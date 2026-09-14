(function () {
  // Self-contained ELSA oral/full exam for the web app. Reuses the deployed
  // openai-assistant edge actions (respond / evaluate_exam / generate_exam_module
  // / evaluate_exam_writing). Listening playback uses the browser speech engine.
  function createElsaExam(ctx) {
    const { supa, tr, esc } = ctx;

    const BOARD_LABEL = { goethe: 'Goethe-Zertifikat', telc: 'telc Deutsch', oesd: 'ÖSD', dtz: 'DTZ' };
    const BOARDS = ['goethe', 'telc', 'oesd', 'dtz'];
    const LEVELS_BY_BOARD = {
      goethe: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      telc: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      oesd: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      dtz: ['A2', 'B1'],
    };
    const PARTS = (level) => (['A1', 'A2', 'B1'].indexOf(level) >= 0 ? 3 : 2);

    let state = null;

    function reset() {
      state = {
        board: 'goethe',
        level: 'B1',
        full: false,
        phase: 'setup',
        messages: [],
        conversationId: null,
        sending: false,
        evaluation: null,
        skills: { sprechen: null, lesen: null, hoeren: null, schreiben: null },
        module: null,
        answers: [],
        writing: '',
      };
    }

    async function call(body) {
      const { data, error } = await supa.functions.invoke('openai-assistant', { body });
      if (error) throw new Error(error.message || 'Request failed');
      return data || {};
    }

    function topic() {
      return (
        BOARD_LABEL[state.board] +
        ' ' +
        state.level +
        ' — mündliche Prüfung (Sprechen). Führe die Prüfung realistisch Teil für Teil durch und stelle eine Nachfrage pro Teil.'
      );
    }

    function lessonParams(turnIndex) {
      return {
        practiceMode: 'examiner',
        practiceTopic: topic(),
        partnerName: 'ELSA',
        partnerRole: 'examiner',
        locale: 'de-DE',
        nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US',
        levelRange: state.level,
        nativeHelp: false,
        lessonTemplate: BOARD_LABEL[state.board] + ' ' + state.level,
        lessonGoal: 'Conduct the ' + BOARD_LABEL[state.board] + ' ' + state.level + ' oral exam part by part with one follow-up per part.',
        lessonTurnIndex: turnIndex,
        lessonTurnTarget: PARTS(state.level) * 2,
      };
    }

    // ---- overlay ----
    function ensureOverlay() {
      let overlay = document.getElementById('elsaExamOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.id = 'elsaExamOverlay';
      overlay.className = 'overlay';
      overlay.innerHTML =
        '<div class="overlay-card" style="width:min(560px,100%);max-height:88vh;display:flex;flex-direction:column">' +
        '<div class="overlay-head"><h2 id="elsaExamTitle">ELSA · ' + esc(tr('Examiner', 'Экзаменатор')) + '</h2>' +
        '<button type="button" id="elsaExamClose" aria-label="Close">✕</button></div>' +
        '<div class="overlay-body" id="elsaExamBody" style="overflow:auto"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#elsaExamClose').addEventListener('click', close);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      return overlay;
    }
    function close() {
      const overlay = document.getElementById('elsaExamOverlay');
      if (overlay) overlay.classList.remove('open');
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
    function open() {
      reset();
      ensureOverlay();
      document.getElementById('elsaExamOverlay').classList.add('open');
      renderSetup();
    }

    function body() { return document.getElementById('elsaExamBody'); }

    // ---- setup ----
    function renderSetup() {
      state.phase = 'setup';
      const boardBtns = BOARDS.map(function (b) {
        return '<button type="button" class="btn opt-btn' + (state.board === b ? ' primary' : '') + '" data-board="' + b + '" style="flex:1;min-width:120px">' + esc(BOARD_LABEL[b]) + '</button>';
      }).join('');
      const levelBtns = LEVELS_BY_BOARD[state.board].map(function (lv) {
        return '<button type="button" class="btn opt-btn' + (state.level === lv ? ' primary' : '') + '" data-level="' + lv + '" style="min-width:52px">' + lv + '</button>';
      }).join('');
      body().innerHTML =
        '<p style="font-weight:800;margin:0 0 6px">' + esc(tr('Mock oral exam', 'Пробный устный экзамен')) + '</p>' +
        '<p style="color:var(--soft);font-weight:600;margin:0 0 14px">' + esc(tr('Pick an exam and level. ELSA runs it part by part and grades you.', 'Выберите экзамен и уровень. ELSA проведёт его по частям и оценит.')) + '</p>' +
        '<div style="font-weight:800;margin-bottom:8px">' + esc(tr('Exam', 'Экзамен')) + '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' + boardBtns + '</div>' +
        '<div style="font-weight:800;margin-bottom:8px">' + esc(tr('Level', 'Уровень')) + '</div>' +
        '<div id="elsaLevels" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">' + levelBtns + '</div>' +
        '<label style="display:flex;align-items:center;gap:10px;margin-bottom:16px;cursor:pointer">' +
        '<input type="checkbox" id="elsaFull"' + (state.full ? ' checked' : '') + '>' +
        '<span><b>' + esc(tr('Full exam', 'Полный экзамен')) + '</b><br><small style="color:var(--soft)">' + esc(tr('Speaking + Reading + Listening + Writing', 'Говорение + Чтение + Аудирование + Письмо')) + '</small></span></label>' +
        '<button class="btn primary" id="elsaStart" style="width:100%">🎤 ' + esc(tr('Start exam', 'Начать экзамен')) + '</button>';
      Array.prototype.forEach.call(body().querySelectorAll('[data-board]'), function (btn) {
        btn.addEventListener('click', function () {
          state.board = btn.getAttribute('data-board');
          if (LEVELS_BY_BOARD[state.board].indexOf(state.level) < 0) state.level = LEVELS_BY_BOARD[state.board][0];
          renderSetup();
        });
      });
      Array.prototype.forEach.call(body().querySelectorAll('[data-level]'), function (btn) {
        btn.addEventListener('click', function () { state.level = btn.getAttribute('data-level'); renderSetup(); });
      });
      body().querySelector('#elsaFull').addEventListener('change', function (e) { state.full = e.target.checked; });
      body().querySelector('#elsaStart').addEventListener('click', startExam);
    }

    // ---- speaking ----
    async function startExam() {
      state.phase = 'exam';
      state.messages = [];
      state.conversationId = null;
      state.evaluation = null;
      state.skills = { sprechen: null, lesen: null, hoeren: null, schreiben: null };
      renderExam();
      await sendTurn('Guten Tag, ich bin bereit für die Prüfung.', true);
    }

    function answersGiven() { return state.messages.filter(function (m) { return m.role === 'user'; }).length; }

    async function sendTurn(text, isKickoff) {
      if (!isKickoff) state.messages.push({ role: 'user', text: text });
      state.sending = true;
      renderExam();
      try {
        const reply = await call(Object.assign({
          action: 'respond',
          input: text,
          conversationId: state.conversationId,
          history: state.messages.slice(-6).map(function (m) { return { role: m.role, text: m.text }; }),
        }, lessonParams(isKickoff ? 0 : answersGiven())));
        state.conversationId = reply.conversationId || state.conversationId;
        state.messages.push({ role: 'assistant', text: reply.text || '(…)' });
      } catch (e) {
        state.error = e.message;
      }
      state.sending = false;
      renderExam();
    }

    function renderExam() {
      state.phase = 'exam';
      const total = PARTS(state.level);
      const part = Math.min(total, Math.floor(answersGiven() / 2) + 1);
      const done = answersGiven() >= total * 2 - 1;
      const log = state.messages.map(function (m) {
        return '<div style="display:flex;justify-content:' + (m.role === 'user' ? 'flex-end' : 'flex-start') + ';margin-bottom:8px">' +
          '<div style="max-width:82%;padding:9px 13px;border-radius:14px;font-weight:600;line-height:1.45;' +
          (m.role === 'user' ? 'background:var(--teal);color:#fff' : 'background:var(--panel-soft);border:1px solid var(--line)') + '">' + esc(m.text) + '</div></div>';
      }).join('') + (state.sending ? '<div style="color:var(--soft);font-weight:700">…</div>' : '');
      body().innerHTML =
        '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:800;color:var(--soft);margin-bottom:10px">' +
        '<span>' + esc(BOARD_LABEL[state.board]) + ' ' + state.level + '</span><span>' + esc(tr('Part', 'Часть')) + ' ' + part + '/' + total + '</span></div>' +
        '<div id="elsaLog" style="max-height:44vh;overflow:auto;margin-bottom:10px">' + log + '</div>' +
        (state.error ? '<div style="color:#d64545;font-weight:700;margin-bottom:8px">' + esc(state.error) + '</div>' : '') +
        (done ? '<button class="btn primary" id="elsaFinish" style="width:100%;margin-bottom:8px">🏁 ' + esc(tr('Finish & get result', 'Завершить и узнать результат')) + '</button>' : '') +
        '<div style="display:flex;gap:8px"><input id="elsaInput" class="search" placeholder="' + esc(tr('Type your answer…', 'Напишите ответ…')) + '" style="flex:1;margin:0"><button class="btn primary" id="elsaSend">➤</button></div>' +
        '<button class="btn" id="elsaEndEarly" style="width:100%;margin-top:8px">' + esc(tr('End early & get result', 'Завершить досрочно')) + '</button>';
      const logEl = document.getElementById('elsaLog'); if (logEl) logEl.scrollTop = logEl.scrollHeight;
      const input = document.getElementById('elsaInput');
      const send = function () { const v = input.value.trim(); if (v && !state.sending) { input.value = ''; void sendTurn(v, false); } };
      document.getElementById('elsaSend').addEventListener('click', send);
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      if (document.getElementById('elsaFinish')) document.getElementById('elsaFinish').addEventListener('click', finishExam);
      document.getElementById('elsaEndEarly').addEventListener('click', finishExam);
    }

    async function finishExam() {
      state.phase = 'scoring';
      renderScoring(tr('Grading your exam…', 'Оцениваю экзамен…'));
      const transcript = state.messages.map(function (m) { return (m.role === 'assistant' ? 'ELSA' : 'Lernender') + ': ' + m.text; }).join('\n');
      try {
        const result = await call({ action: 'evaluate_exam', board: state.board, level: state.level, transcript: transcript, nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US', locale: 'de-DE' });
        state.evaluation = result;
        state.skills.sprechen = result.score.overall;
        if (state.full) { await runModule('lesen'); } else { renderResult(); }
      } catch (e) {
        state.error = e.message;
        renderExam();
      }
    }

    function renderScoring(msg) {
      body().innerHTML = '<div style="text-align:center;padding:40px 0"><div style="font-size:32px">⏳</div><p style="font-weight:800;margin-top:10px">' + esc(msg) + '</p></div>';
    }

    // ---- reading / listening / writing ----
    async function runModule(skill) {
      state.phase = skill;
      renderScoring(tr('Preparing…', 'Готовлю задание…'));
      try {
        state.module = await call({ action: 'generate_exam_module', board: state.board, level: state.level, skill: skill, nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US' });
        state.answers = state.module.questions ? state.module.questions.map(function () { return -1; }) : [];
        state.writing = '';
        renderModule(skill);
      } catch (e) {
        state.error = e.message;
        // skip to next on failure
        nextAfter(skill);
      }
    }

    function mcqHtml(questions) {
      return questions.map(function (q, qi) {
        return '<div style="margin-bottom:16px"><div style="font-weight:800;margin-bottom:6px">' + (qi + 1) + '. ' + esc(q.q) + '</div>' +
          q.options.map(function (opt, oi) {
            const on = state.answers[qi] === oi;
            return '<button type="button" class="btn opt-btn' + (on ? ' primary' : '') + '" data-q="' + qi + '" data-o="' + oi + '" style="display:block;width:100%;text-align:left;margin-bottom:6px">' + esc(opt) + '</button>';
          }).join('') + '</div>';
      }).join('');
    }

    function renderModule(skill) {
      const m = state.module;
      const label = skill === 'lesen' ? tr('Reading', 'Чтение') : skill === 'hoeren' ? tr('Listening', 'Аудирование') : tr('Writing', 'Письмо');
      let html = '<div style="font-weight:900;font-size:18px;margin-bottom:4px">' + esc(label) + '</div>' +
        '<div style="color:var(--soft);font-weight:700;font-size:12px;margin-bottom:14px">' + esc(BOARD_LABEL[state.board]) + ' ' + state.level + '</div>';
      if (skill === 'lesen') {
        html += '<div style="background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px;line-height:1.6">' + esc(m.text) + '</div>' + mcqHtml(m.questions) +
          '<button class="btn primary" id="elsaModNext" style="width:100%">' + esc(tr('Continue', 'Далее')) + '</button>';
      } else if (skill === 'hoeren') {
        html += '<button class="btn primary" id="elsaPlay" style="margin-bottom:10px">🔊 ' + esc(tr('Play audio', 'Прослушать')) + '</button>' +
          '<p style="color:var(--soft);font-weight:600;margin:0 0 14px">' + esc(tr('Listen, then answer.', 'Послушайте, затем ответьте.')) + '</p>' + mcqHtml(m.questions) +
          '<button class="btn primary" id="elsaModNext" style="width:100%">' + esc(tr('Continue', 'Далее')) + '</button>';
      } else {
        html += '<div style="background:var(--panel-soft);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:12px;line-height:1.5">' + esc(m.prompt) + '</div>' +
          '<textarea id="elsaWrite" class="search" style="width:100%;min-height:120px;margin:0 0 6px" placeholder="' + esc(tr('Write your answer…', 'Напишите ответ…')) + '"></textarea>' +
          '<div style="color:var(--soft);font-weight:700;font-size:12px;margin-bottom:10px" id="elsaWc">0 / ' + (m.minWords || 40) + ' ' + esc(tr('words', 'слов')) + '</div>' +
          '<button class="btn primary" id="elsaWriteSubmit" style="width:100%">' + esc(tr('Submit & finish', 'Отправить и завершить')) + '</button>';
      }
      body().innerHTML = html;
      if (skill !== 'schreiben') {
        Array.prototype.forEach.call(body().querySelectorAll('[data-q]'), function (btn) {
          btn.addEventListener('click', function () { state.answers[Number(btn.getAttribute('data-q'))] = Number(btn.getAttribute('data-o')); renderModule(skill); });
        });
        document.getElementById('elsaModNext').addEventListener('click', function () { submitMcq(skill); });
        if (skill === 'hoeren') document.getElementById('elsaPlay').addEventListener('click', function () { speak(m.script); });
      } else {
        const ta = document.getElementById('elsaWrite');
        ta.value = state.writing;
        ta.addEventListener('input', function () {
          state.writing = ta.value;
          document.getElementById('elsaWc').textContent = ta.value.trim().split(/\s+/).filter(Boolean).length + ' / ' + (m.minWords || 40) + ' ' + tr('words', 'слов');
        });
        document.getElementById('elsaWriteSubmit').addEventListener('click', submitWriting);
      }
    }

    function speak(text) {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/^[AB]:\s?/gm, ''));
      u.lang = 'de-DE'; u.rate = 0.95;
      window.speechSynthesis.speak(u);
    }

    function submitMcq(skill) {
      const qs = state.module.questions || [];
      const correct = qs.reduce(function (s, q, i) { return s + (state.answers[i] === q.answer ? 1 : 0); }, 0);
      state.skills[skill] = Math.round((correct / (qs.length || 1)) * 100);
      nextAfter(skill);
    }

    function nextAfter(skill) {
      if (skill === 'lesen') return void runModule('hoeren');
      if (skill === 'hoeren') return void runModule('schreiben');
      renderResult();
    }

    async function submitWriting() {
      if (!state.writing.trim()) return;
      renderScoring(tr('Grading your writing…', 'Оцениваю письмо…'));
      try {
        const graded = await call({ action: 'evaluate_exam_writing', board: state.board, level: state.level, prompt: state.module.prompt, text: state.writing, nativeLocale: ctx.isRu ? 'ru-RU' : 'en-US' });
        state.skills.schreiben = graded.score.overall;
      } catch (e) { /* ignore, still show result */ }
      renderResult();
    }

    // ---- result ----
    function renderResult() {
      state.phase = 'result';
      const ev = state.evaluation || { score: { overall: 0, fluency: 0, accuracy: 0, vocabulary: 0, pronunciation: 0 }, passed: false, band: state.level, finalFeedback: '', improve: [], parts: [], mistakes: [] };
      const bar = function (label, val) {
        return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:110px;font-weight:800;font-size:13px">' + esc(label) + '</span>' +
          '<div style="flex:1;height:9px;border-radius:999px;background:var(--panel-soft);overflow:hidden"><i style="display:block;height:100%;width:' + (val || 0) + '%;background:var(--teal)"></i></div>' +
          '<b style="width:28px;text-align:right">' + (val == null ? '—' : val) + '</b></div>';
      };
      let html = '<div style="text-align:center;margin-bottom:14px">' +
        '<span style="display:inline-block;padding:6px 18px;border-radius:999px;color:#fff;font-weight:900;letter-spacing:1px;background:' + (ev.passed ? '#2FA36B' : '#D94F72') + '">' + (ev.passed ? esc(tr('PASSED', 'СДАН')) : esc(tr('NOT PASSED', 'НЕ СДАН'))) + '</span>' +
        '<div style="font-size:40px;font-weight:900;margin-top:10px">' + ev.score.overall + '/100</div>' +
        '<div style="color:var(--soft);font-weight:700">' + esc(BOARD_LABEL[state.board]) + ' ' + state.level + ' · ' + esc(ev.band) + '</div></div>';
      if (state.full) {
        html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('By skill', 'По навыкам')) + '</b><div style="margin-top:10px">' +
          bar(tr('Speaking', 'Говорение'), state.skills.sprechen) + bar(tr('Reading', 'Чтение'), state.skills.lesen) +
          bar(tr('Listening', 'Аудирование'), state.skills.hoeren) + bar(tr('Writing', 'Письмо'), state.skills.schreiben) + '</div></div>';
      } else {
        html += '<div class="card" style="margin-bottom:12px">' + bar(tr('Fluency', 'Беглость'), ev.score.fluency) + bar(tr('Accuracy', 'Точность'), ev.score.accuracy) +
          bar(tr('Vocabulary', 'Лексика'), ev.score.vocabulary) + bar(tr('Pronunciation', 'Произношение'), ev.score.pronunciation) + '</div>';
      }
      if (ev.parts && ev.parts.length) {
        html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('By part', 'По частям')) + '</b>' +
          ev.parts.map(function (p) { return '<div style="display:flex;justify-content:space-between;margin-top:8px"><span>' + esc(p.label) + '</span><b>' + p.score + '/100</b></div>' + (p.feedback ? '<small style="color:var(--soft)">' + esc(p.feedback) + '</small>' : ''); }).join('') + '</div>';
      }
      if (ev.mistakes && ev.mistakes.length) {
        html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('Mistakes to fix', 'Ошибки для разбора')) + '</b>' +
          ev.mistakes.map(function (mk) { return '<div style="margin-top:10px"><div style="color:#d64545;text-decoration:line-through">' + esc(mk.wrong) + '</div><div style="color:#2FA36B;font-weight:800">' + esc(mk.correction) + '</div>' + (mk.note ? '<small style="color:var(--soft)">' + esc(mk.note) + '</small>' : '') + '</div>'; }).join('') + '</div>';
      }
      if (ev.finalFeedback) html += '<div class="card" style="margin-bottom:12px">' + esc(ev.finalFeedback) + '</div>';
      if (ev.improve && ev.improve.length) html += '<div class="card" style="margin-bottom:12px"><b>' + esc(tr('What to improve', 'Что улучшить')) + '</b>' + ev.improve.map(function (t) { return '<div style="margin-top:6px">• ' + esc(t) + '</div>'; }).join('') + '</div>';
      html += '<button class="btn primary" id="elsaAgain" style="width:100%">' + esc(tr('New exam', 'Новый экзамен')) + '</button>';
      body().innerHTML = html;
      document.getElementById('elsaAgain').addEventListener('click', renderSetup);
    }

    function elsaExamCardHtml() {
      return '<button class="study-tile" id="elsaExamLaunch" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px;margin-bottom:14px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(90deg,#7B47E6,#A231C9);color:#fff">' +
        '<span style="font-size:26px">🎓</span><span style="flex:1"><b style="font-size:15px">ELSA · ' + esc(tr('Mock exam', 'Пробный экзамен')) + '</b><br><small style="opacity:.9">' + esc(tr('Goethe / telc / ÖSD / DTZ — speaking, reading, listening, writing', 'Goethe / telc / ÖSD / DTZ — говорение, чтение, аудирование, письмо')) + '</small></span><span style="font-size:20px">›</span></button>';
    }
    function bindElsaExamCard() {
      const btn = document.getElementById('elsaExamLaunch');
      if (btn) btn.addEventListener('click', open);
    }

    return { open: open, elsaExamCardHtml: elsaExamCardHtml, bindElsaExamCard: bindElsaExamCard };
  }

  window.DuvelaElsaExam = { create: createElsaExam };
})();
