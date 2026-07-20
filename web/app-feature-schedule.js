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
          .select('teacher_id').eq('is_booked', false).gte('slot_date', today);
        const counts = {};
        (slots || []).forEach((slot) => { counts[slot.teacher_id] = (counts[slot.teacher_id] || 0) + 1; });
        const ids = Object.keys(counts);
        let teachers = [];
        if (ids.length) {
          const { data: profiles } = await supa.from('profiles').select('id,full_name,avatar_url,city,country').in('id', ids);
          teachers = (profiles || []).map((profile) => ({ ...profile, slots: counts[profile.id] || 0 })).sort((a, b) => b.slots - a.slots);
        }
        state.scheduleTeachers = teachers;
        const { data: mine } = await supa.from('teacher_slots')
          .select('id,teacher_id,slot_date,slot_time,duration_min')
          .eq('booked_by_user_id', ctx.user.id).gte('slot_date', today).order('slot_date', { ascending: true });
        const teacherIds = Array.from(new Set((mine || []).map((slot) => slot.teacher_id)));
        const { data: teacherProfiles } = teacherIds.length ? await supa.from('profiles').select('id,full_name').in('id', teacherIds) : { data: [] };
        const teacherNames = new Map((teacherProfiles || []).map((profile) => [profile.id, profile.full_name]));
        state.myBookings = (mine || []).map((slot) => ({ ...slot, teacher_name: teacherNames.get(slot.teacher_id) || tr('Teacher', 'Преподаватель') }));
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
        $('#scheduleTitle').textContent = tr('Book a lesson', 'Записаться на урок');
        $('#scheduleSub').textContent = tr('Teachers with open slots', 'Преподаватели со свободными слотами');
        main.innerHTML = '<div class="bd-section-head" style="margin-bottom:10px"><h3>' + esc(tr('Teachers', 'Преподаватели')) + '</h3></div>' +
          (state.scheduleTeachers.length ? '<div class="mg-list">' + state.scheduleTeachers.map((teacher) =>
            '<div class="mg-row" data-teacher="' + esc(teacher.id) + '" style="cursor:pointer">' +
            '<span class="sch-avatar">' + avatarInner(teacher.full_name, teacher.avatar_url) + '</span>' +
            '<span class="mg-row-copy"><b>' + esc(teacher.full_name || tr('Teacher', 'Преподаватель')) + '</b>' +
            '<span>' + esc([teacher.city, teacher.country].filter(Boolean).join(', ') || 'Duvela') + '</span></span>' +
            '<span class="mg-row-tag" style="color:var(--purple)">' + teacher.slots + ' ' + esc(tr('slots', 'слотов')) + '</span></div>'
          ).join('') + '</div>' : '<div class="mg-empty"><span class="mg-empty-ic">' + CAL + '</span><b>' + esc(tr('No open slots right now', 'Свободных слотов сейчас нет')) + '</b><p>' + esc(tr('Check back later — teachers add new times often.', 'Загляните позже — преподаватели часто добавляют новое время.')) + '</p></div>');
        side.innerHTML = '<div class="bd-section-head" style="margin-bottom:10px"><h3>' + esc(tr('My bookings', 'Мои записи')) + '</h3></div>' +
          (state.myBookings.length ? '<div class="mg-list">' + state.myBookings.map((booking) =>
            '<div class="mg-row"><span class="mg-row-ic teal">' + CLOCK + '</span>' +
            '<span class="mg-row-copy"><b>' + esc(booking.teacher_name) + '</b>' +
            '<span>' + esc(fmtSlot(booking)) + ' · ' + (booking.duration_min || 60) + ' ' + esc(tr('min', 'мин')) + '</span></span>' +
            '<button class="sch-cancel" data-cancel-booking="' + esc(booking.id) + '">' + esc(tr('Cancel', 'Отменить')) + '</button></div>'
          ).join('') + '</div>' : '<div class="mg-empty"><span class="mg-empty-ic">' + CLOCK + '</span><b>' + esc(tr('No bookings yet', 'Записей пока нет')) + '</b><p>' + esc(tr('Pick a teacher and choose a free time.', 'Выберите преподавателя и свободное время.')) + '</p></div>');
      }
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
      main.innerHTML = '<div class="sch-head">' +
          '<button class="sch-back" id="slotsBack" type="button">‹ ' + esc(tr('Back', 'Назад')) + '</button>' +
          '<span class="sch-avatar">' + avatarInner(teacher && teacher.full_name, teacher && teacher.avatar_url) + '</span>' +
          '<b>' + esc((teacher && teacher.full_name) || tr('Teacher', 'Преподаватель')) + '</b>' +
        '</div>' +
        (slots.length
          ? '<div class="sch-slots">' + slots.map((slot) => '<button class="slot-chip" data-book="' + esc(slot.id) + '">' + esc(fmtSlot(slot)) + ' · ' + (slot.duration_min || 60) + esc(tr('m', 'м')) + '</button>').join('') + '</div>'
          : '<div class="mg-empty"><b>' + esc(tr('No free slots', 'Свободных слотов нет')) + '</b><p>' + esc(tr('This teacher has no open times right now.', 'У этого преподавателя сейчас нет открытого времени.')) + '</p></div>');
      $('#slotsBack').addEventListener('click', renderSchedule);
      Array.from(main.querySelectorAll('[data-book]')).forEach((button, index) => {
        const slot = slots[index];
        if (!slot) return;
        if (slot.is_booked) {
          button.removeAttribute('data-book');
          button.dataset.waitlist = slot.id;
          button.textContent += ' · ' + tr('Join waitlist', 'В лист ожидания');
        } else if (Number(slot.price)) {
          button.textContent += ' · ' + Number(slot.price).toFixed(2) + ' ' + (slot.currency || 'EUR');
        }
      });
      main.querySelectorAll('[data-waitlist]').forEach((button) => button.addEventListener('click', () => joinWaitlist(button.dataset.waitlist)));
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
