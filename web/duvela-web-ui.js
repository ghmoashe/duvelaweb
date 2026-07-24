(function attachDuvelaWebUi(global) {
  'use strict';

  const STYLE_ID = 'duvela-web-toast-style';
  const HOST_ID = 'duvela-web-toast-host';
  const MODAL_ID = 'duvela-web-dialog-host';

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
      '#' + MODAL_ID + ' {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 10000;',
      '  display: none;',
      '  place-items: center;',
      '  padding: 22px;',
      '  background: rgba(25, 18, 43, .54);',
      '  backdrop-filter: blur(12px);',
      '}',
      '#' + MODAL_ID + '.open { display: grid; }',
      '.duvela-dialog-card {',
      '  width: min(460px, 100%);',
      '  overflow: hidden;',
      '  border: 1px solid rgba(109, 63, 224, .16);',
      '  border-radius: 24px;',
      '  background: #fff;',
      '  box-shadow: 0 28px 90px rgba(32, 22, 64, .28);',
      '  transform: translateY(10px) scale(.98);',
      '  opacity: 0;',
      '  transition: opacity .18s ease, transform .18s ease;',
      '}',
      '#' + MODAL_ID + '.open .duvela-dialog-card { opacity: 1; transform: translateY(0) scale(1); }',
      '.duvela-dialog-top {',
      '  display: flex;',
      '  gap: 13px;',
      '  align-items: flex-start;',
      '  padding: 22px 22px 14px;',
      '}',
      '.duvela-dialog-icon {',
      '  width: 44px;',
      '  height: 44px;',
      '  flex: 0 0 44px;',
      '  display: grid;',
      '  place-items: center;',
      '  border-radius: 16px;',
      '  color: #6d3fe0;',
      '  background: #f1ecff;',
      '  font-size: 20px;',
      '  font-weight: 900;',
      '}',
      '.duvela-dialog-copy { min-width: 0; display: grid; gap: 7px; }',
      '.duvela-dialog-copy h2 { margin: 0; color: #17151f; font-size: 18px; line-height: 1.25; }',
      '.duvela-dialog-copy p { margin: 0; color: #6b6478; font-size: 14px; font-weight: 650; line-height: 1.55; }',
      '.duvela-dialog-input {',
      '  width: calc(100% - 44px);',
      '  margin: 0 22px 4px;',
      '  min-height: 44px;',
      '  border: 1px solid #e9e5f1;',
      '  border-radius: 14px;',
      '  padding: 0 13px;',
      '  outline: 0;',
      '  font: inherit;',
      '}',
      '.duvela-dialog-input:focus { border-color: rgba(109,63,224,.55); box-shadow: 0 0 0 3px rgba(109,63,224,.12); }',
      '.duvela-dialog-actions {',
      '  display: flex;',
      '  justify-content: flex-end;',
      '  gap: 9px;',
      '  padding: 16px 22px 22px;',
      '}',
      '.duvela-dialog-actions button {',
      '  min-height: 42px;',
      '  border: 1px solid #e9e5f1;',
      '  border-radius: 13px;',
      '  padding: 0 17px;',
      '  background: #fff;',
      '  color: #17151f;',
      '  font: inherit;',
      '  font-weight: 850;',
      '  cursor: pointer;',
      '}',
      '.duvela-dialog-actions button.primary { border-color: #6d3fe0; background: #6d3fe0; color: #fff; box-shadow: 0 12px 24px rgba(109,63,224,.22); }',
      '.duvela-dialog-actions button.danger { border-color: #d92d20; background: #d92d20; color: #fff; }',
      '@media (max-width: 520px) { .duvela-dialog-actions { display: grid; } .duvela-dialog-actions button { width: 100%; } }',
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

  function ensureModal() {
    ensureStyles();
    let host = document.getElementById(MODAL_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = MODAL_ID;
      host.setAttribute('role', 'dialog');
      host.setAttribute('aria-modal', 'true');
      document.body.appendChild(host);
    }
    return host;
  }

  function dialog(options) {
    const opts = options || {};
    const host = ensureModal();
    const title = opts.title || 'Duvela';
    const message = opts.message || '';
    const mode = opts.mode || 'alert';
    const confirmLabel = opts.confirmLabel || (mode === 'prompt' ? 'Save' : 'OK');
    const cancelLabel = opts.cancelLabel || 'Cancel';
    const icon = opts.icon || (mode === 'confirm' ? '?' : 'i');
    const tone = opts.tone || 'primary';

    return new Promise((resolve) => {
      host.innerHTML =
        '<div class="duvela-dialog-card">' +
          '<div class="duvela-dialog-top">' +
            '<div class="duvela-dialog-icon">' + icon + '</div>' +
            '<div class="duvela-dialog-copy"><h2></h2><p></p></div>' +
          '</div>' +
          (mode === 'prompt' ? '<input class="duvela-dialog-input">' : '') +
          '<div class="duvela-dialog-actions">' +
            (mode !== 'alert' ? '<button type="button" data-dialog-cancel></button>' : '') +
            '<button type="button" class="' + (tone === 'danger' ? 'danger' : 'primary') + '" data-dialog-ok></button>' +
          '</div>' +
        '</div>';
      host.querySelector('h2').textContent = String(title);
      host.querySelector('p').textContent = String(message);
      const input = host.querySelector('.duvela-dialog-input');
      if (input) input.value = opts.defaultValue || '';
      const ok = host.querySelector('[data-dialog-ok]');
      const cancel = host.querySelector('[data-dialog-cancel]');
      ok.textContent = confirmLabel;
      if (cancel) cancel.textContent = cancelLabel;

      const finish = (value) => {
        host.classList.remove('open');
        document.removeEventListener('keydown', onKey);
        setTimeout(() => { host.innerHTML = ''; }, 160);
        resolve(value);
      };
      const onKey = (event) => {
        if (event.key === 'Escape') finish(mode === 'alert' ? true : null);
        if (event.key === 'Enter' && (!input || document.activeElement === input)) {
          finish(mode === 'prompt' ? input.value : true);
        }
      };
      ok.addEventListener('click', () => finish(mode === 'prompt' ? input.value : true));
      if (cancel) cancel.addEventListener('click', () => finish(null));
      host.addEventListener('click', (event) => { if (event.target === host) finish(mode === 'alert' ? true : null); }, { once: true });
      document.addEventListener('keydown', onKey);
      host.classList.add('open');
      setTimeout(() => { (input || ok).focus(); }, 0);
    });
  }

  function confirmDialog(message, options) {
    const opts = options || {};
    return dialog({
      mode: 'confirm',
      title: opts.title || 'Duvela',
      message,
      icon: opts.icon || '!',
      tone: opts.tone,
      confirmLabel: opts.confirmLabel || 'OK',
      cancelLabel: opts.cancelLabel || 'Cancel'
    }).then(Boolean);
  }

  function promptDialog(message, defaultValue, options) {
    const opts = options || {};
    return dialog({
      mode: 'prompt',
      title: opts.title || 'Duvela',
      message,
      defaultValue,
      icon: opts.icon || '✎',
      confirmLabel: opts.confirmLabel || 'Save',
      cancelLabel: opts.cancelLabel || 'Cancel'
    });
  }

  if (!global.__duvelaNativeAlert) global.__duvelaNativeAlert = global.alert;
  global.alert = function duvelaAlert(message) {
    legacyAlert(message);
  };

  global.DuvelaWebUi = Object.freeze({
    showToast,
    legacyAlert,
    dialog,
    confirm: confirmDialog,
    prompt: promptDialog,
    ensureHost,
  });
})(window);
