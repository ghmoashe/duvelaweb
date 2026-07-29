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

      const [eventsRes, reviewsRes, postsRes, followersRes, earningsRes, giftsRes, coursesRes] = await Promise.all([
        safe(supa.from('events').select('id,title,created_at,is_paid,price_amount,organizer_id', { count: 'exact' }).eq('organizer_id', uid), { data: [], count: 0 }),
        safe(supa.from('teacher_reviews').select('rating,created_at').eq('teacher_id', uid), { data: [] }),
        safe(supa.from('posts').select('id,created_at').eq('user_id', uid), { data: [] }),
        safe(supa.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', uid), { count: 0 }),
        safe(supa.from('live_teacher_earnings').select('amount,source,label,session_id,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(200), { data: [] }),
        safe(supa.from('live_gifts').select('gift_name,cost,sender_name,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(200), { data: [] }),
        safe(supa.from('courses').select('id,title,price,currency,status,created_at').eq('created_by', uid).neq('status', 'archived').limit(500), { data: [] })
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
        paidCourses.length
          ? safe(supa.from('course_enrollments').select('id,course_id,status,full_name,email,created_at').in('course_id', paidCourses.map((course) => course.id)).in('status', ['confirmed', 'pending']), { data: [] })
          : { data: [] },
        paidEvents.length
          ? safe(supa.from('event_rsvps').select('event_id,user_id,status').in('event_id', paidEvents.map((event) => event.id)).eq('status', 'going'), { data: [] })
          : { data: [] }
      ]);
      const courseById = new Map(paidCourses.map((course) => [course.id, course]));
      const eventById = new Map(paidEvents.map((event) => [event.id, event]));
      let coursePendingCount = 0;
      let courseSalesCount = 0;
      let courseSalesTotal = 0;
      const pendingEnrollments = [];
      const courseSales = [];
      ((enrollmentsRes && enrollmentsRes.data) || []).forEach((enrollment) => {
        const course = courseById.get(enrollment.course_id);
        if (!course) return;
        if (enrollment.status === 'pending') {
          coursePendingCount += 1;
          pendingEnrollments.push({ id: enrollment.id, course_id: enrollment.course_id, course_title: course.title, full_name: enrollment.full_name, email: enrollment.email, created_at: enrollment.created_at });
        } else if (enrollment.status === 'confirmed') {
          courseSalesCount += 1;
          courseSalesTotal += Number(course.price || 0);
          courseSales.push({ id: enrollment.id, title: course.title, amount: Number(course.price || 0), currency: course.currency || 'EUR', created_at: enrollment.created_at });
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
        eventSales.push({ event_id: rsvp.event_id, title: event.title || 'Event', amount: Number(event.price_amount || 0), currency: 'EUR' });
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
        coursesCount: Math.max(courseRows.length, (ctx.state.courses || []).length),
        assignmentsCount: 0,
        giftsTotal,
        total,
        monthTotal,
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
    }

    function modalRows(rows, emptyText) {
      if (!rows || !rows.length) return '<div class="bd-modal-empty">' + esc(emptyText) + '</div>';
      return rows.map((row) => '<div class="bd-modal-row"><div><b>' + esc(row.title || row.course_title || row.label || 'Item') + '</b><span>' + esc(row.meta || row.full_name || row.email || row.created_at || '') + '</span></div><strong>' + esc(row.value || '') + '</strong></div>').join('');
    }

    function openBusinessModal(tab) {
      const data = lastData || {};
      const canWithdraw = Number(data.total || 0) > 0;
      const currency = data.salesCurrency || 'EUR';
      const courseRows = (data.courseSales || []).map((item) => ({ title: item.title, meta: item.created_at ? ctx.timeAgo(item.created_at) : '', value: money(item.amount, item.currency || currency) }));
      const eventRows = (data.eventSales || []).map((item) => ({ title: item.title, meta: tr('Event sale', 'Продажа события'), value: money(item.amount, item.currency || currency) }));
      const liveRows = (data.recent || []).map((item) => ({ title: item.label || (item.source === 'gift' ? tr('Gift received', 'Получен подарок') : tr('LIVE earning', 'Доход LIVE')), meta: ctx.timeAgo(item.created_at), value: '+' + dc(item.amount) }));
      const pendingRows = data.pendingEnrollments || [];
      const sourcesTotal = [
        { title: tr('LIVE balance', 'LIVE баланс'), value: dc(data.total || 0) },
        { title: tr('Course sales', 'Продажи курсов'), value: money(data.courseSalesTotal || 0, currency) },
        { title: tr('Event sales', 'Продажи событий'), value: money(data.eventSalesTotal || 0, currency) },
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
            '<h3>' + esc(tr('Course sales', 'Продажи курсов')) + '</h3>' + modalRows(courseRows, tr('No course sales yet.', 'Продаж курсов пока нет.')) +
            '<h3>' + esc(tr('Event sales', 'Продажи событий')) + '</h3>' + modalRows(eventRows, tr('No event sales yet.', 'Продаж событий пока нет.')) +
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
      const rating = data && typeof data.rating === 'number' ? data.rating.toFixed(1) : null;
      const v = (value) => ready ? value : '—';
      const canWithdraw = Boolean(data && data.total > 0);
      const salesCurrency = (data && data.salesCurrency) || 'EUR';

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

      // Two-column body on wide screens: actions/business on the left, insights on the right.
      html += '<div class="bd-grid"><div class="bd-col">';

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

      // My Business (LIVE earnings) — the card carries its own title, so no section heading.
      html += '<div class="bd-section">' +
        '<div class="bd-business">' +
          '<div class="bd-business-top">' +
            '<span class="bd-business-title">' + esc(tr('My Business', 'Мой бизнес')) + '</span>' +
            '<span class="bd-business-badge">' + esc(tr('Teacher Live', 'Учитель Live')) + '</span>' +
          '</div>' +
          '<div class="bd-business-figures">' +
            '<div><b>' + v(dc(data && data.total)) + '</b><span>' + esc(tr('LIVE balance', 'LIVE баланс')) + '</span></div>' +
            '<div><b>' + v(money(data && data.courseEventSalesTotal, salesCurrency)) + '</b><span>' + esc(tr('Course/Event sales', 'Продажи курсов/событий')) + '</span></div>' +
          '</div>' +
          '<div class="bd-business-pills">' +
            pill(tr('Course sales', 'Продажи курсов'), v(money(data && data.courseSalesTotal, salesCurrency))) +
            pill(tr('Event sales', 'Продажи событий'), v(money(data && data.eventSalesTotal, salesCurrency))) +
            pill(tr('Paid LIVE', 'Платный LIVE'), v(dc(data && data.paidMinutesTotal))) +
            pill(tr('Gifts', 'Подарки'), v(dc(data && data.giftsTotal))) +
            pill(tr('LIVE this month', 'LIVE за месяц'), v(dc(data && data.monthTotal))) +
          '</div>' +
          '<button class="bd-business-status" type="button"' + (data && data.coursePendingCount > 0 ? ' data-business-pending' : ' data-business-details') + '>' +
            '<span>' + (data && data.coursePendingCount > 0 ? '⏱' : canWithdraw ? '✓' : 'ⓘ') + '</span>' +
            '<b>' + esc(data && data.coursePendingCount > 0 ? (num(data.coursePendingCount) + ' ' + tr('pending enrollments', 'заявок ждут подтверждения')) : canWithdraw ? tr('Balance is ready to withdraw', 'Баланс доступен для вывода') : tr('No balance to withdraw yet', 'Пока нет средств для вывода')) + '</b>' +
          '</button>' +
          '<div class="bd-business-actions">' +
            '<button class="bd-btn-outline" type="button" data-business-details>' + esc(tr('Details', 'Подробнее')) + '</button>' +
            '<button class="bd-btn-solid' + (!canWithdraw ? ' disabled' : '') + '" type="button" data-business-withdraw>' + esc(tr('Withdraw', 'Вывести')) + '</button>' +
          '</div>' +
        '</div>' +
        '</div>';

      // Manage events
      html += section(tr('Manage events', 'Управление событиями'), null,
        '<div class="bd-manage">' +
          manageRow('events', 'var(--purple-soft)', ic.cal, tr('Events', 'События'), tr('Plan and publish events', 'Планируйте и публикуйте события')) +
          manageRow('courses', 'var(--teal-soft)', ic.book, tr('Courses', 'Курсы'), tr('Manage Courses', 'Управление курсами')) +
          manageRow('live', 'var(--red-soft)', ic.live, tr('Schedule Live', 'Запланировать эфир'), tr('Sessions with students', 'Сессии с учениками')) +
          manageRow('workspace', 'var(--purple-soft)', ic.trophy, tr('Challenges', 'Челленджи'), tr('Motivate students', 'Мотивируйте учеников')) +
        '</div>');

      // Right column: insights (gifts + recent sessions + analytics).
      html += '</div><div class="bd-col">';

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
            '<button class="bd-btn-outline dark" type="button" data-business-details>' + esc(tr('Details', 'Подробнее')) + '</button>' +
            '<button class="bd-btn-solid dark" type="button" data-business-withdraw>' + esc(tr('Withdraw', 'Вывести')) + '</button>' +
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
      html += section(tr('Recent LIVE Sessions', 'Недавние LIVE сессии'), null,
        '<div class="bd-card">' + recentBody + '</div>');

      // Analytics
      const barMax = data && data.activity ? Math.max.apply(null, data.activity.concat([1])) : 1;
      const bars = (data && data.activity ? data.activity : [0, 0, 0, 0, 0, 0, 0]).map((value) => {
        const height = value === 0 ? 4 : Math.max(14, Math.round((value / barMax) * 100));
        return '<span class="bd-bar' + (value === 0 ? ' empty' : '') + '" style="height:' + height + '%"></span>';
      }).join('');
      const activityTotal = (data && data.activity ? data.activity : []).reduce((sum, value) => sum + value, 0);

      html += section(tr('Analytics', 'Аналитика'), null,
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

      html += '</div></div>'; // close right column + grid

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
