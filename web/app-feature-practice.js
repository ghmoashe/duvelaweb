(function () {
  function createPracticeFeature(ctx) {
    const { $, $$, tr, esc, state, supa } = ctx;
    let practiceState = null;

    async function loadPractices() {
      try {
        const { data } = await supa.from('teacher_practices')
          .select('id,creator_name,target,level,format,title,description,cover_image_url,rating_avg,rating_count,plays_count')
          .eq('status', 'published').order('rating_avg', { ascending: false }).limit(30);
        state.practices = data || [];
        if (state.practices.length) {
          const ids = state.practices.map((practice) => practice.id);
          const { data: ratings } = await supa.from('teacher_practice_ratings')
            .select('practice_id,rating').eq('user_id', ctx.user.id).in('practice_id', ids);
          state.myRatings = {};
          (ratings || []).forEach((rating) => { state.myRatings[rating.practice_id] = rating.rating; });
        }
      } catch (error) {
        console.warn('practices load failed', error);
      }
    }

    function practicesHtml() {
      if (!state.practices.length) return '<div class="empty">' + esc(tr('No practices yet. Check back soon.', 'Практик пока нет. Загляните позже.')) + '</div>';
      return state.practices.map((practice) =>
        '<div class="card prac-card" data-practice="' + esc(practice.id) + '">' +
          '<h3>' + esc(practice.title) + '</h3>' +
          (practice.description ? '<p>' + esc(practice.description) + '</p>' : '') +
          '<div class="prac-meta">' +
            (practice.level ? '<span class="tag">' + esc(String(practice.level).toUpperCase()) + '</span>' : '') +
            (practice.target ? '<span class="tag blue">' + esc(practice.target) + '</span>' : '') +
            '<span class="tag amber">★ ' + Number(practice.rating_avg || 0).toFixed(1) + ' (' + (practice.rating_count || 0) + ')</span>' +
            '<span style="color:var(--muted);font-weight:800;font-size:12px">' + (practice.plays_count || 0) + ' ' + esc(tr('plays', 'прохождений')) + '</span>' +
          '</div>' +
        '</div>'
      ).join('');
    }

    async function openPractice(id) {
      const practice = state.practices.find((item) => item.id === id);
      if (!practice) return;
      practiceState = { practice, items: [], idx: 0, score: 0, answered: false };
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

    function pracNextButton() {
      const last = practiceState.idx + 1 >= practiceState.items.length;
      return '<button class="btn primary" id="pracNext" style="margin-top:12px">' + esc(last ? tr('Finish', 'Завершить') : tr('Next', 'Далее')) + '</button>';
    }

    function renderPracticeStep() {
      const step = practiceState;
      const item = step.items[step.idx];
      if (!item) {
        renderPracticeResult();
        return;
      }
      const body = $('#practiceOverlayBody');
      const progress = '<p style="font-weight:900;color:var(--muted);margin:0 0 10px">' + (step.idx + 1) + ' / ' + step.items.length + '</p>';
      const options = Array.isArray(item.options) ? item.options : [];
      const type = item.type || 'mcq';
      if (type === 'mcq' && options.length) {
        body.innerHTML = progress + '<h3 style="margin:0 0 12px">' + esc(item.prompt) + '</h3>' +
          options.map((option, index) => '<button class="opt-btn" data-opt="' + index + '">' + esc(option) + '</button>').join('') +
          '<div id="pracFeedback"></div>';
      } else if (type === 'flashcard') {
        body.innerHTML = progress + '<h3 style="margin:0 0 12px">' + esc(item.prompt) + '</h3>' +
          '<div id="pracFeedback"></div><button class="btn" id="flashReveal">' + esc(tr('Show answer', 'Показать ответ')) + '</button>';
      } else {
        body.innerHTML = progress + '<h3 style="margin:0 0 12px">' + esc(item.prompt) + '</h3>' +
          '<input id="fillInput" class="search" placeholder="' + esc(tr('Your answer', 'Ваш ответ')) + '">' +
          '<button class="btn primary" id="fillCheck">' + esc(tr('Check', 'Проверить')) + '</button><div id="pracFeedback"></div>';
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
      else if (buttons[index]) buttons[index].classList.add('wrong');
      $('#pracFeedback').innerHTML = (item.explanation ? '<p style="font-weight:700;color:var(--soft);margin-top:10px">' + esc(item.explanation) + '</p>' : '') + pracNextButton();
    }

    function revealFlash() {
      const item = practiceState.items[practiceState.idx];
      $('#flashReveal').style.display = 'none';
      $('#pracFeedback').innerHTML =
        '<div class="card" style="padding:12px;margin:10px 0"><b>' + esc(item.answer || item.explanation || '') + '</b>' +
        (item.explanation && item.answer ? '<p style="margin-top:6px;color:var(--soft);font-weight:700">' + esc(item.explanation) + '</p>' : '') + '</div>' +
        '<div style="display:flex;gap:8px"><button class="btn" data-flash="0">' + esc(tr('Missed', 'Не знал')) + '</button><button class="btn primary" data-flash="1">' + esc(tr('Got it', 'Знал')) + '</button></div>';
    }

    function flashMark(got) {
      if (practiceState.answered) return;
      practiceState.answered = true;
      if (got) practiceState.score++;
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
      $('#fillCheck').style.display = 'none';
      $('#fillInput').disabled = true;
      $('#pracFeedback').innerHTML = '<p style="font-weight:900;color:' + (ok ? 'var(--teal)' : 'var(--red)') + ';margin-top:10px">' +
        (ok ? esc(tr('Correct!', 'Верно!')) : esc(tr('Answer: ', 'Ответ: ')) + esc(item.answer || '')) + '</p>' +
        (item.explanation ? '<p style="color:var(--soft);font-weight:700">' + esc(item.explanation) + '</p>' : '') + pracNextButton();
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
      $('#practiceOverlayBody').innerHTML =
        '<div style="text-align:center;padding:10px 0">' +
        '<h2 style="margin:0 0 6px">' + esc(tr('Done!', 'Готово!')) + '</h2>' +
        '<p style="font-weight:900;font-size:28px;margin:6px 0">' + step.score + ' / ' + total + '</p>' +
        '<p style="color:var(--soft);font-weight:800">' + esc(tr('Rate this practice', 'Оцените практику')) + '</p>' +
        '<div class="stars" id="pracStars">' + [1, 2, 3, 4, 5].map((n) => '<span class="st" data-star="' + n + '">★</span>').join('') + '</div>' +
        '<div style="margin-top:16px"><button class="btn primary" id="pracFinish">' + esc(tr('Close', 'Закрыть')) + '</button></div>' +
        '</div>';
      try {
        await supa.from('teacher_practice_attempts').insert({ practice_id: step.practice.id, user_id: ctx.user.id, score: step.score, total });
      } catch (error) {
        /* ignore */
      }
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
      $('#practiceClose').addEventListener('click', closePractice);
      $('#practiceOverlay').addEventListener('click', (event) => {
        if (event.target === $('#practiceOverlay')) closePractice();
      });
      $('#practiceOverlayBody').addEventListener('click', (event) => {
        const option = event.target.closest('[data-opt]');
        if (option) {
          answerMcq(Number(option.dataset.opt));
          return;
        }
        if (event.target.closest('#flashReveal')) {
          revealFlash();
          return;
        }
        const flash = event.target.closest('[data-flash]');
        if (flash) {
          flashMark(flash.dataset.flash === '1');
          return;
        }
        if (event.target.closest('#fillCheck')) {
          checkFill();
          return;
        }
        if (event.target.closest('#pracNext')) {
          nextStep();
          return;
        }
        const star = event.target.closest('[data-star]');
        if (star) {
          ratePractice(Number(star.dataset.star));
          return;
        }
        if (event.target.closest('#pracFinish')) closePractice();
      });
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
