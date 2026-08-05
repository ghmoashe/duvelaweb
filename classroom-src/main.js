import './style.css';

function loadScriptOnce(src, isReady) {
  return new Promise((resolve, reject) => {
    if (isReady()) return resolve();
    const existing = Array.from(document.scripts).find((script) => script.src.endsWith(src));
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}

await loadScriptOnce('/locales/web-locales.js', () => Boolean(window.DUVELA_WEB_I18N));
await loadScriptOnce('/web/app-i18n.js?v=20260804-i18n1', () => Boolean(window.DuvelaAppI18n));
await new Promise((resolve, reject) => {
  if (window.DuvelaWebConfig) return resolve();
  const script = document.createElement('script');
  script.src = '/web/duvela-web-config.js';
  script.onload = resolve;
  script.onerror = reject;
  document.head.append(script);
});

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const query = new URLSearchParams(location.search);
const sessionId = query.get('s') || '';
const config = window.DuvelaWebConfig;
const i18n = window.DuvelaAppI18n?.create({ localeCatalog: window.DUVELA_WEB_I18N, storageKeys: config?.storageKeys });
const tr = i18n?.tr || ((en, ru) => (String(localStorage.getItem('duvela.webLang') || navigator.language || '').toLowerCase().startsWith('ru') ? ru : en));
i18n?.applyDocument?.();
const supa = config?.createSupabaseClient?.();
let client = null;
let zoomClientPromise = null;
let media = null;
let me = null;
let classSession = null;
let previewStream = null;
let micOn = true;
let camOn = true;
let joined = false;
let sharing = false;
let raised = false;
let startedAt = 0;
let timer = null;
let attendanceTimer = null;
let waitingTimer = null;
let roomRole = 'participant';
let reviewRating = 0;
let endingForAll = false;
const raisedUsers = new Set();
const attachedVideoUsers = new Set();
const TILE_VIDEO_QUALITY = 2;
let pinnedUserId = null;
let activeSpeakerId = null;
let activeShareUserId = null;
let selectedCameraId = null;
let selectedMicId = null;
let selectedSpeakerId = null;
const netLevels = new Map();
const raisedUserNames = new Map();
const raisedAt = new Map();
const currentMaterials = new Map();
let activeMaterialUrl = '';
let focusedShareHidden = false;
let lastCopiedAt = 0;
const readiness = { browser: false, network: false, camera: false, mic: false };

function videoStartOptions() { return selectedCameraId ? { cameraId: selectedCameraId } : {}; }
function audioStartOptions() {
  const options = {};
  if (selectedMicId) options.microphoneId = selectedMicId;
  if (selectedSpeakerId) options.speakerId = selectedSpeakerId;
  return options;
}

async function loadZoomClient() {
  if (client) return client;
  zoomClientPromise ||= import('@zoom/videosdk')
    .then(({ default: ZoomVideo }) => ZoomVideo.createClient());
  try {
    client = await zoomClientPromise;
    return client;
  } catch (error) {
    zoomClientPromise = null;
    throw error;
  }
}

function initials(name = 'Duvela') {
  return name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
}

function userKey(userId) {
  return userId == null ? '' : String(userId);
}

function ownZoomUser() {
  return client?.getCurrentUserInfo?.() || null;
}

function roleLabel() {
  return roomRole === 'host' ? tr('Teacher', 'Учитель') : tr('Learner', 'Ученик');
}

function updateRoomStatus(users = client?.getAllUser?.() || []) {
  const activeShare = sharing || activeShareUserId != null;
  const raisedCount = users.filter((user) => raisedUsers.has(userKey(user.userId))).length;
  const weakCount = users.filter((user) => (netLevels.get(userKey(user.userId)) || 0) <= 1 && netLevels.has(userKey(user.userId))).length;
  $('rolePill').textContent = roleLabel();
  $('onlinePill').textContent = `${users.length} ${tr('online', 'онлайн')}`;
  $('onlinePill').classList.toggle('warn', weakCount > 0);
  $('onlinePill').title = weakCount ? `${weakCount} ${tr('weak connection', 'слабое соединение')}` : tr('Connection looks stable', 'Соединение выглядит стабильным');
  $('handsPill').hidden = !raisedCount;
  $('handsPill').textContent = `✋ ${raisedCount}`;
  $('sharePill').hidden = !activeShare;
  $('sharePill').textContent = sharing ? tr('You share screen', 'Вы показываете экран') : tr('Screen is shared', 'Экран показывают');
  $('sharePill').classList.toggle('live', activeShare);
}

function renderHandQueue(users, queueIndex) {
  const queued = users
    .filter((user) => queueIndex.has(userKey(user.userId)))
    .sort((a, b) => queueIndex.get(userKey(a.userId)) - queueIndex.get(userKey(b.userId)));
  const wrap = $('handQueue');
  wrap.hidden = !queued.length;
  $('queueCount').textContent = String(queued.length);
  if (!queued.length) {
    $('handQueueList').replaceChildren();
    return;
  }
  const ownId = userKey(ownZoomUser()?.userId);
  $('handQueueList').innerHTML = queued.map((user) => {
    const key = userKey(user.userId);
    const actions = roomRole === 'host' && key !== ownId
      ? `<span class="queue-actions"><button data-moderate="speak" data-zoom-user="${esc(user.userId)}">${esc(tr('Give floor', 'Дать слово'))}</button><button data-moderate="clear-hand" data-zoom-user="${esc(user.userId)}">${esc(tr('Done', 'Готово'))}</button></span>`
      : '';
    return `<div class="queue-row"><i>${queueIndex.get(key)}</i><span class="mini">${esc(initials(user.displayName))}</span><b>${esc(user.displayName || tr('Learner', 'Ученик'))}</b>${actions}</div>`;
  }).join('');
}

function setRaisedUser(userId, value, name = '') {
  const key = userKey(userId);
  if (!key) return false;
  if (value) {
    raisedUsers.add(key);
    if (name) raisedUserNames.set(key, name);
    if (!raisedAt.has(key)) raisedAt.set(key, Date.now());
  } else {
    raisedUsers.delete(key);
    raisedUserNames.delete(key);
    raisedAt.delete(key);
  }
  return true;
}

function setOwnHandRaised(value) {
  raised = !!value;
  const own = ownZoomUser();
  setRaisedUser(own?.userId, raised, own?.displayName || own?.userName || me?.name);
  const button = $('handBtn');
  button.classList.toggle('off', raised);
  button.classList.toggle('active', raised);
  button.setAttribute('aria-pressed', String(raised));
  button.querySelector('span').textContent = raised ? tr('Lower hand', 'Опустить руку') : tr('Raise hand', 'Поднять руку');
}

function updateControlStates() {
  $('previewMic')?.classList.toggle('off', !micOn);
  $('previewCam')?.classList.toggle('off', !camOn);
  $('micBtn')?.classList.toggle('off', !micOn);
  $('micBtn')?.classList.toggle('active', micOn);
  $('camBtn')?.classList.toggle('off', !camOn);
  $('camBtn')?.classList.toggle('active', camOn);
  $('shareBtn')?.classList.toggle('active', sharing);
  $('handBtn')?.classList.toggle('active', raised);
  const micLabel = $('micBtn')?.querySelector('span');
  const camLabel = $('camBtn')?.querySelector('span');
  if (micLabel) micLabel.textContent = micOn ? tr('Microphone', 'Микрофон') : tr('Mic off', 'Микрофон выкл.');
  if (camLabel) camLabel.textContent = camOn ? tr('Camera', 'Камера') : tr('Camera off', 'Камера выкл.');
}

function updateReadiness() {
  const readyCount = Object.values(readiness).filter(Boolean).length;
  $('readyScore').textContent = `${readyCount}/4`;
  $('prejoinReadiness').classList.toggle('ready', readyCount === 4);
  $('prejoinReadiness').classList.toggle('warn', readyCount > 1 && readyCount < 4);
  $('readyText').textContent = readyCount === 4
    ? tr('Ready to join.', 'Можно входить.')
    : readyCount >= 2
      ? tr('You can join, but check highlighted items.', 'Можно войти, но проверьте отмеченные пункты.')
      : tr('Check device permissions before joining.', 'Проверьте разрешения устройств перед входом.');
}

function setStatus(text, error = false) {
  $('joinStatus').textContent = text || '';
  $('joinStatus').style.color = error ? '#ff868c' : '';
}

async function preview() {
  previewStream?.getTracks().forEach((track) => track.stop());
  previewStream = null;
  if (!camOn) {
    $('previewVideo').srcObject = null;
    $('previewEmpty').textContent = tr('Camera is off', 'Камера выключена');
    $('previewEmpty').hidden = false;
    return;
  }
  try {
    const constraints = { video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true, audio: false };
    previewStream = await navigator.mediaDevices.getUserMedia(constraints);
    $('previewVideo').srcObject = previewStream;
    await $('previewVideo').play().catch(() => {});
    $('previewEmpty').hidden = true;
    void populateDevices();
  } catch {
    camOn = false;
    $('previewCam').classList.remove('active');
    $('previewEmpty').hidden = false;
  }
}

// Device labels are only exposed by the browser once camera/mic permission has
// been granted, so this runs after preview()/diagnostics. Selected ids are
// passed to Zoom's startVideo/startAudio at join time.
async function populateDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  let devices = [];
  try { devices = await navigator.mediaDevices.enumerateDevices(); } catch { return; }
  const fill = (id, kind, label, current) => {
    const select = $(id);
    if (!select) return current;
    const list = devices.filter((device) => device.kind === kind && device.deviceId);
    if (!list.length) { select.innerHTML = `<option value="">${label}</option>`; return current; }
    select.innerHTML = list.map((device, index) => `<option value="${esc(device.deviceId)}">${esc(device.label || `${label} ${index + 1}`)}</option>`).join('');
    if (current && list.some((device) => device.deviceId === current)) select.value = current;
    return select.value || null;
  };
  selectedCameraId = fill('cameraSelect', 'videoinput', tr('Camera', 'Камера'), selectedCameraId);
  selectedMicId = fill('micSelect', 'audioinput', tr('Microphone', 'Микрофон'), selectedMicId);
  selectedSpeakerId = fill('speakerSelect', 'audiooutput', tr('Speaker', 'Динамик'), selectedSpeakerId);
}

async function loadIdentity() {
  if (!supa || !sessionId) throw new Error(tr('The group lesson link is incomplete.', 'Ссылка на групповой урок неполная.'));
  const auth = await supa.auth.getUser();
  if (!auth.data?.user) {
    location.href = './index.html?next=' + encodeURIComponent(location.href);
    throw new Error(tr('Sign in to Duvela.', 'Войдите в Duvela.'));
  }
  me = auth.data.user;
  const [profileResult, sessionResult] = await Promise.all([
    supa.from('profiles').select('full_name,avatar_url').eq('id', me.id).maybeSingle(),
    supa.from('class_sessions').select('id,class_id,title,starts_at,status,provider').eq('id', sessionId).maybeSingle()
  ]);
  if (sessionResult.error || !sessionResult.data) throw new Error(tr('Lesson not found or you do not have access.', 'Урок не найден или у вас нет доступа.'));
  classSession = sessionResult.data;
  me.name = profileResult.data?.full_name || me.email?.split('@')[0] || 'Duvela learner';
  $('joinTitle').textContent = classSession.title || tr('Group lesson', 'Групповой урок');
  $('roomTitle').textContent = classSession.title || tr('Group lesson', 'Групповой урок');
}

async function token() {
  const result = await supa.functions.invoke('zoom-video-token', { body: { sessionId } });
  if (result.data?.waiting) return result.data;
  if (result.error || !result.data?.token) throw new Error(result.data?.error || result.error?.message || tr('Could not open Zoom Classroom.', 'Не удалось открыть Zoom Classroom.'));
  return result.data;
}

function diagnostic(id, ok, text) {
  const node = $(id);
  node.className = ok ? 'ok' : 'bad';
  node.textContent = `${ok ? '✓' : '!'} ${text}`;
}

async function runDiagnostics() {
  readiness.browser = !!(window.WebAssembly && window.RTCPeerConnection);
  readiness.network = navigator.onLine;
  readiness.camera = !!navigator.mediaDevices?.getUserMedia && camOn;
  diagnostic('diagBrowser', readiness.browser, tr('Browser', 'Браузер'));
  diagnostic('diagNetwork', readiness.network, navigator.connection?.effectiveType ? `${tr('Internet', 'Интернет')} · ${navigator.connection.effectiveType}` : tr('Internet', 'Интернет'));
  diagnostic('diagCamera', readiness.camera, camOn ? tr('Camera', 'Камера') : tr('Camera off', 'Камера выкл.'));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    readiness.mic = micOn;
    diagnostic('diagMic', readiness.mic, micOn ? tr('Microphone', 'Микрофон') : tr('Mic off', 'Микрофон выкл.'));
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    readiness.mic = false;
    diagnostic('diagMic', false, tr('Microphone', 'Микрофон'));
  }
  updateReadiness();
  updateControlStates();
}

async function renderWaitingRoom() {
  if (roomRole !== 'host') return;
  const { data } = await supa.from('class_waiting_room').select('id,user_id,status').eq('session_id', sessionId).eq('status', 'waiting');
  const rows = data || [];
  $('waitingWrap').hidden = !rows.length;
  $('waitingList').innerHTML = rows.map((row) => `<div class="waiting-person"><b>${esc(row.user_id.slice(0, 8))}</b><button class="admit" data-wait="${row.id}" data-decision="admitted">${esc(tr('Admit', 'Впустить'))}</button><button data-wait="${row.id}" data-decision="denied">${esc(tr('Deny', 'Отклонить'))}</button></div>`).join('');
}

function tile(user) {
  const ownId = ownZoomUser()?.userId;
  const hasRaisedHand = raisedUsers.has(userKey(user.userId));
  let node = document.querySelector(`.tile[data-user="${user.userId}"]`);
  if (!node) {
    node = document.createElement('article');
    node.className = 'tile';
    node.dataset.user = user.userId;
    node.innerHTML = `<video-player-container class="video-slot"></video-player-container><div class="avatar">${initials(user.displayName)}</div><div class="net" hidden><i></i><i></i><i></i></div><div class="pin-mark" hidden>📌</div><div class="hand-mark" hidden>✋</div><div class="tile-label"></div>`;
    $('gallery').append(node);
  }
  node.toggleAttribute('data-self', userKey(user.userId) === userKey(ownId));
  node.classList.toggle('raised', hasRaisedHand);
  node.classList.toggle('pinned', String(user.userId) === String(pinnedUserId));
  node.querySelector('.pin-mark').hidden = String(user.userId) !== String(pinnedUserId);
  node.querySelector('.hand-mark').hidden = !hasRaisedHand;
  node.querySelector('.tile-label').textContent = `${user.audio === 'muted' ? '🔇' : '🎙'} ${user.displayName}${userKey(user.userId) === userKey(ownId) ? ' (' + tr('You', 'Вы') + ')' : ''}`;
  node.querySelector('.avatar').hidden = !!user.bVideoOn;
  node.querySelector('.video-slot').hidden = !user.bVideoOn;
  return node;
}

// Move each user's tile into the container the current layout calls for and
// toggle the containers. Moving the <article> node keeps its attached Zoom video
// element intact, so no re-attach/flicker. Modes: share > spotlight > grid.
function spotlightTarget(users) {
  if (pinnedUserId && users.some((u) => String(u.userId) === String(pinnedUserId))) return String(pinnedUserId);
  if (users.length > 2 && activeSpeakerId && users.some((u) => String(u.userId) === String(activeSpeakerId))) return String(activeSpeakerId);
  return null;
}

function placeTiles(users) {
  const shareAvailable = sharing || activeShareUserId != null;
  const sharing_ = shareAvailable && !focusedShareHidden;
  const target = sharing_ ? null : spotlightTarget(users);
  const mode = sharing_ ? 'share' : (target ? 'spotlight' : 'grid');
  const gallery = $('gallery'), spotlight = $('spotlight'), filmstrip = $('filmstrip'), shareStage = $('shareStage');
  gallery.hidden = mode !== 'grid';
  spotlight.hidden = mode !== 'spotlight';
  shareStage.hidden = mode !== 'share';
  filmstrip.hidden = mode === 'grid';
  for (const user of users) {
    const node = document.querySelector(`.tile[data-user="${user.userId}"]`);
    if (!node) continue;
    let container = gallery;
    if (mode === 'spotlight') container = String(user.userId) === target ? spotlight : filmstrip;
    else if (mode === 'share') container = filmstrip;
    if (node.parentElement !== container) container.append(node);
  }
  if (!filmstrip.children.length) filmstrip.hidden = true;
  $('restoreShareBtn').hidden = !(shareAvailable && focusedShareHidden);
  $('emptyState').hidden = !(mode === 'grid' && users.length <= 1);
}

function updateNet(userId) {
  const node = document.querySelector(`.tile[data-user="${userId}"] .net`);
  if (!node) return;
  const level = netLevels.get(String(userId));
  if (level == null) { node.hidden = true; return; }
  node.hidden = false;
  node.querySelectorAll('i').forEach((bar, index) => {
    bar.classList.toggle('on', index < level);
    bar.classList.toggle('bad', level <= 1);
    bar.style.height = `${5 + index * 4}px`;
  });
}

function removeVideoElements(elements) {
  const list = Array.isArray(elements) ? elements : [elements];
  list.forEach((element) => element?.remove?.());
}

async function detachTileVideo(userId, slot) {
  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId)) return;
  if (media?.detachVideo && attachedVideoUsers.has(numericUserId)) {
    try {
      removeVideoElements(await media.detachVideo(numericUserId));
    } catch {}
  }
  attachedVideoUsers.delete(numericUserId);
  const target = slot || document.querySelector(`[data-user="${numericUserId}"] .video-slot`);
  if (target) {
    target.replaceChildren();
    delete target.dataset.attachedUser;
  }
}

async function attachTileVideo(user, node) {
  const slot = node.querySelector('.video-slot');
  if (!slot || !media?.attachVideo) return false;
  const userId = Number(user.userId);
  if (slot.dataset.attachedUser === String(user.userId) && slot.childElementCount) return true;
  if (slot.dataset.attachedUser) await detachTileVideo(slot.dataset.attachedUser, slot);
  try {
    const player = await media.attachVideo(userId, TILE_VIDEO_QUALITY);
    if (!(player instanceof Node)) throw new Error('Zoom did not return a video element.');
    player.classList?.add('zoom-video-player');
    slot.replaceChildren(player);
    slot.dataset.attachedUser = String(user.userId);
    attachedVideoUsers.add(userId);
    return true;
  } catch {
    await detachTileVideo(userId, slot);
    return false;
  }
}

async function renderUsers() {
  if (!joined) return;
  const users = client.getAllUser();
  const ids = new Set(users.map((user) => String(user.userId)));
  for (const node of document.querySelectorAll('.tile[data-user]')) {
    if (!ids.has(node.dataset.user)) {
      await detachTileVideo(node.dataset.user, node.querySelector('.video-slot'));
      setRaisedUser(node.dataset.user, false);
      node.remove();
    }
  }
  if (pinnedUserId && !ids.has(String(pinnedUserId))) pinnedUserId = null;
  for (const user of users) {
    const node = tile(user);
    if (user.bVideoOn) {
      const attached = await attachTileVideo(user, node);
      if (!attached) {
        node.querySelector('.avatar').hidden = false;
        node.querySelector('.video-slot').hidden = true;
      }
    } else {
      await detachTileVideo(user.userId, node.querySelector('.video-slot'));
    }
    updateNet(user.userId);
  }
  placeTiles(users);
  $('peopleCount').textContent = users.length;
  const ownId = userKey(ownZoomUser()?.userId);
  const raisedCount = users.filter((user) => raisedUsers.has(userKey(user.userId))).length;
  const handBadge = $('handBadge');
  handBadge.hidden = !raisedCount;
  handBadge.textContent = `✋ ${raisedCount}`;
  const queueKeys = users
    .filter((user) => raisedUsers.has(userKey(user.userId)))
    .sort((a, b) => (raisedAt.get(userKey(a.userId)) || 0) - (raisedAt.get(userKey(b.userId)) || 0))
    .map((user) => userKey(user.userId));
  const queueIndex = new Map(queueKeys.map((key, index) => [key, index + 1]));
  renderHandQueue(users, queueIndex);
  updateRoomStatus(users);
  const sortedUsers = users.slice().sort((a, b) => {
    const aQueue = queueIndex.get(userKey(a.userId)) || 0;
    const bQueue = queueIndex.get(userKey(b.userId)) || 0;
    if (aQueue && bQueue) return aQueue - bQueue;
    const handDiff = Number(!!bQueue) - Number(!!aQueue);
    if (handDiff) return handDiff;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ru');
  });
  $('peopleList').innerHTML = sortedUsers.map((user) => {
    const key = userKey(user.userId);
    const hasRaisedHand = raisedUsers.has(key);
    const queueLabel = queueIndex.get(key) ? `<i class="queue-mark">${queueIndex.get(key)}</i>` : '';
    const netLevel = netLevels.get(key);
    const netLabel = netLevel == null ? '' : netLevel <= 1 ? ' · ' + tr('weak network', 'слабая сеть') : ' · ' + tr('network ok', 'сеть ок');
    const hostActions = roomRole === 'host' && key !== ownId ? `<span class="person-actions">${hasRaisedHand ? `<button data-moderate="speak" data-zoom-user="${user.userId}">${esc(tr('Give floor', 'Дать слово'))}</button><button data-moderate="clear-hand" data-zoom-user="${user.userId}">${esc(tr('Answered', 'Ответил'))}</button>` : ''}<button data-moderate="mute" data-zoom-user="${user.userId}" title="${esc(tr('Mute', 'Отключить звук'))}">🔇</button><button data-moderate="stop-video" data-zoom-user="${user.userId}" title="${esc(tr('Stop camera', 'Выключить камеру'))}">🚫🎥</button><button data-moderate="remove" data-zoom-user="${user.userId}">${esc(tr('Remove', 'Удалить'))}</button></span>` : '';
    return `<div class="person ${hasRaisedHand ? 'raised' : ''}"><span class="mini">${esc(initials(user.displayName))}</span><b>${queueLabel}${esc(user.displayName || tr('Participant', 'Участник'))} ${hasRaisedHand ? '<i class="raised-mark">✋</i>' : ''}</b><span class="person-state" title="${esc(netLabel.trim())}"><i>${user.bVideoOn ? '🎥' : '🚫'}</i><i>${user.audio === 'muted' ? '🔇' : '🎙'}</i>${netLevel != null && netLevel <= 1 ? '<i class="bad">⚠️</i>' : ''}</span>${hostActions}</div>`;
  }).join('');
}

function showPanel(kind) {
  $('sidePanel').classList.remove('closed');
  document.querySelectorAll('[data-panel]').forEach((button) => button.classList.toggle('active', button.dataset.panel === kind));
  $('peoplePanel').hidden = kind !== 'people';
  $('chatPanel').hidden = kind !== 'chat';
  $('materialsPanel').hidden = kind !== 'materials';
  if (kind === 'chat') $('chatBadge').textContent = '0';
}

function showReaction(emoji) {
  const node = document.createElement('span');
  node.className = 'floating-class-reaction';
  node.textContent = emoji;
  node.style.left = `${35 + Math.random() * 30}%`;
  $('reactionLayer').append(node);
  setTimeout(() => node.remove(), 2300);
}

function playNoticeSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const gain = context.createGain();
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {}
}

function showHandNotice(name) {
  if (roomRole !== 'host') return;
  playNoticeSound();
  document.querySelector('.hand-toast')?.remove();
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'hand-toast';
  node.textContent = `✋ ${name || tr('Learner', 'Ученик')} ${tr('raised a hand', 'поднял руку')}`;
  node.onclick = () => { showPanel('people'); node.remove(); };
  document.body.append(node);
  setTimeout(() => node.remove(), 7000);
}

async function acceptSpeakingTurn() {
  if (!media) return;
  const ok = micOn || confirm(tr('The teacher gave you the floor. Turn on your microphone?', 'Преподаватель дал вам слово. Включить микрофон?'));
  if (!ok) return;
  try {
    await media.unmuteAudio();
    micOn = true;
    $('micBtn').classList.toggle('off', false);
    setOwnHandRaised(false);
    await sendClassCommand({ type: 'hand', raised: false });
    await renderUsers();
  } catch (error) {
    alert(error?.message || tr('Could not turn on the microphone.', 'Не удалось включить микрофон.'));
  }
}

async function sendClassCommand(payload, userId) {
  if (!joined) return;
  const own = ownZoomUser();
  const message = {
    ...payload,
    senderUserId: userKey(own?.userId),
    senderName: own?.displayName || own?.userName || me?.name || ''
  };
  await client.getCommandClient().send(JSON.stringify(message), userId);
}

async function announceOwnHand() {
  if (!raised) return;
  await sendClassCommand({ type: 'hand', raised: true });
}

function handleClassCommand(message) {
  let payload;
  try { payload = JSON.parse(message?.text ?? message?.message ?? message); } catch { return; }
  const senderId = userKey(payload.senderUserId || payload.userId || message?.senderId || message?.sender?.userId);
  const senderName = payload.senderName || message?.sender?.name || raisedUserNames.get(senderId) || tr('Learner', 'Ученик');
  const ownId = userKey(ownZoomUser()?.userId);
  if (payload.type === 'reaction' && payload.emoji) showReaction(payload.emoji);
  if (payload.type === 'hand') {
    if (setRaisedUser(senderId, !!payload.raised, senderName) && payload.raised && roomRole === 'host' && senderId !== ownId) showHandNotice(senderName);
    void renderUsers();
  }
  if (payload.type === 'hand-clear') {
    const targetId = userKey(payload.targetUserId || senderId);
    setRaisedUser(targetId, false);
    if (!payload.targetUserId || targetId === ownId) setOwnHandRaised(false);
    void renderUsers();
  }
  if (payload.type === 'host-action' && senderId !== ownId) {
    if (payload.action === 'mute') void media?.muteAudio();
    if (payload.action === 'stop-video') void media?.stopVideo();
    if (payload.action === 'speak') void acceptSpeakingTurn();
  }
  if (payload.type === 'material-show' && payload.url) showMaterial(payload.title || tr('Material', 'Материал'), payload.fileType || '', payload.url);
  if (payload.type === 'materials-changed') void loadMaterials();
}

function bindZoomEvents() {
  client.on('user-added', () => {
    void renderUsers();
    setTimeout(() => { void announceOwnHand(); }, 500);
  });
  ['user-removed', 'user-updated', 'peer-video-state-change'].forEach((event) => client.on(event, renderUsers));
  client.on('active-speaker', (list) => {
    document.querySelectorAll('.tile').forEach((node) => node.classList.remove('speaking'));
    (list || []).forEach((speaker) => document.querySelector(`.tile[data-user="${speaker.userId}"]`)?.classList.add('speaking'));
    const top = (list || [])[0];
    const next = top ? String(top.userId) : activeSpeakerId;
    if (next !== activeSpeakerId) {
      activeSpeakerId = next;
      if (joined) void renderUsers();
    }
  });
  client.on('network-quality-change', (payload) => {
    if (!payload || payload.level == null) return;
    netLevels.set(String(payload.userId), Math.max(0, Math.min(3, Math.round((payload.level / 5) * 3))));
    updateNet(payload.userId);
  });
  client.on('chat-on-message', (payload) => {
    const mine = payload.sender?.userId === client.getCurrentUserInfo()?.userId;
    $('messages').insertAdjacentHTML('beforeend', `<div class="message"><small>${esc(mine ? tr('You', 'Вы') : payload.sender?.name || tr('Participant', 'Участник'))}</small>${esc(payload.message)}</div>`);
    $('messages').scrollTop = $('messages').scrollHeight;
    if ($('chatPanel').hidden) {
      $('chatBadge').textContent = String(Number($('chatBadge').textContent || 0) + 1);
      if (!mine) playNoticeSound();
    }
  });
  client.on('active-share-change', async (payload) => {
    const myId = ownZoomUser()?.userId;
    if (payload.state === 'Active') {
      activeShareUserId = payload.userId;
      focusedShareHidden = false;
      // Only render the incoming share when someone ELSE shares — my own share
      // is already rendered locally by startShareScreen.
      if (userKey(payload.userId) !== userKey(myId)) {
        $('shareVideo').hidden = true;
        $('shareCanvas').hidden = false;
        try { await media.startShareView($('shareCanvas'), payload.userId); } catch {}
      }
    } else {
      activeShareUserId = null;
      try { await media.stopShareView?.(); } catch {}
    }
    updateShareUi();
    await renderUsers();
  });
  client.on('command-channel-message', handleClassCommand);
  client.on('connection-change', (payload) => {
    const state = String(payload?.state || '').toLowerCase();
    let banner = document.querySelector('.reconnect');
    if (state.includes('reconnect') || state.includes('fail') || state.includes('closed')) {
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'reconnect';
        document.body.append(banner);
      }
      banner.textContent = navigator.onLine ? tr('Restoring connection...', 'Восстанавливаем соединение…') : tr('No internet. Waiting for connection...', 'Нет интернета. Ждём подключения…');
    } else if (state.includes('connected')) {
      banner?.remove();
      void renderUsers();
      void loadMaterials();
      setTimeout(() => { void announceOwnHand(); }, 500);
    }
  });
}

async function join() {
  $('joinBtn').disabled = true;
  setStatus(tr('Connecting to the lesson...', 'Подключаемся к уроку…'));
  try {
    previewStream?.getTracks().forEach((track) => track.stop());
    previewStream = null;
    $('previewVideo').srcObject = null;
    $('previewEmpty').textContent = tr('Connecting...', 'Подключаемся…');
    $('previewEmpty').hidden = false;
    const auth = await token();
    if (auth.waiting) {
      setStatus(tr('Request sent. Waiting for the teacher to admit you...', 'Запрос отправлен. Ждём, когда преподаватель впустит вас…'));
      $('joinBtn').disabled = true;
      clearInterval(waitingTimer);
      waitingTimer = setInterval(async () => {
        try {
          const retry = await token();
          if (retry.token) {
            clearInterval(waitingTimer);
            $('joinBtn').disabled = false;
            void join();
          }
        } catch (error) {
          clearInterval(waitingTimer);
          setStatus(error?.message || tr('Entry denied.', 'Вход отклонён.'), true);
        }
      }, 3000);
      return;
    }
    roomRole = auth.role || 'participant';
    await loadZoomClient();
    await client.init('en-US', 'Global', { patchJsMedia: true, stayAwake: true });
    bindZoomEvents();
    await client.join(auth.topic, auth.token, me.name, auth.password || '');
    media = client.getMediaStream();
    joined = true;
    if (roomRole === 'host') {
      void supa.from('class_sessions').update({ status: 'live' }).eq('id', sessionId).eq('created_by', me.id);
      await renderWaitingRoom();
      waitingTimer = setInterval(renderWaitingRoom, 3000);
      $('addMaterialBtn').hidden = false;
      $('hostControls').hidden = false;
      $('chatQuick').hidden = false;
    }
    await supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'join' });
    attendanceTimer = setInterval(() => { void supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'heartbeat' }); }, 30000);
    if (micOn) await media.startAudio(audioStartOptions());
    if (camOn) {
      await media.startVideo(videoStartOptions());
    }
    $('prejoin').hidden = true;
    $('room').hidden = false;
    startedAt = Date.now();
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      $('roomTime').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
    await renderUsers();
    await loadMaterials();
  } catch (error) {
    setStatus(error?.message || tr('Could not join the lesson.', 'Не удалось войти в урок.'), true);
    $('joinBtn').disabled = false;
  }
}

async function toggleMic() {
  if (!media) return;
  micOn = !micOn;
  if (micOn) await media.unmuteAudio(); else await media.muteAudio();
  updateControlStates();
  await renderUsers();
}

async function toggleCam() {
  if (!media) return;
  camOn = !camOn;
  if (camOn) await media.startVideo(videoStartOptions()); else await media.stopVideo();
  updateControlStates();
  await renderUsers();
}

// Zoom renders the local screen-share preview into the element we pass, so it
// must have layout (not display:none) first. Some browsers also require a
// <video> element instead of a <canvas> — the SDK tells us which via
// isStartShareScreenWithVideoElement().
function shareRenderElement() {
  const withVideo = typeof media.isStartShareScreenWithVideoElement === 'function' && media.isStartShareScreenWithVideoElement();
  $('shareVideo').hidden = !withVideo;
  $('shareCanvas').hidden = withVideo;
  return withVideo ? $('shareVideo') : $('shareCanvas');
}

function updateShareUi() {
  const shareActive = sharing || activeShareUserId != null;
  const shareUser = activeShareUserId == null ? null : client?.getAllUser?.().find((user) => userKey(user.userId) === userKey(activeShareUserId));
  $('shareToolbar').hidden = !shareActive;
  $('stopShareBtn').hidden = !sharing;
  $('shareStatus').textContent = sharing
    ? tr('You are sharing your screen', 'Вы показываете экран')
    : `${shareUser?.displayName || tr('Participant', 'Участник')} ${tr('is sharing a screen', 'показывает экран')}`;
  $('shareBtn').querySelector('span').textContent = sharing ? tr('Stop', 'Остановить') : tr('Screen', 'Экран');
  $('shareFitBtn').textContent = document.fullscreenElement === $('shareStage') ? tr('Collapse', 'Свернуть') : tr('Full screen', 'Во весь экран');
  $('restoreShareBtn').hidden = !(shareActive && focusedShareHidden);
  updateControlStates();
  updateRoomStatus();
}

async function copyRoomLink() {
  const button = $('copyRoomLinkBtn');
  const previous = button.textContent;
  try {
    await navigator.clipboard?.writeText(location.href);
    lastCopiedAt = Date.now();
    button.textContent = tr('Copied', 'Скопировано');
    button.classList.add('copied');
  } catch {
    prompt(tr('Copy lesson link', 'Скопируйте ссылку урока'), location.href);
  } finally {
    setTimeout(() => {
      if (Date.now() - lastCopiedAt >= 1400) {
        button.textContent = previous;
        button.classList.remove('copied');
      }
    }, 1500);
  }
}

async function toggleShare() {
  if (!media) return;
  try {
    if (sharing) {
      await media.stopShareScreen();
      sharing = false;
      if (userKey(activeShareUserId) === userKey(ownZoomUser()?.userId)) activeShareUserId = null;
    } else {
      $('shareStage').hidden = false;
      focusedShareHidden = false;
      const element = shareRenderElement();
      try {
        await media.startShareScreen(element);
        sharing = true;
        activeShareUserId = ownZoomUser()?.userId ?? activeShareUserId;
      } catch (error) {
        $('shareStage').hidden = true;
        throw error;
      }
    }
    updateShareUi();
    await renderUsers();
  } catch (error) {
    // Dismissing the browser's "choose what to share" picker throws
    // NotAllowedError/AbortError — that's a user cancel, not a failure, so stay quiet.
    if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') return;
    console.error('startShareScreen failed:', error);
    alert(`${error?.message || tr('Could not start screen sharing', 'Не удалось начать демонстрацию экрана')}${error?.name ? ` [${error.name}]` : ''}`);
  }
}

// Materials live in the PRIVATE `class-materials` bucket, keyed by
// `<sessionId>/<userId>/...` so the storage RLS (which parses the session id
// from the object path) admits enrolled learners. Rows carry storage_path +
// file_type; files are opened through short-lived signed URLs. The table also
// has a legacy NOT NULL `file_url` column we don't use — it defaults to '' at
// the DB level so these inserts (which omit it) succeed. `mime_type` does not
// exist. This mirrors the mobile apps' shared/supabase/class-materials.ts so
// materials interoperate across surfaces.
const MATERIAL_BUCKET = 'class-materials';
const MATERIAL_SIGNED_TTL = 60 * 60;

function showMaterial(title, fileType, url) {
  if (!url) return;
  activeMaterialUrl = url;
  $('materialTitle').textContent = title || tr('Material', 'Материал');
  const isImage = /^image\//.test(fileType || '') || /\.(png|jpe?g|webp)(\?|$)/i.test(url);
  const preview = isImage
    ? `<img src="${esc(url)}" alt="${esc(title || tr('Material', 'Материал'))}">`
    : `<iframe src="${esc(url)}" title="${esc(title || tr('Material', 'Материал'))}"></iframe>`;
  $('materialPreview').innerHTML = preview;
  $('materialOverlay').hidden = false;
}

function closeMaterial() {
  activeMaterialUrl = '';
  $('materialOverlay').hidden = true;
  $('materialPreview').replaceChildren();
}

async function loadMaterials() {
  if (!supa || !sessionId) return;
  const { data, error } = await supa.from('class_session_materials')
    .select('id,title,storage_path,file_type,allow_download,sort_order')
    .eq('session_id', sessionId).order('sort_order').order('created_at');
  if (error) {
    $('materialsList').innerHTML = '<p>' + esc(tr('Materials are not available yet.', 'Материалы пока недоступны.')) + '</p>';
    return;
  }
  const rows = data || [];
  const resolved = await Promise.all(rows.map(async (item) => {
    let url = '';
    if (item.storage_path) {
      const signed = await supa.storage.from(MATERIAL_BUCKET).createSignedUrl(item.storage_path, MATERIAL_SIGNED_TTL);
      url = (signed.data && signed.data.signedUrl) || '';
    }
    return { item, url };
  }));
  currentMaterials.clear();
  resolved.forEach(({ item, url }) => currentMaterials.set(String(item.id), { item, url }));
  $('materialsList').innerHTML = resolved.length ? resolved.map(({ item, url }) => {
    const canOpenExternal = (item.allow_download || roomRole === 'host') && url;
    const actions = url ? `<div class="material-actions"><button data-material-action="preview" data-material-id="${esc(item.id)}">${esc(tr('Watch', 'Смотреть'))}</button>${canOpenExternal ? `<a href="${esc(url)}" target="_blank" rel="noopener"><button type="button">${esc(tr('Open', 'Открыть'))}</button></a>` : ''}${roomRole === 'host' ? `<button data-material-action="show" data-material-id="${esc(item.id)}">${esc(tr('Show everyone', 'Показать всем'))}</button>` : ''}</div>` : '<small>' + esc(tr('View only', 'Только просмотр')) + '</small>';
    return `<div class="material-row"><span>${item.file_type === 'application/pdf' ? '📄' : '🖼'}</span><div><b>${esc(item.title)}</b><small>${esc(item.file_type || tr('Material', 'Материал'))}</small></div>${actions}</div>`;
  }).join('') : '<p>' + esc(tr('No materials for this lesson yet.', 'Материалов к этому уроку пока нет.')) + '</p>';
}

async function uploadMaterial(file) {
  if (roomRole !== 'host' || !file) return;
  const ext = ((file.name.split('.').pop() || (file.type.split('/')[1] || 'bin')).replace(/[^a-z0-9]/gi, '') || 'bin').toLowerCase();
  const unique = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `${sessionId}/${me.id}/${unique}.${ext}`;
  const uploaded = await supa.storage.from(MATERIAL_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (uploaded.error) throw uploaded.error;
  const saved = await supa.from('class_session_materials').insert({
    session_id: sessionId, added_by: me.id, title: file.name,
    storage_path: path, file_type: file.type || 'application/octet-stream', allow_download: true
  });
  if (saved.error) {
    await supa.storage.from(MATERIAL_BUCKET).remove([path]);
    throw saved.error;
  }
  await loadMaterials();
  await sendClassCommand({ type: 'materials-changed' });
}

async function performLeave(endForAll = false) {
  clearInterval(timer);
  clearInterval(attendanceTimer);
  clearInterval(waitingTimer);
  try { await supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'leave' }); } catch {}
  if (roomRole === 'host' && endForAll) {
    try { await supa.from('class_sessions').update({ status: 'ended' }).eq('id', sessionId).eq('created_by', me.id); } catch {}
  }
  await Promise.all(Array.from(document.querySelectorAll('[data-user]')).map((node) => detachTileVideo(node.dataset.user, node.querySelector('.video-slot'))));
  try { if (joined) await client.leave(endForAll); } catch {}
  joined = false;
  if (roomRole === 'host') {
    location.href = './app.html?role=teacher#management';
  } else {
    $('reviewDuration').textContent = `${tr('You were in the lesson for', 'Вы были на уроке')} ${$('roomTime').textContent || '00:00'}.`;
    $('reviewDialog').hidden = false;
  }
}

function leave() {
  $('leaveDialog').hidden = false;
  $('endForAllBtn').hidden = roomRole !== 'host';
}

$('previewMic').onclick = () => { micOn = !micOn; $('previewMic').classList.toggle('active', micOn); updateControlStates(); void runDiagnostics(); };
$('previewCam').onclick = () => { camOn = !camOn; $('previewCam').classList.toggle('active', camOn); updateControlStates(); void preview(); void runDiagnostics(); };
$('cameraSelect').onchange = () => { selectedCameraId = $('cameraSelect').value || null; void preview(); };
$('micSelect').onchange = () => { selectedMicId = $('micSelect').value || null; };
$('speakerSelect').onchange = () => { selectedSpeakerId = $('speakerSelect').value || null; };
// Click a video tile to pin it big (click again to unpin and return to grid/auto).
document.querySelector('.stage').onclick = (event) => {
  const node = event.target.closest('.tile[data-user]');
  if (!node) return;
  pinnedUserId = String(pinnedUserId) === String(node.dataset.user) ? null : node.dataset.user;
  void renderUsers();
};
$('joinBtn').onclick = join;
$('micBtn').onclick = toggleMic;
$('camBtn').onclick = toggleCam;
$('copyRoomLinkBtn').onclick = copyRoomLink;
$('shareBtn').onclick = toggleShare;
$('stopShareBtn').onclick = () => { if (sharing) void toggleShare(); };
$('shareReturnBtn').onclick = () => {
  focusedShareHidden = true;
  void renderUsers();
  updateShareUi();
};
$('restoreShareBtn').onclick = () => {
  focusedShareHidden = false;
  void renderUsers();
  updateShareUi();
};
$('shareFitBtn').onclick = async () => {
  try {
    if (document.fullscreenElement === $('shareStage')) await document.exitFullscreen();
    else await $('shareStage').requestFullscreen?.();
  } finally {
    updateShareUi();
  }
};
$('peopleBtn').onclick = () => showPanel('people');
$('chatBtn').onclick = () => showPanel('chat');
$('materialsBtn').onclick = () => showPanel('materials');
$('handBtn').onclick = async () => {
  setOwnHandRaised(!raised);
  await renderUsers();
  await sendClassCommand({ type: 'hand', raised });
};
$('reactionBtn').onclick = () => { $('reactionChoices').hidden = !$('reactionChoices').hidden; };
$('reactionChoices').onclick = async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const emoji = button.textContent.trim();
  showReaction(emoji);
  $('reactionChoices').hidden = true;
  await sendClassCommand({ type: 'reaction', emoji });
};
$('leaveBtn').onclick = $('leaveTop').onclick = leave;
document.querySelectorAll('[data-panel]').forEach((button) => button.onclick = () => showPanel(button.dataset.panel));
$('peopleList').onclick = async (event) => {
  const button = event.target.closest('[data-moderate]');
  if (!button || roomRole !== 'host') return;
  const userId = Number(button.dataset.zoomUser);
  const action = button.dataset.moderate;
  if (action === 'remove') {
    if (confirm(tr('Remove this participant from the lesson?', 'Удалить участника из урока?'))) await client.removeUser(userId);
    return;
  }
  if (action === 'clear-hand') {
    setRaisedUser(userId, false);
    await sendClassCommand({ type: 'hand-clear', targetUserId: userId }, userId);
    await renderUsers();
    return;
  }
  if (action === 'speak') {
    pinnedUserId = String(userId);
    setRaisedUser(userId, false);
    await sendClassCommand({ type: 'host-action', action: 'speak' }, userId);
    await sendClassCommand({ type: 'hand-clear', targetUserId: userId }, userId);
    await renderUsers();
    return;
  }
  if (action === 'mute') await media.muteAudio(userId);
  if (action === 'stop-video') await sendClassCommand({ type: 'host-action', action: 'stop-video' }, userId);
};
$('handQueue').onclick = (event) => $('peopleList').onclick(event);
$('hostControls').onclick = async (event) => {
  const button = event.target.closest('[data-host-control]');
  if (!button || roomRole !== 'host') return;
  const ownId = userKey(ownZoomUser()?.userId);
  const users = client.getAllUser().filter((user) => userKey(user.userId) !== ownId);
  if (button.dataset.hostControl === 'mute-all') {
    await Promise.all(users.map((user) => Promise.resolve(media.muteAudio(Number(user.userId))).catch(() => {})));
  }
  if (button.dataset.hostControl === 'stop-video-all') {
    await Promise.all(users.map((user) => Promise.resolve(sendClassCommand({ type: 'host-action', action: 'stop-video' }, Number(user.userId))).catch(() => {})));
  }
  if (button.dataset.hostControl === 'lower-all-hands') {
    users.forEach((user) => setRaisedUser(user.userId, false));
    await Promise.all(users.map((user) => Promise.resolve(sendClassCommand({ type: 'hand-clear', targetUserId: user.userId }, Number(user.userId))).catch(() => {})));
  }
  await renderUsers();
};
$('chatQuick').onclick = async (event) => {
  const button = event.target.closest('[data-quick-chat]');
  if (!button || !joined) return;
  await client.getChatClient().sendToAll(button.dataset.quickChat);
};
$('addMaterialBtn').onclick = () => $('materialFile').click();
$('closeMaterialBtn').onclick = closeMaterial;
$('materialsList').onclick = async (event) => {
  const button = event.target.closest('[data-material-action]');
  if (!button) return;
  const record = currentMaterials.get(String(button.dataset.materialId));
  if (!record?.url) return;
  showMaterial(record.item.title, record.item.file_type, record.url);
  if (button.dataset.materialAction === 'show' && roomRole === 'host') {
    await sendClassCommand({
      type: 'material-show',
      title: record.item.title,
      fileType: record.item.file_type,
      url: record.url
    });
  }
};
$('materialFile').onchange = async () => {
  const file = $('materialFile').files?.[0];
  if (!file) return;
  try { await uploadMaterial(file); } catch (error) { alert(error?.message || tr('Could not add material.', 'Не удалось добавить материал.')); }
  $('materialFile').value = '';
};
$('exitOnlyBtn').onclick = () => { $('leaveDialog').hidden = true; void performLeave(false); };
$('endForAllBtn').onclick = () => {
  if (!confirm(tr('End the lesson for all participants?', 'Завершить урок для всех участников?'))) return;
  endingForAll = true;
  $('leaveDialog').hidden = true;
  void performLeave(true);
};
$('leaveCancelBtn').onclick = () => { $('leaveDialog').hidden = true; };
$('reviewStars').onclick = (event) => {
  const buttons = Array.from($('reviewStars').querySelectorAll('button'));
  const index = buttons.indexOf(event.target.closest('button'));
  if (index < 0) return;
  reviewRating = index + 1;
  buttons.forEach((button, buttonIndex) => button.classList.toggle('active', buttonIndex < reviewRating));
};
$('reviewSaveBtn').onclick = async () => {
  const comment = $('reviewComment').value.trim();
  if (reviewRating) {
    const result = await supa.from('class_session_reviews').upsert({
      session_id: sessionId, user_id: me.id, rating: reviewRating, comment,
      updated_at: new Date().toISOString()
    }, { onConflict: 'session_id,user_id' });
    if (result.error) return alert(result.error.message || tr('Could not save review.', 'Не удалось сохранить отзыв.'));
  }
  location.href = './app.html?role=learner#schedule';
};
$('chatForm').onsubmit = async (event) => {
  event.preventDefault();
  const value = $('chatInput').value.trim();
  if (!value) return;
  await client.getChatClient().sendToAll(value);
  $('chatInput').value = '';
};
$('waitingList').onclick = async (event) => {
  const button = event.target.closest('[data-wait]');
  if (!button || roomRole !== 'host') return;
  await supa.from('class_waiting_room').update({
    status: button.dataset.decision, decided_at: new Date().toISOString(), decided_by: me.id
  }).eq('id', button.dataset.wait);
  await renderWaitingRoom();
};
addEventListener('online', runDiagnostics);
addEventListener('offline', runDiagnostics);
addEventListener('fullscreenchange', updateShareUi);
addEventListener('beforeunload', () => {
  if (joined && !endingForAll) void supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'leave' });
});

loadIdentity().then(async () => { await runDiagnostics(); await preview(); await populateDevices(); }).catch((error) => setStatus(error.message, true));
