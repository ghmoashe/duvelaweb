(function attachDuvelaConsent(global) {
  'use strict';

  const STORAGE_KEY = 'klaro-consent';
  let locale = 'en';
  let banner;
  let overlay;
  let serviceInputs = new Map();

  function catalog() {
    return global.DUVELA_LEGAL;
  }

  function translation() {
    const translations = catalog()?.consentTranslations ?? {};
    return translations[locale] ?? translations.en;
  }

  function readConsent() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveConsent(next) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...next, necessary: true, updatedAt: new Date().toISOString() }),
    );
    banner.hidden = true;
    overlay.hidden = true;
    global.dispatchEvent(new CustomEvent('duvela-consent-change', { detail: next }));
  }

  function stateFor(value) {
    return Object.fromEntries(
      (catalog()?.services ?? []).map((service) => [
        service.id,
        service.required ? true : value,
      ]),
    );
  }

  function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function updateLanguage(nextLocale) {
    locale = String(nextLocale || 'en').toLowerCase().split('-')[0];
    if (!banner || !overlay) return;

    const copy = translation();
    document.documentElement.dataset.consentLocale = locale;
    setText('[data-consent="notice-title"]', copy.consentModal.title);
    setText('[data-consent="notice-copy"]', copy.consentNotice.description);
    setText('[data-consent="settings"]', copy.consentNotice.learnMore);
    setText('[data-consent="decline"]', copy.decline);
    setText('[data-consent="accept"]', copy.acceptAll);
    setText('[data-consent="modal-title"]', copy.consentModal.title);
    setText('[data-consent="modal-copy"]', copy.consentModal.description);
    setText('[data-consent="save"]', copy.save);
    setText('[data-consent="modal-decline"]', copy.decline);
    setText('[data-consent="modal-accept"]', copy.acceptAll);

    for (const service of catalog().services) {
      setText(`[data-service-title="${service.id}"]`, service.title);
      setText(
        `[data-service-copy="${service.id}"]`,
        service.required
          ? copy.service.required.description
          : copy.purposes[service.purpose],
      );
    }
  }

  function syncInputs() {
    const stored = readConsent() ?? stateFor(false);
    for (const service of catalog().services) {
      serviceInputs.get(service.id).checked = service.required || Boolean(stored[service.id]);
    }
  }

  function openSettings() {
    syncInputs();
    overlay.hidden = false;
  }

  function closeSettings() {
    overlay.hidden = true;
  }

  function build() {
    banner = document.createElement('aside');
    banner.className = 'consent-banner';
    banner.innerHTML = `
      <div class="consent-banner-title" data-consent="notice-title"></div>
      <div class="consent-banner-copy" data-consent="notice-copy"></div>
      <div class="consent-actions">
        <button class="consent-button" type="button" data-consent="settings"></button>
        <button class="consent-button" type="button" data-consent="decline"></button>
        <button class="consent-button primary" type="button" data-consent="accept"></button>
      </div>
    `;

    overlay = document.createElement('div');
    overlay.className = 'consent-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="consent-modal" role="dialog" aria-modal="true">
        <div class="consent-modal-title" data-consent="modal-title"></div>
        <div class="consent-modal-copy" data-consent="modal-copy"></div>
        <div class="consent-service-list"></div>
        <div class="consent-actions">
          <button class="consent-button" type="button" data-consent="modal-decline"></button>
          <button class="consent-button" type="button" data-consent="save"></button>
          <button class="consent-button primary" type="button" data-consent="modal-accept"></button>
        </div>
      </section>
    `;

    const serviceList = overlay.querySelector('.consent-service-list');
    for (const service of catalog().services) {
      const row = document.createElement('label');
      row.className = 'consent-service';
      row.innerHTML = `
        <span>
          <span class="consent-service-title" data-service-title="${service.id}"></span>
          <span class="consent-service-copy" data-service-copy="${service.id}"></span>
        </span>
        <input type="checkbox" ${service.required ? 'disabled checked' : ''}>
      `;
      const input = row.querySelector('input');
      serviceInputs.set(service.id, input);
      serviceList.appendChild(row);
    }

    document.body.append(banner, overlay);

    banner.querySelector('[data-consent="settings"]').addEventListener('click', openSettings);
    banner.querySelector('[data-consent="decline"]').addEventListener('click', () => {
      saveConsent(stateFor(false));
    });
    banner.querySelector('[data-consent="accept"]').addEventListener('click', () => {
      saveConsent(stateFor(true));
    });
    overlay.querySelector('[data-consent="modal-decline"]').addEventListener('click', () => {
      saveConsent(stateFor(false));
    });
    overlay.querySelector('[data-consent="modal-accept"]').addEventListener('click', () => {
      saveConsent(stateFor(true));
    });
    overlay.querySelector('[data-consent="save"]').addEventListener('click', () => {
      saveConsent(
        Object.fromEntries(
          catalog().services.map((service) => [
            service.id,
            service.required || serviceInputs.get(service.id).checked,
          ]),
        ),
      );
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeSettings();
    });
  }

  function init(initialLocale) {
    if (!catalog()) throw new Error('DUVELA_LEGAL catalog is required before consent.js.');
    if (!banner) build();
    updateLanguage(initialLocale);
    banner.hidden = Boolean(readConsent());
  }

  global.DUVELA_CONSENT = {
    init,
    openSettings,
    updateLanguage,
  };
})(window);
