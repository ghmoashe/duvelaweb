-- Duvela roles are selected once, during registration. There is no role-request flow.

-- Preserve the role chosen by existing accounts that were created by the old
-- request-based signup flow, then remove their pending state.
update public.profiles
set is_teacher = true,
    last_web_role = 'teacher',
    requested_role = null,
    role_request_status = null,
    requested_role_at = null
where requested_role = 'teacher'
  and coalesce(role_request_status, 'pending') = 'pending';

update public.profiles
set is_organizer = true,
    last_web_role = case when requested_role = 'organization' then 'organization' else 'organizer' end,
    requested_role = null,
    role_request_status = null,
    requested_role_at = null
where requested_role in ('organizer', 'organization')
  and coalesce(role_request_status, 'pending') = 'pending';

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
    id,
    email,
    locale,
    is_teacher,
    is_organizer,
    is_admin,
    last_web_role,
    requested_role,
    role_request_status,
    requested_role_at,
    updated_at
  ) values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'locale', ''),
    selected_role = 'teacher',
    selected_role in ('organizer', 'organization'),
    false,
    selected_role,
    null,
    null,
    null,
    now()
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
