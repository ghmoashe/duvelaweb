(function () {
  const indexI18nApi = window.DuvelaIndexI18n;
  const loadedScripts = new Map();

  function loadScript(src) {
    if (loadedScripts.has(src)) return loadedScripts.get(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Unable to load ${src}`));
      document.head.appendChild(script);
    });
    loadedScripts.set(src, promise);
    return promise;
  }

  let corePromise = null;
  function ensureCore() {
    if (!corePromise) {
      corePromise = [
        './web/vendor/supabase-js-v2.js',
        './web/duvela-runtime-config.js',
        './web/duvela-web-config.js',
        './web/duvela-web-roles.js?v=20260925-rbac1',
        './web/duvela-web-ui.js',
        './web/duvela-web-profile-writes.js?v=20260926-1'
      ].reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve());
    }
    return corePromise;
  }

  const revealItems = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    revealItems.forEach((el) => io.observe(el));
  } else {
    revealItems.forEach((el) => el.classList.add('in'));
  }

  document.querySelectorAll('.feat-grid .feat, .steps .step').forEach((el, index) => {
    el.style.transitionDelay = ((index % 3) * 90) + 'ms';
  });

  const pPages = Array.from(document.querySelectorAll('.p-page'));
  const pNavItems = Array.from(document.querySelectorAll('.p-nav span'));
  const pNav = document.querySelector('.p-nav');
  const phoneEl = document.querySelector('.phone');
  const navFor = [0, 1, 1, 2, 3, 4];
  let pIdx = 0;
  let pTimer = null;

  function showPage(index) {
    if (!pPages[index] || !pNav) return;
    pIdx = index;
    pPages.forEach((page, pageIndex) => page.classList.toggle('active', pageIndex === index));
    pNavItems.forEach((item, itemIndex) => {
      const active = itemIndex === navFor[index];
      item.classList.toggle('on', active);
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
    pNav.classList.toggle('lightnav', pPages[index].classList.contains('light'));
  }

  function startRotate() {
    clearInterval(pTimer);
    // Keep the first preview stable. Automatic rotation continually introduces
    // new LCP candidates and can distract keyboard and screen-reader users.
    // The preview navigation remains fully interactive.
  }

  pNavItems.forEach((item, index) => {
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    const activate = () => {
      const target = navFor.indexOf(index);
      if (target >= 0) {
        showPage(target);
        startRotate();
      }
    };
    item.addEventListener('click', activate);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        activate();
      }
    });
  });

  if (phoneEl) {
    phoneEl.addEventListener('mouseenter', () => clearInterval(pTimer));
    phoneEl.addEventListener('mouseleave', startRotate);
    phoneEl.addEventListener('focusin', () => clearInterval(pTimer));
    phoneEl.addEventListener('focusout', startRotate);
  }

  showPage(0);
  startRotate();

  let authFeature = null;
  const i18nFeature = indexI18nApi.create({
    onDictChange() {
      if (authFeature) authFeature.syncCopy();
    }
  });

  i18nFeature.init();

  let authPromise = null;
  function ensureAuth() {
    if (!authPromise) {
      authPromise = ensureCore()
        .then(() => loadScript('./web/index-auth-ui.js?v=20260925-authui1'))
        .then(() => loadScript('./web/index-auth.js?v=20260925-auth3'))
        .then(() => {
          authFeature = window.DuvelaIndexAuth.create({
            config: window.DuvelaWebConfig,
            rolesApi: window.DuvelaWebRoles,
            profileWritesApi: window.DuvelaWebProfileWrites,
            authUiApi: window.DuvelaIndexAuthUi,
            getDict: () => i18nFeature.getDict()
          });
          authFeature.init();
          return authFeature;
        });
    }
    return authPromise;
  }

  let replayingAuthClick = false;
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('#openLogin, #openLoginMob, [data-auth-open]');
    if (!trigger || authFeature || replayingAuthClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ensureAuth().then(() => {
      replayingAuthClick = true;
      trigger.click();
      replayingAuthClick = false;
    }).catch((error) => console.error('[duvela-auth]', error));
  }, true);

  const query = new URLSearchParams(window.location.search);
  if (query.get('login') === '1' || query.get('auth') === '1') ensureAuth().catch(() => {});

  let publicDataPromise = null;
  function ensurePublicData() {
    if (!publicDataPromise) {
      publicDataPromise = ensureCore().then(() => loadScript('./web/index-public-data.js?v=20260925-public4'));
    }
    return publicDataPromise;
  }

  const publicDataTarget = document.getElementById('teachers');
  if (publicDataTarget && 'IntersectionObserver' in window) {
    const publicDataObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      publicDataObserver.disconnect();
      ensurePublicData().catch(() => {});
    }, { rootMargin: '500px 0px' });
    publicDataObserver.observe(publicDataTarget);
  } else if (publicDataTarget) {
    ensurePublicData().catch(() => {});
  }

  let assistantRequested = false;
  function ensureAssistant() {
    if (assistantRequested) return;
    assistantRequested = true;
    loadScript('./web/duvi-assistant.js?v=20261016duvifix1').catch(() => {});
  }
  window.addEventListener('pointerdown', ensureAssistant, { once: true, passive: true });
  window.addEventListener('keydown', ensureAssistant, { once: true });

  const scrollBar = document.getElementById('scrollBar');
  window.addEventListener('scroll', () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? Math.min(100, window.scrollY / scrollable * 100) : 0;
    if (scrollBar) scrollBar.style.width = pct + '%';
  }, { passive: true });

  const togglePass = document.getElementById('togglePass');
  const loginPassword = document.getElementById('loginPassword');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeOff = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  const eyeOn = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';

  togglePass.addEventListener('click', () => {
    const show = loginPassword.type === 'password';
    loginPassword.type = show ? 'text' : 'password';
    eyeIcon.innerHTML = show ? eyeOff : eyeOn;
  });

  document.querySelectorAll('.faq-q').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach((faq) => {
        faq.classList.remove('open');
        faq.querySelector('.faq-q')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        button.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.querySelectorAll('[data-store-soon]').forEach((button) => {
    button.addEventListener('click', () => {
      const note = document.getElementById('mobileStoreNote');
      if (!note) return;
      note.classList.remove('store-note-pulse');
      window.requestAnimationFrame(() => note.classList.add('store-note-pulse'));
      note.focus?.();
    });
  });
})();
