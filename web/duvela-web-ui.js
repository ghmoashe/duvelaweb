(function attachDuvelaWebUi(global) {
  'use strict';

  const STYLE_ID = 'duvela-web-toast-style';
  const HOST_ID = 'duvela-web-toast-host';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + HOST_ID + ' {',
      '  position: fixed;',
      '  right: 18px;',
      '  bottom: 18px;',
      '  z-index: 9999;',
      '  display: grid;',
      '  gap: 10px;',
      '  max-width: min(360px, calc(100vw - 24px));',
      '}',
      '.' + HOST_ID + '-toast {',
      '  border-radius: 16px;',
      '  padding: 14px 16px;',
      '  color: #fff;',
      '  box-shadow: 0 18px 42px rgba(15, 23, 42, .22);',
      '  font-family: inherit;',
      '  font-size: 14px;',
      '  font-weight: 800;',
      '  line-height: 1.4;',
      '  opacity: 0;',
      '  transform: translateY(12px);',
      '  transition: opacity .18s ease, transform .18s ease;',
      '}',
      '.' + HOST_ID + '-toast.show {',
      '  opacity: 1;',
      '  transform: translateY(0);',
      '}',
      '.' + HOST_ID + '-info { background: #1f2937; }',
      '.' + HOST_ID + '-success { background: #0f9f7a; }',
      '.' + HOST_ID + '-error { background: #d92d20; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureHost() {
    ensureStyles();
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      document.body.appendChild(host);
    }
    return host;
  }

  function normalizeTone(tone) {
    return ['info', 'success', 'error'].includes(tone) ? tone : 'info';
  }

  function inferTone(message) {
    const text = String(message || '');
    if (/[✓]|success|saved|created|published|booked|joined|sent|completed|успеш|сохран|создан|опублик|отправлен|запис/.test(text.toLowerCase())) {
      return 'success';
    }
    if (/could not|failed|error|not available|unavailable|denied|не удалось|ошиб|недоступ|отказ/.test(text.toLowerCase())) {
      return 'error';
    }
    return 'info';
  }

  function showToast(options) {
    const message = typeof options === 'string' ? options : options && options.message;
    if (!message) return;

    const host = ensureHost();
    const tone = normalizeTone(typeof options === 'string' ? 'info' : options.tone || 'info');
    const duration = typeof options === 'object' && typeof options.duration === 'number'
      ? options.duration
      : 3200;
    const toast = document.createElement('div');
    toast.className = HOST_ID + '-toast ' + HOST_ID + '-' + tone;
    toast.textContent = String(message);
    host.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    const dismiss = () => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 180);
    };

    setTimeout(dismiss, Math.max(duration, 1200));
    return dismiss;
  }

  function legacyAlert(message) {
    return showToast({ message, tone: inferTone(message) });
  }

  global.DuvelaWebUi = Object.freeze({
    showToast,
    legacyAlert,
    ensureHost,
  });
})(window);
