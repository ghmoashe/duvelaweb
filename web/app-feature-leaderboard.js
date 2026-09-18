(function () {
  function createLeaderboardFeature(ctx) {
    const { $, tr, esc, supa, state, avatarInner } = ctx;

    const ROLE_CONFIG = {
      learner: {
        icon: '🎓',
        title: () => tr('Learner ranking', 'Рейтинг учеников'),
        plural: () => tr('Learners', 'Ученики'),
        empty: () => tr('No learners match these filters.', 'По этим фильтрам учеников пока нет.'),
        scopeLabel: () => tr('Studies', 'Изучает')
      },
      teacher: {
        icon: '✏️',
        title: () => tr('Teacher ranking', 'Рейтинг учителей'),
        plural: () => tr('Teachers', 'Учителя'),
        empty: () => tr('No teachers match these filters.', 'По этим фильтрам учителей пока нет.'),
        scopeLabel: () => tr('Teaches', 'Преподаёт')
      },
      organizer: {
        icon: '📅',
        title: () => tr('Organizer ranking', 'Рейтинг организаторов'),
        plural: () => tr('Organizers', 'Организаторы'),
        empty: () => tr('No organizers match these filters.', 'По этим фильтрам организаторов пока нет.'),
        scopeLabel: () => tr('Direction', 'Направление')
      },
      organization: {
        icon: '🏢',
        title: () => tr('Organization ranking', 'Рейтинг организаций'),
        plural: () => tr('Organizations', 'Организации'),
        empty: () => tr('No organizations match these filters.', 'По этим фильтрам организаций пока нет.'),
        scopeLabel: () => tr('Direction', 'Направление')
      }
    };

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

    function addTargets(list, targets) {
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

    function academyDirections() {
      const data = window.DuvelaOnboardingData || {};
      const list = [];
      listFrom(data.LANGUAGES).forEach((item) => addUnique(list, item));
      (Array.isArray(data.CATEGORIES) ? data.CATEGORIES : []).forEach((item) => addUnique(list, item && typeof item === 'object' ? item.label || item.id : item));
      Object.values(data.SUBCATEGORIES || {}).forEach((items) => listFrom(items).forEach((item) => addUnique(list, item)));
      return list;
    }

    function looksOrganization(row) {
      if (row?.last_web_role === 'organization') return true;
      const targets = Array.isArray(row?.learning_targets) ? row.learning_targets : [];
      return targets.some((target) => target && typeof target === 'object' && (target.organization_type || Array.isArray(target.audience)));
    }

    function roleOf(row) {
      if (row?.is_teacher) return 'teacher';
      if (row?.is_organizer) return looksOrganization(row) ? 'organization' : 'organizer';
      return 'learner';
    }

    function rowDirections(row, role) {
      const list = [];
      if (role === 'teacher') listFrom(row?.teaches_languages).forEach((item) => addUnique(list, item));
      listFrom(row?.learning_languages).forEach((item) => addUnique(list, item));
      addTargets(list, row?.learning_targets);
      listFrom(row?.specialization).forEach((item) => addUnique(list, item));
      return list;
    }

    function preferredRole() {
      if (!state.rankRole) {
        if (['teacher', 'organizer', 'organization'].includes(ctx.role)) state.rankRole = ctx.role;
        else state.rankRole = 'learner';
      }
      return ROLE_CONFIG[state.rankRole] ? state.rankRole : 'learner';
    }

    function profilePreferredDirection(allDirections) {
      const role = preferredRole();
      const mine = rowDirections(ctx.profile || {}, role);
      return mine.find((item) => allDirections.some((dir) => dir.toLowerCase() === item.toLowerCase())) || '';
    }

    function optionHtml(items, selected, allLabel) {
      return (allLabel ? '<option value="">' + esc(allLabel) + '</option>' : '') + items.map((item) =>
        '<option value="' + esc(item) + '"' + (String(selected).toLowerCase() === item.toLowerCase() ? ' selected' : '') + '>' + esc(item) + '</option>'
      ).join('');
    }

    function xp(row) {
      return Number(row?.score || 0);
    }

    function displayName(row) {
      const role = ROLE_CONFIG[roleOf(row)] || ROLE_CONFIG.learner;
      return row?.full_name || tr('Duvela profile', 'Профиль Duvela') + ' · ' + role.plural();
    }

    function directionLabel(row, role, fallback) {
      return rowDirections(row, role)[0] || fallback || tr('Academy direction', 'Направление Academy');
    }

    function matchesDirection(row, role, direction) {
      const wanted = String(direction || '').trim().toLowerCase();
      if (!wanted) return true;
      return rowDirections(row, role).some((item) => item.toLowerCase() === wanted);
    }

    function matchesFilters(row, role, filters) {
      if (roleOf(row) !== role) return false;
      if (!matchesDirection(row, role, filters.direction)) return false;
      if (filters.level && String(row?.language_level || '').toLowerCase() !== filters.level.toLowerCase()) return false;
      if (filters.city && String(row?.city || '').toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.search) {
        const haystack = [row?.full_name, row?.city, row?.country, row?.bio].concat(rowDirections(row, role)).join(' ').toLowerCase();
        if (!haystack.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    }

    function rankRows(rows) {
      return rows.slice().sort((a, b) => xp(b) - xp(a));
    }

    function tabsHtml(activeRole) {
      return '<div class="student-rank-tabs">' + Object.entries(ROLE_CONFIG).map(([role, config]) =>
        '<button type="button" data-rank-role="' + role + '" class="' + (role === activeRole ? 'active' : '') + '"><span>' + config.icon + '</span><b>' + esc(config.plural()) + '</b></button>'
      ).join('') + '</div>';
    }

    function heroHtml(activeRole, directions, cities, filters) {
      const config = ROLE_CONFIG[activeRole];
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
      return tabsHtml(activeRole) + '<div class="student-rank-hero">' +
        '<div class="student-rank-title"><span>' + esc(tr('Rankings', '\u0420\u0435\u0439\u0442\u0438\u043d\u0433\u0438')) + '</span><h2>' + esc(config.title()) + '</h2><p>' + esc(tr('Compare learner, teacher, organizer and organization results in one Academy leaderboard.', '\u0421\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u0439\u0442\u0435 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u0443\u0447\u0435\u043d\u0438\u043a\u043e\u0432, \u0443\u0447\u0438\u0442\u0435\u043b\u0435\u0439, \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0442\u043e\u0440\u043e\u0432 \u0438 \u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u0439.')) + '</p></div>' +
        '<div class="student-rank-trophy" aria-hidden="true">&#127942;</div>' +
        '<div class="student-rank-control rank-control-grid">' +
          '<label class="rank-search-field">' + esc(tr('Search', '\u041f\u043e\u0438\u0441\u043a')) + '<input id="rankSearch" class="role-select" value="' + esc(filters.search) + '" placeholder="' + esc(tr('Search by name...', '\u041f\u043e\u0438\u0441\u043a \u0443\u0447\u0435\u043d\u0438\u043a\u0430 \u043f\u043e \u0438\u043c\u0435\u043d\u0438...')) + '"></label>' +
          '<label>' + esc(tr('Direction', '\u041d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435')) + '<select id="rankDirection" class="role-select">' + optionHtml(directions, filters.direction, tr('All Academy directions', '\u0412\u0441\u0435 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f Academy')) + '</select></label>' +
          '<label>' + esc(tr('Level', '\u0423\u0440\u043e\u0432\u0435\u043d\u044c')) + '<select id="rankLevel" class="role-select">' + optionHtml(levels, filters.level, tr('All levels', '\u0412\u0441\u0435 \u0443\u0440\u043e\u0432\u043d\u0438')) + '</select></label>' +
          '<label>' + esc(tr('City', '\u0413\u043e\u0440\u043e\u0434')) + '<select id="rankCity" class="role-select">' + optionHtml(cities, filters.city, tr('All cities', '\u0412\u0441\u0435 \u0433\u043e\u0440\u043e\u0434\u0430')) + '</select></label>' +
          '<button class="btn ghost" id="studentRankRefresh" type="button">' + esc(tr('Refresh', '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c')) + '</button>' +
        '</div>' +
      '</div>';
    }

        function podiumHtml(rows) {
      const top = rows.slice(0, 3);
      if (!top.length) return '<div class="student-rank-empty">' + esc(tr('Nothing to show yet.', 'Пока нечего показать.')) + '</div>';
      const order = [top[1], top[0], top[2]].filter(Boolean);
      return '<div class="student-podium">' + order.map((row) => {
        const place = rows.findIndex((item) => item.id === row.id) + 1;
        return '<article class="student-podium-card place-' + place + '">' +
          '<span class="student-medal">' + (place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉') + '</span>' +
          '<div class="avatar">' + avatarInner(displayName(row), row.avatar_url) + '</div>' +
          '<b>' + esc(displayName(row)) + '</b>' +
          '<strong>' + xp(row).toLocaleString() + ' XP</strong>' +
        '</article>';
      }).join('') + '</div>';
    }

    function listHtml(rows, activeRole, direction) {
      const config = ROLE_CONFIG[activeRole];
      if (!rows.length) return '<div class="student-rank-empty">' + esc(config.empty()) + '</div>';
      return '<div class="student-rank-list">' + rows.map((row, index) => {
        const isMe = row.id === ctx.user.id;
        return '<article class="student-rank-row' + (isMe ? ' me' : '') + '">' +
          '<div class="student-rank-number">' + (index + 1) + '</div>' +
          '<div class="avatar">' + avatarInner(displayName(row), row.avatar_url) + '</div>' +
          '<div class="student-rank-person"><b>' + esc(displayName(row)) + '</b><span>' + esc(config.scopeLabel()) + ': ' + esc(directionLabel(row, activeRole, direction)) + '</span></div>' +
          '<div class="student-rank-score"><b>' + xp(row).toLocaleString() + '</b><span>XP</span></div>' +
          '<a class="btn ghost student-rank-profile" href="./profile.html?id=' + encodeURIComponent(row.id) + '">' + esc(tr('Profile', 'Профиль')) + '</a>' +
        '</article>';
      }).join('') + '</div>';
    }

    function sideHtml(rows, allRows, activeRole, filters) {
      const myIndex = rows.findIndex((row) => row.id === ctx.user.id);
      const myRank = myIndex >= 0 ? String(myIndex + 1) : '\u2014';
      const topScore = rows.length ? xp(rows[0]).toLocaleString() : '0';
      const avgScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + xp(row), 0) / rows.length).toLocaleString() : '0';
      const roleTotal = allRows.filter((row) => roleOf(row) === activeRole).length;
      const rankPercent = myIndex >= 0 && roleTotal ? Math.max(1, Math.ceil(((myIndex + 1) / roleTotal) * 100)) : null;
      return '<div class="student-rank-stat rank-progress"><span>' + esc(tr('Your rank', '\u0412\u0430\u0448 \u0440\u0430\u043d\u0433')) + '</span><b>' + esc(myRank) + ' / ' + roleTotal.toLocaleString() + '</b><em>' + esc(rankPercent ? 'Top ' + rankPercent + '%' : '—') + '</em><i></i><p>' + esc(rankPercent ? tr('Calculated from current ranking data.', '\u0420\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043d\u043e \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c \u0434\u0430\u043d\u043d\u044b\u043c \u0440\u0435\u0439\u0442\u0438\u043d\u0433\u0430.') : tr('No personal rank in this filter yet.', '\u0412 \u044d\u0442\u043e\u043c \u0444\u0438\u043b\u044c\u0442\u0440\u0435 \u043b\u0438\u0447\u043d\u043e\u0433\u043e \u0440\u0430\u043d\u0433\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442.')) + '</p></div>' +
        '<div class="student-rank-stat"><span>' + esc(tr('Shown now', '\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e \u0441\u0435\u0439\u0447\u0430\u0441')) + '</span><b>' + rows.length.toLocaleString() + '</b><p>' + esc(tr('Records after filters.', '\u0417\u0430\u043f\u0438\u0441\u0435\u0439 \u043f\u043e\u0441\u043b\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u043e\u0432.')) + '</p></div>' +
        '<div class="student-rank-stat"><span>' + esc(tr('Top score', '\u041b\u0443\u0447\u0448\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442')) + '</span><b>' + topScore + ' XP</b><p>' + esc(tr('Average result', '\u0421\u0440\u0435\u0434\u043d\u0438\u0439 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442')) + ': ' + avgScore + ' XP</p></div>' +
        '<div class="student-rank-stat"><span>' + esc(tr('Activity trend', '\u0422\u0440\u0435\u043d\u0434 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438')) + '</span><b>—</b><p>' + esc(tr('Weekly comparison is not connected yet.', '\u0421\u0440\u0430\u0432\u043d\u0435\u043d\u0438\u0435 \u0437\u0430 \u043d\u0435\u0434\u0435\u043b\u044e \u0435\u0449\u0435 \u043d\u0435 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043e.')) + '</p></div>' +
        '<div class="student-rank-note"><b>' + esc(tr('How Academy ranking works', '\u041a\u0430\u043a \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442 \u0440\u0435\u0439\u0442\u0438\u043d\u0433 Academy?')) + '</b><p>' + esc(tr('XP comes from tasks, lessons and platform activity. Use filters to compare results by role, direction, level and city.', '\u0412 \u0440\u0435\u0439\u0442\u0438\u043d\u0433 \u043f\u043e\u043f\u0430\u0434\u0430\u044e\u0442 \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u0438 \u043f\u043e XP \u0437\u0430 \u0437\u0430\u0434\u0430\u043d\u0438\u044f, \u0443\u0440\u043e\u043a\u0438 \u0438 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c \u0432 \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435. \u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 \u0444\u0438\u043b\u044c\u0442\u0440\u044b, \u0447\u0442\u043e\u0431\u044b \u0441\u0440\u0430\u0432\u043d\u0438\u0432\u0430\u0442\u044c \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442\u044b \u043f\u043e \u0440\u043e\u043b\u044f\u043c, \u0443\u0440\u043e\u0432\u043d\u044f\u043c \u0438 \u0433\u043e\u0440\u043e\u0434\u0430\u043c.')) + '</p><button class="btn ghost" type="button">' + esc(tr('Continue learning', '\u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u043e\u0431\u0443\u0447\u0435\u043d\u0438\u0435')) + ' \u2192</button></div>';
    }

        function collectFilters(allRows, activeRole) {
      const directions = academyDirections();
      allRows.forEach((row) => rowDirections(row, roleOf(row)).forEach((item) => addUnique(directions, item)));
      const preferred = profilePreferredDirection(directions);
      if (state.rankDirection == null) state.rankDirection = preferred;
      const cities = [];
      allRows.filter((row) => roleOf(row) === activeRole).forEach((row) => addUnique(cities, row.city));
      cities.sort((a, b) => a.localeCompare(b));
      directions.sort((a, b) => a.localeCompare(b));
      return {
        directions,
        cities,
        filters: {
          direction: state.rankDirection || '',
          level: state.rankLevel || '',
          city: state.rankCity || '',
          search: state.rankSearch || ''
        }
      };
    }

    function bindControls() {
      const roleButtons = Array.from(document.querySelectorAll('[data-rank-role]'));
      roleButtons.forEach((button) => button.addEventListener('click', () => {
        state.rankRole = button.dataset.rankRole;
        state.rankDirection = '';
        state.rankLevel = '';
        state.rankCity = '';
        renderLeaderboardPage();
      }));
      const direction = $('#rankDirection');
      const level = $('#rankLevel');
      const city = $('#rankCity');
      const search = $('#rankSearch');
      if (direction) direction.addEventListener('change', () => { state.rankDirection = direction.value; renderLeaderboardPage(); });
      if (level) level.addEventListener('change', () => { state.rankLevel = level.value; renderLeaderboardPage(); });
      if (city) city.addEventListener('change', () => { state.rankCity = city.value; renderLeaderboardPage(); });
      if (search) search.addEventListener('input', () => {
        clearTimeout(state.rankSearchTimer);
        state.rankSearchTimer = setTimeout(() => { state.rankSearch = search.value.trim(); renderLeaderboardPage(); }, 250);
      });
      const refresh = $('#studentRankRefresh');
      if (refresh) refresh.addEventListener('click', renderLeaderboardPage);
    }

    function renderPageFrame(allRows) {
      const activeRole = preferredRole();
      const { directions, cities, filters } = collectFilters(allRows, activeRole);
      const rows = rankRows(allRows.filter((row) => matchesFilters(row, activeRole, filters)));
      const page = $('#studentLeaderboardPage');
      page.innerHTML =
        heroHtml(activeRole, directions, cities, filters) +
        '<div class="student-rank-grid">' +
          '<section class="student-rank-card student-rank-main">' +
            '<div class="student-rank-section-head"><div><h3>' + esc(ROLE_CONFIG[activeRole].title()) + '</h3><p>' + esc(filters.direction || tr('All Academy directions', '\u0412\u0441\u0435 \u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u044f Academy')) + '</p></div><span>' + esc(tr('Showing top by earned XP', '\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u043c \u0442\u043e\u043f \u043f\u043e \u043d\u0430\u0447\u0438\u0441\u043b\u0435\u043d\u043d\u044b\u043c XP')) + '</span></div>' +
            podiumHtml(rows) +
            listHtml(rows, activeRole, filters.direction) +
          '</section>' +
          '<aside class="student-rank-card student-rank-side">' + sideHtml(rows, allRows, activeRole, filters) + '</aside>' +
        '</div>';
      bindControls();
    }

    async function loadRows() {
      const { data, error } = await supa.from('profiles')
        .select('id,full_name,avatar_url,score,is_teacher,is_organizer,is_verified,last_web_role,learning_languages,teaches_languages,learning_targets,language_level,city,country,bio,specialization')
        .order('score', { ascending: false })
        .limit(800);
      if (error) {
        const fallback = await supa.from('profiles')
          .select('id,full_name,avatar_url,score,is_teacher,is_organizer,is_verified,learning_languages,teaches_languages,learning_targets,language_level,city,country,bio,specialization')
          .order('score', { ascending: false })
          .limit(800);
        if (fallback.error) throw fallback.error;
        return fallback.data || [];
      }
      return data || [];
    }

    async function renderLeaderboardPage() {
      const page = $('#studentLeaderboardPage');
      if (!page) return;
      page.innerHTML =
        '<div class="student-rank-hero"><div><span>' + esc(tr('Academy rankings', 'Рейтинги Academy')) + '</span><h2>' + esc(tr('Loading rankings...', 'Загружаем рейтинги...')) + '</h2><p>' + esc(tr('Preparing role lists and dynamic Academy filters.', 'Готовим списки ролей и динамические фильтры Academy.')) + '</p></div></div>';
      try {
        const rows = await loadRows();
        renderPageFrame(rows);
      } catch (error) {
        page.innerHTML = '<div class="student-rank-empty">' + esc(tr('Could not load rankings.', 'Не удалось загрузить рейтинги.')) + '</div>';
      }
    }

    return { renderLeaderboardPage };
  }

  window.DuvelaAppLeaderboard = { create: createLeaderboardFeature };
})();
