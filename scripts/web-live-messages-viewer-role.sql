-- ================================================================
-- Duvela Web — fix viewer LIVE chat (role mismatch)
-- The live_messages CHECK constraint allows role IN ('viewer','teacher','system'),
-- but the INSERT RLS policy only lets a non-teacher insert when role = 'student'.
-- Those are mutually exclusive → viewers could NEVER post a chat message.
-- This aligns the policy with the constraint (and the web client, which now
-- sends role = 'viewer').
--
-- Idempotent. Run once in Supabase SQL Editor.
-- ================================================================

drop policy if exists live_messages_insert_participant on public.live_messages;

create policy live_messages_insert_participant on public.live_messages
  for insert
  with check (
    (sender_id = auth.uid())
    and exists (
      select 1
      from public.live_sessions session
      where session.id = live_messages.session_id
        and session.channel_name = live_messages.channel_name
        and session.status = 'live'
    )
    and (
      (role = 'teacher' and is_live_session_teacher(session_id))
      or (
        role = 'viewer'
        and (has_accepted_live_join_request(session_id) or is_active_live_participant(session_id))
      )
    )
  );
