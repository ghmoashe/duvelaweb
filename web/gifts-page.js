// Gifts this teacher/organizer received (my_received_gifts), newest first; opening the page
// marks new ones as seen.
(function () {
  var isRu = (navigator.language || '').toLowerCase().indexOf('ru') === 0;
  var t = function (en, ru) { return isRu ? ru : en; };
  var esc = function (s) { return s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); };
  document.documentElement.lang = isRu ? 'ru' : 'en';
  document.getElementById('pgTitle').textContent = t('Gifts', 'Подарки');
  document.getElementById('pgLoading').textContent = t('Loading…', 'Загрузка…');
  var supa = window.DuvelaWebConfig.createSupabaseClient();
  var body = document.getElementById('pgBody');

  supa.auth.getSession().then(function (res) {
    var session = res && res.data && res.data.session;
    if (!session) {
      window.location.href = './index.html?login=1&return_to=' + encodeURIComponent('/gifts.html');
      return;
    }
    return supa.rpc('my_received_gifts', { p_limit: 150 }).then(function (r) {
      if (r.error) { body.innerHTML = '<div class="pg-empty"><b>' + esc(t('Could not load gifts.', 'Не удалось загрузить подарки.')) + '</b></div>'; return; }
      var rows = r.data || [];
      if (!rows.length) {
        body.innerHTML = '<div class="pg-empty"><span>🎁</span><b>' + esc(t('No gifts yet', 'Подарков пока нет')) + '</b><p>' + esc(t('Learners can send you gifts from your profile. They will appear here.', 'Ученики могут отправлять вам подарки из вашего профиля. Они появятся здесь.')) + '</p></div>';
        return;
      }
      var total = rows.reduce(function (s, g) { return s + (g.cost_dv || 0); }, 0);
      var senders = new Set(rows.map(function (g) { return g.sender_id; })).size;
      body.innerHTML =
        '<section class="pg-summary"><small>' + esc(t('Received', 'Получено')) + '</small><div>' +
          '<span><b>' + rows.length + '</b>' + esc(t('gifts', 'подарков')) + '</span>' +
          '<span><b>' + total + '</b>' + esc(t('DV earned', 'DV заработано')) + '</span>' +
          '<span><b>' + senders + '</b>' + esc(t('learners', 'учеников')) + '</span>' +
        '</div></section>' +
        rows.map(function (g) {
          var info = window.DuvelaGifts.byKey[g.gift_key];
          var giftName = info ? (isRu ? info.ru : info.en) : g.gift_key;
          var sender = (g.sender_name || '').trim() || t('A learner', 'Ученик');
          var when = new Date(g.created_at).toLocaleDateString(isRu ? 'ru' : 'en', { day: 'numeric', month: 'short' });
          return '<div class="pg-item' + (g.seen_at ? '' : ' new') + '">' +
            '<span class="pg-bubble">' + (info ? '<img src="' + window.DuvelaGifts.image(g.gift_key) + '" alt="">' : '🎁') + '</span>' +
            '<div><div class="pg-line"><b>' + esc(giftName) + '</b><em class="' + (g.cost_dv ? 'paid' : 'free') + '">' + esc(g.cost_dv ? '+' + g.cost_dv + ' DV' : t('Free', 'Бесплатно')) + '</em></div>' +
            '<div class="pg-from">' + (g.sender_avatar ? '<img src="' + esc(g.sender_avatar) + '" alt="">' : '<i>' + esc(sender[0].toUpperCase()) + '</i>') + '<span>' + esc(sender) + '</span><small>' + esc(when) + '</small></div>' +
            (g.message ? '<q>' + esc(g.message) + '</q>' : '') + '</div>' +
            (g.seen_at ? '' : '<span class="pg-dot" aria-label="' + esc(t('New', 'Новый')) + '"></span>') +
          '</div>';
        }).join('');
      if (rows.some(function (g) { return !g.seen_at; })) supa.rpc('mark_profile_gifts_seen').then(function () {}, function () {});
    });
  });
})();
