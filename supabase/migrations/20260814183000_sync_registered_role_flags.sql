-- Let the trusted registration-role functions synchronize teacher/organizer
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
