(function () {
  function createGamificationFeature(ctx) {
    const { $, tr, esc, alert, supa, state, timeAgo, formatDate } = ctx;
    const CHALLENGE_GOALS = [
      ['daily_min_dialogs', 'dialogs_done', ['Dialogs', 'Диалоги']],
      ['daily_min_words', 'words_done', ['Words', 'Слова']],
      ['daily_min_writing', 'writing_done', ['Writing', 'Письмо']],
      ['daily_min_listening_min', 'listening_min_done', ['Listening (min)', 'Аудирование (мин)']],
      ['daily_min_live_min', 'live_min_done', ['Live (min)', 'Live (мин)']]
    ];

    async function loadWallet() {
      try {
        const { data } = await supa.from('coin_transactions')
          .select('amount,balance_after,source,label,created_at')
          .eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(8);
        state.walletTx = data || [];
      } catch (error) {
        console.warn('wallet load failed', error);
      }
    }

    function walletHtml() {
      const balance = (ctx.profile?.vela_coin_balance ?? 0).toLocaleString();
      const rows = state.walletTx.length
        ? state.walletTx.map((item) => {
            const amount = Number(item.amount || 0);
            return '<div class="rank-row" style="grid-template-columns:minmax(0,1fr) auto"><div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(item.label || item.source || tr('Transaction', 'Операция')) + '<div style="color:var(--muted);font-size:11px">' + esc(timeAgo(item.created_at)) + '</div></div><div style="font-weight:900;color:' + (amount >= 0 ? 'var(--teal)' : 'var(--red)') + '">' + (amount >= 0 ? '+' : '') + amount + '</div></div>';
          }).join('')
        : '<div class="empty">' + esc(tr('No coin activity yet.', 'Операций с монетами пока нет.')) + '</div>';
      return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Duvela Coins', 'Монеты Duvela')) + '</h2><span>' + balance + '</span></div>' +
        rows +
        '<p style="color:var(--muted);font-size:12px;font-weight:700;margin-top:10px">' + esc(tr('Buying coins is available in the Duvela mobile app.', 'Покупка монет доступна в мобильном приложении Duvela.')) + '</p>';
    }

    async function loadChallenges() {
      try {
        const { data } = await supa.from('challenges')
          .select('id,title,target_level,exam_type,started_at,ends_at,daily_min_dialogs,daily_min_words,daily_min_writing,daily_min_listening_min,daily_min_live_min,cover_url')
          .order('created_at', { ascending: false }).limit(20);
        state.challenges = data || [];
        const { data: mine } = await supa.from('challenge_participants').select('challenge_id').eq('user_id', ctx.user.id);
        state.myChallengeIds = new Set((mine || []).map((item) => item.challenge_id));
      } catch (error) {
        console.warn('challenges load failed', error);
      }
    }

    function challengesHtml() {
      if (!state.challenges.length) return '';
      return '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Challenges', 'Челленджи')) + '</h2></div>' +
        state.challenges.map((challenge) => {
          const joined = state.myChallengeIds.has(challenge.id);
          return '<div class="card row" data-challenge="' + esc(challenge.id) + '" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer"><div><h3>' + esc(challenge.title) + '</h3><p>' + esc([challenge.target_level, challenge.exam_type, challenge.ends_at ? tr('until ', 'до ') + formatDate(challenge.ends_at) : ''].filter(Boolean).join(' · ')) + '</p></div><span class="tag ' + (joined ? 'teal' : '') + '">' + esc(joined ? tr('Joined', 'Участвую') : tr('Open', 'Открыть')) + '</span></div>';
        }).join('');
    }

    async function openChallenge(id) {
      const challenge = state.challenges.find((item) => item.id === id);
      if (!challenge) return;
      $('#challengeOverlayTitle').textContent = challenge.title;
      const body = $('#challengeOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      $('#challengeOverlay').classList.add('open');
      const joined = state.myChallengeIds.has(id);
      let todayProgress = null;
      if (joined) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const { data } = await supa.from('challenge_progress').select('*').eq('challenge_id', id).eq('user_id', ctx.user.id).eq('day', today).maybeSingle();
          todayProgress = data;
        } catch (error) {
          /* optional */
        }
      }
      body.innerHTML =
        '<p style="font-weight:700;color:var(--soft)">' + esc([challenge.target_level, challenge.exam_type, challenge.ends_at ? tr('until ', 'до ') + formatDate(challenge.ends_at) : ''].filter(Boolean).join(' · ')) + '</p>' +
        '<div style="margin:10px 0;display:flex;gap:6px;flex-wrap:wrap">' + CHALLENGE_GOALS.filter((goal) => Number(challenge[goal[0]]) > 0).map((goal) => '<span class="tag">' + esc(tr(goal[2][0], goal[2][1])) + ': ' + challenge[goal[0]] + '</span>').join('') + '</div>' +
        (joined
          ? '<h3 style="font-size:15px;margin:12px 0 6px">' + esc(tr("Today's progress", 'Прогресс за сегодня')) + '</h3>' +
            '<div class="form-grid">' + CHALLENGE_GOALS.map((goal) => '<div class="field"><label>' + esc(tr(goal[2][0], goal[2][1])) + (Number(challenge[goal[0]]) > 0 ? ' / ' + challenge[goal[0]] : '') + '</label><input id="cg-' + goal[1] + '" type="number" min="0" value="' + ((todayProgress && todayProgress[goal[1]]) || 0) + '"></div>').join('') + '</div>' +
            '<button class="btn primary" data-save-challenge="' + esc(id) + '" style="margin-top:10px">' + esc(tr('Save progress', 'Сохранить прогресс')) + '</button>'
          : '<button class="btn primary" data-join-challenge="' + esc(id) + '" style="margin-top:8px">' + esc(tr('Join challenge', 'Участвовать')) + '</button>');
    }

    async function joinChallenge(id) {
      try {
        const { error } = await supa.from('challenge_participants').insert({ challenge_id: id, user_id: ctx.user.id, status: 'active' });
        if (error) throw error;
        state.myChallengeIds.add(id);
        openChallenge(id);
      } catch (error) {
        alert(error.message || tr('Could not join.', 'Не удалось присоединиться.'));
      }
    }

    async function saveChallengeProgress(id) {
      const today = new Date().toISOString().slice(0, 10);
      const row = { challenge_id: id, user_id: ctx.user.id, day: today };
      CHALLENGE_GOALS.forEach((goal) => {
        const el = $('#cg-' + goal[1]);
        row[goal[1]] = el ? Math.max(0, Number(el.value) || 0) : 0;
      });
      try {
        const { error } = await supa.from('challenge_progress').upsert(row, { onConflict: 'challenge_id,user_id,day' });
        if (error) throw error;
        $('#challengeOverlay').classList.remove('open');
        alert(tr('Progress saved ✓', 'Прогресс сохранён ✓'));
      } catch (error) {
        alert(error.message || tr('Could not save progress.', 'Не удалось сохранить прогресс.'));
      }
    }

    function openChallengeCreate() {
      if (!state.myOrg) {
        alert(tr('Create an organization first.', 'Сначала создайте организацию.'));
        return;
      }
      $('#challengeOverlayTitle').textContent = tr('New challenge', 'Новый челлендж');
      $('#challengeOverlayBody').innerHTML =
        '<form id="chCreateForm">' +
        '<div class="field"><label>' + esc(tr('Title', 'Название')) + '</label><input id="chTitle" maxlength="140" required></div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>' + esc(tr('Target level', 'Целевой уровень')) + '</label><input id="chLevel" placeholder="B1" maxlength="10"></div>' +
          '<div class="field"><label>' + esc(tr('Exam type', 'Тип экзамена')) + '</label><input id="chExam" maxlength="40"></div>' +
          '<div class="field"><label>' + esc(tr('Ends on', 'Дата окончания')) + '</label><input id="chEnds" type="date"></div>' +
          '<div class="field"><label>' + esc(tr('Daily dialogs', 'Диалогов в день')) + '</label><input id="chDialogs" type="number" min="0" value="0"></div>' +
          '<div class="field"><label>' + esc(tr('Daily words', 'Слов в день')) + '</label><input id="chWords" type="number" min="0" value="0"></div>' +
        '</div>' +
        '<button class="btn primary" type="submit" style="margin-top:10px">' + esc(tr('Create challenge', 'Создать челлендж')) + '</button>' +
        '</form>';
      $('#challengeOverlay').classList.add('open');
      $('#chCreateForm').addEventListener('submit', createChallenge);
    }

    async function createChallenge(event) {
      event.preventDefault();
      const title = $('#chTitle').value.trim();
      if (!title) return;
      try {
        const { error } = await supa.from('challenges').insert({
          organization_id: state.myOrg.id,
          created_by: ctx.user.id,
          title,
          target_level: $('#chLevel').value.trim() || null,
          exam_type: $('#chExam').value.trim() || null,
          started_at: new Date().toISOString().slice(0, 10),
          ends_at: $('#chEnds').value || null,
          daily_min_dialogs: Number($('#chDialogs').value) || 0,
          daily_min_words: Number($('#chWords').value) || 0
        });
        if (error) throw error;
        $('#challengeOverlay').classList.remove('open');
        await loadChallenges();
        alert(tr('Challenge created ✓', 'Челлендж создан ✓'));
      } catch (error) {
        alert(error.message || tr('Could not create the challenge.', 'Не удалось создать челлендж.'));
      }
    }

    return {
      challengesHtml,
      joinChallenge,
      loadChallenges,
      loadWallet,
      openChallenge,
      openChallengeCreate,
      saveChallengeProgress,
      walletHtml
    };
  }

  window.DuvelaAppGamification = { create: createGamificationFeature };
})();
