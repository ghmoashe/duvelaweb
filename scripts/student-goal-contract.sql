-- Student Goal contract for Duvela web and mobile Academy Hub.
-- Apply this on existing Supabase projects before relying on A1-C2 goal sync.

alter table public.profiles
  add column if not exists goal_level text,
  add column if not exists learning_goal text;

update public.profiles
set goal_level = upper(trim(learning_goal))
where goal_level is null
  and upper(trim(learning_goal)) in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

update public.profiles
set goal_level = upper(trim(goal_level))
where goal_level is not null
  and upper(trim(goal_level)) in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

update public.profiles
set goal_level = null
where goal_level is not null
  and goal_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

update public.profiles
set learning_goal = goal_level
where goal_level is not null
  and learning_goal is distinct from goal_level;

alter table public.profiles
  drop constraint if exists profiles_goal_level_check;

alter table public.profiles
  add constraint profiles_goal_level_check
  check (
    goal_level is null
    or goal_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  );

create table if not exists public.learner_language_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null,
  current_level text not null default 'A1',
  goal_level text not null default 'A1',
  is_active boolean not null default false,
  practice_progress jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, language),
  constraint learner_language_profiles_current_level_check
    check (current_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  constraint learner_language_profiles_goal_level_check
    check (goal_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'))
);

alter table public.learner_language_profiles
  add column if not exists current_level text default 'A1',
  add column if not exists goal_level text default 'A1',
  add column if not exists is_active boolean default false,
  add column if not exists practice_progress jsonb default '{}'::jsonb,
  add column if not exists score integer default 0,
  add column if not exists updated_at timestamptz default now();

delete from public.learner_language_profiles
where user_id is null;

update public.learner_language_profiles
set language = 'Language'
where language is null
   or trim(language) = '';

update public.learner_language_profiles
set current_level = upper(trim(current_level))
where current_level is not null
  and upper(trim(current_level)) in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

update public.learner_language_profiles
set current_level = 'A1'
where current_level is null
   or current_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

update public.learner_language_profiles
set goal_level = upper(trim(goal_level))
where goal_level is not null
  and upper(trim(goal_level)) in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

update public.learner_language_profiles
set goal_level = 'A1'
where goal_level is null
   or goal_level not in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

alter table public.learner_language_profiles
  alter column user_id set not null,
  alter column current_level set default 'A1',
  alter column current_level set not null,
  alter column language set not null,
  alter column goal_level set default 'A1',
  alter column goal_level set not null,
  alter column is_active set default false,
  alter column is_active set not null,
  alter column practice_progress set default '{}'::jsonb,
  alter column practice_progress set not null,
  alter column score set default 0,
  alter column score set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

alter table public.learner_language_profiles
  drop constraint if exists learner_language_profiles_current_level_check;

alter table public.learner_language_profiles
  add constraint learner_language_profiles_current_level_check
  check (current_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

alter table public.learner_language_profiles
  drop constraint if exists learner_language_profiles_goal_level_check;

alter table public.learner_language_profiles
  add constraint learner_language_profiles_goal_level_check
  check (goal_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));

delete from public.learner_language_profiles
where ctid in (
  select row_ctid
  from (
    select
      ctid as row_ctid,
      row_number() over (
        partition by user_id, language
        order by is_active desc, updated_at desc
      ) as row_number
    from public.learner_language_profiles
  ) duplicates
  where row_number > 1
);

do $$
declare
  primary_key_name text;
  primary_key_columns text;
begin
  select
    constraint_info.conname,
    string_agg(attribute_info.attname, ',' order by key_info.ordinality)
  into primary_key_name, primary_key_columns
  from pg_constraint constraint_info
  join unnest(constraint_info.conkey) with ordinality as key_info(attnum, ordinality) on true
  join pg_attribute attribute_info
    on attribute_info.attrelid = constraint_info.conrelid
   and attribute_info.attnum = key_info.attnum
  where constraint_info.conrelid = 'public.learner_language_profiles'::regclass
    and constraint_info.contype = 'p'
  group by constraint_info.conname;

  if primary_key_name is not null
     and primary_key_columns <> 'user_id,language' then
    execute format(
      'alter table public.learner_language_profiles drop constraint %I',
      primary_key_name
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learner_language_profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.learner_language_profiles
      add constraint learner_language_profiles_pkey primary key (user_id, language);
  end if;
end $$;

alter table public.learner_language_profiles enable row level security;

drop policy if exists "users manage own learner language profiles" on public.learner_language_profiles;
create policy "users manage own learner language profiles"
  on public.learner_language_profiles
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists learner_language_profiles_active_idx
  on public.learner_language_profiles (user_id, is_active);

insert into public.learner_language_profiles (
  user_id,
  language,
  current_level,
  goal_level,
  is_active,
  updated_at
)
select
  id,
  coalesce(nullif(trim(language), ''), 'Language'),
  case
    when language_level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2') then language_level
    else 'A1'
  end,
  coalesce(goal_level, 'A1'),
  not exists (
    select 1
    from public.learner_language_profiles existing_profile
    where existing_profile.user_id = profiles.id
      and existing_profile.is_active = true
  ),
  now()
from public.profiles
where coalesce(is_teacher, false) = false
  and coalesce(is_organizer, false) = false
on conflict (user_id, language) do update
set current_level = excluded.current_level,
    goal_level = excluded.goal_level,
    is_active = public.learner_language_profiles.is_active or excluded.is_active,
    updated_at = excluded.updated_at;
