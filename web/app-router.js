(function () {
  function createAppRouter(ctx) {
    const { $, $$, tr, navLabels, titles, modeKey, setText } = ctx;

    function syncShell() {
      const mode = modeKey();
      const label = mode === 'bus' ? 'Duvela Business' : 'Duvela Hub';
      const homeNav = document.querySelector('.nav button[data-view="home"]');
      if (homeNav) {
        homeNav.hidden = mode !== 'bus';
        homeNav.style.display = mode === 'bus' ? '' : 'none';
      }
      document.body.classList.toggle('business-mode', mode === 'bus');
      setText('#modeChip', label);
      setText('#sideStatusTitle', mode === 'bus' ? tr('Duvela Business workspace', 'Кабинет Duvela Business') : tr('Duvela Hub workspace', 'Кабинет Duvela Hub'));
      setText(
        '#sideStatusText',
        mode === 'bus'
          ? tr('Manage live, courses, events and messages from this browser.', 'Управляйте эфирами, курсами, событиями и сообщениями прямо из браузера.')
          : tr('Learn, watch live lessons and keep your practice in this browser.', 'Учитесь, смотрите эфиры и продолжайте практику прямо в браузере.')
      );
      Object.entries(navLabels[mode]).forEach(([view, text]) => {
        const labelNode = document.querySelector('.nav button[data-view="' + view + '"] span:last-child');
        if (labelNode) labelNode.textContent = text;
      });
    }

    function setView(view) {
      const mode = modeKey();
      const copy = titles[mode];
      const defaultView = mode === 'bus' ? 'home' : 'workspace';
      const learnerView = mode !== 'bus' && view === 'home' ? defaultView : view;
      const businessOnly = learnerView === 'management' || learnerView === 'earnings';
      const learnerOnly = learnerView === 'wallet';
      const allowedView = mode !== 'bus' && businessOnly ? defaultView : (mode === 'bus' && learnerOnly ? defaultView : learnerView);
      const known = copy[allowedView] ? allowedView : defaultView;
      $$('.nav button').forEach((button) => {
        const isChallengeTab = known === 'management' && window.__duvelaManagementTab === 'challenges';
        const active = isChallengeTab
          ? button.dataset.view === 'management' && button.dataset.managementTab === 'challenges'
          : button.dataset.view === known && !(button.dataset.view === 'management' && button.dataset.managementTab);
        button.classList.toggle('active', active);
      });
      $$('[data-sidebar-action]').forEach((button) => {
        const active = button.dataset.sidebarAction === 'settings' && known === 'settings';
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      });
      $$('.panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === known));
      $('#viewTitle').textContent = copy[known][0];
      $('#viewSub').textContent = copy[known][1];
      if (window.location.hash !== '#' + known) history.replaceState(null, '', '#' + known);
    }

    return {
      setView,
      syncShell
    };
  }

  window.DuvelaAppRouter = { create: createAppRouter };
})();
