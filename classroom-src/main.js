import '../web/duvela-session-guard.js';
import './style.css';
import '../web/duvi-assistant.css';
import './classroom-v6.css';

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
await loadScriptOnce('/web/app-i18n.js?v=20260805-classroom2', () => Boolean(window.DuvelaAppI18n));
await loadScriptOnce('/web/duvi-assistant.js?v=20260806duvi9', () => Boolean(window.DuvelaDUVI));
await loadScriptOnce('./web/vendor/supabase-js-v2.js', () => Boolean(window.supabase?.createClient));
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
const duvi = window.DuvelaDUVI?.mount({ context: 'classroom', locale: () => i18n?.appLang, autoWelcome: true });
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
let audioStarted = false;
// 'speaker' keeps the original auto layout (pinned or active speaker big);
// 'gallery' keeps everyone in the grid unless someone is pinned.
let viewMode = 'speaker';
let connectionState = 'connecting';
const readiness = { browser: false, network: false, camera: false, mic: false };

const icon = (name, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

function localizeV6() {
  const set = (selector, text) => document.querySelectorAll(selector).forEach((node) => { node.textContent = text; });
  set('[data-host-control="invite"] span', tr('Invite', 'Пригласить'));
  set('#moreBtn span', tr('More', 'Ещё'));
  set('[data-tool="devices"] span', tr('Devices', 'Устройства'));
  set('[data-tool="fullscreen"] span', tr('Full screen', 'Во весь экран'));
  set('[data-tool="invite"] span', tr('Copy invite link', 'Скопировать ссылку-приглашение'));
  set('#devicesTitle', tr('Devices', 'Устройства'));
  set('#devicesHint', tr('Switch the camera, microphone or speaker without leaving the lesson.', 'Смените камеру, микрофон или динамик, не выходя из урока.'));
  set('#recordingChip span', tr('Recording', 'Идёт запись'));
  set('[data-tool="whiteboard"] span', tr('Whiteboard', 'Доска'));
  set('[data-tool="rooms"] span', tr('Breakout rooms', 'Комнаты для групп'));
  set('#roomsTitle', tr('Breakout rooms', 'Комнаты для групп'));
  set('#stopWhiteboardBtn', tr('Stop', 'Закрыть'));
  set('#leaveSubsessionBtn', tr('Return to main session', 'Вернуться в общий урок'));
  set('#askHelpBtn', tr('Ask for help', 'Позвать учителя'));
  set('#leaveDialog h2', tr('Leave the lesson', 'Завершение урока'));
  set('#leaveDialog p', tr('You can leave and come back, or end the room for everyone.', 'Можно выйти и вернуться или завершить комнату для всех участников.'));
  set('#exitOnlyBtn', tr('Leave', 'Выйти'));
  set('#endForAllBtn', tr('End for everyone', 'Завершить для всех'));
  set('#leaveCancelBtn', tr('Cancel', 'Отмена'));
  set('#reviewDialog h2', tr('How was the lesson?', 'Как прошёл урок?'));
  set('#reviewSaveBtn', tr('Save and continue', 'Сохранить и продолжить'));
  $('reviewComment').placeholder = tr('A short review or note…', 'Короткий отзыв или заметка…');
  $('peopleSearch').placeholder = tr('Search participants…', 'Поиск участников…');
  $('fullscreenBtn').setAttribute('aria-label', tr('Full screen', 'Во весь экран'));
  $('stageFullBtn').setAttribute('aria-label', tr('Full screen', 'Во весь экран'));
  $('closeSideBtn').setAttribute('aria-label', tr('Close', 'Закрыть'));
  updateViewModeUi();
  renderConnection();
}

function updateViewModeUi() {
  const next = viewMode === 'speaker' ? 'gallery' : 'speaker';
  const label = next === 'gallery' ? tr('Gallery', 'Галерея') : tr('Speaker', 'Спикер');
  $('viewModeBtn').innerHTML = `${icon(next === 'gallery' ? 'grid' : 'speaker')}<span>${esc(label)}</span>`;
  $('viewModeBtn').title = next === 'gallery' ? tr('Show everyone in a grid', 'Показать всех сеткой') : tr('Show the active speaker large', 'Показать говорящего крупно');
  const item = document.querySelector('[data-tool="view"]');
  if (item) item.innerHTML = `${icon(next === 'gallery' ? 'grid' : 'speaker')}<span>${esc(next === 'gallery' ? tr('Gallery view', 'Вид «Галерея»') : tr('Speaker view', 'Вид «Спикер»'))}</span>`;
}

// Connection chip mirrors the SDK's connection-change state and the user's own
// network-quality level; it never claims more than the SDK reported.
function renderConnection() {
  const chip = $('connChip');
  if (!chip) return;
  const labels = {
    connecting: tr('Connecting…', 'Подключение…'),
    connected: tr('Connected', 'Подключено'),
    reconnecting: tr('Reconnecting…', 'Переподключение…'),
    lost: tr('Connection lost', 'Связь потеряна')
  };
  chip.dataset.state = connectionState;
  $('connText').textContent = labels[connectionState] || labels.connecting;
  const level = netLevels.get(userKey(ownZoomUser()?.userId));
  const bars = $('connBars');
  bars.hidden = connectionState !== 'connected' || level == null;
  bars.querySelectorAll('i').forEach((bar, index) => { bar.classList.toggle('on', level != null && index < level); bar.classList.toggle('bad', level != null && level <= 1); });
  $('liveBadge').hidden = !(joined && connectionState === 'connected');
}

function isNarrow() { return matchMedia('(max-width: 980px)').matches; }

function toast(text, actionLabel, action, ms = 8000) {
  const node = document.createElement('div');
  node.className = 'cv6-toast';
  node.innerHTML = `<span>${esc(text)}</span>`;
  if (actionLabel && action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.onclick = () => { node.remove(); void action(); };
    node.append(button);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'cv6-toast-close';
  close.setAttribute('aria-label', tr('Close', 'Закрыть'));
  close.textContent = '×';
  close.onclick = () => node.remove();
  node.append(close);
  $('cv6Toasts').append(node);
  setTimeout(() => node.remove(), ms);
}

// ── Whiteboard (Video SDK WhiteboardClient, 2.3.5+) ──
// Shown only when the account has whiteboard enabled; the SDK renders into
// #whiteboardCanvas for the presenter (startWhiteboardScreen) and viewers
// (startWhiteboardView).
let whiteboardPresenterId = null;
let whiteboardViewing = false;

function whiteboardClient() {
  try { return client?.getWhiteboardClient?.() || null; } catch { return null; }
}

function whiteboardAvailable() {
  const wb = whiteboardClient();
  try { return !!wb?.isWhiteboardEnabled?.(); } catch { return false; }
}

function isOwnWhiteboard() {
  return whiteboardPresenterId != null && userKey(whiteboardPresenterId) === userKey(ownZoomUser()?.userId);
}

function updateWhiteboardUi() {
  const active = whiteboardPresenterId != null;
  const presenter = active ? client?.getAllUser?.().find((user) => userKey(user.userId) === userKey(whiteboardPresenterId)) : null;
  $('whiteboardStatus').textContent = isOwnWhiteboard()
    ? tr('You are presenting the whiteboard', 'Вы ведёте доску')
    : `${presenter?.displayName || tr('Teacher', 'Учитель')} ${tr('is presenting the whiteboard', 'ведёт доску')}`;
  $('stopWhiteboardBtn').hidden = !isOwnWhiteboard();
  const item = document.querySelector('[data-tool="whiteboard"]');
  if (item) {
    item.hidden = !whiteboardAvailable() || (active && !isOwnWhiteboard());
    item.querySelector('span').textContent = isOwnWhiteboard() ? tr('Stop whiteboard', 'Закрыть доску') : tr('Whiteboard', 'Доска');
  }
}

async function toggleWhiteboard() {
  const wb = whiteboardClient();
  if (!wb) return;
  try {
    if (isOwnWhiteboard()) {
      await wb.stopWhiteboardScreen();
      whiteboardPresenterId = null;
    } else {
      if (sharing) await toggleShare();
      if (!wb.canStartWhiteboard?.()) throw new Error(tr('The whiteboard cannot start right now (screen sharing or another whiteboard is active).', 'Доску сейчас нельзя открыть: идёт демонстрация экрана или другая доска.'));
      $('whiteboardStage').hidden = false;
      await wb.startWhiteboardScreen($('whiteboardCanvas'));
      whiteboardPresenterId = ownZoomUser()?.userId ?? null;
    }
  } catch (error) {
    if (!isOwnWhiteboard()) $('whiteboardStage').hidden = true;
    alert(error?.reason || error?.message || tr('Could not open the whiteboard.', 'Не удалось открыть доску.'));
  }
  updateWhiteboardUi();
  await renderUsers();
}

async function viewWhiteboard(presenterId) {
  const wb = whiteboardClient();
  if (!wb || presenterId == null) return;
  whiteboardPresenterId = presenterId;
  $('whiteboardStage').hidden = false;
  try {
    if (whiteboardViewing) await wb.stopWhiteboardView();
    await wb.startWhiteboardView($('whiteboardCanvas'), Number(presenterId));
    whiteboardViewing = true;
  } catch (error) {
    console.warn('Whiteboard view failed.', error);
  }
  updateWhiteboardUi();
  await renderUsers();
}

async function closeWhiteboardView() {
  const wb = whiteboardClient();
  if (whiteboardViewing) { try { await wb?.stopWhiteboardView(); } catch {} }
  whiteboardViewing = false;
  whiteboardPresenterId = null;
  $('whiteboardCanvas').replaceChildren();
  updateWhiteboardUi();
  await renderUsers();
}

// ── Breakout rooms (Video SDK SubsessionClient) ──
// Teacher-only controls; shown only when subsessions are enabled for the
// account. Learners get the SDK's invites, countdowns and broadcasts.
function subsessionClient() {
  try { return client?.getSubsessionClient?.() || null; } catch { return null; }
}

function subsessionAvailable() {
  const sub = subsessionClient();
  try { return !!sub?.isSubsessionEnabled?.(); } catch { return false; }
}

let roomCountdown = null;

function updateRoomBanner() {
  const sub = subsessionClient();
  let current = null;
  try { current = sub?.getCurrentSubsession?.() || null; } catch {}
  const inRoom = current && String(current.userStatus || '').toLowerCase() === 'in room' && current.subsessionName;
  $('roomBanner').hidden = !inRoom;
  if (inRoom) {
    const left = roomCountdown != null ? ` · ${Math.floor(roomCountdown / 60)}:${String(roomCountdown % 60).padStart(2, '0')}` : '';
    $('roomBannerText').textContent = `${tr('Breakout room', 'Комната')}: ${current.subsessionName}${left}`;
  }
  $('leaveSubsessionBtn').hidden = !inRoom;
  $('askHelpBtn').hidden = !inRoom || roomRole === 'host';
  const item = document.querySelector('[data-tool="rooms"]');
  if (item) item.hidden = !(roomRole === 'host' && subsessionAvailable());
}

function renderRoomsDialog() {
  const sub = subsessionClient();
  if (!sub) return;
  let status = 1;
  try { status = Number(sub.getSubsessionStatus?.()) || 1; } catch {}
  let rooms = [];
  try { rooms = sub.getSubsessionList?.() || []; } catch {}
  if (status === 1 || !rooms.length) {
    $('roomsHint').textContent = tr('Learners are split evenly and join their room automatically. They can return to the main session at any time.', 'Ученики распределяются поровну и входят в свою комнату автоматически. Вернуться в общий урок можно в любой момент.');
    $('roomsBody').innerHTML = `<label>${esc(tr('Rooms', 'Комнат'))}<select id="roomsCount">${[2, 3, 4, 5, 6, 8].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></label><label>${esc(tr('Timer', 'Таймер'))}<select id="roomsTimer"><option value="0">${esc(tr('No timer', 'Без таймера'))}</option>${[5, 10, 15, 20, 30].map((m) => `<option value="${m}">${m} ${esc(tr('min', 'мин'))}</option>`).join('')}</select></label><button type="button" class="primary" id="roomsOpenBtn">${esc(tr('Open rooms', 'Открыть комнаты'))}</button>`;
    $('roomsOpenBtn').onclick = openRooms;
    return;
  }
  $('roomsHint').textContent = status === 3 ? tr('Rooms are closing…', 'Комнаты закрываются…') : tr('Rooms are open.', 'Комнаты открыты.');
  $('roomsBody').innerHTML = `<div class="cv6-room-list">${rooms.map((room) => `<article><b>${esc(room.subsessionName)}</b><small>${esc((room.userList || []).map((user) => user.displayName).join(', ') || tr('Nobody yet', 'Пока никого'))}</small><button type="button" data-join-room="${esc(room.subsessionId)}">${esc(tr('Join', 'Войти'))}</button></article>`).join('')}</div><form id="roomsBroadcastForm" class="cv6-inline-form"><input id="roomsBroadcastInput" maxlength="300" placeholder="${esc(tr('Message to all rooms…', 'Сообщение во все комнаты…'))}"><button type="submit">${esc(tr('Send', 'Отправить'))}</button></form><button type="button" class="danger" id="roomsCloseAllBtn">${esc(tr('Close all rooms', 'Закрыть все комнаты'))}</button>`;
  $('roomsBody').querySelectorAll('[data-join-room]').forEach((button) => {
    button.onclick = async () => { try { await sub.joinSubsession(button.dataset.joinRoom); $('roomsDialog').hidden = true; } catch (error) { $('roomsStatus').textContent = error?.reason || error?.message || ''; } };
  });
  $('roomsBroadcastForm').onsubmit = async (event) => {
    event.preventDefault();
    const text = $('roomsBroadcastInput').value.trim();
    if (!text) return;
    try { await sub.broadcast(text); $('roomsBroadcastInput').value = ''; $('roomsStatus').textContent = tr('Sent', 'Отправлено'); } catch (error) { $('roomsStatus').textContent = error?.reason || error?.message || ''; }
  };
  $('roomsCloseAllBtn').onclick = async () => {
    try { await sub.closeAllSubsessions(); $('roomsStatus').textContent = tr('Closing rooms…', 'Закрываем комнаты…'); } catch (error) { $('roomsStatus').textContent = error?.reason || error?.message || ''; }
    setTimeout(renderRoomsDialog, 800);
  };
}

async function openRooms() {
  const sub = subsessionClient();
  if (!sub) return;
  const count = Number($('roomsCount').value) || 2;
  const minutes = Number($('roomsTimer').value) || 0;
  $('roomsStatus').textContent = tr('Opening rooms…', 'Открываем комнаты…');
  try {
    const rooms = await sub.createSubsessions(count, 1);
    if (rooms instanceof Error) throw rooms;
    await sub.openSubsessions(rooms, {
      isAutoJoinSubsession: true, isBackToMainSessionEnabled: true,
      isTimerEnabled: minutes > 0, timerDuration: minutes * 60, isTimerAutoEnabled: minutes > 0, waitSeconds: 30
    });
    $('roomsStatus').textContent = '';
  } catch (error) {
    $('roomsStatus').textContent = error?.reason || error?.message || tr('Could not open breakout rooms.', 'Не удалось открыть комнаты.');
  }
  setTimeout(renderRoomsDialog, 600);
}

function openRoomsDialog() {
  $('roomsStatus').textContent = '';
  renderRoomsDialog();
  $('roomsDialog').hidden = false;
}

function bindClassroomTools() {
  client.on('peer-whiteboard-state-change', (payload) => {
    const action = String(payload?.action || '').toLowerCase();
    if (action === 'start' && userKey(payload.userId) !== userKey(ownZoomUser()?.userId)) void viewWhiteboard(payload.userId);
    if (action === 'stop') void closeWhiteboardView();
  });
  client.on('whiteboard-status-change', () => updateWhiteboardUi());
  client.on('subsession-invite-to-join', (payload) => {
    toast(`${tr('You are invited to', 'Вас приглашают в')} ${payload?.subsessionName || tr('a breakout room', 'комнату')}`, tr('Join', 'Войти'), () => subsessionClient()?.joinSubsession(payload.subsessionId), 20000);
  });
  client.on('subsession-countdown', (payload) => { roomCountdown = Number(payload?.countdown) || null; updateRoomBanner(); });
  client.on('closing-subsession-countdown', (payload) => {
    if (Number(payload?.countdown) > 0) toast(`${tr('Rooms close in', 'Комнаты закроются через')} ${payload.countdown} ${tr('s', 'с')}`, '', null, 4000);
  });
  client.on('subsession-broadcast-message', (payload) => { if (payload?.message) toast(`📣 ${payload.message}`, '', null, 12000); });
  client.on('subsession-ask-for-help', (payload) => {
    if (roomRole !== 'host') return;
    playNoticeSound();
    toast(`${payload?.displayName || tr('A learner', 'Ученик')} ${tr('asks for help in', 'просит помощи в')} ${payload?.subsessionName || ''}`, tr('Join', 'Войти'), () => subsessionClient()?.joinSubsession(payload.subsessionId), 20000);
  });
  client.on('subsession-invite-back-to-main-session', (payload) => {
    toast(`${payload?.inviterName || tr('Teacher', 'Учитель')} ${tr('invites you back to the main session', 'зовёт вас обратно в общий урок')}`, tr('Return', 'Вернуться'), () => subsessionClient()?.leaveSubsession(), 20000);
  });
  client.on('subsession-state-change', () => { roomCountdown = null; updateRoomBanner(); if (!$('roomsDialog').hidden) renderRoomsDialog(); });
  client.on('subsession-user-update', () => { updateRoomBanner(); if (!$('roomsDialog').hidden) renderRoomsDialog(); setTimeout(() => { void renderUsers(); }, 600); });
}

// The lesson timer follows the session start (class_sessions.started_at, set
// by the zoom-video-token start action) so everyone sees the same clock.
async function lessonStartTime() {
  try {
    const { data } = await supa.from('class_sessions').select('started_at').eq('id', sessionId).maybeSingle();
    const started = Date.parse(data?.started_at || '');
    if (Number.isFinite(started) && started <= Date.now() + 60000 && Date.now() - started < 12 * 3600 * 1000) return Math.min(started, Date.now());
  } catch {}
  return Date.now();
}

async function toggleFullscreen(target) {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await target.requestFullscreen?.();
  } catch {}
}

function copyText(value) {
  return navigator.clipboard?.writeText(value).then(() => true, () => false) ?? Promise.resolve(false);
}

async function inviteLink(button) {
  const ok = await copyText(location.href);
  if (!ok) { prompt(tr('Copy lesson link', 'Скопируйте ссылку урока'), location.href); return; }
  const label = button?.querySelector('span');
  if (!label) return;
  const previous = label.textContent;
  label.textContent = tr('Copied', 'Скопировано');
  setTimeout(() => { label.textContent = previous; }, 1500);
}

function fillDeviceSelect(select, list, currentId, fallback) {
  if (!list?.length) { select.innerHTML = `<option value="">${esc(fallback)}</option>`; select.disabled = true; return; }
  select.disabled = false;
  select.innerHTML = list.map((device, index) => `<option value="${esc(device.deviceId)}">${esc(device.label || `${fallback} ${index + 1}`)}</option>`).join('');
  if (currentId && list.some((device) => device.deviceId === currentId)) select.value = currentId;
}

// Device switching uses the Video SDK stream API (getCameraList/switchCamera,
// getMicList/switchMicrophone, getSpeakerList/switchSpeaker) so Zoom keeps
// owning the media; no extra getUserMedia stream is opened in the room.
function openDevices() {
  if (!media) return;
  const cameraId = media.getActiveCamera?.() || selectedCameraId;
  const micId = media.getActiveMicrophone?.() || selectedMicId;
  const speakerId = media.getActiveSpeaker?.() || selectedSpeakerId;
  fillDeviceSelect($('roomCameraSelect'), media.getCameraList?.() || [], cameraId, tr('Camera', 'Камера'));
  fillDeviceSelect($('roomMicSelect'), media.getMicList?.() || [], micId, tr('Microphone', 'Микрофон'));
  fillDeviceSelect($('roomSpeakerSelect'), media.getSpeakerList?.() || [], speakerId, tr('Speaker', 'Динамик'));
  $('devicesStatus').textContent = '';
  $('devicesDialog').hidden = false;
}

async function switchDevice(kind, deviceId) {
  if (!media || !deviceId) return;
  $('devicesStatus').textContent = tr('Switching…', 'Переключаем…');
  try {
    if (kind === 'camera') { selectedCameraId = deviceId; if (camOn) await media.switchCamera(deviceId); }
    if (kind === 'mic') { selectedMicId = deviceId; if (audioStarted) await media.switchMicrophone(deviceId); }
    if (kind === 'speaker') { selectedSpeakerId = deviceId; if (audioStarted) await media.switchSpeaker(deviceId); }
    $('devicesStatus').textContent = tr('Done', 'Готово');
  } catch (error) {
    $('devicesStatus').textContent = error?.reason || error?.message || tr('This device could not be used.', 'Не удалось использовать это устройство.');
  }
}

function isCanceledStatus(status) {
  const value = String(status || '').toLowerCase();
  return value === 'canceled' || value === 'cancelled';
}

async function edgeFunctionMessage(error) {
  const response = error?.context;
  if (response && typeof response.clone === 'function') {
    try {
      const payload = await response.clone().json();
      if (payload?.error) return payload.error;
      if (payload?.message) return payload.message;
    } catch {
      // Fall back to the SDK message when the response is not JSON.
    }
  }
  return error?.message || '';
}

function renderLanguageSelectors() {
  const locales = i18n?.locales || [];
  const selects = [$('joinLangSelect'), $('roomLangSelect')].filter(Boolean);
  if (!locales.length || !selects.length) return;
  const options = locales.map((locale) => `<option value="${esc(locale.code)}">${esc(`${locale.flag ? `${locale.flag} ` : ''}${locale.name}`)}</option>`).join('');
  const storageKey = config?.storageKeys?.lang || window.DUVELA_WEB_I18N?.storageKey || 'duvela.webLang';
  selects.forEach((select) => {
    select.innerHTML = options;
    select.value = i18n.appLang;
    select.onchange = () => {
      localStorage.setItem(storageKey, select.value);
      localStorage.setItem('duvela.web.lang', select.value);
      location.reload();
    };
  });
}

renderLanguageSelectors();

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

// Video SDK participants carry audio: '' | 'computer' | 'phone' plus muted;
// no joined audio counts as muted.
function isMuted(user) { return !user?.audio || !!user.muted; }

function roleLabel() {
  return roomRole === 'host' ? tr('Teacher', 'Учитель') : tr('Learner', 'Ученик');
}

function updateRoomStatus(users = client?.getAllUser?.() || []) {
  const activeShare = sharing || activeShareUserId != null;
  const raisedCount = users.filter((user) => raisedUsers.has(userKey(user.userId))).length;
  const weakCount = users.filter((user) => (netLevels.get(userKey(user.userId)) || 0) <= 1 && netLevels.has(userKey(user.userId))).length;
  $('rolePill').querySelector('b').textContent = roleLabel();
  $('rolePill').classList.toggle('host', roomRole === 'host');
  $('onlinePill').innerHTML = `${icon('people')}<b>${users.length}</b> ${esc(tr('online', 'онлайн'))}`;
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
  [['micBtn', micOn ? 'mic' : 'mic-off'], ['camBtn', camOn ? 'cam' : 'cam-off'], ['previewMic', micOn ? 'mic' : 'mic-off'], ['previewCam', camOn ? 'cam' : 'cam-off']].forEach(([id, name]) => $(id)?.querySelector('use')?.setAttribute('href', `#i-${name}`));
  $('micBtn')?.setAttribute('aria-pressed', String(micOn));
  $('camBtn')?.setAttribute('aria-pressed', String(camOn));
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
  if (error && text) duvi?.show('error', { message: text });
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
  if (isCanceledStatus(classSession.status)) {
    $('joinBtn').disabled = true;
    throw new Error(tr(
      'This lesson was canceled. The teacher can restore it in Management.',
      'Этот урок отменён. Преподаватель может восстановить его в разделе «Управление».'
    ));
  }
}

async function token() {
  const result = await supa.functions.invoke('zoom-video-token', { body: { sessionId } });
  if (result.data?.waiting) return result.data;
  if (result.error || !result.data?.token) {
    const message = result.data?.error || await edgeFunctionMessage(result.error);
    throw new Error(message || tr('Could not open Zoom Classroom.', 'Не удалось открыть Zoom Classroom.'));
  }
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
    node.innerHTML = `<video-player-container class="video-slot"></video-player-container><div class="avatar">${esc(initials(user.displayName))}</div><div class="net" hidden><i></i><i></i><i></i></div><div class="pin-mark" hidden>${icon('pin')}</div><div class="hand-mark" hidden>✋</div><div class="tile-label"></div>`;
    $('gallery').append(node);
  }
  const isSelf = userKey(user.userId) === userKey(ownId);
  const muted = isMuted(user);
  node.toggleAttribute('data-self', isSelf);
  node.classList.toggle('raised', hasRaisedHand);
  node.classList.toggle('no-video', !user.bVideoOn);
  node.classList.toggle('pinned', String(user.userId) === String(pinnedUserId));
  node.querySelector('.pin-mark').hidden = String(user.userId) !== String(pinnedUserId);
  node.querySelector('.hand-mark').hidden = !hasRaisedHand;
  node.querySelector('.tile-label').innerHTML = `${user.isHost ? icon('crown', 'crown') : ''}<span>${esc(user.displayName || tr('Participant', 'Участник'))}${isSelf ? ' (' + esc(tr('You', 'Вы')) + ')' : ''}</span>${icon(muted ? 'mic-off' : 'mic', muted ? 'muted' : 'live')}`;
  node.querySelector('.avatar').hidden = !!user.bVideoOn;
  node.querySelector('.video-slot').hidden = !user.bVideoOn;
  return node;
}

// Move each user's tile into the container the current layout calls for and
// toggle the containers. Moving the <article> node keeps its attached Zoom video
// element intact, so no re-attach/flicker. Modes: share > spotlight > grid.
function spotlightTarget(users) {
  if (pinnedUserId && users.some((u) => String(u.userId) === String(pinnedUserId))) return String(pinnedUserId);
  if (viewMode === 'gallery') return null;
  if (users.length > 2 && activeSpeakerId && users.some((u) => String(u.userId) === String(activeSpeakerId))) return String(activeSpeakerId);
  return null;
}

function placeTiles(users) {
  const shareAvailable = sharing || activeShareUserId != null;
  const sharing_ = shareAvailable && !focusedShareHidden;
  const board = whiteboardPresenterId != null;
  const target = sharing_ || board ? null : spotlightTarget(users);
  const mode = board ? 'whiteboard' : sharing_ ? 'share' : (target ? 'spotlight' : 'grid');
  const gallery = $('gallery'), spotlight = $('spotlight'), filmstrip = $('filmstrip'), shareStage = $('shareStage');
  gallery.hidden = mode !== 'grid';
  spotlight.hidden = mode !== 'spotlight';
  shareStage.hidden = mode !== 'share';
  $('whiteboardStage').hidden = mode !== 'whiteboard';
  filmstrip.hidden = mode === 'grid';
  for (const user of users) {
    const node = document.querySelector(`.tile[data-user="${user.userId}"]`);
    if (!node) continue;
    let container = gallery;
    if (mode === 'spotlight') container = String(user.userId) === target ? spotlight : filmstrip;
    else if (mode === 'share' || mode === 'whiteboard') container = filmstrip;
    if (node.parentElement !== container) container.append(node);
  }
  if (!filmstrip.children.length) filmstrip.hidden = true;
  $('restoreShareBtn').hidden = !(shareAvailable && focusedShareHidden);
  $('emptyState').hidden = !(mode === 'grid' && users.length <= 1);
  gallery.dataset.count = String(Math.min(users.length, 9));
  $('stageMain').dataset.mode = mode;
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
    // You first, then the teacher, then raised hands in order, then by name.
    const selfDiff = Number(userKey(b.userId) === ownId) - Number(userKey(a.userId) === ownId);
    if (selfDiff) return selfDiff;
    const hostDiff = Number(!!b.isHost) - Number(!!a.isHost);
    if (hostDiff) return hostDiff;
    const aQueue = queueIndex.get(userKey(a.userId)) || 0;
    const bQueue = queueIndex.get(userKey(b.userId)) || 0;
    if (aQueue && bQueue) return aQueue - bQueue;
    const handDiff = Number(!!bQueue) - Number(!!aQueue);
    if (handDiff) return handDiff;
    return String(a.displayName || '').localeCompare(String(b.displayName || ''), 'ru');
  });
  $('dockPeopleCount').textContent = String(users.length);
  renderPeopleList(sortedUsers, queueIndex);
  renderConnection();
}

let lastPeople = { users: [], queueIndex: new Map() };
let openPersonMenu = '';

function renderPeopleList(sortedUsers = lastPeople.users, queueIndex = lastPeople.queueIndex) {
  lastPeople = { users: sortedUsers, queueIndex };
  const ownId = userKey(ownZoomUser()?.userId);
  const needle = ($('peopleSearch')?.value || '').trim().toLowerCase();
  const visible = needle ? sortedUsers.filter((user) => String(user.displayName || '').toLowerCase().includes(needle)) : sortedUsers;
  $('peopleList').innerHTML = visible.length ? visible.map((user) => {
    const key = userKey(user.userId);
    const isSelf = key === ownId;
    const hasRaisedHand = raisedUsers.has(key);
    const muted = isMuted(user);
    const queueLabel = queueIndex.get(key) ? `<i class="queue-mark">${queueIndex.get(key)}</i>` : '';
    const netLevel = netLevels.get(key);
    const netLabel = netLevel == null ? '' : netLevel <= 1 ? tr('weak network', 'слабая сеть') : tr('network ok', 'сеть ок');
    const role = user.isHost ? `${icon('crown', 'crown')}${esc(tr('Teacher', 'Учитель'))} · ${esc(tr('Host', 'Ведущий'))}` : esc(tr('Student', 'Ученик'));
    const canModerate = roomRole === 'host' && !isSelf;
    const menu = canModerate ? `<span class="person-menu${openPersonMenu === key ? ' open' : ''}"><button type="button" class="person-more" data-person-menu="${esc(key)}" aria-label="${esc(tr('Participant actions', 'Действия с участником'))}" aria-expanded="${openPersonMenu === key}">${icon('more')}</button><span class="person-actions" role="menu">${hasRaisedHand ? `<button data-moderate="speak" data-zoom-user="${esc(user.userId)}">${esc(tr('Give floor', 'Дать слово'))}</button><button data-moderate="clear-hand" data-zoom-user="${esc(user.userId)}">${esc(tr('Answered', 'Ответил'))}</button>` : ''}<button data-moderate="mute" data-zoom-user="${esc(user.userId)}">${icon('mic-off')}${esc(tr('Mute', 'Отключить звук'))}</button><button data-moderate="stop-video" data-zoom-user="${esc(user.userId)}">${icon('cam-off')}${esc(tr('Stop camera', 'Выключить камеру'))}</button><button data-moderate="remove" data-zoom-user="${esc(user.userId)}" class="danger-text">${esc(tr('Remove', 'Удалить'))}</button></span></span>` : '';
    return `<div class="person ${hasRaisedHand ? 'raised' : ''}${activeSpeakerId && String(user.userId) === String(activeSpeakerId) ? ' speaking' : ''}"><span class="mini">${esc(initials(user.displayName))}</span><span class="person-name"><b>${queueLabel}${esc(user.displayName || tr('Participant', 'Участник'))}${isSelf ? ` <small>(${esc(tr('You', 'Вы'))})</small>` : ''}</b><em>${role}</em></span><span class="person-state" title="${esc(netLabel)}">${hasRaisedHand ? '<i class="raised-mark" title="✋">✋</i>' : ''}${netLevel != null && netLevel <= 1 ? `<i class="bad" title="${esc(netLabel)}">!</i>` : ''}<i class="${muted ? 'off' : 'on'}" title="${esc(muted ? tr('Microphone off', 'Микрофон выключен') : tr('Microphone on', 'Микрофон включён'))}">${icon(muted ? 'mic-off' : 'mic')}</i><i class="${user.bVideoOn ? 'on' : 'off'}" title="${esc(user.bVideoOn ? tr('Camera on', 'Камера включена') : tr('Camera off', 'Камера выключена'))}">${icon(user.bVideoOn ? 'cam' : 'cam-off')}</i></span>${menu}</div>`;
  }).join('') : `<p class="cv6-empty">${esc(tr('Nobody matches this search.', 'По запросу никого нет.'))}</p>`;
}

let activePanel = 'people';

function showPanel(kind, fromDock = false) {
  // On phones/tablets the sidebar is a drawer: the dock button toggles it.
  if (fromDock && isNarrow() && activePanel === kind && !$('sidePanel').classList.contains('closed')) {
    $('sidePanel').classList.add('closed');
    syncDockPanels();
    return;
  }
  activePanel = kind;
  $('sidePanel').classList.remove('closed');
  document.querySelectorAll('[data-panel]').forEach((button) => {
    button.classList.toggle('active', button.dataset.panel === kind);
    button.setAttribute('aria-selected', String(button.dataset.panel === kind));
  });
  $('peoplePanel').hidden = kind !== 'people';
  $('chatPanel').hidden = kind !== 'chat';
  $('materialsPanel').hidden = kind !== 'materials';
  if (kind === 'chat') {
    $('chatBadge').textContent = '0';
    $('dockChatBadge').hidden = true;
    $('messages').scrollTop = $('messages').scrollHeight;
  }
  syncDockPanels();
}

function syncDockPanels() {
  const open = !$('sidePanel').classList.contains('closed');
  [['people', 'peopleBtn'], ['chat', 'chatBtn'], ['materials', 'materialsBtn']].forEach(([kind, id]) => $(id).classList.toggle('panel-on', open && activePanel === kind));
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
  duvi?.show('handRaised', { name: name || tr('Learner', 'Ученик') });
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
  duvi?.show('teacherFloor');
  const ok = micOn || confirm(tr('The teacher gave you the floor. Turn on your microphone?', 'Преподаватель дал вам слово. Включить микрофон?'));
  if (!ok) return;
  try {
    if (!audioStarted) { await media.startAudio(audioStartOptions()); audioStarted = true; }
    else await media.unmuteAudio();
    micOn = true;
    updateControlStates();
    $('micBtn').classList.toggle('off', false);
    setOwnHandRaised(false);
    await sendClassCommand({ type: 'hand', raised: false });
    await renderUsers();
  } catch (error) {
    duvi?.show('micError');
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
  if (!payload || typeof payload !== 'object') return;
  // Identity comes from the SDK (message.senderId), never from the JSON body,
  // which any participant can write. Teacher-only commands need a sender the
  // SDK reports as host/manager.
  const sdkSender = message && typeof message === 'object' ? message.senderId ?? message.sender?.userId : null;
  const senderId = userKey(sdkSender);
  if (!senderId) return;
  const senderUser = client?.getUser?.(Number(senderId));
  const senderIsHost = !!(senderUser?.isHost || senderUser?.isManager);
  const senderName = senderUser?.displayName || message?.senderName || raisedUserNames.get(senderId) || tr('Learner', 'Ученик');
  const ownId = userKey(ownZoomUser()?.userId);
  if (payload.type === 'reaction' && typeof payload.emoji === 'string' && payload.emoji.length <= 8) showReaction(payload.emoji);
  if (payload.type === 'hand') {
    if (setRaisedUser(senderId, !!payload.raised, senderName) && payload.raised && roomRole === 'host' && senderId !== ownId) showHandNotice(senderName);
    void renderUsers();
  }
  if (payload.type === 'hand-clear') {
    // Learners may only lower their own hand; the teacher may lower anyone's.
    const targetId = userKey(payload.targetUserId || senderId);
    if (targetId !== senderId && !senderIsHost) return;
    setRaisedUser(targetId, false);
    if (targetId === ownId) setOwnHandRaised(false);
    void renderUsers();
  }
  if (payload.type === 'host-action' && senderId !== ownId && senderIsHost) {
    if (payload.action === 'mute') void media?.muteAudio();
    if (payload.action === 'stop-video') { camOn = false; updateControlStates(); void Promise.resolve(media?.stopVideo()).catch(() => {}); }
    if (payload.action === 'speak') void acceptSpeakingTurn();
  }
  if (payload.type === 'material-show' && senderIsHost && isTrustedMaterialUrl(payload.url)) showMaterial(String(payload.title || tr('Material', 'Материал')).slice(0, 200), String(payload.fileType || ''), payload.url);
  if (payload.type === 'materials-changed' && senderIsHost) void loadMaterials();
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
    if (userKey(payload.userId) === userKey(ownZoomUser()?.userId)) renderConnection();
  });
  client.on('chat-on-message', (payload) => {
    const mine = payload.sender?.userId === client.getCurrentUserInfo()?.userId;
    const box = $('messages');
    // Keep the reader's place when they scrolled up to older messages.
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const time = new Date(payload.timestamp || Date.now()).toLocaleTimeString(i18n?.appLang || undefined, { hour: '2-digit', minute: '2-digit' });
    box.insertAdjacentHTML('beforeend', `<div class="message${mine ? ' mine' : ''}"><small><b>${esc(mine ? tr('You', 'Вы') : payload.sender?.name || tr('Participant', 'Участник'))}</b><time>${esc(time)}</time></small>${esc(payload.message)}</div>`);
    if (mine || nearBottom) box.scrollTop = box.scrollHeight;
    const chatVisible = !$('chatPanel').hidden && !$('sidePanel').classList.contains('closed');
    if (!chatVisible) {
      const unread = Number($('chatBadge').textContent || 0) + 1;
      $('chatBadge').textContent = String(unread);
      $('dockChatBadge').textContent = String(unread);
      $('dockChatBadge').hidden = false;
      if (!mine) playNoticeSound();
    }
  });
  client.on('recording-change', (payload) => {
    const state = String(payload?.state || '').toLowerCase();
    $('recordingChip').hidden = !(state === 'recording' || state === 'start' || state === 'started');
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
  // Keep the dock honest when the host mutes this user or audio drops.
  client.on('current-audio-change', (payload) => {
    const action = String(payload?.action || '');
    if (action === 'muted') micOn = false;
    if (action === 'unmuted') micOn = true;
    if (action === 'leave') { micOn = false; audioStarted = false; }
    updateControlStates();
  });
  client.on('connection-change', (payload) => {
    const state = String(payload?.state || '').toLowerCase();
    let banner = document.querySelector('.reconnect');
    connectionState = state.includes('reconnect') ? 'reconnecting' : (state.includes('fail') || state.includes('closed')) ? 'lost' : state.includes('connected') ? 'connected' : connectionState;
    renderConnection();
    if (state.includes('reconnect') || state.includes('fail') || state.includes('closed')) {
      if (!banner) {
        banner = document.createElement('div');
        banner.className = 'reconnect';
        document.body.append(banner);
      }
      const reason = String(payload?.reason || '').toLowerCase();
      banner.textContent = reason.includes('subsession') || reason.includes('main session')
        ? tr('Moving between rooms…', 'Переходим между комнатами…')
        : navigator.onLine ? tr('Restoring connection...', 'Восстанавливаем соединение…') : tr('No internet. Waiting for connection...', 'Нет интернета. Ждём подключения…');
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
    roomRole = auth.role === 1 || auth.role === 'host' ? 'host' : 'participant';
    if (auth.role === 1 || auth.role === 'host') {
      await window.DuvelaSessionGuard.assertFree(supa, me.id, 'classroom', sessionId);
      const startResult = await supa.functions.invoke('zoom-video-token', { body: { action: 'start', sessionId } });
      if (startResult.error || !startResult.data?.started) throw new Error(startResult.data?.error || startResult.error?.message || tr('The classroom could not start.','Не удалось запустить класс.'));
    }
    await loadZoomClient();
    await client.init('en-US', 'Global', { patchJsMedia: true, stayAwake: true });
    bindZoomEvents();
    bindClassroomTools();
    await client.join(auth.topic, auth.token, me.name, auth.password || '');
    media = client.getMediaStream();
    joined = true;
    connectionState = 'connected';
    if (roomRole === 'host') {
      await renderWaitingRoom();
      waitingTimer = setInterval(renderWaitingRoom, 3000);
      $('addMaterialBtn').hidden = false;
      $('hostControls').hidden = false;
      $('chatQuick').hidden = false;
    }
    await supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'join' });
    attendanceTimer = setInterval(() => { void supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'heartbeat' }); }, 30000);
    if (micOn) { await media.startAudio(audioStartOptions()); audioStarted = true; }
    if (camOn) {
      await media.startVideo(videoStartOptions());
    }
    $('prejoin').hidden = true;
    $('room').hidden = false;
    if (isNarrow()) $('sidePanel').classList.add('closed');
    syncDockPanels();
    renderConnection();
    startedAt = await lessonStartTime();
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      const hours = Math.floor(seconds / 3600);
      const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
      const ss = String(seconds % 60).padStart(2, '0');
      $('roomTime').textContent = hours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
    };
    tick();
    timer = setInterval(tick, 1000);
    await renderUsers();
    await loadMaterials();
    // A late joiner sees a whiteboard that is already running.
    try {
      const presenter = whiteboardClient()?.getWhiteboardPresenter?.();
      if (presenter && userKey(presenter.userId) !== userKey(ownZoomUser()?.userId)) await viewWhiteboard(presenter.userId);
    } catch {}
    updateWhiteboardUi();
    updateRoomBanner();
  } catch (error) {
    setStatus(error?.message || tr('Could not join the lesson.', 'Не удалось войти в урок.'), true);
    $('joinBtn').disabled = false;
  }
}

async function toggleMic() {
  if (!media) return;
  micOn = !micOn;
  try {
    // Joining with the mic off never started Zoom audio, so the first unmute starts it.
    if (micOn && !audioStarted) { await media.startAudio(audioStartOptions()); audioStarted = true; }
    else if (micOn) await media.unmuteAudio(); else await media.muteAudio();
  } catch (error) {
    micOn = !micOn;
    updateControlStates();
    duvi?.show('micError');
    alert(error?.reason || error?.message || tr('Could not turn on the microphone.', 'Не удалось включить микрофон.'));
    return;
  }
  updateControlStates();
  await renderUsers();
}

async function toggleCam() {
  if (!media) return;
  camOn = !camOn;
  try {
    if (camOn) await media.startVideo(videoStartOptions()); else await media.stopVideo();
  } catch (error) {
    camOn = !camOn;
    updateControlStates();
    alert(error?.reason || error?.message || tr('Could not turn on the camera.', 'Не удалось включить камеру.'));
    return;
  }
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
  const label = button.querySelector('span') || button;
  const previous = label.textContent;
  try {
    await navigator.clipboard?.writeText(location.href);
    lastCopiedAt = Date.now();
    label.textContent = tr('Copied', 'Скопировано');
    button.classList.add('copied');
  } catch {
    prompt(tr('Copy lesson link', 'Скопируйте ссылку урока'), location.href);
  } finally {
    setTimeout(() => {
      if (Date.now() - lastCopiedAt >= 1400) {
        label.textContent = previous;
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

// Materials are short-lived signed URLs from this project's Supabase Storage;
// anything else (other hosts, javascript:/data: URLs) is never rendered.
function isTrustedMaterialUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const storage = new URL(config?.supabaseUrl || 'https://invalid.invalid');
    return url.protocol === 'https:' && url.host === storage.host && url.pathname.startsWith('/storage/v1/object/');
  } catch { return false; }
}

function isImageMaterial(fileType, url = '') {
  return /^image\//.test(fileType || '') || /\.(png|jpe?g|webp)(\?|$)/i.test(url);
}

function isPdfMaterial(fileType, url = '') {
  return fileType === 'application/pdf' || /\.pdf(\?|$)/i.test(url);
}

function openMaterialExternal(url) {
  if (!url) return;
  window.open(url, '_blank', 'noopener');
}

function showMaterial(title, fileType, url) {
  if (!url || !isTrustedMaterialUrl(url)) return;
  activeMaterialUrl = url;
  const safeTitle = title || tr('Material', 'Материал');
  $('materialTitle').textContent = safeTitle;
  const isImage = isImageMaterial(fileType, url);
  const isPdf = isPdfMaterial(fileType, url);
  const preview = isImage
    ? `<img src="${esc(url)}" alt="${esc(safeTitle)}">`
    : `<div class="material-empty"><b>${esc(isPdf ? tr('PDF opens outside the classroom', 'PDF открывается вне класса') : tr('Open this material in a new tab', 'Откройте материал в новой вкладке'))}</b><p>${esc(isPdf ? tr('Browsers block this PDF preview, so use a new tab for reliable viewing.', 'Браузер блокирует просмотр этого PDF внутри урока, поэтому откройте его в новой вкладке.') : tr('This file type cannot be previewed inside the classroom.', 'Этот тип файла нельзя надежно показать внутри класса.'))}</p><a href="${esc(url)}" target="_blank" rel="noopener">${esc(isPdf ? tr('Open PDF', 'Открыть PDF') : tr('Open', 'Открыть'))}</a></div>`;
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
    const fileType = item.file_type || '';
    const isPdf = isPdfMaterial(fileType, url);
    const canOpenExternal = (item.allow_download || roomRole === 'host' || isPdf) && url;
    const previewLabel = isPdf ? tr('Open PDF', 'Открыть PDF') : tr('Watch', 'Смотреть');
    const actions = url ? `<div class="material-actions"><button data-material-action="preview" data-material-id="${esc(item.id)}">${esc(previewLabel)}</button>${canOpenExternal ? `<a href="${esc(url)}" target="_blank" rel="noopener"><button type="button">${esc(tr('Open', 'Открыть'))}</button></a>` : ''}${roomRole === 'host' ? `<button data-material-action="show" data-material-id="${esc(item.id)}">${esc(tr('Show everyone', 'Показать всем'))}</button>` : ''}</div>` : '<small>' + esc(tr('View only', 'Только просмотр')) + '</small>';
    return `<div class="material-row"><span>${isPdf ? '📄' : '🖼'}</span><div><b>${esc(item.title)}</b><small>${esc(fileType || tr('Material', 'Материал'))}</small></div>${actions}</div>`;
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
$('peopleBtn').onclick = () => showPanel('people', true);
$('chatBtn').onclick = () => showPanel('chat', true);
$('materialsBtn').onclick = () => showPanel('materials', true);
$('closeSideBtn').onclick = () => { $('sidePanel').classList.add('closed'); syncDockPanels(); };
function setViewMode(next) {
  viewMode = next;
  if (next === 'gallery') pinnedUserId = null;
  updateViewModeUi();
  void renderUsers();
}
$('viewModeBtn').onclick = (event) => { event.stopPropagation(); setViewMode(viewMode === 'speaker' ? 'gallery' : 'speaker'); };
$('fullscreenBtn').onclick = () => toggleFullscreen(document.documentElement);
$('stageFullBtn').onclick = (event) => { event.stopPropagation(); void toggleFullscreen(document.querySelector('.stage')); };
function closeMoreMenu() { $('moreMenu').hidden = true; $('moreBtn').setAttribute('aria-expanded', 'false'); }
$('moreBtn').onclick = (event) => {
  event.stopPropagation();
  const open = $('moreMenu').hidden;
  $('moreMenu').hidden = !open;
  $('moreBtn').setAttribute('aria-expanded', String(open));
  $('reactionChoices').hidden = true;
};
$('moreMenu').onclick = (event) => {
  const item = event.target.closest('[data-tool]');
  if (!item) return;
  closeMoreMenu();
  if (item.dataset.tool === 'devices') openDevices();
  if (item.dataset.tool === 'whiteboard') void toggleWhiteboard();
  if (item.dataset.tool === 'rooms') openRoomsDialog();
  if (item.dataset.tool === 'view') setViewMode(viewMode === 'speaker' ? 'gallery' : 'speaker');
  if (item.dataset.tool === 'fullscreen') void toggleFullscreen(document.documentElement);
  if (item.dataset.tool === 'invite') void inviteLink($('moreBtn'));
};
$('roomCameraSelect').onchange = () => switchDevice('camera', $('roomCameraSelect').value);
$('roomMicSelect').onchange = () => switchDevice('mic', $('roomMicSelect').value);
$('roomSpeakerSelect').onchange = () => switchDevice('speaker', $('roomSpeakerSelect').value);
$('devicesCloseBtn').onclick = () => { $('devicesDialog').hidden = true; };
$('stopWhiteboardBtn').onclick = () => { if (isOwnWhiteboard()) void toggleWhiteboard(); };
$('roomsCloseBtn').onclick = () => { $('roomsDialog').hidden = true; };
$('roomsDialog').onclick = (event) => { if (event.target === $('roomsDialog')) $('roomsDialog').hidden = true; };
$('leaveSubsessionBtn').onclick = async () => { try { await subsessionClient()?.leaveSubsession(); } catch (error) { alert(error?.reason || error?.message || ''); } };
$('askHelpBtn').onclick = async () => {
  try { await subsessionClient()?.askForHelp(); toast(tr('The teacher has been asked to join your room.', 'Учителю отправлена просьба зайти в комнату.')); } catch (error) { alert(error?.reason || error?.message || ''); }
};
$('devicesDialog').onclick = (event) => { if (event.target === $('devicesDialog')) $('devicesDialog').hidden = true; };
$('peopleSearch').oninput = () => renderPeopleList();
document.addEventListener('click', (event) => {
  if (!event.target.closest('.cv6-more')) closeMoreMenu();
  if (!event.target.closest('.reaction-menu')) $('reactionChoices').hidden = true;
  if (openPersonMenu && !event.target.closest('.person-menu')) { openPersonMenu = ''; renderPeopleList(); }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeMoreMenu();
  $('reactionChoices').hidden = true;
  if (openPersonMenu) { openPersonMenu = ''; renderPeopleList(); }
});
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
  const toggle = event.target.closest('[data-person-menu]');
  if (toggle) {
    event.stopPropagation();
    openPersonMenu = openPersonMenu === toggle.dataset.personMenu ? '' : toggle.dataset.personMenu;
    renderPeopleList();
    return;
  }
  const button = event.target.closest('[data-moderate]');
  if (button && openPersonMenu) { openPersonMenu = ''; renderPeopleList(); }
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
  if (button.dataset.hostControl === 'invite') { await inviteLink(button); return; }
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
  if (button.dataset.materialAction === 'preview' && isPdfMaterial(record.item.file_type, record.url)) {
    openMaterialExternal(record.url);
  }
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
addEventListener('fullscreenchange', () => { updateShareUi(); document.body.classList.toggle('cv6-fullscreen', !!document.fullscreenElement); });
addEventListener('resize', () => { if (!isNarrow()) $('sidePanel').classList.remove('closed'); syncDockPanels(); });
localizeV6();
addEventListener('beforeunload', () => {
  if (joined && !endingForAll) void supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'leave' });
});

loadIdentity().then(async () => { await runDiagnostics(); await preview(); await populateDevices(); }).catch((error) => setStatus(error.message, true));
