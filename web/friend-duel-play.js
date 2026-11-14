// Friend duel in the browser: the guest joins a Hub friend room by code and plays the
// match against the phone in real time. Decks, rounds and scoring come from the Hub's
// own engine (duel-engine.generated.js), and the clock follows the match's started_at
// plus the shared 3-2-1 intro, so both sides play exactly the same duel.
(function () {
  'use strict';

  var STRINGS = {
    en: {
      joining: 'Joining the duel…',
      rivalFound: 'Rival found!',
      getReady: 'Get ready…',
      go: 'GO!',
      you: 'You',
      rival: 'Rival',
      sec: 'sec',
      question: function (a, b) { return 'Question ' + a + ' of ' + b; },
      round: 'Round',
      combo: function (n) { return n > 1 ? 'Combo x' + n : 'Combo ready'; },
      check: 'Check',
      typeAnswer: 'Type your answer',
      correctIs: function (a) { return 'Correct: ' + a; },
      timeout: 'Time is up for this round.',
      miss: 'Round lost.',
      award: function (p) { return '+' + p + ' points'; },
      finished: function (s) { return 'Done! Your score: ' + s; },
      waitingRival: 'Waiting for your rival or the timer…',
      calculating: 'Calculating the result…',
      win: 'You won!',
      lose: 'You lost',
      tie: 'Draw!',
      surrender: 'Surrender',
      surrenderConfirm: 'Stop this duel? It counts as a loss.',
      openApp: 'Open the Duvela app',
      home: 'Go to the Duvela website',
      ownRoom: 'This is your own room. Send the invite to a friend.',
      notFound: 'This invite code was not found.',
      expired: 'This invite has expired. Ask your friend for a new one.',
      started: 'This duel has already started with someone else.',
      unavailable: 'This duel room is no longer available.',
      error: 'Could not join the duel. Check your connection and try again.',
      retry: 'Try again',
    },
    ru: {
      joining: 'Подключаемся к дуэли…',
      rivalFound: 'Соперник найден!',
      getReady: 'Приготовься…',
      go: 'Старт!',
      you: 'Вы',
      rival: 'Соперник',
      sec: 'сек',
      question: function (a, b) { return 'Вопрос ' + a + ' из ' + b; },
      round: 'Раунд',
      combo: function (n) { return n > 1 ? 'Серия x' + n : 'Серия готова'; },
      check: 'Проверить',
      typeAnswer: 'Введите ответ',
      correctIs: function (a) { return 'Правильно: ' + a; },
      timeout: 'Время раунда вышло.',
      miss: 'Раунд проигран.',
      award: function (p) { return '+' + p + ' очков'; },
      finished: function (s) { return 'Готово! Ваш счёт: ' + s; },
      waitingRival: 'Ждём соперника или конец таймера…',
      calculating: 'Считаем итог матча…',
      win: 'Победа!',
      lose: 'Поражение',
      tie: 'Ничья!',
      surrender: 'Сдаться',
      surrenderConfirm: 'Остановить дуэль? Это будет поражение.',
      openApp: 'Открыть приложение Duvela',
      home: 'На сайт Duvela',
      ownRoom: 'Это ваша собственная комната. Отправьте приглашение другу.',
      notFound: 'Код приглашения не найден.',
      expired: 'Приглашение истекло. Попросите друга прислать новое.',
      started: 'Эта дуэль уже началась с другим игроком.',
      unavailable: 'Комната дуэли больше недоступна.',
      error: 'Не удалось подключиться к дуэли. Проверьте соединение и попробуйте снова.',
      retry: 'Попробовать снова',
    },
    de: {
      joining: 'Duell wird verbunden…',
      rivalFound: 'Gegner gefunden!',
      getReady: 'Mach dich bereit…',
      go: 'Los!',
      you: 'Du',
      rival: 'Gegner',
      sec: 'Sek.',
      question: function (a, b) { return 'Frage ' + a + ' von ' + b; },
      round: 'Runde',
      combo: function (n) { return n > 1 ? 'Combo x' + n : 'Combo bereit'; },
      check: 'Prüfen',
      typeAnswer: 'Antwort eingeben',
      correctIs: function (a) { return 'Richtig: ' + a; },
      timeout: 'Die Zeit für diese Runde ist um.',
      miss: 'Runde verloren.',
      award: function (p) { return '+' + p + ' Punkte'; },
      finished: function (s) { return 'Fertig! Dein Punktestand: ' + s; },
      waitingRival: 'Warte auf deinen Gegner oder das Ende der Zeit…',
      calculating: 'Ergebnis wird berechnet…',
      win: 'Du hast gewonnen!',
      lose: 'Verloren',
      tie: 'Unentschieden!',
      surrender: 'Aufgeben',
      surrenderConfirm: 'Duell beenden? Es zählt als Niederlage.',
      openApp: 'Duvela-App öffnen',
      home: 'Zur Duvela-Website',
      ownRoom: 'Das ist dein eigener Raum. Schicke die Einladung an einen Freund.',
      notFound: 'Dieser Einladungscode wurde nicht gefunden.',
      expired: 'Die Einladung ist abgelaufen. Bitte um eine neue.',
      started: 'Dieses Duell hat bereits mit jemand anderem begonnen.',
      unavailable: 'Dieser Duellraum ist nicht mehr verfügbar.',
      error: 'Beitritt fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.',
      retry: 'Erneut versuchen',
    },
  };

  var ADVANCE_DELAY_MS = 950;
  var POLL_MS = 3000;

  function h(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).slice(0, 2);
    var value = parts.map(function (part) { return part.charAt(0).toUpperCase(); }).join('');
    return value || '?';
  }

  function avatar(name, url, crown) {
    var wrap = h('div', 'fd-avatar');
    if (url && /^https:\/\//.test(url)) {
      var img = h('img');
      img.src = url;
      img.alt = '';
      wrap.appendChild(img);
    } else {
      wrap.appendChild(h('span', '', initials(name)));
    }
    if (crown) wrap.appendChild(h('span', 'fd-crown', '👑'));
    return wrap;
  }

  function start(options) {
    var t = STRINGS[options.lang] || STRINGS.en;
    var root = options.root;
    var E = window.DuvelaDuelEngine;
    var supa = window.DuvelaWebConfig.createSupabaseClient();

    var s = {
      me: null,
      room: null,
      match: null,
      rounds: [],
      index: 0,
      score: 0,
      combo: 0,
      progress: 0,
      revealed: false,
      selected: null,
      typed: '',
      feedback: null,
      finishedLocal: false,
      finishSent: false,
      timeUp: false,
      done: false,
      introEndsAt: 0,
      clockStartMs: 0,
      roundStartedAt: 0,
      introKey: '',
      myName: '',
      myAvatar: null,
      rivalName: '',
      rivalAvatar: null,
      opp: { score: 0, progress: 0, finished: false },
      timer: null,
      poll: null,
      channel: null,
      advance: null,
      battle: null,
    };

    function clear() {
      root.innerHTML = '';
    }

    function stopAll() {
      if (s.timer) window.clearInterval(s.timer);
      if (s.poll) window.clearInterval(s.poll);
      if (s.advance) window.clearTimeout(s.advance);
      s.timer = null;
      s.poll = null;
      if (s.channel) {
        try { supa.removeChannel(s.channel); } catch (error) { /* ignore */ }
        s.channel = null;
      }
    }

    function showStatus(message, spinner, actions) {
      clear();
      s.battle = null;
      var card = h('div', 'fd-card fd-center');
      if (spinner) card.appendChild(h('div', 'fd-spinner'));
      card.appendChild(h('p', 'fd-status', message));
      (actions || []).forEach(function (action) {
        var button = h(action.href ? 'a' : 'button', action.primary ? 'fd-btn' : 'fd-btn fd-btn-ghost', action.label);
        if (action.href) button.href = action.href;
        else {
          button.type = 'button';
          button.addEventListener('click', action.onClick);
        }
        card.appendChild(button);
      });
      root.appendChild(card);
    }

    function exitActions() {
      return [
        { label: t.openApp, href: 'duvelahub://native/duel', primary: true },
        { label: t.home, href: './index.html' },
      ];
    }

    function errorMessage(error) {
      var message = String((error && error.message) || '').toLowerCase();
      if (message.indexOf('not found') >= 0) return t.notFound;
      if (message.indexOf('expired') >= 0) return t.expired;
      if (message.indexOf('already started') >= 0) return t.started;
      if (message.indexOf('unavailable') >= 0) return t.unavailable;
      return t.error;
    }

    function mySide(match) {
      var isP1 = match.player1_id === s.me;
      return {
        score: isP1 ? match.player1_score : match.player2_score,
        oppScore: isP1 ? match.player2_score : match.player1_score,
        oppProgress: isP1 ? match.player2_progress : match.player1_progress,
        oppFinished: isP1 ? match.player2_finished : match.player1_finished,
      };
    }

    async function fetchMatch(id) {
      var res = await supa.from('practice_matches').select('*').eq('id', id).maybeSingle();
      return res.error ? null : res.data;
    }

    async function loadPracticeItems(practiceId) {
      var res = await supa
        .from('teacher_practice_items')
        .select('id,practice_id,order_index,type,prompt,options,answer,explanation')
        .eq('practice_id', practiceId)
        .order('order_index', { ascending: true });
      if (res.error || !Array.isArray(res.data)) return null;
      return res.data.map(function (row) {
        return {
          id: String(row.id),
          practiceId: String(row.practice_id),
          orderIndex: Number(row.order_index || 0),
          type: row.type || 'mcq',
          prompt: String(row.prompt || ''),
          options: Array.isArray(row.options) ? row.options.map(String) : [],
          answer: typeof row.answer === 'string' ? row.answer : null,
          explanation: typeof row.explanation === 'string' ? row.explanation : null,
        };
      });
    }

    async function loadProfiles(hostId) {
      try {
        var mine = await supa.from('profiles').select('full_name,avatar_url').eq('id', s.me).maybeSingle();
        if (mine.data) {
          s.myName = mine.data.full_name || '';
          s.myAvatar = mine.data.avatar_url || null;
        }
      } catch (error) { /* optional */ }
      try {
        var res = await window.DuvelaWebConfig.relatedProfiles(supa, [hostId], 'id,full_name,avatar_url');
        var row = res && Array.isArray(res.data) ? res.data[0] : null;
        if (row) {
          s.rivalName = row.full_name || '';
          s.rivalAvatar = row.avatar_url || null;
        }
      } catch (error) { /* optional */ }
    }

    function applyMatch(row) {
      if (!row || !row.id) return;
      s.match = row;
      var side = mySide(row);
      s.opp = { score: side.oppScore || 0, progress: side.oppProgress || 0, finished: Boolean(side.oppFinished) };
      if (row.status === 'completed') {
        showResult();
        return;
      }
      updateBattleBars();
      if (s.finishedLocal) showWaiting();
    }

    function subscribe(matchId) {
      try {
        s.channel = supa
          .channel('fd-match-' + matchId)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_matches', filter: 'id=eq.' + matchId }, function (payload) {
            applyMatch(payload && payload.new);
          })
          .subscribe();
      } catch (error) { /* polling covers it */ }
      s.poll = window.setInterval(function () {
        if (s.done) return;
        fetchMatch(matchId).then(applyMatch);
      }, POLL_MS);
    }

    // ---- intro ----
    function renderIntro(phase, count) {
      var key = phase + ':' + count;
      if (key === s.introKey) return;
      s.introKey = key;
      clear();
      var card = h('div', 'fd-card fd-center');
      card.appendChild(h('h2', 'fd-title', t.rivalFound));
      var versus = h('div', 'fd-versus');
      var me = h('div', 'fd-player');
      me.appendChild(avatar(s.myName || t.you, s.myAvatar));
      me.appendChild(h('b', '', t.you));
      var rival = h('div', 'fd-player');
      rival.appendChild(avatar(s.rivalName || t.rival, s.rivalAvatar));
      rival.appendChild(h('b', '', s.rivalName || t.rival));
      versus.appendChild(me);
      versus.appendChild(h('span', 'fd-swords', '⚔️'));
      versus.appendChild(rival);
      card.appendChild(versus);
      root.appendChild(card);
      var area = h('div', 'fd-count-area');
      if (phase === 'found') area.appendChild(h('p', 'fd-ready', t.getReady));
      else if (phase === 'go') area.appendChild(h('div', 'fd-go fd-pop', t.go));
      else area.appendChild(h('div', 'fd-count fd-pop', count));
      root.appendChild(area);
    }

    // ---- battle ----
    function buildBattle() {
      clear();
      var b = {};
      var board = h('div', 'fd-board');
      function side(label, right) {
        var col = h('div', 'fd-side' + (right ? ' fd-right' : ''));
        var top = h('div', 'fd-side-top');
        top.appendChild(avatar(right ? (s.rivalName || label) : (s.myName || label), right ? s.rivalAvatar : s.myAvatar));
        var text = h('div', 'fd-side-text');
        text.appendChild(h('span', 'fd-side-name', right ? (s.rivalName || t.rival) : t.you));
        var score = h('strong', 'fd-side-score', '0');
        text.appendChild(score);
        top.appendChild(text);
        col.appendChild(top);
        var track = h('div', 'fd-track');
        var fill = h('i', right ? 'fd-fill fd-fill-right' : 'fd-fill');
        track.appendChild(fill);
        col.appendChild(track);
        return { col: col, score: score, fill: fill };
      }
      var mine = side(t.you, false);
      var rival = side(s.rivalName || t.rival, true);
      var timer = h('div', 'fd-timer');
      var timerValue = h('strong', '', '');
      timer.appendChild(timerValue);
      timer.appendChild(h('small', '', t.sec));
      board.appendChild(mine.col);
      board.appendChild(timer);
      board.appendChild(rival.col);
      root.appendChild(board);

      var meta = h('div', 'fd-meta');
      var pills = h('div', 'fd-pills');
      var comboPill = h('span', 'fd-pill', '');
      var countPill = h('span', 'fd-pill', '');
      pills.appendChild(comboPill);
      pills.appendChild(countPill);
      var roundBox = h('div', 'fd-round');
      roundBox.appendChild(h('small', '', t.round));
      var roundValue = h('strong', '', '');
      roundBox.appendChild(roundValue);
      meta.appendChild(pills);
      meta.appendChild(roundBox);
      root.appendChild(meta);

      var play = h('div', 'fd-play');
      root.appendChild(play);

      var surrender = h('button', 'fd-surrender', '🏳 ' + t.surrender);
      surrender.type = 'button';
      surrender.addEventListener('click', onSurrender);
      root.appendChild(surrender);

      b.myScore = mine.score;
      b.myFill = mine.fill;
      b.oppScore = rival.score;
      b.oppFill = rival.fill;
      b.timer = timer;
      b.timerValue = timerValue;
      b.combo = comboPill;
      b.count = countPill;
      b.round = roundBox;
      b.roundValue = roundValue;
      b.play = play;
      s.battle = b;
      updateBattleBars();
      renderQuestion();
    }

    function updateBattleBars() {
      var b = s.battle;
      if (!b) return;
      var total = s.rounds.length || 1;
      b.myScore.textContent = String(s.score);
      b.oppScore.textContent = String(s.opp.score);
      b.myFill.style.width = Math.min(100, (s.progress / total) * 100) + '%';
      b.oppFill.style.width = Math.min(100, (s.opp.progress / total) * 100) + '%';
      b.combo.textContent = '🔥 ' + t.combo(s.combo);
      b.count.textContent = '✅ ' + s.progress + '/' + s.rounds.length;
    }

    function renderQuestion() {
      var b = s.battle;
      if (!b) return;
      var round = s.rounds[s.index];
      b.play.innerHTML = '';
      if (!round) return;
      if (s.feedback) {
        var fb = h('div', 'fd-feedback fd-feedback-' + s.feedback.tone);
        fb.textContent = s.feedback.text;
        b.play.appendChild(fb);
      }
      var card = h('div', 'fd-question');
      card.appendChild(h('span', '', t.question(s.index + 1, s.rounds.length)));
      card.appendChild(h('h2', '', round.prompt));
      b.play.appendChild(card);

      if (round.type === 'fill_blank') {
        var input = h('input', 'fd-input');
        input.type = 'text';
        input.placeholder = t.typeAnswer;
        input.value = s.typed;
        input.disabled = s.revealed;
        input.autocapitalize = 'none';
        input.addEventListener('input', function () { s.typed = input.value; });
        input.addEventListener('keydown', function (event) { if (event.key === 'Enter') submitFill(); });
        b.play.appendChild(input);
        if (s.revealed) {
          var ok = s.typed.trim().toLowerCase() === String(round.answer || '').trim().toLowerCase();
          input.classList.add(ok ? 'is-correct' : 'is-wrong');
          b.play.appendChild(h('p', 'fd-correct-is', t.correctIs(round.answer || '')));
        } else {
          var check = h('button', 'fd-btn', t.check);
          check.type = 'button';
          check.addEventListener('click', submitFill);
          b.play.appendChild(check);
          window.setTimeout(function () { input.focus(); }, 0);
        }
        return;
      }

      var correctIndex = Math.max(0, Number(round.answer || 0));
      (round.options || []).forEach(function (option, optionIndex) {
        var button = h('button', 'fd-option', option);
        button.type = 'button';
        button.disabled = s.revealed;
        if (s.revealed && optionIndex === correctIndex) button.classList.add('is-correct');
        if (s.revealed && s.selected === optionIndex && optionIndex !== correctIndex) button.classList.add('is-wrong');
        button.addEventListener('click', function () { choose(optionIndex); });
        b.play.appendChild(button);
      });
    }

    function choose(optionIndex) {
      if (s.revealed || s.finishedLocal) return;
      var round = s.rounds[s.index];
      s.selected = optionIndex;
      s.revealed = true;
      settle(optionIndex === Math.max(0, Number(round.answer || 0)));
    }

    function submitFill() {
      if (s.revealed || s.finishedLocal) return;
      var round = s.rounds[s.index];
      var expected = String(round.answer || '').trim().toLowerCase();
      s.revealed = true;
      settle(expected.length > 0 && s.typed.trim().toLowerCase() === expected);
    }

    function settle(correct, timedOut) {
      var round = s.rounds[s.index];
      if (!round) return;
      var responseMs = Math.max(0, Date.now() - s.roundStartedAt);
      var result = E.scoreDuelRound({
        correct: correct,
        duelType: round.duelType,
        previousCombo: s.combo,
        responseMs: responseMs,
        roundSeconds: round.roundSeconds,
      });
      s.score += result.awarded;
      s.combo = result.nextCombo;
      s.progress = s.index + 1;
      var done = s.progress >= s.rounds.length;
      s.feedback = correct
        ? { tone: 'good', text: t.award(result.awarded) }
        : { tone: timedOut ? 'warning' : 'neutral', text: timedOut ? t.timeout : t.miss };

      supa.rpc('update_match_progress', {
        p_match_id: s.match.id,
        p_score: s.score,
        p_progress: s.progress,
        p_finished: done,
      }).then(function () {}, function () {});
      if (done) s.finishSent = true;

      updateBattleBars();
      renderQuestion();

      if (s.advance) window.clearTimeout(s.advance);
      s.advance = window.setTimeout(function () {
        if (done) {
          finishMine();
          return;
        }
        s.index += 1;
        s.selected = null;
        s.typed = '';
        s.revealed = false;
        s.feedback = null;
        s.roundStartedAt = Date.now();
        renderQuestion();
      }, ADVANCE_DELAY_MS);
    }

    function finishMine() {
      if (s.finishedLocal) return;
      s.finishedLocal = true;
      if (!s.finishSent) {
        s.finishSent = true;
        supa.rpc('update_match_progress', {
          p_match_id: s.match.id,
          p_score: s.score,
          p_progress: s.progress,
          p_finished: true,
        }).then(function () {}, function () {});
      }
      showWaiting();
    }

    function showWaiting() {
      if (s.done) return;
      var b = s.battle;
      if (!b) return;
      b.play.innerHTML = '';
      var card = h('div', 'fd-card fd-center');
      card.appendChild(h('div', 'fd-spinner'));
      card.appendChild(h('p', 'fd-status', t.finished(s.score)));
      card.appendChild(h('p', 'fd-sub', s.opp.finished || s.timeUp ? t.calculating : t.waitingRival));
      b.play.appendChild(card);
    }

    function onSurrender() {
      if (s.done || !window.confirm(t.surrenderConfirm)) return;
      supa.rpc('surrender_match', { p_match_id: s.match.id }).then(function (res) {
        var row = res && res.data ? (Array.isArray(res.data) ? res.data[0] : res.data) : null;
        if (row) applyMatch(row);
      }, function () {});
    }

    function showResult() {
      if (s.done) return;
      s.done = true;
      stopAll();
      var match = s.match;
      var side = mySide(match);
      var outcome = match.winner_id ? (match.winner_id === s.me ? 'win' : 'lose') : 'tie';
      clear();
      var card = h('div', 'fd-card fd-center fd-result');
      card.appendChild(h('div', 'fd-trophy', outcome === 'win' ? '🏆' : outcome === 'tie' ? '🤝' : '😔'));
      card.appendChild(h('div', 'fd-ribbon' + (outcome === 'win' ? '' : ' is-muted'), t[outcome]));
      var versus = h('div', 'fd-versus');
      var me = h('div', 'fd-player');
      me.appendChild(avatar(s.myName || t.you, s.myAvatar, outcome === 'win'));
      me.appendChild(h('b', '', t.you));
      var rival = h('div', 'fd-player');
      rival.appendChild(avatar(s.rivalName || t.rival, s.rivalAvatar, outcome === 'lose'));
      rival.appendChild(h('b', '', s.rivalName || t.rival));
      versus.appendChild(me);
      versus.appendChild(h('span', 'fd-final', (side.score || 0) + ' : ' + (side.oppScore || 0)));
      versus.appendChild(rival);
      card.appendChild(versus);
      exitActions().forEach(function (action) {
        var link = h('a', action.primary ? 'fd-btn' : 'fd-btn fd-btn-ghost', action.label);
        link.href = action.href;
        card.appendChild(link);
      });
      root.appendChild(card);
    }

    // ---- main loop ----
    function tick() {
      if (s.done) return;
      var now = Date.now();
      if (now < s.introEndsAt) {
        var msLeft = s.introEndsAt - now;
        var countWindow = E.INTRO_COUNT_FROM * 1000 + E.INTRO_GO_MS;
        var phase = msLeft > countWindow ? 'found' : msLeft > E.INTRO_GO_MS ? 'count' : 'go';
        var count = Math.min(E.INTRO_COUNT_FROM, Math.max(1, Math.ceil((msLeft - E.INTRO_GO_MS) / 1000)));
        renderIntro(phase, phase === 'count' ? count : 0);
        return;
      }
      if (!s.battle) {
        s.roundStartedAt = now;
        buildBattle();
      }

      var duration = Number(s.match.duration_seconds || 90);
      var elapsed = Math.floor((now - s.clockStartMs) / 1000);
      var left = Math.max(0, Math.min(duration, duration - elapsed));
      if (s.battle) {
        s.battle.timerValue.textContent = String(left);
        s.battle.timer.classList.toggle('is-low', left <= 10);
      }
      if (left <= 0 && !s.timeUp) {
        s.timeUp = true;
        finishMine();
        supa.rpc('finalize_match', { p_match_id: s.match.id }).then(function () {}, function () {});
        return;
      }

      var round = s.rounds[s.index];
      if (!round || s.finishedLocal || !s.battle) return;
      var roundLeft = Math.max(0, round.roundSeconds - Math.floor((now - s.roundStartedAt) / 1000));
      s.battle.roundValue.textContent = String(roundLeft);
      s.battle.round.classList.toggle('is-low', roundLeft <= 3);
      if (roundLeft <= 0 && !s.revealed) {
        s.revealed = true;
        settle(false, true);
      }
    }

    async function run() {
      showStatus(t.joining, true);
      try {
        var session = await supa.auth.getSession();
        var user = session && session.data && session.data.session && session.data.session.user;
        if (!user) {
          if (options.onLoginRequired) options.onLoginRequired();
          return;
        }
        s.me = user.id;

        var joined = await supa.rpc('join_friend_duel_room', { p_invite_code: options.code });
        if (joined.error) {
          showStatus(errorMessage(joined.error), false, exitActions());
          return;
        }
        var room = Array.isArray(joined.data) ? joined.data[0] : joined.data;
        if (!room) {
          showStatus(t.unavailable, false, exitActions());
          return;
        }
        if (room.host_id === s.me) {
          showStatus(t.ownRoom, false, exitActions());
          return;
        }
        if (!room.match_id) {
          showStatus(t.unavailable, false, exitActions());
          return;
        }
        s.room = room;

        var match = await fetchMatch(room.match_id);
        if (!match) {
          showStatus(t.error, false, [{ label: t.retry, primary: true, onClick: run }]);
          return;
        }
        s.match = match;

        var mode = String(room.duel_mode || 'classic');
        var practiceItems = mode === 'classic' && match.practice_id ? await loadPracticeItems(match.practice_id) : null;
        var deck = E.buildLiveDuelDeck({
          level: String(match.level || 'a1').toLowerCase(),
          mode: mode,
          practiceItems: practiceItems,
          seed: match.id,
          target: String(match.target || 'german'),
        });
        s.rounds = deck.map(function (item, index) { return E.buildDuelRound(item, index); });

        await loadProfiles(room.host_id);
        applyMatch(match);
        if (s.done) return;

        var now = Date.now();
        var startedAt = match.started_at ? new Date(match.started_at).getTime() : now;
        s.clockStartMs = startedAt + E.INTRO_TOTAL_MS;
        s.introEndsAt = Math.min(Math.max(s.clockStartMs, now), now + E.INTRO_TOTAL_MS);

        subscribe(match.id);
        s.timer = window.setInterval(tick, 150);
        tick();
      } catch (error) {
        showStatus(t.error, false, [{ label: t.retry, primary: true, onClick: run }]);
      }
    }

    run();
    return { stop: stopAll };
  }

  window.DuvelaFriendDuelPlay = { start: start };
})();
