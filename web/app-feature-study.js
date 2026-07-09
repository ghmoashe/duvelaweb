(function () {
  function createStudyFeature(ctx) {
    const { $, tr, esc, supa } = ctx;
    const PROGRESS_KEY = 'duvela.study.progress';
    let studyState = null;
    let aiChatState = null;

    // ---- content banks (offline, bundled) ----
    const VOCAB = {
      de: [
        { w: 'das Haus', t: 'дом / house' }, { w: 'die Frau', t: 'женщина / woman' },
        { w: 'der Mann', t: 'мужчина / man' }, { w: 'das Buch', t: 'книга / book' },
        { w: 'die Stadt', t: 'город / city' }, { w: 'das Wasser', t: 'вода / water' },
        { w: 'der Freund', t: 'друг / friend' }, { w: 'die Arbeit', t: 'работа / work' },
        { w: 'das Kind', t: 'ребёнок / child' }, { w: 'die Zeit', t: 'время / time' },
        { w: 'der Tag', t: 'день / day' }, { w: 'die Nacht', t: 'ночь / night' },
        { w: 'essen', t: 'есть / to eat' }, { w: 'trinken', t: 'пить / to drink' },
        { w: 'sprechen', t: 'говорить / to speak' }, { w: 'lernen', t: 'учить / to learn' }
      ],
      en: [
        { w: 'house', t: 'дом / das Haus' }, { w: 'woman', t: 'женщина / die Frau' },
        { w: 'friend', t: 'друг / der Freund' }, { w: 'work', t: 'работа / die Arbeit' },
        { w: 'water', t: 'вода / das Wasser' }, { w: 'city', t: 'город / die Stadt' },
        { w: 'to speak', t: 'говорить / sprechen' }, { w: 'to learn', t: 'учить / lernen' },
        { w: 'to need', t: 'нуждаться / brauchen' }, { w: 'enough', t: 'достаточно / genug' },
        { w: 'to improve', t: 'улучшать / verbessern' }, { w: 'meeting', t: 'встреча / das Treffen' }
      ],
      es: [
        { w: 'la casa', t: 'дом / house' }, { w: 'la mujer', t: 'женщина / woman' },
        { w: 'el amigo', t: 'друг / friend' }, { w: 'el trabajo', t: 'работа / work' },
        { w: 'el agua', t: 'вода / water' }, { w: 'la ciudad', t: 'город / city' },
        { w: 'hablar', t: 'говорить / to speak' }, { w: 'aprender', t: 'учить / to learn' },
        { w: 'comer', t: 'есть / to eat' }, { w: 'beber', t: 'пить / to drink' }
      ]
    };

    const ARTICLES = [
      { noun: 'Haus', art: 'das' }, { noun: 'Frau', art: 'die' }, { noun: 'Mann', art: 'der' },
      { noun: 'Buch', art: 'das' }, { noun: 'Stadt', art: 'die' }, { noun: 'Tisch', art: 'der' },
      { noun: 'Wasser', art: 'das' }, { noun: 'Arbeit', art: 'die' }, { noun: 'Tag', art: 'der' },
      { noun: 'Kind', art: 'das' }, { noun: 'Nacht', art: 'die' }, { noun: 'Freund', art: 'der' },
      { noun: 'Auto', art: 'das' }, { noun: 'Zeit', art: 'die' }, { noun: 'Weg', art: 'der' },
      { noun: 'Fenster', art: 'das' }, { noun: 'Straße', art: 'die' }, { noun: 'Apfel', art: 'der' }
    ];

    const GRAMMAR = {
      de: [
        { q: 'Ich ___ Student.', opts: ['bin', 'bist', 'ist', 'sind'], a: 0 },
        { q: 'Wir ___ nach Berlin.', opts: ['fahre', 'fährst', 'fahren', 'fährt'], a: 2 },
        { q: 'Das ist ___ Buch.', opts: ['ein', 'eine', 'einen', 'einem'], a: 0 },
        { q: 'Er ___ jeden Tag Deutsch.', opts: ['lerne', 'lernst', 'lernt', 'lernen'], a: 2 },
        { q: 'Ich gehe ___ Schule.', opts: ['zur', 'zum', 'im', 'am'], a: 0 },
        { q: 'Sie ___ ein Auto.', opts: ['habe', 'hast', 'hat', 'haben'], a: 2 }
      ],
      en: [
        { q: 'She ___ to school every day.', opts: ['go', 'goes', 'going', 'gone'], a: 1 },
        { q: 'I ___ living here since 2020.', opts: ['am', 'have been', 'was', 'be'], a: 1 },
        { q: 'They ___ finished yet.', opts: ["haven't", "hasn't", "didn't", "isn't"], a: 0 },
        { q: 'If it rains, we ___ stay home.', opts: ['will', 'would', 'are', 'have'], a: 0 },
        { q: 'This is ___ interesting book.', opts: ['a', 'an', 'the', '-'], a: 1 },
        { q: 'He is good ___ maths.', opts: ['in', 'on', 'at', 'for'], a: 2 }
      ],
      es: [
        { q: 'Yo ___ español.', opts: ['hablo', 'hablas', 'habla', 'hablan'], a: 0 },
        { q: 'Nosotros ___ en Madrid.', opts: ['vivo', 'vives', 'vivimos', 'viven'], a: 2 },
        { q: '___ un libro.', opts: ['Es', 'Está', 'Son', 'Están'], a: 0 },
        { q: 'Ella ___ profesora.', opts: ['soy', 'eres', 'es', 'son'], a: 2 }
      ]
    };

    const WORD_USAGE = {
      de: [
        { s: 'Ich ___ einen Kaffee, bitte.', a: 'möchte', opts: ['möchte', 'gehe', 'komme', 'sehe'] },
        { s: 'Am Wochenende ___ ich meine Familie.', a: 'besuche', opts: ['besuche', 'trinke', 'schlafe', 'lese'] },
        { s: 'Der Zug ___ um acht Uhr ab.', a: 'fährt', opts: ['fährt', 'isst', 'liest', 'singt'] },
        { s: 'Kannst du mir bitte ___?', a: 'helfen', opts: ['helfen', 'gehen', 'essen', 'trinken'] }
      ],
      en: [
        { s: 'I would like to ___ my English.', a: 'improve', opts: ['improve', 'drink', 'drive', 'sleep'] },
        { s: 'She ___ a meeting at noon.', a: 'has', opts: ['has', 'eats', 'runs', 'sings'] },
        { s: 'We need to ___ the report today.', a: 'finish', opts: ['finish', 'swim', 'cook', 'dance'] }
      ],
      es: [
        { s: 'Quiero ___ español mejor.', a: 'hablar', opts: ['hablar', 'comer', 'dormir', 'correr'] },
        { s: 'Ella ___ en Madrid.', a: 'vive', opts: ['vive', 'come', 'bebe', 'canta'] }
      ]
    };

    const LISTEN = {
      de: [
        { text: 'Guten Morgen, wie geht es dir?', hint: 'приветствие / greeting' },
        { text: 'Ich hätte gern einen Kaffee.', hint: 'в кафе / at a cafe' },
        { text: 'Wo ist der Bahnhof, bitte?', hint: 'вопрос дороги / directions' },
        { text: 'Das Wetter ist heute sehr schön.', hint: 'погода / weather' }
      ],
      en: [
        { text: 'Could you tell me the way to the station?', hint: 'directions' },
        { text: 'I have been learning English for two years.', hint: 'about yourself' },
        { text: 'What time does the meeting start?', hint: 'at work' }
      ],
      es: [
        { text: 'Buenos días, ¿cómo estás?', hint: 'saludo / greeting' },
        { text: '¿Dónde está la estación, por favor?', hint: 'direcciones / directions' }
      ]
    };

    const SPEECH_LOCALE = { de: 'de-DE', en: 'en-US', es: 'es-ES' };

    const READING = {
      de: [
        {
          title: 'Ein Tag in Berlin',
          text: 'Anna wohnt in Berlin. Jeden Morgen trinkt sie Kaffee und fährt mit dem Fahrrad zur Arbeit. Nach der Arbeit trifft sie oft ihre Freunde im Park. Am Wochenende besucht sie ihre Familie in Hamburg.',
          questions: [
            { q: 'Wo wohnt Anna?', opts: ['Berlin', 'Hamburg', 'München', 'Köln'], a: 0 },
            { q: 'Wie fährt sie zur Arbeit?', opts: ['Auto', 'Fahrrad', 'Bus', 'Zu Fuß'], a: 1 },
            { q: 'Wen besucht sie am Wochenende?', opts: ['Freunde', 'Kollegen', 'Familie', 'Niemanden'], a: 2 }
          ]
        }
      ],
      en: [
        {
          title: 'A Day at Work',
          text: 'Tom works in an office downtown. He starts at nine and has lunch with his colleagues at noon. After work, he usually goes to the gym before heading home. On Fridays, he meets friends for dinner.',
          questions: [
            { q: 'Where does Tom work?', opts: ['At home', 'In an office', 'At a school', 'Outdoors'], a: 1 },
            { q: 'What does he do after work?', opts: ['Sleeps', 'Goes to the gym', 'Watches TV', 'Cooks'], a: 1 },
            { q: 'What happens on Fridays?', opts: ['He works late', 'He meets friends', 'He stays home', 'He travels'], a: 1 }
          ]
        }
      ],
      es: [
        {
          title: 'Un día en Madrid',
          text: 'Marta vive en Madrid. Cada mañana toma un café y camina al trabajo. Después del trabajo, estudia inglés dos horas. Los fines de semana visita a sus padres.',
          questions: [
            { q: '¿Dónde vive Marta?', opts: ['Madrid', 'Barcelona', 'Sevilla', 'Valencia'], a: 0 },
            { q: '¿Qué estudia después del trabajo?', opts: ['Francés', 'Inglés', 'Alemán', 'Nada'], a: 1 },
            { q: '¿A quién visita los fines de semana?', opts: ['Amigos', 'Padres', 'Colegas', 'Vecinos'], a: 1 }
          ]
        }
      ]
    };

    const WRITING = {
      de: [
        { prompt: 'Beschreiben Sie Ihren typischen Tag (mindestens 4 Sätze).', checklist: ['Ich benutze Präsens.', 'Ich habe mindestens 4 Sätze.', 'Ich benutze Zeitwörter wie "morgens", "dann", "danach".'] },
        { prompt: 'Schreiben Sie über Ihre Familie.', checklist: ['Ich nenne mindestens 2 Familienmitglieder.', 'Ich benutze "haben" oder "sein".', 'Der Text hat einen Anfang und ein Ende.'] }
      ],
      en: [
        { prompt: 'Describe your typical day (at least 4 sentences).', checklist: ['I used present tense.', 'I wrote at least 4 sentences.', 'I used time words like "then", "after that".'] },
        { prompt: 'Write about your last holiday.', checklist: ['I used past tense.', 'I mentioned where I went.', 'I described one activity.'] }
      ],
      es: [
        { prompt: 'Describe tu día típico (al menos 4 frases).', checklist: ['Usé el presente.', 'Escribí al menos 4 frases.', 'Usé palabras de tiempo como "luego", "después".'] }
      ]
    };

    const ESSENTIALS = {
      de: [
        { title: 'Begrüßungen', bullets: ['Guten Morgen — good morning', 'Guten Tag — good day', 'Guten Abend — good evening', 'Wie geht es dir? — how are you?'] },
        { title: 'Zahlen 1–10', bullets: ['eins, zwei, drei, vier, fünf', 'sechs, sieben, acht, neun, zehn'] },
        { title: 'Höflichkeit', bullets: ['bitte — please', 'danke — thank you', 'entschuldigung — excuse me', 'gern geschehen — you\'re welcome'] }
      ],
      en: [
        { title: 'Greetings', bullets: ['Good morning', 'Good afternoon', 'Good evening', 'How are you?'] },
        { title: 'Numbers 1–10', bullets: ['one, two, three, four, five', 'six, seven, eight, nine, ten'] },
        { title: 'Politeness', bullets: ['please', 'thank you', 'excuse me', "you're welcome"] }
      ],
      es: [
        { title: 'Saludos', bullets: ['Buenos días', 'Buenas tardes', 'Buenas noches', '¿Cómo estás?'] },
        { title: 'Números 1–10', bullets: ['uno, dos, tres, cuatro, cinco', 'seis, siete, ocho, nueve, diez'] }
      ]
    };

    const MISTAKE_KEY = 'duvela.study.mistakes';
    const SAVED_WORDS_KEY = 'duvela.study.savedWords';

    const TOOLS = [
      { id: 'flashcards', icon: '🔤', title: tr('Flashcards', 'Флешкарты'), desc: tr('Learn words with flip cards', 'Учите слова карточками') },
      { id: 'articles', icon: '🇩🇪', title: tr('Guess the article', 'Угадай артикль'), desc: tr('German der / die / das', 'Немецкий der / die / das') },
      { id: 'memory', icon: '🃏', title: tr('Memory match', 'Мемори'), desc: tr('Match word to translation', 'Соедини слово и перевод') },
      { id: 'grammar', icon: '📘', title: tr('Grammar quiz', 'Грамматика'), desc: tr('Fill the correct form', 'Выберите правильную форму') },
      { id: 'wordusage', icon: '✍️', title: tr('Word usage', 'Употребление слов'), desc: tr('Pick the word that fits', 'Подберите подходящее слово') },
      { id: 'listening', icon: '🎧', title: tr('Listening lab', 'Аудирование'), desc: tr('Type what you hear', 'Запишите, что услышали') },
      { id: 'reading', icon: '📖', title: tr('Reading lab', 'Чтение'), desc: tr('Read and answer questions', 'Прочитайте и ответьте на вопросы') },
      { id: 'writing', icon: '📝', title: tr('Writing lab', 'Письмо'), desc: tr('Write and self-check', 'Пишите и проверяйте себя') },
      { id: 'exam', icon: '⏱️', title: tr('Exam mode', 'Режим экзамена'), desc: tr('Timed mixed quiz', 'Смешанный квиз на время') },
      { id: 'mistakes', icon: '🧠', title: tr('Mistake center', 'Центр ошибок'), desc: tr('Review what you got wrong', 'Повторите свои ошибки') },
      { id: 'essentials', icon: '📗', title: tr('Essentials', 'Основы'), desc: tr('Short core lessons', 'Короткие базовые уроки') },
      { id: 'ai', icon: '🤖', title: tr('AI practice coach', 'ИИ-репетитор'), desc: tr('Chat and get corrections', 'Общайтесь и получайте исправления') }
    ];

    // ---- helpers ----
    function loadProgress() {
      try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch (e) { return {}; }
    }
    function saveProgress(next) {
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
    }
    function bumpProgress(toolId, xp) {
      const p = loadProgress();
      p[toolId] = (p[toolId] || 0) + 1;
      p.xp = (p.xp || 0) + xp;
      saveProgress(p);
    }

    function loadMistakes() {
      try { return JSON.parse(localStorage.getItem(MISTAKE_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveMistakes(list) {
      try { localStorage.setItem(MISTAKE_KEY, JSON.stringify(list.slice(-60))); } catch (e) { /* ignore */ }
    }
    function logMistake(lang, prompt, opts, correctIdx, kind) {
      var list = loadMistakes();
      var key = lang + '|' + prompt;
      list = list.filter(function (m) { return (m.lang + '|' + m.prompt) !== key; });
      list.push({ lang: lang, prompt: prompt, opts: opts, a: correctIdx, kind: kind || 'mcq', at: Date.now() });
      saveMistakes(list);
    }
    function clearMistake(lang, prompt) {
      var list = loadMistakes().filter(function (m) { return (m.lang + '|' + m.prompt) !== (lang + '|' + prompt); });
      saveMistakes(list);
    }

    function loadSavedWords() {
      try { return JSON.parse(localStorage.getItem(SAVED_WORDS_KEY) || '[]'); } catch (e) { return []; }
    }
    function toggleSavedWord(lang, word, translation) {
      var list = loadSavedWords();
      var key = lang + '|' + word;
      var idx = list.findIndex(function (item) { return (item.lang + '|' + item.w) === key; });
      if (idx >= 0) list.splice(idx, 1);
      else list.push({ lang: lang, w: word, t: translation });
      try { localStorage.setItem(SAVED_WORDS_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
      return idx < 0;
    }
    function isWordSaved(lang, word) {
      return loadSavedWords().some(function (item) { return item.lang === lang && item.w === word; });
    }

    async function awardXp(amount) {
      if (!amount || !ctx.user) return;
      try {
        const current = ctx.profile && typeof ctx.profile.score === 'number' ? ctx.profile.score : 0;
        const next = current + amount;
        const { error } = await supa.from('profiles').update({ score: next }).eq('id', ctx.user.id);
        if (!error && ctx.profile) ctx.setProfile(Object.assign({}, ctx.profile, { score: next }));
      } catch (e) { /* XP is best-effort */ }
    }

    function currentLang() {
      const raw = (ctx.profile && (ctx.profile.language || ctx.profile.language_level)) || '';
      const low = String(raw).toLowerCase();
      if (low.indexOf('deu') >= 0 || low.indexOf('нем') >= 0 || low.indexOf('german') >= 0) return 'de';
      if (low.indexOf('esp') >= 0 || low.indexOf('исп') >= 0 || low.indexOf('spanish') >= 0) return 'es';
      if (low.indexOf('eng') >= 0 || low.indexOf('англ') >= 0) return 'en';
      return studyState && studyState.lang ? studyState.lang : 'de';
    }

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    }

    function langPicker() {
      const cur = currentLang();
      const opt = (code, label) => '<option value="' + code + '"' + (code === cur ? ' selected' : '') + '>' + label + '</option>';
      return '<select id="studyLang" class="role-select" style="width:auto;margin-bottom:12px">' +
        opt('de', tr('German', 'Немецкий')) + opt('en', tr('English', 'Английский')) + opt('es', tr('Spanish', 'Испанский')) +
        '</select>';
    }

    // ---- public: tools grid in learner workspace ----
    function studyToolsHtml() {
      const p = loadProgress();
      const done = (p.xp || 0);
      return '<div class="study-wrap" style="margin-bottom:18px">' +
        '<div class="section-head" style="margin-bottom:10px"><h2 style="font-size:16px">' + esc(tr('Study tools', 'Инструменты обучения')) + '</h2>' +
        '<span style="color:var(--soft);font-weight:800">' + esc(tr('Self-study', 'Самостоятельно')) + ' · ' + done + ' XP</span></div>' +
        '<div class="study-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px">' +
        TOOLS.map(function (tool) {
          return '<button class="card study-tile" data-study="' + esc(tool.id) + '" ' +
            'style="text-align:left;cursor:pointer;padding:14px;border:1px solid var(--line);border-radius:14px">' +
            '<div style="font-size:26px;margin-bottom:6px">' + tool.icon + '</div>' +
            '<div style="font-weight:900;font-size:14px">' + esc(tool.title) + '</div>' +
            '<div style="color:var(--soft);font-weight:700;font-size:12px;margin-top:2px">' + esc(tool.desc) + '</div>' +
          '</button>';
        }).join('') +
        '</div></div>';
    }

    function bindStudyTiles() {
      var tiles = document.querySelectorAll('.study-tile');
      Array.prototype.forEach.call(tiles, function (tile) {
        tile.addEventListener('click', function () { openStudyTool(tile.getAttribute('data-study')); });
      });
    }

    // ---- overlay plumbing ----
    function ensureOverlay() {
      var overlay = $('#studyOverlay');
      if (overlay) return overlay;
      overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.id = 'studyOverlay';
      overlay.innerHTML =
        '<div class="overlay-card" style="width:min(640px,100%)">' +
          '<div class="overlay-head"><h2 id="studyOverlayTitle">Study</h2>' +
          '<button type="button" id="studyClose" aria-label="Close">✕</button></div>' +
          '<div class="overlay-body" id="studyOverlayBody"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector('#studyClose').addEventListener('click', closeStudy);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) closeStudy(); });
      return overlay;
    }
    function closeStudy() {
      var overlay = $('#studyOverlay');
      if (overlay) overlay.classList.remove('open');
      if (studyState && studyState.examTimerId) clearInterval(studyState.examTimerId);
      studyState = null;
      aiChatState = null;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    function openStudyTool(id) {
      var tool = TOOLS.find(function (t) { return t.id === id; });
      if (!tool) return;
      ensureOverlay();
      if (id !== 'ai') aiChatState = null;
      studyState = { tool: id, lang: currentLang(), idx: 0, score: 0 };
      $('#studyOverlayTitle').textContent = tool.icon + ' ' + tool.title;
      $('#studyOverlay').classList.add('open');
      renderTool();
    }

    function renderTool() {
      var body = $('#studyOverlayBody');
      var showPicker = studyState.tool !== 'mistakes' && studyState.tool !== 'ai';
      var pickerRow = showPicker ? '<div style="display:flex;align-items:center;gap:10px">' + langPicker() + '</div>' : '';
      body.innerHTML = pickerRow + '<div id="studyToolBody"></div>';
      var sel = $('#studyLang');
      if (sel) sel.addEventListener('change', function () {
        studyState.lang = sel.value; studyState.idx = 0; studyState.score = 0; studyState.data = null; renderToolBody();
      });
      renderToolBody();
    }

    function renderToolBody() {
      switch (studyState.tool) {
        case 'flashcards': return renderFlashcards();
        case 'articles': return renderArticles();
        case 'memory': return renderMemory();
        case 'grammar': return renderGrammar();
        case 'wordusage': return renderWordUsage();
        case 'listening': return renderListening();
        case 'reading': return renderReading();
        case 'writing': return renderWriting();
        case 'exam': return renderExam();
        case 'mistakes': return renderMistakes();
        case 'essentials': return renderEssentials();
        case 'ai': return renderAiPractice();
      }
    }

    function counterHtml(idx, total) {
      return '<div style="color:var(--soft);font-weight:800;font-size:12px;margin:4px 0 12px">' +
        (idx + 1) + ' / ' + total + '</div>';
    }

    function finishHtml(scoreText) {
      return '<div style="text-align:center;padding:14px 0">' +
        '<h2 style="margin:0 0 4px">' + esc(tr('Done!', 'Готово!')) + '</h2>' +
        '<p style="font-weight:900;font-size:26px;margin:6px 0">' + scoreText + '</p>' +
        '<p style="color:var(--teal);font-weight:900">+' + '{xp}' + ' XP</p>' +
        '<button class="btn primary" id="studyAgain" style="margin-top:12px">' + esc(tr('Again', 'Ещё раз')) + '</button>' +
        '</div>';
    }
    function wireAgain() {
      var again = $('#studyAgain');
      if (again) again.addEventListener('click', function () {
        studyState.idx = 0; studyState.score = 0; studyState.data = null; renderToolBody();
      });
    }

    // ---- 1. Flashcards ----
    function renderFlashcards() {
      if (!studyState.data) studyState.data = shuffle(VOCAB[studyState.lang] || VOCAB.de);
      var deck = studyState.data;
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var card = deck[studyState.idx];
      var host = $('#studyToolBody');
      var saved = isWordSaved(studyState.lang, card.w);
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div id="flip" style="cursor:pointer;border:1px solid var(--line);border-radius:16px;padding:34px 16px;text-align:center;background:var(--panel-soft);position:relative">' +
          '<button type="button" id="fcStar" aria-label="save" style="position:absolute;top:8px;right:10px;background:none;border:none;font-size:20px;cursor:pointer">' + (saved ? '⭐' : '☆') + '</button>' +
          '<div style="font-size:24px;font-weight:900" id="flipFront">' + esc(card.w) + '</div>' +
          '<div style="color:var(--soft);font-weight:700;margin-top:8px" id="flipBack">' + esc(tr('Tap to flip', 'Нажмите, чтобы перевернуть')) + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:14px">' +
          '<button class="btn" id="fcAgain" style="flex:1">' + esc(tr('Repeat', 'Повторить')) + '</button>' +
          '<button class="btn primary" id="fcKnow" style="flex:1">' + esc(tr('I know it', 'Знаю')) + '</button>' +
        '</div>';
      var flipped = false;
      $('#flip').addEventListener('click', function (e) {
        if (e.target && e.target.id === 'fcStar') return;
        flipped = !flipped;
        $('#flipFront').textContent = flipped ? card.t : card.w;
        $('#flipBack').textContent = flipped ? tr('Translation', 'Перевод') : tr('Tap to flip', 'Нажмите, чтобы перевернуть');
      });
      $('#fcStar').addEventListener('click', function (e) {
        e.stopPropagation();
        var nowSaved = toggleSavedWord(studyState.lang, card.w, card.t);
        $('#fcStar').textContent = nowSaved ? '⭐' : '☆';
      });
      $('#fcKnow').addEventListener('click', function () { studyState.score++; studyState.idx++; renderFlashcards(); });
      $('#fcAgain').addEventListener('click', function () { studyState.idx++; renderFlashcards(); });
    }

    // ---- 2. Guess the article ----
    function renderArticles() {
      if (!studyState.data) studyState.data = shuffle(ARTICLES).slice(0, 10);
      var deck = studyState.data;
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var host = $('#studyToolBody');
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="text-align:center;font-size:24px;font-weight:900;margin:10px 0">___ ' + esc(item.noun) + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center">' +
        ['der', 'die', 'das'].map(function (art) {
          return '<button class="btn opt-btn" data-art="' + art + '" style="min-width:88px;font-size:16px">' + art + '</button>';
        }).join('') + '</div>' +
        '<div id="artFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-art]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = btn.getAttribute('data-art');
          var ok = chosen === item.art;
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.noun); }
          else logMistake(studyState.lang, item.noun, ['der', 'die', 'das'], ['der', 'die', 'das'].indexOf(item.art), 'article');
          $('#artFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + item.art + ' ' + esc(item.noun) + '</span>';
          Array.prototype.forEach.call(host.querySelectorAll('[data-art]'), function (b) { b.disabled = true; });
          setTimeout(function () { studyState.idx++; renderArticles(); }, 850);
        });
      });
    }

    // ---- 3. Memory match ----
    function renderMemory() {
      var host = $('#studyToolBody');
      if (!studyState.data) {
        var pool = shuffle(VOCAB[studyState.lang] || VOCAB.de).slice(0, 6);
        var cards = [];
        pool.forEach(function (item, i) {
          cards.push({ id: i, face: item.w, kind: 'w' });
          cards.push({ id: i, face: item.t, kind: 't' });
        });
        studyState.data = shuffle(cards);
        studyState.matched = {}; studyState.first = null; studyState.moves = 0; studyState.busy = false;
      }
      var deck = studyState.data;
      host.innerHTML =
        '<div style="color:var(--soft);font-weight:800;font-size:12px;margin-bottom:10px">' +
          esc(tr('Moves', 'Ходы')) + ': <b id="memMoves">' + studyState.moves + '</b></div>' +
        '<div id="memGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
        deck.map(function (c, i) {
          var isMatched = studyState.matched[i];
          var isOpen = studyState.first === i;
          var shown = isMatched || isOpen;
          return '<button class="btn mem-cell" data-cell="' + i + '"' + (isMatched ? ' disabled' : '') +
            ' style="min-height:64px;font-size:13px;font-weight:800;' + (isMatched ? 'opacity:.35;' : '') +
            'background:' + (shown ? 'var(--panel-soft)' : 'var(--ink)') + ';color:' + (shown ? 'var(--ink)' : 'transparent') + '">' +
            esc(c.face) + '</button>';
        }).join('') + '</div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-cell]'), function (btn) {
        btn.addEventListener('click', function () {
          if (studyState.busy) return;
          var i = Number(btn.getAttribute('data-cell'));
          if (studyState.matched[i] || studyState.first === i) return;
          if (studyState.first === null) { studyState.first = i; renderMemory(); return; }
          studyState.moves++;
          var a = deck[studyState.first], b = deck[i];
          if (a.id === b.id && a.kind !== b.kind) {
            studyState.matched[studyState.first] = true; studyState.matched[i] = true;
            studyState.first = null;
            renderMemory();
            if (Object.keys(studyState.matched).length >= deck.length) {
              setTimeout(function () { finishTool(tr('All matched', 'Все пары') + ' · ' + studyState.moves + ' ' + tr('moves', 'ходов'), 12); }, 300);
            }
          } else {
            studyState.busy = true;
            var firstIdx = studyState.first; studyState.first = i; renderMemory();
            setTimeout(function () {
              studyState.first = null; studyState.busy = false; renderMemory();
            }, 750);
            void firstIdx;
          }
        });
      });
    }

    // ---- 4. Grammar quiz ----
    function renderGrammar() {
      if (!studyState.data) studyState.data = shuffle(GRAMMAR[studyState.lang] || GRAMMAR.de);
      quizStep(studyState.data, renderGrammar, function (item) { return item.q; });
    }

    // ---- 5. Word usage ----
    function renderWordUsage() {
      if (!studyState.data) {
        studyState.data = shuffle(WORD_USAGE[studyState.lang] || WORD_USAGE.de).map(function (item) {
          var correctIdx = item.opts.indexOf(item.a);
          return { q: item.s, opts: item.opts, a: correctIdx < 0 ? 0 : correctIdx };
        });
      }
      quizStep(studyState.data, renderWordUsage, function (item) { return item.q; });
    }

    // shared MCQ step for grammar + word usage
    function quizStep(deck, rerender, promptOf) {
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var host = $('#studyToolBody');
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="font-size:18px;font-weight:900;margin:6px 0 14px">' + esc(promptOf(item)) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        item.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-opt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div id="quizFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-opt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-opt'));
          var ok = chosen === item.a;
          if (ok) { studyState.score++; clearMistake(studyState.lang, item.q); }
          else logMistake(studyState.lang, item.q, item.opts, item.a, 'mcq');
          Array.prototype.forEach.call(host.querySelectorAll('[data-opt]'), function (b, i) {
            b.disabled = true;
            if (i === item.a) b.style.background = 'rgba(37,178,150,.16)';
            else if (i === chosen) b.style.background = 'rgba(214,69,69,.14)';
          });
          $('#quizFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + esc(item.opts[item.a]) + '</span>';
          setTimeout(function () { studyState.idx++; rerender(); }, 900);
        });
      });
    }

    // ---- 6. Listening lab (TTS) ----
    function renderListening() {
      if (!studyState.data) studyState.data = shuffle(LISTEN[studyState.lang] || LISTEN.de);
      var deck = studyState.data;
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 3);
      var item = deck[studyState.idx];
      var host = $('#studyToolBody');
      var supported = !!window.speechSynthesis;
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        (supported ? '' : '<div class="empty">' + esc(tr('Your browser has no speech engine.', 'В браузере нет синтеза речи.')) + '</div>') +
        '<div style="text-align:center;margin:6px 0 12px">' +
          '<button class="btn primary" id="lsPlay" style="min-width:150px">🔊 ' + esc(tr('Play audio', 'Прослушать')) + '</button>' +
          '<div style="color:var(--soft);font-weight:700;font-size:12px;margin-top:8px">' + esc(item.hint) + '</div>' +
        '</div>' +
        '<div class="field"><label>' + esc(tr('Type what you hear', 'Запишите, что услышали')) + '</label>' +
        '<input id="lsInput" placeholder="..." autocomplete="off"></div>' +
        '<button class="btn primary" id="lsCheck" style="width:100%;margin-top:6px">' + esc(tr('Check', 'Проверить')) + '</button>' +
        '<div id="lsFb" style="font-weight:900;margin-top:12px;min-height:22px"></div>';
      function speak() {
        if (!supported) return;
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(item.text);
        u.lang = SPEECH_LOCALE[studyState.lang] || 'de-DE';
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
      $('#lsPlay').addEventListener('click', speak);
      if (supported) setTimeout(speak, 250);
      function norm(s) { return String(s || '').toLowerCase().replace(/[.,!?¿¡;:"']/g, '').replace(/\s+/g, ' ').trim(); }
      $('#lsCheck').addEventListener('click', function () {
        var val = norm($('#lsInput').value);
        var target = norm(item.text);
        var ok = val === target;
        if (!ok && val.length) {
          var vw = val.split(' '), tw = target.split(' ');
          var hits = vw.filter(function (w) { return tw.indexOf(w) >= 0; }).length;
          ok = hits / tw.length >= 0.8;
        }
        if (ok) studyState.score++;
        $('#lsFb').innerHTML = ok
          ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
          : '<span style="color:#d64545">' + esc(item.text) + '</span>';
        $('#lsCheck').disabled = true;
        setTimeout(function () { studyState.idx++; renderListening(); }, 1200);
      });
    }

    // ---- 7. Reading lab ----
    function renderReading() {
      if (!studyState.data) studyState.data = { passage: (READING[studyState.lang] || READING.de)[0], qIdx: 0, answered: false };
      var d = studyState.data;
      var passage = d.passage;
      var host = $('#studyToolBody');
      if (d.qIdx >= passage.questions.length) {
        return finishTool(studyState.score + ' / ' + passage.questions.length, passage.questions.length * 3);
      }
      var question = passage.questions[d.qIdx];
      host.innerHTML =
        '<div style="border:1px solid var(--line);border-radius:12px;padding:14px;background:var(--panel-soft);margin-bottom:14px">' +
          '<h3 style="margin:0 0 8px">' + esc(passage.title) + '</h3>' +
          '<p style="line-height:1.6;margin:0">' + esc(passage.text) + '</p>' +
        '</div>' +
        counterHtml(d.qIdx, passage.questions.length) +
        '<div style="font-weight:900;margin-bottom:10px">' + esc(question.q) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        question.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-ropt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div id="rdFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-ropt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-ropt'));
          var ok = chosen === question.a;
          if (ok) studyState.score++;
          Array.prototype.forEach.call(host.querySelectorAll('[data-ropt]'), function (b) { b.disabled = true; });
          $('#rdFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct!', 'Верно!')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + esc(question.opts[question.a]) + '</span>';
          setTimeout(function () { d.qIdx++; renderReading(); }, 900);
        });
      });
    }

    // ---- 8. Writing lab (self-check) ----
    function renderWriting() {
      if (!studyState.data) {
        var picks = shuffle(WRITING[studyState.lang] || WRITING.de);
        studyState.data = picks[0];
        studyState.checked = {};
      }
      var task = studyState.data;
      var host = $('#studyToolBody');
      var checkedCount = Object.keys(studyState.checked).filter(function (k) { return studyState.checked[k]; }).length;
      host.innerHTML =
        '<div style="font-weight:900;margin-bottom:10px">' + esc(task.prompt) + '</div>' +
        '<textarea id="wrText" rows="6" style="width:100%;border:1px solid var(--line);border-radius:10px;padding:10px;font:inherit" placeholder="' + esc(tr('Write here...', 'Пишите здесь...')) + '"></textarea>' +
        '<div style="color:var(--soft);font-weight:700;font-size:12px;margin:6px 0 12px" id="wrCount">0 ' + esc(tr('words', 'слов')) + '</div>' +
        '<div style="font-weight:900;margin-bottom:6px">' + esc(tr('Self-check', 'Самопроверка')) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px">' +
        task.checklist.map(function (item, i) {
          return '<label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">' +
            '<input type="checkbox" data-chk="' + i + '"' + (studyState.checked[i] ? ' checked' : '') + '>' +
            '<span>' + esc(item) + '</span></label>';
        }).join('') + '</div>' +
        '<button class="btn primary" id="wrDone" style="width:100%;margin-top:14px"' + (checkedCount < task.checklist.length ? ' disabled' : '') + '>' +
          esc(tr('Finish', 'Завершить')) + '</button>';
      $('#wrText').addEventListener('input', function () {
        var words = $('#wrText').value.trim().split(/\s+/).filter(Boolean).length;
        $('#wrCount').textContent = words + ' ' + tr('words', 'слов');
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-chk]'), function (chk) {
        chk.addEventListener('change', function () {
          studyState.checked[chk.getAttribute('data-chk')] = chk.checked;
          renderWriting();
        });
      });
      $('#wrDone').addEventListener('click', function () {
        if ($('#wrDone').disabled) return;
        finishTool(tr('Checklist complete', 'Чек-лист выполнен'), 10);
      });
    }

    // ---- 9. Exam mode (timed mixed quiz) ----
    function buildExamDeck(lang) {
      var deck = [];
      (GRAMMAR[lang] || GRAMMAR.de).forEach(function (g) { deck.push({ q: g.q, opts: g.opts, a: g.a }); });
      (WORD_USAGE[lang] || WORD_USAGE.de).forEach(function (w) {
        var ci = w.opts.indexOf(w.a);
        deck.push({ q: w.s, opts: w.opts, a: ci < 0 ? 0 : ci });
      });
      if (lang === 'de') {
        shuffle(ARTICLES).slice(0, 6).forEach(function (ar) {
          deck.push({ q: '___ ' + ar.noun, opts: ['der', 'die', 'das'], a: ['der', 'die', 'das'].indexOf(ar.art) });
        });
      }
      return shuffle(deck);
    }
    function renderExam() {
      if (!studyState.data) {
        studyState.data = buildExamDeck(studyState.lang);
        studyState.examEndAt = Date.now() + 90000;
        studyState.examTimerId = setInterval(examTick, 500);
      }
      examStep();
    }
    function examTick() {
      var el = $('#examTimer');
      if (!el || !studyState) return;
      var left = Math.max(0, Math.round((studyState.examEndAt - Date.now()) / 1000));
      el.textContent = (left / 60 | 0) + ':' + String(left % 60).padStart(2, '0');
      if (left <= 0) {
        clearInterval(studyState.examTimerId);
        studyState.examTimerId = null;
        studyState.idx = studyState.data.length;
        examStep();
      }
    }
    function examStep() {
      var deck = studyState.data;
      var host = $('#studyToolBody');
      if (studyState.idx >= deck.length) {
        if (studyState.examTimerId) { clearInterval(studyState.examTimerId); studyState.examTimerId = null; }
        return finishTool(studyState.score + ' / ' + deck.length, studyState.score * 3);
      }
      var item = deck[studyState.idx];
      var left = Math.max(0, Math.round((studyState.examEndAt - Date.now()) / 1000));
      host.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin:4px 0 12px">' +
          '<span style="color:var(--soft);font-weight:800;font-size:12px">' + (studyState.idx + 1) + ' / ' + deck.length + '</span>' +
          '<span id="examTimer" style="font-weight:900;color:var(--teal)">' + (left / 60 | 0) + ':' + String(left % 60).padStart(2, '0') + '</span>' +
        '</div>' +
        '<div style="font-size:18px;font-weight:900;margin:6px 0 14px">' + esc(item.q) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        item.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-eopt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-eopt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-eopt'));
          if (chosen === item.a) studyState.score++;
          else logMistake(studyState.lang, item.q, item.opts, item.a, 'mcq');
          studyState.idx++;
          examStep();
        });
      });
    }

    // ---- 10. Mistake center ----
    function renderMistakes() {
      if (!studyState.data) studyState.data = shuffle(loadMistakes());
      var deck = studyState.data;
      var host = $('#studyToolBody');
      if (!deck.length) {
        host.innerHTML = '<div class="empty">' + esc(tr('No mistakes saved. Great job!', 'Ошибок пока нет. Отлично!')) + '</div>';
        return;
      }
      if (studyState.idx >= deck.length) return finishTool(studyState.score + ' / ' + deck.length, deck.length * 2);
      var item = deck[studyState.idx];
      var label = item.kind === 'article' ? ('___ ' + item.prompt) : item.prompt;
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="font-size:18px;font-weight:900;margin:6px 0 14px">' + esc(label) + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        item.opts.map(function (opt, i) {
          return '<button class="btn opt-btn" data-mopt="' + i + '" style="text-align:left">' + esc(opt) + '</button>';
        }).join('') + '</div>' +
        '<div id="mistFb" style="text-align:center;font-weight:900;margin-top:12px;min-height:22px"></div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-mopt]'), function (btn) {
        btn.addEventListener('click', function () {
          var chosen = Number(btn.getAttribute('data-mopt'));
          var ok = chosen === item.a;
          if (ok) { studyState.score++; clearMistake(item.lang, item.prompt); }
          Array.prototype.forEach.call(host.querySelectorAll('[data-mopt]'), function (b) { b.disabled = true; });
          $('#mistFb').innerHTML = ok
            ? '<span style="color:var(--teal)">' + esc(tr('Correct! Removed from mistakes.', 'Верно! Убрано из ошибок.')) + '</span>'
            : '<span style="color:#d64545">' + esc(tr('Answer: ', 'Ответ: ')) + esc(item.opts[item.a]) + '</span>';
          setTimeout(function () { studyState.idx++; renderMistakes(); }, 900);
        });
      });
    }

    // ---- 11. Essentials (short lesson cards) ----
    function renderEssentials() {
      if (!studyState.data) studyState.data = ESSENTIALS[studyState.lang] || ESSENTIALS.de;
      var deck = studyState.data;
      if (studyState.idx >= deck.length) return finishTool(tr('All lessons reviewed', 'Все уроки пройдены'), deck.length * 2);
      var lesson = deck[studyState.idx];
      var host = $('#studyToolBody');
      host.innerHTML = counterHtml(studyState.idx, deck.length) +
        '<div style="border:1px solid var(--line);border-radius:12px;padding:16px;background:var(--panel-soft)">' +
          '<h3 style="margin:0 0 10px">' + esc(lesson.title) + '</h3>' +
          '<ul style="margin:0;padding-left:18px;line-height:1.7">' +
            lesson.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') +
          '</ul>' +
        '</div>' +
        '<button class="btn primary" id="essNext" style="width:100%;margin-top:14px">' + esc(tr('Got it, next', 'Понятно, дальше')) + '</button>';
      $('#essNext').addEventListener('click', function () { studyState.idx++; renderEssentials(); });
    }

    // ---- 12. AI practice coach (real LLM via Supabase edge function) ----
    const AI_TOPIC_PRESETS = {
      de: ['Small talk', 'Im Restaurant', 'Beim Arzt', 'Im Büro'],
      en: ['Small talk', 'At a restaurant', 'At the doctor', 'At work'],
      es: ['Charla informal', 'En el restaurante', 'En el médico', 'En el trabajo']
    };

    function aiChatBubble(role, text) {
      var mine = role === 'user';
      return '<div style="display:flex;justify-content:' + (mine ? 'flex-end' : 'flex-start') + ';margin-bottom:8px">' +
        '<div style="max-width:80%;padding:9px 13px;border-radius:14px;font-weight:600;line-height:1.45;' +
        (mine
          ? 'background:var(--teal);color:#fff;border-bottom-right-radius:4px'
          : 'background:var(--panel-soft);border:1px solid var(--line);border-bottom-left-radius:4px') +
        '">' + esc(text) + '</div></div>';
    }

    function renderAiPractice() {
      if (!aiChatState) {
        aiChatState = { started: false, lang: studyState.lang, topic: '', messages: [], conversationId: null, turns: 0, busy: false, error: null };
      }
      var host = $('#studyToolBody');

      if (!aiChatState.started) {
        var presets = AI_TOPIC_PRESETS[aiChatState.lang] || AI_TOPIC_PRESETS.de;
        host.innerHTML =
          '<div style="font-weight:900;margin-bottom:10px">' + esc(tr('What do you want to practice?', 'Что хотите попрактиковать?')) + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">' +
          presets.map(function (p) { return '<button type="button" class="btn opt-btn" data-preset="' + esc(p) + '" style="font-size:13px">' + esc(p) + '</button>'; }).join('') +
          '</div>' +
          '<div class="field"><label>' + esc(tr('Or type a topic', 'Или впишите свою тему')) + '</label>' +
          '<input id="aiTopic" placeholder="' + esc(tr('e.g. ordering coffee', 'например, заказ кофе')) + '" value="' + esc(aiChatState.topic) + '"></div>' +
          '<button class="btn primary" id="aiStart" style="width:100%;margin-top:10px">' + esc(tr('Start chatting', 'Начать разговор')) + '</button>';
        Array.prototype.forEach.call(host.querySelectorAll('[data-preset]'), function (btn) {
          btn.addEventListener('click', function () { $('#aiTopic').value = btn.getAttribute('data-preset'); });
        });
        $('#aiStart').addEventListener('click', function () {
          aiChatState.topic = $('#aiTopic').value.trim() || presets[0];
          aiChatState.started = true;
          renderAiPractice();
          sendAiTurn('__start__');
        });
        return;
      }

      host.innerHTML =
        '<div style="font-size:12px;color:var(--soft);font-weight:800;margin-bottom:8px">' +
          esc(tr('Topic: ', 'Тема: ')) + esc(aiChatState.topic) +
        '</div>' +
        '<div id="aiChatLog" style="max-height:320px;overflow-y:auto;padding:4px 2px;margin-bottom:10px"></div>' +
        (aiChatState.error ? '<div style="color:#d64545;font-weight:800;margin-bottom:8px">' + esc(aiChatState.error) + '</div>' : '') +
        '<div style="display:flex;gap:8px">' +
          '<input id="aiInput" placeholder="' + esc(tr('Type your answer...', 'Напишите ответ...')) + '" style="flex:1" autocomplete="off">' +
          '<button class="btn primary" id="aiSend"' + (aiChatState.busy ? ' disabled' : '') + '>' + (aiChatState.busy ? '…' : esc(tr('Send', 'Отпр.'))) + '</button>' +
        '</div>' +
        '<button class="btn" id="aiEnd" style="width:100%;margin-top:10px">' + esc(tr('End session', 'Завершить сессию')) + '</button>';

      var log = $('#aiChatLog');
      log.innerHTML = aiChatState.messages.map(function (m) { return aiChatBubble(m.role, m.text); }).join('') ||
        '<div class="empty">' + esc(tr('Say hello to start.', 'Поздоровайтесь, чтобы начать.')) + '</div>';
      log.scrollTop = log.scrollHeight;

      function send() {
        var input = $('#aiInput');
        var text = input.value.trim();
        if (!text || aiChatState.busy) return;
        input.value = '';
        sendAiTurn(text);
      }
      $('#aiSend').addEventListener('click', send);
      $('#aiInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
      $('#aiEnd').addEventListener('click', function () {
        var xp = Math.min(30, aiChatState.turns * 5);
        aiChatState = null;
        finishTool(tr('Session ended', 'Сессия завершена'), xp);
      });
    }

    async function sendAiTurn(text) {
      var isGreeting = text === '__start__';
      if (!isGreeting) aiChatState.messages.push({ role: 'user', text: text });
      aiChatState.busy = true;
      aiChatState.error = null;
      renderAiPractice();
      try {
        var nativeLocale = ctx.isRu ? 'ru-RU' : 'en-US';
        var { data, error } = await supa.functions.invoke('openai-assistant', {
          body: {
            action: 'respond',
            input: isGreeting ? 'Hello! Let\'s start.' : text,
            conversationId: aiChatState.conversationId,
            history: aiChatState.messages.slice(-6).map(function (m) { return { role: m.role, text: m.text }; }),
            locale: SPEECH_LOCALE[aiChatState.lang] || 'de-DE',
            nativeLocale: nativeLocale,
            practiceTopic: aiChatState.topic,
            nativeHelp: true
          }
        });
        if (error) throw error;
        var reply = data || {};
        var coach = reply.coach || null;
        var directText = (reply.text || '').trim();
        var assistantText = directText;
        if (!assistantText && coach) {
          var ar = (coach.assistantReply || '').trim();
          var nq = (coach.nextQuestion || '').trim();
          assistantText = ar && nq
            ? (ar.toLowerCase().indexOf(nq.toLowerCase()) >= 0 ? ar : (ar + ' ' + nq).trim())
            : (ar || nq);
        }
        assistantText = assistantText || tr('(no reply)', '(нет ответа)');
        aiChatState.conversationId = reply.conversationId || aiChatState.conversationId;
        aiChatState.messages.push({ role: 'assistant', text: assistantText });
        if (coach && coach.quickCorrection) {
          aiChatState.messages.push({ role: 'assistant', text: '✏️ ' + coach.quickCorrection });
        }
        aiChatState.turns++;
        bumpProgress('ai', 0);
      } catch (e) {
        aiChatState.error = (e && e.message) || tr('Could not reach the AI coach. Try again.', 'Не удалось связаться с ИИ-репетитором. Попробуйте ещё раз.');
      }
      aiChatState.busy = false;
      renderAiPractice();
    }

    function finishTool(scoreText, xp) {
      bumpProgress(studyState.tool, xp);
      awardXp(xp);
      var host = $('#studyToolBody');
      host.innerHTML = finishHtml(scoreText).replace('{xp}', xp);
      wireAgain();
    }

    return {
      studyToolsHtml: studyToolsHtml,
      bindStudyTiles: bindStudyTiles,
      openStudyTool: openStudyTool
    };
  }

  window.DuvelaAppStudy = { create: createStudyFeature };
})();
