-- Duvela Web consolidated Supabase setup
-- Apply in the SQL editor before using Hub/Bus Web end to end.
-- Edge Functions still need to be deployed separately:
--   - agora-token
--   - notify-course-enrollment
--   - live-payment
--   - live-restream

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. Safe role request fields for web auth
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
-- 2. Public profile page read access
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
