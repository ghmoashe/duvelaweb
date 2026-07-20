-- Run once in the Supabase SQL editor for an existing Duvela deployment.
alter table public.chat_participants add column if not exists is_pinned boolean not null default false;
alter table public.chat_participants add column if not exists is_archived boolean not null default false;
alter table public.chat_participants add column if not exists is_blocked boolean not null default false;
alter table public.chat_messages add column if not exists edited_at timestamptz;
alter table public.chat_messages add column if not exists reply_to_id uuid references public.chat_messages(id) on delete set null;
alter table public.chat_messages add column if not exists forwarded_from_id uuid references public.chat_messages(id) on delete set null;
alter table public.chat_messages add column if not exists attachment_path text;
alter table public.chat_messages add column if not exists attachment_name text;
alter table public.chat_messages add column if not exists attachment_type text;
alter table public.chat_messages add column if not exists attachment_iv text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-encrypted', 'chat-encrypted', false, 20971520) on conflict (id) do nothing;
drop policy if exists "chat members upload encrypted attachments" on storage.objects;
create policy "chat members upload encrypted attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-encrypted' and (storage.foldername(name))[1] in (select conversation_id::text from public.chat_participants where user_id = auth.uid()));
drop policy if exists "chat members read encrypted attachments" on storage.objects;
create policy "chat members read encrypted attachments" on storage.objects for select to authenticated
  using (bucket_id = 'chat-encrypted' and (storage.foldername(name))[1] in (select conversation_id::text from public.chat_participants where user_id = auth.uid()));

create table if not exists public.chat_e2ee_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_key jsonb not null,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.chat_e2ee_envelopes (
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.chat_e2ee_initializers (
  conversation_id uuid primary key references public.chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.chat_e2ee_initializers enable row level security;
drop policy if exists "members view e2ee initializer" on public.chat_e2ee_initializers;
create policy "members view e2ee initializer" on public.chat_e2ee_initializers for select to authenticated
  using (public.is_chat_participant(conversation_id));

create or replace function public.claim_chat_e2ee_initialization(target_conversation_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare claimed_user uuid;
begin
  if auth.uid() is null or not public.is_chat_participant(target_conversation_id) then
    raise exception 'Conversation access denied';
  end if;
  insert into public.chat_e2ee_initializers (conversation_id, user_id)
  values (target_conversation_id, auth.uid())
  on conflict (conversation_id) do update
    set user_id = case
      when chat_e2ee_initializers.claimed_at < now() - interval '2 minutes'
       and not exists (select 1 from public.chat_e2ee_envelopes e where e.conversation_id = target_conversation_id)
      then auth.uid() else chat_e2ee_initializers.user_id end,
    claimed_at = case
      when chat_e2ee_initializers.claimed_at < now() - interval '2 minutes'
       and not exists (select 1 from public.chat_e2ee_envelopes e where e.conversation_id = target_conversation_id)
      then now() else chat_e2ee_initializers.claimed_at end
  returning user_id into claimed_user;
  return claimed_user;
end;
$$;
revoke all on function public.claim_chat_e2ee_initialization(uuid) from public, anon;
grant execute on function public.claim_chat_e2ee_initialization(uuid) to authenticated;
alter table public.chat_e2ee_identities enable row level security;
alter table public.chat_e2ee_identities add column if not exists last_seen_at timestamptz;
alter table public.chat_e2ee_envelopes enable row level security;
drop policy if exists "authenticated can read e2ee public identities" on public.chat_e2ee_identities;
create policy "authenticated can read e2ee public identities" on public.chat_e2ee_identities for select to authenticated using (true);
drop policy if exists "users manage own e2ee identity" on public.chat_e2ee_identities;
create policy "users manage own e2ee identity" on public.chat_e2ee_identities for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "members read own e2ee envelope" on public.chat_e2ee_envelopes;
create policy "members read own e2ee envelope" on public.chat_e2ee_envelopes for select to authenticated using (user_id = auth.uid() and public.is_chat_participant(conversation_id));
drop policy if exists "members create e2ee envelopes" on public.chat_e2ee_envelopes;
create policy "members create e2ee envelopes" on public.chat_e2ee_envelopes for insert to authenticated with check (
  public.is_chat_participant(conversation_id)
  and exists (select 1 from public.chat_participants target where target.conversation_id = chat_e2ee_envelopes.conversation_id and target.user_id = chat_e2ee_envelopes.user_id)
  and exists (select 1 from public.chat_e2ee_initializers i where i.conversation_id = chat_e2ee_envelopes.conversation_id and i.user_id = auth.uid())
);

create or replace function public.enforce_chat_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.chat_messages where sender_id = new.sender_id and created_at > now() - interval '10 seconds') >= 8 then
    raise exception 'Too many messages. Please slow down.';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_messages_rate_limit on public.chat_messages;
create trigger chat_messages_rate_limit before insert on public.chat_messages for each row execute function public.enforce_chat_rate_limit();

create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 12),
  primary key (message_id, user_id, emoji)
);
alter table public.chat_message_reactions enable row level security;
drop policy if exists "participants view reactions" on public.chat_message_reactions;
create policy "participants view reactions" on public.chat_message_reactions for select to authenticated
  using (exists (select 1 from public.chat_messages m where m.id = message_id and public.is_chat_participant(m.conversation_id)));
drop policy if exists "users manage own reactions" on public.chat_message_reactions;
create policy "users manage own reactions" on public.chat_message_reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid references auth.users(id) on delete set null, conversation_id uuid references public.chat_conversations(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null, decrypted_excerpt text, reason text not null, created_at timestamptz not null default now()
);
alter table public.chat_reports enable row level security;
drop policy if exists "users submit chat reports" on public.chat_reports;
create policy "users submit chat reports" on public.chat_reports for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "users can leave chat conversations" on public.chat_participants;
create policy "users can leave chat conversations" on public.chat_participants
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "senders can delete their chat messages" on public.chat_messages;
create policy "senders can delete their chat messages" on public.chat_messages
  for delete to authenticated using (sender_id = auth.uid());

drop policy if exists "senders can edit their chat messages" on public.chat_messages;
create policy "senders can edit their chat messages" on public.chat_messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

drop policy if exists "participants can send chat messages" on public.chat_messages;
create policy "participants can send chat messages" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_participant(conversation_id)
    and not exists (
      select 1 from public.chat_participants blocked_participant
      where blocked_participant.conversation_id = chat_messages.conversation_id
        and blocked_participant.is_blocked = true
    )
  );

create or replace function public.delete_chat_for_everyone(target_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_chat_participant(target_conversation_id) then
    raise exception 'Conversation access denied';
  end if;
  delete from public.chat_conversations where id = target_conversation_id;
end;
$$;
revoke all on function public.delete_chat_for_everyone(uuid) from public, anon;
grant execute on function public.delete_chat_for_everyone(uuid) to authenticated;

-- Reopening an existing direct chat should bring it back from the archive.
create or replace function public.restore_own_chat(target_conversation_id uuid)
returns void language sql security invoker set search_path = public as $$
  update public.chat_participants set is_archived = false
  where conversation_id = target_conversation_id and user_id = auth.uid();
$$;
revoke all on function public.restore_own_chat(uuid) from public, anon;
grant execute on function public.restore_own_chat(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_participants'
  ) then
    alter publication supabase_realtime add table public.chat_participants;
  end if;
exception when undefined_object then null; when duplicate_object then null;
end;
$$;
