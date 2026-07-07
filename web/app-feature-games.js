(function () {
  function createGamesFeature(ctx) {
    const { $, tr, esc, supa, alert } = ctx;
    const CHESS_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const PIECE_GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
    const DUEL_TARGETS = [['german', 'Deutsch'], ['english', 'English'], ['spanish', 'EspaГ±ol'], ['french', 'FranГ§ais']];
    let chessState = null;
    let duelState = null;

    function mapChess(row) {
      return {
        id: String(row.id),
        inviteCode: String(row.invite_code || ''),
        whiteId: String(row.white_id || ''),
        blackId: row.black_id || null,
        fen: row.fen || CHESS_START,
        status: row.status || 'waiting',
        winner: row.winner || null
      };
    }

    function openChess() {
      if (chessState && chessState.channel) supa.removeChannel(chessState.channel);
      chessState = null;
      $('#chessOverlayBody').innerHTML =
        '<p style="font-weight:800;color:var(--soft)">' + esc(tr('Play chess with a friend by sharing an invite code.', 'Играйте в шахматы с другом по коду-приглашению.')) + '</p>' +
        '<button class="btn primary" id="chessCreate" style="width:100%;margin:10px 0">' + esc(tr('Create a game', 'Создать игру')) + '</button>' +
        '<div class="section-head"><h3 style="font-size:14px;margin:0">' + esc(tr('Join by code', 'Войти по коду')) + '</h3></div>' +
        '<form id="chessJoinForm" style="display:flex;gap:8px;margin-top:6px"><input id="chessCode" placeholder="CODE" style="flex:1;border:1px solid var(--line);border-radius:10px;padding:10px;text-transform:uppercase"><button class="btn" type="submit">' + esc(tr('Join', 'Войти')) + '</button></form>' +
        '<div id="chessLobbyNote" style="display:none;margin-top:8px;font-weight:900;color:var(--red)"></div>';
      $('#chessCreate').addEventListener('click', chessCreate);
      $('#chessJoinForm').addEventListener('submit', chessJoin);
      $('#chessOverlay').classList.add('open');
    }

    function chessErr(error) {
      const note = $('#chessLobbyNote');
      if (!note) return;
      note.textContent = (error && error.message) || tr('Could not start.', 'Не удалось начать.');
      note.style.display = 'block';
    }

    async function chessCreate() {
      const button = $('#chessCreate');
      button.disabled = true;
      try {
        const { data, error } = await supa.rpc('chess_create_match');
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        startChess(mapChess(row));
      } catch (error) {
        chessErr(error);
        button.disabled = false;
      }
    }

    async function chessJoin(event) {
      event.preventDefault();
      const code = $('#chessCode').value.trim().toUpperCase();
      if (!code) return;
      try {
        const { data, error } = await supa.rpc('chess_join_match', { p_invite_code: code });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error(tr('Match not found.', 'Игра не найдена.'));
        startChess(mapChess(row));
      } catch (error) {
        chessErr(error);
      }
    }

    function startChess(match) {
      const myColor = match.whiteId === ctx.user.id ? 'w' : 'b';
      chessState = { match, game: new window.Chess(match.fen || CHESS_START), sel: null, legal: null, myColor, channel: null };
      chessState.channel = supa.channel('chess-' + match.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chess_matches', filter: 'id=eq.' + match.id }, (payload) => {
          const row = payload.new;
          if (!row || !row.id) return;
          chessState.match = mapChess(row);
          chessState.game = new window.Chess(chessState.match.fen || CHESS_START);
          chessState.sel = null;
          chessState.legal = null;
          renderChessBoard();
        }).subscribe();
      renderChessBoard();
    }

    function renderChessBoard() {
      const step = chessState;
      if (!step) return;
      const match = step.match;
      const game = step.game;
      const flip = step.myColor === 'b';
      const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
      const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
      const rows = flip ? [...ranks].reverse() : ranks;
      const cols = flip ? [...files].reverse() : files;
      let cells = '';
      rows.forEach((rank) => {
        cols.forEach((file) => {
          const square = file + rank;
          const piece = game.get(square);
          const dark = (files.indexOf(file) + rank) % 2 === 1;
          const isSelected = step.sel === square;
          const isTarget = step.legal && step.legal.indexOf(square) !== -1;
          const glyph = piece ? '<span class="pc ' + piece.color + '">' + PIECE_GLYPH[piece.type] + '</span>' : '';
          cells += '<div class="csq ' + (dark ? 'dark' : 'light') + (isSelected ? ' sel' : '') + (isTarget ? ' tgt' : '') + '" data-sq="' + square + '">' + glyph + '</div>';
        });
      });
      const myTurn = match.status === 'active' && game.turn() === step.myColor;
      let statusText;
      if (match.status === 'waiting') statusText = tr('Waiting for opponent — code: ', 'Ждём соперника — код: ') + match.inviteCode;
      else if (match.status === 'completed') statusText = match.winner === 'draw' ? tr('Draw', 'Ничья') : (((match.winner === 'white') ? 'w' : 'b') === step.myColor ? tr('You won! 🎉', 'Вы выиграли! 🎉') : tr('You lost.', 'Вы проиграли.'));
      else if (match.status === 'aborted') statusText = tr('Game aborted.', 'Игра прервана.');
      else statusText = myTurn ? tr('Your move', 'Ваш ход') : tr('Opponent is thinking…', 'Ход соперника…');
      $('#chessOverlayBody').innerHTML =
        '<div class="chessboard" id="chessBoard">' + cells + '</div>' +
        '<p style="text-align:center;font-weight:900;margin:12px 0 4px">' + esc(statusText) + '</p>' +
        (match.status === 'waiting' || match.status === 'active'
          ? '<button class="btn danger" id="chessResign" style="width:100%">' + esc(match.status === 'waiting' ? tr('Cancel', 'Отменить') : tr('Resign', 'Сдаться')) + '</button>'
          : '<button class="btn primary" id="chessNew" style="width:100%">' + esc(tr('New game', 'Новая игра')) + '</button>');
      const board = $('#chessBoard');
      if (board && myTurn) board.addEventListener('click', onChessSquare);
      const resignButton = $('#chessResign');
      if (resignButton) resignButton.addEventListener('click', chessResign);
      const newButton = $('#chessNew');
      if (newButton) newButton.addEventListener('click', openChess);
    }

    function onChessSquare(event) {
      const cell = event.target.closest('[data-sq]');
      if (!cell) return;
      const step = chessState;
      const game = step.game;
      const square = cell.dataset.sq;
      if (step.sel) {
        const move = game.moves({ square: step.sel, verbose: true }).find((item) => item.to === square);
        if (move) {
          doChessMove(step.sel, square, move.promotion ? 'q' : undefined);
          return;
        }
      }
      const piece = game.get(square);
      if (piece && piece.color === step.myColor) {
        step.sel = square;
        step.legal = game.moves({ square, verbose: true }).map((item) => item.to);
      } else {
        step.sel = null;
        step.legal = null;
      }
      renderChessBoard();
    }

    async function doChessMove(from, to, promotion) {
      const step = chessState;
      const game = step.game;
      const move = game.move({ from, to, promotion: promotion || 'q' });
      if (!move) {
        step.sel = null;
        step.legal = null;
        renderChessBoard();
        return;
      }
      step.sel = null;
      step.legal = null;
      let status = 'active';
      let winner = '';
      let reason = '';
      if (game.game_over()) {
        status = 'completed';
        if (game.in_checkmate()) {
          winner = game.turn() === 'w' ? 'black' : 'white';
          reason = 'checkmate';
        } else {
          winner = 'draw';
          reason = 'draw';
        }
      }
      renderChessBoard();
      try {
        await supa.rpc('chess_apply_move', { p_match_id: step.match.id, p_fen: game.fen(), p_last_move: from + to, p_status: status, p_winner: winner, p_reason: reason });
      } catch (error) {
        alert((error && error.message) || tr('Move failed.', 'Ход не прошёл.'));
      }
    }

    async function chessResign() {
      const step = chessState;
      if (!step) return;
      try {
        if (step.match.status === 'waiting') await supa.rpc('chess_cancel_match', { p_match_id: step.match.id });
        else await supa.rpc('chess_resign_match', { p_match_id: step.match.id });
      } catch (error) {
        /* best effort */
      }
      closeChess();
    }

    function closeChess() {
      if (chessState && chessState.channel) supa.removeChannel(chessState.channel);
      chessState = null;
      $('#chessOverlay').classList.remove('open');
    }

    function mapDuel(row) {
      return {
        id: String(row.id),
        practiceId: row.practice_id || null,
        status: row.status || 'waiting',
        durationSeconds: Number(row.duration_seconds || 90),
        p1: { id: String(row.player1_id), score: Number(row.player1_score || 0), progress: Number(row.player1_progress || 0), finished: row.player1_finished === true },
        p2: { id: row.player2_id || null, score: Number(row.player2_score || 0), progress: Number(row.player2_progress || 0), finished: row.player2_finished === true },
        winnerId: row.winner_id || null
      };
    }

    function openDuel() {
      cleanupDuel();
      const level = (ctx.profile && ctx.profile.language_level ? ctx.profile.language_level : 'a2').toLowerCase();
      $('#duelOverlayBody').innerHTML =
        '<p style="font-weight:800;color:var(--soft)">' + esc(tr('Get matched with a rival at your level and race through a practice.', 'Найдём соперника вашего уровня — кто быстрее Рё точнее пройдёт практику.')) + '</p>' +
        '<div class="field"><label>' + esc(tr('Language', 'Язык')) + '</label><select id="duelTarget" class="role-select">' + DUEL_TARGETS.map(([value, label]) => '<option value="' + value + '">' + esc(label) + '</option>').join('') + '</select></div>' +
        '<div class="field"><label>' + esc(tr('Level', 'Уровень')) + '</label><select id="duelLevel" class="role-select">' + ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((item) => '<option value="' + item + '"' + (item === level ? ' selected' : '') + '>' + item.toUpperCase() + '</option>').join('') + '</select></div>' +
        '<button class="btn primary" id="duelFind" style="width:100%;margin-top:10px">' + esc(tr('Find a rival', 'Найти соперника')) + '</button>' +
        '<div id="duelNote" style="display:none;margin-top:8px;font-weight:900;color:var(--red)"></div>';
      $('#duelFind').addEventListener('click', duelFind);
      $('#duelOverlay').classList.add('open');
    }

    async function duelFind() {
      const target = $('#duelTarget').value;
      const level = $('#duelLevel').value;
      const button = $('#duelFind');
      button.disabled = true;
      button.textContent = tr('Searching…', 'Поиск…');
      try {
        const { data, error } = await supa.rpc('find_or_create_match', { p_target: target, p_level: level });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error(tr('No practice available for this pair yet.', 'Для этой пары пока нет практики.'));
        startDuel(mapDuel(row));
      } catch (error) {
        const note = $('#duelNote');
        note.textContent = (error && error.message) || tr('Matchmaking failed.', 'Матчмейкинг не удался.');
        note.style.display = 'block';
        button.disabled = false;
        button.textContent = tr('Find a rival', 'Найти соперника');
      }
    }

    function startDuel(match) {
      duelState = { match, items: [], idx: 0, score: 0, channel: null, timer: null, timeLeft: match.durationSeconds, me: match.p1.id === ctx.user.id ? 'p1' : 'p2', started: false };
      duelState.channel = supa.channel('duel-' + match.id)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_matches', filter: 'id=eq.' + match.id }, (payload) => {
          const row = payload.new;
          if (!row || !row.id) return;
          duelState.match = mapDuel(row);
          if (duelState.match.status === 'completed' || duelState.match.status === 'cancelled') {
            renderDuelResult();
            return;
          }
          if (duelState.match.status === 'active' && !duelState.started) {
            beginDuelPlay();
            return;
          }
          if (duelState.started) updateDuelBars();
        }).subscribe();
      if (match.status === 'active') beginDuelPlay();
      else renderDuelWaiting();
    }

    function renderDuelWaiting() {
      $('#duelOverlayBody').innerHTML = '<div class="empty" style="padding:30px">' + esc(tr('Waiting for a rival…', 'Ждём соперника…')) + '</div><button class="btn danger" id="duelCancel" style="width:100%">' + esc(tr('Cancel', 'Отменить')) + '</button>';
      $('#duelCancel').addEventListener('click', duelCancel);
    }

    async function beginDuelPlay() {
      if (duelState.started) return;
      duelState.started = true;
      const match = duelState.match;
      if (!match.practiceId) {
        finishDuel();
        return;
      }
      try {
        const { data } = await supa.from('teacher_practice_items').select('id,type,prompt,options,answer').eq('practice_id', match.practiceId).order('order_index', { ascending: true });
        duelState.items = data || [];
      } catch (error) {
        duelState.items = [];
      }
      duelState.timeLeft = match.durationSeconds;
      duelState.timer = setInterval(() => {
        duelState.timeLeft--;
        const timer = $('#duelTimer');
        if (timer) timer.textContent = Math.max(0, duelState.timeLeft);
        if (duelState.timeLeft <= 0) finishDuel();
      }, 1000);
      renderDuelPlay();
    }

    function duelOpp() {
      const match = duelState.match;
      return duelState.me === 'p1' ? match.p2 : match.p1;
    }

    function renderDuelPlay() {
      const item = duelState.items[duelState.idx];
      if (!item) {
        finishDuel();
        return;
      }
      const total = duelState.items.length || 1;
      const mine = Math.round((duelState.idx / total) * 100);
      const opp = duelOpp();
      const oppProgress = opp ? opp.progress : 0;
      const options = Array.isArray(item.options) ? item.options : [];
      $('#duelOverlayBody').innerHTML =
        '<div class="duel-timer" id="duelTimer">' + Math.max(0, duelState.timeLeft) + '</div>' +
        '<div class="duel-bars">' +
          '<div><div style="display:flex;justify-content:space-between;font-weight:900;font-size:12px"><span>' + esc(tr('You', 'Вы')) + ' · ' + duelState.score + '</span><span id="duelMineP">' + mine + '%</span></div><div class="prog-bar"><i id="duelMineBar" style="width:' + mine + '%"></i></div></div>' +
          '<div><div style="display:flex;justify-content:space-between;font-weight:900;font-size:12px"><span>' + esc(tr('Rival', 'Соперник')) + '</span><span id="duelOppP">' + oppProgress + '%</span></div><div class="prog-bar"><i id="duelOppBar" style="width:' + oppProgress + '%;background:var(--red)"></i></div></div>' +
        '</div>' +
        '<div class="card" style="padding:14px;margin-top:8px"><h3 style="margin:0 0 10px">' + esc(item.prompt) + '</h3>' +
          options.map((option, index) => '<button class="btn" data-duel-opt="' + index + '" style="width:100%;margin-bottom:6px;justify-content:flex-start;text-align:left">' + esc(option) + '</button>').join('') + '</div>';
    }

    function updateDuelBars() {
      const opp = duelOpp();
      if (!opp) return;
      const progress = $('#duelOppP');
      const bar = $('#duelOppBar');
      if (progress) progress.textContent = opp.progress + '%';
      if (bar) bar.style.width = opp.progress + '%';
    }

    async function answerDuel(index) {
      const item = duelState.items[duelState.idx];
      if (!item) return;
      const correct = String(item.answer) === String(index) || String(item.answer).toLowerCase() === String((item.options || [])[index] || '').toLowerCase();
      if (correct) duelState.score++;
      duelState.idx++;
      const total = duelState.items.length || 1;
      const finished = duelState.idx >= duelState.items.length;
      const progress = finished ? 100 : Math.round((duelState.idx / total) * 100);
      try {
        await supa.rpc('update_match_progress', { p_match_id: duelState.match.id, p_score: duelState.score, p_progress: progress, p_finished: finished });
      } catch (error) {
        /* ignore */
      }
      if (finished) finishDuel();
      else renderDuelPlay();
    }

    async function finishDuel() {
      if (duelState.timer) {
        clearInterval(duelState.timer);
        duelState.timer = null;
      }
      try {
        await supa.rpc('update_match_progress', { p_match_id: duelState.match.id, p_score: duelState.score, p_progress: 100, p_finished: true });
      } catch (error) {
        /* ignore */
      }
      try {
        await supa.rpc('finalize_match', { p_match_id: duelState.match.id });
      } catch (error) {
        /* ignore */
      }
      $('#duelOverlayBody').innerHTML = '<div class="empty" style="padding:30px">' + esc(tr('Finished! Waiting for result…', 'Готово! Ждём результат…')) + '</div>';
    }

    function renderDuelResult() {
      if (duelState.timer) {
        clearInterval(duelState.timer);
        duelState.timer = null;
      }
      const match = duelState.match;
      const text = (!match.winnerId) ? tr('Draw', 'Ничья') : (match.winnerId === ctx.user.id ? tr('You won! 🎉', 'Вы выиграли! 🎉') : tr('You lost.', 'Вы проиграли.'));
      $('#duelOverlayBody').innerHTML = '<div style="text-align:center;padding:20px"><div style="font-size:40px">🏁</div><h2>' + esc(text) + '</h2><p style="color:var(--soft);font-weight:800">' + esc(tr('Your score: ', 'Ваш счёт: ') + duelState.score) + '</p></div><button class="btn primary" id="duelAgain" style="width:100%">' + esc(tr('Play again', 'Ещё раз')) + '</button>';
      $('#duelAgain').addEventListener('click', openDuel);
    }

    async function duelCancel() {
      try {
        if (duelState) await supa.from('practice_matches').delete().eq('id', duelState.match.id);
      } catch (error) {
        /* ignore */
      }
      closeDuel();
    }

    function cleanupDuel() {
      if (duelState) {
        if (duelState.timer) clearInterval(duelState.timer);
        if (duelState.channel) supa.removeChannel(duelState.channel);
      }
      duelState = null;
    }

    function closeDuel() {
      cleanupDuel();
      $('#duelOverlay').classList.remove('open');
    }

    function bindEvents() {
      $('#duelClose').addEventListener('click', closeDuel);
      $('#duelOverlay').addEventListener('click', (event) => {
        if (event.target === $('#duelOverlay')) closeDuel();
      });
      $('#chessClose').addEventListener('click', closeChess);
      $('#chessOverlay').addEventListener('click', (event) => {
        if (event.target === $('#chessOverlay')) closeChess();
      });
      $('#duelOverlayBody').addEventListener('click', (event) => {
        const option = event.target.closest('[data-duel-opt]');
        if (option) answerDuel(Number(option.dataset.duelOpt));
      });
    }

    function cleanup() {
      closeDuel();
      closeChess();
    }

    return {
      bindEvents,
      cleanup,
      closeChess,
      closeDuel,
      openChess,
      openDuel
    };
  }

  window.DuvelaAppGames = { create: createGamesFeature };
})();
