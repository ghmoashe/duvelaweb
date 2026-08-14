-- Keep the account type selected at registration as the single source of truth.
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
