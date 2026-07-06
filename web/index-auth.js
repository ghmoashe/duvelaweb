(function () {
  function createIndexAuth(ctx) {
    const { config, rolesApi, getDict } = ctx;
    const supa = config.createSupabaseClient();

    const overlay = document.getElementById('loginOverlay');
    const loginSubmit = document.getElementById('loginSubmit');
    const loginNote = document.getElementById('loginNote');
    const tabSignin = document.getElementById('tabSignin');
    const tabSignup = document.getElementById('tabSignup');
    const confirmWrap = document.getElementById('confirmWrap');
    const forgotPassLink = document.getElementById('forgotPass');
    const loginFootWrap = document.getElementById('loginFootWrap');
    const signupRoleWrap = document.getElementById('signupRoleWrap');
    const signupRoleSelect = document.getElementById('signupRoleSelect');
    const openLoginBtn = document.getElementById('openLogin');
    const openLoginMobBtn = document.getElementById('openLoginMob');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const loginConfirmInput = document.getElementById('loginConfirm');

    const WEB_ROLE_KEY = config.storageKeys.role;
    const AUTH_FLOW_KEY = config.storageKeys.authFlow;
    const AUTH_MODE_KEY = config.storageKeys.authMode;
    const SIGNUP_ROLE_KEY = config.storageKeys.signupRole;
    const LOGIN_ROLE = 'learner';
    const roleKeys = {
      learner: 'roleLearner',
      teacher: 'roleTeacher',
      organizer: 'roleOrganizer',
      organization: 'roleOrganization'
    };

    let currentRole = LOGIN_ROLE;
    let signupRole = normalizeSignupRole(localStorage.getItem(SIGNUP_ROLE_KEY) || 'learner');
    let signedInUser = null;
    let authMode = 'signin';

    function dict() {
      return getDict ? (getDict() || {}) : {};
    }

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
      const copy = dict();
      if (authMode === 'signup') {
        const roleName = copy[roleKeys[signupRole]] || signupRole;
        loginSubmit.textContent = (copy.signUpAs || 'Create account as {role}').replace('{role}', roleName);
      } else {
        loginSubmit.textContent = copy.tabSignin || 'Sign in';
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
      loginConfirmInput.required = authMode === 'signup';
      forgotPassLink.style.display = authMode === 'signup' ? 'none' : 'block';
      loginFootWrap.style.display = authMode === 'signup' ? 'none' : 'block';
      loginPasswordInput.setAttribute('autocomplete', authMode === 'signup' ? 'new-password' : 'current-password');

      syncCurrentRole();
      loginNote.classList.remove('show');
      refreshLoginSubmit();
    }

    function authCallbackUrl() {
      const url = new URL('./index.html', window.location.href);
      url.searchParams.set('auth', '1');
      return url.href;
    }

    function appUrl(role, hash) {
      const selectedRole = role || currentRole || LOGIN_ROLE;
      const url = new URL('./app.html', window.location.href);
      url.searchParams.set('role', selectedRole);
      url.hash = hash && hash.startsWith('#') ? hash : '#home';
      return url.href;
    }

    function defaultHashForRole(role) {
      return rolesApi.isBusinessRole(role) ? '#workspace' : '#home';
    }

    function goToWebApp(role, hash) {
      localStorage.setItem(WEB_ROLE_KEY, role || currentRole || LOGIN_ROLE);
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
      const savedSignupRole = normalizeSignupRole(
        sessionStorage.getItem(SIGNUP_ROLE_KEY) || localStorage.getItem(SIGNUP_ROLE_KEY) || signupRole
      );

      sessionStorage.removeItem(AUTH_FLOW_KEY);
      sessionStorage.removeItem(AUTH_MODE_KEY);
      sessionStorage.removeItem(SIGNUP_ROLE_KEY);

      if (flowMode === 'signup') {
        signupRole = savedSignupRole;
        currentRole = signupRole;
        await upsertWebProfile(
          sessionUser.id,
          sessionUser.email,
          document.documentElement.getAttribute('lang') || 'en'
        );
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

    function handleLoginAccess(event) {
      event.preventDefault();
      if (signedInUser) goToDetectedWebApp(signedInUser);
      else openLogin();
    }

    async function upsertWebProfile(userId, email, locale) {
      const now = new Date().toISOString();
      const patch = { id: userId, email: email || null, locale, updated_at: now };

      try {
        await supa.from('profiles').upsert(patch, { onConflict: 'id' });
      } catch (error) {
        console.warn('profile upsert skipped', error);
      }

      if (!rolesApi.isBusinessRole(currentRole)) return;

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
      } catch (error) {
        console.warn('role request update skipped', error);
      }
    }

    async function handleLoginSubmit(event) {
      event.preventDefault();
      const copy = dict();
      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;
      const locale = document.documentElement.getAttribute('lang') || 'en';

      loginNote.classList.remove('show');
      loginNote.style.color = '';
      localStorage.setItem(WEB_ROLE_KEY, currentRole);

      if (authMode === 'signup') {
        const confirm = loginConfirmInput.value;
        if (password.length < 6) {
          loginNote.textContent = copy.pwTooShort || 'Password must be at least 6 characters.';
          loginNote.classList.add('show');
          return;
        }
        if (password !== confirm) {
          loginNote.textContent = copy.pwMismatch || 'Passwords do not match.';
          loginNote.classList.add('show');
          return;
        }

        loginSubmit.disabled = true;
        loginSubmit.textContent = copy.creatingAccount || 'Creating account...';
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
          loginNote.textContent = copy.checkEmailVerify || 'Account created. Check your email to confirm, then sign in.';
          loginNote.classList.add('show');
          setAuthMode('signin');
          return;
        }
        goToWebApp(currentRole, defaultHashForRole(currentRole));
        return;
      }

      loginSubmit.disabled = true;
      loginSubmit.textContent = copy.signingIn || 'Signing in...';
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
    }

    function setNavUser(user) {
      signedInUser = user;
      const initial = (user.user_metadata?.full_name || user.email || 'U').charAt(0).toUpperCase();
      const name = user.user_metadata?.full_name || user.email.split('@')[0];

      openLoginBtn.innerHTML =
        '<span style="display:flex;align-items:center;gap:7px">' +
        '<span style="width:26px;height:26px;border-radius:99px;background:var(--grad);display:grid;place-items:center;color:#fff;font-size:11px;font-weight:900;flex-shrink:0">' + initial + '</span>' +
        name + '</span>';
      openLoginBtn.title = 'Open Duvela Web';
      openLoginMobBtn.innerHTML =
        '<span style="width:22px;height:22px;border-radius:99px;background:var(--grad);display:grid;place-items:center;color:#fff;font-size:10px;font-weight:900">' + initial + '</span>';
    }

    function setNavGuest() {
      const copy = dict();
      signedInUser = null;
      openLoginBtn.innerHTML = copy.signIn || 'Sign In';
      openLoginBtn.title = '';
      openLoginMobBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
    }

    function bindEvents() {
      tabSignin.addEventListener('click', () => setAuthMode('signin'));
      tabSignup.addEventListener('click', () => setAuthMode('signup'));
      signupRoleSelect.addEventListener('change', (event) => setSignupRole(event.target.value));

      document.getElementById('openLogin').addEventListener('click', handleLoginAccess);
      document.getElementById('openLoginMob').addEventListener('click', handleLoginAccess);
      document.getElementById('closeLogin').addEventListener('click', closeLogin);
      document.getElementById('loginGetApp').addEventListener('click', (event) => {
        event.preventDefault();
        setAuthMode('signup');
      });

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeLogin();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeLogin();
      });

      document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);

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

      document.getElementById('forgotPass').addEventListener('click', async (event) => {
        event.preventDefault();
        const email = loginEmailInput.value.trim();
        if (!email) {
          loginNote.textContent = 'Enter your email above first.';
          loginNote.classList.add('show');
          return;
        }
        const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        loginNote.textContent = error ? error.message : 'Reset link sent to ' + email + ' ✓';
        loginNote.classList.add('show');
      });
    }

    function bindSupabase() {
      supa.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setNavUser(session.user);
          if (event === 'SIGNED_IN') {
            closeLogin();
            if (sessionStorage.getItem(AUTH_FLOW_KEY) === '1') {
              await finishOAuthFlow(session.user);
            }
          }
        } else {
          setNavGuest();
        }
      });

      supa.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setNavUser(session.user);
          goToDetectedWebApp(session.user);
        }
      });
    }

    function syncCopy() {
      signupRoleSelect.value = signupRole;
      refreshLoginSubmit();
      loginNote.classList.remove('show');
      if (!signedInUser) setNavGuest();
    }

    function init() {
      configureWebAppLinks();
      bindEvents();
      bindSupabase();
      syncCurrentRole();
      syncCopy();
      setAuthMode(authMode);
      if (new URLSearchParams(window.location.search).get('login') === '1') openLogin();
    }

    return {
      init,
      syncCopy
    };
  }

  window.DuvelaIndexAuth = { create: createIndexAuth };
})();
