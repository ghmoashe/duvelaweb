(function () {
  function createIndexI18n(ctx) {
    const localeCatalog = window.DUVELA_WEB_I18N;
    if (!localeCatalog) throw new Error('Duvela Web locale catalog failed to load.');

    const I18N = localeCatalog.base;
    const I18N_EXTRA = localeCatalog.extra;
    const LANG_STORAGE_KEY = localeCatalog.storageKey;
    const LANG_DATA = localeCatalog.locales;
    const SUPPORTED_LANGS = LANG_DATA.map((locale) => locale.code);
    const RTL_LANGS = new Set(
      LANG_DATA.filter((locale) => locale.dir === 'rtl').map((locale) => locale.code)
    );

    const langBtn = document.getElementById('langBtn');
    const langMenu = document.getElementById('langMenu');
    const langBtnFlag = document.getElementById('langBtnFlag');
    const langBtnCode = document.getElementById('langBtnCode');

    let dict = Object.assign({}, I18N.en, I18N_EXTRA.en);
    const WEB_APP_COPY = {
      en: {
        getApp: 'Open Web App',
        btnDownload: 'Start learning free',
        btnHow: 'Start teaching',
        heroClarity: 'Works in your browser. No download required.',
        heroMeta: '<b>Web app available now</b><br>Learners and teachers use the same account.',
        appsKicker: 'Two workspaces, one web app',
        appsTitle: 'Choose your <span class="grad-text">workspace</span>',
        appsSub: 'Duvela runs in a modern browser. Learners and teachers use one account and can return to the homepage at any time.',
        ctaTitle: 'Start learning with real teachers today',
        ctaSub: 'Create a free account and open your learner workspace directly in the browser.',
        ctaGet: 'Create free account',
        ctaExplore: 'Open Web App',
        footDownload: 'Web App',
        phoneGreeting: 'Welcome to Duvela',
        phoneStreak: 'Daily practice',
        levelTestCheck: 'Set your CEFR level',
        f2p: 'Join public LIVE sessions, ask questions in real time, practice speaking and send supported Duvela Coin gifts.',
        f3t: 'CEFR Level Setup',
        f3p: 'Choose or update your CEFR level from A1 to C2. Duvela uses it to organize relevant learning content.',
        f6p: 'Daily goals, XP, achievements and leaderboards track progress. Duvela Coins support eligible in-app gifts and rewards.',
        f7p: 'The practice hub includes 15+ tools for grammar, listening, writing, reading and review. Premium AI Coach adds guided dialogue and corrections.',
        f10p: 'Track eligible LIVE, course, event and gift income in the Business workspace.',
        earningFacts: '<div><dt>Balance</dt><dd>DC</dd></div><div><dt>Minimum request</dt><dd>100 DC</dd></div><div><dt>Methods</dt><dd>Bank, PayPal, Wise</dd></div><div><dt>Fees and conversion</dt><dd>Not yet published</dd></div>',
        s1p: 'Choose your current CEFR level from A1 to C2 and update it later as your learning goals change.',
        hub2: '<b>✓</b> CEFR level setup from A1 to C2',
        hub4: '<b>✓</b> XP, streaks and supported Duvela Coins',
        biz2: '<b>✓</b> Track eligible LIVE and gift income',
        mobileAppsKicker: 'Mobile apps',
        mobileAppsTitle: 'Download Duvela on your phone',
        storeNote: 'Store links will be enabled after the iOS and Android releases are published.'
      },
      ru: {
        getApp: 'Открыть веб-приложение',
        btnDownload: 'Начать бесплатно',
        btnHow: 'Начать преподавать',
        heroClarity: 'Работает в браузере. Скачивание не требуется.',
        heroMeta: '<b>Веб-приложение уже доступно</b><br>Ученики и преподаватели используют один аккаунт.',
        appsKicker: 'Два пространства, одно веб-приложение',
        appsTitle: 'Выберите своё <span class="grad-text">пространство</span>',
        appsSub: 'Duvela работает в современном браузере. Ученики и преподаватели используют один аккаунт.',
        ctaTitle: 'Начните учиться с настоящими преподавателями',
        ctaSub: 'Создайте бесплатный аккаунт и откройте пространство ученика прямо в браузере.',
        ctaGet: 'Создать аккаунт',
        ctaExplore: 'Открыть веб-приложение',
        footDownload: 'Веб-приложение',
        phoneGreeting: 'Добро пожаловать в Duvela',
        phoneStreak: 'Ежедневная практика',
        levelTestCheck: 'Укажите свой уровень CEFR',
        f2p: 'Подключайтесь к публичным LIVE-эфирам, задавайте вопросы, практикуйте речь и отправляйте доступные подарки за монеты Duvela.',
        f3t: 'Настройка уровня CEFR',
        f3p: 'Выберите или обновите уровень CEFR от A1 до C2. Duvela использует его для организации подходящего учебного контента.',
        f6p: 'Ежедневные цели, XP, достижения и рейтинг показывают прогресс. Монеты Duvela используются для доступных подарков и наград.',
        f7p: 'В разделе практики доступно более 15 тренажёров: грамматика, аудирование, письмо, чтение и повторение. Premium AI Coach добавляет диалоги и исправления.',
        f10p: 'Отслеживайте доступный доход от LIVE, курсов, событий и подарков в Business-пространстве.',
        earningFacts: '<div><dt>Баланс</dt><dd>DC</dd></div><div><dt>Минимальная заявка</dt><dd>100 DC</dd></div><div><dt>Способы</dt><dd>Банк, PayPal, Wise</dd></div><div><dt>Комиссия и конвертация</dt><dd>Ещё не опубликованы</dd></div>',
        s1p: 'Выберите текущий уровень CEFR от A1 до C2 и обновляйте его по мере изменения учебных целей.',
        hub2: '<b>✓</b> Настройка уровня CEFR от A1 до C2',
        hub4: '<b>✓</b> XP, серии и доступные монеты Duvela',
        biz2: '<b>✓</b> Учёт доступного LIVE-дохода и подарков',
        mobileAppsKicker: 'Мобильные приложения',
        mobileAppsTitle: 'Скачайте Duvela на телефон',
        storeNote: 'Ссылки будут активированы после публикации приложений для iOS и Android.'
      }
    };

    const I18N_MAP = [
      ['.nav-links li:nth-child(1) a', 'navVideo'],
      ['.nav-links li:nth-child(2) a', 'navFeatures'],
      ['.nav-links li:nth-child(3) a', 'navHow'],
      ['.nav-links li:nth-child(4) a', 'navLevels'],
      ['.nav-links li:nth-child(5) a', 'navApps'],
      ['#openLogin', 'signIn'],
      ['.nav-cta', 'getApp'],
      ['header.hero h1', 'heroTitle', true],
      ['.hero-sub', 'heroSub'],
      ['.hero-persona-learn .hero-persona-kicker', 'hubKicker'],
      ['.hero-persona-learn .hero-persona-text', 'hubP'],
      ['.hero-persona-biz .hero-persona-kicker', 'bizKicker', true],
      ['.hero-persona-biz .hero-persona-text', 'bizP'],
      ['.hero-actions .btn-primary', 'btnDownload'],
      ['.hero-actions .btn-ghost', 'btnHow'],
      ['.hero-clarity', 'heroClarity'],
      ['.video-title', 'videoTitle'],
      ['.video-sub', 'videoSub'],
      ['.stats-card .stat:nth-child(1) span', 'stat1'],
      ['.stats-card .stat:nth-child(2) span', 'stat2'],
      ['.stats-card .stat:nth-child(3) span', 'stat3'],
      ['.stats-card .stat:nth-child(4) span', 'stat4'],
      ['#features .sec-kicker', 'featKicker'],
      ['#features .sec-title', 'featTitle', true],
      ['#features .sec-sub', 'featSub'],
      ['.feat-grid .feat:nth-child(1) h3', 'f1t', true], ['.feat-grid .feat:nth-child(1) p', 'f1p'], ['.feat-grid .feat:nth-child(1) .feat-tag', 'f1g'],
      ['.feat-grid .feat:nth-child(2) h3', 'f2t', true], ['.feat-grid .feat:nth-child(2) p', 'f2p'], ['.feat-grid .feat:nth-child(2) .feat-tag', 'f2g'],
      ['.feat-grid .feat:nth-child(3) h3', 'f3t', true], ['.feat-grid .feat:nth-child(3) p', 'f3p'], ['.feat-grid .feat:nth-child(3) .feat-tag', 'f3g'],
      ['.feat-grid .feat:nth-child(4) h3', 'f4t', true], ['.feat-grid .feat:nth-child(4) p', 'f4p'], ['.feat-grid .feat:nth-child(4) .feat-tag', 'f4g'],
      ['.feat-grid .feat:nth-child(5) h3', 'f5t', true], ['.feat-grid .feat:nth-child(5) p', 'f5p'], ['.feat-grid .feat:nth-child(5) .feat-tag', 'f5g'],
      ['.feat-grid .feat:nth-child(6) h3', 'f6t', true], ['.feat-grid .feat:nth-child(6) p', 'f6p'], ['.feat-grid .feat:nth-child(6) .feat-tag', 'f6g'],
      ['.feat-grid .feat:nth-child(7) h3', 'f7t', true], ['.feat-grid .feat:nth-child(7) p', 'f7p'], ['.feat-grid .feat:nth-child(7) .feat-tag', 'f7g'],
      ['.feat-grid .feat:nth-child(8) h3', 'f8t', true], ['.feat-grid .feat:nth-child(8) p', 'f8p'], ['.feat-grid .feat:nth-child(8) .feat-tag', 'f8g'],
      ['.feat-grid .feat:nth-child(9) h3', 'f9t', true], ['.feat-grid .feat:nth-child(9) p', 'f9p'], ['.feat-grid .feat:nth-child(9) .feat-tag', 'f9g'],
      ['.feat-grid .feat:nth-child(10) h3', 'f10t', true], ['.feat-grid .feat:nth-child(10) p', 'f10p'], ['.feat-grid .feat:nth-child(10) .feat-tag', 'f10g'],
      ['.feat-grid .feat:nth-child(11) h3', 'f11t', true], ['.feat-grid .feat:nth-child(11) p', 'f11p'], ['.feat-grid .feat:nth-child(11) .feat-tag', 'f11g'],
      ['#how .sec-kicker', 'howKicker'],
      ['#how .sec-title', 'howTitle', true],
      ['.steps .step:nth-child(1) h3', 's1t'], ['.steps .step:nth-child(1) p', 's1p'],
      ['.steps .step:nth-child(2) h3', 's2t', true], ['.steps .step:nth-child(2) p', 's2p'],
      ['.steps .step:nth-child(3) h3', 's3t'], ['.steps .step:nth-child(3) p', 's3p'],
      ['#levels .sec-title', 'lvlTitle', true],
      ['#levels .sec-sub', 'lvlSub'],
      ['.levels-note', 'lvlNote', true],
      ['#apps .sec-kicker', 'appsKicker'],
      ['#apps .sec-title', 'appsTitle', true],
      ['#apps .sec-sub', 'appsSub'],
      ['.app-hub .app-kicker', 'hubKicker'],
      ['.app-hub > p', 'hubP'],
      ['.app-hub .app-feats li:nth-child(1)', 'hub1', true], ['.app-hub .app-feats li:nth-child(2)', 'hub2', true],
      ['.app-hub .app-feats li:nth-child(3)', 'hub3', true], ['.app-hub .app-feats li:nth-child(4)', 'hub4', true],
      ['.app-biz .app-kicker', 'bizKicker', true],
      ['.app-biz > p', 'bizP'],
      ['.app-biz .app-feats li:nth-child(1)', 'biz1', true], ['.app-biz .app-feats li:nth-child(2)', 'biz2', true],
      ['.app-biz .app-feats li:nth-child(3)', 'biz3', true], ['.app-biz .app-feats li:nth-child(4)', 'biz4', true],
      ['.cta-banner h2', 'ctaTitle'],
      ['.cta-banner p', 'ctaSub'],
      ['.btn-white', 'ctaGet'],
      ['.btn-outline-w', 'ctaExplore'],
      ['.foot-brand p', 'footBrand'],
      ['.foot-inner > div:nth-child(2) h4', 'footProduct'],
      ['.foot-inner > div:nth-child(2) a:nth-of-type(1)', 'footFeatures'],
      ['.foot-inner > div:nth-child(2) a:nth-of-type(2)', 'footHow'],
      ['.foot-inner > div:nth-child(2) a:nth-of-type(3)', 'footLevels'],
      ['.foot-inner > div:nth-child(2) a:nth-of-type(4)', 'footDownload'],
      ['.foot-inner > div:nth-child(3) h4', 'footTeachers'],
      ['.foot-inner > div:nth-child(3) a:nth-of-type(1)', 'footBiz'],
      ['.foot-inner > div:nth-child(3) a:nth-of-type(2)', 'footLive'],
      ['.foot-inner > div:nth-child(3) a:nth-of-type(3)', 'footCourses'],
      ['.foot-inner > div:nth-child(3) a:nth-of-type(4)', 'footAnalytics'],
      ['.foot-inner > div:nth-child(4) h4', 'footCompany'],
      ['#footAbout', 'footAbout'],
      ['#footContact', 'footContact'],
      ['#footPrivacy', 'footPrivacy'],
      ['#footImpressum', 'footImpressum'],
      ['#footTerms', 'footTerms'],
      ['#footCookie', 'footCookie'],
      ['.foot-bottom > span', 'footCopy'],
      ['#loginTitle', 'loginTitle'],
      ['#tabSignin', 'tabSignin'],
      ['#tabSignup', 'tabSignup'],
      ['#signupRoleSelect option[value="learner"]', 'roleLearner'],
      ['#signupRoleSelect option[value="teacher"]', 'roleTeacher'],
      ['#signupRoleSelect option[value="organizer"]', 'roleOrganizer'],
      ['#signupRoleSelect option[value="organization"]', 'roleOrganization'],
      ['#loginFoot1', 'loginFoot1'],
      ['#loginGetApp', 'signupHere'],
      ['.store-btn:nth-child(1) small', 'storeDownloadOn'],
      ['.store-btn:nth-child(2) small', 'storeGetItOn'],

      ['.phone-screen > .p-page:nth-child(1) .lp-hi', 'phoneGreeting'],
      ['.phone-screen > .p-page:nth-child(1) .lp-sub', 'phoneLearnToday'],
      ['.phone-screen > .p-page:nth-child(1) .lp-chiprow .lp-chip:nth-child(1)', 'phoneStreak'],
      ['.phone-screen > .p-page:nth-child(1) > .lp-card:nth-child(3) .lp-label', 'phoneContinueLearning'],
      ['.phone-screen > .p-page:nth-child(1) > .lp-card:nth-child(3) .lp-card-title', 'phoneUnit'],
      ['.phone-screen > .p-page:nth-child(1) > .lp-card:nth-child(3) .lp-card-meta', 'phoneComplete'],
      ['.phone-screen > .p-page:nth-child(1) > .lp-card:nth-child(4) .lp-card-title', 'phoneSpeakingClub'],
      ['.phone-screen > .p-page:nth-child(1) > .lp-card:nth-child(4) .lp-card-meta', 'phoneFriday'],
      ['.phone-screen > .p-page:nth-child(1) > .lp-label:nth-child(5)', 'phoneTopTeachers'],
      ['.phone-screen > .p-page:nth-child(1) .tch:nth-child(1) span', 'langGerman'],
      ['.phone-screen > .p-page:nth-child(1) .tch:nth-child(2) span', 'langEnglish'],
      ['.phone-screen > .p-page:nth-child(1) .tch:nth-child(3) span', 'langSpanish'],

      ['.p-tabs .p-tab:nth-child(1)', 'tabShorts'],
      ['.p-tabs .p-tab:nth-child(2)', 'tabVideos'],
      ['.p-tabs .p-tab:nth-child(3)', 'tabLive', true],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(2) .p-title', 'videoGermanStories'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(2) .p-meta', 'videoGermanMeta'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(3) .p-title', 'videoEnglishClub'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(3) .p-meta', 'videoEnglishMeta'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(4) .p-title', 'videoDailyPhrases'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(4) .p-meta', 'videoSpanishMeta'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(5) .p-title', 'videoFrenchMinutes'],
      ['.phone-screen > .p-page:nth-child(2) > .p-card:nth-child(5) .p-meta', 'videoFrenchMeta'],

      ['.phone-screen > .p-page:nth-child(3) .p-live-sub', 'liveJoinLesson'],
      ['.phone-screen > .p-page:nth-child(3) > div:nth-child(3)', 'liveNow'],
      ['.phone-screen > .p-page:nth-child(3) > .lv-row:nth-child(4) .lv-topic', 'liveTopicGerman'],
      ['.phone-screen > .p-page:nth-child(3) > .lv-row:nth-child(5) .lv-topic', 'liveTopicIelts'],
      ['.phone-screen > .p-page:nth-child(3) > .lv-row:nth-child(6) .lv-topic', 'liveTopicSpanish'],
      ['.phone-screen > .p-page:nth-child(3) .lv-join', 'join'],

      ['.phone-screen > .p-page:nth-child(4) > .lp-hi', 'practiceTitle'],
      ['.phone-screen > .p-page:nth-child(4) > .lp-card:nth-child(2) .lp-label', 'dailyGoal'],
      ['.phone-screen > .p-page:nth-child(4) > .lp-card:nth-child(2) .lp-card-meta', 'keepStreak'],
      ['.phone-screen > .p-page:nth-child(4) .lp-skills .lp-card:nth-child(1) .lp-card-title', 'grammar'],
      ['.phone-screen > .p-page:nth-child(4) .lp-skills .lp-card:nth-child(2) .lp-card-title', 'vocabulary'],
      ['.phone-screen > .p-page:nth-child(4) .lp-skills .lp-card:nth-child(3) .lp-card-title', 'speaking'],
      ['.phone-screen > .p-page:nth-child(4) .lp-skills .lp-card:nth-child(4) .lp-card-title', 'exam'],
      ['.phone-screen > .p-page:nth-child(4) .pf-test > div:nth-child(2) > div:nth-child(1)', 'levelTest'],
      ['.phone-screen > .p-page:nth-child(4) .pf-test > div:nth-child(2) > div:nth-child(2)', 'levelTestCheck'],

      ['.phone-screen > .p-page:nth-child(5) > .lp-hi', 'inboxTitle'],
      ['.phone-screen > .p-page:nth-child(5) > .ib-row:nth-child(2) .ib-msg', 'msgProgress'],
      ['.phone-screen > .p-page:nth-child(5) > .ib-row:nth-child(3) .ib-msg', 'msgEssay'],
      ['.phone-screen > .p-page:nth-child(5) > .ib-row:nth-child(4) .ib-msg', 'msgSpanish'],
      ['.phone-screen > .p-page:nth-child(5) > .ib-row:nth-child(5) .ib-msg', 'msgAchievement'],

      ['.phone-screen > .p-page:nth-child(6) .pf-loc', 'learningGerman'],
      ['.phone-screen > .p-page:nth-child(6) .pf-stat:nth-child(2) span', 'streakLabel'],
      ['.phone-screen > .p-page:nth-child(6) .pf-stat:nth-child(3) span', 'coinsLabel'],
      ['.phone-screen > .p-page:nth-child(6) .lp-card .lp-card-title', 'currentLevel'],
      ['.phone-screen > .p-page:nth-child(6) .lp-card .lp-card-meta', 'germanIntermediate'],
      ['.phone-screen > .p-page:nth-child(6) .pf-test > div:nth-child(2) > div:nth-child(1)', 'retakeLevel'],
      ['.phone-screen > .p-page:nth-child(6) .pf-test > div:nth-child(2) > div:nth-child(2)', 'feedAdapts'],
      ['.phone-screen > .p-nav span:nth-child(1)', 'navHome'],
      ['.phone-screen > .p-nav span:nth-child(2)', 'navShorts'],
      ['.phone-screen > .p-nav span:nth-child(3)', 'navPractice'],
      ['.phone-screen > .p-nav span:nth-child(4)', 'navInbox'],
      ['.phone-screen > .p-nav span:nth-child(5)', 'navProfile']
    ];

    function detectWebLanguage() {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved && SUPPORTED_LANGS.includes(saved)) return saved;

      const candidates = navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || 'en'];

      for (const candidate of candidates) {
        const code = String(candidate).toLowerCase().split('-')[0];
        if (SUPPORTED_LANGS.includes(code)) return code;
      }

      return 'en';
    }

    function applyWebLanguage(code) {
      dict = Object.assign({}, I18N.en, I18N_EXTRA.en, I18N[code] || {}, I18N_EXTRA[code] || {});
      Object.assign(dict, WEB_APP_COPY[code] || WEB_APP_COPY.en);
      document.documentElement.lang = code;
      document.documentElement.dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr';
      document.title = dict.metaTitle;

      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) metaDescription.content = dict.metaDescription;

      document.getElementById('closeLogin').setAttribute('aria-label', dict.closeLabel);
      langBtn.setAttribute('aria-label', dict.languageLabel);

      for (const [selector, key, isHtml] of I18N_MAP) {
        if (!dict[key]) continue;
        document.querySelectorAll(selector).forEach((el) => {
          if (isHtml) el.innerHTML = dict[key];
          else el.textContent = dict[key];
        });
      }

      const earningFacts = document.getElementById('earningFacts');
      if (earningFacts && dict.earningFacts) earningFacts.innerHTML = dict.earningFacts;

      const mobileAppsKicker = document.querySelector('.mobile-downloads-copy > span');
      const mobileAppsTitle = document.querySelector('.mobile-downloads-copy h3');
      const mobileStoreNote = document.getElementById('mobileStoreNote');
      if (mobileAppsKicker) mobileAppsKicker.textContent = dict.mobileAppsKicker;
      if (mobileAppsTitle) mobileAppsTitle.textContent = dict.mobileAppsTitle;
      if (mobileStoreNote) mobileStoreNote.textContent = dict.storeNote;

      for (const kind of ['privacy', 'impressum', 'terms']) {
        const link = document.getElementById(
          kind === 'impressum' ? 'footImpressum' : 'foot' + kind[0].toUpperCase() + kind.slice(1)
        );
        if (link) link.href = './legal.html?doc=' + kind + '&lang=' + code;
      }

      window.DUVELA_CONSENT?.updateLanguage(code);

      [
        ['.fc-1', 'phoneLevelMatched'],
        ['.fc-2', 'phoneLikesToday'],
        ['.fc-3', 'phoneProgress']
      ].forEach(([selector, key]) => {
        const el = document.querySelector(selector);
        if (!el || !dict[key]) return;
        const separator = dict[key].indexOf(' ');
        const icon = separator === -1 ? '' : dict[key].slice(0, separator);
        const text = separator === -1 ? dict[key] : dict[key].slice(separator + 1);
        el.innerHTML = '<span class="chip-icon">' + icon + '</span> ' + text;
      });

      const videoChip = document.querySelector('.video-chip');
      if (videoChip) videoChip.innerHTML = '<span class="dot"></span> ' + dict.videoChip;
      const heroMeta = document.querySelector('.hero-meta p');
      if (heroMeta) heroMeta.innerHTML = dict.heroMeta;

      document.getElementById('loginEmail').placeholder = dict.phEmail;
      document.getElementById('loginPassword').placeholder = dict.phPassword;

      if (ctx.onDictChange) ctx.onDictChange(dict, code);
      window.dispatchEvent(new CustomEvent('duvela-language-change', { detail: { locale: code } }));
    }

    function renderLanguageMenu() {
      const fragment = document.createDocumentFragment();

      for (const language of LANG_DATA) {
        const item = document.createElement('li');
        item.className = 'lang-item';
        item.dataset.val = language.code;
        item.setAttribute('role', 'option');
        item.textContent = language.flag + ' ' + language.name;
        fragment.appendChild(item);
      }

      langMenu.replaceChildren(fragment);
    }

    function setLang(code) {
      const entry = LANG_DATA.find((language) => language.code === code) || LANG_DATA[0];
      langBtnFlag.textContent = entry.flag;
      langBtnCode.textContent = entry.code.toUpperCase();
      langMenu.querySelectorAll('.lang-item').forEach((li) => {
        const active = li.dataset.val === entry.code;
        li.classList.toggle('active', active);
        li.setAttribute('aria-selected', String(active));
      });
      localStorage.setItem(LANG_STORAGE_KEY, entry.code);
      applyWebLanguage(entry.code);
    }

    function bindEvents() {
      langBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const open = langMenu.classList.toggle('open');
        langBtn.classList.toggle('open', open);
        langBtn.setAttribute('aria-expanded', open);
      });

      langMenu.addEventListener('click', (event) => {
        const item = event.target.closest('.lang-item');
        if (!item) return;
        langMenu.classList.remove('open');
        langBtn.classList.remove('open');
        langBtn.setAttribute('aria-expanded', 'false');
        setLang(item.dataset.val);
      });

      document.addEventListener('click', () => {
        langMenu.classList.remove('open');
        langBtn.classList.remove('open');
        langBtn.setAttribute('aria-expanded', 'false');
      });

      document.getElementById('footCookie').addEventListener('click', (event) => {
        event.preventDefault();
        window.DUVELA_CONSENT.openSettings();
      });
    }

    function init() {
      renderLanguageMenu();
      bindEvents();
      const initialLang = detectWebLanguage();
      setLang(initialLang);
      window.DUVELA_CONSENT.init(initialLang);
    }

    return {
      getDict: () => dict,
      init,
      setLang
    };
  }

  window.DuvelaIndexI18n = { create: createIndexI18n };
})();
