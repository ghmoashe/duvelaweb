alter table public.live_participants drop constraint if exists live_participants_role_check;
alter table public.live_participants
  add constraint live_participants_role_check check (role in ('host', 'audience', 'moderator', 'guest'));

create table if not exists public.live_guest_requests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, requester_id),
  constraint live_guest_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled', 'ended'))
);

create index if not exists live_guest_requests_session_status_idx
  on public.live_guest_requests (session_id, status, requested_at);

alter table public.live_guest_requests enable row level security;

drop policy if exists "live_guest_requests_select_authenticated" on public.live_guest_requests;
create policy "live_guest_requests_select_authenticated"
  on public.live_guest_requests
  for select
  to authenticated
  using (true);

drop policy if exists "live_guest_requests_insert_self" on public.live_guest_requests;
create policy "live_guest_requests_insert_self"
  on public.live_guest_requests
  for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1
      from public.live_sessions session
      where session.id = live_guest_requests.session_id
        and session.status = 'live'
        and session.is_private = false
        and session.allow_guest_requests = true
        and session.teacher_id <> auth.uid()
    )
  );

drop policy if exists "live_guest_requests_update_self_or_teacher" on public.live_guest_requests;
create policy "live_guest_requests_update_self_or_teacher"
  on public.live_guest_requests
  for update
  to authenticated
  using (
    requester_id = auth.uid()
    or exists (
      select 1
      from public.live_sessions session
      where session.id = live_guest_requests.session_id
        and session.teacher_id = auth.uid()
        and public.can_host_live_session(auth.uid())
    )
  )
  with check (
    requester_id = auth.uid()
    or exists (
      select 1
      from public.live_sessions session
      where session.id = live_guest_requests.session_id
        and session.teacher_id = auth.uid()
        and public.can_host_live_session(auth.uid())
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_guest_requests'
  ) then
    alter publication supabase_realtime add table public.live_guest_requests;
  end if;
exception
  when undefined_object then null;
  when duplicate_object then null;
end;
$$;
