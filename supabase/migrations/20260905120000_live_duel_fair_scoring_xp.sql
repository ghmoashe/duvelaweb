create extension if not exists pgcrypto;

create table if not exists public.live_duel_rooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid null,
  join_code text not null,
  target text not null default 'de',
  level text not null default 'A1',
  topic text null,
  duel_mode text not null default 'teacher',
  total_questions integer not null default 10,
  question_seconds integer not null default 15,
  deck jsonb not null default '[]'::jsonb,
  status text not null default 'lobby',
  current_question integer not null default -1,
  reveal_answer boolean not null default false,
  question_started_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.live_duel_rooms
  add column if not exists session_id uuid null,
  add column if not exists target text not null default 'de',
  add column if not exists level text not null default 'A1',
  add column if not exists topic text null,
  add column if not exists duel_mode text not null default 'teacher',
  add column if not exists total_questions integer not null default 10,
  add column if not exists question_seconds integer not null default 15,
  add column if not exists deck jsonb not null default '[]'::jsonb,
  add column if not exists current_question integer not null default -1,
  add column if not exists reveal_answer boolean not null default false,
  add column if not exists question_started_at timestamptz null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists live_duel_rooms_active_code_idx
  on public.live_duel_rooms (join_code)
  where status in ('lobby', 'running', 'paused');

create unique index if not exists live_duel_rooms_active_teacher_idx
  on public.live_duel_rooms (teacher_id)
  where status in ('lobby', 'running', 'paused');

create table if not exists public.live_duel_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_duel_rooms(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  origin text not null default 'app',
  score integer not null default 0,
  correct_count integer not null default 0,
  answered_count integer not null default 0,
  last_answered_question integer not null default -1,
  last_answered_option integer not null default -1,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.live_duel_players
  add column if not exists origin text not null default 'app',
  add column if not exists last_answered_question integer not null default -1,
  add column if not exists last_answered_option integer not null default -1,
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now();

create unique index if not exists live_duel_players_user_room_idx
  on public.live_duel_players (room_id, user_id)
  where user_id is not null;

create table if not exists public.live_duel_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_duel_rooms(id) on delete cascade,
  player_id uuid not null references public.live_duel_players(id) on delete cascade,
  question_index integer not null,
  option_index integer not null,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.live_duel_votes
  add column if not exists is_correct boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists live_duel_votes_one_per_question_idx
  on public.live_duel_votes (room_id, player_id, question_index);

create table if not exists public.live_duel_queue (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Student',
  join_code text null,
  created_at timestamptz not null default now()
);

alter table public.live_duel_queue
  add column if not exists join_code text null,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists live_duel_queue_teacher_user_idx
  on public.live_duel_queue (teacher_id, user_id);

create table if not exists public.live_duel_xp_awards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_duel_rooms(id) on delete cascade,
  player_id uuid not null references public.live_duel_players(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp integer not null,
  created_at timestamptz not null default now(),
  unique (room_id, player_id),
  unique (room_id, user_id)
);

alter table public.live_duel_rooms enable row level security;
alter table public.live_duel_players enable row level security;
alter table public.live_duel_votes enable row level security;
alter table public.live_duel_queue enable row level security;
alter table public.live_duel_xp_awards enable row level security;

drop policy if exists "live duel rooms are readable" on public.live_duel_rooms;
create policy "live duel rooms are readable"
  on public.live_duel_rooms for select
  using (true);

drop policy if exists "teachers host own live duel rooms" on public.live_duel_rooms;
create policy "teachers host own live duel rooms"
  on public.live_duel_rooms for all
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists "live duel players are readable" on public.live_duel_players;
create policy "live duel players are readable"
  on public.live_duel_players for select
  using (true);

drop policy if exists "learners join live duel rooms" on public.live_duel_players;
create policy "learners join live duel rooms"
  on public.live_duel_players for insert
  with check (
    (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.live_duel_rooms room
      where room.id = room_id
        and room.status in ('lobby', 'running', 'paused')
    )
  );

drop policy if exists "participants touch own live duel player" on public.live_duel_players;
drop policy if exists "teachers update live duel players" on public.live_duel_players;
create policy "teachers update live duel players"
  on public.live_duel_players for update
  to authenticated
  using (
    exists (
      select 1 from public.live_duel_rooms room
      where room.id = room_id
        and room.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.live_duel_rooms room
      where room.id = room_id
        and room.teacher_id = auth.uid()
    )
  );

drop policy if exists "teachers remove live duel players" on public.live_duel_players;
create policy "teachers remove live duel players"
  on public.live_duel_players for delete
  to authenticated
  using (
    exists (
      select 1 from public.live_duel_rooms room
      where room.id = room_id
        and room.teacher_id = auth.uid()
    )
  );

drop policy if exists "live duel votes are readable" on public.live_duel_votes;
create policy "live duel votes are readable"
  on public.live_duel_votes for select
  using (true);

drop policy if exists "players submit live duel votes" on public.live_duel_votes;
create policy "players submit live duel votes"
  on public.live_duel_votes for insert
  with check (
    exists (
      select 1 from public.live_duel_players player
      where player.id = player_id
        and player.room_id = room_id
        and (player.user_id is null or player.user_id = auth.uid())
    )
  );

drop policy if exists "teachers and learners manage live duel queue" on public.live_duel_queue;
create policy "teachers and learners manage live duel queue"
  on public.live_duel_queue for all
  to authenticated
  using (user_id = auth.uid() or teacher_id = auth.uid())
  with check (user_id = auth.uid() or teacher_id = auth.uid());

drop policy if exists "learners read own live duel xp awards" on public.live_duel_xp_awards;
create policy "learners read own live duel xp awards"
  on public.live_duel_xp_awards for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.prepare_live_duel_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  duel_room public.live_duel_rooms%rowtype;
  item jsonb;
begin
  select * into duel_room
  from public.live_duel_rooms
  where id = new.room_id;

  if duel_room.id is null then
    raise exception 'Duel room not found';
  end if;
  if duel_room.status <> 'running' or duel_room.reveal_answer then
    raise exception 'This question is closed';
  end if;
  if new.question_index <> duel_room.current_question then
    raise exception 'This question already moved on';
  end if;
  if new.option_index < 0 or new.option_index > 3 then
    raise exception 'Invalid answer option';
  end if;

  item := duel_room.deck -> new.question_index;
  new.is_correct := coalesce((item ->> 'a')::integer = new.option_index, false);
  return new;
end;
$$;

drop trigger if exists trg_prepare_live_duel_vote on public.live_duel_votes;
create trigger trg_prepare_live_duel_vote
  before insert on public.live_duel_votes
  for each row execute function public.prepare_live_duel_vote();

create or replace function public.apply_live_duel_vote_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_duel_players
  set
    answered_count = coalesce(answered_count, 0) + 1,
    correct_count = coalesce(correct_count, 0) + case when new.is_correct then 1 else 0 end,
    score = coalesce(score, 0) + case when new.is_correct then 1 else 0 end,
    last_answered_question = new.question_index,
    last_answered_option = new.option_index,
    last_seen_at = now()
  where id = new.player_id
    and room_id = new.room_id;
  return new;
end;
$$;

drop trigger if exists trg_apply_live_duel_vote_score on public.live_duel_votes;
create trigger trg_apply_live_duel_vote_score
  after insert on public.live_duel_votes
  for each row execute function public.apply_live_duel_vote_score();

create or replace function public.award_live_duel_xp(p_room_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  player_row public.live_duel_players%rowtype;
  room_status text;
  existing_xp integer;
  rank_index integer;
  xp_value integer;
  inserted_xp integer;
begin
  if current_user_id is null then
    return 0;
  end if;

  select * into player_row
  from public.live_duel_players
  where room_id = p_room_id
    and user_id = current_user_id
  limit 1;

  if player_row.id is null then
    return 0;
  end if;

  select status into room_status
  from public.live_duel_rooms
  where id = p_room_id;

  if room_status not in ('finished', 'closed') then
    return 0;
  end if;

  select xp into existing_xp
  from public.live_duel_xp_awards
  where room_id = p_room_id
    and player_id = player_row.id;

  if existing_xp is not null then
    return existing_xp;
  end if;

  select ranked.rank_no - 1 into rank_index
  from (
    select id, row_number() over (order by score desc, correct_count desc, joined_at asc) as rank_no
    from public.live_duel_players
    where room_id = p_room_id
      and user_id is not null
  ) ranked
  where ranked.id = player_row.id;

  xp_value := 8 + greatest(coalesce(player_row.correct_count, 0), 0) * 2;
  if coalesce(rank_index, 99) = 0 then
    xp_value := xp_value + 20;
  elsif rank_index = 1 then
    xp_value := xp_value + 12;
  elsif rank_index = 2 then
    xp_value := xp_value + 6;
  end if;

  insert into public.live_duel_xp_awards (room_id, player_id, user_id, xp)
  values (p_room_id, player_row.id, current_user_id, xp_value)
  on conflict do nothing
  returning xp into inserted_xp;

  if inserted_xp is null then
    select xp into existing_xp
    from public.live_duel_xp_awards
    where room_id = p_room_id
      and player_id = player_row.id;
    return coalesce(existing_xp, 0);
  end if;

  update public.profiles
  set score = coalesce(score, 0) + inserted_xp
  where id = current_user_id;

  return inserted_xp;
end;
$$;

grant execute on function public.award_live_duel_xp(uuid) to authenticated;
