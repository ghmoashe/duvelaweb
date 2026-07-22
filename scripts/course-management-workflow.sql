-- Duvela course workflow: notify enrolled learners when a course is published.
-- Run once in Supabase SQL Editor after duvela-web-supabase.sql and
-- live-audience-notifications.sql.

alter table public.courses drop constraint if exists courses_status_check;
alter table public.courses add constraint courses_status_check
  check (status in ('draft', 'active', 'closed', 'completed', 'archived'));

create or replace function public.notify_course_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into public.notifications (user_id, type, title, body)
    select distinct enrollment.user_id,
      'course_published',
      'Курс опубликован',
      coalesce(new.title, 'Ваш курс') || ' теперь доступен для обучения.'
    from public.course_enrollments enrollment
    where enrollment.course_id = new.id
      and enrollment.status in ('pending', 'confirmed');
  end if;
  return new;
end;
$$;

drop trigger if exists courses_notify_published on public.courses;
create trigger courses_notify_published
after insert or update of status on public.courses
for each row execute function public.notify_course_published();
