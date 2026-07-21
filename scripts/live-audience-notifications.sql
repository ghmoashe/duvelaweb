-- Duvela LIVE: reliable online presence and one notification per LIVE session.
alter table public.live_participants
  add column if not exists updated_at timestamptz not null default now();

create index if not exists live_participants_online_idx
  on public.live_participants (session_id, left_at, updated_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.live_start_notification_dispatches (
  session_id uuid primary key references public.live_sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.live_start_notification_dispatches enable row level security;
drop policy if exists "teachers view own live notification dispatches" on public.live_start_notification_dispatches;
create policy "teachers view own live notification dispatches" on public.live_start_notification_dispatches
  for select to authenticated using (teacher_id = auth.uid());

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when undefined_object then null; when duplicate_object then null; end $$;
