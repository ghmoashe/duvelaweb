(function () {
  // GRAMMI on the web (mirrors the Hub's grammi-cards.tsx + ai-practice.tsx flow):
  // the grammar topics of the learner's level, a lesson card (rule, pattern,
  // examples, typical mistake) with four tasks answered in place, the check of
  // those answers, and review cards over finished topics. Anything typed in the
  // chat is a grammar request. Lessons and checks come from openai-assistant
  // (grammar_lesson / grammar_check); the topic map is web/content/grammi-topics.js.

  var PASS_SCORE = 75;
  var STORAGE_PREFIX = 'duvela.grammi.v1';

  var STYLE = [
    '.gr-log{max-height:56vh;overflow-y:auto;padding:2px}',
    '.gr-bubble{display:flex;gap:8px;align-items:flex-end;margin-bottom:8px}',
    '.gr-bubble>div{max-width:82%;padding:9px 13px;border-radius:14px;font-weight:600;line-height:1.45;background:var(--panel-soft);border:1px solid var(--line)}',
    '.gr-bubble.me{justify-content:flex-end}',
    '.gr-bubble.me>div{background:var(--teal);color:#fff;border:0}',
    '.gr-card{border:1px solid var(--line);border-radius:22px;padding:14px;background:var(--panel-soft);margin:6px 0 12px;display:grid;gap:10px}',
    '.gr-head{display:flex;align-items:center;gap:10px}',
    '.gr-head>span{width:38px;height:38px;border-radius:14px;background:rgba(109,61,245,.12);display:grid;place-items:center;font-size:18px;flex:0 0 auto}',
    '.gr-head b{display:block;font-size:15px}',
    '.gr-head small{color:var(--soft);display:block;line-height:1.35}',
    '.gr-head em{margin-left:auto;font-style:normal;border-radius:14px;background:rgba(109,61,245,.12);color:#6D3DF5;font-weight:900;font-size:12px;padding:4px 9px}',
    '.gr-topics{display:grid;gap:6px}',
    '.gr-topic{display:flex;align-items:center;gap:10px;border:1px solid transparent;border-radius:14px;background:var(--panel,#fff);padding:9px 11px;cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}',
    '.gr-topic:hover{border-color:#C9B8FF}',
    '.gr-topic.next{border-color:#B9A5FF;border-width:1.5px}',
    '.gr-topic i{font-style:normal;width:18px;text-align:center;color:#B7AED3}',
    '.gr-topic.done i{color:#0E9F6E}',
    '.gr-topic.next i{color:#6D3DF5}',
    '.gr-topic span{flex:1;min-width:0}',
    '.gr-topic b{display:block;font-size:14px}',
    '.gr-topic small{display:block;color:var(--soft);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gr-mini{border-radius:10px;padding:2px 7px;font-weight:900;font-size:12px}',
    '.gr-chip{border:0;border-radius:14px;background:rgba(109,61,245,.10);color:#6D3DF5;font-weight:800;font-size:13px;padding:8px 12px;cursor:pointer;justify-self:start}',
    '.gr-text{font-size:15px;font-weight:600;line-height:1.55;margin:0}',
    '.gr-pattern{border-radius:14px;background:rgba(109,61,245,.10);padding:10px 12px}',
    '.gr-label{display:block;color:#6D3DF5;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px}',
    '.gr-pattern b{color:#3B2A80;font-size:15px}',
    '.gr-example{display:flex;align-items:center;gap:10px;border:0;border-radius:14px;background:var(--panel,#fff);padding:9px 11px;cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}',
    '.gr-example span{flex:1}',
    '.gr-example b{display:block;font-size:15px}',
    '.gr-example small{display:block;color:var(--soft);font-weight:600}',
    '.gr-pitfall{border-radius:14px;background:#FFF7E6;color:#7C4A03;font-weight:700;padding:10px 12px;line-height:1.45}',
    '.gr-task{border-radius:16px;background:var(--panel,#fff);padding:11px;display:grid;gap:7px}',
    '.gr-task>small{color:#6D3DF5;font-weight:800}',
    '.gr-task>b{font-size:16px;line-height:1.4}',
    '.gr-task input,.gr-task textarea{width:100%;box-sizing:border-box;border:1px solid #DCD2FA;border-radius:12px;padding:9px 11px;font:inherit;font-size:15px;background:var(--panel,#fff);color:inherit}',
    '.gr-options{display:flex;flex-wrap:wrap;gap:7px}',
    '.gr-option{border:1px solid #DCD2FA;border-radius:12px;background:var(--panel,#fff);color:#3B2A80;font-weight:800;padding:8px 12px;cursor:pointer;font:inherit}',
    '.gr-option.on{background:#6D3DF5;border-color:#6D3DF5;color:#fff}',
    '.gr-result{display:flex;gap:7px;align-items:flex-start;border-radius:12px;padding:8px 10px;font-size:14px;line-height:1.4}',
    '.gr-result.ok{background:#ECFDF5}',
    '.gr-result.bad{background:#FFF1F3}',
    '.gr-result b{display:block;color:#064E3B}',
    '.gr-result small{display:block;color:#4B4566;font-weight:600}',
    '.gr-score{display:flex;align-items:center;gap:12px}',
    '.gr-score strong{font-size:24px;font-weight:900;border-radius:16px;padding:6px 12px;white-space:nowrap}',
    '.gr-score strong small{font-size:12px}',
    '.gr-next{border-radius:12px;background:rgba(109,61,245,.10);color:#3B2A80;font-weight:700;padding:9px 11px;line-height:1.4}',
    '.gr-actions{display:flex;flex-wrap:wrap;gap:8px}',
    '.gr-check{border:0;border-radius:16px;background:#6D3DF5;color:#fff;font-weight:900;font-size:15px;padding:12px;cursor:pointer}',
    '.gr-check:disabled{opacity:.5;cursor:not-allowed}',
    '.gr-dock{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}',
    '.gr-dock .btn{flex:1;min-width:160px}',
    '.gr-composer{display:flex;gap:8px}',
    '.gr-composer input{flex:1;min-width:0}',
    '.gr-error{color:#d64545;font-weight:800;margin:6px 0}',
    '.theme-dark .gr-pattern b{color:#E4DAFF}',
    '.theme-dark .gr-pitfall{background:#3A2A10;color:#FDE7B0}',
    '.theme-dark .gr-result.ok{background:#0F3B2E}',
    '.theme-dark .gr-result.bad{background:#47202A}',
    '.theme-dark .gr-result b,.theme-dark .gr-result small{color:#F4F0FF}',
    '.theme-dark .gr-next{color:#E4DAFF}',
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('grammiStyle')) return;
    var style = document.createElement('style');
    style.id = 'grammiStyle';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function scoreColors(score) {
    if (score >= 90) return ['#D1FAE5', '#0E9F6E'];
    if (score >= PASS_SCORE) return ['#E0F2FE', '#0284C7'];
    if (score >= 50) return ['#FEF3C7', '#D97706'];
    return ['#FEE2E2', '#E11D48'];
  }

  function topicsFor(lang, level) {
    var bank = (window.DUVELA_GRAMMI_TOPICS || {})[lang];
    return bank ? bank[String(level || 'A1').toUpperCase()] || [] : [];
  }

  function storageKey(userId, lang) {
    return STORAGE_PREFIX + '.' + (userId || 'guest') + '.' + lang;
  }
  function loadProgress(userId, lang) {
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey(userId, lang)) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  // Server copy (practice_topic_progress, owner-only; written through
  // record_practice_topic_score, which keeps the best score) so the app and the web
  // show the same done topics. Any failure means "offline": the local copy stays.
  function recordServerScore(supa, partner, lang, topicId, score) {
    if (!supa || typeof supa.rpc !== 'function') return;
    supa.rpc('record_practice_topic_score', { p_partner: partner, p_language: lang, p_topic_id: topicId, p_score: Math.round(score) })
      .then(function () {}, function () {});
  }
  async function mergeServerProgress(supa, partner, lang, progress) {
    if (!supa || typeof supa.from !== 'function') return null;
    try {
      var res = await supa.from('practice_topic_progress').select('topic_id,best_score,updated_at').eq('partner', partner).eq('language', lang);
      if (res.error) return null;
      var rows = res.data || [];
      var merged = Object.assign({}, progress);
      rows.forEach(function (row) {
        if (!merged[row.topic_id] || row.best_score > merged[row.topic_id].best) merged[row.topic_id] = { best: row.best_score, at: row.updated_at };
      });
      // Topics done before the server copy existed go up once.
      Object.keys(progress).forEach(function (topicId) {
        var onServer = rows.find(function (row) { return row.topic_id === topicId; });
        if (!onServer || onServer.best_score < progress[topicId].best) recordServerScore(supa, partner, lang, topicId, progress[topicId].best);
      });
      return merged;
    } catch (error) {
      return null;
    }
  }
  function writeProgress(userId, lang, progress) {
    try { localStorage.setItem(storageKey(userId, lang), JSON.stringify(progress)); } catch (error) { /* convenience only */ }
  }

  function saveScore(userId, lang, topicId, score) {
    var progress = loadProgress(userId, lang);
    var best = Math.max((progress[topicId] && progress[topicId].best) || 0, score);
    progress[topicId] = { best: best, at: new Date().toISOString() };
    try { localStorage.setItem(storageKey(userId, lang), JSON.stringify(progress)); } catch (error) { /* convenience only */ }
    return progress;
  }
  function isDone(progress, topicId) {
    return ((progress[topicId] && progress[topicId].best) || 0) >= PASS_SCORE;
  }

  function mount(host, opts) {
    injectStyle();
    var esc = opts.esc, tr = opts.tr;
    var topics = topicsFor(opts.lang, opts.level);
    var glossKey = opts.isRu ? 'ru' : 'en';
    var state = { log: [], busy: false, error: null, progress: loadProgress(opts.userId, opts.lang), results: [] };

    state.log.push({
      kind: 'bot',
      topics: topics.length > 0,
      text: topics.length
        ? tr("Hi, I'm GRAMMI! Pick a topic of your level: I explain the rule in simple words, show examples and give you tasks. Or just write in the chat which grammar to explain — a topic or a question about a sentence.",
            'Привет, я GRAMMI! Выбери тему своего уровня: объясню правило простыми словами, покажу примеры и дам задания. Или просто напиши в чат, какую грамматику разобрать — тему или вопрос о предложении.')
        : tr("Hi, I'm GRAMMI! Write in the chat which grammar to explain — a topic or a question about a sentence — and I'll give you a clear explanation, examples and tasks.",
            'Привет, я GRAMMI! Напиши в чат, какую грамматику разобрать — тему или вопрос о предложении, — и я понятно объясню, покажу примеры и дам задания.'),
    });

    function gloss(topic) { return topic[glossKey] || topic.en; }
    function doneTopics() { return topics.filter(function (topic) { return isDone(state.progress, topic.id); }); }
    function nextTopic() { return topics.find(function (topic) { return !isDone(state.progress, topic.id); }) || null; }

    function topicsHtml() {
      var next = nextTopic();
      var done = doneTopics().length;
      return '<div class="gr-card"><div class="gr-head"><span>🎓</span><div><b>' + esc(tr('Grammar of your level', 'Грамматика твоего уровня')) + ' ' + esc(opts.level) + '</b><small>' +
        esc(tr('Tap a topic: I explain it with examples and give you tasks. Or type any topic or grammar question in the chat.', 'Нажми тему: объясню с примерами и дам задания. Или напиши в чат любую тему или вопрос по грамматике.')) +
        '</small></div><em>' + done + '/' + topics.length + '</em></div><div class="gr-topics">' +
        topics.map(function (topic) {
          var isNext = next && next.id === topic.id;
          var doneTopic = isDone(state.progress, topic.id);
          var best = state.progress[topic.id] && state.progress[topic.id].best;
          var colors = typeof best === 'number' ? scoreColors(best) : null;
          return '<button type="button" class="gr-topic' + (doneTopic ? ' done' : '') + (isNext ? ' next' : '') + '" data-topic="' + esc(topic.id) + '"><i>' + (doneTopic ? '✓' : isNext ? '★' : '○') + '</i><span><b>' + esc(topic.title) + '</b><small>' +
            (isNext ? esc(tr('Next', 'Дальше')) + ' · ' : '') + esc(gloss(topic)) + '</small></span>' +
            (colors ? '<em class="gr-mini" style="background:' + colors[0] + ';color:' + colors[1] + '">' + best + '</em>' : '<small>›</small>') + '</button>';
        }).join('') + '</div>' +
        (done ? '<button type="button" class="gr-chip" data-act="review">🔁 ' + esc(tr('Review completed topics', 'Повторить пройденные темы')) + ' (' + done + ')</button>' : '') +
        '</div>';
    }

    function lessonHtml(entry) {
      var lesson = entry.lesson;
      if (!lesson.explanation && !lesson.pattern && !(lesson.examples || []).length && !lesson.pitfall) return '';
      return '<div class="gr-card"><div class="gr-head"><span>📘</span><div><b>' + esc(lesson.title || entry.topicTitle) + '</b></div></div>' +
        (lesson.explanation ? '<p class="gr-text">' + esc(lesson.explanation) + '</p>' : '') +
        (lesson.pattern ? '<div class="gr-pattern"><span class="gr-label">' + esc(tr('Pattern', 'Схема')) + '</span><b>' + esc(lesson.pattern) + '</b></div>' : '') +
        ((lesson.examples || []).length ? '<div><span class="gr-label">' + esc(tr('Examples', 'Примеры')) + '</span><div class="gr-topics">' +
          lesson.examples.map(function (example) {
            return '<button type="button" class="gr-example" data-speak="' + esc(example.target) + '"><span><b>' + esc(example.target) + '</b>' + (example.native ? '<small>' + esc(example.native) + '</small>' : '') + '</span>🔊</button>';
          }).join('') + '</div></div>' : '') +
        (lesson.pitfall ? '<div class="gr-pitfall">⚠️ ' + esc(lesson.pitfall) + '</div>' : '') +
        '</div>';
    }

    function taskLabel(task) {
      if (task.instruction) return task.instruction;
      return task.type === 'translate' ? tr('Translate', 'Переведи') : task.type === 'order' ? tr('Put the words in order', 'Составь предложение')
        : task.type === 'transform' ? tr('Rewrite', 'Перепиши') : task.type === 'choose' ? tr('Choose', 'Выбери') : tr('Fill the gap', 'Вставь пропуск');
    }

    function answeredCount(entry) {
      return entry.lesson.tasks.filter(function (task) { return String(entry.answers[task.id] || '').trim(); }).length;
    }

    function tasksHtml(entry, index) {
      var lesson = entry.lesson;
      if (!(lesson.tasks || []).length) return '';
      var check = entry.check;
      var locked = Boolean(check) || entry.checking;
      var results = {};
      ((check && check.results) || []).forEach(function (item) { results[item.id] = item; });
      var next = nextTopic();
      var nextTitle = next && next.id !== entry.topicId ? next.title : null;
      var colors = check ? scoreColors(check.score) : null;
      return '<div class="gr-card"><div class="gr-head"><span>✍️</span><div><b>' +
        esc(lesson.mode === 'review' ? (lesson.title || tr('Review', 'Повторение')) : tr('Tasks', 'Задания')) + '</b><small>' +
        esc(tr('Answer here, then press «Check».', 'Ответь прямо здесь и нажми «Проверить».')) + '</small></div></div>' +
        lesson.tasks.map(function (task, n) {
          var value = entry.answers[task.id] || '';
          var result = results[task.id];
          var field = task.type === 'choose' && (task.options || []).length
            ? '<div class="gr-options">' + task.options.map(function (option) {
                return '<button type="button" class="gr-option' + (value === option ? ' on' : '') + '" data-choose="' + index + '|' + esc(task.id) + '" data-value="' + esc(option) + '"' + (locked ? ' disabled' : '') + '>' + esc(option) + '</button>';
              }).join('') + '</div>'
            : (task.type === 'fill'
                ? '<input data-answer="' + index + '|' + esc(task.id) + '" value="' + esc(value) + '" placeholder="' + esc(tr('Your answer', 'Твой ответ')) + '" autocomplete="off" spellcheck="false"' + (locked ? ' disabled' : '') + '>'
                : '<textarea rows="2" data-answer="' + index + '|' + esc(task.id) + '" placeholder="' + esc(tr('Your answer', 'Твой ответ')) + '" spellcheck="false"' + (locked ? ' disabled' : '') + '>' + esc(value) + '</textarea>');
          return '<div class="gr-task"><small>' + (n + 1) + '. ' + esc(taskLabel(task)) + '</small><b>' + esc(task.item) + '</b>' + field +
            (result ? '<div class="gr-result ' + (result.correct ? 'ok' : 'bad') + '">' + (result.correct ? '✅' : '❌') + '<span>' +
              (!result.correct ? '<b>' + esc(result.correctAnswer) + '</b>' : '') + (result.note ? '<small>' + esc(result.note) + '</small>' : '') + '</span></div>' : '') +
            '</div>';
        }).join('') +
        (check
          ? '<div class="gr-score"><strong style="background:' + colors[0] + ';color:' + colors[1] + '">' + check.score + '<small>/100</small></strong><span class="gr-text">' + esc(check.summary || '') + '</span></div>' +
            (check.nextStep ? '<div class="gr-next">🧭 ' + esc(check.nextStep) + '</div>' : '') +
            '<div class="gr-actions"><button type="button" class="gr-chip" data-more="' + index + '">🔄 ' + esc(tr('More tasks', 'Ещё задания')) + '</button>' +
            (nextTitle ? '<button type="button" class="gr-chip" data-topic="' + esc(next.id) + '">➡️ ' + esc(tr('Next', 'Дальше')) + ': ' + esc(nextTitle) + '</button>' : '') +
            (topics.length ? '<button type="button" class="gr-chip" data-act="topics">📋 ' + esc(tr('All topics', 'Все темы')) + '</button>' : '') + '</div>'
          : '<button type="button" class="gr-check" data-check="' + index + '"' + (entry.checking || !answeredCount(entry) ? ' disabled' : '') + '>' +
            esc(entry.checking ? tr('Checking…', 'Проверяю…') : tr('Check', 'Проверить')) + ' (<span data-count="' + index + '">' + answeredCount(entry) + '</span>/' + lesson.tasks.length + ')</button>') +
        '</div>';
    }

    function paint(scrollToEnd) {
      var logEl = host.querySelector('#grLog');
      var previousScroll = logEl ? logEl.scrollTop : 0;
      var log = state.log.map(function (entry, index) {
        var html;
        if (entry.kind === 'me') html = '<div class="gr-bubble me"><div>' + esc(entry.text) + '</div></div>';
        else {
          var bubble = entry.text ? '<div class="gr-bubble">' + opts.avatarHtml() + '<div>' + esc(entry.text) + '</div></div>' : '';
          html = entry.kind === 'lesson' ? bubble + lessonHtml(entry) + tasksHtml(entry, index) : bubble + (entry.topics ? topicsHtml() : '');
        }
        return '<div data-entry="' + index + '">' + html + '</div>';
      }).join('') + (state.busy ? '<div class="gr-bubble">' + opts.avatarHtml() + '<div>…</div></div>' : '');
      var next = nextTopic();
      var dock = (topics.length ? '<button type="button" class="btn" data-act="topics">📋 ' + esc(tr('Topics of my level', 'Темы моего уровня')) + '</button>' : '') +
        (doneTopics().length
          ? '<button type="button" class="btn" data-act="review">🔁 ' + esc(tr('Review completed topics', 'Повторить пройденные темы')) + '</button>'
          : next ? '<button type="button" class="btn" data-topic="' + esc(next.id) + '">⭐ ' + esc(tr('Start', 'Начать')) + ': ' + esc(next.title) + '</button>' : '');
      host.innerHTML =
        '<div class="gr-log" id="grLog">' + log + '</div>' +
        (state.error ? '<div class="gr-error" role="alert">' + esc(state.error) + '</div>' : '') +
        (dock ? '<div class="gr-dock">' + dock + '</div>' : '') +
        '<div class="gr-composer"><input id="grInput" placeholder="' + esc(tr('A grammar topic or question…', 'Тема или вопрос по грамматике…')) + '" autocomplete="off"' + (state.busy ? ' disabled' : '') + '>' +
        '<button class="btn primary" id="grSend"' + (state.busy ? ' disabled' : '') + '>' + esc(tr('Send', 'Отправить')) + '</button></div>' +
        '<button class="btn" id="grEnd" style="width:100%;margin-top:10px">' + esc(tr('End session', 'Завершить сессию')) + '</button>';
      logEl = host.querySelector('#grLog');
      // true = to the end, a number = to the top of that log entry (a new lesson), else keep.
      var target = typeof scrollToEnd === 'number' ? host.querySelector('[data-entry="' + scrollToEnd + '"]') : null;
      if (logEl) logEl.scrollTop = target ? target.offsetTop - logEl.offsetTop : scrollToEnd === true ? logEl.scrollHeight : previousScroll;
      wire();
    }

    async function requestLesson(input) {
      if (state.busy) return;
      state.log.push({ kind: 'me', text: input.userText });
      state.busy = true;
      state.error = null;
      paint(true);
      try {
        var res = await opts.supa.functions.invoke('openai-assistant', {
          body: {
            action: 'grammar_lesson', level: opts.level, locale: opts.locale, nativeLocale: opts.nativeLocale,
            mode: input.mode, topic: input.topic, topicHint: input.topicHint || '', reviewTopics: input.reviewTopics || [],
          },
        });
        if (res.error) throw res.error;
        var lesson = res.data || {};
        state.busy = false;
        if (lesson.offTopic || !(lesson.tasks || []).length) {
          state.log.push({ kind: 'bot', text: lesson.reply || tr('Which grammar topic should I explain?', 'Какую тему грамматики объяснить?') });
        } else {
          state.log.push({
            kind: 'lesson', lesson: lesson, topicId: input.topicId || null, topicTitle: lesson.title || input.topic, answers: {}, check: null, checking: false,
            text: input.mode === 'review'
              ? tr('Review time! Tasks on the topics you have studied.', 'Повторим! Задания по пройденным темам.')
              : input.mode === 'more'
                ? tr('Here are new tasks on the same topic.', 'Вот новые задания по этой теме.')
                : tr('Here is the rule with examples — then try the tasks below.', 'Вот правило с примерами — а ниже задания, попробуй.'),
          });
        }
        paint(state.log.length - 1);
      } catch (error) {
        state.log.pop();
        state.busy = false;
        state.error = (error && error.message) || tr('GRAMMI could not answer. Try again.', 'GRAMMI не смог ответить. Попробуйте ещё раз.');
        paint(true);
      }
    }

    function openTopic(topicId) {
      var topic = topics.find(function (item) { return item.id === topicId; });
      if (!topic) return;
      requestLesson({ mode: 'lesson', topic: topic.title, topicHint: topic.en, topicId: topic.id, userText: topic.title + ' — ' + gloss(topic) });
    }

    function startReview() {
      var done = doneTopics().sort(function (a, b) {
        return String((state.progress[b.id] || {}).at || '').localeCompare(String((state.progress[a.id] || {}).at || ''));
      }).slice(0, 6);
      if (!done.length) return;
      requestLesson({
        mode: 'review', topic: done.map(function (t) { return t.title; }).join('; '),
        reviewTopics: done.map(function (t) { return t.title; }), userText: tr('Review completed topics', 'Повторить пройденные темы'),
      });
    }

    function moreTasks(entry) {
      if (entry.lesson.mode === 'review') {
        requestLesson({
          mode: 'review', topic: entry.topicTitle, userText: tr('More review tasks', 'Ещё задания на повторение'),
          reviewTopics: entry.lesson.tasks.map(function (task) { return task.topic; }).filter(Boolean),
        });
      } else {
        requestLesson({ mode: 'more', topic: entry.topicTitle, topicId: entry.topicId, userText: tr('More tasks on this topic', 'Ещё задания по этой теме') });
      }
    }

    async function checkAnswers(entry) {
      if (entry.checking || entry.check) return;
      entry.checking = true;
      state.error = null;
      paint(false);
      try {
        var res = await opts.supa.functions.invoke('openai-assistant', {
          body: {
            action: 'grammar_check', level: opts.level, locale: opts.locale, nativeLocale: opts.nativeLocale, topic: entry.topicTitle,
            tasks: entry.lesson.tasks.map(function (task) { return Object.assign({}, task, { learnerAnswer: String(entry.answers[task.id] || '').trim() }); }),
          },
        });
        if (res.error) throw res.error;
        var check = res.data || {};
        entry.check = check;
        entry.checking = false;
        state.results.push({ score: Number(check.score) || 0 });
        if (check.score >= PASS_SCORE) opts.awardXp(10);
        // Score per topic: the lesson's own topic, or each reviewed topic from its tasks.
        var scores = {};
        if (entry.topicId) {
          scores[entry.topicId] = (check.results || []).map(function (r) { return r.correct ? 100 : 0; });
        } else if (entry.lesson.mode === 'review') {
          entry.lesson.tasks.forEach(function (task) {
            var topic = topics.find(function (item) { return item.title === task.topic; });
            var result = (check.results || []).find(function (item) { return item.id === task.id; });
            if (!topic || !result) return;
            (scores[topic.id] = scores[topic.id] || []).push(result.correct ? 100 : 0);
          });
        }
        Object.keys(scores).forEach(function (topicId) {
          var values = scores[topicId];
          if (!values.length) return;
          var topicScore = Math.round(values.reduce(function (s, v) { return s + v; }, 0) / values.length);
          state.progress = saveScore(opts.userId, opts.lang, topicId, topicScore);
          if (opts.userId) recordServerScore(opts.supa, 'grammi', opts.lang, topicId, topicScore);
        });
        paint(false);
      } catch (error) {
        entry.checking = false;
        state.error = (error && error.message) || tr('GRAMMI could not check it. Try again.', 'GRAMMI не смог проверить. Попробуйте ещё раз.');
        paint(false);
      }
    }

    function wire() {
      Array.prototype.forEach.call(host.querySelectorAll('[data-speak]'), function (b) { b.onclick = function () { opts.speak(b.getAttribute('data-speak')); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-topic]'), function (b) { b.onclick = function () { openTopic(b.getAttribute('data-topic')); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-more]'), function (b) { b.onclick = function () { moreTasks(state.log[Number(b.getAttribute('data-more'))]); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-check]'), function (b) { b.onclick = function () { checkAnswers(state.log[Number(b.getAttribute('data-check'))]); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-choose]'), function (b) {
        b.onclick = function () {
          var parts = b.getAttribute('data-choose').split('|');
          var entry = state.log[Number(parts[0])];
          entry.answers[parts[1]] = b.getAttribute('data-value');
          paint(false);
        };
      });
      // Typing keeps answers in state without re-rendering (so focus stays put).
      Array.prototype.forEach.call(host.querySelectorAll('[data-answer]'), function (field) {
        field.oninput = function () {
          var parts = field.getAttribute('data-answer').split('|');
          var index = Number(parts[0]);
          var entry = state.log[index];
          entry.answers[parts[1]] = field.value;
          var count = answeredCount(entry);
          var counter = host.querySelector('[data-count="' + index + '"]');
          if (counter) counter.textContent = String(count);
          var button = host.querySelector('[data-check="' + index + '"]');
          if (button) button.disabled = count === 0 || entry.checking;
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-act]'), function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act');
          if (act === 'review') startReview();
          if (act === 'topics') {
            state.log.push({ kind: 'bot', topics: true, text: tr('Here are the topics of your level.', 'Вот темы твоего уровня.') });
            paint(state.log.length - 1);
          }
        };
      });
      var input = host.querySelector('#grInput');
      function send() {
        var text = input && input.value.trim();
        if (!text || state.busy) return;
        input.value = '';
        requestLesson({ mode: 'lesson', topic: text, userText: text });
      }
      var sendBtn = host.querySelector('#grSend');
      if (sendBtn) sendBtn.onclick = send;
      if (input) input.addEventListener('keydown', function (event) { if (event.key === 'Enter') send(); });
      var end = host.querySelector('#grEnd');
      if (end) end.onclick = function () { opts.onEnd(state.results); };
    }

    // Open at the top: the greeting and the level's topic list come first.
    paint(false);
    if (opts.userId) {
      mergeServerProgress(opts.supa, 'grammi', opts.lang, state.progress).then(function (merged) {
        if (!merged) return;
        state.progress = merged;
        writeProgress(opts.userId, opts.lang, merged);
        paint(false);
      });
    }
  }

  // injectStyle is shared with NOVA (web/app-feature-nova.js), which reuses the gr-* card styles.
  window.DuvelaGrammi = { render: mount, topicsFor: topicsFor, PASS_SCORE: PASS_SCORE, injectStyle: injectStyle, scoreColors: scoreColors, mergeServerProgress: mergeServerProgress, recordServerScore: recordServerScore };
})();
