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
  function showOverlay(show) {
    el('overlay').style.display = show ? 'flex' : 'none';
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
    return user.user_metadata?.full_name || user.email?.split('@')[0] || tr('Duvela teacher', 'Преподаватель Duvela');
  }
  function teacherWatchTitle(name) {
    return (name || tr('A teacher', 'Преподаватель')) + tr(' is live on Duvela', ' в эфире на Duvela');
  }
  function formatElapsed(value) {
    var started = new Date(value || Date.now()).getTime();
    var diff = Math.max(0, Date.now() - started);
    var totalSeconds = Math.floor(diff / 1000);
    var minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    var seconds = String(totalSeconds % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  }
  function startElapsedClock(value) {
    clearInterval(elapsedTimer);
    el('elapsedText').textContent = formatElapsed(value);
    elapsedTimer = setInterval(function () {
      el('elapsedText').textContent = formatElapsed(value);
    }, 1000);
  }
  function stopElapsedClock() {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
    el('elapsedText').textContent = '00:00';
  }
  function renderFacts(session) {
    var facts = [
      { label: tr('Teacher', 'Преподаватель'), value: session?.teacher_name || teacher || tr('Waiting', 'Ожидание') },
      { label: tr('Level', 'Уровень'), value: session?.level || tr('Open', 'Открытый') },
      { label: tr('Language', 'Язык'), value: session?.language || tr('General', 'Общий') },
      { label: tr('Access', 'Доступ'), value: session?.is_private ? tr('Private', 'Приватный') : tr('Public', 'Публичный') }
    ];
    el('sessionFacts').innerHTML = facts.map(function (fact) {
      return '<div class="fact"><span>' + esc(fact.label) + '</span><b>' + esc(fact.value) + '</b></div>';
    }).join('');
  }
  function updateHostControls() {
    el('toggleMic').textContent = micEnabled ? tr('Mute mic', 'Выключить микрофон') : tr('Unmute mic', 'Включить микрофон');
    el('toggleCam').textContent = camEnabled ? tr('Camera off', 'Выключить камеру') : tr('Camera on', 'Включить камеру');
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
        renderFacts(currentSession);
        if (currentSession.topic) el('title').textContent = currentSession.topic;
        if (currentSession.status === 'ended') {
          showOverlay(true);
          setStatus(tr('LIVE ended', 'Эфир завершён'), '');
          setStage('', tr('The live session has ended.', 'Эфир завершён.'));
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
    if (!session?.id) return;
    var url = new URL('./live.html', window.location.href);
    url.searchParams.set('s', session.id);
    if (session.teacher_name) url.searchParams.set('t', session.teacher_name);
    el('shareUrl').value = url.href;
    el('shareBox').classList.add('visible');
    renderFacts(session);
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
    if (anon.error || !anon.data.session) throw new Error(tr('Could not create viewer session.', 'Не удалось создать viewer session.'));
    return anon.data.session;
  }
  async function getPublisherToken(channelName, uid) {
    var fn = await supa.functions.invoke('agora-token', {
      body: { channelName: channelName, uid: uid, role: 'publisher', ttlSeconds: 3600 }
    });
    if (fn.error) throw new Error(fn.error.message || tr('Could not get host token.', 'Не удалось получить host token.'));
    if (!fn.data?.token) throw new Error(tr('Could not get host token.', 'Не удалось получить host token.'));
    return fn.data.token;
  }
  async function getSubscriberToken(channelName, uid) {
    var fn = await supa.functions.invoke('agora-token', {
      body: { channelName: channelName, uid: uid, role: 'subscriber', ttlSeconds: 3600 }
    });
    if (fn.error) throw new Error(fn.error.message || tr('Could not get stream token.', 'Не удалось получить token для эфира.'));
    if (!fn.data?.token) throw new Error(tr('Could not get stream token.', 'Не удалось получить token для эфира.'));
    return fn.data.token;
  }
  async function loadLiveSession(id) {
    var result = await supa.from('live_sessions').select(LIVE_FIELDS).eq('id', id).maybeSingle();
    if (result.error || !result.data) throw new Error(tr('This LIVE was not found.', 'Этот LIVE не найден.'));
    return result.data;
  }
  async function createLiveSession(user) {
    var now = new Date().toISOString();
    var topic = el('topicInput').value.trim() || tr('Live lesson', 'Live-урок');
    var payload = {
      channel_name: createChannelName(user.id),
      ended_at: null,
      heartbeat_at: now,
      is_private: el('privateInput').checked,
      level: el('levelInput').value || null,
      price_per_minute: 0,
      started_at: now,
      status: 'live',
      teacher_id: user.id,
      teacher_name: displayName(user),
      topic: topic
    };
    var result = await supa
      .from('live_sessions')
      .upsert(payload, { onConflict: 'channel_name' })
      .select(LIVE_FIELDS)
      .single();
    if (result.error || !result.data) {
      throw new Error(result.error?.message || tr('Could not create LIVE. Make sure this account is a teacher/organizer.', 'Не удалось создать LIVE. Проверьте, что аккаунт отмечен как teacher или organizer.'));
    }
    return result.data;
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
      setStage('', tr('Live studio is not configured.', 'Live Studio не настроена.'));
      return;
    }
    if (client) {
      try { await client.leave(); } catch (e) {}
      client = null;
    }
    el('mainAction').disabled = true;
    setStatus(tr('Starting teacher LIVE', 'Запуск teacher LIVE'), 'ready');
    setStage('<div class="spinner"></div>', tr('Preparing camera and microphone...', 'Подготовка камеры и микрофона...'));
    try {
      var authSession = await requireSessionForHost();
      currentUser = authSession.user;
      var uid = createAgoraUid(currentUser.id);
      currentSession = sessionId ? await loadLiveSession(sessionId) : await createLiveSession(currentUser);
      if (currentSession.teacher_id && currentSession.teacher_id !== currentUser.id) {
        throw new Error(tr('This LIVE belongs to another teacher.', 'Этот LIVE принадлежит другому преподавателю.'));
      }
      if (currentSession.status !== 'live') throw new Error(tr('This LIVE is not active.', 'Этот LIVE сейчас не активен.'));

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
      el('subtitle').textContent = tr('You are live from the browser. Students can open the watch link.', 'Вы уже в эфире из браузера. Ученики могут открыть ссылку для просмотра.');
      showOverlay(false);
      el('endLive').style.display = 'inline-flex';
      el('toggleMic').style.display = 'inline-flex';
      el('toggleCam').style.display = 'inline-flex';
      updateHostControls();
      el('mainAction').textContent = tr('LIVE is running', 'LIVE запущен');
      setStatus(tr('Teacher is LIVE', 'Teacher в эфире'), 'live');
      setStage('', '');
      updateUrlForHost(currentSession);
      updateShareLink(currentSession);
      startElapsedClock(currentSession.started_at || new Date().toISOString());
      startSessionPolling();
      await markHeartbeat();
      heartbeatTimer = setInterval(markHeartbeat, 30000);
    } catch (error) {
      el('mainAction').disabled = false;
      el('mainAction').textContent = sessionId ? tr('Enter as teacher', 'Войти как teacher') : tr('Start LIVE', 'Запустить LIVE');
      setStatus(tr('Not live', 'Не в эфире'), '');
      setStage('', error?.message || tr('Could not start LIVE.', 'Не удалось запустить LIVE.'));
      await stopMedia(false);
    }
  }
  async function watch() {
    if (!sessionId) {
      setStage('', tr('No live session selected.', 'Live-сессия не выбрана.'));
      return;
    }
    if (!supa || !window.AgoraRTC || !AGORA_APP_ID) {
      setStage('', tr('Open the app to watch this lesson.', 'Откройте приложение, чтобы смотреть этот урок.'));
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
      currentSession = await loadLiveSession(sessionId);
      renderFacts(currentSession);
      startElapsedClock(currentSession.started_at || new Date().toISOString());
      startSessionPolling();
      if (currentSession.status !== 'live') throw new Error(tr('This LIVE has ended.', 'Этот LIVE уже завершён.'));
      if (currentSession.is_private) throw new Error(tr('This is a private lesson. Open the app to request access.', 'Это приватный урок. Откройте приложение, чтобы запросить доступ.'));
      if (currentSession.teacher_name && !teacher) el('title').textContent = teacherWatchTitle(currentSession.teacher_name);
      var token = await getSubscriberToken(currentSession.channel_name, uid);
      client = window.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      await client.setClientRole('audience');
      client.on('user-published', async function (remoteUser, mediaType) {
        await client.subscribe(remoteUser, mediaType);
        if (mediaType === 'video') {
          showOverlay(false);
          remoteUser.videoTrack.play('player', { fit: 'cover' });
          setStatus(tr('Watching LIVE', 'Смотрим LIVE'), 'live');
        }
        if (mediaType === 'audio') {
          try { remoteUser.audioTrack.play(); }
          catch (e) { showSoundPill(remoteUser); }
        }
      });
      client.on('user-unpublished', function () {
        showOverlay(true);
        setStage('', tr('The teacher paused the stream.', 'Преподаватель поставил эфир на паузу.'));
      });
      await client.join(AGORA_APP_ID, currentSession.channel_name, token, uid);
      setStage('<div class="spinner"></div>', tr('Waiting for the teacher camera...', 'Ожидаем камеру преподавателя...'));
      el('mainAction').disabled = false;
      el('mainAction').textContent = tr('Try again', 'Повторить');
    } catch (error) {
      el('mainAction').disabled = false;
      el('mainAction').textContent = tr('Try again', 'Повторить');
      setStatus(tr('Not connected', 'Нет подключения'), '');
      setStage('', error?.message || tr('Could not start the stream.', 'Не удалось запустить эфир.'));
      showOverlay(true);
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
    el('toggleMic').style.display = 'none';
    el('toggleCam').style.display = 'none';
    if (markSessionEnded) await markEnded();
  }
  async function endHost() {
    el('endLive').disabled = true;
    setStatus(tr('Ending LIVE', 'Завершаем LIVE'), 'ready');
    await stopMedia(true);
    showOverlay(true);
    el('endLive').style.display = 'none';
    el('endLive').disabled = false;
    el('mainAction').disabled = false;
    el('mainAction').textContent = tr('Start LIVE', 'Запустить LIVE');
    setStatus(tr('LIVE ended', 'Эфир завершён'), '');
    setStage('', tr('The live session has ended.', 'Эфир завершён.'));
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
  function setupMode() {
    document.documentElement.lang = isRu ? 'ru' : 'en';
    document.querySelector('label[for="topicInput"]').textContent = tr('LIVE title', 'Название LIVE');
    document.querySelector('label[for="levelInput"]').textContent = tr('Level', 'Уровень');
    document.querySelector('label[for="shareUrl"]').textContent = tr('Student watch link', 'Ссылка для просмотра ученикам');
    document.querySelector('#hostSetup .check-row span').textContent = tr('Private room', 'Приватная комната');
    el('topicInput').value = tr('Live lesson', 'Live-урок');
    el('soundPill').textContent = tr('Tap for sound', 'Нажмите для звука');
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
      setTimeout(function () { el('copyShare').textContent = tr('Copy link', 'Копировать ссылку'); }, 1200);
    });
    el('endLive').addEventListener('click', endHost);
    el('toggleMic').addEventListener('click', function () { void toggleMic(); });
    el('toggleCam').addEventListener('click', function () { void toggleCam(); });
    window.addEventListener('beforeunload', function () {
      if (isHostMode) void stopMedia(true);
      else if (client) void client.leave();
    });

    if (isHostMode) {
      document.title = tr('Duvela LIVE - teacher studio', 'Duvela LIVE - teacher studio');
      el('modePill').textContent = tr('Bus Web - Teacher Live', 'Bus Web - Teacher Live');
      el('badgeText').textContent = 'TEACHER LIVE';
      el('title').textContent = sessionId ? tr('Enter teacher LIVE', 'Войти в teacher LIVE') : tr('Start teacher LIVE', 'Запустить teacher LIVE');
      el('subtitle').textContent = tr('Create a live room and publish camera plus microphone from this browser.', 'Создайте live-комнату и выйдите в эфир с камеры и микрофона из браузера.');
      el('sideTitle').textContent = tr('Teacher controls', 'Управление teacher LIVE');
      el('sideCopy').textContent = tr('Your teacher account must be marked as teacher or organizer in Supabase.', 'Аккаунт должен быть отмечен в Supabase как teacher или organizer.');
      el('hostSetup').style.display = 'grid';
      el('mainAction').textContent = sessionId ? tr('Enter as teacher', 'Войти как teacher') : tr('Start LIVE', 'Запустить LIVE');
      el('mainAction').addEventListener('click', startHost);
      el('dashboardLink').href = './app.html?role=teacher#live';
      el('backLink').href = './app.html?role=teacher#live';
      el('note').textContent = tr('Allow camera and microphone permissions when the browser asks.', 'Разрешите доступ к камере и микрофону, когда браузер попросит.');
      el('openApp').textContent = tr('Open in the Duvela app', 'Открыть в приложении Duvela');
      el('dashboardLink').textContent = tr('Back to web dashboard', 'Назад в веб-кабинет');
      el('copyShare').textContent = tr('Copy link', 'Копировать ссылку');
      renderFacts({ teacher_name: teacher || displayName({}), level: el('levelInput').value || 'B1', is_private: false });
      setStatus(tr('Ready for teacher', 'Готово для teacher'), 'ready');
      return;
    }

    if (teacher) el('title').textContent = teacherWatchTitle(teacher);
    el('modePill').textContent = isBusiness ? tr('Business viewer', 'Business viewer') : tr('Hub Web viewer', 'Hub Web viewer');
    el('mainAction').textContent = tr('Watch now', 'Смотреть');
    el('mainAction').addEventListener('click', watch);
    el('dashboardLink').href = './app.html?role=learner#live';
    el('backLink').href = './app.html?role=learner#live';
    el('sideTitle').textContent = tr('Live room', 'Live-комната');
    el('sideCopy').textContent = tr('Use the browser to watch the lesson, or open Duvela on mobile.', 'Смотрите урок в браузере или откройте Duvela на мобильном.');
    el('openApp').textContent = tr('Open in the Duvela app', 'Открыть в приложении Duvela');
    el('dashboardLink').textContent = tr('Back to web dashboard', 'Назад в веб-кабинет');
    el('copyShare').textContent = tr('Copy link', 'Копировать ссылку');
    setStatus(sessionId ? tr('Ready to watch', 'Готово к просмотру') : tr('No session selected', 'Сессия не выбрана'), sessionId ? 'ready' : '');
    el('note').textContent = sessionId ? tr('If playback does not start, open the lesson in the app.', 'Если воспроизведение не стартует, откройте урок в приложении.') : tr('Open a live session from Hub or Bus Web.', 'Откройте live-сессию из Hub или Bus Web.');
    renderFacts({ teacher_name: teacher || '', level: '', language: '', is_private: false });
    if (sessionId) setTimeout(function () { void watch(); }, 250);
  }

  setupMode();
})();
