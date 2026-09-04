// LIVE Language Duel rooms — real multiplayer for teacher-vs-class play.
//
// Before this, the web duel only looked multiplayer: the teacher tapped the
// A/B/C/D poll bars by hand, the join code pointed at nothing, and the
// "Students" score was a bot on a 4.2s timer. This module backs those three
// surfaces with live_duel_rooms / live_duel_players / live_duel_votes so a
// class can actually play along from their own devices.
//
// Exposed as window.DuvelaDuelRoom.
(function () {
  const ROOM_TABLE = 'live_duel_rooms';
  const PLAYER_TABLE = 'live_duel_players';
  const VOTE_TABLE = 'live_duel_votes';

  function client() {
    const config = window.DuvelaWebConfig;
    if (!config || typeof config.createSupabaseClient !== 'function') return null;
    return config.createSupabaseClient();
  }

  function generateJoinCode() {
    // Room codes are shown on stream and typed by hand, so avoid the glyphs
    // that get misread (0/O, 1/I). 4 chars over a 32-symbol alphabet is ~1M
    // combinations, and codes are only unique among *active* rooms.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'DUEL';
    for (let i = 0; i < 4; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }

  // ── Teacher side ───────────────────────────────────────────────────────────

  async function createRoom(options) {
    const supa = client();
    if (!supa) throw new Error('Supabase is not configured.');
    const auth = await supa.auth.getUser();
    const teacherId = auth?.data?.user?.id;
    if (!teacherId) throw new Error('Sign in to host a duel.');

    const deck = Array.isArray(options.deck) ? options.deck : [];
    // Retry on the unique active-code index rather than trusting one draw.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = generateJoinCode();
      const { data, error } = await supa
        .from(ROOM_TABLE)
        .insert({
          join_code: joinCode,
          teacher_id: teacherId,
          session_id: options.sessionId || null,
          target: options.target || 'german',
          level: options.level || 'A1',
          topic: options.topic || null,
          duel_mode: options.mode || 'teacher',
          total_questions: deck.length || 10,
          deck,
          status: 'lobby',
          current_question: -1
        })
        .select()
        .single();
      if (!error) return data;
      // 23505 = unique violation: that code is taken by another live room.
      if (error.code !== '23505') throw error;
    }
    throw new Error('Could not allocate a duel code. Try again.');
  }

  async function setRoomState(roomId, patch) {
    const supa = client();
    if (!supa || !roomId) return null;
    const { data, error } = await supa
      .from(ROOM_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', roomId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const showQuestion = (roomId, index) =>
    setRoomState(roomId, { current_question: index, reveal_answer: false, status: 'running' });
  const revealAnswer = (roomId) => setRoomState(roomId, { reveal_answer: true });
  const pauseRoom = (roomId) => setRoomState(roomId, { status: 'paused' });
  const resumeRoom = (roomId) => setRoomState(roomId, { status: 'running' });
  const finishRoom = (roomId) => setRoomState(roomId, { status: 'finished' });
  const closeRoom = (roomId) => setRoomState(roomId, { status: 'closed' });

  // ── Learner side ───────────────────────────────────────────────────────────

  async function findRoomByCode(joinCode) {
    const supa = client();
    if (!supa) throw new Error('Supabase is not configured.');
    const code = String(joinCode || '').trim().toUpperCase();
    if (!code) throw new Error('Enter the duel code.');
    const { data, error } = await supa
      .from(ROOM_TABLE)
      .select('*')
      .eq('join_code', code)
      .in('status', ['lobby', 'running', 'paused'])
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No live duel with that code.');
    return data;
  }

  async function joinRoom(joinCode, displayName) {
    const supa = client();
    if (!supa) throw new Error('Supabase is not configured.');
    const room = await findRoomByCode(joinCode);
    const auth = await supa.auth.getUser();
    const userId = auth?.data?.user?.id || null;

    // A signed-in learner rejoining (refresh, dropped connection) must land on
    // the same player row so their score survives.
    if (userId) {
      const existing = await supa
        .from(PLAYER_TABLE)
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', userId)
        .maybeSingle();
      if (existing.data) {
        await supa
          .from(PLAYER_TABLE)
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', existing.data.id);
        return { room, player: existing.data };
      }
    }

    const name = String(displayName || '').trim() || 'Student';
    const { data, error } = await supa
      .from(PLAYER_TABLE)
      .insert({ room_id: room.id, user_id: userId, display_name: name.slice(0, 60) })
      .select()
      .single();
    if (error) throw error;
    return { room, player: data };
  }

  async function submitVote(roomId, playerId, questionIndex, optionIndex, isCorrect) {
    const supa = client();
    if (!supa) throw new Error('Supabase is not configured.');
    const { data, error } = await supa
      .from(VOTE_TABLE)
      .insert({
        room_id: roomId,
        player_id: playerId,
        question_index: questionIndex,
        option_index: optionIndex,
        is_correct: !!isCorrect
      })
      .select()
      .single();
    // 23505 = the learner already answered this question; that's not an error
    // worth surfacing, the poll simply ignores the second tap.
    if (error && error.code === '23505') return null;
    if (error) throw error;
    return data;
  }

  // ── Shared reads ───────────────────────────────────────────────────────────

  async function fetchPlayers(roomId) {
    const supa = client();
    if (!supa || !roomId) return [];
    const { data, error } = await supa
      .from(PLAYER_TABLE)
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .order('correct_count', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  }

  async function fetchTally(roomId, questionIndex) {
    const supa = client();
    if (!supa || !roomId) return [0, 0, 0, 0];
    const { data, error } = await supa
      .from(VOTE_TABLE)
      .select('option_index')
      .eq('room_id', roomId)
      .eq('question_index', questionIndex);
    if (error) throw error;
    const counts = [0, 0, 0, 0];
    (data || []).forEach((row) => {
      const index = Number(row.option_index);
      if (index >= 0 && index < 4) counts[index] += 1;
    });
    return counts;
  }

  // ── Realtime ───────────────────────────────────────────────────────────────

  // One channel per room carries all three streams. handlers may supply
  // onVote / onPlayer / onRoom; each is optional.
  function subscribe(roomId, handlers) {
    const supa = client();
    if (!supa || !roomId) return null;
    const on = handlers || {};
    const channel = supa.channel('duel-room-' + roomId + '-' + Date.now());

    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: VOTE_TABLE,
      filter: 'room_id=eq.' + roomId
    }, (payload) => { if (on.onVote) on.onVote(payload.new); });

    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: PLAYER_TABLE,
      filter: 'room_id=eq.' + roomId
    }, (payload) => { if (on.onPlayer) on.onPlayer(payload.new || payload.old, payload.eventType); });

    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: ROOM_TABLE,
      filter: 'id=eq.' + roomId
    }, (payload) => { if (on.onRoom) on.onRoom(payload.new); });

    channel.subscribe();
    return channel;
  }

  function unsubscribe(channel) {
    const supa = client();
    if (!supa || !channel) return;
    try { supa.removeChannel(channel); } catch (error) { /* already gone */ }
  }

  window.DuvelaDuelRoom = {
    generateJoinCode,
    createRoom,
    setRoomState,
    showQuestion,
    revealAnswer,
    pauseRoom,
    resumeRoom,
    finishRoom,
    closeRoom,
    findRoomByCode,
    joinRoom,
    submitVote,
    fetchPlayers,
    fetchTally,
    subscribe,
    unsubscribe
  };
})();
