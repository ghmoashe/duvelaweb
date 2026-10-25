(function () {
  // Rich business "Dashboard" home for the web workspace — mirrors the mobile Bus
  // dashboard: profile + rating, Go Live banner, quick actions, My Business (LIVE
  // earnings in DUVELA coins), Manage events, My Gifts, Recent LIVE sessions and
  // an Analytics block (metric grid + rating bar + 7-day activity chart).
  function createBusinessDashboard(ctx) {
    const { tr, esc, supa } = ctx;
    const locale = ctx.isRu ? 'ru-RU' : 'en-US';
    let lastUserId = null;
    let lastData = null;
    let inflight = null;
    let revenuePeriod = 30;

    function num(value) {
      return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString(locale);
    }
    function dc(value) {
      return num(value) + ' DC';
    }
    function money(value, currency) {
      const amount = Math.max(0, Number(value) || 0);
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0 }).format(amount);
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

      const [eventsRes, reviewsRes, postsRes, followersRes, earningsRes, giftsRes, coursesRes, classesRes, sessionsRes] = await Promise.all([
        safe(supa.from('events').select('id,title,created_at,is_paid,price_amount,organizer_id', { count: 'exact' }).eq('organizer_id', uid), { data: [], count: 0 }),
        safe(supa.from('teacher_reviews').select('rating,created_at').eq('teacher_id', uid), { data: [] }),
        safe(supa.from('posts').select('id,created_at').eq('user_id', uid), { data: [] }),
        safe(supa.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', uid), { count: 0 }),
        safe(supa.from('live_teacher_earnings').select('amount,source,label,session_id,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(200), { data: [] }),
        safe(supa.from('live_gifts').select('gift_name,cost,sender_name,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(200), { data: [] }),
        safe(supa.from('courses').select('id,title,description,language,level,price,currency,status,cover_image_url,created_at').eq('created_by', uid).neq('status', 'archived').limit(500), { data: [] }),
        safe(supa.from('classes').select('id,course_id,name,language,level').eq('teacher_id', uid).limit(500), { data: [] }),
        safe(supa.from('class_sessions').select('id,class_id,title,starts_at,ends_at,duration_min,status,provider').eq('created_by', uid).order('starts_at', { ascending: true }).limit(100), { data: [] })
      ]);
      const membershipsRes = await safe(supa.from('organization_memberships').select('organization_id').eq('user_id', uid).eq('status', 'active'), { data: [] });
      const orgIds = Array.from(new Set(((membershipsRes && membershipsRes.data) || []).map((row) => row.organization_id).filter(Boolean)));
      let orgCourses = [];
      if (orgIds.length) {
        const orgCoursesRes = await safe(supa.from('courses').select('id,title,price,currency,status,created_at,organization_id').in('organization_id', orgIds).neq('status', 'archived').limit(500), { data: [] });
        orgCourses = (orgCoursesRes && orgCoursesRes.data) || [];
      }

      const eventRows = (eventsRes && eventsRes.data) || [];
      const eventIds = eventRows.map((row) => row.id).filter(Boolean);
      const eventsCount = (eventsRes && typeof eventsRes.count === 'number') ? eventsRes.count : eventIds.length;
      const courseMap = new Map();
      ((coursesRes && coursesRes.data) || []).concat(orgCourses).forEach((course) => {
        if (course && course.id) courseMap.set(course.id, course);
      });
      const courseRows = Array.from(courseMap.values());
      const paidCourses = courseRows.filter((course) => Number(course.price || 0) > 0);
      const paidEvents = eventRows.filter((event) => event.is_paid && Number(event.price_amount || 0) > 0);
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

      const [enrollmentsRes, rsvpsRes] = await Promise.all([
        courseRows.length
          ? safe(supa.from('course_enrollments').select('id,course_id,user_id,status,full_name,email,created_at').in('course_id', courseRows.map((course) => course.id)).in('status', ['confirmed', 'pending']), { data: [] })
          : { data: [] },
        paidEvents.length
          ? safe(supa.from('event_rsvps').select('event_id,user_id,status,created_at').in('event_id', paidEvents.map((event) => event.id)).eq('status', 'going'), { data: [] })
          : { data: [] }
      ]);
      const courseById = new Map(paidCourses.map((course) => [course.id, course]));
      const allCourseById = new Map(courseRows.map((course) => [course.id, course]));
      const eventById = new Map(paidEvents.map((event) => [event.id, event]));
      let coursePendingCount = 0;
      let courseSalesCount = 0;
      let courseSalesTotal = 0;
      const pendingEnrollments = [];
      const courseSales = [];
      const enrollmentRows = (enrollmentsRes && enrollmentsRes.data) || [];
      const activeStudentKeys = new Set();
      enrollmentRows.forEach((enrollment) => {
        const course = allCourseById.get(enrollment.course_id);
        if (!course) return;
        if (enrollment.status === 'pending') {
          coursePendingCount += 1;
          pendingEnrollments.push({ id: enrollment.id, course_id: enrollment.course_id, course_title: course.title, full_name: enrollment.full_name, email: enrollment.email, created_at: enrollment.created_at });
        } else if (enrollment.status === 'confirmed') {
          activeStudentKeys.add(enrollment.user_id || enrollment.email || enrollment.id);
          const paidCourse = courseById.get(enrollment.course_id);
          if (!paidCourse) return;
          courseSalesCount += 1;
          courseSalesTotal += Number(paidCourse.price || 0);
          courseSales.push({ id: enrollment.id, title: paidCourse.title, amount: Number(paidCourse.price || 0), currency: paidCourse.currency || 'EUR', created_at: enrollment.created_at });
        }
      });
      let eventSalesCount = 0;
      let eventSalesTotal = 0;
      const eventSales = [];
      ((rsvpsRes && rsvpsRes.data) || []).forEach((rsvp) => {
        const event = eventById.get(rsvp.event_id);
        if (!event || rsvp.user_id === uid) return;
        eventSalesCount += 1;
        eventSalesTotal += Number(event.price_amount || 0);
        eventSales.push({ event_id: rsvp.event_id, title: event.title || 'Event', amount: Number(event.price_amount || 0), currency: 'EUR', created_at: rsvp.created_at });
      });
      const salesCurrency = (paidCourses.find((course) => course.currency) || {}).currency || 'EUR';

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
      const courseMonthSalesTotal = sum(courseSales.filter((item) => afterMonth(item.created_at)), (item) => item.amount);
      const eventMonthSalesTotal = sum(eventSales.filter((item) => afterMonth(item.created_at)), (item) => item.amount);
      const salesByCurrency = [...courseSales, ...eventSales].reduce((totals, item) => {
        const currency = String(item.currency || 'EUR').toUpperCase();
        totals[currency] = (totals[currency] || 0) + Number(item.amount || 0);
        return totals;
      }, {});
      const weekSalesByDay = new Map(dayKeys().map((key) => [key, 0]));
      const addSaleDay = (item) => {
        const key = (item.created_at || '').slice(0, 10);
        if (key && weekSalesByDay.has(key)) weekSalesByDay.set(key, weekSalesByDay.get(key) + (Number(item.amount) || 0));
      };
      courseSales.forEach(addSaleDay);
      eventSales.forEach(addSaleDay);
      earnings.forEach((item) => addSaleDay({ created_at: item.created_at, amount: item.amount }));
      const weekRevenueByDay = dayKeys().map((key) => weekSalesByDay.get(key) || 0);
      const weekRevenueTotal = weekRevenueByDay.reduce((total, value) => total + value, 0);

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

      const classRows = (classesRes && classesRes.data) || [];
      const classById = new Map(classRows.map((row) => [row.id, row]));
      const studentsByCourse = new Map();
      enrollmentRows.filter((row) => row.status === 'confirmed').forEach((row) => {
        const set = studentsByCourse.get(row.course_id) || new Set();
        set.add(row.user_id || row.email || row.id);
        studentsByCourse.set(row.course_id, set);
      });
      courseRows.forEach((course) => { course.studentCount = (studentsByCourse.get(course.id) || new Set()).size; });
      const sessions = ((sessionsRes && sessionsRes.data) || []).map((session) => {
        const group = classById.get(session.class_id) || {};
        const course = allCourseById.get(group.course_id) || {};
        return Object.assign({}, session, { class_name: group.name, course_id: group.course_id, course_title: course.title, participants: (studentsByCourse.get(group.course_id) || new Set()).size });
      });
      return {
        rating,
        eventsCount,
        clientsCount,
        likesCount,
        commentsCount,
        viewsCount,
        followersCount: (followersRes && followersRes.count) || 0,
        coursesCount: courseRows.length,
        publishedCoursesCount: courseRows.filter((course) => ['active', 'published'].includes(String(course.status || '').toLowerCase())).length,
        activeStudentsCount: activeStudentKeys.size,
        courseRows,
        sessions,
        earnings,
        gifts,
        assignmentsCount: 0,
        giftsTotal,
        total,
        monthTotal,
        monthCourseSalesTotal: courseMonthSalesTotal,
        monthEventSalesTotal: eventMonthSalesTotal,
        monthRevenueTotal: courseMonthSalesTotal + eventMonthSalesTotal + monthTotal,
        weekRevenueByDay,
        weekRevenueTotal,
        paidMinutesTotal,
        sessionsCount,
        recent,
        topGifts,
        topViewers,
        activity,
        coursePendingCount,
        courseSalesCount,
        courseSalesTotal,
        eventSalesCount,
        eventSalesTotal,
        courseEventSalesTotal: courseSalesTotal + eventSalesTotal,
        salesCurrency,
        salesByCurrency,
        pendingEnrollments,
        courseSales,
        eventSales
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
    function manageRow(view, tint, icon, title, meta, tab) {
      return '<a class="bd-manage-row" href="#' + view + '" data-go="' + view + '"' + (tab ? ' data-management-tab="' + esc(tab) + '"' : '') + '>' +
        '<span class="bd-manage-ic" style="background:' + tint + '">' + icon + '</span>' +
        '<span class="bd-manage-copy"><b>' + esc(title) + '</b><span>' + esc(meta) + '</span></span>' +
        '<span class="bd-chevron">›</span></a>';
    }
    function quick(view, tint, icon, label, tab) {
      return '<a class="bd-quick" href="#' + view + '" data-go="' + view + '"' + (tab ? ' data-management-tab="' + esc(tab) + '"' : '') + '>' +
        '<span class="bd-quick-ic" style="background:' + tint + '">' + icon + '</span>' +
        '<span>' + esc(label) + '</span></a>';
    }

    function bindBusinessActions(host) {
      host.querySelectorAll('[data-business-details]').forEach((button) => {
        button.onclick = function () { openBusinessModal('details'); };
      });
      host.querySelectorAll('[data-business-withdraw]').forEach((button) => {
        button.onclick = function () { openBusinessModal('withdraw'); };
      });
      host.querySelectorAll('[data-business-pending]').forEach((button) => {
        button.onclick = function () { openBusinessModal('pending'); };
      });
      host.querySelectorAll('[data-dashboard-period]').forEach((button) => {
        button.onclick = function () {
          revenuePeriod = Number(button.dataset.dashboardPeriod) || 30;
          if (lastData) {
            host.innerHTML = shell((ctx.profile && ctx.profile.full_name) || (ctx.user && ctx.user.email) || 'Duvela Academy', ctx.profile || {}, ctx.teacherLiveUrl(), lastData);
            bindBusinessActions(host);
          }
        };
      });
      host.querySelectorAll('[data-dashboard-create-course]').forEach((button) => {
        button.onclick = function () {
          if (ctx.management && ctx.management.openCourseModal) ctx.management.openCourseModal();
          else location.hash = 'courses';
        };
      });
      host.querySelectorAll('[data-dashboard-notifications]').forEach((button) => {
        button.onclick = function () { const bell = document.getElementById('notifBell'); if (bell) bell.click(); };
      });
    }

    function modalRows(rows, emptyText) {
      if (!rows || !rows.length) return '<div class="bd-modal-empty">' + esc(emptyText) + '</div>';
      return rows.map((row) => '<div class="bd-modal-row"><div><b>' + esc(row.title || row.course_title || row.label || 'Item') + '</b><span>' + esc(row.meta || row.full_name || row.email || row.created_at || '') + '</span></div><strong>' + esc(row.value || '') + '</strong></div>').join('');
    }

    function openBusinessModal(tab) {
      const data = lastData || {};
      const canWithdraw = Number(data.total || 0) > 0;
      const currency = data.salesCurrency || 'EUR';
      const courseRows = [];
      const eventRows = [];
      const liveRows = (data.recent || []).map((item) => ({ title: item.label || (item.source === 'gift' ? tr('Gift received', 'Получен подарок') : tr('LIVE earning', 'Доход LIVE')), meta: ctx.timeAgo(item.created_at), value: '+' + dc(item.amount) }));
      const pendingRows = data.pendingEnrollments || [];
      const sourcesTotal = [
        { title: tr('LIVE balance', 'LIVE баланс'), value: dc(data.total || 0) },
        { title: tr('Course sales', 'Продажи курсов'), value: '—' },
        { title: tr('Event sales', 'Продажи событий'), value: '—' },
        { title: tr('Gifts', 'Подарки'), value: dc(data.giftsTotal || 0) },
        { title: tr('Paid LIVE', 'Платный LIVE'), value: dc(data.paidMinutesTotal || 0) }
      ];
      const overlay = document.createElement('div');
      overlay.className = 'bd-modal-overlay';
      overlay.innerHTML = '<div class="bd-modal">' +
        '<button class="bd-modal-close" type="button" aria-label="Close">×</button>' +
        '<div class="bd-modal-head"><span>' + esc(tr('Business', 'Бизнес')) + '</span><h2>' + esc(tab === 'withdraw' ? tr('Withdraw balance', 'Вывести баланс') : tab === 'pending' ? tr('Pending enrollments', 'Заявки на курсы') : tr('Business details', 'Детали бизнеса')) + '</h2><p>' + esc(tr('LIVE, course, event and gift income in one place.', 'LIVE, курсы, события и подарки в одном месте.')) + '</p></div>' +
        '<div class="bd-modal-tabs"><button class="' + (tab === 'details' ? 'active' : '') + '" data-bd-tab="details">' + esc(tr('Details', 'Детали')) + '</button><button class="' + (tab === 'pending' ? 'active' : '') + '" data-bd-tab="pending">' + esc(tr('Pending', 'Заявки')) + '</button><button class="' + (tab === 'withdraw' ? 'active' : '') + '" data-bd-tab="withdraw">' + esc(tr('Withdraw', 'Вывод')) + '</button></div>' +
        '<div class="bd-modal-body" data-bd-body></div>' +
      '</div>';
      document.body.appendChild(overlay);
      const body = overlay.querySelector('[data-bd-body]');
      function paint(nextTab) {
        overlay.querySelectorAll('[data-bd-tab]').forEach((b) => b.classList.toggle('active', b.dataset.bdTab === nextTab));
        if (nextTab === 'details') {
          body.innerHTML = '<div class="bd-source-grid">' + sourcesTotal.map((item) => '<div><span>' + esc(item.title) + '</span><b>' + esc(item.value) + '</b></div>').join('') + '</div>' +
            '<h3>' + esc(tr('Course sales', 'Продажи курсов')) + '</h3>' + modalRows(courseRows, tr('Payment ledger is not connected.', 'Платёжный реестр не подключён.')) +
            '<h3>' + esc(tr('Event sales', 'Продажи событий')) + '</h3>' + modalRows(eventRows, tr('Payment ledger is not connected.', 'Платёжный реестр не подключён.')) +
            '<h3>' + esc(tr('Recent LIVE income', 'Недавний LIVE доход')) + '</h3>' + modalRows(liveRows, tr('No LIVE income yet.', 'LIVE дохода пока нет.'));
        } else if (nextTab === 'pending') {
          body.innerHTML = pendingRows.length ? pendingRows.map((item) => '<div class="bd-modal-row"><div><b>' + esc(item.course_title || tr('Course', 'Курс')) + '</b><span>' + esc([item.full_name, item.email].filter(Boolean).join(' · ') || tr('Learner', 'Ученик')) + '</span></div><div class="bd-row-actions"><button type="button" data-enroll-approve="' + esc(item.id) + '">' + esc(tr('Approve', 'Подтвердить')) + '</button><button type="button" data-enroll-reject="' + esc(item.id) + '">' + esc(tr('Reject', 'Отклонить')) + '</button></div></div>').join('') : '<div class="bd-modal-empty">' + esc(tr('No pending enrollments.', 'Нет заявок на подтверждение.')) + '</div>';
          body.querySelectorAll('[data-enroll-approve]').forEach((btn) => btn.onclick = () => updateEnrollment(btn.dataset.enrollApprove, 'confirmed', overlay));
          body.querySelectorAll('[data-enroll-reject]').forEach((btn) => btn.onclick = () => updateEnrollment(btn.dataset.enrollReject, 'cancelled', overlay));
        } else {
          body.innerHTML = '<form class="bd-withdraw-form"><div class="bd-source-grid"><div><span>' + esc(tr('Available', 'Доступно')) + '</span><b>' + esc(dc(data.total || 0)) + '</b></div><div><span>' + esc(tr('Minimum', 'Минимум')) + '</span><b>100 DC</b></div></div>' +
            '<label>' + esc(tr('Amount', 'Сумма')) + '<input name="amount" type="number" min="100" max="' + Math.max(0, Number(data.total || 0)) + '" value="' + Math.max(0, Number(data.total || 0)) + '"' + (!canWithdraw ? ' disabled' : '') + '></label>' +
            '<label>' + esc(tr('Payout method', 'Способ вывода')) + '<select name="method"' + (!canWithdraw ? ' disabled' : '') + '><option value="bank">Bank transfer</option><option value="paypal">PayPal</option><option value="wise">Wise</option></select></label>' +
            '<label>' + esc(tr('Payout details', 'Реквизиты')) + '<textarea name="details" placeholder="IBAN, PayPal email, Wise email..."' + (!canWithdraw ? ' disabled' : '') + '></textarea></label>' +
            '<button class="bd-submit" type="submit"' + (!canWithdraw ? ' disabled' : '') + '>' + esc(canWithdraw ? tr('Request withdrawal', 'Создать заявку на вывод') : tr('No balance to withdraw', 'Нет баланса для вывода')) + '</button><p data-withdraw-note></p></form>';
          const form = body.querySelector('form');
          form.onsubmit = (event) => submitWithdraw(event, overlay);
        }
      }
      overlay.querySelector('.bd-modal-close').onclick = () => overlay.remove();
      overlay.onclick = (event) => { if (event.target === overlay) overlay.remove(); };
      overlay.querySelectorAll('[data-bd-tab]').forEach((button) => button.onclick = () => paint(button.dataset.bdTab));
      paint(tab);
    }

    async function updateEnrollment(id, status, overlay) {
      if (!id) return;
      const result = await supa.from('course_enrollments').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (result.error) return ctx.alert(result.error.message || tr('Could not update enrollment.', 'Не удалось обновить заявку.'));
      overlay.remove();
      lastUserId = null;
      render();
    }

    async function submitWithdraw(event, overlay) {
      event.preventDefault();
      const form = event.currentTarget;
      const note = form.querySelector('[data-withdraw-note]');
      const amount = Math.floor(Number(form.amount.value) || 0);
      if (amount < 100) {
        note.textContent = tr('Minimum withdrawal is 100 DC.', 'Минимальная сумма вывода 100 DC.');
        return;
      }
      const payload = {
        user_id: ctx.user.id,
        amount,
        currency: 'DC',
        method: form.method.value,
        payout_details: form.details.value.trim() || null,
        status: 'pending'
      };
      const result = await supa.from('business_withdrawal_requests').insert(payload);
      if (result.error) {
        note.textContent = result.error.message || tr('Could not create withdrawal request. Apply the SQL setup first.', 'Не удалось создать заявку. Сначала примените SQL setup.');
        return;
      }
      note.textContent = tr('Withdrawal request created.', 'Заявка на вывод создана.');
      setTimeout(() => overlay.remove(), 700);
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
        bindBusinessActions(host);
      }
      lastUserId = uid;

      inflight = fetchData(uid).then((data) => {
        lastData = data;
        host.innerHTML = shell(name, profile, liveUrl, data);
        bindBusinessActions(host);
      }).catch(() => {
        lastData = {};
        host.innerHTML = shell(name, profile, liveUrl, {});
        bindBusinessActions(host);
      });
      return inflight;
    }

    function shell(name, profile, liveUrl, data) {
      const ready = Boolean(data);
      const v = (value) => ready ? value : '—';
      const rating = data && typeof data.rating === 'number' ? data.rating.toFixed(1) : null;
      const notifications = (ctx.state && ctx.state.notifications) || [];
      const unread = notifications.filter((item) => !item.read);
      const now = Date.now();
      const courses = (data && data.courseRows) || [];
      const sessions = ((data && data.sessions) || []).filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return !['canceled', 'cancelled', 'ended', 'completed'].includes(status) && Date.parse(item.ends_at || item.starts_at) > now;
      }).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
      const published = courses.filter((course) => ['active', 'published'].includes(String(course.status || '').toLowerCase()));
      const shownCourses = (published.length ? published : courses).slice(0, 3);
      const localeDate = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
      const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date());
      const paths = {
        plus: '<path d="M12 5v14M5 12h14"/>', live: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
        book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M8 7h7"/>',
        coin: '<circle cx="8" cy="8" r="6"/><path d="M18.1 8.7A6 6 0 1 1 8.7 18.1"/>', star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1z"/>',
        calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>', message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
        gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
        arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'
      };
      const icon = (key) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[key] + '</svg>';
      const fmtDate = (value) => value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : tr('Time not set', 'Время не указано');
      const cover = (course, index) => course.cover_image_url ? '<img src="' + esc(course.cover_image_url) + '" alt="">' : '<span class="td4-course-fallback tone-' + (index % 3) + '"><small>DUVELA</small><b>' + esc(course.level || 'COURSE') + '</b></span>';
      function kpi(iconName, label, value, note, tone) { return '<article class="td4-kpi ' + tone + '"><span class="td4-kpi-icon">' + icon(iconName) + '</span><div><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong><em>' + esc(note) + '</em></div></article>'; }
      function emptyState(title, copy, href, action) { return '<div class="td4-empty"><span>' + icon('calendar') + '</span><div><b>' + esc(title) + '</b><p>' + esc(copy) + '</p></div>' + (href ? '<a href="' + href + '" data-go="' + href.slice(1) + '">' + esc(action) + ' →</a>' : '') + '</div>'; }

      let html = '<div class="td4-page">';
      html += '<header class="td4-welcome"><div class="td4-identity"><span class="td4-avatar">' + ctx.avatarInner(name, profile.avatar_url) + '</span><div><span class="td4-eyebrow">DUVELA / TEACHER WORKSPACE</span><h1>' + esc(tr('Welcome back', 'С возвращением')) + ', ' + esc(name.split(/\s+/)[0]) + '</h1><p><span class="td4-online"></span>' + esc(tr('Teacher · Online', 'Преподаватель · В сети')) + '<i></i>' + esc(localeDate) + '</p></div></div><div class="td4-head-actions"><a class="td4-btn td4-btn-light" href="#schedule" data-go="schedule">' + icon('calendar') + esc(tr('Create Lesson', 'Создать урок')) + '</a><a class="td4-btn td4-btn-green" href="#live" data-go="live">' + icon('live') + esc(tr('Go LIVE', 'Выйти в LIVE')) + '</a></div></header>';
      html += '<section class="td4-kpis" aria-label="' + esc(tr('Teaching overview', 'Обзор преподавания')) + '">' + kpi('users', tr('Active Students', 'Активные ученики'), v(num(data && data.activeStudentsCount)), tr('Confirmed course enrollments', 'Подтверждённые записи на курсы'), 'green') + kpi('book', tr('Published Courses', 'Опубликованные курсы'), v(num(data && data.publishedCoursesCount)), tr('Visible active courses', 'Активные опубликованные курсы'), 'violet') + kpi('coin', tr('Monthly Revenue', 'Доход за месяц'), ready ? dc(data.monthTotal) : '—', tr('Verified LIVE ledger · ', 'Подтверждённый LIVE · ') + monthLabel, 'navy') + kpi('star', tr('Average Rating', 'Средний рейтинг'), rating || '—', rating ? tr('Verified teacher reviews', 'Подтверждённые отзывы') : tr('No reviews yet', 'Отзывов пока нет'), 'amber') + '</section>';

      const lessons = !ready ? '<div class="td4-loading"><i></i><i></i><i></i></div>' : sessions.length ? sessions.slice(0, 3).map((session) => '<article class="td4-lesson"><time><b>' + esc(new Date(session.starts_at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })) + '</b><span>' + esc(new Date(session.starts_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })) + '</span></time><div class="td4-lesson-main"><strong>' + esc(session.title || session.course_title || tr('Classroom lesson', 'Урок в классе')) + '</strong><p>' + esc(session.course_title || session.class_name || tr('Independent lesson', 'Самостоятельный урок')) + '</p><span>' + esc((session.duration_min || 60) + ' ' + tr('min', 'мин')) + ' · ' + esc(num(session.participants)) + ' ' + esc(tr('participants', 'участников')) + '</span></div><a href="./classroom.html?s=' + encodeURIComponent(session.id) + '">' + esc(tr('Join classroom', 'Войти в класс')) + ' ' + icon('arrow') + '</a></article>').join('') : emptyState(tr('No lessons scheduled today', 'На сегодня уроков нет'), tr('Schedule a lesson and invite students from your course.', 'Запланируйте урок и пригласите учеников курса.'), '#schedule', tr('Schedule lesson', 'Запланировать'));
      html += '<div class="td4-two"><section class="td4-card td4-teaching"><header><div><span class="td4-eyebrow">' + esc(tr("TODAY'S TEACHING", 'СЕГОДНЯШНИЕ УРОКИ')) + '</span><h2>' + esc(tr('Your teaching schedule', 'Ваше расписание')) + '</h2></div><a href="#schedule" data-go="schedule">' + esc(tr('Full schedule', 'Всё расписание')) + ' →</a></header><div class="td4-lesson-list">' + lessons + '</div></section>';
      html += '<section class="td4-card td4-quick"><header><div><span class="td4-eyebrow">' + esc(tr('QUICK ACTIONS', 'БЫСТРЫЕ ДЕЙСТВИЯ')) + '</span><h2>' + esc(tr('Keep your day moving', 'Управляйте рабочим днём')) + '</h2></div></header><div class="td4-quick-grid"><button type="button" data-dashboard-create-course><span>' + icon('plus') + '</span><b>' + esc(tr('Create Course', 'Создать курс')) + '</b><small>' + esc(tr('Build and publish', 'Создать и опубликовать')) + '</small></button><a href="#schedule" data-go="schedule"><span>' + icon('calendar') + '</span><b>' + esc(tr('Schedule Lesson', 'Запланировать урок')) + '</b><small>' + esc(tr('Add to your calendar', 'Добавить в календарь')) + '</small></a><a href="#live" data-go="live"><span>' + icon('live') + '</span><b>' + esc(tr('Start Public LIVE', 'Начать публичный LIVE')) + '</b><small>' + esc(tr('Open LIVE Studio', 'Открыть LIVE Studio')) + '</small></a><a href="#courses" data-go="courses"><span>' + icon('users') + '</span><b>' + esc(tr('Manage Students', 'Управлять учениками')) + '</b><small>' + esc(tr('Open course workspaces', 'Открыть кабинеты курсов')) + '</small></a></div></section></div>';

      const courseHtml = !ready ? '<div class="td4-loading"><i></i><i></i><i></i></div>' : shownCourses.length ? shownCourses.map((course, index) => '<article class="td4-course"><div class="td4-course-cover">' + cover(course, index) + '</div><div><span class="td4-status ' + (['active','published'].includes(String(course.status).toLowerCase()) ? 'active' : '') + '">' + esc(['active','published'].includes(String(course.status).toLowerCase()) ? tr('Published', 'Опубликован') : tr('Draft', 'Черновик')) + '</span><h3>' + esc(course.title || tr('Untitled course', 'Курс без названия')) + '</h3><p>' + esc([course.language, course.level].filter(Boolean).join(' · ') || tr('Language and level not set', 'Язык и уровень не указаны')) + '</p><small>' + esc(num(course.studentCount)) + ' ' + esc(tr('students', 'учеников')) + '</small></div><a href="#courses" data-go="courses" aria-label="' + esc(tr('Manage course', 'Управлять курсом')) + '">' + icon('arrow') + '</a></article>').join('') : emptyState(tr('No courses yet', 'Курсов пока нет'), tr('Create your first course to organize lessons and students.', 'Создайте первый курс, чтобы организовать уроки и учеников.'), '#courses', tr('Open Courses', 'Открыть курсы'));
      const topGift = data && data.topGifts && data.topGifts[0];
      html += '<div class="td4-two td4-mid"><section class="td4-card td4-courses"><header><div><span class="td4-eyebrow">' + esc(tr('COURSES OVERVIEW', 'ОБЗОР КУРСОВ')) + '</span><h2>' + esc(tr('Active teaching programs', 'Активные учебные программы')) + '</h2></div><a href="#courses" data-go="courses">' + esc(tr('All courses', 'Все курсы')) + ' →</a></header><div class="td4-course-list">' + courseHtml + '</div></section><section class="td4-wallet"><span class="td4-eyebrow">' + esc(tr('GIFTS & COINS', 'ПОДАРКИ И МОНЕТЫ')) + '</span><div class="td4-wallet-title"><span>' + icon('gift') + '</span><div><small>' + esc(tr('Available DUVELA balance', 'Доступный баланс DUVELA')) + '</small><strong>' + (ready ? dc(data.total) : '—') + '</strong></div></div><div class="td4-wallet-grid"><div><span>' + esc(tr('LIVE income', 'Доход LIVE')) + '</span><b>' + (ready ? dc(data.paidMinutesTotal) : '—') + '</b></div><div><span>' + esc(tr('Gift balance', 'Подарки')) + '</span><b>' + (ready ? dc(data.giftsTotal) : '—') + '</b></div></div><div class="td4-currency-row"><div><span>EUR</span><b>' + (ready ? money(data.salesByCurrency?.EUR || 0, 'EUR') : '—') + '</b></div><div><span>USD</span><b>' + (ready ? money(data.salesByCurrency?.USD || 0, 'USD') : '—') + '</b></div></div><p>' + esc(topGift ? tr('Most received: ', 'Чаще всего: ') + topGift.name + ' ×' + topGift.count : tr('Gifts from LIVE sessions will appear here.', 'Подарки из LIVE-сессий появятся здесь.')) + '</p><div class="td4-wallet-actions"><button type="button" data-business-details>' + esc(tr('View ledger', 'Открыть историю')) + '</button><button type="button" class="primary" data-business-withdraw' + (ready && data.total > 0 ? '' : ' disabled') + '>' + esc(tr('Withdraw', 'Вывести')) + '</button></div><small class="td4-wallet-note">' + esc(tr('DC, EUR and USD are shown separately. No currency conversion is applied.', 'DC, EUR и USD показываются отдельно. Конвертация валют не выполняется.')) + '</small></section></div>';

      const periodStart = now - revenuePeriod * 86400000;
      const earnings = ((data && data.earnings) || []).filter((item) => Date.parse(item.created_at) >= periodStart);
      const directGifts = ((data && data.gifts) || []).filter((item) => Date.parse(item.created_at) >= periodStart);
      const nonGift = earnings.filter((item) => item.source !== 'gift').reduce((sum, item) => sum + item.amount, 0);
      const earningsGifts = earnings.filter((item) => item.source === 'gift').reduce((sum, item) => sum + item.amount, 0);
      const giftTotal = Math.max(earningsGifts, directGifts.reduce((sum, item) => sum + item.cost, 0));
      const ledger = earnings.filter((item) => item.source !== 'gift').map((item) => ({ at: item.created_at, amount: item.amount })).concat((directGifts.length ? directGifts.map((item) => ({ at: item.created_at, amount: item.cost })) : earnings.filter((item) => item.source === 'gift').map((item) => ({ at: item.created_at, amount: item.amount }))));
      const bucketSize = revenuePeriod * 86400000 / 7;
      const bucketValues = Array.from({ length: 7 }, (_, index) => ledger.filter((item) => { const age = now - Date.parse(item.at); return age >= bucketSize * (6 - index) && age < bucketSize * (7 - index); }).reduce((sum, item) => sum + item.amount, 0));
      const maxBucket = Math.max.apply(null, bucketValues.concat([1]));
      const bars = bucketValues.map((value, index) => '<span><i style="height:' + (value ? Math.max(12, Math.round(value / maxBucket * 100)) : 4) + '%"></i><b>' + esc(index === 6 ? tr('Now', 'Сейчас') : '-' + Math.round((6 - index) * revenuePeriod / 7) + tr('d', 'д')) + '</b></span>').join('');
      html += '<section class="td4-card td4-revenue"><header><div><span class="td4-eyebrow">' + esc(tr('REVENUE ANALYTICS', 'АНАЛИТИКА ДОХОДА')) + '</span><h2>' + esc(tr('Verified LIVE revenue', 'Подтверждённый доход LIVE')) + '</h2><p>' + esc(tr('Values come from the LIVE earnings and gifts ledgers.', 'Значения получены из реестров LIVE-доходов и подарков.')) + '</p></div><div class="td4-periods">' + [7,30,90].map((days) => '<button type="button" data-dashboard-period="' + days + '" class="' + (revenuePeriod === days ? 'active' : '') + '">' + days + esc(tr('D', 'Д')) + '</button>').join('') + '</div></header><div class="td4-revenue-body"><div class="td4-chart"><div class="td4-chart-bars">' + bars + '</div></div><div class="td4-revenue-summary"><div><span>' + esc(tr('LIVE income', 'Доход LIVE')) + '</span><b>' + dc(nonGift) + '</b><small>' + esc(tr('Verified earnings ledger', 'Подтверждённый реестр')) + '</small></div><div><span>' + esc(tr('Gift income', 'Доход от подарков')) + '</span><b>' + dc(giftTotal) + '</b><small>' + esc(tr('Verified gift records', 'Подтверждённые подарки')) + '</small></div><div class="unavailable"><span>' + esc(tr('Course earnings', 'Доход от курсов')) + '</span><b>—</b><small>' + esc(tr('Payment ledger not connected', 'Платёжный реестр не подключён')) + '</small></div></div></div></section>';

      const activity = [];
      (data && data.pendingEnrollments || []).slice(0, 2).forEach((item) => activity.push({ icon: 'users', title: tr('New enrollment request', 'Новая заявка на курс'), copy: (item.full_name || item.email || tr('Student', 'Ученик')) + ' · ' + (item.course_title || ''), time: item.created_at, action: '<button type="button" data-business-pending>' + esc(tr('Review', 'Проверить')) + '</button>' }));
      unread.slice(0, 2).forEach((item) => activity.push({ icon: 'bell', title: item.title || tr('New notification', 'Новое уведомление'), copy: item.body || tr('Open notifications to view details.', 'Откройте уведомления для подробностей.'), time: item.created_at, action: '<button type="button" data-dashboard-notifications>' + esc(tr('Open', 'Открыть')) + '</button>' }));
      sessions.slice(0, 1).forEach((item) => activity.push({ icon: 'calendar', title: tr('Lesson reminder', 'Напоминание об уроке'), copy: (item.title || item.course_title || tr('Classroom lesson', 'Урок в классе')) + ' · ' + fmtDate(item.starts_at), time: item.starts_at, action: '<a href="#schedule" data-go="schedule">' + esc(tr('Schedule', 'Расписание')) + '</a>' }));
      (data && data.recent || []).slice(0, 1).forEach((item) => activity.push({ icon: 'live', title: item.label || tr('LIVE session activity', 'Активность LIVE-сессии'), copy: '+' + dc(item.amount), time: item.created_at, action: '<a href="#live" data-go="live">' + esc(tr('Studio', 'Студия')) + '</a>' }));
      const activityHtml = !ready ? '<div class="td4-loading"><i></i><i></i><i></i></div>' : activity.length ? activity.slice(0, 5).map((item) => '<article class="td4-activity-row"><span>' + icon(item.icon) + '</span><div><b>' + esc(item.title) + '</b><p>' + esc(item.copy) + '</p><small>' + esc(item.time ? ctx.timeAgo(item.time) : '') + '</small></div>' + item.action + '</article>').join('') : emptyState(tr('You are all caught up', 'Все задачи выполнены'), tr('Enrollment requests, reminders and LIVE activity will appear here.', 'Заявки, напоминания и LIVE-активность появятся здесь.'), '', '');
      html += '<section class="td4-card td4-activity"><header><div><span class="td4-eyebrow">' + esc(tr('ACTIVITY CENTER', 'ЦЕНТР АКТИВНОСТИ')) + '</span><h2>' + esc(tr('What needs your attention', 'Что требует внимания')) + '</h2></div><button type="button" data-dashboard-notifications>' + icon('bell') + esc(tr('Notifications', 'Уведомления')) + (unread.length ? '<i>' + unread.length + '</i>' : '') + '</button></header><div>' + activityHtml + '</div></section>';
      html += '<footer class="td4-footer"><span>DUVELA TEACHER WORKSPACE 4.0</span><small>' + esc(tr('Teach · Create · Grow', 'Обучайте · Создавайте · Развивайтесь')) + '</small></footer></div>';
      return html;
    }
    function section(title, icon, body) {
      return '<div class="bd-section">' +
        '<div class="bd-section-head">' + (icon ? '<span class="bd-section-ic">' + icon + '</span>' : '') +
        '<h3>' + esc(title) + '</h3></div>' + body + '</div>';
    }

    async function renderEarnings() {
      const host = document.getElementById('earningsView');
      if (!host) return;
      if (!ctx.isBusiness()) { host.replaceChildren(); return; }
      const data = lastData;
      if (!data) { host.innerHTML = '<div class="be4-loading">Loading verified financial data…</div>'; render(); setTimeout(renderEarnings, 250); return; }
      const eur = Number(data.salesByCurrency?.EUR || 0), usd = Number(data.salesByCurrency?.USD || 0);
      const courseRevenue = (data.courseSales || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const eventRevenue = (data.eventSales || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const rows = [...(data.courseSales || []).map((item) => ({ label: item.title, amount: item.amount, currency: item.currency || 'EUR', date: item.created_at })), ...(data.eventSales || []).map((item) => ({ label: item.title, amount: item.amount, currency: item.currency || 'EUR', date: item.created_at }))].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      const payoutRes = await safe(supa.from('business_withdrawal_requests').select('amount,currency,method,status,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(50), { data: [] });
      const payouts = payoutRes.data || [];
      host.innerHTML = '<div class="be4-page"><header class="be4-header"><div><span class="be4-eyebrow">DUVELA BUSINESS</span><h1>Earnings &amp; Finance</h1><p>Manage your teaching income, gifts and payouts.</p></div><span class="be4-header-icon">▣</span></header><div class="be4-kpis"><article><span>Course Revenue</span><strong>' + (courseRevenue ? money(courseRevenue, data.salesCurrency || 'EUR') : '—') + '</strong></article><article><span>Event Revenue</span><strong>' + (eventRevenue ? money(eventRevenue, 'EUR') : '—') + '</strong></article><article><span>LIVE Balance</span><strong>' + dc(data.total || 0) + '</strong></article><article><span>Gift Balance</span><strong>' + dc(data.giftsTotal || 0) + '</strong></article><article><span>EUR sales</span><strong>' + money(eur, 'EUR') + '</strong></article><article><span>USD sales</span><strong>' + money(usd, 'USD') + '</strong></article></div><section class="be4-status"><b>ⓘ Payment integration status</b><p>' + (courseRevenue || eventRevenue ? 'Verified course and event sales are available.' : 'The payment ledger is not connected. Course and event sales data cannot currently be displayed.') + '</p><span>' + (courseRevenue || eventRevenue ? 'Connected' : 'Integration required') + '</span></section><section class="be4-ledger"><nav><button class="active" type="button" data-be4-tab="transactions">Transactions</button><button type="button" data-be4-tab="payouts">Payouts</button><button type="button" data-be4-tab="coins">Coins &amp; Gifts</button><button type="button" data-be4-export="1">Export CSV</button></nav>' + (rows.length ? rows.map((row) => '<div class="be4-row"><div><b>' + esc(row.label || 'Sale') + '</b><small>' + esc(ctx.timeAgo(row.date)) + '</small></div><strong>' + esc(money(row.amount, row.currency)) + '</strong></div>').join('') : '<div class="be4-empty"><b>Transactions unavailable</b><p>This section will display verified records when its associated backend service is connected.</p></div>') + '</section></div>';
      host.querySelectorAll('[data-be4-tab]').forEach((button) => { button.onclick = () => { host.querySelectorAll('[data-be4-tab]').forEach((item) => item.classList.toggle('active', item === button)); const ledger = host.querySelector('.be4-ledger'); if (!ledger) return; if (button.dataset.be4Tab === 'payouts') ledger.insertAdjacentHTML('beforeend', payouts.length ? payouts.map((item) => '<div class="be4-row"><div><b>' + esc(item.method || 'Payout') + '</b><small>' + esc(item.status || 'pending') + ' · ' + esc(ctx.timeAgo(item.created_at)) + '</small></div><strong>' + esc(money(item.amount, item.currency || 'DC')) + '</strong></div>').join('') : '<div class="be4-empty"><b>No payouts yet</b><p>Verified payout requests will appear here.</p></div>'); else if (button.dataset.be4Tab === 'coins') ledger.insertAdjacentHTML('beforeend', '<div class="be4-empty"><b>Coins &amp; Gifts</b><p>Duvela Coins and gift records remain separate from EUR and USD revenue.</p></div>'); }; });
      const exportButton = host.querySelector('[data-be4-export]'); if (exportButton) exportButton.onclick = () => { const csv = ['Type,Label,Amount,Currency,Date'].concat(rows.map((item) => ['Transaction', item.label, item.amount, item.currency, item.date].map((value) => '"' + String(value || '').replaceAll('"', '""') + '"').join(','))).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'duvela-earnings.csv'; link.click(); URL.revokeObjectURL(link.href); };
    }
    return { render, renderEarnings };
  }

  window.DuvelaBusinessDashboard = { create: createBusinessDashboard };
})();
