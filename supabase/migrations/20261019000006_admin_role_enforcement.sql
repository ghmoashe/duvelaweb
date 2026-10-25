create or replace function public.admin_require_capability(required_capability text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text := 'none';
  caller_is_admin boolean;
begin
  select coalesce(is_admin, false) into caller_is_admin
    from public.profiles where id = auth.uid();
  if not caller_is_admin then
    raise exception 'admin access required';
  end if;
  select ar.role into caller_role
    from public.admin_access_roles ar where ar.user_id = auth.uid();
  if caller_role = 'super_admin' then return; end if;
  if required_capability = 'access_read' then return; end if;
  if (required_capability = 'moderation' and caller_role = 'moderator')
     or (required_capability in ('support','bulk','media') and caller_role = 'support_admin')
     or (required_capability = 'finance' and caller_role = 'finance_admin') then return; end if;
  raise exception 'admin capability required: %', required_capability;
end;
$$;

grant execute on function public.admin_require_capability(text) to authenticated;

CREATE OR REPLACE FUNCTION public.admin_ban_user(target_user uuid, reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('moderation');
  if target_user = auth.uid() then
    raise exception 'cannot ban yourself';
  end if;
  update public.profiles
     set is_banned = true, banned_at = now(), banned_reason = reason, banned_by = auth.uid()
   where id = target_user;
  perform public.audit_admin_action('ban_user', 'profiles', target_user,
    jsonb_build_object('reason', reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_bulk_invite_seats(target_account uuid, emails text[])
 RETURNS TABLE(email text, outcome text, detail text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  em text;
  errmsg text;
  ok_count int := 0;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('bulk');
  if not exists (select 1 from public.corporate_accounts where id = target_account) then
    raise exception 'account not found';
  end if;

  foreach em in array emails loop
    begin
      -- Reuse the HR-facing RPC — admins are always allowed to act as HR
      -- because assert_admin() already passed, but the RPC gates on
      -- hr_contact_id = auth.uid(). We inline the essentials here instead.
      declare
        used int := public.corporate_seats_used(target_account);
        seats_purchased int;
        existing uuid;
      begin
        select seats_purchased into seats_purchased
          from public.corporate_accounts where id = target_account;
        if used >= seats_purchased then
          email := em; outcome := 'skipped'; detail := 'seat limit reached';
          return next; continue;
        end if;

        select u.id into existing from auth.users u
          join public.profiles p on p.id = u.id
          where lower(u.email) = lower(em) limit 1;

        if existing is not null then
          insert into public.corporate_seats(account_id, learner_id, invited_email, status, accepted_at)
          values (target_account, existing, em, 'active', now())
          on conflict (account_id, learner_id) do update
            set status = 'active', accepted_at = coalesce(public.corporate_seats.accepted_at, now());
          email := em; outcome := 'activated'; detail := existing::text;
        else
          insert into public.corporate_pending_invites(account_id, email, invited_by)
          values (target_account, em, auth.uid())
          on conflict (account_id, email) do update set invited_at = now();
          email := em; outcome := 'pending'; detail := 'no profile yet';
        end if;
        ok_count := ok_count + 1;
        return next;
      end;
    exception when others then
      errmsg := SQLERRM;
      email := em; outcome := 'error'; detail := errmsg;
      return next;
    end;
  end loop;

  perform public.audit_admin_action('bulk_invite_seats', 'corporate_accounts', target_account,
    jsonb_build_object('total', array_length(emails, 1), 'successful', ok_count));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_bunny_stats()
 RETURNS TABLE(posts_total bigint, posts_finished bigint, posts_deleted_at_cdn bigint, posts_processing bigint, posts_never_synced bigint, total_views bigint, total_watch_time_seconds bigint, total_storage_bytes bigint, synced_recently bigint, synced_stale bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('media');
  return query
  select
    (select count(*) from public.posts where bunny_video_guid is not null)::bigint,
    (select count(*) from public.posts where bunny_status = 'finished')::bigint,
    (select count(*) from public.posts where bunny_status = 'deleted')::bigint,
    (select count(*) from public.posts where bunny_status in ('created','uploaded','processing','transcoding'))::bigint,
    (select count(*) from public.posts where bunny_video_guid is not null and bunny_last_synced_at is null)::bigint,
    coalesce((select sum(bunny_view_count) from public.posts where bunny_view_count > 0), 0)::bigint,
    coalesce((select sum(bunny_watch_time_seconds) from public.posts where bunny_watch_time_seconds > 0), 0)::bigint,
    coalesce((select sum(bunny_storage_size_bytes) from public.posts where bunny_storage_size_bytes > 0), 0)::bigint,
    (select count(*) from public.posts where bunny_last_synced_at > now() - interval '2 hours')::bigint,
    (select count(*) from public.posts where bunny_video_guid is not null and (bunny_last_synced_at is null or bunny_last_synced_at < now() - interval '2 hours'))::bigint;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_bunny_top_posts(limit_rows integer DEFAULT 25)
 RETURNS TABLE(id uuid, user_id uuid, author_email text, author_name text, caption text, bunny_video_guid text, bunny_thumbnail_url text, bunny_view_count integer, bunny_watch_time_seconds integer, bunny_length_seconds integer, bunny_status text, bunny_last_synced_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('media');
  return query
  select
    p.id, p.user_id, u.email, prof.full_name,
    p.caption,
    p.bunny_video_guid, p.bunny_thumbnail_url,
    coalesce(p.bunny_view_count, 0),
    coalesce(p.bunny_watch_time_seconds, 0),
    p.bunny_length_seconds,
    coalesce(p.bunny_status, 'unknown'),
    p.bunny_last_synced_at,
    p.created_at
  from public.posts p
  left join auth.users u on u.id = p.user_id
  left join public.profiles prof on prof.id = p.user_id
  where p.bunny_video_guid is not null
    and p.shorts_deleted_at is null
  order by coalesce(p.bunny_view_count, 0) desc, p.created_at desc
  limit greatest(1, least(200, limit_rows));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_corporate_account(target_account uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  update public.corporate_accounts set status = 'cancelled' where id = target_account;
  perform public.audit_admin_action(
    'cancel_corporate_account', 'corporate_accounts', target_account, null
  );
end $function$;

CREATE OR REPLACE FUNCTION public.admin_convert_lead_to_account(lead_id uuid, target_company text, target_hr_email text, target_seats integer, target_plan text, target_price_per_seat numeric DEFAULT NULL::numeric, target_languages text[] DEFAULT ARRAY['de'::text], target_cities text[] DEFAULT ARRAY[]::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_account uuid;
  hr_uuid uuid;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');

  select id into hr_uuid from auth.users
    where lower(email) = lower(target_hr_email) limit 1;
  if hr_uuid is null then
    -- Fall back to the acting admin so the row is legally-owned; admin
    -- rebinds after HR signs up.
    hr_uuid := auth.uid();
  end if;

  insert into public.corporate_accounts(
    company_name, hr_contact_id, seats_purchased, plan,
    monthly_price_per_seat, languages, cities, status
  ) values (
    target_company, hr_uuid, target_seats, target_plan,
    target_price_per_seat, target_languages, target_cities, 'trial'
  ) returning id into new_account;

  if lead_id is not null then
    update public.corporate_leads set handled = true where id = lead_id;
  end if;

  perform public.audit_admin_action(
    'convert_lead_to_account', 'corporate_accounts', new_account,
    jsonb_build_object(
      'lead_id', lead_id, 'company', target_company,
      'hr_email', target_hr_email, 'seats', target_seats, 'plan', target_plan
    )
  );

  return new_account;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_financial_summary(days integer DEFAULT 30)
 RETURNS TABLE(mrr_eur numeric, active_accounts integer, trial_accounts integer, coin_revenue_period numeric, coin_purchases_count integer, top_account_id uuid, top_account_name text, top_account_mrr numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  window_start timestamptz := now() - make_interval(days => greatest(1, days));
  top_id uuid;
  top_name text;
  top_amount numeric;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('finance');

  select a.id, a.company_name,
         (a.seats_purchased * coalesce(a.monthly_price_per_seat, 0))
    into top_id, top_name, top_amount
  from public.corporate_accounts a
  where a.status = 'active'
  order by (a.seats_purchased * coalesce(a.monthly_price_per_seat, 0)) desc
  limit 1;

  return query
  select
    coalesce((select sum(seats_purchased * coalesce(monthly_price_per_seat, 0))
              from public.corporate_accounts where status = 'active'), 0)::numeric,
    (select count(*) from public.corporate_accounts where status = 'active')::int,
    (select count(*) from public.corporate_accounts where status = 'trial')::int,
    coalesce((select sum(amount) from public.coin_transactions
              where amount > 0 and source ilike '%purchase%'
                and created_at > window_start), 0)::numeric,
    (select count(*) from public.coin_transactions
       where amount > 0 and source ilike '%purchase%'
         and created_at > window_start)::int,
    top_id, top_name, top_amount;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_hide_post(post_id uuid, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('moderation');
  update public.posts
     set shorts_hidden = true, shorts_hidden_reason = reason
   where id = post_id;
  perform public.audit_admin_action('hide_post', 'posts', post_id,
    jsonb_build_object('reason', reason));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_coin_transactions(days integer DEFAULT 30, limit_rows integer DEFAULT 100)
 RETURNS TABLE(id uuid, user_id uuid, user_email text, amount integer, balance_after integer, source text, label text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('finance');
  return query
  select t.id, t.user_id, u.email::text, t.amount, t.balance_after, t.source, t.label, t.created_at
  from public.coin_transactions t
  left join auth.users u on u.id = t.user_id
  where t.created_at > now() - make_interval(days => greatest(1, days))
  order by t.created_at desc limit greatest(1, limit_rows);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_corporate_accounts(status_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, company_name text, plan text, seats_purchased integer, seats_used integer, monthly_price_per_seat numeric, status text, hr_email text, languages text[], cities text[], created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  return query
  select a.id, a.company_name, a.plan, a.seats_purchased,
         public.corporate_seats_used(a.id),
         a.monthly_price_per_seat, a.status,
         u.email::text, a.languages, a.cities, a.created_at
  from public.corporate_accounts a
  left join auth.users u on u.id = a.hr_contact_id
  where status_filter is null or a.status = status_filter
  order by a.created_at desc
  limit 100;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_corporate_leads(only_open boolean DEFAULT true)
 RETURNS TABLE(id uuid, contact_name text, contact_email text, company_name text, team_size text, plan text, notes text, handled boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  return query
  select l.id, l.contact_name, l.contact_email, l.company_name,
         l.team_size, l.plan, l.notes, l.handled, l.created_at
  from public.corporate_leads l
  where (not only_open) or l.handled = false
  order by l.created_at desc
  limit 100;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_payout_requests(status_filter text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, teacher_id uuid, teacher_name text, teacher_email text, amount_dv integer, method text, details text, status text, admin_note text, created_at timestamp with time zone, processed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('finance');

  return query
    select r.id, r.teacher_id, p.full_name, u.email::text,
           r.amount_dv, r.method, r.details, r.status,
           r.admin_note, r.created_at, r.processed_at
    from public.teacher_payout_requests r
    join public.profiles p on p.id = r.teacher_id
    left join auth.users u on u.id = r.teacher_id
    where status_filter is null or r.status = status_filter
    order by (r.status = 'pending') desc, r.created_at desc
    limit 200;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_recent_signups(days_back integer DEFAULT 7)
 RETURNS TABLE(id uuid, full_name text, email text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  return query
  select p.id, p.full_name, u.email::text, p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.created_at > now() - make_interval(days => greatest(1, days_back))
  order by p.created_at desc
  limit 100;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_reports(report_kind text DEFAULT 'media'::text, only_open boolean DEFAULT true, limit_rows integer DEFAULT 100)
 RETURNS TABLE(id uuid, kind text, reporter_id uuid, reporter_email text, reported_user_id uuid, reported_user_email text, target_id uuid, reason text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('moderation');

  if report_kind = 'media' then
    return query
    select r.id, 'media'::text, r.reporter_id, ru.email::text, r.creator_id, cu.email::text,
           r.post_id, r.reason, coalesce(r.status,'open'), r.created_at
    from public.media_reports r
    left join auth.users ru on ru.id = r.reporter_id
    left join auth.users cu on cu.id = r.creator_id
    where (not only_open) or coalesce(r.status, 'open') = 'open'
    order by r.created_at desc limit greatest(1, limit_rows);
  elsif report_kind = 'chat' then
    return query
    select r.id, 'chat'::text, r.reporter_id, ru.email::text, r.reported_user_id, tu.email::text,
           r.message_id, r.reason, 'open'::text, r.created_at
    from public.chat_reports r
    left join auth.users ru on ru.id = r.reporter_id
    left join auth.users tu on tu.id = r.reported_user_id
    order by r.created_at desc limit greatest(1, limit_rows);
  elsif report_kind = 'live' then
    return query
    select r.id, 'live'::text, r.reporter_id, ru.email::text, r.reported_user_id, tu.email::text,
           r.session_id, r.reason, 'open'::text, r.created_at
    from public.live_reports r
    left join auth.users ru on ru.id = r.reporter_id
    left join auth.users tu on tu.id = r.reported_user_id
    order by r.created_at desc limit greatest(1, limit_rows);
  else
    raise exception 'unknown kind %', report_kind;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_teacher_applications(only_new boolean DEFAULT true, limit_rows integer DEFAULT 100)
 RETURNS TABLE(id uuid, full_name text, email text, phone text, native_language text, teaching_languages text[], teaching_levels text[], years_experience integer, current_platform text, city text, country text, motivation text, source text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  return query
  select a.id, a.full_name, a.email, a.phone,
         a.native_language, a.teaching_languages, a.teaching_levels,
         a.years_experience, a.current_platform, a.city, a.country,
         a.motivation, a.source, a.status, a.created_at
  from public.teacher_applications a
  where (not only_new) or a.status = 'new'
  order by a.created_at desc
  limit greatest(1, limit_rows);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_list_verification_requests_v1()
 RETURNS TABLE(verification_id uuid, user_id uuid, created_at timestamp with time zone, document_path text, applicant_note text, account_role text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  return query
    select v.id,v.user_id,v.created_at,v.document_path,v.note,p.registered_web_role
    from public.verification_requests v
    join public.profiles p on p.id=v.user_id
    where v.status='pending'
    order by v.created_at asc,v.id asc;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_platform_kpis()
 RETURNS TABLE(total_users bigint, new_users_7d bigint, teachers bigint, teachers_b2b bigint, live_corporate_accounts bigint, seats_sold_total bigint, seats_active_total bigint, open_leads bigint, mrr_eur numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');

  return query
  select
    (select count(*) from public.profiles)::bigint,
    (select count(*) from public.profiles where created_at > now() - interval '7 days')::bigint,
    (select count(*) from public.profiles where is_teacher = true)::bigint,
    (select count(*) from public.profiles
       where is_teacher = true and teacher_audience in ('b2b','both'))::bigint,
    (select count(*) from public.corporate_accounts where status in ('trial','active'))::bigint,
    coalesce((select sum(seats_purchased) from public.corporate_accounts
              where status in ('trial','active')), 0)::bigint,
    (select count(*) from public.corporate_seats where status = 'active')::bigint,
    (select count(*) from public.corporate_leads where handled = false)::bigint,
    coalesce((select sum(seats_purchased * coalesce(monthly_price_per_seat, 0))
              from public.corporate_accounts where status = 'active'), 0)::numeric;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_recent_audit(limit_rows integer DEFAULT 50)
 RETURNS TABLE(id uuid, admin_email text, action text, target_table text, target_id uuid, payload jsonb, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('audit');
  return query
  select l.id, u.email::text, l.action, l.target_table, l.target_id, l.payload, l.created_at
  from public.admin_audit_log l
  left join auth.users u on u.id = l.admin_id
  order by l.created_at desc
  limit greatest(1, limit_rows);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_referral_source_breakdown()
 RETURNS TABLE(referral_source text, signups bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');

  return query
  select coalesce(p.referral_source, 'unknown') as referral_source, count(*)::bigint as signups
  from public.profiles p
  group by coalesce(p.referral_source, 'unknown')
  order by signups desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_resolve_media_report(report_id uuid, note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('moderation');
  update public.media_reports
     set status = 'resolved', resolution_note = note,
         resolved_at = now(), resolved_by = auth.uid()
   where id = report_id;
  perform public.audit_admin_action('resolve_report', 'media_reports', report_id,
    jsonb_build_object('note', note));
end $function$;

CREATE OR REPLACE FUNCTION public.admin_revenue_by_account()
 RETURNS TABLE(account_id uuid, company_name text, plan text, seats_purchased integer, monthly_price_per_seat numeric, monthly_revenue numeric, status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('finance');
  return query
  select a.id, a.company_name, a.plan, a.seats_purchased,
         coalesce(a.monthly_price_per_seat, 0),
         (a.seats_purchased * coalesce(a.monthly_price_per_seat, 0))::numeric,
         a.status
  from public.corporate_accounts a
  where a.status in ('trial','active')
  order by (a.seats_purchased * coalesce(a.monthly_price_per_seat, 0)) desc
  limit 100;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_review_verification_request_v1(verification_id uuid, approve boolean, reviewer_note text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare request_row public.verification_requests%rowtype; decision text;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  select * into request_row from public.verification_requests
    where id=verification_id for update;
  if request_row.id is null then raise exception 'Verification request not found' using errcode='22023'; end if;
  if request_row.status<>'pending' then raise exception 'Request already reviewed' using errcode='22023'; end if;
  if approve and (request_row.document_path is null or request_row.document_path='' or not exists (
    select 1 from storage.objects o where o.bucket_id='verification'
      and o.name=request_row.document_path
  )) then raise exception 'Uploaded document required' using errcode='22023'; end if;
  decision := case when approve then 'approved' else 'rejected' end;
  update public.verification_requests set status=decision,
    review_note=nullif(trim(coalesce(reviewer_note,'')),''),updated_at=now()
    where id=verification_id;
  if approve then
    update public.profiles set is_verified=true,updated_at=now()
      where id=request_row.user_id;
  end if;
  perform public.audit_admin_action('review_verification_request','verification_requests',verification_id,
    jsonb_build_object('decision',decision,'user_id',request_row.user_id));
  return decision;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_search_users(query text DEFAULT ''::text, page_size integer DEFAULT 25)
 RETURNS TABLE(id uuid, full_name text, email text, city text, country text, is_teacher boolean, is_verified boolean, is_admin boolean, teacher_audience text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');
  return query
  select p.id, p.full_name, u.email::text, p.city, p.country,
         coalesce(p.is_teacher, false), coalesce(p.is_verified, false),
         coalesce(p.is_admin, false), p.teacher_audience, p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where query = '' or query is null
     or p.full_name ilike '%' || query || '%'
     or u.email     ilike '%' || query || '%'
  order by p.created_at desc nulls last
  limit greatest(1, page_size);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_account_role(target_user uuid, new_role text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  normalized_role text := lower(coalesce(trim(new_role), ''));
  previous_role text;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('super_admin');

  if normalized_role not in ('learner', 'teacher', 'organizer', 'organization') then
    raise exception 'Invalid role %', new_role;
  end if;

  select registered_web_role into previous_role
  from public.profiles
  where id = target_user
  for update;

  if previous_role is null then
    raise exception 'Profile % not found', target_user;
  end if;

  if previous_role = normalized_role then
    return normalized_role;
  end if;

  -- Open the lock so lock_registered_web_role lets the change through, and
  -- keep auth.users metadata in step with the profile (confirm_legacy_web_role
  -- does the same).
  perform set_config('duvela.role_assignment', '1', true);

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('web_role', normalized_role)
  where id = target_user;

  -- is_teacher / is_organizer are recomputed by trg_sync_role_flags; we only
  -- set the role and the bookkeeping columns here.
  update public.profiles
  set registered_web_role = normalized_role,
      registered_web_role_confirmed = true,
      last_web_role = normalized_role,
      updated_at = now()
  where id = target_user;

  perform public.audit_admin_action(
    'set_account_role', 'profiles', target_user,
    jsonb_build_object('from', previous_role, 'to', normalized_role)
  );

  return normalized_role;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_payout_status(p_request_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.teacher_payout_requests%rowtype;
  v_balance integer;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('finance');

  if p_status not in ('paid', 'rejected') then
    raise exception 'Invalid status.';
  end if;

  select * into v_request from public.teacher_payout_requests where id = p_request_id for update;

  if v_request.id is null then
    raise exception 'Payout request not found.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Request already processed.';
  end if;

  if p_status = 'rejected' then
    perform set_config('duvela.coin_write', '1', true);

    update public.profiles
       set vela_coin_balance = coalesce(vela_coin_balance, 0) + v_request.amount_dv,
           updated_at = now()
     where id = v_request.teacher_id
    returning vela_coin_balance into v_balance;

    insert into public.coin_transactions (user_id, amount, balance_after, source, label)
    values (v_request.teacher_id, v_request.amount_dv, v_balance, 'payout_rejected', 'Payout request rejected — refunded');
  end if;

  update public.teacher_payout_requests
     set status = p_status,
         admin_note = nullif(trim(coalesce(p_note, '')), ''),
         processed_by = (select auth.uid()),
         processed_at = now()
   where id = p_request_id;

  perform public.audit_admin_action(
    'payout_' || p_status,
    'teacher_payout_requests',
    p_request_id,
    jsonb_build_object('amount_dv', v_request.amount_dv, 'teacher_id', v_request.teacher_id)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_profile_flag(target_user uuid, flag text, value boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('super_admin');

  if flag in ('is_teacher', 'is_organizer') then
    raise exception
      'is_teacher and is_organizer are derived from registered_web_role and cannot be set directly. Change the account role instead.';
  end if;

  if flag not in ('is_verified', 'is_admin') then
    raise exception 'flag % is not toggleable via this RPC', flag;
  end if;

  -- Safety: don't let an admin remove their own admin flag (avoids getting
  -- locked out). To demote yourself, use the DB directly.
  if flag = 'is_admin' and target_user = auth.uid() and value = false then
    raise exception 'cannot revoke your own admin flag';
  end if;

  execute format(
    'update public.profiles set %I = $1 where id = $2', flag
  ) using value, target_user;

  perform public.audit_admin_action(
    'set_profile_flag', 'profiles', target_user,
    jsonb_build_object('flag', flag, 'value', value)
  );
end $function$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(target_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('moderation');
  update public.profiles
     set is_banned = false, banned_at = null, banned_reason = null, banned_by = null
   where id = target_user;
  perform public.audit_admin_action('unban_user', 'profiles', target_user, null);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_unhide_post(post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin();
  perform public.admin_require_capability('moderation');
  update public.posts
     set shorts_hidden = false, shorts_hidden_reason = null
   where id = post_id;
  perform public.audit_admin_action('unhide_post', 'posts', post_id, null);
end $function$;

CREATE OR REPLACE FUNCTION public.admin_update_corporate_account(target_account uuid, new_seats integer DEFAULT NULL::integer, new_plan text DEFAULT NULL::text, new_price numeric DEFAULT NULL::numeric, new_status text DEFAULT NULL::text, new_hr_email text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_hr uuid;
begin
  perform public.assert_admin();
  perform public.admin_require_capability('support');

  if new_hr_email is not null then
    select id into new_hr from auth.users where lower(email) = lower(new_hr_email) limit 1;
    if new_hr is null then
      raise exception 'no auth user with email %', new_hr_email;
    end if;
  end if;

  update public.corporate_accounts
     set seats_purchased        = coalesce(new_seats, seats_purchased),
         plan                   = coalesce(new_plan, plan),
         monthly_price_per_seat = coalesce(new_price, monthly_price_per_seat),
         status                 = coalesce(new_status, status),
         hr_contact_id          = coalesce(new_hr, hr_contact_id)
   where id = target_account;

  perform public.audit_admin_action(
    'update_corporate_account', 'corporate_accounts', target_account,
    jsonb_build_object('seats', new_seats, 'plan', new_plan, 'price', new_price,
                       'status', new_status, 'hr_email', new_hr_email)
  );
end $function$;




CREATE OR REPLACE FUNCTION public.admin_get_access()
RETURNS TABLE(role text, can_moderate boolean, can_view_finance boolean, can_manage_bulk boolean, can_manage_media boolean, can_view_audit boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
declare
  caller_is_admin boolean;
  effective_role text;
begin
  perform public.admin_require_capability('access_read');
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
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_access_role(target_user uuid, target_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
begin
  perform public.admin_require_capability('super_admin');
  if target_role not in ('super_admin','moderator','finance_admin','support_admin') then raise exception 'invalid admin role'; end if;
  if not exists (select 1 from public.profiles p where p.id = target_user and p.is_admin = true) then raise exception 'target user is not an administrator'; end if;
  insert into public.admin_access_roles(user_id, role) values (target_user, target_role)
    on conflict (user_id) do update set role = excluded.role, updated_at = now();
end $function$;
