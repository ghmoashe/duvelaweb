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
  // Course-builder catalog shared with the Business app (shared/teaching-languages.ts,
  // shared/course-builder.ts): same keys, limits and duration chips.
  var MAX_TEACHING_LANGUAGES = 2, MAX_EXPLANATION_LANGUAGES = 4;
  var LEVELS = ['A1','A2','B1','B2','C1','C2'];
  var DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];
  var TEACHING_LANGUAGES = [
    ['🇬🇧','english','English'],['🇪🇸','spanish','Español'],['🇩🇪','german','Deutsch'],['🇫🇷','french','Français'],['🇮🇹','italian','Italiano'],['🇷🇺','russian','Русский'],
    ['🇺🇦','ukrainian','Українська'],['🇹🇷','turkish','Türkçe'],['🇦🇿','azerbaijani','Azərbaycanca'],['🇺🇿','uzbek','Oʻzbekcha'],['🇮🇷','farsi','فارسی'],['🇸🇦','arabic','العربية'],
    ['🇮🇱','hebrew','עברית'],['🇮🇳','hindi','हिन्दी'],['🇵🇰','urdu','اردو'],['🇧🇩','bengali','বাংলা'],['🇨🇳','chinese','中文'],['🇰🇷','korean','한국어'],
    ['🇯🇵','japanese','日本語'],['🇻🇳','vietnamese','Tiếng Việt'],['🇹🇭','thai','ไทย'],['🇮🇩','indonesian','Bahasa Indonesia'],['🇵🇱','polish','Polski'],['🇨🇿','czech','Čeština'],
    ['🇸🇰','slovak','Slovenčina'],['🇭🇺','hungarian','Magyar'],['🇷🇴','romanian','Română'],['🇷🇸','serbian','Српски'],['🇬🇷','greek','Ελληνικά'],['🇳🇱','dutch','Nederlands'],
    ['🇸🇪','swedish','Svenska'],['🇳🇴','norwegian','Norsk'],['🇩🇰','danish','Dansk'],['🇫🇮','finnish','Suomi'],['🇪🇪','estonian','Eesti'],['🇵🇹','portuguese','Português']
  ].map(function (row) { return { flag: row[0], key: row[1], label: row[2] }; });
  // Same spellings as public.normalize_teaching_language_key (explanation-language guard).
  var LANGUAGE_ALIASES = { persian: 'farsi', deutsch: 'german', espanol: 'spanish', 'español': 'spanish', francais: 'french', 'français': 'french', italiano: 'italian', portugues: 'portuguese', 'português': 'portuguese', 'русский': 'russian', 'türkçe': 'turkish', turkce: 'turkish', svenska: 'swedish', norsk: 'norwegian', polski: 'polish', 'čeština': 'czech', cestina: 'czech', nederlands: 'dutch', '中文': 'chinese', '한국어': 'korean', '日本語': 'japanese', 'العربية': 'arabic', 'oʻzbekcha': 'uzbek', ozbekcha: 'uzbek', 'azərbaycanca': 'azerbaijani' };
  var LANGUAGE_CODES = { en: 'english', de: 'german', es: 'spanish', fr: 'french', it: 'italian', pt: 'portuguese', nl: 'dutch', sv: 'swedish', no: 'norwegian', da: 'danish', fi: 'finnish', ro: 'romanian', sr: 'serbian', pl: 'polish', cs: 'czech', tr: 'turkish', ru: 'russian', uk: 'ukrainian', az: 'azerbaijani', uz: 'uzbek', fa: 'farsi', ar: 'arabic', vi: 'vietnamese', zh: 'chinese', ja: 'japanese', ko: 'korean' };
  function normalizeLanguage(value) {
    var v = String(value || '').trim().toLowerCase(); if (!v) return '';
    if (TEACHING_LANGUAGES.some(function (l) { return l.key === v; })) return v;
    return LANGUAGE_ALIASES[v] || LANGUAGE_CODES[v.split('-')[0].split('_')[0]] || '';
  }
  function normalizeLanguages(values) {
    var list = Array.isArray(values) ? values : String(values || '').split(',');
    return list.map(normalizeLanguage).filter(function (key, i, all) { return key && all.indexOf(key) === i; });
  }
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
    var wizardProfile, zoomLessonDraft = null, zoomLessonFor = null, zoomLessonSaving = false, zoomLessonNotice = '';
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
      if (manageTab === 'schedule') return scheduleTab(course);
      if (manageTab === 'pricing') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Pricing', 'Цена')) + '</h2><p>' + esc(tr('The price currently shown in the public catalog.', 'Цена, которая сейчас показана в каталоге.')) + '</p></div><button class="cr-primary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit pricing', 'Изменить цену')) + '</button></div><div class="cr-price-card"><small>' + esc(tr('Course price', 'Цена курса')) + '</small><strong>' + esc(money(course)) + '</strong><p>' + esc(isFree(course) ? tr('Learners can enroll without payment.', 'Ученики могут записаться бесплатно.') : tr('Payment settlement is not exposed in this workspace.', 'Платёжные расчёты пока не доступны в этом кабинете.')) + '</p></div>';
      if (manageTab === 'analytics') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Course analytics', 'Аналитика курса')) + '</h2><p>' + esc(tr('Only metrics backed by saved course records are shown.', 'Показаны только показатели из сохранённых данных.')) + '</p></div></div><div class="cr-analytics">' + stat(tr('Confirmed students','Подтверждённые ученики'),course.studentCount) + stat(tr('Lessons','Уроки'),course.lessons.length) + stat(tr('Assignments','Задания'),course.tasks.length) + stat(tr('Classroom sessions','Занятия'),course.sessions.length) + '</div><div class="cr-data-note">' + esc(tr('Revenue, completion and course rating are not shown because no verified course analytics source is connected.', 'Доход, завершение и рейтинг не показаны: для них нет подключённого проверенного источника.')) + '</div>';
      if (manageTab === 'settings') return '<div class="cr-panel-head"><div><h2>' + esc(tr('Course settings', 'Настройки курса')) + '</h2><p>' + esc(tr('Publication and lifecycle controls.', 'Публикация и управление жизненным циклом курса.')) + '</p></div></div><div class="cr-settings-actions"><button class="cr-primary" data-status-set="active" data-id="' + esc(course.id) + '">' + esc(tr('Publish course', 'Опубликовать курс')) + '</button><button class="cr-secondary" data-status-set="draft" data-id="' + esc(course.id) + '">' + esc(tr('Move to draft', 'Вернуть в черновики')) + '</button><button class="cr-danger" data-action="archive" data-id="' + esc(course.id) + '">' + esc(tr('Archive course', 'Архивировать курс')) + '</button></div><div class="cr-data-note">' + esc(tr('Current status: ', 'Текущий статус: ')) + '<b>' + esc(statusLabel(course.status)) + '</b></div>';
      return '<div class="cr-panel-head"><div><h2>' + esc(tr('Course overview', 'Обзор курса')) + '</h2><p>' + esc(course.description || tr('No description yet.', 'Описание пока не добавлено.')) + '</p></div><button class="cr-primary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit details', 'Изменить данные')) + '</button></div><div class="cr-overview-grid">' + stat(tr('Status','Статус'),statusLabel(course.status)) + stat(tr('Language','Язык'),course.language || '—') + stat(tr('CEFR level','Уровень CEFR'),course.level || '—') + stat(tr('Price','Цена'),money(course)) + stat(tr('Students','Ученики'),course.studentCount) + stat(tr('Lessons','Уроки'),course.lessons.length) + '</div>';
    }
    // Zoom courses get the Business app's "add a Zoom lesson" form right in the schedule.
    function scheduleTab(course) {
      var head = '<div class="cr-panel-head"><div><h2>' + esc(tr('Schedule', 'Расписание')) + '</h2><p>' + esc(course.schedule || tr('No recurring schedule set.', 'Повторяющееся расписание не задано.')) + '</p></div><button class="cr-secondary" data-action="edit" data-id="' + esc(course.id) + '">' + esc(tr('Edit schedule', 'Изменить расписание')) + '</button></div>';
      var list = course.sessions.length ? '<div class="cr-session-list">' + course.sessions.map(function (row) { return '<article><span>' + icon('calendar') + '</span><div><b>' + esc(row.title || course.title) + '</b><p>' + esc(dateTime(row.starts_at)) + ' · ' + esc(String(row.duration_min || 60)) + ' ' + esc(tr('min', 'мин')) + '</p></div><em class="cr-status ' + esc(row.status) + '">' + esc(row.status || '') + '</em>' + (row.status === 'scheduled' ? '<a class="cr-secondary" href="./classroom.html?s=' + esc(row.id) + '">' + esc(tr('Prepare', 'Подготовить')) + '</a>' : '') + '</article>'; }).join('') + '</div>' : '';
      if (!course.zoom_enabled) return head + (list || emptyInline(tr('No classroom sessions', 'Нет занятий'), tr('Enable Zoom Classroom in course settings to create sessions.', 'Включите Zoom Classroom в настройках курса.')));
      if (!course.classRow) return head + '<div class="cr-zoom-add"><h3>Zoom Classroom</h3><p>' + esc(tr('The student group for Zoom lessons is not ready yet.', 'Группа учеников для Zoom-уроков ещё не создана.')) + '</p><button class="cr-primary" data-zoom-enable="' + esc(course.id) + '">' + esc(tr('Enable Zoom lessons', 'Включить Zoom-уроки')) + '</button></div>' + list;
      var draft = zoomLessonDraft && String(zoomLessonFor) === String(course.id) ? zoomLessonDraft : { title: course.title, starts_at: '', duration: 60 };
      var form = '<form class="cr-zoom-add" data-zoom-lesson="' + esc(course.id) + '"><h3>' + esc(course.sessions.length ? tr('Add Zoom lesson', 'Добавить Zoom-урок') : tr('Add your first Zoom lesson', 'Добавьте первый Zoom-урок')) + '</h3><p>' + esc(tr('Students of the course join from the app; you enter as the teacher.', 'Ученики курса входят из приложения, вы — как преподаватель.')) + '</p><div class="cr-field-grid three"><label class="cr-field"><span>' + esc(tr('Lesson title', 'Название урока')) + '</span><input name="title" maxlength="120" value="' + esc(draft.title || '') + '" required></label><label class="cr-field"><span>' + esc(tr('Date and time', 'Дата и время')) + '</span><input name="starts_at" type="datetime-local" value="' + esc(draft.starts_at || '') + '" required></label><label class="cr-field"><span>' + esc(tr('Lesson duration', 'Длительность одного урока')) + '</span><select name="duration">' + DURATIONS.filter(function (m) { return m <= 240; }).map(function (m) { return '<option value="' + m + '"' + (Number(draft.duration) === m ? ' selected' : '') + '>' + m + ' ' + esc(tr('min', 'мин')) + '</option>'; }).join('') + '</select></label></div>' + (zoomLessonNotice ? '<div class="cr-notice" role="alert">' + esc(zoomLessonNotice) + '</div>' : '') + '<button class="cr-primary" type="submit"' + (zoomLessonSaving ? ' disabled' : '') + '>' + esc(zoomLessonSaving ? tr('Saving…', 'Сохранение…') : tr('Add Zoom lesson', 'Добавить Zoom-урок')) + '</button></form>';
      return head + form + list;
    }
    async function enableCourseZoom(courseId) {
      var res = await safe(supa.rpc('create_course_zoom_class', { target_course: courseId }));
      if (res.error) { window.alert(res.error.message || tr('Could not enable Zoom lessons.', 'Не удалось включить Zoom-уроки.')); return; }
      await load(true);
    }
    async function addZoomLesson(form) {
      var course = data.courses.find(function (row) { return String(row.id) === String(form.dataset.zoomLesson); });
      if (!course || !course.classRow || zoomLessonSaving) return;
      var title = form.elements.title.value.trim(), when = form.elements.starts_at.value, duration = Number(form.elements.duration.value) || 60;
      zoomLessonFor = course.id; zoomLessonDraft = { title: title, starts_at: when, duration: duration }; zoomLessonNotice = '';
      var startsAt = when ? new Date(when) : null;
      if (!startsAt || isNaN(startsAt.getTime())) zoomLessonNotice = tr('Choose the date and time of the lesson.', 'Укажите дату и время урока.');
      else if (startsAt.getTime() < Date.now()) zoomLessonNotice = tr('The lesson time is in the past.', 'Время урока уже прошло.');
      if (zoomLessonNotice) { paint(); return; }
      zoomLessonSaving = true; paint();
      var res = await safe(supa.from('class_sessions').insert({
        class_id: course.classRow.id, title: title || tr('Zoom lesson', 'Zoom-урок'),
        starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + duration * 60000).toISOString(),
        join_opens_at: new Date(startsAt.getTime() - 30 * 60000).toISOString(), duration_min: duration,
        created_by: ctx.user.id, status: 'scheduled', provider: 'zoom',
        max_participants: Math.max(2, Math.min(25, Number(course.max_students) || 25)), waiting_room_enabled: true
      }));
      zoomLessonSaving = false;
      if (res.error) { zoomLessonNotice = res.error.message || tr('Could not add the lesson.', 'Не удалось добавить урок.'); paint(); return; }
      zoomLessonDraft = null; zoomLessonFor = null;
      await load(true);
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
      host.querySelectorAll('[data-zoom-enable]').forEach(function (button) { button.onclick = function () { button.disabled = true; void enableCourseZoom(button.dataset.zoomEnable); }; });
      host.querySelectorAll('form[data-zoom-lesson]').forEach(function (form) { form.onsubmit = function (event) { event.preventDefault(); void addZoomLesson(form); }; });
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

    // Same four steps, fields and saved columns as the Business app's create-course
    // screen (About the course → Language and level → Schedule → Price and format).
    function openWizard() {
      wizard = { step: 0, title: '', description: '', cover_image_url: '', teaching: [], explaining: [], levels: [], scheduleType: 'fixed', start_date: '', end_date: '', start_time: '', weekdays: [], duration: 60, total_lessons: '', format: 'online', zoom: true, max_students: '', pricing: 'free', price: '', currency: 'EUR' };
      notice = ''; wizardProfile = undefined; paintWizard(); void loadWizardProfile();
    }
    async function loadWizardProfile() {
      var res = await safe(supa.from('profiles').select('language,teaches_languages,explanation_languages').eq('id', ctx.user.id).maybeSingle());
      if (!wizard) return;
      wizardProfile = res.error ? null : (res.data || null);
      var declared = normalizeLanguages(wizardProfile && wizardProfile.teaches_languages);
      if (declared.length && !wizard.teaching.length) wizard.teaching = declared.slice(0, MAX_TEACHING_LANGUAGES);
      var native = normalizeLanguage(wizardProfile && wizardProfile.language);
      if (native && !wizard.explaining.length) wizard.explaining = [native];
      readWizard(); paintWizard();
    }
    function declaredLanguages() { return normalizeLanguages(wizardProfile && wizardProfile.teaches_languages); }
    function teachingChoices() { var declared = declaredLanguages(); return declared.length ? TEACHING_LANGUAGES.filter(function (l) { return declared.indexOf(l.key) >= 0; }) : TEACHING_LANGUAGES; }
    function explanationChoices() {
      if (wizardProfile === undefined) return [];
      var known = normalizeLanguages(wizardProfile && wizardProfile.explanation_languages).concat([normalizeLanguage(wizardProfile && wizardProfile.language)], declaredLanguages()).filter(Boolean);
      if (!known.length) return TEACHING_LANGUAGES;
      known = known.concat(wizard.explaining);
      return TEACHING_LANGUAGES.filter(function (l) { return known.indexOf(l.key) >= 0; });
    }
    function closeWizard() { if (saving) return; document.querySelector('.cr-wizard')?.remove(); wizard = null; document.body.classList.remove('modal-open'); }
    function wizardSteps() {
      return [
        [tr('About the course','О курсе'), tr('Course name and description','Название и описание курса')],
        [tr('Language and level','Язык и уровень'), tr('Who this course is for','Для кого создан курс')],
        [tr('Schedule','Расписание'), tr('When and how the course runs','Когда и как проходит курс')],
        [tr('Price and format','Цена и формат'), tr('Participants and price','Участники и стоимость')]
      ];
    }
    function weekdayNames() { return [tr('Mon','Пн'),tr('Tue','Вт'),tr('Wed','Ср'),tr('Thu','Чт'),tr('Fri','Пт'),tr('Sat','Сб'),tr('Sun','Вс')]; }
    function durationLabel(minutes) { return minutes < 60 ? minutes + ' ' + tr('min','мин') : minutes === 60 ? tr('1 hour','1 час') : minutes === 90 ? tr('1.5 hours','1,5 часа') : (minutes / 60) + ' ' + (minutes >= 300 ? tr('hours','часов') : tr('hours','часа')); }
    function formatLabel(key) { return ({ online: tr('Online','Онлайн'), offline: tr('In person','Очно'), hybrid: tr('Hybrid','Гибрид') })[key]; }
    function scheduleLabel(key) { return ({ fixed: tr('Specific date','Конкретная дата'), ongoing: tr('Ongoing','Постоянный'), flexible: tr('Flexible','Гибкий') })[key]; }
    function displayDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
    function languageName(key) { var item = TEACHING_LANGUAGES.find(function (l) { return l.key === key; }); return item ? item.flag + ' ' + item.label : key; }
    function readWizard() {
      var box = document.querySelector('.cr-wizard'); if (!box || !wizard) return;
      box.querySelectorAll('[data-field]').forEach(function (input) { wizard[input.dataset.field] = input.value; });
    }
    function validateStep() {
      readWizard(); notice = '';
      var s = wizard.step;
      if (s === 0 && !wizard.title.trim()) notice = tr('Enter the course name.', 'Введите название курса.');
      else if (s === 0 && !wizard.description.trim()) notice = tr('Add a course description.', 'Добавьте описание курса.');
      else if (s === 1 && !wizard.teaching.length) notice = tr('Choose at least one teaching language.', 'Выберите хотя бы один язык преподавания.');
      else if (s === 1 && !wizard.levels.length) notice = tr('Select at least one level.', 'Выберите хотя бы один уровень.');
      else if (s === 2 && wizard.scheduleType === 'fixed' && !wizard.start_date) notice = tr('Enter the start date.', 'Укажите дату начала.');
      else if (s === 2 && wizard.scheduleType === 'fixed' && wizard.end_date && wizard.end_date < wizard.start_date) notice = tr('The end date is before the start date.', 'Дата окончания раньше даты начала.');
      else if (s === 3 && wizard.pricing === 'paid' && !(Number(wizard.price) > 0)) notice = tr('Enter the price.', 'Укажите стоимость.');
      return !notice;
    }
    function field(id, label, type, placeholder, extra) { return '<label class="cr-field"><span>' + esc(label) + '</span><input data-field="' + id + '" type="' + (type || 'text') + '" value="' + esc(wizard[id] || '') + '" placeholder="' + esc(placeholder || '') + '"' + (extra || '') + '></label>'; }
    function block(title, body) { return '<section class="cr-wz-block"><h3>' + esc(title) + '</h3>' + body + '</section>'; }
    function tip(text) { return '<div class="cr-wz-tip">' + icon('star') + '<p>' + esc(text) + '</p></div>'; }
    function chip(attr, value, label, active, disabled) { return '<button type="button" class="cr-wz-chip' + (active ? ' active' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (active ? 'true' : 'false') + '"' + (disabled ? ' disabled' : '') + '>' + (active ? icon('check') : '') + '<span>' + esc(label) + '</span></button>'; }
    function stepper(field, value, placeholder) { return '<div class="cr-wz-counter"><button type="button" data-count="' + field + '" data-delta="-1" aria-label="−">−</button><input data-field="' + field + '" inputmode="numeric" value="' + esc(value) + '" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '"><button type="button" data-count="' + field + '" data-delta="1" aria-label="+">+</button></div>'; }
    function wizardBody() {
      var s = wizard.step;
      if (s === 0) {
        var importer = ctx.management && ctx.management.pickCourseExcel ? '<button type="button" class="cr-wz-import" data-import-excel>' + icon('upload') + '<span>' + esc(tr('Import courses from Excel','Загрузить курсы из Excel')) + '</span>' + icon('chevron') + '</button>' : '';
        return importer + tip(tr('Write clearly: outcome, lesson format, and who this course is for.','Пиши конкретно: результат, формат занятий и кому подходит курс.')) +
          block(tr('Course name','Название курса'), '<input class="cr-wz-input" data-field="title" maxlength="120" value="' + esc(wizard.title) + '" placeholder="' + esc(tr('Example: Conversational German B1','Например: Разговорный немецкий B1')) + '" aria-label="' + esc(tr('Course name','Название курса')) + '">') +
          block(tr('What students will learn','Что изучат студенты'), '<p class="cr-helper">' + esc(tr('Example: in 8 weeks students will speak confidently about daily topics, review grammar, and complete practice tasks after every lesson.','Пример: за 8 недель студенты научатся уверенно говорить на бытовые темы, разбирать грамматику и выполнять практические задания после каждого урока.')) + '</p><textarea class="cr-wz-input" data-field="description" maxlength="2000" placeholder="' + esc(tr('Describe the course goals, lesson topics, and learning outcomes...','Опишите цели курса, темы уроков и результат обучения...')) + '" aria-label="' + esc(tr('What students will learn','Что изучат студенты')) + '">' + esc(wizard.description) + '</textarea>') +
          block(tr('Course cover','Обложка курса'), '<button class="cr-upload" type="button" data-upload>' + (wizard.cover_image_url ? '<img src="' + esc(wizard.cover_image_url) + '" alt="">' : icon('upload') + '<b>' + esc(tr('Add course cover','Добавить обложку курса')) + '</b><span>' + esc(tr('JPG, PNG or WebP · 16:9','JPG, PNG или WebP · 16:9')) + '</span>') + '</button>' + (wizard.cover_image_url ? '<button type="button" class="cr-wz-link" data-remove-cover>' + esc(tr('Remove photo','Удалить фото')) + '</button>' : '') + '<input type="file" data-cover-file accept="image/jpeg,image/png,image/webp" hidden>');
      }
      if (s === 1) {
        var declared = declaredLanguages(), langHint = '';
        if (wizardProfile !== undefined && !declared.length) langHint = tr('You haven’t listed teaching languages in your profile yet. Add them under Profile so this list matches what you teach.','В твоём профиле пока не указано, какие языки ты преподаёшь. Добавь их в Профиле — тогда здесь появятся именно они.');
        else if (declared.length) langHint = tr('Only your declared teaching languages are shown ({1}). Update your profile to change this list.','Показаны только твои преподаваемые языки ({1}). Чтобы изменить — обнови профиль.').replace('{1}', declared.length);
        var explain = explanationChoices();
        return tip(tr('Choose the course language and every student level you can genuinely support.','Выбери язык курса и все уровни студентов, которым реально сможешь помочь.')) +
          block(tr('Teaching language','Язык обучения'), '<p class="cr-helper">' + esc(tr('Choose up to {1} languages · {2}/{1}','Выберите максимум {1} языка · {2}/{1}').replace(/\{1\}/g, MAX_TEACHING_LANGUAGES).replace('{2}', wizard.teaching.length)) + '</p>' + (langHint ? '<p class="cr-helper' + (declared.length ? '' : ' cr-wz-hint') + '">' + esc(langHint) + '</p>' : '') + '<div class="cr-wz-chips">' + teachingChoices().map(function (l) { var on = wizard.teaching.indexOf(l.key) >= 0; return chip('data-teach', l.key, l.flag + ' ' + l.label, on, !on && wizard.teaching.length >= MAX_TEACHING_LANGUAGES); }).join('') + '</div>') +
          block(tr('Explanation language','Язык объяснения') + ' (' + wizard.explaining.length + '/' + MAX_EXPLANATION_LANGUAGES + ')', explain.length ? '<div class="cr-wz-chips">' + explain.map(function (l) { var on = wizard.explaining.indexOf(l.key) >= 0; return chip('data-explain', l.key, l.flag + ' ' + l.label, on, !on && wizard.explaining.length >= MAX_EXPLANATION_LANGUAGES); }).join('') + '</div>' : '<p class="cr-helper">' + esc(tr('Loading…','Загрузка…')) + '</p>') +
          block(tr('Student levels (multiple allowed)','Уровень студентов (можно несколько)'), '<div class="cr-wz-levels">' + LEVELS.map(function (key) { var on = wizard.levels.indexOf(key) >= 0; return '<button type="button" class="cr-wz-level' + (on ? ' active' : '') + '" data-level="' + key + '" aria-pressed="' + on + '"><b>' + key + '</b><span>' + esc(levelDescription(key)) + '</span></button>'; }).join('') + '</div>' + (wizard.levels.length ? '<p class="cr-helper">' + esc(tr('Selected','Выбрано')) + ': ' + esc(orderedLevels().join(', ')) + '</p>' : ''));
      }
      if (s === 2) {
        var types = [['fixed', tr('A fixed start date','Фиксированная дата начала')], ['ongoing', tr('Subscription without a start date','По подписке, без даты')], ['flexible', tr('Students choose a time','Студент выбирает время')]];
        return tip(tr('If the schedule is not final yet, choose flexible and confirm days later.','Если расписание еще не финальное, выбери «Гибкий» и уточни дни позже.')) +
          block(tr('Schedule type','Тип расписания'), '<div class="cr-wz-options">' + types.map(function (t) { var on = wizard.scheduleType === t[0]; return '<button type="button" class="cr-wz-option' + (on ? ' active' : '') + '" data-schedule-type="' + t[0] + '" aria-pressed="' + on + '">' + icon('calendar') + '<b>' + esc(scheduleLabel(t[0])) + '</b><span>' + esc(t[1]) + '</span></button>'; }).join('') + '</div>') +
          (wizard.scheduleType === 'fixed' ? block(tr('Start date and time','Дата и время начала'), '<div class="cr-field-grid">' + field('start_date', tr('Start date','Дата начала'), 'date') + field('end_date', tr('End date (optional)','Дата окончания (необязательно)'), 'date') + '</div>' + field('start_time', tr('Time','Время'), 'time')) : '') +
          block(tr('Class days (optional)','Дни занятий (необязательно)'), '<div class="cr-wz-chips">' + weekdayNames().map(function (name, i) { return chip('data-weekday', i, name, wizard.weekdays.indexOf(i) >= 0); }).join('') + '</div>') +
          block(tr('Lesson duration','Длительность одного урока'), '<div class="cr-wz-chips">' + DURATIONS.map(function (m) { return chip('data-duration', m, durationLabel(m), Number(wizard.duration) === m); }).join('') + '</div>') +
          block(tr('Number of lessons','Количество уроков в курсе'), stepper('total_lessons', wizard.total_lessons, '∞') + '<p class="cr-helper">' + esc(wizard.total_lessons ? tr('{count} lessons in the course','{count} уроков в курсе').replace('{count}', wizard.total_lessons) : tr('Unlimited','Без ограничений')) + '</p>');
      }
      var zoomBlock = wizard.format !== 'offline' ? block(tr('Zoom lessons','Zoom-уроки'), '<button type="button" class="cr-wz-zoom' + (wizard.zoom ? ' active' : '') + '" data-zoom aria-pressed="' + wizard.zoom + '">' + icon('users') + '<span><b>Zoom Classroom</b><em>' + esc(tr('Lessons happen right in the app: student group, teacher entry, attendance and materials.','Уроки проходят прямо в приложении: группа учеников, вход учителем, посещаемость и материалы.')) + '</em></span><i>' + (wizard.zoom ? icon('check') : '') + '</i></button>' + (wizard.zoom ? '<p class="cr-helper">' + esc(tr('After creating the course the schedule opens — add your first Zoom lesson.','После создания курса откроется расписание — добавьте первый Zoom-урок.')) + '</p>' : '')) : '';
      var summary = [
        ['book', wizard.title || '—'],
        ['grid', wizard.teaching.map(languageName).join(', ') || '—'],
        ['star', wizard.levels.length ? orderedLevels().join(', ') : tr('Any level','Любой уровень')],
        ['calendar', wizard.scheduleType === 'fixed' && wizard.start_date ? tr('Start: {date}','Старт: {date}').replace('{date}', displayDate(wizard.start_date)) : scheduleLabel(wizard.scheduleType)]
      ];
      if (wizard.scheduleType === 'fixed' && wizard.end_date) summary.push(['calendar', tr('Ends: {1}','Окончание: {1}').replace('{1}', displayDate(wizard.end_date))]);
      if (wizard.weekdays.length) summary.push(['list', orderedWeekdays().map(function (d) { return weekdayNames()[d]; }).join(', ')]);
      summary.push(['users', formatLabel(wizard.format) + (zoomOn() ? ' · Zoom Classroom' : '')]);
      summary.push(['coins', wizard.pricing === 'paid' && wizard.price ? (wizard.currency === 'USD' ? '$' : '€') + wizard.price : tr('Free','Бесплатно')]);
      return tip(tr('Before creating, check format, price, and student limit. Students will see this.','Перед созданием проверь формат, цену и лимит студентов. Это увидят ученики.')) +
        block(tr('Course format','Формат проведения'), '<div class="cr-wz-options three">' + ['online','offline','hybrid'].map(function (key) { var on = wizard.format === key; return '<button type="button" class="cr-wz-option' + (on ? ' active' : '') + '" data-format="' + key + '" aria-pressed="' + on + '"><b>' + esc(formatLabel(key)) + '</b></button>'; }).join('') + '</div>') +
        zoomBlock +
        block(tr('Max. students','Макс. студентов'), stepper('max_students', wizard.max_students, '∞') + '<p class="cr-helper">' + esc(wizard.max_students ? tr('{count} students','{count} студентов').replace('{count}', wizard.max_students) : tr('Unlimited','Без ограничений')) + '</p>') +
        block(tr('Course price','Стоимость курса'), '<div class="cr-wz-options">' + [['free', tr('Free','Бесплатно')], ['paid', tr('Paid','Платно')]].map(function (p) { var on = wizard.pricing === p[0]; return '<button type="button" class="cr-wz-option' + (on ? ' active' : '') + '" data-pricing="' + p[0] + '" aria-pressed="' + on + '">' + icon(p[0] === 'free' ? 'star' : 'coins') + '<b>' + esc(p[1]) + '</b></button>'; }).join('') + '</div>' +
          (wizard.pricing === 'paid' ? '<div class="cr-wz-price"><div class="cr-wz-chips">' + ['EUR','USD'].map(function (c) { return chip('data-currency', c, c === 'EUR' ? '€ EUR' : '$ USD', wizard.currency === c); }).join('') + '</div>' + field('price', tr('Amount','Сумма'), 'number', '0.00', ' min="0" step="0.01"') + '</div>' : '')) +
        '<section class="cr-wz-summary"><h3>' + esc(tr('Course summary','Итог курса')) + '</h3>' + summary.map(function (row) { return '<p>' + icon(row[0]) + '<span>' + esc(row[1]) + '</span></p>'; }).join('') + '</section>';
    }
    function orderedLevels() { return LEVELS.filter(function (key) { return wizard.levels.indexOf(key) >= 0; }); }
    function orderedWeekdays() { return [0,1,2,3,4,5,6].filter(function (d) { return wizard.weekdays.indexOf(d) >= 0; }); }
    function levelDescription(key) { return ({ A1: tr('Beginner','Начинающий'), A2: tr('Elementary','Элементарный'), B1: tr('Intermediate','Средний'), B2: tr('Upper intermediate','Выше среднего'), C1: tr('Advanced','Продвинутый'), C2: tr('Mastery','Мастерство') })[key]; }
    function zoomOn() { return !!wizard.zoom && wizard.format !== 'offline'; }
    function toggleIn(list, value, max) { var i = list.indexOf(value); if (i >= 0) list.splice(i, 1); else if (!max || list.length < max) list.push(value); }
    function paintWizard() {
      if (!wizard) return;
      var overlay = document.querySelector('.cr-wizard'); if (!overlay) { overlay = document.createElement('div'); overlay.className = 'cr-wizard'; document.body.appendChild(overlay); }
      document.body.classList.add('modal-open'); var steps = wizardSteps(), last = steps.length - 1;
      overlay.innerHTML = '<div class="cr-wizard-card" role="dialog" aria-modal="true" aria-labelledby="crWizardTitle"><header><div><span class="cr-eyebrow">' + esc(tr('Create course','Создать курс')) + ' · ' + esc(tr('Step {1} of {2}','Шаг {1} из {2}').replace('{1}', wizard.step + 1).replace('{2}', steps.length)) + '</span><h2 id="crWizardTitle">' + esc(steps[wizard.step][0]) + '</h2><p class="cr-wz-sub">' + esc(steps[wizard.step][1]) + '</p></div><button data-wizard-close aria-label="' + esc(tr('Close','Закрыть')) + '">' + icon('close') + '</button></header><div class="cr-stepper">' + steps.map(function (label,i) { return '<button type="button" class="' + (i === wizard.step ? 'active' : i < wizard.step ? 'done' : '') + '" data-step-jump="' + i + '"' + (i > wizard.step ? ' disabled' : '') + (i === wizard.step ? ' aria-current="step"' : '') + '><span>' + (i < wizard.step ? icon('check') : i + 1) + '</span><em>' + esc(label[0]) + '</em></button>'; }).join('') + '</div><main>' + wizardBody() + (notice ? '<div class="cr-notice" role="alert">' + esc(notice) + '</div>' : '') + '</main><footer><button class="cr-secondary" data-prev>' + esc(wizard.step ? tr('Back','Назад') : tr('Cancel','Отмена')) + '</button><button class="cr-primary" data-next' + (saving ? ' disabled' : '') + '>' + esc(saving ? tr('Saving…','Сохранение…') : wizard.step === last ? tr('Create course','Создать курс') : tr('Next','Далее')) + (wizard.step === last ? '' : icon('arrow')) + '</button></footer></div>';
      overlay.querySelector('[data-wizard-close]').onclick = closeWizard;
      overlay.onclick = function (e) { if (e.target === overlay) closeWizard(); };
      overlay.querySelector('[data-prev]').onclick = function () { if (!wizard.step) { closeWizard(); return; } readWizard(); wizard.step--; notice=''; paintWizard(); };
      overlay.querySelector('[data-next]').onclick = function () { if (!validateStep()) { paintWizard(); return; } if (wizard.step < last) { wizard.step++; paintWizard(); overlay.querySelector('main').scrollTop = 0; } else void saveWizard(); };
      overlay.querySelectorAll('[data-step-jump]').forEach(function (button) { button.onclick = function () { readWizard(); wizard.step = Number(button.dataset.stepJump); notice=''; paintWizard(); }; });
      function on(selector, handler) { overlay.querySelectorAll(selector).forEach(function (button) { button.onclick = function () { readWizard(); handler(button); notice=''; paintWizard(); }; }); }
      on('[data-teach]', function (b) { toggleIn(wizard.teaching, b.dataset.teach, MAX_TEACHING_LANGUAGES); });
      on('[data-explain]', function (b) { toggleIn(wizard.explaining, b.dataset.explain, MAX_EXPLANATION_LANGUAGES); });
      on('[data-level]', function (b) { toggleIn(wizard.levels, b.dataset.level); });
      on('[data-schedule-type]', function (b) { wizard.scheduleType = b.dataset.scheduleType; });
      on('[data-weekday]', function (b) { toggleIn(wizard.weekdays, Number(b.dataset.weekday)); });
      on('[data-duration]', function (b) { wizard.duration = Number(b.dataset.duration); });
      on('[data-format]', function (b) { wizard.format = b.dataset.format; });
      on('[data-zoom]', function () { wizard.zoom = !wizard.zoom; });
      on('[data-pricing]', function (b) { wizard.pricing = b.dataset.pricing; });
      on('[data-currency]', function (b) { wizard.currency = b.dataset.currency; });
      on('[data-remove-cover]', function () { wizard.cover_image_url = ''; });
      on('[data-count]', function (b) { var key = b.dataset.count; wizard[key] = String(Math.max(1, (parseInt(wizard[key], 10) || 0) + Number(b.dataset.delta))); });
      var importer = overlay.querySelector('[data-import-excel]'); if (importer) importer.onclick = function () { closeWizard(); ctx.management.pickCourseExcel(); };
      var upload = overlay.querySelector('[data-upload]'), file = overlay.querySelector('[data-cover-file]'); if (upload && file) { upload.onclick = function () { file.click(); }; file.onchange = function () { var selected = file.files && file.files[0]; if (selected) { readWizard(); void uploadWizardCover(selected); } }; }
    }
    async function uploadWizardCover(file) { notice = tr('Uploading cover…','Загрузка обложки…'); paintWizard(); try { wizard.cover_image_url = await ctx.uploadToBucket('posts', file); notice=''; } catch (e) { notice = e.message || tr('Could not upload the cover.','Не удалось загрузить обложку.'); } paintWizard(); }
    function scheduleNote() {
      var parts = [];
      if (wizard.scheduleType === 'fixed' && wizard.start_date) parts.push('📅 ' + tr('Start: {date}','Старт: {date}').replace('{date}', displayDate(wizard.start_date) + (wizard.start_time ? ' ' + wizard.start_time : '')));
      if (wizard.scheduleType !== 'fixed') parts.push('📅 ' + scheduleLabel(wizard.scheduleType));
      if (wizard.weekdays.length) parts.push('🗓️ ' + orderedWeekdays().map(function (d) { return weekdayNames()[d]; }).join(', '));
      if (wizard.total_lessons) parts.push('📖 ' + tr('{count} lessons in the course','{count} уроков в курсе').replace('{count}', wizard.total_lessons));
      return parts.join('\n');
    }
    async function saveWizard() {
      readWizard(); saving = true; notice=''; paintWizard();
      var org = ctx.state && ctx.state.myOrg; if (!org && ctx.management && ctx.management.ensureOrg) org = await ctx.management.ensureOrg();
      if (!org) { saving=false; notice=tr('Could not prepare your teaching workspace.','Не удалось подготовить кабинет преподавателя.'); paintWizard(); return; }
      var levelText = orderedLevels().join(', ') || tr('Any level','Любой уровень');
      var formatNote = (wizard.format === 'online' ? '💻 ' : '🏫 ') + formatLabel(wizard.format);
      var note = scheduleNote(), zoom = zoomOn(), maxStudents = parseInt(wizard.max_students, 10);
      var row = {
        organization_id: org.id, created_by: ctx.user.id, title: wizard.title.trim(),
        description: [wizard.description.trim(), '\n' + levelText, formatNote, note].filter(Boolean).join('\n'),
        cover_image_url: wizard.cover_image_url || null,
        language: wizard.teaching.join(', '), level: levelText,
        explanation_language: wizard.explaining[0] || null, explanation_languages: wizard.explaining.length ? wizard.explaining.slice() : null,
        starts_on: wizard.scheduleType === 'fixed' ? wizard.start_date || null : null,
        ends_on: wizard.scheduleType === 'fixed' ? wizard.end_date || null : null,
        schedule: note || wizard.scheduleType,
        note: [formatNote, Number(wizard.duration) + ' min', maxStudents > 0 ? 'Max students: ' + maxStudents : null, zoom ? 'Zoom Classroom' : null].filter(Boolean).join(' · '),
        price: wizard.pricing === 'paid' ? Number(wizard.price) : 0, currency: wizard.pricing === 'paid' ? wizard.currency : null,
        zoom_enabled: zoom, delivery_mode: zoom ? (wizard.format === 'hybrid' ? 'mixed' : 'zoom_group') : 'self_paced',
        max_students: maxStudents > 0 ? maxStudents : 25, timezone: 'Europe/Berlin'
      };
      var result = await supa.from('courses').insert(row).select('id').single();
      if (result.error) { saving=false; notice=tr('Could not create the course. Please try again.','Не удалось создать курс. Попробуйте снова.') + (result.error.message ? ' (' + result.error.message + ')' : ''); paintWizard(); return; }
      var zoomReady = false;
      if (zoom) { var zoomRes = await safe(supa.rpc('create_course_zoom_class', { target_course: result.data.id })); zoomReady = !zoomRes.error; if (zoomRes.error) console.warn('Zoom classroom was not enabled for the new course.', zoomRes.error); }
      zoomLessonFor = result.data.id; zoomLessonDraft = zoomReady ? { title: wizard.title.trim(), starts_at: wizard.start_date && wizard.start_time ? wizard.start_date + 'T' + wizard.start_time : '', duration: Number(wizard.duration) || 60 } : null;
      saving=false; closeWizard(); await load(true); selectedId=result.data.id; manageTab = zoomReady ? 'schedule' : 'overview'; paint();
    }

    function render() {
      host = document.querySelector('[data-panel="courses"]'); if (!host) return;
      var uid = ctx.user && ctx.user.id; if (!data || loadedFor !== uid) { void load(true); } else paint();
    }
    return { render: render, reload: function () { return load(true); } };
  }

  window.DuvelaCourses4 = { create: createCourses4, __test: { statusKey: statusKey, isFree: isFree, filterCourses: filterCourses, sortCourses: sortCourses, normalizeLanguages: normalizeLanguages } };
})();
