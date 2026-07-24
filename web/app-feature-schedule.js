(function () {
  function createScheduleFeature(ctx) {
    const { $, tr, esc, alert, supa, state, avatarInner, formatDate } = ctx;

    function fmtSlot(slot) {
      return formatDate(slot.slot_date) + ' · ' + String(slot.slot_time || '').slice(0, 5);
    }

    async function loadSchedule() {
      const today = new Date().toISOString().slice(0, 10);
      if (ctx.isBusiness()) {
        try {
          const { data } = await supa.from('teacher_slots')
            .select('id,slot_date,slot_time,duration_min,is_booked,booked_by_user_id,status,price,currency,timezone,live_room_url,approval_required,booking_status,series_id')
            .eq('teacher_id', ctx.user.id).gte('slot_date', today)
            .order('slot_date', { ascending: true }).order('slot_time', { ascending: true }).limit(60);
          state.mySlots = data || [];
        } catch (error) {
          console.warn('slots load failed', error);
        }
        return;
      }
      try {
        const { data: slots } = await supa.from('teacher_slots')
          .select('id,teacher_id,slot_date,slot_time,duration_min,price,currency,timezone,live_room_url,approval_required,status')
          .eq('is_booked', false).gte('slot_date', today)
          .order('slot_date', { ascending: true }).order('slot_time', { ascending: true });
        const counts = {};
        (slots || []).forEach((slot) => { counts[slot.teacher_id] = (counts[slot.teacher_id] || 0) + 1; });
        const ids = Object.keys(counts);
        let teachers = [];
        if (ids.length) {
          const { data: profiles } = await supa.from('profiles').select('id,full_name,avatar_url,city,country').in('id', ids);
          teachers = (profiles || []).map((profile) => {
            const teacherSlots = (slots || []).filter((slot) => String(slot.teacher_id) === String(profile.id));
            return { ...profile, slots: counts[profile.id] || 0, next_slots: teacherSlots.slice(0, 4), first_slot: teacherSlots[0] || null };
          }).sort((a, b) => b.slots - a.slots);
        }
        state.scheduleTeachers = teachers;
        const { data: mine } = await supa.from('teacher_slots')
          .select('id,teacher_id,slot_date,slot_time,duration_min,price,currency,timezone,live_room_url,approval_required,status,booking_status')
          .eq('booked_by_user_id', ctx.user.id).gte('slot_date', today).order('slot_date', { ascending: true });
        const teacherIds = Array.from(new Set((mine || []).map((slot) => slot.teacher_id)));
        const { data: teacherProfiles } = teacherIds.length ? await supa.from('profiles').select('id,full_name,avatar_url,city,country').in('id', teacherIds) : { data: [] };
        const teacherMap = new Map((teacherProfiles || []).map((profile) => [profile.id, profile]));
        state.myBookings = (mine || []).map((slot) => ({ ...slot, teacher_profile: teacherMap.get(slot.teacher_id) || null, teacher_name: (teacherMap.get(slot.teacher_id) || {}).full_name || tr('Teacher', '\u041f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044c') }));
      } catch (error) {
        console.warn('schedule load failed', error);
      }
    }

    function renderSchedule() {
      const main = $('#scheduleMain');
      const side = $('#scheduleSide');
      if (!main || !side) return;
      // Mobile-style cards (reuses the shared mg-*/pv-* design system).
      const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>';
      const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
      const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
      const VIDEO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>';
      const moneyText = (item) => Number(item.price) ? Number(item.price).toFixed(2) + ' ' + (item.currency || 'EUR') : tr('Free', '\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e');
      const slotDateTime = (slot) => esc(formatDate(slot.slot_date)) + '<b>' + esc(String(slot.slot_time || '').slice(0, 5)) + '</b>';
      const lessonFormat = (slot) => slot && slot.live_room_url ? tr('Online LIVE', '\u041e\u043d\u043b\u0430\u0439\u043d LIVE') : tr('Online lesson', '\u041e\u043d\u043b\u0430\u0439\u043d-\u0443\u0440\u043e\u043a');
      if (ctx.isBusiness()) {
        $('#scheduleTitle').textContent = tr('Your lesson slots', 'Ваши слоты уроков');
        $('#scheduleSub').textContent = tr('Open times for learners to book', 'Открытые слоты для записи учеников');
        const free = state.mySlots.filter((slot) => !slot.is_booked).length;
        const booked = state.mySlots.length - free;
        main.innerHTML =
          '<div class="mg-summary" style="margin-bottom:14px">' +
            '<span class="mg-summary-ic">' + CAL + '</span>' +
            '<div class="mg-summary-copy"><b>' + esc(state.mySlots.length + ' ' + tr('slots', 'слотов')) + '</b>' +
            '<span>' + esc(free + ' ' + tr('free', 'свободно') + ' | ' + booked + ' ' + tr('booked', 'занято')) + '</span></div>' +
          '</div>' +
          '<form id="slotForm"><div class="pv-field-grid">' +
            '<div class="pv-field"><label>' + esc(tr('Date', 'Дата')) + '</label><input id="slotDate" type="date" required></div>' +
            '<div class="pv-field"><label>' + esc(tr('Time', 'Время')) + '</label><input id="slotTime" type="time" required></div>' +
          '</div>' +
          '<div class="pv-field"><label>' + esc(tr('Duration (min)', 'Длительность (мин)')) + '</label><input id="slotDur" type="number" min="15" step="15" value="60"></div>' +
          '<button class="mg-btn-solid" type="submit" style="margin-top:12px;width:100%;justify-content:center">' + esc(tr('Open slot', 'Открыть слот')) + '</button></form>';
        const slotSubmit = $('#slotForm button[type="submit"]');
        slotSubmit.innerHTML = '<span id="slotSubmitLabel">' + esc(tr('Open slot', 'Открыть слот')) + '</span>';
        slotSubmit.insertAdjacentHTML('beforebegin',
          '<div class="pv-field-grid" style="margin-top:10px">' +
            '<div class="pv-field"><label>' + esc(tr('Number of slots', 'Количество слотов')) + '</label><input id="slotCount" type="number" min="1" max="30" step="1" value="1"></div>' +
            '<div class="pv-field"><label>' + esc(tr('Break between slots (min)', 'Перерыв между слотами (мин)')) + '</label><input id="slotBreak" type="number" min="0" max="240" step="5" value="0"></div>' +
          '</div>' +
          '<div class="pv-field-grid" style="margin-top:10px">' +
            '<div class="pv-field"><label>' + esc(tr('Repeat', 'Повторение')) + '</label><select id="slotRepeat"><option value="none">' + esc(tr('No repeat', 'Без повторения')) + '</option><option value="daily">' + esc(tr('Every day', 'Каждый день')) + '</option><option value="weekly">' + esc(tr('Selected weekdays', 'По выбранным дням')) + '</option></select></div>' +
            '<div class="pv-field"><label>' + esc(tr('Repeat until', 'Повторять до')) + '</label><input id="slotEndDate" type="date"></div>' +
          '</div>' +
          '<div id="slotWeekdays" style="display:none;flex-wrap:wrap;gap:8px;margin-top:9px">' + [1,2,3,4,5,6,0].map((day, index) => '<label class="slot-chip" style="padding:7px 10px"><input type="checkbox" value="' + day + '"' + (day >= 1 && day <= 5 ? ' checked' : '') + '> ' + esc([tr('Sun','Вс'),tr('Mon','Пн'),tr('Tue','Вт'),tr('Wed','Ср'),tr('Thu','Чт'),tr('Fri','Пт'),tr('Sat','Сб')][day]) + '</label>').join('') + '</div>' +
          '<div class="pv-field-grid" style="margin-top:10px">' +
            '<div class="pv-field"><label>' + esc(tr('Working hours from', 'Рабочее время с')) + '</label><input id="workingStart" type="time" value="09:00"></div>' +
            '<div class="pv-field"><label>' + esc(tr('Working hours until', 'Рабочее время до')) + '</label><input id="workingEnd" type="time" value="18:00"></div>' +
          '</div>' +
          '<div class="pv-field-grid" style="margin-top:10px">' +
            '<div class="pv-field"><label>' + esc(tr('Lesson price', 'Стоимость урока')) + '</label><input id="slotPrice" type="number" min="0" step="0.01" value="0"></div>' +
            '<div class="pv-field"><label>' + esc(tr('Currency', 'Валюта')) + '</label><select id="slotCurrency"><option>EUR</option><option>USD</option><option>RUB</option></select></div>' +
          '</div>' +
          '<div class="pv-field"><label>' + esc(tr('LIVE room link (optional)', 'Ссылка на LIVE-комнату')) + '</label><input id="slotLiveUrl" type="url" placeholder="https://..."></div>' +
          '<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-weight:700"><input id="slotApproval" type="checkbox"> ' + esc(tr('Require teacher approval', 'Требовать подтверждение преподавателя')) + '</label>' +
          '<p id="slotBatchHint" style="margin:9px 2px 0;color:var(--soft);font-size:12px;font-weight:650"></p>');
        $('#slotForm').addEventListener('submit', createSlot);
        ['slotDate', 'slotTime', 'slotDur', 'slotCount', 'slotBreak', 'slotRepeat', 'slotEndDate', 'workingStart', 'workingEnd'].forEach((id) => $('#' + id).addEventListener('input', updateSlotBatchPreview));
        $('#slotRepeat').addEventListener('change', () => { $('#slotWeekdays').style.display = $('#slotRepeat').value === 'weekly' ? 'flex' : 'none'; });
        updateSlotBatchPreview();
        side.innerHTML = '<div class="bd-section-head" style="margin-bottom:10px"><h3>' + esc(tr('Upcoming slots', 'Ближайшие слоты')) + '</h3></div>' +
          (state.mySlots.length ? '<div class="mg-list">' + state.mySlots.map((slot) =>
            '<div class="mg-row"><span class="mg-row-ic' + (slot.is_booked ? ' teal' : '') + '">' + CLOCK + '</span>' +
            '<span class="mg-row-copy"><b>' + esc(fmtSlot(slot)) + '</b><span>' + (slot.duration_min || 60) + ' ' + esc(tr('min', 'мин')) + '</span></span>' +
            '<span class="mg-row-tag"' + (slot.is_booked ? '' : ' style="color:var(--purple)"') + '>' + esc(slot.is_booked ? tr('Booked', 'Занят') : tr('Free', 'Свободен')) + '</span></div>'
          ).join('') + '</div>' : '<div class="mg-empty"><span class="mg-empty-ic">' + CAL + '</span><b>' + esc(tr('No slots yet', 'Слотов пока нет')) + '</b><p>' + esc(tr('Open a time above so learners can book you.', 'Откройте время слева — и ученики смогут записаться.')) + '</p></div>');
        side.insertAdjacentHTML('afterbegin', '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn" type="button" id="scheduleCalendarView">' + esc(tr('Calendar', 'Календарь')) + '</button><button class="btn" type="button" id="deleteFreeSlots">' + esc(tr('Delete free slots', 'Удалить свободные')) + '</button><button class="btn" type="button" id="scheduleSettings">⚙ ' + esc(tr('Rules', 'Правила')) + '</button><button class="btn" type="button" id="calendarConnections">' + esc(tr('Google & Outlook', 'Google и Outlook')) + '</button></div>');
        $('#scheduleCalendarView').addEventListener('click', renderCalendarView);
        $('#deleteFreeSlots').addEventListener('click', deleteAllFreeSlots);
        $('#scheduleSettings').addEventListener('click', editScheduleSettings);
        $('#calendarConnections').addEventListener('click', showCalendarConnections);
      } else {
        $('#scheduleTitle').textContent = tr('Book a lesson', '\u0417\u0430\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f \u043d\u0430 \u0443\u0440\u043e\u043a');
        $('#scheduleSub').textContent = tr('Choose a teacher, compare open times and manage your bookings.', '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f, \u0441\u0440\u0430\u0432\u043d\u0438\u0442\u0435 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f \u0438 \u0443\u043f\u0440\u0430\u0432\u043b\u044f\u0439\u0442\u0435 \u0437\u0430\u043f\u0438\u0441\u044f\u043c\u0438.');
        const totalSlots = state.scheduleTeachers.reduce((sum, teacher) => sum + Number(teacher.slots || 0), 0);
        const nextBooking = state.myBookings[0] || null;
        main.innerHTML = '<div class="schedule-learner-hero"><div><span>' + esc(tr('Lesson schedule', '\u0420\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0443\u0440\u043e\u043a\u043e\u0432')) + '</span><h2>' + esc(totalSlots ? tr('Find a time that fits you', '\u041d\u0430\u0439\u0434\u0438\u0442\u0435 \u0443\u0434\u043e\u0431\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f') : tr('Open slots will appear here', '\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0435 \u0441\u043b\u043e\u0442\u044b \u043f\u043e\u044f\u0432\u044f\u0442\u0441\u044f \u0437\u0434\u0435\u0441\u044c')) + '</h2><p>' + esc(tr('Teacher cards show the next available lesson, duration, price, format and location details.', '\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u044e\u0442 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0439 \u0443\u0440\u043e\u043a, \u0434\u043b\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c, \u0446\u0435\u043d\u0443, \u0444\u043e\u0440\u043c\u0430\u0442 \u0438 \u043b\u043e\u043a\u0430\u0446\u0438\u044e.')) + '</p></div><div class="schedule-hero-stats"><span><b>' + state.scheduleTeachers.length + '</b><small>' + esc(tr('teachers', '\u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u0435\u0439')) + '</small></span><span><b>' + totalSlots + '</b><small>' + esc(tr('open slots', '\u0441\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0445 \u0441\u043b\u043e\u0442\u043e\u0432')) + '</small></span><span><b>' + state.myBookings.length + '</b><small>' + esc(tr('bookings', '\u0437\u0430\u043f\u0438\u0441\u0435\u0439')) + '</small></span></div></div>' +
          '<div class="schedule-toolbar"><label>⌕<input id="scheduleTeacherSearch" placeholder="' + esc(tr('Search teacher or city...', '\u041f\u043e\u0438\u0441\u043a \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f \u0438\u043b\u0438 \u0433\u043e\u0440\u043e\u0434\u0430...')) + '"></label><button type="button" data-schedule-filter="all" class="active">' + esc(tr('All', '\u0412\u0441\u0435')) + '</button><button type="button" data-schedule-filter="free">' + esc(tr('Free', '\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u043e')) + '</button><button type="button" data-schedule-filter="live">LIVE</button></div>' +
          (state.scheduleTeachers.length ? '<div class="schedule-teacher-grid">' + state.scheduleTeachers.map((teacher) => {
            const first = teacher.first_slot || {};
            const location = [teacher.city, teacher.country].filter(Boolean).join(', ') || 'Duvela';
            const search = [teacher.full_name, teacher.city, teacher.country, lessonFormat(first), moneyText(first)].filter(Boolean).join(' ').toLowerCase();
            return '<article class="schedule-teacher-card" data-teacher-card data-teacher="' + esc(teacher.id) + '" data-schedule-search="' + esc(search) + '" data-schedule-price="' + (Number(first.price) ? 'paid' : 'free') + '" data-schedule-live="' + (first.live_room_url ? '1' : '0') + '">' +
              '<div class="schedule-teacher-top"><span class="sch-avatar">' + avatarInner(teacher.full_name, teacher.avatar_url) + '</span><div><h3>' + esc(teacher.full_name || tr('Teacher', '\u041f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044c')) + '</h3><p>' + PIN + esc(location) + '</p></div><strong>' + teacher.slots + ' ' + esc(tr('slots', '\u0441\u043b\u043e\u0442\u043e\u0432')) + '</strong></div>' +
              '<div class="schedule-next-slot"><small>' + esc(tr('Nearest lesson', '\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0439 \u0443\u0440\u043e\u043a')) + '</small><div>' + slotDateTime(first) + '</div></div>' +
              '<div class="schedule-facts"><span>' + CLOCK + esc((first.duration_min || 60) + ' ' + tr('min', '\u043c\u0438\u043d')) + '</span><span>' + VIDEO + esc(lessonFormat(first)) + '</span><span>' + esc(moneyText(first)) + '</span></div>' +
              '<div class="schedule-mini-slots">' + (teacher.next_slots || []).map((slot) => '<span>' + esc(String(slot.slot_time || '').slice(0, 5)) + '</span>').join('') + '</div>' +
              '<button class="btn primary" type="button">' + esc(tr('Choose time', '\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0432\u0440\u0435\u043c\u044f')) + '</button>' +
            '</article>';
          }).join('') + '</div>' : '<div class="mg-empty schedule-empty"><span class="mg-empty-ic">' + CAL + '</span><b>' + esc(tr('No open slots right now', '\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0445 \u0441\u043b\u043e\u0442\u043e\u0432 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442')) + '</b><p>' + esc(tr('Check back later. Teachers add new times often.', '\u0417\u0430\u0433\u043b\u044f\u043d\u0438\u0442\u0435 \u043f\u043e\u0437\u0436\u0435. \u041f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u0438 \u0447\u0430\u0441\u0442\u043e \u0434\u043e\u0431\u0430\u0432\u043b\u044f\u044e\u0442 \u043d\u043e\u0432\u043e\u0435 \u0432\u0440\u0435\u043c\u044f.')) + '</p></div>') + '<div class="practice-no-results schedule-no-results" hidden>' + esc(tr('No teachers match these filters.', '\u041f\u043e \u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u0435\u0439 \u043d\u0435\u0442.')) + '</div>';
        side.innerHTML = '<div class="schedule-bookings-head"><div><h3>' + esc(tr('My bookings', '\u041c\u043e\u0438 \u0437\u0430\u043f\u0438\u0441\u0438')) + '</h3><p>' + esc(nextBooking ? tr('Your next lesson is ready.', '\u0412\u0430\u0448 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439 \u0443\u0440\u043e\u043a \u0433\u043e\u0442\u043e\u0432.') : tr('Choose a teacher and a free time.', '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f \u0438 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f.')) + '</p></div>' + (nextBooking ? '<span>' + esc(formatDate(nextBooking.slot_date)) + '</span>' : '') + '</div>' +
          (state.myBookings.length ? '<div class="schedule-booking-list">' + state.myBookings.map((booking) => {
            const profile = booking.teacher_profile || {};
            return '<article class="schedule-booking-card"><div class="schedule-booking-main"><span class="sch-avatar">' + avatarInner(booking.teacher_name, profile.avatar_url) + '</span><div><h3>' + esc(booking.teacher_name) + '</h3><p>' + esc([profile.city, profile.country].filter(Boolean).join(', ') || lessonFormat(booking)) + '</p></div><span class="practice-status-pill teal">' + esc(booking.approval_required && booking.status === 'pending' ? tr('Pending', '\u041e\u0436\u0438\u0434\u0430\u0435\u0442') : tr('Booked', '\u0417\u0430\u043f\u0438\u0441\u0430\u043d\u043e')) + '</span></div><div class="schedule-booking-time"><span>' + CAL + esc(formatDate(booking.slot_date)) + '</span><span>' + CLOCK + esc(String(booking.slot_time || '').slice(0, 5) + ' · ' + (booking.duration_min || 60) + ' ' + tr('min', '\u043c\u0438\u043d')) + '</span><span>' + esc(moneyText(booking)) + '</span></div>' + (booking.live_room_url ? '<a class="btn" href="' + esc(booking.live_room_url) + '" target="_blank" rel="noopener">LIVE</a>' : '') + '<button class="sch-cancel" data-cancel-booking="' + esc(booking.id) + '">' + esc(tr('Cancel booking', '\u041e\u0442\u043c\u0435\u043d\u0438\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c')) + '</button></article>';
          }).join('') + '</div>' : '<div class="mg-empty schedule-empty"><span class="mg-empty-ic">' + CLOCK + '</span><b>' + esc(tr('No bookings yet', '\u0417\u0430\u043f\u0438\u0441\u0435\u0439 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442')) + '</b><p>' + esc(tr('Pick a teacher and choose a free time.', '\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f \u0438 \u0441\u0432\u043e\u0431\u043e\u0434\u043d\u043e\u0435 \u0432\u0440\u0435\u043c\u044f.')) + '</p></div>');
        bindScheduleFilters(main);
      }
    }

    function bindScheduleFilters(host) {
      const apply = () => {
        const query = (host.querySelector('#scheduleTeacherSearch')?.value || '').trim().toLowerCase();
        const active = host.querySelector('[data-schedule-filter].active')?.dataset.scheduleFilter || 'all';
        let visible = 0;
        Array.from(host.querySelectorAll('[data-teacher-card]')).forEach((card) => {
          let show = !query || card.dataset.scheduleSearch.includes(query);
          if (active === 'free') show = show && card.dataset.schedulePrice === 'free';
          if (active === 'live') show = show && card.dataset.scheduleLive === '1';
          card.hidden = !show;
          if (show) visible++;
        });
        const empty = host.querySelector('.schedule-no-results');
        if (empty) empty.hidden = Boolean(visible);
      };
      const search = host.querySelector('#scheduleTeacherSearch');
      if (search) search.addEventListener('input', apply);
      host.querySelectorAll('[data-schedule-filter]').forEach((button) => {
        button.addEventListener('click', () => {
          host.querySelectorAll('[data-schedule-filter]').forEach((node) => node.classList.toggle('active', node === button));
          apply();
        });
      });
    }

    async function openTeacherSlots(teacherId) {
      const teacher = state.scheduleTeachers.find((item) => item.id === teacherId);
      const main = $('#scheduleMain');
      main.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      const today = new Date().toISOString().slice(0, 10);
      let slots = [];
      try {
        const { data } = await supa.from('teacher_slots')
          .select('id,slot_date,slot_time,duration_min,is_booked,status,price,currency,timezone,live_room_url,approval_required').eq('teacher_id', teacherId)
          .gte('slot_date', today)
          .order('slot_date', { ascending: true }).order('slot_time', { ascending: true }).limit(60);
        slots = data || [];
      } catch (error) {
        /* ignore */
      }
      const freeSlots = slots.filter((slot) => !slot.is_booked);
      const grouped = freeSlots.reduce((map, slot) => {
        const list = map.get(slot.slot_date) || [];
        list.push(slot);
        map.set(slot.slot_date, list);
        return map;
      }, new Map());
      main.innerHTML = '<div class="schedule-teacher-detail">' +
          '<button class="sch-back" id="slotsBack" type="button">← ' + esc(tr('Back', '\u041d\u0430\u0437\u0430\u0434')) + '</button>' +
          '<div class="schedule-teacher-detail-main"><span class="sch-avatar">' + avatarInner(teacher && teacher.full_name, teacher && teacher.avatar_url) + '</span><div><small>' + esc(tr('Teacher schedule', '\u0420\u0430\u0441\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f')) + '</small><h2>' + esc((teacher && teacher.full_name) || tr('Teacher', '\u041f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044c')) + '</h2><p>' + esc([teacher && teacher.city, teacher && teacher.country].filter(Boolean).join(', ') || 'Duvela') + '</p></div></div>' +
          '<div class="schedule-hero-stats compact"><span><b>' + freeSlots.length + '</b><small>' + esc(tr('free slots', '\u0441\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0445 \u0441\u043b\u043e\u0442\u043e\u0432')) + '</small></span><span><b>' + (freeSlots[0] ? (freeSlots[0].duration_min || 60) : 0) + '</b><small>' + esc(tr('minutes', '\u043c\u0438\u043d\u0443\u0442')) + '</small></span><span><b>' + esc(freeSlots[0] ? moneyText(freeSlots[0]) : '-') + '</b><small>' + esc(tr('price', '\u0446\u0435\u043d\u0430')) + '</small></span></div>' +
        '</div>' +
        (freeSlots.length ? '<div class="schedule-day-groups">' + Array.from(grouped, ([date, daySlots]) => '<section class="schedule-day-card"><div class="schedule-day-head"><b>' + esc(formatDate(date)) + '</b><span>' + daySlots.length + ' ' + esc(tr('times', '\u0432\u0440\u0435\u043c\u0435\u043d\u0438')) + '</span></div><div class="schedule-slot-grid">' + daySlots.map((slot) => '<button class="schedule-slot-card" data-book="' + esc(slot.id) + '"><span class="schedule-slot-time">' + esc(String(slot.slot_time || '').slice(0, 5)) + '</span><span>' + CLOCK + esc((slot.duration_min || 60) + ' ' + tr('min', '\u043c\u0438\u043d')) + '</span><span>' + VIDEO + esc(lessonFormat(slot)) + '</span><span>' + esc(moneyText(slot)) + '</span>' + (slot.approval_required ? '<small>' + esc(tr('Teacher approval required', '\u041d\u0443\u0436\u043d\u043e \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f')) + '</small>' : '<small>' + esc(tr('Instant booking', '\u041c\u0433\u043d\u043e\u0432\u0435\u043d\u043d\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c')) + '</small>') + '</button>').join('') + '</div></section>').join('') + '</div>' : '<div class="mg-empty schedule-empty"><b>' + esc(tr('No free slots', '\u0421\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0445 \u0441\u043b\u043e\u0442\u043e\u0432 \u043d\u0435\u0442')) + '</b><p>' + esc(tr('This teacher has no open times right now.', '\u0423 \u044d\u0442\u043e\u0433\u043e \u043f\u0440\u0435\u043f\u043e\u0434\u0430\u0432\u0430\u0442\u0435\u043b\u044f \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0442 \u043e\u0442\u043a\u0440\u044b\u0442\u043e\u0433\u043e \u0432\u0440\u0435\u043c\u0435\u043d\u0438.')) + '</p></div>');
      $('#slotsBack').addEventListener('click', renderSchedule);
    }

    async function bookSlot(slotId) {
      try {
        const { error } = await supa.rpc('book_teacher_slot', { target_slot_id: slotId });
        if (error) throw error;
        alert(tr('Lesson booked! The teacher will see you in their schedule.', 'Урок забронирован! Преподаватель увидит вас в своём расписании.'));
        await loadSchedule();
        renderSchedule();
      } catch (error) {
        alert(error.message || tr('Could not book the slot.', 'Не удалось забронировать слот.'));
      }
    }

    async function joinWaitlist(slotId) {
      const result = await supa.rpc('join_slot_waitlist', { target_slot_id: slotId });
      if (result.error) alert(result.error.message);
      else alert(tr('Waitlist position: ', 'Позиция в листе ожидания: ') + result.data);
    }

    async function cancelBooking(slotId) {
      if (!confirm(tr('Cancel this booking?', 'Отменить эту запись?'))) return;
      try {
        const { error } = await supa.rpc('cancel_own_booking', { target_slot_id: slotId });
        if (error) throw error;
        await loadSchedule();
        renderSchedule();
      } catch (error) {
        alert(error.message || tr('Could not cancel the booking.', 'Не удалось отменить запись.'));
      }
    }

    function renderCalendarView() {
      const side = $('#scheduleSide');
      const grouped = new Map();
      state.mySlots.forEach((slot) => { const list = grouped.get(slot.slot_date) || []; list.push(slot); grouped.set(slot.slot_date, list); });
      side.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">' + esc(tr('Calendar', 'Календарь')) + '</h3><button class="btn" id="calendarBack">' + esc(tr('List', 'Список')) + '</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">' + Array.from(grouped, ([date, slots]) =>
          '<div class="card" style="padding:12px"><b>' + esc(formatDate(date)) + '</b><div style="display:grid;gap:6px;margin-top:8px">' + slots.map((slot) =>
            '<button class="slot-chip" type="button" data-calendar-slot="' + esc(slot.id) + '" style="justify-content:space-between;border-color:' + (slot.is_booked ? 'var(--teal)' : 'var(--purple)') + '"><span>' + esc(String(slot.slot_time).slice(0,5)) + '</span><span>' + esc(slot.is_booked ? tr('Booked','Занят') : tr('Free','Свободен')) + '</span></button>'
          ).join('') + '</div></div>').join('') + '</div>';
      $('#calendarBack').addEventListener('click', renderSchedule);
      side.querySelectorAll('[data-calendar-slot]').forEach((button) => button.addEventListener('click', () => editSlot(button.dataset.calendarSlot)));
    }

    async function editSlot(id) {
      const slot = state.mySlots.find((item) => item.id === id);
      if (!slot) return;
      if (slot.status === 'pending' && window.confirm(tr('Approve this booking request?', 'Подтвердить этот запрос на запись?'))) {
        const approved = await supa.from('teacher_slots').update({ status: 'booked', booking_status: 'booked', is_booked: true }).eq('id', id).eq('teacher_id', ctx.user.id);
        if (approved.error) alert(approved.error.message); else { await loadSchedule(); renderCalendarView(); }
        return;
      }
      const value = window.prompt(tr('New date and time (YYYY-MM-DD HH:MM):', 'Новая дата и время (ГГГГ-ММ-ДД ЧЧ:ММ):'), slot.slot_date + ' ' + String(slot.slot_time).slice(0,5));
      if (!value) return;
      const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
      if (!match) return alert(tr('Invalid date or time.', 'Неверная дата или время.'));
      const result = await supa.from('teacher_slots').update({ slot_date: match[1], slot_time: match[2] }).eq('id', id).eq('teacher_id', ctx.user.id);
      if (result.error) alert(result.error.message); else { await loadSchedule(); renderCalendarView(); }
    }

    async function deleteAllFreeSlots() {
      if (!window.confirm(tr('Delete all future free slots?', 'Удалить все будущие свободные слоты?'))) return;
      const ids = state.mySlots.filter((slot) => !slot.is_booked).map((slot) => slot.id);
      if (!ids.length) return;
      const result = await supa.from('teacher_slots').delete().in('id', ids).eq('teacher_id', ctx.user.id);
      if (result.error) alert(result.error.message); else { await loadSchedule(); renderSchedule(); }
    }

    function showCalendarConnections() {
      if (!state.mySlots.length) return alert(tr('Create a slot before exporting the calendar.', 'Создайте слот перед экспортом календаря.'));
      const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Duvela//Schedule//EN'];
      state.mySlots.forEach((slot) => {
        const start = new Date(slot.slot_date + 'T' + String(slot.slot_time).slice(0,5));
        const end = new Date(start.getTime() + (slot.duration_min || 60) * 60000);
        const stamp = (date) => date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
        lines.push('BEGIN:VEVENT','UID:' + slot.id + '@duvela','DTSTART:' + stamp(start),'DTEND:' + stamp(end),'SUMMARY:Duvela lesson' + (slot.live_room_url ? '\nURL:' + slot.live_room_url : ''),'END:VEVENT');
      });
      lines.push('END:VCALENDAR');
      const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar' }));
      const link = document.createElement('a'); link.href = url; link.download = 'duvela-schedule.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      alert(tr('Calendar file created. It can be imported into Google Calendar or Outlook.', 'Файл календаря создан. Его можно импортировать в Google Calendar или Outlook.'));
    }

    async function editScheduleSettings() {
      const currentResult = await supa.from('teacher_schedule_settings').select('*').eq('teacher_id', ctx.user.id).maybeSingle();
      const current = currentResult.data || {};
      const maxBookings = window.prompt(tr('Maximum active bookings per student:', 'Максимум активных записей одного ученика:'), current.max_active_bookings_per_student || 5);
      if (maxBookings === null) return;
      const minNotice = window.prompt(tr('Minimum booking notice (minutes):', 'Минимальное время до записи (минуты):'), current.min_booking_notice_min || 120);
      if (minNotice === null) return;
      const cancelCutoff = window.prompt(tr('Cancellation cutoff (minutes):', 'Срок отмены до урока (минуты):'), current.cancellation_cutoff_min || 120);
      if (cancelCutoff === null) return;
      const result = await supa.from('teacher_schedule_settings').upsert({
        teacher_id: ctx.user.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        max_active_bookings_per_student: Math.max(1, Number(maxBookings) || 5),
        min_booking_notice_min: Math.max(0, Number(minNotice) || 0),
        cancellation_cutoff_min: Math.max(0, Number(cancelCutoff) || 0),
        approval_required: window.confirm(tr('Require approval for all new bookings?', 'Требовать подтверждение всех новых записей?')),
        reminders_in_app: true,
        reminders_email: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'teacher_id' });
      if (result.error) alert(result.error.message); else alert(tr('Schedule rules saved.', 'Правила расписания сохранены.'));
    }

    async function createSlot(event) {
      event.preventDefault();
      const date = $('#slotDate').value;
      const time = $('#slotTime').value;
      const duration = Math.max(15, Number($('#slotDur').value) || 60);
      const count = Math.min(30, Math.max(1, Number($('#slotCount').value) || 1));
      const breakMinutes = Math.min(240, Math.max(0, Number($('#slotBreak').value) || 0));
      if (!date || !time) return;
      const firstStart = new Date(date + 'T' + time);
      if (!Number.isFinite(firstStart.getTime())) return;
      if (firstStart.getTime() < Date.now()) return alert(tr('Choose a future date and time.', 'Выберите будущую дату и время.'));
      const repeat = $('#slotRepeat').value;
      const endDate = $('#slotEndDate').value ? new Date($('#slotEndDate').value + 'T23:59') : firstStart;
      const weekdays = new Set(Array.from($('#slotWeekdays').querySelectorAll('input:checked')).map((input) => Number(input.value)));
      const seriesId = repeat === 'none' ? null : crypto.randomUUID();
      const days = [];
      for (let cursor = new Date(firstStart); cursor <= endDate && days.length < 366; cursor.setDate(cursor.getDate() + 1)) {
        if (repeat === 'none' && days.length) break;
        if (repeat === 'weekly' && !weekdays.has(cursor.getDay())) continue;
        days.push(new Date(cursor));
        if (repeat === 'none') break;
      }
      const price = Math.max(0, Number($('#slotPrice').value) || 0);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const workingStart = $('#workingStart').value;
      const workingEnd = $('#workingEnd').value;
      const payload = days.flatMap((day) => Array.from({ length: count }, (_, index) => {
        const start = new Date(day.getTime() + index * (duration + breakMinutes) * 60000);
        return {
          teacher_id: ctx.user.id, slot_date: localDateValue(start), slot_time: localTimeValue(start), duration_min: duration,
          is_booked: false, status: 'open', price, currency: $('#slotCurrency').value, timezone,
          live_room_url: $('#slotLiveUrl').value.trim() || null, approval_required: $('#slotApproval').checked, series_id: seriesId
        };
      })).filter((slot) => {
        const startMinutes = Number(slot.slot_time.slice(0, 2)) * 60 + Number(slot.slot_time.slice(3, 5));
        const minStart = Number(workingStart.slice(0, 2)) * 60 + Number(workingStart.slice(3, 5));
        const maxEnd = Number(workingEnd.slice(0, 2)) * 60 + Number(workingEnd.slice(3, 5));
        return startMinutes >= minStart && startMinutes + duration <= maxEnd;
      });
      if (!payload.length) return alert(tr('No slots fit inside the selected working hours.', 'Ни один слот не помещается в выбранные рабочие часы.'));
      if (payload.length > 500) return alert(tr('A maximum of 500 slots can be created at once.', 'За один раз можно создать не более 500 слотов.'));
      const overlaps = payload.some((candidate) => {
        const candidateStart = new Date(candidate.slot_date + 'T' + candidate.slot_time).getTime();
        const candidateEnd = candidateStart + candidate.duration_min * 60000;
        return state.mySlots.some((existing) => {
          const existingStart = new Date(existing.slot_date + 'T' + String(existing.slot_time || '').slice(0, 5)).getTime();
          const existingEnd = existingStart + (existing.duration_min || 60) * 60000;
          return candidateStart < existingEnd && candidateEnd > existingStart;
        });
      });
      if (overlaps) return alert(tr('One or more new slots overlap an existing slot.', 'Один или несколько новых слотов пересекаются с существующим слотом.'));
      const btn = $('#slotForm button[type="submit"]');
      btn.disabled = true;
      try {
        const { error } = await supa.from('teacher_slots').insert(payload);
        if (error) throw error;
        await loadSchedule();
        renderSchedule();
      } catch (error) {
        alert(error.message || tr('Could not open the slot.', 'Не удалось открыть слот.'));
        btn.disabled = false;
      }
    }

    function localDateValue(date) {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function localTimeValue(date) {
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }

    function updateSlotBatchPreview() {
      const hint = $('#slotBatchHint');
      if (!hint) return;
      const count = Math.min(30, Math.max(1, Number($('#slotCount').value) || 1));
      const duration = Math.max(15, Number($('#slotDur').value) || 60);
      const breakMinutes = Math.min(240, Math.max(0, Number($('#slotBreak').value) || 0));
      $('#slotSubmitLabel').textContent = count === 1 ? tr('Open slot', 'Открыть слот') : tr('Open ', 'Открыть ') + count + tr(' slots', ' слотов');
      const date = $('#slotDate').value;
      const time = $('#slotTime').value;
      if (!date || !time) {
        hint.textContent = tr('Choose the first slot time. Following slots will be created automatically.', 'Выберите время первого слота. Следующие слоты будут созданы автоматически.');
        return;
      }
      const first = new Date(date + 'T' + time);
      const last = new Date(first.getTime() + (count - 1) * (duration + breakMinutes) * 60000);
      hint.textContent = count === 1
        ? tr('One slot will be opened.', 'Будет открыт один слот.')
        : tr('From ', 'С ') + first.toLocaleString() + tr(' to ', ' до ') + new Date(last.getTime() + duration * 60000).toLocaleString() + ' · ' + count + tr(' slots', ' слотов');
    }

    return {
      bookSlot,
      cancelBooking,
      loadSchedule,
      openTeacherSlots,
      renderSchedule
    };
  }

  window.DuvelaAppSchedule = { create: createScheduleFeature };
})();
