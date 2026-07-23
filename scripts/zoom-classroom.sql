-- Duvela Classroom: Zoom Video SDK for group lessons.
-- Agora live_sessions remains the separate broadcast/gifts product.

alter table if exists public.class_sessions
  add column if not exists provider text not null default 'zoom',
  add column if not exists session_name text default ('duvela-class-' || gen_random_uuid()::text),
  add column if not exists max_participants integer not null default 25;

update public.class_sessions
set session_name = 'duvela-class-' || id::text
where session_name is null;

alter table if exists public.class_sessions
  alter column session_name set default ('duvela-class-' || gen_random_uuid()::text),
  alter column session_name set not null;

create unique index if not exists class_sessions_session_name_key
  on public.class_sessions(session_name);

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
