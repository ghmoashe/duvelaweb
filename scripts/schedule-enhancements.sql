-- Duvela schedule v2. Run once in Supabase SQL Editor.
alter table public.teacher_slots add column if not exists status text not null default 'open';
alter table public.teacher_slots add column if not exists price numeric(10,2) not null default 0;
alter table public.teacher_slots add column if not exists currency text not null default 'EUR';
alter table public.teacher_slots add column if not exists timezone text not null default 'UTC';
alter table public.teacher_slots add column if not exists live_room_url text;
alter table public.teacher_slots add column if not exists approval_required boolean not null default false;
alter table public.teacher_slots add column if not exists booking_status text;
alter table public.teacher_slots add column if not exists series_id uuid;
alter table public.teacher_slots add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.teacher_slots add constraint teacher_slots_status_check
    check (status in ('open','pending','booked','completed','cancelled'));
exception when duplicate_object then null; end $$;

create table if not exists public.teacher_schedule_settings (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC', working_start time not null default '09:00', working_end time not null default '18:00',
  default_duration_min integer not null default 60, default_break_min integer not null default 0,
  max_active_bookings_per_student integer not null default 5,
  min_booking_notice_min integer not null default 120, cancellation_cutoff_min integer not null default 120,
  approval_required boolean not null default false, reminders_in_app boolean not null default true,
  reminders_email boolean not null default true, reminder_minutes integer[] not null default array[1440,60], updated_at timestamptz not null default now()
);
alter table public.teacher_schedule_settings enable row level security;
drop policy if exists "schedule settings visible" on public.teacher_schedule_settings;
create policy "schedule settings visible" on public.teacher_schedule_settings for select to authenticated using (true);
drop policy if exists "teachers manage schedule settings" on public.teacher_schedule_settings;
create policy "teachers manage schedule settings" on public.teacher_schedule_settings for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create table if not exists public.slot_waitlist (
  slot_id uuid not null references public.teacher_slots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null, status text not null default 'waiting', created_at timestamptz not null default now(),
  primary key (slot_id,user_id)
);
alter table public.slot_waitlist enable row level security;
drop policy if exists "waitlist visible to owner and teacher" on public.slot_waitlist;
create policy "waitlist visible to owner and teacher" on public.slot_waitlist for select to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.teacher_slots s where s.id=slot_id and s.teacher_id=auth.uid()));
drop policy if exists "students join waitlist" on public.slot_waitlist;
create policy "students join waitlist" on public.slot_waitlist for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "students leave waitlist" on public.slot_waitlist;
create policy "students leave waitlist" on public.slot_waitlist for delete to authenticated using (user_id=auth.uid());

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('google','outlook')), provider_account text,
  encrypted_refresh_token text, expires_at timestamptz, enabled boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,provider)
);
alter table public.calendar_connections enable row level security;
drop policy if exists "users view own calendar connections" on public.calendar_connections;
create policy "users view own calendar connections" on public.calendar_connections for select to authenticated using(user_id=auth.uid());

create table if not exists public.schedule_reminders (
  id uuid primary key default gen_random_uuid(), slot_id uuid not null references public.teacher_slots(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, channel text not null check(channel in ('in_app','email')),
  send_at timestamptz not null, sent_at timestamptz, unique(slot_id,user_id,channel,send_at)
);
alter table public.schedule_reminders enable row level security;
drop policy if exists "users view own reminders" on public.schedule_reminders;
create policy "users view own reminders" on public.schedule_reminders for select to authenticated using(user_id=auth.uid());

create or replace function public.join_slot_waitlist(target_slot_id uuid) returns integer
language plpgsql security definer set search_path=public as $$
declare next_position integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(max(position),0)+1 into next_position from public.slot_waitlist where slot_id=target_slot_id and status='waiting';
  insert into public.slot_waitlist(slot_id,user_id,position) values(target_slot_id,auth.uid(),next_position)
    on conflict(slot_id,user_id) do update set status='waiting' returning position into next_position;
  return next_position;
end $$;
grant execute on function public.join_slot_waitlist(uuid) to authenticated;

create or replace function public.cancel_own_booking(target_slot_id uuid) returns void
language plpgsql security definer set search_path=public as $$
declare target public.teacher_slots; cutoff integer; next_user uuid;
begin
  select * into target from public.teacher_slots where id=target_slot_id for update;
  if target.booked_by_user_id<>auth.uid() then raise exception 'Booking access denied'; end if;
  select coalesce(cancellation_cutoff_min,120) into cutoff from public.teacher_schedule_settings where teacher_id=target.teacher_id;
  cutoff:=coalesce(cutoff,120);
  if (target.slot_date + target.slot_time) < now() + make_interval(mins=>cutoff) then raise exception 'Cancellation deadline has passed'; end if;
  select user_id into next_user from public.slot_waitlist where slot_id=target_slot_id and status='waiting' order by position limit 1 for update;
  update public.teacher_slots set is_booked=false,booked_by_user_id=null,status='open',booking_status=null where id=target_slot_id;
  if next_user is not null then update public.slot_waitlist set status='offered' where slot_id=target_slot_id and user_id=next_user; end if;
end $$;
grant execute on function public.cancel_own_booking(uuid) to authenticated;

create or replace function public.book_teacher_slot(target_slot_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare target public.teacher_slots; settings public.teacher_schedule_settings; active_count integer; next_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target from public.teacher_slots where id=target_slot_id for update;
  if target.id is null or target.is_booked then raise exception 'Slot is no longer available'; end if;
  select * into settings from public.teacher_schedule_settings where teacher_id=target.teacher_id;
  if (target.slot_date + target.slot_time) < now() + make_interval(mins=>coalesce(settings.min_booking_notice_min,120)) then raise exception 'Booking notice deadline has passed'; end if;
  select count(*) into active_count from public.teacher_slots where booked_by_user_id=auth.uid() and status in ('pending','booked') and slot_date>=current_date;
  if active_count>=coalesce(settings.max_active_bookings_per_student,5) then raise exception 'Active booking limit reached'; end if;
  next_status:=case when coalesce(target.approval_required,settings.approval_required,false) then 'pending' else 'booked' end;
  update public.teacher_slots set is_booked=true,booked_by_user_id=auth.uid(),status=next_status,booking_status=next_status where id=target_slot_id;
  insert into public.schedule_reminders(slot_id,user_id,channel,send_at)
    select target_slot_id,auth.uid(),channel,(target.slot_date+target.slot_time)-make_interval(mins=>minutes)
    from unnest(coalesce(settings.reminder_minutes,array[1440,60])) minutes
    cross join lateral (values ('in_app'),('email')) c(channel)
    where (channel='in_app' and coalesce(settings.reminders_in_app,true)) or (channel='email' and coalesce(settings.reminders_email,true))
    on conflict do nothing;
  return next_status;
end $$;
grant execute on function public.book_teacher_slot(uuid) to authenticated;
