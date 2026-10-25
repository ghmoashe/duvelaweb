(function () {
  'use strict';

  function createChallenges4(ctx, actions) {
    const { $, tr, esc, supa, state, formatDate, alert } = ctx;
    const GOALS = [
      ['daily_min_dialogs', 'dialogs_done', 'Speaking dialogs', 'Разговорные диалоги', 'dialogs', 'диалогов'],
      ['daily_min_words', 'words_done', 'Vocabulary words', 'Новые слова', 'words', 'слов'],
      ['daily_min_writing', 'writing_done', 'Writing tasks', 'Письменные задания', 'tasks', 'заданий'],
      ['daily_min_listening_min', 'listening_min_done', 'Listening minutes', 'Минуты аудирования', 'listening min', 'мин. аудирования'],
      ['daily_min_live_min', 'live_min_done', 'LIVE minutes', 'Минуты LIVE', 'LIVE min', 'мин. LIVE']
    ];
    let filter = 'all', search = '', level = '', direction = '', layout = 'grid';
    let screen = 'library', selectedId = '', manageTab = 'overview';
    let details = blankDetails(false), metrics = blankMetrics(true, true), builder = null;
    let metricsRequest = 0, detailsRequest = 0;

    function blankDetails(loading) { return { loading, error: '', participants: [], progress: [], names: new Map() }; }
    function blankMetrics(loading, available) { return { loading, available, participants: new Map(), checkins: new Map(), completed: new Map(), participantTotal: 0, completedTotal: 0, rows: [] }; }

    const icon = (name) => {
      const paths = {
        plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/>',
        trophy: '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        pulse: '<path d="M3 12h4l2-7 4 14 2-7h6"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
        target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
        spark: '<path d="m12 3-1.3 4.2a5 5 0 0 1-3.5 3.5L3 12l4.2 1.3a5 5 0 0 1 3.5 3.5L12 21l1.3-4.2a5 5 0 0 1 3.5-3.5L21 12l-4.2-1.3a5 5 0 0 1-3.5-3.5L12 3Z"/>',
        chevron: '<path d="m9 18 6-6-6-6"/>', back: '<path d="m15 18-6-6 6-6"/>', edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>',
        check: '<path d="m5 12 4 4L19 6"/>', flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>'
      };
      return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (paths[name] || paths.target) + '</svg>';
    };

    const isoDay = (value) => value ? new Date(value).toISOString().slice(0, 10) : '';
    const statusOf = (item) => {
      const today = new Date().toISOString().slice(0, 10);
      if (item.ends_at && isoDay(item.ends_at) < today) return 'ended';
      if (item.started_at && isoDay(item.started_at) > today) return 'upcoming';
      return 'active';
    };
    const statusLabel = (status) => ({ active: tr('Active', 'Активен'), upcoming: tr('Scheduled', 'Запланирован'), ended: tr('Completed', 'Завершён') })[status];
    const selected = () => (state.challenges || []).find((item) => String(item.id) === String(selectedId));
    const owner = (item) => Boolean(item && ctx.user && String(item.created_by) === String(ctx.user.id));
    const enabledGoals = (item) => GOALS.filter((goal) => Number(item && item[goal[0]]) > 0);
    const rowComplete = (item, row) => { const goals = enabledGoals(item); return goals.length > 0 && goals.every((goal) => Number(row[goal[1]] || 0) >= Number(item[goal[0]] || 0)); };
    const goalItems = (item) => enabledGoals(item).map((goal) => [Number(item[goal[0]]), tr(goal[4], goal[5])]);
    const rowsFor = (id) => metrics.rows.filter((row) => String(row.challenge_id) === String(id));
    const metric = (value) => metrics.loading ? '<span class="ch4-metric-loading"></span>' : (metrics.available ? String(value) : '—');

    function visibleChallenges() {
      return (state.challenges || []).filter((item) => {
        const query = [item.title, item.target_level, item.exam_type].filter(Boolean).join(' ').toLowerCase();
        return (filter === 'all' || statusOf(item) === filter) && (!search || query.includes(search)) && (!level || item.target_level === level) && (!direction || item.exam_type === direction);
      });
    }

    function card(item) {
      const status = statusOf(item), goals = goalItems(item), remaining = item.ends_at ? Math.ceil((new Date(item.ends_at).setHours(23, 59, 59, 999) - Date.now()) / 86400000) : null;
      const cover = item.cover_url ? '<img src="' + esc(item.cover_url) + '" alt="">' : '<div class="ch4-cover-art"><span>DUVELA</span><i></i><b>' + esc((item.title || 'D').slice(0, 2).toUpperCase()) + '</b><em>' + icon('spark') + '</em></div>';
      return '<article class="ch4-card" data-ch4-card><div class="ch4-card-cover">' + cover + '<span class="ch4-status ' + status + '"><i></i>' + esc(statusLabel(status)) + '</span>' + (item.target_level ? '<span class="ch4-level">' + esc(item.target_level) + '</span>' : '') + '</div><div class="ch4-card-body"><div class="ch4-card-kicker">' + esc(item.exam_type || tr('Daily practice', 'Ежедневная практика')) + '</div><h3>' + esc(item.title || tr('Untitled challenge', 'Челлендж без названия')) + '</h3><div class="ch4-card-meta"><span>' + icon('calendar') + esc(item.ends_at ? formatDate(item.ends_at) : tr('No end date', 'Без даты окончания')) + '</span><span>' + icon('users') + metric(metrics.participants.get(String(item.id)) || 0) + ' ' + esc(tr('participants', 'участников')) + '</span></div><div class="ch4-goals">' + (goals.length ? goals.slice(0, 3).map((goal) => '<span><b>' + goal[0] + '</b> ' + esc(goal[1]) + '</span>').join('') : '<span>' + esc(tr('No tracked goals', 'Нет отслеживаемых целей')) + '</span>') + '</div><div class="ch4-card-foot"><div><small>' + esc(tr('Completed check-ins', 'Выполненные отметки')) + '</small><strong>' + metric(metrics.completed.get(String(item.id)) || 0) + ' / ' + metric(metrics.checkins.get(String(item.id)) || 0) + '</strong></div><button class="ch4-open" type="button" data-open-ch4="' + esc(item.id) + '">' + esc(tr('Manage', 'Управлять')) + icon('chevron') + '</button></div>' + (status === 'active' && remaining !== null && remaining >= 0 ? '<div class="ch4-timebar"><span style="width:' + Math.max(5, Math.min(100, 100 - remaining * 3)) + '%"></span><small>' + esc(remaining === 0 ? tr('Ends today', 'Завершается сегодня') : tr(remaining + ' days left', 'Осталось дней: ' + remaining)) + '</small></div>' : '') + '</div></article>';
    }

    function emptyState() {
      const filtered = search || level || direction || filter !== 'all';
      return '<div class="ch4-empty">' + icon('trophy') + '<h3>' + esc(filtered ? tr('Nothing matches these filters', 'По этим фильтрам ничего не найдено') : tr('Create your first challenge', 'Создайте первый челлендж')) + '</h3><p>' + esc(filtered ? tr('Change the search or filters.', 'Измените поиск или фильтры.') : tr('Set a clear daily goal and keep students engaged between lessons.', 'Задайте понятную ежедневную цель и поддерживайте активность учеников между уроками.')) + '</p>' + (filtered ? '<button class="ch4-secondary" data-ch4-reset>' + esc(tr('Reset filters', 'Сбросить фильтры')) + '</button>' : '<button class="ch4-primary" data-ch4-create>' + icon('plus') + esc(tr('Create challenge', 'Создать челлендж')) + '</button>') + '</div>';
    }

    function paintLibrary() {
      const root = $('#challengeList'); if (!root) return;
      const all = state.challenges || [], active = all.filter((item) => statusOf(item) === 'active'), upcoming = all.filter((item) => statusOf(item) === 'upcoming');
      const featured = active[0] || upcoming[0] || all[0], cards = visibleChallenges();
      const levels = [...new Set(all.map((item) => item.target_level).filter(Boolean))].sort(), directions = [...new Set(all.map((item) => item.exam_type).filter(Boolean))].sort();
      const featureRows = featured ? rowsFor(featured.id) : [], featureDone = featured ? featureRows.filter((row) => rowComplete(featured, row)).length : 0;
      root.innerHTML = '<div class="ch4-shell"><header class="ch4-header"><div><span class="ch4-eyebrow">' + icon('trophy') + 'DUVELA CHALLENGE STUDIO</span><h1>Challenge Studio</h1><p>' + esc(tr('Create focused learning sprints and keep every student moving.', 'Создавайте учебные спринты и поддерживайте движение каждого ученика к цели.')) + '</p></div><button class="ch4-primary" data-ch4-create>' + icon('plus') + esc(tr('Create challenge', 'Создать челлендж')) + '</button></header>' +
        '<section class="ch4-kpis"><article><i class="violet">' + icon('target') + '</i><div><strong>' + all.length + '</strong><span>' + esc(tr('Total challenges', 'Всего челленджей')) + '</span><small>' + esc(tr('All available programs', 'Все доступные программы')) + '</small></div></article><article><i class="green">' + icon('pulse') + '</i><div><strong>' + active.length + '</strong><span>' + esc(tr('Active challenges', 'Активные челленджи')) + '</span><small>' + esc(tr('Open for progress', 'Открыты для прогресса')) + '</small></div></article><article><i class="blue">' + icon('users') + '</i><div><strong>' + metric(metrics.participantTotal) + '</strong><span>' + esc(tr('Active participants', 'Активные участники')) + '</span><small>' + esc(tr('Real participant records', 'Реальные записи участников')) + '</small></div></article><article><i class="amber">' + icon('check') + '</i><div><strong>' + metric(metrics.completedTotal) + '</strong><span>' + esc(tr('Completed check-ins', 'Выполненные отметки')) + '</span><small>' + esc(tr('All enabled goals reached', 'Все цели выполнены')) + '</small></div></article></section>' +
        (featured ? '<section class="ch4-feature"><div class="ch4-feature-copy"><span class="ch4-feature-label">' + icon('spark') + esc(tr('Featured challenge', 'Главный челлендж')) + '</span><h2>' + esc(featured.title) + '</h2><p>' + esc(featured.exam_type || tr('A structured daily routine for consistent progress.', 'Понятный ежедневный ритм для стабильного прогресса.')) + '</p><div class="ch4-feature-facts"><span>' + icon('calendar') + esc(formatDate(featured.started_at)) + ' — ' + esc(formatDate(featured.ends_at)) + '</span><span>' + icon('users') + metric(metrics.participants.get(String(featured.id)) || 0) + ' ' + esc(tr('participants', 'участников')) + '</span><span>' + icon('check') + metric(featureDone) + ' / ' + metric(featureRows.length) + ' ' + esc(tr('completed check-ins', 'выполнено')) + '</span></div><button data-open-ch4="' + esc(featured.id) + '">' + esc(tr('Manage challenge', 'Управлять челленджем')) + icon('arrow') + '</button></div><div class="ch4-feature-goals"><span>' + esc(tr('DAILY GOALS', 'ЕЖЕДНЕВНЫЕ ЦЕЛИ')) + '</span>' + (goalItems(featured).length ? goalItems(featured).slice(0, 4).map((goal) => '<div><b>' + goal[0] + '</b><small>' + esc(goal[1]) + '</small></div>').join('') : '<p>' + esc(tr('No tracked goals configured.', 'Отслеживаемые цели не настроены.')) + '</p>') + '</div></section>' : '') +
        '<section class="ch4-workspace"><div class="ch4-section-title"><div><h2>' + esc(tr('Challenge library', 'Библиотека челленджей')) + '</h2><p>' + esc(tr('Manage active, scheduled and completed learning sprints.', 'Управляйте активными, запланированными и завершёнными спринтами.')) + '</p></div><span>' + cards.length + ' ' + esc(tr('shown', 'показано')) + '</span></div><div class="ch4-toolbar"><label>' + icon('search') + '<input type="search" data-ch4-search value="' + esc(search) + '" placeholder="' + esc(tr('Search challenges', 'Поиск челленджей')) + '"></label><div class="ch4-tabs">' + [['all', tr('All', 'Все')], ['active', tr('Active', 'Активные')], ['upcoming', tr('Scheduled', 'Запланированные')], ['ended', tr('Completed', 'Завершённые')]].map((tab) => '<button class="' + (filter === tab[0] ? 'active' : '') + '" data-ch4-filter="' + tab[0] + '">' + esc(tab[1]) + '<b>' + all.filter((item) => tab[0] === 'all' || statusOf(item) === tab[0]).length + '</b></button>').join('') + '</div><select data-ch4-direction aria-label="' + esc(tr('Language or exam', 'Язык или экзамен')) + '"><option value="">' + esc(tr('All languages', 'Все языки')) + '</option>' + directions.map((item) => '<option value="' + esc(item) + '"' + (direction === item ? ' selected' : '') + '>' + esc(item) + '</option>').join('') + '</select><select data-ch4-level aria-label="' + esc(tr('Filter by level', 'Фильтр по уровню')) + '"><option value="">' + esc(tr('All levels', 'Все уровни')) + '</option>' + levels.map((item) => '<option value="' + esc(item) + '"' + (level === item ? ' selected' : '') + '>' + esc(item) + '</option>').join('') + '</select><div class="ch4-view-switch"><button class="' + (layout === 'grid' ? 'active' : '') + '" data-ch4-view="grid" aria-label="Grid">' + icon('grid') + '</button><button class="' + (layout === 'list' ? 'active' : '') + '" data-ch4-view="list" aria-label="List">' + icon('list') + '</button></div></div>' + (cards.length ? '<div class="ch4-grid ' + (layout === 'list' ? 'is-list' : '') + '">' + cards.map(card).join('') + '</div>' : emptyState()) + '</section></div>';
      bindLibrary();
    }

    function bindLibrary() {
      const root = $('#challengeList');
      root.querySelectorAll('[data-ch4-create]').forEach((button) => { button.onclick = () => openBuilder(); });
      root.querySelectorAll('[data-open-ch4]').forEach((button) => { button.onclick = () => openManagement(button.dataset.openCh4); });
      root.querySelectorAll('[data-ch4-filter]').forEach((button) => { button.onclick = () => { filter = button.dataset.ch4Filter; paint(); }; });
      root.querySelectorAll('[data-ch4-view]').forEach((button) => { button.onclick = () => { layout = button.dataset.ch4View; paint(); }; });
      const input = root.querySelector('[data-ch4-search]');
      if (input) input.oninput = () => { search = input.value.trim().toLowerCase(); paint(); requestAnimationFrame(() => { const next = root.querySelector('[data-ch4-search]'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); } }); };
      root.querySelector('[data-ch4-level]')?.addEventListener('change', (event) => { level = event.target.value; paint(); });
      root.querySelector('[data-ch4-direction]')?.addEventListener('change', (event) => { direction = event.target.value; paint(); });
      root.querySelector('[data-ch4-reset]')?.addEventListener('click', () => { filter = 'all'; search = ''; level = ''; direction = ''; paint(); });
    }

    function summary(item) {
      const complete = details.progress.filter((row) => rowComplete(item, row)).length, rate = details.progress.length ? Math.round(complete / details.progress.length * 100) : 0;
      return '<section class="ch4-manage-stats"><article><span>' + esc(tr('Participants', 'Участники')) + '</span><strong>' + details.participants.length + '</strong><small>' + esc(tr('Non-cancelled records', 'Активные записи')) + '</small></article><article><span>' + esc(tr('Check-ins', 'Отметки')) + '</span><strong>' + details.progress.length + '</strong><small>' + esc(tr('Recorded daily updates', 'Сохранённые отчёты')) + '</small></article><article><span>' + esc(tr('Completed', 'Выполнено')) + '</span><strong>' + complete + '</strong><small>' + esc(tr('All daily goals reached', 'Все дневные цели выполнены')) + '</small></article><article><span>' + esc(tr('Completion rate', 'Доля выполнения')) + '</span><strong>' + rate + '%</strong><small>' + esc(tr('Across recorded check-ins', 'Среди сохранённых отметок')) + '</small></article></section>';
    }

    function overview(item) {
      return '<div class="ch4-overview-grid"><section><div class="ch4-panel-head"><div><h2>' + esc(tr('Challenge overview', 'Обзор челленджа')) + '</h2><p>' + esc(tr('Current configuration and real activity.', 'Текущие настройки и реальная активность.')) + '</p></div></div><div class="ch4-facts"><div><span>' + esc(tr('Status', 'Статус')) + '</span><b>' + esc(statusLabel(statusOf(item))) + '</b></div><div><span>' + esc(tr('Level', 'Уровень')) + '</span><b>' + esc(item.target_level || '—') + '</b></div><div><span>' + esc(tr('Language / exam', 'Язык / экзамен')) + '</span><b>' + esc(item.exam_type || '—') + '</b></div><div><span>' + esc(tr('Duration', 'Период')) + '</span><b>' + esc(formatDate(item.started_at)) + ' — ' + esc(formatDate(item.ends_at)) + '</b></div></div></section><aside><span class="ch4-cap-title">' + esc(tr('Learning integrations', 'Учебные интеграции')) + '</span>' + capability('ready', 'check', tr('Student check-ins', 'Отметки учеников'), tr('Connected to challenge_progress', 'Подключено к challenge_progress')) + capability('planned', 'link', tr('Courses and AI Exercises', 'Курсы и AI Exercises'), tr('Planned · no challenge link in the current schema', 'Запланировано · в схеме пока нет связи')) + capability('planned', 'flag', tr('Badges and certificates', 'Значки и сертификаты'), tr('Planned · no server validation service yet', 'Запланировано · нет серверной проверки')) + '</aside></div>';
    }
    function capability(kind, glyph, title, note) { return '<div class="ch4-capability ' + kind + '">' + icon(glyph) + '<div><b>' + esc(title) + '</b><small>' + esc(note) + '</small></div></div>'; }

    function goals(item) {
      const active = enabledGoals(item);
      return '<div class="ch4-panel-head"><div><h2>' + esc(tr('Daily learning goals', 'Ежедневные учебные цели')) + '</h2><p>' + esc(tr('Only goal types backed by real check-in fields are active.', 'Активны только цели с реальными полями отметок.')) + '</p></div>' + (owner(item) ? '<button class="ch4-secondary" data-ch4-edit>' + icon('edit') + esc(tr('Edit goals', 'Изменить цели')) + '</button>' : '') + '</div><div class="ch4-goal-cards">' + (active.length ? active.map((goal) => '<article><i>' + icon('target') + '</i><span>' + esc(tr(goal[2], goal[3])) + '</span><strong>' + Number(item[goal[0]]) + '</strong><small>' + esc(tr('Daily target', 'Цель на день')) + '</small></article>').join('') : '<div class="ch4-manage-empty"><h3>' + esc(tr('No daily goals configured', 'Ежедневные цели не настроены')) + '</h3></div>') + '</div><div class="ch4-planned-row"><span><b>' + esc(tr('Reading tasks', 'Задания по чтению')) + '</b><small>' + esc(tr('Planned · tracking service required', 'Запланировано · нужен сервис отслеживания')) + '</small></span><span><b>' + esc(tr('Quizzes and exercises', 'Тесты и упражнения')) + '</b><small>' + esc(tr('Planned · course integration required', 'Запланировано · нужна связь с курсами')) + '</small></span></div>';
    }

    function participants(item) {
      if (!details.participants.length) return manageEmpty('users', tr('No participants yet', 'Участников пока нет'), tr('Participant records will appear after enrollment.', 'Записи появятся после присоединения учеников.'));
      return '<div class="ch4-table"><div class="ch4-table-head"><span>' + esc(tr('Student', 'Ученик')) + '</span><span>' + esc(tr('Status', 'Статус')) + '</span><span>' + esc(tr('Check-ins', 'Отметки')) + '</span><span>' + esc(tr('Completed', 'Выполнено')) + '</span></div>' + details.participants.map((person) => {
        const rows = details.progress.filter((row) => String(row.user_id) === String(person.user_id)), name = details.names.get(String(person.user_id)) || tr('Duvela learner', 'Ученик Duvela');
        return '<div class="ch4-table-row"><span><i class="ch4-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</i><b>' + esc(name) + '</b></span><span><em class="ch4-pill green">' + esc(person.status || tr('Active', 'Активен')) + '</em></span><span>' + rows.length + '</span><span>' + rows.filter((row) => rowComplete(item, row)).length + '</span></div>';
      }).join('') + '</div>';
    }

    function progress(item) {
      const rows = details.progress.slice().sort((a, b) => String(b.day).localeCompare(String(a.day)));
      if (!rows.length) return manageEmpty('pulse', tr('No progress check-ins yet', 'Отметок прогресса пока нет'), tr('Student updates will appear here with their recorded values.', 'Здесь появятся сохранённые значения учеников.'));
      return '<div class="ch4-progress-list">' + rows.slice(0, 50).map((row) => {
        const name = details.names.get(String(row.user_id)) || tr('Duvela learner', 'Ученик Duvela'), values = enabledGoals(item).map((goal) => tr(goal[4], goal[5]) + ': ' + Number(row[goal[1]] || 0) + '/' + Number(item[goal[0]])).join(' · ');
        return '<article><div><i class="ch4-avatar">' + esc(name.slice(0, 1).toUpperCase()) + '</i><span><b>' + esc(name) + '</b><small>' + esc(formatDate(row.day)) + '</small></span></div><p>' + esc(values || tr('No tracked values', 'Нет отслеживаемых значений')) + '</p><em class="ch4-pill ' + (rowComplete(item, row) ? 'green' : '') + '">' + esc(rowComplete(item, row) ? tr('Complete', 'Выполнено') : tr('In progress', 'В процессе')) + '</em></article>';
      }).join('') + '</div>';
    }

    function leaderboard(item) {
      const leaders = details.participants.map((person) => { const rows = details.progress.filter((row) => String(row.user_id) === String(person.user_id)); return { name: details.names.get(String(person.user_id)) || tr('Duvela learner', 'Ученик Duvela'), complete: rows.filter((row) => rowComplete(item, row)).length, checkins: rows.length }; }).sort((a, b) => b.complete - a.complete || b.checkins - a.checkins);
      return '<div class="ch4-fair-note">' + icon('lock') + '<div><b>' + esc(tr('Fair ranking', 'Честный рейтинг')) + '</b><p>' + esc(tr('Ranking uses completed daily check-ins, then total check-ins. It does not invent XP or expose private activity details.', 'Рейтинг учитывает выполненные дневные отметки, затем общее число отметок. XP не выдумывается, частные данные не раскрываются.')) + '</p></div></div>' + (leaders.length ? '<div class="ch4-leaderboard">' + leaders.map((row, index) => '<article><strong>#' + (index + 1) + '</strong><i class="ch4-avatar">' + esc(row.name.slice(0, 1).toUpperCase()) + '</i><span><b>' + esc(row.name) + '</b><small>' + row.checkins + ' ' + esc(tr('check-ins', 'отметок')) + '</small></span><em>' + row.complete + ' ' + esc(tr('completed', 'выполнено')) + '</em></article>').join('') + '</div>' : manageEmpty('trophy', tr('Leaderboard is empty', 'Рейтинг пока пуст'), ''));
    }

    function settings(item) {
      return '<div class="ch4-settings-card"><div>' + icon('lock') + '<h2>' + esc(tr('Challenge settings', 'Настройки челленджа')) + '</h2><p>' + esc(owner(item) ? tr('Edit supported fields through the guided builder. IDs and participant records remain unchanged.', 'Изменяйте поддерживаемые поля через конструктор. ID и записи участников сохраняются.') : tr('This challenge is read-only because another teacher created it.', 'Этот челлендж доступен только для просмотра, потому что создан другим преподавателем.')) + '</p></div>' + (owner(item) ? '<button class="ch4-primary" data-ch4-edit>' + icon('edit') + esc(tr('Edit challenge', 'Редактировать челлендж')) + '</button>' : '') + '</div>';
    }
    function manageEmpty(glyph, title, note) { return '<div class="ch4-manage-empty">' + icon(glyph) + '<h3>' + esc(title) + '</h3>' + (note ? '<p>' + esc(note) + '</p>' : '') + '</div>'; }

    function manageBody(item) {
      if (details.loading) return '<div class="ch4-manage-empty"><span class="ch4-loader"></span><h3>' + esc(tr('Loading challenge data…', 'Загрузка данных челленджа…')) + '</h3></div>';
      if (details.error) return '<div class="ch4-manage-empty error"><h3>' + esc(tr('Could not load challenge data', 'Не удалось загрузить данные')) + '</h3><p>' + esc(details.error) + '</p><button class="ch4-secondary" data-ch4-retry>' + esc(tr('Try again', 'Повторить')) + '</button></div>';
      return ({ overview: overview, goals, participants, progress, leaderboard, settings }[manageTab] || overview)(item);
    }

    function paintManagement() {
      const root = $('#challengeList'), item = selected();
      if (!root || !item) { screen = 'library'; paintLibrary(); return; }
      const tabs = [['overview', tr('Overview', 'Обзор')], ['goals', tr('Daily Goals', 'Дневные цели')], ['participants', tr('Participants', 'Участники')], ['progress', tr('Progress', 'Прогресс')], ['leaderboard', tr('Leaderboard', 'Рейтинг')], ['settings', tr('Settings', 'Настройки')]];
      root.innerHTML = '<div class="ch4-shell ch4-manage"><button class="ch4-back" data-ch4-back>' + icon('back') + esc(tr('Back to challenges', 'Назад к челленджам')) + '</button><header class="ch4-manage-hero"><div><span class="ch4-status ' + statusOf(item) + '"><i></i>' + esc(statusLabel(statusOf(item))) + '</span><h1>' + esc(item.title) + '</h1><p>' + esc(item.exam_type || tr('Daily learning challenge', 'Ежедневный учебный челлендж')) + ' · ' + esc(item.target_level || tr('Any level', 'Любой уровень')) + '</p></div><div>' + (owner(item) ? '<button class="ch4-secondary" data-ch4-edit>' + icon('edit') + esc(tr('Edit', 'Редактировать')) + '</button>' : '') + '<button class="ch4-primary" data-ch4-preview>' + esc(tr('Preview learner view', 'Просмотр для ученика')) + '</button></div></header>' + (!details.loading && !details.error ? summary(item) : '') + '<nav class="ch4-manage-tabs">' + tabs.map((tab) => '<button class="' + (manageTab === tab[0] ? 'active' : '') + '" data-ch4-manage-tab="' + tab[0] + '">' + esc(tab[1]) + '</button>').join('') + '</nav><section class="ch4-manage-body">' + manageBody(item) + '</section></div>';
      root.querySelector('[data-ch4-back]').onclick = () => { screen = 'library'; selectedId = ''; paint(); };
      root.querySelectorAll('[data-ch4-manage-tab]').forEach((button) => { button.onclick = () => { manageTab = button.dataset.ch4ManageTab; paintManagement(); }; });
      root.querySelectorAll('[data-ch4-edit]').forEach((button) => { button.onclick = () => openBuilder(item); });
      root.querySelector('[data-ch4-preview]').onclick = () => actions.open(item.id);
      root.querySelector('[data-ch4-retry]')?.addEventListener('click', () => loadManagement(item.id));
    }

    async function openManagement(id) { screen = 'management'; selectedId = id; manageTab = 'overview'; details = blankDetails(true); paintManagement(); await loadManagement(id); }
    async function loadManagement(id) {
      const request = ++detailsRequest; details = blankDetails(true); paintManagement();
      try {
        const [people, progressResult] = await Promise.all([
          supa.from('challenge_participants').select('user_id,status').eq('challenge_id', id).neq('status', 'cancelled').limit(200),
          supa.from('challenge_progress').select('user_id,day,dialogs_done,words_done,writing_done,listening_min_done,live_min_done').eq('challenge_id', id).order('day', { ascending: false }).limit(1000)
        ]);
        if (people.error) throw people.error; if (progressResult.error) throw progressResult.error;
        const ids = [...new Set([...(people.data || []).map((row) => row.user_id), ...(progressResult.data || []).map((row) => row.user_id)].filter(Boolean))];
        let names = new Map();
        if (ids.length) { const profiles = await window.DuvelaWebConfig.publicProfiles(supa, 'id,full_name').in('id', ids); names = new Map((profiles.data || []).map((row) => [String(row.id), row.full_name || tr('Duvela learner', 'Ученик Duvela')])); }
        if (request !== detailsRequest) return;
        details = { loading: false, error: '', participants: people.data || [], progress: progressResult.data || [], names };
      } catch (error) { if (request !== detailsRequest) return; details = { loading: false, error: error.message || tr('Request failed.', 'Ошибка запроса.'), participants: [], progress: [], names: new Map() }; }
      paintManagement();
    }

    function draftFor(item) {
      const today = new Date().toISOString().slice(0, 10), later = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const draft = { title: item?.title || '', target_level: item?.target_level || '', exam_type: item?.exam_type || '', started_at: isoDay(item?.started_at) || today, ends_at: isoDay(item?.ends_at) || later };
      GOALS.forEach((goal) => { draft[goal[0]] = Number(item?.[goal[0]] || 0); }); return draft;
    }
    function openBuilder(item) {
      if (!item && !state.myOrg) { alert(tr('Create an organization first.', 'Сначала создайте организацию.')); return; }
      builder = { item: item || null, step: 1, saving: false, error: '', draft: draftFor(item) };
      $('#challengeOverlayTitle').textContent = item ? tr('Edit challenge', 'Редактировать челлендж') : tr('New challenge', 'Новый челлендж');
      $('#challengeOverlay').classList.add('open'); paintBuilder();
    }
    function rememberStep() {
      if (!builder) return; const value = (id) => { const node = $(id); return node ? node.value.trim() : null; };
      if (builder.step === 1 && value('#ch4bTitle') !== null) builder.draft.title = value('#ch4bTitle');
      if (builder.step === 2) { builder.draft.exam_type = value('#ch4bDirection') ?? builder.draft.exam_type; builder.draft.target_level = value('#ch4bLevel') ?? builder.draft.target_level; }
      if (builder.step === 4) { builder.draft.started_at = value('#ch4bStart') ?? builder.draft.started_at; builder.draft.ends_at = value('#ch4bEnd') ?? builder.draft.ends_at; }
      if (builder.step === 5) GOALS.forEach((goal) => { const raw = value('#ch4b-' + goal[0]); if (raw !== null) builder.draft[goal[0]] = Math.max(0, Number(raw) || 0); });
    }
    function planned(title, note, kind) { return '<div class="ch4-builder-note ' + (kind || 'planned') + '">' + icon(kind === 'ready' ? 'check' : 'flag') + '<div><b>' + esc(title) + '</b><small>' + esc(note) + '</small></div></div>'; }

    function stepHtml() {
      const d = builder.draft;
      if (builder.step === 1) return builderCopy(tr('Name your challenge', 'Назовите челлендж'), tr('Use a clear outcome learners can understand immediately.', 'Используйте понятный результат, который сразу поймут ученики.')) + '<div class="field"><label>' + esc(tr('Challenge name', 'Название челленджа')) + '</label><input id="ch4bTitle" maxlength="140" value="' + esc(d.title) + '" placeholder="B1 Speaking Sprint"></div>' + planned(tr('Description', 'Описание'), tr('Planned · the current schema has no description field.', 'Запланировано · в текущей схеме нет поля описания.'));
      if (builder.step === 2) return builderCopy(tr('Language and level', 'Язык и уровень'), tr('These values power library filters and learner context.', 'Эти значения используются в фильтрах и контексте для ученика.')) + '<div class="form-grid"><div class="field"><label>' + esc(tr('Language / exam', 'Язык / экзамен')) + '</label><input id="ch4bDirection" maxlength="40" value="' + esc(d.exam_type) + '" placeholder="German · TELC"></div><div class="field"><label>' + esc(tr('CEFR level', 'Уровень CEFR')) + '</label><input id="ch4bLevel" maxlength="10" value="' + esc(d.target_level) + '" placeholder="B1"></div></div>';
      if (builder.step === 3) return builderCopy(tr('Challenge type', 'Тип челленджа'), tr('Only the format supported by real daily tracking can be published.', 'Можно публиковать только формат с реальным ежедневным отслеживанием.')) + '<div class="ch4-type-grid"><button class="selected" type="button">' + icon('calendar') + '<b>' + esc(tr('Daily', 'Ежедневный')) + '</b><small>' + esc(tr('Available', 'Доступно')) + '</small></button><button disabled type="button">' + icon('calendar') + '<b>' + esc(tr('Weekly', 'Еженедельный')) + '</b><small>' + esc(tr('Planned', 'Запланировано')) + '</small></button><button disabled type="button">' + icon('flag') + '<b>' + esc(tr('Learning Journey', 'Учебный маршрут')) + '</b><small>' + esc(tr('Planned', 'Запланировано')) + '</small></button></div>';
      if (builder.step === 4) return builderCopy(tr('Duration', 'Продолжительность'), tr('Choose the active period for learner check-ins.', 'Укажите период, когда ученики смогут отмечать прогресс.')) + '<div class="form-grid"><div class="field"><label>' + esc(tr('Start date', 'Дата начала')) + '</label><input id="ch4bStart" type="date" value="' + esc(d.started_at) + '"></div><div class="field"><label>' + esc(tr('End date', 'Дата окончания')) + '</label><input id="ch4bEnd" type="date" value="' + esc(d.ends_at) + '"></div></div>' + planned(tr('Milestones', 'Этапы'), tr('Planned · milestone records are not implemented yet.', 'Запланировано · записи этапов пока не реализованы.'));
      if (builder.step === 5) return builderCopy(tr('Daily learning goals', 'Ежедневные учебные цели'), tr('Set 0 to disable a goal. Every enabled goal is backed by a real progress field.', 'Укажите 0, чтобы отключить цель. Каждая активная цель связана с реальным полем прогресса.')) + '<div class="form-grid ch4-goal-fields">' + GOALS.map((goal) => '<div class="field"><label>' + esc(tr(goal[2], goal[3])) + '</label><input id="ch4b-' + goal[0] + '" type="number" min="0" value="' + Number(d[goal[0]] || 0) + '"></div>').join('') + '</div><div class="ch4-planned-inline"><span>' + esc(tr('Reading · planned', 'Чтение · запланировано')) + '</span><span>' + esc(tr('Quizzes · planned', 'Тесты · запланировано')) + '</span></div>';
      if (builder.step === 6) return builderCopy(tr('Participation and privacy', 'Участие и приватность'), tr('Access follows existing Teacher permissions and Supabase RLS.', 'Доступ определяется правами преподавателя и Supabase RLS.')) + '<div class="ch4-privacy-card">' + icon('lock') + '<div><b>' + esc(tr('Existing access policy', 'Текущая политика доступа')) + '</b><p>' + esc(tr('Only public profile names and challenge aggregates are shown.', 'Показываются только публичные имена и агрегаты челленджа.')) + '</p></div></div>' + planned(tr('Invite-only and public visibility', 'Доступ по приглашению и публичность'), tr('Planned · visibility fields are not present in the schema.', 'Запланировано · полей видимости в схеме нет.'));
      const reviewGoals = goalItems(d);
      return builderCopy(tr('Review and publish', 'Проверка и публикация'), tr('Review the fields that will be written to Supabase.', 'Проверьте поля, которые будут сохранены в Supabase.')) + '<div class="ch4-review"><div><span>' + esc(tr('Challenge', 'Челлендж')) + '</span><b>' + esc(d.title || '—') + '</b></div><div><span>' + esc(tr('Language / level', 'Язык / уровень')) + '</span><b>' + esc(d.exam_type || '—') + ' · ' + esc(d.target_level || '—') + '</b></div><div><span>' + esc(tr('Duration', 'Период')) + '</span><b>' + esc(formatDate(d.started_at)) + ' — ' + esc(formatDate(d.ends_at)) + '</b></div><div><span>' + esc(tr('Tracked goals', 'Отслеживаемые цели')) + '</span><b>' + esc(reviewGoals.length ? reviewGoals.map((goal) => goal[0] + ' ' + goal[1]).join(' · ') : tr('None', 'Нет')) + '</b></div></div>' + planned(tr('Real API action', 'Реальное действие API'), builder.item ? tr('Updates the existing challenge without changing its ID.', 'Обновит существующий челлендж без изменения ID.') : tr('Creates a new challenge record.', 'Создаст новую запись челленджа.'), 'ready');
    }
    function builderCopy(title, note) { return '<div class="ch4-builder-copy"><h3>' + esc(title) + '</h3><p>' + esc(note) + '</p></div>'; }

    function paintBuilder() {
      const body = $('#challengeOverlayBody'); if (!body || !builder) return;
      const labels = [tr('Basics', 'Основное'), tr('Language', 'Язык'), tr('Type', 'Тип'), tr('Duration', 'Сроки'), tr('Goals', 'Цели'), tr('Access', 'Доступ'), tr('Review', 'Проверка')];
      body.innerHTML = '<div class="ch4-builder"><div class="ch4-builder-steps">' + labels.map((label, index) => '<span class="' + (builder.step === index + 1 ? 'active' : builder.step > index + 1 ? 'done' : '') + '"><i>' + (builder.step > index + 1 ? icon('check') : index + 1) + '</i><b>' + esc(label) + '</b></span>').join('') + '</div><div class="ch4-builder-content">' + stepHtml() + (builder.error ? '<div class="ch4-builder-error">' + esc(builder.error) + '</div>' : '') + '</div><div class="ch4-builder-actions"><button class="ch4-secondary" data-builder-back' + (builder.step === 1 || builder.saving ? ' disabled' : '') + '>' + esc(tr('Back', 'Назад')) + '</button><span>' + builder.step + ' / 7</span><button class="ch4-primary" data-builder-next' + (builder.saving ? ' disabled' : '') + '>' + esc(builder.saving ? tr('Saving…', 'Сохранение…') : builder.step === 7 ? (builder.item ? tr('Save changes', 'Сохранить изменения') : tr('Publish challenge', 'Опубликовать челлендж')) : tr('Continue', 'Продолжить')) + icon(builder.step === 7 ? 'check' : 'arrow') + '</button></div></div>';
      body.querySelector('[data-builder-back]')?.addEventListener('click', () => { rememberStep(); builder.step -= 1; builder.error = ''; paintBuilder(); });
      body.querySelector('[data-builder-next]')?.addEventListener('click', async () => { rememberStep(); builder.error = ''; if (builder.step === 1 && !builder.draft.title) { builder.error = tr('Enter a challenge name.', 'Введите название челленджа.'); paintBuilder(); return; } if (builder.step === 4 && (!builder.draft.started_at || !builder.draft.ends_at || builder.draft.ends_at < builder.draft.started_at)) { builder.error = tr('Choose a valid date range.', 'Укажите корректный период.'); paintBuilder(); return; } if (builder.step < 7) { builder.step += 1; paintBuilder(); return; } await saveBuilder(); });
    }

    async function saveBuilder() {
      builder.saving = true; paintBuilder(); const d = builder.draft;
      const row = { title: d.title, target_level: d.target_level || null, exam_type: d.exam_type || null, started_at: d.started_at, ends_at: d.ends_at };
      GOALS.forEach((goal) => { row[goal[0]] = Math.max(0, Number(d[goal[0]]) || 0); });
      try {
        const editingId = builder.item?.id;
        const result = builder.item ? await supa.from('challenges').update(row).eq('id', editingId).eq('created_by', ctx.user.id) : await supa.from('challenges').insert(Object.assign({ created_by: ctx.user.id, organization_id: state.myOrg?.id || null }, row));
        if (result.error) throw result.error;
        $('#challengeOverlay').classList.remove('open'); builder = null;
        screen = editingId ? 'management' : 'library'; selectedId = editingId || '';
        await actions.reload(); await loadMetrics(); if (editingId) await loadManagement(editingId); else paint();
      } catch (error) { builder.saving = false; builder.error = error.message || tr('Could not save the challenge.', 'Не удалось сохранить челлендж.'); paintBuilder(); }
    }

    async function loadMetrics() {
      const challenges = state.challenges || [], ids = challenges.map((item) => item.id).filter(Boolean), request = ++metricsRequest;
      if (!ids.length) { metrics = blankMetrics(false, true); paint(); return; }
      try {
        const [people, progressResult] = await Promise.all([
          supa.from('challenge_participants').select('challenge_id,user_id,status').in('challenge_id', ids),
          supa.from('challenge_progress').select('challenge_id,user_id,day,dialogs_done,words_done,writing_done,listening_min_done,live_min_done').in('challenge_id', ids)
        ]);
        if (people.error) throw people.error; if (progressResult.error) throw progressResult.error; if (request !== metricsRequest) return;
        const participants = new Map(), checkins = new Map(), completed = new Map();
        (people.data || []).filter((row) => row.status !== 'cancelled').forEach((row) => participants.set(String(row.challenge_id), (participants.get(String(row.challenge_id)) || 0) + 1));
        (progressResult.data || []).forEach((row) => { const id = String(row.challenge_id), challenge = challenges.find((item) => String(item.id) === id); checkins.set(id, (checkins.get(id) || 0) + 1); if (challenge && rowComplete(challenge, row)) completed.set(id, (completed.get(id) || 0) + 1); });
        metrics = { loading: false, available: true, participants, checkins, completed, participantTotal: [...participants.values()].reduce((a, b) => a + b, 0), completedTotal: [...completed.values()].reduce((a, b) => a + b, 0), rows: progressResult.data || [] };
      } catch (error) { console.warn('challenge metrics unavailable', error); metrics = blankMetrics(false, false); }
      paint();
    }

    function paint() { screen === 'management' ? paintManagement() : paintLibrary(); }
    function render() { document.querySelector('[data-panel="challenges"]')?.classList.add('ch4-panel'); paint(); loadMetrics(); }
    return { render, paint };
  }

  window.DuvelaChallenges4 = { create: createChallenges4 };
})();
