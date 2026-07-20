-- Duvela LIVE Studio: moderators, reactions and audience analytics.
create table if not exists public.live_moderators (
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(session_id,user_id)
);
alter table public.live_moderators add column if not exists session_id uuid references public.live_sessions(id) on delete cascade;
alter table public.live_moderators add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.live_moderators add column if not exists added_by uuid references auth.users(id) on delete cascade;
alter table public.live_moderators add column if not exists created_at timestamptz not null default now();
create unique index if not exists live_moderators_session_user_uidx on public.live_moderators(session_id,user_id);
alter table public.live_moderators enable row level security;
drop policy if exists "session members view moderators" on public.live_moderators;
create policy "session members view moderators" on public.live_moderators for select to authenticated using (
  user_id=auth.uid() or added_by=auth.uid() or exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid()));
drop policy if exists "teachers manage moderators" on public.live_moderators;
create policy "teachers manage moderators" on public.live_moderators for all to authenticated
  using(exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid()))
  with check(exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid()) and added_by=auth.uid());

create table if not exists public.live_reactions (
  id uuid primary key default gen_random_uuid(), session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, emoji text not null check(char_length(emoji) between 1 and 12),
  created_at timestamptz not null default now()
);
alter table public.live_reactions add column if not exists session_id uuid references public.live_sessions(id) on delete cascade;
alter table public.live_reactions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.live_reactions add column if not exists emoji text;
alter table public.live_reactions add column if not exists created_at timestamptz not null default now();
create index if not exists live_reactions_session_created_idx on public.live_reactions(session_id,created_at desc);
alter table public.live_reactions enable row level security;
drop policy if exists "authenticated view live reactions" on public.live_reactions;
create policy "authenticated view live reactions" on public.live_reactions for select to authenticated using(true);
drop policy if exists "users send live reactions" on public.live_reactions;
create policy "users send live reactions" on public.live_reactions for insert to authenticated with check(user_id=auth.uid());

create table if not exists public.live_session_analytics (
  session_id uuid primary key references public.live_sessions(id) on delete cascade,
  peak_viewers integer not null default 0, total_joins integer not null default 0, reaction_count integer not null default 0,
  message_count integer not null default 0, guest_count integer not null default 0, technical_events integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.live_session_analytics add column if not exists session_id uuid references public.live_sessions(id) on delete cascade;
alter table public.live_session_analytics add column if not exists peak_viewers integer not null default 0;
alter table public.live_session_analytics add column if not exists total_joins integer not null default 0;
alter table public.live_session_analytics add column if not exists reaction_count integer not null default 0;
alter table public.live_session_analytics add column if not exists message_count integer not null default 0;
alter table public.live_session_analytics add column if not exists guest_count integer not null default 0;
alter table public.live_session_analytics add column if not exists technical_events integer not null default 0;
alter table public.live_session_analytics add column if not exists updated_at timestamptz not null default now();
create unique index if not exists live_session_analytics_session_uidx on public.live_session_analytics(session_id);
alter table public.live_session_analytics enable row level security;
drop policy if exists "teachers view own live analytics" on public.live_session_analytics;
create policy "teachers view own live analytics" on public.live_session_analytics for select to authenticated using(
  exists(select 1 from public.live_sessions s where s.id=session_id and s.teacher_id=auth.uid()));

create or replace function public.update_live_audience_metrics(target_session_id uuid,current_viewers integer,join_increment integer default 0)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.live_participants p where p.session_id=target_session_id and p.user_id=auth.uid())
     and not exists(select 1 from public.live_sessions s where s.id=target_session_id and s.teacher_id=auth.uid()) then
    raise exception 'Session access denied';
  end if;
  insert into public.live_session_analytics(session_id,peak_viewers,total_joins)
  values(target_session_id,greatest(current_viewers,0),greatest(join_increment,0))
  on conflict(session_id) do update set peak_viewers=greatest(live_session_analytics.peak_viewers,excluded.peak_viewers),
    total_joins=live_session_analytics.total_joins+excluded.total_joins,updated_at=now();
end $$;
grant execute on function public.update_live_audience_metrics(uuid,integer,integer) to authenticated;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_reactions') then
    alter publication supabase_realtime add table public.live_reactions;
  end if;
exception when undefined_object then null; when duplicate_object then null; end $$;
