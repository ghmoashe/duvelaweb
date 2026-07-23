import ZoomVideo from '@zoom/videosdk';
import './style.css';

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
const supa = config?.createSupabaseClient?.();
const client = ZoomVideo.createClient();
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

function initials(name = 'Duvela') {
  return name.trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
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
    $('previewEmpty').hidden = false;
    return;
  }
  try {
    previewStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    $('previewVideo').srcObject = previewStream;
    $('previewEmpty').hidden = true;
  } catch {
    camOn = false;
    $('previewCam').classList.remove('active');
    $('previewEmpty').hidden = false;
  }
}

async function loadIdentity() {
  if (!supa || !sessionId) throw new Error('Ссылка на групповой урок неполная.');
  const auth = await supa.auth.getUser();
  if (!auth.data?.user) {
    location.href = './index.html?next=' + encodeURIComponent(location.href);
    throw new Error('Войдите в Duvela.');
  }
  me = auth.data.user;
  const [profileResult, sessionResult] = await Promise.all([
    supa.from('profiles').select('full_name,avatar_url').eq('id', me.id).maybeSingle(),
    supa.from('class_sessions').select('id,class_id,title,starts_at,status,provider').eq('id', sessionId).maybeSingle()
  ]);
  if (sessionResult.error || !sessionResult.data) throw new Error('Урок не найден или у вас нет доступа.');
  classSession = sessionResult.data;
  me.name = profileResult.data?.full_name || me.email?.split('@')[0] || 'Duvela learner';
  $('joinTitle').textContent = classSession.title || 'Групповой урок';
  $('roomTitle').textContent = classSession.title || 'Групповой урок';
}

async function token() {
  const result = await supa.functions.invoke('zoom-video-token', { body: { sessionId } });
  if (result.data?.waiting) return result.data;
  if (result.error || !result.data?.token) throw new Error(result.data?.error || result.error?.message || 'Не удалось открыть Zoom Classroom.');
  return result.data;
}

function diagnostic(id, ok, text) {
  const node = $(id);
  node.className = ok ? 'ok' : 'bad';
  node.textContent = `${ok ? '✓' : '!'} ${text}`;
}

async function runDiagnostics() {
  diagnostic('diagBrowser', !!(window.WebAssembly && window.RTCPeerConnection), 'Браузер');
  diagnostic('diagNetwork', navigator.onLine, navigator.connection?.effectiveType ? `Интернет · ${navigator.connection.effectiveType}` : 'Интернет');
  diagnostic('diagCamera', !!navigator.mediaDevices?.getUserMedia, 'Камера');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    diagnostic('diagMic', true, 'Микрофон');
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    diagnostic('diagMic', false, 'Микрофон');
  }
}

async function renderWaitingRoom() {
  if (roomRole !== 'host') return;
  const { data } = await supa.from('class_waiting_room').select('id,user_id,status').eq('session_id', sessionId).eq('status', 'waiting');
  const rows = data || [];
  $('waitingWrap').hidden = !rows.length;
  $('waitingList').innerHTML = rows.map((row) => `<div class="waiting-person"><b>${esc(row.user_id.slice(0, 8))}</b><button class="admit" data-wait="${row.id}" data-decision="admitted">Впустить</button><button data-wait="${row.id}" data-decision="denied">Отклонить</button></div>`).join('');
}

function tile(user) {
  let node = document.querySelector(`[data-user="${user.userId}"]`);
  if (!node) {
    node = document.createElement('article');
    node.className = 'tile';
    node.dataset.user = user.userId;
    node.innerHTML = `<canvas></canvas><div class="avatar">${initials(user.displayName)}</div><div class="tile-label"></div>`;
    $('gallery').append(node);
  }
  node.querySelector('.tile-label').textContent = `${user.audio === 'muted' ? '🔇' : '🎙'} ${user.displayName}${user.userId === client.getCurrentUserInfo()?.userId ? ' (Вы)' : ''}`;
  node.querySelector('.avatar').hidden = !!user.bVideoOn;
  node.querySelector('canvas').hidden = !user.bVideoOn;
  return node;
}

async function renderUsers() {
  if (!joined) return;
  const users = client.getAllUser();
  const ids = new Set(users.map((user) => String(user.userId)));
  document.querySelectorAll('[data-user]').forEach((node) => {
    if (!ids.has(node.dataset.user)) node.remove();
  });
  for (const user of users) {
    const node = tile(user);
    if (user.bVideoOn) {
      const canvas = node.querySelector('canvas');
      try {
        await media.renderVideo(canvas, user.userId, Math.max(320, node.clientWidth), Math.max(180, node.clientHeight), 0, 0, 2);
      } catch {}
    }
  }
  $('peopleCount').textContent = users.length;
  $('peopleList').innerHTML = users.map((user) => `<div class="person"><span class="mini">${esc(initials(user.displayName))}</span><b>${esc(user.displayName)}</b><span>${user.bVideoOn ? '🎥' : '🚫'} ${user.audio === 'muted' ? '🔇' : '🎙'}</span></div>`).join('');
}

function showPanel(kind) {
  $('sidePanel').classList.remove('closed');
  document.querySelectorAll('[data-panel]').forEach((button) => button.classList.toggle('active', button.dataset.panel === kind));
  $('peoplePanel').hidden = kind !== 'people';
  $('chatPanel').hidden = kind !== 'chat';
  if (kind === 'chat') $('chatBadge').textContent = '0';
}

function bindZoomEvents() {
  ['user-added', 'user-removed', 'user-updated', 'peer-video-state-change'].forEach((event) => client.on(event, renderUsers));
  client.on('active-speaker', (list) => {
    document.querySelectorAll('.tile').forEach((node) => node.classList.remove('speaking'));
    (list || []).forEach((speaker) => document.querySelector(`[data-user="${speaker.userId}"]`)?.classList.add('speaking'));
  });
  client.on('chat-on-message', (payload) => {
    const mine = payload.sender?.userId === client.getCurrentUserInfo()?.userId;
    $('messages').insertAdjacentHTML('beforeend', `<div class="message"><small>${esc(mine ? 'Вы' : payload.sender?.name || 'Участник')}</small>${esc(payload.message)}</div>`);
    $('messages').scrollTop = $('messages').scrollHeight;
    if ($('chatPanel').hidden) $('chatBadge').textContent = String(Number($('chatBadge').textContent || 0) + 1);
  });
  client.on('active-share-change', async (payload) => {
    if (payload.state === 'Active') {
      $('shareStage').hidden = false;
      try { await media.startShareView($('shareCanvas'), payload.userId); } catch {}
    } else {
      $('shareStage').hidden = true;
    }
  });
}

async function join() {
  $('joinBtn').disabled = true;
  setStatus('Подключаемся к уроку…');
  try {
    previewStream?.getTracks().forEach((track) => track.stop());
    const auth = await token();
    if (auth.waiting) {
      setStatus('Запрос отправлен. Ждём, когда преподаватель впустит вас…');
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
          setStatus(error?.message || 'Вход отклонён.', true);
        }
      }, 3000);
      return;
    }
    roomRole = auth.role || 'participant';
    await client.init('en-US', 'Global', { patchJsMedia: true, stayAwake: true });
    bindZoomEvents();
    await client.join(auth.topic, auth.token, me.name, auth.password || '');
    media = client.getMediaStream();
    joined = true;
    if (roomRole === 'host') {
      void supa.from('class_sessions').update({ status: 'live' }).eq('id', sessionId).eq('created_by', me.id);
      await renderWaitingRoom();
      waitingTimer = setInterval(renderWaitingRoom, 3000);
    }
    await supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'join' });
    attendanceTimer = setInterval(() => { void supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'heartbeat' }); }, 30000);
    if (micOn) await media.startAudio();
    if (camOn) {
      await media.startVideo();
    }
    $('prejoin').hidden = true;
    $('room').hidden = false;
    startedAt = Date.now();
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      $('roomTime').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
    await renderUsers();
  } catch (error) {
    setStatus(error?.message || 'Не удалось войти в урок.', true);
    $('joinBtn').disabled = false;
  }
}

async function toggleMic() {
  if (!media) return;
  micOn = !micOn;
  if (micOn) await media.unmuteAudio(); else await media.muteAudio();
  $('micBtn').classList.toggle('off', !micOn);
  await renderUsers();
}

async function toggleCam() {
  if (!media) return;
  camOn = !camOn;
  if (camOn) await media.startVideo(); else await media.stopVideo();
  $('camBtn').classList.toggle('off', !camOn);
  await renderUsers();
}

async function toggleShare() {
  if (!media) return;
  try {
    if (sharing) await media.stopShareScreen();
    else await media.startShareScreen($('shareCanvas'));
    sharing = !sharing;
    $('shareBtn').classList.toggle('off', !sharing);
  } catch (error) {
    alert(error?.message || 'Браузер не разрешил демонстрацию экрана.');
  }
}

async function leave() {
  clearInterval(timer);
  clearInterval(attendanceTimer);
  clearInterval(waitingTimer);
  try { await supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'leave' }); } catch {}
  try { if (joined) await client.leave(); } catch {}
  if (roomRole === 'host') {
    try { await supa.from('class_sessions').update({ status: 'ended' }).eq('id', sessionId).eq('created_by', me.id); } catch {}
  }
  location.href = roomRole === 'host'
    ? './app.html?role=teacher#management'
    : './app.html?role=learner#schedule';
}

$('previewMic').onclick = () => { micOn = !micOn; $('previewMic').classList.toggle('active', micOn); };
$('previewCam').onclick = () => { camOn = !camOn; $('previewCam').classList.toggle('active', camOn); preview(); };
$('joinBtn').onclick = join;
$('micBtn').onclick = toggleMic;
$('camBtn').onclick = toggleCam;
$('shareBtn').onclick = toggleShare;
$('peopleBtn').onclick = () => showPanel('people');
$('chatBtn').onclick = () => showPanel('chat');
$('handBtn').onclick = () => { raised = !raised; $('handBtn').classList.toggle('off', raised); $('handBtn').querySelector('span').textContent = raised ? 'Опустить руку' : 'Поднять руку'; };
$('leaveBtn').onclick = $('leaveTop').onclick = leave;
document.querySelectorAll('[data-panel]').forEach((button) => button.onclick = () => showPanel(button.dataset.panel));
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
addEventListener('beforeunload', () => {
  if (joined) void supa.rpc('record_class_attendance', { target_session: sessionId, event_name: 'leave' });
});

loadIdentity().then(async () => { await runDiagnostics(); await preview(); }).catch((error) => setStatus(error.message, true));
