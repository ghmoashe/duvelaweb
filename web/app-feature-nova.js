(function () {
  // NOVA on the web (mirrors the Hub's nova-cards.tsx + ai-practice.tsx flow): the
  // sounds of the learner's level, a lesson card per sound (how to make it, minimal
  // pairs, examples, typical mistake) and a practice card where every item is
  // recorded in the browser and checked on its own. Typed text asks for a sound;
  // "Just talk" hands back to the free pronunciation chat. Lessons and checks come
  // from openai-assistant (pronunciation_lesson / pronunciation_check_item); the sound
  // map is web/content/nova-sounds.js. Card styles are GRAMMI's gr-* classes.

  var STORAGE_PREFIX = 'duvela.nova.v1';
  var STYLE = [
    '.nv-pairs{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
    '.nv-pair-word{display:inline-flex;align-items:center;gap:6px;border:1px solid #DCD2FA;border-radius:12px;background:var(--panel,#fff);padding:7px 11px;font:inherit;font-size:16px;font-weight:800;color:inherit;cursor:pointer}',
    '.nv-vs{color:#A49CC0;font-weight:900}',
    '.nv-howto{border-radius:14px;background:rgba(109,61,245,.10);padding:10px 12px}',
    '.nv-item{border-radius:16px;background:var(--panel,#fff);padding:11px;display:grid;gap:7px}',
    '.nv-item>small{color:#6D3DF5;font-weight:800}',
    '.nv-row{display:flex;align-items:center;gap:8px}',
    '.nv-row>span{flex:1;min-width:0}',
    '.nv-row b{display:block;font-size:17px}',
    '.nv-row small{display:block;color:var(--soft);font-weight:600}',
    '.nv-round{width:40px;height:40px;border-radius:20px;border:0;display:grid;place-items:center;cursor:pointer;font-size:17px;flex:0 0 auto}',
    '.nv-listen{background:rgba(109,61,245,.12);color:#6D3DF5}',
    '.nv-mic{background:#6D3DF5;color:#fff}',
    '.nv-mic.on{background:#E11D48;animation:nvPulse 1s infinite}',
    '.nv-mic:disabled{opacity:.4;cursor:not-allowed}',
    '@keyframes nvPulse{0%,100%{box-shadow:0 0 0 0 rgba(225,29,72,.45)}50%{box-shadow:0 0 0 8px rgba(225,29,72,0)}}',
    '.nv-free{border:0;background:none;color:#6D3DF5;font-weight:800;cursor:pointer;padding:4px 0;font:inherit}',
  ].join('\n');

  function injectStyle() {
    if (window.DuvelaGrammi && window.DuvelaGrammi.injectStyle) window.DuvelaGrammi.injectStyle();
    if (document.getElementById('novaStyle')) return;
    var style = document.createElement('style');
    style.id = 'novaStyle';
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function soundsFor(lang, level) {
    var bank = (window.DUVELA_NOVA_SOUNDS || {})[lang];
    return bank ? bank[String(level || 'A1').toUpperCase()] || [] : [];
  }
  function storageKey(userId, lang) { return STORAGE_PREFIX + '.' + (userId || 'guest') + '.' + lang; }
  function loadProgress(userId, lang) {
    try { var parsed = JSON.parse(localStorage.getItem(storageKey(userId, lang)) || '{}'); return parsed && typeof parsed === 'object' ? parsed : {}; } catch (error) { return {}; }
  }
  function saveScore(userId, lang, soundId, score) {
    var progress = loadProgress(userId, lang);
    progress[soundId] = { best: Math.max((progress[soundId] && progress[soundId].best) || 0, score), at: new Date().toISOString() };
    try { localStorage.setItem(storageKey(userId, lang), JSON.stringify(progress)); } catch (error) { /* convenience only */ }
    return progress;
  }
  function scoreColors(score) {
    return window.DuvelaGrammi && window.DuvelaGrammi.scoreColors ? window.DuvelaGrammi.scoreColors(score) : ['#E0F2FE', '#0284C7'];
  }
  function passScore() { return (window.DuvelaGrammi && window.DuvelaGrammi.PASS_SCORE) || 75; }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '').split(',')[1] || ''); };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function mount(host, opts) {
    injectStyle();
    var esc = opts.esc, tr = opts.tr;
    var sounds = soundsFor(opts.lang, opts.level);
    var glossKey = opts.isRu ? 'ru' : 'en';
    var state = { log: [], busy: false, error: null, progress: loadProgress(opts.userId, opts.lang), recording: null, checking: null, results: [] };
    var media = { recorder: null, stream: null, chunks: [] };

    state.log.push({
      kind: 'bot',
      sounds: sounds.length > 0,
      text: tr("Hi, I'm NOVA! Pick a sound of your level: I show how to make it, let you hear the difference and check every word you say. Or write which sound or word to practise.",
        'Привет, я NOVA! Выбери звук своего уровня: покажу, как его произносить, дам услышать разницу и проверю каждое слово, которое ты скажешь. Или напиши, какой звук или слово потренировать.'),
    });

    function gloss(sound) { return sound[glossKey] || sound.en; }
    function isDone(id) { return ((state.progress[id] && state.progress[id].best) || 0) >= passScore(); }
    function doneSounds() { return sounds.filter(function (sound) { return isDone(sound.id); }); }
    function nextSound() { return sounds.find(function (sound) { return !isDone(sound.id); }) || null; }
    function cardScore(entry) {
      var items = entry.lesson.items;
      return items.length ? Math.round(items.filter(function (item) { return entry.results[item.id] && entry.results[item.id].ok; }).length / items.length * 100) : 0;
    }

    function soundsHtml() {
      var next = nextSound();
      var done = doneSounds().length;
      return '<div class="gr-card"><div class="gr-head"><span>🎙</span><div><b>' + esc(tr('Sounds of your level', 'Звуки твоего уровня')) + ' ' + esc(opts.level) + '</b><small>' +
        esc(tr('Tap a sound: I show how to make it and check every word you say. Or type a sound or word in the chat.', 'Нажми звук: покажу, как его произносить, и проверю каждое слово. Или напиши в чат звук или слово.')) +
        '</small></div><em>' + done + '/' + sounds.length + '</em></div><div class="gr-topics">' +
        sounds.map(function (sound) {
          var isNext = next && next.id === sound.id;
          var doneSound = isDone(sound.id);
          var best = state.progress[sound.id] && state.progress[sound.id].best;
          var colors = typeof best === 'number' ? scoreColors(best) : null;
          return '<button type="button" class="gr-topic' + (doneSound ? ' done' : '') + (isNext ? ' next' : '') + '" data-sound="' + esc(sound.id) + '"><i>' + (doneSound ? '✓' : isNext ? '★' : '○') + '</i><span><b>' + esc(sound.title) + '</b><small>' +
            (isNext ? esc(tr('Next', 'Дальше')) + ' · ' : '') + esc(gloss(sound)) + '</small></span>' +
            (colors ? '<em class="gr-mini" style="background:' + colors[0] + ';color:' + colors[1] + '">' + best + '</em>' : '<small>›</small>') + '</button>';
        }).join('') + '</div>' +
        (done ? '<button type="button" class="gr-chip" data-act="review">🔁 ' + esc(tr('Review practised sounds', 'Повторить пройденные звуки')) + ' (' + done + ')</button>' : '') +
        '</div>';
    }

    function lessonHtml(entry) {
      var lesson = entry.lesson;
      if (!lesson.howTo && !(lesson.pairs || []).length && !(lesson.examples || []).length && !lesson.pitfall) return '';
      return '<div class="gr-card"><div class="gr-head"><span>🗣</span><div><b>' + esc(lesson.title || entry.soundTitle) + '</b></div></div>' +
        (lesson.howTo ? '<div class="nv-howto"><span class="gr-label">' + esc(tr('How to say it', 'Как произносить')) + '</span><p class="gr-text">' + esc(lesson.howTo) + '</p></div>' : '') +
        ((lesson.pairs || []).length ? '<div><span class="gr-label">' + esc(tr('Hear the difference', 'Услышь разницу')) + '</span><div class="gr-topics">' +
          lesson.pairs.map(function (pair) {
            return '<div class="gr-task"><div class="nv-pairs"><button type="button" class="nv-pair-word" data-speak="' + esc(pair.a) + '">' + esc(pair.a) + ' 🔊</button><span class="nv-vs">↔</span><button type="button" class="nv-pair-word" data-speak="' + esc(pair.b) + '">' + esc(pair.b) + ' 🔊</button></div>' +
              (pair.note ? '<small style="color:var(--soft);font-weight:600">' + esc(pair.note) + '</small>' : '') + '</div>';
          }).join('') + '</div></div>' : '') +
        ((lesson.examples || []).length ? '<div><span class="gr-label">' + esc(tr('Examples', 'Примеры')) + '</span><div class="gr-topics">' +
          lesson.examples.map(function (example) {
            return '<button type="button" class="gr-example" data-speak="' + esc(example.target) + '"><span><b>' + esc(example.target) + '</b>' + (example.native ? '<small>' + esc(example.native) + '</small>' : '') + '</span>🔊</button>';
          }).join('') + '</div></div>' : '') +
        (lesson.pitfall ? '<div class="gr-pitfall">⚠️ ' + esc(lesson.pitfall) + '</div>' : '') +
        '</div>';
    }

    function itemLabel(item) {
      return item.type === 'sentence' ? tr('Say the sentence', 'Скажи фразу') : item.type === 'pair' ? tr('Minimal pair — say exactly this word', 'Пара — скажи именно это слово') : tr('Say the word', 'Скажи слово');
    }

    function practiceHtml(entry, index) {
      var lesson = entry.lesson;
      var busy = Boolean(state.checking) || Boolean(state.recording);
      var done = lesson.items.every(function (item) { return entry.results[item.id]; });
      var next = nextSound();
      var nextTitle = next && next.id !== entry.soundId ? next.title : null;
      var score = cardScore(entry);
      var colors = scoreColors(score);
      return '<div class="gr-card"><div class="gr-head"><span>🎤</span><div><b>' +
        esc(lesson.mode === 'review' ? (lesson.title || tr('Review', 'Повторение')) : tr('Say it', 'Произнеси')) + '</b><small>' +
        esc(tr('Listen, press the mic, say it, press again.', 'Послушай, нажми микрофон, скажи и нажми ещё раз.')) + '</small></div></div>' +
        lesson.items.map(function (item, n) {
          var key = index + '|' + item.id;
          var result = entry.results[item.id];
          var recording = state.recording === key;
          var checking = state.checking === key;
          var disabled = busy && !recording;
          return '<div class="nv-item"><small>' + (n + 1) + '. ' + esc(itemLabel(item)) + '</small><div class="nv-row"><span><b>' + esc(item.text) + '</b>' + (item.native ? '<small>' + esc(item.native) + '</small>' : '') + '</span>' +
            '<button type="button" class="nv-round nv-listen" data-speak="' + esc(item.text) + '" aria-label="' + esc(tr('Listen', 'Слушать')) + '">🔊</button>' +
            '<button type="button" class="nv-round nv-mic' + (recording ? ' on' : '') + '" data-mic="' + esc(key) + '"' + (disabled ? ' disabled' : '') + ' aria-label="' + esc(recording ? tr('Stop and check', 'Стоп и проверить') : tr('Record', 'Записать')) + '">' +
            (checking ? '…' : recording ? '■' : result ? '↻' : '🎙') + '</button></div>' +
            (result ? '<div class="gr-result ' + (result.ok ? 'ok' : 'bad') + '">' + (result.ok ? '✅' : '❌') + '<span><b>' + esc(tr('Heard', 'Услышано')) + ': «' + esc(result.heard || '…') + '»</b>' +
              (!result.ok && (result.words || []).length > 1 ? '<small>' + esc(result.words.map(function (w) { return w.ok ? w.word : '[' + w.word + ']'; }).join(' ')) + '</small>' : '') +
              (result.tip ? '<small>' + esc(result.tip) + '</small>' : '') + '</span></div>' : '') +
            '</div>';
        }).join('') +
        (done
          ? '<div class="gr-score"><strong style="background:' + colors[0] + ';color:' + colors[1] + '">' + score + '<small>/100</small></strong><span class="gr-text">' +
            esc(score >= passScore() ? tr('Well done — this sound is on its way!', 'Отлично — этот звук получается!') : tr('Repeat the red ones: listen first, then say them slowly.', 'Повтори красные: сначала послушай, потом скажи медленно.')) + '</span></div>' +
            '<div class="gr-actions"><button type="button" class="gr-chip" data-more="' + index + '">🔄 ' + esc(tr('More practice', 'Ещё упражнения')) + '</button>' +
            (nextTitle ? '<button type="button" class="gr-chip" data-sound="' + esc(next.id) + '">➡️ ' + esc(tr('Next', 'Дальше')) + ': ' + esc(nextTitle) + '</button>' : '') +
            (sounds.length ? '<button type="button" class="gr-chip" data-act="sounds">📋 ' + esc(tr('All sounds', 'Все звуки')) + '</button>' : '') + '</div>'
          : '') +
        '</div>';
    }

    function paint(scroll) {
      var logEl = host.querySelector('#nvLog');
      var previousScroll = logEl ? logEl.scrollTop : 0;
      var log = state.log.map(function (entry, index) {
        var html;
        if (entry.kind === 'me') html = '<div class="gr-bubble me"><div>' + esc(entry.text) + '</div></div>';
        else {
          var bubble = entry.text ? '<div class="gr-bubble">' + opts.avatarHtml() + '<div>' + esc(entry.text) + '</div></div>' : '';
          html = entry.kind === 'lesson' ? bubble + lessonHtml(entry) + practiceHtml(entry, index) : bubble + (entry.sounds ? soundsHtml() : '');
        }
        return '<div data-entry="' + index + '">' + html + '</div>';
      }).join('') + (state.busy ? '<div class="gr-bubble">' + opts.avatarHtml() + '<div>…</div></div>' : '');
      var next = nextSound();
      var dock = (sounds.length ? '<button type="button" class="btn" data-act="sounds">📋 ' + esc(tr('Sounds of my level', 'Звуки моего уровня')) + '</button>' : '') +
        (doneSounds().length
          ? '<button type="button" class="btn" data-act="review">🔁 ' + esc(tr('Review practised sounds', 'Повторить пройденные звуки')) + '</button>'
          : next ? '<button type="button" class="btn" data-sound="' + esc(next.id) + '">⭐ ' + esc(tr('Start', 'Начать')) + ': ' + esc(next.title) + '</button>' : '') +
        '<button type="button" class="btn" data-act="free">💬 ' + esc(tr('Just talk', 'Просто поговорить')) + '</button>';
      host.innerHTML =
        '<div class="gr-log" id="nvLog">' + log + '</div>' +
        (state.error ? '<div class="gr-error" role="alert">' + esc(state.error) + '</div>' : '') +
        '<div class="gr-dock">' + dock + '</div>' +
        '<div class="gr-composer"><input id="nvInput" placeholder="' + esc(tr('A sound or word to practise…', 'Звук или слово для тренировки…')) + '" autocomplete="off"' + (state.busy ? ' disabled' : '') + '>' +
        '<button class="btn primary" id="nvSend"' + (state.busy ? ' disabled' : '') + '>' + esc(tr('Send', 'Отправить')) + '</button></div>' +
        '<button class="btn" id="nvEnd" style="width:100%;margin-top:10px">' + esc(tr('End session', 'Завершить сессию')) + '</button>';
      logEl = host.querySelector('#nvLog');
      var target = typeof scroll === 'number' ? host.querySelector('[data-entry="' + scroll + '"]') : null;
      if (logEl) logEl.scrollTop = target ? target.offsetTop - logEl.offsetTop : scroll === true ? logEl.scrollHeight : previousScroll;
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
            action: 'pronunciation_lesson', level: opts.level, locale: opts.locale, nativeLocale: opts.nativeLocale,
            mode: input.mode, sound: input.sound, soundHint: input.soundHint || '', reviewSounds: input.reviewSounds || [],
          },
        });
        if (res.error) throw res.error;
        var lesson = res.data || {};
        state.busy = false;
        if (lesson.offTopic || !(lesson.items || []).length) {
          state.log.push({ kind: 'bot', text: lesson.reply || tr('Which sound or word should we practise?', 'Какой звук или слово потренируем?') });
        } else {
          state.log.push({
            kind: 'lesson', lesson: lesson, soundId: input.soundId || null, soundTitle: lesson.title || input.sound, results: {},
            text: input.mode === 'review'
              ? tr('Review time! Say the sounds you have practised.', 'Повторим! Произнеси звуки, которые уже тренировал.')
              : input.mode === 'more'
                ? tr('Here are new words for the same sound.', 'Вот новые слова на этот звук.')
                : tr('Here is how to make the sound — listen, then say the words below.', 'Вот как произносить звук — послушай и скажи слова ниже.'),
          });
        }
        paint(state.log.length - 1);
      } catch (error) {
        state.log.pop();
        state.busy = false;
        state.error = (error && error.message) || tr('NOVA could not answer. Try again.', 'NOVA не смогла ответить. Попробуйте ещё раз.');
        paint(true);
      }
    }

    function openSound(soundId) {
      var sound = sounds.find(function (item) { return item.id === soundId; });
      if (!sound) return;
      requestLesson({
        mode: 'lesson', sound: sound.title, soundId: sound.id, userText: sound.title + ' — ' + gloss(sound),
        soundHint: sound.pairs ? sound.en + '; use exactly these minimal pairs: ' + sound.pairs : sound.en,
      });
    }

    function startReview() {
      var done = doneSounds().sort(function (a, b) {
        return String((state.progress[b.id] || {}).at || '').localeCompare(String((state.progress[a.id] || {}).at || ''));
      }).slice(0, 6);
      if (!done.length) return;
      requestLesson({ mode: 'review', sound: done.map(function (s) { return s.title; }).join('; '), reviewSounds: done.map(function (s) { return s.title; }), userText: tr('Review practised sounds', 'Повторить пройденные звуки') });
    }

    function moreItems(entry) {
      if (entry.lesson.mode === 'review') {
        requestLesson({ mode: 'review', sound: entry.soundTitle, userText: tr('More review', 'Ещё повторение'),
          reviewSounds: entry.lesson.items.map(function (item) { return item.sound; }).filter(Boolean) });
      } else {
        requestLesson({ mode: 'more', sound: entry.soundTitle, soundId: entry.soundId, userText: tr('More words for this sound', 'Ещё слова на этот звук') });
      }
    }

    function stopStream() {
      if (media.stream) media.stream.getTracks().forEach(function (track) { track.stop(); });
      media.stream = null;
      media.recorder = null;
    }

    async function startRecording(key) {
      if (state.recording || state.checking) return;
      state.error = null;
      try {
        if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error('unsupported');
        media.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        media.chunks = [];
        var type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(function (candidate) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(candidate); });
        media.recorder = type ? new MediaRecorder(media.stream, { mimeType: type }) : new MediaRecorder(media.stream);
        media.recorder.ondataavailable = function (event) { if (event.data && event.data.size) media.chunks.push(event.data); };
        media.recorder.start();
        state.recording = key;
        paint(false);
      } catch (error) {
        stopStream();
        state.error = tr('Allow microphone access to practise speaking.', 'Разрешите доступ к микрофону, чтобы тренировать произношение.');
        paint(false);
      }
    }

    async function stopAndCheck(key) {
      if (state.recording !== key || !media.recorder) return;
      var parts = key.split('|');
      var entry = state.log[Number(parts[0])];
      var item = entry.lesson.items.find(function (candidate) { return candidate.id === parts[1]; });
      var recorder = media.recorder;
      var stopped = new Promise(function (resolve) { recorder.onstop = resolve; });
      recorder.stop();
      await stopped;
      var mimeType = (recorder.mimeType || 'audio/webm').split(';')[0];
      var blob = new Blob(media.chunks, { type: mimeType });
      stopStream();
      state.recording = null;
      state.checking = key;
      paint(false);
      try {
        // The other word of a minimal pair must never pass as a near miss.
        var alternatives = (entry.lesson.pairs || []).reduce(function (list, pair) {
          if (pair.a === item.text) list.push(pair.b);
          if (pair.b === item.text) list.push(pair.a);
          return list;
        }, []);
        var res = await opts.supa.functions.invoke('openai-assistant', {
          body: {
            action: 'pronunciation_check_item', audioBase64: await blobToBase64(blob), mimeType: mimeType, alternatives: alternatives,
            level: opts.level, locale: opts.locale, nativeLocale: opts.nativeLocale, sound: item.sound || entry.soundTitle, text: item.text,
          },
        });
        if (res.error) throw res.error;
        entry.results[item.id] = res.data || { ok: false, heard: '', words: [], tip: '' };
        if (entry.lesson.items.every(function (candidate) { return entry.results[candidate.id]; })) finishCard(entry);
      } catch (error) {
        state.error = (error && error.message) || tr('Could not check the recording. Try again.', 'Не удалось проверить запись. Попробуйте ещё раз.');
      }
      state.checking = null;
      paint(false);
    }

    function finishCard(entry) {
      var score = cardScore(entry);
      state.results.push({ score: score });
      if (score >= passScore()) opts.awardXp(10);
      var scores = {};
      if (entry.soundId) {
        scores[entry.soundId] = [score];
      } else if (entry.lesson.mode === 'review') {
        entry.lesson.items.forEach(function (item) {
          var sound = sounds.find(function (candidate) { return candidate.title === item.sound; });
          if (!sound) return;
          (scores[sound.id] = scores[sound.id] || []).push(entry.results[item.id] && entry.results[item.id].ok ? 100 : 0);
        });
      }
      Object.keys(scores).forEach(function (soundId) {
        var values = scores[soundId];
        state.progress = saveScore(opts.userId, opts.lang, soundId, Math.round(values.reduce(function (s, v) { return s + v; }, 0) / values.length));
      });
    }

    function wire() {
      Array.prototype.forEach.call(host.querySelectorAll('[data-speak]'), function (b) { b.onclick = function () { opts.speak(b.getAttribute('data-speak')); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-sound]'), function (b) { b.onclick = function () { openSound(b.getAttribute('data-sound')); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-more]'), function (b) { b.onclick = function () { moreItems(state.log[Number(b.getAttribute('data-more'))]); }; });
      Array.prototype.forEach.call(host.querySelectorAll('[data-mic]'), function (b) {
        b.onclick = function () {
          var key = b.getAttribute('data-mic');
          if (state.recording === key) stopAndCheck(key); else startRecording(key);
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-act]'), function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act');
          if (act === 'review') startReview();
          if (act === 'free') { stopStream(); opts.onFreeChat(); }
          if (act === 'sounds') {
            state.log.push({ kind: 'bot', sounds: true, text: tr('Here are the sounds of your level.', 'Вот звуки твоего уровня.') });
            paint(state.log.length - 1);
          }
        };
      });
      var input = host.querySelector('#nvInput');
      function send() {
        var text = input && input.value.trim();
        if (!text || state.busy) return;
        input.value = '';
        requestLesson({ mode: 'lesson', sound: text, userText: text });
      }
      var sendBtn = host.querySelector('#nvSend');
      if (sendBtn) sendBtn.onclick = send;
      if (input) input.addEventListener('keydown', function (event) { if (event.key === 'Enter') send(); });
      var end = host.querySelector('#nvEnd');
      if (end) end.onclick = function () { stopStream(); opts.onEnd(state.results); };
    }

    // Open at the top: the greeting and the level's sound map come first.
    paint(false);
  }

  window.DuvelaNova = { render: mount, soundsFor: soundsFor };
})();
