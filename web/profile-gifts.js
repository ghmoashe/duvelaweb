// Profile gifts on the web: the catalog (same keys and DV prices as the app and the database
// function profile_gift_cost) and the "Send a gift" sheet. The server checks the gift, takes
// the coins and notifies the teacher; the sheet shows "sent" only after it accepted.
(function () {
  var GIFTS = [
    { key: 'rose', cost: 0, en: 'Rose', ru: 'Роза' },
    { key: 'heart', cost: 0, en: 'Heart', ru: 'Сердце' },
    { key: 'coffee', cost: 0, en: 'Coffee', ru: 'Кофе' },
    { key: 'book', cost: 0, en: 'Book', ru: 'Книга' },
    { key: 'fire-gift', cost: 10, en: 'Fire gift', ru: 'Огонь' },
    { key: 'crown', cost: 12, en: 'Crown', ru: 'Корона' },
    { key: 'magic-box', cost: 15, en: 'Magic Box', ru: 'Волшебная коробка' },
    { key: 'watch', cost: 16, en: 'Watch', ru: 'Часы' },
    { key: 'diamond', cost: 18, en: 'Diamond', ru: 'Бриллиант' },
    { key: 'duvela-star', cost: 20, en: 'Duvela Star', ru: 'Звезда Duvela' }
  ];
  var byKey = {};
  GIFTS.forEach(function (g) { byKey[g.key] = g; });

  function image(key) { return './gifts/' + key + '.png'; }
  function esc(s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  function openSheet(opts) {
    var supa = opts.supa, isRu = opts.isRu;
    var t = function (en, ru) { return isRu ? ru : en; };
    var name = function (g) { return isRu ? g.ru : g.en; };
    var state = { key: GIFTS[0].key, balance: null, sending: false, sent: null, error: '' };

    var overlay = document.createElement('div');
    overlay.className = 'pg-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function close() {
      overlay.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    supa.rpc('get_my_coin_balance').then(function (r) {
      if (!r.error && typeof r.data === 'number') { state.balance = Math.max(0, Math.floor(r.data)); render(); }
    }, function () {});

    function render() {
      var gift = byKey[state.key];
      if (state.sent) {
        overlay.innerHTML =
          '<div class="pg-sheet pg-sent">' +
            '<div class="pg-pop"><img src="' + image(state.sent.key) + '" alt=""></div>' +
            '<h2>' + esc(t('Gift sent!', 'Подарок отправлен!')) + '</h2>' +
            '<p>' + esc(t(opts.recipientName + ' will get a notification with your gift.', opts.recipientName + ' получит уведомление о вашем подарке.')) + '</p>' +
            '<div class="pg-row"><button type="button" class="pg-ghost" data-pg-again>' + esc(t('Send another', 'Ещё подарок')) + '</button>' +
            '<button type="button" class="pg-send" data-pg-close>' + esc(t('Done', 'Готово')) + '</button></div>' +
          '</div>';
        overlay.querySelector('[data-pg-again]').onclick = function () { state.sent = null; render(); };
        overlay.querySelector('[data-pg-close]').onclick = close;
        return;
      }
      var notEnough = gift.cost > 0 && typeof state.balance === 'number' && state.balance < gift.cost;
      overlay.innerHTML =
        '<div class="pg-sheet">' +
          '<header><div><h2>' + esc(t('Send a gift', 'Отправить подарок')) + '</h2><p>' + esc(t('to ', 'для ') + opts.recipientName) + '</p></div>' +
          '<button type="button" class="pg-x" aria-label="' + esc(t('Close', 'Закрыть')) + '" data-pg-close>×</button></header>' +
          (typeof state.balance === 'number' ? '<div class="pg-balance">💰 ' + esc(t('Balance: ', 'Баланс: ') + state.balance + ' DV') + '</div>' : '') +
          '<div class="pg-grid">' + GIFTS.map(function (g) {
            return '<button type="button" class="pg-card' + (g.key === state.key ? ' active' : '') + '" data-pg-key="' + g.key + '" aria-pressed="' + (g.key === state.key) + '">' +
              '<img src="' + image(g.key) + '" alt="">' +
              '<b>' + esc(name(g)) + '</b>' +
              '<span class="' + (g.cost ? 'paid' : 'free') + '">' + esc(g.cost ? g.cost + ' DV' : t('Free', 'Бесплатно')) + '</span>' +
            '</button>';
          }).join('') + '</div>' +
          '<input class="pg-note" maxlength="140" placeholder="' + esc(t('Add a short note (optional)', 'Короткое пожелание (необязательно)')) + '" value="' + esc(state.note || '') + '">' +
          (state.error ? '<p class="pg-error">' + esc(state.error) + '</p>' : '') +
          (notEnough
            ? '<p class="pg-error">' + esc(t('Not enough DV coins for this gift. Top up in your Duvela wallet.', 'Недостаточно DV для этого подарка. Пополните кошелёк Duvela.')) + '</p>'
            : '<button type="button" class="pg-send" data-pg-send' + (state.sending ? ' disabled' : '') + '>' +
                (state.sending ? '…' : '🎁 ' + esc(gift.cost ? t('Send ', 'Отправить: ') + name(gift) + ' · ' + gift.cost + ' DV' : t('Send ', 'Отправить: ') + name(gift))) +
              '</button>') +
        '</div>';
      overlay.querySelector('[data-pg-close]').onclick = close;
      var note = overlay.querySelector('.pg-note');
      note.oninput = function () { state.note = note.value; };
      overlay.querySelectorAll('[data-pg-key]').forEach(function (btn) {
        btn.onclick = function () { state.key = btn.dataset.pgKey; state.error = ''; render(); };
      });
      var sendBtn = overlay.querySelector('[data-pg-send]');
      if (sendBtn) sendBtn.onclick = send;
    }

    function send() {
      var gift = byKey[state.key];
      if (state.sending) return;
      if (gift.cost > 0 && !window.confirm(t(name(gift) + ' for ' + opts.recipientName + ' — ' + gift.cost + ' DV coins. Send?', name(gift) + ' для ' + opts.recipientName + ' — ' + gift.cost + ' DV. Отправить?'))) return;
      state.sending = true; state.error = ''; render();
      supa.rpc('send_profile_gift', { p_recipient: opts.recipientId, p_gift_key: gift.key, p_message: (state.note || '').trim() || null })
        .then(function (r) {
          state.sending = false;
          if (r.error) {
            var m = r.error.message || '';
            state.error = /not enough dv/i.test(m) ? t('Not enough DV coins for this gift.', 'Недостаточно DV для этого подарка.')
              : /limit reached/i.test(m) ? t('You have sent enough free gifts today. Try a premium gift or come back tomorrow.', 'На сегодня бесплатные подарки закончились. Выберите премиум-подарок или вернитесь завтра.')
              : /teachers and organizers/i.test(m) ? t('Gifts can only be sent to teachers and organizers.', 'Подарки можно отправлять только преподавателям и организаторам.')
              : t('Could not send the gift. Try again.', 'Не удалось отправить подарок. Попробуйте ещё раз.');
            render();
            return;
          }
          var row = r.data || {};
          if (gift.cost > 0 && typeof row.balanceAfter === 'number') state.balance = row.balanceAfter;
          if (row.giftId) supa.functions.invoke('send-push', { body: { type: 'gift_received', giftId: row.giftId } }).catch(function () {});
          state.note = '';
          state.sent = gift;
          render();
          if (opts.onSent) opts.onSent(gift);
        }, function () { state.sending = false; state.error = t('Could not send the gift. Try again.', 'Не удалось отправить подарок. Попробуйте ещё раз.'); render(); });
    }

    render();
  }

  window.DuvelaGifts = { list: GIFTS, byKey: byKey, image: image, openSheet: openSheet };
})();
