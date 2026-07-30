(function () {
  function createLeaderboardFeature(ctx) {
    const { $, tr, esc, supa, state, avatarInner } = ctx;

    function listFrom(value) {
      if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
      if (value == null) return [];
      return String(value).split(',').map((item) => item.trim()).filter(Boolean);
    }

    function addUnique(list, value) {
      const text = String(value || '').trim();
      if (!text) return;
      if (!list.some((item) => item.toLowerCase() === text.toLowerCase())) list.push(text);
    }

    function addTargetScopes(list, targets) {
      if (!Array.isArray(targets)) {
        listFrom(targets).forEach((item) => addUnique(list, item));
        return;
      }
      targets.forEach((target) => {
        if (!target || typeof target !== 'object') return;
        addUnique(list, target.language);
        listFrom(target.languages).forEach((item) => addUnique(list, item));
        listFrom(target.subcategories).forEach((item) => addUnique(list, item));
        addUnique(list, target.category);
      });
    }

    function profileScopes(profile) {
      const scopes = [];
      if (ctx.role === 'teacher') {
        listFrom(profile?.teaches_languages).forEach((item) => addUnique(scopes, item));
      } else {
        listFrom(profile?.learning_languages).forEach((item) => addUnique(scopes, item));
      }
      listFrom(profile?.learning_languages).forEach((item) => addUnique(scopes, item));
      addTargetScopes(scopes, profile?.learning_targets);
      listFrom(profile?.specialization).forEach((item) => addUnique(scopes, item));
      return scopes;
    }

    function learnerScopes(profile) {
      const scopes = [];
      listFrom(profile?.learning_languages).forEach((item) => addUnique(scopes, item));
      addTargetScopes(scopes, profile?.learning_targets);
      return scopes;
    }

    function selectedScope(scopes) {
      if (!scopes.length) return '';
      if (!state.studentRankScope || !scopes.some((item) => item.toLowerCase() === String(state.studentRankScope).toLowerCase())) {
        state.studentRankScope = scopes[0];
      }
      return state.studentRankScope;
    }

    function matchesScope(row, scope) {
      const wanted = String(scope || '').trim().toLowerCase();
      if (!wanted) return false;
      return learnerScopes(row).some((item) => item.toLowerCase() === wanted);
    }

    function xp(row) {
      return Number(row?.score || 0);
    }

    function initialsName(row) {
      return row?.full_name || tr('Duvela learner', 'Ученик Duvela');
    }

    function scopeOptionsHtml(scopes, active) {
      return scopes.map((scope) =>
        '<option value="' + esc(scope) + '"' + (scope.toLowerCase() === String(active).toLowerCase() ? ' selected' : '') + '>' + esc(scope) + '</option>'
      ).join('');
    }

    function podiumHtml(rows) {
      const top = rows.slice(0, 3);
      if (!top.length) return '<div class="student-rank-empty">' + esc(tr('No learners in this direction yet.', 'По этому направлению учеников пока нет.')) + '</div>';
      const order = [top[1], top[0], top[2]].filter(Boolean);
      return '<div class="student-podium">' + order.map((row) => {
        const place = rows.findIndex((item) => item.id === row.id) + 1;
        return '<article class="student-podium-card place-' + place + '">' +
          '<span class="student-medal">' + (place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉') + '</span>' +
          '<div class="avatar">' + avatarInner(initialsName(row), row.avatar_url) + '</div>' +
          '<b>' + esc(initialsName(row)) + '</b>' +
          '<strong>' + xp(row).toLocaleString() + ' XP</strong>' +
        '</article>';
      }).join('') + '</div>';
    }

    function listHtml(rows, activeScope) {
      if (!rows.length) return '<div class="student-rank-empty">' + esc(tr('No ranking data for this direction.', 'Нет данных рейтинга по этому направлению.')) + '</div>';
      return '<div class="student-rank-list">' + rows.map((row, index) => {
        const isMe = row.id === ctx.user.id;
        return '<article class="student-rank-row' + (isMe ? ' me' : '') + '">' +
          '<div class="student-rank-number">' + (index + 1) + '</div>' +
          '<div class="avatar">' + avatarInner(initialsName(row), row.avatar_url) + '</div>' +
          '<div class="student-rank-person"><b>' + esc(initialsName(row)) + '</b><span>' + esc(activeScope) + '</span></div>' +
          '<div class="student-rank-score"><b>' + xp(row).toLocaleString() + '</b><span>XP</span></div>' +
          '<a class="btn ghost student-rank-profile" href="./profile.html?id=' + encodeURIComponent(row.id) + '">' + esc(tr('Profile', 'Профиль')) + '</a>' +
        '</article>';
      }).join('') + '</div>';
    }

    function skeletonHtml(scopes, activeScope) {
      return '<div class="student-rank-hero">' +
        '<div><span>' + esc(tr('Student leaderboard', 'Рейтинг учеников')) + '</span><h2>' + esc(tr('Learners by your direction', 'Ученики по вашему направлению')) + '</h2><p>' + esc(tr('The list is strict: only learners studying the selected language or subject are counted.', 'Список строгий: считаются только ученики, которые изучают выбранный язык или предмет.')) + '</p></div>' +
        '<div class="student-rank-control"><label>' + esc(tr('Direction', 'Направление')) + '</label>' +
          (scopes.length ? '<select id="studentRankScope" class="role-select">' + scopeOptionsHtml(scopes, activeScope) + '</select>' : '<a class="btn" data-go="profile" href="#profile">' + esc(tr('Set direction in profile', 'Указать направление в профиле')) + '</a>') +
        '</div>' +
      '</div>' +
      '<div class="student-rank-grid">' +
        '<section class="student-rank-card student-rank-main"><div class="student-rank-loading">' + esc(tr('Loading ranking...', 'Загружаем рейтинг...')) + '</div></section>' +
        '<aside class="student-rank-card student-rank-side"><div class="student-rank-loading">' + esc(tr('Preparing stats...', 'Готовим статистику...')) + '</div></aside>' +
      '</div>';
    }

    function renderResults(rows, activeScope, totalAll) {
      const page = $('#studentLeaderboardPage');
      if (!page) return;
      const myIndex = rows.findIndex((row) => row.id === ctx.user.id);
      const myRank = myIndex >= 0 ? myIndex + 1 : null;
      const topScore = rows.length ? xp(rows[0]).toLocaleString() : '0';
      const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + xp(row), 0) / rows.length).toLocaleString() : '0';
      const main = page.querySelector('.student-rank-main');
      const side = page.querySelector('.student-rank-side');
      if (main) {
        main.innerHTML =
          '<div class="student-rank-section-head"><div><h3>' + esc(tr('Top learners', 'Топ учеников')) + '</h3><p>' + esc(activeScope) + '</p></div><button class="btn ghost" id="studentRankRefresh" type="button">' + esc(tr('Refresh', 'Обновить')) + '</button></div>' +
          podiumHtml(rows) +
          listHtml(rows, activeScope);
      }
      if (side) {
        side.innerHTML =
          '<div class="student-rank-stat"><span>' + esc(tr('Your rank', 'Ваш ранг')) + '</span><b>' + esc(myRank ? '#' + myRank : '—') + '</b><p>' + esc(myRank ? tr('Inside this direction only.', 'Только внутри этого направления.') : tr('You are not in this learner list.', 'Вас нет в этом списке учеников.')) + '</p></div>' +
          '<div class="student-rank-stat"><span>' + esc(tr('Learners here', 'Учеников здесь')) + '</span><b>' + rows.length.toLocaleString() + '</b><p>' + esc(tr('Matched by selected language or subject.', 'Совпали по выбранному языку или предмету.')) + '</p></div>' +
          '<div class="student-rank-stat"><span>' + esc(tr('Top score', 'Лучший результат')) + '</span><b>' + topScore + '</b><p>XP</p></div>' +
          '<div class="student-rank-note"><b>' + esc(tr('Strict logic', 'Строгая логика')) + '</b><p>' + esc(tr('Teachers, organizers and organizations are excluded from this page. They can use their direction to view matching learners.', 'Учителя, организаторы и организации исключены из списка. Они используют своё направление, чтобы видеть подходящих учеников.')) + '</p><span>' + esc(tr('Average XP: ', 'Средний XP: ') + avgScore + ' · ' + tr('All learners loaded: ', 'Всего загружено учеников: ') + totalAll.toLocaleString()) + '</span></div>';
      }
      const refresh = $('#studentRankRefresh');
      if (refresh) refresh.addEventListener('click', renderLeaderboardPage);
    }

    async function renderLeaderboardPage() {
      const page = $('#studentLeaderboardPage');
      if (!page) return;
      const scopes = profileScopes(ctx.profile || {});
      const activeScope = selectedScope(scopes);
      page.innerHTML = skeletonHtml(scopes, activeScope);
      const select = $('#studentRankScope');
      if (select) select.addEventListener('change', () => {
        state.studentRankScope = select.value;
        renderLeaderboardPage();
      });
      if (!activeScope) return;
      try {
        const { data, error } = await supa.from('profiles')
          .select('id,full_name,avatar_url,score,is_teacher,is_organizer,learning_languages,learning_targets')
          .or('is_teacher.is.null,is_teacher.eq.false')
          .or('is_organizer.is.null,is_organizer.eq.false')
          .order('score', { ascending: false })
          .limit(500);
        if (error) throw error;
        const allLearners = data || [];
        const rows = allLearners
          .filter((row) => !row?.is_teacher && !row?.is_organizer)
          .filter((row) => matchesScope(row, activeScope))
          .sort((a, b) => xp(b) - xp(a));
        renderResults(rows, activeScope, allLearners.length);
      } catch (error) {
        const main = $('#studentLeaderboardPage .student-rank-main');
        if (main) main.innerHTML = '<div class="student-rank-empty">' + esc(tr('Could not load student ranking.', 'Не удалось загрузить рейтинг учеников.')) + '</div>';
      }
    }

    return { renderLeaderboardPage };
  }

  window.DuvelaAppLeaderboard = { create: createLeaderboardFeature };
})();
