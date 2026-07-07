(function () {
  function createAppRouter(ctx) {
    const { $, $$, tr, navLabels, titles, modeKey, setText } = ctx;

    function syncShell() {
      const mode = modeKey();
      const label = mode === 'bus' ? 'Bus Web' : 'Hub Web';
      document.body.classList.toggle('business-mode', mode === 'bus');
      setText('#modeChip', label);
      setText('#sideStatusTitle', mode === 'bus' ? tr('Bus Web workspace', 'Кабинет Bus Web') : tr('Hub Web workspace', 'Кабинет Hub Web'));
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
      const copy = titles[modeKey()];
      const known = copy[view] ? view : 'home';
      $$('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.view === known));
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
