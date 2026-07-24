(function () {
  function createCatalogFeature(ctx) {
    const { $, tr, esc, alert, supa, state, formatDate, formatMoney } = ctx;
    let currentCourseId = null;
    const savedCatalogKey = (kind) => 'duvela.saved.' + kind;
    const savedCatalogIds = (kind) => new Set(JSON.parse(localStorage.getItem(savedCatalogKey(kind)) || '[]'));

    function catalogToolbar(kind, levels, includeFormat) {
      return '<div class="catalog-toolbar" data-catalog-toolbar="' + kind + '"><label>⌕<input type="search" data-catalog-search placeholder="' + esc(tr('Search by title…', 'Поиск по названию…')) + '"></label>' +
        '<select data-catalog-level><option value="">' + esc(tr('All levels', 'Все уровни')) + '</option>' + levels.map((level) => '<option value="' + esc(level) + '">' + esc(level) + '</option>').join('') + '</select>' +
        (includeFormat ? '<select data-catalog-format><option value="">' + esc(tr('Any format', 'Любой формат')) + '</option><option value="online">' + esc(tr('Online', 'Онлайн')) + '</option><option value="offline">' + esc(tr('In person', 'Очно')) + '</option></select>' : '') +
        '<button type="button" data-catalog-saved>♡ ' + esc(tr('Saved', 'Избранное')) + '</button></div>';
    }

    function bindCatalogTools(kind, list) {
      const toolbar = list.querySelector('[data-catalog-toolbar]');
      if (!toolbar) return;
      let savedOnly = false;
      const apply = () => {
        const query = (toolbar.querySelector('[data-catalog-search]').value || '').trim().toLowerCase();
        const level = toolbar.querySelector('[data-catalog-level]').value;
        const format = toolbar.querySelector('[data-catalog-format]')?.value || '';
        const saved = savedCatalogIds(kind);
        list.querySelectorAll('[data-catalog-card]').forEach((card) => {
          const wrongPeriod = card.dataset.eventPeriod && list.dataset.eventPeriod && card.dataset.eventPeriod !== list.dataset.eventPeriod;
          card.hidden = Boolean(wrongPeriod || (query && !card.dataset.catalogSearch.includes(query)) || (level && card.dataset.catalogLevel !== level) || (format && card.dataset.catalogFormat !== format) || (savedOnly && !saved.has(card.dataset.catalogId)));
        });
      };
      toolbar.querySelector('[data-catalog-search]').oninput = apply;
      toolbar.querySelectorAll('select').forEach((select) => { select.onchange = apply; });
      toolbar.querySelector('[data-catalog-saved]').onclick = (event) => { savedOnly = !savedOnly; event.currentTarget.classList.toggle('active', savedOnly); apply(); };
      list.querySelectorAll('[data-save-catalog]').forEach((button) => {
        button.onclick = (event) => {
          event.preventDefault(); event.stopPropagation();
          const saved = savedCatalogIds(kind), id = button.dataset.saveCatalog;
          if (saved.has(id)) saved.delete(id); else saved.add(id);
          localStorage.setItem(savedCatalogKey(kind), JSON.stringify([...saved]));
          button.classList.toggle('active', saved.has(id)); button.textContent = saved.has(id) ? '♥' : '♡';
          apply();
        };
      });
    }

    async function openEventDetail(id) {
      const item = state.events.find((entry) => entry.id === id);
      if (!item) return;
      $('#eventOverlayTitle').textContent = item.title;
      const body = $('#eventOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      $('#eventOverlay').classList.add('open');
      let organizer = null;
      let myStatus = null;
      let going = 0;
      let participants = [];
      let views = 0;
      try {
        const [{ data: org }, { count }, { data: mine }, { data: rsvps }, viewResult] = await Promise.all([
          item.organizer_id ? supa.from('profiles').select('full_name').eq('id', item.organizer_id).maybeSingle() : Promise.resolve({ data: null }),
          supa.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('event_id', id).eq('status', 'going'),
          supa.from('event_rsvps').select('status').eq('event_id', id).eq('user_id', ctx.user.id).maybeSingle(),
          item.organizer_id === ctx.user.id ? supa.from('event_rsvps').select('user_id,status').eq('event_id', id).eq('status', 'going') : Promise.resolve({ data: [] }),
          supa.rpc('track_event_view', { target_event_id: id })
        ]);
        organizer = org;
        going = count || 0;
        myStatus = mine && mine.status;
        views = Number(viewResult && viewResult.data) || 0;
        if (rsvps && rsvps.length) {
          const ids = rsvps.map((entry) => entry.user_id);
          const { data: profiles } = await supa.from('profiles').select('id,full_name').in('id', ids);
          participants = rsvps.map((entry) => ({ ...entry, name: (profiles || []).find((profile) => profile.id === entry.user_id)?.full_name || tr('Student', 'Ученик') }));
        }
      } catch (error) {
        /* counts optional */
      }
      const attending = myStatus === 'going';
      const isOwner = !!(item.organizer_id && ctx.user && item.organizer_id === ctx.user.id);
      const capacity = Number(item.max_participants) || 0;
      const capacityText = capacity ? going + ' / ' + capacity : String(going);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const when = [item.event_date ? formatDate(item.event_date) : '', item.event_time ? item.event_time.slice(0, 5) : '', timezone].filter(Boolean).join(' · ');
      body.innerHTML =
        (item.image ? '<img src="' + esc(item.image) + '" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:12px">' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          (when ? '<span class="tag blue">' + esc(when) + '</span>' : '') +
          '<span class="tag">' + esc(item.is_online ? tr('Online', 'Онлайн') : (item.city || tr('In person', 'Оффлайн'))) + '</span>' +
          '<span class="tag amber">' + esc(formatMoney(item)) + '</span>' +
          '<span class="tag teal">' + esc(capacityText + ' ' + tr('going', 'участников')) + '</span>' +
        '</div>' +
        (organizer && organizer.full_name ? '<p style="font-weight:800;color:var(--soft);margin:0 0 8px">' + esc(tr('By ', 'Организатор: ') + organizer.full_name) + '</p>' : '') +
        '<p style="font-weight:700;color:var(--soft);line-height:1.5">' + esc(item.description || tr('No description yet.', 'Описания пока нет.')) + '</p>' +
        (isOwner
          ? '<div class="event-owner-tools"><div class="event-owner-head"><span class="tag teal">' + esc(tr('You are the organizer', 'Вы организатор')) + '</span><span>' + esc(item.status === 'canceled' ? tr('Canceled', 'Отменено') : item.status === 'draft' ? tr('Draft', 'Черновик') : item.event_date && item.event_date < new Date().toISOString().slice(0,10) ? tr('Completed', 'Завершено') : tr('Published', 'Опубликовано')) + '</span></div><div class="event-owner-stats"><span><b>' + views + '</b>' + esc(tr('Views', 'Просмотры')) + '</span><span><b>' + going + '</b>' + esc(tr('Registrations', 'Регистрации')) + '</span><span><b>' + (capacity ? Math.round(going / capacity * 100) : 0) + '%</b>' + esc(tr('Capacity', 'Заполнение')) + '</span></div>' +
              '<div class="event-owner-actions"><button class="btn primary" data-event-live>' + esc(tr('Start LIVE', 'Начать эфир')) + '</button><button class="btn" data-event-edit>' + esc(tr('Edit', 'Редактировать')) + '</button><button class="btn" data-event-copy>' + esc(tr('Copy link', 'Копировать ссылку')) + '</button><button class="btn" data-event-calendar>' + esc(tr('Add to calendar', 'В календарь')) + '</button><button class="btn" data-event-message>' + esc(tr('Message participants', 'Написать участникам')) + '</button><button class="btn" data-event-cancel>' + esc(tr('Cancel event', 'Отменить событие')) + '</button><button class="btn danger" data-event-delete>' + esc(tr('Delete', 'Удалить')) + '</button></div>' +
              '<div class="event-edit-form" data-event-edit-form hidden><div class="pv-field-grid"><div class="pv-field"><label>' + esc(tr('Title', 'Название')) + '</label><input data-ee-title value="' + esc(item.title || '') + '"></div><div class="pv-field"><label>' + esc(tr('Capacity', 'Количество мест')) + '</label><input data-ee-capacity type="number" min="0" value="' + esc(item.max_participants || '') + '"></div></div><div class="pv-field-grid"><div class="pv-field"><label>' + esc(tr('Date', 'Дата')) + '</label><input data-ee-date type="date" value="' + esc(item.event_date || '') + '"></div><div class="pv-field"><label>' + esc(tr('Time', 'Время')) + '</label><input data-ee-time type="time" value="' + esc((item.event_time || '').slice(0,5)) + '"></div></div><button class="btn primary" data-event-save>' + esc(tr('Save changes', 'Сохранить')) + '</button></div>' +
              '<div class="event-participants"><h3>' + esc(tr('Participants', 'Участники')) + ' (' + going + ')</h3>' + (participants.length ? participants.map((person) => '<div><span class="sch-avatar">' + esc(person.name.charAt(0).toUpperCase()) + '</span><b>' + esc(person.name) + '</b></div>').join('') : '<p>' + esc(tr('No registrations yet.', 'Регистраций пока нет.')) + '</p>') + '</div></div>'
          : '<div style="margin-top:16px"><button class="btn ' + (attending ? '' : 'primary') + '" data-rsvp="' + esc(id) + '">' + esc(attending ? tr('Cancel RSVP', 'Отменить участие') : tr('RSVP — I will attend', 'Пойду')) + '</button></div>');
      if (isOwner) bindEventOwnerActions(item);
    }

    function eventShareUrl(item) {
      return location.origin + location.pathname + '?event=' + encodeURIComponent(item.id) + '#events';
    }

    function bindEventOwnerActions(item) {
      const body = $('#eventOverlayBody');
      const edit = body.querySelector('[data-event-edit]'), form = body.querySelector('[data-event-edit-form]');
      if (edit && form) edit.onclick = () => { form.hidden = !form.hidden; };
      body.querySelector('[data-event-copy]').onclick = async () => {
        await navigator.clipboard.writeText(eventShareUrl(item));
        alert(tr('Event link copied.', 'Ссылка на событие скопирована.'));
      };
      body.querySelector('[data-event-live]').onclick = () => {
        location.href = 'live.html?app=business&mode=host&t=' + encodeURIComponent(item.title || 'Duvela LIVE');
      };
      body.querySelector('[data-event-calendar]').onclick = () => downloadEventCalendar(item);
      body.querySelector('[data-event-cancel]').onclick = async () => {
        if (!window.confirm(tr('Cancel this event and notify participants?', 'Отменить событие и уведомить участников?'))) return;
        const result = await supa.from('events').update({ status:'canceled' }).eq('id',item.id).eq('organizer_id',ctx.user.id);
        if (result.error) { alert(result.error.message); return; }
        item.status='canceled'; openEventDetail(item.id);
      };
      body.querySelector('[data-event-message]').onclick = async () => {
        const message = window.prompt(tr('Message for all participants', 'Сообщение всем участникам'));
        if (!message) return;
        const result = await supa.rpc('notify_event_participants', { target_event_id: item.id, message_body: message });
        alert(result.error ? result.error.message : tr('Message sent.', 'Сообщение отправлено.'));
      };
      body.querySelector('[data-event-save]').onclick = async () => {
        const date = body.querySelector('[data-ee-date]').value, time = body.querySelector('[data-ee-time]').value;
        if (date && date < new Date().toISOString().slice(0,10) && !window.confirm(tr('This date is in the past. Save anyway?', 'Эта дата уже прошла. Всё равно сохранить?'))) return;
        if (date && time) {
          const conflict = await supa.from('events').select('id,title').eq('organizer_id', ctx.user.id).eq('event_date', date).eq('event_time', time).neq('id', item.id).limit(1);
          if ((conflict.data || []).length && !window.confirm(tr('Another event starts at the same time. Save anyway?', 'Другое событие начинается в это же время. Всё равно сохранить?'))) return;
        }
        const payload = { title: body.querySelector('[data-ee-title]').value.trim(), event_date: date || null, event_time: time || null, max_participants: Number(body.querySelector('[data-ee-capacity]').value) || null };
        if (!payload.title) return;
        const result = await supa.from('events').update(payload).eq('id', item.id).eq('organizer_id', ctx.user.id);
        if (result.error) { alert(result.error.message); return; }
        Object.assign(item, payload); openEventDetail(item.id); void ctx.loadPublicData?.();
      };
      body.querySelector('[data-event-delete]').onclick = async () => {
        if (!window.confirm(tr('Delete this event? Participants will be notified.', 'Удалить событие? Участники получат уведомление.'))) return;
        const result = await supa.from('events').delete().eq('id', item.id).eq('organizer_id', ctx.user.id);
        if (result.error) { alert(result.error.message); return; }
        $('#eventOverlay').classList.remove('open'); state.events = state.events.filter((entry) => entry.id !== item.id); renderEvents();
      };
    }

    function downloadEventCalendar(item) {
      const compact = (value) => value.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const start = new Date((item.event_date || new Date().toISOString().slice(0,10)) + 'T' + ((item.event_time || '12:00').slice(0,5)) + ':00');
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const text = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Duvela//Events//EN','BEGIN:VEVENT','UID:' + item.id + '@duvela','DTSTART:' + compact(start.toISOString()),'DTEND:' + compact(end.toISOString()),'SUMMARY:' + (item.title || 'Duvela Event'),'DESCRIPTION:' + (item.description || ''),'URL:' + eventShareUrl(item),'END:VEVENT','END:VCALENDAR'].join('\r\n');
      const url = URL.createObjectURL(new Blob([text], { type:'text/calendar;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'duvela-event.ics'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function toggleRsvp(eventId) {
      const overlayOpen = $('#eventOverlay').classList.contains('open');
      try {
        const { data: mine } = await supa.from('event_rsvps').select('status').eq('event_id', eventId).eq('user_id', ctx.user.id).maybeSingle();
        const going = mine && mine.status === 'going';
        await supa.from('event_rsvps').upsert({ event_id: eventId, user_id: ctx.user.id, status: going ? 'cancelled' : 'going', updated_at: new Date().toISOString() }, { onConflict: 'event_id,user_id' });
        if (overlayOpen) openEventDetail(eventId);
      } catch (error) {
        alert(error.message || tr('Could not update RSVP.', 'Не удалось обновить участие.'));
      }
    }

    async function openCourseDetail(courseId) {
      const course = state.courses.find((entry) => entry.id === courseId);
      if (!course) return;
      currentCourseId = courseId;
      $('#courseOverlayTitle').textContent = course.title;
      const body = $('#courseOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      $('#courseOverlay').classList.add('open');
      let meta = null;
      let lessons = [];
      let tasks = [];
      let mySubs = [];
      let allSubs = [];
      let enrollments = [];
      let zoomClass = null;
      let zoomSessions = [];
      let ownEnrollmentStatus = null;
      try {
        const [{ data: metaResult }, { data: lessonRows }, { data: taskRows }] = await Promise.all([
          supa.from('courses').select('created_by,organization_id,status,zoom_enabled,delivery_mode').eq('id', courseId).maybeSingle(),
          supa.from('course_lessons').select('id,order_index,title,description').eq('course_id', courseId).order('order_index', { ascending: true }),
          supa.from('lesson_tasks').select('id,lesson_id,order_index,title,description,max_score').eq('course_id', courseId).order('order_index', { ascending: true })
        ]);
        meta = metaResult;
        lessons = lessonRows || [];
        tasks = taskRows || [];
      } catch (error) {
        /* optional */
      }
      const owner = !!(meta && meta.created_by === ctx.user.id);
      if (meta && meta.zoom_enabled) {
        try {
          const { data: classRow } = await supa.from('classes').select('id,name').eq('course_id', courseId).maybeSingle();
          zoomClass = classRow || null;
          if (zoomClass) {
            const { data: sessionRows } = await supa.from('class_sessions')
              .select('id,title,starts_at,ends_at,status,duration_min,join_opens_at')
              .eq('class_id', zoomClass.id).order('starts_at', { ascending: true });
            zoomSessions = sessionRows || [];
          }
          if (!owner) {
            const { data: ownEnrollment } = await supa.from('course_enrollments')
              .select('status').eq('course_id', courseId).eq('user_id', ctx.user.id).maybeSingle();
            ownEnrollmentStatus = ownEnrollment && ownEnrollment.status;
          }
        } catch (error) { /* optional Zoom course data */ }
      }
      try {
        if (owner) {
          const [{ data: enrollmentRows }, { data: submissionRows }] = await Promise.all([
            supa.from('course_enrollments').select('id,user_id,status,full_name').eq('course_id', courseId).neq('status', 'cancelled'),
            supa.from('task_submissions').select('id,task_id,student_id,content,score,feedback').eq('course_id', courseId)
          ]);
          enrollments = enrollmentRows || [];
          allSubs = submissionRows || [];
        } else {
          const { data: ownSubs } = await supa.from('task_submissions').select('id,task_id,content,score,feedback').eq('course_id', courseId).eq('student_id', ctx.user.id);
          mySubs = ownSubs || [];
        }
      } catch (error) {
        /* optional */
      }
      const tasksByLesson = new Map();
      tasks.forEach((task) => {
        const items = tasksByLesson.get(task.lesson_id) || [];
        items.push(task);
        tasksByLesson.set(task.lesson_id, items);
      });
      const mySubByTask = new Map(mySubs.map((submission) => [submission.task_id, submission]));
      const subsByTask = new Map();
      allSubs.forEach((submission) => {
        const items = subsByTask.get(submission.task_id) || [];
        items.push(submission);
        subsByTask.set(submission.task_id, items);
      });
      const enrolled = state.enrolledIds.has(courseId);

      function taskHtml(task) {
        const head = '<b style="font-size:13px">' + esc(task.title || tr('Task', 'Задание')) + '</b>' + (task.description ? '<p>' + esc(task.description) + '</p>' : '');
        if (owner) {
          const subs = subsByTask.get(task.id) || [];
          return '<div class="lesson-item" style="grid-template-columns:1fr"><div>' + head +
            '<p style="color:var(--purple);font-weight:800">' + subs.length + ' ' + esc(tr('submissions', 'сдач')) + '</p>' +
            subs.map((submission) => '<div style="border-top:1px solid var(--line);padding:6px 0;font-size:12.5px"><b>' + esc((enrollments.find((entry) => entry.user_id === submission.student_id) || {}).full_name || tr('Student', 'Студент')) + '</b>: ' + esc((submission.content || '').slice(0, 200)) + (submission.score != null ? ' <span class="tag teal">' + submission.score + '/' + (task.max_score || 100) + '</span>' : ' <button class="btn" data-grade="' + esc(submission.id) + '" data-max="' + (task.max_score || 100) + '" style="min-height:28px;padding:4px 8px">' + esc(tr('Grade', 'Оценить')) + '</button>') + '</div>').join('') +
            '</div></div>';
        }
        const sub = mySubByTask.get(task.id);
        if (sub) {
          return '<div class="lesson-item" style="grid-template-columns:1fr"><div>' + head +
            (sub.score != null
              ? '<p style="color:var(--teal);font-weight:800">' + esc(tr('Score: ', 'Оценка: ')) + sub.score + '/' + (task.max_score || 100) + (sub.feedback ? ' — ' + esc(sub.feedback) : '') + '</p>'
              : '<p style="color:var(--amber);font-weight:800">' + esc(tr('Submitted — awaiting grade', 'Сдано — ждёт оценки')) + '</p>') +
            '</div></div>';
        }
        return '<div class="lesson-item" style="grid-template-columns:1fr"><div>' + head +
          '<textarea id="ta-' + esc(task.id) + '" placeholder="' + esc(tr('Your answer', 'Ваш ответ')) + '" style="width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-soft);min-height:60px;margin:6px 0"></textarea>' +
          '<button class="btn primary" data-submit-task="' + esc(task.id) + '" data-lesson="' + esc(task.lesson_id) + '" style="min-height:32px">' + esc(tr('Submit', 'Сдать')) + '</button>' +
          '</div></div>';
      }

      const totalTasks = tasks.length;
      const doneTasks = tasks.filter((task) => mySubByTask.has(task.id)).length;
      const pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;
      let html =
        '<div class="cd-cover"' + (course.image ? ' style="background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.45)),url(' + esc(course.image) + ')"' : '') + '>' +
          '<span class="cd-cover-title">' + esc(course.title || tr('Course', 'Курс')) + '</span>' +
        '</div>' +
        '<div class="pv-chips" style="margin:12px 0">' +
          (course.level ? '<span class="pv-chip">' + esc(course.level) + '</span>' : '') +
          '<span class="pv-chip teal">' + esc(formatMoney(course)) + '</span>' +
          (course.schedule ? '<span class="pv-chip">' + esc(course.schedule) + '</span>' : '') +
          (course.language ? '<span class="pv-chip">' + esc(course.language) + '</span>' : '') +
        '</div>' +
        '<p class="cd-desc">' + esc(course.description || tr('No description yet.', 'Описания пока нет.')) + '</p>';
      if (!owner && totalTasks) {
        html += '<div class="prog-row" style="margin-top:14px"><div class="prog-label"><span>' + esc(tr('Course progress', 'Прогресс курса')) + '</span><span>' + pct + '%</span></div><div class="prog-bar"><i style="width:' + pct + '%"></i></div></div>';
      }
      if (zoomClass) {
        const now = Date.now();
        const upcoming = zoomSessions.filter((session) => session.status !== 'cancelled' && session.status !== 'ended' && Date.parse(session.ends_at || session.starts_at) + 21600000 > now);
        const next = upcoming[0];
        const confirmed = owner || ownEnrollmentStatus === 'confirmed';
        const opensAt = next ? Date.parse(next.join_opens_at || next.starts_at) - (next.join_opens_at ? 0 : 1800000) : 0;
        const canJoin = !!(next && confirmed && (owner || now >= opensAt) && next.status !== 'cancelled');
        const nextLabel = next ? new Date(next.starts_at).toLocaleString(ctx.isRu ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }) : tr('No upcoming lessons', 'Ближайших уроков нет');
        html += '<section class="cd-zoom-classroom"><div class="cd-zoom-icon">▦</div><div class="cd-zoom-main"><small>ZOOM CLASSROOM</small><h3>' + esc(zoomClass.name || course.title) + '</h3><p>' + esc(nextLabel) + (next ? ' · ' + (next.duration_min || 60) + ' ' + esc(tr('min', 'мин')) : '') + '</p>' +
          (!confirmed && !owner ? '<div class="cd-zoom-warning">' + esc(tr('The teacher must confirm your enrollment before entry.', 'Для входа преподаватель должен подтвердить вашу запись.')) + '</div>' : '') +
          (next && confirmed && !canJoin ? '<div class="cd-zoom-warning">' + esc(tr('The entry button opens 30 minutes before the lesson.', 'Кнопка входа откроется за 30 минут до урока.')) + '</div>' : '') +
          '</div>' + (next ? '<a class="btn primary' + (canJoin ? '' : ' disabled') + '" ' + (canJoin ? 'href="./classroom.html?s=' + esc(next.id) + '"' : 'aria-disabled="true"') + '>' + esc(owner ? tr('Open classroom', 'Открыть класс') : tr('Enter lesson', 'Войти в урок')) + '</a>' : '') + '</section>';
        if (zoomSessions.length) {
          html += '<div class="cd-sec">' + esc(tr('Class calendar', 'Расписание группы')) + '</div><div class="cd-session-list">' +
            zoomSessions.map((session) => '<div class="cd-session-row"><span class="n">▦</span><div><b>' + esc(session.title || course.title) + '</b><p>' + esc(new Date(session.starts_at).toLocaleString(ctx.isRu ? 'ru-RU' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })) + '</p></div><span class="tag ' + (session.status === 'cancelled' ? '' : 'teal') + '">' + esc(session.status) + '</span></div>').join('') +
          '</div>';
        }
      }
      html += '<div class="cd-sec">' + esc(tr('Lessons', 'Уроки')) + '</div>';
      if (owner) {
        html += '<div class="card" style="padding:10px;margin-bottom:10px;display:flex;gap:8px"><input id="newLessonTitle" placeholder="' + esc(tr('New lesson title', 'Название урока')) + '" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-soft)"><button class="btn primary" data-add-lesson="1">' + esc(tr('Add', 'Добавить')) + '</button></div>';
      }
      html += lessons.length ? lessons.map((lesson, index) =>
        '<div class="lesson-item"><div class="n">' + (lesson.order_index != null ? lesson.order_index : index + 1) + '</div><div style="min-width:0"><b>' + esc(lesson.title || tr('Lesson', 'Урок')) + '</b>' + (lesson.description ? '<p>' + esc(lesson.description) + '</p>' : '') + '</div></div>' +
        (tasksByLesson.get(lesson.id) || []).map(taskHtml).join('') +
        (owner ? '<div class="card" style="padding:8px;margin:0 0 12px;display:flex;gap:6px;flex-wrap:wrap"><input id="nt-' + esc(lesson.id) + '" placeholder="' + esc(tr('New task/homework', 'Новое задание')) + '" style="flex:1;min-width:140px;border:1px solid var(--line);border-radius:8px;padding:7px;background:var(--panel-soft)"><input id="ntm-' + esc(lesson.id) + '" type="number" min="1" value="100" title="max" style="width:70px;border:1px solid var(--line);border-radius:8px;padding:7px;background:var(--panel-soft)"><button class="btn" data-add-task="' + esc(lesson.id) + '">' + esc(tr('Add task', 'Задание')) + '</button></div>' : '')
      ).join('') : '<div class="empty">' + esc(tr('No lessons yet.', 'Уроков пока нет.')) + '</div>';
      if (owner) {
        html += '<div class="cd-sec">' + esc(tr('Enrollments', 'Записи')) + ' (' + enrollments.length + ')</div>' +
          (enrollments.length ? enrollments.map((enrollment) =>
            '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(enrollment.full_name || tr('Student', 'Студент')) + '</h3><p>' + esc(enrollment.status) + '</p></div>' + (enrollment.status === 'pending' ? '<button class="btn primary" data-confirm-enroll="' + esc(enrollment.id) + '">' + esc(tr('Confirm', 'Подтвердить')) + '</button>' : '<span class="tag teal">' + esc(tr('Confirmed', 'Подтверждён')) + '</span>') + '</div>'
          ).join('') : '<div class="empty">' + esc(tr('No enrollments yet.', 'Записей пока нет.')) + '</div>');
      } else {
        const cta = enrolled
          ? '<button class="btn" data-unenroll="' + esc(courseId) + '">' + esc(tr('Cancel enrollment', 'Отменить запись')) + '</button>'
          : '<button class="btn primary" data-enroll="' + esc(courseId) + '">' + esc(tr('Enroll', 'Записаться')) + '</button>';
        const certificate = (totalTasks && doneTasks === totalTasks)
          ? ' <button class="btn primary" data-cert="' + esc(courseId) + '">' + esc(tr('Get certificate', 'Получить сертификат')) + '</button>'
          : '';
        html += '<div style="margin-top:16px">' + cta + certificate + '</div>';
      }
      body.innerHTML = html;
    }

    async function addLesson(courseId) {
      const title = ($('#newLessonTitle').value || '').trim();
      if (!title) return;
      try {
        const count = (await supa.from('course_lessons').select('id', { count: 'exact', head: true }).eq('course_id', courseId)).count || 0;
        const { error } = await supa.from('course_lessons').insert({ course_id: courseId, teacher_id: ctx.user.id, order_index: count + 1, title });
        if (error) throw error;
        openCourseDetail(courseId);
      } catch (error) {
        alert(error.message || tr('Could not add the lesson.', 'Не удалось добавить урок.'));
      }
    }

    async function addTask(lessonId) {
      const title = ($('#nt-' + lessonId).value || '').trim();
      const max = Number($('#ntm-' + lessonId).value) || 100;
      if (!title) return;
      try {
        const { error } = await supa.from('lesson_tasks').insert({ lesson_id: lessonId, course_id: currentCourseId, order_index: 0, title, task_type: 'homework', max_score: max });
        if (error) throw error;
        openCourseDetail(currentCourseId);
      } catch (error) {
        alert(error.message || tr('Could not add the task.', 'Не удалось добавить задание.'));
      }
    }

    async function submitTask(taskId, lessonId) {
      const input = $('#ta-' + taskId);
      const content = ((input && input.value) || '').trim();
      if (!content) {
        alert(tr('Write your answer first.', 'Сначала напишите ответ.'));
        return;
      }
      try {
        const { error } = await supa.from('task_submissions').insert({ task_id: taskId, lesson_id: lessonId, course_id: currentCourseId, student_id: ctx.user.id, content });
        if (error) throw error;
        openCourseDetail(currentCourseId);
      } catch (error) {
        alert(error.message || tr('Could not submit.', 'Не удалось сдать.'));
      }
    }

    async function gradeSubmission(submissionId, max) {
      const raw = prompt(tr('Score (0–', 'Оценка (0–') + max + '):');
      if (raw == null) return;
      const score = Math.max(0, Math.min(max, Number(raw) || 0));
      const feedback = prompt(tr('Feedback (optional):', 'Комментарий (необязательно):')) || null;
      try {
        const { error } = await supa.from('task_submissions').update({ score, feedback, graded_at: new Date().toISOString(), grader_id: ctx.user.id }).eq('id', submissionId);
        if (error) throw error;
        openCourseDetail(currentCourseId);
      } catch (error) {
        alert(error.message || tr('Could not save the grade.', 'Не удалось сохранить оценку.'));
      }
    }

    async function confirmEnrollment(enrollmentId) {
      try {
        const { error } = await supa.from('course_enrollments').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', enrollmentId);
        if (error) throw error;
        openCourseDetail(currentCourseId);
      } catch (error) {
        alert(error.message || tr('Could not confirm.', 'Не удалось подтвердить.'));
      }
    }

    function openCertificate(courseId) {
      const course = state.courses.find((item) => item.id === courseId) || {};
      const name = ctx.profile?.full_name || (ctx.user.email || 'Duvela learner');
      const win = window.open('', '_blank');
      if (!win) {
        alert(tr('Allow pop-ups to open the certificate.', 'Разрешите всплывающие окна для сертификата.'));
        return;
      }
      const dateStr = new Date().toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      win.document.write(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificate</title><style>' +
        'body{font-family:Georgia,serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f1fb}' +
        '.cert{width:760px;max-width:92vw;background:#fff;border:10px solid #683FDC;border-radius:14px;padding:56px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.15)}' +
        '.k{letter-spacing:4px;color:#683FDC;font-weight:bold;font-size:14px}.n{font-size:40px;margin:18px 0}.c{font-size:22px;color:#333;margin:8px 0 24px}.d{color:#666;margin-top:26px}button{margin-top:24px;padding:10px 20px;border:0;background:#683FDC;color:#fff;border-radius:8px;font-size:15px;cursor:pointer}@media print{button{display:none}}' +
        '</style></head><body><div class="cert"><div class="k">' + esc(tr('CERTIFICATE OF COMPLETION', 'СЕРТИФИКАТ О ЗАВЕРШЕНИИ')) + '</div>' +
        '<div class="n">' + esc(name) + '</div>' +
        '<div class="c">' + esc(tr('has successfully completed', 'успешно завершил(а) курс')) + '<br><b>' + esc(course.title || 'Duvela course') + '</b></div>' +
        '<div class="d">Duvela · ' + esc(dateStr) + '</div>' +
        '<button onclick="window.print()">' + esc(tr('Print / Save PDF', 'Печать / Сохранить PDF')) + '</button>' +
        '</div></body></html>'
      );
      win.document.close();
    }

    function renderHome() {
      const creator = ctx.isBusiness();
      const homeHeads = document.querySelectorAll('[data-panel="home"] .section-head');
      if (homeHeads[0]) {
        homeHeads[0].querySelector('h2').textContent = creator ? tr('Creator desk', 'Рабочий стол автора') : tr('Continue learning', 'Продолжить обучение');
        homeHeads[0].querySelector('span').textContent = creator ? tr('Today', 'Сегодня') : tr('Next steps', 'Следующие шаги');
      }
      if (homeHeads[1]) homeHeads[1].querySelector('h2').textContent = creator ? tr('Live rooms', 'Live-комнаты') : tr('Live now', 'Сейчас в эфире');
      if (creator) {
        ctx.setMetric(0, tr('Active live', 'Активные эфиры'), String(state.live.length), tr('Public live rooms available from the web.', 'Публичные live-комнаты доступны из веба.'));
        ctx.setMetric(1, tr('Course catalog', 'Каталог курсов'), String(state.courses.length), tr('Programs loaded for your web workspace.', 'Программы загружены в ваш веб-кабинет.'));
        ctx.setMetric(2, tr('Creator tools', 'Инструменты автора'), tr('Ready', 'Готово'), tr('Draft, publish and manage activity.', 'Создавайте, публикуйте и управляйте активностью.'));
        $('#homeList').innerHTML = [
          ctx.row({ title: tr('Start teacher LIVE', 'Запустить teacher LIVE'), meta: tr('Open camera, microphone and publish from the browser.', 'Откройте камеру, микрофон и начните эфир из браузера.'), level: tr('Live', 'Эфир') }, '<a class="btn primary" href="' + ctx.teacherLiveUrl() + '">' + esc(tr('Start', 'Старт')) + '</a>'),
          ctx.row({ title: tr('Build a course offer', 'Собрать курс'), meta: tr('Review course list and prepare the next program.', 'Проверьте список курсов и подготовьте следующую программу.'), level: tr('Course', 'Курс') }, '<a class="btn" href="#courses" data-go="courses">' + esc(tr('Manage', 'Управлять')) + '</a>'),
          ctx.row({ title: tr('Publish an event', 'Опубликовать событие'), meta: tr('Create a workshop or community meetup plan.', 'Создайте план воркшопа или community meetup.'), level: tr('Event', 'Событие') }, '<a class="btn" href="#events" data-go="events">' + esc(tr('Plan', 'План')) + '</a>')
        ].join('');
      } else {
        const xp = ctx.profile?.score ?? 0;
        const coins = ctx.profile?.vela_coin_balance ?? 0;
        const speaking = ctx.profile?.speaking_progress ?? 0;
        ctx.setMetric(0, tr('Current level', 'Текущий уровень'), ctx.profile?.language_level || '—', ctx.profile?.goal_level ? (tr('Goal: ', 'Цель: ') + ctx.profile.goal_level) : tr('Feed tuned for your progress.', 'Лента настроена под ваш прогресс.'));
        ctx.setMetric(1, tr('Total XP', 'Всего XP'), xp.toLocaleString(), tr('Earned from practice and lessons.', 'Заработано на практике и уроках.'));
        ctx.setMetric(2, tr('Duvela Coins', 'Монеты Duvela'), coins.toLocaleString(), tr('Spend on rewards and unlocks.', 'Тратьте на награды и разблокировки.'));
        const myCourse = state.myCourses[0];
        const liveForLearner = (state.live || []).filter((item) => !item.is_private);
        $('#homeList').innerHTML = learnerHubHeroV2(myCourse, liveForLearner) + [
          myCourse
            ? ctx.row({ title: myCourse.title, meta: myCourse.status === 'confirmed' ? tr('Enrolled • confirmed', 'Записан • подтверждено') : tr('Enrollment pending', 'Запись ожидает подтверждения'), level: myCourse.level || '' }, '<a class="btn primary" href="#courses" data-go="courses">' + esc(tr('Open', 'Открыть')) + '</a>')
            : ctx.row({ title: tr('Find your first course', 'Найдите свой первый курс'), meta: tr('Browse structured programs from teachers', 'Посмотрите структурированные программы от преподавателей'), level: tr('New', 'Новый') }, '<a class="btn primary" href="#courses" data-go="courses">' + esc(tr('Browse', 'Смотреть')) + '</a>'),
          ctx.row({ title: tr('Daily speaking practice', 'Ежедневная speaking practice'), meta: tr('Speaking progress: ', 'Прогресс speaking: ') + speaking + '%', level: tr('Practice', 'Практика') }, '<a class="btn" href="#workspace" data-go="workspace">' + esc(tr('Open', 'Открыть')) + '</a>'),
          ctx.row({ title: tr('Message a teacher', 'Написать преподавателю'), meta: tr('Ask a question or book a lesson', 'Задайте вопрос или договоритесь об уроке'), level: tr('Chat', 'Чат') }, '<a class="btn" href="#messages" data-go="messages">' + esc(tr('Open', 'Открыть')) + '</a>')
        ].join('');
      }
      $('#homeLive').innerHTML = state.live.slice(0, 3).map((item) =>
        ctx.row({ title: item.teacher_name || tr('Teacher live', 'Эфир преподавателя'), meta: item.title || tr('Live lesson', 'Live-урок'), level: tr('Live', 'Эфир') }, '<a class="btn primary" href="' + (creator ? ctx.teacherLiveUrl(item) : ctx.liveUrl(item)) + '">' + esc(creator ? tr('Enter', 'Войти') : tr('Watch', 'Смотреть')) + '</a>')
      ).join('');
      $('#liveCount').textContent = ctx.staticSessionCount(state.live.length);
    }

    function renderLive() {
      const creator = ctx.isBusiness();
      const head = document.querySelector('[data-panel="live"] .section-head');
      if (head) {
        head.querySelector('h2').textContent = creator ? tr('Live Studio', 'Live Studio') : tr('Live lessons', 'Live-уроки');
        head.querySelector('span').textContent = creator ? tr('Public rooms and active sessions', 'Публичные комнаты и активные эфиры') : tr('Watch in browser', 'Смотрите в браузере');
      }
      $('#liveHostPanel').innerHTML = creator ? (
        '<div class="card live-host-card">' +
        '<div><h3>' + esc(tr('Start teacher LIVE', 'Запустить teacher LIVE')) + '</h3><p>' + esc(tr('Create a live room, open camera and microphone, and publish as host.', 'Создайте live-комнату, откройте камеру и микрофон и выйдите в эфир как host.')) + '</p></div>' +
        '<a class="btn primary" href="' + ctx.teacherLiveUrl() + '">' + esc(tr('Start LIVE', 'Запустить LIVE')) + '</a>' +
        '</div>'
      ) : '';
      $('#liveList').innerHTML = state.live.map((item) =>
        ctx.row({ title: item.teacher_name || tr('Teacher live', 'Эфир преподавателя'), meta: item.title || tr('Live lesson', 'Live-урок'), level: item.status || tr('live', 'live') }, '<a class="btn primary" href="' + (creator ? ctx.teacherLiveUrl(item) : ctx.liveUrl(item)) + '">' + esc(creator ? tr('Enter', 'Войти') : tr('Watch', 'Смотреть')) + '</a>')
      ).join('') || '<div class="card empty">' + esc(tr('No public live sessions right now.', 'Сейчас нет публичных эфиров.')) + '</div>';
    }

    function courseAction(item) {
      const price = '<span class="tag teal">' + esc(formatMoney(item)) + '</span>';
      if (ctx.isBusiness() || !item.id) return price;
      if (state.enrolledIds.has(item.id)) {
        return price + '<button class="btn" data-unenroll="' + esc(item.id) + '" style="margin-left:8px">' + esc(tr('Enrolled ✓', 'Записан ✓')) + '</button>';
      }
      return price + '<button class="btn primary" data-enroll="' + esc(item.id) + '" style="margin-left:8px">' + esc(tr('Enroll', 'Записаться')) + '</button>';
    }

    function renderCourses() {
      const head = document.querySelector('[data-panel="courses"] .section-head');
      if (head) {
        head.querySelector('h2').textContent = ctx.isBusiness() ? tr('Courses & offers', 'Курсы и офферы') : tr('Courses', 'Курсы');
        head.querySelector('span').textContent = ctx.isBusiness() ? tr('Web catalog', 'Веб-каталог') : tr('Structured programs', 'Структурированные программы');
      }
      const courseList = $('#courseList');
      const courseLevels = [...new Set(state.courses.map((item) => item.level).filter(Boolean))];
      const courseSaved = savedCatalogIds('courses');
      courseList.innerHTML = catalogToolbar('courses', courseLevels, false) + state.courses.map((item) =>
        '<article class="card catalog-card course-catalog-card" data-catalog-card data-catalog-id="' + esc(item.id || '') + '" data-catalog-search="' + esc([item.title,item.description,item.level].filter(Boolean).join(' ').toLowerCase()) + '" data-catalog-level="' + esc(item.level || '') + '"' + (item.id ? ' data-course="' + esc(item.id) + '"' : '') + ' tabindex="0">' +
          '<div class="catalog-cover">' +
            (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<div class="catalog-cover-fallback"><span>DUVELA</span><b>' + esc((item.title || 'C').charAt(0)) + '</b></div>') +
            '<div class="catalog-cover-shade"></div><span class="catalog-type">' + esc(tr('Course', 'Курс')) + '</span>' +
            (item.level ? '<span class="catalog-level">' + esc(item.level) + '</span>' : '') + (item.id ? '<button class="catalog-save ' + (courseSaved.has(String(item.id)) ? 'active' : '') + '" data-save-catalog="' + esc(item.id) + '" aria-label="' + esc(tr('Save course', 'Сохранить курс')) + '">' + (courseSaved.has(String(item.id)) ? '♥' : '♡') + '</button>' : '') +
          '</div><div class="catalog-body">' +
            '<span class="catalog-eyebrow">' + esc(tr('Structured learning', 'Структурированное обучение')) + '</span><h3>' + esc(item.title) + '</h3>' +
            '<p class="catalog-description">' + esc(item.description || tr('A practical course from Duvela teachers with clear lessons and steady progress.', 'Практический курс от преподавателей Duvela с понятными уроками и заметным прогрессом.')) + '</p>' +
            '<div class="catalog-facts"><span><b>▤</b>' + esc(item.schedule || tr('Flexible schedule', 'Гибкое расписание')) + '</span><span><b>◎</b>' + esc(item.level ? tr('Level ', 'Уровень ') + item.level : tr('All levels', 'Все уровни')) + '</span></div>' +
            '<div class="catalog-footer"><div class="catalog-price"><small>' + esc(tr('Course price', 'Стоимость курса')) + '</small><strong>' + esc(formatMoney(item)) + '</strong></div><div class="catalog-actions">' + courseAction(item) + '</div></div>' +
          '</div></article>'
      ).join('') + (!state.courses.length ? '<div class="card empty">' + esc(tr('No courses available yet.', 'Курсов пока нет.')) + '</div>' : '');
      bindCatalogTools('courses', courseList);
    }

    function renderEvents() {
      const head = document.querySelector('[data-panel="events"] .section-head');
      if (head) {
        head.querySelector('h2').textContent = ctx.isBusiness() ? tr('Events & workshops', 'События и воркшопы') : tr('Events', 'События');
        head.querySelector('span').textContent = ctx.isBusiness() ? tr('Calendar and tickets', 'Календарь и билеты') : tr('Online and offline', 'Онлайн и офлайн');
      }
      const today = new Date().toISOString().slice(0,10);
      const eventList = $('#eventList');
      const eventLevels = [...new Set(state.events.map((item) => item.level).filter(Boolean))];
      const eventSaved = savedCatalogIds('events');
      eventList.innerHTML = catalogToolbar('events', eventLevels, true) + '<div class="event-catalog-tabs"><button class="active" data-event-filter="upcoming">' + esc(tr('Upcoming', 'Предстоящие')) + '</button><button data-event-filter="past">' + esc(tr('Past', 'Прошедшие')) + '</button><button data-event-filter="draft">' + esc(tr('Drafts', 'Черновики')) + '</button><button data-event-filter="canceled">' + esc(tr('Canceled', 'Отменённые')) + '</button></div>' + state.events.map((item) =>
        '<article class="card catalog-card event-catalog-card" data-catalog-card data-catalog-id="' + esc(item.id || '') + '" data-catalog-search="' + esc([item.title,item.description,item.language,item.city].filter(Boolean).join(' ').toLowerCase()) + '" data-catalog-level="' + esc(item.level || '') + '" data-catalog-format="' + (item.is_online ? 'online' : 'offline') + '" data-event-period="' + (item.status === 'draft' ? 'draft' : item.status === 'canceled' ? 'canceled' : item.event_date && item.event_date < today ? 'past' : 'upcoming') + '"' + (item.id ? ' data-event="' + esc(item.id) + '"' : '') + ' tabindex="0">' +
          '<div class="catalog-cover">' +
            (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<div class="catalog-cover-fallback event"><span>DUVELA EVENT</span><b>' + esc((item.title || 'E').charAt(0)) + '</b></div>') +
            '<div class="catalog-cover-shade"></div><span class="catalog-type ' + (item.is_online ? 'live' : '') + '">' + esc(item.is_online ? tr('Online', 'Онлайн') : tr('In person', 'Очно')) + '</span>' +
            (item.language ? '<span class="catalog-level">' + esc(item.language) + '</span>' : '') + (item.id ? '<button class="catalog-save ' + (eventSaved.has(String(item.id)) ? 'active' : '') + '" data-save-catalog="' + esc(item.id) + '" aria-label="' + esc(tr('Save event', 'Сохранить событие')) + '">' + (eventSaved.has(String(item.id)) ? '♥' : '♡') + '</button>' : '') +
          '</div><div class="catalog-body">' +
            '<span class="catalog-eyebrow">' + esc(tr('Duvela event', 'Событие Duvela')) + '</span><h3>' + esc(item.title) + '</h3>' +
            '<p class="catalog-description">' + esc(item.description || tr('Meet, learn and practise together with the Duvela community.', 'Встречайтесь, учитесь и практикуйтесь вместе с сообществом Duvela.')) + '</p>' +
            '<div class="catalog-facts"><span><b>□</b>' + esc(item.event_date ? formatDate(item.event_date) + (item.event_time ? ' · ' + item.event_time.slice(0,5) : '') : tr('Date coming soon', 'Дата скоро')) + '</span><span><b>⌖</b>' + esc(item.is_online ? tr('Join from anywhere', 'Подключение из любой точки') : [item.city, item.country].filter(Boolean).join(', ') || tr('Location coming soon', 'Место скоро')) + '</span>' +
              (item.max_participants ? '<span><b>◎</b>' + esc(tr('Up to ', 'До ') + item.max_participants + tr(' participants', ' участников')) + '</span>' : '') + '</div>' +
            '<div class="catalog-footer"><div class="catalog-price"><small>' + esc(tr('Ticket', 'Билет')) + '</small><strong>' + esc(formatMoney(item)) + '</strong></div><button class="btn primary catalog-open" type="button">' + esc(tr('View event', 'Подробнее')) + '</button></div>' +
          '</div></article>'
      ).join('');
      const applyEventFilter = (period) => {
        eventList.dataset.eventPeriod = period;
        eventList.querySelectorAll('[data-event-period]').forEach((card) => { card.hidden = card.dataset.eventPeriod !== period; });
        eventList.querySelectorAll('[data-event-filter]').forEach((button) => button.classList.toggle('active', button.dataset.eventFilter === period));
        eventList.querySelector('[data-catalog-search]')?.dispatchEvent(new Event('input'));
      };
      eventList.querySelectorAll('[data-event-filter]').forEach((button) => { button.onclick = () => applyEventFilter(button.dataset.eventFilter); });
      applyEventFilter('upcoming');
      bindCatalogTools('events', eventList);
    }

    async function loadEnrollments() {
      if (ctx.isBusiness()) return;
      try {
        const { data } = await supa.from('course_enrollments')
          .select('course_id,status,courses(id,title,level,cover_image_url)')
          .eq('user_id', ctx.user.id).neq('status', 'cancelled');
        state.enrolledIds = new Set((data || []).map((row) => row.course_id));
        state.myCourses = (data || []).map((row) => ({
          id: row.course_id,
          status: row.status,
          title: (row.courses && row.courses.title) || tr('Course', 'Курс'),
          level: (row.courses && row.courses.level) || ''
        }));
      } catch (error) {
        console.warn('enrollments load failed', error);
      }
    }

    async function enrollCourse(courseId) {
      try {
        const { error } = await supa.from('course_enrollments').upsert({
          course_id: courseId,
          user_id: ctx.user.id,
          status: 'pending',
          full_name: ctx.profile?.full_name || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'course_id,user_id' });
        if (error) throw error;
        state.enrolledIds.add(courseId);
        void supa.functions.invoke('notify-course-enrollment', { body: { courseId, learnerName: ctx.profile?.full_name || undefined } }).catch(() => {});
        await loadEnrollments();
        $('#courseOverlay').classList.remove('open');
        renderCourses();
        renderHome();
        ctx.renderWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not enroll.', 'Не удалось записаться.'));
      }
    }

    async function unenrollCourse(courseId) {
      try {
        await supa.from('course_enrollments').update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('course_id', courseId).eq('user_id', ctx.user.id);
        state.enrolledIds.delete(courseId);
        await loadEnrollments();
        $('#courseOverlay').classList.remove('open');
        renderCourses();
        renderHome();
        ctx.renderWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not update enrollment.', 'Не удалось обновить запись.'));
      }
    }

    function visibleLiveSessionsV2() {
      return (state.live || []).filter((item) => ctx.isBusiness() || !item.is_private);
    }

    function upcomingLiveSessionsV2() {
      return (state.liveScheduled || []).filter((item) => ctx.isBusiness() || !item.is_private);
    }

    function archivedLiveSessionsV2() {
      return ctx.isBusiness() ? (state.liveHistory || []) : [];
    }

    function ownLiveSessionV2() {
      if (!ctx.user?.id) return null;
      return (state.live || []).find((item) => item.teacher_id === ctx.user.id) || null;
    }

    function studioMetricV2(label, value) {
      return '<div class="live-studio-metric"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
    }

    function studioStepV2(title, copy) {
      return '<div class="live-studio-step"><b>' + esc(title) + '</b><span>' + esc(copy) + '</span></div>';
    }

    function liveDateV2(value) {
      if (!value) return '';
      return formatDate(value.slice(0, 10));
    }

    function liveTimeV2(value) {
      if (!value) return '';
      return value.slice(11, 16);
    }

    function liveTimingV2(item) {
      if (!item) return '';
      if (item.status === 'scheduled' && item.started_at) {
        return [tr('Starts', 'Старт'), liveDateV2(item.started_at), liveTimeV2(item.started_at)].filter(Boolean).join(' • ');
      }
      if (item.status === 'ended' && item.ended_at) {
        return [tr('Ended', 'Завершен'), liveDateV2(item.ended_at), liveTimeV2(item.ended_at)].filter(Boolean).join(' • ');
      }
      if (item.started_at) {
        return [tr('Started', 'Стартовал'), liveDateV2(item.started_at), liveTimeV2(item.started_at)].filter(Boolean).join(' • ');
      }
      return '';
    }

    function liveRowLevelV2(item, creator) {
      if (item.status === 'scheduled') return tr('Scheduled', 'Запланировано');
      if (item.status === 'ended') return tr('History', 'История');
      if (item.is_private && creator) return tr('Private', 'Приватный');
      return tr('Live', 'Эфир');
    }

    function liveRowActionV2(item, creator) {
      if (creator) {
        if (item.status === 'scheduled') return tr('Prepare', 'Подготовить');
        if (item.status === 'ended') return tr('Reuse', 'Повторить');
        return tr('Enter', 'Войти');
      }
      if (item.status === 'scheduled') return tr('Open', 'Открыть');
      return tr('Watch', 'Смотреть');
    }

    function liveRowMetaV2(item) {
      return [item.title || tr('Live lesson', 'Live-урок'), liveTimingV2(item)].filter(Boolean).join(' • ');
    }

    function hubQuickCardV2(icon, title, copy, href, primary) {
      return '<a class="card hub-quick-card" href="' + esc(href) + '" data-go="' + esc(href.replace('#', '')) + '">' +
        '<div class="hub-quick-icon">' + esc(icon) + '</div>' +
        '<div><b>' + esc(title) + '</b><span>' + esc(copy) + '</span></div>' +
        '<span class="tag ' + (primary ? 'teal' : 'blue') + '">' + esc(primary ? tr('Start', 'Start') : tr('Open', 'Open')) + '</span>' +
      '</a>';
    }

    function learnerHubHeroV2(myCourse, liveItems) {
      const level = ctx.profile?.language_level || 'Level';
      const goal = ctx.profile?.goal_level || tr('Choose a goal in profile', 'Goal');
      const title = myCourse ? tr('Continue your course', 'Continue your course') : tr('Build today around one clear action', 'Build today around one clear action');
      const copy = myCourse
        ? (myCourse.status === 'confirmed'
            ? tr('Your enrollment is confirmed. Open the course and keep momentum.', 'Your enrollment is confirmed. Open the course and keep momentum.')
            : tr('Your enrollment is waiting for confirmation. Practice while the teacher reviews it.', 'Your enrollment is waiting for confirmation. Practice while the teacher reviews it.'))
        : tr('Pick a course, run a short practice, or join the next live room.', 'Pick a course, run a short practice, or join the next live room.');
      return '<div class="card hub-hero" style="margin-bottom:12px">' +
        '<div class="hub-hero-top">' +
          '<div><h2>' + esc(title) + '</h2><p>' + esc(copy) + '</p></div>' +
          '<div class="hub-pill-row">' +
            '<span class="tag teal">' + esc(tr('Level: ', 'Level: ') + level) + '</span>' +
            '<span class="tag blue">' + esc(tr('Goal: ', 'Goal: ') + goal) + '</span>' +
            '<span class="tag amber">' + esc(liveItems.length ? tr('Live available', 'Live available') : tr('Self-study ready', 'Self-study ready')) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="hub-quick-grid">' +
          hubQuickCardV2('01', myCourse ? tr('Open course', 'Open course') : tr('Find a course', 'Find a course'), myCourse ? (myCourse.title || tr('Your active course', 'Your active course')) : tr('Structured teacher programs', 'Structured teacher programs'), '#courses', true) +
          hubQuickCardV2('02', tr('Practice now', 'Practice now'), tr('Flashcards, speaking, grammar and exam drills', 'Flashcards, speaking, grammar and exam drills'), '#workspace', false) +
          hubQuickCardV2('03', liveItems.length ? tr('Join LIVE', 'Join LIVE') : tr('Check schedule', 'Check schedule'), liveItems.length ? tr('Watch an active lesson in browser', 'Watch an active lesson in browser') : tr('Book a lesson or watch upcoming rooms', 'Book a lesson or watch upcoming rooms'), liveItems.length ? '#live' : '#schedule', false) +
        '</div>' +
      '</div>';
    }

    function emptyLiveBlockV2(copy) {
      return '<div class="card empty">' + esc(copy) + '</div>';
    }

    function learnerLiveEmptyStateV2() {
      return '<div class="card live-empty-state">' +
        '<div class="live-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="14" height="14" rx="3"></rect><path d="m17 10 4-2v8l-4-2"></path><path d="M8 12h4"></path></svg></div>' +
        '<div class="live-empty-copy"><h3>' + esc(tr('Nothing is live right now', 'Сейчас нет активных эфиров')) + '</h3>' +
        '<p>' + esc(tr('Explore a course or check the schedule — new public lessons will appear here automatically.', 'Выберите курс или откройте расписание — новые публичные уроки появятся здесь автоматически.')) + '</p></div>' +
        '<div class="live-empty-actions"><a class="btn primary" href="#courses" data-go="courses">' + esc(tr('Explore courses', 'Найти курс')) + '</a>' +
        '<a class="btn" href="#schedule" data-go="schedule">' + esc(tr('Open schedule', 'Открыть расписание')) + '</a></div>' +
        '</div>';
    }

    function renderLiveRowsV2(target, items, creator, emptyCopy) {
      const node = document.getElementById(target);
      if (!node) return;
      node.innerHTML = items.length
        ? items.map((item) =>
            '<article class="card live-catalog-card ' + (item.status === 'live' ? 'is-live' : '') + '">' +
              '<div class="live-catalog-visual"><div class="live-orbit"></div><span class="live-camera">●</span><span class="live-status">' + esc(liveRowLevelV2(item, creator)) + '</span></div>' +
              '<div class="live-catalog-body"><div><span class="catalog-eyebrow">' + esc(item.language || tr('Live lesson', 'Live-урок')) + (item.level ? ' · ' + esc(item.level) : '') + '</span><h3>' + esc(item.title || tr('Live lesson', 'Live-урок')) + '</h3><p>' + esc(tr('with ', 'с преподавателем ') + (item.teacher_name || tr('Duvela teacher', 'Duvela'))) + '</p></div>' +
                '<div class="live-catalog-meta"><span><b>◉</b>' + esc(item.status === 'live' ? tr('Streaming now', 'Сейчас в эфире') : liveTimingV2(item) || tr('Session details', 'Детали сессии')) + '</span><span><b>♙</b>' + esc(item.is_private ? tr('Private room', 'Приватная комната') : tr('Public room', 'Публичный эфир')) + '</span></div>' +
                '<a class="btn ' + (item.status === 'live' ? 'primary' : '') + '" href="' + (creator ? ctx.teacherLiveUrl(item) : ctx.liveUrl(item)) + '">' + esc(liveRowActionV2(item, creator)) + '</a>' +
              '</div></article>'
          ).join('')
        : emptyLiveBlockV2(emptyCopy);
    }

    function learnerHomeV3(liveItems, scheduledItems) {
      const host=document.getElementById('genericHome');if(!host)return;
      const favorites=new Set(JSON.parse(localStorage.getItem('duvela.learner.eventFavorites')||'[]'));
      const video=state.videos[0]||{},events=(state.events||[]).slice(0,8),courses=(state.courses||[]).slice(0,4),live=(liveItems||[]).slice(0,4),challenges=(state.challenges||[]).slice(0,4);
      const booking=(state.myBookings||[])[0],course=state.myCourses[0];
      const xp=Number(ctx.profile?.score)||0,goal=Number(ctx.profile?.weekly_minutes_goal)||50,skill=Math.round(((Number(ctx.profile?.grammar_progress)||0)+(Number(ctx.profile?.speaking_progress)||0)+(Number(ctx.profile?.vocabulary_progress)||0))/3);
      const videoProgress=Math.max(0,Math.min(100,Number(localStorage.getItem('duvela.video.progress.'+(video.id||'first')))||0));
      const dateKind=item=>{if(!item.event_date)return'upcoming';const date=new Date(item.event_date+'T12:00:00'),today=new Date(),same=date.toDateString()===today.toDateString(),weekend=[0,6].includes(date.getDay());return same?'today':weekend?'weekend':'upcoming';};
      const eventCard=item=>'<article class="lh-event" data-home-event data-home-kind="events" data-date-kind="'+dateKind(item)+'" data-language="'+esc(String(item.language||''))+'" data-level="'+esc(String(item.level||''))+'" data-format="'+(item.is_online?'online':'offline')+'" data-home-card="'+esc([item.title,item.city,item.language,item.level,item.description].filter(Boolean).join(' ').toLowerCase())+'">'+
        '<div class="lh-event-cover"'+(item.id?' data-event="'+esc(item.id)+'"':'')+'>'+(item.image?'<img src="'+esc(item.image)+'" alt="">':'<span>DUVELA</span>')+'<b>'+esc(item.is_online?tr('Online','Онлайн'):tr('Offline','Офлайн'))+'</b><button class="lh-save '+(favorites.has(item.id)?'active':'')+'" data-save-event="'+esc(item.id||item.title)+'" aria-label="Save">♡</button></div>'+
        '<div class="lh-event-body"><h3>'+esc(item.title||tr('Language meetup','Языковая встреча'))+'</h3><p>'+esc([item.language,item.level].filter(Boolean).join(' · ')||item.description||tr('Community practice','Практика сообщества'))+'</p><div class="lh-event-meta"><span>⌖ '+esc(item.city||tr('Duvela community','Сообщество Duvela'))+'</span><span>□ '+esc(item.event_date?formatDate(item.event_date):item.meta||tr('Upcoming','Скоро'))+'</span></div><div class="lh-event-foot"><span data-event-going="'+esc(item.id||'')+'">◉ 0 '+esc(tr('going','участников'))+'</span>'+(item.id?'<button data-home-rsvp="'+esc(item.id)+'">'+esc(tr('Join','Участвовать'))+'</button>':'')+'</div></div></article>';
      const challengeCard=item=>{const goals=[['daily_min_dialogs',tr('dialogs','диалогов')],['daily_min_words',tr('words','слов')],['daily_min_writing',tr('writing tasks','письменных заданий')],['daily_min_listening_min',tr('listening min','мин. аудирования')],['daily_min_live_min',tr('LIVE min','мин. LIVE')]].filter(goal=>Number(item[goal[0]])>0);const joined=state.myChallengeIds&&state.myChallengeIds.has(String(item.id));return '<article class="card lh-challenge-card" data-home-kind="challenges" data-home-level="'+esc(item.target_level||'')+'" data-open-challenge="'+esc(item.id||'')+'" data-home-card="'+esc([item.title,item.target_level,item.exam_type].filter(Boolean).join(' ').toLowerCase())+'"><div class="lh-challenge-cover">'+(item.cover_url?'<img src="'+esc(item.cover_url)+'" alt="">':'<div class="lh-challenge-art"><span>DUVELA</span><b>♕</b></div>')+'<span class="lh-challenge-status">'+esc(joined?tr('Joined','Участвую'):tr('Challenge','Челлендж'))+'</span><span class="lh-challenge-level">'+esc(item.target_level||tr('Any level','Любой уровень'))+'</span></div><div class="lh-challenge-body"><span class="catalog-eyebrow">'+esc(item.exam_type||tr('Daily language practice','Ежедневная языковая практика'))+'</span><h3>'+esc(item.title||tr('Duvela challenge','Челлендж Duvela'))+'</h3><p>'+esc(tr('Build a daily streak, complete the goals and reach the finish with other learners.','Сохраняйте ежедневную серию, выполняйте цели и дойдите до финиша вместе с другими учениками.'))+'</p><div class="lh-challenge-dates"><span><b>□</b>'+esc(item.started_at?formatDate(item.started_at):tr('Start today','Начните сегодня'))+'</span><span><b>⚑</b>'+esc(item.ends_at?formatDate(item.ends_at):tr('Open finish','Без срока'))+'</span></div><div class="lh-challenge-goals">'+(goals.length?goals.slice(0,3).map(goal=>'<span>'+esc(item[goal[0]]+' '+goal[1])+'</span>').join(''):'<span>'+esc(tr('Daily activity','Ежедневная активность'))+'</span>')+'</div><div class="lh-challenge-foot"><span><small>'+esc(tr('Completion reward','Награда за финиш'))+'</small><strong>XP + 🏅</strong></span><button type="button">'+esc(joined?tr('Continue','Продолжить'):tr('View challenge','Подробнее'))+'</button></div></div></article>';};
      const mini=(item,kind)=>'<a class="lh-mini" href="#'+(kind==='challenges'?'home':kind)+'" '+(kind==='challenges'?'data-open-challenge="'+esc(item.id||'')+'"':'data-go="'+kind+'"')+' data-home-kind="'+kind+'" data-home-card="'+esc([item.title,item.description,item.teacher_name,item.level].filter(Boolean).join(' ').toLowerCase())+'"><span class="lh-mini-icon">'+(kind==='courses'?'▣':kind==='challenges'?'♕':'◉')+'</span><span><b>'+esc(item.title||item.teacher_name||tr('Duvela challenge','Челлендж Duvela'))+'</b><small>'+esc(item.level||item.description||item.target_level||tr('Open details','Открыть подробнее'))+'</small></span></a>';
      host.innerHTML='<div class="learner-home">'+
        '<div class="lh-search-row"><label class="lh-search">⌕<input id="learnerHomeSearch" placeholder="'+esc(tr('Search events, courses and LIVE…','Поиск событий, курсов и LIVE…'))+'"></label><button class="lh-filter" id="learnerFilterBtn">☷</button></div><div class="lh-filter-panel" id="learnerFilterPanel" hidden><select id="lhLanguage"><option value="">'+esc(tr('Any language','Любой язык'))+'</option><option>German</option><option>English</option><option>Spanish</option><option>Russian</option></select><select id="lhLevel"><option value="">'+esc(tr('Any level','Любой уровень'))+'</option>'+['A1','A2','B1','B2','C1','C2'].map(x=>'<option>'+x+'</option>').join('')+'</select><select id="lhFormat"><option value="">'+esc(tr('Any format','Любой формат'))+'</option><option value="online">Online</option><option value="offline">Offline</option></select></div>'+
        '<nav class="lh-primary-tabs"><button class="active" data-home-kind-filter="events">▦ '+esc(tr('Events','События'))+'</button><button data-home-kind-filter="courses">▣ '+esc(tr('Courses','Курсы'))+'</button><button data-home-kind-filter="live">◉ LIVE</button><button data-home-kind-filter="challenges">♕ '+esc(tr('Challenges','Челленджи'))+'</button></nav><div class="lh-filter-tabs">'+[['all',tr('All','Все')],['upcoming',tr('Upcoming','Предстоящие')],['today',tr('Today','Сегодня')],['weekend',tr('Weekend','Выходные')]].map((x,i)=>'<button data-home-filter="'+x[0]+'" class="'+(i?'':'active')+'">'+esc(x[1])+'</button>').join('')+'</div>'+
        '<div class="lh-stats"><div><b>'+xp.toLocaleString()+'</b><span>XP</span></div><div><b>'+skill+'%</b><span>'+esc(tr('Skills','Навыки'))+'</span></div><div><b>'+goal+'</b><span>'+esc(tr('Daily goal','Цель дня'))+'</span></div></div>'+
        (booking?'<section class="lh-next"><span>□</span><div><small>'+esc(tr('Next booked lesson','Ближайший урок'))+'</small><b>'+esc(booking.teacher_name)+'</b><p>'+esc(formatDate(booking.slot_date)+' · '+String(booking.slot_time||'').slice(0,5))+'</p></div><a href="#schedule" data-go="schedule">'+esc(tr('Open','Открыть'))+'</a></section>':'')+
        (live.length?'<section class="lh-live-strip"><div><small>● LIVE</small><b>'+esc(live[0].teacher_name||tr('Teacher is live','Преподаватель в эфире'))+'</b></div><a href="'+esc(ctx.liveUrl(live[0]))+'">'+esc(tr('Watch','Смотреть'))+'</a></section>':'')+
        '<section class="lh-section"><div class="lh-heading"><h2>▶ '+esc(tr('Continue watching','Продолжить просмотр'))+'</h2><a href="#videos" data-go="videos">'+esc(tr('All media','Все медиа'))+'</a></div><article class="lh-continue"'+(video.id?' data-video="'+esc(video.id)+'"':'')+' data-home-card="'+esc([video.title,video.meta].filter(Boolean).join(' ').toLowerCase())+'"><div class="lh-video-thumb">'+(video.image?'<img src="'+esc(video.image)+'" alt="">':'')+'<span>▶</span><i style="width:'+videoProgress+'%"></i></div><div><h3>'+esc(video.title||tr('Choose your first video','Выберите первое видео'))+'</h3><p>'+esc(video.meta||tr('Lessons from Duvela teachers','Уроки преподавателей Duvela'))+'</p><small>'+videoProgress+'% '+esc(tr('watched','просмотрено'))+'</small></div></article></section>'+
        '<div class="lh-levels"><b>✦ '+esc(tr('Your level','Ваш уровень'))+': '+esc(ctx.profile?.language_level||'A1')+'</b><span>'+esc(tr('Recommended for your language and level','Рекомендации по языку и уровню'))+'</span></div>'+
        (course?'<section class="lh-course-progress"><div><small>'+esc(tr('Current course','Текущий курс'))+'</small><b>'+esc(course.title)+'</b></div><strong>'+skill+'%</strong><i><span style="width:'+skill+'%"></span></i><a href="#courses" data-go="courses">'+esc(tr('Continue','Продолжить'))+'</a></section>':'')+
        '<section class="lh-section"><div class="lh-heading"><h2 id="lhCategoryTitle">'+esc(tr('Recommended events','Рекомендованные события'))+'</h2></div><div class="lh-event-grid">'+(events.length?events.map(eventCard).join(''):'<div class="lh-empty" data-home-kind="events" data-home-card="">'+esc(tr('New events will appear here.','Новые события появятся здесь.'))+'</div>')+'</div><div class="lh-mini-grid">'+courses.map(x=>mini(x,'courses')).concat(live.map(x=>mini(x,'live'))).join('')+challenges.map(challengeCard).join('')+'</div></section><div class="lh-no-results" id="learnerHomeEmpty" hidden>'+esc(tr('Nothing matched your filters.','По фильтрам ничего не найдено.'))+'</div>'+
        '<nav class="lh-mobile-nav"><a class="active" href="#home" data-go="home">⌂<span>'+esc(tr('Home','Главная'))+'</span></a><a href="#videos" data-go="videos">▶<span>'+esc(tr('Media','Медиа'))+'</span></a><a href="#workspace" data-go="workspace">✦<span>'+esc(tr('Practice','Практика'))+'</span></a><a href="#messages" data-go="messages">▣<span>'+esc(tr('Inbox','Сообщения'))+'</span></a><a href="#profile" data-go="profile">♙<span>'+esc(tr('Profile','Профиль'))+'</span></a></nav></div>';
      let dateFilter='all',kindFilter='events';const titles={events:tr('Recommended events','Рекомендованные события'),courses:tr('Recommended courses','Рекомендованные курсы'),live:tr('LIVE lessons','LIVE-уроки'),challenges:tr('Learning challenges','Учебные челленджи')};const apply=()=>{const q=(host.querySelector('#learnerHomeSearch').value||'').trim().toLowerCase(),lang=host.querySelector('#lhLanguage').value.toLowerCase(),level=host.querySelector('#lhLevel').value,format=host.querySelector('#lhFormat').value;let visible=0;host.querySelectorAll('[data-home-card]').forEach(card=>{let show=(!card.dataset.homeKind||card.dataset.homeKind===kindFilter)&&(!q||card.dataset.homeCard.includes(q));if(card.matches('[data-home-event]'))show=show&&(dateFilter==='all'||card.dataset.dateKind===dateFilter)&&(!lang||card.dataset.language.toLowerCase()===lang)&&(!level||card.dataset.level===level)&&(!format||card.dataset.format===format);else if(card.dataset.homeLevel)show=show&&(!level||card.dataset.homeLevel===level);card.hidden=!show;if(show&&card.dataset.homeKind)visible++;});host.querySelector('#lhCategoryTitle').textContent=titles[kindFilter];host.querySelector('.lh-filter-tabs').hidden=kindFilter!=='events';host.querySelector('#learnerHomeEmpty').hidden=Boolean(visible);};
      host.querySelector('#learnerHomeSearch').oninput=apply;host.querySelectorAll('#learnerFilterPanel select').forEach(x=>x.onchange=apply);host.querySelector('#learnerFilterBtn').onclick=()=>{const panel=host.querySelector('#learnerFilterPanel');panel.hidden=!panel.hidden;};host.querySelectorAll('[data-home-filter]').forEach(btn=>btn.onclick=()=>{dateFilter=btn.dataset.homeFilter;host.querySelectorAll('[data-home-filter]').forEach(x=>x.classList.toggle('active',x===btn));apply();});
      host.querySelectorAll('[data-home-kind-filter]').forEach(btn=>btn.onclick=()=>{kindFilter=btn.dataset.homeKindFilter;host.querySelectorAll('[data-home-kind-filter]').forEach(x=>x.classList.toggle('active',x===btn));apply();});
      host.querySelectorAll('[data-open-challenge]').forEach(card=>card.onclick=e=>{e.preventDefault();ctx.openChallenge(card.dataset.openChallenge);});
      host.querySelectorAll('[data-save-event]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();const id=btn.dataset.saveEvent;if(favorites.has(id))favorites.delete(id);else favorites.add(id);localStorage.setItem('duvela.learner.eventFavorites',JSON.stringify([...favorites]));btn.classList.toggle('active',favorites.has(id));});
      host.querySelectorAll('[data-home-rsvp]').forEach(btn=>btn.onclick=async e=>{e.preventDefault();e.stopPropagation();btn.disabled=true;await toggleRsvp(btn.dataset.homeRsvp);btn.textContent=tr('Joined ✓','Участвуете ✓');btn.disabled=false;void hydrateEventCounts();});
      async function hydrateEventCounts(){const ids=events.map(x=>x.id).filter(Boolean);if(!ids.length)return;try{const {data}=await supa.from('event_rsvps').select('event_id,user_id').in('event_id',ids).eq('status','going');ids.forEach(id=>{const count=(data||[]).filter(x=>x.event_id===id).length,node=host.querySelector('[data-event-going="'+CSS.escape(id)+'"]');if(node)node.textContent='◉ '+count+' '+tr('going','участников');});}catch(_){} }void hydrateEventCounts();
      apply();
    }

    function renderHomeV2() {
      const creator = ctx.isBusiness();
      const busDash = document.getElementById('busDashboard');
      const genericHome = document.getElementById('genericHome');
      // Business/creator mode gets the rich dashboard; learners keep the simple home.
      if (creator && ctx.busDashboard) {
        if (busDash) busDash.hidden = false;
        if (genericHome) genericHome.hidden = true;
        ctx.busDashboard.render();
        return;
      }
      if (busDash) busDash.hidden = true;
      if (genericHome) genericHome.hidden = false;
      const liveItems = visibleLiveSessionsV2();
      const scheduledItems = upcomingLiveSessionsV2();
      const historyItems = archivedLiveSessionsV2();
      if (!creator) {
        learnerHomeV3(liveItems.filter((item) => !item.is_private), scheduledItems.filter((item) => !item.is_private));
        return;
      }
      const homeFeed = (liveItems.length ? liveItems : scheduledItems).slice(0, 3);
      const homeHeads = document.querySelectorAll('[data-panel="home"] .section-head');
      if (homeHeads[0]) {
        homeHeads[0].querySelector('h2').textContent = creator ? tr('Creator desk', 'Рабочий стол автора') : tr('Continue learning', 'Продолжить обучение');
        homeHeads[0].querySelector('span').textContent = creator ? tr('Today', 'Сегодня') : tr('Next steps', 'Следующие шаги');
      }
      if (homeHeads[1]) homeHeads[1].querySelector('h2').textContent = creator ? tr('Live pipeline', 'Поток Live') : tr('Live now', 'Сейчас в эфире');
      if (creator) {
        ctx.setMetric(0, tr('Active live', 'Активные эфиры'), String(liveItems.length), tr('Rooms currently open in the browser.', 'Комнаты, которые уже открыты в браузере.'));
        ctx.setMetric(1, tr('Scheduled', 'Запланировано'), String(scheduledItems.length), tr('Upcoming sessions that still need host action.', 'Ближайшие сессии, которым еще нужен запуск хоста.'));
        ctx.setMetric(2, tr('Recent sessions', 'Недавние сессии'), String(historyItems.length), tr('Finished rooms you can reopen and reuse.', 'Завершенные комнаты, которые можно открыть и использовать снова.'));
        $('#homeList').innerHTML = [
          ctx.row(
            {
              title: tr('Open Live Studio', 'Открыть Live Studio'),
              meta: tr('Start now, resume a room, or check room diagnostics from the browser.', 'Запустите эфир, вернитесь в комнату или проверьте диагностику прямо из браузера.'),
              level: tr('Studio', 'Студия')
            },
            '<a class="btn primary" href="' + ctx.teacherLiveUrl(ownLiveSessionV2() || scheduledItems[0]) + '">' + esc(tr('Open', 'Открыть')) + '</a>'
          ),
          ctx.row(
            {
              title: tr('Schedule the next session', 'Запланировать следующую сессию'),
              meta: scheduledItems[0]
                ? tr('Nearest slot: ', 'Ближайший слот: ') + liveTimingV2(scheduledItems[0])
                : tr('Set the next room time before publishing.', 'Задайте время следующей комнаты до публикации.'),
              level: tr('Planning', 'План')
            },
            '<a class="btn" href="' + ctx.teacherLiveUrl(scheduledItems[0]) + '">' + esc(scheduledItems[0] ? tr('Manage', 'Управлять') : tr('Plan', 'План')) + '</a>'
          ),
          ctx.row(
            {
              title: tr('Review session archive', 'Проверить архив сессий'),
              meta: historyItems[0]
                ? tr('Last room: ', 'Последняя комната: ') + liveTimingV2(historyItems[0])
                : tr('Ended sessions stay ready for replay and follow-up.', 'Завершенные эфиры остаются под рукой для повторного запуска и follow-up.'),
              level: tr('History', 'История')
            },
            '<a class="btn" href="#live" data-go="live">' + esc(tr('Open list', 'Открыть список')) + '</a>'
          )
        ].join('');
      } else {
        const xp = ctx.profile?.score ?? 0;
        const coins = ctx.profile?.vela_coin_balance ?? 0;
        const speaking = ctx.profile?.speaking_progress ?? 0;
        const myCourse = state.myCourses[0];
        const liveForLearner = liveItems.filter((item) => !item.is_private);
        ctx.setMetric(0, tr('Current level', 'Текущий уровень'), ctx.profile?.language_level || '—', ctx.profile?.goal_level ? (tr('Goal: ', 'Цель: ') + ctx.profile.goal_level) : tr('Feed tuned for your progress.', 'Лента настроена под ваш прогресс.'));
        ctx.setMetric(1, tr('Total XP', 'Всего XP'), xp.toLocaleString(), tr('Earned from practice and lessons.', 'Заработано на практике и уроках.'));
        ctx.setMetric(2, tr('Duvela Coins', 'Монеты Duvela'), coins.toLocaleString(), tr('Spend on rewards and unlocks.', 'Тратьте на награды и разблокировки.'));
        $('#homeList').innerHTML = learnerHubHeroV2(myCourse, liveForLearner) + [
          myCourse
            ? ctx.row({ title: myCourse.title, meta: myCourse.status === 'confirmed' ? tr('Enrolled • confirmed', 'Записан • подтверждено') : tr('Enrollment pending', 'Запись ожидает подтверждения'), level: myCourse.level || '' }, '<a class="btn primary" href="#courses" data-go="courses">' + esc(tr('Open', 'Открыть')) + '</a>')
            : ctx.row({ title: tr('Find your first course', 'Найдите свой первый курс'), meta: tr('Browse structured programs from teachers', 'Посмотрите структурированные программы от преподавателей'), level: tr('New', 'Новый') }, '<a class="btn primary" href="#courses" data-go="courses">' + esc(tr('Browse', 'Смотреть')) + '</a>'),
          ctx.row({ title: tr('Daily speaking practice', 'Ежедневная speaking practice'), meta: tr('Speaking progress: ', 'Прогресс speaking: ') + speaking + '%', level: tr('Practice', 'Практика') }, '<a class="btn" href="#workspace" data-go="workspace">' + esc(tr('Open', 'Открыть')) + '</a>'),
          ctx.row({ title: tr('Message a teacher', 'Написать преподавателю'), meta: tr('Ask a question or book a lesson', 'Задайте вопрос или договоритесь об уроке'), level: tr('Chat', 'Чат') }, '<a class="btn" href="#messages" data-go="messages">' + esc(tr('Open', 'Открыть')) + '</a>')
        ].join('');
      }
      $('#homeLive').innerHTML = homeFeed.length
        ? homeFeed.map((item) =>
            ctx.row(
              {
                title: item.teacher_name || tr('Teacher live', 'Эфир преподавателя'),
                meta: liveRowMetaV2(item),
                level: liveRowLevelV2(item, creator)
              },
              '<a class="btn ' + (item.status === 'live' ? 'primary' : '') + '" href="' + (creator ? ctx.teacherLiveUrl(item) : ctx.liveUrl(item)) + '">' + esc(liveRowActionV2(item, creator)) + '</a>'
            )
          ).join('')
        : emptyLiveBlockV2(creator ? tr('No live or scheduled rooms yet.', 'Пока нет ни активных, ни запланированных комнат.') : tr('No public live sessions right now.', 'Сейчас нет публичных эфиров.'));
      $('#liveCount').textContent = liveItems.length
        ? ctx.staticSessionCount(liveItems.length)
        : (scheduledItems.length
            ? String(scheduledItems.length) + ' ' + tr('scheduled', 'запланировано')
            : ctx.staticSessionCount(0));
    }

    function renderLiveV2() {
      const creator = ctx.isBusiness();
      const liveItems = visibleLiveSessionsV2();
      const scheduledItems = upcomingLiveSessionsV2();
      const historyItems = archivedLiveSessionsV2();
      const mine = creator ? ownLiveSessionV2() : null;
      const feedItems = creator && mine ? liveItems.filter((item) => item.id !== mine.id) : liveItems;
      const head = document.querySelector('[data-panel="live"] .section-head');
      if (head) {
        head.querySelector('h2').textContent = creator ? tr('Live Studio', 'Live Studio') : tr('Live lessons', 'Live-уроки');
        head.querySelector('span').textContent = creator
          ? tr('Run live, keep the next room scheduled, and reuse recent sessions.', 'Запускайте эфир, держите расписание под рукой и переиспользуйте недавние комнаты.')
          : tr('Watch in browser and track upcoming public sessions.', 'Смотрите в браузере и следите за ближайшими публичными сессиями.');
      }

      $('#liveActiveTitle').textContent = creator ? tr('Active rooms', 'Активные комнаты') : tr('Live now', 'Сейчас в эфире');
      $('#liveActiveMeta').textContent = liveItems.length
        ? ctx.staticSessionCount(liveItems.length)
        : (creator ? tr('No active rooms', 'Нет активных комнат') : tr('No public rooms now', 'Сейчас нет публичных комнат'));
      $('#liveScheduledTitle').textContent = creator ? tr('Scheduled queue', 'Очередь запуска') : tr('Upcoming sessions', 'Ближайшие сессии');
      $('#liveScheduledMeta').textContent = scheduledItems.length
        ? String(scheduledItems.length) + ' ' + tr('upcoming', 'впереди')
        : (creator ? tr('No upcoming sessions', 'Нет ближайших сессий') : tr('Nothing scheduled', 'Ничего не запланировано'));
      $('#liveHistoryTitle').textContent = creator ? tr('Recent sessions', 'Недавние сессии') : tr('Host archive', 'Архив хоста');
      $('#liveHistoryMeta').textContent = creator
        ? (historyItems.length ? String(historyItems.length) + ' ' + tr('recent', 'недавних') : tr('No recent sessions', 'Нет недавних сессий'))
        : tr('Available in teacher mode', 'Доступно в режиме преподавателя');
      const historyBlock = document.querySelector('[data-panel="live"] #liveHistoryList')?.closest('.live-panel-block');
      if (historyBlock) historyBlock.style.display = creator ? '' : 'none';

      $('#liveHostPanel').innerHTML = creator ? (
        '<div class="live-studio-grid">' +
          '<div class="card live-studio-card">' +
            '<div><h3>' + esc(tr('Browser studio', 'Браузерная студия')) + '</h3><p>' + esc(tr('Run one operational view for launch, schedule, diagnostics and watch-link handoff.', 'Держите в одной точке запуск, расписание, диагностику и передачу ссылки на просмотр.')) + '</p></div>' +
            '<div class="live-studio-metrics">' +
              studioMetricV2(tr('Active', 'Активно'), String(liveItems.length)) +
              studioMetricV2(tr('Scheduled', 'Запланировано'), String(scheduledItems.length)) +
              studioMetricV2(tr('Archive', 'Архив'), String(historyItems.length)) +
            '</div>' +
            '<div class="live-studio-actions">' +
              '<a class="btn primary" href="' + ctx.teacherLiveUrl(mine || scheduledItems[0] || historyItems[0]) + '">' + esc(mine ? tr('Re-enter studio', 'Вернуться в студию') : tr('Open studio', 'Открыть студию')) + '</a>' +
              (mine && !mine.is_private ? '<a class="btn" href="' + ctx.liveUrl(mine) + '" target="_blank" rel="noopener">' + esc(tr('Open watch page', 'Открыть страницу просмотра')) + '</a>' : '') +
            '</div>' +
          '</div>' +
          '<div class="card live-studio-card">' +
            (mine
              ? '<div><h3>' + esc(tr('Your current room', 'Ваша текущая комната')) + '</h3><p>' + esc(liveRowMetaV2(mine)) + '</p></div>' +
                '<div class="live-studio-metrics">' +
                  studioMetricV2(tr('Teacher', 'Преподаватель'), mine.teacher_name || tr('Teacher', 'Преподаватель')) +
                  studioMetricV2(tr('Status', 'Статус'), liveRowLevelV2(mine, true)) +
                  studioMetricV2(tr('Access', 'Доступ'), mine.is_private ? tr('Private', 'Приватный') : tr('Public', 'Публичный')) +
                '</div>' +
                '<div class="live-studio-actions"><a class="btn" href="' + ctx.teacherLiveUrl(mine) + '">' + esc(tr('Manage room', 'Управлять комнатой')) + '</a></div>'
              : '<div><h3>' + esc(tr('Studio flow', 'Сценарий студии')) + '</h3><p>' + esc(tr('Keep the room lifecycle clean: prepare, schedule, go live, then reuse the session.', 'Держите цикл комнаты простым: подготовка, расписание, запуск и повторное использование.')) + '</p></div>' +
                '<div class="live-studio-steps">' +
                  studioStepV2(tr('1. Prepare room', '1. Подготовьте комнату'), tr('Update title, level, language and access before learners arrive.', 'Обновите название, уровень, язык и доступ до прихода учеников.')) +
                  studioStepV2(tr('2. Schedule or start', '2. Запланируйте или запустите'), tr('Use one room for immediate live start or for the next slot.', 'Используйте одну комнату либо для мгновенного старта, либо для ближайшего слота.')) +
                  studioStepV2(tr('3. Reuse history', '3. Переиспользуйте историю'), tr('Ended sessions stay visible so the next launch is faster.', 'Завершенные сессии остаются под рукой, чтобы следующий запуск был быстрее.')) +
                '</div>')
          + '</div>' +
        '</div>'
      ) : (!liveItems.length && !scheduledItems.length ? learnerLiveEmptyStateV2() : '');
      renderLiveRowsV2('liveList', feedItems, creator, creator ? tr('No additional live rooms right now.', 'Сейчас нет других live-комнат.') : tr('No public live sessions right now.', 'Сейчас нет публичных эфиров.'));
      renderLiveRowsV2('liveScheduledList', scheduledItems, creator, creator ? tr('No upcoming sessions yet.', 'Пока нет ближайших сессий.') : tr('No public sessions are scheduled yet.', 'Пока нет публичных сессий в расписании.'));
      renderLiveRowsV2('liveHistoryList', historyItems, creator, creator ? tr('No ended sessions yet.', 'Пока нет завершенных сессий.') : tr('Session history is visible to hosts.', 'История сессий доступна хосту.'));
    }

    renderHome = renderHomeV2;
    renderLive = renderLiveV2;

    return {
      addLesson,
      addTask,
      confirmEnrollment,
      enrollCourse,
      gradeSubmission,
      loadEnrollments,
      openCertificate,
      openCourseDetail,
      openEventDetail,
      renderCourses,
      renderEvents,
      renderHome,
      renderLive,
      submitTask,
      toggleRsvp,
      unenrollCourse
    };
  }

  window.DuvelaAppCatalog = { create: createCatalogFeature };
})();
