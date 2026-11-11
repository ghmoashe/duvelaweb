// Super+ on the web (super-plus.html?teacher=<id>), same two states as the app:
// an offer before subscribing and a member view once the server says it is active.
// Price: teacher_super_price(); status/dates: my_teacher_subscriptions(); balance:
// get_my_coin_balance(); actions: subscribe_to_teacher / cancel_teacher_subscription /
// resume_teacher_subscription. Nothing is changed locally to look like a server answer —
// after every action the page reads the server again.
(function () {
  var PERIOD_DAYS = 30;
  var isRu = (navigator.language || '').toLowerCase().indexOf('ru') === 0;
  var t = function (en, ru) { return isRu ? ru : en; };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  var root = document.getElementById('spRoot');
  var supa = window.DuvelaWebConfig.createSupabaseClient();
  var teacherId = (new URLSearchParams(location.search).get('teacher') || '').trim();
  document.documentElement.lang = isRu ? 'ru' : 'en';

  var icon = {
    back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    crown: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8z"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
    ok: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>',
    cal: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    info: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    wallet: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v14H5a2 2 0 0 1-2-2V5"/><path d="M16 14h.01"/></svg>',
    media: '<svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    spark: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    mic: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    heart: '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.2-8.7C1.3 8.2 3 4.5 6.5 4.5c2 0 3.5 1.2 5.5 3.3 2-2.1 3.5-3.3 5.5-3.3 3.5 0 5.2 3.7 3.7 6.8C19 15.6 12 20 12 20z"/></svg>',
    shield: '<svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  var state = { user: null, teacher: null, price: null, sub: null, balance: null, busy: null, error: '', confirm: null, loaded: false };

  function backHref() { return teacherId ? './profile.html?id=' + encodeURIComponent(teacherId) : './app.html'; }
  function loginHref() { return './index.html?login=1&return_to=' + encodeURIComponent('/super-plus.html?teacher=' + teacherId); }
  function fmtDate(value) {
    var d = value ? new Date(value) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleDateString(isRu ? 'ru' : 'en', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  }
  function avatar(large) {
    var p = state.teacher || {};
    var cls = 'spv2-avatar' + (large ? ' spv2-avatar-large' : '');
    if (p.avatar_url) return '<img class="' + cls + '" src="' + esc(p.avatar_url) + '" alt="">';
    var initials = String(p.full_name || 'D').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    return '<span class="' + cls + ' spv2-avatar-fallback">' + esc(initials) + '</span>';
  }
  var LANGS = { english: ['English', 'английский'], german: ['German', 'немецкий'], deutsch: ['German', 'немецкий'], spanish: ['Spanish', 'испанский'], espanol: ['Spanish', 'испанский'], french: ['French', 'французский'], italian: ['Italian', 'итальянский'], italiano: ['Italian', 'итальянский'], russian: ['Russian', 'русский'], ukrainian: ['Ukrainian', 'украинский'], turkish: ['Turkish', 'турецкий'], farsi: ['Farsi', 'фарси'], arabic: ['Arabic', 'арабский'], portuguese: ['Portuguese', 'португальский'], polish: ['Polish', 'польский'], chinese: ['Chinese', 'китайский'], japanese: ['Japanese', 'японский'], korean: ['Korean', 'корейский'] };
  function subject() {
    var list = (state.teacher && state.teacher.teaches_languages) || [];
    var names = list.map(function (c) { var n = LANGS[String(c).toLowerCase()]; return n ? n[isRu ? 1 : 0] : c; }).slice(0, 3);
    return names.length ? (isRu ? 'Преподаёт: ' : 'Teaches ') + names.join(', ') : t('Teacher', 'Преподаватель');
  }
  var benefits = function () {
    var who = (state.teacher && state.teacher.full_name) || t('the teacher', 'преподавателя');
    return [
      { icon: icon.media, title: t('Super Media', 'Super-медиа'), short: t('Super media', 'Super-медиа'), body: t('Protected videos and photos the teacher publishes for subscribers.', 'Защищённые видео и фото, которые преподаватель публикует для подписчиков.') },
      { icon: icon.spark, title: t('Teacher Practices', 'Практики преподавателя'), short: t('Practices', 'Практики'), body: t('Practices the teacher opens to Super+ subscribers.', 'Практики, которые преподаватель открывает подписчикам Super+.') },
      { icon: icon.mic, title: t('Subscriber Voice Rooms', 'Голосовые комнаты'), short: t('Voice rooms', 'Голосовые комнаты'), body: t('Join the teacher’s voice rooms for subscribers.', 'Вход в голосовые комнаты преподавателя для подписчиков.') },
      { icon: icon.heart, title: t('Support the Teacher', 'Поддержка преподавателя'), short: t('Support', 'Поддержка'), body: t('Your subscription goes directly to ', 'Ваша подписка напрямую поддерживает ') + who + '.' },
    ];
  };

  function render() {
    if (!state.loaded) { root.innerHTML = '<div class="spv2-state">' + esc(t('Loading…', 'Загрузка…')) + '</div>'; return; }
    var p = state.teacher;
    var header = '<header class="spv2-topbar"><a class="spv2-round-back" href="' + backHref() + '" aria-label="' + esc(t('Back', 'Назад')) + '">' + icon.back + '</a><h1>Super+</h1><span class="spv2-header-spacer"></span></header>';
    if (!p) { root.innerHTML = header + '<div class="spv2-state">' + esc(t('Teacher not found.', 'Преподаватель не найден.')) + '</div>'; return; }

    var end = state.sub && state.sub.current_period_end ? new Date(state.sub.current_period_end) : null;
    var periodValid = Boolean(end && end.getTime() > Date.now());
    var member = Boolean(state.sub && periodValid && (state.sub.status === 'active' || state.sub.status === 'canceled'));
    var renews = Boolean(state.sub && state.sub.status === 'active');
    var own = state.user && state.user.id === teacherId;
    var offered = state.price !== null && state.price > 0;
    var shortage = offered && typeof state.balance === 'number' ? Math.max(0, state.price - state.balance) : null;
    var endLabel = fmtDate(end);
    var name = esc(p.full_name || t('Teacher', 'Преподаватель'));
    var verified = p.is_verified ? ' <span aria-label="' + esc(t('Verified', 'Проверен')) + '">✓</span>' : '';
    var list = benefits();
    var html = header + '<main class="spv2-main">';

    if (member) {
      var price = (state.sub && state.sub.price_dv) || state.price;
      html +=
        '<section class="spv2-hero spv2-hero-active"><div class="spv2-active-top">' + avatar(true) +
          '<div class="spv2-teacher-copy"><div class="spv2-teacher-name">' + name + verified + '</div><span>' + esc(subject()) + '</span></div>' +
          '<span class="spv2-crown-seal">' + icon.crown + '<small>SUPER+</small></span></div>' +
          '<p class="spv2-active-status">' + icon.ok + esc(t('You are a Super+ subscriber', 'Вы подписчик Super+')) + '</p>' +
          '<p class="spv2-valid-until">' + icon.cal + esc(t('Valid until: ', 'Действует до: ') + endLabel) + '</p></section>' +
        '<section class="spv2-access-tiles">' + list.map(function (b) { return '<div class="spv2-access-tile">' + b.icon + '<span>' + esc(b.short) + '</span></div>'; }).join('') + '</section>' +
        '<section class="spv2-surface spv2-subscription-panel"><h2><span class="spv2-heading-crown">' + icon.crown + '</span>' + esc(t('Subscription', 'Подписка')) + '</h2>' +
          row(t('Plan', 'Тариф'), t('Super+ (Teacher)', 'Super+ (преподаватель)')) +
          row(t('Price', 'Цена'), price ? price + ' DV / ' + PERIOD_DAYS + t(' days', ' дней') : '—') +
          row(t('Next renewal', 'Следующее продление'), renews ? endLabel : t('Cancelled', 'Отменено')) +
          '<div class="spv2-detail-row"><span>' + esc(t('Auto-renewal', 'Автопродление')) + '</span><button type="button" class="spv2-switch' + (renews ? ' on' : '') + '" role="switch" aria-checked="' + renews + '" aria-label="' + esc(t('Auto-renewal', 'Автопродление')) + '" data-sp="' + (renews ? 'cancel' : 'resume') + '"' + (state.busy ? ' disabled' : '') + '><span></span></button></div>' +
        '</section>' +
        '<section class="spv2-manage-panel"><span>' + icon.info + '</span><div><strong>' + esc(t('Manage Subscription', 'Управление подпиской')) + '</strong><span>' +
          esc(renews
            ? t('Renews every 30 days from your DV balance. You can cancel anytime; your access stays active until ', 'Продлевается каждые 30 дней с баланса DV. Отменить можно в любой момент — доступ сохранится до ') + endLabel + '.'
            : t('Auto-renewal is cancelled. Access continues until ', 'Автопродление отменено. Доступ сохранится до ') + endLabel + '.') +
        '</span></div></section>' +
        (renews
          ? '<button type="button" class="spv2-cancel-outline" data-sp="cancel"' + (state.busy ? ' disabled' : '') + '>' + esc(t('Cancel Subscription', 'Отменить подписку')) + '</button>'
          : '<button type="button" class="spv2-resume" data-sp="resume"' + (state.busy ? ' disabled' : '') + '>' + esc(t('Turn auto-renewal back on', 'Включить автопродление')) + '</button>');
    } else {
      html +=
        '<section class="spv2-hero spv2-hero-offer"><div class="spv2-hero-glow"></div>' +
          '<span class="spv2-super-tag">' + icon.crown + ' SUPER+</span>' +
          '<div class="spv2-offer-teacher">' + avatar(true) + '<div class="spv2-teacher-copy"><div class="spv2-teacher-name">' + name + verified + '</div><span>' + esc(subject()) + '</span>' +
          '<a class="spv2-view-profile" href="' + backHref() + '">' + esc(t('View profile ›', 'Открыть профиль ›')) + '</a></div></div>' +
          '<div class="spv2-hero-price">' + (offered ? '<strong>' + state.price + '</strong><span>DV / ' + PERIOD_DAYS + t(' days', ' дней') + '</span>' : '<span>' + esc(t('This teacher does not offer Super+ yet.', 'Этот преподаватель пока не предлагает Super+.')) + '</span>') + '</div>' +
          '<p class="spv2-hero-caption">' + esc(t('Exclusive content, practice and more', 'Эксклюзивный контент, практика и не только')) + '</p>' +
        '</section>' +
        '<section class="spv2-surface"><h2><span class="spv2-heading-crown">' + icon.crown + '</span>' + esc(t('What you get with Super+', 'Что даёт Super+')) + '</h2>' +
          list.map(function (b) { return '<div class="spv2-benefit-row"><span class="spv2-benefit-icon">' + b.icon + '</span><span class="spv2-benefit-copy"><strong>' + esc(b.title) + '</strong><small>' + esc(b.body) + '</small></span><span></span></div>'; }).join('') +
        '</section>' +
        (state.user && offered
          ? '<section class="spv2-wallet-panel"><div class="spv2-wallet-label">' + icon.wallet + '<strong>' + esc(t('Your balance: ', 'Ваш баланс: ') + (typeof state.balance === 'number' ? state.balance + ' DV' : '—')) + '</strong></div><button type="button" data-sp="topup">' + esc(t('Top up', 'Пополнить')) + '</button></section>'
          : '') +
        '<section class="spv2-surface spv2-terms-panel"><h2>' + icon.info + esc(t('How it works', 'Как это работает')) + '</h2>' +
          term(offered ? t('Paid with DV coins (' + state.price + ' DV per 30 days). The first period starts once payment is confirmed.', 'Оплата DV-монетами (' + state.price + ' DV за 30 дней). Первый период начинается после подтверждения оплаты.') : t('Paid with DV coins. The first period starts once payment is confirmed.', 'Оплата DV-монетами. Первый период начинается после подтверждения оплаты.')) +
          term(t('Renews automatically when enough DV coins are on your balance; otherwise it ends.', 'Продлевается автоматически, если на балансе хватает DV; иначе заканчивается.')) +
          term(t('Cancel anytime. Access stays until the paid period ends.', 'Отменить можно в любой момент. Доступ сохранится до конца оплаченного периода.')) +
        '</section>';
    }
    if (state.error) html += '<p class="spv2-error" role="alert">' + esc(state.error) + '</p>';
    html += '</main>';

    if (!member && !own) {
      var label, action = 'subscribe', disabled = Boolean(state.busy);
      if (!offered) { label = t('Super+ is not offered yet', 'Super+ пока не предлагается'); disabled = true; }
      else if (!state.user) { label = t('Sign in to subscribe', 'Войдите, чтобы оформить'); action = 'login'; }
      else if (state.balance === null) { label = t('Balance unavailable', 'Баланс недоступен'); disabled = true; }
      else if (shortage > 0) { label = t('Top up ' + shortage + ' DV to subscribe', 'Пополните ' + shortage + ' DV для подписки'); action = 'topup'; }
      else label = t('Subscribe to Super+ (' + state.price + ' DV)', 'Оформить Super+ (' + state.price + ' DV)');
      html += '<div class="spv2-sticky-cta"><button class="spv2-primary-cta" type="button" data-sp="' + action + '"' + (disabled ? ' disabled' : '') + '>' + icon.crown + esc(state.busy === 'subscribe' ? t('Processing…', 'Оформляем…') : label) + '</button></div>';
    }

    if (state.confirm) {
      var c = state.confirm;
      var title = c === 'cancel' ? t('Cancel Super+ renewal?', 'Отменить продление Super+?') : c === 'resume' ? t('Turn auto-renewal back on?', 'Включить автопродление?') : t('Subscribe to Super+?', 'Оформить Super+?');
      var body = c === 'cancel'
        ? t('You keep access through ' + endLabel + '. The subscription will not renew afterwards.', 'Доступ сохранится до ' + endLabel + '. После этого подписка не продлится.')
        : c === 'resume'
          ? t('Nothing is charged now. On ' + endLabel + ' the next 30 days are paid from your DV balance.', 'Сейчас ничего не спишется. ' + endLabel + ' следующие 30 дней оплатятся с баланса DV.')
          : t(state.price + ' DV will be taken now, then every 30 days. Cancel anytime.', 'Сейчас спишется ' + state.price + ' DV, затем каждые 30 дней. Отменить можно в любой момент.');
      var yes = c === 'cancel' ? t('Confirm cancellation', 'Отменить продление') : c === 'resume' ? t('Turn on', 'Включить') : t('Subscribe', 'Оформить');
      var no = c === 'cancel' ? t('Keep subscription', 'Оставить') : t('Not now', 'Не сейчас');
      html += '<div class="spv2-modal-backdrop" role="presentation"><div class="spv2-modal" role="dialog" aria-modal="true" aria-labelledby="spv2-dialog-title">' +
        '<button type="button" class="spv2-close" aria-label="' + esc(t('Close', 'Закрыть')) + '" data-sp="close">' + icon.close + '</button>' +
        '<span class="spv2-modal-symbol">' + icon.shield + '</span><h2 id="spv2-dialog-title">' + esc(title) + '</h2><p>' + esc(body) + '</p>' +
        '<div class="spv2-modal-buttons"><button type="button" data-sp="close">' + esc(no) + '</button><button type="button" data-sp="do-' + c + '"' + (state.busy ? ' disabled' : '') + '>' + esc(yes) + '</button></div></div></div>';
    }
    root.innerHTML = html;
  }

  function row(label, value) { return '<div class="spv2-detail-row"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>'; }
  function term(text) { return '<div class="spv2-term-line">' + icon.check + '<span>' + esc(text) + '</span></div>'; }

  function describe(message) {
    var m = String(message || '');
    if (/not enough dv/i.test(m)) return t('Not enough DV coins. Top up and try again.', 'Недостаточно DV. Пополните баланс и попробуйте снова.');
    if (/already subscribed/i.test(m)) return t('You already have Super+ with this teacher.', 'У вас уже есть Super+ у этого преподавателя.');
    if (/not offering/i.test(m)) return t('This teacher does not offer Super+ right now.', 'Этот преподаватель сейчас не предлагает Super+.');
    if (/nothing to resume/i.test(m)) return t('This subscription has already ended. Subscribe again to continue.', 'Эта подписка уже закончилась. Оформите её снова.');
    if (/no active subscription/i.test(m)) return t('There is no active subscription to cancel.', 'Нет активной подписки для отмены.');
    return m || t('Something went wrong. Please try again.', 'Что-то пошло не так. Попробуйте ещё раз.');
  }

  function refresh() {
    var jobs = [supa.rpc('teacher_super_price', { p_teacher: teacherId })];
    if (state.user) jobs.push(supa.rpc('my_teacher_subscriptions'), supa.rpc('get_my_coin_balance'));
    return Promise.all(jobs).then(function (res) {
      var price = Number(res[0] && res[0].data);
      state.price = res[0] && !res[0].error && price > 0 ? price : null;
      if (state.user) {
        state.sub = ((res[1] && res[1].data) || []).find(function (s) { return s.teacher_id === teacherId; }) || null;
        state.balance = res[2] && !res[2].error && typeof res[2].data === 'number' ? Math.max(0, Math.floor(res[2].data)) : null;
      }
    });
  }

  function act(kind) {
    var rpc = kind === 'subscribe' ? 'subscribe_to_teacher' : kind === 'cancel' ? 'cancel_teacher_subscription' : 'resume_teacher_subscription';
    state.busy = kind; state.error = ''; state.confirm = null; render();
    supa.rpc(rpc, { p_teacher_id: teacherId }).then(function (r) {
      if (r.error) state.error = describe(r.error.message);
      return refresh();
    }).then(function () { state.busy = null; render(); }, function () { state.busy = null; state.error = describe(''); render(); });
  }

  root.addEventListener('click', function (event) {
    var el = event.target.closest('[data-sp]');
    if (!el || el.disabled) return;
    var a = el.dataset.sp;
    if (a === 'login') { location.href = loginHref(); return; }
    if (a === 'topup') { location.href = './app.html#wallet'; return; }
    if (a === 'close') { state.confirm = null; render(); return; }
    if (a === 'subscribe' || a === 'cancel' || a === 'resume') { state.confirm = a; render(); return; }
    if (a.indexOf('do-') === 0) act(a.slice(3));
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.confirm) { state.confirm = null; render(); } });

  if (!/^[0-9a-f-]{36}$/i.test(teacherId)) { state.loaded = true; render(); return; }
  render();
  Promise.all([
    supa.auth.getSession(),
    window.DuvelaWebConfig.publicProfiles(supa, 'id,full_name,avatar_url,is_verified,teaches_languages').eq('id', teacherId).maybeSingle(),
  ]).then(function (res) {
    state.user = res[0] && res[0].data && res[0].data.session ? res[0].data.session.user : null;
    state.teacher = res[1] && res[1].data ? res[1].data : null;
    if (state.teacher) document.title = (state.teacher.full_name || 'Duvela') + ' — Super+';
    return state.teacher ? refresh() : null;
  }).then(function () { state.loaded = true; render(); }, function () { state.loaded = true; render(); });
})();
