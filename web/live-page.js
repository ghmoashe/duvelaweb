(function () {
  var AGORA_APP_ID = '7dbbced847dc459ba72f7ee6e2426c11';
  var LIVE_FIELDS = 'id,channel_name,teacher_id,teacher_name,teacher_avatar_url,language,level,topic,price_per_minute,status,started_at,ended_at,created_at,heartbeat_at,is_private,material_url,allow_guest_requests,min_viewer_age,video_quality';
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
  var deepARInstance = null;
  var hostCameraStream = null;
  var deepARCanvasStream = null;
  var hostPreviewPromise = null;
  var selectedLiveEffect = 'makeup';
  var cameraFacingMode = 'user';
  var isHostPublishing = false;
  var EFFECT_PATHS = {
    makeup: './web/effects/MakeupLook.deepar',
    hearts: './web/effects/PixelHearts.deepar',
    aviators: 'https://cdn.jsdelivr.net/npm/deepar@5.6.22/effects/aviators',
    koala: 'https://cdn.jsdelivr.net/npm/deepar@5.6.22/effects/koala',
    lion: 'https://cdn.jsdelivr.net/npm/deepar@5.6.22/effects/lion'
  };
  var currentSession = null;
  var materialChannel = null;
  var heartbeatTimer = null;
  var sessionPollTimer = null;
  var restreamStatusTimer = null;
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
    { id: 'rose', emoji: '🌹', name: 'Rose', cost: 0 },
    { id: 'heart', emoji: '❤️', name: 'Heart', cost: 0 },
    { id: 'coffee', emoji: '☕', name: 'Coffee', cost: 0 },
    { id: 'book', emoji: '📖', name: 'Book', cost: 0 },
    { id: 'fire-gift', emoji: '🔥', name: 'Fire gift', cost: 10 },
    { id: 'crown', emoji: '👑', name: 'Crown', cost: 12 },
    { id: 'magic-box', emoji: '🎁', name: 'Magic Box', cost: 15 },
    { id: 'watch', emoji: '⌚', name: 'Watch', cost: 16 },
    { id: 'diamond', emoji: '💎', name: 'Diamond', cost: 18 },
    { id: 'duvela-star', emoji: '🌟', name: 'DUVELA Star', cost: 20 }
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
      || tr('Student', 'Ученик');
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
    return cost > 0 ? cost + ' coin' : tr('Free', 'Бесплатно');
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
      text = tr('Duvela balance: ', 'Баланс Duvela: ') + '—';
    } else if (viewerBalance == null) {
      text = tr('Duvela balance: sign in with a learner account for gifts', 'Баланс Duvela: войдите как ученик, чтобы отправлять подарки');
    } else {
      text = tr('Duvela balance: ', 'Баланс Duvela: ') + viewerBalance;
    }
    el('viewerBalance').innerHTML = text.replace(/(\d+|—)$/, '<b>$1</b>');
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
      el('chatList').innerHTML = '<div class="chat-empty">' + esc(tr('No live messages yet. Start the conversation.', 'Сообщений в эфире пока нет. Начните разговор.')) + '</div>';
      return;
    }
    el('chatList').innerHTML = viewerMessages.map(function (message) {
      var isOwn = currentUser?.id && message.sender_id === currentUser.id;
      var classes = 'chat-message';
      if (message.role === 'system') classes += ' system';
      else if (isOwn) classes += ' own';
      return '<div class="' + classes + '">' +
        '<div class="chat-meta">' +
          '<span>' + esc(message.sender_name || tr('Live chat', 'Чат эфира')) + '</span>' +
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
    setTimeout(function () { el('closeGift')?.focus(); }, 30);
  }
  async function loadViewerBalance() {
    if (!currentUser?.id || !supa) {
      viewerBalance = null;
      renderViewerBalance();
      return;
    }
    var result = await supa.from('profiles').select('vela_coin_balance').eq('id', currentUser.id).maybeSingle();
    viewerBalance = typeof result.data?.vela_coin_balance === 'number' ? result.data.vela_coin_balance : null;
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
  var RESTREAM_PLATFORMS = ['youtube', 'facebook', 'tiktok'];
  var RESTREAM_DEFAULT_URLS = {
    youtube: 'rtmp://a.rtmp.youtube.com/live2',
    facebook: 'rtmps://live-api-s.facebook.com:443/rtmp',
    tiktok: ''
  };
  function restreamRow(platform) {
    return document.querySelector('.restream-row[data-platform="' + platform + '"]');
  }
  async function loadRestreamTargets() {
    if (!supa || !currentUser?.id) return;
    try {
      var res = await supa.from('live_restream_targets')
        .select('platform,rtmp_url,stream_key,enabled')
        .eq('teacher_id', currentUser.id);
      var rows = res.data || [];
      rows.forEach(function (row) {
        var el2 = restreamRow(row.platform);
        if (!el2) return;
        el2.querySelector('.restreamUrl').value = row.rtmp_url || '';
        el2.querySelector('.restreamKey').value = row.stream_key || '';
        el2.querySelector('.restreamEnabled').checked = Boolean(row.enabled);
      });
    } catch (e) { /* best-effort */ }
  }
  async function saveRestreamTargets() {
    if (!supa || !currentUser?.id) return;
    var status = el('restreamStatus');
    var btn = el('saveRestreamBtn');
    btn.disabled = true;
    status.textContent = tr('Saving...', 'Сохранение...');
    try {
      var payload = RESTREAM_PLATFORMS.map(function (platform) {
        var row = restreamRow(platform);
        return {
          teacher_id: currentUser.id,
          platform: platform,
          rtmp_url: row.querySelector('.restreamUrl').value.trim(),
          stream_key: row.querySelector('.restreamKey').value.trim(),
          enabled: row.querySelector('.restreamEnabled').checked,
          updated_at: new Date().toISOString()
        };
      }).filter(function (row) { return row.enabled ? Boolean(row.rtmp_url) : true; });
      var res = await supa.from('live_restream_targets').upsert(payload, { onConflict: 'teacher_id,platform' });
      status.textContent = res.error
        ? (tr('Could not save: ', 'Не удалось сохранить: ') + res.error.message)
        : tr('Saved.', 'Сохранено.');
    } catch (e) {
      status.textContent = tr('Could not save.', 'Не удалось сохранить.');
    } finally {
      btn.disabled = false;
      setTimeout(function () { status.textContent = ''; }, 3000);
    }
  }
  async function startRestream(channelName, hostUid) {
    if (!supa) return;
    try {
      var res = await supa.functions.invoke('live-restream', {
        body: { action: 'start', channelName: channelName, hostUid: hostUid }
      });
      var results = res?.data?.results || {};
      var started = Object.keys(results).filter(function (p) { return results[p] === 'started'; });
      if (started.length) { setNote(tr('Also live on: ', 'Также в эфире на: ') + started.join(', ')); startRestreamStatusPolling(); }
    } catch (e) { /* best-effort, LIVE itself keeps running */ }
  }
  async function stopRestream() {
    if (restreamStatusTimer) { clearInterval(restreamStatusTimer); restreamStatusTimer = null; }
    if (!supa) return;
    try { await supa.functions.invoke('live-restream', { body: { action: 'stop' } }); }
    catch (e) { /* converters auto-expire */ }
  }
  function startRestreamStatusPolling() {
    if (restreamStatusTimer) clearInterval(restreamStatusTimer);
    var warned = {};
    var check = async function () {
      try {
        var res = await supa.functions.invoke('live-restream', { body: { action: 'status' } });
        var results = res?.data?.results || {};
        Object.keys(results).forEach(function (p) {
          var s = results[p];
          if ((s === 'stopped' || s.indexOf('error') === 0) && !warned[p]) {
            warned[p] = true;
            setNote(tr(p + ' disconnected', p + ' отключился'));
          }
        });
      } catch (e) { /* ignore */ }
    };
    setTimeout(check, 15000);
    restreamStatusTimer = setInterval(check, 45000);
  }
  function displayName(user) {
    return user.user_metadata?.full_name || user.email?.split('@')[0] || tr('Duvela teacher', 'Преподаватель Duvela');
  }
  function teacherWatchTitle(name) {
    return (name || tr('A teacher', 'Преподаватель')) + tr(' is live on Duvela', ' в эфире на Duvela');
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
    return [formatDateLabel(value), formatTimeLabel(value)].filter(Boolean).join(' · ');
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
    var roomLabel = tr('Room', 'Комната');
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
    return session?.is_private ? tr('Private', 'Приватная') : tr('Public', 'Публичная');
  }
  function sessionStatusLabel(session) {
    if (session?.status === 'live') return tr('Live', 'В эфире');
    if (session?.status === 'scheduled') return tr('Scheduled', 'Запланирована');
    if (session?.status === 'ended') return tr('Ended', 'Завершена');
    if (isHostMode) return tr('Ready', 'Готово');
    return sessionId ? tr('Waiting', 'Ожидание') : tr('No session', 'Нет сессии');
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
    el('allowViewerRequests').checked = session.allow_guest_requests !== false;
    el('audience18Plus').checked = session.min_viewer_age === 18;
    el('videoQuality').value = session.video_quality || 'auto';
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
      { label: tr('Teacher', 'Преподаватель'), value: session?.teacher_name || teacher || tr('Waiting', 'Ожидание') },
      { label: tr('Title', 'Название'), value: session?.topic || el('topicInput')?.value || tr('Live lesson', 'Живой урок') },
      { label: tr('Level', 'Уровень'), value: session?.level || el('levelInput')?.value || tr('Open', 'Любой') },
      { label: tr('Language', 'Язык'), value: session?.language || el('languageInput')?.value || tr('General', 'Общий') },
      { label: tr('Timing', 'Время'), value: timing || tr('Not scheduled', 'Не запланировано') },
      { label: tr('Access', 'Доступ'), value: accessLabel(session) },
      { label: tr('Status', 'Статус'), value: sessionStatusLabel(session) }
    ];
    el('sessionFacts').innerHTML = facts.map(function (fact) {
      return '<div class="fact"><span>' + esc(fact.label) + '</span><b>' + esc(fact.value) + '</b></div>';
    }).join('');
  }
  function renderStudioMetrics(session) {
    var metrics;
    if (isHostMode) {
      metrics = [
        { label: tr('Mode', 'Режим'), value: tr('Teacher host', 'Ведущий-преподаватель') },
        { label: tr('Room', 'Комната'), value: sessionStatusLabel(session) },
        { label: tr('Upcoming', 'Предстоящие'), value: String(hostScheduledSessions.length) },
        { label: tr('Distribution', 'Распространение'), value: session?.id ? (session?.is_private ? tr('App access', 'Через приложение') : tr('Watch link ready', 'Ссылка готова')) : tr('After room save', 'После сохранения комнаты') }
      ];
    } else {
      metrics = [
        { label: tr('Mode', 'Режим'), value: tr('Browser viewer', 'Просмотр в браузере') },
        { label: tr('Room', 'Комната'), value: sessionStatusLabel(session) },
        { label: tr('Access', 'Доступ'), value: accessLabel(session) },
        { label: tr('Entry', 'Вход'), value: sessionId ? tr('Session opened', 'Сессия открыта') : tr('Choose a session', 'Выберите сессию') }
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
    document.body.classList.toggle('is-live', shouldShow);
    if (!shouldShow) return;
    el('stripTeacher').textContent = session?.teacher_name || currentUser?.user_metadata?.full_name || tr('Teacher', 'Преподаватель');
    el('stripTopic').textContent = session?.topic || tr('Live lesson', 'Живой урок');
    el('stripStatus').textContent = tr('LIVE', 'ЭФИР');
    el('stripLevel').textContent = session?.level || tr('Open', 'Любой');
    el('stripLanguage').textContent = session?.language || tr('General', 'Общий');
    el('stripAccess').textContent = accessLabel(session);
    updateStageStripRuntime(session);
  }
  function renderStudioChecklist(session) {
    var items;
    if (isHostMode) {
      if (session?.status === 'live') {
        items = [
          {
            title: tr('Share the room', 'Поделитесь комнатой'),
            copy: session?.is_private
              ? tr('Private rooms should be handed off through the app or your approved access flow.', 'Приватные комнаты лучше открывать через приложение или ваш подтверждённый способ доступа.')
              : tr('Send the browser watch link to learners while the stream is live.', 'Пока эфир идёт, отправьте ученикам ссылку для просмотра в браузере.')
          },
          {
            title: tr('Keep this tab open', 'Не закрывайте вкладку'),
            copy: tr('Camera, microphone and room heartbeat stay active while this page remains open.', 'Камера, микрофон и связь с комнатой работают, пока открыта эта страница.')
          },
          {
            title: tr('Use stage controls', 'Управляйте эфиром со сцены'),
            copy: tr('Mute microphone, stop camera or end the room from the footer controls under the video stage.', 'Выключайте микрофон, камеру или завершайте эфир кнопками под видео.')
          }
        ];
      } else if (session?.status === 'scheduled') {
        items = [
          {
            title: tr('Keep the slot clear', 'Держите время свободным'),
            copy: tr('Open the same room shortly before the lesson and launch LIVE from this browser.', 'Откройте эту же комнату незадолго до урока и запустите эфир из браузера.')
          },
          {
            title: tr('Review access mode', 'Проверьте режим доступа'),
            copy: session?.is_private
              ? tr('Private sessions should continue through the app or your approved access path.', 'Приватные сессии лучше продолжать через приложение или ваш подтверждённый способ доступа.')
              : tr('Public scheduled rooms already have a browser watch link for learners.', 'У публичных запланированных комнат уже есть ссылка для просмотра учениками в браузере.')
          },
          {
            title: tr('Reuse this room', 'Используйте эту комнату снова'),
            copy: tr('You can edit the same room instead of creating a new session each time.', 'Вы можете редактировать эту же комнату вместо создания новой сессии каждый раз.')
          }
        ];
      } else {
        items = [
          {
            title: tr('Prepare room details', 'Подготовьте параметры комнаты'),
            copy: tr('Check title, level, language and access before you publish the stream.', 'Проверьте название, уровень, язык и доступ перед запуском эфира.')
          },
          {
            title: tr('Allow permissions', 'Разрешите доступ'),
            copy: tr('Browser host mode needs camera and microphone permission on this device.', 'Режиму ведущего в браузере нужен доступ к камере и микрофону на этом устройстве.')
          },
          {
            title: tr('Plan learner entry', 'Спланируйте вход учеников'),
            copy: tr('After the room starts you can copy the browser watch link or continue in the Duvela app.', 'После запуска комнаты вы можете скопировать ссылку для браузера или продолжить в приложении Duvela.')
          }
        ];
      }
    } else if (sessionId) {
      items = [
        {
          title: tr('Watch in browser', 'Смотреть в браузере'),
          copy: tr('Playback starts here when the teacher camera is published to the room.', 'Просмотр начнётся здесь, как только камера преподавателя появится в комнате.')
        },
        {
          title: tr('Use the app as fallback', 'Приложение как запасной вариант'),
          copy: session?.is_private
            ? tr('Private lessons may require the app or an approved access path.', 'Для приватных уроков может понадобиться приложение или подтверждённый способ доступа.')
            : tr('If playback stalls, reopen the same room in the Duvela mobile app.', 'Если просмотр зависает, откройте эту же комнату в мобильном приложении Duvela.')
        },
        {
          title: tr('Enable sound', 'Включите звук'),
          copy: tr('If the browser blocks autoplay, use the sound prompt above the stage.', 'Если браузер блокирует автовоспроизведение, нажмите подсказку со звуком над сценой.')
        }
      ];
    } else {
      items = [
        {
          title: tr('Open from the dashboard', 'Откройте из панели управления'),
          copy: tr('Use Hub Web or Bus Web to open a specific live room.', 'Используйте Hub Web или Bus Web, чтобы открыть конкретную комнату.')
        },
        {
          title: tr('Check the teacher link', 'Проверьте ссылку преподавателя'),
          copy: tr('A valid room link adds the live session id to this page.', 'Корректная ссылка на комнату добавляет id сессии эфира к этой странице.')
        },
        {
          title: tr('Continue in the app', 'Продолжить в приложении'),
          copy: tr('Mobile app entry remains available for rooms that are not ready in the browser.', 'Вход через мобильное приложение доступен, если комната ещё не готова в браузере.')
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
    var title = session?.topic || tr('Live lesson', 'Живой урок');
    var timing = session?.status === 'ended'
      ? formatSessionMoment(session.ended_at || session.started_at)
      : formatSessionMoment(session.started_at);
    var subtitle = [session?.language, session?.level, timing].filter(Boolean).join(' · ');
    var hostUrl = buildHostUrl(session);
    var watchUrl = buildShareUrl(session);
    var actions = '<div class="timeline-actions"><a class="btn" href="' + hostUrl + '">' + esc(primaryLabel) + '</a>';
    if (!session?.is_private && session?.id) {
      actions += '<a class="btn ghost" href="' + watchUrl + '" target="_blank" rel="noopener">' + esc(secondaryLabel) + '</a>';
    }
    actions += '</div>';
    return '<div class="timeline-item">' +
      '<div class="timeline-item-top">' +
        '<div><b>' + esc(title) + '</b><p>' + esc(subtitle || tr('No details yet.', 'Пока нет данных.')) + '</p></div>' +
        '<span class="timeline-pill">' + esc(sessionStatusLabel(session)) + '</span>' +
      '</div>' +
      actions +
    '</div>';
  }
  function renderDiagnostics(session) {
    var items = [];
    if (isHostMode) {
      items = [
        { label: tr('Browser realtime', 'Браузер в реальном времени'), value: (window.AgoraRTC && navigator.mediaDevices?.getUserMedia) ? tr('Ready', 'Готово') : tr('Missing media support', 'Нет поддержки медиа') },
        { label: tr('Account', 'Аккаунт'), value: currentUser?.id ? tr('Signed in', 'Вы вошли') : tr('Sign in required', 'Нужен вход') },
        { label: tr('Room state', 'Состояние комнаты'), value: sessionStatusLabel(session) },
        { label: tr('Microphone', 'Микрофон'), value: localAudioTrack ? (micEnabled ? tr('Live', 'В эфире') : tr('Muted', 'Выключен')) : tr('Idle', 'Не активен') },
        { label: tr('Camera', 'Камера'), value: localVideoTrack ? (camEnabled ? tr('Live', 'В эфире') : tr('Off', 'Выключена')) : tr('Idle', 'Не активен') },
        { label: tr('Share route', 'Способ доступа'), value: session?.id ? (session?.is_private ? tr('App or approved access', 'Приложение или подтверждённый доступ') : tr('Browser watch link ready', 'Ссылка для браузера готова')) : tr('Created after room save', 'Появится после сохранения комнаты') }
      ];
    } else {
      items = [
        { label: tr('Browser playback', 'Просмотр в браузере'), value: window.AgoraRTC ? tr('Ready', 'Готово') : tr('Fallback to app', 'Резерв — приложение') },
        { label: tr('Room state', 'Состояние комнаты'), value: sessionStatusLabel(session) },
        { label: tr('Access', 'Доступ'), value: accessLabel(session) },
        { label: tr('Watch link', 'Ссылка для просмотра'), value: session?.id ? tr('Opened', 'Открыта') : tr('Missing', 'Отсутствует') }
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
    el('timelineUpcomingMeta').textContent = String(hostScheduledSessions.length) + ' ' + tr('sessions', 'сессий');
    el('timelineHistoryMeta').textContent = String(hostHistorySessions.length) + ' ' + tr('sessions', 'сессий');
    el('timelineUpcoming').innerHTML = hostScheduledSessions.length
      ? hostScheduledSessions.map(function (session) {
          return timelineItem(session, tr('Open studio', 'Открыть студию'), tr('Open watch page', 'Открыть страницу просмотра'));
        }).join('')
      : '<div class="card empty">' + esc(tr('No upcoming sessions yet.', 'Пока нет предстоящих сессий.')) + '</div>';
    el('timelineHistory').innerHTML = hostHistorySessions.length
      ? hostHistorySessions.map(function (session) {
          return timelineItem(session, tr('Reuse room', 'Использовать снова'), tr('Open watch page', 'Открыть страницу просмотра'));
        }).join('')
      : '<div class="card empty">' + esc(tr('No recent sessions yet.', 'Пока нет недавних сессий.')) + '</div>';
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
          ? tr('Private room is live. Use the app handoff or your approved access path for learners.', 'Приватная комната в эфире. Направляйте учеников через приложение или ваш подтверждённый способ доступа.')
          : tr('Public room is live. Share the browser watch link while this host tab stays open.', 'Публичная комната в эфире. Делитесь ссылкой для браузера, пока эта вкладка открыта.'));
      } else if (session?.status === 'scheduled') {
        setNote(tr('This room is scheduled. Open the same page shortly before start time and launch LIVE from here.', 'Комната запланирована. Откройте эту страницу незадолго до начала и запустите эфир отсюда.'));
      } else if (session?.status === 'ended') {
        setNote(tr('This room has ended. Update the setup and start a new live session when you are ready.', 'Эта комната завершена. Обновите настройки и запустите новую сессию, когда будете готовы.'));
      } else {
        setNote(tr('The room stays in setup mode until you start LIVE from this browser.', 'Комната остаётся в режиме настройки, пока вы не запустите эфир из этого браузера.'));
      }
      return;
    }
    if (session?.status === 'scheduled') {
      setNote(tr('This lesson is scheduled. Keep the page open and it will update when the teacher starts.', 'Урок запланирован. Не закрывайте страницу — она обновится, когда преподаватель начнёт эфир.'));
    } else if (session?.status === 'ended') {
      setNote(tr('The broadcast has ended. Reopen the next lesson from the dashboard or mobile app.', 'Эфир завершён. Откройте следующий урок из панели управления или мобильного приложения.'));
    } else if (session?.is_private) {
      setNote(tr('Private lessons may still require the Duvela app even when the browser page opens.', 'Для приватных уроков может всё же понадобиться приложение Duvela, даже если страница открылась в браузере.'));
    } else {
      setNote(tr('If the stream does not start, reopen the room or continue in the Duvela app.', 'Если эфир не запускается, откройте комнату заново или продолжите в приложении Duvela.'));
    }
  }
  function updateHostControls() {
    el('toggleMic').textContent = micEnabled ? tr('Mute mic', 'Выключить микрофон') : tr('Unmute mic', 'Включить микрофон');
    el('toggleCam').textContent = camEnabled ? tr('Camera off', 'Выключить камеру') : tr('Camera on', 'Включить камеру');
  }
  function syncHostActionState(session) {
    if (!isHostMode || !el('hostAction')) return;
    var isLiveRoom = session?.status === 'live' && isHostPublishing;
    var hostActionLabel = session?.status === 'scheduled'
      ? tr('Go LIVE now', 'Выйти в эфир сейчас')
      : tr('Start LIVE', 'Начать эфир');
    el('hostAction').style.display = 'inline-flex';
    el('hostAction').disabled = isLiveRoom;
    el('hostAction').textContent = isLiveRoom ? tr('LIVE is running', 'Эфир идёт') : hostActionLabel;
    el('endLive').style.display = isLiveRoom ? 'inline-flex' : 'none';
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
          setStatus(tr('Scheduled', 'Запланирована'), 'ready');
          setStage('', tr('This session is scheduled and will switch to LIVE when the teacher starts.', 'Сессия запланирована и переключится в эфир, когда преподаватель начнёт.'));
          stopElapsedClock();
        }
        if (currentSession.status === 'ended') {
          showOverlay(true);
          setStatus(tr('LIVE ended', 'Эфир завершён'), '');
          setStage('', tr('The live session has ended.', 'Сессия эфира завершена.'));
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
    throw new Error(tr('Sign in first.', 'Сначала войдите в аккаунт.'));
  }
  async function ensureViewerSession() {
    var got = await supa.auth.getSession();
    if (got.data.session?.user) return got.data.session;
    var anon = await supa.auth.signInAnonymously();
    if (anon.error || !anon.data.session) throw new Error(tr('Could not create viewer session.', 'Не удалось создать сессию просмотра.'));
    return anon.data.session;
  }
  async function getPublisherToken(channelName, uid) {
    var fn = await supa.functions.invoke('agora-token', {
      body: { channelName: channelName, uid: uid, role: 'publisher', ttlSeconds: 3600 }
    });
    if (fn.error) throw new Error(fn.error.message || tr('Could not get host token.', 'Не удалось получить токен ведущего.'));
    if (!fn.data?.token) throw new Error(tr('Could not get host token.', 'Не удалось получить токен ведущего.'));
    return fn.data.token;
  }
  async function getSubscriberToken(channelName, uid) {
    var fn = await supa.functions.invoke('agora-token', {
      body: { channelName: channelName, uid: uid, role: 'subscriber', ttlSeconds: 3600 }
    });
    if (fn.error) throw new Error(fn.error.message || tr('Could not get stream token.', 'Не удалось получить токен трансляции.'));
    if (!fn.data?.token) throw new Error(tr('Could not get stream token.', 'Не удалось получить токен трансляции.'));
    return fn.data.token;
  }
  async function loadLiveSession(id) {
    var result = await supa.from('live_sessions').select(LIVE_FIELDS).eq('id', id).maybeSingle();
    if (result.error || !result.data) throw new Error(tr('This LIVE was not found.', 'Этот эфир не найден.'));
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
      throw new Error(result.error.message || tr('Could not join the live room.', 'Не удалось подключиться к комнате эфира.'));
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
      throw new Error(result.error.message || tr('Could not load live chat.', 'Не удалось загрузить чат эфира.'));
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
          message: (payload.new.sender_name || tr('Student', 'Ученик')) + ' ' + tr('sent', 'отправил(а)') + ' ' + (payload.new.gift_name || tr('a gift', 'подарок')),
          role: 'system',
          sender_id: payload.new.sender_id || null,
          sender_name: tr('Gift', 'Подарок'),
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
        role: 'viewer',
        sender_id: currentUser.id,
        sender_name: viewerDisplayName(),
        session_id: currentSession.id
      }).select('id,channel_name,created_at,message,role,sender_id,sender_name,session_id').single();
      if (result.error || !result.data) {
        throw new Error(result.error?.message || tr('Could not send the message.', 'Не удалось отправить сообщение.'));
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
        throw new Error(response.error.message || tr('Could not send the gift.', 'Не удалось отправить подарок.'));
      }
      viewerBalance = typeof response.data?.balanceAfter === 'number' ? response.data.balanceAfter : viewerBalance;
      renderViewerBalance();
      closeGiftModal();
      setNote(tr('Gift sent to the live teacher.', 'Подарок отправлен преподавателю в эфире.'));
    } finally {
      viewerSendingGift = false;
      el('sendGift').disabled = false;
    }
  }
  function hostSessionPayload(user, status, startedAt, existingSession) {
    var now = new Date().toISOString();
    var topic = el('topicInput').value.trim() || tr('Live lesson', 'Живой урок');
    return {
      channel_name: existingSession?.channel_name || createChannelName(user.id),
      ended_at: status === 'ended' ? now : null,
      heartbeat_at: now,
      is_private: el('privateInput').checked,
      allow_guest_requests: el('allowViewerRequests').checked,
      min_viewer_age: el('audience18Plus').checked ? 18 : 0,
      video_quality: el('videoQuality').value || 'auto',
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
      throw new Error(result.error?.message || tr('Could not create LIVE. Make sure this account is a teacher/organizer.', 'Не удалось создать эфир. Убедитесь, что аккаунт имеет роль преподавателя/организатора.'));
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
      throw new Error(result.error?.message || tr('Could not update LIVE room.', 'Не удалось обновить комнату эфира.'));
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
      if (!scheduledAt) throw new Error(tr('Choose date and time first.', 'Сначала выберите дату и время.'));
      if (Date.parse(scheduledAt) <= Date.now()) {
        throw new Error(tr('Choose a future start time.', 'Выберите время начала в будущем.'));
      }
      var selectedSession = sessionId ? await loadLiveSession(sessionId) : null;
      if (selectedSession?.teacher_id && selectedSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Этот эфир принадлежит другому преподавателю.'));
      }
      currentSession = selectedSession
        ? await updateHostSession(currentUser, selectedSession, 'scheduled', scheduledAt)
        : await (async function () {
            var payload = hostSessionPayload(currentUser, 'scheduled', scheduledAt, null);
            var result = await supa.from('live_sessions').insert(payload).select(LIVE_FIELDS).single();
            if (result.error || !result.data) {
              throw new Error(result.error?.message || tr('Could not schedule LIVE.', 'Не удалось запланировать эфир.'));
            }
            return result.data;
          })();
      teacher = currentSession.teacher_name || teacher;
      updateUrlForHost(currentSession);
      updateShareLink(currentSession);
      applySessionToInputs(currentSession);
      renderWorkspace(currentSession);
      el('mainAction').textContent = tr('Go LIVE now', 'Выйти в эфир сейчас');
      showOverlay(true);
      setStatus(tr('Scheduled', 'Запланирована'), 'ready');
      setStage('', tr('The session is scheduled. Open this page again to start LIVE from the browser.', 'Сессия запланирована. Откройте эту страницу снова, чтобы начать эфир из браузера.'));
      if (currentSession.topic) el('title').textContent = currentSession.topic;
      await loadHostTimeline();
    } catch (error) {
      setStage('', error?.message || tr('Could not schedule LIVE.', 'Не удалось запланировать эфир.'));
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

  function selectedVideoProfile() {
    var quality = el('videoQuality')?.value || '720p';
    if (quality === '540p') return { width: 960, height: 540, frameRate: 24 };
    if (quality === 'auto') return { width: 640, height: 360, frameRate: 24 };
    return { width: 1280, height: 720, frameRate: 30 };
  }

  function updateEffectButtons() {
    Array.from(document.querySelectorAll('[data-live-effect]')).forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-live-effect') === selectedLiveEffect);
    });
  }

  async function applyLiveEffect(effectId) {
    selectedLiveEffect = (EFFECT_PATHS[effectId] || effectId === 'off') ? effectId : 'makeup';
    updateEffectButtons();
    if (!deepARInstance) return;
    el('previewStatus').textContent = tr('Loading effect...', 'Загрузка эффекта...');
    try {
      if (selectedLiveEffect === 'off') await deepARInstance.clearEffect();
      else await deepARInstance.switchEffect(EFFECT_PATHS[selectedLiveEffect]);
      el('deeparCanvas')?.classList.add('active');
      el('hostCameraPreview')?.classList.remove('active');
      el('previewStatus').textContent = isHostPublishing
        ? tr('Effect is visible to LIVE viewers.', 'Эффект виден зрителям LIVE.')
        : tr('Practice mode: the effect is private until you press Go LIVE.', 'Режим практики: эффект видите только вы до нажатия «В эфир».');
    } catch (error) {
      el('previewStatus').textContent = error?.message || tr('Could not load this effect.', 'Не удалось загрузить эффект.');
    }
  }

  async function openHostCamera(facingMode) {
    var profile = selectedVideoProfile();
    var nextStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: profile.width },
        height: { ideal: profile.height },
        frameRate: { ideal: profile.frameRate, max: 30 }
      }
    });
    var oldStream = hostCameraStream;
    hostCameraStream = nextStream;
    var preview = el('hostCameraPreview');
    preview.srcObject = nextStream;
    await preview.play();
    if (deepARInstance) await deepARInstance.setVideoElement(preview, true);
    if (localVideoTrack && !deepARInstance && typeof localVideoTrack.replaceTrack === 'function') {
      await localVideoTrack.replaceTrack(nextStream.getVideoTracks()[0], true);
    }
    oldStream?.getTracks().forEach(function (track) { track.stop(); });
    document.body.classList.toggle('front-camera', facingMode === 'user');
  }

  async function initializeHostPreview() {
    if (!isHostMode) return;
    if (hostPreviewPromise) return hostPreviewPromise;
    hostPreviewPromise = (async function () {
      document.body.classList.add('host-preview');
      el('previewStatus').textContent = tr('Requesting camera access...', 'Запрашиваем доступ к камере...');
      await openHostCamera(cameraFacingMode);
      var canvas = el('deeparCanvas');
      var fallbackVideo = el('hostCameraPreview');
      var licenseKey = window.DUVELA_DEEPAR_WEB_LICENSE_KEY || config.deepARWebLicenseKey || '';
      if (window.deepar && licenseKey) {
        try {
          deepARInstance = await window.deepar.initialize({
            licenseKey: licenseKey,
            canvas: canvas,
            additionalOptions: {
              cameraConfig: { disableDefaultCamera: true }
            }
          });
          await deepARInstance.setVideoElement(fallbackVideo, true);
          canvas.classList.add('active');
          fallbackVideo.classList.remove('active');
          await applyLiveEffect(selectedLiveEffect);
        } catch (error) {
          deepARInstance = null;
          canvas.classList.remove('active');
          fallbackVideo.classList.add('active');
          el('previewStatus').textContent = tr('Camera is ready. DeepAR could not start, so the clean camera will be used.', 'Камера готова. DeepAR не запустился, поэтому будет использована обычная камера.');
        }
      } else {
        fallbackVideo.classList.add('active');
        el('previewStatus').textContent = tr('Camera is ready. Add the DeepAR Web license to enable effects.', 'Камера готова. Добавьте лицензию DeepAR Web, чтобы включить эффекты.');
      }
      showOverlay(false);
      el('flipCamera').style.display = 'inline-flex';
      el('toggleFullscreen').style.display = 'inline-flex';
      syncHostActionState(currentSession);
    })().catch(function (error) {
      hostPreviewPromise = null;
      el('previewStatus').textContent = error?.message || tr('Camera preview is unavailable.', 'Предпросмотр камеры недоступен.');
      throw error;
    });
    return hostPreviewPromise;
  }

  async function createHostTracks() {
    await initializeHostPreview();
    var profile = selectedVideoProfile();
    localAudioTrack = await window.AgoraRTC.createMicrophoneAudioTrack({
      AEC: true,
      AGC: true,
      ANS: Boolean(el('noiseSuppression')?.checked)
    });
    var sourceTrack;
    if (deepARInstance) {
      deepARInstance.setFps(profile.frameRate);
      deepARCanvasStream = el('deeparCanvas').captureStream(profile.frameRate);
      sourceTrack = deepARCanvasStream.getVideoTracks()[0];
    } else {
      sourceTrack = hostCameraStream?.getVideoTracks()[0]?.clone();
    }
    if (!sourceTrack) throw new Error(tr('Camera video track is unavailable.', 'Видеодорожка камеры недоступна.'));
    localVideoTrack = window.AgoraRTC.createCustomVideoTrack({
      mediaStreamTrack: sourceTrack,
      encoderConfig: {
        width: profile.width,
        height: profile.height,
        frameRate: profile.frameRate,
        bitrateMin: profile.width >= 1280 ? 600 : 350,
        bitrateMax: profile.width >= 1280 ? 1800 : 1000
      }
    });
  }

  async function flipHostCamera() {
    cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
    el('flipCamera').disabled = true;
    try { await openHostCamera(cameraFacingMode); }
    catch (error) { cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user'; }
    finally { el('flipCamera').disabled = false; }
  }

  function toggleStageFullscreen() {
    var stage = el('player')?.parentElement;
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen();
  }

  async function startHost() {
    if (!supa || !window.AgoraRTC || !AGORA_APP_ID) {
      setStage('', tr('Live studio is not configured.', 'Студия эфира не настроена.'));
      return;
    }
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    el('mainAction').disabled = true;
    setStatus(tr('Starting teacher LIVE', 'Запуск эфира преподавателя'), 'ready');
    setStage('<div class="spinner"></div>', tr('Preparing camera and microphone...', 'Подготовка камеры и микрофона...'));
    try {
      var createdFreshSession = false;
      var authSession = await requireSessionForHost();
      currentUser = authSession.user;
      var uid = createAgoraUid(currentUser.id);
      currentSession = sessionId ? await loadLiveSession(sessionId) : await createLiveSession(currentUser);
      createdFreshSession = !sessionId;
      applySessionToInputs(currentSession);
      if (currentSession.teacher_id && currentSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Этот эфир принадлежит другому преподавателю.'));
      }
      if (!createdFreshSession) {
        currentSession = await updateHostSession(currentUser, currentSession, 'live', new Date().toISOString());
      }

      var token = await getPublisherToken(currentSession.channel_name, uid);
      client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('host');
      await client.join(AGORA_APP_ID, currentSession.channel_name, token, uid);
      await createHostTracks();
      micEnabled = true;
      camEnabled = true;
      await client.publish([localAudioTrack, localVideoTrack]);
      isHostPublishing = true;

      el('title').textContent = currentSession.topic || tr('Teacher LIVE', 'Эфир преподавателя');
      el('subtitle').textContent = tr('You are live from the browser. Students can open the watch link.', 'Вы в эфире из браузера. Ученики могут открыть ссылку для просмотра.');
      showOverlay(false);
      el('toggleMic').style.display = 'inline-flex';
      el('toggleCam').style.display = 'inline-flex';
      el('pinMaterial').style.display = 'inline-flex';
      if (currentSession) { subscribeLiveMaterial(currentSession.id); renderLiveMaterial(currentSession.material_url); }
      updateHostControls();
      el('mainAction').textContent = tr('LIVE is running', 'Эфир идёт');
      syncHostActionState(currentSession);
      setStatus(tr('Teacher is LIVE', 'Преподаватель в эфире'), 'live');
      el('previewStatus').textContent = tr('LIVE: the selected effect is visible to viewers.', 'LIVE: выбранный эффект виден зрителям.');
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
      void startRestream(currentSession.channel_name, uid);
    } catch (error) {
      el('mainAction').disabled = false;
      el('mainAction').textContent = sessionId ? tr('Open as teacher', 'Открыть как преподаватель') : tr('Start LIVE', 'Начать эфир');
      syncHostActionState(currentSession);
      setStatus(tr('Not live', 'Не в эфире'), '');
      setStage('', error?.message || tr('Could not start LIVE.', 'Не удалось начать эфир.'));
      if (createdFreshSession && currentSession?.id && currentUser?.id) {
        try { await markEnded(); } catch (e) {}
      }
      await stopMedia(false);
      renderWorkspace(currentSession);
    }
  }
  function renderLiveMaterial(url) {
    var stage = el('player') && el('player').parentElement;
    if (!stage) return;
    var node = document.getElementById('liveMaterialOverlay');
    if (!url) { if (node) node.remove(); return; }
    if (!node) {
      node = document.createElement('div');
      node.id = 'liveMaterialOverlay';
      node.style.cssText = 'position:absolute;inset:0;z-index:8;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);';
      node.innerHTML = '<img alt="" style="max-width:94%;max-height:82%;object-fit:contain;border-radius:8px;">';
      if (getComputedStyle(stage).position === 'static') stage.style.position = 'relative';
      stage.appendChild(node);
    }
    node.querySelector('img').src = url;
  }

  async function hostToggleMaterial() {
    if (!currentSession) return;
    // If material is currently shown, remove it; otherwise open the file picker.
    if (document.getElementById('liveMaterialOverlay')) {
      try {
        await supa.from('live_sessions').update({ material_url: null }).eq('id', currentSession.id);
        if (materialChannel) materialChannel.send({ type: 'broadcast', event: 'material', payload: { kind: 'clear' } });
        renderLiveMaterial(null);
      } catch (e) { /* ignore */ }
      el('pinMaterial').textContent = tr('Material', 'Материал');
      return;
    }
    el('materialFile').value = '';
    el('materialFile').click();
  }

  async function hostUploadMaterial() {
    var file = el('materialFile').files && el('materialFile').files[0];
    if (!file || !currentSession || !currentUser) return;
    try {
      setNote(tr('Uploading material…', 'Загрузка материала…'));
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      var path = currentUser.id + '/live-materials/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      var up = await supa.storage.from('posts').upload(path, file, { contentType: file.type || undefined, upsert: true });
      if (up.error) throw up.error;
      var url = supa.storage.from('posts').getPublicUrl(path).data.publicUrl;
      await supa.from('live_sessions').update({ material_url: url }).eq('id', currentSession.id);
      if (!materialChannel) subscribeLiveMaterial(currentSession.id);
      if (materialChannel) materialChannel.send({ type: 'broadcast', event: 'material', payload: { kind: 'set', url: url } });
      renderLiveMaterial(url);
      el('pinMaterial').textContent = tr('Remove material', 'Убрать материал');
      setNote('');
    } catch (e) {
      setNote(tr('Material upload failed', 'Не удалось загрузить материал'));
    }
  }

  function nextFollowerGoal(n) {
    var steps = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
    for (var i = 0; i < steps.length; i++) if (steps[i] > n) return steps[i];
    return Math.ceil((n + 1) / 100000) * 100000;
  }

  var viewerIsFollowing = false;

  async function renderFollowUi() {
    var box = el('viewerFollow');
    if (!box || !currentSession || isHostMode) { if (box) box.style.display = 'none'; return; }
    var teacherId = currentSession.teacher_id;
    if (!teacherId) { box.style.display = 'none'; return; }
    try {
      var cnt = await supa.from('user_follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', teacherId);
      var count = cnt.count || 0;
      var goal = nextFollowerGoal(count);
      var pct = Math.min(100, Math.round((count / goal) * 100));
      el('goalLabel').textContent = tr('Followers', 'Подписчики') + ' ' + count + '/' + goal;
      el('goalPct').textContent = pct + '%';
      el('goalFill').style.width = pct + '%';
      if (currentUser && teacherId !== currentUser.id) {
        var mine = await supa.from('user_follows').select('follower_id').eq('follower_id', currentUser.id).eq('following_id', teacherId).maybeSingle();
        viewerIsFollowing = !!(mine && mine.data);
        el('followBtn').textContent = viewerIsFollowing ? tr('Following', 'Вы подписаны') : tr('Follow', 'Подписаться');
        el('followBtn').style.display = '';
      } else {
        el('followBtn').style.display = 'none';
      }
      box.style.display = '';
    } catch (e) { box.style.display = 'none'; }
    void renderRankBadge(teacherId);
  }

  async function renderRankBadge(teacherId) {
    var badge = el('rankBadge');
    if (!badge || !teacherId) return;
    try {
      var res = await supa.rpc('live_gift_rank', { p_teacher: teacherId, p_period: 'hour' });
      var row = res && res.data && (Array.isArray(res.data) ? res.data[0] : res.data);
      var rank = row ? Number(row.rank) || 0 : 0;
      if (rank > 0 && rank <= 50) {
        badge.textContent = '🏆 #' + rank + ' ' + tr('this hour', 'за час');
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    } catch (e) { badge.style.display = 'none'; }
  }

  async function toggleViewerFollow() {
    if (!currentSession || !currentUser) return;
    var teacherId = currentSession.teacher_id;
    if (!teacherId || teacherId === currentUser.id) return;
    try {
      if (viewerIsFollowing) {
        await supa.from('user_follows').delete().eq('follower_id', currentUser.id).eq('following_id', teacherId);
      } else {
        await supa.from('user_follows').insert({ follower_id: currentUser.id, following_id: teacherId });
      }
      await renderFollowUi();
    } catch (e) { /* ignore */ }
  }

  function subscribeLiveMaterial(id) {
    if (!supa || !id) return;
    if (materialChannel) { try { supa.removeChannel(materialChannel); } catch (e) {} materialChannel = null; }
    materialChannel = supa.channel('live-material-' + id, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'material' }, function (msg) {
        var p = msg && msg.payload;
        renderLiveMaterial(p && p.kind === 'set' ? p.url : null);
      });
    materialChannel.subscribe();
  }

  async function watch() {
    if (!sessionId) {
      setStage('', tr('No live session selected.', 'Сессия эфира не выбрана.'));
      return;
    }
    if (!supa || !window.AgoraRTC || !AGORA_APP_ID) {
      setStage('', tr('Open the app to watch this lesson.', 'Откройте приложение, чтобы посмотреть этот урок.'));
      return;
    }
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    el('mainAction').disabled = true;
    setStatus(tr('Connecting', 'Подключение'), 'ready');
    setStage('<div class="spinner"></div>', tr('Connecting...', 'Подключение...'));
    try {
      var authSession = await ensureViewerSession();
      var user = authSession.user;
      var uid = createAgoraUid(user.id);
      currentUser = user;
      currentSession = await loadLiveSession(sessionId);
      if (currentSession.min_viewer_age === 18 && localStorage.getItem('duvela.viewerAge18Confirmed') !== 'true') {
        var confirmed = window.confirm(tr('This LIVE is for viewers aged 18+. Confirm that you are at least 18 years old.', 'Этот эфир предназначен для зрителей 18+. Подтвердите, что вам уже исполнилось 18 лет.'));
        if (!confirmed) throw new Error(tr('Age confirmation is required for this LIVE.', 'Для этого эфира требуется подтверждение возраста.'));
        localStorage.setItem('duvela.viewerAge18Confirmed', 'true');
      }
      renderWorkspace(currentSession);
      updateShareLink(currentSession);
      startSessionPolling();
      if (currentSession.status === 'scheduled') {
        stopElapsedClock();
        throw new Error(tr('This lesson is scheduled. Keep this page open or reopen it near the start time.', 'Урок запланирован. Не закрывайте страницу или откройте её снова ближе ко времени начала.'));
      }
      if (currentSession.status !== 'live') throw new Error(tr('This LIVE has ended.', 'Этот эфир завершён.'));
      if (currentSession.is_private) throw new Error(tr('This is a private lesson. Open the app to request access.', 'Это приватный урок. Откройте приложение, чтобы запросить доступ.'));
      if (currentSession.teacher_name && !teacher) el('title').textContent = teacherWatchTitle(currentSession.teacher_name);
      await joinViewerParticipant(uid);
      await loadViewerBalance();
      await loadViewerMessages();
      await subscribeViewerRealtime();
      renderLiveMaterial(currentSession.material_url);
      subscribeLiveMaterial(sessionId);
      void renderFollowUi();
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
          setStatus(tr('Watching LIVE', 'Смотрите эфир'), 'live');
        }
        if (mediaType === 'audio') {
          try { remoteUser.audioTrack.play(); }
          catch (e) { showSoundPill(remoteUser); }
        }
      });
      client.on('user-unpublished', function () {
        showOverlay(true);
        setStage('', tr('The teacher paused the stream.', 'Преподаватель приостановил трансляцию.'));
      });
      await client.join(AGORA_APP_ID, currentSession.channel_name, token, uid);
      setStage('<div class="spinner"></div>', tr('Waiting for the teacher camera...', 'Ожидание камеры преподавателя...'));
      el('mainAction').disabled = false;
      el('mainAction').textContent = tr('Try again', 'Повторить');
    } catch (error) {
      el('mainAction').disabled = false;
      el('mainAction').textContent = tr('Try again', 'Повторить');
      setStatus(tr('Not connected', 'Нет подключения'), '');
      setStage('', error?.message || tr('Could not start the stream.', 'Не удалось запустить трансляцию.'));
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
    deepARCanvasStream = null;
    isHostPublishing = false;
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    if (!isHostMode) {
      if (viewerRealtimeChannel) {
        try { await supa.removeChannel(viewerRealtimeChannel); } catch (e) {}
        viewerRealtimeChannel = null;
      }
      if (materialChannel) { try { await supa.removeChannel(materialChannel); } catch (e) {} materialChannel = null; }
      renderLiveMaterial(null);
      await leaveViewerParticipant();
      viewerMessages = [];
      renderViewerMessages();
      closeGiftModal();
      setViewerControlsEnabled(false);
    }
    el('toggleMic').style.display = 'none';
    el('toggleCam').style.display = 'none';
    el('pinMaterial').style.display = 'none';
    if (materialChannel) { try { await supa.removeChannel(materialChannel); } catch (e) {} materialChannel = null; }
    renderLiveMaterial(null);
    setHostSetupDisabled(false);
    if (markSessionEnded && currentSession?.status === 'live') await markEnded();
  }
  async function endHost() {
    el('endLive').disabled = true;
    setStatus(tr('Ending LIVE', 'Завершение эфира'), 'ready');
    void stopRestream();
    await stopMedia(true);
    showOverlay(false);
    el('endLive').style.display = 'none';
    el('endLive').disabled = false;
    el('mainAction').disabled = false;
    el('mainAction').textContent = tr('Start LIVE', 'Начать эфир');
    setStatus(tr('LIVE ended', 'Эфир завершён'), '');
    setStage('', '');
    el('previewStatus').textContent = tr('Practice mode: camera and effects remain private.', 'Режим практики: камера и эффекты снова видны только вам.');
    currentSession = currentSession ? Object.assign({}, currentSession, { status: 'ended', ended_at: new Date().toISOString() }) : null;
    updateShareLink(currentSession);
    renderWorkspace(currentSession);
    syncHostActionState(currentSession);
    if (currentUser?.id) await loadHostTimeline();
  }
  function showSoundPill(remoteUser) {
    var pill = el('soundPill');
    pill.style.display = 'block';
    pill.textContent = tr('Tap for sound', 'Нажмите для звука');
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
      void loadRestreamTargets();
      if (!sessionId) return;
      currentSession = await loadLiveSession(sessionId);
      if (currentSession.teacher_id && currentSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Этот эфир принадлежит другому преподавателю.'));
      }
      teacher = currentSession.teacher_name || teacher;
      applySessionToInputs(currentSession);
      updateShareLink(currentSession);
      if (currentSession.topic) el('title').textContent = currentSession.topic;
      if (currentSession.status === 'scheduled') {
        el('mainAction').textContent = tr('Go LIVE now', 'Выйти в эфир сейчас');
        setStatus(tr('Scheduled', 'Запланирована'), 'ready');
        setStage('', tr('This room is scheduled and ready for launch from this browser.', 'Комната запланирована и готова к запуску из этого браузера.'));
      } else if (currentSession.status === 'ended') {
        el('mainAction').textContent = tr('Start LIVE', 'Начать эфир');
        setStatus(tr('Ended', 'Завершена'), '');
        setStage('', tr('This room ended earlier. Update details or reuse it for the next lesson.', 'Эта комната уже завершена. Обновите данные или используйте её для следующего урока.'));
      }
      renderWorkspace(currentSession);
      syncHostActionState(currentSession);
    } catch (error) {
      setNote(error?.message || tr('Could not load teacher session.', 'Не удалось загрузить сессию преподавателя.'));
    }
  }
  function setupMode() {
    document.documentElement.lang = isRu ? 'ru' : 'en';
    document.querySelector('label[for="topicInput"]').textContent = tr('LIVE title', 'Название эфира');
    document.querySelector('label[for="levelInput"]').textContent = tr('Level', 'Уровень');
    document.querySelector('label[for="languageInput"]').textContent = tr('Language', 'Язык');
    document.querySelector('label[for="scheduleDateInput"]').textContent = tr('Start date', 'Дата начала');
    document.querySelector('label[for="scheduleTimeInput"]').textContent = tr('Start time', 'Время начала');
    document.querySelector('label[for="shareUrl"]').textContent = tr('Student watch link', 'Ссылка для просмотра ученикам');
    document.querySelector('#hostSetup .check-row span').textContent = tr('Private room', 'Приватная комната');
    el('restreamSummary').textContent = tr('Multistream (YouTube / Facebook / TikTok)', 'Мультитрансляция (YouTube / Facebook / TikTok)');
    el('saveRestreamBtn').textContent = tr('Save multistream settings', 'Сохранить настройки мультитрансляции');
    el('restreamIgNote').textContent = tr(
      'Instagram does not support external streaming — it can only be started from the Instagram app.',
      'Instagram не поддерживает трансляцию извне — эфир там можно начать только из приложения Instagram.'
    );
    RESTREAM_PLATFORMS.forEach(function (platform) {
      var row = restreamRow(platform);
      var urlInput = row.querySelector('.restreamUrl');
      urlInput.placeholder = RESTREAM_DEFAULT_URLS[platform] || tr('Server URL', 'Адрес сервера');
      if (RESTREAM_DEFAULT_URLS[platform]) urlInput.value = RESTREAM_DEFAULT_URLS[platform];
      row.querySelector('.restreamKey').placeholder = tr('Stream key', 'Ключ трансляции');
      row.querySelector('.check-row span').textContent = tr('On', 'Вкл');
    });
    el('saveRestreamBtn').addEventListener('click', function () { void saveRestreamTargets(); });
    el('topicInput').value = tr('Live lesson', 'Живой урок');
    el('soundPill').textContent = tr('Tap for sound', 'Нажмите для звука');
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
      el('copyShare').textContent = tr('Copied', 'Скопировано');
      setTimeout(function () { el('copyShare').textContent = tr('Copy link', 'Скопировать ссылку'); }, 1200);
    });
    el('endLive').addEventListener('click', endHost);
    el('hostAction').addEventListener('click', function () { void startHost(); });
    el('toggleMic').addEventListener('click', function () { void toggleMic(); });
    el('toggleCam').addEventListener('click', function () { void toggleCam(); });
    el('flipCamera').addEventListener('click', function () { void flipHostCamera(); });
    el('toggleFullscreen').addEventListener('click', toggleStageFullscreen);
    el('exitFullscreen').addEventListener('click', toggleStageFullscreen);
    Array.from(document.querySelectorAll('[data-live-effect]')).forEach(function (button) {
      button.addEventListener('click', function () {
        void applyLiveEffect(button.getAttribute('data-live-effect') || 'off');
      });
    });
    el('videoQuality').addEventListener('change', function () {
      if (!isHostPublishing && hostCameraStream) void openHostCamera(cameraFacingMode);
    });
    el('pinMaterial').addEventListener('click', function () { void hostToggleMaterial(); });
    el('materialFile').addEventListener('change', function () { void hostUploadMaterial(); });
    if (el('followBtn')) el('followBtn').addEventListener('click', function () { void toggleViewerFollow(); });
    el('scheduleSession').addEventListener('click', function () { void scheduleHostSession(); });
    window.addEventListener('beforeunload', function () {
      if (isHostMode) void stopMedia(true);
      else void stopMedia(false);
    });

    if (isHostMode) {
      document.title = tr('Duvela LIVE - teacher studio', 'Duvela LIVE — студия преподавателя');
      el('modePill').textContent = tr('Duvela Business - Teacher Live', 'Duvela Business — эфир преподавателя');
      el('studioKicker').textContent = tr('Teacher studio', 'Студия преподавателя');
      el('stageCardTitle').textContent = tr('Broadcast studio', 'Студия эфира');
      el('stageCardCopy').textContent = tr('Camera preview, room status and live controls in one place.', 'Превью камеры, статус комнаты и управление эфиром в одном месте.');
      el('stageChipPrimary').textContent = tr('Host preview', 'Превью ведущего');
      el('stageChipSecondary').textContent = tr('Camera + mic live', 'Камера и микрофон в эфире');
      el('sideKicker').textContent = tr('Studio panel', 'Панель студии');
      el('badgeText').textContent = 'TEACHER LIVE';
      el('title').textContent = sessionId ? tr('Enter teacher LIVE', 'Войти в эфир преподавателя') : tr('Start teacher LIVE', 'Начать эфир преподавателя');
      el('subtitle').textContent = tr('Create a live room and publish camera plus microphone from this browser.', 'Создайте комнату эфира и транслируйте камеру и микрофон прямо из браузера.');
      el('sideTitle').textContent = tr('Teacher controls', 'Управление преподавателя');
      el('sideCopy').textContent = tr('Run the live room from the browser, keep session details clear, and hand off learners with the right entry link.', 'Управляйте комнатой эфира из браузера, держите данные сессии в порядке и направляйте учеников по нужной ссылке.');
      el('setupSection').style.display = 'grid';
      el('effectsSection').style.display = 'grid';
      el('hostSetup').style.display = 'grid';
      el('scheduleSetup').style.display = 'grid';
      el('setupTitle').textContent = tr('Session setup', 'Настройка сессии');
      el('setupCopy').textContent = tr('Prepare room details, set the next time slot, then launch or reuse the same room.', 'Подготовьте параметры комнаты, задайте время следующего запуска, затем запустите эфир или используйте эту же комнату снова.');
      el('linksTitle').textContent = tr('Studio links', 'Ссылки студии');
      el('linksCopy').textContent = tr('Use browser and app entry points for the same live room.', 'Используйте вход через браузер и через приложение для одной и той же комнаты эфира.');
      el('detailsTitle').textContent = tr('Room details', 'Параметры комнаты');
      el('detailsCopy').textContent = tr('Session state, access and teaching details update here.', 'Здесь обновляются статус сессии, доступ и параметры урока.');
      el('checklistTitle').textContent = tr('Broadcast checklist', 'Чек-лист эфира');
      el('checklistCopy').textContent = tr('Use this checklist before and during the lesson.', 'Используйте этот чек-лист до и во время урока.');
      el('diagnosticsTitle').textContent = tr('Diagnostics', 'Диагностика');
      el('diagnosticsCopy').textContent = tr('Check browser readiness, room access and device state before you go live.', 'Перед выходом в эфир проверьте готовность браузера, доступ к комнате и состояние устройств.');
      el('timelineTitle').textContent = tr('Session timeline', 'Хронология сессий');
      el('timelineCopy').textContent = tr('Keep upcoming and recent rooms in one operational view.', 'Держите предстоящие и недавние комнаты в одном рабочем списке.');
      el('timelineUpcomingTitle').textContent = tr('Upcoming', 'Предстоящие');
      el('timelineHistoryTitle').textContent = tr('Recent', 'Недавние');
      el('scheduleSession').textContent = tr('Schedule session', 'Запланировать сессию');
      el('mainAction').textContent = sessionId ? tr('Open as teacher', 'Открыть как преподаватель') : tr('Start LIVE', 'Начать эфир');
      el('mainAction').addEventListener('click', startHost);
      el('dashboardLink').href = './app.html?role=teacher#live';
      el('backLink').href = './app.html?role=teacher#live';
      el('openApp').textContent = tr('Open in the Duvela app', 'Открыть в приложении Duvela');
      el('dashboardLink').textContent = tr('Back to web dashboard', 'Назад в веб-панель');
      el('copyShare').textContent = tr('Copy link', 'Скопировать ссылку');
      renderWorkspace({
        teacher_name: teacher || displayName({}),
        topic: el('topicInput').value,
        level: el('levelInput').value || 'B1',
        language: el('languageInput').value,
        is_private: false
      });
      setStatus(tr('Ready for teacher', 'Готово для преподавателя'), 'ready');
      syncHostActionState(currentSession);
      void preloadHostSession();
      void initializeHostPreview();
      return;
    }

    if (teacher) el('title').textContent = teacherWatchTitle(teacher);
    el('modePill').textContent = isBusiness ? tr('Duvela Business viewer', 'Просмотр Duvela Business') : tr('Duvela Hub viewer', 'Просмотр Duvela Hub');
    el('studioKicker').textContent = tr('Viewer stage', 'Сцена зрителя');
    el('stageCardTitle').textContent = tr('Watch the live lesson in a clean stage view', 'Смотрите урок в удобном формате сцены');
    el('stageCardCopy').textContent = tr('Playback, chat, gifts, and room status stay close without crowding the video.', 'Просмотр, чат, подарки и статус комнаты рядом, но не мешают видео.');
    el('stageChipPrimary').textContent = tr('Viewer playback', 'Просмотр зрителя');
    el('stageChipSecondary').textContent = tr('Live room access', 'Доступ к комнате эфира');
    el('sideKicker').textContent = tr('Room panel', 'Панель комнаты');
    el('mainAction').textContent = tr('Watch now', 'Смотреть');
    el('mainAction').addEventListener('click', watch);
    el('dashboardLink').href = './app.html?role=learner#live';
    el('backLink').href = './app.html?role=learner#live';
    el('sideTitle').textContent = tr('Live room', 'Комната эфира');
    el('sideCopy').textContent = tr('Use the browser to watch the lesson, or move the same session into the Duvela app.', 'Смотрите урок в браузере или перейдите с этой же сессией в приложение Duvela.');
    el('linksTitle').textContent = tr('Access links', 'Ссылки доступа');
    el('linksCopy').textContent = tr('Switch between browser playback and the mobile app when needed.', 'При необходимости переключайтесь между просмотром в браузере и мобильным приложением.');
    el('detailsTitle').textContent = tr('Room details', 'Параметры комнаты');
    el('detailsCopy').textContent = tr('Session state updates as the teacher joins or ends the room.', 'Статус сессии обновляется, когда преподаватель подключается или завершает комнату.');
    el('checklistTitle').textContent = tr('Watch checklist', 'Чек-лист просмотра');
    el('checklistCopy').textContent = tr('Use these steps if the stream is not immediately available.', 'Используйте эти шаги, если трансляция не запустилась сразу.');
    el('diagnosticsTitle').textContent = tr('Playback diagnostics', 'Диагностика просмотра');
    el('diagnosticsCopy').textContent = tr('Check room state and browser readiness before moving into the app.', 'Проверьте состояние комнаты и готовность браузера перед переходом в приложение.');
    el('openApp').textContent = tr('Open in the Duvela app', 'Открыть в приложении Duvela');
    el('dashboardLink').textContent = tr('Back to web dashboard', 'Назад в веб-панель');
    el('copyShare').textContent = tr('Copy link', 'Скопировать ссылку');
    el('viewerActionsSection').style.display = 'grid';
    el('viewerActionsTitle').textContent = tr('Live interaction', 'Общение в эфире');
    el('viewerActionsCopy').textContent = tr('Join the room chat and send a gift while the lesson is live.', 'Подключайтесь к чату комнаты и отправляйте подарки, пока урок идёт в эфире.');
    el('openChat').textContent = tr('Open chat', 'Открыть чат');
    el('openGift').textContent = tr('Send gift', 'Отправить подарок');
    el('giftTitle').textContent = tr('Send a gift', 'Отправить подарок');
    el('giftCopy').textContent = tr('Choose one gift for the live teacher.', 'Выберите один подарок для преподавателя в эфире.');
    el('cancelGift').textContent = tr('Cancel', 'Отмена');
    el('sendGift').textContent = tr('Send gift', 'Отправить подарок');
    el('chatInput').placeholder = tr('Write to the teacher...', 'Напишите преподавателю...');
    el('sendChat').textContent = tr('Send', 'Отправить');
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
    setStatus(sessionId ? tr('Ready to watch', 'Готово к просмотру') : tr('No session selected', 'Сессия не выбрана'), sessionId ? 'ready' : '');
    renderWorkspace({ teacher_name: teacher || '', level: '', language: '', is_private: false });
    if (sessionId) setTimeout(function () { void watch(); }, 250);
  }

  setupMode();
})();
