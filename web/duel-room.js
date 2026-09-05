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

  function joinUrl(joinCode) {
    const code = String(joinCode || '').trim().toUpperCase();
    const origin = window.location.origin;
    const path = window.location.pathname || '/app.html';
    return origin + path + '?duel=' + encodeURIComponent(code) + '#duel';
  }

  // ── Teacher side ───────────────────────────────────────────────────────────

  async function currentTeacherId() {
    const supa = client();
    if (!supa) return null;
    const auth = await supa.auth.getUser();
    return auth?.data?.user?.id || null;
  }

  async function findMyActiveRoom() {
    const supa = client();
    if (!supa) throw new Error('Supabase is not configured.');
    const teacherId = await currentTeacherId();
    if (!teacherId) throw new Error('Sign in to host a duel.');
    const { data, error } = await supa
      .from(ROOM_TABLE)
      .select('*')
      .eq('teacher_id', teacherId)
      .in('status', ['lobby', 'running', 'paused'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function createRoom(options) {
    const supa = client();
    if (!supa) throw new Error('Supabase is not configured.');
    const teacherId = await currentTeacherId();
    if (!teacherId) throw new Error('Sign in to host a duel.');

    const deck = Array.isArray(options.deck) ? options.deck : [];
    const payload = {
      teacher_id: teacherId,
      session_id: options.sessionId || null,
      target: options.target || 'german',
      level: options.level || 'A1',
      topic: options.topic || null,
      duel_mode: options.mode || 'teacher',
      total_questions: deck.length || options.total_questions || 10,
      question_seconds: options.question_seconds || 15,
      deck,
      status: 'lobby',
      current_question: -1,
      reveal_answer: false
    };
    // Retry on the unique active-code index rather than trusting one draw.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await supa
        .from(ROOM_TABLE)
        .insert(Object.assign({ join_code: generateJoinCode() }, payload))
        .select()
        .single();
      if (!error) return data;
      // 23505 = unique violation: code taken, or this teacher already has a live room.
      if (error.code !== '23505') throw error;
      const existing = await findMyActiveRoom();
      if (existing) return existing;
    }
    throw new Error('Could not allocate a duel code. Try again.');
  }

  async function resetLobby(roomId, patch) {
    const supa = client();
    if (!supa || !roomId) return null;
    // Drop votes from a previous run so Q1 is answerable again on the same code.
    await supa.from(VOTE_TABLE).delete().eq('room_id', roomId);
    await supa
      .from(PLAYER_TABLE)
      .update({ score: 0, correct_count: 0, answered_count: 0 })
      .eq('room_id', roomId);
    return setRoomState(roomId, Object.assign({}, patch || {}, {
      status: 'lobby',
      current_question: -1,
      reveal_answer: false
    }));
  }

  async function ensureLobbyRoom(options) {
    const existing = await findMyActiveRoom();
    const deck = Array.isArray(options.deck) ? options.deck : [];
    const patch = {
      target: options.target || 'german',
      level: options.level || 'A1',
      topic: options.topic || null,
      duel_mode: options.mode || 'teacher',
      total_questions: deck.length || options.total_questions || 10,
      question_seconds: options.question_seconds || 15,
      deck
    };
    if (!existing) return createRoom(options);
    if (existing.status === 'running' || existing.status === 'paused') {
      try {
        return await resetLobby(existing.id, patch);
      } catch (error) {
        // Vote-delete policy may not be applied yet; close and mint a fresh lobby.
        await setRoomState(existing.id, { status: 'closed' });
        return createRoom(options);
      }
    }
    return setRoomState(existing.id, patch);
  }

  async function kickPlayer(playerId) {
    const supa = client();
    if (!supa || !playerId) return;
    const { error } = await supa.from(PLAYER_TABLE).delete().eq('id', playerId);
    if (error) throw error;
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
    setRoomState(roomId, {
      current_question: index,
      reveal_answer: false,
      status: 'running',
      question_started_at: new Date().toISOString()
    });
  const revealAnswer = (roomId) => setRoomState(roomId, { reveal_answer: true });
  const pauseRoom = (roomId) => setRoomState(roomId, { status: 'paused' });
  const resumeRoom = (roomId, extra) =>
    setRoomState(roomId, Object.assign({ status: 'running' }, extra || {}));
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
    if (userId && userId === room.teacher_id) {
      throw new Error('You are hosting this duel.');
    }

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

  function parseChatVote(text) {
    const raw = String(text || '').trim().toUpperCase().replace(/["""']/g, '');
    if (!raw) return -1;
    const match = raw.match(/^(?:ANSWER|VOTE|ГОЛОС|ОТВЕТ|OPTION|VAR)\s*[:.\-]?\s*([ABCD])(?:\b|[\).:!]|$)/)
      || raw.match(/^([ABCD])(?:\b|[\).:!]|$)/);
    if (!match) return -1;
    return match[1].charCodeAt(0) - 65;
  }

  async function findActiveLiveSession() {
    const supa = client();
    if (!supa) return null;
    const teacherId = await currentTeacherId();
    if (!teacherId) return null;
    const { data, error } = await supa
      .from('live_sessions')
      .select('id, teacher_id, status, channel_name')
      .eq('teacher_id', teacherId)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data || null;
  }

  async function ingestChatVote(roomId, payload) {
    const supa = client();
    if (!supa || !roomId) return null;
    const optionIndex = Number(payload && payload.optionIndex);
    if (!(optionIndex >= 0 && optionIndex <= 3)) return null;

    const roomRes = await supa
      .from(ROOM_TABLE)
      .select('id, current_question, deck, teacher_id, status, reveal_answer')
      .eq('id', roomId)
      .maybeSingle();
    const room = roomRes.data;
    if (!room || room.status !== 'running' || room.reveal_answer) return null;
    const userId = payload.userId || null;
    if (userId && userId === room.teacher_id) return null;
    const questionIndex = Number(room.current_question);
    if (!(questionIndex >= 0)) return null;
    const deck = Array.isArray(room.deck) ? room.deck : [];
    const item = deck[questionIndex];
    const isCorrect = !!(item && Number(item.a) === optionIndex);
    const name = String(payload.displayName || 'Chat').trim().slice(0, 60) || 'Chat';

    let player = null;
    if (userId) {
      const existing = await supa.from(PLAYER_TABLE).select('*').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
      player = existing.data;
    }
    if (!player) {
      let chatLookup = await supa
        .from(PLAYER_TABLE)
        .select('*')
        .eq('room_id', roomId)
        .eq('display_name', name)
        .eq('origin', 'chat')
        .maybeSingle();
      if (chatLookup.error && /origin/.test(String(chatLookup.error.message || ''))) {
        chatLookup = await supa.from(PLAYER_TABLE).select('*').eq('room_id', roomId).eq('display_name', name).maybeSingle();
      }
      player = chatLookup.data;
    }
    if (!player) {
      const row = { room_id: roomId, user_id: userId, display_name: name, origin: 'chat' };
      let inserted = await supa.from(PLAYER_TABLE).insert(row).select().single();
      if (inserted.error && /origin/.test(String(inserted.error.message || ''))) {
        delete row.origin;
        inserted = await supa.from(PLAYER_TABLE).insert(row).select().single();
      }
      if (inserted.error) return null;
      player = inserted.data;
    }
    return submitVote(roomId, player.id, questionIndex, optionIndex, isCorrect);
  }

  async function enqueueWaiter(teacherId, displayName, joinCode) {
    const supa = client();
    const userId = await currentTeacherId();
    if (!supa || !userId || !teacherId) throw new Error('Sign in to join the waiting list.');
    const { error } = await supa.from('live_duel_queue').upsert({
      teacher_id: teacherId,
      user_id: userId,
      display_name: String(displayName || 'Student').slice(0, 60),
      join_code: joinCode || null
    }, { onConflict: 'teacher_id,user_id' });
    if (error) throw error;
  }

  async function leaveQueue(teacherId) {
    const supa = client();
    const userId = await currentTeacherId();
    if (!supa || !userId || !teacherId) return;
    await supa.from('live_duel_queue').delete().eq('teacher_id', teacherId).eq('user_id', userId);
  }

  async function fetchQueue(teacherId) {
    const supa = client();
    if (!supa || !teacherId) return [];
    const { data, error } = await supa
      .from('live_duel_queue')
      .select('id,user_id,display_name,created_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return data || [];
  }

  async function findTeacherLobby(teacherId) {
    const supa = client();
    if (!supa || !teacherId) return null;
    const { data, error } = await supa
      .from(ROOM_TABLE)
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('status', 'lobby')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data || null;
  }

  function subscribeQueue(teacherId, onChange) {
    const supa = client();
    if (!supa || !teacherId) return null;
    const channel = supa.channel('duel-queue-' + teacherId + '-' + Date.now());
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'live_duel_queue',
      filter: 'teacher_id=eq.' + teacherId
    }, () => { if (onChange) onChange(); });
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: ROOM_TABLE,
      filter: 'teacher_id=eq.' + teacherId
    }, (payload) => { if (onChange) onChange(payload.new || payload.old); });
    channel.subscribe();
    return channel;
  }

  function subscribeLiveChat(sessionId, onMessage) {
    const supa = client();
    if (!supa || !sessionId) return null;
    const channel = supa.channel('duel-live-chat-' + sessionId + '-' + Date.now());
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'live_messages',
      filter: 'session_id=eq.' + sessionId
    }, (payload) => {
      if (onMessage) onMessage(payload.new || {});
    });
    channel.subscribe();
    return channel;
  }

  async function fetchPlayers(roomId, options) {
    const supa = client();
    if (!supa || !roomId) return [];
    let query = supa
      .from(PLAYER_TABLE)
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .order('correct_count', { ascending: false })
      .limit(200);
    if (options && options.joinedOnly) query = query.neq('origin', 'chat');
    const { data, error } = await query;
    if (error && options && options.joinedOnly) return fetchPlayers(roomId);
    if (error) return [];
    return data || [];
  }

  async function fetchTally(roomId, questionIndex) {
    const supa = client();
    const empty = { counts: [0, 0, 0, 0], answeredIds: {} };
    if (!supa || !roomId) return empty;
    const { data, error } = await supa
      .from(VOTE_TABLE)
      .select('option_index, player_id')
      .eq('room_id', roomId)
      .eq('question_index', questionIndex);
    if (error) throw error;
    const counts = [0, 0, 0, 0];
    const answeredIds = {};
    (data || []).forEach((row) => {
      const index = Number(row.option_index);
      if (index >= 0 && index < 4) counts[index] += 1;
      if (row.player_id) answeredIds[row.player_id] = true;
    });
    return { counts, answeredIds };
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
    joinUrl,
    createRoom,
    findMyActiveRoom,
    ensureLobbyRoom,
    resetLobby,
    kickPlayer,
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
    parseChatVote,
    ingestChatVote,
    findActiveLiveSession,
    subscribeLiveChat,
    enqueueWaiter,
    leaveQueue,
    fetchQueue,
    findTeacherLobby,
    subscribeQueue,
    fetchPlayers,
    fetchTally,
    subscribe,
    unsubscribe
  };
})();
