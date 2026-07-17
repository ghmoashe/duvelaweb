(function () {
  // Rich business "Dashboard" home for the web workspace — mirrors the mobile Bus
  // dashboard: profile + rating, Go Live banner, quick actions, My Business (LIVE
  // earnings in DUVELA coins), Manage events, My Gifts, Recent LIVE sessions and
  // an Analytics block (metric grid + rating bar + 7-day activity chart).
  function createBusinessDashboard(ctx) {
    const { tr, esc, supa } = ctx;
    const locale = ctx.isRu ? 'ru-RU' : 'en-US';
    let lastUserId = null;
    let inflight = null;

    function num(value) {
      return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString(locale);
    }
    function dc(value) {
      return num(value) + ' DC';
    }

    async function safe(promise, fallback) {
      try {
        const result = await promise;
        if (result && result.error) return fallback;
        return result;
      } catch (error) {
        return fallback;
      }
    }

    function dayKeys() {
      return Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - 6 + index);
        return date.toISOString().slice(0, 10);
      });
    }

    function aggregateByName(items) {
      const totals = new Map();
      items.forEach((item) => {
        const key = item.name;
        const current = totals.get(key) || { count: 0, name: key, total: 0 };
        current.count += 1;
        current.total += Number(item.value) || 0;
        totals.set(key, current);
      });
      return Array.from(totals.values())
        .sort((left, right) => right.total - left.total || right.count - left.count)
        .slice(0, 3);
    }

    async function fetchData(uid) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const weekStart = dayKeys()[0] + 'T00:00:00.000Z';

      const [eventsRes, reviewsRes, postsRes, followersRes, earningsRes, giftsRes] = await Promise.all([
        safe(supa.from('events').select('id,created_at', { count: 'exact' }).eq('organizer_id', uid), { data: [], count: 0 }),
        safe(supa.from('teacher_reviews').select('rating,created_at').eq('teacher_id', uid), { data: [] }),
        safe(supa.from('posts').select('id,created_at').eq('user_id', uid), { data: [] }),
        safe(supa.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', uid), { count: 0 }),
        safe(supa.from('live_teacher_earnings').select('amount,source,label,session_id,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(200), { data: [] }),
        safe(supa.from('live_gifts').select('gift_name,cost,sender_name,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(200), { data: [] })
      ]);

      const eventRows = (eventsRes && eventsRes.data) || [];
      const eventIds = eventRows.map((row) => row.id).filter(Boolean);
      const eventsCount = (eventsRes && typeof eventsRes.count === 'number') ? eventsRes.count : eventIds.length;
      const postRows = (postsRes && postsRes.data) || [];
      const postIds = postRows.map((row) => row.id).filter(Boolean);

      const ratings = ((reviewsRes && reviewsRes.data) || [])
        .map((row) => Number(row.rating))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 5);
      const rating = ratings.length > 0 ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;

      const countBy = async (table) => {
        if (postIds.length === 0) return 0;
        const res = await safe(supa.from(table).select('post_id', { count: 'exact', head: true }).in('post_id', postIds), { count: 0 });
        return (res && res.count) || 0;
      };
      const clientsFrom = async () => {
        if (eventIds.length === 0) return 0;
        const res = await safe(supa.from('event_rsvps').select('user_id').in('event_id', eventIds).eq('status', 'going'), { data: [] });
        return new Set(((res && res.data) || []).map((row) => row.user_id).filter(Boolean)).size;
      };

      const [likesCount, commentsCount, viewsCount, clientsCount] = await Promise.all([
        countBy('post_likes'),
        countBy('post_comments'),
        countBy('post_views'),
        clientsFrom()
      ]);

      // Earnings summary (mirrors buildEarningsSummary on mobile).
      const earnings = ((earningsRes && earningsRes.data) || []).map((row) => ({
        amount: Math.max(0, Math.floor(Number(row.amount) || 0)),
        created_at: row.created_at || new Date(0).toISOString(),
        label: row.label,
        session_id: row.session_id,
        source: row.source || 'paid_minutes'
      }));
      const gifts = ((giftsRes && giftsRes.data) || []).map((row) => ({
        cost: Math.max(0, Math.floor(Number(row.cost) || 0)),
        created_at: row.created_at || new Date(0).toISOString(),
        gift_name: (row.gift_name || '').trim() || 'Gift',
        sender_name: (row.sender_name || '').trim() || (ctx.isRu ? 'Зритель' : 'Viewer')
      }));

      const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
      const afterMonth = (iso) => new Date(iso).getTime() >= monthStart.getTime();
      const paidMinutesTotal = sum(earnings.filter((item) => item.source === 'paid_minutes'), (item) => item.amount);
      const nonGiftTotal = sum(earnings.filter((item) => item.source !== 'gift'), (item) => item.amount);
      const earningGifts = sum(earnings.filter((item) => item.source === 'gift'), (item) => item.amount);
      const directGifts = sum(gifts, (item) => item.cost);
      const giftsTotal = Math.max(earningGifts, directGifts);
      const total = nonGiftTotal + giftsTotal;
      const monthNonGift = sum(earnings.filter((item) => item.source !== 'gift' && afterMonth(item.created_at)), (item) => item.amount);
      const monthEarningGifts = sum(earnings.filter((item) => item.source === 'gift' && afterMonth(item.created_at)), (item) => item.amount);
      const monthDirectGifts = sum(gifts.filter((item) => afterMonth(item.created_at)), (item) => item.cost);
      const monthTotal = monthNonGift + Math.max(monthEarningGifts, monthDirectGifts);
      const sessionsCount = new Set(earnings.map((item) => item.session_id).filter(Boolean)).size;
      const recent = earnings.slice().sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()).slice(0, 3);
      const topGifts = aggregateByName(gifts.map((item) => ({ name: item.gift_name, value: item.cost })));
      const topViewers = aggregateByName(gifts.map((item) => ({ name: item.sender_name, value: item.cost })));

      // 7-day activity: content + engagement signals we can read cheaply.
      const keys = dayKeys();
      const counts = new Map(keys.map((key) => [key, 0]));
      const addRows = (rows) => (rows || []).forEach((row) => {
        const key = (row.created_at || '').slice(0, 10);
        if (key && counts.has(key)) counts.set(key, counts.get(key) + 1);
      });
      addRows(postRows.filter((row) => (row.created_at || '') >= weekStart));
      addRows(eventRows.filter((row) => (row.created_at || '') >= weekStart));
      addRows(((reviewsRes && reviewsRes.data) || []).filter((row) => (row.created_at || '') >= weekStart));
      addRows(gifts.filter((item) => item.created_at >= weekStart).map((item) => ({ created_at: item.created_at })));
      addRows(earnings.filter((item) => item.created_at >= weekStart).map((item) => ({ created_at: item.created_at })));
      const activity = keys.map((key) => counts.get(key) || 0);

      return {
        rating,
        eventsCount,
        clientsCount,
        likesCount,
        commentsCount,
        viewsCount,
        followersCount: (followersRes && followersRes.count) || 0,
        coursesCount: (ctx.state.courses || []).length,
        assignmentsCount: 0,
        giftsTotal,
        total,
        monthTotal,
        paidMinutesTotal,
        sessionsCount,
        recent,
        topGifts,
        topViewers,
        activity
      };
    }

    function statTile(icon, label, value) {
      return '<div class="bd-metric"><span class="bd-metric-ic">' + icon + '</span>' +
        '<span class="bd-metric-label">' + esc(label) + '</span>' +
        '<b class="bd-metric-value">' + esc(value) + '</b></div>';
    }
    function pill(label, value) {
      return '<div class="bd-pill"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
    }
    function manageRow(view, tint, icon, title, meta) {
      return '<a class="bd-manage-row" href="#' + view + '" data-go="' + view + '">' +
        '<span class="bd-manage-ic" style="background:' + tint + '">' + icon + '</span>' +
        '<span class="bd-manage-copy"><b>' + esc(title) + '</b><span>' + esc(meta) + '</span></span>' +
        '<span class="bd-chevron">›</span></a>';
    }
    function quick(view, tint, icon, label) {
      return '<a class="bd-quick" href="#' + view + '" data-go="' + view + '">' +
        '<span class="bd-quick-ic" style="background:' + tint + '">' + icon + '</span>' +
        '<span>' + esc(label) + '</span></a>';
    }

    function render() {
      const host = document.getElementById('busDashboard');
      if (!host) return;
      const uid = ctx.user && ctx.user.id;
      if (!uid) return;

      const profile = ctx.profile || {};
      const name = (profile.full_name || (ctx.user.email || 'Duvela Academy')).trim();
      const liveUrl = ctx.teacherLiveUrl();

      // Skeleton first paint, then hydrate with data. Keeps counts from a stale user.
      if (lastUserId !== uid) {
        host.innerHTML = shell(name, profile, liveUrl, null);
      }
      lastUserId = uid;

      inflight = fetchData(uid).then((data) => {
        host.innerHTML = shell(name, profile, liveUrl, data);
      }).catch(() => {
        host.innerHTML = shell(name, profile, liveUrl, {});
      });
      return inflight;
    }

    function shell(name, profile, liveUrl, data) {
      const ready = Boolean(data);
      const rating = data && typeof data.rating === 'number' ? data.rating.toFixed(1) : null;
      const v = (value) => ready ? value : '—';

      const ic = {
        live: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-4v12l-6-4z"/></svg>',
        cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
        add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
        book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5V5a2 2 0 012-2h13v16H6.5A2.5 2.5 0 004 21.5"/></svg>',
        trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v4a6 6 0 01-12 0zM4 5h2M18 5h2M9 21h6M12 15v6"/></svg>',
        bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12c1 1 1 2 1 3h6c0-1 0-2 1-3a7 7 0 00-4-12z"/></svg>',
        eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
        heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z"/></svg>',
        chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/></svg>',
        follow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M18 8v6M15 11h6"/></svg>',
        people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 4a4 4 0 010 8"/></svg>',
        doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6"/></svg>',
        gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6 3-6"/></svg>'
      };

      // Profile card
      let html = '<div class="bd-profile">' +
        '<div class="bd-profile-left">' +
        '<span class="bd-avatar">' + ctx.avatarInner(name, profile.avatar_url) + '</span>' +
        '<span class="bd-profile-name"><b>' + esc(name) + '</b>' +
        '<span class="bd-teacher-badge">' + esc(tr('Teacher', 'Преподаватель')) + '</span></span>' +
        '</div>' +
        '<span class="bd-rating">★ <b>' + esc(rating || '—') + '</b></span>' +
        '</div>';

      // Go Live banner
      html += '<a class="bd-golive" href="' + esc(liveUrl) + '">' +
        '<span class="bd-golive-dot"></span>' +
        '<span class="bd-golive-copy"><b>' + esc(tr('Start Teaching LIVE', 'Начать преподавать в эфире')) + '</b>' +
        '<span>' + esc(tr('Connect with students in real-time', 'Общайтесь с учениками в реальном времени')) + '</span></span>' +
        '<span class="bd-golive-btn">' + ic.live + esc(tr('Go Live', 'В эфир')) + '</span>' +
        '</a>';

      // Quick actions
      html += '<div class="bd-quick-grid">' +
        quick('live', 'var(--red-soft)', ic.live, tr('Schedule Live', 'Запланировать эфир')) +
        quick('schedule', 'var(--teal-soft)', ic.cal, tr('Schedule', 'Расписание')) +
        quick('events', 'var(--purple-soft)', ic.add, tr('Create Event', 'Создать событие')) +
        quick('events', 'var(--purple-soft)', ic.cal, tr('My Events', 'Мои события')) +
        quick('courses', 'var(--purple-soft)', ic.book, tr('My Courses', 'Мои курсы')) +
        quick('courses', 'var(--teal-soft)', ic.book, tr('Add Courses', 'Добавить курсы')) +
        quick('workspace', 'var(--purple-soft)', ic.trophy, tr('Challenges', 'Челленджи')) +
        quick('workspace', 'var(--teal-soft)', ic.bulb, tr('My practices', 'Мои практики')) +
        '</div>';

      // My Business (LIVE earnings)
      html += section(tr('My Business', 'Мой бизнес'), null,
        '<div class="bd-business">' +
          '<div class="bd-business-top">' +
            '<span class="bd-business-title">' + esc(tr('My Business', 'Мой бизнес')) + '</span>' +
            '<span class="bd-business-badge">' + esc(tr('Teacher Live', 'Учитель Live')) + '</span>' +
          '</div>' +
          '<div class="bd-business-figures">' +
            '<div><b>' + v(dc(data && data.monthTotal)) + '</b><span>' + esc(tr('Income (This Month)', 'Доход (за месяц)')) + '</span></div>' +
            '<div><b>' + v(dc(data && data.total)) + '</b><span>' + esc(tr('Available Balance', 'Доступный баланс')) + '</span></div>' +
          '</div>' +
          '<div class="bd-business-pills">' +
            pill(tr('Paid LIVE', 'Платный LIVE'), v(dc(data && data.paidMinutesTotal))) +
            pill(tr('Gifts', 'Подарки'), v(dc(data && data.giftsTotal))) +
            pill(tr('Sessions', 'Сессии'), v(num(data && data.sessionsCount))) +
          '</div>' +
          '<div class="bd-business-actions">' +
            '<a class="bd-btn-outline" href="#events" data-go="events">' + esc(tr('Details', 'Подробнее')) + '</a>' +
            '<a class="bd-btn-solid" href="#profile" data-go="profile">' + esc(tr('Withdraw', 'Вывести')) + '</a>' +
          '</div>' +
        '</div>');

      // Manage events
      html += section(tr('Manage events', 'Управление событиями'), null,
        '<div class="bd-manage">' +
          manageRow('events', 'var(--purple-soft)', ic.cal, tr('Events', 'События'), tr('Plan and publish events', 'Планируйте и публикуйте события')) +
          manageRow('courses', 'var(--teal-soft)', ic.book, tr('Courses', 'Курсы'), tr('Manage Courses', 'Управление курсами')) +
          manageRow('live', 'var(--red-soft)', ic.live, tr('Schedule Live', 'Запланировать эфир'), tr('Sessions with students', 'Сессии с учениками')) +
          manageRow('workspace', 'var(--purple-soft)', ic.trophy, tr('Challenges', 'Челленджи'), tr('Motivate students', 'Мотивируйте учеников')) +
        '</div>');

      // My Gifts
      const topGift = data && data.topGifts && data.topGifts[0];
      const topViewer = data && data.topViewers && data.topViewers[0];
      html += section(tr('My Gifts', 'Мои подарки'), null,
        '<div class="bd-gifts">' +
          '<div class="bd-gifts-head">' +
            '<span class="bd-gifts-ic">' + ic.gem + '</span>' +
            '<div><span class="bd-gifts-label">' + esc(tr('Total Coins', 'Всего монет')) + '</span>' +
            '<div class="bd-gifts-coin"><b>' + v(num(data && data.giftsTotal)) + '</b><span>' + esc(tr('LIVE gifts', 'подарки LIVE')) + '</span></div></div>' +
          '</div>' +
          '<div class="bd-gifts-stats">' +
            '<div class="bd-gift-stat"><span>' + esc(tr('Top Gift', 'Топ подарок')) + '</span><b>' + esc(topGift ? topGift.name : '—') + '</b>' +
              (topGift ? '<small>x' + num(topGift.count) + '</small>' : '') + '</div>' +
            '<div class="bd-gift-stat"><span>' + esc(tr('Top User', 'Топ зритель')) + '</span><b>' + esc(topViewer ? topViewer.name : '—') + '</b>' +
              (topViewer ? '<small>' + dc(topViewer.total) + '</small>' : '') + '</div>' +
          '</div>' +
          '<div class="bd-business-actions">' +
            '<a class="bd-btn-outline dark" href="#events" data-go="events">' + esc(tr('Details', 'Подробнее')) + '</a>' +
            '<a class="bd-btn-solid dark" href="#profile" data-go="profile">' + esc(tr('Withdraw', 'Вывести')) + '</a>' +
          '</div>' +
        '</div>');

      // Recent LIVE sessions
      const recent = (data && data.recent) || [];
      let recentBody;
      if (recent.length > 0) {
        recentBody = recent.map((item) => {
          const isGift = item.source === 'gift';
          return '<div class="bd-session"><span class="bd-session-ic">' + (isGift ? '🎁' : ic.live) + '</span>' +
            '<span class="bd-session-copy"><b>' + esc(item.label || (isGift ? tr('Gift received', 'Получен подарок') : tr('LIVE session', 'LIVE сессия'))) + '</b>' +
            '<span>' + esc(ctx.timeAgo(item.created_at)) + '</span></span>' +
            '<span class="bd-session-amount">+' + dc(item.amount) + '</span></div>';
        }).join('');
      } else {
        recentBody = '<div class="bd-empty">' + ic.live +
          '<div><b>' + esc(tr('No sessions yet', 'Пока нет сессий')) + '</b>' +
          '<span>' + esc(tr('Your completed LIVE sessions will appear here with earnings and duration.', 'Ваши завершённые эфиры появятся здесь с доходом и длительностью.')) + '</span></div>' +
          '<a class="bd-btn-solid" href="' + esc(liveUrl) + '">' + esc(tr('Go Live now', 'В эфир сейчас')) + '</a></div>';
      }
      html += section(tr('Recent LIVE Sessions', 'Недавние LIVE сессии'), ic.live,
        '<div class="bd-card">' + recentBody + '</div>');

      // Analytics
      const barMax = data && data.activity ? Math.max.apply(null, data.activity.concat([1])) : 1;
      const bars = (data && data.activity ? data.activity : [0, 0, 0, 0, 0, 0, 0]).map((value) => {
        const height = value === 0 ? 4 : Math.max(14, Math.round((value / barMax) * 100));
        return '<span class="bd-bar' + (value === 0 ? ' empty' : '') + '" style="height:' + height + '%"></span>';
      }).join('');
      const activityTotal = (data && data.activity ? data.activity : []).reduce((sum, value) => sum + value, 0);

      html += section(tr('Analytics', 'Аналитика'), '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/></svg>',
        '<div class="bd-card bd-analytics">' +
          '<div class="bd-metric-grid">' +
            statTile(ic.eye, tr('Video Views', 'Просмотры видео'), v(num(data && data.viewsCount))) +
            statTile(ic.heart, tr('Likes', 'Лайки'), v(num(data && data.likesCount))) +
            statTile(ic.chat, tr('Comments', 'Комментарии'), v(num(data && data.commentsCount))) +
            statTile(ic.follow, tr('Followers', 'Подписчики'), v(num(data && data.followersCount))) +
            statTile(ic.people, tr('Clients', 'Клиенты'), v(num(data && data.clientsCount))) +
            statTile(ic.cal, tr('Events', 'События'), v(num(data && data.eventsCount))) +
            statTile(ic.book, tr('Courses', 'Курсы'), v(num(data && data.coursesCount))) +
            statTile(ic.doc, tr('Assignments', 'Задания'), v(num(data && data.assignmentsCount))) +
          '</div>' +
          '<div class="bd-progress">' +
            '<div class="bd-progress-head"><span>' + esc(tr('Avg. Rating', 'Средний рейтинг')) + '</span><b>' + esc(rating ? rating + ' / 5' : '—') + '</b></div>' +
            '<div class="bd-progress-track"><span style="width:' + (rating ? (parseFloat(rating) / 5 * 100) : 0) + '%"></span></div>' +
          '</div>' +
          '<div class="bd-activity">' +
            '<div class="bd-progress-head"><span>' + esc(tr('Activity (7 days)', 'Активность (7 дней)')) + '</span><b>' + num(activityTotal) + '</b></div>' +
            '<div class="bd-bars">' + bars + '</div>' +
          '</div>' +
        '</div>');

      return html;
    }

    function section(title, icon, body) {
      return '<div class="bd-section">' +
        '<div class="bd-section-head">' + (icon ? '<span class="bd-section-ic">' + icon + '</span>' : '') +
        '<h3>' + esc(title) + '</h3></div>' + body + '</div>';
    }

    return { render };
  }

  window.DuvelaBusinessDashboard = { create: createBusinessDashboard };
})();
