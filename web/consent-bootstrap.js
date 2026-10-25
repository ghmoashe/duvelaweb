(function bootstrapDuvelaConsent(global) {
  'use strict';

  if (!global.DUVELA_CONSENT) return;
  const supported = new Set(
    (global.DUVELA_WEB_I18N?.locales || []).map((locale) => locale.code)
  );
  const requested = new URLSearchParams(global.location.search).get('lang');
  const saved = localStorage.getItem(global.DUVELA_WEB_I18N?.storageKey || 'duvela.webLang');
  const browser = String(navigator.language || 'en').toLowerCase().split('-')[0];
  const locale = [requested, saved, browser, 'en']
    .map((value) => String(value || '').toLowerCase().split('-')[0])
    .find((value) => supported.has(value)) || 'en';

  global.DUVELA_CONSENT.init(locale);
})(window);
