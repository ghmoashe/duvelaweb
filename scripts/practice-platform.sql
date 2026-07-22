-- Duvela Practice 2.0 shared mobile/web persistence.
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id text not null, tool_id text not null, language text not null default 'de', level text,
  status text not null default 'active' check(status in ('active','completed','abandoned')),
  current_step integer not null default 0, score integer not null default 0, total integer not null default 0,
  duration_seconds integer not null default 0, xp_awarded integer not null default 0,
  state jsonb not null default '{}'::jsonb, started_at timestamptz not null default now(), completed_at timestamptz,
  unique(user_id,client_session_id)
);
create table if not exists public.practice_progress (
  user_id uuid not null references auth.users(id) on delete cascade, tool_id text not null, language text not null default 'de',
  level text, sessions integer not null default 0, correct integer not null default 0, attempted integer not null default 0,
  xp integer not null default 0, best_score integer not null default 0, last_practiced_at timestamptz,
  primary key(user_id,tool_id,language)
);
create table if not exists public.practice_mistakes (
  user_id uuid not null references auth.users(id) on delete cascade, mistake_key text not null, language text not null,
  tool_id text not null, prompt text not null, options jsonb not null default '[]', correct_index integer,
  attempts integer not null default 1, mastered_at timestamptz, updated_at timestamptz not null default now(),
  primary key(user_id,mistake_key)
);
create table if not exists public.practice_saved_words (
  user_id uuid not null references auth.users(id) on delete cascade, language text not null, word text not null,
  translation text, box integer not null default 1, ease numeric not null default 2.5, due_at timestamptz not null default now(),
  repetitions integer not null default 0, updated_at timestamptz not null default now(), primary key(user_id,language,word)
);
create table if not exists public.practice_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade, current_streak integer not null default 0,
  longest_streak integer not null default 0, last_practice_date date, daily_goal integer not null default 1,
  today_sessions integer not null default 0, updated_at timestamptz not null default now()
);
create table if not exists public.practice_achievements (
  user_id uuid not null references auth.users(id) on delete cascade, achievement_id text not null,
  unlocked_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb,
  primary key(user_id,achievement_id)
);
create table if not exists public.practice_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check(status in ('inactive','active','past_due','cancelled')),
  plan text not null default 'premium_monthly', current_period_end timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.practice_reminders (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false, reminder_time time not null default '18:00', timezone text not null default 'Europe/Berlin', updated_at timestamptz not null default now()
);
create table if not exists public.practice_language_settings (
  user_id uuid not null references auth.users(id) on delete cascade, language text not null, level text not null default 'A1', active boolean not null default false,
  updated_at timestamptz not null default now(), primary key(user_id,language)
);
create table if not exists public.practice_feedback (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete set null, practice_id uuid, session_id uuid references public.practice_sessions(id) on delete set null,
  score integer, feedback text, created_at timestamptz not null default now()
);
create table if not exists public.practice_assignments (
  id uuid primary key default gen_random_uuid(), practice_id uuid not null, teacher_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade, due_at timestamptz, status text not null default 'assigned' check(status in ('assigned','submitted','reviewed')),
  created_at timestamptz not null default now(), unique(practice_id,student_id)
);

-- Compatibility migration for projects where these tables were created by an
-- earlier Practice version. CREATE TABLE IF NOT EXISTS does not add columns to
-- an existing table, so add every column used by the current RLS policies.
alter table public.practice_assignments add column if not exists student_id uuid references auth.users(id) on delete cascade;
alter table public.practice_assignments add column if not exists teacher_id uuid references auth.users(id) on delete cascade;
alter table public.practice_assignments add column if not exists practice_id uuid;
alter table public.practice_assignments add column if not exists due_at timestamptz;
alter table public.practice_assignments add column if not exists status text default 'assigned';
alter table public.practice_assignments add column if not exists created_at timestamptz default now();

alter table public.practice_feedback add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.practice_feedback add column if not exists teacher_id uuid references auth.users(id) on delete set null;
alter table public.practice_feedback add column if not exists practice_id uuid;
alter table public.practice_feedback add column if not exists session_id uuid references public.practice_sessions(id) on delete set null;
alter table public.practice_feedback add column if not exists score integer;
alter table public.practice_feedback add column if not exists feedback text;
alter table public.practice_feedback add column if not exists created_at timestamptz default now();

-- Preserve owners from common legacy column names when they are present.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='practice_assignments' and column_name='learner_id') then
    execute 'update public.practice_assignments set student_id=learner_id where student_id is null';
  elsif exists (select 1 from information_schema.columns where table_schema='public' and table_name='practice_assignments' and column_name='user_id') then
    execute 'update public.practice_assignments set student_id=user_id where student_id is null';
  end if;
end $$;
create index if not exists practice_assignments_student_idx on public.practice_assignments(student_id);
create index if not exists practice_assignments_teacher_idx on public.practice_assignments(teacher_id);

create table if not exists public.practice_resume (
  user_id uuid primary key references auth.users(id) on delete cascade, tool_id text not null, language text not null default 'de',
  level text, current_step integer not null default 0, score integer not null default 0, state jsonb not null default '{}'::jsonb,
  client_session_id text, updated_at timestamptz not null default now()
);
create table if not exists public.practice_submissions (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete set null, assignment_id uuid, tool_id text not null,
  submission_type text not null check(submission_type in ('speaking','writing')), content_text text, media_url text,
  status text not null default 'submitted' check(status in ('submitted','reviewed','returned')),
  score integer, feedback text, created_at timestamptz not null default now(), reviewed_at timestamptz
);
create table if not exists public.practice_challenges (
  id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('duel','team')), created_by uuid not null references auth.users(id) on delete cascade,
  language text not null default 'de', level text not null default 'A1', status text not null default 'waiting' check(status in ('waiting','active','completed','cancelled')),
  goal integer not null default 5, starts_at timestamptz, ends_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.practice_challenge_members (
  challenge_id uuid not null references public.practice_challenges(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0, completed integer not null default 0, joined_at timestamptz not null default now(), primary key(challenge_id,user_id)
);
create index if not exists practice_submissions_student_idx on public.practice_submissions(student_id,created_at desc);
create index if not exists practice_submissions_teacher_idx on public.practice_submissions(teacher_id,status,created_at desc);
create index if not exists practice_challenges_status_idx on public.practice_challenges(kind,status,created_at desc);

alter table public.practice_sessions enable row level security;
alter table public.practice_progress enable row level security;
alter table public.practice_mistakes enable row level security;
alter table public.practice_saved_words enable row level security;
alter table public.practice_streaks enable row level security;
alter table public.practice_achievements enable row level security;
alter table public.practice_subscriptions enable row level security;
alter table public.practice_reminders enable row level security;
alter table public.practice_language_settings enable row level security;
alter table public.practice_feedback enable row level security;
alter table public.practice_assignments enable row level security;
alter table public.practice_resume enable row level security;
alter table public.practice_submissions enable row level security;
alter table public.practice_challenges enable row level security;
alter table public.practice_challenge_members enable row level security;
do $$ declare t text; begin foreach t in array array['practice_sessions','practice_progress','practice_mistakes','practice_saved_words','practice_streaks','practice_achievements','practice_reminders','practice_language_settings'] loop
  execute format('drop policy if exists "users manage own %1$s" on public.%1$I',t);
  execute format('create policy "users manage own %1$s" on public.%1$I for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid())',t);
end loop; end $$;
drop policy if exists "users read own practice subscription" on public.practice_subscriptions;
create policy "users read own practice subscription" on public.practice_subscriptions for select to authenticated using(user_id=auth.uid());
drop policy if exists "users read own practice feedback" on public.practice_feedback;
create policy "users read own practice feedback" on public.practice_feedback for select to authenticated using(user_id=auth.uid() or teacher_id=auth.uid());
drop policy if exists "students and teachers read practice assignments" on public.practice_assignments;
create policy "students and teachers read practice assignments" on public.practice_assignments for select to authenticated using(student_id=auth.uid() or teacher_id=auth.uid());
drop policy if exists "teachers manage practice assignments" on public.practice_assignments;
create policy "teachers manage practice assignments" on public.practice_assignments for all to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
drop policy if exists "users manage own practice resume" on public.practice_resume;
create policy "users manage own practice resume" on public.practice_resume for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "students and teachers read submissions" on public.practice_submissions;
create policy "students and teachers read submissions" on public.practice_submissions for select to authenticated using(student_id=auth.uid() or teacher_id=auth.uid());
drop policy if exists "students create submissions" on public.practice_submissions;
create policy "students create submissions" on public.practice_submissions for insert to authenticated with check(student_id=auth.uid());
drop policy if exists "teachers review submissions" on public.practice_submissions;
create policy "teachers review submissions" on public.practice_submissions for update to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
drop policy if exists "authenticated read challenges" on public.practice_challenges;
create policy "authenticated read challenges" on public.practice_challenges for select to authenticated using(true);
drop policy if exists "users create challenges" on public.practice_challenges;
create policy "users create challenges" on public.practice_challenges for insert to authenticated with check(created_by=auth.uid());
drop policy if exists "creators update challenges" on public.practice_challenges;
create policy "creators update challenges" on public.practice_challenges for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
drop policy if exists "members read challenge members" on public.practice_challenge_members;
create policy "members read challenge members" on public.practice_challenge_members for select to authenticated using(true);
drop policy if exists "users join challenges" on public.practice_challenge_members;
create policy "users join challenges" on public.practice_challenge_members for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "users update own challenge score" on public.practice_challenge_members;
create policy "users update own challenge score" on public.practice_challenge_members for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='practice_challenge_members') then
    alter publication supabase_realtime add table public.practice_challenge_members;
  end if;
end $$;

create or replace function public.complete_practice_session(
  p_client_session_id text,p_tool_id text,p_language text,p_level text,p_score integer,p_total integer,p_duration_seconds integer,p_xp integer,p_state jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); existing public.practice_sessions; today date:=current_date; streak public.practice_streaks;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into existing from public.practice_sessions where user_id=uid and client_session_id=p_client_session_id for update;
  if existing.id is not null and existing.status='completed' then
    return jsonb_build_object('awarded',false,'xp',existing.xp_awarded,'reason','already_completed');
  end if;
  insert into public.practice_sessions(user_id,client_session_id,tool_id,language,level,status,current_step,score,total,duration_seconds,xp_awarded,state,completed_at)
  values(uid,p_client_session_id,p_tool_id,coalesce(p_language,'de'),p_level,'completed',p_total,p_score,p_total,greatest(p_duration_seconds,0),greatest(p_xp,0),coalesce(p_state,'{}'),now())
  on conflict(user_id,client_session_id) do update set status='completed',score=excluded.score,total=excluded.total,duration_seconds=excluded.duration_seconds,xp_awarded=excluded.xp_awarded,state=excluded.state,completed_at=now();
  insert into public.practice_progress(user_id,tool_id,language,level,sessions,correct,attempted,xp,best_score,last_practiced_at)
  values(uid,p_tool_id,coalesce(p_language,'de'),p_level,1,greatest(p_score,0),greatest(p_total,0),greatest(p_xp,0),greatest(p_score,0),now())
  on conflict(user_id,tool_id,language) do update set sessions=practice_progress.sessions+1,correct=practice_progress.correct+excluded.correct,attempted=practice_progress.attempted+excluded.attempted,xp=practice_progress.xp+excluded.xp,best_score=greatest(practice_progress.best_score,excluded.best_score),level=excluded.level,last_practiced_at=now();
  insert into public.practice_streaks(user_id,current_streak,longest_streak,last_practice_date,today_sessions)
  values(uid,1,1,today,1) on conflict(user_id) do update set
    current_streak=case when practice_streaks.last_practice_date=today then practice_streaks.current_streak when practice_streaks.last_practice_date=today-1 then practice_streaks.current_streak+1 else 1 end,
    longest_streak=greatest(practice_streaks.longest_streak,case when practice_streaks.last_practice_date=today-1 then practice_streaks.current_streak+1 else 1 end),
    today_sessions=case when practice_streaks.last_practice_date=today then practice_streaks.today_sessions+1 else 1 end,last_practice_date=today,updated_at=now();
  update public.profiles set score=coalesce(score,0)+greatest(p_xp,0) where id=uid;
  select * into streak from public.practice_streaks where user_id=uid;
  if streak.current_streak >= 3 then
    insert into public.practice_achievements(user_id,achievement_id,metadata) values(uid,'streak-3',jsonb_build_object('streak',streak.current_streak)) on conflict do nothing;
  end if;
  if (select count(*) from public.practice_sessions where user_id=uid and status='completed') >= 10 then
    insert into public.practice_achievements(user_id,achievement_id,metadata) values(uid,'practice-10',jsonb_build_object('source','web-mobile')) on conflict do nothing;
  end if;
  if (select coalesce(sum(xp),0) from public.practice_progress where user_id=uid) >= 500 then
    insert into public.practice_achievements(user_id,achievement_id,metadata) values(uid,'xp-500',jsonb_build_object('rank','Explorer')) on conflict do nothing;
  end if;
  return jsonb_build_object('awarded',true,'xp',greatest(p_xp,0),'streak',streak.current_streak,'todaySessions',streak.today_sessions);
end $$;
grant execute on function public.complete_practice_session(text,text,text,text,integer,integer,integer,integer,jsonb) to authenticated;
