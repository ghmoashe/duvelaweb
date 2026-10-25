-- Detailed user records for the Admin Control Center.
-- Authentication secrets and tokens are intentionally excluded.

create or replace function public.admin_search_users_v2(
  query text default '',
  page_size integer default 30
)
returns table(
  id uuid,
  full_name text,
  email text,
  phone text,
  city text,
  country text,
  registered_web_role text,
  is_teacher boolean,
  is_organizer boolean,
  is_verified boolean,
  is_admin boolean,
  is_banned boolean,
  teacher_audience text,
  language text,
  language_level text,
  goal_level text,
  provider text,
  email_confirmed boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');

  return query
  select
    p.id,
    p.full_name,
    u.email::text,
    u.phone::text,
    p.city,
    p.country,
    coalesce(to_jsonb(p)->>'registered_web_role', 'learner'),
    coalesce(p.is_teacher, false),
    coalesce((to_jsonb(p)->>'is_organizer')::boolean, false),
    coalesce(p.is_verified, false),
    coalesce(p.is_admin, false),
    coalesce((to_jsonb(p)->>'is_banned')::boolean, false),
    p.teacher_audience,
    to_jsonb(p)->>'language',
    to_jsonb(p)->>'language_level',
    to_jsonb(p)->>'goal_level',
    coalesce(u.raw_app_meta_data->>'provider', 'email'),
    u.email_confirmed_at is not null,
    coalesce(u.created_at, p.created_at),
    u.last_sign_in_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where coalesce(query, '') = ''
     or p.full_name ilike '%' || query || '%'
     or u.email ilike '%' || query || '%'
     or p.id::text = query
  order by coalesce(u.created_at, p.created_at) desc nulls last
  limit greatest(1, least(100, page_size));
end
$function$;

create or replace function public.admin_get_user_details_v1(target_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $function$
declare
  profile_data jsonb;
  auth_data jsonb;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');

  select jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'avatar_url', to_jsonb(p)->>'avatar_url',
    'bio', to_jsonb(p)->>'bio',
    'city', p.city,
    'country', p.country,
    'registered_web_role', coalesce(to_jsonb(p)->>'registered_web_role', 'learner'),
    'role_request_status', to_jsonb(p)->>'role_request_status',
    'is_teacher', coalesce(p.is_teacher, false),
    'is_organizer', coalesce((to_jsonb(p)->>'is_organizer')::boolean, false),
    'is_verified', coalesce(p.is_verified, false),
    'is_admin', coalesce(p.is_admin, false),
    'is_banned', coalesce((to_jsonb(p)->>'is_banned')::boolean, false),
    'banned_at', to_jsonb(p)->>'banned_at',
    'banned_reason', to_jsonb(p)->>'banned_reason',
    'language', to_jsonb(p)->>'language',
    'native_language', to_jsonb(p)->>'native_language',
    'language_level', to_jsonb(p)->>'language_level',
    'goal_level', to_jsonb(p)->>'goal_level',
    'learning_targets', to_jsonb(p)->'learning_targets',
    'score', to_jsonb(p)->'score',
    'vela_coin_balance', to_jsonb(p)->'vela_coin_balance',
    'specialization', to_jsonb(p)->>'specialization',
    'teacher_audience', p.teacher_audience,
    'teaching_experience', to_jsonb(p)->>'teaching_experience',
    'teaches_languages', to_jsonb(p)->'teaches_languages',
    'explanation_languages', to_jsonb(p)->'explanation_languages',
    'qualifications', to_jsonb(p)->'qualifications',
    'telegram', to_jsonb(p)->>'telegram',
    'instagram', to_jsonb(p)->>'instagram',
    'tiktok', to_jsonb(p)->>'tiktok',
    'website', to_jsonb(p)->>'website',
    'created_at', p.created_at,
    'updated_at', to_jsonb(p)->>'updated_at'
  ) into profile_data
  from public.profiles p
  where p.id = target_user;

  if profile_data is null then
    raise exception 'User profile % not found', target_user;
  end if;

  select jsonb_build_object(
    'email', u.email,
    'phone', u.phone,
    'provider', coalesce(u.raw_app_meta_data->>'provider', 'email'),
    'providers', coalesce(u.raw_app_meta_data->'providers', '[]'::jsonb),
    'created_at', u.created_at,
    'updated_at', u.updated_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed_at', u.email_confirmed_at,
    'phone_confirmed_at', u.phone_confirmed_at,
    'banned_until', u.banned_until,
    'is_sso_user', u.is_sso_user
  ) into auth_data
  from auth.users u
  where u.id = target_user;

  return jsonb_build_object('profile', profile_data, 'auth', coalesce(auth_data, '{}'::jsonb));
end
$function$;

revoke all on function public.admin_search_users_v2(text, integer) from public;
revoke all on function public.admin_get_user_details_v1(uuid) from public;
grant execute on function public.admin_search_users_v2(text, integer) to authenticated;
grant execute on function public.admin_get_user_details_v1(uuid) to authenticated;
