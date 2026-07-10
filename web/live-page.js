(function () {
  var AGORA_APP_ID = '7dbbced847dc459ba72f7ee6e2426c11';
  var LIVE_FIELDS = 'id,channel_name,teacher_id,teacher_name,teacher_avatar_url,language,level,topic,price_per_minute,status,started_at,ended_at,created_at,heartbeat_at,is_private';
  var config = window.DuvelaWebConfig;
  var LANG_KEY = config.storageKeys.lang;

  var params = new URLSearchParams(window.location.search);
  var appLang = (localStorage.getItem(LANG_KEY) || navigator.language || 'en').toLowerCase();
  var isRu = appLang.indexOf('ru') === 0;
  var tr = function (en, ru) { return isRu ? ru : en; };
  var sessionId = params.get('s') || '';
  var teacher = params.get('t') || '';
  var isHostMode = params.get('mode') === 'host';
  var isBusiness = params.get('app') === 'business' || isHostMode;
  var supa = window.supabase ? config.createSupabaseClient() : null;
  var client = null;
  var localAudioTrack = null;
  var localVideoTrack = null;
  var currentSession = null;
  var heartbeatTimer = null;
  var sessionPollTimer = null;
  var elapsedTimer = null;
  var currentUser = null;
  var micEnabled = true;
  var camEnabled = true;
  var hostScheduledSessions = [];
  var hostHistorySessions = [];
  var viewerJoined = false;
  var viewerAgoraUid = null;
  var viewerRealtimeChannel = null;
  var viewerMessages = [];
  var viewerBalance = null;
  var selectedGiftId = 'heart';
  var viewerSendingGift = false;
  var viewerSendingMessage = false;
  var giftOptions = [
    { id: 'rose', emoji: 'СЂСџРЉв„–', name: 'Rose', cost: 0 },
    { id: 'heart', emoji: 'РІСњВ¤РїС‘РЏ', name: 'Heart', cost: 0 },
    { id: 'coffee', emoji: 'РІВвЂў', name: 'Coffee', cost: 0 },
    { id: 'book', emoji: 'СЂСџвЂњвЂ“', name: 'Book', cost: 0 },
    { id: 'fire-gift', emoji: 'СЂСџвЂќТђ', name: 'Fire gift', cost: 10 },
    { id: 'crown', emoji: 'СЂСџвЂвЂ', name: 'Crown', cost: 12 },
    { id: 'magic-box', emoji: 'СЂСџР‹Рѓ', name: 'Magic Box', cost: 15 },
    { id: 'watch', emoji: 'РІРЉС™', name: 'Watch', cost: 16 },
    { id: 'diamond', emoji: 'СЂСџвЂ™Р‹', name: 'Diamond', cost: 18 },
    { id: 'duvela-star', emoji: 'СЂСџРЉСџ', name: 'DUVELA Star', cost: 20 }
  ];

  var el = function (id) { return document.getElementById(id); };

  function esc(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }
  function setStatus(text, state) {
    var node = el('statusText');
    node.textContent = text;
    node.classList.toggle('live', state === 'live');
    node.classList.toggle('ready', state === 'ready');
  }
  function setStage(html, msg) {
    el('stageMsg').innerHTML = html + (msg ? '<div style="margin-top:8px">' + esc(msg) + '</div>' : '');
  }
  function setNote(text) {
    el('note').textContent = text || '';
  }
  function showOverlay(show) {
    el('overlay').style.display = show ? 'flex' : 'none';
  }
  function viewerDisplayName() {
    return currentUser?.user_metadata?.full_name
      || currentUser?.email?.split('@')[0]
      || tr('Student', 'Р Р€РЎвЂЎР ВµР Р…Р С‘Р С”');
  }
  function formatChatTime(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleTimeString(isRu ? 'ru-RU' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  }
  function giftCostLabel(cost) {
    return cost > 0 ? cost + ' coin' : tr('Free', 'Р вЂР ВµРЎРѓР С—Р В»Р В°РЎвЂљР Р…Р С•');
  }
  function upsertViewerMessage(message) {
    if (!message?.id) return;
    var existingIndex = viewerMessages.findIndex(function (item) { return item.id === message.id; });
    if (existingIndex >= 0) viewerMessages.splice(existingIndex, 1, message);
    else viewerMessages.push(message);
    viewerMessages.sort(function (a, b) {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  }
  function renderViewerBalance() {
    if (!el('viewerBalance')) return;
    var text;
    if (!currentUser) {
      text = tr('Duvela balance: ', 'Р вЂР В°Р В»Р В°Р Р…РЎРѓ Duvela: ') + 'РІР‚вЂќ';
    } else if (viewerBalance == null) {
      text = tr('Duvela balance: sign in with a learner account for gifts', 'Р вЂР В°Р В»Р В°Р Р…РЎРѓ Duvela: Р Р†Р С•Р в„–Р Т‘Р С‘РЎвЂљР Вµ Р С”Р В°Р С” РЎС“РЎвЂЎР ВµР Р…Р С‘Р С” Р Т‘Р В»РЎРЏ Р С—Р С•Р Т‘Р В°РЎР‚Р С”Р С•Р Р†');
    } else {
      text = tr('Duvela balance: ', 'Р вЂР В°Р В»Р В°Р Р…РЎРѓ Duvela: ') + viewerBalance;
    }
    el('viewerBalance').innerHTML = text.replace(/(\d+|РІР‚вЂќ)$/, '<b>$1</b>');
  }
  function renderGiftGrid() {
    if (!el('giftGrid')) return;
    el('giftGrid').innerHTML = giftOptions.map(function (gift) {
      return '<button type="button" class="gift-tile' + (gift.id === selectedGiftId ? ' active' : '') + '" data-gift-id="' + esc(gift.id) + '">' +
        '<span class="gift-emoji">' + esc(gift.emoji) + '</span>' +
        '<span class="gift-name">' + esc(gift.name) + '</span>' +
        '<span class="gift-cost">' + esc(giftCostLabel(gift.cost)) + '</span>' +
      '</button>';
    }).join('');
    Array.from(document.querySelectorAll('[data-gift-id]')).forEach(function (node) {
      node.addEventListener('click', function () {
        selectedGiftId = node.getAttribute('data-gift-id') || selectedGiftId;
        renderGiftGrid();
      });
    });
  }
  function renderViewerMessages() {
    if (!el('chatList')) return;
    if (!viewerMessages.length) {
      el('chatList').innerHTML = '<div class="chat-empty">' + esc(tr('No live messages yet. Start the conversation.', 'Р РЋР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р в„– Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ Р С—Р С•Р С”Р В° Р Р…Р ВµРЎвЂљ. Р СњР В°РЎвЂЎР Р…Р С‘РЎвЂљР Вµ РЎР‚Р В°Р В·Р С–Р С•Р Р†Р С•РЎР‚.')) + '</div>';
      return;
    }
    el('chatList').innerHTML = viewerMessages.map(function (message) {
      var isOwn = currentUser?.id && message.sender_id === currentUser.id;
      var classes = 'chat-message';
      if (message.role === 'system') classes += ' system';
      else if (isOwn) classes += ' own';
      return '<div class="' + classes + '">' +
        '<div class="chat-meta">' +
          '<span>' + esc(message.sender_name || tr('Live chat', 'Р В§Р В°РЎвЂљ РЎРЊРЎвЂћР С‘РЎР‚Р В°')) + '</span>' +
          '<span>' + esc(formatChatTime(message.created_at)) + '</span>' +
        '</div>' +
        '<div class="chat-body">' + esc(message.message || '') + '</div>' +
      '</div>';
    }).join('');
    el('chatList').scrollTop = el('chatList').scrollHeight;
  }
  function setViewerControlsEnabled(enabled) {
    ['openChat', 'openGift', 'chatInput', 'sendChat', 'sendGift'].forEach(function (id) {
      var node = el(id);
      if (node) node.disabled = !enabled;
    });
  }
  function openChatPanel() {
    if (!el('chatShell')) return;
    el('chatShell').style.display = 'grid';
    setTimeout(function () { el('chatInput')?.focus(); }, 30);
  }
  function closeGiftModal() {
    if (!el('giftModal')) return;
    el('giftModal').classList.remove('open');
    el('giftModal').setAttribute('aria-hidden', 'true');
  }
  function openGiftModal() {
    if (!el('giftModal')) return;
    renderGiftGrid();
    el('giftModal').classList.add('open');
    el('giftModal').setAttribute('aria-hidden', 'false');
  }
  async function loadViewerBalance() {
    if (!currentUser?.id || !supa) {
      viewerBalance = null;
      renderViewerBalance();
      return;
    }
    var result = await supa.from('profiles').select('duvela_coin_balance').eq('id', currentUser.id).maybeSingle();
    viewerBalance = typeof result.data?.duvela_coin_balance === 'number' ? result.data.duvela_coin_balance : null;
    renderViewerBalance();
  }
  function createAgoraUid(value) {
    var hash = 0;
    for (var i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return (hash % 2147483646) + 1;
  }
  function createChannelName(userId) {
    return ('duvela-web-' + userId.replace(/-/g, '').slice(0, 12) + '-' + Date.now().toString(36)).slice(0, 64);
  }
  function displayName(user) {
    return user.user_metadata?.full_name || user.email?.split('@')[0] || tr('Duvela teacher', 'Р СџРЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Duvela');
  }
  function teacherWatchTitle(name) {
    return (name || tr('A teacher', 'Р СџРЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ')) + tr(' is live on Duvela', ' Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ Р Р…Р В° Duvela');
  }
  function formatDateLabel(value) {
    if (!value) return '';
    return new Date(value).toLocaleDateString(isRu ? 'ru-RU' : 'en-GB', {
      day: '2-digit',
      month: 'short'
    });
  }
  function formatTimeLabel(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString(isRu ? 'ru-RU' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  function formatSessionMoment(value) {
    if (!value) return '';
    return [formatDateLabel(value), formatTimeLabel(value)].filter(Boolean).join(' РІР‚Сћ ');
  }
  function nextHourMoment() {
    var value = new Date();
    value.setMinutes(0, 0, 0);
    value.setHours(value.getHours() + 1);
    return value;
  }
  function applyDefaultScheduleInputs() {
    if (!el('scheduleDateInput') || !el('scheduleTimeInput')) return;
    var value = nextHourMoment();
    el('scheduleDateInput').value = value.toISOString().slice(0, 10);
    el('scheduleTimeInput').value = String(value.getHours()).padStart(2, '0') + ':' + String(value.getMinutes()).padStart(2, '0');
  }
  function buildScheduleIso() {
    var date = el('scheduleDateInput')?.value;
    var time = el('scheduleTimeInput')?.value;
    if (!date || !time) return '';
    return new Date(date + 'T' + time + ':00').toISOString();
  }
  function formatElapsed(value) {
    var started = new Date(value || Date.now()).getTime();
    var diff = Math.max(0, Date.now() - started);
    var totalSeconds = Math.floor(diff / 1000);
    var minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    var seconds = String(totalSeconds % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  }
  function formatRoomId(value) {
    if (!value) return '----';
    return String(value).slice(0, 8).toUpperCase();
  }
  function updateStageStripRuntime(session) {
    if (!el('stripRuntime')) return;
    var timer = session?.status === 'live'
      ? formatElapsed(session?.started_at || Date.now())
      : '00:00';
    var roomLabel = tr('Room', 'Room');
    el('stripRuntime').textContent = timer + ' | ' + roomLabel + ' ' + formatRoomId(session?.id);
  }
  function startElapsedClock(value) {
    clearInterval(elapsedTimer);
    el('elapsedText').textContent = formatElapsed(value);
    if (currentSession?.status === 'live') {
      updateStageStripRuntime(currentSession);
    }
    elapsedTimer = setInterval(function () {
      el('elapsedText').textContent = formatElapsed(value);
      if (currentSession?.status === 'live') {
        updateStageStripRuntime(currentSession);
      }
    }, 1000);
  }
  function stopElapsedClock() {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
    el('elapsedText').textContent = '00:00';
    updateStageStripRuntime(currentSession);
  }
  function accessLabel(session) {
    return session?.is_private ? tr('Private', 'Р СџРЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…РЎвЂ№Р в„–') : tr('Public', 'Р СџРЎС“Р В±Р В»Р С‘РЎвЂЎР Р…РЎвЂ№Р в„–');
  }
  function sessionStatusLabel(session) {
    if (session?.status === 'live') return tr('Live', 'Р вЂ™ РЎРЊРЎвЂћР С‘РЎР‚Р Вµ');
    if (session?.status === 'scheduled') return tr('Scheduled', 'Р вЂ”Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С•');
    if (session?.status === 'ended') return tr('Ended', 'Р вЂ”Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…');
    if (isHostMode) return tr('Ready', 'Р вЂњР С•РЎвЂљР С•Р Р†Р С•');
    return sessionId ? tr('Waiting', 'Р С›Р В¶Р С‘Р Т‘Р В°Р Р…Р С‘Р Вµ') : tr('No session', 'Р СњР ВµРЎвЂљ РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘');
  }
  function buildShareUrl(session) {
    if (!session?.id) return '';
    var url = new URL('./live.html', window.location.href);
    url.searchParams.set('s', session.id);
    if (session.teacher_name) url.searchParams.set('t', session.teacher_name);
    return url.href;
  }
  function buildHostUrl(session) {
    var url = new URL('./live.html', window.location.href);
    url.searchParams.set('app', 'business');
    url.searchParams.set('mode', 'host');
    if (session?.id) url.searchParams.set('s', session.id);
    if (session?.teacher_name) url.searchParams.set('t', session.teacher_name);
    return url.href;
  }
  function studioMetric(label, value) {
    return '<div class="studio-metric"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }
  function studioCheck(title, copy) {
    return '<div class="studio-check"><b>' + esc(title) + '</b><span>' + esc(copy) + '</span></div>';
  }
  function setHostSetupDisabled(disabled) {
    ['topicInput', 'levelInput', 'languageInput', 'privateInput', 'scheduleDateInput', 'scheduleTimeInput', 'scheduleSession'].forEach(function (id) {
      var node = el(id);
      if (node) node.disabled = disabled;
    });
  }
  function applySessionToInputs(session) {
    if (!isHostMode || !session) return;
    if (session.topic) el('topicInput').value = session.topic;
    el('levelInput').value = session.level || '';
    el('languageInput').value = session.language || '';
    el('privateInput').checked = !!session.is_private;
    if (session.started_at && el('scheduleDateInput') && el('scheduleTimeInput')) {
      el('scheduleDateInput').value = session.started_at.slice(0, 10);
      el('scheduleTimeInput').value = session.started_at.slice(11, 16);
    }
  }
  function renderFacts(session) {
    var timing = session?.status === 'ended'
      ? formatSessionMoment(session?.ended_at || session?.started_at)
      : formatSessionMoment(session?.started_at);
    var facts = [
      { label: tr('Teacher', 'Р СџРЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ'), value: session?.teacher_name || teacher || tr('Waiting', 'Р С›Р В¶Р С‘Р Т‘Р В°Р Р…Р С‘Р Вµ') },
      { label: tr('Title', 'Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ'), value: session?.topic || el('topicInput')?.value || tr('Live lesson', 'Live-РЎС“РЎР‚Р С•Р С”') },
      { label: tr('Level', 'Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ'), value: session?.level || el('levelInput')?.value || tr('Open', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎвЂ№Р в„–') },
      { label: tr('Language', 'Р Р‡Р В·РЎвЂ№Р С”'), value: session?.language || el('languageInput')?.value || tr('General', 'Р С›Р В±РЎвЂ°Р С‘Р в„–') },
      { label: tr('Timing', 'Р вЂ™РЎР‚Р ВµР СРЎРЏ'), value: timing || tr('Not scheduled', 'Р СњР Вµ Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С•') },
      { label: tr('Access', 'Р вЂќР С•РЎРѓРЎвЂљРЎС“Р С—'), value: accessLabel(session) },
      { label: tr('Status', 'Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ'), value: sessionStatusLabel(session) }
    ];
    el('sessionFacts').innerHTML = facts.map(function (fact) {
      return '<div class="fact"><span>' + esc(fact.label) + '</span><b>' + esc(fact.value) + '</b></div>';
    }).join('');
  }
  function renderStudioMetrics(session) {
    var metrics;
    if (isHostMode) {
      metrics = [
        { label: tr('Mode', 'Р В Р ВµР В¶Р С‘Р С'), value: tr('Teacher host', 'Teacher host') },
        { label: tr('Room', 'Р С™Р С•Р СР Р…Р В°РЎвЂљР В°'), value: sessionStatusLabel(session) },
        { label: tr('Upcoming', 'Р вЂР В»Р С‘Р В¶Р В°Р в„–РЎв‚¬Р С‘Р Вµ'), value: String(hostScheduledSessions.length) },
        { label: tr('Distribution', 'Р В Р В°Р В·Р Т‘Р В°РЎвЂЎР В°'), value: session?.id ? (session?.is_private ? tr('App access', 'Р В§Р ВµРЎР‚Р ВµР В· Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ') : tr('Watch link ready', 'Р РЋРЎРѓРЎвЂ№Р В»Р С”Р В° Р С–Р С•РЎвЂљР С•Р Р†Р В°')) : tr('After room save', 'Р СџР С•РЎРѓР В»Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№') }
      ];
    } else {
      metrics = [
        { label: tr('Mode', 'Р В Р ВµР В¶Р С‘Р С'), value: tr('Browser viewer', 'Р СџРЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚ Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ') },
        { label: tr('Room', 'Р С™Р С•Р СР Р…Р В°РЎвЂљР В°'), value: sessionStatusLabel(session) },
        { label: tr('Access', 'Р вЂќР С•РЎРѓРЎвЂљРЎС“Р С—'), value: accessLabel(session) },
        { label: tr('Entry', 'Р вЂ™РЎвЂ¦Р С•Р Т‘'), value: sessionId ? tr('Session opened', 'Р РЋР ВµРЎРѓРЎРѓР С‘РЎРЏ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В°') : tr('Choose a session', 'Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ РЎРѓР ВµРЎРѓРЎРѓР С‘РЎР‹') }
      ];
    }
    el('studioMetrics').innerHTML = metrics.map(function (item) {
      return studioMetric(item.label, item.value);
    }).join('');
  }
  function renderStageStrip(session) {
    if (!el('stageLiveStrip')) return;
    var shouldShow = Boolean(isHostMode && session?.status === 'live');
    el('stageLiveStrip').classList.toggle('visible', shouldShow);
    if (!shouldShow) return;
    el('stripTeacher').textContent = session?.teacher_name || currentUser?.user_metadata?.full_name || tr('Teacher', 'Teacher');
    el('stripTopic').textContent = session?.topic || tr('Live lesson', 'Live lesson');
    el('stripStatus').textContent = tr('LIVE', 'LIVE');
    el('stripLevel').textContent = session?.level || tr('Open', 'Open');
    el('stripLanguage').textContent = session?.language || tr('General', 'General');
    el('stripAccess').textContent = accessLabel(session);
    updateStageStripRuntime(session);
  }
  function renderStudioChecklist(session) {
    var items;
    if (isHostMode) {
      if (session?.status === 'live') {
        items = [
          {
            title: tr('Share the room', 'Р СџР С•Р Т‘Р ВµР В»Р С‘РЎвЂљР ВµРЎРѓРЎРЉ Р С”Р С•Р СР Р…Р В°РЎвЂљР С•Р в„–'),
            copy: session?.is_private
              ? tr('Private rooms should be handed off through the app or your approved access flow.', 'Р СџРЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…РЎвЂ№Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р В»РЎС“РЎвЂЎРЎв‚¬Р Вµ Р С•РЎвЂљР С”РЎР‚РЎвЂ№Р Р†Р В°РЎвЂљРЎРЉ РЎвЂЎР ВµРЎР‚Р ВµР В· Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С‘Р В»Р С‘ Р Р†Р В°РЎв‚¬ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р Р…РЎвЂ№Р в„– РЎРѓРЎвЂ Р ВµР Р…Р В°РЎР‚Р С‘Р в„– Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°.')
              : tr('Send the browser watch link to learners while the stream is live.', 'Р СџР С•Р С”Р В° РЎРЊРЎвЂћР С‘РЎР‚ Р С‘Р Т‘Р ВµРЎвЂљ, Р С•РЎвЂљР С—РЎР‚Р В°Р Р†РЎРЉРЎвЂљР Вµ РЎС“РЎвЂЎР ВµР Р…Р С‘Р С”Р В°Р С РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В° Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ.')
          },
          {
            title: tr('Keep this tab open', 'Р СњР Вµ Р В·Р В°Р С”РЎР‚РЎвЂ№Р Р†Р В°Р в„–РЎвЂљР Вµ Р Р†Р С”Р В»Р В°Р Т‘Р С”РЎС“'),
            copy: tr('Camera, microphone and room heartbeat stay active while this page remains open.', 'Р С™Р В°Р СР ВµРЎР‚Р В°, Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р… Р С‘ heartbeat Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ РЎР‚Р В°Р В±Р С•РЎвЂљР В°РЎР‹РЎвЂљ, Р С—Р С•Р С”Р В° РЎРЊРЎвЂљР В° РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В°.')
          },
          {
            title: tr('Use stage controls', 'Р Р€Р С—РЎР‚Р В°Р Р†Р В»РЎРЏР в„–РЎвЂљР Вµ РЎРЊРЎвЂћР С‘РЎР‚Р С•Р С РЎРѓР С• РЎРѓРЎвЂ Р ВµР Р…РЎвЂ№'),
            copy: tr('Mute microphone, stop camera or end the room from the footer controls under the video stage.', 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР В°Р в„–РЎвЂљР Вµ Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…, Р С”Р В°Р СР ВµРЎР‚РЎС“ Р С‘Р В»Р С‘ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р В°Р в„–РЎвЂљР Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р С”Р Р…Р С•Р С—Р С”Р В°Р СР С‘ Р С—Р С•Р Т‘ Р Р†Р С‘Р Т‘Р ВµР С•РЎРѓРЎвЂ Р ВµР Р…Р С•Р в„–.')
          }
        ];
      } else if (session?.status === 'scheduled') {
        items = [
          {
            title: tr('Keep the slot clear', 'Р вЂќР ВµРЎР‚Р В¶Р С‘РЎвЂљР Вµ РЎРѓР В»Р С•РЎвЂљ РЎРѓР Р†Р С•Р В±Р С•Р Т‘Р Р…РЎвЂ№Р С'),
            copy: tr('Open the same room shortly before the lesson and launch LIVE from this browser.', 'Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р Р…Р ВµР В·Р В°Р Т‘Р С•Р В»Р С–Р С• Р Т‘Р С• РЎС“РЎР‚Р С•Р С”Р В° Р С‘ Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљР Вµ LIVE Р С‘Р В· РЎРЊРЎвЂљР С•Р С–Р С• Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°.')
          },
          {
            title: tr('Review access mode', 'Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ РЎР‚Р ВµР В¶Р С‘Р С Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°'),
            copy: session?.is_private
              ? tr('Private sessions should continue through the app or your approved access path.', 'Р СџРЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…РЎвЂ№Р Вµ РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘ Р В»РЎС“РЎвЂЎРЎв‚¬Р Вµ Р Р†Р ВµРЎРѓРЎвЂљР С‘ РЎвЂЎР ВµРЎР‚Р ВµР В· Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С‘Р В»Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р Р…РЎвЂ№Р в„– РЎРѓРЎвЂ Р ВµР Р…Р В°РЎР‚Р С‘Р в„– Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°.')
              : tr('Public scheduled rooms already have a browser watch link for learners.', 'Р СџРЎС“Р В±Р В»Р С‘РЎвЂЎР Р…РЎвЂ№Р Вµ Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ РЎС“Р В¶Р Вµ Р С‘Р СР ВµРЎР‹РЎвЂљ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Р…РЎС“РЎР‹ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р Т‘Р В»РЎРЏ РЎС“РЎвЂЎР ВµР Р…Р С‘Р С”Р С•Р Р†.')
          },
          {
            title: tr('Reuse this room', 'Р СџР ВµРЎР‚Р ВµР С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“'),
            copy: tr('You can edit the same room instead of creating a new session each time.', 'Р СљР С•Р В¶Р Р…Р С• РЎР‚Р ВµР Т‘Р В°Р С”РЎвЂљР С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р Р†Р СР ВµРЎРѓРЎвЂљР С• РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р С‘РЎРЏ Р Р…Р С•Р Р†Р С•Р в„– РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘ Р С”Р В°Р В¶Р Т‘РЎвЂ№Р в„– РЎР‚Р В°Р В·.')
          }
        ];
      } else {
        items = [
          {
            title: tr('Prepare room details', 'Р СџР С•Р Т‘Р С–Р С•РЎвЂљР С•Р Р†РЎРЉРЎвЂљР Вµ Р С—Р В°РЎР‚Р В°Р СР ВµРЎвЂљРЎР‚РЎвЂ№ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№'),
            copy: tr('Check title, level, language and access before you publish the stream.', 'Р СџР ВµРЎР‚Р ВµР Т‘ Р В·Р В°Р С—РЎС“РЎРѓР С”Р С•Р С РЎРЊРЎвЂћР С‘РЎР‚Р В° Р С—РЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ Р Р…Р В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ, РЎС“РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ, РЎРЏР В·РЎвЂ№Р С” Р С‘ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—.')
          },
          {
            title: tr('Allow permissions', 'Р В Р В°Р В·РЎР‚Р ВµРЎв‚¬Р С‘РЎвЂљР Вµ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—'),
            copy: tr('Browser host mode needs camera and microphone permission on this device.', 'Р В Р ВµР В¶Р С‘Р СРЎС“ host Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ Р Р…РЎС“Р В¶Р ВµР Р… Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р С” Р С”Р В°Р СР ВµРЎР‚Р Вµ Р С‘ Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…РЎС“ Р Р…Р В° РЎРЊРЎвЂљР С•Р С РЎС“РЎРѓРЎвЂљРЎР‚Р С•Р в„–РЎРѓРЎвЂљР Р†Р Вµ.')
          },
          {
            title: tr('Plan learner entry', 'Р СџР С•Р Т‘Р С–Р С•РЎвЂљР С•Р Р†РЎРЉРЎвЂљР Вµ Р Р†РЎвЂ¦Р С•Р Т‘ Р Т‘Р В»РЎРЏ РЎС“РЎвЂЎР ВµР Р…Р С‘Р С”Р С•Р Р†'),
            copy: tr('After the room starts you can copy the browser watch link or continue in the Duvela app.', 'Р СџР С•РЎРѓР В»Р Вµ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В° Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р СР С•Р В¶Р Р…Р С• РЎРѓР С”Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Р…РЎС“РЎР‹ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р С‘Р В»Р С‘ Р С—РЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р С‘РЎвЂљРЎРЉ РЎР‚Р В°Р В±Р С•РЎвЂљРЎС“ Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р С‘ Duvela.')
          }
        ];
      }
    } else if (sessionId) {
      items = [
        {
          title: tr('Watch in browser', 'Р РЋР СР С•РЎвЂљРЎР‚Р С‘РЎвЂљР Вµ Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ'),
          copy: tr('Playback starts here when the teacher camera is published to the room.', 'Р вЂ™Р С•РЎРѓР С—РЎР‚Р С•Р С‘Р В·Р Р†Р ВµР Т‘Р ВµР Р…Р С‘Р Вµ Р Р…Р В°РЎвЂЎР Р…Р ВµРЎвЂљРЎРѓРЎРЏ Р В·Р Т‘Р ВµРЎРѓРЎРЉ, Р С”Р С•Р С–Р Т‘Р В° Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р С•Р С—РЎС“Р В±Р В»Р С‘Р С”РЎС“Р ВµРЎвЂљ Р С”Р В°Р СР ВµРЎР‚РЎС“ Р Р† Р С”Р С•Р СР Р…Р В°РЎвЂљР Вµ.')
        },
        {
          title: tr('Use the app as fallback', 'Р СџРЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С”Р В°Р С” Р В·Р В°Р С—Р В°РЎРѓР Р…Р С•Р в„– Р Р†РЎвЂ¦Р С•Р Т‘'),
          copy: session?.is_private
            ? tr('Private lessons may require the app or an approved access path.', 'Р вЂќР В»РЎРЏ Р С—РЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…РЎвЂ№РЎвЂ¦ РЎС“РЎР‚Р С•Р С”Р С•Р Р† Р СР С•Р В¶Р ВµРЎвЂљ Р С—Р С•Р Р…Р В°Р Т‘Р С•Р В±Р С‘РЎвЂљРЎРЉРЎРѓРЎРЏ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С‘Р В»Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р Р…РЎвЂ№Р в„– Р С—РЎС“РЎвЂљРЎРЉ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°.')
            : tr('If playback stalls, reopen the same room in the Duvela mobile app.', 'Р вЂўРЎРѓР В»Р С‘ Р Р†Р С•РЎРѓР С—РЎР‚Р С•Р С‘Р В·Р Р†Р ВµР Т‘Р ВµР Р…Р С‘Р Вµ Р В·Р В°Р Р†Р С‘РЎРѓР Р…Р ВµРЎвЂљ, Р С•РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р Р† Р СР С•Р В±Р С‘Р В»РЎРЉР Р…Р С•Р С Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р С‘ Duvela.')
        },
        {
          title: tr('Enable sound', 'Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљР Вµ Р В·Р Р†РЎС“Р С”'),
          copy: tr('If the browser blocks autoplay, use the sound prompt above the stage.', 'Р вЂўРЎРѓР В»Р С‘ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚ Р В±Р В»Р С•Р С”Р С‘РЎР‚РЎС“Р ВµРЎвЂљ Р В°Р Р†РЎвЂљР С•Р В·Р В°Р С—РЎС“РЎРѓР С”, Р Р…Р В°Р В¶Р СР С‘РЎвЂљР Вµ Р С—Р С•Р Т‘РЎРѓР С”Р В°Р В·Р С”РЎС“ Р В·Р Р†РЎС“Р С”Р В° Р Р…Р В°Р Т‘ РЎРѓРЎвЂ Р ВµР Р…Р С•Р в„–.')
        }
      ];
    } else {
      items = [
        {
          title: tr('Open from the dashboard', 'Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ Р С‘Р В· Р С”Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљР В°'),
          copy: tr('Use Hub Web or Bus Web to open a specific live room.', 'Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ Р С”Р С•Р Р…Р С”РЎР‚Р ВµРЎвЂљР Р…РЎС“РЎР‹ live-Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р С‘Р В· Hub Web Р С‘Р В»Р С‘ Bus Web.')
        },
        {
          title: tr('Check the teacher link', 'Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ'),
          copy: tr('A valid room link adds the live session id to this page.', 'Р С™Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р В°РЎРЏ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В° Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р Т‘Р С•Р В±Р В°Р Р†Р В»РЎРЏР ВµРЎвЂљ id live-РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘ Р Р…Р В° РЎРЊРЎвЂљРЎС“ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“.')
        },
        {
          title: tr('Continue in the app', 'Р СџРЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р С‘РЎвЂљР Вµ Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р С‘'),
          copy: tr('Mobile app entry remains available for rooms that are not ready in the browser.', 'Р вЂ™РЎвЂ¦Р С•Р Т‘ РЎвЂЎР ВµРЎР‚Р ВµР В· Р СР С•Р В±Р С‘Р В»РЎРЉР Р…Р С•Р Вµ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С•РЎРѓРЎвЂљР В°Р ВµРЎвЂљРЎРѓРЎРЏ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…РЎвЂ№Р С Р Т‘Р В»РЎРЏ Р С”Р С•Р СР Р…Р В°РЎвЂљ, Р С”Р С•РЎвЂљР С•РЎР‚РЎвЂ№Р Вµ Р С—Р С•Р С”Р В° Р Р…Р Вµ Р С–Р С•РЎвЂљР С•Р Р†РЎвЂ№ Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ.')
        }
      ];
    }
    el('studioChecklist').innerHTML = items.map(function (item) {
      return studioCheck(item.title, item.copy);
    }).join('');
  }
  function diagnosticCard(label, value) {
    return '<div class="diagnostic"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
  }
  function timelineItem(session, primaryLabel, secondaryLabel) {
    var title = session?.topic || tr('Live lesson', 'Live-РЎС“РЎР‚Р С•Р С”');
    var timing = session?.status === 'ended'
      ? formatSessionMoment(session.ended_at || session.started_at)
      : formatSessionMoment(session.started_at);
    var subtitle = [session?.language, session?.level, timing].filter(Boolean).join(' РІР‚Сћ ');
    var hostUrl = buildHostUrl(session);
    var watchUrl = buildShareUrl(session);
    var actions = '<div class="timeline-actions"><a class="btn" href="' + hostUrl + '">' + esc(primaryLabel) + '</a>';
    if (!session?.is_private && session?.id) {
      actions += '<a class="btn ghost" href="' + watchUrl + '" target="_blank" rel="noopener">' + esc(secondaryLabel) + '</a>';
    }
    actions += '</div>';
    return '<div class="timeline-item">' +
      '<div class="timeline-item-top">' +
        '<div><b>' + esc(title) + '</b><p>' + esc(subtitle || tr('No details yet.', 'Р СџР С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р Т‘Р ВµРЎвЂљР В°Р В»Р ВµР в„–.')) + '</p></div>' +
        '<span class="timeline-pill">' + esc(sessionStatusLabel(session)) + '</span>' +
      '</div>' +
      actions +
    '</div>';
  }
  function renderDiagnostics(session) {
    var items = [];
    if (isHostMode) {
      items = [
        { label: tr('Browser realtime', 'Р вЂРЎР‚Р В°РЎС“Р В·Р ВµРЎР‚ realtime'), value: (window.AgoraRTC && navigator.mediaDevices?.getUserMedia) ? tr('Ready', 'Р вЂњР С•РЎвЂљР С•Р Р†Р С•') : tr('Missing media support', 'Р СњР ВµРЎвЂљ media support') },
        { label: tr('Account', 'Р С’Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ'), value: currentUser?.id ? tr('Signed in', 'Р вЂ™РЎвЂ¦Р С•Р Т‘ Р Р†РЎвЂ№Р С—Р С•Р В»Р Р…Р ВµР Р…') : tr('Sign in required', 'Р СњРЎС“Р В¶Р ВµР Р… Р Р†РЎвЂ¦Р С•Р Т‘') },
        { label: tr('Room state', 'Р РЋР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№'), value: sessionStatusLabel(session) },
        { label: tr('Microphone', 'Р СљР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…'), value: localAudioTrack ? (micEnabled ? tr('Live', 'Р С’Р С”РЎвЂљР С‘Р Р†Р ВµР Р…') : tr('Muted', 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…')) : tr('Idle', 'Р С›Р В¶Р С‘Р Т‘Р В°Р ВµРЎвЂљ') },
        { label: tr('Camera', 'Р С™Р В°Р СР ВµРЎР‚Р В°'), value: localVideoTrack ? (camEnabled ? tr('Live', 'Р С’Р С”РЎвЂљР С‘Р Р†Р Р…Р В°') : tr('Off', 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р В°')) : tr('Idle', 'Р С›Р В¶Р С‘Р Т‘Р В°Р ВµРЎвЂљ') },
        { label: tr('Share route', 'Р СљР В°РЎР‚РЎв‚¬РЎР‚РЎС“РЎвЂљ Р Р†РЎвЂ¦Р С•Р Т‘Р В°'), value: session?.id ? (session?.is_private ? tr('App or approved access', 'Р СџРЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С‘Р В»Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р Р…РЎвЂ№Р в„– Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—') : tr('Browser watch link ready', 'Р РЋРЎРѓРЎвЂ№Р В»Р С”Р В° Р Т‘Р В»РЎРЏ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В° Р С–Р С•РЎвЂљР С•Р Р†Р В°')) : tr('Created after room save', 'Р СџР С•РЎРЏР Р†Р С‘РЎвЂљРЎРѓРЎРЏ Р С—Р С•РЎРѓР В»Р Вµ РЎРѓР С•РЎвЂ¦РЎР‚Р В°Р Р…Р ВµР Р…Р С‘РЎРЏ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№') }
      ];
    } else {
      items = [
        { label: tr('Browser playback', 'Р вЂРЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Р…РЎвЂ№Р в„– Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚'), value: window.AgoraRTC ? tr('Ready', 'Р вЂњР С•РЎвЂљР С•Р Р†Р С•') : tr('Fallback to app', 'Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ') },
        { label: tr('Room state', 'Р РЋР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№'), value: sessionStatusLabel(session) },
        { label: tr('Access', 'Р вЂќР С•РЎРѓРЎвЂљРЎС“Р С—'), value: accessLabel(session) },
        { label: tr('Watch link', 'Р РЋРЎРѓРЎвЂ№Р В»Р С”Р В° Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В°'), value: session?.id ? tr('Opened', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР В°') : tr('Missing', 'Р СњР ВµРЎвЂљ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р С‘') }
      ];
    }
    el('diagnosticsList').innerHTML = items.map(function (item) {
      return diagnosticCard(item.label, item.value);
    }).join('');
  }
  function renderTimeline() {
    if (!el('timelineSection')) return;
    if (!isHostMode) {
      el('timelineSection').style.display = 'none';
      return;
    }
    el('timelineSection').style.display = 'grid';
    el('timelineUpcomingMeta').textContent = String(hostScheduledSessions.length) + ' ' + tr('sessions', 'РЎРѓР ВµРЎРѓРЎРѓР С‘Р в„–');
    el('timelineHistoryMeta').textContent = String(hostHistorySessions.length) + ' ' + tr('sessions', 'РЎРѓР ВµРЎРѓРЎРѓР С‘Р в„–');
    el('timelineUpcoming').innerHTML = hostScheduledSessions.length
      ? hostScheduledSessions.map(function (session) {
          return timelineItem(session, tr('Open studio', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ РЎРѓРЎвЂљРЎС“Р Т‘Р С‘РЎР‹'), tr('Open watch page', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚'));
        }).join('')
      : '<div class="card empty">' + esc(tr('No upcoming sessions yet.', 'Р СџР С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р В±Р В»Р С‘Р В¶Р В°Р в„–РЎв‚¬Р С‘РЎвЂ¦ РЎРѓР ВµРЎРѓРЎРѓР С‘Р в„–.')) + '</div>';
    el('timelineHistory').innerHTML = hostHistorySessions.length
      ? hostHistorySessions.map(function (session) {
          return timelineItem(session, tr('Reuse room', 'Р СџР С•Р Р†РЎвЂљР С•РЎР‚Р С‘РЎвЂљРЎРЉ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“'), tr('Open watch page', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚'));
        }).join('')
      : '<div class="card empty">' + esc(tr('No recent sessions yet.', 'Р СџР С•Р С”Р В° Р Р…Р ВµРЎвЂљ Р Р…Р ВµР Т‘Р В°Р Р†Р Р…Р С‘РЎвЂ¦ РЎРѓР ВµРЎРѓРЎРѓР С‘Р в„–.')) + '</div>';
  }
  function renderWorkspace(session) {
    renderFacts(session);
    renderStudioMetrics(session);
    renderStageStrip(session);
    renderStudioChecklist(session);
    renderDiagnostics(session);
    renderTimeline();
    if (isHostMode) {
      if (session?.status === 'live') {
        setNote(session?.is_private
          ? tr('Private room is live. Use the app handoff or your approved access path for learners.', 'Р СџРЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…Р В°РЎРЏ Р С”Р С•Р СР Р…Р В°РЎвЂљР В° РЎС“Р В¶Р Вµ Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ. Р вЂќР В»РЎРЏ РЎС“РЎвЂЎР ВµР Р…Р С‘Р С”Р С•Р Р† Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ Р Р†РЎвЂ¦Р С•Р Т‘ РЎвЂЎР ВµРЎР‚Р ВµР В· Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Р С‘Р В»Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р Р…РЎвЂ№Р в„– РЎРѓРЎвЂ Р ВµР Р…Р В°РЎР‚Р С‘Р в„– Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°.')
          : tr('Public room is live. Share the browser watch link while this host tab stays open.', 'Р СџРЎС“Р В±Р В»Р С‘РЎвЂЎР Р…Р В°РЎРЏ Р С”Р С•Р СР Р…Р В°РЎвЂљР В° РЎС“Р В¶Р Вµ Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ. Р вЂќР ВµР В»Р С‘РЎвЂљР ВµРЎРѓРЎРЉ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Р…Р С•Р в„– РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р С•Р в„–, Р С—Р С•Р С”Р В° РЎРЊРЎвЂљР В° host-Р Р†Р С”Р В»Р В°Р Т‘Р С”Р В° Р С•РЎРѓРЎвЂљР В°Р ВµРЎвЂљРЎРѓРЎРЏ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР С•Р в„–.'));
      } else if (session?.status === 'scheduled') {
        setNote(tr('This room is scheduled. Open the same page shortly before start time and launch LIVE from here.', 'Р В­РЎвЂљР В° Р С”Р С•Р СР Р…Р В°РЎвЂљР В° Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В°. Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“ Р Р…Р ВµР В·Р В°Р Т‘Р С•Р В»Р С–Р С• Р Т‘Р С• РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В° Р С‘ Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљР Вµ LIVE Р С•РЎвЂљРЎРѓРЎР‹Р Т‘Р В°.'));
      } else if (session?.status === 'ended') {
        setNote(tr('This room has ended. Update the setup and start a new live session when you are ready.', 'Р В­РЎвЂљР В° Р С”Р С•Р СР Р…Р В°РЎвЂљР В° Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…Р В°. Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљР Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘ Р С‘ Р В·Р В°Р С—РЎС“РЎРѓР С”Р В°Р в„–РЎвЂљР Вµ Р Р…Р С•Р Р†РЎвЂ№Р в„– РЎРЊРЎвЂћР С‘РЎР‚, Р С”Р С•Р С–Р Т‘Р В° Р В±РЎС“Р Т‘Р ВµРЎвЂљР Вµ Р С–Р С•РЎвЂљР С•Р Р†РЎвЂ№.'));
      } else {
        setNote(tr('The room stays in setup mode until you start LIVE from this browser.', 'Р С™Р С•Р СР Р…Р В°РЎвЂљР В° Р С•РЎРѓРЎвЂљР В°Р ВµРЎвЂљРЎРѓРЎРЏ Р Р† РЎР‚Р ВµР В¶Р С‘Р СР Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р С‘, Р С—Р С•Р С”Р В° Р Р†РЎвЂ№ Р Р…Р Вµ Р Р…Р В°Р В¶Р СР ВµРЎвЂљР Вµ Start LIVE Р Р† РЎРЊРЎвЂљР С•Р С Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ.'));
      }
      return;
    }
    if (session?.status === 'scheduled') {
      setNote(tr('This lesson is scheduled. Keep the page open and it will update when the teacher starts.', 'Р В­РЎвЂљР С•РЎвЂљ РЎС“РЎР‚Р С•Р С” Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…. Р С›РЎРѓРЎвЂљР В°Р Р†РЎРЉРЎвЂљР Вµ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР С•Р в„–, Р С‘ Р С•Р Р…Р В° Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРѓРЎРЏ, Р С”Р С•Р С–Р Т‘Р В° Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р Р…Р В°РЎвЂЎР Р…Р ВµРЎвЂљ РЎРЊРЎвЂћР С‘РЎР‚.'));
    } else if (session?.status === 'ended') {
      setNote(tr('The broadcast has ended. Reopen the next lesson from the dashboard or mobile app.', 'Р В­РЎвЂћР С‘РЎР‚ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…. Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р С‘Р в„– РЎС“РЎР‚Р С•Р С” Р С‘Р В· Р С”Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљР В° Р С‘Р В»Р С‘ Р СР С•Р В±Р С‘Р В»РЎРЉР Р…Р С•Р С–Р С• Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘РЎРЏ.'));
    } else if (session?.is_private) {
      setNote(tr('Private lessons may still require the Duvela app even when the browser page opens.', 'Р вЂќР В°Р В¶Р Вµ Р ВµРЎРѓР В»Р С‘ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ Р В° Р С•РЎвЂљР С”РЎР‚РЎвЂ№Р В»Р В°РЎРѓРЎРЉ Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ, Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…РЎвЂ№РЎвЂ¦ РЎС“РЎР‚Р С•Р С”Р С•Р Р† Р Р†РЎРѓР Вµ РЎР‚Р В°Р Р†Р Р…Р С• Р СР С•Р В¶Р ВµРЎвЂљ Р С—Р С•Р Р…Р В°Р Т‘Р С•Р В±Р С‘РЎвЂљРЎРЉРЎРѓРЎРЏ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Duvela.'));
    } else {
      setNote(tr('If the stream does not start, reopen the room or continue in the Duvela app.', 'Р вЂўРЎРѓР В»Р С‘ РЎРЊРЎвЂћР С‘РЎР‚ Р Р…Р Вµ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљРЎС“Р ВµРЎвЂљ, Р С—Р ВµРЎР‚Р ВµР С•РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р С‘Р В»Р С‘ Р С—РЎР‚Р С•Р Т‘Р С•Р В»Р В¶Р С‘РЎвЂљР Вµ Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р С‘ Duvela.'));
    }
  }
  function updateHostControls() {
    el('toggleMic').textContent = micEnabled ? tr('Mute mic', 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…') : tr('Unmute mic', 'Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…');
    el('toggleCam').textContent = camEnabled ? tr('Camera off', 'Р вЂ™РЎвЂ№Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Р С”Р В°Р СР ВµРЎР‚РЎС“') : tr('Camera on', 'Р вЂ™Р С”Р В»РЎР‹РЎвЂЎР С‘РЎвЂљРЎРЉ Р С”Р В°Р СР ВµРЎР‚РЎС“');
  }
  async function toggleMic() {
    if (!localAudioTrack) return;
    micEnabled = !micEnabled;
    await localAudioTrack.setEnabled(micEnabled);
    updateHostControls();
  }
  async function toggleCam() {
    if (!localVideoTrack) return;
    camEnabled = !camEnabled;
    await localVideoTrack.setEnabled(camEnabled);
    updateHostControls();
  }
  function startSessionPolling() {
    clearInterval(sessionPollTimer);
    if (!sessionId) return;
    sessionPollTimer = setInterval(async function () {
      try {
        currentSession = await loadLiveSession(sessionId);
        applySessionToInputs(currentSession);
        updateShareLink(currentSession);
        renderWorkspace(currentSession);
        if (currentSession.topic) el('title').textContent = currentSession.topic;
        if (isHostMode && currentUser?.id) {
          await loadHostTimeline();
        }
        if (currentSession.status === 'scheduled') {
          showOverlay(true);
          setStatus(tr('Scheduled', 'Р вЂ”Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С•'), 'ready');
          setStage('', tr('This session is scheduled and will switch to LIVE when the teacher starts.', 'Р В­РЎвЂљР В° РЎРѓР ВµРЎРѓРЎРѓР С‘РЎРЏ Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В° Р С‘ Р С—Р ВµРЎР‚Р ВµР в„–Р Т‘Р ВµРЎвЂљ Р Р† LIVE, Р С”Р С•Р С–Р Т‘Р В° Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р Р…Р В°РЎвЂЎР Р…Р ВµРЎвЂљ РЎРЊРЎвЂћР С‘РЎР‚.'));
          stopElapsedClock();
        }
        if (currentSession.status === 'ended') {
          showOverlay(true);
          setStatus(tr('LIVE ended', 'Р В­РЎвЂћР С‘РЎР‚ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…'), '');
          setStage('', tr('The live session has ended.', 'Р В­РЎвЂћР С‘РЎР‚ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р….'));
          setHostSetupDisabled(false);
        }
      } catch (error) {}
    }, 15000);
  }
  function makeDeepLink() {
    if (isBusiness) {
      return 'duvelabusiness://live-stream' + (sessionId ? '?sessionId=' + encodeURIComponent(sessionId) : '');
    }
    return 'duvelahub://native/live-stream?mode=student' + (sessionId ? '&sessionId=' + encodeURIComponent(sessionId) : '');
  }
  function updateShareLink(session) {
    if (!session?.id || session?.is_private || session?.status === 'ended') {
      el('shareBox').classList.remove('visible');
      el('shareUrl').value = '';
      return;
    }
    el('shareUrl').value = buildShareUrl(session);
    el('shareBox').classList.add('visible');
  }
  function updateUrlForHost(session) {
    if (!session?.id) return;
    var url = new URL('./live.html', window.location.href);
    url.searchParams.set('app', 'business');
    url.searchParams.set('mode', 'host');
    url.searchParams.set('s', session.id);
    if (session.teacher_name) url.searchParams.set('t', session.teacher_name);
    history.replaceState(null, '', url.href);
    sessionId = session.id;
    el('openApp').href = makeDeepLink();
  }
  async function requireSessionForHost() {
    var got = await supa.auth.getSession();
    if (got.data.session?.user) return got.data.session;
    window.location.href = './index.html?login=1';
    throw new Error(tr('Sign in first.', 'Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В° Р Р†Р С•Р в„–Р Т‘Р С‘РЎвЂљР Вµ Р Р† Р В°Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ.'));
  }
  async function ensureViewerSession() {
    var got = await supa.auth.getSession();
    if (got.data.session?.user) return got.data.session;
    var anon = await supa.auth.signInAnonymously();
    if (anon.error || !anon.data.session) throw new Error(tr('Could not create viewer session.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ viewer session.'));
    return anon.data.session;
  }
  async function getPublisherToken(channelName, uid) {
    var fn = await supa.functions.invoke('agora-token', {
      body: { channelName: channelName, uid: uid, role: 'publisher', ttlSeconds: 3600 }
    });
    if (fn.error) throw new Error(fn.error.message || tr('Could not get host token.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С—Р С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ host token.'));
    if (!fn.data?.token) throw new Error(tr('Could not get host token.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С—Р С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ host token.'));
    return fn.data.token;
  }
  async function getSubscriberToken(channelName, uid) {
    var fn = await supa.functions.invoke('agora-token', {
      body: { channelName: channelName, uid: uid, role: 'subscriber', ttlSeconds: 3600 }
    });
    if (fn.error) throw new Error(fn.error.message || tr('Could not get stream token.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С—Р С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ token Р Т‘Р В»РЎРЏ РЎРЊРЎвЂћР С‘РЎР‚Р В°.'));
    if (!fn.data?.token) throw new Error(tr('Could not get stream token.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С—Р С•Р В»РЎС“РЎвЂЎР С‘РЎвЂљРЎРЉ token Р Т‘Р В»РЎРЏ РЎРЊРЎвЂћР С‘РЎР‚Р В°.'));
    return fn.data.token;
  }
  async function loadLiveSession(id) {
    var result = await supa.from('live_sessions').select(LIVE_FIELDS).eq('id', id).maybeSingle();
    if (result.error || !result.data) throw new Error(tr('This LIVE was not found.', 'Р В­РЎвЂљР С•РЎвЂљ LIVE Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….'));
    return result.data;
  }
  async function joinViewerParticipant(uid) {
    if (!currentSession?.id || !currentUser?.id || !supa) return;
    if (viewerJoined && viewerAgoraUid === uid) return;
    var result = await supa.from('live_participants').upsert({
      agora_uid: uid,
      left_at: null,
      role: 'audience',
      session_id: currentSession.id,
      user_id: currentUser.id
    }, { onConflict: 'session_id,user_id' });
    if (result.error) {
      throw new Error(result.error.message || tr('Could not join the live room.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р Р†Р С•Р в„–РЎвЂљР С‘ Р Р† live-Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“.'));
    }
    viewerJoined = true;
    viewerAgoraUid = uid;
  }
  async function leaveViewerParticipant() {
    if (!viewerJoined || !currentSession?.id || !currentUser?.id || !supa) return;
    await supa.from('live_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('session_id', currentSession.id)
      .eq('user_id', currentUser.id);
    viewerJoined = false;
    viewerAgoraUid = null;
  }
  async function loadViewerMessages() {
    if (!currentSession?.id || !supa) return;
    var result = await supa.from('live_messages')
      .select('id,channel_name,created_at,message,role,sender_id,sender_name,session_id')
      .eq('session_id', currentSession.id)
      .order('created_at', { ascending: true })
      .limit(200);
    if (result.error) {
      throw new Error(result.error.message || tr('Could not load live chat.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ РЎвЂЎР В°РЎвЂљ РЎРЊРЎвЂћР С‘РЎР‚Р В°.'));
    }
    viewerMessages = result.data || [];
    renderViewerMessages();
  }
  async function subscribeViewerRealtime() {
    if (!currentSession?.id || !supa) return;
    if (viewerRealtimeChannel) {
      await supa.removeChannel(viewerRealtimeChannel);
      viewerRealtimeChannel = null;
    }
    viewerRealtimeChannel = supa.channel('live-room-' + currentSession.id + '-' + Date.now());
    viewerRealtimeChannel
      .on('postgres_changes', {
        event: 'INSERT',
        filter: 'session_id=eq.' + currentSession.id,
        schema: 'public',
        table: 'live_messages'
      }, function (payload) {
        upsertViewerMessage(payload.new);
        renderViewerMessages();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        filter: 'session_id=eq.' + currentSession.id,
        schema: 'public',
        table: 'live_gifts'
      }, function (payload) {
        upsertViewerMessage({
          channel_name: currentSession.channel_name,
          created_at: payload.new.created_at || new Date().toISOString(),
          id: 'gift-' + payload.new.id,
          message: (payload.new.sender_name || tr('Student', 'Р Р€РЎвЂЎР ВµР Р…Р С‘Р С”')) + ' ' + tr('sent', 'Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘Р В»') + ' ' + (payload.new.gift_name || tr('a gift', 'Р С—Р С•Р Т‘Р В°РЎР‚Р С•Р С”')),
          role: 'system',
          sender_id: payload.new.sender_id || null,
          sender_name: tr('Gift', 'Р СџР С•Р Т‘Р В°РЎР‚Р С•Р С”'),
          session_id: currentSession.id
        });
        renderViewerMessages();
        if (currentUser?.id && payload.new.sender_id === currentUser.id) void loadViewerBalance();
      });
    await viewerRealtimeChannel.subscribe();
  }
  async function sendViewerMessage() {
    var text = (el('chatInput')?.value || '').trim();
    if (!text || !currentSession?.id || !currentUser?.id || !supa || viewerSendingMessage) return;
    viewerSendingMessage = true;
    el('sendChat').disabled = true;
    try {
      var result = await supa.from('live_messages').insert({
        channel_name: currentSession.channel_name,
        message: text,
        role: 'student',
        sender_id: currentUser.id,
        sender_name: viewerDisplayName(),
        session_id: currentSession.id
      }).select('id,channel_name,created_at,message,role,sender_id,sender_name,session_id').single();
      if (result.error || !result.data) {
        throw new Error(result.error?.message || tr('Could not send the message.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎРѓР С•Р С•Р В±РЎвЂ°Р ВµР Р…Р С‘Р Вµ.'));
      }
      el('chatInput').value = '';
      upsertViewerMessage(result.data);
      renderViewerMessages();
    } finally {
      viewerSendingMessage = false;
      el('sendChat').disabled = false;
    }
  }
  async function sendViewerGift() {
    if (!currentSession?.id || !supa || viewerSendingGift) return;
    viewerSendingGift = true;
    el('sendGift').disabled = true;
    try {
      var response = await supa.functions.invoke('live-payment', {
        body: {
          action: 'gift',
          giftId: selectedGiftId,
          senderName: viewerDisplayName(),
          sessionId: currentSession.id
        }
      });
      if (response.error) {
        var context = response.error.context;
        if (context instanceof Response) {
          var payload = await context.clone().json().catch(function () { return null; });
          if (payload?.error) throw new Error(payload.error);
        }
        throw new Error(response.error.message || tr('Could not send the gift.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р Т‘Р В°РЎР‚Р С•Р С”.'));
      }
      viewerBalance = typeof response.data?.balanceAfter === 'number' ? response.data.balanceAfter : viewerBalance;
      renderViewerBalance();
      closeGiftModal();
      setNote(tr('Gift sent to the live teacher.', 'Р СџР С•Р Т‘Р В°РЎР‚Р С•Р С” Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р… Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎР‹ РЎРЊРЎвЂћР С‘РЎР‚Р В°.'));
    } finally {
      viewerSendingGift = false;
      el('sendGift').disabled = false;
    }
  }
  function hostSessionPayload(user, status, startedAt, existingSession) {
    var now = new Date().toISOString();
    var topic = el('topicInput').value.trim() || tr('Live lesson', 'Live-РЎС“РЎР‚Р С•Р С”');
    return {
      channel_name: existingSession?.channel_name || createChannelName(user.id),
      ended_at: status === 'ended' ? now : null,
      heartbeat_at: now,
      is_private: el('privateInput').checked,
      language: el('languageInput').value || null,
      level: el('levelInput').value || null,
      price_per_minute: 0,
      started_at: startedAt || existingSession?.started_at || now,
      status: status,
      teacher_id: user.id,
      teacher_name: displayName(user),
      topic: topic
    };
  }
  async function createLiveSession(user) {
    var payload = hostSessionPayload(user, 'live', new Date().toISOString(), null);
    var result = await supa
      .from('live_sessions')
      .insert(payload)
      .select(LIVE_FIELDS)
      .single();
    if (result.error || !result.data) {
      throw new Error(result.error?.message || tr('Could not create LIVE. Make sure this account is a teacher/organizer.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ LIVE. Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ, РЎвЂЎРЎвЂљР С• Р В°Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ Р С•РЎвЂљР СР ВµРЎвЂЎР ВµР Р… Р С”Р В°Р С” teacher Р С‘Р В»Р С‘ organizer.'));
    }
    return result.data;
  }
  async function updateHostSession(user, session, status, startedAt) {
    var payload = hostSessionPayload(user, status, startedAt, session);
    var result = await supa
      .from('live_sessions')
      .update(payload)
      .eq('id', session.id)
      .eq('teacher_id', user.id)
      .select(LIVE_FIELDS)
      .single();
    if (result.error || !result.data) {
      throw new Error(result.error?.message || tr('Could not update LIVE room.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљРЎРЉ LIVE-Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“.'));
    }
    return result.data;
  }
  async function loadHostTimeline() {
    if (!isHostMode || !currentUser?.id) return;
    var now = new Date().toISOString();
    var results = await Promise.all([
      supa.from('live_sessions')
        .select(LIVE_FIELDS)
        .eq('teacher_id', currentUser.id)
        .eq('status', 'scheduled')
        .gte('started_at', now)
        .order('started_at', { ascending: true })
        .limit(8),
      supa.from('live_sessions')
        .select(LIVE_FIELDS)
        .eq('teacher_id', currentUser.id)
        .eq('status', 'ended')
        .order('ended_at', { ascending: false })
        .limit(8)
    ]);
    hostScheduledSessions = results[0].data || [];
    hostHistorySessions = results[1].data || [];
    renderWorkspace(currentSession);
  }
  async function scheduleHostSession() {
    if (!supa) return;
    el('scheduleSession').disabled = true;
    try {
      var authSession = await requireSessionForHost();
      currentUser = authSession.user;
      var scheduledAt = buildScheduleIso();
      if (!scheduledAt) throw new Error(tr('Choose date and time first.', 'Р РЋР Р…Р В°РЎвЂЎР В°Р В»Р В° Р Р†РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ Р Т‘Р В°РЎвЂљРЎС“ Р С‘ Р Р†РЎР‚Р ВµР СРЎРЏ.'));
      if (Date.parse(scheduledAt) <= Date.now()) {
        throw new Error(tr('Choose a future start time.', 'Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ Р Р†РЎР‚Р ВµР СРЎРЏ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В° Р Р† Р В±РЎС“Р Т‘РЎС“РЎвЂ°Р ВµР С.'));
      }
      var selectedSession = sessionId ? await loadLiveSession(sessionId) : null;
      if (selectedSession?.teacher_id && selectedSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Р В­РЎвЂљР С•РЎвЂљ LIVE Р С—РЎР‚Р С‘Р Р…Р В°Р Т‘Р В»Р ВµР В¶Р С‘РЎвЂљ Р Т‘РЎР‚РЎС“Р С–Р С•Р СРЎС“ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎР‹.'));
      }
      currentSession = selectedSession
        ? await updateHostSession(currentUser, selectedSession, 'scheduled', scheduledAt)
        : await (async function () {
            var payload = hostSessionPayload(currentUser, 'scheduled', scheduledAt, null);
            var result = await supa.from('live_sessions').insert(payload).select(LIVE_FIELDS).single();
            if (result.error || !result.data) {
              throw new Error(result.error?.message || tr('Could not schedule LIVE.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ LIVE.'));
            }
            return result.data;
          })();
      teacher = currentSession.teacher_name || teacher;
      updateUrlForHost(currentSession);
      updateShareLink(currentSession);
      applySessionToInputs(currentSession);
      renderWorkspace(currentSession);
      el('mainAction').textContent = tr('Go LIVE now', 'Р вЂ™РЎвЂ№Р в„–РЎвЂљР С‘ Р Р† LIVE');
      showOverlay(true);
      setStatus(tr('Scheduled', 'Р вЂ”Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С•'), 'ready');
      setStage('', tr('The session is scheduled. Open this page again to start LIVE from the browser.', 'Р РЋР ВµРЎРѓРЎРѓР С‘РЎРЏ Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В°. Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“ РЎРѓР Р…Р С•Р Р†Р В°, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ LIVE Р С‘Р В· Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°.'));
      if (currentSession.topic) el('title').textContent = currentSession.topic;
      await loadHostTimeline();
    } catch (error) {
      setStage('', error?.message || tr('Could not schedule LIVE.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ LIVE.'));
    } finally {
      el('scheduleSession').disabled = false;
    }
  }
  async function markHeartbeat() {
    if (!currentSession?.id) return;
    await supa.from('live_sessions').update({
      heartbeat_at: new Date().toISOString(),
      status: 'live',
      ended_at: null
    }).eq('id', currentSession.id);
  }
  async function markEnded() {
    if (!currentSession?.id || !currentUser?.id) return;
    await supa.from('live_sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', currentSession.id)
      .eq('teacher_id', currentUser.id);
  }
  async function startHost() {
    if (!supa || !window.AgoraRTC || !AGORA_APP_ID) {
      setStage('', tr('Live studio is not configured.', 'Live Studio Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р…Р В°.'));
      return;
    }
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    el('mainAction').disabled = true;
    setStatus(tr('Starting teacher LIVE', 'Р вЂ”Р В°Р С—РЎС“РЎРѓР С” teacher LIVE'), 'ready');
    setStage('<div class="spinner"></div>', tr('Preparing camera and microphone...', 'Р СџР С•Р Т‘Р С–Р С•РЎвЂљР С•Р Р†Р С”Р В° Р С”Р В°Р СР ВµРЎР‚РЎвЂ№ Р С‘ Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…Р В°...'));
    try {
      var createdFreshSession = false;
      var authSession = await requireSessionForHost();
      currentUser = authSession.user;
      var uid = createAgoraUid(currentUser.id);
      currentSession = sessionId ? await loadLiveSession(sessionId) : await createLiveSession(currentUser);
      createdFreshSession = !sessionId;
      applySessionToInputs(currentSession);
      if (currentSession.teacher_id && currentSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Р В­РЎвЂљР С•РЎвЂљ LIVE Р С—РЎР‚Р С‘Р Р…Р В°Р Т‘Р В»Р ВµР В¶Р С‘РЎвЂљ Р Т‘РЎР‚РЎС“Р С–Р С•Р СРЎС“ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎР‹.'));
      }
      if (!createdFreshSession) {
        currentSession = await updateHostSession(currentUser, currentSession, 'live', new Date().toISOString());
      }

      var token = await getPublisherToken(currentSession.channel_name, uid);
      client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('host');
      await client.join(AGORA_APP_ID, currentSession.channel_name, token, uid);
      var tracks = await window.AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrack = tracks[0];
      localVideoTrack = tracks[1];
      micEnabled = true;
      camEnabled = true;
      localVideoTrack.play('player', { fit: 'cover' });
      await client.publish([localAudioTrack, localVideoTrack]);

      el('title').textContent = currentSession.topic || tr('Teacher LIVE', 'Teacher LIVE');
      el('subtitle').textContent = tr('You are live from the browser. Students can open the watch link.', 'Р вЂ™РЎвЂ№ РЎС“Р В¶Р Вµ Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ Р С‘Р В· Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°. Р Р€РЎвЂЎР ВµР Р…Р С‘Р С”Р С‘ Р СР С•Р С–РЎС“РЎвЂљ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В°.');
      showOverlay(false);
      el('endLive').style.display = 'inline-flex';
      el('toggleMic').style.display = 'inline-flex';
      el('toggleCam').style.display = 'inline-flex';
      updateHostControls();
      el('mainAction').textContent = tr('LIVE is running', 'LIVE Р В·Р В°Р С—РЎС“РЎвЂ°Р ВµР Р…');
      setStatus(tr('Teacher is LIVE', 'Teacher Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ'), 'live');
      setStage('', '');
      updateUrlForHost(currentSession);
      updateShareLink(currentSession);
      setHostSetupDisabled(true);
      renderWorkspace(currentSession);
      startElapsedClock(currentSession.started_at || new Date().toISOString());
      startSessionPolling();
      await markHeartbeat();
      heartbeatTimer = setInterval(markHeartbeat, 30000);
      await loadHostTimeline();
    } catch (error) {
      el('mainAction').disabled = false;
      el('mainAction').textContent = sessionId ? tr('Open as teacher', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р С”Р В°Р С” teacher') : tr('Start LIVE', 'Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ LIVE');
      setStatus(tr('Not live', 'Р СњР Вµ Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ'), '');
      setStage('', error?.message || tr('Could not start LIVE.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ LIVE.'));
      if (createdFreshSession && currentSession?.id && currentUser?.id) {
        try { await markEnded(); } catch (e) {}
      }
      await stopMedia(false);
      renderWorkspace(currentSession);
    }
  }
  async function watch() {
    if (!sessionId) {
      setStage('', tr('No live session selected.', 'Live-РЎРѓР ВµРЎРѓРЎРѓР С‘РЎРЏ Р Р…Р Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р В°.'));
      return;
    }
    if (!supa || !window.AgoraRTC || !AGORA_APP_ID) {
      setStage('', tr('Open the app to watch this lesson.', 'Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎРѓР СР С•РЎвЂљРЎР‚Р ВµРЎвЂљРЎРЉ РЎРЊРЎвЂљР С•РЎвЂљ РЎС“РЎР‚Р С•Р С”.'));
      return;
    }
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    el('mainAction').disabled = true;
    setStatus(tr('Connecting', 'Р СџР С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ'), 'ready');
    setStage('<div class="spinner"></div>', tr('Connecting...', 'Р СџР С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘Р Вµ...'));
    try {
      var authSession = await ensureViewerSession();
      var user = authSession.user;
      var uid = createAgoraUid(user.id);
      currentUser = user;
      currentSession = await loadLiveSession(sessionId);
      renderWorkspace(currentSession);
      updateShareLink(currentSession);
      startSessionPolling();
      if (currentSession.status === 'scheduled') {
        stopElapsedClock();
        throw new Error(tr('This lesson is scheduled. Keep this page open or reopen it near the start time.', 'Р В­РЎвЂљР С•РЎвЂљ РЎС“РЎР‚Р С•Р С” Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…. Р С›РЎРѓРЎвЂљР В°Р Р†РЎРЉРЎвЂљР Вµ РЎРѓРЎвЂљРЎР‚Р В°Р Р…Р С‘РЎвЂ РЎС“ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљР С•Р в„– Р С‘Р В»Р С‘ Р Р†Р ВµРЎР‚Р Р…Р С‘РЎвЂљР ВµРЎРѓРЎРЉ Р В±Р В»Р С‘Р В¶Р Вµ Р С”Р С• Р Р†РЎР‚Р ВµР СР ВµР Р…Р С‘ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В°.'));
      }
      if (currentSession.status !== 'live') throw new Error(tr('This LIVE has ended.', 'Р В­РЎвЂљР С•РЎвЂљ LIVE РЎС“Р В¶Р Вµ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р….'));
      if (currentSession.is_private) throw new Error(tr('This is a private lesson. Open the app to request access.', 'Р В­РЎвЂљР С• Р С—РЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…РЎвЂ№Р в„– РЎС“РЎР‚Р С•Р С”. Р С›РЎвЂљР С”РЎР‚Р С•Р в„–РЎвЂљР Вµ Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ Р В·Р В°Р С—РЎР‚Р С•РЎРѓР С‘РЎвЂљРЎРЉ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—.'));
      if (currentSession.teacher_name && !teacher) el('title').textContent = teacherWatchTitle(currentSession.teacher_name);
      await joinViewerParticipant(uid);
      await loadViewerBalance();
      await loadViewerMessages();
      await subscribeViewerRealtime();
      setViewerControlsEnabled(true);
      startElapsedClock(currentSession.started_at || new Date().toISOString());
      var token = await getSubscriberToken(currentSession.channel_name, uid);
      client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('audience');
      client.on('user-published', async function (remoteUser, mediaType) {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === 'video') {
          showOverlay(false);
          remoteUser.videoTrack.play('player', { fit: 'cover' });
          setStatus(tr('Watching LIVE', 'Р РЋР СР С•РЎвЂљРЎР‚Р С‘Р С LIVE'), 'live');
        }
        if (mediaType === 'audio') {
          try { remoteUser.audioTrack.play(); }
          catch (e) { showSoundPill(remoteUser); }
        }
      });
      client.on('user-unpublished', function () {
        showOverlay(true);
        setStage('', tr('The teacher paused the stream.', 'Р СџРЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р С—Р С•РЎРѓРЎвЂљР В°Р Р†Р С‘Р В» РЎРЊРЎвЂћР С‘РЎР‚ Р Р…Р В° Р С—Р В°РЎС“Р В·РЎС“.'));
      });
      await client.join(AGORA_APP_ID, currentSession.channel_name, token, uid);
      setStage('<div class="spinner"></div>', tr('Waiting for the teacher camera...', 'Р С›Р В¶Р С‘Р Т‘Р В°Р ВµР С Р С”Р В°Р СР ВµРЎР‚РЎС“ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ...'));
      el('mainAction').disabled = false;
      el('mainAction').textContent = tr('Try again', 'Р СџР С•Р Р†РЎвЂљР С•РЎР‚Р С‘РЎвЂљРЎРЉ');
    } catch (error) {
      el('mainAction').disabled = false;
      el('mainAction').textContent = tr('Try again', 'Р СџР С•Р Р†РЎвЂљР С•РЎР‚Р С‘РЎвЂљРЎРЉ');
      setStatus(tr('Not connected', 'Р СњР ВµРЎвЂљ Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР ВµР Р…Р С‘РЎРЏ'), '');
      setStage('', error?.message || tr('Could not start the stream.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ РЎРЊРЎвЂћР С‘РЎР‚.'));
      showOverlay(true);
      setViewerControlsEnabled(false);
      await stopMedia(false);
      renderWorkspace(currentSession);
    }
  }
  async function stopMedia(markSessionEnded) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    clearInterval(sessionPollTimer);
    sessionPollTimer = null;
    stopElapsedClock();
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      localAudioTrack = null;
    }
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
      localVideoTrack = null;
    }
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    if (!isHostMode) {
      if (viewerRealtimeChannel) {
        try { await supa.removeChannel(viewerRealtimeChannel); } catch (e) {}
        viewerRealtimeChannel = null;
      }
      await leaveViewerParticipant();
      viewerMessages = [];
      renderViewerMessages();
      closeGiftModal();
      setViewerControlsEnabled(false);
    }
    el('toggleMic').style.display = 'none';
    el('toggleCam').style.display = 'none';
    setHostSetupDisabled(false);
    if (markSessionEnded && currentSession?.status === 'live') await markEnded();
  }
  async function endHost() {
    el('endLive').disabled = true;
    setStatus(tr('Ending LIVE', 'Р вЂ”Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р В°Р ВµР С LIVE'), 'ready');
    await stopMedia(true);
    showOverlay(true);
    el('endLive').style.display = 'none';
    el('endLive').disabled = false;
    el('mainAction').disabled = false;
    el('mainAction').textContent = tr('Start LIVE', 'Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ LIVE');
    setStatus(tr('LIVE ended', 'Р В­РЎвЂћР С‘РЎР‚ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…'), '');
    setStage('', tr('The live session has ended.', 'Р В­РЎвЂћР С‘РЎР‚ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р….'));
    currentSession = currentSession ? Object.assign({}, currentSession, { status: 'ended', ended_at: new Date().toISOString() }) : null;
    updateShareLink(currentSession);
    renderWorkspace(currentSession);
    if (currentUser?.id) await loadHostTimeline();
  }
  function showSoundPill(remoteUser) {
    var pill = el('soundPill');
    pill.style.display = 'block';
    pill.textContent = tr('Tap for sound', 'Р СњР В°Р В¶Р СР С‘РЎвЂљР Вµ Р Т‘Р В»РЎРЏ Р В·Р Р†РЎС“Р С”Р В°');
    pill.onclick = function () {
      try {
        remoteUser.audioTrack.play();
        pill.style.display = 'none';
      } catch (e) {}
    };
  }
  async function preloadHostSession() {
    try {
      var authSession = await requireSessionForHost();
      currentUser = authSession.user;
      await loadHostTimeline();
      if (!sessionId) return;
      currentSession = await loadLiveSession(sessionId);
      if (currentSession.teacher_id && currentSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Р В­РЎвЂљР С•РЎвЂљ LIVE Р С—РЎР‚Р С‘Р Р…Р В°Р Т‘Р В»Р ВµР В¶Р С‘РЎвЂљ Р Т‘РЎР‚РЎС“Р С–Р С•Р СРЎС“ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎР‹.'));
      }
      teacher = currentSession.teacher_name || teacher;
      applySessionToInputs(currentSession);
      updateShareLink(currentSession);
      if (currentSession.topic) el('title').textContent = currentSession.topic;
      if (currentSession.status === 'scheduled') {
        el('mainAction').textContent = tr('Go LIVE now', 'Р вЂ™РЎвЂ№Р в„–РЎвЂљР С‘ Р Р† LIVE');
        setStatus(tr('Scheduled', 'Р вЂ”Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С•'), 'ready');
        setStage('', tr('This room is scheduled and ready for launch from this browser.', 'Р В­РЎвЂљР В° Р С”Р С•Р СР Р…Р В°РЎвЂљР В° Р В·Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р В° Р С‘ Р С–Р С•РЎвЂљР С•Р Р†Р В° Р С” Р В·Р В°Р С—РЎС“РЎРѓР С”РЎС“ Р С‘Р В· РЎРЊРЎвЂљР С•Р С–Р С• Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°.'));
      } else if (currentSession.status === 'ended') {
        setStatus(tr('Ended', 'Р вЂ”Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…'), '');
        setStage('', tr('This room ended earlier. Update details or reuse it for the next lesson.', 'Р В­РЎвЂљР В° Р С”Р С•Р СР Р…Р В°РЎвЂљР В° РЎС“Р В¶Р Вµ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р В°Р В»Р В°РЎРѓРЎРЉ. Р С›Р В±Р Р…Р С•Р Р†Р С‘РЎвЂљР Вµ Р Т‘Р ВµРЎвЂљР В°Р В»Р С‘ Р С‘Р В»Р С‘ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ Р ВµР Вµ РЎРѓР Р…Р С•Р Р†Р В° Р Т‘Р В»РЎРЏ РЎРѓР В»Р ВµР Т‘РЎС“РЎР‹РЎвЂ°Р ВµР С–Р С• РЎС“РЎР‚Р С•Р С”Р В°.'));
      }
      renderWorkspace(currentSession);
    } catch (error) {
      setNote(error?.message || tr('Could not load teacher session.', 'Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р В·Р В°Р С–РЎР‚РЎС“Р В·Р С‘РЎвЂљРЎРЉ teacher session.'));
    }
  }
  function setupMode() {
    document.documentElement.lang = isRu ? 'ru' : 'en';
    document.querySelector('label[for="topicInput"]').textContent = tr('LIVE title', 'Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ LIVE');
    document.querySelector('label[for="levelInput"]').textContent = tr('Level', 'Р Р€РЎР‚Р С•Р Р†Р ВµР Р…РЎРЉ');
    document.querySelector('label[for="languageInput"]').textContent = tr('Language', 'Р Р‡Р В·РЎвЂ№Р С”');
    document.querySelector('label[for="scheduleDateInput"]').textContent = tr('Start date', 'Р вЂќР В°РЎвЂљР В° РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В°');
    document.querySelector('label[for="scheduleTimeInput"]').textContent = tr('Start time', 'Р вЂ™РЎР‚Р ВµР СРЎРЏ РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В°');
    document.querySelector('label[for="shareUrl"]').textContent = tr('Student watch link', 'Р РЋРЎРѓРЎвЂ№Р В»Р С”Р В° Р Т‘Р В»РЎРЏ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В° РЎС“РЎвЂЎР ВµР Р…Р С‘Р С”Р В°Р С');
    document.querySelector('#hostSetup .check-row span').textContent = tr('Private room', 'Р СџРЎР‚Р С‘Р Р†Р В°РЎвЂљР Р…Р В°РЎРЏ Р С”Р С•Р СР Р…Р В°РЎвЂљР В°');
    el('topicInput').value = tr('Live lesson', 'Live-РЎС“РЎР‚Р С•Р С”');
    el('soundPill').textContent = tr('Tap for sound', 'Р СњР В°Р В¶Р СР С‘РЎвЂљР Вµ Р Т‘Р В»РЎРЏ Р В·Р Р†РЎС“Р С”Р В°');
    applyDefaultScheduleInputs();
    el('openApp').href = makeDeepLink();
    el('openApp').addEventListener('click', function (event) {
      event.preventDefault();
      window.location.href = makeDeepLink();
    });
    el('copyShare').addEventListener('click', async function () {
      el('shareUrl').select();
      try { await navigator.clipboard.writeText(el('shareUrl').value); }
      catch (e) { document.execCommand('copy'); }
      el('copyShare').textContent = tr('Copied', 'Р РЋР С”Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р С•');
      setTimeout(function () { el('copyShare').textContent = tr('Copy link', 'Р С™Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“'); }, 1200);
    });
    el('endLive').addEventListener('click', endHost);
    el('toggleMic').addEventListener('click', function () { void toggleMic(); });
    el('toggleCam').addEventListener('click', function () { void toggleCam(); });
    el('scheduleSession').addEventListener('click', function () { void scheduleHostSession(); });
    window.addEventListener('beforeunload', function () {
      if (isHostMode) void stopMedia(true);
      else void stopMedia(false);
    });

    if (isHostMode) {
      document.title = tr('Duvela LIVE - teacher studio', 'Duvela LIVE - teacher studio');
      el('modePill').textContent = tr('Bus Web - Teacher Live', 'Bus Web - Teacher Live');
      el('studioKicker').textContent = tr('Teacher studio', 'Teacher studio');
      el('stageCardTitle').textContent = tr('Run the lesson from one broadcast workspace', 'Р вЂ™Р ВµР Т‘Р С‘РЎвЂљР Вµ РЎС“РЎР‚Р С•Р С” Р С‘Р В· Р С•Р Т‘Р Р…Р С•Р С–Р С• broadcast workspace');
      el('stageCardCopy').textContent = tr('Preview the camera, manage room status, and control the live session without leaving this screen.', 'Р СџРЎР‚Р С•РЎРѓР СР В°РЎвЂљРЎР‚Р С‘Р Р†Р В°Р в„–РЎвЂљР Вµ Р С”Р В°Р СР ВµРЎР‚РЎС“, РЎС“Р С—РЎР‚Р В°Р Р†Р В»РЎРЏР в„–РЎвЂљР Вµ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓР С•Р С Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р С‘ Р Р†Р ВµР Т‘Р С‘РЎвЂљР Вµ РЎРЊРЎвЂћР С‘РЎР‚, Р Р…Р Вµ Р Р†РЎвЂ№РЎвЂ¦Р С•Р Т‘РЎРЏ РЎРѓ РЎРЊРЎвЂљР С•Р С–Р С• РЎРЊР С”РЎР‚Р В°Р Р…Р В°.');
      el('stageChipPrimary').textContent = tr('Host preview', 'Host preview');
      el('stageChipSecondary').textContent = tr('Camera + mic live', 'Camera + mic live');
      el('sideKicker').textContent = tr('Studio panel', 'Studio panel');
      el('badgeText').textContent = 'TEACHER LIVE';
      el('title').textContent = sessionId ? tr('Enter teacher LIVE', 'Р вЂ™Р С•Р в„–РЎвЂљР С‘ Р Р† teacher LIVE') : tr('Start teacher LIVE', 'Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ teacher LIVE');
      el('subtitle').textContent = tr('Create a live room and publish camera plus microphone from this browser.', 'Р РЋР С•Р В·Р Т‘Р В°Р в„–РЎвЂљР Вµ live-Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“ Р С‘ Р Р†РЎвЂ№Р в„–Р Т‘Р С‘РЎвЂљР Вµ Р Р† РЎРЊРЎвЂћР С‘РЎР‚ РЎРѓ Р С”Р В°Р СР ВµРЎР‚РЎвЂ№ Р С‘ Р СР С‘Р С”РЎР‚Р С•РЎвЂћР С•Р Р…Р В° Р С‘Р В· Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°.');
      el('sideTitle').textContent = tr('Teacher controls', 'Р Р€Р С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘Р Вµ teacher LIVE');
      el('sideCopy').textContent = tr('Run the live room from the browser, keep session details clear, and hand off learners with the right entry link.', 'Р вЂ”Р В°Р С—РЎС“РЎРѓР С”Р В°Р в„–РЎвЂљР Вµ РЎРЊРЎвЂћР С‘РЎР‚ Р С‘Р В· Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°, Р Т‘Р ВµРЎР‚Р В¶Р С‘РЎвЂљР Вµ Р Т‘Р В°Р Р…Р Р…РЎвЂ№Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р Р† Р С—Р С•РЎР‚РЎРЏР Т‘Р С”Р Вµ Р С‘ Р С—Р ВµРЎР‚Р ВµР Р†Р С•Р Т‘Р С‘РЎвЂљР Вµ РЎС“РЎвЂЎР ВµР Р…Р С‘Р С”Р С•Р Р† Р С—Р С• Р С—РЎР‚Р В°Р Р†Р С‘Р В»РЎРЉР Р…Р С•Р в„– РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р Вµ Р Р†РЎвЂ¦Р С•Р Т‘Р В°.');
      el('setupSection').style.display = 'grid';
      el('hostSetup').style.display = 'grid';
      el('scheduleSetup').style.display = 'grid';
      el('setupTitle').textContent = tr('Session setup', 'Р СњР В°РЎРѓРЎвЂљРЎР‚Р С•Р в„–Р С”Р В° РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘');
      el('setupCopy').textContent = tr('Prepare room details, set the next time slot, then launch or reuse the same room.', 'Р СџР С•Р Т‘Р С–Р С•РЎвЂљР С•Р Р†РЎРЉРЎвЂљР Вµ Р Т‘Р ВµРЎвЂљР В°Р В»Р С‘ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№, Р В·Р В°Р Т‘Р В°Р в„–РЎвЂљР Вµ Р В±Р В»Р С‘Р В¶Р В°Р в„–РЎв‚¬Р С‘Р в„– РЎРѓР В»Р С•РЎвЂљ Р С‘ Р В·Р В°РЎвЂљР ВµР С Р В·Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљР Вµ Р С‘Р В»Р С‘ Р С—Р ВµРЎР‚Р ВµР С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“.');
      el('linksTitle').textContent = tr('Studio links', 'Р РЋРЎРѓРЎвЂ№Р В»Р С”Р С‘ РЎРѓРЎвЂљРЎС“Р Т‘Р С‘Р С‘');
      el('linksCopy').textContent = tr('Use browser and app entry points for the same live room.', 'Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Р…РЎвЂ№Р в„– Р С‘ Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р в„– Р Р†РЎвЂ¦Р С•Р Т‘ Р Т‘Р В»РЎРЏ Р С•Р Т‘Р Р…Р С•Р в„– Р С‘ РЎвЂљР С•Р в„– Р В¶Р Вµ live-Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№.');
      el('detailsTitle').textContent = tr('Room details', 'Р вЂќР ВµРЎвЂљР В°Р В»Р С‘ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№');
      el('detailsCopy').textContent = tr('Session state, access and teaching details update here.', 'Р вЂ”Р Т‘Р ВµРЎРѓРЎРЉ Р С•Р В±Р Р…Р С•Р Р†Р В»РЎРЏРЎР‹РЎвЂљРЎРѓРЎРЏ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘, Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р С‘ РЎС“РЎвЂЎР ВµР В±Р Р…РЎвЂ№Р Вµ Р С—Р В°РЎР‚Р В°Р СР ВµРЎвЂљРЎР‚РЎвЂ№.');
      el('checklistTitle').textContent = tr('Broadcast checklist', 'Р В§Р ВµР С”Р В»Р С‘РЎРѓРЎвЂљ РЎРЊРЎвЂћР С‘РЎР‚Р В°');
      el('checklistCopy').textContent = tr('Use this checklist before and during the lesson.', 'Р СџР С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР ВµРЎРѓРЎРЉ РЎРЊРЎвЂљР С‘Р С РЎвЂЎР ВµР С”Р В»Р С‘РЎРѓРЎвЂљР С•Р С Р Т‘Р С• РЎРѓРЎвЂљР В°РЎР‚РЎвЂљР В° Р С‘ Р Р†Р С• Р Р†РЎР‚Р ВµР СРЎРЏ РЎС“РЎР‚Р С•Р С”Р В°.');
      el('diagnosticsTitle').textContent = tr('Diagnostics', 'Р вЂќР С‘Р В°Р С–Р Р…Р С•РЎРѓРЎвЂљР С‘Р С”Р В°');
      el('diagnosticsCopy').textContent = tr('Check browser readiness, room access and device state before you go live.', 'Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ Р С–Р С•РЎвЂљР С•Р Р†Р Р…Р С•РЎРѓРЎвЂљРЎРЉ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В°, Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р С‘ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ РЎС“РЎРѓРЎвЂљРЎР‚Р С•Р в„–РЎРѓРЎвЂљР Р† Р Т‘Р С• Р В·Р В°Р С—РЎС“РЎРѓР С”Р В°.');
      el('timelineTitle').textContent = tr('Session timeline', 'Р вЂєР ВµР Р…РЎвЂљР В° РЎРѓР ВµРЎРѓРЎРѓР С‘Р в„–');
      el('timelineCopy').textContent = tr('Keep upcoming and recent rooms in one operational view.', 'Р вЂќР ВµРЎР‚Р В¶Р С‘РЎвЂљР Вµ Р В±Р В»Р С‘Р В¶Р В°Р в„–РЎв‚¬Р С‘Р Вµ Р С‘ Р Р…Р ВµР Т‘Р В°Р Р†Р Р…Р С‘Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р Р† Р С•Р Т‘Р Р…Р С•Р С РЎР‚Р В°Р В±Р С•РЎвЂЎР ВµР С РЎРѓР С—Р С‘РЎРѓР С”Р Вµ.');
      el('timelineUpcomingTitle').textContent = tr('Upcoming', 'Р вЂР В»Р С‘Р В¶Р В°Р в„–РЎв‚¬Р С‘Р Вµ');
      el('timelineHistoryTitle').textContent = tr('Recent', 'Р СњР ВµР Т‘Р В°Р Р†Р Р…Р С‘Р Вµ');
      el('scheduleSession').textContent = tr('Schedule session', 'Р вЂ”Р В°Р С—Р В»Р В°Р Р…Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРѓР ВµРЎРѓРЎРѓР С‘РЎР‹');
      el('mainAction').textContent = sessionId ? tr('Open as teacher', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р С”Р В°Р С” teacher') : tr('Start LIVE', 'Р вЂ”Р В°Р С—РЎС“РЎРѓРЎвЂљР С‘РЎвЂљРЎРЉ LIVE');
      el('mainAction').addEventListener('click', startHost);
      el('dashboardLink').href = './app.html?role=teacher#live';
      el('backLink').href = './app.html?role=teacher#live';
      el('openApp').textContent = tr('Open in the Duvela app', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р С‘ Duvela');
      el('dashboardLink').textContent = tr('Back to web dashboard', 'Р СњР В°Р В·Р В°Р Т‘ Р Р† Р Р†Р ВµР В±-Р С”Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљ');
      el('copyShare').textContent = tr('Copy link', 'Р С™Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“');
      renderWorkspace({
        teacher_name: teacher || displayName({}),
        topic: el('topicInput').value,
        level: el('levelInput').value || 'B1',
        language: el('languageInput').value,
        is_private: false
      });
      setStatus(tr('Ready for teacher', 'Р вЂњР С•РЎвЂљР С•Р Р†Р С• Р Т‘Р В»РЎРЏ teacher'), 'ready');
      void preloadHostSession();
      return;
    }

    if (teacher) el('title').textContent = teacherWatchTitle(teacher);
    el('modePill').textContent = isBusiness ? tr('Business viewer', 'Business viewer') : tr('Hub Web viewer', 'Hub Web viewer');
    el('studioKicker').textContent = tr('Viewer stage', 'Р РЋРЎвЂ Р ВµР Р…Р В° Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В°');
    el('stageCardTitle').textContent = tr('Watch the live lesson in a clean stage view', 'Р РЋР СР С•РЎвЂљРЎР‚Р С‘РЎвЂљР Вµ live-РЎС“РЎР‚Р С•Р С” Р Р† РЎвЂЎР С‘РЎРѓРЎвЂљР С•Р С РЎРѓРЎвЂ Р ВµР Р…Р С‘РЎвЂЎР ВµРЎРѓР С”Р С•Р С РЎР‚Р ВµР В¶Р С‘Р СР Вµ');
    el('stageCardCopy').textContent = tr('Playback, chat, gifts, and room status stay close without crowding the video.', 'Р СџРЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚, РЎвЂЎР В°РЎвЂљ, Р С—Р С•Р Т‘Р В°РЎР‚Р С”Р С‘ Р С‘ РЎРѓРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р С•РЎРѓРЎвЂљР В°РЎР‹РЎвЂљРЎРѓРЎРЏ РЎР‚РЎРЏР Т‘Р С•Р С Р С‘ Р Р…Р Вµ Р С—Р ВµРЎР‚Р ВµР С–РЎР‚РЎС“Р В¶Р В°РЎР‹РЎвЂљ Р Р†Р С‘Р Т‘Р ВµР С•.');
    el('stageChipPrimary').textContent = tr('Viewer playback', 'Viewer playback');
    el('stageChipSecondary').textContent = tr('Live room access', 'Live room access');
    el('sideKicker').textContent = tr('Room panel', 'Р СџР В°Р Р…Р ВµР В»РЎРЉ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№');
    el('mainAction').textContent = tr('Watch now', 'Р РЋР СР С•РЎвЂљРЎР‚Р ВµРЎвЂљРЎРЉ');
    el('mainAction').addEventListener('click', watch);
    el('dashboardLink').href = './app.html?role=learner#live';
    el('backLink').href = './app.html?role=learner#live';
    el('sideTitle').textContent = tr('Live room', 'Live-Р С”Р С•Р СР Р…Р В°РЎвЂљР В°');
    el('sideCopy').textContent = tr('Use the browser to watch the lesson, or move the same session into the Duvela app.', 'Р РЋР СР С•РЎвЂљРЎР‚Р С‘РЎвЂљР Вµ РЎС“РЎР‚Р С•Р С” Р Р† Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Вµ Р С‘Р В»Р С‘ Р С—Р ВµРЎР‚Р ВµР Р…Р С•РЎРѓР С‘РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ РЎРѓР ВµРЎРѓРЎРѓР С‘РЎР‹ Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ Duvela.');
    el('linksTitle').textContent = tr('Access links', 'Р РЋРЎРѓРЎвЂ№Р В»Р С”Р С‘ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р В°');
    el('linksCopy').textContent = tr('Switch between browser playback and the mobile app when needed.', 'Р СџРЎР‚Р С‘ Р Р…Р ВµР С•Р В±РЎвЂ¦Р С•Р Т‘Р С‘Р СР С•РЎРѓРЎвЂљР С‘ Р С—Р ВµРЎР‚Р ВµР С”Р В»РЎР‹РЎвЂЎР В°Р в„–РЎвЂљР ВµРЎРѓРЎРЉ Р СР ВµР В¶Р Т‘РЎС“ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р Р…РЎвЂ№Р С Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р С•Р С Р С‘ Р СР С•Р В±Р С‘Р В»РЎРЉР Р…РЎвЂ№Р С Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р ВµР С.');
    el('detailsTitle').textContent = tr('Room details', 'Р вЂќР ВµРЎвЂљР В°Р В»Р С‘ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№');
    el('detailsCopy').textContent = tr('Session state updates as the teacher joins or ends the room.', 'Р РЋР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘ Р С•Р В±Р Р…Р С•Р Р†Р В»РЎРЏР ВµРЎвЂљРЎРѓРЎРЏ, Р С”Р С•Р С–Р Т‘Р В° Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р С—Р С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР В°Р ВµРЎвЂљРЎРѓРЎРЏ Р С‘Р В»Р С‘ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р В°Р ВµРЎвЂљ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎС“.');
    el('checklistTitle').textContent = tr('Watch checklist', 'Р В§Р ВµР С”Р В»Р С‘РЎРѓРЎвЂљ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В°');
    el('checklistCopy').textContent = tr('Use these steps if the stream is not immediately available.', 'Р ВРЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ РЎРЊРЎвЂљР С‘ РЎв‚¬Р В°Р С–Р С‘, Р ВµРЎРѓР В»Р С‘ РЎРЊРЎвЂћР С‘РЎР‚ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р… Р Р…Р Вµ РЎРѓРЎР‚Р В°Р В·РЎС“.');
    el('diagnosticsTitle').textContent = tr('Playback diagnostics', 'Р вЂќР С‘Р В°Р С–Р Р…Р С•РЎРѓРЎвЂљР С‘Р С”Р В° Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В°');
    el('diagnosticsCopy').textContent = tr('Check room state and browser readiness before moving into the app.', 'Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ РЎРѓР С•РЎРѓРЎвЂљР С•РЎРЏР Р…Р С‘Р Вµ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р С‘ Р С–Р С•РЎвЂљР С•Р Р†Р Р…Р С•РЎРѓРЎвЂљРЎРЉ Р В±РЎР‚Р В°РЎС“Р В·Р ВµРЎР‚Р В° Р С—Р ВµРЎР‚Р ВµР Т‘ Р С—Р ВµРЎР‚Р ВµРЎвЂ¦Р С•Р Т‘Р С•Р С Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р Вµ.');
    el('openApp').textContent = tr('Open in the Duvela app', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р Р† Р С—РЎР‚Р С‘Р В»Р С•Р В¶Р ВµР Р…Р С‘Р С‘ Duvela');
    el('dashboardLink').textContent = tr('Back to web dashboard', 'Р СњР В°Р В·Р В°Р Т‘ Р Р† Р Р†Р ВµР В±-Р С”Р В°Р В±Р С‘Р Р…Р ВµРЎвЂљ');
    el('copyShare').textContent = tr('Copy link', 'Р С™Р С•Р С—Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“');
    el('viewerActionsSection').style.display = 'grid';
    el('viewerActionsTitle').textContent = tr('Live interaction', 'Р вЂ™Р В·Р В°Р С‘Р СР С•Р Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘Р Вµ Р Р† LIVE');
    el('viewerActionsCopy').textContent = tr('Join the room chat and send a gift while the lesson is live.', 'Р СџР С•Р Т‘Р С”Р В»РЎР‹РЎвЂЎР В°Р в„–РЎвЂљР ВµРЎРѓРЎРЉ Р С” РЎвЂЎР В°РЎвЂљРЎС“ Р С”Р С•Р СР Р…Р В°РЎвЂљРЎвЂ№ Р С‘ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»РЎРЏР в„–РЎвЂљР Вµ Р С—Р С•Р Т‘Р В°РЎР‚Р С”Р С‘, Р С—Р С•Р С”Р В° РЎС“РЎР‚Р С•Р С” Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ.');
    el('openChat').textContent = tr('Open chat', 'Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ РЎвЂЎР В°РЎвЂљ');
    el('openGift').textContent = tr('Send gift', 'Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р Т‘Р В°РЎР‚Р С•Р С”');
    el('giftTitle').textContent = tr('Send a gift', 'Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р Т‘Р В°РЎР‚Р С•Р С”');
    el('giftCopy').textContent = tr('Choose one gift for the live teacher.', 'Р вЂ™РЎвЂ№Р В±Р ВµРЎР‚Р С‘РЎвЂљР Вµ Р С•Р Т‘Р С‘Р Р… Р С—Р С•Р Т‘Р В°РЎР‚Р С•Р С” Р Т‘Р В»РЎРЏ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎРЏ Р Р† РЎРЊРЎвЂћР С‘РЎР‚Р Вµ.');
    el('cancelGift').textContent = tr('Cancel', 'Р С›РЎвЂљР СР ВµР Р…Р В°');
    el('sendGift').textContent = tr('Send gift', 'Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С•Р Т‘Р В°РЎР‚Р С•Р С”');
    el('chatInput').placeholder = tr('Write to the teacher...', 'Р СњР В°Р С—Р С‘РЎв‚¬Р С‘РЎвЂљР Вµ Р С—РЎР‚Р ВµР С—Р С•Р Т‘Р В°Р Р†Р В°РЎвЂљР ВµР В»РЎР‹...');
    el('sendChat').textContent = tr('Send', 'Р С›РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ');
    el('openChat').addEventListener('click', openChatPanel);
    el('openGift').addEventListener('click', openGiftModal);
    el('closeGift').addEventListener('click', closeGiftModal);
    el('cancelGift').addEventListener('click', closeGiftModal);
    el('sendGift').addEventListener('click', function () { void sendViewerGift(); });
    el('chatForm').addEventListener('submit', function (event) {
      event.preventDefault();
      void sendViewerMessage();
    });
    renderGiftGrid();
    renderViewerBalance();
    renderViewerMessages();
    setViewerControlsEnabled(false);
    setStatus(sessionId ? tr('Ready to watch', 'Р вЂњР С•РЎвЂљР С•Р Р†Р С• Р С” Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚РЎС“') : tr('No session selected', 'Р РЋР ВµРЎРѓРЎРѓР С‘РЎРЏ Р Р…Р Вµ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р В°'), sessionId ? 'ready' : '');
    renderWorkspace({ teacher_name: teacher || '', level: '', language: '', is_private: false });
    if (sessionId) setTimeout(function () { void watch(); }, 250);
  }

  setupMode();
})();

