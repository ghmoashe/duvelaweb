(function () {
  function createClassesFeature(ctx) {
    const { $, tr, esc, alert, supa, state, avatarInner, formatDate } = ctx;
    let currentClassId = null;
    let selectedSessionId = null;
    let clsStudentTimer = null;

    async function openClassManage(classId) {
      currentClassId = classId;
      const classItem = state.orgClasses.find((item) => item.id === classId);
      $('#classOverlayTitle').textContent = (classItem && classItem.name) || tr('Class', 'РљР»Р°СЃСЃ');
      const body = $('#classOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Р—Р°РіСЂСѓР·РєР°...')) + '</div>';
      $('#classOverlay').classList.add('open');
      let sessions = [];
      let roster = [];
      let attendance = [];
      try {
        const [sessionsResult, rosterResult] = await Promise.all([
          supa.from('class_sessions').select('id,title,starts_at,status').eq('class_id', classId).order('starts_at', { ascending: false }).limit(30),
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
          const { data } = await supa.from('class_attendance').select('client_id,status').eq('session_id', selectedSessionId);
          attendance = data || [];
        } catch (error) {
          /* optional */
        }
      }
      const attendanceMap = new Map(attendance.map((item) => [item.client_id, item.status]));
      const inputStyle = 'flex:1;min-width:120px;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-soft)';
      body.innerHTML =
        '<div class="section-head"><h2 style="font-size:15px">' + esc(tr('Sessions', 'РЎРµСЃСЃРёРё')) + '</h2></div>' +
        '<div class="card" style="padding:10px;margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap"><input id="csTitle" placeholder="' + esc(tr('Session title', 'РќР°Р·РІР°РЅРёРµ СЃРµСЃСЃРёРё')) + '" style="' + inputStyle + '"><input id="csWhen" type="datetime-local" style="' + inputStyle + '"><button class="btn primary" data-add-session="1">' + esc(tr('Add', 'Р”РѕР±Р°РІРёС‚СЊ')) + '</button></div>' +
        (sessions.length ? sessions.map((session) => '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(session.title || tr('Session', 'РЎРµСЃСЃРёСЏ')) + '</h3><p>' + esc(session.starts_at ? formatDate(session.starts_at) : '') + '</p></div><button class="btn' + (selectedSessionId === session.id ? ' primary' : '') + '" data-session-att="' + esc(session.id) + '">' + esc(tr('Attendance', 'РџРѕСЃРµС‰Р°РµРјРѕСЃС‚СЊ')) + '</button></div>').join('') : '<div class="empty">' + esc(tr('No sessions yet.', 'РЎРµСЃСЃРёР№ РїРѕРєР° РЅРµС‚.')) + '</div>') +
        '<div class="section-head" style="margin-top:16px"><h2 style="font-size:15px">' + esc(tr('Students', 'РЈС‡РµРЅРёРєРё')) + '</h2>' + (selectedSessionId ? '<span>' + esc(tr('Marking attendance', 'РћС‚РјРµС‚РєР° РїРѕСЃРµС‰Р°РµРјРѕСЃС‚Рё')) + '</span>' : '') + '</div>' +
        '<input id="clsStudentSearch" class="search" placeholder="' + esc(tr('Add student by name...', 'Р”РѕР±Р°РІРёС‚СЊ СѓС‡РµРЅРёРєР° РїРѕ РёРјРµРЅРё...')) + '"><div id="clsStudentResults"></div>' +
        (roster.length ? roster.map((member) => {
          const name = (member.profiles && member.profiles.full_name) || tr('Student', 'РЈС‡РµРЅРёРє');
          const mark = attendanceMap.get(member.client_id);
          const controls = selectedSessionId
            ? '<button class="btn' + (mark === 'present' ? ' primary' : '') + '" data-att="present" data-client="' + esc(member.client_id) + '" style="min-height:28px;padding:4px 10px">' + esc(tr('Present', 'Р‘С‹Р»')) + '</button> <button class="btn' + (mark === 'absent' ? ' danger' : '') + '" data-att="absent" data-client="' + esc(member.client_id) + '" style="min-height:28px;padding:4px 10px">' + esc(tr('Absent', 'РќРµС‚')) + '</button>'
            : '';
          return '<div class="card row" style="grid-template-columns:36px minmax(0,1fr) auto"><div class="avatar" style="width:36px;height:36px">' + avatarInner(name, member.profiles && member.profiles.avatar_url) + '</div><div style="min-width:0"><h3>' + esc(name) + '</h3></div><div style="display:flex;gap:6px;white-space:nowrap">' + controls + '</div></div>';
        }).join('') : '<div class="empty">' + esc(tr('No students yet.', 'РЈС‡РµРЅРёРєРѕРІ РїРѕРєР° РЅРµС‚.')) + '</div>');
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
        box.innerHTML = (data || []).map((profile) => '<div class="conv" data-add-student="' + esc(profile.id) + '"><div class="avatar">' + avatarInner(profile.full_name, profile.avatar_url) + '</div><div><h3>' + esc(profile.full_name || 'Duvela') + '</h3><p>' + esc(profile.city || '') + '</p></div><div>+</div></div>').join('') || '<div class="empty">' + esc(tr('No people found.', 'Р›СЋРґРё РЅРµ РЅР°Р№РґРµРЅС‹.')) + '</div>';
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
        alert(error.message || tr('Could not add the student.', 'РќРµ СѓРґР°Р»РѕСЃСЊ РґРѕР±Р°РІРёС‚СЊ СѓС‡РµРЅРёРєР°.'));
      }
    }

    async function createClassSession() {
      const title = ($('#csTitle').value || '').trim();
      const when = $('#csWhen').value;
      if (!title || !when) {
        alert(tr('Title and time are required.', 'РќСѓР¶РЅС‹ РЅР°Р·РІР°РЅРёРµ Рё РІСЂРµРјСЏ.'));
        return;
      }
      try {
        const { error } = await supa.from('class_sessions').insert({ class_id: currentClassId, title, starts_at: new Date(when).toISOString(), created_by: ctx.user.id, status: 'scheduled' });
        if (error) throw error;
        openClassManage(currentClassId);
      } catch (error) {
        alert(error.message || tr('Could not create the session.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ СЃРµСЃСЃРёСЋ.'));
      }
    }

    async function markAttendance(clientId, status) {
      if (!selectedSessionId) return;
      try {
        const { error } = await supa.from('class_attendance').upsert({ session_id: selectedSessionId, client_id: clientId, status, marked_by: ctx.user.id, marked_at: new Date().toISOString() }, { onConflict: 'session_id,client_id' });
        if (error) throw error;
        openClassManage(currentClassId);
      } catch (error) {
        alert(error.message || tr('Could not mark attendance.', 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РјРµС‚РёС‚СЊ РїРѕСЃРµС‰Р°РµРјРѕСЃС‚СЊ.'));
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
