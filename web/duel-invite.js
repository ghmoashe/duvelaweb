// Bridge page for friend-duel invites (vela.cafe/app.html?friend=CODE&target=…&level=…&variant=…).
// The web version has no friend rooms, so this page hands the invite to the Hub app
// (duvelahub:// scheme) and shows the code for joining manually.
(function () {
  var STRINGS = {
    en: {
      title: 'You have been challenged!',
      lead: 'A friend invites you to a duel in Duvela Academy Hub.',
      invalidTitle: 'This invite link is broken',
      invalidLead: 'Ask your friend to send the invite again.',
      codeLabel: 'Invite code',
      copy: 'Copy',
      copied: 'Copied',
      open: 'Open in the app',
      playWeb: 'Play in the browser',
      hint: 'If the button does nothing inside WhatsApp or Telegram, open this link in Safari or Chrome.',
      stepsTitle: 'Or join manually:',
      steps: ['Open Duvela Academy Hub', 'Go to Duel → Friend duel', 'Enter the code and tap “Join by code”'],
      home: 'Go to the Duvela website',
      level: 'Level',
    },
    ru: {
      title: 'Тебя вызвали на дуэль!',
      lead: 'Друг приглашает сыграть дуэль в Duvela Academy Hub.',
      invalidTitle: 'Ссылка-приглашение повреждена',
      invalidLead: 'Попросите друга отправить приглашение ещё раз.',
      codeLabel: 'Код приглашения',
      copy: 'Копировать',
      copied: 'Скопировано',
      open: 'Открыть в приложении',
      playWeb: 'Играть в браузере',
      hint: 'Если кнопка не сработала в WhatsApp или Telegram, откройте ссылку в Safari или Chrome.',
      stepsTitle: 'Или войдите вручную:',
      steps: ['Откройте Duvela Academy Hub', 'Дуэль → Friend duel', 'Введите код и нажмите «Войти по коду»'],
      home: 'На сайт Duvela',
      level: 'Уровень',
    },
    de: {
      title: 'Du wurdest herausgefordert!',
      lead: 'Ein Freund lädt dich zu einem Duell in Duvela Academy Hub ein.',
      invalidTitle: 'Dieser Einladungslink ist ungültig',
      invalidLead: 'Bitte deinen Freund, die Einladung noch einmal zu senden.',
      codeLabel: 'Einladungscode',
      copy: 'Kopieren',
      copied: 'Kopiert',
      open: 'In der App öffnen',
      playWeb: 'Im Browser spielen',
      hint: 'Wenn der Button in WhatsApp oder Telegram nichts tut, öffne den Link in Safari oder Chrome.',
      stepsTitle: 'Oder manuell beitreten:',
      steps: ['Öffne Duvela Academy Hub', 'Duell → Friend duel', 'Code eingeben und „Mit Code beitreten“ tippen'],
      home: 'Zur Duvela-Website',
      level: 'Niveau',
    },
  };

  var MODES = {
    classic: { en: 'Classic duel', ru: 'Классическая дуэль', de: 'Klassisches Duell' },
    article: { en: 'Guess article', ru: 'Угадай артикль', de: 'Artikel raten' },
    sentence: { en: 'Sentence builder', ru: 'Собери предложение', de: 'Satzbau' },
    prep: { en: 'Prepositions', ru: 'Предлоги', de: 'Präpositionen' },
    case: { en: 'Cases', ru: 'Падежи', de: 'Fälle' },
    verb: { en: 'Verb forms', ru: 'Формы глагола', de: 'Verbformen' },
    'sentence-check': { en: 'Correct sentence', ru: 'Верное предложение', de: 'Richtiger Satz' },
  };

  var TARGETS = {
    english: { flag: '🇬🇧', en: 'English', ru: 'Английский', de: 'Englisch' },
    german: { flag: '🇩🇪', en: 'German', ru: 'Немецкий', de: 'Deutsch' },
    spanish: { flag: '🇪🇸', en: 'Spanish', ru: 'Испанский', de: 'Spanisch' },
    french: { flag: '🇫🇷', en: 'French', ru: 'Французский', de: 'Französisch' },
    italian: { flag: '🇮🇹', en: 'Italian', ru: 'Итальянский', de: 'Italienisch' },
    portuguese: { flag: '🇵🇹', en: 'Portuguese', ru: 'Португальский', de: 'Portugiesisch' },
    swedish: { flag: '🇸🇪', en: 'Swedish', ru: 'Шведский', de: 'Schwedisch' },
    persian: { flag: '🇮🇷', en: 'Persian', ru: 'Персидский', de: 'Persisch' },
  };

  function pickLang() {
    var stored = '';
    try {
      stored = window.localStorage.getItem('duvela.webLang') || '';
    } catch (error) {
      stored = '';
    }
    var candidates = [stored].concat(navigator.languages || [navigator.language || 'en']);
    for (var i = 0; i < candidates.length; i += 1) {
      var code = String(candidates[i] || '').slice(0, 2).toLowerCase();
      if (STRINGS[code]) return code;
    }
    return 'en';
  }

  var lang = pickLang();
  var t = STRINGS[lang];
  document.documentElement.lang = lang;

  var params = new URLSearchParams(window.location.search);
  var code = String(params.get('friend') || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12);
  var target = String(params.get('target') || '').toLowerCase();
  var level = String(params.get('level') || '').toUpperCase();
  var variant = String(params.get('variant') || '').toLowerCase();
  if (!TARGETS[target]) target = '';
  if (!/^(A1|A2|B1|B2|C1|C2)$/.test(level)) level = '';
  if (!MODES[variant]) variant = 'classic';

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = byId(id);
    if (node) node.textContent = value;
  }

  setText('home', t.home);

  if (code.length < 4) {
    setText('title', t.invalidTitle);
    setText('lead', t.invalidLead);
    ['inviteBody', 'codeBox', 'openApp', 'playWeb', 'hint', 'stepsTitle', 'steps'].forEach(function (id) {
      byId(id).classList.add('hidden');
    });
    return;
  }

  setText('title', t.title);
  setText('lead', t.lead);
  setText('codeLabel', t.codeLabel);
  setText('code', code);
  setText('copy', t.copy);
  setText('openApp', t.open);
  setText('playWeb', t.playWeb);
  setText('hint', t.hint);
  setText('stepsTitle', t.stepsTitle);

  var chips = byId('chips');
  function addChip(text) {
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = text;
    chips.appendChild(chip);
  }
  addChip(MODES[variant][lang]);
  if (target) addChip(TARGETS[target].flag + ' ' + TARGETS[target][lang]);
  if (level) addChip(t.level + ' ' + level);

  var steps = byId('steps');
  t.steps.forEach(function (step) {
    var item = document.createElement('li');
    item.textContent = step;
    steps.appendChild(item);
  });

  var appParams = new URLSearchParams({ code: code, mode: 'friend', variant: variant });
  if (target) appParams.set('target', target);
  if (level) appParams.set('level', level);
  byId('openApp').href = 'duvelahub://native/duel?' + appParams.toString();

  // ---- play in the browser (scripts load on demand) ----
  var PLAY_SCRIPTS = [
    './web/vendor/supabase-js-v2.js',
    './web/duvela-runtime-config.js',
    './web/duvela-web-config.js',
    './web/duel-engine.generated.js?v=20261114-friend2',
    './web/friend-duel-play.js?v=20261114-friend2',
  ];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function loadPlayScripts() {
    return PLAY_SCRIPTS.reduce(function (chain, src) {
      return chain.then(function () { return loadScript(src); });
    }, Promise.resolve());
  }

  function goToLogin() {
    var back = new URLSearchParams(window.location.search);
    back.set('play', '1');
    window.location.href = './index.html?login=1&return_to=' + encodeURIComponent('/app.html?' + back.toString());
  }

  var playing = false;
  function playInBrowser() {
    if (playing) return;
    playing = true;
    byId('playWeb').disabled = true;
    loadPlayScripts()
      .then(function () {
        byId('inviteCard').classList.add('hidden');
        var playRoot = byId('playRoot');
        playRoot.classList.remove('hidden');
        window.DuvelaFriendDuelPlay.start({ code: code, lang: lang, root: playRoot, onLoginRequired: goToLogin });
      })
      .catch(function () {
        playing = false;
        byId('playWeb').disabled = false;
      });
  }

  byId('playWeb').addEventListener('click', playInBrowser);
  if (params.get('play') === '1') playInBrowser();

  byId('copy').addEventListener('click', function () {
    var button = byId('copy');
    function done() {
      button.textContent = t.copied;
      window.setTimeout(function () {
        button.textContent = t.copy;
      }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done, function () {});
    }
  });
})();
