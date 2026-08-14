-- Duvela Web consolidated Supabase setup
-- Apply in the SQL editor before using Hub/Bus Web end to end.
-- Edge Functions still need to be deployed separately:
--   - agora-token
--   - notify-course-enrollment
--   - live-payment
--   - live-restream

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Immutable role selected during web registration
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists requested_role text,
  add column if not exists role_request_status text,
  add column if not exists requested_role_at timestamptz,
  add column if not exists last_web_role text;

alter table public.profiles
  alter column role_request_status drop default,
  alter column role_request_status drop not null;

update public.profiles
set role_request_status = 'pending'
where requested_role is not null
  and role_request_status = 'none';

update public.profiles
set role_request_status = null
where requested_role is null
  and role_request_status = 'none';

update public.profiles
set requested_role = null,
    role_request_status = null
where requested_role = 'admin';

alter table public.profiles
  drop constraint if exists profiles_requested_role_check;

alter table public.profiles
  add constraint profiles_requested_role_check
  check (
    requested_role is null
    or requested_role in ('learner', 'teacher', 'organizer', 'organization')
  );

alter table public.profiles
  drop constraint if exists profiles_role_request_status_check;

alter table public.profiles
  add constraint profiles_role_request_status_check
  check (
    role_request_status is null
    or role_request_status in ('pending', 'approved', 'denied', 'rejected')
  );

create index if not exists profiles_role_request_pending_idx
  on public.profiles (role_request_status)
  where role_request_status = 'pending';

update public.profiles as profile
set is_teacher = registered.role = 'teacher',
    is_organizer = registered.role in ('organizer', 'organization'),
    last_web_role = registered.role,
    requested_role = null,
    role_request_status = null,
    requested_role_at = null,
    updated_at = now()
from (
  select id, lower(raw_user_meta_data ->> 'web_role') as role
  from auth.users
) as registered
where profile.id = registered.id
  and registered.role in ('learner', 'teacher', 'organizer', 'organization');

create or replace function public.assign_initial_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text := lower(coalesce(new.raw_user_meta_data ->> 'web_role', 'learner'));
begin
  if selected_role not in ('learner', 'teacher', 'organizer', 'organization') then
    selected_role := 'learner';
  end if;

  insert into public.profiles (
    id, email, locale, is_teacher, is_organizer, is_admin, last_web_role,
    requested_role, role_request_status, requested_role_at, updated_at
  ) values (
    new.id, new.email, nullif(new.raw_user_meta_data ->> 'locale', ''),
    selected_role = 'teacher', selected_role in ('organizer', 'organization'), false,
    selected_role, null, null, null, now()
  )
  on conflict (id) do update set
    email = excluded.email,
    locale = coalesce(excluded.locale, public.profiles.locale),
    is_teacher = excluded.is_teacher,
    is_organizer = excluded.is_organizer,
    last_web_role = excluded.last_web_role,
    requested_role = null,
    role_request_status = null,
    requested_role_at = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_assign_initial_web_role on auth.users;
drop trigger if exists zz_on_auth_user_assign_initial_web_role on auth.users;
create trigger zz_on_auth_user_assign_initial_web_role
  after insert on auth.users
  for each row execute function public.assign_initial_web_role();

create or replace function public.lock_registered_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.is_teacher := old.is_teacher;
    new.is_organizer := old.is_organizer;
    new.last_web_role := old.last_web_role;
    new.requested_role := null;
    new.role_request_status := null;
    new.requested_role_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_registered_web_role on public.profiles;
create trigger trg_lock_registered_web_role
  before update on public.profiles
  for each row execute function public.lock_registered_web_role();

-- -----------------------------------------------------------------------------
-- 2. Student Goal contract shared by web and mobile Academy Hub
-- -----------------------------------------------------------------------------

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

create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_is_admin boolean := false;
begin
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(profile.is_admin, false)
  into acting_user_is_admin
  from public.profiles profile
  where profile.id = auth.uid();

  if acting_user_is_admin then
    return new;
  end if;

  new.is_admin := old.is_admin;
  new.is_verified := old.is_verified;
  new.is_teacher := old.is_teacher;
  new.is_organizer := old.is_organizer;
  return new;
end;
$$;

drop trigger if exists trg_protect_privileged_profile_columns on public.profiles;
create trigger trg_protect_privileged_profile_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();

-- -----------------------------------------------------------------------------
-- 3. Public profile page read access
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;

drop policy if exists "public read organizations" on public.organizations;
create policy "public read organizations"
  on public.organizations
  for select
  to anon, authenticated
  using (true);

alter table public.organization_memberships enable row level security;

drop policy if exists "public read active memberships" on public.organization_memberships;
create policy "public read active memberships"
  on public.organization_memberships
  for select
  to anon, authenticated
  using (status = 'active');

alter table public.events enable row level security;

drop policy if exists "public read events" on public.events;
create policy "public read events"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 3. Browser LIVE / Agora session data
-- -----------------------------------------------------------------------------

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  channel_name text not null unique,
  teacher_id uuid references auth.users(id) on delete set null,
  teacher_name text not null default 'Duvela teacher',
  teacher_avatar_url text,
  language text,
  level text,
  topic text not null default 'Live lesson',
  price_per_minute integer not null default 0,
  status text not null default 'live',
  is_private boolean not null default false,
  allow_guest_requests boolean not null default true,
  min_viewer_age integer not null default 0,
  video_quality text not null default 'auto',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint live_sessions_channel_name_check check (channel_name ~ '^[a-zA-Z0-9_-]{1,64}$'),
  constraint live_sessions_status_check check (status in ('scheduled', 'live', 'ended')),
  constraint live_sessions_price_check check (price_per_minute >= 0),
  constraint live_sessions_min_viewer_age_check check (min_viewer_age in (0, 18)),
  constraint live_sessions_video_quality_check check (video_quality in ('auto', '540p', '720p'))
);

alter table public.live_sessions
  add column if not exists teacher_avatar_url text,
  add column if not exists language text,
  add column if not exists level text,
  add column if not exists topic text not null default 'Live lesson',
  add column if not exists price_per_minute integer not null default 0,
  add column if not exists is_private boolean not null default false,
  add column if not exists allow_guest_requests boolean not null default true,
  add column if not exists min_viewer_age integer not null default 0,
  add column if not exists video_quality text not null default 'auto',
  add column if not exists heartbeat_at timestamptz not null default now();

alter table public.live_sessions drop constraint if exists live_sessions_min_viewer_age_check;
alter table public.live_sessions
  add constraint live_sessions_min_viewer_age_check check (min_viewer_age in (0, 18));
alter table public.live_sessions drop constraint if exists live_sessions_video_quality_check;
alter table public.live_sessions
  add constraint live_sessions_video_quality_check check (video_quality in ('auto', '540p', '720p'));

create index if not exists live_sessions_status_started_idx
  on public.live_sessions (status, started_at desc);

create or replace function public.can_host_live_session(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = target_user_id
      and (
        coalesce(profile.is_teacher, false) = true
        or coalesce(profile.is_organizer, false) = true
        or coalesce(profile.is_admin, false) = true
      )
  );
$$;

create or replace function public.cleanup_stale_live_sessions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.live_sessions
  set status = 'ended',
      ended_at = coalesce(ended_at, now())
  where status = 'live'
    and coalesce(heartbeat_at, started_at, created_at) < now() - interval '3 minutes';
$$;

revoke all on function public.cleanup_stale_live_sessions() from public, anon, authenticated;
grant execute on function public.cleanup_stale_live_sessions() to service_role;

alter table public.live_sessions enable row level security;

drop policy if exists "live_sessions_select_authenticated" on public.live_sessions;
create policy "live_sessions_select_authenticated"
  on public.live_sessions
  for select
  to authenticated
  using (true);

drop policy if exists "live_sessions_insert_teacher" on public.live_sessions;
create policy "live_sessions_insert_teacher"
  on public.live_sessions
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  );

drop policy if exists "live_sessions_update_teacher" on public.live_sessions;
create policy "live_sessions_update_teacher"
  on public.live_sessions
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  );

create table if not exists public.live_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agora_uid bigint not null,
  role text not null default 'audience',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id),
  constraint live_participants_role_check check (role in ('host', 'audience', 'moderator', 'guest'))
);

alter table public.live_participants drop constraint if exists live_participants_role_check;
alter table public.live_participants
  add constraint live_participants_role_check check (role in ('host', 'audience', 'moderator', 'guest'));

create index if not exists live_participants_session_idx
  on public.live_participants (session_id, left_at);

alter table public.live_participants enable row level security;

drop policy if exists "live_participants_select_authenticated" on public.live_participants;
create policy "live_participants_select_authenticated"
  on public.live_participants
  for select
  to authenticated
  using (true);

drop policy if exists "live_participants_insert_self" on public.live_participants;
create policy "live_participants_insert_self"
  on public.live_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.live_sessions session
      where session.id = live_participants.session_id
        and session.status in ('scheduled', 'live')
    )
  );

drop policy if exists "live_participants_update_self" on public.live_participants;
create policy "live_participants_update_self"
  on public.live_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

create table if not exists public.live_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  channel_name text not null,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  role text not null default 'student',
  message text not null,
  created_at timestamptz not null default now(),
  constraint live_messages_role_check check (role in ('student', 'teacher', 'system')),
  constraint live_messages_message_check check (char_length(message) between 1 and 1000)
);

create index if not exists live_messages_session_created_idx
  on public.live_messages (session_id, created_at);

alter table public.live_messages enable row level security;

drop policy if exists "live_messages_select_authenticated" on public.live_messages;
create policy "live_messages_select_authenticated"
  on public.live_messages
  for select
  to authenticated
  using (true);

drop policy if exists "live_messages_insert_self" on public.live_messages;
create policy "live_messages_insert_self"
  on public.live_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.live_sessions session
      where session.id = live_messages.session_id
        and session.channel_name = live_messages.channel_name
        and session.status = 'live'
        and (
          live_messages.role = 'student'
          or (
            live_messages.role = 'teacher'
            and session.teacher_id = auth.uid()
          )
        )
    )
  );

create table if not exists public.live_gifts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  channel_name text not null,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  gift_id text not null,
  gift_name text not null,
  cost integer not null default 0,
  created_at timestamptz not null default now(),
  constraint live_gifts_cost_check check (cost >= 0),
  constraint live_gifts_gift_id_check check (gift_id ~ '^[a-z0-9_-]{1,64}$')
);

create index if not exists live_gifts_session_created_idx
  on public.live_gifts (session_id, created_at);

alter table public.live_gifts enable row level security;

drop policy if exists "live_gifts_select_authenticated" on public.live_gifts;
create policy "live_gifts_select_authenticated"
  on public.live_gifts
  for select
  to authenticated
  using (true);

drop function if exists public.send_live_gift(uuid, uuid, text, text, text, integer);

create or replace function public.send_live_gift(
  target_session_id uuid,
  sender_user_id uuid,
  sender_display_name text,
  gift_key text,
  gift_label text,
  gift_cost integer
)
returns table (
  created_gift_id uuid,
  balance_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.live_sessions%rowtype;
  next_balance integer;
  inserted_gift_id uuid;
begin
  if gift_cost < 0 then
    raise exception 'Gift cost cannot be negative.';
  end if;

  select *
  into target_session
  from public.live_sessions
  where id = target_session_id
    and status = 'live';

  if target_session.id is null then
    raise exception 'Live session is not active.';
  end if;

  if gift_cost > 0 then
    update public.profiles
    set vela_coin_balance = coalesce(vela_coin_balance, 0) - gift_cost
    where id = sender_user_id
      and coalesce(vela_coin_balance, 0) >= gift_cost
    returning coalesce(vela_coin_balance, 0)
    into next_balance;

    if next_balance is null then
      raise exception 'Insufficient Duvela coin balance.';
    end if;
  else
    select coalesce(profile.vela_coin_balance, 0)
    into next_balance
    from public.profiles profile
    where profile.id = sender_user_id;

    next_balance := coalesce(next_balance, 0);
  end if;

  insert into public.live_gifts (
    session_id,
    channel_name,
    sender_id,
    sender_name,
    gift_id,
    gift_name,
    cost
  )
  values (
    target_session.id,
    target_session.channel_name,
    sender_user_id,
    nullif(sender_display_name, ''),
    gift_key,
    gift_label,
    gift_cost
  )
  returning id
  into inserted_gift_id;

  return query select inserted_gift_id, next_balance;
end;
$$;

revoke all on function public.send_live_gift(uuid, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.send_live_gift(uuid, uuid, text, text, text, integer) to service_role;

create table if not exists public.live_restream_targets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  rtmp_url text,
  stream_key text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, platform),
  constraint live_restream_targets_platform_check check (platform in ('youtube', 'facebook', 'tiktok')),
  constraint live_restream_targets_url_check check (rtmp_url is null or rtmp_url ~ '^rtmps?://')
);

alter table public.live_restream_targets enable row level security;

drop policy if exists "live_restream_targets_select_own" on public.live_restream_targets;
create policy "live_restream_targets_select_own"
  on public.live_restream_targets
  for select
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  );

drop policy if exists "live_restream_targets_insert_own" on public.live_restream_targets;
create policy "live_restream_targets_insert_own"
  on public.live_restream_targets
  for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  );

drop policy if exists "live_restream_targets_update_own" on public.live_restream_targets;
create policy "live_restream_targets_update_own"
  on public.live_restream_targets
  for update
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  )
  with check (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  );

drop policy if exists "live_restream_targets_delete_own" on public.live_restream_targets;
create policy "live_restream_targets_delete_own"
  on public.live_restream_targets
  for delete
  to authenticated
  using (
    teacher_id = auth.uid()
    and public.can_host_live_session(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 4. Learner course enrollments from web
-- -----------------------------------------------------------------------------

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  full_name text,
  contact text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id),
  constraint course_enrollments_status_check
    check (status in ('pending', 'confirmed', 'cancelled'))
);

create index if not exists course_enrollments_course_idx
  on public.course_enrollments (course_id, status);

create index if not exists course_enrollments_user_idx
  on public.course_enrollments (user_id, status);

alter table public.course_enrollments enable row level security;

create or replace function public.can_update_own_course_enrollment(
  enrollment_id uuid,
  next_course_id uuid,
  next_user_id uuid,
  next_status text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.course_enrollments existing
    where existing.id = enrollment_id
      and existing.user_id = auth.uid()
      and next_user_id = auth.uid()
      and existing.course_id = next_course_id
      and (
        (existing.status in ('pending', 'confirmed') and next_status = 'cancelled')
        or (existing.status = 'cancelled' and next_status = 'pending')
      )
  );
$$;

drop policy if exists "course_enrollments_select_own" on public.course_enrollments;
create policy "course_enrollments_select_own"
  on public.course_enrollments
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "course_enrollments_insert_self" on public.course_enrollments;
create policy "course_enrollments_insert_self"
  on public.course_enrollments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.courses course
      where course.id = course_id
        and course.status = 'active'
    )
  );

drop policy if exists "course_enrollments_update_self" on public.course_enrollments;
create policy "course_enrollments_update_self"
  on public.course_enrollments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (public.can_update_own_course_enrollment(id, course_id, user_id, status));

-- -----------------------------------------------------------------------------
-- 5. Realtime direct chat for web messages
-- -----------------------------------------------------------------------------

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  is_group boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_participants (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

alter table public.chat_participants add column if not exists is_pinned boolean not null default false;
alter table public.chat_participants add column if not exists is_archived boolean not null default false;
alter table public.chat_participants add column if not exists is_blocked boolean not null default false;
alter table public.chat_messages add column if not exists edited_at timestamptz;
alter table public.chat_messages add column if not exists reply_to_id uuid references public.chat_messages(id) on delete set null;
alter table public.chat_messages add column if not exists forwarded_from_id uuid references public.chat_messages(id) on delete set null;

create index if not exists chat_participants_user_id_idx
  on public.chat_participants(user_id);

create index if not exists chat_messages_conversation_created_at_idx
  on public.chat_messages(conversation_id, created_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.is_chat_participant(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.user_id = auth.uid()
  );
$$;

drop policy if exists "chat conversations are visible to participants" on public.chat_conversations;
create policy "chat conversations are visible to participants"
  on public.chat_conversations
  for select
  to authenticated
  using (public.is_chat_participant(id));

drop policy if exists "authenticated users can create chat conversations" on public.chat_conversations;
create policy "authenticated users can create chat conversations"
  on public.chat_conversations
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "chat participants are visible to conversation members" on public.chat_participants;
create policy "chat participants are visible to conversation members"
  on public.chat_participants
  for select
  to authenticated
  using (public.is_chat_participant(conversation_id));

drop policy if exists "users can join conversations they create" on public.chat_participants;
create policy "users can join conversations they create"
  on public.chat_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.chat_conversations conversation
      where conversation.id = conversation_id
        and conversation.created_by = auth.uid()
    )
  );

drop policy if exists "users can update their chat read state" on public.chat_participants;
create policy "users can update their chat read state"
  on public.chat_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "users can leave chat conversations" on public.chat_participants;
create policy "users can leave chat conversations"
  on public.chat_participants
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "chat messages are visible to participants" on public.chat_messages;
create policy "chat messages are visible to participants"
  on public.chat_messages
  for select
  to authenticated
  using (public.is_chat_participant(conversation_id));

drop policy if exists "participants can send chat messages" on public.chat_messages;
create policy "participants can send chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_participant(conversation_id)
    and not exists (
      select 1 from public.chat_participants blocked_participant
      where blocked_participant.conversation_id = chat_messages.conversation_id
        and blocked_participant.is_blocked = true
    )
  );

drop policy if exists "senders can edit their chat messages" on public.chat_messages;
create policy "senders can edit their chat messages"
  on public.chat_messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "senders can delete their chat messages" on public.chat_messages;
create policy "senders can delete their chat messages"
  on public.chat_messages
  for delete
  to authenticated
  using (sender_id = auth.uid());

create or replace function public.create_direct_chat(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'A different target user is required';
  end if;

  select conversation.id
  into existing_conversation_id
  from public.chat_conversations conversation
  join public.chat_participants own_participant
    on own_participant.conversation_id = conversation.id
   and own_participant.user_id = current_user_id
  join public.chat_participants target_participant
    on target_participant.conversation_id = conversation.id
   and target_participant.user_id = target_user_id
  where conversation.is_group = false
  limit 1;

  if existing_conversation_id is not null then
    update public.chat_participants
    set is_archived = false
    where conversation_id = existing_conversation_id and user_id = current_user_id;
    return existing_conversation_id;
  end if;

  insert into public.chat_conversations (created_by, is_group)
  values (current_user_id, false)
  returning id into new_conversation_id;

  insert into public.chat_participants (conversation_id, user_id)
  values
    (new_conversation_id, current_user_id),
    (new_conversation_id, target_user_id)
  on conflict do nothing;

  return new_conversation_id;
end;
$$;

revoke all on function public.create_direct_chat(uuid) from public, anon;
grant execute on function public.create_direct_chat(uuid) to authenticated;

create or replace function public.delete_chat_for_everyone(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_chat_participant(target_conversation_id) then
    raise exception 'Conversation access denied';
  end if;
  delete from public.chat_conversations where id = target_conversation_id;
end;
$$;

revoke all on function public.delete_chat_for_everyone(uuid) from public, anon;
grant execute on function public.delete_chat_for_everyone(uuid) to authenticated;

-- Existing Supabase projects may already have search_chat_profiles(text, integer)
-- with a different RETURNS TABLE shape. Recreate it explicitly for the web bundle.
drop function if exists public.search_chat_profiles(text, integer);

create function public.search_chat_profiles(search_text text default '', result_limit integer default 20)
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  city text,
  country text,
  is_organizer boolean,
  is_teacher boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.full_name,
    profile.avatar_url,
    profile.city,
    profile.country,
    profile.is_organizer,
    profile.is_teacher
  from public.profiles profile
  where auth.uid() is not null
    and profile.id <> auth.uid()
    and (
      trim(coalesce(search_text, '')) = ''
      or profile.full_name ilike '%' || trim(search_text) || '%'
      or profile.city ilike '%' || trim(search_text) || '%'
      or profile.country ilike '%' || trim(search_text) || '%'
    )
  order by
    case when profile.full_name ilike trim(coalesce(search_text, '')) || '%' then 0 else 1 end,
    profile.full_name nulls last,
    profile.id desc
  limit greatest(1, least(coalesce(result_limit, 20), 50));
$$;

revoke all on function public.search_chat_profiles(text, integer) from public, anon;
grant execute on function public.search_chat_profiles(text, integer) to authenticated;

create or replace function public.touch_chat_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
  after insert on public.chat_messages
  for each row
  execute function public.touch_chat_conversation();

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

-- -----------------------------------------------------------------------------
-- Registered web role repair and immutable OAuth registration role
-- -----------------------------------------------------------------------------
+-- Keep the account type selected at registration as the single source of truth.
-- This also repairs legacy users whose auth account existed without a profile.

alter table public.profiles
  add column if not exists registered_web_role text;

update public.profiles as profile
set registered_web_role = case
      when lower(auth_user.raw_user_meta_data ->> 'web_role') in ('learner', 'teacher', 'organizer', 'organization')
        then lower(auth_user.raw_user_meta_data ->> 'web_role')
      when coalesce(profile.is_teacher, false) then 'teacher'
      when coalesce(profile.is_organizer, false) and profile.last_web_role = 'organization' then 'organization'
      when coalesce(profile.is_organizer, false) then 'organizer'
      when profile.last_web_role in ('teacher', 'organizer', 'organization') then profile.last_web_role
      else 'learner'
    end
from auth.users as auth_user
where profile.id = auth_user.id;

update public.profiles
set registered_web_role = 'learner'
where registered_web_role is null
   or registered_web_role not in ('learner', 'teacher', 'organizer', 'organization');

alter table public.profiles
  alter column registered_web_role set default 'learner',
  alter column registered_web_role set not null;

alter table public.profiles
  drop constraint if exists profiles_registered_web_role_check;
alter table public.profiles
  add constraint profiles_registered_web_role_check
  check (registered_web_role in ('learner', 'teacher', 'organizer', 'organization'));

insert into public.profiles (
  id, email, registered_web_role, is_teacher, is_organizer, is_admin,
  last_web_role, requested_role, role_request_status, requested_role_at, updated_at
)
select
  auth_user.id,
  auth_user.email,
  case
    when lower(auth_user.raw_user_meta_data ->> 'web_role') in ('learner', 'teacher', 'organizer', 'organization')
      then lower(auth_user.raw_user_meta_data ->> 'web_role')
    else 'learner'
  end,
  coalesce(lower(auth_user.raw_user_meta_data ->> 'web_role') = 'teacher', false),
  coalesce(lower(auth_user.raw_user_meta_data ->> 'web_role') in ('organizer', 'organization'), false),
  false,
  case
    when lower(auth_user.raw_user_meta_data ->> 'web_role') in ('learner', 'teacher', 'organizer', 'organization')
      then lower(auth_user.raw_user_meta_data ->> 'web_role')
    else 'learner'
  end,
  null, null, null, now()
from auth.users as auth_user
where not exists (
  select 1 from public.profiles as profile where profile.id = auth_user.id
);

update public.profiles
set is_teacher = registered_web_role = 'teacher',
    is_organizer = registered_web_role in ('organizer', 'organization'),
    last_web_role = case when coalesce(is_admin, false) then 'admin' else registered_web_role end,
    requested_role = null,
    role_request_status = null,
    requested_role_at = null,
    updated_at = now();

-- Backfill the immutable auth metadata for every legacy account. From this
-- point onward the value cannot be changed by a signed-in browser session.
update auth.users as auth_user
set raw_user_meta_data = coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('web_role', profile.registered_web_role)
from public.profiles as profile
where profile.id = auth_user.id
  and coalesce(lower(auth_user.raw_user_meta_data ->> 'web_role'), '')
      is distinct from profile.registered_web_role;

create or replace function public.assign_initial_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text := lower(coalesce(new.raw_user_meta_data ->> 'web_role', 'learner'));
begin
  if selected_role not in ('learner', 'teacher', 'organizer', 'organization') then
    selected_role := 'learner';
  end if;

  perform set_config('duvela.role_assignment', '1', true);

  insert into public.profiles (
    id, email, locale, registered_web_role, is_teacher, is_organizer, is_admin,
    last_web_role, requested_role, role_request_status, requested_role_at, updated_at
  ) values (
    new.id, new.email, nullif(new.raw_user_meta_data ->> 'locale', ''), selected_role,
    selected_role = 'teacher', selected_role in ('organizer', 'organization'), false,
    selected_role, null, null, null, now()
  )
  on conflict (id) do update set
    email = excluded.email,
    locale = coalesce(excluded.locale, public.profiles.locale),
    registered_web_role = excluded.registered_web_role,
    is_teacher = excluded.is_teacher,
    is_organizer = excluded.is_organizer,
    last_web_role = excluded.last_web_role,
    requested_role = null,
    role_request_status = null,
    requested_role_at = null,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.lock_auth_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_role text := lower(coalesce(old.raw_user_meta_data ->> 'web_role', ''));
  new_role text := lower(coalesce(new.raw_user_meta_data ->> 'web_role', ''));
begin
  if old_role in ('learner', 'teacher', 'organizer', 'organization') and new_role is distinct from old_role then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('web_role', old_role);
  elsif old_role not in ('learner', 'teacher', 'organizer', 'organization')
        and new_role in ('learner', 'teacher', 'organizer', 'organization')
        and old.created_at < now() - interval '30 minutes' then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'web_role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_auth_web_role on auth.users;
create trigger trg_lock_auth_web_role
  before update of raw_user_meta_data on auth.users
  for each row execute function public.lock_auth_web_role();

drop trigger if exists on_auth_user_assign_initial_web_role on auth.users;
drop trigger if exists zz_on_auth_user_assign_initial_web_role on auth.users;
create trigger zz_on_auth_user_assign_initial_web_role
  after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.assign_initial_web_role();

create or replace function public.lock_registered_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('duvela.role_assignment', true), '') <> '1' then
    new.registered_web_role := old.registered_web_role;
    new.is_teacher := old.is_teacher;
    new.is_organizer := old.is_organizer;
    new.last_web_role := old.last_web_role;
    new.requested_role := null;
    new.role_request_status := null;
    new.requested_role_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lock_registered_web_role on public.profiles;
create trigger trg_lock_registered_web_role
  before update on public.profiles
  for each row execute function public.lock_registered_web_role();

-- A signed-in user must always be able to read and maintain the non-privileged
-- part of their own profile, even when public profile visibility is restricted.
drop policy if exists "Duvela users can read own profile" on public.profiles;
create policy "Duvela users can read own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "Duvela users can insert own profile" on public.profiles;
create policy "Duvela users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Duvela users can update own profile" on public.profiles;
create policy "Duvela users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- One-time confirmation for legacy accounts whose original role was not stored
+-- Some accounts predate server-side role storage. Their profile was created by
-- the repair migration long after the auth account, so allow exactly one role
-- confirmation and lock it immediately afterwards.

alter table public.profiles
  add column if not exists registered_web_role_confirmed boolean not null default true;

update public.profiles as profile
set registered_web_role_confirmed = false
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.registered_web_role = 'learner'
  and profile.created_at >= timestamptz '2026-08-14 17:20:00+00'
  and auth_user.created_at < profile.created_at - interval '5 minutes';

create or replace function public.assign_initial_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata_role text := lower(coalesce(new.raw_user_meta_data ->> 'web_role', ''));
  selected_role text := metadata_role;
  role_is_explicit boolean := metadata_role in ('learner', 'teacher', 'organizer', 'organization');
begin
  if not role_is_explicit then
    selected_role := 'learner';
  end if;

  perform set_config('duvela.role_assignment', '1', true);

  insert into public.profiles (
    id, email, locale, registered_web_role, registered_web_role_confirmed,
    is_teacher, is_organizer, is_admin, last_web_role,
    requested_role, role_request_status, requested_role_at, updated_at
  ) values (
    new.id, new.email, nullif(new.raw_user_meta_data ->> 'locale', ''),
    selected_role, role_is_explicit,
    selected_role = 'teacher', selected_role in ('organizer', 'organization'), false,
    selected_role, null, null, null, now()
  )
  on conflict (id) do update set
    email = excluded.email,
    locale = coalesce(excluded.locale, public.profiles.locale),
    registered_web_role = excluded.registered_web_role,
    registered_web_role_confirmed = excluded.registered_web_role_confirmed,
    is_teacher = excluded.is_teacher,
    is_organizer = excluded.is_organizer,
    last_web_role = excluded.last_web_role,
    requested_role = null,
    role_request_status = null,
    requested_role_at = null,
    updated_at = now();

  return new;
end;
$$;

create or replace function public.lock_auth_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_role text := lower(coalesce(old.raw_user_meta_data ->> 'web_role', ''));
  new_role text := lower(coalesce(new.raw_user_meta_data ->> 'web_role', ''));
  trusted_assignment boolean := coalesce(current_setting('duvela.role_assignment', true), '') = '1';
begin
  if trusted_assignment then
    return new;
  end if;
  if old_role in ('learner', 'teacher', 'organizer', 'organization') and new_role is distinct from old_role then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('web_role', old_role);
  elsif old_role not in ('learner', 'teacher', 'organizer', 'organization')
        and new_role in ('learner', 'teacher', 'organizer', 'organization')
        and old.created_at < now() - interval '30 minutes' then
    new.raw_user_meta_data := coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'web_role';
  end if;
  return new;
end;
$$;

create or replace function public.confirm_legacy_web_role(chosen_role text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_role text := lower(coalesce(chosen_role, ''));
  is_confirmed boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if normalized_role not in ('learner', 'teacher', 'organizer', 'organization') then
    raise exception 'Invalid registration role';
  end if;

  select registered_web_role_confirmed
    into is_confirmed
  from public.profiles
  where id = auth.uid()
  for update;

  if is_confirmed is distinct from false then
    return (select registered_web_role from public.profiles where id = auth.uid());
  end if;

  perform set_config('duvela.role_assignment', '1', true);
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('web_role', normalized_role)
  where id = auth.uid();

  update public.profiles
  set registered_web_role = normalized_role,
      registered_web_role_confirmed = true,
      is_teacher = normalized_role = 'teacher',
      is_organizer = normalized_role in ('organizer', 'organization'),
      last_web_role = normalized_role,
      updated_at = now()
  where id = auth.uid();

  return normalized_role;
end;
$$;

grant execute on function public.confirm_legacy_web_role(text) to authenticated;

revoke all on function public.confirm_legacy_web_role(text) from public;
revoke all on function public.confirm_legacy_web_role(text) from anon;
grant execute on function public.confirm_legacy_web_role(text) to authenticated;

-- Synchronize protected flags from the immutable registered role
+-- Let the trusted registration-role functions synchronize teacher/organizer
-- flags while continuing to block ordinary profile privilege escalation.

create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_user_is_admin boolean := false;
begin
  if auth.uid() is null
     or coalesce(current_setting('duvela.role_assignment', true), '') = '1' then
    return new;
  end if;

  select coalesce(profile.is_admin, false)
  into acting_user_is_admin
  from public.profiles profile
  where profile.id = auth.uid();

  if acting_user_is_admin then
    return new;
  end if;

  new.is_admin := old.is_admin;
  new.is_verified := old.is_verified;
  new.is_teacher := old.is_teacher;
  new.is_organizer := old.is_organizer;
  return new;
end;
$$;

update public.profiles
set is_teacher = registered_web_role = 'teacher',
    is_organizer = registered_web_role in ('organizer', 'organization'),
    last_web_role = case when coalesce(is_admin, false) then 'admin' else registered_web_role end,
    updated_at = now();

create or replace function public.lock_registered_web_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('duvela.role_assignment', true), '') <> '1' then
    new.registered_web_role := old.registered_web_role;
    new.registered_web_role_confirmed := old.registered_web_role_confirmed;
    new.is_teacher := old.is_teacher;
    new.is_organizer := old.is_organizer;
    new.last_web_role := old.last_web_role;
    new.requested_role := null;
    new.role_request_status := null;
    new.requested_role_at := null;
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_participants'
  ) then
    alter publication supabase_realtime add table public.chat_participants;
  end if;
exception when undefined_object then null; when duplicate_object then null;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
exception
  when undefined_object then null;
  when duplicate_object then null;
end;
$$;
