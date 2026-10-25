(function attachDuvelaHomepageV6(global) {
  'use strict';

  const CONSENT_KEY = 'klaro-consent';
  const tabs = Array.from(document.querySelectorAll('[data-product-tab]'));
  const panel = document.getElementById('productTabPanel');
  const menuToggle = document.getElementById('navMenuToggle');
  const primaryNav = document.getElementById('primaryNav');
  let activeProduct = 'videos';
  let copy = global.DUVELA_HOME_V6_COPY || null;

  function analyticsAllowed() {
    try {
      return Boolean(JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')?.ga);
    } catch {
      return false;
    }
  }

  function track(name, data) {
    if (!analyticsAllowed() || typeof global.va !== 'function') return;
    global.va('event', { name, data: data || {} });
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function renderProduct(name, moveFocus) {
    if (!copy?.items?.[name] || !panel) return;
    activeProduct = name;
    const item = copy.items[name];
    const activeTab = tabs.find((tab) => tab.dataset.productTab === name);

    for (const tab of tabs) {
      const active = tab === activeTab;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }

    panel.setAttribute('aria-labelledby', activeTab?.id || 'productTabVideos');
    const content = element('div');
    content.append(
      element('span', 'product-tab-kicker', item.kicker),
      element('h3', '', item.title),
      element('p', '', item.text)
    );
    const link = element('a', '', item.cta + ' →');
    link.href = item.href;
    link.dataset.analyticsEvent = 'home_product_open';
    link.dataset.analyticsArea = name;
    content.append(link);

    const preview = element('div', 'product-tab-preview');
    preview.setAttribute('aria-hidden', 'true');
    preview.append(
      element('span', '', item.label),
      element('strong', '', item.preview),
      element('small', '', 'DUVELA')
    );
    panel.replaceChildren(content, preview);
    if (moveFocus) activeTab?.focus();
  }

  function localizeProduct(nextCopy) {
    if (!nextCopy) return;
    copy = nextCopy;
    const heading = document.querySelector('.product-showcase-head');
    if (heading) {
      const kicker = heading.querySelector('.sec-kicker');
      const title = heading.querySelector('.sec-title');
      const sub = heading.querySelector('.sec-sub');
      if (kicker) kicker.textContent = copy.section.kicker;
      if (title) title.textContent = copy.section.title;
      if (sub) sub.textContent = copy.section.sub;
    }
    for (const tab of tabs) {
      const item = copy.items[tab.dataset.productTab];
      if (item) tab.textContent = item.tab;
    }
    renderProduct(activeProduct, false);
  }

  function setMenu(open) {
    if (!menuToggle || !primaryNav) return;
    primaryNav.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    const labels = copy?.menu || { open: 'Menu', close: 'Close' };
    menuToggle.textContent = open ? labels.close : labels.open;
    menuToggle.setAttribute('aria-label', open ? labels.close : labels.open);
  }

  function bindProductTabs() {
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        renderProduct(tab.dataset.productTab, false);
        track('home_product_tab', { area: tab.dataset.productTab });
      });
      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        renderProduct(tabs[nextIndex].dataset.productTab, true);
      });
    });
  }

  function bindMenu() {
    if (!menuToggle || !primaryNav) return;
    menuToggle.addEventListener('click', () => setMenu(!primaryNav.classList.contains('is-open')));
    primaryNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && primaryNav.classList.contains('is-open')) {
        setMenu(false);
        menuToggle.focus();
      }
    });
  }

  function bindConversionAnalytics() {
    const markers = [
      ['.hero-actions .btn-primary', 'home_start_learning'],
      ['.hero-actions .btn-ghost', 'home_start_teaching'],
      ['.hero-persona-learn', 'home_choose_learner'],
      ['.hero-persona-biz', 'home_choose_teacher'],
      ['.nav-cta', 'home_nav_get_started'],
      ['#openLogin', 'home_login_open'],
      ['#openLoginMob', 'home_login_open'],
      ['#pricing .price-card:nth-child(1) a', 'home_pricing_learner'],
      ['#pricing .price-card:nth-child(2) a', 'home_pricing_course'],
      ['#pricing .price-card:nth-child(3) a', 'home_pricing_teacher']
    ];
    markers.forEach(([selector, eventName]) => {
      document.querySelectorAll(selector).forEach((node) => { node.dataset.analyticsEvent = eventName; });
    });

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-analytics-event]');
      if (!target) return;
      track(target.dataset.analyticsEvent, {
        area: target.dataset.analyticsArea || target.dataset.signupRole || 'homepage'
      });
    });
  }

  function optimizeMedia() {
    document.querySelectorAll('img').forEach((image) => {
      image.decoding = 'async';
      if (!image.closest('.nav,.hero')) image.loading = 'lazy';
    });
  }

  global.addEventListener('duvela-home-v6-copy', (event) => localizeProduct(event.detail));
  global.addEventListener('duvela-consent-change', (event) => {
    if (event.detail?.ga) track('consent_analytics_enabled', { area: 'cookie_preferences' });
  });

  bindProductTabs();
  bindMenu();
  bindConversionAnalytics();
  optimizeMedia();
  localizeProduct(copy);
  setMenu(false);
})(window);
