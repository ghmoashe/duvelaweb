  // Scroll-reveal
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // Stagger feature/step cards
  document.querySelectorAll('.feat-grid .feat, .steps .step').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 3) * 90}ms`;
  });

  // ── Phone mockup: auto-rotate screens every 4s ──
  // Page order: Home, Videos, Live, Practice, Inbox, Profile
  const pPages = [...document.querySelectorAll('.p-page')];
  const pNavItems = [...document.querySelectorAll('.p-nav span')];
  const pNav = document.querySelector('.p-nav');
  const phoneEl = document.querySelector('.phone');
  // Which bottom-nav tab each page highlights (Live lives under Shorts)
  const navFor = [0, 1, 1, 2, 3, 4];
  let pIdx = 1;
  let pTimer = null;

  function showPage(i) {
    pIdx = i;
    pPages.forEach((p, j) => p.classList.toggle('active', j === i));
    pNavItems.forEach((n, j) => n.classList.toggle('on', j === navFor[i]));
    pNav.classList.toggle('lightnav', pPages[i].classList.contains('light'));
  }
  function startRotate() {
    clearInterval(pTimer);
    pTimer = setInterval(() => showPage((pIdx + 1) % pPages.length), 4000);
  }

  // Click a nav tab to jump to its screen
  pNavItems.forEach((n, j) => {
    n.addEventListener('click', () => {
      const target = navFor.indexOf(j);
      if (target >= 0) { showPage(target); startRotate(); }
    });
  });
  // Pause while hovering the phone
  phoneEl.addEventListener('mouseenter', () => clearInterval(pTimer));
  phoneEl.addEventListener('mouseleave', startRotate);

  showPage(1);
  startRotate();

  // ── Login modal ──
  const config = window.DuvelaWebConfig;
  const rolesApi = window.DuvelaWebRoles;
  const overlay = document.getElementById('loginOverlay');
  const loginSubmit = document.getElementById('loginSubmit');
  const loginNote = document.getElementById('loginNote');
  const WEB_ROLE_KEY = config.storageKeys.role;
  const AUTH_FLOW_KEY = config.storageKeys.authFlow;
  const AUTH_MODE_KEY = config.storageKeys.authMode;
  const SIGNUP_ROLE_KEY = config.storageKeys.signupRole;
  const LOGIN_ROLE = 'learner';
  const roleKeys = { learner: 'roleLearner', teacher: 'roleTeacher', organizer: 'roleOrganizer', organization: 'roleOrganization' };
  let currentRole = LOGIN_ROLE;
  let signupRole = normalizeSignupRole(localStorage.getItem(SIGNUP_ROLE_KEY) || 'learner');
  let signedInUser = null;
  let authMode = 'signin';
  const tabSignin = document.getElementById('tabSignin');
  const tabSignup = document.getElementById('tabSignup');
  const confirmWrap = document.getElementById('confirmWrap');
  const forgotPassLink = document.getElementById('forgotPass');
  const loginFootWrap = document.getElementById('loginFootWrap');
  const signupRoleWrap = document.getElementById('signupRoleWrap');
  const signupRoleSelect = document.getElementById('signupRoleSelect');
  function normalizeSignupRole(role) {
    return rolesApi.normalizeSignupRole(role);
  }
  function syncCurrentRole() {
    currentRole = authMode === 'signup' ? signupRole : LOGIN_ROLE;
  }
  function setSignupRole(role) {
    signupRole = normalizeSignupRole(role);
    localStorage.setItem(SIGNUP_ROLE_KEY, signupRole);
    signupRoleSelect.value = signupRole;
    syncCurrentRole();
    refreshLoginSubmit();
  }
  function refreshLoginSubmit() {
    if (authMode === 'signup') {
      const roleName = dict[roleKeys[signupRole]] || signupRole;
      loginSubmit.textContent = (dict.signUpAs || 'Create account as {role}').replace('{role}', roleName);
    } else {
      loginSubmit.textContent = dict.tabSignin || 'Sign in';
    }
  }
  function setAuthMode(mode) {
    authMode = mode === 'signup' ? 'signup' : 'signin';
    const activeStyle = 'flex:1;padding:10px;border-radius:12px;border:1px solid var(--purple);background:var(--purple);color:#fff;font-weight:900;cursor:pointer;font-size:14px';
    const idleStyle = 'flex:1;padding:10px;border-radius:12px;border:1px solid #E4D9FF;background:#fff;color:var(--purple);font-weight:900;cursor:pointer;font-size:14px';
    tabSignin.setAttribute('style', authMode === 'signin' ? activeStyle : idleStyle);
    tabSignup.setAttribute('style', authMode === 'signup' ? activeStyle : idleStyle);
    confirmWrap.style.display = authMode === 'signup' ? 'block' : 'none';
    signupRoleWrap.style.display = authMode === 'signup' ? 'block' : 'none';
    document.getElementById('loginConfirm').required = authMode === 'signup';
    forgotPassLink.style.display = authMode === 'signup' ? 'none' : 'block';
    loginFootWrap.style.display = authMode === 'signup' ? 'none' : 'block';
    document.getElementById('loginPassword').setAttribute('autocomplete', authMode === 'signup' ? 'new-password' : 'current-password');
    syncCurrentRole();
    loginNote.classList.remove('show');
    refreshLoginSubmit();
  }
  tabSignin.addEventListener('click', () => setAuthMode('signin'));
  tabSignup.addEventListener('click', () => setAuthMode('signup'));
  signupRoleSelect.addEventListener('change', (e) => setSignupRole(e.target.value));
  function authCallbackUrl() {
    const url = new URL('./index.html', window.location.href);
    url.searchParams.set('auth', '1');
    return url.href;
  }
  function appUrl(role, hash = '#home') {
    const selectedRole = role || currentRole || 'learner';
    const url = new URL('./app.html', window.location.href);
    url.searchParams.set('role', selectedRole);
    url.hash = hash && hash.startsWith('#') ? hash : '#home';
    return url.href;
  }
  function defaultHashForRole(role) {
    return isBusinessWebRole(role) ? '#workspace' : '#home';
  }
  function goToWebApp(role, hash) {
    localStorage.setItem(WEB_ROLE_KEY, role || currentRole || 'learner');
    window.location.href = appUrl(role, hash || defaultHashForRole(role));
  }
  async function detectWebRole(userId) {
    return rolesApi.detectWebRole(supa, userId);
  }
  async function goToDetectedWebApp(userOrId, hash) {
    const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
    const detectedRole = userId ? await detectWebRole(userId) : LOGIN_ROLE;
    currentRole = detectedRole;
    goToWebApp(detectedRole, hash || defaultHashForRole(detectedRole));
  }
  async function finishOAuthFlow(sessionUser) {
    const flowMode = sessionStorage.getItem(AUTH_MODE_KEY) || 'signin';
    const savedSignupRole = normalizeSignupRole(sessionStorage.getItem(SIGNUP_ROLE_KEY) || localStorage.getItem(SIGNUP_ROLE_KEY) || signupRole);
    sessionStorage.removeItem(AUTH_FLOW_KEY);
    sessionStorage.removeItem(AUTH_MODE_KEY);
    sessionStorage.removeItem(SIGNUP_ROLE_KEY);
    if (flowMode === 'signup') {
      signupRole = savedSignupRole;
      currentRole = signupRole;
      await upsertWebProfile(sessionUser.id, sessionUser.email, document.documentElement.getAttribute('lang') || 'en');
      goToWebApp(signupRole, defaultHashForRole(signupRole));
      return;
    }
    currentRole = LOGIN_ROLE;
    await goToDetectedWebApp(sessionUser);
  }
  function configureWebAppLinks() {
    document.querySelectorAll('.app-hub .store-btn').forEach((link) => { link.href = appUrl('learner', '#home'); });
    document.querySelectorAll('.app-biz .store-btn').forEach((link) => { link.href = appUrl('teacher', '#workspace'); });
    document.querySelectorAll('.tch-btn-big').forEach((link) => { link.href = appUrl('teacher', '#workspace'); });
    const footBiz = document.querySelector('.foot-inner > div:nth-child(3) a:nth-of-type(1)');
    if (footBiz) footBiz.href = appUrl('teacher', '#home');
    const footLive = document.querySelector('.foot-inner > div:nth-child(3) a:nth-of-type(2)');
    if (footLive) footLive.href = appUrl('teacher', '#live');
    const footCourses = document.querySelector('.foot-inner > div:nth-child(3) a:nth-of-type(3)');
    if (footCourses) footCourses.href = appUrl('teacher', '#courses');
    const footAnalytics = document.querySelector('.foot-inner > div:nth-child(3) a:nth-of-type(4)');
    if (footAnalytics) footAnalytics.href = appUrl('teacher', '#home');
  }
  configureWebAppLinks();

  function openLogin() {
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeLogin() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    loginNote.classList.remove('show');
  }
  function handleLoginAccess(e) {
    e.preventDefault();
    if (signedInUser) goToDetectedWebApp(signedInUser);
    else openLogin();
  }
  document.getElementById('openLogin').addEventListener('click', handleLoginAccess);
  document.getElementById('openLoginMob').addEventListener('click', handleLoginAccess);
  document.getElementById('closeLogin').addEventListener('click', closeLogin);
  document.getElementById('loginGetApp').addEventListener('click', (e) => { e.preventDefault(); setAuthMode('signup'); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLogin(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLogin(); });

  function isBusinessWebRole(role) {
    return rolesApi.isBusinessRole(role);
  }

  async function upsertWebProfile(userId, email, locale) {
    const now = new Date().toISOString();
    const patch = { id: userId, email: email || null, locale, updated_at: now };
    try { await supa.from('profiles').upsert(patch, { onConflict: 'id' }); }
    catch (err) { console.warn('profile upsert skipped', err); }

    if (!isBusinessWebRole(currentRole)) return;

    try {
      const existing = await supa.from('profiles')
        .select('is_teacher,is_organizer,is_admin,requested_role,role_request_status')
        .eq('id', userId)
        .maybeSingle();
      if (existing.error || !existing.data) return;
      const profile = existing.data;
      const approved =
        profile.is_admin
        || (currentRole === 'teacher' && profile.is_teacher)
        || ((currentRole === 'organizer' || currentRole === 'organization') && profile.is_organizer);
      if (approved) {
        await supa.from('profiles').update({ last_web_role: currentRole, updated_at: now }).eq('id', userId);
        return;
      }
      await supa.from('profiles').update({
        requested_role: currentRole,
        role_request_status: 'pending',
        requested_role_at: now,
        last_web_role: currentRole,
        updated_at: now
      }).eq('id', userId);
    } catch (err) {
      console.warn('role request update skipped', err);
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const locale = document.documentElement.getAttribute('lang') || 'en';
    loginNote.classList.remove('show');
    loginNote.style.color = '';
    localStorage.setItem(WEB_ROLE_KEY, currentRole);

    if (authMode === 'signup') {
      const confirm = document.getElementById('loginConfirm').value;
      if (password.length < 6) {
        loginNote.textContent = dict.pwTooShort || 'Password must be at least 6 characters.';
        loginNote.classList.add('show');
        return;
      }
      if (password !== confirm) {
        loginNote.textContent = dict.pwMismatch || 'Passwords do not match.';
        loginNote.classList.add('show');
        return;
      }
      loginSubmit.disabled = true;
      loginSubmit.textContent = dict.creatingAccount || 'Creating account...';
      const { data, error } = await supa.auth.signUp({
        email,
        password,
        options: { data: { locale, web_role: currentRole }, emailRedirectTo: authCallbackUrl() }
      });
      loginSubmit.disabled = false;
      refreshLoginSubmit();
      if (error) {
        loginNote.textContent = error.message || 'Could not create the account.';
        loginNote.classList.add('show');
        return;
      }
      if (data.user) await upsertWebProfile(data.user.id, email, locale);
      if (!data.session) {
        loginNote.style.color = 'var(--purple)';
        loginNote.textContent = (dict.checkEmailVerify || 'Account created. Check your email to confirm, then sign in.');
        loginNote.classList.add('show');
        setAuthMode('signin');
        return;
      }
      goToWebApp(currentRole, defaultHashForRole(currentRole));
      return;
    }

    loginSubmit.disabled = true;
    loginSubmit.textContent = dict.signingIn || 'Signing in...';
    const { data, error } = await supa.auth.signInWithPassword({ email, password });
    loginSubmit.disabled = false;
    refreshLoginSubmit();
    if (error) {
      loginNote.textContent = error.message || 'Could not sign in. Check your email and password.';
      loginNote.classList.add('show');
      return;
    }
    if (data.user) await upsertWebProfile(data.user.id, email, locale);
    await goToDetectedWebApp(data.user);
  });

  if (new URLSearchParams(window.location.search).get('login') === '1') openLogin();

  // ── i18n: автоопределение языка устройства + переключатель ──
  const localeCatalog = window.DUVELA_WEB_I18N;
  if (!localeCatalog) throw new Error('Duvela Web locale catalog failed to load.');

  const I18N = localeCatalog.base;
  const I18N_EXTRA = localeCatalog.extra;
  const LANG_STORAGE_KEY = localeCatalog.storageKey;
  const LANG_DATA = localeCatalog.locales;
  const SUPPORTED_LANGS = LANG_DATA.map((locale) => locale.code);
  const RTL_LANGS = new Set(
    LANG_DATA.filter((locale) => locale.dir === 'rtl').map((locale) => locale.code),
  );

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

  // [selector, key, isHtml]
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
    ['.hero-actions .btn-primary', 'btnDownload'],
    ['.hero-actions .btn-ghost', 'btnHow'],
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
    ['.phone-screen > .p-nav span:nth-child(5)', 'navProfile'],
  ];

  function applyWebLanguage(code) {
    dict = Object.assign({}, I18N.en, I18N_EXTRA.en, I18N[code] || {}, I18N_EXTRA[code] || {});
    document.documentElement.lang = code;
    document.documentElement.dir = RTL_LANGS.has(code) ? 'rtl' : 'ltr';
    document.title = dict.metaTitle;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = dict.metaDescription;
    document.getElementById('closeLogin').setAttribute('aria-label', dict.closeLabel);
    document.getElementById('langBtn').setAttribute('aria-label', dict.languageLabel);

    for (const [selector, key, isHtml] of I18N_MAP) {
      if (!dict[key]) continue;
      document.querySelectorAll(selector).forEach((el) => {
        if (isHtml) el.innerHTML = dict[key];
        else el.textContent = dict[key];
      });
    }

    for (const kind of ['privacy', 'impressum', 'terms']) {
      const link = document.getElementById(
        kind === 'impressum' ? 'footImpressum' : `foot${kind[0].toUpperCase()}${kind.slice(1)}`,
      );
      if (link) link.href = `./legal.html?doc=${kind}&lang=${code}`;
    }
    window.DUVELA_CONSENT?.updateLanguage(code);

    [
      ['.fc-1', 'phoneLevelMatched'],
      ['.fc-2', 'phoneLikesToday'],
      ['.fc-3', 'phoneProgress'],
    ].forEach(([selector, key]) => {
      const el = document.querySelector(selector);
      if (!el) return;
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
    if (heroMeta) heroMeta.innerHTML = '<span class="stars">★★★★★</span><br>' + dict.heroMeta;

    document.getElementById('loginEmail').placeholder = dict.phEmail;
    document.getElementById('loginPassword').placeholder = dict.phPassword;
    refreshLoginSubmit();
    loginNote.classList.remove('show');
  }

  let dict = Object.assign({}, I18N.en, I18N_EXTRA.en);
  signupRoleSelect.value = signupRole;



  const langBtn  = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  const langBtnFlag = document.getElementById('langBtnFlag');
  const langBtnCode = document.getElementById('langBtnCode');

  function renderLanguageMenu() {
    const fragment = document.createDocumentFragment();

    for (const language of LANG_DATA) {
      const item = document.createElement('li');
      item.className = 'lang-item';
      item.dataset.val = language.code;
      item.setAttribute('role', 'option');
      item.textContent = `${language.flag} ${language.name}`;
      fragment.appendChild(item);
    }

    langMenu.replaceChildren(fragment);
  }

  function setLang(code) {
    const entry = LANG_DATA.find(l => l.code === code) || LANG_DATA[0];
    langBtnFlag.textContent = entry.flag;
    langBtnCode.textContent = entry.code.toUpperCase();
    langMenu.querySelectorAll('.lang-item').forEach((li) => {
      const active = li.dataset.val === entry.code;
      li.classList.toggle('active', active);
      li.setAttribute('aria-selected', String(active));
    });
    localStorage.setItem(LANG_STORAGE_KEY, code);
    applyWebLanguage(code);
  }

  renderLanguageMenu();

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = langMenu.classList.toggle('open');
    langBtn.classList.toggle('open', open);
    langBtn.setAttribute('aria-expanded', open);
  });

  langMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.lang-item');
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

  const initialLang = detectWebLanguage();
  setLang(initialLang);
  document.getElementById('footCookie').addEventListener('click', (event) => {
    event.preventDefault();
    window.DUVELA_CONSENT.openSettings();
  });
  window.DUVELA_CONSENT.init(initialLang);

  // Scroll progress bar
  const scrollBar = document.getElementById('scrollBar');
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    scrollBar.style.width = pct + '%';
  }, { passive: true });

  // Password eye toggle
  const togglePass = document.getElementById('togglePass');
  const loginPassword = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeOff = `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  const eyeOn = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  togglePass.addEventListener('click', () => {
    const show = loginPassword.type === 'password';
    loginPassword.type = show ? 'text' : 'password';
    eyeIcon.innerHTML = show ? eyeOff : eyeOn;
  });

  // ── Supabase init ──────────────────────────────────
  const supa = config.createSupabaseClient();

  const openLoginBtn = document.getElementById('openLogin');
  const openLoginMobBtn = document.getElementById('openLoginMob');

  function setNavUser(user) {
    signedInUser = user;
    const initial = (user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase();
    const name = user.user_metadata?.full_name || user.email.split('@')[0];
    openLoginBtn.innerHTML =
      `<span style="display:flex;align-items:center;gap:7px">` +
      `<span style="width:26px;height:26px;border-radius:99px;background:var(--grad);` +
      `display:grid;place-items:center;color:#fff;font-size:11px;font-weight:900;flex-shrink:0">${initial}</span>` +
      `${name}</span>`;
    openLoginBtn.title = 'Open Duvela Web';
    openLoginMobBtn.innerHTML =
      `<span style="width:22px;height:22px;border-radius:99px;background:var(--grad);` +
      `display:grid;place-items:center;color:#fff;font-size:10px;font-weight:900">${initial}</span>`;
  }

  function setNavGuest() {
    signedInUser = null;
    openLoginBtn.innerHTML = dict.signIn || 'Sign In';
    openLoginBtn.title = '';
    openLoginMobBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
  }

  supa.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      setNavUser(session.user);
      if (event === 'SIGNED_IN') {
        closeLogin();
        if (sessionStorage.getItem(AUTH_FLOW_KEY) === '1') {
          await finishOAuthFlow(session.user);
        }
      }
    }
    else setNavGuest();
  });

  supa.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setNavUser(session.user);
      goToDetectedWebApp(session.user);
    }
  });

  // Google OAuth
  document.getElementById('googleSignIn').addEventListener('click', async () => {
    loginNote.classList.remove('show');
    sessionStorage.setItem(AUTH_FLOW_KEY, '1');
    sessionStorage.setItem(AUTH_MODE_KEY, authMode);
    sessionStorage.setItem(SIGNUP_ROLE_KEY, signupRole);
    const { error } = await supa.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authCallbackUrl() }
    });
    if (error) {
      sessionStorage.removeItem(AUTH_FLOW_KEY);
      sessionStorage.removeItem(AUTH_MODE_KEY);
      sessionStorage.removeItem(SIGNUP_ROLE_KEY);
      loginNote.textContent = error.message || 'Google sign-in is not available right now.';
      loginNote.classList.add('show');
    }
  });

  // Forgot password
  document.getElementById('forgotPass').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    if (!email) {
      loginNote.textContent = 'Enter your email above first.';
      loginNote.classList.add('show');
      return;
    }
    const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    loginNote.textContent = error ? error.message : `Reset link sent to ${email} ✓`;
    loginNote.classList.add('show');
  });

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
