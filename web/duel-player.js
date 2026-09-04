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
    players: []
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

  function currentItem() {
    const room = state.room;
    if (!room) return null;
    const deck = Array.isArray(room.deck) ? room.deck : [];
    const index = Number(room.current_question);
    if (!(index >= 0) || index >= deck.length) return null;
    const item = deck[index];
    if (!item || !Array.isArray(item.opts) || item.opts.length < 2) return null;
    return item;
  }

  function scoreboardHtml() {
    if (!state.players.length) return '';
    const me = state.player ? state.player.id : null;
    return '<ol class="duel-play-board">' + state.players.slice(0, 8).map(function (player, index) {
      const mine = player.id === me ? ' class="me"' : '';
      return '<li' + mine + '><b>' + (index + 1) + '</b><span>' + esc(player.display_name || 'Student') +
        '</span><em>' + Number(player.correct_count || 0) + '</em></li>';
    }).join('') + '</ol>';
  }

  function render() {
    const card = playCard();
    if (!card) return;
    const room = state.room;
    if (!room || !state.player) { card.innerHTML = ''; card.hidden = true; return; }
    card.hidden = false;

    const head = '<div class="duel-play-head">' +
      '<div><small>' + esc(tr('ROOM', 'КОМНАТА')) + '</small><strong>' + esc(room.join_code) + '</strong></div>' +
      '<div><small>' + esc(tr('YOU', 'ВЫ')) + '</small><strong>' + esc(state.player.display_name) + '</strong></div>' +
      '<button class="btn" type="button" id="duelPlayLeave">' + esc(tr('Leave', 'Выйти')) + '</button>' +
      '</div>';

    if (room.status === 'finished' || room.status === 'closed') {
      card.innerHTML = head + '<div class="duel-play-body"><h3>' +
        esc(tr('The duel is over', 'Дуэль завершена')) + '</h3><p>' +
        esc(tr('Your correct answers: ', 'Правильных ответов: ')) +
        Number(state.player.correct_count || 0) + '</p>' + scoreboardHtml() + '</div>';
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

    const index = Number(room.current_question);
    const answered = state.answeredIndex === index;
    // Options only turn green/red once the teacher presses "Show answer" — the
    // class must not see the key before the reveal.
    const reveal = answered && !!room.reveal_answer;
    const options = item.opts.slice(0, 4).map(function (option, optionIndex) {
      let className = '';
      if (answered && optionIndex === state.answeredOption) className = ' class="chosen"';
      if (reveal) {
        if (optionIndex === Number(item.a)) className = ' class="correct"';
        else if (optionIndex === state.answeredOption) className = ' class="wrong"';
      }
      return '<button type="button" data-duel-play-option="' + optionIndex + '"' + className +
        (answered ? ' disabled' : '') + '><span>' + String.fromCharCode(65 + optionIndex) + '</span>' +
        esc(option) + '</button>';
    }).join('');

    const note = answered
      ? '<p class="duel-play-note">' + esc(tr('Answer locked in. Waiting for the next question…',
        'Ответ принят. Ждём следующий вопрос…')) + '</p>'
      : '';

    card.innerHTML = head +
      '<div class="duel-play-body">' +
      '<small class="duel-play-count">' + esc(tr('Question ', 'Вопрос ')) + (index + 1) + ' / ' +
      Number(room.total_questions || (room.deck || []).length || 0) + '</small>' +
      '<h3>' + esc(item.q) + '</h3>' +
      '<div class="duel-play-options">' + options + '</div>' + note + scoreboardHtml() +
      '</div>';
    bind();
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
      if (mine) state.player = mine;
      render();
    } catch (error) { /* scoreboard refresh is best-effort */ }
  }

  function leaveRoom() {
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

  async function join(code, name) {
    const rooms = api();
    if (!rooms) throw new Error('Duel rooms are not available.');
    const joined = await rooms.joinRoom(code, name);
    state.room = joined.room;
    state.player = joined.player;
    state.answeredIndex = -1;
    state.answeredOption = -1;
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
      onPlayer: function () { void refreshPlayers(); }
    });
    await refreshPlayers();
    render();
  }

  function mount() {
    const form = document.getElementById('duelJoinForm');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    const nameField = document.getElementById('duelJoinName');
    if (nameField) void suggestedName().then(function (name) { if (name && !nameField.value) nameField.value = name; });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const codeField = document.getElementById('duelJoinCode');
      const code = String(codeField ? codeField.value : '').trim().toUpperCase();
      if (!code) { setStatus(tr('Enter the duel code.', 'Введите код дуэли.'), 'bad'); return; }
      const submit = document.getElementById('duelJoinSubmit');
      if (submit) submit.disabled = true;
      setStatus(tr('Joining…', 'Подключаемся…'), '');
      try {
        await join(code, nameField ? nameField.value : '');
        form.hidden = true;
        setStatus('', '');
      } catch (error) {
        setStatus(error && error.message ? error.message : tr('Could not join.', 'Не удалось подключиться.'), 'bad');
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.DuvelaDuelPlayer = { mount: mount, leave: leaveRoom };
})();
