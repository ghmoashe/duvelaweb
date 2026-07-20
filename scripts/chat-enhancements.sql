-- Run once in the Supabase SQL editor for an existing Duvela deployment.
alter table public.chat_participants add column if not exists is_pinned boolean not null default false;
alter table public.chat_participants add column if not exists is_archived boolean not null default false;
alter table public.chat_participants add column if not exists is_blocked boolean not null default false;
alter table public.chat_messages add column if not exists edited_at timestamptz;

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
