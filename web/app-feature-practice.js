(function () {
  function createPracticeFeature(ctx) {
    const { $, $$, tr, esc, state, supa } = ctx;
    let practiceState = null;
    let practicesLoaded = false;
    let practicesLoading = false;
    let practicesError = '';

    const TARGET_ALIASES = {
      de:'de', deutsch:'de', german:'de', en:'en', english:'en', englisch:'en', es:'es', spanish:'es', spanisch:'es', espanol:'es', español:'es',
      french:'fr', français:'fr', francais:'fr', fr:'fr', italian:'it', it:'it', portuguese:'pt', pt:'pt', russian:'ru', ru:'ru',
      arabic:'ar', ar:'ar', persian:'fa', farsi:'fa', fa:'fa', turkish:'tr', tr:'tr', dutch:'nl', nl:'nl', polish:'pl', pl:'pl',
      ukrainian:'uk', uk:'uk', swedish:'sv', sv:'sv', norwegian:'no', no:'no', danish:'da', da:'da', finnish:'fi', fi:'fi',
      greek:'el', el:'el', czech:'cs', cs:'cs', hungarian:'hu', hu:'hu', romanian:'ro', ro:'ro', chinese:'zh', zh:'zh',
      japanese:'ja', ja:'ja', korean:'ko', ko:'ko', hindi:'hi', hi:'hi', thai:'th', th:'th', vietnamese:'vi', vi:'vi',
      indonesian:'id', id:'id', math:'math', mathematics:'math', математика:'math', математик:'math', chess:'chess'
    };
    function targetSlug(value) {
      return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g,'and').replace(/[^a-z0-9а-яё]+/gi,'-').replace(/^-+|-+$/g,'');
    }
    function normalizeTarget(value) {
      const raw = targetSlug(value);
      if (!raw) return '';
      const compact = raw.replace(/-/g, '');
      return TARGET_ALIASES[raw] || TARGET_ALIASES[compact] || TARGET_ALIASES[raw.split('-')[0]] || raw;
    }
    function addLearnerTarget(targets, levels, raw, level) {
      const target = normalizeTarget(raw);
      if (!target || targets.indexOf(target) >= 0) return;
      targets.push(target);
      if (level) {
        const match = String(level).toUpperCase().match(/A1|A2|B1|B2|C1|C2/);
        levels[target] = match ? match[0] : 'A1';
      }
    }
    function learnerCriteria() {
      let prefs = {};
      try { prefs = JSON.parse(localStorage.getItem('duvela.study.preferences') || '{}'); } catch (error) {}
      const profile = ctx.profile || {};
      const targets = [], levels = Object.assign({}, prefs.levels || {});
      const learningTargets = Array.isArray(profile.learning_targets) ? profile.learning_targets : [];
      learningTargets.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const itemLevel = item.level || profile.language_level || 'A1';
        if (item.levels && typeof item.levels === 'object') Object.keys(item.levels).forEach((language) => addLearnerTarget(targets, levels, language, item.levels[language] || itemLevel));
        if (Array.isArray(item.languages)) item.languages.forEach((language) => addLearnerTarget(targets, levels, language, (item.levels && item.levels[language]) || itemLevel));
        if (item.language) addLearnerTarget(targets, levels, item.language, item.level || itemLevel);
        if (Array.isArray(item.subcategories)) item.subcategories.forEach((subject) => addLearnerTarget(targets, levels, subject, item.level || itemLevel));
      });
      if (Array.isArray(profile.learning_languages)) profile.learning_languages.forEach((language) => addLearnerTarget(targets, levels, language, profile.language_level || 'A1'));
      if (!targets.length && prefs.practiceTarget) addLearnerTarget(targets, levels, prefs.practiceTarget, levels[prefs.practiceTarget] || profile.language_level || 'A1');
      const selected = normalizeTarget(prefs.practiceTarget || prefs.practiceLang);
      const target = targets.indexOf(selected) >= 0 ? selected : targets[0];
      const level = String((levels || {})[target] || profile.language_level || 'A1').toUpperCase().match(/A1|A2|B1|B2|C1|C2/);
      return { target: target || '', level: level ? level[0] : 'A1' };
    }

    function matchesLearner(practice) {
      const criteria = learnerCriteria();
      if (!criteria.target) return false;
      return normalizeTarget(practice.target) === criteria.target && String(practice.level || '').toUpperCase() === criteria.level;
    }

    function assignmentFor(practice) {
      return (state.practiceAssignments || []).find((item) => String(item.practice_id) === String(practice.id));
    }

    function feedbackFor(practice) {
      return (state.practiceFeedback || []).find((item) => String(item.practice_id) === String(practice.id));
    }

    function attemptsFor(practice) {
      return (state.practiceAttempts || []).filter((item) => String(item.practice_id) === String(practice.id));
    }

    function bestAttempt(practice) {
      return attemptsFor(practice).sort((a, b) => {
        const bp = Number(b.score || 0) / Math.max(1, Number(b.total || 1));
        const ap = Number(a.score || 0) / Math.max(1, Number(a.total || 1));
        return bp - ap;
      })[0] || null;
    }

    function statusFor(practice) {
      const assignment = assignmentFor(practice);
      if (bestAttempt(practice)) return { id: 'done', label: tr('Completed', 'Пройдено'), tone: 'teal' };
      if (assignment && assignment.due_at && new Date(assignment.due_at) < new Date()) return { id: 'overdue', label: tr('Overdue', 'Просрочено'), tone: 'red' };
      if (assignment) return { id: 'assigned', label: tr('Assigned', 'Назначено'), tone: 'amber' };
      return { id: 'available', label: tr('Available', 'Доступно'), tone: 'blue' };
    }

    function challengeFor(practice) {
      const level = String(practice.level || '').toUpperCase();
      const target = normalizeTarget(practice.target);
      return (state.challenges || []).find((challenge) => {
        const challengeLevel = String(challenge.target_level || '').toUpperCase();
        const exam = String(challenge.exam_type || '').toLowerCase();
        return (!challengeLevel || challengeLevel === level) && (!exam || exam.includes(target) || exam.includes('practice'));
      }) || null;
    }

    function audiencesOf(practice) {
      const list = Array.isArray(practice.access_audiences) ? practice.access_audiences.filter((value) => ['everyone', 'premium', 'subscribers'].includes(value)) : [];
      return list.length ? list : ['everyone'];
    }

    function accessBadge(practice) {
      const list = audiencesOf(practice);
      if (list.includes('everyone')) return '';
      const label = list.includes('premium') && list.includes('subscribers')
        ? tr('Premium + Super subscribers', 'Premium + Super-подписчики')
        : list.includes('subscribers') ? tr('Super subscribers', 'Только Super') : 'Premium';
      const open = (state.practiceAccess || {})[practice.id]?.hasAccess;
      return '<span class="tag" style="background:#F1EAFD;color:#6D3DF5">' + (open ? '✓ ' : (list.includes('premium') ? '🔒 ' : '⭐ ')) + esc(label) + '</span>';
    }

    function xpFor(practice, total) {
      return Math.max(20, Number(total || 0) * 5 || Math.round((Number(practice.plays_count || 1) + 20) / 2));
    }

    async function loadPractices() {
      if(practicesLoading)return;
      practicesLoading=true;practicesError='';
      try {
        const [practiceResult, assignmentResult, feedbackResult] = await Promise.all([
          supa.from('teacher_practices').select('id,creator_id,creator_name,target,level,format,title,description,cover_image_url,rating_avg,rating_count,plays_count,access_audiences').eq('status', 'published').order('rating_avg', { ascending: false }).limit(30),
          supa.from('practice_assignments').select('practice_id,due_at,status,created_at').eq('student_id', ctx.user.id),
          supa.from('practice_feedback').select('practice_id,score,feedback,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false })
        ]);
        if(practiceResult.error)throw practiceResult.error;
        if(assignmentResult.error)console.warn('practice assignments load failed',assignmentResult.error);
        if(feedbackResult.error)console.warn('practice feedback load failed',feedbackResult.error);
        state.practices = (practiceResult.data || []).filter(matchesLearner);
        state.practiceAssignments = assignmentResult.data || [];
        state.practiceFeedback = feedbackResult.data || [];
        state.practiceAttempts = [];
        state.myRatings = {};
        if (state.practices.length) {
          const ids = state.practices.map((practice) => practice.id);
          const [{ data: ratings }, { data: attempts }] = await Promise.all([
            supa.from('teacher_practice_ratings').select('practice_id,rating').eq('user_id', ctx.user.id).in('practice_id', ids),
            supa.from('teacher_practice_attempts').select('practice_id,score,total,created_at').eq('user_id', ctx.user.id).in('practice_id', ids).order('created_at', { ascending: false })
          ]);
          (ratings || []).forEach((rating) => { state.myRatings[rating.practice_id] = rating.rating; });
          state.practiceAttempts = attempts || [];
          // Premium / Super-subscriber practices: the server says who may open them.
          state.practiceAccess = {};
          const restrictedIds = state.practices.filter((practice) => !audiencesOf(practice).includes('everyone')).map((practice) => practice.id);
          if (restrictedIds.length) {
            const { data: access } = await supa.rpc('teacher_practice_access_summary', { p_practice_ids: restrictedIds });
            (Array.isArray(access) ? access : []).forEach((row) => {
              state.practiceAccess[row.practice_id] = { hasAccess: row.has_access === true, itemCount: Number(row.item_count || 0) };
            });
          }
        }
      } catch (error) {
        practicesError=tr('Check your connection and try again.','Проверьте соединение и повторите попытку.');
        console.warn('practices load failed', error);
      } finally {practicesLoading=false;practicesLoaded=true;}
    }

    function practicesHtml() {
      const criteria = learnerCriteria();
      if(!navigator.onLine)return '<div class="practice-catalog-state offline" role="status"><span>↯</span><b>'+esc(tr('Teacher practices are unavailable offline','Практики преподавателей недоступны офлайн'))+'</b><p>'+esc(tr('Your built-in exercises and saved progress remain available.','Встроенные упражнения и сохранённый прогресс остаются доступны.'))+'</p></div>';
      if(!practicesLoaded||practicesLoading)return '<div class="practice-catalog-state loading" role="status" aria-live="polite"><i></i><b>'+esc(tr('Loading matching teacher practices…','Загружаем подходящие практики преподавателей…'))+'</b></div>';
      if(practicesError)return '<div class="practice-catalog-state error" role="alert"><span>!</span><b>'+esc(tr('Teacher practices could not be loaded','Не удалось загрузить практики преподавателей'))+'</b><p>'+esc(practicesError)+'</p><button type="button" data-practice-load-retry>'+esc(tr('Try again','Повторить'))+'</button></div>';
      if (!criteria.target) {
        return '<div class="empty rich-empty practice-empty"><span>🎯</span><b>' + esc(tr('Choose a learning direction first', 'Сначала выберите направление обучения')) + '</b><p>' + esc(tr('Teacher practices are shown only for the exact direction saved in your learner profile.', 'Практики преподавателей показываются только для направления, сохранённого в профиле ученика.')) + '</p><a class="btn" href="#profile" data-go="profile">' + esc(tr('Open profile', 'Открыть профиль')) + '</a></div>';
      }
      if (!state.practices.length) {
        return '<div class="empty rich-empty practice-empty"><span>✦</span><b>' + esc(tr('No practices for your level yet', 'Пока нет практик для вашего уровня')) + '</b><p>' + esc(tr('Current target:', 'Сейчас выбрано:')) + ' ' + esc(criteria.target.toUpperCase() + ' · ' + criteria.level) + '. ' + esc(tr('New teacher exercises will appear here automatically.', 'Новые упражнения от преподавателей появятся здесь автоматически.')) + '</p><a class="btn" href="#profile" data-go="profile">' + esc(tr('Change level or language', 'Изменить уровень или язык')) + '</a></div>';
      }
      const saved = new Set(JSON.parse(localStorage.getItem('duvela.saved.practice') || '[]'));
      const levels = [...new Set(state.practices.map((practice) => String(practice.level || '').toUpperCase()).filter(Boolean))];
      const tabs = [['all', tr('All', 'Все')], ['assigned', tr('Assigned', 'Назначенные')], ['progress', tr('In progress', 'В процессе')], ['done', tr('Completed', 'Пройденные')], ['saved', tr('Saved', 'Избранное')]];
      return '<div class="practice-filterbar"><label>⌕<input data-practice-search placeholder="' + esc(tr('Search practices...', 'Поиск практик...')) + '"></label><select data-practice-level><option value="">' + esc(tr('All levels', 'Все уровни')) + '</option>' + levels.map((level) => '<option>' + esc(level) + '</option>').join('') + '</select></div>' +
        '<nav class="practice-tabs">' + tabs.map((tab, index) => '<button type="button" data-practice-tab="' + tab[0] + '" class="' + (index ? '' : 'active') + '">' + esc(tab[1]) + '</button>').join('') + '</nav>' +
        '<div class="practice-card-grid">' + state.practices.map((practice) => {
          const assignment = assignmentFor(practice);
          const feedback = feedbackFor(practice);
          const attempt = bestAttempt(practice);
          const status = statusFor(practice);
          const challenge = challengeFor(practice);
          const percent = attempt ? Math.round((Number(attempt.score || 0) / Math.max(1, Number(attempt.total || 1))) * 100) : 0;
          const duration = Math.max(6, Math.min(25, Math.round((Number(practice.plays_count || 1) % 7 + 2) * 3)));
          const due = assignment && assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : tr('No deadline', 'Без дедлайна');
          return '<article class="card prac-card practice-catalog-card" data-practice="' + esc(practice.id) + '" data-practice-card data-practice-status="' + esc(status.id) + '" data-practice-level="' + esc(String(practice.level || '').toUpperCase()) + '" data-practice-search="' + esc([practice.title, practice.description, practice.target, practice.level, practice.creator_name, status.label].filter(Boolean).join(' ').toLowerCase()) + '" data-practice-saved="' + (saved.has(String(practice.id)) ? '1' : '0') + '">' +
            '<div class="practice-card-cover">' + (practice.cover_image_url ? '<img src="' + esc(practice.cover_image_url) + '" alt="">' : '<span>✦</span>') + '<b>' + esc(practice.format || tr('Practice', 'Практика')) + '</b><button data-local-save data-save-kind="practice" data-save-id="' + esc(practice.id) + '" class="' + (saved.has(String(practice.id)) ? 'active' : '') + '">' + (saved.has(String(practice.id)) ? '♥' : '♡') + '</button></div>' +
            '<div class="practice-card-body"><div class="practice-card-top"><span class="practice-status-pill ' + esc(status.tone) + '">' + esc(status.label) + '</span><small>' + esc(due) + '</small></div>' +
            '<h3>' + esc(practice.title) + '</h3>' +
            (practice.description ? '<p>' + esc(practice.description) + '</p>' : '') +
            '<div class="practice-progress"><i style="width:' + percent + '%"></i><span>' + percent + '%</span></div>' +
            '<div class="prac-meta">' +
              (practice.level ? '<span class="tag">' + esc(String(practice.level).toUpperCase()) + '</span>' : '') +
              (practice.target ? '<span class="tag blue">' + esc(practice.target) + '</span>' : '') +
              accessBadge(practice) +
              '<span class="tag amber">★ ' + Number(practice.rating_avg || 0).toFixed(1) + ' (' + (practice.rating_count || 0) + ')</span>' +
              '<span>' + duration + ' ' + esc(tr('min', 'мин')) + '</span><span>' + (practice.plays_count || 0) + ' ' + esc(tr('plays', 'прохождений')) + '</span>' +
            '</div><div class="practice-owner-line"><span>' + esc(practice.creator_name || tr('Duvela teacher', 'Преподаватель Duvela')) + '</span><span>' + esc(tr('Best', 'Лучший')) + ': ' + (attempt ? percent + '%' : '-') + '</span></div>' +
            (challenge ? '<div class="practice-challenge-link">⚑ ' + esc(tr('Counts toward challenge', 'Засчитывается в челлендж')) + ': ' + esc(challenge.title || tr('Daily challenge', 'Ежедневный челлендж')) + '</div>' : '') +
            '<div class="practice-card-foot"><span>+' + xpFor(practice, attempt && attempt.total) + ' XP</span><button type="button">' + esc(attempt ? tr('Repeat practice', 'Повторить') : tr('Start practice', 'Начать практику')) + '</button></div>' +
            (feedback ? '<div class="practice-teacher-feedback"><b>💬 ' + esc(tr('Teacher feedback', 'Комментарий преподавателя')) + (feedback.score != null ? ' · ' + Number(feedback.score) : '') + '</b><p>' + esc(feedback.feedback || tr('Reviewed', 'Проверено')) + '</p></div>' : '') +
            '</div></article>';
        }).join('') + '</div><div class="practice-no-results" hidden>' + esc(tr('Nothing matched your practice filters.', 'По фильтрам практик ничего не найдено.')) + '</div>';
    }

    async function openPractice(id) {
      const practice = state.practices.find((item) => String(item.id) === String(id));
      if (!practice || !matchesLearner(practice)) return;
      const restricted = !audiencesOf(practice).includes('everyone');
      const access = (state.practiceAccess || {})[practice.id];
      // Without access the server only returns the free preview items.
      const preview = restricted && !(access && access.hasAccess);
      practiceState = { practice, items: [], idx: 0, score: 0, answered: false, misses: [], preview, totalItems: access ? access.itemCount : 0 };
      $('#practiceOverlayTitle').textContent = practice.title;
      const body = $('#practiceOverlayBody');
      body.innerHTML = '<div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      $('#practiceOverlay').classList.add('open');
      try {
        const { data } = await supa.from('teacher_practice_items')
          .select('id,order_index,type,prompt,options,answer,explanation')
          .eq('practice_id', id).order('order_index', { ascending: true });
        practiceState.items = data || [];
      } catch (error) {
        practiceState.items = [];
      }
      if (!practiceState.items.length) {
        body.innerHTML = '<div class="empty">' + esc(tr('This practice has no tasks yet.', 'В этой практике пока нет заданий.')) + '</div>';
        return;
      }
      renderPracticeStep();
    }

    function nextButton() {
      const last = practiceState.idx + 1 >= practiceState.items.length;
      return '<button class="btn primary" id="pracNext" style="margin-top:12px">' + esc(last ? tr('Finish', 'Завершить') : tr('Next', 'Далее')) + '</button>';
    }

    function renderPracticeStep() {
      const step = practiceState;
      const item = step.items[step.idx];
      if (!item) return renderPracticeResult();
      const body = $('#practiceOverlayBody');
      const pct = Math.round((step.idx / Math.max(1, step.items.length)) * 100);
      const progress = '<div class="practice-session-head"><span>' + esc(String(item.type || 'mcq').toUpperCase()) + '</span><b>' + (step.idx + 1) + ' / ' + step.items.length + '</b></div><div class="practice-session-progress"><i style="width:' + pct + '%"></i></div>';
      const options = Array.isArray(item.options) ? item.options : [];
      const type = item.type || 'mcq';
      if (type === 'mcq' && options.length) {
        body.innerHTML = progress + '<h3 style="margin:0 0 12px">' + esc(item.prompt) + '</h3>' + options.map((option, index) => '<button class="opt-btn" data-opt="' + index + '">' + esc(option) + '</button>').join('') + '<div id="pracFeedback"></div>';
      } else if (type === 'flashcard') {
        body.innerHTML = progress + '<h3 style="margin:0 0 12px">' + esc(item.prompt) + '</h3><div id="pracFeedback"></div><button class="btn" id="flashReveal">' + esc(tr('Show answer', 'Показать ответ')) + '</button>';
      } else {
        body.innerHTML = progress + '<h3 style="margin:0 0 12px">' + esc(item.prompt) + '</h3><input id="fillInput" class="search" placeholder="' + esc(tr('Your answer', 'Ваш ответ')) + '"><button class="btn primary" id="fillCheck">' + esc(tr('Check', 'Проверить')) + '</button><div id="pracFeedback"></div>';
      }
    }

    function answerMcq(index) {
      const step = practiceState;
      if (step.answered) return;
      step.answered = true;
      const item = step.items[step.idx];
      const options = item.options || [];
      const correctIdx = options.findIndex((option, optionIndex) => String(optionIndex) === String(item.answer) || String(option) === String(item.answer));
      const buttons = $$('#practiceOverlayBody .opt-btn');
      buttons.forEach((button, buttonIndex) => {
        button.style.pointerEvents = 'none';
        if (buttonIndex === correctIdx) button.classList.add('correct');
      });
      if (index === correctIdx) step.score++;
      else {
        if (buttons[index]) buttons[index].classList.add('wrong');
        step.misses.push({ prompt: item.prompt, answer: item.answer || options[correctIdx] || '', explanation: item.explanation || '' });
      }
      $('#pracFeedback').innerHTML = (item.explanation ? '<p style="font-weight:700;color:var(--soft);margin-top:10px">' + esc(item.explanation) + '</p>' : '') + nextButton();
    }

    function revealFlash() {
      const item = practiceState.items[practiceState.idx];
      $('#flashReveal').style.display = 'none';
      $('#pracFeedback').innerHTML = '<div class="card" style="padding:12px;margin:10px 0"><b>' + esc(item.answer || item.explanation || '') + '</b>' + (item.explanation && item.answer ? '<p style="margin-top:6px;color:var(--soft);font-weight:700">' + esc(item.explanation) + '</p>' : '') + '</div><div style="display:flex;gap:8px"><button class="btn" data-flash="0">' + esc(tr('Missed', 'Не знал')) + '</button><button class="btn primary" data-flash="1">' + esc(tr('Got it', 'Знал')) + '</button></div>';
    }

    function flashMark(got) {
      if (practiceState.answered) return;
      const item = practiceState.items[practiceState.idx];
      practiceState.answered = true;
      if (got) practiceState.score++;
      else practiceState.misses.push({ prompt: item.prompt, answer: item.answer || '', explanation: item.explanation || '' });
      nextStep();
    }

    function checkFill() {
      const step = practiceState;
      if (step.answered) return;
      const item = step.items[step.idx];
      const value = ($('#fillInput').value || '').trim().toLowerCase();
      const answer = String(item.answer || '').trim().toLowerCase();
      step.answered = true;
      const ok = value && value === answer;
      if (ok) step.score++;
      else step.misses.push({ prompt: item.prompt, answer: item.answer || '', explanation: item.explanation || '' });
      $('#fillCheck').style.display = 'none';
      $('#fillInput').disabled = true;
      $('#pracFeedback').innerHTML = '<p style="font-weight:900;color:' + (ok ? 'var(--teal)' : 'var(--red)') + ';margin-top:10px">' + (ok ? esc(tr('Correct!', 'Верно!')) : esc(tr('Answer: ', 'Ответ: ')) + esc(item.answer || '')) + '</p>' + (item.explanation ? '<p style="color:var(--soft);font-weight:700">' + esc(item.explanation) + '</p>' : '') + nextButton();
    }

    function nextStep() {
      practiceState.idx++;
      practiceState.answered = false;
      if (practiceState.idx >= practiceState.items.length) renderPracticeResult();
      else renderPracticeStep();
    }

    function renderPracticePaywall() {
      const step = practiceState;
      const list = audiencesOf(step.practice);
      const superOnly = list.includes('subscribers') && !list.includes('premium');
      const locked = Math.max(0, Number(step.totalItems || 0) - step.items.length);
      const text = superOnly
        ? tr('The full practice opens with a Super subscription to this teacher.', 'Целиком практика открывается с Super-подпиской на этого учителя.')
        : list.includes('subscribers')
          ? tr('The full practice opens with Duvela Premium or a Super subscription to this teacher.', 'Целиком практика открывается с Duvela Premium или Super-подпиской на этого учителя.')
          : tr('The full run with rewards unlocks with Duvela Premium.', 'Полное прохождение с наградами открывается с Duvela Premium.');
      $('#practiceOverlayBody').innerHTML = '<div class="practice-result-card"><span class="practice-result-kicker">🔒 ' + esc(tr('Preview finished', 'Превью пройдено')) + '</span>' +
        '<h2>' + step.score + ' / ' + step.items.length + '</h2>' +
        (locked ? '<p style="font-weight:800">+' + locked + ' ' + esc(tr('more items in this practice', 'ещё заданий в этой практике')) + '</p>' : '') +
        '<p style="font-weight:700">' + esc(text) + '</p>' +
        '<p style="color:var(--soft);font-weight:700">' + esc(tr('If your teacher assigned this practice as homework, it opens in full without a subscription.', 'Если учитель задал эту практику как ДЗ, она откроется полностью и без подписки.')) + '</p>' +
        (list.includes('subscribers') && step.practice.creator_id ? '<a class="btn primary" style="display:block;text-align:center;margin-top:10px" href="./profile.html?id=' + encodeURIComponent(step.practice.creator_id) + '">⭐ ' + esc(tr('Subscribe to the teacher (Super)', 'Подписаться на учителя (Super)')) + '</a>' : '') +
        (list.includes('premium') ? '<button type="button" class="btn' + (superOnly ? '' : ' primary') + '" id="pracPremium" style="width:100%;margin-top:10px">★ ' + esc(tr('Join the Duvela Premium waitlist', 'В лист ожидания Duvela Premium')) + '</button>' : '') +
        '</div>';
      const premium = $('#pracPremium');
      if (premium) premium.onclick = async function () {
        localStorage.setItem('duvela.premium.waitlist', '1');
        try { await supa.from('notifications').insert({ user_id: ctx.user.id, type: 'premium_waitlist', title: 'Duvela Premium', body: 'Premium payment waitlist' }); } catch (e) {}
        this.textContent = '✓ ' + tr('Saved', 'Сохранено');
        this.disabled = true;
      };
    }

    async function renderPracticeResult() {
      const step = practiceState;
      // A preview never counts as a run (the server refuses it anyway): show the paywall.
      if (step.preview) { renderPracticePaywall(); return; }
      const total = step.items.length;
      const accuracy = Math.round((step.score / Math.max(1, total)) * 100);
      const xp = xpFor(step.practice, total);
      const challenge = challengeFor(step.practice);
      $('#practiceOverlayBody').innerHTML = '<div class="practice-result-card"><span class="practice-result-kicker">' + esc(tr('Practice complete', 'Практика завершена')) + '</span><h2>' + accuracy + '%</h2><p>' + step.score + ' / ' + total + ' · +' + xp + ' XP</p><div class="practice-result-stats"><span><b>' + accuracy + '%</b><small>' + esc(tr('Accuracy', 'Точность')) + '</small></span><span><b>' + step.misses.length + '</b><small>' + esc(tr('Weak points', 'Ошибки')) + '</small></span><span><b>' + (challenge ? '✓' : '-') + '</b><small>' + esc(tr('Challenge', 'Челлендж')) + '</small></span></div>' +
        (challenge ? '<div class="practice-challenge-link">⚑ +' + esc(tr('streak progress for', 'прогресс серии для')) + ' ' + esc(challenge.title || tr('challenge', 'челленджа')) + '</div>' : '') +
        (step.misses.length ? '<details class="practice-miss-list" open><summary>' + esc(tr('Review mistakes', 'Разобрать ошибки')) + '</summary>' + step.misses.slice(0, 4).map((miss) => '<p><b>' + esc(miss.prompt) + '</b><span>' + esc(tr('Answer', 'Ответ')) + ': ' + esc(miss.answer || '-') + '</span>' + (miss.explanation ? '<small>' + esc(miss.explanation) + '</small>' : '') + '</p>').join('') + '</details>' : '<div class="practice-perfect">' + esc(tr('No mistakes. Keep the streak.', 'Без ошибок. Продолжайте серию.')) + '</div>') +
        '<p style="color:var(--soft);font-weight:800">' + esc(tr('Rate this practice', 'Оцените практику')) + '</p><div class="stars" id="pracStars">' + [1, 2, 3, 4, 5].map((n) => '<span class="st" data-star="' + n + '">★</span>').join('') + '</div><div class="practice-result-actions"><button class="btn" id="pracRetry">' + esc(tr('Repeat mistakes', 'Повторить ошибки')) + '</button><button class="btn primary" id="pracFinish">' + esc(tr('Close', 'Закрыть')) + '</button></div></div>';
      try {
        await supa.from('teacher_practice_attempts').insert({ practice_id: step.practice.id, user_id: ctx.user.id, score: step.score, total });
      } catch (error) {}
      const existing = state.myRatings[step.practice.id];
      if (existing) highlightStars(existing);
    }

    function highlightStars(n) {
      $$('#pracStars .st').forEach((star, index) => star.classList.toggle('on', index < n));
    }

    async function ratePractice(n) {
      const practiceId = practiceState.practice.id;
      highlightStars(n);
      try {
        await supa.from('teacher_practice_ratings').upsert(
          { practice_id: practiceId, user_id: ctx.user.id, rating: n, updated_at: new Date().toISOString() },
          { onConflict: 'practice_id,user_id' }
        );
        state.myRatings[practiceId] = n;
      } catch (error) {
        console.warn('rating failed', error);
      }
    }

    function closePractice() {
      $('#practiceOverlay').classList.remove('open');
      practiceState = null;
      loadPractices().then(() => {
        if (!ctx.isBusiness()) ctx.renderWorkspace();
      });
    }

    function bindEvents() {
      document.addEventListener('input', (event) => {
        if (!event.target.matches('[data-practice-search],[data-practice-level]')) return;
        applyPracticeFilters(event.target.closest('[data-panel="workspace"]'));
      });
      document.addEventListener('click', (event) => {
        const retry=event.target.closest('[data-practice-load-retry]');
        if(retry){retry.disabled=true;practicesLoaded=false;loadPractices().then(()=>ctx.renderWorkspace());return;}
        const tab = event.target.closest('[data-practice-tab]');
        if (tab) {
          const host = tab.closest('[data-panel="workspace"]');
          host.querySelectorAll('[data-practice-tab]').forEach((button) => button.classList.toggle('active', button === tab));
          applyPracticeFilters(host);
          return;
        }
        const savedFilter = event.target.closest('[data-practice-saved]');
        if (!savedFilter) return;
        savedFilter.classList.toggle('active');
        applyPracticeFilters(savedFilter.closest('[data-panel="workspace"]'));
      });
      $('#practiceClose').addEventListener('click', closePractice);
      $('#practiceOverlay').addEventListener('click', (event) => {
        if (event.target === $('#practiceOverlay')) closePractice();
      });
      $('#practiceOverlayBody').addEventListener('click', (event) => {
        const option = event.target.closest('[data-opt]');
        if (option) return answerMcq(Number(option.dataset.opt));
        if (event.target.closest('#flashReveal')) return revealFlash();
        const flash = event.target.closest('[data-flash]');
        if (flash) return flashMark(flash.dataset.flash === '1');
        if (event.target.closest('#fillCheck')) return checkFill();
        if (event.target.closest('#pracNext')) return nextStep();
        const star = event.target.closest('[data-star]');
        if (star) return ratePractice(Number(star.dataset.star));
        if (event.target.closest('#pracRetry')) {
          practiceState.items = practiceState.misses.length ? practiceState.misses.map((miss, index) => ({ id: 'miss-' + index, type: 'fill', prompt: miss.prompt, answer: miss.answer, explanation: miss.explanation })) : practiceState.items;
          practiceState.idx = 0;
          practiceState.score = 0;
          practiceState.answered = false;
          practiceState.misses = [];
          return renderPracticeStep();
        }
        if (event.target.closest('#pracFinish')) closePractice();
      });
    }

    function applyPracticeFilters(host) {
      if (!host) return;
      const query = (host.querySelector('[data-practice-search]')?.value || '').trim().toLowerCase();
      const level = host.querySelector('[data-practice-level]')?.value || '';
      const activeTab = host.querySelector('[data-practice-tab].active')?.dataset.practiceTab || 'all';
      let visible = 0;
      host.querySelectorAll('[data-practice-card]').forEach((card) => {
        let hidden = Boolean((query && !card.dataset.practiceSearch.includes(query)) || (level && card.dataset.practiceLevel !== level));
        if (activeTab === 'saved') hidden = hidden || card.dataset.practiceSaved !== '1';
        if (activeTab === 'assigned') hidden = hidden || !['assigned', 'overdue'].includes(card.dataset.practiceStatus);
        if (activeTab === 'progress') hidden = hidden || card.dataset.practiceStatus !== 'available';
        if (activeTab === 'done') hidden = hidden || card.dataset.practiceStatus !== 'done';
        card.hidden = hidden;
        if (!hidden) visible++;
      });
      const empty = host.querySelector('.practice-no-results');
      if (empty) empty.hidden = Boolean(visible);
    }

    return {
      bindEvents,
      closePractice,
      loadPractices,
      openPractice,
      practicesHtml
    };
  }

  window.DuvelaAppPractice = { create: createPracticeFeature };
})();
