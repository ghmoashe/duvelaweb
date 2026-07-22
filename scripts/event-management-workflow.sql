-- Duvela event management workflow.
-- Run after duvela-web-supabase.sql and live-audience-notifications.sql.

alter table public.events add column if not exists status text not null default 'published';
alter table public.events drop constraint if exists events_status_check;
alter table public.events add constraint events_status_check check(status in ('draft','published','completed','canceled'));

alter table public.event_rsvps enable row level security;
drop policy if exists "event organizers view registrations" on public.event_rsvps;
create policy "event organizers view registrations" on public.event_rsvps
for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()
  )
);

create or replace function public.notify_event_participants(target_event_id uuid, message_body text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare sent integer;
begin
  if not exists (select 1 from public.events where id=target_event_id and organizer_id=auth.uid()) then
    raise exception 'Only the event organizer can message participants';
  end if;
  insert into public.notifications(user_id,type,title,body)
  select distinct r.user_id,'event_message',coalesce(e.title,'Duvela event'),left(message_body,1000)
  from public.event_rsvps r join public.events e on e.id=r.event_id
  where r.event_id=target_event_id and r.status='going' and r.user_id<>auth.uid();
  get diagnostics sent = row_count;
  return sent;
end;
$$;
grant execute on function public.notify_event_participants(uuid,text) to authenticated;

create or replace function public.notify_event_deleted()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,type,title,body)
  select distinct r.user_id,'event_deleted',coalesce(old.title,'Duvela event'),'Событие удалено организатором.'
  from public.event_rsvps r where r.event_id=old.id and r.status='going' and r.user_id<>old.organizer_id;
  return old;
end; $$;
drop trigger if exists events_notify_deleted on public.events;
create trigger events_notify_deleted before delete on public.events for each row execute function public.notify_event_deleted();

create table if not exists public.event_views (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key(event_id,user_id)
);
alter table public.event_views enable row level security;
create or replace function public.track_event_view(target_event_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare total integer;
begin
  insert into public.event_views(event_id,user_id) values(target_event_id,auth.uid())
  on conflict(event_id,user_id) do update set viewed_at=now();
  select count(*) into total from public.event_views where event_id=target_event_id;
  return total;
end; $$;
grant execute on function public.track_event_view(uuid) to authenticated;

create table if not exists public.event_reminders (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  send_at timestamptz not null,
  kind text not null check(kind in ('24h','15m')),
  sent_at timestamptz,
  primary key(event_id,user_id,kind)
);
alter table public.event_reminders enable row level security;
drop policy if exists "users view own event reminders" on public.event_reminders;
create policy "users view own event reminders" on public.event_reminders for select to authenticated using(user_id=auth.uid());

create or replace function public.schedule_event_rsvp_reminders()
returns trigger language plpgsql security definer set search_path=public as $$
declare starts timestamptz;
begin
  if new.status='going' then
    select (event_date::text || ' ' || coalesce(event_time::text,'12:00'))::timestamp at time zone 'Europe/Berlin'
      into starts from public.events where id=new.event_id;
    insert into public.event_reminders(event_id,user_id,send_at,kind) values
      (new.event_id,new.user_id,starts-interval '24 hours','24h'),
      (new.event_id,new.user_id,starts-interval '15 minutes','15m')
    on conflict(event_id,user_id,kind) do update set send_at=excluded.send_at,sent_at=null;
  else
    delete from public.event_reminders where event_id=new.event_id and user_id=new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists event_rsvp_schedule_reminders on public.event_rsvps;
create trigger event_rsvp_schedule_reminders after insert or update of status on public.event_rsvps
for each row execute function public.schedule_event_rsvp_reminders();

create or replace function public.notify_event_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare starts timestamptz;
begin
  if old.event_date is distinct from new.event_date or old.event_time is distinct from new.event_time then
    insert into public.notifications(user_id,type,title,body)
    select distinct r.user_id,'event_changed',coalesce(new.title,'Duvela event'),
      'Время события изменено: '||coalesce(new.event_date::text,'')||' '||coalesce(new.event_time::text,'')
    from public.event_rsvps r where r.event_id=new.id and r.status='going' and r.user_id<>new.organizer_id;
    starts := (new.event_date::text || ' ' || coalesce(new.event_time::text,'12:00'))::timestamp at time zone 'Europe/Berlin';
    update public.event_reminders set send_at=starts-interval '24 hours',sent_at=null where event_id=new.id and kind='24h';
    update public.event_reminders set send_at=starts-interval '15 minutes',sent_at=null where event_id=new.id and kind='15m';
  end if;
  if new.status='canceled' and old.status is distinct from 'canceled' then
    insert into public.notifications(user_id,type,title,body)
    select distinct r.user_id,'event_canceled',coalesce(new.title,'Duvela event'),'Событие отменено организатором.'
    from public.event_rsvps r where r.event_id=new.id and r.status='going' and r.user_id<>new.organizer_id;
  end if;
  return new;
end; $$;
drop trigger if exists events_notify_change on public.events;
create trigger events_notify_change after update of event_date,event_time,status on public.events
for each row execute function public.notify_event_change();

create or replace function public.dispatch_due_event_reminders()
returns integer language plpgsql security definer set search_path=public as $$
declare sent integer;
begin
  insert into public.notifications(user_id,type,title,body)
  select r.user_id,'event_reminder',coalesce(e.title,'Duvela event'),
    case when r.kind='24h' then 'Событие начнётся через 24 часа.' else 'Событие начнётся через 15 минут.' end
  from public.event_reminders r join public.events e on e.id=r.event_id
  where r.sent_at is null and r.send_at<=now() and e.status='published';
  get diagnostics sent=row_count;
  update public.event_reminders set sent_at=now() where sent_at is null and send_at<=now();
  return sent;
end; $$;
-- In Supabase Cron, run every minute:
-- select public.dispatch_due_event_reminders();
