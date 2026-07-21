(function () {
  function createGamificationFeature(ctx) {
    const { $, tr, esc, alert, supa, state, timeAgo, formatDate } = ctx;
    const GOALS = [
      ['daily_min_dialogs', 'dialogs_done', ['Dialogs', 'Диалоги']],
      ['daily_min_words', 'words_done', ['Words', 'Слова']],
      ['daily_min_writing', 'writing_done', ['Writing', 'Письмо']],
      ['daily_min_listening_min', 'listening_min_done', ['Listening (min)', 'Аудирование (мин)']],
      ['daily_min_live_min', 'live_min_done', ['LIVE (min)', 'LIVE (мин)']]
    ];
    const day = (value) => new Date(value || Date.now()).toISOString().slice(0, 10);
    const daysBetween = (a, b) => Math.max(1, Math.floor((new Date(day(b)) - new Date(day(a))) / 86400000) + 1);
    const reminderKey = (id) => 'duvela.challenge.reminder.' + id;
    const rowScore = (row) => GOALS.reduce((sum, goal) => sum + Number(row[goal[1]] || 0), 0);
    const targetScore = (challenge) => GOALS.reduce((sum, goal) => sum + Number(challenge[goal[0]] || 0), 0);
    const dayComplete = (challenge, row) => GOALS.every((goal) => !Number(challenge[goal[0]]) || Number(row[goal[1]] || 0) >= Number(challenge[goal[0]]));

    function statsFor(challenge, rows) {
      const finish = challenge.ends_at && new Date(challenge.ends_at) < new Date() ? challenge.ends_at : day();
      const elapsed = daysBetween(challenge.started_at || day(), finish);
      const target = targetScore(challenge);
      const percent = target ? Math.min(100, Math.round(rows.reduce((sum, row) => sum + rowScore(row), 0) / (target * elapsed) * 100)) : (rows.length ? 100 : 0);
      const completed = new Set(rows.filter((row) => dayComplete(challenge, row)).map((row) => day(row.day)));
      const cursor = new Date();
      if (!completed.has(day(cursor))) cursor.setDate(cursor.getDate() - 1);
      let streak = 0;
      while (completed.has(day(cursor))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
      return { percent, streak, completed: completed.size, elapsed };
    }

    async function loadWallet() {
      try {
        const { data } = await supa.from('coin_transactions').select('amount,balance_after,source,label,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(8);
        state.walletTx = data || [];
      } catch (error) { console.warn('wallet load failed', error); }
    }

    function walletHtml() {
      const balance = (ctx.profile?.vela_coin_balance ?? 0).toLocaleString();
      const rows = state.walletTx.length ? state.walletTx.map((item) => {
        const amount = Number(item.amount || 0);
        return '<div class="rank-row" style="grid-template-columns:minmax(0,1fr) auto"><div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(item.label || item.source || tr('Transaction', 'Операция')) + '<div style="color:var(--muted);font-size:11px">' + esc(timeAgo(item.created_at)) + '</div></div><div style="font-weight:900;color:' + (amount >= 0 ? 'var(--teal)' : 'var(--red)') + '">' + (amount >= 0 ? '+' : '') + amount + '</div></div>';
      }).join('') : '<div class="empty">' + esc(tr('No coin activity yet.', 'Операций с монетами пока нет.')) + '</div>';
      return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Duvela Coins', 'Монеты Duvela')) + '</h2><span>' + balance + '</span></div>' + rows + '<p style="color:var(--muted);font-size:12px;font-weight:700;margin-top:10px">' + esc(tr('Buying coins is available in the Duvela mobile app.', 'Покупка монет доступна в мобильном приложении Duvela.')) + '</p>';
    }

    async function loadChallenges() {
      try {
        const { data } = await supa.from('challenges').select('id,title,target_level,exam_type,started_at,ends_at,daily_min_dialogs,daily_min_words,daily_min_writing,daily_min_listening_min,daily_min_live_min,cover_url').order('created_at', { ascending: false }).limit(20);
        state.challenges = data || [];
        const { data: mine } = await supa.from('challenge_participants').select('challenge_id').eq('user_id', ctx.user.id);
        state.myChallengeIds = new Set((mine || []).map((item) => String(item.challenge_id)));
      } catch (error) { console.warn('challenges load failed', error); }
    }

    function challengesHtml() {
      if (!state.challenges.length) return '';
      return '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Challenges', 'Челленджи')) + '</h2></div>' + state.challenges.map((challenge) => {
        const joined = state.myChallengeIds.has(String(challenge.id));
        return '<div class="card row" data-challenge="' + esc(challenge.id) + '" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer"><div><h3>' + esc(challenge.title) + '</h3><p>' + esc([challenge.target_level, challenge.exam_type, challenge.ends_at ? tr('until ', 'до ') + formatDate(challenge.ends_at) : ''].filter(Boolean).join(' · ')) + '</p></div><span class="tag ' + (joined ? 'teal' : '') + '">' + esc(joined ? tr('Joined', 'Участвую') : tr('Open', 'Открыть')) + '</span></div>';
      }).join('');
    }

    async function loadChallengeDetails(id) {
      const mine = await supa.from('challenge_progress').select('*').eq('challenge_id', id).eq('user_id', ctx.user.id).order('day', { ascending: false });
      const people = await supa.from('challenge_participants').select('user_id,status').eq('challenge_id', id).neq('status', 'cancelled').limit(100);
      const participants = people.data || [];
      let leaderboard = [];
      if (participants.length) {
        const ids = participants.map((item) => item.user_id);
        const [progress, profiles] = await Promise.all([
          supa.from('challenge_progress').select('user_id,dialogs_done,words_done,writing_done,listening_min_done,live_min_done').eq('challenge_id', id).in('user_id', ids),
          supa.from('profiles').select('id,full_name').in('id', ids)
        ]);
        const names = new Map((profiles.data || []).map((item) => [item.id, item.full_name]));
        const scores = new Map();
        (progress.data || []).forEach((row) => scores.set(row.user_id, (scores.get(row.user_id) || 0) + rowScore(row)));
        leaderboard = ids.map((userId) => ({ name: names.get(userId) || tr('Duvela learner', 'Ученик Duvela'), score: scores.get(userId) || 0 })).sort((a, b) => b.score - a.score).slice(0, 5);
      }
      return { rows: mine.data || [], participants, leaderboard };
    }

    async function openChallenge(id) {
      const challenge = state.challenges.find((item) => String(item.id) === String(id));
      if (!challenge) return;
      $('#challengeOverlayTitle').textContent = challenge.title;
      const body = $('#challengeOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading…', 'Загрузка…')) + '</div>';
      $('#challengeOverlay').classList.add('open');
      const joined = state.myChallengeIds.has(String(id));
      let details = { rows: [], participants: [], leaderboard: [] };
      try { details = await loadChallengeDetails(id); } catch (error) { console.warn('challenge details load failed', error); }
      const todayProgress = details.rows.find((row) => day(row.day) === day()) || {};
      const stats = statsFor(challenge, details.rows);
      const totalDays = daysBetween(challenge.started_at || day(), challenge.ends_at || day());
      const rewardXp = Math.max(100, Math.min(1000, totalDays * 25));
      const status = challenge.ends_at && new Date(challenge.ends_at) < new Date() ? tr('Completed', 'Завершён') : challenge.started_at && new Date(challenge.started_at) > new Date() ? tr('Starts soon', 'Скоро начнётся') : tr('Active', 'Активный');
      const reminder = localStorage.getItem(reminderKey(id)) === '1';
      body.innerHTML =
        (challenge.cover_url ? '<img src="' + esc(challenge.cover_url) + '" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:18px;margin-bottom:14px">' : '') +
        '<div style="display:flex;gap:7px;flex-wrap:wrap"><span class="tag teal">' + esc(status) + '</span><span class="tag">' + esc(challenge.target_level || tr('Any level', 'Любой уровень')) + '</span><span class="tag">' + esc(challenge.exam_type || tr('General language', 'Общий язык')) + '</span></div>' +
        '<p style="font-weight:700;color:var(--soft);margin:12px 0">' + esc(tr('Complete daily goals, keep your streak and reach the finish together with other learners.', 'Выполняйте ежедневные задания, сохраняйте серию и дойдите до финиша вместе с другими учениками.')) + '</p>' +
        '<div class="form-grid"><div class="card"><b>' + esc(formatDate(challenge.started_at || day())) + '</b><p>' + esc(tr('Start', 'Начало')) + '</p></div><div class="card"><b>' + esc(formatDate(challenge.ends_at || day())) + '</b><p>' + esc(tr('Finish', 'Завершение')) + '</p></div><div class="card"><b>' + details.participants.length + '</b><p>' + esc(tr('Participants', 'Участники')) + '</p></div><div class="card"><b>+' + rewardXp + ' XP · 🏅</b><p>' + esc(tr('Completion reward', 'Награда за завершение')) + '</p></div></div>' +
        (joined ? '<div class="card" style="margin:12px 0"><div style="display:flex;justify-content:space-between"><b>' + esc(tr('Overall progress', 'Общий прогресс')) + '</b><b>' + stats.percent + '%</b></div><div style="height:10px;background:var(--purple-soft);border-radius:99px;overflow:hidden;margin:9px 0"><span style="display:block;width:' + stats.percent + '%;height:100%;background:linear-gradient(90deg,var(--purple),#c52bd8)"></span></div><small>🔥 ' + stats.streak + ' ' + esc(tr('day streak', 'дней подряд')) + ' · ✓ ' + stats.completed + '/' + stats.elapsed + ' ' + esc(tr('days completed', 'дней выполнено')) + '</small></div>' : '') +
        '<div style="margin:10px 0;display:flex;gap:6px;flex-wrap:wrap">' + GOALS.filter((goal) => Number(challenge[goal[0]]) > 0).map((goal) => '<span class="tag">' + esc(tr(goal[2][0], goal[2][1])) + ': ' + challenge[goal[0]] + '</span>').join('') + '</div>' +
        (joined ? '<h3 style="font-size:15px;margin:14px 0 7px">' + esc(tr("Today's tasks", 'Задания на сегодня')) + '</h3><div class="form-grid">' + GOALS.filter((goal) => Number(challenge[goal[0]]) > 0).map((goal) => '<div class="field"><label>' + esc(tr(goal[2][0], goal[2][1])) + ' / ' + challenge[goal[0]] + '</label><input id="cg-' + goal[1] + '" type="number" min="0" value="' + Number(todayProgress[goal[1]] || 0) + '"></div>').join('') + '</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" data-save-challenge="' + esc(id) + '">' + esc(tr('Save progress', 'Сохранить прогресс')) + '</button><button class="btn" id="challengeReminder">' + esc(reminder ? tr('Reminder on', 'Напоминание включено') : tr('Remind me', 'Напомнить мне')) + '</button></div>' : '<button class="btn primary" data-join-challenge="' + esc(id) + '" style="margin-top:8px">' + esc(tr('Join challenge', 'Участвовать')) + '</button>') +
        '<h3 style="font-size:15px;margin:18px 0 8px">🏆 ' + esc(tr('Leaderboard', 'Таблица лидеров')) + '</h3>' + (details.leaderboard.length ? details.leaderboard.map((row, index) => '<div class="rank-row" style="grid-template-columns:30px minmax(0,1fr) auto"><b>#' + (index + 1) + '</b><span>' + esc(row.name) + '</span><b>' + row.score + '</b></div>').join('') : '<div class="empty">' + esc(tr('Be the first participant on the leaderboard.', 'Станьте первым участником в таблице лидеров.')) + '</div>');
      const reminderButton = $('#challengeReminder');
      if (reminderButton) reminderButton.onclick = () => {
        const next = localStorage.getItem(reminderKey(id)) !== '1';
        localStorage.setItem(reminderKey(id), next ? '1' : '0');
        reminderButton.textContent = next ? tr('Reminder on', 'Напоминание включено') : tr('Remind me', 'Напомнить мне');
      };
    }

    async function joinChallenge(id) {
      try {
        const { error } = await supa.from('challenge_participants').insert({ challenge_id: id, user_id: ctx.user.id, status: 'active' });
        if (error) throw error;
        state.myChallengeIds.add(String(id));
        openChallenge(id);
      } catch (error) { alert(error.message || tr('Could not join.', 'Не удалось присоединиться.')); }
    }

    async function saveChallengeProgress(id) {
      const row = { challenge_id: id, user_id: ctx.user.id, day: day() };
      GOALS.forEach((goal) => { const input = $('#cg-' + goal[1]); row[goal[1]] = input ? Math.max(0, Number(input.value) || 0) : 0; });
      try {
        const { error } = await supa.from('challenge_progress').upsert(row, { onConflict: 'challenge_id,user_id,day' });
        if (error) throw error;
        await openChallenge(id);
        alert(tr('Progress saved ✓', 'Прогресс сохранён ✓'));
      } catch (error) { alert(error.message || tr('Could not save progress.', 'Не удалось сохранить прогресс.')); }
    }

    function openChallengeCreate() {
      if (!state.myOrg) { alert(tr('Create an organization first.', 'Сначала создайте организацию.')); return; }
      $('#challengeOverlayTitle').textContent = tr('New challenge', 'Новый челлендж');
      $('#challengeOverlayBody').innerHTML = '<form id="chCreateForm"><div class="field"><label>' + esc(tr('Title', 'Название')) + '</label><input id="chTitle" maxlength="140" required></div><div class="form-grid"><div class="field"><label>' + esc(tr('Target level', 'Целевой уровень')) + '</label><input id="chLevel" placeholder="B1" maxlength="10"></div><div class="field"><label>' + esc(tr('Language / exam', 'Язык / экзамен')) + '</label><input id="chExam" maxlength="40"></div><div class="field"><label>' + esc(tr('Ends on', 'Дата окончания')) + '</label><input id="chEnds" type="date"></div><div class="field"><label>' + esc(tr('Daily dialogs', 'Диалогов в день')) + '</label><input id="chDialogs" type="number" min="0" value="0"></div><div class="field"><label>' + esc(tr('Daily words', 'Слов в день')) + '</label><input id="chWords" type="number" min="0" value="0"></div></div><button class="btn primary" type="submit" style="margin-top:10px">' + esc(tr('Create challenge', 'Создать челлендж')) + '</button></form>';
      $('#challengeOverlay').classList.add('open');
      $('#chCreateForm').addEventListener('submit', createChallenge);
    }

    async function createChallenge(event) {
      event.preventDefault();
      const title = $('#chTitle').value.trim();
      if (!title) return;
      try {
        const { error } = await supa.from('challenges').insert({ organization_id: state.myOrg.id, created_by: ctx.user.id, title, target_level: $('#chLevel').value.trim() || null, exam_type: $('#chExam').value.trim() || null, started_at: day(), ends_at: $('#chEnds').value || null, daily_min_dialogs: Number($('#chDialogs').value) || 0, daily_min_words: Number($('#chWords').value) || 0 });
        if (error) throw error;
        $('#challengeOverlay').classList.remove('open');
        await loadChallenges();
        alert(tr('Challenge created ✓', 'Челлендж создан ✓'));
      } catch (error) { alert(error.message || tr('Could not create the challenge.', 'Не удалось создать челлендж.')); }
    }

    return { challengesHtml, joinChallenge, loadChallenges, loadWallet, openChallenge, openChallengeCreate, saveChallengeProgress, walletHtml };
  }
  window.DuvelaAppGamification = { create: createGamificationFeature };
})();
