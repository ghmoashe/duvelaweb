(function () {
  function createIndexAuth(ctx) {
    const { config, rolesApi, profileWritesApi, authUiApi, getDict } = ctx;
    if (!authUiApi) throw new Error('DuvelaIndexAuthUi is required.');

    const supa = config.createSupabaseClient();

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

    const authUi = authUiApi.create({
      rolesApi,
      getDict,
      storageKey: SIGNUP_ROLE_KEY,
      loginRole: LOGIN_ROLE,
      roleKeys
    });

    const {
      overlay,
      tabSignin,
      tabSignup,
      signupRoleSelect,
      openLoginBtn,
      openLoginMobBtn,
      loginEmailInput,
      loginPasswordInput,
      loginConfirmInput
    } = authUi.elements;

    const closeLoginBtn = document.getElementById('closeLogin');
    const loginForm = document.getElementById('loginForm');
    const loginGetApp = document.getElementById('loginGetApp');
    const googleSignInBtn = document.getElementById('googleSignIn');
    const forgotPassBtn = document.getElementById('forgotPass');

    let signedInUser = null;

    function authCallbackUrl() {
      const url = new URL('./index.html', window.location.href);
      url.searchParams.set('auth', '1');
      return url.href;
    }

    function appUrl(role, hash) {
      const selectedRole = role || authUi.getCurrentRole() || LOGIN_ROLE;
      const url = new URL('./app.html', window.location.href);
      url.searchParams.set('role', selectedRole);
      url.hash = hash && hash.startsWith('#') ? hash : '#home';
      return url.href;
    }

    function defaultHashForRole(role) {
      return rolesApi.isBusinessRole(role) ? '#workspace' : '#home';
    }

    function goToWebApp(role, hash) {
      const targetRole = role || authUi.getCurrentRole() || LOGIN_ROLE;
      localStorage.setItem(WEB_ROLE_KEY, targetRole);
      window.location.href = appUrl(targetRole, hash || defaultHashForRole(targetRole));
    }

    async function detectWebRole(userId) {
      return rolesApi.detectWebRole(supa, userId);
    }

    async function goToDetectedWebApp(userOrId, hash) {
      const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
      const detectedRole = userId ? await detectWebRole(userId) : LOGIN_ROLE;
      authUi.setCurrentRole(detectedRole);
      goToWebApp(detectedRole, hash || defaultHashForRole(detectedRole));
    }

    async function finishOAuthFlow(sessionUser) {
      const flowMode = sessionStorage.getItem(AUTH_MODE_KEY) || 'signin';
      const savedSignupRole = rolesApi.normalizeSignupRole(
        sessionStorage.getItem(SIGNUP_ROLE_KEY)
          || localStorage.getItem(SIGNUP_ROLE_KEY)
          || authUi.getSignupRole()
      );

      sessionStorage.removeItem(AUTH_FLOW_KEY);
      sessionStorage.removeItem(AUTH_MODE_KEY);
      sessionStorage.removeItem(SIGNUP_ROLE_KEY);

      if (flowMode === 'signup') {
        authUi.setSignupRole(savedSignupRole);
        authUi.setCurrentRole(savedSignupRole);
        await upsertWebProfile(
          sessionUser.id,
          sessionUser.email,
          document.documentElement.getAttribute('lang') || 'en'
        );
        goToWebApp(savedSignupRole, defaultHashForRole(savedSignupRole));
        return;
      }

      authUi.setCurrentRole(LOGIN_ROLE);
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

    function handleLoginAccess(event) {
      event.preventDefault();
      if (signedInUser) goToDetectedWebApp(signedInUser);
      else authUi.openLogin();
    }

    async function upsertWebProfile(userId, email, locale) {
      const currentRole = authUi.getCurrentRole();

      try {
        await profileWritesApi.upsertProfileIdentity(supa, { userId, email, locale });
      } catch (error) {
        console.warn('profile upsert skipped', error);
      }

      if (!rolesApi.isBusinessRole(currentRole)) return;

      try {
        await profileWritesApi.persistBusinessRoleSelection(supa, rolesApi, {
          userId,
          targetRole: currentRole,
        });
      } catch (error) {
        console.warn('role request update skipped', error);
      }
    }

    async function handleLoginSubmit(event) {
      event.preventDefault();
      const email = loginEmailInput.value.trim();
      const password = loginPasswordInput.value;
      const locale = document.documentElement.getAttribute('lang') || 'en';
      const authMode = authUi.getAuthMode();
      const currentRole = authUi.getCurrentRole();

      authUi.clearNote();
      localStorage.setItem(WEB_ROLE_KEY, currentRole);

      if (authMode === 'signup') {
        const confirm = loginConfirmInput.value;
        if (password.length < 6) {
          authUi.showNote(authUi.getCopy('pwTooShort', 'Password must be at least 6 characters.'));
          return;
        }
        if (password !== confirm) {
          authUi.showNote(authUi.getCopy('pwMismatch', 'Passwords do not match.'));
          return;
        }

        authUi.setSubmitBusy(authUi.getCopy('creatingAccount', 'Creating account...'));
        const { data, error } = await supa.auth.signUp({
          email,
          password,
          options: { data: { locale, web_role: currentRole }, emailRedirectTo: authCallbackUrl() }
        });
        authUi.setSubmitIdle();

        if (error) {
          authUi.showNote(error.message || authUi.getCopy('signupFailed', 'Could not create the account.'));
          return;
        }
        if (data.user) await upsertWebProfile(data.user.id, email, locale);
        if (!data.session) {
          authUi.showNote(
            authUi.getCopy('checkEmailVerify', 'Account created. Check your email to confirm, then sign in.'),
            'accent'
          );
          authUi.setAuthMode('signin');
          return;
        }
        goToWebApp(currentRole, defaultHashForRole(currentRole));
        return;
      }

      authUi.setSubmitBusy(authUi.getCopy('signingIn', 'Signing in...'));
      const { data, error } = await supa.auth.signInWithPassword({ email, password });
      authUi.setSubmitIdle();

      if (error) {
        authUi.showNote(
          error.message || authUi.getCopy('signinFailed', 'Could not sign in. Check your email and password.')
        );
        return;
      }

      if (data.user) await upsertWebProfile(data.user.id, email, locale);
      await goToDetectedWebApp(data.user);
    }

    function setNavUser(user) {
      signedInUser = user;
      const nameSource = user.user_metadata?.full_name || user.email || 'U';
      const initial = nameSource.charAt(0).toUpperCase();
      const name = user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'User');

      openLoginBtn.innerHTML =
        '<span style="display:flex;align-items:center;gap:7px">' +
        '<span style="width:26px;height:26px;border-radius:99px;background:var(--grad);display:grid;place-items:center;color:#fff;font-size:11px;font-weight:900;flex-shrink:0">' + initial + '</span>' +
        name + '</span>';
      openLoginBtn.title = 'Open Duvela Web';
      openLoginMobBtn.innerHTML =
        '<span style="width:22px;height:22px;border-radius:99px;background:var(--grad);display:grid;place-items:center;color:#fff;font-size:10px;font-weight:900">' + initial + '</span>';
    }

    function setNavGuest() {
      signedInUser = null;
      openLoginBtn.innerHTML = authUi.getCopy('signIn', 'Sign In');
      openLoginBtn.title = '';
      openLoginMobBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
    }

    function bindEvents() {
      tabSignin.addEventListener('click', () => authUi.setAuthMode('signin'));
      tabSignup.addEventListener('click', () => authUi.setAuthMode('signup'));
      signupRoleSelect.addEventListener('change', (event) => authUi.setSignupRole(event.target.value));

      openLoginBtn.addEventListener('click', handleLoginAccess);
      openLoginMobBtn.addEventListener('click', handleLoginAccess);
      closeLoginBtn.addEventListener('click', () => authUi.closeLogin());
      loginGetApp.addEventListener('click', (event) => {
        event.preventDefault();
        authUi.setAuthMode('signup');
      });
      document.querySelectorAll('[data-auth-open]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
          event.preventDefault();
          if (signedInUser) {
            goToDetectedWebApp(signedInUser);
            return;
          }

          const mode = trigger.dataset.authOpen === 'signup' ? 'signup' : 'signin';
          const signupRole = trigger.dataset.signupRole;

          authUi.setAuthMode(mode);
          if (mode === 'signup' && signupRole) authUi.setSignupRole(signupRole);
          authUi.openLogin();
        });
      });

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) authUi.closeLogin();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') authUi.closeLogin();
      });

      loginForm.addEventListener('submit', handleLoginSubmit);

      googleSignInBtn.addEventListener('click', async () => {
        authUi.clearNote();
        sessionStorage.setItem(AUTH_FLOW_KEY, '1');
        sessionStorage.setItem(AUTH_MODE_KEY, authUi.getAuthMode());
        sessionStorage.setItem(SIGNUP_ROLE_KEY, authUi.getSignupRole());

        const { error } = await supa.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: authCallbackUrl() }
        });

        if (error) {
          sessionStorage.removeItem(AUTH_FLOW_KEY);
          sessionStorage.removeItem(AUTH_MODE_KEY);
          sessionStorage.removeItem(SIGNUP_ROLE_KEY);
          authUi.showNote(
            error.message || authUi.getCopy('googleSignInUnavailable', 'Google sign-in is not available right now.')
          );
        }
      });

      forgotPassBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        const email = loginEmailInput.value.trim();
        if (!email) {
          authUi.showNote(authUi.getCopy('enterEmailFirst', 'Enter your email above first.'));
          return;
        }
        const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        authUi.showNote(
          error
            ? error.message
            : authUi.getCopy('resetLinkSent', 'Reset link sent to {email}.', { email })
        );
      });
    }

    function bindSupabase() {
      supa.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setNavUser(session.user);
          if (event === 'SIGNED_IN') {
            authUi.closeLogin();
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
      authUi.syncCopy();
      if (!signedInUser) setNavGuest();
    }

    function init() {
      configureWebAppLinks();
      bindEvents();
      bindSupabase();
      syncCopy();
      authUi.setAuthMode(authUi.getAuthMode());
      if (new URLSearchParams(window.location.search).get('login') === '1') authUi.openLogin();
    }

    return {
      init,
      syncCopy
    };
  }

  window.DuvelaIndexAuth = { create: createIndexAuth };
})();
