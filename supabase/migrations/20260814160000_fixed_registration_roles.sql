-- Roles are chosen once at registration and cannot be switched in the web app.

alter table public.profiles
  add column if not exists requested_role text,
  add column if not exists role_request_status text,
  add column if not exists requested_role_at timestamptz,
  add column if not exists last_web_role text;

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

update public.profiles
set requested_role = null,
    role_request_status = null,
    requested_role_at = null
where requested_role is not null or role_request_status is not null;

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
