-- Course Detail 5.1: server-authoritative availability and free enrollment.
alter table if exists public.courses
  add column if not exists enrollment_open boolean not null default true,
  add column if not exists enrollment_requires_approval boolean not null default true;

create or replace function public.course_enrollment_summary(p_course_id uuid)
returns table (
  enrollment_open boolean,
  requires_approval boolean,
  capacity integer,
  enrolled_count integer,
  remaining_places integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_enrolled integer;
begin
  select * into v_course
  from public.courses
  where id = p_course_id
    and status = 'active'
    and is_test = false;

  if not found then
    return;
  end if;

  select count(*)::integer into v_enrolled
  from public.course_enrollments
  where course_id = p_course_id
    and status in ('pending', 'confirmed');

  return query select
    v_course.enrollment_open,
    v_course.enrollment_requires_approval,
    v_course.max_students,
    v_enrolled,
    case when v_course.max_students is null then null else greatest(v_course.max_students - v_enrolled, 0) end;
end;
$$;

create or replace function public.enroll_free_course(p_course_id uuid)
returns table (status text, remaining_places integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_status text;
  v_enrolled integer;
  v_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to enroll.' using errcode = '42501';
  end if;

  -- Locking the course row serializes capacity checks for this course.
  select * into v_course
  from public.courses
  where id = p_course_id
  for update;

  if not found or v_course.status <> 'active' or v_course.is_test then
    raise exception 'This course is not available for enrollment.';
  end if;
  if not v_course.enrollment_open then
    raise exception 'Enrollment is closed for this course.';
  end if;
  if coalesce(v_course.price, 0) <> 0 then
    raise exception 'Payment is required before enrollment.';
  end if;

  select status into v_status
  from public.course_enrollments
  where course_id = p_course_id
    and user_id = auth.uid();

  if v_status in ('pending', 'confirmed') then
    select count(*)::integer into v_enrolled
    from public.course_enrollments
    where course_id = p_course_id and status in ('pending', 'confirmed');
    v_remaining := case when v_course.max_students is null then null else greatest(v_course.max_students - v_enrolled, 0) end;
    return query select v_status, v_remaining;
    return;
  end if;

  select count(*)::integer into v_enrolled
  from public.course_enrollments
  where course_id = p_course_id and status in ('pending', 'confirmed');

  if v_course.max_students is not null and v_enrolled >= v_course.max_students then
    raise exception 'No places are available for this course.';
  end if;

  v_status := case when v_course.enrollment_requires_approval then 'pending' else 'confirmed' end;
  insert into public.course_enrollments (course_id, user_id, status, updated_at)
  values (p_course_id, auth.uid(), v_status, now())
  on conflict (course_id, user_id) do update
    set status = excluded.status, updated_at = now();

  v_remaining := case when v_course.max_students is null then null else greatest(v_course.max_students - v_enrolled - 1, 0) end;
  return query select v_status, v_remaining;
end;
$$;

revoke all on function public.course_enrollment_summary(uuid) from public;
revoke all on function public.enroll_free_course(uuid) from public;
grant execute on function public.course_enrollment_summary(uuid) to anon, authenticated;
grant execute on function public.enroll_free_course(uuid) to authenticated;
