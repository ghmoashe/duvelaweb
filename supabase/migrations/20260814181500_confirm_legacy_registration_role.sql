-- Some accounts predate server-side role storage. Their profile was created by
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
