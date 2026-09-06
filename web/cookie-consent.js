// Duvela cookie-consent banner + settings modal.
//
// Shows once on first visit (no localStorage record), lets the visitor
// accept all, reject non-essential, or open a settings dialog with
// category toggles. Persists the decision to
// `duvela.cookieConsent.v1` and exposes window.DuvelaCookieConsent
// so other scripts can gate optional integrations (analytics, embeds)
// behind the visitor's choice.
//
// Category taxonomy (GDPR-friendly):
//   essential  — always on; required for auth / cart / language pick
//   functional — remembered preferences, saved drafts, language
//   analytics  — usage metrics (Supabase logs, error reporting)
//   marketing  — social embeds, ad pixels, remarketing
//
// The banner ships translated into en / ru / de / es / fr / ar and
// falls back to English for anything else. Any anchor with
// id="footCookie" reopens the settings modal.

(function () {
  var STORAGE_KEY = 'duvela.cookieConsent.v1';
  var VERSION = 1;

  var COPY = {
    en: {
      title: 'We value your privacy',
      body: 'Duvela uses cookies to keep you signed in, remember your language and level, and understand how the app is used. You can accept everything, reject non-essential cookies, or customise what you allow.',
      acceptAll: 'Accept all',
      rejectAll: 'Only essential',
      settings: 'Settings',
      save: 'Save preferences',
      cancel: 'Cancel',
      modalTitle: 'Cookie preferences',
      modalIntro: 'Turn categories on or off. Essential cookies keep the site working and cannot be disabled.',
      essential: 'Essential',
      essentialDesc: 'Sign-in session, language and role — required to use the site.',
      functional: 'Functional',
      functionalDesc: 'Remembers your last course, saved drafts, level and interface preferences.',
      analytics: 'Analytics',
      analyticsDesc: 'Anonymous usage statistics that help us fix bugs and improve the app.',
      marketing: 'Marketing',
      marketingDesc: 'Social embeds and personalised campaign links.',
      required: 'Required',
      readMore: 'Read our privacy policy',
      privacyHref: './legal.html?doc=privacy',
    },
    ru: {
      title: 'Ваша конфиденциальность важна',
      body: 'Duvela использует cookie, чтобы держать вас в системе, помнить язык и уровень и понимать, как используется приложение. Вы можете принять все, отклонить второстепенные или настроить.',
      acceptAll: 'Принять все',
      rejectAll: 'Только необходимые',
      settings: 'Настройки',
      save: 'Сохранить',
      cancel: 'Отмена',
      modalTitle: 'Настройки cookie',
      modalIntro: 'Включите или выключите категории. Необходимые cookie обязательны для работы сайта и не отключаются.',
      essential: 'Необходимые',
      essentialDesc: 'Сессия входа, язык, роль — без них сайт не работает.',
      functional: 'Функциональные',
      functionalDesc: 'Запоминают выбранный курс, черновики, уровень и настройки интерфейса.',
      analytics: 'Аналитика',
      analyticsDesc: 'Анонимная статистика — помогает нам чинить баги и улучшать сервис.',
      marketing: 'Маркетинг',
      marketingDesc: 'Соцсети и персонализированные ссылки в рассылках.',
      required: 'Обязательно',
      readMore: 'Политика конфиденциальности',
      privacyHref: './legal.html?doc=privacy',
    },
    de: {
      title: 'Deine Privatsphäre ist uns wichtig',
      body: 'Duvela verwendet Cookies, um dich angemeldet zu halten, deine Sprache und dein Niveau zu merken und die Nutzung zu verstehen. Du kannst alles akzeptieren, nur essenzielle zulassen oder anpassen.',
      acceptAll: 'Alle akzeptieren',
      rejectAll: 'Nur essenzielle',
      settings: 'Einstellungen',
      save: 'Speichern',
      cancel: 'Abbrechen',
      modalTitle: 'Cookie-Einstellungen',
      modalIntro: 'Aktiviere oder deaktiviere Kategorien. Essenzielle Cookies sind für den Betrieb notwendig und lassen sich nicht abschalten.',
      essential: 'Essenziell',
      essentialDesc: 'Anmeldung, Sprache, Rolle — ohne diese funktioniert die Seite nicht.',
      functional: 'Funktional',
      functionalDesc: 'Merkt sich Kurs, Entwürfe, Niveau und Oberflächen-Einstellungen.',
      analytics: 'Analyse',
      analyticsDesc: 'Anonyme Statistiken — helfen uns, Bugs zu finden und zu verbessern.',
      marketing: 'Marketing',
      marketingDesc: 'Social-Media-Einbettungen und personalisierte Kampagnen-Links.',
      required: 'Erforderlich',
      readMore: 'Datenschutzerklärung lesen',
      privacyHref: './legal.html?doc=privacy',
    },
    es: {
      title: 'Tu privacidad importa',
      body: 'Duvela usa cookies para mantener tu sesión, recordar tu idioma y nivel, y entender cómo se usa la app. Puedes aceptar todo, rechazar las no esenciales o personalizar.',
      acceptAll: 'Aceptar todo',
      rejectAll: 'Solo esenciales',
      settings: 'Ajustes',
      save: 'Guardar',
      cancel: 'Cancelar',
      modalTitle: 'Preferencias de cookies',
      modalIntro: 'Activa o desactiva categorías. Las cookies esenciales mantienen el sitio funcionando y no pueden desactivarse.',
      essential: 'Esenciales',
      essentialDesc: 'Sesión, idioma, rol — necesarias para usar el sitio.',
      functional: 'Funcionales',
      functionalDesc: 'Recuerdan tu curso, borradores, nivel y preferencias de interfaz.',
      analytics: 'Analítica',
      analyticsDesc: 'Estadísticas anónimas para arreglar bugs y mejorar la app.',
      marketing: 'Marketing',
      marketingDesc: 'Insertados sociales y enlaces personalizados de campaña.',
      required: 'Obligatorio',
      readMore: 'Leer política de privacidad',
      privacyHref: './legal.html?doc=privacy',
    },
    fr: {
      title: 'Votre vie privée compte',
      body: 'Duvela utilise des cookies pour vous garder connecté·e, retenir votre langue et votre niveau et comprendre l’usage. Vous pouvez tout accepter, refuser les non-essentiels ou personnaliser.',
      acceptAll: 'Tout accepter',
      rejectAll: 'Uniquement essentiels',
      settings: 'Paramètres',
      save: 'Enregistrer',
      cancel: 'Annuler',
      modalTitle: 'Préférences de cookies',
      modalIntro: 'Activez ou désactivez les catégories. Les cookies essentiels sont nécessaires au site.',
      essential: 'Essentiels',
      essentialDesc: 'Session, langue, rôle — nécessaires pour utiliser le site.',
      functional: 'Fonctionnels',
      functionalDesc: 'Retiennent votre cours, brouillons, niveau et préférences.',
      analytics: 'Analyse',
      analyticsDesc: 'Statistiques anonymes pour corriger les bugs.',
      marketing: 'Marketing',
      marketingDesc: 'Intégrations sociales et liens de campagne personnalisés.',
      required: 'Requis',
      readMore: 'Lire la politique de confidentialité',
      privacyHref: './legal.html?doc=privacy',
    },
    ar: {
      title: 'خصوصيتك تهمنا',
      body: 'يستخدم Duvela ملفات تعريف الارتباط لإبقائك مسجَّل الدخول، وتذكُّر لغتك ومستواك، وفهم طريقة استخدام التطبيق. يمكنك قبول الكل أو رفض غير الضروري أو تخصيصها.',
      acceptAll: 'قبول الكل',
      rejectAll: 'الأساسية فقط',
      settings: 'إعدادات',
      save: 'حفظ',
      cancel: 'إلغاء',
      modalTitle: 'تفضيلات ملفات تعريف الارتباط',
      modalIntro: 'فعِّل أو عطِّل الفئات. الفئة الأساسية ضرورية لعمل الموقع ولا يمكن تعطيلها.',
      essential: 'أساسية',
      essentialDesc: 'الجلسة، اللغة، الدور — لازمة لاستخدام الموقع.',
      functional: 'وظيفية',
      functionalDesc: 'تتذكَّر آخر مساق، المسودات، المستوى وإعدادات الواجهة.',
      analytics: 'تحليلات',
      analyticsDesc: 'إحصائيات مجهولة تساعدنا على إصلاح الأخطاء والتحسين.',
      marketing: 'تسويق',
      marketingDesc: 'روابط مخصَّصة للحملات والتضمينات الاجتماعية.',
      required: 'مطلوب',
      readMore: 'اقرأ سياسة الخصوصية',
      privacyHref: './legal.html?doc=privacy',
    },
  };

  function pickLocale() {
    var raw = String((navigator && navigator.language) || 'en').toLowerCase();
    var key = raw.split('-')[0];
    return COPY[key] ? key : 'en';
  }
  var locale = pickLocale();
  var t = COPY[locale];
  var isRtl = locale === 'ar';

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== VERSION) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeStored(consent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.assign({
        version: VERSION,
        decidedAt: new Date().toISOString(),
      }, consent)));
    } catch (error) { /* private mode, quota — ignore */ }
    fireChange();
  }

  var listeners = [];
  function fireChange() {
    var current = readStored();
    listeners.forEach(function (fn) { try { fn(current); } catch (_) {} });
  }

  function injectStyles() {
    if (document.getElementById('duvela-cookie-styles')) return;
    var style = document.createElement('style');
    style.id = 'duvela-cookie-styles';
    style.textContent = [
      '.duvela-cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;',
      '  background:#141024;color:#F4F1FA;border-radius:20px;padding:18px 20px;',
      '  box-shadow:0 24px 60px rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.08);',
      '  max-width:640px;margin-inline:auto;font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;}',
      '.duvela-cookie-banner h3{margin:0 0 6px;font-size:16px;font-weight:900;}',
      '.duvela-cookie-banner p{margin:0 0 12px;font-size:13.5px;color:#C8BFDB;line-height:1.5;}',
      '.duvela-cookie-banner .actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;}',
      '.duvela-cookie-banner button{border:0;padding:10px 16px;border-radius:999px;',
      '  font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;}',
      '.duvela-cookie-banner button.primary{background:linear-gradient(100deg,#7845F1,#D63BD8);color:#fff;}',
      '.duvela-cookie-banner button.ghost{background:transparent;color:#F4F1FA;border:1px solid rgba(255,255,255,.24);}',
      '.duvela-cookie-banner button.link{background:transparent;color:#C7B8FF;text-decoration:underline;padding:10px 8px;}',
      '.duvela-cookie-banner .foot{margin-top:10px;font-size:11px;color:#8D84A8;}',
      '.duvela-cookie-banner .foot a{color:#C7B8FF;}',
      '.duvela-cookie-backdrop{position:fixed;inset:0;background:rgba(6,4,14,.65);z-index:99998;',
      '  display:flex;align-items:center;justify-content:center;padding:20px;}',
      '.duvela-cookie-modal{background:#171226;color:#F4F1FA;border-radius:24px;padding:22px;',
      '  max-width:520px;width:100%;max-height:88vh;overflow:auto;',
      '  font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;',
      '  box-shadow:0 32px 72px rgba(0,0,0,.5);}',
      '.duvela-cookie-modal h3{margin:0 0 8px;font-size:20px;font-weight:900;}',
      '.duvela-cookie-modal .intro{color:#C8BFDB;font-size:13.5px;margin:0 0 16px;line-height:1.5;}',
      '.duvela-cookie-row{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-top:1px solid rgba(255,255,255,.06);}',
      '.duvela-cookie-row:first-of-type{border-top:0;}',
      '.duvela-cookie-row .info{flex:1;min-width:0;}',
      '.duvela-cookie-row h4{margin:0;font-size:14px;font-weight:900;color:#F4F1FA;}',
      '.duvela-cookie-row p{margin:2px 0 0;font-size:12.5px;color:#B7AECB;line-height:1.45;}',
      '.duvela-cookie-toggle{width:44px;height:24px;border-radius:999px;background:#3A2F52;position:relative;flex:0 0 auto;cursor:pointer;border:0;padding:0;}',
      '.duvela-cookie-toggle::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .18s ease;}',
      '.duvela-cookie-toggle.on{background:#22C55E;}',
      '.duvela-cookie-toggle.on::after{transform:translateX(20px);}',
      '.duvela-cookie-toggle[disabled]{opacity:.6;cursor:not-allowed;}',
      '.duvela-cookie-row .required{color:#F59E0B;font-size:11px;font-weight:900;letter-spacing:.1em;margin-top:2px;}',
      '.duvela-cookie-modal .modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap;}',
      '.duvela-cookie-modal button{border:0;padding:10px 16px;border-radius:999px;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;}',
      '.duvela-cookie-modal button.primary{background:linear-gradient(100deg,#7845F1,#D63BD8);color:#fff;}',
      '.duvela-cookie-modal button.ghost{background:transparent;color:#F4F1FA;border:1px solid rgba(255,255,255,.24);}',
      '[dir="rtl"] .duvela-cookie-toggle::after{left:auto;right:2px;}',
      '[dir="rtl"] .duvela-cookie-toggle.on::after{transform:translateX(-20px);}',
      '@media (max-width:480px){',
      '  .duvela-cookie-banner{left:10px;right:10px;bottom:10px;padding:16px;}',
      '  .duvela-cookie-banner .actions{justify-content:stretch;}',
      '  .duvela-cookie-banner button{flex:1;}',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  var currentBanner = null;
  var currentModal = null;

  function closeBanner() {
    if (currentBanner && currentBanner.parentNode) currentBanner.parentNode.removeChild(currentBanner);
    currentBanner = null;
  }
  function closeModal() {
    if (currentModal && currentModal.parentNode) currentModal.parentNode.removeChild(currentModal);
    currentModal = null;
  }

  function showBanner() {
    if (currentBanner) return;
    injectStyles();
    var wrap = document.createElement('div');
    wrap.className = 'duvela-cookie-banner';
    if (isRtl) wrap.setAttribute('dir', 'rtl');
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', t.title);
    wrap.innerHTML =
      '<h3>' + esc(t.title) + '</h3>' +
      '<p>' + esc(t.body) + '</p>' +
      '<div class="actions">' +
      '<button type="button" class="link" data-action="settings">' + esc(t.settings) + '</button>' +
      '<button type="button" class="ghost" data-action="reject">' + esc(t.rejectAll) + '</button>' +
      '<button type="button" class="primary" data-action="accept">' + esc(t.acceptAll) + '</button>' +
      '</div>' +
      '<div class="foot"><a href="' + esc(t.privacyHref) + '">' + esc(t.readMore) + '</a></div>';
    document.body.appendChild(wrap);
    currentBanner = wrap;

    wrap.querySelector('[data-action="accept"]').addEventListener('click', function () {
      writeStored({ essential: true, functional: true, analytics: true, marketing: true });
      closeBanner();
    });
    wrap.querySelector('[data-action="reject"]').addEventListener('click', function () {
      writeStored({ essential: true, functional: false, analytics: false, marketing: false });
      closeBanner();
    });
    wrap.querySelector('[data-action="settings"]').addEventListener('click', function () {
      closeBanner();
      showModal();
    });
  }

  function showModal() {
    injectStyles();
    var existing = readStored() || { essential: true, functional: true, analytics: true, marketing: false };
    var state = {
      essential: true,
      functional: existing.functional !== false,
      analytics: existing.analytics === true,
      marketing: existing.marketing === true,
    };

    var backdrop = document.createElement('div');
    backdrop.className = 'duvela-cookie-backdrop';
    if (isRtl) backdrop.setAttribute('dir', 'rtl');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', t.modalTitle);

    var modal = document.createElement('div');
    modal.className = 'duvela-cookie-modal';
    backdrop.appendChild(modal);

    function row(id, title, desc, disabled) {
      return '<div class="duvela-cookie-row">' +
        '<div class="info"><h4>' + esc(title) + '</h4>' +
        '<p>' + esc(desc) + '</p>' +
        (disabled ? '<div class="required">' + esc(t.required) + '</div>' : '') +
        '</div>' +
        '<button type="button" class="duvela-cookie-toggle' + (state[id] ? ' on' : '') + '"' +
        (disabled ? ' disabled aria-disabled="true"' : '') +
        ' data-toggle="' + id + '" aria-label="' + esc(title) + '"></button>' +
        '</div>';
    }

    modal.innerHTML =
      '<h3>' + esc(t.modalTitle) + '</h3>' +
      '<p class="intro">' + esc(t.modalIntro) + '</p>' +
      row('essential', t.essential, t.essentialDesc, true) +
      row('functional', t.functional, t.functionalDesc, false) +
      row('analytics', t.analytics, t.analyticsDesc, false) +
      row('marketing', t.marketing, t.marketingDesc, false) +
      '<div class="modal-actions">' +
      '<button type="button" class="ghost" data-action="cancel">' + esc(t.cancel) + '</button>' +
      '<button type="button" class="primary" data-action="save">' + esc(t.save) + '</button>' +
      '</div>';

    document.body.appendChild(backdrop);
    currentModal = backdrop;

    Array.prototype.forEach.call(modal.querySelectorAll('[data-toggle]'), function (button) {
      if (button.disabled) return;
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-toggle');
        state[key] = !state[key];
        button.classList.toggle('on', state[key]);
      });
    });
    modal.querySelector('[data-action="cancel"]').addEventListener('click', function () {
      closeModal();
      if (!readStored()) showBanner();
    });
    modal.querySelector('[data-action="save"]').addEventListener('click', function () {
      writeStored(state);
      closeModal();
    });
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) {
        closeModal();
        if (!readStored()) showBanner();
      }
    });
  }

  window.DuvelaCookieConsent = {
    /** @returns {null | object} current consent record, or null if undecided. */
    get: function () { return readStored(); },
    /** @param {'essential'|'functional'|'analytics'|'marketing'} category */
    has: function (category) {
      var stored = readStored();
      if (!stored) return false;
      if (category === 'essential') return true;
      return stored[category] === true;
    },
    open: function () { closeBanner(); showModal(); },
    reset: function () {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      fireChange();
      showBanner();
    },
    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (entry) { return entry !== fn; }); };
    },
  };

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var stored = readStored();
    if (!stored) showBanner();

    // The footer link ("Cookie Settings") reopens the picker regardless
    // of whether a decision has already been recorded.
    var footerLink = document.getElementById('footCookie');
    if (footerLink) {
      footerLink.addEventListener('click', function (event) {
        event.preventDefault();
        window.DuvelaCookieConsent.open();
      });
    }
    // Any element the site marks with data-cookie-settings does the same
    // (used by app.html's static privacy shell).
    Array.prototype.forEach.call(document.querySelectorAll('[data-cookie-settings]'), function (node) {
      node.addEventListener('click', function (event) {
        event.preventDefault();
        window.DuvelaCookieConsent.open();
      });
    });
  });
})();
