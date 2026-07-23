-- Duvela Classroom: Zoom Video SDK for group lessons.
-- Agora live_sessions remains the separate broadcast/gifts product.

alter table if exists public.class_sessions
  add column if not exists provider text not null default 'zoom',
  add column if not exists session_name text default ('duvela-class-' || gen_random_uuid()::text),
  add column if not exists max_participants integer not null default 25,
  add column if not exists duration_min integer not null default 60,
  add column if not exists ends_at timestamptz,
  add column if not exists join_opens_at timestamptz,
  add column if not exists recurrence_group_id uuid,
  add column if not exists waiting_room_enabled boolean not null default true,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.class_sessions
set session_name = 'duvela-class-' || id::text
where session_name is null;

alter table if exists public.class_sessions
  alter column session_name set default ('duvela-class-' || gen_random_uuid()::text),
  alter column session_name set not null;

create unique index if not exists class_sessions_session_name_key
  on public.class_sessions(session_name);
create unique index if not exists class_sessions_class_start_key
  on public.class_sessions(class_id, starts_at);

alter table if exists public.class_sessions
  drop constraint if exists class_sessions_provider_check;
alter table if exists public.class_sessions
  add constraint class_sessions_provider_check check (provider in ('zoom'));

alter table if exists public.class_sessions
  drop constraint if exists class_sessions_max_participants_check;
alter table if exists public.class_sessions
  add constraint class_sessions_max_participants_check check (max_participants between 2 and 25);

alter table public.class_sessions enable row level security;

drop policy if exists "class members see sessions" on public.class_sessions;
create policy "class members see sessions" on public.class_sessions
for select to authenticated using (
  created_by = auth.uid()
  or exists (
    select 1 from public.class_clients cc
    where cc.class_id = class_sessions.class_id
      and cc.client_id = auth.uid()
      and cc.status <> 'removed'
  )
);

drop policy if exists "teachers create class sessions" on public.class_sessions;
create policy "teachers create class sessions" on public.class_sessions
for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "teachers update class sessions" on public.class_sessions;
create policy "teachers update class sessions" on public.class_sessions
for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "teachers delete class sessions" on public.class_sessions;
create policy "teachers delete class sessions" on public.class_sessions
for delete to authenticated using (created_by = auth.uid());

comment on column public.class_sessions.provider is
  'Group classrooms use Zoom Video SDK. Mass broadcasts use public.live_sessions and Agora.';

update public.class_sessions
set join_opens_at = starts_at - interval '30 minutes',
    ends_at = coalesce(ends_at, starts_at + make_interval(mins => duration_min))
where starts_at is not null;

create table if not exists public.class_waiting_room (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','admitted','denied')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  unique(session_id,user_id)
);

alter table public.class_waiting_room enable row level security;
drop policy if exists "participants see own waiting state" on public.class_waiting_room;
create policy "participants see own waiting state" on public.class_waiting_room
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.class_sessions s where s.id = session_id and s.created_by = auth.uid()
  )
);
drop policy if exists "teachers manage waiting room" on public.class_waiting_room;
create policy "teachers manage waiting room" on public.class_waiting_room
for update to authenticated using (
  exists (select 1 from public.class_sessions s where s.id = session_id and s.created_by = auth.uid())
) with check (
  exists (select 1 from public.class_sessions s where s.id = session_id and s.created_by = auth.uid())
);

alter table if exists public.class_attendance
  add column if not exists joined_at timestamptz,
  add column if not exists left_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists duration_seconds integer not null default 0,
  add column if not exists connection_count integer not null default 0;

create or replace function public.record_class_attendance(target_session uuid, event_name text)
returns void language plpgsql security definer set search_path = public as $$
declare current_row public.class_attendance%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.class_sessions s
    join public.classes c on c.id = s.class_id
    left join public.course_enrollments e on e.course_id = c.course_id and e.user_id = auth.uid() and e.status = 'confirmed'
    left join public.class_clients cc on cc.class_id = c.id and cc.client_id = auth.uid() and cc.status <> 'removed'
    where s.id = target_session and (s.created_by = auth.uid() or e.id is not null or cc.id is not null)
  ) then raise exception 'Classroom access denied'; end if;

  select * into current_row from public.class_attendance
  where session_id = target_session and client_id = auth.uid() for update;
  if not found then
    insert into public.class_attendance(session_id,client_id,status,marked_by,marked_at,joined_at,last_seen_at,connection_count)
    values(target_session,auth.uid(),'present',auth.uid(),now(),now(),now(),1);
  elsif event_name = 'join' then
    update public.class_attendance set
      status='present', joined_at=coalesce(joined_at,now()), last_seen_at=now(),
      connection_count=connection_count+1
    where session_id=target_session and client_id=auth.uid();
  elsif event_name = 'leave' then
    update public.class_attendance set
      duration_seconds=duration_seconds + greatest(0,extract(epoch from (now()-coalesce(last_seen_at,now())))::integer),
      last_seen_at=now(), left_at=now()
    where session_id=target_session and client_id=auth.uid();
  else
    update public.class_attendance set
      duration_seconds=duration_seconds + greatest(0,least(90,extract(epoch from (now()-coalesce(last_seen_at,now())))::integer)),
      last_seen_at=now()
    where session_id=target_session and client_id=auth.uid();
  end if;
end $$;
grant execute on function public.record_class_attendance(uuid,text) to authenticated;

create table if not exists public.class_session_notifications (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('24h','1h','started','rescheduled','cancelled')),
  title text not null,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(session_id,user_id,kind)
);
alter table public.class_session_notifications enable row level security;
drop policy if exists "users see classroom notifications" on public.class_session_notifications;
create policy "users see classroom notifications" on public.class_session_notifications
for select to authenticated using (user_id=auth.uid());
drop policy if exists "users mark classroom notifications read" on public.class_session_notifications;
create policy "users mark classroom notifications read" on public.class_session_notifications
for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.notify_class_members()
returns trigger language plpgsql security definer set search_path=public as $$
declare notice_kind text; notice_body text;
begin
  if tg_op='UPDATE' and new.status='cancelled' and old.status is distinct from new.status then
    notice_kind := 'cancelled'; notice_body := coalesce(new.cancellation_reason,'The lesson was cancelled.');
  elsif tg_op='UPDATE' and new.status='live' and old.status is distinct from new.status then
    notice_kind := 'started'; notice_body := 'The lesson has started. You can enter now.';
  elsif tg_op='UPDATE' and new.starts_at is distinct from old.starts_at then
    notice_kind := 'rescheduled'; notice_body := 'The lesson time has changed.';
  else return new; end if;
  insert into public.class_session_notifications(session_id,user_id,kind,title,body)
  select new.id,cc.client_id,notice_kind,new.title,notice_body
  from public.class_clients cc where cc.class_id=new.class_id and cc.status<>'removed'
  on conflict(session_id,user_id,kind) do update set body=excluded.body,created_at=now(),read_at=null;
  insert into public.notifications(user_id,type,title,body)
  select cc.client_id,'zoom_class_'||notice_kind,new.title,notice_body
  from public.class_clients cc where cc.class_id=new.class_id and cc.status<>'removed';
  return new;
end $$;
drop trigger if exists class_session_member_notice on public.class_sessions;
create trigger class_session_member_notice after update on public.class_sessions
for each row execute function public.notify_class_members();

create or replace function public.dispatch_zoom_course_reminders()
returns integer language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
  insert into public.class_session_notifications(session_id,user_id,kind,title,body)
  select s.id,cc.client_id,
    case when s.starts_at between now()+interval '23 hours 45 minutes' and now()+interval '24 hours 15 minutes' then '24h' else '1h' end,
    s.title,
    case when s.starts_at > now()+interval '2 hours' then 'Your lesson starts in 24 hours.' else 'Your lesson starts in 1 hour.' end
  from public.class_sessions s join public.class_clients cc on cc.class_id=s.class_id and cc.status<>'removed'
  where s.status='scheduled' and (
    s.starts_at between now()+interval '23 hours 45 minutes' and now()+interval '24 hours 15 minutes'
    or s.starts_at between now()+interval '45 minutes' and now()+interval '75 minutes'
  ) on conflict(session_id,user_id,kind) do nothing;
  get diagnostics inserted_count = row_count;
  insert into public.notifications(user_id,type,title,body)
  select n.user_id,'zoom_class_'||n.kind,n.title,n.body
  from public.class_session_notifications n
  where n.created_at >= now()-interval '2 minutes' and n.kind in ('24h','1h')
    and not exists (
      select 1 from public.notifications x
      where x.user_id=n.user_id and x.type='zoom_class_'||n.kind and x.title=n.title
        and x.created_at >= now()-interval '30 minutes'
    );
  return inserted_count;
end $$;

-- Connect a published course directly to its Zoom study group.
alter table if exists public.courses
  add column if not exists delivery_mode text not null default 'self_paced',
  add column if not exists zoom_enabled boolean not null default false,
  add column if not exists max_students integer not null default 25;

alter table if exists public.courses
  drop constraint if exists courses_delivery_mode_check;
alter table if exists public.courses
  add constraint courses_delivery_mode_check
  check (delivery_mode in ('self_paced', 'zoom_group', 'mixed'));

alter table if exists public.courses
  drop constraint if exists courses_max_students_check;
alter table if exists public.courses
  add constraint courses_max_students_check check (max_students between 2 and 25);

alter table if exists public.classes
  add column if not exists course_id uuid references public.courses(id) on delete cascade;

create unique index if not exists classes_course_id_key
  on public.classes(course_id) where course_id is not null;

create or replace function public.sync_course_enrollment_to_zoom_group()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_class uuid;
begin
  select id into target_class from public.classes where course_id = new.course_id limit 1;
  if target_class is not null and new.status = 'confirmed' then
    insert into public.class_clients(class_id, client_id, status)
    values(target_class, new.user_id, 'active')
    on conflict(class_id, client_id) do update set status = 'active';
  elsif target_class is not null and new.status = 'cancelled' then
    update public.class_clients
    set status = 'removed'
    where class_id = target_class and client_id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists course_enrollment_adds_zoom_group on public.course_enrollments;
create trigger course_enrollment_adds_zoom_group
after insert or update of status on public.course_enrollments
for each row execute function public.sync_course_enrollment_to_zoom_group();
