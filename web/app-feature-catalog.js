(function () {
  function createCatalogFeature(ctx) {
    const { $, tr, esc, alert, supa, state, formatDate, formatMoney } = ctx;
    let currentCourseId = null;

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
      try {
        const [{ data: org }, { count }, { data: mine }] = await Promise.all([
          item.organizer_id ? supa.from('profiles').select('full_name').eq('id', item.organizer_id).maybeSingle() : Promise.resolve({ data: null }),
          supa.from('event_rsvps').select('*', { count: 'exact', head: true }).eq('event_id', id).eq('status', 'going'),
          supa.from('event_rsvps').select('status').eq('event_id', id).eq('user_id', ctx.user.id).maybeSingle()
        ]);
        organizer = org;
        going = count || 0;
        myStatus = mine && mine.status;
      } catch (error) {
        /* counts optional */
      }
      const attending = myStatus === 'going';
      const when = [item.event_date ? formatDate(item.event_date) : '', item.event_time ? item.event_time.slice(0, 5) : ''].filter(Boolean).join(' · ');
      body.innerHTML =
        (item.image ? '<img src="' + esc(item.image) + '" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:12px">' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          (when ? '<span class="tag blue">' + esc(when) + '</span>' : '') +
          '<span class="tag">' + esc(item.is_online ? tr('Online', 'Онлайн') : (item.city || tr('In person', 'Оффлайн'))) + '</span>' +
          '<span class="tag amber">' + esc(formatMoney(item)) + '</span>' +
          (going ? '<span class="tag teal">' + going + ' ' + esc(tr('going', 'идут')) + '</span>' : '') +
        '</div>' +
        (organizer && organizer.full_name ? '<p style="font-weight:800;color:var(--soft);margin:0 0 8px">' + esc(tr('By ', 'Организатор: ') + organizer.full_name) + '</p>' : '') +
        '<p style="font-weight:700;color:var(--soft);line-height:1.5">' + esc(item.description || tr('No description yet.', 'Описания пока нет.')) + '</p>' +
        '<div style="margin-top:16px"><button class="btn ' + (attending ? '' : 'primary') + '" data-rsvp="' + esc(id) + '">' + esc(attending ? tr('Cancel RSVP', 'Отменить участие') : tr('RSVP — I will attend', 'Пойду')) + '</button></div>';
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
      try {
        const [{ data: metaResult }, { data: lessonRows }, { data: taskRows }] = await Promise.all([
          supa.from('courses').select('created_by,organization_id,status').eq('id', courseId).maybeSingle(),
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
        (course.image ? '<img src="' + esc(course.image) + '" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:12px">' : '') +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
          (course.level ? '<span class="tag">' + esc(course.level) + '</span>' : '') +
          '<span class="tag teal">' + esc(formatMoney(course)) + '</span>' +
          (course.schedule ? '<span class="tag blue">' + esc(course.schedule) + '</span>' : '') +
        '</div>' +
        '<p style="font-weight:700;color:var(--soft);line-height:1.5">' + esc(course.description || tr('No description yet.', 'Описания пока нет.')) + '</p>';
      if (!owner && totalTasks) {
        html += '<div class="prog-row" style="margin-top:14px"><div class="prog-label"><span>' + esc(tr('Course progress', 'Прогресс курса')) + '</span><span>' + pct + '%</span></div><div class="prog-bar"><i style="width:' + pct + '%"></i></div></div>';
      }
      html += '<h3 style="margin:16px 0 6px;font-size:15px">' + esc(tr('Lessons', 'Уроки')) + '</h3>';
      if (owner) {
        html += '<div class="card" style="padding:10px;margin-bottom:10px;display:flex;gap:8px"><input id="newLessonTitle" placeholder="' + esc(tr('New lesson title', 'Название урока')) + '" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-soft)"><button class="btn primary" data-add-lesson="1">' + esc(tr('Add', 'Добавить')) + '</button></div>';
      }
      html += lessons.length ? lessons.map((lesson, index) =>
        '<div class="lesson-item"><div class="n">' + (lesson.order_index != null ? lesson.order_index : index + 1) + '</div><div style="min-width:0"><b>' + esc(lesson.title || tr('Lesson', 'Урок')) + '</b>' + (lesson.description ? '<p>' + esc(lesson.description) + '</p>' : '') + '</div></div>' +
        (tasksByLesson.get(lesson.id) || []).map(taskHtml).join('') +
        (owner ? '<div class="card" style="padding:8px;margin:0 0 12px;display:flex;gap:6px;flex-wrap:wrap"><input id="nt-' + esc(lesson.id) + '" placeholder="' + esc(tr('New task/homework', 'Новое задание')) + '" style="flex:1;min-width:140px;border:1px solid var(--line);border-radius:8px;padding:7px;background:var(--panel-soft)"><input id="ntm-' + esc(lesson.id) + '" type="number" min="1" value="100" title="max" style="width:70px;border:1px solid var(--line);border-radius:8px;padding:7px;background:var(--panel-soft)"><button class="btn" data-add-task="' + esc(lesson.id) + '">' + esc(tr('Add task', 'Задание')) + '</button></div>' : '')
      ).join('') : '<div class="empty">' + esc(tr('No lessons yet.', 'Уроков пока нет.')) + '</div>';
      if (owner) {
        html += '<h3 style="margin:16px 0 6px;font-size:15px">' + esc(tr('Enrollments', 'Записи')) + ' (' + enrollments.length + ')</h3>' +
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
        $('#homeList').innerHTML = [
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
      $('#courseList').innerHTML = state.courses.map((item) =>
        '<div class="card row"' + (item.id ? ' data-course="' + esc(item.id) + '"' : '') + '>' +
          '<div class="thumb">' + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : esc((item.title || 'C').charAt(0))) + '</div>' +
          '<div><h3>' + esc(item.title) + '</h3><p>' + esc(item.description || tr('Course from Duvela teachers', 'Курс от преподавателей Duvela')) + '</p></div>' +
          '<div style="display:flex;align-items:center;gap:0;white-space:nowrap">' + (item.level ? '<span class="tag" style="margin-right:8px">' + esc(item.level) + '</span>' : '') + courseAction(item) + '</div>' +
        '</div>'
      ).join('') || '<div class="card empty">' + esc(tr('No courses available yet.', 'Курсов пока нет.')) + '</div>';
    }

    function renderEvents() {
      const head = document.querySelector('[data-panel="events"] .section-head');
      if (head) {
        head.querySelector('h2').textContent = ctx.isBusiness() ? tr('Events & workshops', 'События и воркшопы') : tr('Events', 'События');
        head.querySelector('span').textContent = ctx.isBusiness() ? tr('Calendar and tickets', 'Календарь и билеты') : tr('Online and offline', 'Онлайн и офлайн');
      }
      $('#eventList').innerHTML = state.events.map((item) =>
        '<div class="card row"' + (item.id ? ' data-event="' + esc(item.id) + '"' : '') + '>' +
          '<div class="thumb">' + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : esc((item.title || 'E').charAt(0))) + '</div>' +
          '<div><h3>' + esc(item.title) + '</h3><p>' + esc(item.meta || item.description || tr('Upcoming event', 'Ближайшее событие')) + '</p></div>' +
          '<div style="display:flex;align-items:center;gap:8px;white-space:nowrap">' + (item.is_online ? '<span class="tag">' + esc(tr('Online', 'Онлайн')) + '</span>' : '') + '<span class="tag amber">' + esc(formatMoney(item)) + '</span></div>' +
        '</div>'
      ).join('') || '<div class="card empty">' + esc(tr('No upcoming events.', 'Ближайших событий пока нет.')) + '</div>';
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
            ctx.row(
              {
                title: item.teacher_name || tr('Teacher live', 'Эфир преподавателя'),
                meta: liveRowMetaV2(item),
                level: liveRowLevelV2(item, creator)
              },
              '<a class="btn ' + (item.status === 'live' ? 'primary' : '') + '" href="' + (creator ? ctx.teacherLiveUrl(item) : ctx.liveUrl(item)) + '">' + esc(liveRowActionV2(item, creator)) + '</a>'
            )
          ).join('')
        : emptyLiveBlockV2(emptyCopy);
    }

    function renderHomeV2() {
      const creator = ctx.isBusiness();
      const liveItems = visibleLiveSessionsV2();
      const scheduledItems = upcomingLiveSessionsV2();
      const historyItems = archivedLiveSessionsV2();
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
        ctx.setMetric(0, tr('Current level', 'Текущий уровень'), ctx.profile?.language_level || '—', ctx.profile?.goal_level ? (tr('Goal: ', 'Цель: ') + ctx.profile.goal_level) : tr('Feed tuned for your progress.', 'Лента настроена под ваш прогресс.'));
        ctx.setMetric(1, tr('Total XP', 'Всего XP'), xp.toLocaleString(), tr('Earned from practice and lessons.', 'Заработано на практике и уроках.'));
        ctx.setMetric(2, tr('Duvela Coins', 'Монеты Duvela'), coins.toLocaleString(), tr('Spend on rewards and unlocks.', 'Тратьте на награды и разблокировки.'));
        $('#homeList').innerHTML = [
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
