(function () {
  function createBusinessFeature(ctx) {
    const { $, $$, tr, esc, alert, supa, state, avatarInner, formatDate } = ctx;

    async function publishEvent(event) {
      event.preventDefault();
      const note = $('#evNote');
      const title = $('#evTitle').value.trim();
      if (!title) return;
      const priceRaw = $('#evPrice').value.trim();
      const isPaid = priceRaw !== '' && Number(priceRaw) > 0;
      const baseDate = $('#evDate').value || null;
      const repeat = Math.max(1, Math.min(12, Number($('#evRepeat') && $('#evRepeat').value) || 1));
      const btn = $('#eventForm button[type="submit"]');
      btn.disabled = true;
      btn.textContent = tr('Publishing...', 'Публикация...');
      try {
        let imageUrl = null;
        const fileInput = $('#evImage');
        if (fileInput && fileInput.files && fileInput.files[0]) {
          imageUrl = await ctx.uploadToBucket('events', fileInput.files[0]);
        }
        const base = {
          organizer_id: ctx.user.id,
          title,
          description: $('#evDesc').value.trim() || null,
          event_time: $('#evTime').value || null,
          city: $('#evCity').value.trim() || null,
          format: $('#evFormat').value,
          language: $('#evLang').value.trim() || null,
          is_paid: isPaid,
          price_amount: isPaid ? Number(priceRaw) : null,
          image_url: imageUrl
        };
        let rows;
        if (repeat > 1 && baseDate) {
          const groupId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
          rows = [];
          for (let i = 0; i < repeat; i++) {
            const date = new Date(baseDate + 'T00:00:00');
            date.setDate(date.getDate() + i * 7);
            rows.push({ ...base, event_date: date.toISOString().slice(0, 10), recurrence_group_id: groupId, recurrence_rule: 'weekly', recurrence_occurrence: i + 1 });
          }
        } else {
          rows = [{ ...base, event_date: baseDate }];
        }
        const { error } = await supa.from('events').insert(rows);
        if (error) throw error;
        note.style.color = 'var(--teal)';
        note.textContent = repeat > 1
          ? tr(repeat + ' events published ✓', repeat + ' событий опубликовано ✓')
          : tr('Event published ✓ Learners can see it now.', 'Событие опубликовано ✓ Ученики уже видят его.');
        note.style.display = 'block';
        $('#eventForm').reset();
        await ctx.safeQuery(
          'events',
          () => supa.from('events').select(ctx.getEventColumns()).order('event_date', { ascending: true }).limit(12),
          ctx.mapEventRow
        );
        ctx.renderEvents();
      } catch (error) {
        note.style.color = 'var(--red)';
        note.textContent = error.message || tr('Could not publish the event.', 'Не удалось опубликовать событие.');
        note.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = tr('Publish event', 'Опубликовать событие');
      }
    }

    async function loadBusinessWorkspace() {
      if (!ctx.isBusiness()) return;
      try {
        const { data: memberships } = await supa.from('organization_memberships')
          .select('organization_id,role,status,organizations(id,name,city,country,type)')
          .eq('user_id', ctx.user.id).eq('status', 'active');
        const org = (memberships || []).map((membership) => membership.organizations).find(Boolean) || null;
        state.myOrg = org;
        if (org) {
          const [{ data: courses }, { data: classes }] = await Promise.all([
            supa.from('courses').select('id,title,level,status,price,currency,created_at').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(30),
            supa.from('classes').select('id,name,level,language,starts_at,format,course_id').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(30)
          ]);
          state.orgCourses = courses || [];
          state.orgClasses = classes || [];
        } else {
          state.orgCourses = [];
          state.orgClasses = [];
        }
      } catch (error) {
        console.warn('business workspace load failed', error);
      }
      try {
        const { data: practices } = await supa.from('teacher_practices')
          .select('id,title,target,level,status,plays_count,rating_avg,rating_count')
          .eq('creator_id', ctx.user.id).order('created_at', { ascending: false }).limit(30);
        state.myPractices = practices || [];
      } catch (error) {
        console.warn('my practices load failed', error);
      }
      try {
        const { data: submissions } = await supa.from('practice_submissions').select('id,student_id,tool_id,submission_type,content_text,media_url,status,score,feedback,created_at').eq('teacher_id',ctx.user.id).order('created_at',{ascending:false}).limit(30);
        state.practiceSubmissions=submissions||[];
      } catch(error){state.practiceSubmissions=[];console.warn('practice submissions load failed',error);}
      try {
        const { data: portfolio } = await supa.from('organizer_portfolio')
          .select('id,title,description,image_url,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(20);
        state.portfolio = portfolio || [];
      } catch (error) {
        console.warn('portfolio load failed', error);
      }
      try {
        const { data: verification } = await supa.from('verification_requests')
          .select('id,status,note,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(1);
        state.verification = (verification && verification[0]) || null;
      } catch (error) {
        console.warn('verification load failed', error);
      }
      if (state.myOrg) {
        try {
          const { data: members } = await supa.from('organization_memberships')
            .select('id,user_id,role,status,profiles(full_name,avatar_url)').eq('organization_id', state.myOrg.id).eq('status', 'active');
          state.orgMembers = members || [];
        } catch (error) {
          console.warn('members load failed', error);
        }
      } else {
        state.orgMembers = [];
      }
    }

    function analyticsHtml() {
      const plays = state.myPractices.reduce((sum, practice) => sum + (practice.plays_count || 0), 0);
      const cells = [
        [tr('Courses', 'Курсы'), state.orgCourses.length],
        [tr('Classes', 'Классы'), state.orgClasses.length],
        [tr('Practices', 'Практики'), state.myPractices.length],
        [tr('Plays', 'Прохождений'), plays]
      ];
      return '<div class="grid-3" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">' +
        cells.map(([label, value]) => '<div class="card metric" style="min-height:auto;padding:12px"><span>' + esc(label) + '</span><b style="font-size:22px">' + value + '</b></div>').join('') + '</div>';
    }

    function businessAction(label, title, copy, href, tone) {
      return '<a class="business-action" href="' + esc(href) + '" data-go="' + esc(href.replace('#', '')) + '">' +
        '<span class="tag ' + (tone || '') + '">' + esc(label) + '</span>' +
        '<div><b>' + esc(title) + '</b><span>' + esc(copy) + '</span></div>' +
      '</a>';
    }

    function businessStep(title, copy, value) {
      return '<div class="business-step">' +
        '<span class="tag blue">' + esc(value) + '</span>' +
        '<b>' + esc(title) + '</b>' +
        '<p>' + esc(copy) + '</p>' +
      '</div>';
    }

    function businessDeskHtml(org) {
      const activeCourses = state.orgCourses.filter((course) => course.status === 'active').length;
      const draftCourses = state.orgCourses.filter((course) => course.status && course.status !== 'active').length;
      const publishedPractices = state.myPractices.filter((practice) => practice.status === 'published').length;
      const location = [org.city, org.country].filter(Boolean).join(', ') || tr('Business workspace', 'Бизнес-кабинет');
      return '<div class="business-desk" style="margin-bottom:14px">' +
        '<div class="business-desk-top">' +
          '<div><h2>' + esc(org.name) + '</h2><p>' + esc(location) + '</p></div>' +
          '<div class="hub-pill-row">' +
            '<span class="tag teal">' + esc(activeCourses + ' ' + tr('active courses', 'активных курсов')) + '</span>' +
            '<span class="tag blue">' + esc(state.orgClasses.length + ' ' + tr('classes', 'классов')) + '</span>' +
            '<span class="tag amber">' + esc(publishedPractices + ' ' + tr('published practices', 'опубликованных практик')) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="business-action-grid">' +
          businessAction('LIVE', tr('Open Live Studio', 'Открыть LIVE-студию'), tr('Start, schedule or reuse a browser room.', 'Запускайте, планируйте и повторно используйте браузерную комнату.'), '#live', 'teal') +
          businessAction('COURSE', tr('Create an offer', 'Создать предложение'), tr('Publish a course learners can enroll in.', 'Опубликуйте курс, на который ученики смогут записаться.'), '#workspace', 'blue') +
          businessAction('EVENT', tr('Publish workshop', 'Опубликовать воркшоп'), tr('Add online or offline events to the catalog.', 'Добавьте онлайн- или офлайн-события в каталог.'), '#events', 'amber') +
          businessAction('CHAT', tr('Follow up leads', 'Обработать лиды'), tr('Reply to learner questions and requests.', 'Отвечайте на вопросы и запросы учеников.'), '#messages', '') +
        '</div>' +
        '<div class="business-pipeline">' +
          businessStep(tr('Catalog health', 'Состояние каталога'), tr('Keep at least one active offer visible to learners.', 'Держите хотя бы одно активное предложение видимым для учеников.'), activeCourses + '/' + state.orgCourses.length) +
          businessStep(tr('Class operations', 'Управление классами'), tr('Use sessions and attendance to keep cohorts organized.', 'Используйте занятия и посещаемость, чтобы держать группы в порядке.'), String(state.orgClasses.length)) +
          businessStep(tr('Draft queue', 'Очередь черновиков'), tr('Review drafts before the next campaign push.', 'Проверьте черновики перед следующим запуском кампании.'), String(draftCourses)) +
        '</div>' +
      '</div>';
    }

    function noOrgOnboardingHtml() {
      return '<div class="business-desk" style="margin-bottom:14px">' +
        '<div class="business-desk-top">' +
          '<div><h2>' + esc(tr('Set up your business workspace', 'Настройте бизнес-кабинет')) + '</h2>' +
          '<p>' + esc(tr('Create an organization once, then publish courses, classes, practices and events from one place.', 'Создайте организацию один раз, а затем публикуйте курсы, классы, практики и события из одного места.')) + '</p></div>' +
          '<span class="tag amber">' + esc(tr('Setup required', 'Нужна настройка')) + '</span>' +
        '</div>' +
        '<div class="business-pipeline">' +
          businessStep(tr('1. Organization', '1. Организация'), tr('Add name, city and country for public trust.', 'Добавьте название, город и страну для доверия со стороны пользователей.'), tr('Now', 'Сейчас')) +
          businessStep(tr('2. First offer', '2. Первое предложение'), tr('Create one course or class learners can understand quickly.', 'Создайте один курс или класс, который ученикам будет легко понять.'), tr('Next', 'Дальше')) +
          businessStep(tr('3. Publish activity', '3. Публикация активности'), tr('Add LIVE, event or practice to make the page feel active.', 'Добавьте LIVE, событие или практику, чтобы страница выглядела живой.'), tr('Then', 'Потом')) +
        '</div>' +
      '</div>';
    }

    function membersHtml() {
      const roles = ['owner', 'admin', 'teacher', 'client'];
      return '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Members', 'Участники')) + '</h2><span>' + state.orgMembers.length + '</span></div>' +
        '<p style="color:var(--muted);font-size:12px;font-weight:700;margin:0 0 8px">' + esc(tr('Invite by email is available in the app.', 'Приглашение по email доступно в приложении.')) + '</p>' +
        (state.orgMembers.length ? state.orgMembers.map((member) => {
          const name = (member.profiles && member.profiles.full_name) || tr('Member', 'Участник');
          const isMe = member.user_id === ctx.user.id;
          return '<div class="card row" style="grid-template-columns:40px minmax(0,1fr) auto auto;gap:8px"><div class="avatar" style="width:40px;height:40px">' + avatarInner(name, member.profiles && member.profiles.avatar_url) + '</div><div style="min-width:0"><h3>' + esc(name) + (isMe ? ' (' + esc(tr('you', 'вы')) + ')' : '') + '</h3></div>' +
            '<select class="role-select" data-member-role="' + esc(member.id) + '" style="width:auto;padding:6px" ' + (isMe ? 'disabled' : '') + '>' + roles.map((role) => '<option value="' + role + '"' + (member.role === role ? ' selected' : '') + '>' + esc(role) + '</option>').join('') + '</select>' +
            (isMe ? '<span></span>' : '<button class="btn danger" data-member-remove="' + esc(member.id) + '" style="min-height:30px">✕</button>') +
          '</div>';
        }).join('') : '<div class="empty">' + esc(tr('No members yet.', 'Участников пока нет.')) + '</div>');
    }

    async function changeMemberRole(id, roleVal) {
      try {
        const { error } = await supa.from('organization_memberships').update({ role: roleVal, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        await loadBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not change the role.', 'Не удалось изменить роль.'));
      }
    }

    async function removeMember(id) {
      if (!confirm(tr('Remove this member?', 'Удалить участника?'))) return;
      try {
        const { error } = await supa.from('organization_memberships').delete().eq('id', id);
        if (error) throw error;
        await loadBusinessWorkspace();
        renderBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not remove the member.', 'Не удалось удалить участника.'));
      }
    }

    function renderBusinessWorkspace() {
      const org = state.myOrg;
      const left = $('#workspaceActions');
      $('#workspacePrimaryTitle').textContent = org ? esc(org.name) : tr('Your organization', 'Ваша организация');
      if (!org) {
        left.innerHTML =
          noOrgOnboardingHtml() +
          '<p style="font-weight:800;color:var(--soft);margin:0 0 12px">' + esc(tr('Create an organization to publish courses and classes on Duvela.', 'Создайте организацию, чтобы публиковать курсы и классы в Duvela.')) + '</p>' +
          '<form id="orgForm">' +
            '<div class="field"><label>' + esc(tr('Organization name', 'Название организации')) + '</label><input id="orgName" required maxlength="120"></div>' +
            '<div class="form-grid">' +
              '<div class="field"><label>' + esc(tr('City', 'Город')) + '</label><input id="orgCity" maxlength="80"></div>' +
              '<div class="field"><label>' + esc(tr('Country', 'Страна')) + '</label><input id="orgCountry" maxlength="80"></div>' +
            '</div>' +
            '<div class="field"><label>' + esc(tr('About', 'Описание')) + '</label><textarea id="orgDesc" maxlength="400"></textarea></div>' +
            '<button class="btn primary" type="submit" style="margin-top:10px">' + esc(tr('Create organization', 'Создать организацию')) + '</button>' +
          '</form>';
        $('#orgForm').addEventListener('submit', createOrg);
        return;
      }
      left.innerHTML =
        businessDeskHtml(org) +
        analyticsHtml() +
        '<p style="font-weight:800;color:var(--soft);margin:0 0 12px">' + esc([org.city, org.country].filter(Boolean).join(', ') || tr('Your Duvela organization', 'Ваша организация Duvela')) + '</p>' +
        '<form id="courseForm">' +
          '<div class="section-head" style="margin-bottom:8px"><h2 style="font-size:15px">' + esc(tr('New course', 'Новый курс')) + '</h2></div>' +
          '<div class="field"><label>' + esc(tr('Title', 'Название')) + '</label><input id="cTitle" required maxlength="140"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + esc(tr('Level', 'Уровень')) + '</label><input id="cLevel" placeholder="A1–C2" maxlength="10"></div>' +
            '<div class="field"><label>' + esc(tr('Language', 'Язык')) + '</label><input id="cLang" maxlength="40"></div>' +
            '<div class="field"><label>' + esc(tr('Price (blank = free)', 'Цена (пусто = бесплатно)')) + '</label><input id="cPrice" type="number" min="0" step="1"></div>' +
            '<div class="field"><label>' + esc(tr('Currency', 'Валюта')) + '</label><input id="cCurrency" value="EUR" maxlength="8"></div>' +
          '</div>' +
          '<div class="field"><label>' + esc(tr('Schedule', 'Расписание')) + '</label><input id="cSchedule" placeholder="' + esc(tr('Mon, Wed 18:00', 'Пн, Ср 18:00')) + '" maxlength="120"></div>' +
          '<div class="field"><label>' + esc(tr('Description', 'Описание')) + '</label><textarea id="cDesc" maxlength="600"></textarea></div>' +
          '<label style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;margin:4px 0"><input type="checkbox" id="cPublish" checked> ' + esc(tr('Publish now (visible to learners)', 'Опубликовать сразу (видно ученикам)')) + '</label>' +
          '<button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Create course', 'Создать курс')) + '</button>' +
        '</form>' +
        '<div style="margin:8px 0"><input id="xlsxFile" type="file" accept=".xlsx,.xls,.csv" style="display:none"><button class="btn" id="importXlsxBtn" type="button">' + esc(tr('Import courses (Excel)', 'Импорт курсов (Excel)')) + '</button><span id="xlsxNote" style="margin-left:10px;font-weight:800"></span></div>' +
        '<p style="color:var(--muted);font-size:11px;font-weight:700;margin:0 0 8px">' + esc(tr('Columns: title, level, language, price, schedule, description', 'Колонки: title, level, language, price, schedule, description')) + '</p>' +
        '<div class="section-head" style="margin:16px 0 8px"><h2 style="font-size:15px">' + esc(tr('Your courses', 'Ваши курсы')) + '</h2><span>' + state.orgCourses.length + '</span></div>' +
        (state.orgCourses.length ? state.orgCourses.map((course) =>
          '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(course.title) + '</h3><p>' + esc([course.level, course.status].filter(Boolean).join(' · ')) + '</p></div><span class="tag ' + (course.status === 'active' ? 'teal' : '') + '">' + esc(course.status === 'active' ? tr('Live', 'Активен') : (course.status || tr('Draft', 'Черновик'))) + '</span></div>'
        ).join('') : '<div class="empty">' + esc(tr('No courses yet.', 'Курсов пока нет.')) + '</div>') +
        '<form id="classForm" style="margin-top:18px">' +
          '<div class="section-head" style="margin-bottom:8px"><h2 style="font-size:15px">' + esc(tr('New class', 'Новый класс')) + '</h2></div>' +
          '<div class="field"><label>' + esc(tr('Class name', 'Название класса')) + '</label><input id="clName" required maxlength="140"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + esc(tr('Language', 'Язык')) + '</label><input id="clLang" maxlength="40"></div>' +
            '<div class="field"><label>' + esc(tr('Level', 'Уровень')) + '</label><input id="clLevel" placeholder="A1–C2" maxlength="10"></div>' +
            '<div class="field"><label>' + esc(tr('Format', 'Формат')) + '</label><select id="clFormat" class="role-select"><option value="online">' + esc(tr('Online', 'Онлайн')) + '</option><option value="offline">' + esc(tr('In person', 'Оффлайн')) + '</option></select></div>' +
            '<div class="field"><label>' + esc(tr('Starts', 'Старт')) + '</label><input id="clStart" type="datetime-local"></div>' +
          '</div>' +
          '<button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Create class', 'Создать класс')) + '</button>' +
        '</form>' +
        '<div class="section-head" style="margin:16px 0 8px"><h2 style="font-size:15px">' + esc(tr('Your classes', 'Ваши классы')) + '</h2><span>' + state.orgClasses.length + '</span></div>' +
        (state.orgClasses.length ? state.orgClasses.map((item) =>
          '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto auto;gap:8px"><div><h3>' + esc(item.name) + '</h3><p>' + esc([item.language, item.level, item.starts_at ? formatDate(item.starts_at) : ''].filter(Boolean).join(' · ')) + '</p></div><span class="tag">' + esc(item.format === 'offline' ? tr('In person', 'Оффлайн') : tr('Online', 'Онлайн')) + '</span><button class="btn" data-class-manage="' + esc(item.id) + '" style="min-height:30px">' + esc(tr('Manage', 'Управлять')) + '</button></div>'
        ).join('') : '<div class="empty">' + esc(tr('No classes yet.', 'Классов пока нет.')) + '</div>') +
        '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Practices', 'Практики')) + '</h2><div style="display:flex;gap:6px"><button class="btn" id="createChallengeBtn" type="button">' + esc(tr('+ Challenge', '+ Челлендж')) + '</button><button class="btn primary" id="createPracticeBtn" type="button">' + esc(tr('Create practice', 'Создать практику')) + '</button></div></div>' +
        (state.myPractices.length ? state.myPractices.map((practice) =>
          '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(practice.title) + '</h3><p>' + esc([practice.target, practice.level].filter(Boolean).join(' · ')) + ' · ' + (practice.plays_count || 0) + ' ' + esc(tr('plays', 'прохождений')) + ' · ★ ' + (Number(practice.rating_avg || 0).toFixed(1)) + ' (' + (practice.rating_count || 0) + ')</p></div><span class="tag ' + (practice.status === 'published' ? 'teal' : '') + '">' + esc(practice.status === 'published' ? tr('Live', 'Активна') : (practice.status || tr('Draft', 'Черновик'))) + '</span></div>'
        ).join('') : '<div class="empty">' + esc(tr('No practices yet.', 'Практик пока нет.')) + '</div>') +
        '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">'+esc(tr('Work awaiting review','Работы на проверку'))+'</h2><span>'+Number((state.practiceSubmissions||[]).filter((item)=>item.status==='submitted').length)+'</span></div>'+
        ((state.practiceSubmissions||[]).length?(state.practiceSubmissions||[]).map((item)=>'<article class="submission-review"><div><b>'+esc(item.submission_type==='speaking'?tr('Speaking response','Ответ Speaking'):tr('Writing response','Ответ Writing'))+'</b><small>'+new Date(item.created_at).toLocaleString()+' · '+esc(item.status)+'</small></div>'+(item.media_url?'<audio controls src="'+esc(item.media_url)+'"></audio>':'')+(item.content_text?'<p>'+esc(item.content_text)+'</p>':'')+'<div class="submission-review-form"><input type="number" min="0" max="100" value="'+(item.score==null?'':Number(item.score))+'" placeholder="0–100" data-submission-score="'+esc(item.id)+'"><input value="'+esc(item.feedback||'')+'" placeholder="'+esc(tr('Teacher feedback','Комментарий преподавателя'))+'" data-submission-feedback="'+esc(item.id)+'"><button class="btn" data-review-submission="'+esc(item.id)+'">'+esc(tr('Save review','Сохранить проверку'))+'</button></div></article>').join(''):'<div class="empty">'+esc(tr('No submitted work yet.','Отправленных работ пока нет.'))+'</div>')+
        membersHtml();
      $('#courseForm').addEventListener('submit', createCourse);
      $('#classForm').addEventListener('submit', createClass);
      $('#createPracticeBtn').addEventListener('click', ctx.openPracticeBuilder);
      if ($('#createChallengeBtn')) $('#createChallengeBtn').addEventListener('click', ctx.openChallengeCreate);
      $$('[data-review-submission]').forEach((button)=>button.addEventListener('click',async()=>{const id=button.dataset.reviewSubmission,score=$('[data-submission-score="'+id+'"]')?.value,feedback=$('[data-submission-feedback="'+id+'"]')?.value;button.disabled=true;const result=await supa.from('practice_submissions').update({score:score===''?null:Number(score),feedback:feedback||null,status:'reviewed',reviewed_at:new Date().toISOString()}).eq('id',id).eq('teacher_id',ctx.user.id);if(result.error){alert(result.error.message);button.disabled=false;}else{button.textContent='✓ '+tr('Saved','Сохранено');}}));
      $$('[data-member-role]').forEach((select) => select.addEventListener('change', (event) => changeMemberRole(select.dataset.memberRole, event.target.value)));
      const importButton = $('#importXlsxBtn');
      if (importButton) importButton.addEventListener('click', () => $('#xlsxFile').click());
      const fileInput = $('#xlsxFile');
      if (fileInput) fileInput.addEventListener('change', importCoursesExcel);
    }

    async function createOrg(event) {
      event.preventDefault();
      const name = $('#orgName').value.trim();
      if (!name) return;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
      const btn = $('#orgForm button[type="submit"]');
      btn.disabled = true;
      try {
        const { data: org, error } = await supa.from('organizations').insert({
          owner_id: ctx.user.id,
          name,
          slug,
          city: $('#orgCity').value.trim() || null,
          country: $('#orgCountry').value.trim() || null,
          description: $('#orgDesc').value.trim() || null
        }).select('id,name,city,country,type').single();
        if (error) throw error;
        const { error: membershipError } = await supa.from('organization_memberships').insert({
          organization_id: org.id,
          user_id: ctx.user.id,
          role: 'owner',
          status: 'active'
        });
        if (membershipError) throw membershipError;
        await loadBusinessWorkspace();
        renderBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not create the organization.', 'Не удалось создать организацию.'));
        btn.disabled = false;
      }
    }

    async function createCourse(event) {
      event.preventDefault();
      if (!state.myOrg) return;
      const title = $('#cTitle').value.trim();
      if (!title) return;
      const priceRaw = $('#cPrice').value.trim();
      const btn = $('#courseForm button[type="submit"]');
      btn.disabled = true;
      try {
        const { error } = await supa.from('courses').insert({
          organization_id: state.myOrg.id,
          created_by: ctx.user.id,
          title,
          level: $('#cLevel').value.trim().toUpperCase() || null,
          language: $('#cLang').value.trim() || null,
          price: priceRaw !== '' ? Number(priceRaw) : null,
          currency: $('#cCurrency').value.trim() || null,
          schedule: $('#cSchedule').value.trim() || null,
          description: $('#cDesc').value.trim() || null,
          status: $('#cPublish').checked ? 'active' : 'draft'
        });
        if (error) throw error;
        await Promise.all([loadBusinessWorkspace(), ctx.loadPublicData()]);
        renderBusinessWorkspace();
        ctx.renderCourses();
      } catch (error) {
        alert(error.message || tr('Could not create the course.', 'Не удалось создать курс.'));
        btn.disabled = false;
      }
    }

    async function createClass(event) {
      event.preventDefault();
      if (!state.myOrg) return;
      const name = $('#clName').value.trim();
      if (!name) return;
      const btn = $('#classForm button[type="submit"]');
      btn.disabled = true;
      try {
        const startVal = $('#clStart').value;
        const { error } = await supa.from('classes').insert({
          organization_id: state.myOrg.id,
          teacher_id: ctx.user.id,
          name,
          language: $('#clLang').value.trim() || null,
          level: $('#clLevel').value.trim().toUpperCase() || null,
          format: $('#clFormat').value,
          starts_at: startVal ? new Date(startVal).toISOString() : null
        });
        if (error) throw error;
        await loadBusinessWorkspace();
        renderBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not create the class.', 'Не удалось создать класс.'));
        btn.disabled = false;
      }
    }

    async function importCoursesExcel(event) {
      const file = event.target.files && event.target.files[0];
      if (!file || !state.myOrg) return;
      const note = $('#xlsxNote');
      if (note) {
        note.style.color = 'var(--soft)';
        note.textContent = tr('Reading...', 'Чтение...');
      }
      try {
        if (!window.XLSX) throw new Error(tr('Spreadsheet library not loaded.', 'Библиотека таблиц не загрузилась.'));
        const buf = await file.arrayBuffer();
        const workbook = window.XLSX.read(buf, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const lookup = (obj, key) => {
          for (const currentKey in obj) {
            if (currentKey.toLowerCase().trim() === key) return obj[currentKey];
          }
          return '';
        };
        const payload = rows.map((row) => {
          const title = String(lookup(row, 'title') || '').trim();
          if (!title) return null;
          const priceRaw = String(lookup(row, 'price') || '').trim();
          return {
            organization_id: state.myOrg.id,
            created_by: ctx.user.id,
            title,
            level: String(lookup(row, 'level') || '').trim().toUpperCase() || null,
            language: String(lookup(row, 'language') || '').trim() || null,
            price: priceRaw && !isNaN(Number(priceRaw)) ? Number(priceRaw) : null,
            schedule: String(lookup(row, 'schedule') || '').trim() || null,
            description: String(lookup(row, 'description') || '').trim() || null,
            status: 'active'
          };
        }).filter(Boolean);
        if (!payload.length) {
          alert(tr('No valid rows — need a "title" column.', 'Нет валидных строк — нужна колонка "title".'));
          return;
        }
        const { error } = await supa.from('courses').insert(payload);
        if (error) throw error;
        await Promise.all([loadBusinessWorkspace(), ctx.loadPublicData()]);
        renderBusinessWorkspace();
        ctx.renderCourses();
        alert('✓ ' + payload.length + ' ' + tr('courses imported.', 'курсов импортировано.'));
      } catch (error) {
        alert(error.message || tr('Import failed.', 'Импорт не удался.'));
      } finally {
        event.target.value = '';
      }
    }

    return {
      importCoursesExcel,
      loadBusinessWorkspace,
      publishEvent,
      removeMember,
      renderBusinessWorkspace
    };
  }

  window.DuvelaAppBusiness = { create: createBusinessFeature };
})();
