(function () {
  function createClassesFeature(ctx) {
    const { $, tr, esc, alert, supa, state, avatarInner, formatDate } = ctx;
    let currentClassId = null;
    let selectedSessionId = null;
    let clsStudentTimer = null;

    async function openClassManage(classId) {
      currentClassId = classId;
      const classItem = state.orgClasses.find((item) => item.id === classId);
      $('#classOverlayTitle').textContent = (classItem && classItem.name) || tr('Class', 'Класс');
      const body = $('#classOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      $('#classOverlay').classList.add('open');
      let sessions = [];
      let roster = [];
      let attendance = [];
      try {
        const [sessionsResult, rosterResult] = await Promise.all([
          supa.from('class_sessions').select('id,title,starts_at,ends_at,duration_min,status,recurrence_group_id').eq('class_id', classId).order('starts_at', { ascending: false }).limit(30),
          supa.from('class_clients').select('id,client_id,status,profiles(full_name,avatar_url)').eq('class_id', classId).neq('status', 'removed')
        ]);
        sessions = sessionsResult.data || [];
        roster = rosterResult.data || [];
      } catch (error) {
        /* optional */
      }
      if (selectedSessionId && !sessions.find((session) => session.id === selectedSessionId)) selectedSessionId = null;
      if (selectedSessionId) {
        try {
          const { data } = await supa.from('class_attendance').select('client_id,status,joined_at,left_at,duration_seconds,connection_count').eq('session_id', selectedSessionId);
          attendance = data || [];
        } catch (error) {
          /* optional */
        }
      }
      const attendanceMap = new Map(attendance.map((item) => [item.client_id, item]));
      const inputStyle = 'flex:1;min-width:120px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-soft)';
      body.innerHTML =
        '<div class="section-head"><h2 style="font-size:15px">' + esc(tr('Sessions', 'Сессии')) + '</h2></div>' +
        '<div class="card" style="padding:10px;margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap"><input id="csTitle" placeholder="' + esc(tr('Session title', 'Название сессии')) + '" style="' + inputStyle + '"><input id="csWhen" type="datetime-local" style="' + inputStyle + '"><button class="btn primary" data-add-session="1">' + esc(tr('Add', 'Добавить')) + '</button></div>' +
        (sessions.length ? sessions.map((session) => '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(session.title || tr('Session', 'Сессия')) + '</h3><p>' + esc(session.starts_at ? formatDate(session.starts_at) : '') + ' · ' + esc(session.status || 'scheduled') + '</p></div><div class="class-session-actions">' +
          (session.status !== 'cancelled' && session.status !== 'ended' ? '<button class="btn" data-session-reschedule="' + esc(session.id) + '">' + esc(tr('Reschedule', 'Перенести')) + '</button>' + (session.recurrence_group_id ? '<button class="btn" data-series-reschedule="' + esc(session.id) + '">' + esc(tr('This and next', 'Этот и следующие')) + '</button>' : '') + '<button class="btn danger" data-session-cancel="' + esc(session.id) + '">' + esc(tr('Cancel', 'Отменить')) + '</button>' + (session.recurrence_group_id ? '<button class="btn danger" data-series-cancel="' + esc(session.id) + '">' + esc(tr('Cancel series', 'Отменить серию')) + '</button>' : '') : '') +
          '<button class="btn' + (selectedSessionId === session.id ? ' primary' : '') + '" data-session-att="' + esc(session.id) + '">' + esc(tr('Attendance', 'Посещаемость')) + '</button></div></div>').join('') : '<div class="empty">' + esc(tr('No sessions yet.', 'Сессий пока нет.')) + '</div>') +
        '<div class="section-head" style="margin-top:16px"><h2 style="font-size:15px">' + esc(tr('Students', 'Ученики')) + '</h2>' + (selectedSessionId ? '<span>' + esc(tr('Marking attendance', 'Отметка посещаемости')) + '</span>' : '') + '</div>' +
        '<input id="clsStudentSearch" class="search" placeholder="' + esc(tr('Add student by name...', 'Добавить ученика по имени...')) + '"><div id="clsStudentResults"></div>' +
        (roster.length ? roster.map((member) => {
          const name = (member.profiles && member.profiles.full_name) || tr('Student', 'Ученик');
          const record = attendanceMap.get(member.client_id);
          const mark = record && record.status;
          const duration = record && Number(record.duration_seconds || 0);
          const report = record ? '<small style="display:block;color:var(--soft);margin-top:3px">' + esc(Math.round(duration / 60) + ' мин · подключений: ' + Number(record.connection_count || 0)) + '</small>' : '';
          const controls = selectedSessionId
            ? '<button class="btn' + (mark === 'present' ? ' primary' : '') + '" data-att="present" data-client="' + esc(member.client_id) + '" style="min-height:28px;padding:4px 10px">' + esc(tr('Present', 'Был')) + '</button> <button class="btn' + (mark === 'absent' ? ' danger' : '') + '" data-att="absent" data-client="' + esc(member.client_id) + '" style="min-height:28px;padding:4px 10px">' + esc(tr('Absent', 'Нет')) + '</button>'
            : '';
          return '<div class="card row" style="grid-template-columns:36px minmax(0,1fr) auto"><div class="avatar" style="width:36px;height:36px">' + avatarInner(name, member.profiles && member.profiles.avatar_url) + '</div><div style="min-width:0"><h3>' + esc(name) + '</h3>' + report + '</div><div style="display:flex;gap:6px;white-space:nowrap">' + controls + '</div></div>';
        }).join('') : '<div class="empty">' + esc(tr('No students yet.', 'Учеников пока нет.')) + '</div>');
      if (selectedSessionId && attendance.length) {
        body.insertAdjacentHTML('beforeend', '<button class="btn" id="exportClassAttendance">' + esc(tr('Export attendance CSV', 'Экспорт посещаемости CSV')) + '</button>');
        $('#exportClassAttendance').onclick = () => exportAttendanceCsv(roster, attendance);
      }
      body.querySelectorAll('[data-session-att]').forEach((button) => {
        const sessionId = button.getAttribute('data-session-att');
        const classroomLink = document.createElement('a');
        classroomLink.className = 'btn primary';
        classroomLink.href = './classroom.html?s=' + encodeURIComponent(sessionId);
        classroomLink.textContent = tr('Open classroom', 'Открыть класс');
        button.parentElement.insertBefore(classroomLink, button);
      });
      body.querySelectorAll('[data-session-reschedule]').forEach((button) => {
        button.onclick = () => rescheduleSession(button.dataset.sessionReschedule, sessions, roster.length);
      });
      body.querySelectorAll('[data-session-cancel]').forEach((button) => {
        button.onclick = () => cancelSession(button.dataset.sessionCancel, roster.length);
      });
      body.querySelectorAll('[data-series-reschedule]').forEach((button) => {
        button.onclick = () => rescheduleSeries(button.dataset.seriesReschedule, sessions, roster.length);
      });
      body.querySelectorAll('[data-series-cancel]').forEach((button) => {
        button.onclick = () => cancelSeries(button.dataset.seriesCancel, sessions, roster.length);
      });
      $('#clsStudentSearch').addEventListener('input', (event) => {
        clearTimeout(clsStudentTimer);
        const value = event.target.value;
        clsStudentTimer = setTimeout(() => searchClassStudent(value), 250);
      });
    }

    async function searchClassStudent(queryValue) {
      const box = $('#clsStudentResults');
      if (!box) return;
      const query = queryValue.trim();
      if (query.length < 2) {
        box.innerHTML = '';
        return;
      }
      try {
        const { data } = await supa.from('profiles').select('id,full_name,avatar_url,city').ilike('full_name', '%' + query.replace(/[%,()]/g, '') + '%').limit(6);
        box.innerHTML = (data || []).map((profile) => '<div class="conv" data-add-student="' + esc(profile.id) + '"><div class="avatar">' + avatarInner(profile.full_name, profile.avatar_url) + '</div><div><h3>' + esc(profile.full_name || 'Duvela') + '</h3><p>' + esc(profile.city || '') + '</p></div><div>+</div></div>').join('') || '<div class="empty">' + esc(tr('No people found.', 'Люди не найдены.')) + '</div>';
      } catch (error) {
        box.innerHTML = '';
      }
    }

    async function addClassStudent(clientId) {
      try {
        const { error } = await supa.from('class_clients').upsert({ class_id: currentClassId, client_id: clientId, status: 'active' }, { onConflict: 'class_id,client_id' });
        if (error) throw error;
        openClassManage(currentClassId);
      } catch (error) {
        alert(error.message || tr('Could not add the student.', 'Не удалось добавить ученика.'));
      }
    }

    async function createClassSession() {
      const title = ($('#csTitle').value || '').trim();
      const when = $('#csWhen').value;
      if (!title || !when) {
        alert(tr('Title and time are required.', 'Нужны название и время.'));
        return;
      }
      try {
        const { error } = await supa.from('class_sessions').insert({ class_id: currentClassId, title, starts_at: new Date(when).toISOString(), created_by: ctx.user.id, status: 'scheduled', provider: 'zoom', max_participants: 25 });
        if (error) throw error;
        openClassManage(currentClassId);
      } catch (error) {
        alert(error.message || tr('Could not create the session.', 'Не удалось создать сессию.'));
      }
    }

    async function rescheduleSession(sessionId, sessions, learnerCount) {
      const session = sessions.find((item) => String(item.id) === String(sessionId));
      if (!session) return;
      const local = new Date(session.starts_at);
      local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
      const nextValue = window.prompt(
        tr('New date and time (Europe/Berlin):', 'Новая дата и время (Europe/Berlin):'),
        local.toISOString().slice(0, 16)
      );
      if (!nextValue || nextValue === local.toISOString().slice(0, 16)) return;
      if (learnerCount && !window.confirm(tr(
        learnerCount + ' learners will receive a rescheduling notification. Continue?',
        learnerCount + ' учеников получат уведомление о переносе. Продолжить?'
      ))) return;
      const startsAt = new Date(nextValue);
      const duration = session.duration_min || Math.max(15, Math.round((Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60000) || 60);
      const { error } = await supa.from('class_sessions').update({
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + duration * 60000).toISOString(),
        join_opens_at: new Date(startsAt.getTime() - 30 * 60000).toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', sessionId);
      if (error) return alert(error.message || tr('Could not reschedule the lesson.', 'Не удалось перенести урок.'));
      openClassManage(currentClassId);
    }

    async function cancelSession(sessionId, learnerCount) {
      const reason = window.prompt(tr('Cancellation reason:', 'Причина отмены:'));
      if (reason === null) return;
      if (learnerCount && !window.confirm(tr(
        learnerCount + ' learners will receive a cancellation notification. Continue?',
        learnerCount + ' учеников получат уведомление об отмене. Продолжить?'
      ))) return;
      const { error } = await supa.from('class_sessions').update({
        status: 'cancelled', cancellation_reason: reason.trim() || null,
        cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', sessionId);
      if (error) return alert(error.message || tr('Could not cancel the lesson.', 'Не удалось отменить урок.'));
      openClassManage(currentClassId);
    }

    async function rescheduleSeries(sessionId, sessions, learnerCount) {
      const session = sessions.find((item) => String(item.id) === String(sessionId));
      if (!session || !session.recurrence_group_id) return;
      const nextValue = window.prompt(tr('New date and time for this lesson:', 'Новая дата и время этого урока:'), new Date(session.starts_at).toISOString().slice(0, 16));
      if (!nextValue) return;
      const nextStart = new Date(nextValue);
      const shiftMs = nextStart.getTime() - Date.parse(session.starts_at);
      if (!Number.isFinite(shiftMs) || !window.confirm(tr('Move this and all following lessons?', 'Перенести этот и все следующие уроки?'))) return;
      const affected = sessions.filter((item) => item.recurrence_group_id === session.recurrence_group_id && Date.parse(item.starts_at) >= Date.parse(session.starts_at) && item.status === 'scheduled');
      for (const item of affected) {
        const start = new Date(Date.parse(item.starts_at) + shiftMs);
        const duration = item.duration_min || 60;
        await supa.from('class_sessions').update({
          starts_at: start.toISOString(), ends_at: new Date(start.getTime() + duration * 60000).toISOString(),
          join_opens_at: new Date(start.getTime() - 30 * 60000).toISOString(), updated_at: new Date().toISOString()
        }).eq('id', item.id);
      }
      openClassManage(currentClassId);
    }

    async function cancelSeries(sessionId, sessions, learnerCount) {
      const session = sessions.find((item) => String(item.id) === String(sessionId));
      if (!session || !session.recurrence_group_id) return;
      const reason = window.prompt(tr('Cancellation reason for the series:', 'Причина отмены серии:'));
      if (reason === null || !window.confirm(tr('Cancel this and all following lessons?', 'Отменить этот и все следующие уроки?'))) return;
      const ids = sessions.filter((item) => item.recurrence_group_id === session.recurrence_group_id && Date.parse(item.starts_at) >= Date.parse(session.starts_at) && item.status === 'scheduled').map((item) => item.id);
      if (ids.length) await supa.from('class_sessions').update({ status: 'cancelled', cancellation_reason: reason || null, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', ids);
      openClassManage(currentClassId);
    }

    function exportAttendanceCsv(roster, attendance) {
      const attendanceMap = new Map(attendance.map((item) => [item.client_id, item]));
      const rows = [['Student','Status','Joined','Left','Minutes','Connections']].concat(roster.map((member) => {
        const record = attendanceMap.get(member.client_id) || {};
        return [
          member.profiles && member.profiles.full_name || 'Student', record.status || 'unknown',
          record.joined_at || '', record.left_at || '', Math.round(Number(record.duration_seconds || 0) / 60),
          Number(record.connection_count || 0)
        ];
      }));
      const csv = rows.map((row) => row.map((value) => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\n');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
      link.download = 'duvela-attendance-' + selectedSessionId + '.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    async function markAttendance(clientId, status) {
      if (!selectedSessionId) return;
      try {
        const { error } = await supa.from('class_attendance').upsert({ session_id: selectedSessionId, client_id: clientId, status, marked_by: ctx.user.id, marked_at: new Date().toISOString() }, { onConflict: 'session_id,client_id' });
        if (error) throw error;
        openClassManage(currentClassId);
      } catch (error) {
        alert(error.message || tr('Could not mark attendance.', 'Не удалось отметить посещаемость.'));
      }
    }

    function clearSelectedSession() {
      selectedSessionId = null;
    }

    function selectSession(sessionId) {
      selectedSessionId = sessionId;
      if (currentClassId) openClassManage(currentClassId);
    }

    return {
      addClassStudent,
      clearSelectedSession,
      createClassSession,
      markAttendance,
      openClassManage,
      selectSession
    };
  }

  window.DuvelaAppClasses = { create: createClassesFeature };
})();
