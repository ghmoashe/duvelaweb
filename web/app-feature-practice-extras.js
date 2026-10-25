(function () {
  // Practice screens ported from the Duvela Academy Hub app: STELLA's word cards, the
  // German alphabet with letter combinations, and the Persian track (alphabet, reading
  // & letters, listening, numbers / time / money). Content comes from
  // web/content/practice-extras.js (scripts/sync-practice-extras.mjs), loaded on first
  // use. app-feature-study.js owns the overlay; these functions only fill its body.

  var DATA_URL = './web/content/practice-extras.js?v=20261025-extras2';
  var dataPromise = null;

  function ensureData() {
    if (window.DuvelaPracticeExtrasData) return Promise.resolve(window.DuvelaPracticeExtrasData);
    if (!dataPromise) {
      dataPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = DATA_URL;
        script.onload = function () { resolve(window.DuvelaPracticeExtrasData); };
        script.onerror = function () { dataPromise = null; reject(new Error('Practice content could not be loaded.')); };
        document.head.appendChild(script);
      });
    }
    return dataPromise;
  }

  var STYLE = [
    '.px-tabs{display:flex;gap:4px;padding:4px;border-radius:16px;background:var(--panel-soft);margin-bottom:12px}',
    '.px-tabs button{flex:1;border:0;border-radius:12px;padding:9px 8px;font-weight:800;background:transparent;color:var(--soft);cursor:pointer}',
    '.px-tabs button.on{background:#7B47E6;color:#fff}',
    '.px-switch{display:flex;gap:4px;justify-content:center;margin:0 auto 12px;padding:4px;border-radius:14px;background:rgba(15,159,122,.12);width:max-content;max-width:100%;flex-wrap:wrap}',
    '.px-switch button{border:0;border-radius:10px;padding:7px 14px;font-weight:800;background:transparent;color:#0F6F57;cursor:pointer}',
    '.px-switch button.on{background:#0F9F7A;color:#fff}',
    '.px-hint{color:var(--soft);font-weight:700;font-size:13px;line-height:1.5;margin:0 0 12px}',
    '.px-hero{display:flex;flex-direction:column;align-items:center;gap:4px;padding:20px;border-radius:24px;background:linear-gradient(120deg,#0F9F7A,#7B47E6);color:#fff;margin-bottom:12px}',
    '.px-big{font-size:72px;line-height:1.25;font-weight:700;display:flex;align-items:center;gap:12px;cursor:pointer;background:none;border:0;color:#fff}',
    '.px-big.long{font-size:38px}',
    '.px-big i{font-style:normal;font-size:22px}',
    '.px-hero b{font-size:20px}.px-hero small{opacity:.88;font-weight:800}',
    '.px-panel{border:1px solid var(--line);border-radius:18px;padding:14px;background:var(--panel-soft);margin-bottom:12px}',
    '.px-panel h4{margin:0 0 8px}',
    '.px-forms{display:flex;gap:8px}.px-forms span{flex:1;text-align:center;background:var(--panel,#fff);border-radius:12px;padding:6px 0;font-size:30px;line-height:1.6}',
    '.px-forms small{display:block;font-size:11px;color:var(--soft);font-weight:800;line-height:1.2}',
    '.px-example{display:flex;align-items:center;gap:10px;cursor:pointer;background:none;border:0;width:100%;text-align:left;color:inherit}',
    '.px-example div{flex:1}.px-example b{font-size:26px;display:block}.px-example em{font-style:normal;color:#0F9F7A;font-weight:900}',
    '.px-note{color:var(--soft);font-size:13px;font-weight:700;line-height:1.5;margin-top:8px}',
    '.px-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px}',
    '.px-grid.rtl{direction:rtl}',
    '.px-grid button{border:1px solid var(--line);border-radius:12px;background:var(--panel,#fff);padding:6px 2px;cursor:pointer;color:inherit}',
    '.px-grid button.on{background:#0F9F7A;color:#fff;border-color:#0F9F7A}',
    '.px-grid b{display:block;font-size:22px;line-height:1.5;font-weight:500}.px-grid b.long{font-size:12px;line-height:2.7}',
    '.px-grid small{font-size:10px;font-weight:800;opacity:.8}',
    '.px-card{border:1px solid var(--line);border-radius:22px;padding:18px;text-align:center;background:var(--panel-soft);margin-bottom:12px}',
    '.px-card .px-prompt{font-weight:800;margin-bottom:6px}',
    '.px-q{font-size:64px;line-height:1.5;color:#7B47E6}.px-q.long{font-size:34px}.px-q.fa{direction:rtl}',
    '.px-qhint{font-size:22px;font-weight:900;margin-top:-6px}',
    '.px-options{display:flex;flex-direction:column;gap:8px;margin-top:12px}',
    '.px-options button{border:1px solid var(--line);border-radius:14px;background:var(--panel,#fff);padding:12px;font-weight:900;font-size:17px;cursor:pointer;color:inherit}',
    '.px-options button.fa{font-size:26px;font-weight:500;line-height:1.6;padding:6px}',
    '.px-options button.ok{background:#16A06D;color:#fff;border-color:#16A06D}',
    '.px-options button.bad{background:#E4395E;color:#fff;border-color:#E4395E}',
    '.px-feedback{font-weight:800;margin-top:10px}.px-feedback.ok{color:#16A06D}.px-feedback.bad{color:#E4395E}',
    '.px-score{display:flex;justify-content:space-between;font-weight:900;margin-bottom:8px}',
    '.px-play{width:96px;height:96px;border-radius:50%;border:0;background:#0F9F7A;color:#fff;font-size:34px;cursor:pointer;margin:6px auto}',
    '.px-built{border-radius:16px;background:var(--panel,#fff);padding:4px 10px;margin:10px 0;min-height:70px}',
    '.px-built b{font-size:42px;line-height:1.6;font-weight:500;direction:rtl;display:block}',
    '.px-built.ok{background:#E6FBF3}.px-built.bad{background:#FDE8EE}',
    '.px-tiles{display:flex;flex-direction:row-reverse;flex-wrap:wrap;gap:8px;justify-content:center}',
    '.px-tiles button{width:56px;height:60px;border-radius:14px;border:1px solid var(--line);background:var(--panel,#fff);font-size:28px;cursor:pointer;color:inherit}',
    '.px-tiles button.used{opacity:.25}.px-tiles button.bad{background:#E4395E;color:#fff}',
    '.px-actions{display:flex;gap:8px;margin-top:12px}.px-actions .btn{flex:1}',
    '.px-row{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-radius:16px;padding:10px 12px;margin-bottom:8px;background:var(--panel-soft);cursor:pointer;width:100%;text-align:left;color:inherit}',
    '.px-value{min-width:64px;text-align:center;border-radius:12px;background:rgba(123,71,230,.12);padding:4px 6px}',
    '.px-value b{display:block;font-size:17px}.px-value span{color:#7B47E6;font-size:19px}',
    '.px-row-text{flex:1}.px-row-text .fa{font-size:22px;line-height:1.7;display:block}',
    '.px-row-text em{font-style:normal;color:#0F9F7A;font-weight:900}.px-row-text small{display:block;color:var(--soft);font-weight:700}',
    '.st-word{border:1px solid var(--line);border-radius:22px;padding:14px;background:var(--panel-soft);margin:6px 0 12px}',
    '.st-word-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}.st-word-head b{display:block}.st-word-head small{color:var(--soft)}',
    '.st-word-head span{margin-left:auto;min-width:28px;height:28px;border-radius:14px;background:rgba(109,61,245,.12);color:#6D3DF5;font-weight:900;display:flex;align-items:center;justify-content:center}',
    '.st-face{display:flex;align-items:center;justify-content:center;gap:12px;border-radius:18px;padding:18px;background:linear-gradient(135deg,#7B47E6,#B13BD1);color:#fff}',
    '.st-face b{font-size:28px;font-weight:900}.st-face button{border:0;border-radius:18px;width:36px;height:36px;background:rgba(255,255,255,.22);color:#fff;cursor:pointer}',
    '.st-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}',
    '.st-level{background:#6D3DF5;color:#fff;border-radius:10px;padding:2px 8px;font-weight:900;font-size:12px}',
    '.st-pos{color:#6D3DF5;font-style:italic;font-weight:700;font-size:13px}',
    '.st-chip{border:0;border-radius:14px;background:rgba(109,61,245,.10);color:#6D3DF5;font-weight:800;font-size:12px;padding:6px 12px;cursor:pointer}',
    '.st-chip.done{background:#ECFDF5;color:#0E9F6E;cursor:default}',
    '.st-example{border-radius:14px;background:var(--panel,#fff);padding:8px 10px;margin-top:8px;font-weight:600}',
    '.st-result{border:1px solid var(--line);border-radius:20px;padding:12px;background:var(--panel-soft);margin:6px 0 12px}',
    '.st-score{display:flex;align-items:center;gap:12px;margin-bottom:8px}',
    '.st-score strong{font-size:26px;font-weight:900;border-radius:16px;padding:6px 12px}',
    '.st-better{display:flex;align-items:center;gap:10px;border-radius:14px;background:#ECFDF5;padding:10px;margin-top:8px;cursor:pointer;border:0;width:100%;text-align:left;color:#064E3B}',
    '.st-better small{display:block;color:#0E9F6E;font-weight:900;text-transform:uppercase;font-size:11px}',
    '.st-warn{border-radius:12px;background:#FFF1F3;color:#BE123C;font-weight:700;padding:8px;margin-top:6px}',
    '.st-log{max-height:52vh;overflow-y:auto;padding:2px}',
    '.st-bubble{display:flex;gap:8px;align-items:flex-end;margin-bottom:8px}',
    '.st-bubble>div{max-width:82%;padding:9px 13px;border-radius:14px;font-weight:600;line-height:1.45;background:var(--panel-soft);border:1px solid var(--line)}',
    '.st-bubble.me{justify-content:flex-end}.st-bubble.me>div{background:var(--teal);color:#fff;border:0}',
    '.st-dock{display:flex;gap:8px;margin:8px 0}.st-dock .btn{flex:1}',
  ].join('\n');

  function injectStyle() {
    if (document.getElementById('practiceExtrasStyle')) return;
    var style = document.createElement('style');
    style.id = 'practiceExtrasStyle';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function shuffle(items) {
    var copy = items.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
  }
  function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
  function chars(text) { return Array.from(String(text || '')); }

  // opts: { esc, tr, isRu, playClip(audioPath, speechText, voiceId, languageCode), finish(score, total, label), xpRound() }
  function localized(value, opts) {
    if (!value) return '';
    return opts.isRu ? (value.ru || value.en) : (value.en || value.ru);
  }

  function loading(host, opts) {
    host.innerHTML = '<div class="empty">' + opts.esc(opts.tr('Loading…', 'Загрузка…')) + '</div>';
  }

  // ── Alphabet (German letters + combinations, Persian letters) ─────────────────
  var GERMAN_VOICE = '1f1a055633d649589a63b8c0978302f1';
  var PERSIAN_VOICE = 'e29dfaf012b9453c9a8d781f8f6696c3';

  function renderAlphabet(host, kind, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr;
      var state = { set: 'letters', tab: 'learn', index: 0, question: null, picked: null, score: 0, answered: 0, correct: 0 };
      var isPersian = kind === 'persian';
      var voice = isPersian ? PERSIAN_VOICE : GERMAN_VOICE;
      var langCode = isPersian ? 'fa-IR' : 'de-DE';

      function cards() {
        if (isPersian) return data.persian.alphabet;
        return state.set === 'combos' ? data.germanAlphabet.combos : data.germanAlphabet.letters;
      }
      function answerOf(card) {
        if (isPersian) return card.sound;
        return state.set === 'combos' ? localized(card.sound, opts) : card.name;
      }
      function newQuestion(previousId) {
        var list = cards();
        var pool = list.filter(function (card) { return card.id !== previousId; });
        var card = pick(pool);
        var answer = answerOf(card);
        var seen = {}; seen[answer] = true;
        var wrong = shuffle(list).map(answerOf).filter(function (a) { if (seen[a]) return false; seen[a] = true; return true; }).slice(0, 2);
        return { card: card, answer: answer, options: shuffle([answer].concat(wrong)) };
      }
      function isLong(text) { return chars(text).length > 4; }

      function render() {
        var list = cards();
        var card = list[Math.min(state.index, list.length - 1)];
        var setSwitch = isPersian ? '' :
          '<div class="px-switch">' +
            '<button type="button" data-set="letters" class="' + (state.set === 'letters' ? 'on' : '') + '">' + esc(tr('Letters', 'Буквы')) + '</button>' +
            '<button type="button" data-set="combos" class="' + (state.set === 'combos' ? 'on' : '') + '">' + esc(tr('Combinations', 'Сочетания')) + '</button>' +
          '</div>';
        var tabs = '<div class="px-tabs"><button type="button" data-tab="learn" class="' + (state.tab === 'learn' ? 'on' : '') + '">' + esc(tr('Learn', 'Учить')) + '</button><button type="button" data-tab="quiz" class="' + (state.tab === 'quiz' ? 'on' : '') + '">' + esc(tr('Quiz', 'Тест')) + '</button></div>';
        var body;
        if (state.tab === 'learn') {
          var hint = isPersian
            ? tr('Tap the letter to hear how a teacher says it. Persian is read right to left.', 'Нажмите на букву, чтобы услышать, как её называет учитель. Персидский читается справа налево.')
            : state.set === 'combos'
              ? tr('Tap the combination to hear two words with this sound.', 'Нажмите на сочетание, чтобы услышать два слова с этим звуком.')
              : tr('Tap the letter to hear how Germans spell it: “B wie Ball”.', 'Нажмите на букву, чтобы услышать, как немцы её называют: «B wie Ball».');
          var formsHtml = isPersian
            ? '<div class="px-panel"><h4>' + esc(tr('Shapes in a word', 'Формы в слове')) + '</h4><div class="px-forms">' +
                [tr('end', 'конец'), tr('middle', 'середина'), tr('start', 'начало'), tr('alone', 'отдельно')].map(function (label, i) {
                  return '<span>' + esc(card.forms[i]) + '<small>' + esc(label) + '</small></span>';
                }).join('') + '</div>' +
                (card.nonJoining ? '<div class="px-note">' + esc(tr('This letter never joins the next letter.', 'Эта буква не соединяется со следующей.')) + '</div>' : '') +
              '</div>'
            : '';
          body =
            '<p class="px-hint">' + esc(hint) + '</p>' +
            '<div class="px-hero"><button type="button" class="px-big' + (isLong(card.letter) ? ' long' : '') + '" data-play="letter">' + esc(card.letter) + ' <i>🔊</i></button>' +
              '<b>' + esc(card.name) + '</b><small>' + esc(tr('Sound', 'Звук')) + ': ' + esc(isPersian ? card.sound : localized(card.sound, opts) || card.sound) + '</small></div>' +
            formsHtml +
            '<div class="px-panel"><h4>' + esc(tr('Example', 'Пример')) + '</h4>' +
              '<button type="button" class="px-example" data-play="example"><div><b' + (isPersian ? ' dir="rtl"' : '') + '>' + esc(card.example) + '</b>' +
                (card.translit ? '<em>' + esc(card.translit) + '</em>' : '') +
                '<small>' + esc(localized(card.meaning, opts)) + '</small></div><span>🔊</span></button>' +
              (card.note ? '<div class="px-note">' + esc(localized(card.note, opts)) + '</div>' : '') +
            '</div>' +
            '<button type="button" class="btn primary" id="pxNext" style="width:100%;margin-bottom:12px">' + esc(state.set === 'combos' ? tr('Next combination', 'Следующее сочетание') : tr('Next letter', 'Следующая буква')) + ' →</button>' +
            '<div class="px-grid' + (isPersian ? ' rtl' : '') + '">' + list.map(function (item, i) {
              return '<button type="button" data-letter="' + i + '" class="' + (i === state.index ? 'on' : '') + '"><b class="' + (isLong(item.letter) ? 'long' : '') + '">' + esc(item.letter) + '</b><small>' + esc(answerOf(item)) + '</small></button>';
            }).join('') + '</div>';
        } else {
          if (!state.question) state.question = newQuestion();
          var q = state.question;
          var prompt = isPersian
            ? tr('Which sound does this letter make?', 'Какой звук у этой буквы?')
            : state.set === 'combos' ? tr('How is it read?', 'Как это читается?') : tr('What is this letter called?', 'Как называется эта буква?');
          body =
            '<div class="px-score"><span>' + esc(tr('Score', 'Очки')) + ': ' + state.score + '</span><span>' + state.answered + '/8</span></div>' +
            '<div class="px-card"><div class="px-prompt">' + esc(prompt) + '</div>' +
              '<div class="px-q' + (isLong(q.card.letter) ? ' long' : '') + (isPersian ? ' fa' : '') + '">' + esc(q.card.letter) + '</div>' +
              (q.card.quizHint ? '<div class="px-qhint">' + esc(q.card.quizHint) + '</div>' : '') +
              '<div class="px-options">' + q.options.map(function (option, i) {
                var cls = state.picked === null ? '' : option === q.answer ? 'ok' : option === state.picked ? 'bad' : '';
                return '<button type="button" data-option="' + i + '" class="' + cls + '"' + (state.picked !== null ? ' disabled' : '') + '>' + esc(option) + '</button>';
              }).join('') + '</div>' +
              (state.picked !== null
                ? '<div class="px-feedback ' + (state.picked === q.answer ? 'ok' : 'bad') + '">' + esc(state.picked === q.answer ? tr('Correct!', 'Верно!') + ' ' + q.card.example : tr('Not quite — it is ', 'Не совсем — это ') + '«' + q.answer + '».') + '</div>'
                : '') +
            '</div>' +
            '<button type="button" class="btn primary" id="pxNextQ" style="width:100%"' + (state.picked === null ? ' disabled' : '') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        }
        host.innerHTML = setSwitch + tabs + body;
        wire();
      }

      function play(which) {
        var card = cards()[state.index];
        if (which === 'letter') opts.playClip(card.audio, card.speech, voice, langCode);
        else opts.playClip(card.exampleAudio, card.exampleSpeech, voice, langCode);
      }

      function wire() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-set]'), function (b) {
          b.onclick = function () { state.set = b.getAttribute('data-set'); state.index = 0; state.question = null; state.picked = null; state.answered = 0; state.correct = 0; render(); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-tab]'), function (b) {
          b.onclick = function () { state.tab = b.getAttribute('data-tab'); render(); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-play]'), function (b) {
          b.onclick = function () { play(b.getAttribute('data-play')); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-letter]'), function (b) {
          b.onclick = function () { state.index = Number(b.getAttribute('data-letter')); render(); };
        });
        var next = host.querySelector('#pxNext');
        if (next) next.onclick = function () { state.index = (state.index + 1) % cards().length; render(); };
        Array.prototype.forEach.call(host.querySelectorAll('[data-option]'), function (b) {
          b.onclick = function () {
            if (state.picked !== null) return;
            state.picked = state.question.options[Number(b.getAttribute('data-option'))];
            state.answered += 1;
            if (state.picked === state.question.answer) { state.score += 10; state.correct += 1; }
            render();
          };
        });
        var nextQ = host.querySelector('#pxNextQ');
        if (nextQ) nextQ.onclick = function () {
          if (state.answered >= 8) return opts.finish(state.correct, 8, tr('Alphabet round', 'Раунд по алфавиту'));
          state.question = newQuestion(state.question.card.id);
          state.picked = null;
          render();
        };
      }

      render();
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  // ── Persian: reading & letters ────────────────────────────────────────────────
  var VOWEL_SWAP = { a: 'e', e: 'o', o: 'a' };
  function vowelVariant(translit) {
    var index = translit.search(/[aeo]/);
    if (index < 0) return null;
    return translit.slice(0, index) + VOWEL_SWAP[translit[index]] + translit.slice(index + 1);
  }

  function renderPersianReading(host, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr, words = data.persian.readingWords;
      var buildWords = words.filter(function (w) { var n = chars(w.fa).length; return n >= 2 && n <= 5; });
      var state = { tab: 'read', mode: 'vowelled', q: null, picked: null, answered: 0, correct: 0, build: null };

      function readQuestion(previous) {
        var word = pick(words.filter(function (w) { return w.fa !== previous; }));
        var real = {}; words.forEach(function (w) { real[w.translit] = true; });
        var wrong = [];
        var variant = state.mode === 'vowelled' ? vowelVariant(word.translit) : null;
        if (variant && !real[variant]) wrong.push(variant);
        var similar = shuffle(words.filter(function (w) { return w.translit !== word.translit; }))
          .sort(function (a, b) { return Math.abs(a.translit.length - word.translit.length) - Math.abs(b.translit.length - word.translit.length); })
          .slice(0, 4);
        shuffle(similar).forEach(function (w) { if (wrong.length < 2 && wrong.indexOf(w.translit) < 0) wrong.push(w.translit); });
        return { word: word, options: shuffle([word.translit].concat(wrong)) };
      }
      function buildTask(previous) {
        var word = pick(buildWords.filter(function (w) { return w.fa !== previous; }));
        return { word: word, tiles: shuffle(chars(word.fa).map(function (letter, i) { return { key: i + '-' + letter, letter: letter }; })), used: [], wrongKey: null, mistakes: 0 };
      }
      function play(word) { opts.playClip(word.audio, word.speech, PERSIAN_VOICE, 'fa-IR'); }

      function render() {
        var tabs = '<div class="px-tabs"><button type="button" data-tab="read" class="' + (state.tab === 'read' ? 'on' : '') + '">' + esc(tr('Read', 'Читать')) + '</button><button type="button" data-tab="build" class="' + (state.tab === 'build' ? 'on' : '') + '">' + esc(tr('Build a word', 'Собрать слово')) + '</button></div>';
        var body;
        if (state.tab === 'read') {
          if (!state.q) state.q = readQuestion();
          var q = state.q, ok = state.picked === q.word.translit;
          body =
            '<div class="px-switch"><button type="button" data-mode="vowelled" class="' + (state.mode === 'vowelled' ? 'on' : '') + '">' + esc(tr('With vowel marks', 'С огласовками')) + '</button><button type="button" data-mode="plain" class="' + (state.mode === 'plain' ? 'on' : '') + '">' + esc(tr('Without marks', 'Без огласовок')) + '</button></div>' +
            '<p class="px-hint">' + esc(state.mode === 'vowelled'
              ? tr('The small marks are short vowels: بَ ba, بِ be, بُ bo.', 'Маленькие значки — короткие гласные: بَ ba, بِ be, بُ bo.')
              : tr('Short vowels are usually not written: recognise the word by its consonants and long vowels (ا â, و u, ی i).', 'Короткие гласные обычно не пишут: узнавайте слово по согласным и долгим гласным (ا â, و u, ی i).')) + '</p>' +
            '<div class="px-score"><span>' + esc(tr('Score', 'Очки')) + ': ' + state.correct * 10 + '</span><span>' + state.answered + '/8</span></div>' +
            '<div class="px-card"><div class="px-prompt">' + esc(tr('How is this word read?', 'Как читается это слово?')) + '</div>' +
              '<div class="px-q fa">' + esc(state.mode === 'vowelled' ? q.word.vowelled : q.word.fa) + '</div>' +
              '<div class="px-options">' + q.options.map(function (option, i) {
                var cls = state.picked === null ? '' : option === q.word.translit ? 'ok' : option === state.picked ? 'bad' : '';
                return '<button type="button" data-option="' + i + '" class="' + cls + '"' + (state.picked !== null ? ' disabled' : '') + '>' + esc(option) + '</button>';
              }).join('') + '</div>' +
              (state.picked !== null ? '<div class="px-feedback ' + (ok ? 'ok' : 'bad') + '">' + esc(ok ? tr('Correct!', 'Верно!') : tr('Not quite — it is ', 'Не совсем — это ') + '«' + q.word.translit + '».') + '</div><div class="px-note">' + esc(localized(q.word.meaning, opts)) + ' <button type="button" class="st-chip" data-play-word="1">🔊</button></div>' : '') +
            '</div>' +
            '<button type="button" class="btn primary" id="pxNextQ" style="width:100%"' + (state.picked === null ? ' disabled' : '') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        } else {
          if (!state.build) state.build = buildTask();
          var b = state.build, letters = chars(b.word.fa), done = b.used.length === letters.length;
          body =
            '<p class="px-hint">' + esc(tr('Persian is written right to left. Tap the letters in order — they join by themselves.', 'Персидский пишется справа налево. Нажимайте буквы по порядку — они соединятся сами.')) + '</p>' +
            '<div class="px-score"><span>' + esc(tr('Score', 'Очки')) + ': ' + state.correct * 10 + '</span><span>' + state.answered + '/6</span></div>' +
            '<div class="px-card"><div class="px-prompt">' + esc(tr('Build the word', 'Соберите слово')) + '</div>' +
              '<div><b style="font-size:22px">' + esc(localized(b.word.meaning, opts)) + '</b> · <em style="color:#0F9F7A;font-style:normal;font-weight:900">' + esc(b.word.translit) + '</em> <button type="button" class="st-chip" data-play-word="1">🔊</button></div>' +
              '<div class="px-built' + (done ? ' ok' : '') + '"><b>' + esc(letters.slice(0, b.used.length).join('') || ' ') + '</b><small>' + b.used.length + '/' + letters.length + '</small></div>' +
              '<div class="px-tiles">' + b.tiles.map(function (tile) {
                var used = b.used.indexOf(tile.key) >= 0;
                return '<button type="button" data-tile="' + esc(tile.key) + '" class="' + (used ? 'used' : '') + (b.wrongKey === tile.key ? ' bad' : '') + '"' + (used || done ? ' disabled' : '') + '>' + esc(tile.letter) + '</button>';
              }).join('') + '</div>' +
              (done ? '<div class="px-feedback ok">' + esc(tr('Well done!', 'Отлично!')) + '</div>' : '') +
            '</div>' +
            '<button type="button" class="btn primary" id="pxNextBuild" style="width:100%"' + (done ? '' : ' disabled') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        }
        host.innerHTML = tabs + body;
        wire();
      }

      function wire() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-tab]'), function (btn) {
          btn.onclick = function () { state.tab = btn.getAttribute('data-tab'); state.answered = 0; state.correct = 0; render(); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-mode]'), function (btn) {
          btn.onclick = function () { state.mode = btn.getAttribute('data-mode'); state.q = readQuestion(state.q && state.q.word.fa); state.picked = null; state.answered = 0; state.correct = 0; render(); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-play-word]'), function (btn) {
          btn.onclick = function () { play(state.tab === 'read' ? state.q.word : state.build.word); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-option]'), function (btn) {
          btn.onclick = function () {
            if (state.picked !== null) return;
            state.picked = state.q.options[Number(btn.getAttribute('data-option'))];
            state.answered += 1;
            if (state.picked === state.q.word.translit) state.correct += 1;
            play(state.q.word);
            render();
          };
        });
        var nextQ = host.querySelector('#pxNextQ');
        if (nextQ) nextQ.onclick = function () {
          if (state.answered >= 8) return opts.finish(state.correct, 8, tr('Reading round', 'Раунд чтения'));
          state.q = readQuestion(state.q.word.fa); state.picked = null; render();
        };
        Array.prototype.forEach.call(host.querySelectorAll('[data-tile]'), function (btn) {
          btn.onclick = function () {
            var b = state.build, letters = chars(b.word.fa);
            var tile = b.tiles.find(function (t) { return t.key === btn.getAttribute('data-tile'); });
            if (!tile || b.used.indexOf(tile.key) >= 0) return;
            if (tile.letter !== letters[b.used.length]) {
              b.wrongKey = tile.key; b.mistakes += 1; render();
              setTimeout(function () { if (state.build === b) { b.wrongKey = null; render(); } }, 600);
              return;
            }
            b.used.push(tile.key);
            if (b.used.length === letters.length) {
              state.answered += 1;
              if (!b.mistakes) state.correct += 1;
              play(b.word);
            }
            render();
          };
        });
        var nextBuild = host.querySelector('#pxNextBuild');
        if (nextBuild) nextBuild.onclick = function () {
          if (state.answered >= 6) return opts.finish(state.correct, 6, tr('Word-building round', 'Раунд сборки слов'));
          state.build = buildTask(state.build.word.fa); render();
        };
      }

      render();
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  // ── Persian: listening ────────────────────────────────────────────────────────
  function renderPersianListening(host, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr, words = data.persian.listeningWords;
      var alphabet = data.persian.alphabet.map(function (l) { return l.letter; });
      var dictation = words.filter(function (w) { var n = chars(w.fa).length; return n >= 2 && n <= 6 && !/[\s‌]/.test(w.fa); });
      var state = { tab: 'choose', q: null, picked: null, task: null, typed: [], checked: null, answered: 0, correct: 0 };

      function chooseQuestion(previous) {
        var word = pick(words.filter(function (w) { return w.fa !== previous; }));
        var len = chars(word.fa).length;
        var others = shuffle(words.filter(function (w) { return w.fa !== word.fa; }))
          .sort(function (a, b) {
            var ca = Math.abs(chars(a.fa).length - len) + (a.fa[0] === word.fa[0] ? 0 : 2);
            var cb = Math.abs(chars(b.fa).length - len) + (b.fa[0] === word.fa[0] ? 0 : 2);
            return ca - cb;
          }).slice(0, 5);
        return { word: word, options: shuffle([word.fa].concat(shuffle(others).slice(0, 2).map(function (w) { return w.fa; }))) };
      }
      function dictationTask(previous) {
        var word = pick(dictation.filter(function (w) { return w.fa !== previous; }));
        var letters = chars(word.fa);
        var extra = shuffle(alphabet.filter(function (l) { return letters.indexOf(l) < 0; })).slice(0, 3);
        return { word: word, tiles: shuffle(letters.concat(extra)).map(function (letter, i) { return { key: i + '-' + letter, letter: letter }; }) };
      }
      function current() { return state.tab === 'choose' ? state.q.word : state.task.word; }
      function play() { var w = current(); opts.playClip(w.audio, w.speech, PERSIAN_VOICE, 'fa-IR'); }
      function reveal(word) {
        return '<div class="px-note" style="text-align:center"><b dir="rtl" style="font-size:30px;color:#7B47E6">' + esc(word.fa) + '</b><br>' + esc(word.translit + ' · ' + localized(word.meaning, opts)) + '</div>';
      }
      function count(ok) {
        state.answered += 1;
        if (ok) state.correct += 1;
      }

      function render(autoplay) {
        if (state.tab === 'choose' && !state.q) state.q = chooseQuestion();
        if (state.tab === 'write' && !state.task) state.task = dictationTask();
        var tabs = '<div class="px-tabs"><button type="button" data-tab="choose" class="' + (state.tab === 'choose' ? 'on' : '') + '">' + esc(tr('Choose', 'Выбрать')) + '</button><button type="button" data-tab="write" class="' + (state.tab === 'write' ? 'on' : '') + '">' + esc(tr('Dictation', 'Диктант')) + '</button></div>';
        var head = '<p class="px-hint">' + esc(tr('No transliteration here — only your ears.', 'Здесь нет транслита — только на слух.')) + '</p>' +
          '<div class="px-score"><span>' + esc(tr('Score', 'Очки')) + ': ' + state.correct * 10 + '</span><span>' + state.answered + '/8</span></div>';
        var playBtn = '<button type="button" class="px-play" id="pxPlay" aria-label="' + esc(tr('Play again', 'Ещё раз')) + '">🔊</button>';
        var body;
        if (state.tab === 'choose') {
          var q = state.q, ok = state.picked === q.word.fa;
          body = '<div class="px-card"><div class="px-prompt">' + esc(tr('Listen and pick the word', 'Послушайте и выберите слово')) + '</div>' + playBtn +
            '<div class="px-options">' + q.options.map(function (option, i) {
              var cls = 'fa ' + (state.picked === null ? '' : option === q.word.fa ? 'ok' : option === state.picked ? 'bad' : '');
              return '<button type="button" data-option="' + i + '" class="' + cls + '"' + (state.picked !== null ? ' disabled' : '') + ' dir="rtl">' + esc(option) + '</button>';
            }).join('') + '</div>' +
            (state.picked !== null ? '<div class="px-feedback ' + (ok ? 'ok' : 'bad') + '">' + esc(ok ? tr('Correct!', 'Верно!') : tr('Not quite.', 'Не совсем.')) + '</div>' + reveal(q.word) : '') +
            '</div><button type="button" class="btn primary" id="pxNextQ" style="width:100%"' + (state.picked === null ? ' disabled' : '') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        } else {
          var t = state.task, typed = state.typed.map(function (key) { return t.tiles.find(function (tile) { return tile.key === key; }).letter; }).join('');
          body = '<div class="px-card"><div class="px-prompt">' + esc(tr('Listen and spell the word', 'Послушайте и соберите слово')) + '</div>' + playBtn +
            '<div class="px-built' + (state.checked === true ? ' ok' : state.checked === false ? ' bad' : '') + '"><b>' + esc(typed || ' ') + '</b><small>' + chars(typed).length + '/' + chars(t.word.fa).length + '</small></div>' +
            '<div class="px-tiles">' + t.tiles.map(function (tile) {
              var used = state.typed.indexOf(tile.key) >= 0;
              return '<button type="button" data-tile="' + esc(tile.key) + '" class="' + (used ? 'used' : '') + '"' + (used || state.checked !== null ? ' disabled' : '') + '>' + esc(tile.letter) + '</button>';
            }).join('') + '</div>' +
            (state.checked === null
              ? '<div class="px-actions"><button type="button" class="btn" id="pxErase"' + (state.typed.length ? '' : ' disabled') + '>⌫ ' + esc(tr('Erase', 'Стереть')) + '</button><button type="button" class="btn primary" id="pxCheck"' + (state.typed.length ? '' : ' disabled') + '>' + esc(tr('Check', 'Проверить')) + '</button></div>'
              : '<div class="px-feedback ' + (state.checked ? 'ok' : 'bad') + '">' + esc(state.checked ? tr('Correct!', 'Верно!') : tr('Not quite.', 'Не совсем.')) + '</div>' + reveal(t.word)) +
            '</div><button type="button" class="btn primary" id="pxNextWrite" style="width:100%"' + (state.checked === null ? ' disabled' : '') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        }
        host.innerHTML = tabs + head + body;
        wire();
        if (autoplay) play();
      }

      function next() {
        if (state.answered >= 8) return opts.finish(state.correct, 8, tr('Listening round', 'Раунд аудирования'));
        if (state.tab === 'choose') { state.q = chooseQuestion(state.q.word.fa); state.picked = null; }
        else { state.task = dictationTask(state.task.word.fa); state.typed = []; state.checked = null; }
        render(true);
      }

      function wire() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-tab]'), function (btn) {
          btn.onclick = function () { state.tab = btn.getAttribute('data-tab'); state.answered = 0; state.correct = 0; render(true); };
        });
        var playBtn = host.querySelector('#pxPlay');
        if (playBtn) playBtn.onclick = play;
        Array.prototype.forEach.call(host.querySelectorAll('[data-option]'), function (btn) {
          btn.onclick = function () {
            if (state.picked !== null) return;
            state.picked = state.q.options[Number(btn.getAttribute('data-option'))];
            count(state.picked === state.q.word.fa);
            render();
          };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-tile]'), function (btn) {
          btn.onclick = function () { state.typed.push(btn.getAttribute('data-tile')); render(); };
        });
        var erase = host.querySelector('#pxErase');
        if (erase) erase.onclick = function () { state.typed.pop(); render(); };
        var check = host.querySelector('#pxCheck');
        if (check) check.onclick = function () {
          var t = state.task, typed = state.typed.map(function (key) { return t.tiles.find(function (tile) { return tile.key === key; }).letter; }).join('');
          state.checked = typed === t.word.fa;
          count(state.checked);
          render();
        };
        ['#pxNextQ', '#pxNextWrite'].forEach(function (id) { var b = host.querySelector(id); if (b) b.onclick = next; });
      }

      render(true);
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  // ── Persian: numbers, time, money ─────────────────────────────────────────────
  var PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  function toPersianDigits(text) { return String(text).replace(/[0-9]/g, function (d) { return PERSIAN_DIGITS[Number(d)]; }); }

  function renderPersianNumbers(host, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr, items = data.persian.numbers;
      var state = { section: 'numbers', tab: 'learn', q: null, picked: null, answered: 0, correct: 0 };

      function answerOf(item) { return item.value || localized(item.meaning, opts) || item.translit; }
      function question(previous) {
        var inSection = items.filter(function (i) { return i.section === state.section; });
        var byValue = inSection.filter(function (i) { return i.value; });
        var byMeaning = inSection.filter(function (i) { return !i.value; });
        var askable = (byValue.length >= 3 ? byValue : []).concat(byMeaning.length >= 3 ? byMeaning : []);
        var item = pick(askable.filter(function (i) { return i.id !== previous; }));
        var group = item.value ? byValue : byMeaning;
        var answer = answerOf(item);
        var seen = {}; seen[answer] = true;
        var wrong = shuffle(group).map(answerOf).filter(function (a) { if (seen[a]) return false; seen[a] = true; return true; }).slice(0, 2);
        var kinds = state.section === 'numbers' ? ['listen', 'script', 'digits'] : ['listen', 'script'];
        return { item: item, answer: answer, kind: pick(kinds), options: shuffle([answer].concat(wrong)) };
      }
      function play(item) { opts.playClip(item.audio, item.speech, PERSIAN_VOICE, 'fa-IR'); }

      function render(autoplay) {
        var sections = '<div class="px-switch">' + [['numbers', tr('Numbers', 'Числа')], ['time', tr('Time', 'Время')], ['money', tr('Money', 'Деньги')]].map(function (s) {
          return '<button type="button" data-section="' + s[0] + '" class="' + (state.section === s[0] ? 'on' : '') + '">' + esc(s[1]) + '</button>';
        }).join('') + '</div>';
        var tabs = '<div class="px-tabs"><button type="button" data-tab="learn" class="' + (state.tab === 'learn' ? 'on' : '') + '">' + esc(tr('Learn', 'Учить')) + '</button><button type="button" data-tab="quiz" class="' + (state.tab === 'quiz' ? 'on' : '') + '">' + esc(tr('Quiz', 'Тест')) + '</button></div>';
        var body;
        if (state.tab === 'learn') {
          body = (state.section === 'numbers' ? '<p class="px-hint">' + esc(tr('Persian digits: ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹. Numbers are written left to right, even inside Persian text.', 'Персидские цифры: ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹. Числа пишутся слева направо, даже внутри персидского текста.')) + '</p>' : '') +
            items.filter(function (i) { return i.section === state.section; }).map(function (item, index) {
              return '<button type="button" class="px-row" data-row="' + index + '">' +
                (item.value ? '<span class="px-value"><b>' + esc(item.value) + '</b>' + (item.section !== 'money' ? '<span>' + esc(toPersianDigits(item.value)) + '</span>' : '') + '</span>' : '') +
                '<span class="px-row-text"><span class="fa" dir="rtl">' + esc(item.fa) + '</span><em>' + esc(item.translit) + '</em>' +
                  (item.meaning ? '<small>' + esc(localized(item.meaning, opts)) + '</small>' : '') +
                  (item.note ? '<small>' + esc(localized(item.note, opts)) + '</small>' : '') +
                '</span>🔊</button>';
            }).join('');
        } else {
          if (!state.q) state.q = question();
          var q = state.q, ok = state.picked === q.answer;
          var prompt = q.kind === 'listen' ? tr('What do you hear?', 'Что вы слышите?') : q.kind === 'digits' ? tr('Which number is this?', 'Какое это число?') : tr('What does it say?', 'Что здесь написано?');
          var shown = q.kind === 'listen'
            ? '<button type="button" class="px-play" id="pxPlay">🔊</button>'
            : '<div class="px-q' + (q.kind === 'digits' ? '' : ' fa long') + '">' + esc(q.kind === 'digits' ? toPersianDigits(q.answer) : q.item.fa) + '</div>';
          body = '<div class="px-score"><span>' + esc(tr('Score', 'Очки')) + ': ' + state.correct * 10 + '</span><span>' + state.answered + '/8</span></div>' +
            '<div class="px-card"><div class="px-prompt">' + esc(prompt) + '</div>' + shown +
              '<div class="px-options">' + q.options.map(function (option, i) {
                var cls = state.picked === null ? '' : option === q.answer ? 'ok' : option === state.picked ? 'bad' : '';
                return '<button type="button" data-option="' + i + '" class="' + cls + '"' + (state.picked !== null ? ' disabled' : '') + '>' + esc(option) + '</button>';
              }).join('') + '</div>' +
              (state.picked !== null ? '<div class="px-feedback ' + (ok ? 'ok' : 'bad') + '">' + esc(ok ? tr('Correct!', 'Верно!') : tr('Not quite — it is ', 'Не совсем — это ') + '«' + q.answer + '».') + '</div><div class="px-note"><b dir="rtl">' + esc(q.item.fa) + '</b> · ' + esc(q.item.translit) + '</div>' : '') +
            '</div><button type="button" class="btn primary" id="pxNextQ" style="width:100%"' + (state.picked === null ? ' disabled' : '') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        }
        host.innerHTML = sections + tabs + body;
        wire();
        if (autoplay && state.tab === 'quiz' && state.q && state.q.kind === 'listen') play(state.q.item);
      }

      function wire() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-section]'), function (b) {
          b.onclick = function () { state.section = b.getAttribute('data-section'); state.q = null; state.picked = null; render(true); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-tab]'), function (b) {
          b.onclick = function () { state.tab = b.getAttribute('data-tab'); render(true); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-row]'), function (b) {
          b.onclick = function () { play(items.filter(function (i) { return i.section === state.section; })[Number(b.getAttribute('data-row'))]); };
        });
        var playBtn = host.querySelector('#pxPlay');
        if (playBtn) playBtn.onclick = function () { play(state.q.item); };
        Array.prototype.forEach.call(host.querySelectorAll('[data-option]'), function (b) {
          b.onclick = function () {
            if (state.picked !== null) return;
            state.picked = state.q.options[Number(b.getAttribute('data-option'))];
            state.answered += 1;
            if (state.picked === state.q.answer) state.correct += 1;
            if (state.q.kind !== 'listen') play(state.q.item);
            render();
          };
        });
        var nextQ = host.querySelector('#pxNextQ');
        if (nextQ) nextQ.onclick = function () {
          if (state.answered >= 8) return opts.finish(state.correct, 8, tr('Numbers round', 'Раунд по числам'));
          state.q = question(state.q.item.id); state.picked = null; render(true);
        };
      }

      render();
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  // ── STELLA: build a sentence with a word card ─────────────────────────────────
  var LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  // Same order as the app: the learner's level first, then the level below, then above,
  // until there are at least twelve words.
  function stellaDeck(bank, level) {
    var home = LEVELS.indexOf(String(level || 'A1').toUpperCase());
    if (home < 0) home = 0;
    var order = [LEVELS[home]];
    for (var d = 1; d < LEVELS.length; d++) {
      if (home - d >= 0) order.push(LEVELS[home - d]);
      if (home + d < LEVELS.length) order.push(LEVELS[home + d]);
    }
    var seen = {}, deck = [];
    for (var i = 0; i < order.length; i++) {
      shuffle(bank[order[i]] || []).forEach(function (card) {
        var key = card.word.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        deck.push(Object.assign({ level: order[i] }, card));
      });
      if (deck.length >= 12) break;
    }
    return deck;
  }

  function scoreColors(score) {
    if (score >= 90) return ['#D1FAE5', '#0E9F6E'];
    if (score >= 70) return ['#E0F2FE', '#0284C7'];
    if (score >= 40) return ['#FEF3C7', '#D97706'];
    return ['#FEE2E2', '#E11D48'];
  }

  // opts: { esc, tr, isRu, lang ('de'|'en'|'es'), level, nativeLocale, locale, supa,
  //         avatarHtml, speak(text), isSaved(word), saveWord(word, translation), awardXp(xp), onEnd(results) }
  function renderStella(host, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr;
      var bank = data.stella[opts.lang] || data.stella.de;
      var state = {
        deck: stellaDeck(bank, opts.level), index: 0, shown: 1,
        log: [], results: [], awaiting: false, finished: false, busy: false, error: null, hint: false,
      };
      state.log.push({ kind: 'bot', text: tr("Hi, I'm STELLA! I'll show you a word of your level — build a sentence with it. I'll score it and show a better version. Tap «Finish» whenever you like.", 'Привет, я STELLA! Я покажу слово твоего уровня — составь с ним предложение. Я оценю его и покажу вариант получше. Нажми «Завершить», когда захочешь.') });
      state.log.push({ kind: 'card', card: state.deck[0], n: 1 });

      function current() { return state.deck[state.index]; }
      function verdictLabel(v) {
        return v === 'great' ? tr('Excellent!', 'Отлично!') : v === 'good' ? tr('Good', 'Хорошо') : v === 'fix' ? tr('Almost — small fixes', 'Почти — есть ошибки') : tr('Try again', 'Попробуй ещё раз');
      }
      function saveButton(word, translation) {
        if (opts.isSaved(word)) return '<span class="st-chip done">✓ ' + esc(tr('In My words', 'В моих словах')) + '</span>';
        return '<button type="button" class="st-chip" data-save="' + esc(word) + '" data-save-t="' + esc(translation || '') + '">🔖 ' + esc(tr('Add to My words', 'В мои слова')) + '</button>';
      }
      function cardHtml(entry, isCurrent) {
        var card = entry.card;
        return '<div class="st-word"><div class="st-word-head"><div><b>' + esc(tr('Build a sentence with this word', 'Составь предложение с этим словом')) + '</b><small>' + esc(tr('Write it or say it with the mic', 'Напиши или скажи в микрофон')) + '</small></div><span>' + entry.n + '</span></div>' +
          '<div class="st-face"><b>' + esc(card.word) + '</b><button type="button" data-speak="' + esc(card.word) + '" aria-label="Listen">🔊</button></div>' +
          '<div class="st-meta"><span class="st-level">' + esc(card.level) + '</span>' + (card.pos ? '<span class="st-pos">' + esc(card.pos) + '</span>' : '') + '<b>' + esc(card.meaning) + '</b></div>' +
          (card.example && isCurrent && state.hint ? '<div class="st-example"><small>' + esc(tr('Example', 'Пример')) + '</small><br>' + esc(card.example) + '</div>' : '') +
          '<div class="st-meta">' + (card.example && isCurrent && !state.hint ? '<button type="button" class="st-chip" data-hint="1">💡 ' + esc(tr('Show an example', 'Показать пример')) + '</button>' : '') + saveButton(card.word, card.meaning) + '</div></div>';
      }
      function resultHtml(entry) {
        var r = entry.result, c = scoreColors(r.score);
        return '<div class="st-result"><div class="st-score"><strong style="background:' + c[0] + ';color:' + c[1] + '">' + r.score + '<small>/100</small></strong><div><b style="color:' + c[1] + '">' + esc(verdictLabel(r.verdict)) + '</b>' + (r.meaning ? '<br><small>' + esc(r.meaning) + '</small>' : '') + '</div></div>' +
          (r.usesWord === false ? '<div class="st-warn">' + esc(tr('The card word is missing in your sentence.', 'В предложении нет слова с карточки.')) + '</div>' : '') +
          (r.correction ? '<div>🔧 ' + esc(r.correction) + '</div>' : '') +
          (r.betterVersion ? '<button type="button" class="st-better" data-speak="' + esc(r.betterVersion) + '"><span style="flex:1"><small>' + esc(r.score >= 90 ? tr('Another way to say it', 'Ещё вариант') : tr('Better version', 'Лучший вариант')) + '</small>' + esc(r.betterVersion) + '</span>🔊</button>' : '') +
          '<div class="st-meta">' + saveButton(entry.card.word, r.meaning || entry.card.meaning) + '</div></div>';
      }
      function summaryHtml() {
        var results = state.results;
        if (!results.length) return '';
        var avg = Math.round(results.reduce(function (s, r) { return s + r.score; }, 0) / results.length);
        var strong = results.filter(function (r) { return r.score >= 90; }).map(function (r) { return r.card.word; });
        var review = results.filter(function (r) { return r.score < 70; }).map(function (r) { return r.card.word; });
        var c = scoreColors(avg);
        return '<div class="st-result"><b style="font-size:18px">' + esc(tr('Round result', 'Итог раунда')) + '</b><div class="st-score" style="margin-top:8px"><strong style="background:rgba(109,61,245,.12);color:#6D3DF5">' + results.length + '</strong><small>' + esc(tr('sentences', 'предложений')) + '</small><strong style="background:' + c[0] + ';color:' + c[1] + '">' + avg + '</strong><small>' + esc(tr('average score', 'средний балл')) + '</small></div>' +
          (strong.length ? '<div>⭐ ' + esc(tr('Perfect sentences', 'Идеальные предложения')) + ': <b>' + esc(strong.join(' · ')) + '</b></div>' : '') +
          (review.length ? '<div>🔁 ' + esc(tr('Words to practise again', 'Слова, которые стоит повторить')) + ': <b>' + esc(review.join(' · ')) + '</b></div><div class="st-meta"><button type="button" class="st-chip" data-save-review="1">🔖 ' + esc(tr('Save these words to My words', 'Сохранить эти слова в «Мои слова»')) + '</button></div>' : '') +
          '</div>';
      }

      function render() {
        var lastCardIndex = -1;
        state.log.forEach(function (entry, i) { if (entry.kind === 'card') lastCardIndex = i; });
        var log = state.log.map(function (entry, i) {
          if (entry.kind === 'me') return '<div class="st-bubble me"><div>' + esc(entry.text) + '</div></div>';
          if (entry.kind === 'card') return cardHtml(entry, i === lastCardIndex && !state.finished);
          if (entry.kind === 'result') return '<div class="st-bubble">' + opts.avatarHtml() + '<div>' + esc(entry.result.comment || tr('Here is my check:', 'Вот моя проверка:')) + '</div></div>' + resultHtml(entry);
          if (entry.kind === 'summary') return summaryHtml();
          return '<div class="st-bubble">' + opts.avatarHtml() + '<div>' + esc(entry.text) + '</div></div>';
        }).join('') + (state.busy ? '<div class="st-bubble">' + opts.avatarHtml() + '<div>…</div></div>' : '');
        var dock = state.finished
          ? '<button type="button" class="btn primary" data-act="restart">🔄 ' + esc(tr('New round', 'Новый раунд')) + '</button>'
          : state.awaiting
            ? '<button type="button" class="btn" data-act="retry">🔁 ' + esc(tr('Try this word again', 'Ещё раз с этим словом')) + '</button><button type="button" class="btn" data-act="next">➡️ ' + esc(tr('Next word', 'Следующее слово')) + '</button>'
            : '<button type="button" class="btn" data-act="next">⏭ ' + esc(tr('Another word', 'Другое слово')) + '</button><button type="button" class="btn" data-act="finish">🏁 ' + esc(tr('Finish', 'Завершить')) + '</button>';
        host.innerHTML =
          '<div class="st-log" id="stLog">' + log + '</div>' +
          (state.error ? '<div style="color:#d64545;font-weight:800;margin:6px 0">' + esc(state.error) + '</div>' : '') +
          '<div class="st-dock">' + dock + '</div>' +
          (state.finished ? '' :
            '<div style="display:flex;gap:8px"><input id="stInput" placeholder="' + esc(tr('Your sentence…', 'Твоё предложение…')) + '" style="flex:1" autocomplete="off"' + (state.busy ? ' disabled' : '') + '>' +
            '<button class="btn" id="stMic" type="button" aria-label="Voice answer">🎙</button>' +
            '<button class="btn primary" id="stSend"' + (state.busy ? ' disabled' : '') + '>' + esc(tr('Check', 'Проверить')) + '</button></div>') +
          '<button class="btn" id="stEnd" style="width:100%;margin-top:10px">' + esc(tr('End session', 'Завершить сессию')) + '</button>';
        var logEl = host.querySelector('#stLog');
        if (logEl) logEl.scrollTop = logEl.scrollHeight;
        wire();
      }

      function showNext() {
        state.index += 1;
        if (state.index >= state.deck.length) { state.deck = stellaDeck(bank, opts.level); state.index = 0; }
        state.shown += 1;
        state.awaiting = false;
        state.hint = false;
        state.log.push({ kind: 'card', card: current(), n: state.shown });
        render();
        opts.speak(current().word);
      }

      async function check(sentence) {
        var card = current();
        if (!card || state.busy || state.finished) return;
        state.log.push({ kind: 'me', text: sentence });
        state.busy = true; state.error = null; render();
        try {
          var res = await opts.supa.functions.invoke('openai-assistant', {
            body: {
              action: 'evaluate_word_sentence',
              level: card.level, locale: opts.locale, meaning: card.meaning, nativeLocale: opts.nativeLocale,
              partOfSpeech: card.pos || '', sentence: sentence, word: card.word,
            },
          });
          if (res.error) throw res.error;
          var result = res.data || {};
          state.results.push({ card: card, score: Number(result.score) || 0 });
          state.log.push({ kind: 'result', card: card, result: result });
          if (result.score >= 70) opts.awardXp(10);
          state.busy = false;
          if (result.score >= 70) showNext();
          else { state.awaiting = true; render(); }
        } catch (error) {
          state.log.pop();
          state.busy = false;
          state.error = (error && error.message) || tr('STELLA could not check it. Try again.', 'STELLA не смогла проверить. Попробуйте ещё раз.');
          render();
          var input = host.querySelector('#stInput');
          if (input) input.value = sentence;
        }
      }

      function wire() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-speak]'), function (b) { b.onclick = function () { opts.speak(b.getAttribute('data-speak')); }; });
        Array.prototype.forEach.call(host.querySelectorAll('[data-hint]'), function (b) { b.onclick = function () { state.hint = true; render(); }; });
        Array.prototype.forEach.call(host.querySelectorAll('[data-save]'), function (b) {
          b.onclick = function () { opts.saveWord(b.getAttribute('data-save'), b.getAttribute('data-save-t')); render(); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-save-review]'), function (b) {
          b.onclick = function () {
            state.results.filter(function (r) { return r.score < 70; }).forEach(function (r) { if (!opts.isSaved(r.card.word)) opts.saveWord(r.card.word, r.card.meaning); });
            render();
          };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-act]'), function (b) {
          b.onclick = function () {
            var act = b.getAttribute('data-act');
            if (act === 'next') showNext();
            else if (act === 'retry') {
              state.awaiting = false;
              state.log.push({ kind: 'bot', text: tr('Try once more with «', 'Попробуй ещё раз со словом «') + current().word + '».' });
              render();
              var input = host.querySelector('#stInput'); if (input) input.focus();
            } else if (act === 'finish') {
              state.finished = true; state.awaiting = false;
              if (state.results.length) state.log.push({ kind: 'bot', text: tr('Great work! Here is your round:', 'Отличная работа! Вот итог раунда:') }, { kind: 'summary' });
              else state.log.push({ kind: 'bot', text: tr('No sentences yet — start a new round whenever you like.', 'Пока нет предложений — начни новый раунд, когда захочешь.') });
              render();
            } else if (act === 'restart') {
              renderStella(host, opts);
            }
          };
        });
        var input = host.querySelector('#stInput');
        function send() { var text = input && input.value.trim(); if (!text) return; input.value = ''; check(text); }
        var sendBtn = host.querySelector('#stSend');
        if (sendBtn) sendBtn.onclick = send;
        if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
        var mic = host.querySelector('#stMic');
        if (mic) mic.onclick = function () {
          var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!Recognition) { state.error = tr('Voice input is unavailable in this browser.', 'Голосовой ввод недоступен в этом браузере.'); render(); return; }
          var recognition = new Recognition();
          recognition.lang = opts.locale;
          mic.textContent = '●'; mic.disabled = true;
          recognition.onresult = function (event) { var field = host.querySelector('#stInput'); if (field) field.value = event.results[0][0].transcript; };
          recognition.onend = function () { var b = host.querySelector('#stMic'); if (b) { b.textContent = '🎙'; b.disabled = false; } };
          recognition.start();
        };
        var end = host.querySelector('#stEnd');
        if (end) end.onclick = function () { opts.onEnd(state.results); };
      }

      render();
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  // ── Persian: mini grammar ─────────────────────────────────────────────────────
  var PERSIAN_GRAMMAR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

  // opts: base opts + { level, onMistake(task, answer) }
  function renderPersianGrammar(host, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr;
      var bank = data.persian.grammar[opts.isRu ? 'ru' : 'en'];
      var startLevel = String(opts.level || 'A1').toUpperCase();
      if (startLevel === 'C2') startLevel = 'C1';
      if (PERSIAN_GRAMMAR_LEVELS.indexOf(startLevel) < 0) startLevel = 'A1';
      var state = { level: startLevel, tasks: [], index: 0, options: [], picked: null, answered: 0, correct: 0 };

      function startLevelRound(level) {
        state.level = level;
        state.tasks = shuffle(bank[level] || []);
        state.index = 0;
        state.answered = 0;
        state.correct = 0;
        prepareTask();
      }
      function prepareTask() {
        // The bank lists the answer first; shuffle so position gives nothing away.
        state.options = shuffle(state.tasks[state.index].options);
        state.picked = null;
      }

      function render() {
        var task = state.tasks[state.index];
        var ok = state.picked === task.answer;
        host.innerHTML =
          '<div class="px-switch">' + PERSIAN_GRAMMAR_LEVELS.map(function (level) {
            return '<button type="button" data-level="' + level + '" class="' + (state.level === level ? 'on' : '') + '">' + level + '</button>';
          }).join('') + '</div>' +
          '<div class="px-score"><span>' + esc(tr('Score', 'Очки')) + ': ' + state.correct * 10 + '</span><span>' + state.answered + '/10</span></div>' +
          '<div class="px-card"><div class="px-note" style="margin:0 0 6px">' + esc(task.topic) + '</div>' +
            '<div class="px-prompt">' + esc(task.prompt) + '</div>' +
            // The bank stores "Persian line\ntransliteration": Persian right-to-left, the
            // transliteration as its own left-to-right line.
            '<div class="px-q fa long" dir="rtl" style="font-size:30px">' + esc(task.sentence.split('\n')[0]) + '</div>' +
            (task.sentence.split('\n')[1] ? '<div class="px-note" dir="ltr" style="margin:-6px 0 4px">' + esc(task.sentence.split('\n').slice(1).join(' ')) + '</div>' : '') +
            '<div class="px-options">' + state.options.map(function (option, i) {
              var cls = state.picked === null ? '' : option === task.answer ? 'ok' : option === state.picked ? 'bad' : '';
              return '<button type="button" dir="auto" data-option="' + i + '" class="' + cls + '"' + (state.picked !== null ? ' disabled' : '') + '>' + esc(option) + '</button>';
            }).join('') + '</div>' +
            (state.picked !== null
              ? '<div class="px-feedback ' + (ok ? 'ok' : 'bad') + '">' + esc(ok ? tr('Correct!', 'Верно!') : tr('Not quite — the answer is ', 'Не совсем — правильно: ') + task.answer) + '</div>' +
                '<div class="px-note">' + esc(task.explanation) + '</div>'
              : '') +
          '</div>' +
          '<button type="button" class="btn primary" id="pxNextQ" style="width:100%"' + (state.picked === null ? ' disabled' : '') + '>' + esc(tr('Next', 'Дальше')) + ' →</button>';
        wire();
      }

      function wire() {
        Array.prototype.forEach.call(host.querySelectorAll('[data-level]'), function (b) {
          b.onclick = function () { startLevelRound(b.getAttribute('data-level')); render(); };
        });
        Array.prototype.forEach.call(host.querySelectorAll('[data-option]'), function (b) {
          b.onclick = function () {
            if (state.picked !== null) return;
            var task = state.tasks[state.index];
            state.picked = state.options[Number(b.getAttribute('data-option'))];
            state.answered += 1;
            if (state.picked === task.answer) state.correct += 1;
            else if (opts.onMistake) opts.onMistake(task, state.picked, state.level);
            render();
          };
        });
        var next = host.querySelector('#pxNextQ');
        if (next) next.onclick = function () {
          if (state.answered >= 10) return opts.finish(state.correct, 10, tr('Persian grammar round', 'Раунд персидской грамматики'));
          state.index = (state.index + 1) % state.tasks.length;
          prepareTask();
          render();
        };
      }

      startLevelRound(state.level);
      render();
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  // ── Persian: word cards ───────────────────────────────────────────────────────
  function renderPersianWordCards(host, opts) {
    injectStyle();
    loading(host, opts);
    ensureData().then(function (data) {
      var esc = opts.esc, tr = opts.tr;
      var ROUND = 10;
      var state = { queue: shuffle(data.persian.listeningWords).slice(0, ROUND), revealed: false, known: 0, seen: 0 };

      function play(word) { opts.playClip(word.audio, word.speech, PERSIAN_VOICE, 'fa-IR'); }

      function render() {
        var word = state.queue[0];
        host.innerHTML =
          '<p class="px-hint">' + esc(tr('Read the word, say it, then check. Words you mark “Again” come back later in the round.', 'Прочитайте слово, произнесите его, потом проверьте. Слова с отметкой «Повторить» вернутся позже в этом раунде.')) + '</p>' +
          '<div class="px-score"><span>' + esc(tr('Known', 'Знаю')) + ': ' + state.known + '</span><span>' + state.known + '/' + ROUND + '</span></div>' +
          '<div class="px-card">' +
            '<div class="px-q fa" dir="rtl">' + esc(word.fa) + '</div>' +
            '<button type="button" class="st-chip" id="pxPlay">🔊 ' + esc(tr('Listen', 'Слушать')) + '</button>' +
            (state.revealed
              ? '<div class="px-feedback ok" style="font-size:20px">' + esc(word.translit) + '</div><div class="px-note" style="font-size:16px">' + esc(localized(word.meaning, opts)) + '</div>'
              : '') +
          '</div>' +
          (state.revealed
            ? '<div class="px-actions"><button type="button" class="btn" id="pxAgain">🔁 ' + esc(tr('Again', 'Повторить')) + '</button><button type="button" class="btn primary" id="pxKnow">✓ ' + esc(tr('I know it', 'Знаю')) + '</button></div>'
            : '<button type="button" class="btn primary" id="pxReveal" style="width:100%">' + esc(tr('Show', 'Показать')) + '</button>');
        wire(word);
      }

      function next(knew) {
        var word = state.queue.shift();
        state.seen += 1;
        if (knew) state.known += 1;
        else state.queue.push(word);
        // Ends when every card was known once, or after three passes' worth of cards.
        if (state.known >= ROUND || !state.queue.length || state.seen >= ROUND * 3) {
          return opts.finish(state.known, ROUND, tr('Persian word cards', 'Карточки персидских слов'));
        }
        state.revealed = false;
        render();
      }

      function wire(word) {
        var playBtn = host.querySelector('#pxPlay');
        if (playBtn) playBtn.onclick = function () { play(word); };
        var reveal = host.querySelector('#pxReveal');
        if (reveal) reveal.onclick = function () { state.revealed = true; play(word); render(); };
        var know = host.querySelector('#pxKnow');
        if (know) know.onclick = function () { next(true); };
        var again = host.querySelector('#pxAgain');
        if (again) again.onclick = function () { next(false); };
      }

      render();
    }).catch(function (error) { host.innerHTML = '<div class="empty">' + opts.esc(error.message) + '</div>'; });
  }

  window.DuvelaPracticeExtras = {
    ensureData: ensureData,
    renderAlphabet: renderAlphabet,
    renderPersianReading: renderPersianReading,
    renderPersianListening: renderPersianListening,
    renderPersianNumbers: renderPersianNumbers,
    renderStella: renderStella,
    renderPersianGrammar: renderPersianGrammar,
    renderPersianWordCards: renderPersianWordCards,
  };
})();
