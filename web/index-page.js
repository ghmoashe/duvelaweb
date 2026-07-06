(function () {
  const indexI18nApi = window.DuvelaIndexI18n;
  const indexAuthApi = window.DuvelaIndexAuth;
  const indexAuthUiApi = window.DuvelaIndexAuthUi;

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  document.querySelectorAll('.feat-grid .feat, .steps .step').forEach((el, index) => {
    el.style.transitionDelay = ((index % 3) * 90) + 'ms';
  });

  const pPages = Array.from(document.querySelectorAll('.p-page'));
  const pNavItems = Array.from(document.querySelectorAll('.p-nav span'));
  const pNav = document.querySelector('.p-nav');
  const phoneEl = document.querySelector('.phone');
  const navFor = [0, 1, 1, 2, 3, 4];
  let pIdx = 1;
  let pTimer = null;

  function showPage(index) {
    pIdx = index;
    pPages.forEach((page, pageIndex) => page.classList.toggle('active', pageIndex === index));
    pNavItems.forEach((item, itemIndex) => item.classList.toggle('on', itemIndex === navFor[index]));
    pNav.classList.toggle('lightnav', pPages[index].classList.contains('light'));
  }

  function startRotate() {
    clearInterval(pTimer);
    pTimer = setInterval(() => showPage((pIdx + 1) % pPages.length), 4000);
  }

  pNavItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      const target = navFor.indexOf(index);
      if (target >= 0) {
        showPage(target);
        startRotate();
      }
    });
  });

  phoneEl.addEventListener('mouseenter', () => clearInterval(pTimer));
  phoneEl.addEventListener('mouseleave', startRotate);

  showPage(1);
  startRotate();

  let authFeature = null;
  const i18nFeature = indexI18nApi.create({
    onDictChange() {
      if (authFeature) authFeature.syncCopy();
    }
  });

  authFeature = indexAuthApi.create({
    config: window.DuvelaWebConfig,
    rolesApi: window.DuvelaWebRoles,
    profileWritesApi: window.DuvelaWebProfileWrites,
    authUiApi: indexAuthUiApi,
    getDict: () => i18nFeature.getDict()
  });

  authFeature.init();
  i18nFeature.init();

  const scrollBar = document.getElementById('scrollBar');
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    scrollBar.style.width = pct + '%';
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
      document.querySelectorAll('.faq-item').forEach((faq) => faq.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
})();
