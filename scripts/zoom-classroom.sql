-- Duvela Zoom Classroom schema
-- Apply once in Supabase SQL Editor after the base Duvela schema.
-- Safe to run repeatedly.

create extension if not exists "pgcrypto";

-- Course flags used by the business course editor.
alter table public.courses
  add column if not exists zoom_enabled boolean not null default false,
  add column if not exists delivery_mode text not null default 'self_paced',
  add column if not exists max_students integer not null default 25;

alter table public.courses drop constraint if exists courses_delivery_mode_check;
alter table public.courses
  add constraint courses_delivery_mode_check
  check (delivery_mode in ('self_paced', 'zoom_group', 'mixed'));

-- A class is the private study group generated for a Zoom-enabled course.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null default 'Duvela class',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_status_check check (status in ('active', 'archived'))
);

alter table public.classes
  add column if not exists course_id uuid references public.courses(id) on delete cascade,
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists name text not null default 'Duvela class',
  add column if not exists description text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists classes_course_idx on public.classes(course_id);
create index if not exists classes_created_by_idx on public.classes(created_by);

-- Students/clients attached to a class.
create table if not exists public.class_clients (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, client_id),
  constraint class_clients_status_check check (status in ('active', 'pending', 'removed'))
);

alter table public.class_clients
  add column if not exists status text not null default 'active',
  add column if not exists added_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists class_clients_client_idx on public.class_clients(client_id);

-- Individual Zoom Video SDK sessions.
create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null default 'Zoom lesson',
  starts_at timestamptz not null,
  ends_at timestamptz,
  join_opens_at timestamptz,
  duration_min integer not null default 60,
  status text not null default 'scheduled',
  provider text not null default 'zoom',
  session_name text,
  password text,
  recurrence_group_id uuid,
  max_participants integer not null default 25,
  waiting_room_enabled boolean not null default true,
  cancellation_reason text,
  cancelled_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_status_check check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  constraint class_sessions_provider_check check (provider in ('zoom')),
  constraint class_sessions_duration_check check (duration_min between 15 and 240)
);

alter table public.class_sessions
  add column if not exists ends_at timestamptz,
  add column if not exists join_opens_at timestamptz,
  add column if not exists duration_min integer not null default 60,
  add column if not exists status text not null default 'scheduled',
  add column if not exists provider text not null default 'zoom',
  add column if not exists session_name text,
  add column if not exists password text,
  add column if not exists recurrence_group_id uuid,
  add column if not exists max_participants integer not null default 25,
  add column if not exists waiting_room_enabled boolean not null default true,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.class_sessions
set session_name = coalesce(session_name, 'duvela-class-' || id::text),
    ends_at = coalesce(ends_at, starts_at + (duration_min || ' minutes')::interval),
    join_opens_at = coalesce(join_opens_at, starts_at - interval '30 minutes')
where session_name is null
   or ends_at is null
   or join_opens_at is null;

create index if not exists class_sessions_class_starts_idx on public.class_sessions(class_id, starts_at);
create index if not exists class_sessions_teacher_starts_idx on public.class_sessions(created_by, starts_at);
create index if not exists class_sessions_status_starts_idx on public.class_sessions(status, starts_at);

-- Waiting room requests when the teacher requires manual admission.
create table if not exists public.class_waiting_room (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  unique (session_id, user_id),
  constraint class_waiting_room_status_check check (status in ('waiting', 'admitted', 'denied'))
);

create index if not exists class_waiting_room_session_status_idx
  on public.class_waiting_room(session_id, status);

-- Attendance is updated by the classroom client through record_class_attendance().
create table if not exists public.class_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'present',
  joined_at timestamptz,
  left_at timestamptz,
  last_seen_at timestamptz,
  duration_seconds integer not null default 0,
  connection_count integer not null default 0,
  marked_by uuid references auth.users(id) on delete set null,
  marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, client_id),
  constraint class_attendance_status_check check (status in ('present', 'absent', 'late', 'left', 'unknown'))
);

create index if not exists class_attendance_session_idx on public.class_attendance(session_id);

create table if not exists public.class_session_materials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  title text not null,
  file_url text not null,
  mime_type text,
  allow_download boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists class_session_materials_session_idx
  on public.class_session_materials(session_id, sort_order, created_at);

create table if not exists public.class_session_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating integer,
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id),
  constraint class_session_reviews_rating_check check (rating is null or rating between 1 and 5)
);

create or replace function public.record_class_attendance(target_session uuid, event_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing public.class_attendance%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into existing
  from public.class_attendance
  where session_id = target_session
    and client_id = current_user_id
  for update;

  if event_name = 'join' then
    insert into public.class_attendance (
      session_id, client_id, status, joined_at, last_seen_at, connection_count, updated_at
    )
    values (target_session, current_user_id, 'present', now(), now(), 1, now())
    on conflict (session_id, client_id) do update
      set status = 'present',
          joined_at = coalesce(public.class_attendance.joined_at, now()),
          last_seen_at = now(),
          connection_count = public.class_attendance.connection_count + 1,
          updated_at = now();
    return;
  end if;

  if event_name = 'heartbeat' then
    if existing.id is null then
      insert into public.class_attendance (
        session_id, client_id, status, joined_at, last_seen_at, connection_count, updated_at
      )
      values (target_session, current_user_id, 'present', now(), now(), 1, now());
    else
      update public.class_attendance
      set duration_seconds = greatest(
            duration_seconds,
            extract(epoch from (now() - coalesce(joined_at, now())))::integer
          ),
          last_seen_at = now(),
          updated_at = now()
      where id = existing.id;
    end if;
    return;
  end if;

  if event_name = 'leave' then
    update public.class_attendance
    set left_at = now(),
        last_seen_at = now(),
        duration_seconds = greatest(
          duration_seconds,
          extract(epoch from (now() - coalesce(joined_at, now())))::integer
        ),
        updated_at = now()
    where session_id = target_session
      and client_id = current_user_id;
    return;
  end if;

  raise exception 'Unsupported attendance event: %', event_name;
end;
$$;

grant execute on function public.record_class_attendance(uuid, text) to authenticated;

create or replace function public.dispatch_zoom_course_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  created_count integer := 0;
begin
  if to_regclass('public.notifications') is null then
    return 0;
  end if;

  insert into public.notifications (user_id, type, title, body)
  select distinct cc.client_id,
    'zoom_class_reminder',
    'Zoom lesson starts soon',
    coalesce(cs.title, 'Your Zoom lesson') || ' starts soon.'
  from public.class_sessions cs
  join public.class_clients cc on cc.class_id = cs.class_id and cc.status <> 'removed'
  where cs.provider = 'zoom'
    and cs.status = 'scheduled'
    and cs.starts_at between now() and now() + interval '30 minutes'
    and cs.reminder_sent_at is null;

  get diagnostics created_count = row_count;

  update public.class_sessions
  set reminder_sent_at = now()
  where provider = 'zoom'
    and status = 'scheduled'
    and starts_at between now() and now() + interval '30 minutes'
    and reminder_sent_at is null;

  return created_count;
end;
$$;

revoke all on function public.dispatch_zoom_course_reminders() from public, anon, authenticated;
grant execute on function public.dispatch_zoom_course_reminders() to service_role;

-- RLS: classroom data is private to teachers and enrolled/attached learners.
alter table public.classes enable row level security;
alter table public.class_clients enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_waiting_room enable row level security;
alter table public.class_attendance enable row level security;
alter table public.class_session_materials enable row level security;
alter table public.class_session_reviews enable row level security;

create or replace function public.can_access_class(target_class uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = target_class
      and c.created_by = auth.uid()
  )
  or exists (
    select 1 from public.class_clients cc
    where cc.class_id = target_class
      and cc.client_id = auth.uid()
      and cc.status <> 'removed'
  );
$$;

drop policy if exists "classes_access" on public.classes;
create policy "classes_access" on public.classes
  for all to authenticated
  using (public.can_access_class(id))
  with check (created_by = auth.uid() or public.can_access_class(id));

drop policy if exists "class_clients_access" on public.class_clients;
create policy "class_clients_access" on public.class_clients
  for all to authenticated
  using (public.can_access_class(class_id))
  with check (public.can_access_class(class_id));

drop policy if exists "class_sessions_access" on public.class_sessions;
create policy "class_sessions_access" on public.class_sessions
  for all to authenticated
  using (public.can_access_class(class_id))
  with check (public.can_access_class(class_id));

drop policy if exists "class_waiting_room_access" on public.class_waiting_room;
create policy "class_waiting_room_access" on public.class_waiting_room
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and cs.created_by = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and cs.created_by = auth.uid()
    )
  );

drop policy if exists "class_attendance_access" on public.class_attendance;
create policy "class_attendance_access" on public.class_attendance
  for all to authenticated
  using (
    client_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and cs.created_by = auth.uid()
    )
  )
  with check (
    client_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and cs.created_by = auth.uid()
    )
  );

drop policy if exists "class_session_materials_access" on public.class_session_materials;
create policy "class_session_materials_access" on public.class_session_materials
  for all to authenticated
  using (
    exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and public.can_access_class(cs.class_id)
    )
  )
  with check (
    exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and cs.created_by = auth.uid()
    )
  );

drop policy if exists "class_session_reviews_access" on public.class_session_reviews;
create policy "class_session_reviews_access" on public.class_session_reviews
  for all to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.class_sessions cs
      where cs.id = session_id
        and cs.created_by = auth.uid()
    )
  )
  with check (user_id = auth.uid());
