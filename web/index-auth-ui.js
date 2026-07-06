(function () {
  function createIndexAuthUi(ctx) {
    const {
      rolesApi,
      getDict,
      storageKey,
      loginRole,
      roleKeys
    } = ctx;

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

    const activeStyle = 'flex:1;padding:10px;border-radius:12px;border:1px solid var(--purple);background:var(--purple);color:#fff;font-weight:900;cursor:pointer;font-size:14px';
    const idleStyle = 'flex:1;padding:10px;border-radius:12px;border:1px solid #E4D9FF;background:#fff;color:var(--purple);font-weight:900;cursor:pointer;font-size:14px';

    let currentRole = loginRole;
    let signupRole = normalizeSignupRole(localStorage.getItem(storageKey) || loginRole);
    let authMode = 'signin';

    function dict() {
      return getDict ? (getDict() || {}) : {};
    }

    function getCopy(key, fallback, tokens) {
      let value = dict()[key] || fallback || '';
      if (!tokens) return value;

      for (const [token, replacement] of Object.entries(tokens)) {
        value = value.replace(new RegExp('\\{' + token + '\\}', 'g'), replacement);
      }

      return value;
    }

    function normalizeSignupRole(role) {
      return rolesApi.normalizeSignupRole(role);
    }

    function syncCurrentRole() {
      currentRole = authMode === 'signup' ? signupRole : loginRole;
    }

    function clearNote() {
      loginNote.classList.remove('show');
      loginNote.style.color = '';
    }

    function showNote(message, tone) {
      loginNote.style.color = tone === 'accent' ? 'var(--purple)' : '';
      loginNote.textContent = message;
      loginNote.classList.add('show');
    }

    function refreshLoginSubmit() {
      if (authMode === 'signup') {
        const roleName = getCopy(roleKeys[signupRole], signupRole);
        loginSubmit.textContent = getCopy('signUpAs', 'Create account as {role}', { role: roleName });
      } else {
        loginSubmit.textContent = getCopy('tabSignin', 'Sign in');
      }
    }

    function setSubmitBusy(label) {
      loginSubmit.disabled = true;
      loginSubmit.textContent = label;
    }

    function setSubmitIdle() {
      loginSubmit.disabled = false;
      refreshLoginSubmit();
    }

    function setSignupRole(role) {
      signupRole = normalizeSignupRole(role);
      localStorage.setItem(storageKey, signupRole);
      signupRoleSelect.value = signupRole;
      syncCurrentRole();
      refreshLoginSubmit();
    }

    function setAuthMode(mode) {
      authMode = mode === 'signup' ? 'signup' : 'signin';

      tabSignin.setAttribute('style', authMode === 'signin' ? activeStyle : idleStyle);
      tabSignup.setAttribute('style', authMode === 'signup' ? activeStyle : idleStyle);
      confirmWrap.style.display = authMode === 'signup' ? 'block' : 'none';
      signupRoleWrap.style.display = authMode === 'signup' ? 'block' : 'none';
      loginConfirmInput.required = authMode === 'signup';
      forgotPassLink.style.display = authMode === 'signup' ? 'none' : 'block';
      loginFootWrap.style.display = authMode === 'signup' ? 'none' : 'block';
      loginPasswordInput.setAttribute('autocomplete', authMode === 'signup' ? 'new-password' : 'current-password');

      syncCurrentRole();
      clearNote();
      refreshLoginSubmit();
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
      clearNote();
    }

    function syncCopy() {
      signupRoleSelect.value = signupRole;
      refreshLoginSubmit();
      clearNote();
    }

    return {
      elements: {
        overlay,
        tabSignin,
        tabSignup,
        forgotPassLink,
        signupRoleSelect,
        openLoginBtn,
        openLoginMobBtn,
        loginEmailInput,
        loginPasswordInput,
        loginConfirmInput
      },
      getAuthMode: () => authMode,
      getCurrentRole: () => currentRole,
      getCopy,
      setCurrentRole(role) { currentRole = role || loginRole; },
      getSignupRole: () => signupRole,
      setSignupRole,
      setAuthMode,
      refreshLoginSubmit,
      setSubmitBusy,
      setSubmitIdle,
      clearNote,
      showNote,
      openLogin,
      closeLogin,
      syncCopy
    };
  }

  window.DuvelaIndexAuthUi = { create: createIndexAuthUi };
})();
