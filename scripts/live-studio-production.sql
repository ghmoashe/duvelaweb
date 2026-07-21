-- Duvela LIVE Studio production persistence.
-- Safe to run repeatedly after duvela-web-supabase.sql and live-studio-enhancements.sql.

create table if not exists public.live_materials (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 180),
  public_url text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null default 0 check (size_bytes >= 0 and size_bytes <= 52428800),
  created_at timestamptz not null default now()
);
create index if not exists live_materials_session_created_idx on public.live_materials(session_id,created_at desc);
alter table public.live_materials enable row level security;
drop policy if exists "live room members read materials" on public.live_materials;
create policy "live room members read materials" on public.live_materials for select to authenticated using (
  teacher_id=auth.uid() or exists(select 1 from public.live_participants p where p.session_id=live_materials.session_id and p.user_id=auth.uid())
);
drop policy if exists "teachers manage live materials" on public.live_materials;
create policy "teachers manage live materials" on public.live_materials for all to authenticated
using (teacher_id=auth.uid() and exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid()))
with check (teacher_id=auth.uid() and exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid()));

create table if not exists public.live_polls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 300),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists live_polls_session_created_idx on public.live_polls(session_id,created_at desc);

create table if not exists public.live_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.live_polls(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 160),
  position smallint not null check (position between 0 and 19),
  unique(poll_id,position)
);

create table if not exists public.live_poll_votes (
  poll_id uuid not null references public.live_polls(id) on delete cascade,
  option_id uuid not null references public.live_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(poll_id,user_id)
);
create index if not exists live_poll_votes_option_idx on public.live_poll_votes(option_id);

alter table public.live_polls enable row level security;
alter table public.live_poll_options enable row level security;
alter table public.live_poll_votes enable row level security;
drop policy if exists "authenticated read live polls" on public.live_polls;
create policy "authenticated read live polls" on public.live_polls for select to authenticated using (true);
drop policy if exists "teachers manage live polls" on public.live_polls;
create policy "teachers manage live polls" on public.live_polls for all to authenticated using (teacher_id=auth.uid()) with check (teacher_id=auth.uid());
drop policy if exists "authenticated read poll options" on public.live_poll_options;
create policy "authenticated read poll options" on public.live_poll_options for select to authenticated using (true);
drop policy if exists "teachers manage poll options" on public.live_poll_options;
create policy "teachers manage poll options" on public.live_poll_options for all to authenticated using (
  exists(select 1 from public.live_polls p where p.id=poll_id and p.teacher_id=auth.uid()))
with check (exists(select 1 from public.live_polls p where p.id=poll_id and p.teacher_id=auth.uid()));
drop policy if exists "authenticated read poll votes" on public.live_poll_votes;
create policy "authenticated read poll votes" on public.live_poll_votes for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.live_polls p where p.id=poll_id and p.teacher_id=auth.uid())
);
drop policy if exists "learners cast one poll vote" on public.live_poll_votes;
create policy "learners cast one poll vote" on public.live_poll_votes for insert to authenticated with check (
  user_id=auth.uid() and exists(
    select 1 from public.live_polls p join public.live_poll_options o on o.poll_id=p.id
    where p.id=live_poll_votes.poll_id and o.id=live_poll_votes.option_id and p.status='open'
  )
);

create table if not exists public.live_quality_samples (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','viewer','guest')),
  network_quality text not null check (network_quality in ('excellent','good','fair','poor','offline')),
  rtt_ms integer,
  send_bitrate integer,
  receive_bitrate integer,
  packet_loss numeric(5,2),
  created_at timestamptz not null default now()
);
create index if not exists live_quality_samples_session_created_idx on public.live_quality_samples(session_id,created_at desc);
alter table public.live_quality_samples enable row level security;
drop policy if exists "users add own quality samples" on public.live_quality_samples;
create policy "users add own quality samples" on public.live_quality_samples for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "teachers read room quality" on public.live_quality_samples;
create policy "teachers read room quality" on public.live_quality_samples for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid())
);

create table if not exists public.live_subtitle_segments (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  language text,
  created_at timestamptz not null default now()
);
create index if not exists live_subtitle_segments_session_created_idx on public.live_subtitle_segments(session_id,created_at);
alter table public.live_subtitle_segments enable row level security;
drop policy if exists "room members read subtitles" on public.live_subtitle_segments;
create policy "room members read subtitles" on public.live_subtitle_segments for select to authenticated using (
  teacher_id=auth.uid() or exists(select 1 from public.live_participants p where p.session_id=live_subtitle_segments.session_id and p.user_id=auth.uid())
);
