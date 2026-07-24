(function () {
  function createPracticeFeature(ctx) {
    const { $, $$, tr, esc, state, supa } = ctx;
    let practiceState = null;

    function learnerCriteria() {
      let prefs = {};
      try { prefs = JSON.parse(localStorage.getItem('duvela.study.preferences') || '{}'); } catch (error) {}
      const aliases = { de: 'de', german: 'de', deutsch: 'de', en: 'en', english: 'en', englisch: 'en', es: 'es', spanish: 'es', spanisch: 'es' };
      const raw = String(prefs.practiceTarget || prefs.practiceLang || 'de').toLowerCase();
      const target = aliases[raw] || aliases[raw.split(/[-_]/)[0]] || 'de';
      const level = String((prefs.levels || {})[target] || (ctx.profile && ctx.profile.language_level) || 'A1').toUpperCase().match(/A1|A2|B1|B2|C1|C2/);
      return { target, level: level ? level[0] : 'A1' };
    }

    function normalizeTarget(value) {
      const aliases = { de: 'de', german: 'de', deutsch: 'de', en: 'en', english: 'en', englisch: 'en', es: 'es', spanish: 'es', spanisch: 'es' };
      const raw = String(value || '').trim().toLowerCase();
      return aliases[raw] || aliases[raw.split(/[-_]/)[0]] || raw;
    }

    function matchesLearner(practice) {
      const criteria = learnerCriteria();
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

    function xpFor(practice, total) {
      return Math.max(20, Number(total || 0) * 5 || Math.round((Number(practice.plays_count || 1) + 20) / 2));
    }

    async function loadPractices() {
      try {
        const [practiceResult, assignmentResult, feedbackResult] = await Promise.all([
          supa.from('teacher_practices').select('id,creator_name,target,level,format,title,description,cover_image_url,rating_avg,rating_count,plays_count').eq('status', 'published').order('rating_avg', { ascending: false }).limit(30),
          supa.from('practice_assignments').select('practice_id,due_at,status,created_at').eq('student_id', ctx.user.id),
          supa.from('practice_feedback').select('practice_id,score,feedback,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false })
        ]);
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
        }
      } catch (error) {
        console.warn('practices load failed', error);
      }
    }

    function practicesHtml() {
      const criteria = learnerCriteria();
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
      practiceState = { practice, items: [], idx: 0, score: 0, answered: false, misses: [] };
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

    async function renderPracticeResult() {
      const step = practiceState;
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
