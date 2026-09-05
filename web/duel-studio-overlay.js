// Pins the teacher's LIVE duel onto the Live Studio camera stage so the
// stream shows question + poll over the webcam, not the practice overlay.
(function () {
  function tr(en, ru) {
    return window.DuvelaCurrentAppLang === 'ru' ? ru : en;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function api() { return window.DuvelaDuelRoom || null; }
  function fx() { return window.DuvelaDuelFx || null; }

  const state = {
    open: false,
    room: null,
    channel: null,
    chatChannel: null,
    tally: [0, 0, 0, 0],
    clockId: null,
    rankId: null
  };

  function stage() { return document.querySelector('.stage'); }

  function overlay() {
    let node = document.getElementById('duelStageOverlay');
    if (node) return node;
    const host = stage();
    if (!host) return null;
    node = document.createElement('div');
    node.id = 'duelStageOverlay';
    node.className = 'duel-stage-overlay';
    node.hidden = true;
    node.innerHTML =
      '<div class="dso-top">' +
        '<span class="dso-live"><i></i> LIVE DUEL</span>' +
        '<strong id="dsoCode">—</strong>' +
        '<span id="dsoRank" class="dso-rank" hidden></span>' +
      '</div>' +
      '<img class="duel-duvi dso-duvi" alt="DUVI" src="./web/assets/duvi/greeting.png">' +
      '<div class="dso-timer" id="dsoTimer">15</div>' +
      '<p class="dso-join" id="dsoJoin"></p>' +
      '<h2 id="dsoQuestion">' + esc(tr('Waiting for a LIVE duel…', 'Ждём LIVE-дуэль…')) + '</h2>' +
      '<div class="dso-poll" id="dsoPoll"></div>' +
      '<div class="dso-controls">' +
        '<button type="button" data-dso="reveal">' + esc(tr('Reveal', 'Ответ')) + '</button>' +
        '<button type="button" data-dso="next">' + esc(tr('Next', 'Дальше')) + '</button>' +
        '<button type="button" data-dso="close">' + esc(tr('Hide', 'Скрыть')) + '</button>' +
      '</div>' +
      '<canvas class="duel-confetti"></canvas>';
    host.appendChild(node);
    node.addEventListener('click', function (event) {
      const btn = event.target.closest('[data-dso]');
      if (!btn || !state.room || !api()) return;
      const action = btn.getAttribute('data-dso');
      if (action === 'close') { hide(); return; }
      if (action === 'reveal') {
        void api().revealAnswer(state.room.id);
        if (fx()) { fx().confetti(node); fx().playRevealSound(true); fx().showDuvi(node, 'reveal'); }
      }
      if (action === 'next') {
        const next = Number(state.room.current_question) + 1;
        const deck = Array.isArray(state.room.deck) ? state.room.deck : [];
        if (next >= deck.length) void api().finishRoom(state.room.id);
        else void api().showQuestion(state.room.id, next);
      }
    });
    return node;
  }

  function secondsLeft(room) {
    const limit = Number((room && room.question_seconds) || 15);
    if (!room || room.status === 'paused') return limit;
    const started = room.question_started_at ? new Date(room.question_started_at).getTime() : 0;
    if (!started) return limit;
    return Math.max(0, Math.ceil(limit - (Date.now() - started) / 1000));
  }

  function currentItem(room) {
    const deck = Array.isArray(room && room.deck) ? room.deck : [];
    const index = Number(room && room.current_question);
    if (!(index >= 0) || index >= deck.length) return null;
    return deck[index];
  }

  function render() {
    const node = overlay();
    if (!node) return;
    node.hidden = !state.open;
    const room = state.room;
    if (!room) {
      node.querySelector('#dsoQuestion').textContent = tr('Start a LIVE duel in the app, then pin it here.', 'Запустите LIVE-дуэль в приложении и закрепите её здесь.');
      node.querySelector('#dsoPoll').innerHTML = '';
      return;
    }
    node.querySelector('#dsoCode').textContent = room.join_code || '—';
    node.querySelector('#dsoJoin').textContent = 'vela.cafe  ·  ' + (room.join_code || '');
    const item = currentItem(room);
    const timer = node.querySelector('#dsoTimer');
    if (timer) {
      const left = secondsLeft(room);
      timer.textContent = String(left);
      timer.classList.toggle('urgent', left <= 5);
    }
    if (!item) {
      node.querySelector('#dsoQuestion').textContent = tr('Lobby open — students join with the code.', 'Лобби открыто — ученики заходят по коду.');
      node.querySelector('#dsoPoll').innerHTML = '';
      return;
    }
    node.querySelector('#dsoQuestion').textContent = item.q || '';
    const counts = state.tally || [0, 0, 0, 0];
    const total = counts.reduce(function (sum, n) { return sum + Number(n || 0); }, 0);
    const reveal = !!room.reveal_answer;
    node.querySelector('#dsoPoll').innerHTML = (item.opts || []).slice(0, 4).map(function (opt, index) {
      const pct = total ? Math.round(counts[index] / total * 100) : 0;
      const klass = reveal && index === Number(item.a) ? ' class="correct"' : '';
      return '<button type="button" data-dso-vote="' + index + '"' + klass + '><span>' +
        String.fromCharCode(65 + index) + '</span><i><em style="width:' + pct + '%"></em></i><b>' +
        esc(opt) + '</b><strong>' + pct + '%</strong></button>';
    }).join('');
    Array.prototype.forEach.call(node.querySelectorAll('[data-dso-vote]'), function (button) {
      button.onclick = function () {
        const index = Number(button.getAttribute('data-dso-vote'));
        void api().ingestChatVote(room.id, {
          displayName: 'Stream ' + Date.now().toString(36).slice(-4),
          optionIndex: index
        });
      };
    });
  }

  function startClock() {
    if (state.clockId) clearInterval(state.clockId);
    state.clockId = setInterval(function () {
      if (!state.open || !state.room) return;
      const timer = document.getElementById('dsoTimer');
      if (!timer) return;
      const left = secondsLeft(state.room);
      timer.textContent = String(left);
      timer.classList.toggle('urgent', left <= 5);
    }, 200);
  }

  async function refreshTally() {
    if (!api() || !state.room) return;
    try {
      const result = await api().fetchTally(state.room.id, Number(state.room.current_question));
      state.tally = (result && result.counts) || result || [0, 0, 0, 0];
      render();
    } catch (error) { /* ignore */ }
  }

  async function attach(room) {
    const rooms = api();
    if (!rooms || !room) return;
    if (state.channel) rooms.unsubscribe(state.channel);
    if (state.chatChannel) rooms.unsubscribe(state.chatChannel);
    state.room = room;
    state.channel = rooms.subscribe(room.id, {
      onRoom: function (next) {
        state.room = Object.assign({}, state.room, next, {
          deck: Array.isArray(next.deck) && next.deck.length ? next.deck : state.room.deck
        });
        if (next.reveal_answer && fx()) {
          const node = overlay();
          fx().confetti(node);
          fx().playRevealSound(true);
          fx().showDuvi(node, 'reveal');
        }
        render();
        void refreshTally();
      },
      onVote: function () { void refreshTally(); }
    });
    const session = await rooms.findActiveLiveSession();
    if (session && session.id) {
      try { await rooms.setRoomState(room.id, { session_id: session.id }); } catch (error) { /* optional */ }
      const seen = {};
      state.chatChannel = rooms.subscribeLiveChat(session.id, function (msg) {
        const option = rooms.parseChatVote(msg && msg.message);
        if (option < 0) return;
        const key = String(msg.sender_id || msg.sender_name || '') + ':' + state.room.current_question;
        if (seen[key]) return;
        seen[key] = true;
        void rooms.ingestChatVote(room.id, {
          userId: msg.sender_id || null,
          displayName: msg.sender_name || 'Chat',
          optionIndex: option
        });
      });
    }
    startClock();
    const rank = document.getElementById('dsoRank');
    const teacherId = room.teacher_id;
    if (fx() && rank && teacherId) {
      void fx().renderGiftRank(rank, teacherId);
      if (state.rankId) clearInterval(state.rankId);
      state.rankId = setInterval(function () { void fx().renderGiftRank(rank, teacherId); }, 60000);
    }
    await refreshTally();
    render();
  }

  async function show() {
    const rooms = api();
    const node = overlay();
    if (!rooms || !node) return;
    state.open = true;
    node.hidden = false;
    try {
      const room = await rooms.findMyActiveRoom();
      if (!room) {
        state.room = null;
        render();
        return;
      }
      await attach(room);
    } catch (error) {
      state.room = null;
      render();
    }
  }

  function hide() {
    state.open = false;
    const node = overlay();
    if (node) node.hidden = true;
    const rooms = api();
    if (state.channel && rooms) rooms.unsubscribe(state.channel);
    if (state.chatChannel && rooms) rooms.unsubscribe(state.chatChannel);
    state.channel = null;
    state.chatChannel = null;
    if (state.clockId) clearInterval(state.clockId);
    if (state.rankId) clearInterval(state.rankId);
  }

  function toggle() {
    if (state.open) hide();
    else void show();
  }

  window.DuvelaDuelStudio = { show: show, hide: hide, toggle: toggle };
})();
