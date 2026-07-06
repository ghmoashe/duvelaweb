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
      ['.hero-trust .hero-trust-item:nth-child(1) span', 'stat2'],
      ['.hero-trust .hero-trust-item:nth-child(2) span', 'stat3'],
      ['.hero-trust .hero-trust-item:nth-child(3) span', 'stat4'],
      ['.hero-preview-kicker', 'liveNow'],
      ['.hero-preview-sub', 'liveJoinLesson'],
      ['.hero-preview-topic', 'liveTopicGerman'],
      ['.hero-preview-link', 'join'],
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

      const heroBadge = document.querySelector('.hero-badge');
      if (heroBadge) heroBadge.innerHTML = '<span class="dot"></span> ' + dict.heroBadge;
      const videoChip = document.querySelector('.video-chip');
      if (videoChip) videoChip.innerHTML = '<span class="dot"></span> ' + dict.videoChip;
      const heroMeta = document.querySelector('.hero-meta p');
      if (heroMeta) heroMeta.innerHTML = '<span class="stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span><br>' + dict.heroMeta;

      document.getElementById('loginEmail').placeholder = dict.phEmail;
      document.getElementById('loginPassword').placeholder = dict.phPassword;

      if (ctx.onDictChange) ctx.onDictChange(dict, code);
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
