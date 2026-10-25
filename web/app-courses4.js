(function () {
  'use strict';

  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M8 7h7"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 8.7A6 6 0 1 1 8.7 18.1"/>', star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>',
    check: '<path d="m5 12 4 4L19 6"/>', chevron: '<path d="m9 18 6-6-6-6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.book) + '</svg>'; }
  function statusKey(value) { value = String(value || 'draft').toLowerCase(); return value === 'active' || value === 'published' ? 'published' : value; }
  function isFree(course) { return course.price == null || Number(course.price) === 0; }
  function filterCourses(courses, filters) {
    var query = String(filters.query || '').trim().toLowerCase();
    return courses.filter(function (course) {
      var haystack = [course.title, course.description, course.language, course.level].filter(Boolean).join(' ').toLowerCase();
      return (!query || haystack.indexOf(query) >= 0) &&
        (filters.status === 'all' || statusKey(course.status) === filters.status) &&
        (filters.price === 'all' || (filters.price === 'free' ? isFree(course) : !isFree(course))) &&
        (!filters.language || course.language === filters.language) && (!filters.level || course.level === filters.level);
    });
  }
  function sortCourses(courses, sort) {
    return courses.slice().sort(function (a, b) {
      if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
      if (sort === 'enrollment') return Number(b.studentCount || 0) - Number(a.studentCount || 0);
      return Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0);
    });
  }

  function createCourses4(ctx) {
    var tr = ctx.tr, esc = ctx.esc, supa = ctx.supa;
    var host = null, data = null, error = '', loading = false, loadedFor = '';
    var filters = { query: '', status: 'all', price: 'all', language: '', level: '', sort: 'date' };
    var view = localStorage.getItem('duvela.courses.view') === 'list' ? 'list' : 'grid';
    var selectedId = null, manageTab = 'overview', wizard = null, saving = false, notice = '';
    window.addEventListener('duvela:courses-changed', function () { void load(true); });

    function safe(promise) { return promise.then(function (result) { return result && result.error ? { data: [], error: result.error } : result; }).catch(function (err) { return { data: [], error: err }; }); }
    function money(course) {
      if (isFree(course)) return tr('Free', 'Бесплатно');
      try { return new Intl.NumberFormat(ctx.isRu ? 'ru-RU' : 'en-US', { style: 'currency', currency: course.currency || 'EUR', maximumFractionDigits: 2 }).format(Number(course.price)); }
      catch (_) { return Number(course.price).toFixed(2) + ' ' + (course.currency || 'EUR'); }
    }
    function dateTime(value) { if (!value) return ''; var d = new Date(value); return isNaN(d.getTime()) ? '' : d.toLocaleString(ctx.isRu ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }); }
    function statusLabel(value) {
      var key = statusKey(value); return ({ published: tr('Published', 'Опубликован'), draft: tr('Draft', 'Черновик'), archived: tr('Archived', 'В архиве'), closed: tr('Enrollment closed', 'Набор закрыт'), completed: tr('Completed', 'Завершён') })[key] || value;
    }
    function courseIds() { return (data && data.courses || []).map(function (course) { return course.id; }).filter(Boolean); }

    async function load(force) {
      var uid = ctx.user && ctx.user.id;
      if (!uid || (loading && !force)) return;
      loading = true; error = ''; paint();
      var coursesRes = await safe(supa.from('courses').select('id,title,description,level,language,status,price,currency,cover_image_url,starts_on,ends_on,schedule,location,delivery_mode,zoom_enabled,max_students,created_at,organization_id').eq('created_by', uid).order('created_at', { ascending: false }).limit(200));
      if (coursesRes.error) { error = coursesRes.error.message || tr('Courses could not be loaded.', 'Не удалось загрузить курсы.'); loading = false; data = null; paint(); return; }
      var courses = coursesRes.data || [], ids = courses.map(function (course) { return course.id; });
      var enrollmentsRes = { data: [] }, lessonsRes = { data: [] }, tasksRes = { data: [] }, classesRes = { data: [] };
      if (ids.length) {
        [enrollmentsRes, lessonsRes, tasksRes, classesRes] = await Promise.all([
          safe(supa.from('course_enrollments').select('id,course_id,user_id,status,full_name,email,created_at').in('course_id', ids).neq('status', 'cancelled')),
          safe(supa.from('course_lessons').select('id,course_id,order_index,title,description').in('course_id', ids).order('order_index', { ascending: true })),
          safe(supa.from('lesson_tasks').select('id,course_id,lesson_id,order_index,title,max_score').in('course_id', ids).order('order_index', { ascending: true })),
          safe(supa.from('classes').select('id,course_id,name,language,level').in('course_id', ids))
        ]);
      }
      var classIds = (classesRes.data || []).map(function (row) { return row.id; });
      var sessionsRes = classIds.length ? await safe(supa.from('class_sessions').select('id,class_id,title,starts_at,ends_at,status,provider,duration_min').in('class_id', classIds).order('starts_at', { ascending: true })) : { data: [] };
      var enrollments = enrollmentsRes.data || [], lessons = lessonsRes.data || [], tasks = tasksRes.data || [], classes = classesRes.data || [], sessions = sessionsRes.data || [];
      var now = Date.now();
      courses.forEach(function (course) {
        course.enrollments = enrollments.filter(function (row) { return row.course_id === course.id; });
        course.studentCount = new Set(course.enrollments.filter(function (row) { return row.status === 'confirmed'; }).map(function (row) { return row.user_id || row.email || row.id; })).size;
        course.lessons = lessons.filter(function (row) { return row.course_id === course.id; });
        course.tasks = tasks.filter(function (row) { return row.course_id === course.id; });
        course.classRow = classes.find(function (row) { return row.course_id === course.id; }) || null;
        course.sessions = course.classRow ? sessions.filter(function (row) { return row.class_id === course.classRow.id; }) : [];
        course.nextSession = course.sessions.find(function (row) { var s = String(row.status || '').toLowerCase(); return ['canceled','cancelled','ended','completed'].indexOf(s) < 0 && Date.parse(row.ends_at || row.starts_at) > now; }) || null;
      });
      data = { courses: courses }; loading = false; loadedFor = uid; paint();
    }

    function kpi(iconName, value, label, note, unavailable) {
      return '<article class="cr-kpi' + (unavailable ? ' unavailable' : '') + '"><span class="cr-kpi-icon">' + icon(iconName) + '</span><div><strong>' + esc(value) + '</strong><b>' + esc(label) + '</b><small>' + esc(note) + '</small></div></article>';
    }
    function fallbackCover(course, index) { return '<div class="cr-fallback tone-' + (index % 5) + '"><span>DUVELA</span><b>' + esc(course.level || 'COURSE') + '</b><em>' + esc(course.language || tr('Learning', 'Обучение')) + '</em></div>'; }
    function cover(course, index) { return course.cover_image_url ? '<img src="' + esc(course.cover_image_url) + '" alt="">' : fallbackCover(course, index); }
    function card(course, index) {
      var next = course.nextSession ? dateTime(course.nextSession.starts_at) : '';
      return '<article class="cr-card" data-course-card data-course-id="' + esc(course.id) + '"><div class="cr-cover">' + cover(course, index) +
        '<span class="cr-status ' + esc(statusKey(course.status)) + '">' + esc(statusLabel(course.status)) + '</span></div>' +
        '<div class="cr-card-body"><div class="cr-card-title"><div><h3>' + esc(course.title || tr('Untitled course', 'Курс без названия')) + '</h3><p>' + esc(course.description || tr('No description yet.', 'Описание пока не добавлено.')) + '</p></div>' +
        '<button class="cr-icon-btn" type="button" data-menu="' + esc(course.id) + '" aria-label="' + esc(tr('Course actions', 'Действия курса')) + '">' + icon('more') + '</button></div>' +
        '<div class="cr-tags"><span>' + esc(course.language || tr('Language not set', 'Язык не указан')) + '</span><span>' + esc(course.level || tr('Level not set', 'Уровень не указан')) + '</span></div>' +
        '<div class="cr-facts"><span>' + icon('book') + '<b>' + course.lessons.length + '</b> ' + esc(tr('lessons', 'уроков')) + '</span><span>' + icon('users') + '<b>' + course.studentCount + '</b> ' + esc(tr('students', 'учеников')) + '</span></div>' +
        (next ? '<div class="cr-next">' + icon('calendar') + '<span><small>' + esc(tr('Next session', 'Следующая встреча')) + '</small><b>' + esc(next) + '</b></span></div>' : '') +
        '<div class="cr-card-foot"><strong>' + esc(money(course)) + '</strong><button class="cr-primary" type="button" data-manage="' + esc(course.id) + '">' + esc(tr('Manage Course', 'Управлять курсом')) + icon('arrow') + '</button></div>' +
        '<div class="cr-menu" data-menu-panel="' + esc(course.id) + '" hidden>' +
          '<button data-action="preview" data-id="' + esc(course.id) + '">' + esc(tr('Preview', 'Предпросмотр')) + '</button><button data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit', 'Изменить')) + '</button>' +
          '<button data-action="students" data-id="' + esc(course.id) + '">' + esc(tr('Students', 'Ученики')) + '</button><button data-action="analytics" data-id="' + esc(course.id) + '">' + esc(tr('Analytics', 'Аналитика')) + '</button>' +
          '<button data-action="duplicate" data-id="' + esc(course.id) + '">' + esc(tr('Duplicate', 'Дублировать')) + '</button><button class="danger" data-action="archive" data-id="' + esc(course.id) + '">' + esc(tr('Archive', 'Архивировать')) + '</button>' +
        '</div></div></article>';
    }

    function mainView() {
      var courses = data ? data.courses : [], filtered = sortCourses(filterCourses(courses, filters), filters.sort);
      var students = new Set(); courses.forEach(function (course) { course.enrollments.filter(function (row) { return row.status === 'confirmed'; }).forEach(function (row) { students.add(row.user_id || row.email || row.id); }); });
      var languages = Array.from(new Set(courses.map(function (c) { return c.language; }).filter(Boolean))).sort();
      var levels = Array.from(new Set(courses.map(function (c) { return c.level; }).filter(Boolean))).sort();
      return '<div class="cr-page"><header class="cr-header"><div><span class="cr-eyebrow">DUVELA COURSE STUDIO</span><h1>' + esc(tr('My Courses', 'Мои курсы')) + '</h1><p>' + esc(tr('Create, manage and grow your teaching business.', 'Создавайте курсы, управляйте ими и развивайте своё преподавание.')) + '</p></div><div class="cr-header-actions"><a class="cr-secondary" href="./app.html?role=learner#courses" target="_blank" rel="noopener">' + esc(tr('Preview Public Catalog', 'Открыть каталог')) + '</a><button class="cr-primary" data-create type="button">' + icon('plus') + esc(tr('Create New Course', 'Создать новый курс')) + '</button></div></header>' +
        '<section class="cr-kpis">' + kpi('book', String(courses.length), tr('Total Courses', 'Всего курсов'), tr('All statuses', 'Все статусы')) + kpi('users', String(students.size), tr('Active Students', 'Активные ученики'), tr('Confirmed enrollments', 'Подтверждённые записи')) + kpi('coins', '—', tr('Monthly Revenue', 'Доход за месяц'), tr('Course payment ledger unavailable', 'Нет реестра платежей по курсам'), true) + kpi('star', '—', tr('Average Rating', 'Средняя оценка'), tr('Course ratings unavailable', 'Оценки курсов недоступны'), true) + '</section>' +
        '<section class="cr-toolbar"><div class="cr-search">' + icon('search') + '<input data-filter="query" type="search" value="' + esc(filters.query) + '" placeholder="' + esc(tr('Search by title…', 'Поиск по названию…')) + '"></div>' +
          '<div class="cr-tabs">' + [['all',tr('All','Все')],['published',tr('Published','Опубликованные')],['draft',tr('Draft','Черновики')],['archived',tr('Archived','Архив')]].map(function (item) { return '<button class="' + (filters.status === item[0] ? 'active' : '') + '" data-status="' + item[0] + '">' + esc(item[1]) + '</button>'; }).join('') + '</div>' +
          '<button class="cr-filter-toggle" type="button" data-filter-toggle>' + esc(tr('Filters', 'Фильтры')) + '</button><div class="cr-selects" data-filter-panel>' +
            '<select data-filter="price"><option value="all">' + esc(tr('Free & paid', 'Бесплатные и платные')) + '</option><option value="free"' + (filters.price === 'free' ? ' selected' : '') + '>' + esc(tr('Free', 'Бесплатные')) + '</option><option value="paid"' + (filters.price === 'paid' ? ' selected' : '') + '>' + esc(tr('Paid', 'Платные')) + '</option></select>' +
            '<select data-filter="language"><option value="">' + esc(tr('All languages', 'Все языки')) + '</option>' + languages.map(function (v) { return '<option' + (filters.language === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select>' +
            '<select data-filter="level"><option value="">' + esc(tr('All levels', 'Все уровни')) + '</option>' + levels.map(function (v) { return '<option' + (filters.level === v ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('') + '</select>' +
            '<select data-filter="sort"><option value="date">' + esc(tr('Newest', 'Сначала новые')) + '</option><option value="title"' + (filters.sort === 'title' ? ' selected' : '') + '>' + esc(tr('Title', 'По названию')) + '</option><option value="enrollment"' + (filters.sort === 'enrollment' ? ' selected' : '') + '>' + esc(tr('Enrollment', 'По записям')) + '</option></select></div>' +
          '<div class="cr-view"><button class="' + (view === 'grid' ? 'active' : '') + '" data-view-mode="grid" aria-label="Grid">' + icon('grid') + '</button><button class="' + (view === 'list' ? 'active' : '') + '" data-view-mode="list" aria-label="List">' + icon('list') + '</button></div></section>' +
        '<div class="cr-results-head"><b>' + filtered.length + ' ' + esc(tr('courses', 'курсов')) + '</b><span>' + esc(tr('Showing verified records from your workspace', 'Показаны реальные записи вашего кабинета')) + '</span></div>' +
        (filtered.length ? '<section class="cr-course-grid ' + view + '">' + filtered.map(card).join('') + '</section>' : '<section class="cr-empty"><span>' + icon('book') + '</span><h2>' + esc(courses.length ? tr('No courses match these filters', 'По этим фильтрам курсов нет') : tr('Create your first course', 'Создайте первый курс')) + '</h2><p>' + esc(courses.length ? tr('Change the search or filters to see more results.', 'Измените поиск или фильтры.') : tr('Build a structured course and publish it when it is ready.', 'Соберите программу и опубликуйте её, когда она будет готова.')) + '</p>' + (!courses.length ? '<button class="cr-primary" data-create>' + icon('plus') + esc(tr('Create New Course', 'Создать курс')) + '</button>' : '') + '</section>') + '</div>';
    }

    function selectedCourse() { return data && data.courses.find(function (c) { return String(c.id) === String(selectedId); }); }
    function managementView(course) {
      var tabs = [['overview',tr('Overview','Обзор')],['curriculum',tr('Curriculum','Программа')],['students',tr('Students','Ученики')],['schedule',tr('Schedule','Расписание')],['pricing',tr('Pricing','Цена')],['analytics',tr('Analytics','Аналитика')],['settings',tr('Settings','Настройки')]];
      return '<div class="cr-page cr-manage"><button class="cr-back" data-back>' + icon('chevron') + esc(tr('All courses', 'Все курсы')) + '</button><header class="cr-manage-head"><div class="cr-manage-cover">' + cover(course, 0) + '</div><div><span class="cr-status ' + esc(statusKey(course.status)) + '">' + esc(statusLabel(course.status)) + '</span><h1>' + esc(course.title) + '</h1><p>' + esc([course.language,course.level,course.delivery_mode].filter(Boolean).join(' · ')) + '</p></div><button class="cr-secondary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit course', 'Изменить курс')) + '</button></header><nav class="cr-manage-tabs">' + tabs.map(function (item) { return '<button class="' + (manageTab === item[0] ? 'active' : '') + '" data-manage-tab="' + item[0] + '">' + esc(item[1]) + '</button>'; }).join('') + '</nav><section class="cr-manage-panel">' + managePanel(course) + '</section></div>';
    }
    function stat(label, value) { return '<div class="cr-stat"><small>' + esc(label) + '</small><b>' + esc(String(value)) + '</b></div>'; }
    function managePanel(course) {
      if (manageTab === 'curriculum') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Curriculum', 'Программа')) + '</h2><p>' + esc(tr('Lessons and assignments saved for this course.', 'Уроки и задания этого курса.')) + '</p></div><button class="cr-primary" data-action="preview" data-id="' + esc(course.id) + '">' + esc(tr('Open curriculum editor', 'Открыть редактор')) + '</button></div>' + (course.lessons.length ? '<div class="cr-lesson-list">' + course.lessons.map(function (lesson, index) { var count = course.tasks.filter(function (task) { return task.lesson_id === lesson.id; }).length; return '<article><span>' + (lesson.order_index || index + 1) + '</span><div><b>' + esc(lesson.title || tr('Untitled lesson', 'Урок без названия')) + '</b><p>' + esc(lesson.description || count + ' ' + tr('assignments', 'заданий')) + '</p></div><em>' + count + '</em></article>'; }).join('') + '</div>' : emptyInline(tr('No lessons yet', 'Уроков пока нет'), tr('Open the editor to add the first lesson.', 'Откройте редактор и добавьте первый урок.')));
      if (manageTab === 'students') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Students', 'Ученики')) + '</h2><p>' + esc(tr('Confirmed and pending course enrollments.', 'Подтверждённые и ожидающие записи.')) + '</p></div><span class="cr-count">' + course.enrollments.length + '</span></div>' + (course.enrollments.length ? '<div class="cr-student-list">' + course.enrollments.map(function (row) { return '<article><span>' + esc((row.full_name || row.email || 'S').charAt(0).toUpperCase()) + '</span><div><b>' + esc(row.full_name || tr('Student', 'Ученик')) + '</b><p>' + esc(row.email || statusLabel(row.status)) + '</p></div><em class="cr-status ' + esc(row.status) + '">' + esc(row.status) + '</em>' + (row.status === 'pending' ? '<button class="cr-secondary" data-confirm="' + esc(row.id) + '">' + esc(tr('Confirm', 'Подтвердить')) + '</button>' : '') + '</article>'; }).join('') + '</div>' : emptyInline(tr('No enrollments yet', 'Записей пока нет'), tr('New learners will appear here.', 'Новые ученики появятся здесь.')));
      if (manageTab === 'schedule') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Schedule', 'Расписание')) + '</h2><p>' + esc(course.schedule || tr('No recurring schedule set.', 'Повторяющееся расписание не задано.')) + '</p></div><button class="cr-secondary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit schedule', 'Изменить расписание')) + '</button></div>' + (course.sessions.length ? '<div class="cr-session-list">' + course.sessions.map(function (row) { return '<article><span>' + icon('calendar') + '</span><div><b>' + esc(row.title || course.title) + '</b><p>' + esc(dateTime(row.starts_at)) + ' · ' + esc(String(row.duration_min || 60)) + ' min</p></div><em class="cr-status ' + esc(row.status) + '">' + esc(row.status || '') + '</em>' + (row.status === 'scheduled' ? '<a class="cr-secondary" href="./classroom.html?s=' + esc(row.id) + '">' + esc(tr('Prepare', 'Подготовить')) + '</a>' : '') + '</article>'; }).join('') + '</div>' : emptyInline(tr('No classroom sessions', 'Нет занятий'), tr('Enable Zoom Classroom in course settings to create sessions.', 'Включите Zoom Classroom в настройках курса.')));
      if (manageTab === 'pricing') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Pricing', 'Цена')) + '</h2><p>' + esc(tr('The price currently shown in the public catalog.', 'Цена, которая сейчас показана в каталоге.')) + '</p></div><button class="cr-primary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit pricing', 'Изменить цену')) + '</button></div><div class="cr-price-card"><small>' + esc(tr('Course price', 'Цена курса')) + '</small><strong>' + esc(money(course)) + '</strong><p>' + esc(isFree(course) ? tr('Learners can enroll without payment.', 'Ученики могут записаться бесплатно.') : tr('Payment settlement is not exposed in this workspace.', 'Платёжные расчёты пока не доступны в этом кабинете.')) + '</p></div>';
      if (manageTab === 'analytics') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Course analytics', 'Аналитика курса')) + '</h2><p>' + esc(tr('Only metrics backed by saved course records are shown.', 'Показаны только показатели из сохранённых данных.')) + '</p></div></div><div class="cr-analytics">' + stat(tr('Confirmed students','Подтверждённые ученики'),course.studentCount) + stat(tr('Lessons','Уроки'),course.lessons.length) + stat(tr('Assignments','Задания'),course.tasks.length) + stat(tr('Classroom sessions','Занятия'),course.sessions.length) + '</div><div class="cr-data-note">' + esc(tr('Revenue, completion and course rating are not shown because no verified course analytics source is connected.', 'Доход, завершение и рейтинг не показаны: для них нет подключённого проверенного источника.')) + '</div>';
      if (manageTab === 'settings') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Course settings', 'Настройки курса')) + '</h2><p>' + esc(tr('Publication and lifecycle controls.', 'Публикация и управление жизненным циклом курса.')) + '</p></div></div><div class="cr-settings-actions"><button class="cr-primary" data-status-set="active" data-id="' + esc(course.id) + '">' + esc(tr('Publish course', 'Опубликовать курс')) + '</button><button class="cr-secondary" data-status-set="draft" data-id="' + esc(course.id) + '">' + esc(tr('Move to draft', 'Вернуть в черновики')) + '</button><button class="cr-danger" data-action="archive" data-id="' + esc(course.id) + '">' + esc(tr('Archive course', 'Архивировать курс')) + '</button></div><div class="cr-data-note">' + esc(tr('Current status: ', 'Текущий статус: ')) + '<b>' + esc(statusLabel(course.status)) + '</b></div>';
      return '<div class="cr-panel-head"><div><h2>' + esc(tr('Course overview', 'Обзор курса')) + '</h2><p>' + esc(course.description || tr('No description yet.', 'Описание пока не добавлено.')) + '</p></div><button class="cr-primary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit details', 'Изменить данные')) + '</button></div><div class="cr-overview-grid">' + stat(tr('Status','Статус'),statusLabel(course.status)) + stat(tr('Language','Язык'),course.language || '—') + stat(tr('CEFR level','Уровень CEFR'),course.level || '—') + stat(tr('Price','Цена'),money(course)) + stat(tr('Students','Ученики'),course.studentCount) + stat(tr('Lessons','Уроки'),course.lessons.length) + '</div>';
    }
    function emptyInline(title, copy) { return '<div class="cr-inline-empty"><span>' + icon('book') + '</span><h3>' + esc(title) + '</h3><p>' + esc(copy) + '</p></div>'; }

    function paint() {
      host = document.querySelector('[data-panel="courses"]'); if (!host) return;
      host.classList.add('cr-host');
      if (loading && !data) host.innerHTML = '<div class="cr-page"><div class="cr-skeleton-head"></div><div class="cr-skeleton-grid">' + '<i></i>'.repeat(8) + '</div></div>';
      else if (error && !data) host.innerHTML = '<div class="cr-page"><section class="cr-error"><h1>' + esc(tr('Courses are unavailable', 'Курсы недоступны')) + '</h1><p>' + esc(error) + '</p><button class="cr-primary" data-retry>' + esc(tr('Try again', 'Повторить')) + '</button></section></div>';
      else { var course = selectedCourse(); host.innerHTML = course ? managementView(course) : mainView(); }
      bind(); if (wizard) paintWizard();
    }

    function bind() {
      if (!host) return;
      host.querySelectorAll('[data-create]').forEach(function (button) { button.onclick = openWizard; });
      var query = host.querySelector('[data-filter="query"]'); if (query) query.oninput = function () { filters.query = query.value; paint(); var next = host.querySelector('[data-filter="query"]'); if (next) { next.focus(); next.setSelectionRange(next.value.length,next.value.length); } };
      host.querySelectorAll('[data-status]').forEach(function (button) { button.onclick = function () { filters.status = button.dataset.status; paint(); }; });
      host.querySelectorAll('select[data-filter]').forEach(function (select) { select.onchange = function () { filters[select.dataset.filter] = select.value; paint(); }; });
      var toggle = host.querySelector('[data-filter-toggle]'); if (toggle) toggle.onclick = function () { host.querySelector('[data-filter-panel]').classList.toggle('open'); };
      host.querySelectorAll('[data-view-mode]').forEach(function (button) { button.onclick = function () { view = button.dataset.viewMode; localStorage.setItem('duvela.courses.view', view); paint(); }; });
      host.querySelectorAll('[data-menu]').forEach(function (button) { button.onclick = function (event) { event.stopPropagation(); var panel = host.querySelector('[data-menu-panel="' + CSS.escape(button.dataset.menu) + '"]'); host.querySelectorAll('[data-menu-panel]').forEach(function (p) { if (p !== panel) p.hidden = true; }); panel.hidden = !panel.hidden; }; });
      host.querySelectorAll('[data-manage]').forEach(function (button) { button.onclick = function () { selectedId = button.dataset.manage; manageTab = 'overview'; paint(); }; });
      var back = host.querySelector('[data-back]'); if (back) back.onclick = function () { selectedId = null; paint(); };
      host.querySelectorAll('[data-manage-tab]').forEach(function (button) { button.onclick = function () { manageTab = button.dataset.manageTab; paint(); }; });
      host.querySelectorAll('[data-action]').forEach(function (button) { button.onclick = function () { void action(button.dataset.action, button.dataset.id); }; });
      host.querySelectorAll('[data-status-set]').forEach(function (button) { button.onclick = function () { void setStatus(button.dataset.id, button.dataset.statusSet); }; });
      host.querySelectorAll('[data-confirm]').forEach(function (button) { button.onclick = async function () { await ctx.confirmEnrollment(button.dataset.confirm); await load(true); }; });
      var retry = host.querySelector('[data-retry]'); if (retry) retry.onclick = function () { void load(true); };
    }

    async function action(type, id) {
      var course = data.courses.find(function (row) { return String(row.id) === String(id); }); if (!course) return;
      if (type === 'preview') return ctx.openCourseDetail(id);
      if (type === 'edit') return ctx.management && ctx.management.openCourseModal ? ctx.management.openCourseModal(id) : ctx.openCourseDetail(id);
      if (type === 'students' || type === 'analytics') { selectedId = id; manageTab = type; paint(); return; }
      if (type === 'archive') { if (!window.confirm(tr('Move this course to the archive?', 'Переместить курс в архив?'))) return; return setStatus(id, 'archived'); }
      if (type === 'duplicate') return duplicate(course);
    }
    async function setStatus(id, status) {
      var result = await supa.from('courses').update({ status: status }).eq('id', id).eq('created_by', ctx.user.id).select('id').single();
      if (result.error) { window.alert(result.error.message || tr('Could not update the course.', 'Не удалось обновить курс.')); return; }
      await load(true);
    }
    async function duplicate(course) {
      if (!window.confirm(tr('Create a draft copy of this course?', 'Создать черновую копию курса?'))) return;
      var row = { organization_id: course.organization_id, created_by: ctx.user.id, title: course.title + ' · ' + tr('Copy', 'Копия'), description: course.description, level: course.level, language: course.language, status: 'draft', price: course.price, currency: course.currency, cover_image_url: course.cover_image_url, starts_on: course.starts_on, ends_on: course.ends_on, schedule: course.schedule, location: course.location, delivery_mode: course.delivery_mode, zoom_enabled: false, max_students: course.max_students };
      var created = await supa.from('courses').insert(row).select('id').single(); if (created.error) { window.alert(created.error.message); return; }
      if (course.lessons.length) {
        var lessonRows = course.lessons.map(function (lesson) { return { course_id: created.data.id, teacher_id: ctx.user.id, order_index: lesson.order_index, title: lesson.title, description: lesson.description }; });
        await supa.from('course_lessons').insert(lessonRows);
      }
      await load(true);
    }

    function openWizard() { wizard = { step: 0, title: '', description: '', language: '', level: '', lessons: [''], cover_image_url: '', starts_on: '', ends_on: '', schedule: '', location: '', price: '', currency: 'EUR', status: 'draft' }; notice = ''; paintWizard(); }
    function closeWizard() { if (saving) return; document.querySelector('.cr-wizard')?.remove(); wizard = null; document.body.classList.remove('modal-open'); }
    function wizardSteps() { return [tr('Basic Information','Основная информация'),tr('Language and CEFR','Язык и CEFR'),tr('Curriculum','Программа'),tr('Media and Resources','Медиа и материалы'),tr('Schedule','Расписание'),tr('Pricing','Цена'),tr('Preview and Publish','Предпросмотр и публикация')]; }
    function readWizard() {
      var box = document.querySelector('.cr-wizard'); if (!box || !wizard) return;
      box.querySelectorAll('[data-field]').forEach(function (input) { wizard[input.dataset.field] = input.value; });
      box.querySelectorAll('[data-lesson]').forEach(function (input) { wizard.lessons[Number(input.dataset.lesson)] = input.value; });
    }
    function validateStep() {
      readWizard(); notice = '';
      if (wizard.step === 0 && !wizard.title.trim()) notice = tr('Enter a course title.', 'Введите название курса.');
      if (wizard.step === 0 && wizard.description.trim() && wizard.description.trim().length < 32) notice = tr('Add a clear public description of at least 32 characters.', 'Добавьте понятное публичное описание не короче 32 символов.');
      if (wizard.step === 1 && (!wizard.language.trim() || !wizard.level.trim())) notice = tr('Set the language and CEFR level.', 'Укажите язык и уровень CEFR.');
      if (wizard.step === 4 && wizard.starts_on && wizard.ends_on && wizard.ends_on < wizard.starts_on) notice = tr('End date cannot be before start date.', 'Дата окончания не может быть раньше даты начала.');
      return !notice;
    }
    function field(id, label, type, placeholder) { return '<label class="cr-field"><span>' + esc(label) + '</span><input data-field="' + id + '" type="' + (type || 'text') + '" value="' + esc(wizard[id] || '') + '" placeholder="' + esc(placeholder || '') + '"></label>'; }
    function wizardBody() {
      var s = wizard.step;
      if (s === 0) return field('title',tr('Course title','Название курса'),'text',tr('e.g. German Conversation A2','Например: Разговорный немецкий A2')) + '<label class="cr-field"><span>' + esc(tr('Description','Описание')) + '</span><textarea data-field="description" maxlength="800">' + esc(wizard.description) + '</textarea><small>' + esc(tr('Explain who the course is for, what learners will practice, and the expected result.', 'Укажите, для кого курс, что будут практиковать ученики и какого результата достигнут.')) + '</small></label>';
      if (s === 1) return '<div class="cr-field-grid">' + field('language',tr('Language','Язык'),'text',tr('German','Немецкий')) + '<label class="cr-field"><span>' + esc(tr('CEFR level','Уровень CEFR')) + '</span><select data-field="level"><option value="">—</option>' + ['A1','A2','B1','B2','C1','C2'].map(function (v) { return '<option' + (wizard.level === v ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label></div>';
      if (s === 2) return '<div class="cr-wizard-copy"><h3>' + esc(tr('Build the first lesson outline', 'Соберите план первых уроков')) + '</h3><p>' + esc(tr('Lesson titles are created with the course. Assignments can be added later in the curriculum editor.', 'Названия уроков сохранятся вместе с курсом. Задания можно добавить позже в редакторе программы.')) + '</p></div><div class="cr-wizard-lessons">' + wizard.lessons.map(function (v,i) { return '<label><span>' + (i + 1) + '</span><input data-lesson="' + i + '" value="' + esc(v) + '" placeholder="' + esc(tr('Lesson title','Название урока')) + '"><button type="button" data-remove-lesson="' + i + '" aria-label="Remove">' + icon('close') + '</button></label>'; }).join('') + '</div><button class="cr-secondary" type="button" data-add-lesson>' + icon('plus') + esc(tr('Add lesson','Добавить урок')) + '</button>';
      if (s === 3) return '<button class="cr-upload" type="button" data-upload>' + (wizard.cover_image_url ? '<img src="' + esc(wizard.cover_image_url) + '" alt="">' : icon('upload') + '<b>' + esc(tr('Upload 16:9 course cover','Загрузить обложку 16:9')) + '</b><span>' + esc(tr('JPG, PNG or WebP','JPG, PNG или WebP')) + '</span>') + '</button><input type="file" data-cover-file accept="image/jpeg,image/png,image/webp" hidden><div class="cr-data-note">' + esc(tr('Course resources are added after creation in the curriculum editor. No unsupported file controls are shown.', 'Материалы курса добавляются после создания в редакторе программы.')) + '</div>';
      if (s === 4) return '<div class="cr-field-grid">' + field('starts_on',tr('Start date','Дата начала'),'date','') + field('ends_on',tr('End date','Дата окончания'),'date','') + '</div>' + field('schedule',tr('Schedule','Расписание'),'text',tr('Mon / Wed · 18:00','Пн / Ср · 18:00')) + field('location',tr('Location','Место'),'text',tr('Online or address','Онлайн или адрес')) + '<div class="cr-data-note">' + esc(tr('Zoom Classroom sessions can be configured after creation in Schedule.', 'Занятия Zoom Classroom можно настроить после создания во вкладке «Расписание».')) + '</div>';
      if (s === 5) return '<div class="cr-field-grid">' + field('price',tr('Price','Цена'),'number','0') + '<label class="cr-field"><span>' + esc(tr('Currency','Валюта')) + '</span><select data-field="currency"><option>EUR</option><option' + (wizard.currency === 'USD' ? ' selected' : '') + '>USD</option></select></label></div><p class="cr-helper">' + esc(tr('Use 0 for a free course.', 'Укажите 0 для бесплатного курса.')) + '</p>';
      return '<div class="cr-review"><div class="cr-review-cover">' + (wizard.cover_image_url ? '<img src="' + esc(wizard.cover_image_url) + '" alt="">' : fallbackCover(wizard,0)) + '</div><div><span class="cr-eyebrow">' + esc([wizard.language,wizard.level].filter(Boolean).join(' · ')) + '</span><h2>' + esc(wizard.title || tr('Untitled course','Курс без названия')) + '</h2><p>' + esc(wizard.description || tr('No description yet.','Описание пока не добавлено.')) + '</p><strong>' + esc(money(wizard)) + '</strong></div></div><label class="cr-field"><span>' + esc(tr('Save as','Сохранить как')) + '</span><select data-field="status"><option value="draft">' + esc(tr('Draft','Черновик')) + '</option><option value="active"' + (wizard.status === 'active' ? ' selected' : '') + '>' + esc(tr('Published','Опубликован')) + '</option></select></label>';
    }
    function paintWizard() {
      if (!wizard) return;
      var overlay = document.querySelector('.cr-wizard'); if (!overlay) { overlay = document.createElement('div'); overlay.className = 'cr-wizard'; document.body.appendChild(overlay); }
      document.body.classList.add('modal-open'); var steps = wizardSteps();
      overlay.innerHTML = '<div class="cr-wizard-card" role="dialog" aria-modal="true" aria-labelledby="crWizardTitle"><header><div><span class="cr-eyebrow">' + esc(tr('COURSE BUILDER','КОНСТРУКТОР КУРСА')) + '</span><h2 id="crWizardTitle">' + esc(steps[wizard.step]) + '</h2></div><button data-wizard-close aria-label="Close">' + icon('close') + '</button></header><div class="cr-stepper">' + steps.map(function (label,i) { return '<button type="button" class="' + (i === wizard.step ? 'active' : i < wizard.step ? 'done' : '') + '" data-step-jump="' + i + '"' + (i > wizard.step ? ' disabled' : '') + '><span>' + (i < wizard.step ? icon('check') : i + 1) + '</span><em>' + esc(label) + '</em></button>'; }).join('') + '</div><main>' + wizardBody() + (notice ? '<div class="cr-notice">' + esc(notice) + '</div>' : '') + '</main><footer>' + (wizard.step ? '<button class="cr-secondary" data-prev>' + esc(tr('Back','Назад')) + '</button>' : '<span></span>') + '<button class="cr-primary" data-next' + (saving ? ' disabled' : '') + '>' + esc(saving ? tr('Saving…','Сохранение…') : wizard.step === 6 ? tr('Save Course','Сохранить курс') : tr('Continue','Продолжить')) + icon('arrow') + '</button></footer></div>';
      overlay.querySelector('[data-wizard-close]').onclick = closeWizard;
      overlay.onclick = function (e) { if (e.target === overlay) closeWizard(); };
      overlay.querySelector('[data-prev]')?.addEventListener('click', function () { readWizard(); wizard.step--; notice=''; paintWizard(); });
      overlay.querySelector('[data-next]').onclick = function () { if (!validateStep()) { paintWizard(); return; } if (wizard.step < 6) { wizard.step++; paintWizard(); } else void saveWizard(); };
      overlay.querySelectorAll('[data-step-jump]').forEach(function (button) { button.onclick = function () { readWizard(); wizard.step = Number(button.dataset.stepJump); notice=''; paintWizard(); }; });
      overlay.querySelector('[data-add-lesson]')?.addEventListener('click', function () { readWizard(); wizard.lessons.push(''); paintWizard(); });
      overlay.querySelectorAll('[data-remove-lesson]').forEach(function (button) { button.onclick = function () { readWizard(); wizard.lessons.splice(Number(button.dataset.removeLesson),1); if (!wizard.lessons.length) wizard.lessons.push(''); paintWizard(); }; });
      var upload = overlay.querySelector('[data-upload]'), file = overlay.querySelector('[data-cover-file]'); if (upload && file) { upload.onclick = function () { file.click(); }; file.onchange = function () { var selected = file.files && file.files[0]; if (selected) void uploadWizardCover(selected); }; }
    }
    async function uploadWizardCover(file) { notice = tr('Uploading cover…','Загрузка обложки…'); paintWizard(); try { wizard.cover_image_url = await ctx.uploadToBucket('posts', file); notice=''; } catch (e) { notice = e.message || tr('Could not upload the cover.','Не удалось загрузить обложку.'); } paintWizard(); }
    async function saveWizard() {
      readWizard(); saving = true; notice=''; paintWizard();
      var org = ctx.state && ctx.state.myOrg; if (!org && ctx.management && ctx.management.ensureOrg) org = await ctx.management.ensureOrg();
      if (!org) { saving=false; notice=tr('Could not prepare your teaching workspace.','Не удалось подготовить кабинет преподавателя.'); paintWizard(); return; }
      var priceRaw = String(wizard.price || '').trim();
      var row = { organization_id: org.id, created_by: ctx.user.id, title: wizard.title.trim(), description: wizard.description.trim() || null, language: wizard.language.trim() || null, level: wizard.level || null, cover_image_url: wizard.cover_image_url || null, starts_on: wizard.starts_on || null, ends_on: wizard.ends_on || null, schedule: wizard.schedule.trim() || null, location: wizard.location.trim() || null, price: priceRaw === '' ? null : Number(priceRaw), currency: wizard.currency || 'EUR', status: wizard.status || 'draft', zoom_enabled: false, delivery_mode: 'self_paced', max_students: 25 };
      var result = await supa.from('courses').insert(row).select('id').single();
      if (result.error) { saving=false; notice=result.error.message || tr('Could not create the course.','Не удалось создать курс.'); paintWizard(); return; }
      var lessonTitles = wizard.lessons.map(function (v) { return v.trim(); }).filter(Boolean); if (lessonTitles.length) { var inserted = await supa.from('course_lessons').insert(lessonTitles.map(function (title,i) { return { course_id: result.data.id, teacher_id: ctx.user.id, order_index: i + 1, title: title }; })); if (inserted.error) window.alert(tr('Course created, but lessons could not be saved: ','Курс создан, но уроки не сохранены: ') + inserted.error.message); }
      saving=false; closeWizard(); await load(true); selectedId=result.data.id; manageTab='overview'; paint();
    }

    function render() {
      host = document.querySelector('[data-panel="courses"]'); if (!host) return;
      var uid = ctx.user && ctx.user.id; if (!data || loadedFor !== uid) { void load(true); } else paint();
    }
    return { render: render, reload: function () { return load(true); } };
  }

  window.DuvelaCourses4 = { create: createCourses4, __test: { statusKey: statusKey, isFree: isFree, filterCourses: filterCourses, sortCourses: sortCourses } };
})();
