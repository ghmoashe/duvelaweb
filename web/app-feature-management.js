(function () {
  // Business "Management" page — web mirror of the mobile Bus management screen
  // (app/(business)/events.tsx): a gradient tab bar (Events / Courses / Schedule
  // Live / Challenges) with per-tab summary + list + empty states. View-only lists;
  // create/schedule buttons route to the existing web workspace/live panels.
  function createManagement(ctx) {
    const { tr, esc, supa } = ctx;
    let activeTab = 'events';
    let eventsSub = 'upcoming';
    let data = null;    // {events, courses, challenges}
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
      const [ev, co, ch] = await Promise.all([
        safe(supa.from('events').select(ctx.getEventColumns()).eq('organizer_id', uid).order('event_date', { ascending: true })),
        safe(supa.from('courses').select('id,title,level,language,status,price,currency,cover_image_url,starts_on,ends_on,schedule,location,created_at').eq('created_by', uid).order('created_at', { ascending: false })),
        safe(supa.from('challenges').select('id,title,target_level,exam_type,started_at,ends_at').order('created_at', { ascending: false }).limit(20))
      ]);
      data = { events: (ev && ev.data) || [], courses: (co && co.data) || [], challenges: (ch && ch.data) || [] };
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
        (btnLabel ? '<a class="mg-btn-solid" ' + btnAttrs + '>' + esc(btnLabel) + '</a>' : '') +
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
        '<a class="mg-btn-solid" ' + go('workspace') + '>' + esc(tr('New event', 'Новое событие')) + '</a>' +
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
          go('workspace'));
      }
      return html;
    }

    function renderCoursesTab() {
      var courses = data.courses;
      if (!courses.length) {
        return emptyCard(IC.book, tr('No courses yet', 'Пока нет курсов'),
          tr('Build your first course offer for learners.', 'Соберите первый курс для учеников.'),
          tr('Create course', 'Создать курс'), go('workspace'));
      }
      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic teal">' + IC.book + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(courses.length + ' ' + tr('courses', 'курсов')) + '</b>' +
        '<span>' + esc(tr('Manage your programs', 'Управляйте программами')) + '</span></div>' +
        '<a class="mg-btn-solid teal" ' + go('workspace') + '>' + esc(tr('New course', 'Новый курс')) + '</a>' +
        '</div>';
      html += '<div class="mg-list">' + courses.map(function (c) {
        var tags = [c.level, c.language].filter(Boolean).map(function (t) { return '<span class="mg-chip">' + esc(t) + '</span>'; }).join('');
        return '<a class="mg-row" href="#courses" data-go="courses" data-course-open="' + esc(c.id) + '">' +
          '<span class="mg-row-ic teal">' + IC.book + '</span>' +
          '<span class="mg-row-copy"><b>' + esc(c.title || tr('Untitled course', 'Без названия')) + '</b>' +
          '<span class="mg-chip-row">' + tags + '</span></span>' +
          '<span class="mg-row-tag">' + esc(priceText(c)) + '</span></a>';
      }).join('') + '</div>';
      return html;
    }

    function renderLiveTab() {
      var live = data.events.filter(function (e) { return isUpcoming(e) && isOnline(e); });
      if (!live.length) {
        return emptyCard(IC.live, tr('No scheduled LIVE yet', 'Пока нет запланированных эфиров'),
          tr('Plan an online session with your students.', 'Запланируйте онлайн-сессию с учениками.'),
          tr('Schedule Live', 'Запланировать эфир'), go('live'));
      }
      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic red">' + IC.live + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(tr('Scheduled LIVE', 'Запланированные эфиры')) + '</b>' +
        '<span>' + esc(tr('Upcoming online sessions', 'Ближайшие онлайн-сессии')) + '</span></div>' +
        '<a class="mg-btn-solid" ' + go('live') + '>' + esc(tr('Schedule', 'Запланировать')) + '</a>' +
        '</div>';
      html += '<div class="mg-list">' + live.map(function (ev) {
        return '<a class="mg-row" href="#events" data-go="events" data-event-open="' + esc(ev.id) + '">' +
          '<span class="mg-row-ic red">' + IC.live + '</span>' +
          '<span class="mg-row-copy"><b>' + esc(ev.title || tr('LIVE session', 'LIVE сессия')) + '</b>' +
          '<span>' + esc(eventWhen(ev)) + '</span></span>' +
          '<span class="mg-chevron">›</span></a>';
      }).join('') + '</div>';
      return html;
    }

    function renderChallengesTab() {
      var ch = data.challenges;
      if (!ch.length) {
        return emptyCard(IC.trophy, tr('No challenges yet', 'Пока нет челленджей'),
          tr('Motivate students with a learning challenge.', 'Мотивируйте учеников учебным челленджем.'),
          tr('Create challenge', 'Создать челлендж'), go('workspace'));
      }
      var html = '<div class="mg-summary">' +
        '<span class="mg-summary-ic purple">' + IC.trophy + '</span>' +
        '<div class="mg-summary-copy"><b>' + esc(ch.length + ' ' + tr('challenges', 'челленджей')) + '</b>' +
        '<span>' + esc(tr('Motivate students', 'Мотивируйте учеников')) + '</span></div>' +
        '<a class="mg-btn-solid purple" ' + go('workspace') + '>' + esc(tr('New challenge', 'Новый челлендж')) + '</a>' +
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
    }

    function render() {
      var uid = ctx.user && ctx.user.id;
      if (!uid) return;
      if (loadedFor !== uid) { data = null; }
      paint();
      if (loadedFor !== uid) {
        loadedFor = uid;
        load(uid).then(paint).catch(function () { data = { events: [], courses: [], challenges: [] }; paint(); });
      }
      return null;
    }

    return { render };
  }

  window.DuvelaBusinessManagement = { create: createManagement };
})();
