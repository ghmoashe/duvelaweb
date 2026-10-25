(function () {
  'use strict';

  var AUDITED_QA_IDS = new Set([
    'ff941975-3029-43f4-8bb4-746494f1a4d8',
    'b9b04e70-684f-4274-aa26-bc56f4c70bbf'
  ]);
  var COURSE_FIELDS_LEGACY = 'id,title,description,language,level,status,price,currency,starts_on,ends_on,schedule,location,delivery_mode,zoom_enabled,max_students,cover_image_url,explanation_language,explanation_languages,created_by,created_at';
  var COURSE_FIELDS = COURSE_FIELDS_LEGACY + ',enrollment_open,enrollment_requires_approval';
  var COURSE_FIELDS_V5 = COURSE_FIELDS + ',is_test';
  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M8 7h7"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.book) + '</svg>'; }
  function normalize(value) { return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' '); }
  function isFree(course) { return course.price == null || Number(course.price) === 0; }
  function publicCourse(course) { return course && course.status === 'active' && course.is_test !== true && !AUDITED_QA_IDS.has(String(course.id)); }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))).sort(); }
  function safeText(value) { return Array.isArray(value) ? value.join(', ') : String(value || ''); }

  function learnerContext(ctx) {
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem('duvela.study.preferences') || '{}'); } catch (_) {}
    var profile = ctx.profile || {};
    var languages = stored.languages || profile.learning_languages || profile.teaches_languages || [];
    if (!Array.isArray(languages)) languages = String(languages || '').split(',');
    return {
      language: normalize(languages[0] || stored.language || profile.learning_language || profile.language || ''),
      level: String(stored.level || profile.current_level || profile.language_level || '').toUpperCase().match(/[ABC][12]/)?.[0] || '',
      target: String(stored.targetLevel || profile.goal_level || profile.target_level || '').toUpperCase().match(/[ABC][12]/)?.[0] || ''
    };
  }

  function installPublicDataLoader() {
    if (!window.DuvelaAppPublicData || window.DuvelaAppPublicData.__courses5) return;
    var original = window.DuvelaAppPublicData.create;
    window.DuvelaAppPublicData.create = function (ctx) {
      var feature = original(ctx), baseLoad = feature.loadPublicData;
      feature.loadPublicData = async function () {
        if (!ctx.isBusiness()) ctx.state.courseCatalogStatus = 'loading';
        await baseLoad();
        if (ctx.isBusiness()) return;
        var result;
        try {
          result = await ctx.supa.from('courses').select(COURSE_FIELDS_V5).eq('status', 'active').eq('is_test', false).order('created_at', { ascending: false }).limit(60);
          if (result.error) result = await ctx.supa.from('courses').select(COURSE_FIELDS).eq('status', 'active').order('created_at', { ascending: false }).limit(60);
          // Production may temporarily run before the Course Detail 5.1 migration.
          // Retain a read-only legacy path so new optional fields never hide the catalogue.
          if (result.error) result = await ctx.supa.from('courses').select(COURSE_FIELDS_LEGACY).eq('status', 'active').order('created_at', { ascending: false }).limit(60);
          if (result.error) throw result.error;
          var courses = (result.data || []).filter(publicCourse);
          var ownerIds = unique(courses.map(function (course) { return course.created_by; }));
          var profiles = [];
          if (ownerIds.length) {
            var profileResult = await window.DuvelaWebConfig.publicProfiles(ctx.supa, 'id,full_name,avatar_url,specialization,is_verified').in('id', ownerIds);
            profiles = profileResult.error ? [] : (profileResult.data || []);
          }
          var profileMap = new Map(profiles.map(function (profile) { return [String(profile.id), profile]; }));
          var lessons = [];
          if (courses.length) {
            var lessonResult = await ctx.supa.from('course_lessons').select('id,course_id,title,description,order_index').in('course_id', courses.map(function (course) { return course.id; })).order('order_index', { ascending: true });
            if (!lessonResult.error) lessons = lessonResult.data || [];
          }
          courses.forEach(function (course) {
            course.image = course.cover_image_url || '';
            course.teacher = profileMap.get(String(course.created_by)) || null;
            course.lessons = lessons.filter(function (lesson) { return String(lesson.course_id) === String(course.id); });
            course.lesson_count = course.lessons.length;
            course.is_free = isFree(course);
          });
          ctx.state.courses = courses;
          ctx.state.courseCatalogStatus = 'ready';
          ctx.state.courseCatalogError = '';
          ctx.state.courseCatalogAuditedQaCount = 2;
        } catch (error) {
          ctx.state.courseCatalogStatus = 'error';
          ctx.state.courseCatalogError = error && error.message || 'Course catalogue could not be loaded.';
          ctx.state.courses = [];
        }
      };
      return feature;
    };
    window.DuvelaAppPublicData.__courses5 = true;
  }

  function installCatalog() {
    if (!window.DuvelaAppCatalog || window.DuvelaAppCatalog.__courses5) return;
    var original = window.DuvelaAppCatalog.create;
    window.DuvelaAppCatalog.create = function (ctx) {
      var base = original(ctx), state = ctx.state, esc = ctx.esc, tr = ctx.tr, supa = ctx.supa, alertUser = ctx.alert;
      var baseLoadEnrollments = base.loadEnrollments;
      var filters = { query: '', language: '', level: '', price: 'all', format: '', sort: 'recommended', saved: false };
      var visibleCount = 12;
      var detailReturnFocus = null;
      var detailAccessibilityInstalled = false;

      function formatMoney(course) {
        if (isFree(course)) return tr('Free', 'Бесплатно');
        try { return new Intl.NumberFormat(ctx.isRu ? 'ru-RU' : 'en-US', { style: 'currency', currency: course.currency || 'EUR', maximumFractionDigits: 2 }).format(Number(course.price)); }
        catch (_) { return Number(course.price).toFixed(2) + ' ' + (course.currency || 'EUR'); }
      }
      function formatDate(value) {
        if (!value) return '';
        var date = new Date(value + (String(value).length === 10 ? 'T12:00:00' : ''));
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      function displayLanguage(course) {
        return safeText(course.language).split(',').map(function (part) { return part.trim(); }).filter(Boolean).join(' · ') || tr('Language not specified', 'Язык не указан');
      }
      function formatKey(course) {
        var key = normalize(course && course.delivery_mode);
        if (key === 'offline' || key === 'in person' || key === 'inperson') return 'offline';
        if ((course && course.zoom_enabled) || key === 'online' || key === 'zoom group' || key === 'mixed' || key === 'self paced') return 'online';
        return '';
      }
      function formatLabel(course) {
        var key = formatKey(course);
        if (key === 'online') return tr('Online', 'Онлайн');
        if (key === 'offline') return tr('Offline', 'Офлайн');
        return tr('Format not specified', 'Формат не указан');
      }
      function description(course) {
        var scheduleLines = new Set(String(course.schedule || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean));
        var lines = String(course.description || '').split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).filter(function (line) {
          return !scheduleLines.has(line) && !/^(?:[ABC][12]|💻\s*Онлайн)$/i.test(line);
        });
        return lines.join(' ').trim();
      }
      function hasPublicDescription(text) {
        var value = String(text || '').trim();
        return value.length >= 32 && /[\p{L}\p{N}]/u.test(value);
      }
      function formatDateTime(value) {
        if (!value) return '';
        var date = new Date(value);
        return isNaN(date.getTime()) ? '' : date.toLocaleString(ctx.isRu ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' });
      }
      function hasPassed(value) {
        if (!value) return false;
        var date = new Date(value + (String(value).length === 10 ? 'T23:59:59' : ''));
        return !isNaN(date.getTime()) && date.getTime() < Date.now();
      }
      function safeAvatar(course) {
        var teacher = course.teacher || {}, name = teacher.full_name || tr('Duvela teacher', 'Преподаватель Duvela');
        var fallback = '<span>' + esc(name.charAt(0).toUpperCase() || 'D') + '</span>';
        return teacher.avatar_url ? '<img src="' + esc(teacher.avatar_url) + '" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>' + esc(name.charAt(0).toUpperCase() || 'D') + '</span>' : fallback;
      }
      function cover(course) {
        var url = course.cover_image_url || course.image;
        return url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="lc-cover-fallback" hidden><span>DUVELA</span><b>' + esc(course.level || 'COURSE') + '</b></div>' : '<div class="lc-cover-fallback"><span>DUVELA</span><b>' + esc(course.level || 'COURSE') + '</b></div>';
      }
      function enrollmentStatus(id) { return state.courseEnrollmentStatus instanceof Map ? state.courseEnrollmentStatus.get(String(id)) : (state.enrolledIds && state.enrolledIds.has(id) ? 'confirmed' : ''); }
      function actionLabel(course) {
        var status = enrollmentStatus(course.id);
        if (status === 'confirmed') return tr('Continue Learning', 'Продолжить обучение');
        if (status === 'pending') return tr('Enrollment pending', 'Запись на рассмотрении');
        if (course.status === 'closed') return tr('Enrollment closed', 'Набор закрыт');
        if (course.status === 'completed') return tr('Course completed', 'Курс завершён');
        if (!isFree(course)) return tr('View course', 'Подробнее');
        return tr('Enroll for Free', 'Записаться бесплатно');
      }
      function matchesContext(course, context) {
        return !!(context.language && context.level && normalize(course.language).includes(context.language) && String(course.level || '').toUpperCase() === context.level);
      }
      function card(course, index) {
        var saved = state.savedCourseIds instanceof Set && state.savedCourseIds.has(String(course.id));
        var teacher = course.teacher || {}, desc = description(course);
        var facts = [];
        if (course.lesson_count) facts.push(course.lesson_count + ' ' + tr('lessons', 'уроков'));
        if (course.schedule) facts.push(String(course.schedule).split(/\r?\n/)[0].replace(/^📅\s*/, ''));
        return '<article class="lc-card" data-course="' + esc(course.id) + '" tabindex="0" aria-label="' + esc(tr('Open course: ', 'Открыть курс: ') + (course.title || '')) + '">' +
          '<div class="lc-cover">' + cover(course) + '<div class="lc-badges"><span>' + esc(displayLanguage(course)) + '</span>' + (course.level ? '<span>' + esc(course.level) + '</span>' : '') + '</div>' +
          '<button class="lc-save' + (saved ? ' active' : '') + '" type="button" data-course-save="' + esc(course.id) + '" aria-label="' + esc(saved ? tr('Remove from saved', 'Удалить из сохранённых') : tr('Save course', 'Сохранить курс')) + '">' + icon('heart') + '</button></div>' +
          '<div class="lc-body"><div class="lc-teacher"><button type="button" data-course-teacher="' + esc(course.created_by || '') + '"><i>' + safeAvatar(course) + '</i><span><small>' + esc(tr('Teacher', 'Преподаватель')) + '</small><b>' + esc(teacher.full_name || tr('Duvela teacher', 'Преподаватель Duvela')) + '</b></span></button>' + (teacher.is_verified ? '<em>' + icon('check') + esc(tr('Verified', 'Проверен')) + '</em>' : '') + '</div>' +
          '<h3>' + esc(course.title || tr('Course', 'Курс')) + '</h3><p>' + esc(desc || tr('Open the course to review its programme and learning format.', 'Откройте курс, чтобы посмотреть программу и формат обучения.')) + '</p>' +
          '<div class="lc-meta"><span>' + icon('book') + esc(formatLabel(course)) + '</span>' + facts.slice(0, 2).map(function (fact) { return '<span>' + icon(fact === facts[0] && course.lesson_count ? 'book' : 'calendar') + esc(fact) + '</span>'; }).join('') + '</div>' +
          '<footer><strong>' + esc(formatMoney(course)) + '</strong><button type="button" data-course-open="' + esc(course.id) + '">' + esc(actionLabel(course)) + icon('arrow') + '</button></footer></div></article>';
      }
      function filteredCourses() {
        var context = learnerContext(ctx), saved = state.savedCourseIds instanceof Set ? state.savedCourseIds : new Set();
        var list = (state.courses || []).filter(publicCourse).filter(function (course) {
          var haystack = [course.title, description(course), course.language, course.level, course.delivery_mode, course.teacher && course.teacher.full_name].filter(Boolean).join(' ').toLowerCase();
          return (!filters.query || haystack.includes(filters.query)) &&
            (!filters.language || normalize(course.language).includes(normalize(filters.language))) &&
            (!filters.level || String(course.level || '').toUpperCase() === filters.level) &&
            (filters.price === 'all' || (filters.price === 'free' ? isFree(course) : !isFree(course))) &&
            (!filters.format || formatKey(course) === filters.format) &&
            (!filters.saved || saved.has(String(course.id)));
        });
        return list.sort(function (a, b) {
          if (filters.sort === 'price-low') return Number(a.price || 0) - Number(b.price || 0);
          if (filters.sort === 'price-high') return Number(b.price || 0) - Number(a.price || 0);
          if (filters.sort === 'newest') return Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0);
          return Number(matchesContext(b, context)) - Number(matchesContext(a, context)) || Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0);
        });
      }
      function selectOptions(values, selected, emptyLabel) {
        return '<option value="">' + esc(emptyLabel) + '</option>' + values.map(function (value) { return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(value) + '</option>'; }).join('');
      }
      function renderCourses() {
        if (ctx.isBusiness()) return base.renderCourses();
        var host = ctx.$('#courseList'), head = document.querySelector('[data-panel="courses"] .section-head');
        if (!host) return;
        if (head) head.style.display = 'none';
        var courses = (state.courses || []).filter(publicCourse), list = filteredCourses(), context = learnerContext(ctx);
        var recommended = courses.filter(function (course) { return matchesContext(course, context); });
        var languages = unique(courses.flatMap(function (course) { return safeText(course.language).split(',').map(function (x) { return x.trim(); }); }));
        var levels = unique(courses.map(function (course) { return course.level; }));
        var contextLabel = [context.language && context.language.replace(/\b\w/g, function (c) { return c.toUpperCase(); }), context.level].filter(Boolean).join(' · ');
        var status = state.courseCatalogStatus;
        var content;
        if (status === 'loading') content = '<section class="lc-state"><span class="lc-spinner"></span><h2>' + esc(tr('Loading published courses…', 'Загружаем опубликованные курсы…')) + '</h2></section>';
        else if (status === 'error') content = '<section class="lc-state error"><b>!</b><h2>' + esc(tr('Courses could not be loaded', 'Не удалось загрузить курсы')) + '</h2><p>' + esc(tr('The catalogue request failed. Your enrollments were not changed.', 'Запрос каталога завершился ошибкой. Ваши записи не изменены.')) + '</p><button data-course-retry>' + esc(tr('Retry', 'Повторить')) + '</button></section>';
        else if (!courses.length) content = '<section class="lc-state"><span>' + icon('book') + '</span><h2>' + esc(tr('No published courses yet', 'Опубликованных курсов пока нет')) + '</h2><p>' + esc(tr('Please return later or explore Practice while teachers prepare new programmes.', 'Вернитесь позже или откройте Practice, пока преподаватели готовят программы.')) + '</p><a href="#workspace" data-go="workspace">' + esc(tr('Back to Practice', 'В Practice')) + '</a></section>';
        else content = (recommended.length ? '<section class="lc-recommended"><div><small>' + esc(tr('MATCHES YOUR LEARNING SETUP', 'ПОДХОДИТ ВАШЕЙ УЧЕБНОЙ ЦЕЛИ')) + '</small><h2>' + esc(tr('Recommended for your level', 'Рекомендуем для вашего уровня')) + '</h2></div><span>' + esc(contextLabel) + '</span></section>' : '') +
          '<section class="lc-results-head"><div><h2>' + esc(filters.saved ? tr('Saved Courses', 'Сохранённые курсы') : tr('Browse All Courses', 'Все курсы')) + '</h2><p>' + esc(list.length + ' ' + tr('matching courses', 'подходящих курсов')) + '</p></div></section>' +
          (list.length ? '<section class="lc-grid">' + list.slice(0, visibleCount).map(card).join('') + '</section>' + (list.length > visibleCount ? '<button class="lc-load-more" data-course-more>' + esc(tr('Load more courses', 'Показать ещё')) + '</button>' : '') : '<section class="lc-state compact"><span>' + icon(filters.saved ? 'heart' : 'search') + '</span><h2>' + esc(filters.saved ? tr('No saved courses', 'Нет сохранённых курсов') : tr('No courses match these filters', 'По этим фильтрам курсов нет')) + '</h2><p>' + esc(filters.saved ? tr('Save a course to find it here after the server confirms the change.', 'Сохраните курс — он появится здесь после подтверждения сервером.') : tr('Change or clear the filters to see more courses.', 'Измените или сбросьте фильтры.')) + '</p><button data-course-clear>' + esc(tr('Clear filters', 'Сбросить фильтры')) + '</button></section>');
        host.innerHTML = '<div class="lc-page"><header class="lc-header"><div><small>DUVELA HUB / LEARNING</small><h1>' + esc(tr('Explore Courses', 'Каталог курсов')) + '</h1><p>' + esc(tr('Find a structured programme, understand who teaches it and review every condition before enrolling.', 'Найдите подходящую программу, преподавателя и изучите все условия до записи.')) + '</p></div>' + (contextLabel ? '<span>' + esc(contextLabel) + '</span>' : '') + '</header>' +
          '<section class="lc-toolbar"><label class="lc-search">' + icon('search') + '<input type="search" data-lc-filter="query" value="' + esc(filters.query) + '" placeholder="' + esc(tr('Search courses, topics or teachers…', 'Поиск курсов, тем или преподавателей…')) + '"></label><button class="lc-filter-button" data-lc-filter-toggle>' + icon('filter') + esc(tr('Filters', 'Фильтры')) + '</button><div class="lc-filters" data-lc-filters>' +
          '<select data-lc-filter="language">' + selectOptions(languages, filters.language, tr('All languages', 'Все языки')) + '</select><select data-lc-filter="level">' + selectOptions(levels, filters.level, tr('All levels', 'Все уровни')) + '</select>' +
          '<select data-lc-filter="price"><option value="all">' + esc(tr('Free & paid', 'Бесплатные и платные')) + '</option><option value="free"' + (filters.price === 'free' ? ' selected' : '') + '>' + esc(tr('Free', 'Бесплатные')) + '</option><option value="paid"' + (filters.price === 'paid' ? ' selected' : '') + '>' + esc(tr('Paid', 'Платные')) + '</option></select>' +
          '<select data-lc-filter="format"><option value="">' + esc(tr('Any format', 'Любой формат')) + '</option><option value="online"' + (filters.format === 'online' ? ' selected' : '') + '>' + esc(tr('Online', 'Онлайн')) + '</option><option value="offline"' + (filters.format === 'offline' ? ' selected' : '') + '>' + esc(tr('Offline', 'Офлайн')) + '</option></select><select data-lc-filter="sort"><option value="recommended">' + esc(tr('Recommended', 'Рекомендуемые')) + '</option><option value="newest"' + (filters.sort === 'newest' ? ' selected' : '') + '>' + esc(tr('Newest', 'Сначала новые')) + '</option><option value="price-low"' + (filters.sort === 'price-low' ? ' selected' : '') + '>' + esc(tr('Lowest price', 'Сначала дешевле')) + '</option><option value="price-high"' + (filters.sort === 'price-high' ? ' selected' : '') + '>' + esc(tr('Highest price', 'Сначала дороже')) + '</option></select>' +
          '<button class="lc-saved-filter' + (filters.saved ? ' active' : '') + '" data-lc-saved>' + icon('heart') + esc(tr('Saved', 'Сохранённые')) + '</button></div></section>' + content + '</div>';
        bindPage(host);
      }
      function bindPage(host) {
        var search = host.querySelector('[data-lc-filter="query"]');
        if (search) search.oninput = function () { filters.query = search.value.trim().toLowerCase(); visibleCount = 12; renderCourses(); requestAnimationFrame(function () { var next = ctx.$('[data-lc-filter="query"]'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); } }); };
        host.querySelectorAll('select[data-lc-filter]').forEach(function (select) { select.onchange = function () { filters[select.dataset.lcFilter] = select.value; visibleCount = 12; renderCourses(); }; });
        var toggle = host.querySelector('[data-lc-filter-toggle]'), panel = host.querySelector('[data-lc-filters]');
        if (toggle && panel) toggle.onclick = function () { panel.classList.toggle('open'); };
        var saved = host.querySelector('[data-lc-saved]'); if (saved) saved.onclick = function () { filters.saved = !filters.saved; renderCourses(); };
        var clear = host.querySelector('[data-course-clear]'); if (clear) clear.onclick = function () { filters = { query: '', language: '', level: '', price: 'all', format: '', sort: 'recommended', saved: false }; renderCourses(); };
        var more = host.querySelector('[data-course-more]'); if (more) more.onclick = function () { visibleCount += 12; renderCourses(); };
        var retry = host.querySelector('[data-course-retry]'); if (retry) retry.onclick = async function () { await window.location.reload(); };
        host.querySelectorAll('[data-course-save]').forEach(function (button) { button.onclick = async function (event) { event.preventDefault(); event.stopPropagation(); await toggleSave(button.dataset.courseSave, button); }; });
        host.querySelectorAll('[data-course-teacher]').forEach(function (button) { button.onclick = function (event) { event.preventDefault(); event.stopPropagation(); openTeacher(button.dataset.courseTeacher); }; });
        host.querySelectorAll('[data-course-open]').forEach(function (button) { button.onclick = function (event) { event.preventDefault(); event.stopPropagation(); openCourseDetail(button.dataset.courseOpen); }; });
        host.querySelectorAll('.lc-card').forEach(function (cardNode) { cardNode.onkeydown = function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCourseDetail(cardNode.dataset.course); } }; });
      }
      async function loadEnrollments() {
        await baseLoadEnrollments();
        state.courseEnrollmentStatus = new Map();
        state.savedCourseIds = new Set();
        state.courseSavesSupported = true;
        if (ctx.isBusiness() || !ctx.user || !ctx.user.id) return;
        try {
          var enrollments = await supa.from('course_enrollments').select('course_id,status').eq('user_id', ctx.user.id).neq('status', 'cancelled');
          if (!enrollments.error) (enrollments.data || []).forEach(function (row) { state.courseEnrollmentStatus.set(String(row.course_id), row.status); });
          var saves = await supa.from('course_saves').select('course_id').eq('user_id', ctx.user.id);
          if (saves.error) state.courseSavesSupported = false;
          else (saves.data || []).forEach(function (row) { state.savedCourseIds.add(String(row.course_id)); });
        } catch (_) { state.courseSavesSupported = false; }
      }
      async function toggleSave(courseId, button) {
        if (!state.courseSavesSupported) { alertUser(tr('Saved courses require the Course Marketplace database migration.', 'Для сохранения курсов нужна миграция базы Course Marketplace.')); return; }
        var saved = state.savedCourseIds.has(String(courseId)), result;
        button.disabled = true;
        try {
          result = saved ? await supa.from('course_saves').delete().eq('user_id', ctx.user.id).eq('course_id', courseId) : await supa.from('course_saves').insert({ user_id: ctx.user.id, course_id: courseId });
          if (result.error) throw result.error;
          if (saved) state.savedCourseIds.delete(String(courseId)); else state.savedCourseIds.add(String(courseId));
          renderCourses();
        } catch (error) { button.disabled = false; alertUser(error.message || tr('Could not update saved courses.', 'Не удалось обновить сохранённые курсы.')); }
      }
      function courseById(id) { return (state.courses || []).find(function (course) { return String(course.id) === String(id); }); }
      function closeCourseDetail() {
        var overlay = ctx.$('#courseOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        if (detailReturnFocus && document.contains(detailReturnFocus)) detailReturnFocus.focus();
        detailReturnFocus = null;
      }
      function openCourseOverlay(title) {
        var overlay = ctx.$('#courseOverlay');
        if (!overlay) return;
        if (!overlay.classList.contains('open')) detailReturnFocus = document.activeElement;
        ctx.$('#courseOverlayTitle').textContent = title;
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        if (!detailAccessibilityInstalled) {
          detailAccessibilityInstalled = true;
          ctx.$('#courseClose').addEventListener('click', closeCourseDetail);
          overlay.addEventListener('click', function (event) { if (event.target === overlay) closeCourseDetail(); });
          document.addEventListener('keydown', function (event) {
            if (!overlay.classList.contains('open')) return;
            if (event.key === 'Escape') { event.preventDefault(); closeCourseDetail(); return; }
            if (event.key !== 'Tab') return;
            var focusable = Array.prototype.slice.call(overlay.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            if (!focusable.length) return;
            var first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          });
        }
        requestAnimationFrame(function () { ctx.$('#courseClose').focus(); });
      }
      async function loadEnrollmentAvailability(courseId) {
        var result = await supa.rpc('course_enrollment_summary', { p_course_id: courseId });
        if (result.error) throw result.error;
        return Array.isArray(result.data) ? result.data[0] : result.data;
      }
      async function openTeacher(teacherId) {
        var course = (state.courses || []).find(function (item) { return String(item.created_by) === String(teacherId); }), teacher = course && course.teacher;
        if (!teacher) { alertUser(tr('The public teacher profile is unavailable.', 'Публичный профиль преподавателя недоступен.')); return; }
        var body = ctx.$('#courseOverlayBody');
        openCourseOverlay(tr('Teacher profile', 'Профиль преподавателя'));
        body.innerHTML = '<div class="lcd-teacher-page"><button class="lcd-back" data-teacher-back>' + icon('arrow') + esc(tr('Back to course', 'Назад к курсу')) + '</button><div class="lcd-teacher-hero"><i>' + safeAvatar(course) + '</i><div><small>' + esc(tr('PUBLIC TEACHER PROFILE', 'ПУБЛИЧНЫЙ ПРОФИЛЬ')) + '</small><h2>' + esc(teacher.full_name || tr('Duvela teacher', 'Преподаватель Duvela')) + '</h2>' + (teacher.is_verified ? '<span>' + icon('check') + esc(tr('Verified teacher', 'Проверенный преподаватель')) + '</span>' : '') + '</div></div>' + (teacher.specialization && teacher.specialization.length ? '<section><h3>' + esc(tr('Specialization', 'Специализация')) + '</h3><div class="lcd-chips">' + teacher.specialization.map(function (item) { return '<span>' + esc(item) + '</span>'; }).join('') + '</div></section>' : '') + '<section><h3>' + esc(tr('Published courses', 'Опубликованные курсы')) + '</h3><div class="lcd-related">' + (state.courses || []).filter(function (item) { return String(item.created_by) === String(teacherId); }).map(function (item) { return '<button data-related-course="' + esc(item.id) + '"><b>' + esc(item.title) + '</b><span>' + esc([item.language, item.level].filter(Boolean).join(' · ')) + '</span></button>'; }).join('') + '</div></section></div>';
        body.querySelector('[data-teacher-back]').onclick = function () { openCourseDetail(course.id); };
        body.querySelectorAll('[data-related-course]').forEach(function (button) { button.onclick = function () { openCourseDetail(button.dataset.relatedCourse); }; });
      }
      async function openCourseDetail(courseId) {
        var course = courseById(courseId); if (!course || !publicCourse(course)) return;
        var overlay = ctx.$('#courseOverlay'), body = ctx.$('#courseOverlayBody');
        openCourseOverlay(tr('Course details', 'О курсе'));
        body.innerHTML = '<section class="lc-state"><span class="lc-spinner"></span><h2>' + esc(tr('Loading course details…', 'Загружаем курс…')) + '</h2></section>';
        var lessons = course.lessons || [], sessions = [], availability = null, detailError = '';
        try {
          var lessonResult = await supa.from('course_lessons').select('id,course_id,title,description,order_index').eq('course_id', course.id).order('order_index', { ascending: true });
          if (!lessonResult.error) lessons = lessonResult.data || [];
          if (course.zoom_enabled) {
            var classResult = await supa.from('classes').select('id').eq('course_id', course.id).maybeSingle();
            if (!classResult.error && classResult.data) {
              var sessionResult = await supa.from('class_sessions').select('id,title,starts_at,ends_at,status,duration_min').eq('class_id', classResult.data.id).order('starts_at', { ascending: true });
              if (!sessionResult.error) sessions = sessionResult.data || [];
            }
          }
          availability = await loadEnrollmentAvailability(course.id);
        } catch (error) { detailError = error.message || ''; }
        var teacher = course.teacher || {}, desc = description(course), hasDescription = hasPublicDescription(desc), status = enrollmentStatus(course.id), saved = state.savedCourseIds && state.savedCourseIds.has(String(course.id));
        var activeSessions = sessions.filter(function (session) { return !['cancelled', 'canceled'].includes(normalize(session.status)); });
        var upcomingSessions = activeSessions.filter(function (session) { return session.starts_at && new Date(session.starts_at).getTime() >= Date.now(); });
        var courseStarted = hasPassed(course.starts_on), courseEnded = hasPassed(course.ends_on);
        var openForEnrollment = availability && availability.enrollment_open === true && availability.remaining_places !== 0;
        var availabilityText = availability ? (!availability.enrollment_open ? tr('Enrollment is currently closed', 'Набор сейчас закрыт') : availability.remaining_places === 0 ? tr('No places available', 'Свободных мест нет') : availability.remaining_places == null ? tr('Enrollment is open', 'Набор открыт') : tr(availability.remaining_places + ' places available', 'Свободных мест: ' + availability.remaining_places)) : tr('Availability needs verification', 'Доступность записи требует проверки');
        var primary;
        if (status === 'confirmed') primary = '<button class="lcd-primary" data-detail-continue>' + esc(tr('Continue Learning', 'Продолжить обучение')) + icon('arrow') + '</button>';
        else if (status === 'pending') primary = '<button class="lcd-primary" disabled>' + esc(tr('Enrollment pending', 'Запись на рассмотрении')) + '</button>';
        else if (!ctx.user || !ctx.user.id) primary = '<button class="lcd-primary" disabled>' + esc(tr('Sign in to enroll', 'Войдите, чтобы записаться')) + '</button>';
        else if (!availability) primary = '<button class="lcd-primary" disabled>' + esc(tr('Availability needs verification', 'Доступность записи требует проверки')) + '</button><small>' + esc(tr('The enrollment service is unavailable. No enrollment was created.', 'Сервис записи недоступен. Запись не создана.')) + '</small>';
        else if (!openForEnrollment) primary = '<button class="lcd-primary" disabled>' + esc(availabilityText) + '</button>';
        else if (!isFree(course)) primary = '<button class="lcd-primary" disabled>' + esc(tr('Payment unavailable', 'Оплата недоступна')) + '</button><small>' + esc(tr('A verified course checkout route is not configured yet.', 'Проверенный маршрут оплаты курса пока не настроен.')) + '</small>';
        else primary = '<button class="lcd-primary" data-detail-enroll="' + esc(course.id) + '">' + esc(tr('Enroll for Free', 'Записаться бесплатно')) + icon('arrow') + '</button><small>' + esc(availability.requires_approval ? tr('Enrollment will be reviewed by the teacher.', 'Запись будет подтверждена преподавателем.') : tr('You will receive access after server confirmation.', 'Доступ откроется после подтверждения сервером.')) + '</small>';
        var related = (state.courses || []).filter(function (item) { return item.id !== course.id && (normalize(item.language) === normalize(course.language) || item.level === course.level); }).slice(0, 3);
        body.innerHTML = '<article class="lcd-page"><section class="lcd-hero"><div class="lcd-hero-cover">' + cover(course) + '</div><div class="lcd-hero-copy"><div class="lcd-badges"><span>' + esc(displayLanguage(course)) + '</span>' + (course.level ? '<span>' + esc(course.level) + '</span>' : '') + '<span>' + esc(formatLabel(course)) + '</span></div><h1>' + esc(course.title) + '</h1>' + (hasDescription ? '<p>' + esc(desc) + '</p>' : '<p class="lcd-description-missing">' + esc(tr('The instructor has not provided a complete public description yet.', 'Преподаватель пока не добавил полное публичное описание.')) + '</p>') + '<button class="lcd-teacher-link" data-course-teacher="' + esc(course.created_by || '') + '"><i>' + safeAvatar(course) + '</i><span><small>' + esc(tr('Course instructor', 'Преподаватель курса')) + '</small><b>' + esc(teacher.full_name || tr('Duvela teacher', 'Преподаватель Duvela')) + '</b>' + (teacher.is_verified ? '<em>' + icon('check') + esc(tr('Verified teacher', 'Проверенный преподаватель')) + '</em>' : '') + '</span>' + icon('arrow') + '</button></div><aside class="lcd-purchase"><small>' + esc(tr('Course price', 'Стоимость курса')) + '</small><strong>' + esc(formatMoney(course)) + '</strong><span class="lcd-availability ' + (availability && openForEnrollment ? 'open' : '') + '">' + esc(availabilityText) + '</span>' + primary + '<button class="lcd-save' + (saved ? ' active' : '') + '" data-course-save="' + esc(course.id) + '">' + icon('heart') + esc(saved ? tr('Saved', 'Сохранён') : tr('Save course', 'Сохранить курс')) + '</button></aside></section>' +
          (detailError ? '<div class="lcd-note">' + esc(tr('Some optional course information could not be loaded.', 'Часть дополнительной информации курса не загрузилась.')) + '</div>' : '') +
          '<div class="lcd-layout"><main><section><h2>' + esc(tr('Course overview', 'О курсе')) + '</h2><p>' + esc(hasDescription ? desc : tr('A complete course description is not published yet.', 'Полное описание курса пока не опубликовано.')) + '</p></section>' +
          '<section><h2>' + esc(tr('Learning outcomes', 'Что вы освоите')) + '</h2>' + (lessons.length ? '<ul class="lcd-outcomes">' + lessons.slice(0, 4).map(function (lesson) { return '<li>' + icon('check') + esc(lesson.title || tr('Lesson', 'Урок')) + '</li>'; }).join('') + '</ul>' : '<p class="lcd-unavailable">' + esc(tr('The instructor has not published learning outcomes yet.', 'Преподаватель пока не опубликовал учебные результаты.')) + '</p>') + '</section>' +
          '<section><div class="lcd-section-head"><h2>' + esc(tr('Curriculum', 'Программа')) + '</h2>' + (lessons.length ? '<span>' + esc(lessons.length + ' ' + tr('lessons listed', 'уроков в программе')) + '</span>' : '') + '</div>' + (lessons.length ? '<ol class="lcd-curriculum">' + lessons.map(function (lesson, index) { return '<li><span>' + (index + 1) + '</span><div><b>' + esc(lesson.title || tr('Lesson', 'Урок')) + '</b>' + (lesson.description ? '<p>' + esc(lesson.description) + '</p>' : '') + '</div></li>'; }).join('') + '</ol>' : '<p class="lcd-unavailable">' + esc(tr('The instructor has not published a public lesson list yet.', 'Преподаватель пока не опубликовал открытый список уроков.')) + '</p>') + '</section>' +
          '<section><h2>' + esc(tr('Schedule', 'Расписание')) + '</h2>' + (upcomingSessions.length ? '<div class="lcd-sessions">' + upcomingSessions.map(function (session) { return '<div>' + icon('calendar') + '<span><b>' + esc(session.title || course.title) + '</b><small>' + esc(formatDateTime(session.starts_at) + (session.duration_min ? ' · ' + session.duration_min + ' min' : '')) + '</small></span></div>'; }).join('') + '</div>' : '<p class="lcd-unavailable">' + esc(courseEnded ? tr('No future sessions are available because the recorded course end date has passed.', 'Будущих занятий нет: указанная дата окончания курса уже прошла.') : course.schedule ? tr('Schedule pattern: ', 'График: ') + course.schedule : tr('No upcoming sessions have been published yet.', 'Ближайшие занятия пока не опубликованы.')) + '</p>') + '<div class="lcd-schedule-facts">' + (course.starts_on ? '<span><b>' + esc(courseStarted ? tr('Started', 'Начался') : tr('Starts', 'Начало')) + '</b>' + esc(formatDate(course.starts_on)) + '</span>' : '') + (course.ends_on ? '<span><b>' + esc(tr('Ends', 'Окончание')) + '</b>' + esc(formatDate(course.ends_on)) + '</span>' : '') + (course.schedule && upcomingSessions.length ? '<span><b>' + esc(tr('Pattern', 'График')) + '</b>' + esc(course.schedule) + '</span>' : '') + '</div></section>' +
          '<section class="lcd-instructor"><h2>' + esc(tr('Instructor', 'Преподаватель')) + '</h2><button data-course-teacher="' + esc(course.created_by || '') + '"><i>' + safeAvatar(course) + '</i><span><b>' + esc(teacher.full_name || tr('Duvela teacher', 'Преподаватель Duvela')) + '</b><small>' + esc(teacher.specialization && teacher.specialization.length ? teacher.specialization.join(' · ') : tr('Course instructor', 'Преподаватель курса')) + '</small></span><em>' + esc(tr('View Teacher Profile', 'Открыть профиль преподавателя')) + icon('arrow') + '</em></button></section>' +
          '</main><aside><section class="lcd-facts"><h2>' + esc(tr('Course facts', 'О курсе')) + '</h2><dl><div><dt>' + esc(tr('Language', 'Язык')) + '</dt><dd>' + esc(displayLanguage(course)) + '</dd></div><div><dt>' + esc(tr('Level', 'Уровень')) + '</dt><dd>' + esc(course.level || tr('Not specified', 'Не указан')) + '</dd></div><div><dt>' + esc(tr('Format', 'Формат')) + '</dt><dd>' + esc(formatLabel(course)) + '</dd></div>' + (lessons.length ? '<div><dt>' + esc(tr('Lessons', 'Уроки')) + '</dt><dd>' + esc(String(lessons.length)) + '</dd></div>' : '') + (availability && availability.remaining_places != null ? '<div><dt>' + esc(tr('Available places', 'Свободные места')) + '</dt><dd>' + esc(String(availability.remaining_places)) + '</dd></div>' : '') + (course.location ? '<div><dt>' + esc(tr('Location', 'Место')) + '</dt><dd>' + esc(course.location) + '</dd></div>' : '') + '</dl></section></aside></div>' +
          (related.length ? '<section class="lcd-related-section"><h2>' + esc(tr('Related courses', 'Похожие курсы')) + '</h2><div class="lcd-related">' + related.map(function (item) { return '<button data-related-course="' + esc(item.id) + '"><b>' + esc(item.title) + '</b><span>' + esc([displayLanguage(item), item.level, formatMoney(item)].filter(Boolean).join(' · ')) + '</span></button>'; }).join('') + '</div></section>' : '') + '</article>';
        body.querySelectorAll('[data-course-teacher]').forEach(function (button) { button.onclick = function () { openTeacher(course.created_by); }; });
        var saveButton = body.querySelector('[data-course-save]'); if (saveButton) saveButton.onclick = function () { toggleSave(course.id, saveButton).then(function () { openCourseDetail(course.id); }); };
        var enrollButton = body.querySelector('[data-detail-enroll]'); if (enrollButton) enrollButton.onclick = async function () { await enrollCourse(course.id); openCourseDetail(course.id); };
        var continueButton = body.querySelector('[data-detail-continue]'); if (continueButton) continueButton.onclick = function () { closeCourseDetail(); if (ctx.renderWorkspace) ctx.renderWorkspace(); location.hash = 'workspace'; };
        body.querySelectorAll('[data-related-course]').forEach(function (button) { button.onclick = function () { openCourseDetail(button.dataset.relatedCourse); }; });
      }
      async function enrollCourse(courseId) {
        var course = courseById(courseId);
        if (!course || !publicCourse(course)) { alertUser(tr('This course is not available for enrollment.', 'Этот курс недоступен для записи.')); return; }
        if (!isFree(course)) { alertUser(tr('Course payment is not configured. No enrollment was created.', 'Оплата курса не настроена. Запись не создана.')); return; }
        if (!ctx.user || !ctx.user.id) { alertUser(tr('Sign in to enroll.', 'Войдите, чтобы записаться.')); return; }
        try {
          var result = await supa.rpc('enroll_free_course', { p_course_id: courseId });
          if (result.error) throw result.error;
          await loadEnrollments();
          renderCourses();
          void supa.functions.invoke('notify-course-enrollment', { body: { courseId: courseId, learnerName: ctx.profile && ctx.profile.full_name || undefined } }).catch(function () {});
        } catch (error) { alertUser(error.message || tr('Could not enroll. No enrollment was created.', 'Не удалось записаться. Запись не создана.')); }
      }
      async function unenrollCourse(courseId) { await base.unenrollCourse(courseId); await loadEnrollments(); renderCourses(); }

      return Object.assign({}, base, { renderCourses: renderCourses, openCourseDetail: openCourseDetail, loadEnrollments: loadEnrollments, enrollCourse: enrollCourse, unenrollCourse: unenrollCourse });
    };
    window.DuvelaAppCatalog.__courses5 = true;
  }

  installPublicDataLoader();
  installCatalog();
  window.DuvelaCourses5 = { auditedQaIds: AUDITED_QA_IDS, publicCourse: publicCourse, learnerContext: learnerContext };
})();
