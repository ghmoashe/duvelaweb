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
            .select('id,slot_date,slot_time,duration_min,is_booked,booked_by_user_id')
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
        $('#slotForm').addEventListener('submit', createSlot);
        side.innerHTML = '<div class="bd-section-head" style="margin-bottom:10px"><h3>' + esc(tr('Upcoming slots', 'Ближайшие слоты')) + '</h3></div>' +
          (state.mySlots.length ? '<div class="mg-list">' + state.mySlots.map((slot) =>
            '<div class="mg-row"><span class="mg-row-ic' + (slot.is_booked ? ' teal' : '') + '">' + CLOCK + '</span>' +
            '<span class="mg-row-copy"><b>' + esc(fmtSlot(slot)) + '</b><span>' + (slot.duration_min || 60) + ' ' + esc(tr('min', 'мин')) + '</span></span>' +
            '<span class="mg-row-tag"' + (slot.is_booked ? '' : ' style="color:var(--purple)"') + '>' + esc(slot.is_booked ? tr('Booked', 'Занят') : tr('Free', 'Свободен')) + '</span></div>'
          ).join('') + '</div>' : '<div class="mg-empty"><span class="mg-empty-ic">' + CAL + '</span><b>' + esc(tr('No slots yet', 'Слотов пока нет')) + '</b><p>' + esc(tr('Open a time above so learners can book you.', 'Откройте время слева — и ученики смогут записаться.')) + '</p></div>');
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
          .select('id,slot_date,slot_time,duration_min').eq('teacher_id', teacherId)
          .eq('is_booked', false).gte('slot_date', today)
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
    }

    async function bookSlot(slotId) {
      try {
        const { error } = await supa.from('teacher_slots').update({ is_booked: true, booked_by_user_id: ctx.user.id }).eq('id', slotId).eq('is_booked', false);
        if (error) throw error;
        alert(tr('Lesson booked! The teacher will see you in their schedule.', 'Урок забронирован! Преподаватель увидит вас в своём расписании.'));
        await loadSchedule();
        renderSchedule();
      } catch (error) {
        alert(error.message || tr('Could not book the slot.', 'Не удалось забронировать слот.'));
      }
    }

    async function cancelBooking(slotId) {
      if (!confirm(tr('Cancel this booking?', 'Отменить эту запись?'))) return;
      try {
        const { error } = await supa.from('teacher_slots').update({ is_booked: false, booked_by_user_id: null }).eq('id', slotId).eq('booked_by_user_id', ctx.user.id);
        if (error) throw error;
        await loadSchedule();
        renderSchedule();
      } catch (error) {
        alert(error.message || tr('Could not cancel the booking.', 'Не удалось отменить запись.'));
      }
    }

    async function createSlot(event) {
      event.preventDefault();
      const payload = { teacher_id: ctx.user.id, slot_date: $('#slotDate').value, slot_time: $('#slotTime').value, duration_min: Number($('#slotDur').value) || 60, is_booked: false };
      if (!payload.slot_date || !payload.slot_time) return;
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
