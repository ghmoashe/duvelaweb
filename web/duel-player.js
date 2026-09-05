// Learner half of the LIVE Language Duel: join a teacher's room by code and
// play along from your own device.
//
// The teacher screen (app-feature-study.js) creates the room and steers
// current_question; this module follows that room over Realtime and writes one
// vote per question into live_duel_votes. Without it the join code printed on
// stream pointed at nothing.
//
// Mounts itself on #duelJoinForm inside the Duel panel.
(function () {
  function tr(en, ru) {
    return window.DuvelaCurrentAppLang === 'ru' ? ru : en;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function api() {
    return window.DuvelaDuelRoom || null;
  }

  function supabase() {
    const config = window.DuvelaWebConfig;
    if (!config || typeof config.createSupabaseClient !== 'function') return null;
    return config.createSupabaseClient();
  }

  const state = {
    room: null,
    player: null,
    channel: null,
    // Question index this device has already answered, so a re-render (roster
    // tick, room update) never re-opens the options.
    answeredIndex: -1,
    answeredOption: -1,
    players: [],
    clockId: null,
    xpAwarded: false,
    waiting: null,
    queue: [],
    queueChannel: null
  };

  // Best-effort: a signed-in learner should not have to retype their name.
  async function suggestedName() {
    const supa = supabase();
    if (!supa) return '';
    try {
      const auth = await supa.auth.getUser();
      const user = auth?.data?.user;
      if (!user) return '';
      const profile = await supa
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      return profile?.data?.full_name || user.email?.split('@')[0] || '';
    } catch (error) {
      return '';
    }
  }

  function playCard() {
    let card = document.getElementById('duelPlayCard');
    if (card) return card;
    const panel = document.querySelector('[data-panel="duel"]');
    if (!panel) return null;
    card = document.createElement('div');
    card.id = 'duelPlayCard';
    card.className = 'duel-play-card';
    const launch = document.getElementById('duelLaunchCard');
    if (launch && launch.parentNode === panel) panel.insertBefore(card, launch.nextSibling);
    else panel.appendChild(card);
    return card;
  }

  function setStatus(message, tone) {
    const node = document.getElementById('duelJoinStatus');
    if (!node) return;
    node.textContent = message || '';
    node.className = 'duel-join-status' + (tone ? ' ' + tone : '');
  }

  function codeFromLocation() {
    try {
      const query = new URLSearchParams(window.location.search || '');
      const fromQuery = query.get('duel') || query.get('code') || query.get('join');
      if (fromQuery) return String(fromQuery).trim().toUpperCase();
      const hash = String(window.location.hash || '');
      const q = hash.indexOf('?');
      if (q >= 0) {
        const hashQuery = new URLSearchParams(hash.slice(q + 1));
        const fromHash = hashQuery.get('duel') || hashQuery.get('code') || hashQuery.get('join');
        if (fromHash) return String(fromHash).trim().toUpperCase();
      }
      const path = hash.match(/^#duel\/([A-Z0-9]+)/i);
      return path ? path[1].toUpperCase() : '';
    } catch (error) {
      return '';
    }
  }

  function isHostingOverlay() {
    const overlay = document.getElementById('studyOverlay');
    return !!(overlay && overlay.classList.contains('open') && overlay.getAttribute('data-practice-tool') === 'duel');
  }

  function currentItem() {
    const room = state.room;
    if (!room) return null;
    const deck = Array.isArray(room.deck) ? room.deck : [];
    const index = roomQuestionIndex(room);
    if (!(index >= 0) || index >= deck.length) return null;
    const item = deck[index];
    if (!item || !Array.isArray(item.opts) || item.opts.length < 2) return null;
    return item;
  }

  function secondsLeft(room) {
    const limit = Number((room && room.question_seconds) || 15);
    if (!room || room.status === 'paused') return limit;
    const started = room.question_started_at ? new Date(room.question_started_at).getTime() : 0;
    if (!started) return limit;
    return Math.max(0, Math.ceil(limit - (Date.now() - started) / 1000));
  }

  function roomQuestionIndex(room) {
    const index = Number(room && room.current_question);
    return Number.isFinite(index) ? index : -1;
  }

  function stopClock() {
    if (state.clockId) {
      clearInterval(state.clockId);
      state.clockId = null;
    }
  }

  function startClock() {
    stopClock();
    state.clockId = setInterval(function () {
      const node = document.getElementById('duelPlayTimer');
      if (!state.room || state.room.status !== 'running') return;
      const left = secondsLeft(state.room);
      if (node) {
        node.textContent = String(left);
        node.classList.toggle('urgent', left <= 5);
      }
      if (left <= 0 && !state.room.reveal_answer) {
        const options = document.querySelectorAll('[data-duel-play-option]');
        Array.prototype.forEach.call(options, function (button) { button.disabled = true; });
      }
    }, 200);
  }

  function playerXp(player, rank) {
    const correct = Number(player && player.correct_count || 0);
    let xp = 8 + correct * 2;
    if (rank === 0) xp += 20;
    else if (rank === 1) xp += 12;
    else if (rank === 2) xp += 6;
    return xp;
  }

  async function awardFinishXp() {
    if (state.xpAwarded || !state.player) return;
    state.xpAwarded = true;
    const supa = supabase();
    if (!supa) return;
    try {
      const auth = await supa.auth.getUser();
      const userId = auth && auth.data && auth.data.user && auth.data.user.id;
      if (!userId) return;
      let xp = 0;
      if (state.room && state.room.id) {
        const rpc = await supa.rpc('award_live_duel_xp', { p_room_id: state.room.id });
        if (!rpc.error) xp = Number(rpc.data || 0);
        else if (!/award_live_duel_xp/i.test(String(rpc.error.message || ''))) throw rpc.error;
      }
      if (!xp) {
        const rank = state.players.findIndex(function (player) { return player.id === state.player.id; });
        xp = playerXp(state.player, rank < 0 ? 99 : rank);
        const profile = await supa.from('profiles').select('score').eq('id', userId).maybeSingle();
        const current = Number(profile && profile.data && profile.data.score || 0);
        const updated = await supa.from('profiles').update({ score: current + xp }).eq('id', userId);
        if (updated.error) throw updated.error;
      }
      state.awardedXp = xp;
      render();
    } catch (error) { /* XP is best-effort */ }
  }

  function scoreboardHtml() {
    if (!state.players.length) return '';
    const me = state.player ? state.player.id : null;
    return '<ol class="duel-play-board">' + state.players.slice(0, 8).map(function (player, index) {
      const mine = player.id === me ? ' class="me"' : '';
      return '<li' + mine + '><b>' + (index + 1) + '</b><span>' + esc(player.display_name || 'Student') +
        '</span><em>' + Number(player.score || player.correct_count || 0) + '</em></li>';
    }).join('') + '</ol>';
  }

  function render() {
    const card = playCard();
    if (!card) return;
    const room = state.room;
    if (!room && !state.waiting) { card.innerHTML = ''; card.hidden = true; return; }
    if (state.waiting && !state.player) {
      const place = state.queue.findIndex(function (row) { return row.user_id === (state.waiting.userId || ''); });
      card.hidden = false;
      card.innerHTML = '<div class="duel-play-head"><div><small>' + esc(tr('QUEUE', '\u041e\u0427\u0415\u0420\u0415\u0414\u042c')) + '</small><strong>' +
        esc(state.waiting.code || '') + '</strong></div>' +
        '<button class="btn" type="button" id="duelPlayLeave">' + esc(tr('Leave', '\u0412\u044b\u0439\u0442\u0438')) + '</button></div>' +
        '<div class="duel-play-body duel-play-wait"><h3>' +
        esc(tr('A duel is already in progress', '\u0414\u0443\u044d\u043b\u044c \u0443\u0436\u0435 \u0438\u0434\u0451\u0442')) + '</h3><p>' +
        esc(tr('You are on the waiting list. The next lobby will let you in automatically.',
          '\u0412\u044b \u0432 \u0441\u043f\u0438\u0441\u043a\u0435 \u043e\u0436\u0438\u0434\u0430\u043d\u0438\u044f. \u041d\u043e\u0432\u043e\u0435 \u043b\u043e\u0431\u0431\u0438 \u0432\u043f\u0443\u0441\u0442\u0438\u0442 \u0432\u0430\u0441 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438.')) + '</p>' +
        (place >= 0 ? '<p><b>#' + (place + 1) + '</b></p>' : '') +
        '<ol class="duel-play-board">' + state.queue.map(function (row, index) {
          return '<li' + (row.user_id === state.waiting.userId ? ' class="me"' : '') + '><b>' + (index + 1) +
            '</b><span>' + esc(row.display_name || 'Student') + '</span></li>';
        }).join('') + '</ol></div>';
      bind();
      return;
    }
    if (!room || !state.player) { card.innerHTML = ''; card.hidden = true; return; }
    card.hidden = false;

    const head = '<div class="duel-play-head">' +
      '<div><small>' + esc(tr('ROOM', 'КОМНАТА')) + '</small><strong>' + esc(room.join_code) + '</strong></div>' +
      '<div><small>' + esc(tr('YOU', 'ВЫ')) + '</small><strong>' + esc(state.player.display_name) + '</strong></div>' +
      '<button class="btn" type="button" id="duelPlayLeave">' + esc(tr('Leave', 'Выйти')) + '</button>' +
      '</div>';

    if (state.waiting && !state.player) {
      const place = state.queue.findIndex(function (row) { return row.user_id === (state.waiting.userId || ''); });
      card.hidden = false;
      card.innerHTML = '<div class="duel-play-head"><div><small>' + esc(tr('QUEUE', 'ОЧЕРЕДЬ')) + '</small><strong>' +
        esc(state.waiting.code || '') + '</strong></div>' +
        '<button class="btn" type="button" id="duelPlayLeave">' + esc(tr('Leave', 'Выйти')) + '</button></div>' +
        '<div class="duel-play-body duel-play-wait"><h3>' +
        esc(tr('A duel is already in progress', 'Дуэль уже идёт')) + '</h3><p>' +
        esc(tr('You are on the waiting list. The next lobby will let you in automatically.',
          'Вы в списке ожидания. Как только учитель откроет новое лобби, вы зайдёте автоматически.')) + '</p>' +
        (place >= 0 ? '<p><b>#' + (place + 1) + '</b></p>' : '') +
        '<ol class="duel-play-board">' + state.queue.map(function (row, index) {
          return '<li' + (row.user_id === state.waiting.userId ? ' class="me"' : '') + '><b>' + (index + 1) +
            '</b><span>' + esc(row.display_name || 'Student') + '</span></li>';
        }).join('') + '</ol></div>';
      bind();
      return;
    }

    if (room.status === 'finished' || room.status === 'closed') {
      stopClock();
      void awardFinishXp();
      const rank = state.players.findIndex(function (player) { return state.player && player.id === state.player.id; });
      const xp = state.awardedXp || playerXp(state.player, rank < 0 ? 99 : rank);
      card.innerHTML = head + '<div class="duel-play-body"><h3>' +
        esc(tr('The duel is over', 'Дуэль завершена')) + '</h3><p>' +
        esc(tr('Your score: ', 'Ваш счёт: ')) + Number(state.player.score || 0) +
        ' · ' + Number(state.player.correct_count || 0) + ' ' + esc(tr('correct', 'верных')) +
        ' · +' + xp + ' XP</p>' + scoreboardHtml() + '</div>';
      bind();
      return;
    }

    if (room.status === 'paused') {
      card.innerHTML = head + '<div class="duel-play-body duel-play-wait"><h3>' +
        esc(tr('Paused', 'Пауза')) + '</h3><p>' +
        esc(tr('The teacher paused the duel. Hang tight.',
          'Учитель поставил дуэль на паузу. Подождите.')) + '</p>' +
        scoreboardHtml() + '</div>';
      bind();
      return;
    }

    const item = currentItem();
    if (!item) {
      card.innerHTML = head + '<div class="duel-play-body duel-play-wait"><h3>' +
        esc(tr('Waiting for the teacher…', 'Ждём учителя…')) + '</h3><p>' +
        esc(tr('The question will appear here as soon as the duel starts.',
          'Вопрос появится здесь, как только начнётся дуэль.')) + '</p>' +
        scoreboardHtml() + '</div>';
      bind();
      return;
    }

    const index = roomQuestionIndex(room);
    if (Number(state.player && state.player.last_answered_question) === index) {
      state.answeredIndex = index;
      state.answeredOption = Number(state.player.last_answered_option);
    }
    const answered = state.answeredIndex === index;
    const reveal = !!room.reveal_answer;
    const left = secondsLeft(room);
    const timedOut = left <= 0;
    const locked = answered || reveal || timedOut;
    const options = item.opts.slice(0, 4).map(function (option, optionIndex) {
      let className = '';
      if (answered && optionIndex === state.answeredOption) className = ' class="chosen"';
      if (reveal) {
        if (optionIndex === Number(item.a)) className = ' class="correct"';
        else if (answered && optionIndex === state.answeredOption) className = ' class="wrong"';
      }
      return '<button type="button" data-duel-play-option="' + optionIndex + '"' + className +
        (locked ? ' disabled' : '') + '><span>' + String.fromCharCode(65 + optionIndex) + '</span>' +
        esc(option) + '</button>';
    }).join('');

    const note = reveal
      ? '<p class="duel-play-note">' + esc(tr('Answer revealed. Waiting for the next question…',
        'Ответ показан. Ждём следующий вопрос…')) + '</p>'
      : (timedOut && !answered
        ? '<p class="duel-play-note">' + esc(tr("Time's up.", 'Время вышло.')) + '</p>'
        : (answered
          ? '<p class="duel-play-note">' + esc(tr('Answer locked in. Waiting for the next question…',
            'Ответ принят. Ждём следующий вопрос…')) + '</p>'
          : ''));

    card.innerHTML = head +
      '<div class="duel-play-body">' +
      '<div class="duel-play-count-row"><small class="duel-play-count">' + esc(tr('Question ', 'Вопрос ')) + (index + 1) + ' / ' +
      Number(room.total_questions || (room.deck || []).length || 0) + '</small>' +
      '<strong class="duel-play-timer' + (left <= 5 ? ' urgent' : '') + '" id="duelPlayTimer">' + left + '</strong></div>' +
      '<h3>' + esc(item.q) + '</h3>' +
      '<div class="duel-play-options">' + options + '</div>' + note + scoreboardHtml() +
      '</div>';
    bind();
    startClock();
  }

  function bind() {
    const leave = document.getElementById('duelPlayLeave');
    if (leave) leave.addEventListener('click', leaveRoom);
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-duel-play-option]'),
      function (button) { button.addEventListener('click', function () { void answer(button); }); }
    );
  }

  async function answer(button) {
    const room = state.room;
    const item = currentItem();
    if (!room || !state.player || !item) return;
    if (room.status === 'paused' || room.reveal_answer || secondsLeft(room) <= 0) return;
    const index = Number(room.current_question);
    if (state.answeredIndex === index) return;
    const optionIndex = Number(button.getAttribute('data-duel-play-option'));
    // Lock immediately so a double tap cannot fire two inserts before the
    // round-trip lands; the DB unique index is the backstop, not the guard.
    state.answeredIndex = index;
    state.answeredOption = optionIndex;
    render();
    try {
      await api().submitVote(room.id, state.player.id, index, optionIndex, optionIndex === Number(item.a));
    } catch (error) {
      console.warn('Could not submit duel vote.', error);
    }
    await refreshPlayers();
  }

  async function refreshPlayers() {
    if (!state.room) return;
    try {
      const players = await api().fetchPlayers(state.room.id);
      state.players = players;
      const mine = state.player && players.find(function (player) { return player.id === state.player.id; });
      if (state.player && !mine && players.length) {
        leaveRoom();
        setStatus(tr('You were removed from the room.', 'Вас убрали из комнаты.'), 'bad');
        return;
      }
      if (mine) state.player = mine;
      render();
    } catch (error) { /* scoreboard refresh is best-effort */ }
  }

  function leaveRoom() {
    stopClock();
    if (state.waiting && api() && api().leaveQueue) void api().leaveQueue(state.waiting.teacherId);
    if (state.queueChannel && api()) api().unsubscribe(state.queueChannel);
    state.waiting = null;
    state.queue = [];
    state.queueChannel = null;
    if (state.channel) api().unsubscribe(state.channel);
    state.channel = null;
    state.room = null;
    state.player = null;
    state.players = [];
    state.answeredIndex = -1;
    state.answeredOption = -1;
    const card = document.getElementById('duelPlayCard');
    if (card) { card.innerHTML = ''; card.hidden = true; }
    const form = document.getElementById('duelJoinForm');
    if (form) form.hidden = false;
    setStatus('', '');
  }

  async function enterWaitingList(room, name) {
    const rooms = api();
    if (!rooms || !rooms.enqueueWaiter) return false;
    const supa = supabase();
    const auth = supa ? await supa.auth.getUser() : null;
    const userId = auth && auth.data && auth.data.user && auth.data.user.id;
    await rooms.enqueueWaiter(room.teacher_id, name, room.join_code);
    state.waiting = { teacherId: room.teacher_id, code: room.join_code, userId: userId, name: name };
    if (state.queueChannel) rooms.unsubscribe(state.queueChannel);
    const refreshQueue = async function () {
      try {
        state.queue = await rooms.fetchQueue(room.teacher_id);
      } catch (error) { state.queue = []; }
      const lobby = await rooms.findTeacherLobby(room.teacher_id);
      if (lobby && lobby.status === 'lobby') {
        await rooms.leaveQueue(room.teacher_id);
        state.waiting = null;
        if (state.queueChannel) rooms.unsubscribe(state.queueChannel);
        state.queueChannel = null;
        await join(lobby.join_code, name);
        const form = document.getElementById('duelJoinForm');
        if (form) form.hidden = true;
        return;
      }
      render();
    };
    state.queueChannel = rooms.subscribeQueue(room.teacher_id, function () { void refreshQueue(); });
    await refreshQueue();
    render();
    return true;
  }

  async function join(code, name) {
    const rooms = api();
    if (!rooms) throw new Error('Duel rooms are not available.');
    const found = await rooms.findRoomByCode(code);
    if (found && (found.status === 'running' || found.status === 'paused')) {
      const existingPlayer = rooms.findMyPlayer ? await rooms.findMyPlayer(found.id) : null;
      if (!existingPlayer) {
        const waiting = await enterWaitingList(found, name);
        if (waiting) return;
      }
    }
    const joined = await rooms.joinRoom(code, name);
    state.room = joined.room;
    state.player = joined.player;
    const currentIndex = roomQuestionIndex(joined.room);
    if (Number(joined.player.last_answered_question) === currentIndex) {
      state.answeredIndex = currentIndex;
      state.answeredOption = Number(joined.player.last_answered_option);
    } else {
      state.answeredIndex = -1;
      state.answeredOption = -1;
    }
    state.xpAwarded = false;
    state.awardedXp = 0;
    state.channel = rooms.subscribe(joined.room.id, {
      onRoom: function (room) {
        if (!state.room || state.room.id !== room.id) return;
        // The teacher may have changed only reveal_answer, so keep the deck we
        // already hold if the payload arrives without it.
        state.room = Object.assign({}, state.room, room, {
          deck: Array.isArray(room.deck) && room.deck.length ? room.deck : state.room.deck
        });
        render();
      },
      onPlayer: function (row, eventType) {
        if (eventType === 'DELETE' && state.player && row && row.id === state.player.id) {
          leaveRoom();
          setStatus(tr('You were removed from the room.', 'Вас убрали из комнаты.'), 'bad');
          return;
        }
        void refreshPlayers();
      }
    });
    await refreshPlayers();
    render();
  }

  function isMobile() {
    // Enough to catch phones and tablets — narrow enough that we do not push
    // the app hand-off to desktop learners who happen to have the mobile UA
    // string in their dev tools.
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  }

  function openInApp(code) {
    // duvelahub:// is the Hub app's URL scheme (app.config.ts). If the app is
    // installed the OS hands the tap to it; if it is not, iOS Safari shows a
    // "cannot open" prompt, so we surface a "Get the app" fallback next to it
    // rather than autolaunching.
    const target = 'duvelahub://native/live-duel?code=' + encodeURIComponent(code);
    window.location.href = target;
  }

  function renderAppHandoff(code) {
    if (!code || !isMobile()) return;
    const panel = document.querySelector('[data-panel="duel"]');
    if (!panel || document.getElementById('duelAppHandoff')) return;
    const card = document.createElement('div');
    card.id = 'duelAppHandoff';
    card.className = 'duel-app-handoff';
    card.innerHTML =
      '<div class="duel-app-handoff-lede">' +
      '<img src="./hub-app-icon.png" alt="Duvela Academy Hub" class="duel-app-handoff-icon">' +
      '<div>' +
      '<strong>' + esc(tr('Duvela Academy Hub', 'Duvela Academy Hub')) + '</strong>' +
      '<p>' + esc(tr('You have a duel code — play with the class right in the app.',
        'У вас есть код дуэли — играйте с классом прямо в приложении.')) + '</p>' +
      '</div></div>' +
      '<div class="duel-app-handoff-row">' +
      '<button class="btn primary" type="button" id="duelOpenInApp">' +
      esc(tr('Open in the Hub app', 'Открыть в приложении Hub')) + '</button>' +
      '<button class="btn" type="button" id="duelJoinInBrowser">' +
      esc(tr('Play in browser', 'Играть в браузере')) + '</button>' +
      '</div>' +
      '<small>' + esc(tr('Already installed? The button opens the app. Otherwise install "Duvela Academy Hub" from the App Store or Google Play.',
        'Уже установлено? Кнопка откроет приложение. Иначе установите «Duvela Academy Hub» из App Store или Google Play.')) + '</small>';
    const first = panel.firstElementChild;
    panel.insertBefore(card, first);
    document.getElementById('duelOpenInApp').addEventListener('click', function () { openInApp(code); });
    document.getElementById('duelJoinInBrowser').addEventListener('click', function () {
      card.remove();
    });
  }

  function mount() {
    const form = document.getElementById('duelJoinForm');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    const nameField = document.getElementById('duelJoinName');
    const codeField = document.getElementById('duelJoinCode');
    const preset = codeFromLocation();
    if (codeField && preset && !codeField.value) codeField.value = preset;
    if (nameField) void suggestedName().then(function (name) { if (name && !nameField.value) nameField.value = name; });
    if (preset) renderAppHandoff(preset);

    async function submitJoin() {
      const field = document.getElementById('duelJoinCode');
      const code = String(field ? field.value : '').trim().toUpperCase();
      if (!code) { setStatus(tr('Enter the duel code.', 'Введите код дуэли.'), 'bad'); return; }
      const submit = document.getElementById('duelJoinSubmit');
      if (submit) submit.disabled = true;
      setStatus(tr('Joining…', 'Подключаемся…'), '');
      try {
        await join(code, nameField ? nameField.value : '');
        form.hidden = true;
        setStatus('', '');
      } catch (error) {
        const message = error && error.message === 'You are hosting this duel.'
          ? tr('You are hosting this duel.', 'Вы ведёте эту дуэль.')
          : (error && error.message ? error.message : tr('Could not join.', 'Не удалось подключиться.'));
        setStatus(message, 'bad');
      } finally {
        if (submit) submit.disabled = false;
      }
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      void submitJoin();
    });

    if (preset && !isHostingOverlay() && !state.room) {
      void suggestedName().then(function (name) {
        if (nameField && name && !nameField.value) nameField.value = name;
        void submitJoin();
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.DuvelaDuelPlayer = { mount: mount, leave: leaveRoom };
})();
