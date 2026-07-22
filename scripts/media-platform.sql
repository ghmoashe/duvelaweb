-- Duvela Media platform extensions. Safe to run more than once.
alter table if exists public.posts add column if not exists media_kind text not null default 'video';
alter table if exists public.posts add column if not exists duration_seconds integer;
alter table if exists public.posts add column if not exists language text;
alter table if exists public.posts add column if not exists published_at timestamptz default now();
alter table if exists public.posts add column if not exists subtitle_url text;
alter table if exists public.posts add column if not exists category text;
alter table if exists public.posts drop constraint if exists posts_media_kind_check;
alter table if exists public.posts add constraint posts_media_kind_check check (media_kind in ('video','short','live_replay'));

create table if not exists public.media_subscriptions (
  subscriber_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (subscriber_id, creator_id),
  check (subscriber_id <> creator_id)
);
create table if not exists public.media_watch_later (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.media_watch_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  watched_seconds integer not null default 0,
  last_watched_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.media_hidden_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create table if not exists public.media_blocked_creators (
  user_id uuid not null references auth.users(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, creator_id),
  check (user_id <> creator_id)
);
create table if not exists public.media_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete set null,
  creator_id uuid references auth.users(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);
create table if not exists public.media_live_reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

alter table public.media_subscriptions enable row level security;
alter table public.media_watch_later enable row level security;
alter table public.media_watch_history enable row level security;
alter table public.media_hidden_posts enable row level security;
alter table public.media_blocked_creators enable row level security;
alter table public.media_reports enable row level security;
alter table public.media_live_reminders enable row level security;

drop policy if exists media_subscriptions_own_all on public.media_subscriptions;
create policy media_subscriptions_own_all on public.media_subscriptions for all to authenticated
  using (subscriber_id = auth.uid()) with check (subscriber_id = auth.uid());
drop policy if exists media_watch_later_own_all on public.media_watch_later;
create policy media_watch_later_own_all on public.media_watch_later for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists media_watch_history_own_all on public.media_watch_history;
create policy media_watch_history_own_all on public.media_watch_history for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists media_hidden_posts_own_all on public.media_hidden_posts;
create policy media_hidden_posts_own_all on public.media_hidden_posts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists media_blocked_creators_own_all on public.media_blocked_creators;
create policy media_blocked_creators_own_all on public.media_blocked_creators for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists media_live_reminders_own_all on public.media_live_reminders;
create policy media_live_reminders_own_all on public.media_live_reminders for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists media_reports_insert_own on public.media_reports;
create policy media_reports_insert_own on public.media_reports for insert to authenticated with check (reporter_id = auth.uid());
drop policy if exists media_reports_select_own on public.media_reports;
create policy media_reports_select_own on public.media_reports for select to authenticated using (reporter_id = auth.uid());

create index if not exists media_watch_history_user_time_idx on public.media_watch_history(user_id,last_watched_at desc);
create index if not exists media_subscriptions_creator_idx on public.media_subscriptions(creator_id);
create index if not exists media_reports_status_idx on public.media_reports(status,created_at desc);
