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
      if (ctx.isBusiness()) {
        $('#scheduleTitle').textContent = tr('Your lesson slots', 'Ваши слоты уроков');
        $('#scheduleSub').textContent = tr('Open times for learners to book', 'Открытые слоты для записи учеников');
        main.innerHTML =
          '<div class="section-head"><h2>' + esc(tr('Open a new slot', 'Открыть новый слот')) + '</h2></div>' +
          '<form id="slotForm"><div class="form-grid">' +
            '<div class="field"><label>' + esc(tr('Date', 'Дата')) + '</label><input id="slotDate" type="date" required></div>' +
            '<div class="field"><label>' + esc(tr('Time', 'Время')) + '</label><input id="slotTime" type="time" required></div>' +
            '<div class="field"><label>' + esc(tr('Duration (min)', 'Длительность (мин)')) + '</label><input id="slotDur" type="number" min="15" step="15" value="60"></div>' +
          '</div><button class="btn primary" type="submit" style="margin-top:10px">' + esc(tr('Open slot', 'Открыть слот')) + '</button></form>';
        $('#slotForm').addEventListener('submit', createSlot);
        side.innerHTML = '<div class="section-head"><h2>' + esc(tr('Upcoming slots', 'Ближайшие слоты')) + '</h2></div>' +
          (state.mySlots.length ? state.mySlots.map((slot) =>
            '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(fmtSlot(slot)) + '</h3><p>' + (slot.duration_min || 60) + ' ' + esc(tr('min', 'мин')) + '</p></div><span class="tag ' + (slot.is_booked ? 'teal' : '') + '">' + esc(slot.is_booked ? tr('Booked', 'Занят') : tr('Free', 'Свободен')) + '</span></div>'
          ).join('') : '<div class="empty">' + esc(tr('No slots yet.', 'Слотов пока нет.')) + '</div>');
      } else {
        $('#scheduleTitle').textContent = tr('Book a lesson', 'Записаться на урок');
        $('#scheduleSub').textContent = tr('Teachers with open slots', 'Преподаватели со свободными слотами');
        main.innerHTML = '<div class="section-head"><h2>' + esc(tr('Teachers', 'Преподаватели')) + '</h2></div>' +
          (state.scheduleTeachers.length ? state.scheduleTeachers.map((teacher) =>
            '<div class="card row" data-teacher="' + esc(teacher.id) + '" style="cursor:pointer"><div class="thumb">' + avatarInner(teacher.full_name, teacher.avatar_url) + '</div><div><h3>' + esc(teacher.full_name || tr('Teacher', 'Преподаватель')) + '</h3><p>' + esc([teacher.city, teacher.country].filter(Boolean).join(', ') || 'Duvela') + '</p></div><span class="tag">' + teacher.slots + ' ' + esc(tr('slots', 'слотов')) + '</span></div>'
          ).join('') : '<div class="empty">' + esc(tr('No open slots right now.', 'Свободных слотов сейчас нет.')) + '</div>');
        side.innerHTML = '<div class="section-head"><h2>' + esc(tr('My bookings', 'Мои записи')) + '</h2></div>' +
          (state.myBookings.length ? state.myBookings.map((booking) =>
            '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(booking.teacher_name) + '</h3><p>' + esc(fmtSlot(booking)) + ' · ' + (booking.duration_min || 60) + ' ' + esc(tr('min', 'мин')) + '</p></div><button class="btn danger" data-cancel-booking="' + esc(booking.id) + '">' + esc(tr('Cancel', 'Отменить')) + '</button></div>'
          ).join('') : '<div class="empty">' + esc(tr('No bookings yet.', 'Записей пока нет.')) + '</div>');
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
      main.innerHTML = '<div class="section-head"><h2>' + esc((teacher && teacher.full_name) || tr('Teacher', 'Преподаватель')) + '</h2><button class="btn" id="slotsBack" type="button">' + esc(tr('Back', 'Назад')) + '</button></div>' +
        (slots.length ? '<div>' + slots.map((slot) => '<button class="slot-chip" data-book="' + esc(slot.id) + '">' + esc(fmtSlot(slot)) + ' · ' + (slot.duration_min || 60) + esc(tr('m', 'м')) + '</button>').join('') + '</div>' : '<div class="empty">' + esc(tr('No free slots.', 'Свободных слотов нет.')) + '</div>');
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
