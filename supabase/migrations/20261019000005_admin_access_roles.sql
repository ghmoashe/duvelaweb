-- Admin Control Center access roles.
-- Existing profiles.is_admin remains the root gate; this table narrows access
-- after the migration is applied. Existing admins default to super_admin.
create table if not exists public.admin_access_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin','moderator','finance_admin','support_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admin_access_roles enable row level security;

create or replace function public.admin_get_access()
returns table(role text, can_moderate boolean, can_view_finance boolean, can_manage_bulk boolean, can_manage_media boolean, can_view_audit boolean)
language plpgsql security definer set search_path = public
as $$
declare
  caller_is_admin boolean;
  effective_role text;
begin
  select coalesce(is_admin, false) into caller_is_admin from public.profiles where id = auth.uid();
  if not caller_is_admin then raise exception 'admin access required'; end if;
  effective_role := 'super_admin';
  select ar.role into effective_role from public.admin_access_roles ar where ar.user_id = auth.uid();
  return query select effective_role,
    effective_role in ('super_admin','moderator'),
    effective_role in ('super_admin','finance_admin'),
    effective_role in ('super_admin','support_admin'),
    effective_role in ('super_admin','support_admin'),
    effective_role = 'super_admin';
end;
$$;

create or replace function public.admin_set_access_role(target_user uuid, target_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare caller_role text := 'super_admin'; target_is_admin boolean;
begin
  select ar.role into caller_role from public.admin_access_roles ar where ar.user_id = auth.uid();
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) or caller_role <> 'super_admin' then
    raise exception 'super admin access required';
  end if;
  if target_role not in ('super_admin','moderator','finance_admin','support_admin') then raise exception 'invalid admin role'; end if;
  select coalesce(is_admin, false) into target_is_admin from public.profiles where id = target_user;
  if not target_is_admin then raise exception 'target user is not an administrator'; end if;
  insert into public.admin_access_roles(user_id, role) values (target_user, target_role)
    on conflict (user_id) do update set role = excluded.role, updated_at = now();
end;
$$;

grant execute on function public.admin_get_access() to authenticated;
grant execute on function public.admin_set_access_role(uuid, text) to authenticated;
