(function () {
  // Business "Management" page — web mirror of the mobile Bus management screen
  // (app/(business)/events.tsx): a gradient tab bar (Events / Courses / Schedule
  // Live / Challenges) with per-tab summary + list + empty states. View-only lists;
  // create/schedule buttons route to the existing web workspace/live panels.
  function createManagement(ctx) {
    const { tr, esc, supa, state } = ctx;
    let activeTab = 'events';
    let eventsSub = 'upcoming';
    let data = null;    // {events, courses, challenges, classSessions}
    let loadedFor = null;

    function todayStr() {
      return new Date().toISOString().slice(0, 10);
    }
    function isUpcoming(ev) {
      return !ev.event_date || ev.event_date >= todayStr();
    }
    function isOnline(ev) {
      return ev.is_online === true || ev.format === 'online';
    }

    async function safe(promise) {
      try {
        const r = await promise;
        return (r && r.error) ? { data: [] } : r;
      } catch (e) {
        return { data: [] };
      }
    }

    async function load(uid) {
      const [ev, co, ch, cs] = await Promise.all([
        safe(supa.from('events').select(ctx.getEventColumns()).eq('organizer_id', uid).order('event_date', { ascending: true })),
        safe(supa.from('courses').select('id,title,description,level,language,status,price,currency,cover_image_url,starts_on,ends_on,schedule,location,created_at').eq('created_by', uid).neq('status', 'archived').order('created_at', { ascending: false })),
        safe(supa.from('challenges').select('id,title,target_level,exam_type,started_at,ends_at').order('created_at', { ascending: false }).limit(20)),
        safe(supa.from('class_sessions').select('id,class_id,title,starts_at,status,provider').eq('created_by', uid).order('starts_at', { ascending: true }).limit(40))
      ]);
      data = { events: (ev && ev.data) || [], courses: (co && co.data) || [], challenges: (ch && ch.data) || [], classSessions: (cs && cs.data) || [] };
    }

    function go(view) {
      return 'href="#' + view + '" data-go="' + view + '"';
    }
    function priceText(item) {
      if (item.price == null || item.price === '' || Number(item.price) === 0) return tr('Free', 'Бесплатно');
      return [item.price, item.currency].filter(Boolean).join(' ');
    }
    function eventWhen(ev) {
      const d = ev.event_date ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const t = ev.event_time ? String(ev.event_time).slice(0, 5) : '';
      return [d, t].filter(Boolean).join(' · ') || tr('No date set', 'Дата не задана');
    }
    function shortDate(value) {
      if (!value) return '';
      var date = new Date(String(value).slice(0, 10) + 'T00:00:00');
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function coursePeriod(course) {
      var start = shortDate(course.starts_on), end = shortDate(course.ends_on);
      if (start && end) return start + ' — ' + end;
      return start || end || tr('Dates not set', 'Даты не указаны');
    }

    var IC = {
      cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
      book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V5a2 2 0 012-2h13v16H6.5A2.5 2.5 0 004 21.5"/></svg>',
      live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-4v12l-6-4z"/></svg>',
      trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v4a6 6 0 01-12 0zM4 5h2M18 5h2M9 21h6M12 15v6"/></svg>'
    };

    var TABS = [
      { id: 'events', label: tr('Events', 'События'), icon: IC.cal },
      { id: 'courses', label: tr('Courses', 'Курсы'), icon: IC.book },
      { id: 'live', label: tr('Schedule Live', 'Запланировать эфир'), icon: IC.live },
      { id: 'challenges', label: tr('Challenges', 'Челленджи'), icon: IC.trophy }
    ];

    function tabBar() {
      return '<div class="mg-tabs">' + TABS.map(function (t) {
        return '<button type="button" class="mg-tab' + (t.id === activeTab ? ' active' : '') + '" data-mg-tab="' + t.id + '">' +
          '<span class="mg-tab-ic">' + t.icon + '</span><span>' + esc(t.label) + '</span></button>';
      }).join('') + '</div>';
    }

    function emptyCard(icon, title, text, btnLabel, btnAttrs) {
      return '<div class="mg-empty">' +
        '<span class="mg-empty-ic">' + icon + '</span>' +
        '<b>' + esc(title) + '</b><p>' + esc(text) + '</p>' +
        (btnLabel ? '<button type="button" class="mg-btn-solid" ' + btnAttrs + '>' + esc(btnLabel) + '</button>' : '') +
        '</div>';
    }

    function renderEventsTab() {
      var events = data.events;
      var upcoming = events.filter(isUpcoming);
      var past = events.filter(function (e) { return !isUpcoming(e); });
      var list = eventsSub === 'upcoming' ? upcoming : past;

      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic">' + IC.cal + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(String(events.length) + ' ' + tr('events', 'событий')) + '</b>' +
        '<span>' + esc(upcoming.length + ' ' + tr('upcoming', 'предстоящих') + ' | ' + past.length + ' ' + tr('past', 'прошедших')) + '</span></div>' +
        '<button type="button" class="mg-btn-solid" data-mg-new-event>' + esc(tr('New event', 'Новое событие')) + '</button>' +
        '</div>';

      html += '<div class="mg-seg">' +
        '<button type="button" class="mg-seg-btn' + (eventsSub === 'upcoming' ? ' active' : '') + '" data-mg-sub="upcoming">' + esc(tr('Upcoming', 'Предстоящие') + ' (' + upcoming.length + ')') + '</button>' +
        '<button type="button" class="mg-seg-btn' + (eventsSub === 'past' ? ' active' : '') + '" data-mg-sub="past">' + esc(tr('Past', 'Прошедшие') + ' (' + past.length + ')') + '</button>' +
        '</div>';

      if (list.length) {
        html += '<div class="mg-list">' + list.map(function (ev) {
          return '<a class="mg-row" href="#events" data-go="events" data-event-open="' + esc(ev.id) + '">' +
            '<span class="mg-row-ic">' + IC.cal + '</span>' +
            '<span class="mg-row-copy"><b>' + esc(ev.title || tr('Untitled event', 'Без названия')) + '</b>' +
            '<span>' + esc(eventWhen(ev)) + (isOnline(ev) ? ' · ' + esc(tr('Online', 'Онлайн')) : '') + '</span></span>' +
            '<span class="mg-row-tag">' + esc(priceText(ev)) + '</span></a>';
        }).join('') + '</div>';
      } else {
        html += emptyCard(IC.cal,
          eventsSub === 'upcoming' ? tr('No upcoming events', 'Нет предстоящих событий') : tr('No past events', 'Нет прошедших событий'),
          eventsSub === 'upcoming' ? tr('Create an event and it will appear here.', 'Создайте событие — и оно появится здесь.') : tr('Past events will be listed here.', 'Здесь будут показаны прошедшие события.'),
          eventsSub === 'upcoming' ? tr('Create event', 'Создать событие') : null,
          'data-mg-new-event');
      }
      return html;
    }

    function renderCoursesTab() {
      var courses = data.courses;
      if (!courses.length) {
        return '<div class="mg-empty">' +
          '<span class="mg-empty-ic teal">' + IC.book + '</span>' +
          '<b>' + esc(tr('No courses yet', 'Пока нет курсов')) + '</b>' +
          '<p>' + esc(tr('Build your first course offer for learners, or import many at once from Excel.', 'Соберите первый курс для учеников или импортируйте сразу много из Excel.')) + '</p>' +
          '<div class="mg-empty-actions">' +
            '<button type="button" class="mg-btn-solid teal" data-mg-new-course>' + esc(tr('Create course', 'Создать курс')) + '</button>' +
            '<button type="button" class="mg-btn-outline" data-mg-import-course>' + esc(tr('Import from Excel', 'Импорт из Excel')) + '</button>' +
          '</div></div>';
      }
      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic teal">' + IC.book + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(courses.length + ' ' + tr('courses', 'курсов')) + '</b>' +
        '<span>' + esc(tr('Manage your programs', 'Управляйте программами')) + '</span></div>' +
        '<div class="mg-summary-actions">' +
          '<button type="button" class="mg-btn-outline sm" data-mg-import-course>' + esc(tr('Import', 'Импорт')) + '</button>' +
          '<button type="button" class="mg-btn-solid teal sm" data-mg-new-course>' + esc(tr('New course', 'Новый курс')) + '</button>' +
        '</div>' +
        '</div>';
      html += '<div class="mg-course-list">' + courses.map(function (c) {
        var tags = [c.level, c.language].filter(Boolean).map(function (t) { return '<span class="mg-chip">' + esc(t) + '</span>'; }).join('');
        var cover = c.cover_image_url
          ? '<img src="' + esc(c.cover_image_url) + '" alt="">'
          : '<span>' + IC.book + '</span>';
        var statusLabels = {
          draft: tr('Draft', 'Черновик'), active: tr('Published', 'Опубликован'),
          closed: tr('Enrollment closed', 'Набор закрыт'), completed: tr('Completed', 'Завершён')
        };
        var status = statusLabels[c.status] || tr('Published', 'Опубликован');
        return '<article class="mg-course-card">' +
          '<div class="mg-course-cover">' + cover + '</div>' +
          '<div class="mg-course-main">' +
            '<div class="mg-course-title"><div><h3>' + esc(c.title || tr('Untitled course', 'Без названия')) + '</h3><div class="mg-chip-row">' + tags + '</div></div>' +
              '<span class="mg-status' + (c.status === 'draft' ? ' draft' : '') + '">' + esc(status) + '</span></div>' +
            '<div class="mg-course-facts">' +
              '<span><b>' + esc(tr('Period', 'Период')) + '</b>' + esc(coursePeriod(c)) + '</span>' +
              '<span><b>' + esc(tr('Schedule', 'Расписание')) + '</b>' + esc(c.schedule || tr('Not set', 'Не указано')) + '</span>' +
              '<span><b>' + esc(tr('Location', 'Место')) + '</b>' + esc(c.location || tr('Online', 'Онлайн')) + '</span>' +
            '</div>' +
            '<div class="mg-course-footer"><strong>' + esc(priceText(c)) + '</strong><div class="mg-course-actions">' +
              '<button type="button" class="mg-btn-outline sm" data-course-open="' + esc(c.id) + '">' + esc(tr('Program', 'Программа')) + '</button>' +
              '<button type="button" class="mg-btn-outline sm" data-course-edit="' + esc(c.id) + '">' + esc(tr('Edit', 'Изменить')) + '</button>' +
              '<button type="button" class="mg-btn-danger sm" data-course-archive="' + esc(c.id) + '">' + esc(tr('Archive', 'В архив')) + '</button>' +
            '</div></div>' +
          '</div></article>';
      }).join('') + '</div>';
      var groups = (state && state.orgClasses) || [];
      html += '<div class="section-head" style="margin-top:22px"><div><h2 style="font-size:18px">' + esc(tr('Study groups', 'Учебные группы')) + '</h2><p style="margin:3px 0 0;color:var(--soft);font-size:12px">' + esc(tr('Groups connect enrolled learners with Zoom Classroom lessons.', 'Группы связывают учеников с уроками Zoom Classroom.')) + '</p></div><button type="button" class="mg-btn-solid teal sm" data-mg-new-class>' + esc(tr('New group', 'Новая группа')) + '</button></div>';
      html += groups.length ? '<div class="mg-list">' + groups.map(function (group) {
        return '<button type="button" class="mg-row" data-mg-manage-class="' + esc(group.id) + '" style="width:100%;text-align:left">' +
          '<span class="mg-row-ic teal">' + IC.book + '</span><span class="mg-row-copy"><b>' + esc(group.name || tr('Study group', 'Учебная группа')) + '</b>' +
          '<span>' + esc([group.language, group.level, group.format === 'offline' ? tr('In person', 'Офлайн') : tr('Online', 'Онлайн')].filter(Boolean).join(' · ')) + '</span></span>' +
          '<span class="mg-row-tag">' + esc(tr('Students and lessons', 'Ученики и уроки')) + '</span></button>';
      }).join('') + '</div>' : emptyCard(IC.book, tr('No study groups yet', 'Учебных групп пока нет'), tr('Create a group, add learners and schedule a Zoom lesson.', 'Создайте группу, добавьте учеников и запланируйте Zoom-урок.'), tr('Create group', 'Создать группу'), 'data-mg-new-class');
      return html;
    }

    function renderLiveTab() {
      var live = data.events.filter(function (e) { return isUpcoming(e) && isOnline(e); });
      var classrooms = (data.classSessions || []).filter(function (s) { return s.status !== 'ended' && s.status !== 'cancelled'; });
      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic red">' + IC.live + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(tr('Online lessons and broadcasts', 'Онлайн-уроки и эфиры')) + '</b>' +
        '<span>' + esc(tr('Zoom for interactive classes · Agora for mass LIVE', 'Zoom для групповых уроков · Agora для массовых LIVE')) + '</span></div>' +
        '<div class="mg-summary-actions"><button type="button" class="mg-btn-solid sm" data-mg-schedule-class>' + esc(tr('Group lesson', 'Групповой урок')) + '</button>' +
        '<button type="button" class="mg-btn-outline sm" data-mg-schedule-live>' + esc(tr('Mass LIVE', 'Массовый LIVE')) + '</button></div>' +
        '</div>';
      html += '<div class="mg-broadcast-choice"><div class="card"><b>Zoom Classroom</b><p>' + esc(tr('Interactive lesson: student cameras, microphones, chat and screen sharing.', 'Интерактивный урок: камеры учеников, микрофоны, чат и демонстрация экрана.')) + '</p></div><div class="card"><b>Agora LIVE</b><p>' + esc(tr('Public broadcast: large audience, reactions and gifts.', 'Публичный эфир: большая аудитория, реакции и подарки.')) + '</p></div></div>';
      if (classrooms.length) html += '<div class="section-head"><h2 style="font-size:16px">' + esc(tr('Group lessons', 'Групповые уроки')) + '</h2><span>Zoom</span></div><div class="mg-list">' + classrooms.map(function (session) {
        return '<a class="mg-row" href="./classroom.html?s=' + encodeURIComponent(session.id) + '">' +
          '<span class="mg-row-ic purple">' + IC.live + '</span><span class="mg-row-copy"><b>' + esc(session.title || tr('Group lesson', 'Групповой урок')) + '</b>' +
          '<span>' + esc(session.starts_at ? new Date(session.starts_at).toLocaleString(ctx.isRu ? 'ru-RU' : 'en-US') : '') + ' · Zoom Classroom</span></span>' +
          '<span class="mg-row-tag">' + esc(session.status === 'live' ? tr('Join', 'Войти') : tr('Open', 'Открыть')) + '</span></a>';
      }).join('') + '</div>';
      if (live.length) html += '<div class="section-head"><h2 style="font-size:16px">' + esc(tr('Mass broadcasts', 'Массовые эфиры')) + '</h2><span>Agora</span></div><div class="mg-list">' + live.map(function (ev) {
        return '<a class="mg-row" href="#events" data-go="events" data-event-open="' + esc(ev.id) + '">' +
          '<span class="mg-row-ic red">' + IC.live + '</span>' +
          '<span class="mg-row-copy"><b>' + esc(ev.title || tr('LIVE session', 'LIVE сессия')) + '</b>' +
          '<span>' + esc(eventWhen(ev)) + '</span></span>' +
          '<span class="mg-chevron">›</span></a>';
      }).join('') + '</div>';
      if (!classrooms.length && !live.length) html += emptyCard(IC.live, tr('Nothing scheduled yet', 'Пока ничего не запланировано'), tr('Choose a group lesson or a mass broadcast above.', 'Выберите групповой урок или массовый эфир выше.'));
      return html;
    }

    function renderChallengesTab() {
      var ch = data.challenges;
      if (!ch.length) {
        return emptyCard(IC.trophy, tr('No challenges yet', 'Пока нет челленджей'),
          tr('Motivate students with a learning challenge.', 'Мотивируйте учеников учебным челленджем.'),
          tr('Create challenge', 'Создать челлендж'), 'data-mg-new-challenge');
      }
      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic purple">' + IC.trophy + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(ch.length + ' ' + tr('challenges', 'челленджей')) + '</b>' +
        '<span>' + esc(tr('Motivate students', 'Мотивируйте учеников')) + '</span></div>' +
        '<button type="button" class="mg-btn-solid purple" data-mg-new-challenge>' + esc(tr('New challenge', 'Новый челлендж')) + '</button>' +
        '</div>';
      html += '<div class="mg-list">' + ch.map(function (c) {
        var meta = [c.target_level, c.exam_type].filter(Boolean).join(' · ');
        return '<a class="mg-row" href="#workspace" data-go="workspace" data-challenge="' + esc(c.id) + '">' +
          '<span class="mg-row-ic purple">' + IC.trophy + '</span>' +
          '<span class="mg-row-copy"><b>' + esc(c.title || tr('Challenge', 'Челлендж')) + '</b>' +
          '<span>' + esc(meta) + '</span></span>' +
          '<span class="mg-chevron">›</span></a>';
      }).join('') + '</div>';
      return html;
    }

    function renderBody() {
      if (activeTab === 'events') return renderEventsTab();
      if (activeTab === 'courses') return renderCoursesTab();
      if (activeTab === 'live') return renderLiveTab();
      return renderChallengesTab();
    }

    function paint() {
      var host = document.getElementById('managementPanel');
      if (!host) return;
      if (!data) {
        host.innerHTML = tabBar() + '<div class="mg-loading">' + esc(tr('Loading…', 'Загрузка…')) + '</div>';
        return;
      }
      host.innerHTML = tabBar() + renderBody();
      bindTabEvents(host);
    }

    function bindTabEvents(host) {
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-tab]'), function (btn) {
        btn.addEventListener('click', function () { activeTab = btn.getAttribute('data-mg-tab'); paint(); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-sub]'), function (btn) {
        btn.addEventListener('click', function () { eventsSub = btn.getAttribute('data-mg-sub'); paint(); });
      });
      // View items via existing detail openers (defer to the panel we navigate to).
      Array.prototype.forEach.call(host.querySelectorAll('[data-event-open]'), function (a) {
        a.addEventListener('click', function () { if (ctx.openEventDetail) ctx.openEventDetail(a.getAttribute('data-event-open')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-course-open]'), function (a) {
        a.addEventListener('click', function () { if (ctx.openCourseDetail) ctx.openCourseDetail(a.getAttribute('data-course-open')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-course-delete]'), function (button) {
        button.addEventListener('click', function () { void deleteCourse(button.getAttribute('data-course-delete')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-course-edit]'), function (button) {
        button.addEventListener('click', function () { openCourseModal(button.getAttribute('data-course-edit')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-course-archive]'), function (button) {
        button.addEventListener('click', function () { void archiveCourse(button.getAttribute('data-course-archive')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-new-course]'), function (b) {
        b.addEventListener('click', function () { openCourseModal(); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-import-course]'), function (b) {
        b.addEventListener('click', function () { pickCourseExcel(); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-new-class]'), function (b) {
        b.addEventListener('click', openStudyGroupModal);
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-manage-class]'), function (b) {
        b.addEventListener('click', function () {
          if (ctx.openClassManage) ctx.openClassManage(b.getAttribute('data-mg-manage-class'));
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-new-event]'), function (b) {
        b.addEventListener('click', function () { openEventModal(false); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-schedule-live]'), function (b) {
        b.addEventListener('click', function () { openEventModal(true); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-schedule-class]'), function (b) {
        b.addEventListener('click', openClassSessionModal);
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mg-new-challenge]'), function (b) {
        b.addEventListener('click', function () { openChallengeModal(); });
      });
    }

    // ── Course creation (modal) ─────────────────────────────────────────────
    var courseCover = null;      // uploaded cover URL
    var courseSaving = false;
    var courseNotice = '';
    var courseEditing = null;
    var courseDirty = false;
    var coursePreview = false;

    async function archiveCourse(id) {
      var course = data.courses.find(function (item) { return String(item.id) === String(id); });
      if (!window.confirm(tr('Move this course to the archive?', 'Переместить курс в архив?'))) return;
      var result = await supa.from('courses').update({ status: 'archived' }).eq('id', id).eq('created_by', ctx.user.id);
      if (result.error) { ctx.alert(result.error.message || tr('Could not archive the course.', 'Не удалось архивировать курс.')); return; }
      data.courses = data.courses.filter(function (item) { return String(item.id) !== String(id); });
      paint();
    }

    async function deleteCourse(id) {
      var course = data && data.courses && data.courses.find(function (item) { return String(item.id) === String(id); });
      var title = course && course.title ? ' «' + course.title + '»' : '';
      if (!window.confirm(tr('Delete course', 'Удалить курс') + title + '?')) return;
      var result;
      try {
        result = await supa.from('courses').delete().eq('id', id).eq('created_by', ctx.user.id);
      } catch (e) {
        result = { error: e };
      }
      if (result && result.error) {
        ctx.alert(tr('Could not delete the course.', 'Не удалось удалить курс.'));
        return;
      }
      await load(ctx.user.id);
      paint();
    }

    function el(id) { return document.getElementById(id); }

    // courses.organization_id is NOT NULL and insert RLS needs an org role, so a
    // teacher without an org gets a personal one created on first course.
    async function ensureOrg() {
      if (ctx.state && ctx.state.myOrg) return ctx.state.myOrg;
      var name = ((ctx.profile && ctx.profile.full_name) || tr('My', 'Мой') + ' teacher').trim() + ' · Duvela';
      var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) + '-' + Math.random().toString(36).slice(2, 6);
      var orgRes = await safe(supa.from('organizations').insert({ owner_id: ctx.user.id, name: name, slug: slug }).select('id,name').single());
      if (!orgRes || !orgRes.data) return null;
      await safe(supa.from('organization_memberships').insert({ organization_id: orgRes.data.id, user_id: ctx.user.id, role: 'owner', status: 'active' }));
      if (ctx.state) ctx.state.myOrg = orgRes.data;
      return orgRes.data;
    }

    // Generic create-modal shell shared by course/event/challenge.
    function openModal(title, paintFn) {
      var overlay = el('courseCreateOverlay');
      var titleEl = el('ccTitle');
      if (titleEl) titleEl.textContent = title;
      paintFn();
      if (overlay) {
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };
      }
      document.body.classList.add('modal-open');
      var closeBtn = el('ccClose');
      if (closeBtn) closeBtn.onclick = closeModal;
    }
    function closeModal() {
      if (courseDirty && !window.confirm(tr('Discard unsaved changes?', 'Закрыть без сохранения изменений?'))) return;
      var overlay = el('courseCreateOverlay');
      if (overlay) { overlay.classList.remove('open'); overlay.setAttribute('aria-hidden', 'true'); }
      courseDirty = false;
      document.body.classList.remove('modal-open');
    }
    function afterCreate() {
      closeModal();
      if (ctx.loadPublicData) ctx.loadPublicData();
      return load(ctx.user.id);
    }

    function openCourseModal(id) {
      courseEditing = id ? data.courses.find(function (item) { return String(item.id) === String(id); }) || null : null;
      courseCover = courseEditing && courseEditing.cover_image_url || null;
      courseNotice = ''; courseSaving = false; courseDirty = false; coursePreview = false;
      openModal(courseEditing ? tr('Edit course', 'Редактировать курс') : tr('Create course', 'Создать курс'), paintCourseModal);
    }
    var closeCourseModal = closeModal;

    function field(id, label, type, placeholder, value) {
      return '<div class="pv-field"><label>' + esc(label) + '</label>' +
        '<input id="' + id + '" type="' + (type || 'text') + '" placeholder="' + esc(placeholder || '') + '" value="' + esc(value == null ? '' : value) + '"></div>';
    }

    function paintCourseModal() {
      var body = el('ccBody');
      if (!body) return;
      var coverStyle = courseCover
        ? 'background-image:url(' + esc(courseCover) + ');background-size:cover;background-position:center;'
        : '';
      var c = courseEditing || {};
      body.innerHTML =
        (coursePreview ? '<div class="cc-preview"><div class="cc-preview-cover"' + (courseCover ? ' style="background-image:url(' + esc(courseCover) + ')"' : '') + '></div><div><small>' + esc(tr('Learner preview', 'Предпросмотр для ученика')) + '</small><h3>' + esc(c.title || tr('New course', 'Новый курс')) + '</h3><p>' + esc(c.description || tr('The description will appear here.', 'Здесь появится описание курса.')) + '</p></div></div>' : '') +
        '<button type="button" class="cc-cover" id="ccCoverBtn" style="' + coverStyle + '">' +
          (courseCover ? '' : '<span>+ ' + esc(tr('Add cover photo', 'Добавить обложку')) + '</span>') +
        '</button>' +
        '<input type="file" id="ccCoverFile" accept="image/*" hidden>' +
        '<div class="pv-field" style="margin-top:12px"><label>' + esc(tr('Title', 'Название')) + ' *</label>' +
          '<input id="ccTitleInput" type="text" placeholder="' + esc(tr('e.g. English A1 → A2', 'напр. Английский A1 → A2')) + '" value="' + esc(c.title || '') + '"></div>' +
        '<div class="pv-field-grid">' +
          field('ccLevel', tr('Level', 'Уровень'), 'text', 'A1–C2', c.level) +
          field('ccLanguage', tr('Language', 'Язык'), 'text', tr('English', 'Английский'), c.language) +
        '</div>' +
        '<div class="pv-field-grid">' +
          field('ccPrice', tr('Price', 'Цена'), 'number', '0', c.price) +
          '<div class="pv-field"><label>' + esc(tr('Currency', 'Валюта')) + '</label>' +
            '<select id="ccCurrency"><option value="EUR">EUR €</option><option value="USD">USD $</option></select></div>' +
        '</div>' +
        '<div class="pv-field-grid">' +
          field('ccStart', tr('Start date', 'Дата начала'), 'date', '', c.starts_on) +
          field('ccEnd', tr('End date', 'Дата окончания'), 'date', '', c.ends_on) +
        '</div>' +
        '<div class="pv-field-grid">' +
          field('ccSchedule', tr('Schedule', 'Расписание'), 'text', tr('Mon/Wed 18:00', 'Пн/Ср 18:00'), c.schedule) +
          field('ccLocation', tr('Location', 'Место'), 'text', tr('Online / address', 'Онлайн / адрес'), c.location) +
        '</div>' +
        '<div class="pv-field"><label>' + esc(tr('Description', 'Описание')) + '</label>' +
          '<textarea id="ccDesc" maxlength="800" placeholder="' + esc(tr('What learners will get from this course', 'Что ученики получат от курса')) + '">' + esc(c.description || '') + '</textarea></div>' +
        '<div class="pv-field"><label>' + esc(tr('Status', 'Статус')) + '</label><select id="ccStatus"><option value="draft">' + esc(tr('Draft', 'Черновик')) + '</option><option value="active">' + esc(tr('Published', 'Опубликован')) + '</option><option value="closed">' + esc(tr('Enrollment closed', 'Набор закрыт')) + '</option><option value="completed">' + esc(tr('Completed', 'Завершён')) + '</option></select></div>' +
        (courseNotice ? '<div class="pv-notice">' + esc(courseNotice) + '</div>' : '') +
        '<div class="pv-edit-actions">' +
          '<button type="button" class="pv-btn-outline" id="ccPreview">' + esc(tr('Preview', 'Предпросмотр')) + '</button>' +
          '<button type="button" class="pv-btn-solid" id="ccSubmit"' + (courseSaving ? ' disabled' : '') + '>' + esc(courseSaving ? tr('Saving…', 'Сохранение…') : (courseEditing ? tr('Save changes', 'Сохранить') : tr('Create course', 'Создать курс'))) + '</button>' +
        '</div>' +
        '<p class="cc-hint">' + esc(tr('Excel columns: title, level, language, price, schedule, description', 'Колонки Excel: title, level, language, price, schedule, description')) + '</p>';

      var coverBtn = el('ccCoverBtn'); var coverFile = el('ccCoverFile');
      var statusSelect = el('ccStatus'); if (statusSelect) statusSelect.value = c.status || 'draft';
      var currencySelect = el('ccCurrency'); if (currencySelect && c.currency) currencySelect.value = c.currency;
      if (coverBtn && coverFile) {
        coverBtn.onclick = function () { coverFile.click(); };
        coverFile.onchange = function () {
          var f = coverFile.files && coverFile.files[0];
          if (f) void uploadCover(f);
        };
      }
      var submit = el('ccSubmit');
      if (submit) submit.onclick = function () { void submitCourse(); };
      var preview = el('ccPreview');
      if (preview) preview.onclick = function () { captureCourseForm(); coursePreview = !coursePreview; paintCourseModal(); };
      Array.prototype.forEach.call(body.querySelectorAll('input,textarea,select'), function (input) { input.addEventListener('input', function () { courseDirty = true; }); });
    }

    function captureCourseForm() {
      if (!courseEditing) courseEditing = {};
      var value = function (id) { return el(id) ? el(id).value : ''; };
      courseEditing.title = value('ccTitleInput'); courseEditing.level = value('ccLevel'); courseEditing.language = value('ccLanguage');
      courseEditing.price = value('ccPrice'); courseEditing.starts_on = value('ccStart'); courseEditing.ends_on = value('ccEnd');
      courseEditing.schedule = value('ccSchedule'); courseEditing.location = value('ccLocation'); courseEditing.description = value('ccDesc');
      courseEditing.status = value('ccStatus') || 'draft'; courseEditing.currency = value('ccCurrency') || 'EUR';
    }

    async function uploadCover(file) {
      courseDirty = true;
      courseNotice = tr('Uploading cover…', 'Загрузка обложки…'); paintCourseModal();
      try {
        courseCover = await ctx.uploadToBucket('posts', file);
        courseNotice = '';
      } catch (e) { courseNotice = tr('Could not upload the cover.', 'Не удалось загрузить обложку.'); }
      paintCourseModal();
    }

    async function submitCourse() {
      // Read EVERY field before any repaint — paintCourseModal() rebuilds the inputs.
      var val = function (id) { return (el(id) && el(id).value.trim()) || ''; };
      var title = val('ccTitleInput');
      if (!title) { courseNotice = tr('Enter a course title.', 'Введите название курса.'); paintCourseModal(); return; }
      captureCourseForm();
      var priceRaw = val('ccPrice');
      var fields = {
        level: val('ccLevel').toUpperCase() || null,
        language: val('ccLanguage') || null,
        price: priceRaw !== '' && !isNaN(Number(priceRaw)) ? Number(priceRaw) : null,
        currency: (el('ccCurrency') && el('ccCurrency').value) || null,
        starts_on: val('ccStart') || null, ends_on: val('ccEnd') || null,
        schedule: val('ccSchedule') || null, location: val('ccLocation') || null,
        description: val('ccDesc') || null,
        status: (el('ccStatus') && el('ccStatus').value) || 'draft'
      };
      if (fields.starts_on && fields.ends_on && fields.ends_on < fields.starts_on) {
        courseNotice = tr('End date cannot be before start date.', 'Дата окончания не может быть раньше даты начала.'); paintCourseModal(); return;
      }
      var collision = data.courses.some(function (item) {
        return (!courseEditing || String(item.id) !== String(courseEditing.id)) && fields.schedule && item.schedule &&
          item.schedule.toLowerCase() === fields.schedule.toLowerCase() && fields.starts_on && item.starts_on === fields.starts_on;
      });
      if (collision && !window.confirm(tr('Another course has the same start date and schedule. Save anyway?', 'У другого курса совпадают дата начала и расписание. Всё равно сохранить?'))) return;
      courseSaving = true; courseNotice = ''; paintCourseModal();
      var org = await ensureOrg();
      if (!org) { courseSaving = false; courseNotice = tr('Could not prepare your workspace. Try again.', 'Не удалось подготовить рабочее пространство. Попробуйте ещё раз.'); paintCourseModal(); return; }
      var row = {
        organization_id: org.id, created_by: ctx.user.id, title: title,
        cover_image_url: courseCover || null,
        level: fields.level, language: fields.language, price: fields.price, currency: fields.currency,
        starts_on: fields.starts_on, ends_on: fields.ends_on, schedule: fields.schedule,
        location: fields.location, description: fields.description, status: fields.status
      };
      var res;
      try {
        res = courseEditing && courseEditing.id
          ? await supa.from('courses').update(row).eq('id', courseEditing.id).eq('created_by', ctx.user.id)
          : await supa.from('courses').insert(row);
      } catch (e) { res = { error: e }; }
      courseSaving = false;
      if (!res || res.error) { courseNotice = (res && res.error && res.error.message) || tr('Could not save the course.', 'Не удалось сохранить курс.'); paintCourseModal(); return; }
      courseDirty = false; closeCourseModal();
      if (ctx.loadPublicData) ctx.loadPublicData();
      await load(ctx.user.id);
      activeTab = 'courses';
      paint();
    }

    function pickCourseExcel() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv';
      input.onchange = function () { var f = input.files && input.files[0]; if (f) void importCourseExcel(f); };
      input.click();
    }

    async function importCourseExcel(file) {
      if (!window.XLSX) { ctx.alert(tr('Spreadsheet library not loaded.', 'Библиотека таблиц не загрузилась.')); return; }
      var org = await ensureOrg();
      if (!org) { ctx.alert(tr('Could not prepare your workspace.', 'Не удалось подготовить рабочее пространство.')); return; }
      try {
        var buf = await file.arrayBuffer();
        var wb = window.XLSX.read(buf, { type: 'array' });
        var rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        var lookup = function (obj, key) { for (var k in obj) { if (k.toLowerCase().trim() === key) return obj[k]; } return ''; };
        var payload = rows.map(function (r) {
          var t = String(lookup(r, 'title') || '').trim();
          if (!t) return null;
          var pr = String(lookup(r, 'price') || '').trim();
          return {
            organization_id: org.id, created_by: ctx.user.id, title: t,
            level: String(lookup(r, 'level') || '').trim().toUpperCase() || null,
            language: String(lookup(r, 'language') || '').trim() || null,
            price: pr && !isNaN(Number(pr)) ? Number(pr) : null,
            schedule: String(lookup(r, 'schedule') || '').trim() || null,
            description: String(lookup(r, 'description') || '').trim() || null,
            status: 'active'
          };
        }).filter(Boolean);
        if (!payload.length) { ctx.alert(tr('No valid rows — need a "title" column.', 'Нет валидных строк — нужна колонка "title".')); return; }
        var res = await safe(supa.from('courses').insert(payload));
        if (!res) { ctx.alert(tr('Import failed.', 'Импорт не удался.')); return; }
        closeCourseModal();
        if (ctx.loadPublicData) ctx.loadPublicData();
        await load(ctx.user.id);
        activeTab = 'courses';
        paint();
        ctx.alert('✓ ' + payload.length + ' ' + tr('courses imported.', 'курсов импортировано.'));
      } catch (e) {
        ctx.alert((e && e.message) || tr('Import failed.', 'Импорт не удался.'));
      }
    }

    // ── Event / Schedule Live creation ──────────────────────────────────────
    var groupSaving = false, groupNotice = '';

    function openStudyGroupModal() {
      groupSaving = false; groupNotice = '';
      openModal(tr('Create study group', 'Создать учебную группу'), paintStudyGroupModal);
    }

    function paintStudyGroupModal() {
      var body = el('ccBody');
      if (!body) return;
      var hasOrganization = !!(state && state.myOrg && state.myOrg.id);
      body.innerHTML =
        '<div class="cc-provider-card"><span class="mg-row-ic teal">' + IC.book + '</span><div><b>' + esc(tr('Study group', 'Учебная группа')) + '</b><p>' + esc(tr('Add learners to this group, track attendance and run Zoom Classroom lessons.', 'Добавляйте учеников, отмечайте посещаемость и проводите уроки Zoom Classroom.')) + '</p></div></div>' +
        (!hasOrganization ? '<div class="pv-notice">' + esc(tr('Create your Duvela organization first.', 'Сначала создайте организацию Duvela.')) + '</div>' : '') +
        '<div class="pv-field"><label>' + esc(tr('Group name', 'Название группы')) + ' *</label><input id="groupNameInput" placeholder="' + esc(tr('e.g. German A2 Evening', 'например: Немецкий A2 — вечер')) + '"></div>' +
        '<div class="pv-field-grid"><div class="pv-field"><label>' + esc(tr('Language', 'Язык')) + '</label><input id="groupLanguageInput" placeholder="German"></div>' +
        '<div class="pv-field"><label>' + esc(tr('Level', 'Уровень')) + '</label><select id="groupLevelInput">' + ['A1','A2','B1','B2','C1','C2'].map(function (level) { return '<option>' + level + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="pv-field-grid"><div class="pv-field"><label>' + esc(tr('Format', 'Формат')) + '</label><select id="groupFormatInput"><option value="online">' + esc(tr('Online', 'Онлайн')) + '</option><option value="offline">' + esc(tr('In person', 'Офлайн')) + '</option></select></div>' +
        '<div class="pv-field"><label>' + esc(tr('Start date', 'Дата начала')) + '</label><input id="groupStartInput" type="date"></div></div>' +
        (groupNotice ? '<div class="pv-notice">' + esc(groupNotice) + '</div>' : '') +
        '<div class="pv-edit-actions"><button type="button" class="pv-btn-outline" id="groupCancel">' + esc(tr('Cancel', 'Отмена')) + '</button><button type="button" class="pv-btn-solid" id="groupSubmit"' + (!hasOrganization || groupSaving ? ' disabled' : '') + '>' + esc(groupSaving ? tr('Creating…', 'Создание…') : tr('Create group', 'Создать группу')) + '</button></div>';
      var cancel = el('groupCancel'); if (cancel) cancel.onclick = closeModal;
      var submit = el('groupSubmit'); if (submit) submit.onclick = function () { void submitStudyGroup(); };
    }

    async function submitStudyGroup() {
      var name = (el('groupNameInput') && el('groupNameInput').value.trim()) || '';
      if (!name || !state.myOrg) {
        groupNotice = tr('Enter a group name.', 'Введите название группы.');
        paintStudyGroupModal(); return;
      }
      groupSaving = true; groupNotice = ''; paintStudyGroupModal();
      var start = (el('groupStartInput') && el('groupStartInput').value) || '';
      var result = await supa.from('classes').insert({
        organization_id: state.myOrg.id,
        teacher_id: ctx.user.id,
        name: name,
        language: (el('groupLanguageInput') && el('groupLanguageInput').value.trim()) || null,
        level: (el('groupLevelInput') && el('groupLevelInput').value) || 'A1',
        format: (el('groupFormatInput') && el('groupFormatInput').value) || 'online',
        starts_at: start ? new Date(start + 'T09:00:00').toISOString() : null
      }).select('id,name,language,level,format,starts_at').single();
      groupSaving = false;
      if (result.error || !result.data) {
        groupNotice = (result.error && result.error.message) || tr('Could not create the group.', 'Не удалось создать группу.');
        paintStudyGroupModal(); return;
      }
      state.orgClasses = [result.data].concat(state.orgClasses || []);
      closeModal();
      paint();
      if (ctx.openClassManage) ctx.openClassManage(result.data.id);
    }

    var classSaving = false, classNotice = '';

    function openClassSessionModal() {
      classSaving = false; classNotice = '';
      openModal(tr('Schedule group lesson', 'Запланировать групповой урок'), paintClassSessionModal);
    }

    function paintClassSessionModal() {
      var body = el('ccBody');
      if (!body) return;
      var classes = (state && state.orgClasses) || [];
      var options = classes.map(function (item) {
        return '<option value="' + esc(item.id) + '">' + esc(item.name || tr('Class', 'Класс')) + ' · ' + esc([item.language, item.level].filter(Boolean).join(' ')) + '</option>';
      }).join('');
      body.innerHTML =
        '<div class="cc-provider-card"><span class="mg-row-ic purple">' + IC.live + '</span><div><b>Zoom Classroom</b><p>' + esc(tr('Interactive class with student cameras, microphones, chat and screen sharing. Up to 25 participants.', 'Интерактивный урок с камерами учеников, микрофонами, чатом и демонстрацией экрана. До 25 участников.')) + '</p></div></div>' +
        (classes.length ? '<div class="pv-field"><label>' + esc(tr('Student class', 'Учебный класс')) + ' *</label><select id="classGroupInput">' + options + '</select></div>' : '<div class="pv-notice">' + esc(tr('Create a class and add students before scheduling a group lesson.', 'Сначала создайте класс и добавьте учеников, затем запланируйте групповой урок.')) + '</div>') +
        '<div class="pv-field"><label>' + esc(tr('Lesson title', 'Название урока')) + ' *</label><input id="classTitleInput" placeholder="' + esc(tr('e.g. German conversation A2', 'например: Немецкий разговорный A2')) + '"></div>' +
        '<div class="pv-field"><label>' + esc(tr('Start date and time', 'Дата и время начала')) + ' *</label><input id="classWhenInput" type="datetime-local"></div>' +
        (classNotice ? '<div class="pv-notice">' + esc(classNotice) + '</div>' : '') +
        '<div class="pv-edit-actions"><button type="button" class="pv-btn-outline" id="classCancel">' + esc(tr('Cancel', 'Отмена')) + '</button>' +
        (classes.length ? '<button type="button" class="pv-btn-solid" id="classSubmit"' + (classSaving ? ' disabled' : '') + '>' + esc(classSaving ? tr('Saving…', 'Сохранение…') : tr('Schedule Zoom lesson', 'Запланировать Zoom-урок')) + '</button>' : '<a class="pv-btn-solid" href="#workspace" data-go="workspace">' + esc(tr('Create class', 'Создать класс')) + '</a>') + '</div>';
      var cancel = el('classCancel'); if (cancel) cancel.onclick = closeModal;
      var submit = el('classSubmit'); if (submit) submit.onclick = function () { void submitClassSession(); };
    }

    async function submitClassSession() {
      var classId = (el('classGroupInput') && el('classGroupInput').value) || '';
      var title = (el('classTitleInput') && el('classTitleInput').value.trim()) || '';
      var when = (el('classWhenInput') && el('classWhenInput').value) || '';
      if (!classId || !title || !when) {
        classNotice = tr('Choose a class, title and start time.', 'Выберите класс, название и время начала.');
        paintClassSessionModal(); return;
      }
      classSaving = true; classNotice = ''; paintClassSessionModal();
      var result = await supa.from('class_sessions').insert({
        class_id: classId, title: title, starts_at: new Date(when).toISOString(),
        created_by: ctx.user.id, status: 'scheduled', provider: 'zoom', max_participants: 25
      }).select('id').single();
      classSaving = false;
      if (result.error || !result.data) {
        classNotice = (result.error && result.error.message) || tr('Could not schedule the lesson.', 'Не удалось запланировать урок.');
        paintClassSessionModal(); return;
      }
      closeModal();
      await load(ctx.user.id);
      activeTab = 'live';
      paint();
      location.href = './classroom.html?s=' + encodeURIComponent(result.data.id);
    }

    var eventCover = null, eventSaving = false, eventNotice = '', eventIsLive = false;

    function openEventModal(isLive) {
      eventCover = null; eventSaving = false; eventNotice = ''; eventIsLive = !!isLive;
      openModal(isLive ? tr('Schedule LIVE', 'Запланировать эфир') : tr('Create event', 'Создать событие'), paintEventModal);
    }

    function paintEventModal() {
      var body = el('ccBody');
      if (!body) return;
      var coverStyle = eventCover ? 'background-image:url(' + esc(eventCover) + ');background-size:cover;background-position:center;' : '';
      var fmtOptions = eventIsLive
        ? '<option value="online">' + esc(tr('Online', 'Онлайн')) + '</option>'
        : '<option value="online">' + esc(tr('Online', 'Онлайн')) + '</option><option value="offline">' + esc(tr('In person', 'Офлайн')) + '</option><option value="hybrid">' + esc(tr('Hybrid', 'Гибрид')) + '</option>';
      body.innerHTML =
        '<button type="button" class="cc-cover" id="evCoverBtn" style="' + coverStyle + '">' + (eventCover ? '' : '<span>+ ' + esc(tr('Add cover photo', 'Добавить обложку')) + '</span>') + '</button>' +
        '<input type="file" id="evCoverFile" accept="image/*" hidden>' +
        '<div class="pv-field" style="margin-top:12px"><label>' + esc(tr('Title', 'Название')) + ' *</label>' +
          '<input id="evTitleInput" type="text" placeholder="' + esc(eventIsLive ? tr('e.g. Speaking Club B1', 'напр. Speaking Club B1') : tr('e.g. Grammar Workshop', 'напр. Грамматический воркшоп')) + '"></div>' +
        '<div class="pv-field-grid">' +
          field('evDateInput', tr('Date', 'Дата'), 'date') +
          field('evTimeInput', tr('Time', 'Время'), 'time') +
        '</div>' +
        '<div class="pv-field-grid">' +
          '<div class="pv-field"><label>' + esc(tr('Format', 'Формат')) + '</label><select id="evFormatInput">' + fmtOptions + '</select></div>' +
          field('evLangInput', tr('Language', 'Язык'), 'text', tr('English', 'Английский')) +
        '</div>' +
        '<div class="pv-field-grid">' +
          '<div id="evLocationField">' + field('evCityInput', tr('Location', 'Место'), 'text', tr('City or address', 'Город или адрес')) + '</div>' +
          field('evPriceInput', tr('Price (0 = free)', 'Цена (0 = бесплатно)'), 'number', '0') +
        '</div>' +
        '<div class="pv-field"><label>' + esc(tr('Description', 'Описание')) + '</label>' +
          '<textarea id="evDescInput" maxlength="800" placeholder="' + esc(tr('What is this session about', 'О чём эта сессия')) + '"></textarea></div>' +
        (eventNotice ? '<div class="pv-notice">' + esc(eventNotice) + '</div>' : '') +
        '<div class="pv-edit-actions">' +
          '<button type="button" class="pv-btn-outline" id="evCancel">' + esc(tr('Cancel', 'Отмена')) + '</button>' +
          '<button type="button" class="pv-btn-solid" id="evSubmit"' + (eventSaving ? ' disabled' : '') + '>' + esc(eventSaving ? tr('Saving…', 'Сохранение…') : (eventIsLive ? tr('Schedule', 'Запланировать') : tr('Publish event', 'Опубликовать'))) + '</button>' +
        '</div>';
      var coverBtn = el('evCoverBtn'), coverFile = el('evCoverFile');
      if (coverBtn && coverFile) {
        coverBtn.onclick = function () { coverFile.click(); };
        coverFile.onchange = function () { var f = coverFile.files && coverFile.files[0]; if (f) void uploadEventCover(f); };
      }
      var cancel = el('evCancel'); if (cancel) cancel.onclick = closeModal;
      var submit = el('evSubmit'); if (submit) submit.onclick = function () { void submitEvent(); };
      var format = el('evFormatInput');
      if (format) { format.onchange = syncEventLocation; syncEventLocation(); }
    }

    function syncEventLocation() {
      var format = el('evFormatInput'), fieldWrap = el('evLocationField'), input = el('evCityInput');
      if (!format || !fieldWrap || !input) return;
      var isRemote = format.value === 'online';
      fieldWrap.hidden = isRemote;
      input.disabled = isRemote;
      if (isRemote) input.value = '';
    }

    async function uploadEventCover(file) {
      eventNotice = tr('Uploading cover…', 'Загрузка обложки…'); paintEventModal();
      try { eventCover = await ctx.uploadToBucket('events', file); eventNotice = ''; }
      catch (e) { eventNotice = tr('Could not upload the cover.', 'Не удалось загрузить обложку.'); }
      paintEventModal();
    }

    async function submitEvent() {
      var val = function (id) { return (el(id) && el(id).value.trim()) || ''; };
      var title = val('evTitleInput');
      if (!title) { eventNotice = tr('Enter a title.', 'Введите название.'); paintEventModal(); return; }
      var priceRaw = val('evPriceInput');
      var isPaid = priceRaw !== '' && Number(priceRaw) > 0;
      var format = (el('evFormatInput') && el('evFormatInput').value) || 'online';
      var row = {
        organizer_id: ctx.user.id, title: title,
        description: val('evDescInput') || null,
        event_date: val('evDateInput') || null,
        event_time: val('evTimeInput') || null,
        format: format,
        language: val('evLangInput') || null,
        city: format === 'online' ? null : (val('evCityInput') || null),
        is_paid: isPaid, price_amount: isPaid ? Number(priceRaw) : null,
        image_url: eventCover || null
      };
      eventSaving = true; eventNotice = ''; paintEventModal();
      var res = await safe(supa.from('events').insert(row));
      eventSaving = false;
      if (!res) { eventNotice = tr('Could not create the event.', 'Не удалось создать событие.'); paintEventModal(); return; }
      await afterCreate();
      activeTab = eventIsLive ? 'live' : 'events';
      eventsSub = 'upcoming';
      paint();
    }

    // ── Challenge creation ──────────────────────────────────────────────────
    var challengeSaving = false, challengeNotice = '';

    function openChallengeModal() {
      challengeSaving = false; challengeNotice = '';
      openModal(tr('Create challenge', 'Создать челлендж'), paintChallengeModal);
    }

    function paintChallengeModal() {
      var body = el('ccBody');
      if (!body) return;
      var today = new Date().toISOString().slice(0, 10);
      var in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      body.innerHTML =
        '<div class="pv-field"><label>' + esc(tr('Title', 'Название')) + ' *</label>' +
          '<input id="chTitleInput" type="text" placeholder="' + esc(tr('e.g. 30-day speaking challenge', 'напр. 30 дней разговорной практики')) + '"></div>' +
        '<div class="pv-field-grid">' +
          field('chLevelInput', tr('Target level', 'Целевой уровень'), 'text', 'B1') +
          field('chExamInput', tr('Exam type', 'Тип экзамена'), 'text', 'IELTS') +
        '</div>' +
        '<div class="pv-field-grid">' +
          '<div class="pv-field"><label>' + esc(tr('Start date', 'Дата начала')) + '</label><input id="chStartInput" type="date" value="' + today + '"></div>' +
          '<div class="pv-field"><label>' + esc(tr('End date', 'Дата окончания')) + '</label><input id="chEndInput" type="date" value="' + in30 + '"></div>' +
        '</div>' +
        '<div class="pv-field-grid">' +
          field('chDialogsInput', tr('Daily dialogs', 'Диалогов в день'), 'number', '0') +
          field('chWordsInput', tr('Daily words', 'Слов в день'), 'number', '0') +
        '</div>' +
        (challengeNotice ? '<div class="pv-notice">' + esc(challengeNotice) + '</div>' : '') +
        '<div class="pv-edit-actions">' +
          '<button type="button" class="pv-btn-outline" id="chCancel">' + esc(tr('Cancel', 'Отмена')) + '</button>' +
          '<button type="button" class="pv-btn-solid" id="chSubmit"' + (challengeSaving ? ' disabled' : '') + '>' + esc(challengeSaving ? tr('Saving…', 'Сохранение…') : tr('Create challenge', 'Создать челлендж')) + '</button>' +
        '</div>';
      var cancel = el('chCancel'); if (cancel) cancel.onclick = closeModal;
      var submit = el('chSubmit'); if (submit) submit.onclick = function () { void submitChallenge(); };
    }

    async function submitChallenge() {
      var val = function (id) { return (el(id) && el(id).value.trim()) || ''; };
      var num = function (id) { return Math.max(0, Number(val(id)) || 0); };
      var title = val('chTitleInput');
      if (!title) { challengeNotice = tr('Enter a title.', 'Введите название.'); paintChallengeModal(); return; }
      // started_at & ends_at are NOT NULL — always provide both.
      var start = val('chStartInput') || new Date().toISOString().slice(0, 10);
      var end = val('chEndInput') || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
      var row = {
        created_by: ctx.user.id, title: title,
        target_level: val('chLevelInput') || null,
        exam_type: val('chExamInput') || null,
        started_at: start, ends_at: end,
        daily_min_dialogs: num('chDialogsInput'), daily_min_words: num('chWordsInput')
      };
      challengeSaving = true; challengeNotice = ''; paintChallengeModal();
      var res = await safe(supa.from('challenges').insert(row));
      challengeSaving = false;
      if (!res) { challengeNotice = tr('Could not create the challenge.', 'Не удалось создать челлендж.'); paintChallengeModal(); return; }
      await afterCreate();
      activeTab = 'challenges';
      paint();
    }

    function render() {
      var uid = ctx.user && ctx.user.id;
      if (!uid) return;
      if (loadedFor !== uid) { data = null; }
      paint();
      if (loadedFor !== uid) {
        loadedFor = uid;
        load(uid).then(paint).catch(function () { data = { events: [], courses: [], challenges: [], classSessions: [] }; paint(); });
      }
      return null;
    }

    return { render };
  }

  window.DuvelaBusinessManagement = { create: createManagement };
})();
