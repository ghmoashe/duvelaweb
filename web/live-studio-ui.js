(function () {
  const api = window.DuvelaLiveStudioApi;
  if (!api) return;
  const liveI18n = window.DuvelaLiveI18n || window.DuvelaAppI18n?.create({ localeCatalog: window.DUVELA_WEB_I18N, storageKeys: window.DuvelaWebConfig?.storageKeys });
  const ru = Boolean(liveI18n?.isRu) || (localStorage.getItem('duvela.web.lang') || localStorage.getItem('duvela.webLang') || navigator.language || '').toLowerCase().startsWith('ru');
  const t = liveI18n?.tr || ((en, rus) => ru ? rus : en);
  const productionState={lowerTitle:'',lowerSubtitle:'',logo:'',hold:'',caption:''};
  function renderProductionOverlay(){const stage=document.querySelector('.stage');if(!stage)return;let layer=document.getElementById('productionOverlay');if(!layer){layer=document.createElement('div');layer.id='productionOverlay';layer.className='production-overlay';stage.appendChild(layer);}layer.innerHTML='';if(productionState.hold){const hold=document.createElement('div');hold.className='production-hold';hold.innerHTML='<div><h2></h2><p></p></div>';hold.querySelector('h2').textContent=productionState.hold==='waiting'?t('LIVE starts soon','Эфир скоро начнётся'):t('We will be right back','Скоро вернёмся');hold.querySelector('p').textContent=t('Please stay on this page.','Оставайтесь на этой странице.');layer.appendChild(hold);}if(productionState.logo){const logo=document.createElement('img');logo.className='production-logo';logo.src=productionState.logo;layer.appendChild(logo);}if(productionState.lowerTitle&&!productionState.hold){const lower=document.createElement('div');lower.className='production-lower-third';const title=document.createElement('b'),subtitle=document.createElement('span');title.textContent=productionState.lowerTitle;subtitle.textContent=productionState.lowerSubtitle;lower.append(title,subtitle);layer.appendChild(lower);}if(productionState.caption&&!productionState.hold){const caption=document.createElement('div');caption.className='production-caption';caption.textContent=productionState.caption;layer.appendChild(caption);}}
  function applyProductionEvent(data){if(data.kind==='lower-third'){productionState.lowerTitle=data.title||'';productionState.lowerSubtitle=data.subtitle||'';}if(data.kind==='logo')productionState.logo=data.url||'';if(data.kind==='hold')productionState.hold=data.mode||'';if(data.kind==='caption')productionState.caption=data.text||'';renderProductionOverlay();}
  const reactionDock=document.createElement('div');reactionDock.className='reaction-dock';reactionDock.innerHTML=['👏','❤️','🔥','😂','💡'].map(emoji=>'<button type="button">'+emoji+'</button>').join('');document.querySelector('.stage')?.appendChild(reactionDock);reactionDock.addEventListener('click',async(event)=>{const button=event.target.closest('button');if(!button)return;try{await api.sendReaction(button.textContent);}catch(error){console.warn(error);}});
  window.addEventListener('duvela:studio-event', (event) => {
    const data=event.detail||{};
    applyProductionEvent(data);
    if(data.kind==='guest-command'&&String(data.uid)===api.getAgoraUid()){if(data.action==='remove')api.leaveGuestStage();if(data.action==='mute')api.muteGuestSelf();}
    if(data.kind==='poll'&&!api.isHost){
      document.querySelector('.studio-poll')?.remove();
      const poll=document.createElement('aside');poll.className='studio-poll';
      const title=document.createElement('h3');title.textContent=data.question||t('Quick poll','Быстрый опрос');poll.appendChild(title);
      (data.options||[]).forEach((option,index)=>{const label=typeof option==='string'?option:option.label;const optionId=typeof option==='string'?'':option.id;const button=document.createElement('button');button.className='btn';button.textContent=label;button.onclick=async()=>{button.parentElement.querySelectorAll('button').forEach(node=>node.disabled=true);button.classList.add('primary');try{if(optionId)await api.votePoll(data.id,optionId);await api.broadcastEvent({kind:'poll-vote',pollId:data.id,option:index});}catch(error){button.classList.remove('primary');button.textContent=t('Already voted or vote failed','Вы уже голосовали или произошла ошибка');}setTimeout(()=>poll.remove(),1500);};poll.appendChild(button);});
      document.body.appendChild(poll);
    }
    if(data.kind==='poll-close') document.querySelector('.studio-poll')?.remove();
  });
  if (!api.isHost) return;

  // ── Studio V5 ────────────────────────────────────────────────────────────
  // This layer only re-homes and restyles controls. Every V5 button is either
  // the original element from live.html or forwards a click to it, so Agora
  // join/publish/track logic stays in live-page.js.
  document.body.classList.add('duvela-studio-v5');
  const side = document.querySelector('.side-card');
  const stage = document.querySelector('.stage');
  const stageCard = document.querySelector('.stage-card');
  const topbar = document.querySelector('.topbar');
  const brand = topbar?.querySelector('.brand');
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    micOff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16"/>',
    camera: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3"/>',
    cameraOff: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3M3 3l18 18"/>',
    screen: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M9 10.5l3-3 3 3M12 7.5v6"/>',
    board: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 15.5l3-3.5 2.2 2.2L16.5 9"/>',
    layout: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    notes: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
    plan: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    chat: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.3-4A8 8 0 1 1 20 11.5z"/>',
    record: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.8" fill="currentColor"/>',
    more: '<circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/>',
    live: '<circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8M5.7 5.7a8.9 8.9 0 0 0 0 12.6M18.3 5.7a8.9 8.9 0 0 1 0 12.6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.4M12 17h.01"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    chevron: '<path d="M7 10l5 5 5-5"/>',
    devices: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="12" cy="10" r="2.6"/><path d="M8.3 17.2a3.8 3.8 0 0 1 7.4 0"/>',
    flip: '<path d="M4.5 9.5A8 8 0 0 1 18.3 6.6L20 8.5M19.5 14.5a8 8 0 0 1-13.8 2.9L4 15.5"/><path d="M20 4.5v4h-4M4 19.5v-4h4"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14a4.6 4.6 0 0 1 5 4.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    invite: '<circle cx="10" cy="8" r="3.2"/><path d="M4 19.5a6 6 0 0 1 12 0M19 8v6M16 11h6"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M8 14h2M12 14h2M16 14h.01M8 17h2"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    monitor: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    signal: '<path d="M5 19v-3M10 19v-6M15 19V9M20 19V5"/>',
    pulse: '<path d="M3 12h4l2.2-5.5 4.6 11 2.2-5.5h5"/>',
    duel: '<path d="M14.5 4.5h5v5L9 20l-2.5.5L4 18l.5-2.5zM9.5 4.5h-5v5l3 3M17 17l3 3M15.5 12.5l4 4"/>',
    material: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    task: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12l2.4 2.4L15.5 9.8"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    design: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5C21 6.4 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15" cy="8" r="1.2" fill="currentColor"/>'
  };
  const icon = (name) => '<svg class="v5-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  const cardHead = (iconName, title, copy, extra) => '<div class="v5-card-head"><span class="v5-card-icon">' + icon(iconName) + '</span><div><h3>' + title + '</h3>' + (copy ? '<p>' + copy + '</p>' : '') + '</div>' + (extra || '') + '</div>';
  const NOT_AVAILABLE = t('Not available', 'Нет данных');
  const sceneNames = { camera: t('Camera', 'Камера'), presentation: t('Presentation', 'Презентация'), board: t('Board', 'Доска'), focus: t('Focus', 'Фокус') };

  // Polite toast for hints like "available once LIVE starts" instead of blocking alerts.
  const toast = document.createElement('div');
  toast.className = 'v5-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  function hint(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200); }

  // ── Top bar: brand, real device / broadcast chips, help, notifications, account
  if (brand && !brand.querySelector('.brand-copy')) {
    const name = brand.querySelector('span');
    if (name) {
      const copy = document.createElement('span');
      copy.className = 'brand-copy';
      copy.innerHTML = '<span class="v5-brand-name"><span>DUVELA LIVE</span><em id="v5BrandLive" hidden>LIVE</em></span><small></small>';
      copy.querySelector('small').textContent = t('Teacher Studio', 'Студия преподавателя');
      name.replaceWith(copy);
    }
  }
  brand?.setAttribute('aria-label', t('DUVELA LIVE Teacher Studio — back to dashboard', 'DUVELA LIVE, студия преподавателя — назад в панель'));
  const topStatus = document.createElement('div');
  topStatus.id = 'studioV5TopStatus';
  topStatus.className = 'studio-v5-top-status';
  topStatus.innerHTML =
    '<div class="v5-chip is-off" data-v5-status="camera"><i>' + icon('camera') + '</i><span><b>' + t('Camera', 'Камера') + '</b><small>' + t('Checking…', 'Проверка…') + '</small></span></div>' +
    '<div class="v5-chip is-off" data-v5-status="microphone"><i>' + icon('mic') + '</i><span><b>' + t('Microphone', 'Микрофон') + '</b><small>' + t('Checking…', 'Проверка…') + '</small></span><span class="v5-meter" aria-hidden="true">' + '<i></i>'.repeat(12) + '</span></div>' +
    '<div class="v5-chip v5-chip-broadcast" data-v5-status="broadcast" role="status"><i class="v5-dot" aria-hidden="true"></i><span><b>' + t('Not broadcasting', 'Не в эфире') + '</b><small>' + t('Preview only', 'Только предпросмотр') + '</small></span></div>';
  topbar?.insertBefore(topStatus, topbar.querySelector('.mode-pill'));
  const topActions = document.createElement('div');
  topActions.className = 'v5-top-actions';
  topActions.innerHTML =
    '<button type="button" class="v5-icon-btn" id="v5Help" aria-label="' + t('Help and keyboard shortcuts', 'Помощь и горячие клавиши') + '" title="' + t('Help and keyboard shortcuts', 'Помощь и горячие клавиши') + '">' + icon('help') + '</button>' +
    '<div class="v5-pop-wrap"><button type="button" class="v5-icon-btn" id="v5Bell" aria-haspopup="dialog" aria-expanded="false" aria-controls="v5NotifPanel" aria-label="' + t('Notifications', 'Уведомления') + '" title="' + t('Notifications', 'Уведомления') + '">' + icon('bell') + '<span class="v5-badge" id="v5BellBadge" hidden></span></button>' +
    '<div class="v5-popover" id="v5NotifPanel" role="dialog" aria-label="' + t('Notifications', 'Уведомления') + '" hidden><div class="v5-pop-head"><b>' + t('Notifications', 'Уведомления') + '</b><a href="./app.html?role=teacher#home">' + t('Open dashboard', 'Открыть панель') + '</a></div><div class="v5-notif-list" id="v5NotifList"></div></div></div>' +
    '<div class="v5-pop-wrap"><button type="button" class="v5-account" id="v5Account" aria-haspopup="menu" aria-expanded="false" aria-controls="v5AccountMenu"><span class="v5-avatar" id="v5Avatar">D</span><span class="v5-account-copy"><b id="v5AccountName">' + t('Teacher', 'Преподаватель') + '</b><small>' + t('Teacher', 'Преподаватель') + '</small></span>' + icon('chevron') + '</button>' +
    '<div class="v5-popover v5-menu" id="v5AccountMenu" role="menu" hidden><a role="menuitem" href="./app.html?role=teacher#live">' + icon('layout') + t('Teacher dashboard', 'Панель преподавателя') + '</a><button type="button" role="menuitem" id="v5MenuOpenApp">' + icon('devices') + t('Open in the Duvela app', 'Открыть в приложении Duvela') + '</button><button type="button" role="menuitem" id="v5MenuCopyLink">' + icon('invite') + t('Copy student link', 'Скопировать ссылку для учеников') + '</button></div></div>';
  topbar?.appendChild(topActions);

  function closePopovers(except) {
    topActions.querySelectorAll('.v5-popover').forEach((pop) => { if (pop !== except) pop.hidden = true; });
    topActions.querySelectorAll('[aria-expanded]').forEach((button) => { if (button.getAttribute('aria-controls') !== except?.id) button.setAttribute('aria-expanded', 'false'); });
    if (except !== moreMenu) { moreMenu.hidden = true; moreButton.setAttribute('aria-expanded', 'false'); }
  }
  function togglePopover(button, pop) {
    const open = pop.hidden;
    closePopovers(open ? pop : null);
    pop.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) pop.querySelector('a,button')?.focus({ preventScroll: true });
    return open;
  }
  document.addEventListener('click', (event) => { if (!event.target.closest('.v5-pop-wrap,.v5-more-wrap')) closePopovers(null); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closePopovers(null); });

  let unreadCount = 0;
  async function loadNotifications(render) {
    const list = byId('v5NotifList');
    if (render) list.innerHTML = '<p class="v5-muted">' + t('Loading…', 'Загрузка…') + '</p>';
    try {
      const rows = await api.listNotifications();
      unreadCount = rows.filter((row) => !row.read).length;
      byId('v5BellBadge').hidden = !unreadCount;
      byId('v5BellBadge').textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      if (render) list.innerHTML = rows.length ? rows.map((row) => '<div class="v5-notif' + (row.read ? '' : ' unread') + '"><b>' + esc(row.title || 'Duvela') + '</b>' + (row.body ? '<span>' + esc(row.body) + '</span>' : '') + '<small>' + esc(row.created_at ? new Date(row.created_at).toLocaleString(liveI18n?.intlLocale || (ru ? 'ru-RU' : 'en-GB'), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '</small></div>').join('') : '<p class="v5-muted">' + t('No notifications.', 'Уведомлений нет.') + '</p>';
    } catch (error) {
      if (render) list.innerHTML = '<p class="v5-muted">' + t('Could not load notifications.', 'Не удалось загрузить уведомления.') + '</p>';
    }
  }
  byId('v5Bell').addEventListener('click', () => { if (togglePopover(byId('v5Bell'), byId('v5NotifPanel'))) void loadNotifications(true); });
  byId('v5Account').addEventListener('click', () => togglePopover(byId('v5Account'), byId('v5AccountMenu')));
  byId('v5MenuOpenApp').addEventListener('click', () => { closePopovers(null); byId('openApp')?.click(); });
  byId('v5MenuCopyLink').addEventListener('click', () => { closePopovers(null); copyStudentLink(); });
  setTimeout(() => loadNotifications(false), 3000);
  setInterval(() => loadNotifications(false), 60000);
  let accountRendered = false;
  function renderAccount() {
    const user = api.getUser?.();
    if (!user || accountRendered) return;
    accountRendered = true;
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || (user.email || '').split('@')[0] || t('Teacher', 'Преподаватель');
    byId('v5AccountName').textContent = name;
    const avatar = byId('v5Avatar');
    if (meta.avatar_url) { avatar.textContent = ''; const img = document.createElement('img'); img.alt = ''; img.src = meta.avatar_url; avatar.appendChild(img); }
    else avatar.textContent = name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'D';
  }

  // Help dialog with the shortcuts the studio already supports.
  const helpModal = document.createElement('div');
  helpModal.className = 'prelive-modal v5-help-modal';
  helpModal.setAttribute('role', 'dialog');
  helpModal.setAttribute('aria-modal', 'true');
  helpModal.setAttribute('aria-labelledby', 'v5HelpTitle');
  helpModal.innerHTML = '<div class="prelive-card"><span class="prelive-kicker">' + t('HELP', 'ПОМОЩЬ') + '</span><h2 id="v5HelpTitle">' + t('Studio shortcuts', 'Горячие клавиши студии') + '</h2><p>' + t('Shortcuts work when the cursor is not in a text field. Scene keys send the layout to viewers immediately.', 'Клавиши работают, когда курсор не в текстовом поле. Клавиши сцен сразу отправляют раскладку зрителям.') + '</p><dl class="v5-shortcuts">' +
    [['1 – 4', t('Camera / Presentation / Board / Focus (live)', 'Камера / Презентация / Доска / Фокус (в эфир)')], ['M', t('Microphone on/off', 'Микрофон вкл/выкл')], ['V', t('Camera on/off', 'Камера вкл/выкл')], ['S', t('Share screen', 'Показ экрана')], ['P', t('Pause screen', 'Экран паузы')]].map(([key, label]) => '<div><dt><kbd>' + key + '</kbd></dt><dd>' + label + '</dd></div>').join('') +
    '</dl><button type="button" class="btn primary" data-close>' + t('Close', 'Закрыть') + '</button></div>';
  document.body.appendChild(helpModal);
  let helpReturnFocus = null;
  function openHelp() { helpReturnFocus = document.activeElement; helpModal.classList.add('open'); helpModal.querySelector('[data-close]').focus(); }
  function closeHelp() { helpModal.classList.remove('open'); helpReturnFocus?.focus?.(); }
  helpModal.querySelector('[data-close]').addEventListener('click', closeHelp);
  helpModal.addEventListener('click', (event) => { if (event.target === helpModal) closeHelp(); });
  helpModal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeHelp(); });
  byId('v5Help').addEventListener('click', openHelp);

  // ── Stage overlay: host label + device / flip / fullscreen
  const stageBadge = document.createElement('div');
  stageBadge.className = 'v5-stage-badge';
  stageBadge.innerHTML = '<i class="v5-dot" aria-hidden="true"></i><span>' + t('You (Host)', 'Вы (ведущий)') + '</span><span aria-hidden="true">👑</span>';
  const recBadge = document.createElement('div');
  recBadge.className = 'v5-rec-badge';
  recBadge.hidden = true;
  recBadge.innerHTML = '<i aria-hidden="true"></i>REC';
  const stageTools = document.createElement('div');
  stageTools.className = 'v5-stage-tools';
  stageTools.innerHTML =
    '<button type="button" class="v5-stage-btn" id="v5Devices" aria-label="' + t('Camera and microphone settings', 'Настройки камеры и микрофона') + '" title="' + t('Camera and microphone settings', 'Настройки камеры и микрофона') + '">' + icon('devices') + '</button>' +
    '<button type="button" class="v5-stage-btn" id="v5Flip" aria-label="' + t('Switch camera', 'Сменить камеру') + '" title="' + t('Switch camera', 'Сменить камеру') + '">' + icon('flip') + '</button>' +
    '<button type="button" class="v5-stage-btn" id="v5Fullscreen" aria-label="' + t('Full screen', 'Полный экран') + '" title="' + t('Full screen', 'Полный экран') + '">' + icon('fullscreen') + '</button>';
  stage?.append(stageBadge, recBadge, stageTools);
  byId('v5Flip').addEventListener('click', () => { const flip = byId('flipCamera'); if (flip && flip.style.display !== 'none' && !flip.disabled) flip.click(); else hint(t('The camera preview is still starting.', 'Предпросмотр камеры ещё запускается.')); });
  byId('v5Fullscreen').addEventListener('click', () => byId('toggleFullscreen')?.click());

  // ── Control dock
  const dockButton = (id, iconName, label, extra) => '<button type="button" class="v5-tool" id="' + id + '"' + (extra || '') + '><span class="v5-tool-icon">' + icon(iconName) + '</span><span class="v5-tool-label">' + label + '</span></button>';
  const setToolLabel = (button, label) => { const node = button?.querySelector('.v5-tool-label'); if (node) node.textContent = label; };
  const setToolIcon = (button, iconName) => { const node = button?.querySelector('.v5-tool-icon'); if (node && node.dataset.icon !== iconName) { node.dataset.icon = iconName; node.innerHTML = icon(iconName); } };
  const v5Dock = document.createElement('div');
  v5Dock.className = 'v5-dock';
  v5Dock.innerHTML =
    '<div class="v5-dock-tools" role="toolbar" aria-label="' + t('Broadcast controls', 'Управление эфиром') + '">' +
      '<div class="v5-tool-split">' + dockButton('v5Mic', 'mic', t('Mic', 'Микрофон')) + '<button type="button" class="v5-tool-caret" id="v5MicMenu" aria-label="' + t('Choose camera and microphone', 'Выбрать камеру и микрофон') + '" title="' + t('Choose camera and microphone', 'Выбрать камеру и микрофон') + '">' + icon('chevron') + '</button></div>' +
      dockButton('v5Camera', 'camera', t('Camera', 'Камера')) +
      dockButton('studioShareScreen', 'screen', t('Share screen', 'Экран')) +
      dockButton('v5Board', 'board', t('Board', 'Доска')) +
      '<span class="v5-dock-divider" aria-hidden="true"></span>' +
      dockButton('v5Layout', 'layout', t('Layout', 'Сцена')) +
      dockButton('studioNotesBtn', 'notes', t('Notes', 'Заметки')) +
      dockButton('studioPlanBtn', 'plan', t('Lesson plan', 'План урока')) +
      dockButton('studioChatBtn', 'chat', t('Chat', 'Чат')) +
      dockButton('studioRecord', 'record', t('Record', 'Запись'), ' title="' + t('Local recording: saves a .webm file of your camera and microphone in this browser', 'Локальная запись: сохраняет файл .webm с камерой и микрофоном в этом браузере') + '"') +
      '<div class="v5-more-wrap">' + dockButton('v5More', 'more', t('More', 'Ещё'), ' aria-haspopup="menu" aria-expanded="false" aria-controls="v5MoreMenu"') +
        '<div class="v5-popover v5-menu v5-more-menu" id="v5MoreMenu" role="menu" hidden>' +
          '<button type="button" role="menuitem" id="studioDuelBtn">' + icon('duel') + t('Duel', 'Дуэль') + '</button>' +
          '<button type="button" role="menuitem" id="v5Shortcuts">' + icon('keyboard') + t('Keyboard shortcuts', 'Горячие клавиши') + '</button>' +
        '</div></div>' +
    '</div>' +
    '<div class="v5-dock-cta"></div>';
  const oldFooter = document.querySelector('.stage-footer');
  stage?.after(v5Dock);
  const moreMenu = byId('v5MoreMenu');
  const moreButton = byId('v5More');
  // Material and task buttons only appear while LIVE (live-page.js toggles their display).
  ['pinMaterial', 'pushTaskBtn'].forEach((id) => { const node = byId(id); if (node) { node.setAttribute('role', 'menuitem'); node.classList.add('v5-menu-native'); moreMenu.insertBefore(node, byId('v5Shortcuts')); } });
  const cta = v5Dock.querySelector('.v5-dock-cta');
  ['hostAction', 'endLive'].forEach((id) => { const node = byId(id); if (node) cta.appendChild(node); });
  moreButton.addEventListener('click', () => { const open = moreMenu.hidden; closePopovers(open ? moreMenu : null); moreMenu.hidden = !open; moreButton.setAttribute('aria-expanded', String(open)); if (open) moreMenu.querySelector('button:not([style*="none"])')?.focus(); });
  moreMenu.addEventListener('click', (event) => { if (event.target.closest('button')) { moreMenu.hidden = true; moreButton.setAttribute('aria-expanded', 'false'); } });
  byId('v5Shortcuts').addEventListener('click', openHelp);
  const forward = (id, unavailable) => { const node = byId(id); if (node && node.style.display !== 'none' && !node.disabled) { node.click(); return true; } hint(unavailable); return false; };
  byId('v5Mic').addEventListener('click', () => forward('toggleMic', t('The microphone connects when LIVE starts. Use the arrow to choose a device.', 'Микрофон подключается при старте эфира. Стрелка рядом — выбор устройства.')));
  byId('v5Camera').addEventListener('click', () => forward('toggleCam', t('Camera on/off works during LIVE. Before that, the preview is visible only to you.', 'Камеру можно выключать во время эфира. До старта предпросмотр видите только вы.')));
  byId('v5Board').addEventListener('click', () => { if (document.body.classList.contains('scene-board')) api.setScene('camera'); else byId('whiteboardToggle')?.click(); });
  byId('v5Layout').addEventListener('click', () => { showTab('setup', true); layoutSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); layoutSection.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }); });

  // Cards under the dock: room status, timer, quick reactions.
  const cards = document.createElement('div');
  cards.className = 'v5-cards';
  cards.innerHTML =
    '<section class="v5-mini-card v5-room" aria-labelledby="v5RoomTitle"><span class="v5-card-icon">' + icon('users') + '</span><div><h3 id="v5RoomTitle">' + t('Room status', 'Комната') + '</h3><p class="v5-big" id="v5Participants">0</p><small id="v5ParticipantsLabel">' + t('viewers online', 'зрителей онлайн') + '</small></div><button type="button" class="btn v5-invite" id="v5Invite" title="' + t('Copy the student link', 'Скопировать ссылку для учеников') + '">' + icon('invite') + '<span class="v5-invite-label">' + t('Invite', 'Пригласить') + '</span></button></section>' +
    '<section class="v5-mini-card v5-timer" aria-labelledby="v5TimerTitle"><span class="v5-card-icon">' + icon('clock') + '</span><div class="v5-timer-body"><h3 id="v5TimerTitle">' + t('Live timer', 'Таймер эфира') + '</h3></div></section>' +
    '<section class="v5-mini-card v5-reactions" aria-labelledby="v5ReactTitle"><span class="v5-card-icon">' + icon('smile') + '</span><div class="v5-react-body"><h3 id="v5ReactTitle">' + t('Quick reactions', 'Быстрые реакции') + '</h3></div></section>';
  v5Dock.after(cards);
  const timerBody = cards.querySelector('.v5-timer-body');
  ['elapsedText', 'statusText'].forEach((id) => { const node = byId(id); if (node) timerBody.appendChild(node); });
  byId('elapsedText')?.setAttribute('aria-label', t('Elapsed broadcast time', 'Время эфира'));
  reactionDock.classList.add('host-dock');
  reactionDock.setAttribute('role', 'group');
  reactionDock.setAttribute('aria-label', t('Send a reaction to the room', 'Отправить реакцию в комнату'));
  reactionDock.insertAdjacentHTML('beforeend', '<span class="v5-react-extra" hidden>' + ['👍', '🎉', '😮', '🙏', '✅'].map((emoji) => '<button type="button">' + emoji + '</button>').join('') + '</span>');
  const reactBody = cards.querySelector('.v5-react-body');
  const reactRow = document.createElement('div');
  reactRow.className = 'v5-react-row';
  reactRow.append(reactionDock);
  reactRow.insertAdjacentHTML('beforeend', '<button type="button" class="v5-react-more" id="v5ReactMore" aria-expanded="false" aria-label="' + t('More reactions', 'Больше реакций') + '">' + icon('plus') + '</button>');
  reactBody.appendChild(reactRow);
  byId('v5ReactMore').addEventListener('click', function () { const extra = reactionDock.querySelector('.v5-react-extra'); extra.hidden = !extra.hidden; this.setAttribute('aria-expanded', String(!extra.hidden)); });
  reactionDock.addEventListener('click', (event) => { if (event.target.closest('button') && !api.getSession()) hint(t('Reactions reach viewers once the room is open.', 'Реакции увидят зрители, когда комната будет открыта.')); }, true);
  function copyStudentLink() {
    const url = byId('shareUrl')?.value || '';
    if (!api.getSession() || !url) { hint(t('The student link appears once you schedule or start the room.', 'Ссылка для учеников появится, когда вы запланируете или запустите комнату.')); return; }
    byId('copyShare')?.click();
    hint(t('Student link copied.', 'Ссылка для учеников скопирована.'));
  }
  byId('v5Invite').addEventListener('click', copyStudentLink);
  if (oldFooter) oldFooter.hidden = true;

  document.addEventListener('click',(event)=>{const button=event.target.closest('[data-remove-guest]');if(button&&confirm(t('Remove this guest from the stage?','Убрать этого гостя со сцены?')))api.removeGuest(button.dataset.removeGuest).catch(error=>alert(error.message));});
  document.addEventListener('click',(event)=>{const mute=event.target.closest('[data-mute-guest]'),pin=event.target.closest('[data-pin-guest]');if(mute)api.muteGuest(mute.dataset.muteGuest).catch(error=>alert(error.message));if(pin){const tile=pin.closest('.guest-tile'),container=tile?.parentElement;if(!tile||!container)return;container.querySelectorAll('.guest-tile').forEach(node=>node.classList.toggle('pinned',node===tile));container.prepend(tile);}});
  let meterStream = null;
  let meterFrame = 0;
  let micChecked = false;

  // ── Inspector tabs
  const tabs = document.createElement('div');
  tabs.className = 'studio-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', t('Studio panel', 'Панель студии'));
  tabs.innerHTML = [
    ['setup', t('Setup','Настройка')], ['design',t('Design','Дизайн')], ['materials',t('Materials','Материалы')],
    ['people',t('People','Люди')], ['health',t('Health','Связь')]
  ].map((item, index) => '<button type="button" role="tab" id="v5Tab-'+item[0]+'" aria-controls="v5Inspector" aria-selected="'+(index===0)+'" tabindex="'+(index===0?0:-1)+'" data-studio-tab="'+item[0]+'" class="'+(index===0?'active':'')+'">'+item[1]+'</button>').join('');
  const tabsBar = document.createElement('div');
  tabsBar.className = 'v5-tabs-bar';
  tabsBar.append(tabs);
  tabsBar.insertAdjacentHTML('beforeend', '<button type="button" class="v5-icon-btn v5-inspector-toggle" id="v5InspectorToggle" aria-expanded="true" aria-controls="v5Inspector" aria-label="' + t('Show or hide the studio panel', 'Показать или скрыть панель студии') + '">' + icon('chevron') + '</button>');
  side.id = 'v5Inspector';
  side.setAttribute('role', 'tabpanel');
  side.setAttribute('aria-labelledby', 'v5Tab-setup');
  side.prepend(tabsBar);
  const noteBanner = byId('note');
  if (noteBanner) { noteBanner.setAttribute('role', 'status'); tabsBar.after(noteBanner); }

  const map = {
    setup: ['setupSection','timelineSection'], design: ['cameraSection'], materials: ['linksTitle'],
    people: ['guestRequestsSection'], health: ['diagnosticsSection','checklistTitle','detailsTitle']
  };
  const sections = Array.from(side.querySelectorAll('.studio-section'));
  sections.forEach((section) => section.dataset.studioGroup = 'setup');
  Object.entries(map).forEach(([group, ids]) => ids.forEach((id) => {
    const node=document.getElementById(id); const section=node && node.closest('.studio-section'); if(section) section.dataset.studioGroup=group;
  }));
  const narrow = window.matchMedia('(max-width: 1200px)');
  let studioTick = null;
  function setCollapsed(collapsed) {
    side.classList.toggle('v5-collapsed', collapsed);
    byId('v5InspectorToggle').setAttribute('aria-expanded', String(!collapsed));
  }
  function showTab(name, expand) {
    tabs.querySelectorAll('button').forEach((button)=>{const active=button.dataset.studioTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
    side.setAttribute('aria-labelledby', 'v5Tab-' + name);
    sections.forEach((section)=>{ section.style.display=section.id==='viewerActionsSection'?'none':(section.dataset.studioGroup===name?'grid':'none'); });
    if (expand) setCollapsed(false);
    if (name === 'health') studioTick?.();
  }
  tabs.addEventListener('click',(event)=>{ const button=event.target.closest('[data-studio-tab]'); if(!button)return; if(narrow.matches&&button.classList.contains('active')&&!side.classList.contains('v5-collapsed')){setCollapsed(true);return;} showTab(button.dataset.studioTab,true); });
  tabs.addEventListener('keydown',(event)=>{const list=Array.from(tabs.querySelectorAll('[role="tab"]'));const index=list.indexOf(document.activeElement);if(index<0)return;let next=-1;if(event.key==='ArrowRight')next=(index+1)%list.length;if(event.key==='ArrowLeft')next=(index-1+list.length)%list.length;if(event.key==='Home')next=0;if(event.key==='End')next=list.length-1;if(next<0)return;event.preventDefault();list[next].focus();showTab(list[next].dataset.studioTab,true);});
  byId('v5InspectorToggle').addEventListener('click', () => setCollapsed(!side.classList.contains('v5-collapsed')));
  setCollapsed(narrow.matches);
  narrow.addEventListener?.('change', (event) => setCollapsed(event.matches));
  showTab('setup');
  const savedScene=localStorage.getItem('duvela.live.scene')||'camera'; const sceneSelect=document.getElementById('scenePreset'); if(sceneSelect){sceneSelect.value=savedScene;sceneSelect.addEventListener('change',()=>localStorage.setItem('duvela.live.scene',sceneSelect.value));}
  sceneSelect?.closest('.option-row')?.classList.add('v5-hidden-row');
  function addSection(group, className, html) {
    const section = document.createElement('section');
    section.className = 'studio-section v5-wrap ' + (className || '');
    section.dataset.studioGroup = group;
    section.innerHTML = html;
    side.appendChild(section);
    sections.push(section);
    return section;
  }

  // Chat (People tab)
  const hostChatSection=addSection('people','host-chat-section','<div class="studio-tool-card">'+cardHead('chat',t('LIVE chat','Чат эфира'),t('Messages from learners appear here in real time.','Сообщения учеников появляются здесь в реальном времени.'))+'</div>');
  const hostChatShell=document.getElementById('chatShell');
  if(hostChatShell){hostChatShell.style.display='grid';hostChatSection.querySelector('.studio-tool-card').appendChild(hostChatShell);}
  const chatInput=document.getElementById('chatInput'),chatForm=document.getElementById('chatForm'),chatButton=document.getElementById('studioChatBtn');
  if(chatInput){chatInput.placeholder=t('Write to the LIVE chat…','Напишите в чат эфира…');chatInput.setAttribute('aria-label',t('Message to the LIVE chat','Сообщение в чат эфира'));}
  if(document.getElementById('sendChat'))document.getElementById('sendChat').textContent=t('Send','Отправить');
  if(chatForm&&!chatForm.dataset.hostBound){chatForm.dataset.hostBound='true';chatForm.addEventListener('submit',async(event)=>{event.preventDefault();const text=chatInput?.value.trim();if(!text)return;try{await api.sendChatMessage(text);}catch(error){alert(error.message);}});}
  async function openHostChat(){showTab('people',true);hostChatSection.scrollIntoView({behavior:'smooth',block:'start'});try{await api.initializeChat();chatInput?.focus();}catch(error){alert(error.message);}}
  if(chatButton)chatButton.onclick=openHostChat;
  let chatReady=false;const chatBootstrap=setInterval(async()=>{if(chatReady||!api.getSession())return;try{chatReady=await api.initializeChat();if(chatReady)clearInterval(chatBootstrap);}catch(_){}},1000);

  const duelBtn=document.getElementById('studioDuelBtn');
  if(duelBtn) duelBtn.onclick=function(){
    if(window.DuvelaDuelStudio) window.DuvelaDuelStudio.toggle();
    else alert(t('Duel overlay is not loaded.','Оверлей дуэли не загрузился.'));
  };
  document.getElementById('studioRecord').onclick=async function(){if(!api.isRecording()&&!api.isPublishing())return hint(t('Recording is available once LIVE is running. It saves a .webm file in this browser.','Запись доступна во время эфира. Она сохраняет файл .webm в этом браузере.'));try{if(api.isRecording()){await api.stopRecording();this.classList.remove('is-active');setToolLabel(this,t('Record','Запись'));}else{api.startRecording();this.classList.add('is-active');setToolLabel(this,t('Stop','Стоп'));}}catch(error){alert(error.message);}};
  function syncShareButton(on){const button=document.getElementById('studioShareScreen');if(!button)return;button.classList.toggle('is-active',on);button.setAttribute('aria-pressed',String(on));setToolLabel(button,on?t('Stop sharing','Остановить'):t('Share screen','Экран'));}
  document.getElementById('studioShareScreen').addEventListener('click',async function(){ try { syncShareButton(await api.toggleScreenShare()); } catch(error){ if(error?.name!=='NotAllowedError')alert(error.message); } });
  window.addEventListener('duvela:screen-share',(event)=>syncShareButton(Boolean(event.detail?.active)));
  syncShareButton(false);

  // Materials tab: lesson files, private notes, lesson plan timer, poll.
  const privateTools=addSection('materials','v5-private-tools','<div class="studio-tool-card" id="v5NotesCard">'+cardHead('notes',t('Private notes','Личные заметки'),t('Stored only in this browser and never shown to viewers.','Хранятся только в этом браузере и не видны зрителям.'))+'<textarea id="studioPrivateNotes" rows="6" aria-label="'+t('Private notes','Личные заметки')+'" placeholder="'+t('Private notes…','Личные заметки…')+'"></textarea></div><div class="studio-tool-card" id="v5PlanCard">'+cardHead('plan',t('Lesson plan','План урока'),t('Name the current stage and run a countdown for it.','Назовите текущий этап урока и запустите для него таймер.'))+'<div class="lesson-plan-row"><input id="lessonPlanText" aria-label="'+t('Lesson stage','Этап урока')+'" placeholder="'+t('Lesson stage','Этап урока')+'"><input id="lessonPlanMinutes" type="number" min="1" value="10" aria-label="'+t('Minutes','Минуты')+'"><button class="btn" id="lessonPlanStart">'+t('Start timer','Запустить')+'</button></div><div class="plan-timer" id="lessonPlanTimer" role="timer">10:00</div></div>');
  privateTools.id='privateTeacherTools';
  const notesKey='duvela.live.notes.'+(new URLSearchParams(location.search).get('s')||'new');
  const notes=privateTools.querySelector('#studioPrivateNotes'); notes.value=localStorage.getItem(notesKey)||''; notes.addEventListener('input',()=>localStorage.setItem(notesKey,notes.value));
  const materialTools=document.createElement('div');materialTools.className='studio-tool-card';materialTools.innerHTML=cardHead('material',t('PDF and lesson materials','PDF и материалы урока'),t('Preview a PDF or image before LIVE. During a broadcast it is shown to viewers on the stage.','Проверьте PDF или изображение до эфира. Во время трансляции материал появится на сцене у зрителей.'))+'<div class="material-picker-stack"><button class="btn primary" id="studioChoosePdf">📄 '+t('Choose PDF','Выбрать PDF')+'</button><button class="btn" id="studioChooseImage">🖼 '+t('Choose JPG, PNG or WebP','Выбрать JPG, PNG или WebP')+'</button></div><button class="btn" id="studioRemoveMaterial">'+t('Remove from stage','Убрать со сцены')+'</button><span id="studioMaterialName">'+t('No material selected','Материал не выбран')+'</span>';
  privateTools.prepend(materialTools);
  materialTools.insertAdjacentHTML('beforeend','<button class="btn" id="exportAnnotatedPdf">⇩ '+t('Export PDF with annotations','Экспорт PDF с пометками')+'</button>');
  materialTools.querySelector('#exportAnnotatedPdf').onclick=async function(){this.disabled=true;try{await api.exportAnnotatedPdf();}catch(error){alert(error.message);}finally{this.disabled=false;}};
  const materialLibrary=document.createElement('div');materialLibrary.className='material-library';materialTools.appendChild(materialLibrary);const sessionMaterials=[];let activeMaterial=-1;
  function setActiveMaterial(index){activeMaterial=index;const item=sessionMaterials[index];materialTools.querySelector('#studioMaterialName').textContent=item?t('On stage: ','На сцене: ')+item.file.name:t('No material selected','Материал не выбран');renderMaterialLibrary();}
  function renderMaterialLibrary(){materialLibrary.replaceChildren(...sessionMaterials.map((item,index)=>{const button=document.createElement('button');button.type='button';button.className='btn'+(index===activeMaterial?' active':'');button.dataset.materialIndex=index;const name=document.createElement('span');name.textContent=item.file.name;const size=document.createElement('small');size.textContent=Math.ceil(item.file.size/1024)+' KB';button.append(name,size);return button;}));}
  async function syncServerMaterials(){const rows=await api.listMaterials();rows.forEach(row=>{if(sessionMaterials.some(item=>item.serverId===row.id||item.url===row.public_url))return;sessionMaterials.push({serverId:row.id,url:row.public_url,file:{name:row.name,size:row.size_bytes||0,type:row.mime_type}});});renderMaterialLibrary();}
  setTimeout(syncServerMaterials,1600);setInterval(()=>{if(tabs.querySelector('[data-studio-tab="materials"]')?.classList.contains('active'))syncServerMaterials();},8000);
  materialLibrary.addEventListener('click',(event)=>{const button=event.target.closest('[data-material-index]');if(!button)return;const index=Number(button.dataset.materialIndex),item=sessionMaterials[index];if(!item)return;setActiveMaterial(index);const input=document.getElementById('materialFile');try{const transfer=new DataTransfer();transfer.items.add(item.file);input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){api.previewMaterial(item.url,item.file.type);}});
  function chooseMaterial(accept){const input=document.getElementById('materialFile');if(input){input.accept=accept;input.value='';input.click();}}
  materialTools.querySelector('#studioChoosePdf').onclick=()=>chooseMaterial('application/pdf,.pdf');
  materialTools.querySelector('#studioChooseImage').onclick=()=>chooseMaterial('image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp');
  document.getElementById('materialFile')?.addEventListener('change',(event)=>{const file=event.target.files?.[0];if(!file)return;const supported=file.type==='application/pdf'||['image/jpeg','image/png','image/webp'].includes(file.type);if(!supported){event.target.value='';return alert(t('Choose a PDF, JPG, PNG or WebP file.','Выберите файл PDF, JPG, PNG или WebP.'));}let index=sessionMaterials.findIndex(item=>item.file.name===file.name&&item.file.size===file.size);let item=sessionMaterials[index];if(!item){item={file,url:URL.createObjectURL(file)};sessionMaterials.push(item);index=sessionMaterials.length-1;}setActiveMaterial(index);api.previewMaterial(item.url,file.type);});
  materialTools.querySelector('#studioRemoveMaterial').onclick=()=>{const overlay=document.getElementById('liveMaterialOverlay');if(overlay&&api.isPublishing())document.getElementById('pinMaterial')?.click();else api.clearMaterialPreview();setActiveMaterial(-1);};
  document.getElementById('studioNotesBtn').addEventListener('click',()=>{showTab('materials',true);byId('v5NotesCard').scrollIntoView({behavior:'smooth',block:'start'});notes.focus({preventScroll:true});});
  document.getElementById('studioPlanBtn').addEventListener('click',()=>{showTab('materials',true);byId('v5PlanCard').scrollIntoView({behavior:'smooth',block:'start'});byId('lessonPlanText').focus({preventScroll:true});});
  const peopleSection=document.getElementById('guestRequestsSection');if(peopleSection){peopleSection.insertAdjacentHTML('afterbegin','<div class="moderator-box studio-tool-card">'+cardHead('users',t('Moderator','Модератор'),t('Add a trusted Duvela user by profile ID.','Добавьте доверенного пользователя Duvela по ID профиля.'))+'<div class="lesson-plan-row"><input id="moderatorUserId" placeholder="User UUID" aria-label="'+t('Moderator profile ID','ID профиля модератора')+'"><button class="btn" id="addModerator">'+t('Add','Добавить')+'</button></div></div>');document.getElementById('addModerator').addEventListener('click',async()=>{try{await api.addModerator(document.getElementById('moderatorUserId').value.trim());alert(t('Moderator added.','Модератор добавлен.'));}catch(error){alert(error.message);}});}
  const boardRow=document.getElementById('whiteboardLabel')?.closest('.option-row');
  if(boardRow){boardRow.insertAdjacentHTML('afterend','<div class="option-row"><span>'+t('Board tools','Инструменты доски')+'</span><div style="display:flex;gap:8px;align-items:center"><input type="color" id="boardColor" value="#6d3fe0" title="Color" aria-label="'+t('Board pen colour','Цвет пера доски')+'"><input type="range" id="boardWidth" min="2" max="18" value="5" title="Line width" aria-label="'+t('Board line width','Толщина линии доски')+'"></div></div>'); const update=()=>api.setBoardTool(document.getElementById('boardColor').value,document.getElementById('boardWidth').value);document.getElementById('boardColor').addEventListener('input',update);document.getElementById('boardWidth').addEventListener('input',update);}
  let planTimer=null; privateTools.querySelector('#lessonPlanStart').addEventListener('click',()=>{ clearInterval(planTimer); let seconds=Math.max(1,Number(privateTools.querySelector('#lessonPlanMinutes').value)||10)*60; const out=privateTools.querySelector('#lessonPlanTimer'); out.classList.remove('done'); const draw=()=>{out.textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'); if(seconds--<=0){clearInterval(planTimer);out.classList.add('done');}}; draw(); planTimer=setInterval(draw,1000); });

  // Pre-live device check; the stage "devices" button reopens it later.
  const modal=document.createElement('div'); modal.className='prelive-modal open'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','v5PreliveTitle'); modal.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('PRE-LIVE CHECK','ПРОВЕРКА ПЕРЕД ЭФИРОМ')+'</span><h2 id="v5PreliveTitle">'+t('Ready to enter the studio?','Готовы войти в студию?')+'</h2><p class="v5-prelive-copy">'+t('Choose devices and confirm the connection before broadcasting.','Выберите устройства и проверьте соединение перед эфиром.')+'</p><div class="prelive-preview"><video autoplay muted playsinline></video></div><label>'+t('Camera','Камера')+'<select id="preCamera"></select></label><label>'+t('Microphone','Микрофон')+'<select id="preMic"></select></label><div class="mic-meter" role="meter" aria-label="'+t('Microphone level','Уровень микрофона')+'" aria-valuemin="0" aria-valuemax="100"><i></i></div><div class="preflight-status"><span>● '+(navigator.onLine?t('Internet ready','Интернет готов'):t('Offline','Нет сети'))+'</span><span id="preNetwork">'+(navigator.connection?.effectiveType||t('Checking…','Проверка…'))+'</span></div><div class="studio-inline v5-prelive-actions"><button class="btn" id="cancelDevices" hidden>'+t('Cancel','Отмена')+'</button><button class="btn primary" id="enterStudio">'+t('Enter studio','Войти в студию')+'</button></div></div>';
  document.body.appendChild(modal);
  let meterContext=null;
  async function loadDevices(){
    try {
      meterStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); modal.querySelector('video').srcObject=meterStream;
      const devices=await navigator.mediaDevices.enumerateDevices(); const cam=modal.querySelector('#preCamera'),mic=modal.querySelector('#preMic');
      cam.innerHTML=devices.filter(d=>d.kind==='videoinput').map((d,i)=>'<option value="'+esc(d.deviceId)+'">'+esc(d.label||t('Camera ','Камера ')+(i+1))+'</option>').join('');
      mic.innerHTML=devices.filter(d=>d.kind==='audioinput').map((d,i)=>'<option value="'+esc(d.deviceId)+'">'+esc(d.label||t('Microphone ','Микрофон ')+(i+1))+'</option>').join('');
      micChecked=meterStream.getAudioTracks().some(track=>track.readyState==='live');
      meterContext=new AudioContext();const source=meterContext.createMediaStreamSource(meterStream),analyser=meterContext.createAnalyser(),data=new Uint8Array(analyser.frequencyBinCount); source.connect(analyser);
      const meter=modal.querySelector('.mic-meter');const draw=()=>{analyser.getByteFrequencyData(data); const level=data.reduce((a,b)=>a+b,0)/data.length/255; const pct=Math.min(100,level*260); meter.querySelector('i').style.width=pct+'%'; meter.setAttribute('aria-valuenow',String(Math.round(pct))); meterFrame=requestAnimationFrame(draw);}; draw();
    } catch(error){ modal.querySelector('.preflight-status').textContent=String(error&&error.message||error); }
  }
  function stopDeviceCheck(){ cancelAnimationFrame(meterFrame); meterStream?.getTracks().forEach(track=>track.stop()); meterStream=null; meterContext?.close?.().catch(()=>{}); meterContext=null; modal.classList.remove('open'); }
  modal.querySelector('#enterStudio').addEventListener('click',async()=>{ const button=modal.querySelector('#enterStudio'),cam=modal.querySelector('#preCamera').value,mic=modal.querySelector('#preMic').value; if(button)button.disabled=true; stopDeviceCheck(); try{await api.setDevices(cam,mic);}catch(error){console.warn('pre-live device setup failed',error);} });
  modal.querySelector('#cancelDevices').addEventListener('click',()=>{stopDeviceCheck();byId('v5Devices').focus();});
  modal.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&!modal.querySelector('#cancelDevices').hidden){stopDeviceCheck();byId('v5Devices').focus();}});
  function openDevices(){
    if(modal.classList.contains('open'))return;
    modal.querySelector('.prelive-kicker').textContent=t('DEVICES','УСТРОЙСТВА');
    modal.querySelector('h2').textContent=t('Camera and microphone','Камера и микрофон');
    modal.querySelector('.v5-prelive-copy').textContent=api.isPublishing()?t('A new camera switches immediately. A new microphone is used the next time LIVE starts.','Новая камера переключится сразу. Новый микрофон будет использован при следующем запуске эфира.'):t('The selected devices are used for the preview and when LIVE starts.','Выбранные устройства используются для предпросмотра и при запуске эфира.');
    const enter=modal.querySelector('#enterStudio');enter.disabled=false;enter.textContent=t('Apply devices','Применить');
    modal.querySelector('#cancelDevices').hidden=false;
    modal.classList.add('open');loadDevices();enter.focus();
  }
  byId('v5Devices').addEventListener('click',openDevices);
  byId('v5MicMenu').addEventListener('click',openDevices);
  loadDevices();

  // ── Setup tab: session card, layout & scene, production controls, Agora status, multistream
  const setupSection = byId('setupSection');
  setupSection.classList.add('v5-setup-card');
  const setupTitle = byId('setupTitle')?.parentElement;
  if (setupTitle) { setupTitle.classList.add('v5-card-copy'); const head = document.createElement('div'); head.className = 'v5-card-head'; head.innerHTML = '<span class="v5-card-icon">' + icon('calendar') + '</span>'; setupTitle.before(head); head.appendChild(setupTitle); }
  const topicInput = byId('topicInput');
  const topicLabel = setupSection.querySelector('label[for="topicInput"]');
  if (topicLabel && topicInput) {
    const row = document.createElement('div'); row.className = 'v5-label-row'; topicLabel.before(row); row.appendChild(topicLabel);
    row.insertAdjacentHTML('beforeend', '<span class="v5-counter" id="v5TitleCount" aria-live="polite"></span>');
    const count = () => { byId('v5TitleCount').textContent = topicInput.value.length + '/' + (topicInput.maxLength > 0 ? topicInput.maxLength : 80); };
    topicInput.addEventListener('input', count); count(); setInterval(count, 2000);
  }
  const hostSetup = byId('hostSetup');
  function switchRow(input, iconName, title, copy) {
    if (!input) return null;
    const oldRow = input.closest('label');
    const row = document.createElement('label');
    row.className = 'v5-switch-row';
    row.innerHTML = '<span class="v5-switch-icon">' + icon(iconName) + '</span><span class="v5-switch-copy"><b>' + title + '</b><small>' + copy + '</small></span>';
    input.classList.add('v5-switch');
    input.setAttribute('role', 'switch');
    row.appendChild(input);
    hostSetup.insertBefore(row, byId('restreamSetup'));
    if (oldRow && oldRow !== row) oldRow.remove();
    return row;
  }
  switchRow(byId('privateInput'), 'lock', t('Private room', 'Закрытая комната'), t('Only invited participants can join.', 'Войти могут только приглашённые участники.'));
  switchRow(byId('allowViewerRequests'), 'invite', t('Guest stage requests', 'Запросы на выход в эфир'), t('Viewers can ask to join you on stage.', 'Зрители могут попросить выйти к вам в эфир.'));
  switchRow(byId('audience18Plus'), 'eye', t('Audience 18+', 'Аудитория 18+'), t('Only adult learners can watch.', 'Смотреть могут только взрослые ученики.'));
  byId('scheduleSession')?.classList.add('primary', 'v5-schedule-btn');
  const restream = byId('restreamSetup');

  const sceneButtons=document.createElement('div');
  sceneButtons.className='studio-v5-scene-grid';
  sceneButtons.setAttribute('role','group');
  sceneButtons.setAttribute('aria-label',t('Scene selection','Выбор сцены'));
  const initialScene = api.getSceneState?.().live || 'camera';
  sceneButtons.innerHTML=[
    ['camera','Camera','Камера','Full frame','На весь экран'],
    ['presentation','Presentation','Презентация','Screen + camera','Экран + камера'],
    ['board','Board','Доска','Teaching board','Учебная доска'],
    ['focus','Focus','Фокус','Teacher close-up','Крупный план']
  ].map(([id,en,ruName,detailEn,detailRu])=>'<button type="button" class="studio-v5-scene" data-quick-scene="'+id+'" data-scene="'+id+'" aria-pressed="'+(id===initialScene)+'"><span class="v5-thumb" aria-hidden="true"><canvas width="160" height="90"></canvas><i class="v5-thumb-slide"></i><i class="v5-thumb-pip"><canvas width="64" height="36"></canvas></i></span><span class="v5-scene-name">'+t(en,ruName)+'</span><small>'+t(detailEn,detailRu)+'</small></button>').join('');
  const layoutSection = addSection('setup', 'v5-layout-card', '<div class="studio-tool-card">' + cardHead('monitor', t('Layout & scene', 'Раскладка и сцена'), t('Choose how your live room looks to participants.', 'Выберите, как комната выглядит для участников.')) + '<select id="previewScene" hidden aria-hidden="true"><option value="camera">camera</option><option value="presentation">presentation</option><option value="board">board</option><option value="focus">focus</option></select></div>');
  layoutSection.querySelector('.studio-tool-card').appendChild(sceneButtons);
  layoutSection.querySelector('.studio-tool-card').insertAdjacentHTML('beforeend', '<label class="v5-range">' + t('Camera window size (Presentation)', 'Размер окна камеры (Презентация)') + '<input id="cameraPipSize" type="range" min="18" max="55" value="27"></label>');
  const production = addSection('setup', 'v5-production-card', '<div class="studio-tool-card">' + cardHead('sliders', t('Production controls', 'Управление эфиром'), t('Preview changes before going live. Drag the camera on the stage in Presentation.', 'Проверьте изменения до отправки в эфир. В Презентации камеру можно перетаскивать по сцене.')) + '<div class="v5-production-actions"><button type="button" class="btn" id="previewSceneBtn">' + icon('eye') + t('Preview changes', 'Предпросмотр') + '</button><button type="button" class="btn primary" id="commitSceneBtn">' + icon('send') + t('Apply to live', 'Отправить в эфир') + '</button></div><p class="v5-scene-state" id="v5SceneState" aria-live="polite"></p><label class="v5-range">' + t('Microphone level', 'Громкость микрофона') + '<input id="studioMicVolume" type="range" min="0" max="100" value="100"></label></div>');
  const previewSelect = layoutSection.querySelector('#previewScene');
  previewSelect.value = initialScene;
  const statusSection = addSection('setup', 'v5-agora-card', '<div class="studio-tool-card">' + cardHead('pulse', t('Studio status (Agora)', 'Состояние студии (Agora)'), '', '<span class="v5-conn" id="v5ConnState"><i></i><span>' + t('Not connected', 'Не подключено') + '</span></span>') + '<div class="v5-stat-grid"><div><span>' + t('Network', 'Сеть') + '</span><b id="v5StatNetwork">' + NOT_AVAILABLE + '</b></div><div><span>' + t('Latency', 'Задержка') + '</span><b id="v5StatRtt">' + NOT_AVAILABLE + '</b></div><div><span>' + t('Uplink', 'Отдача') + '</span><b id="v5StatUp">' + NOT_AVAILABLE + '</b></div><div><span>' + t('Downlink', 'Приём') + '</span><b id="v5StatDown">' + NOT_AVAILABLE + '</b></div></div></div>');
  const multistream = addSection('setup', 'v5-multistream-card', '<div class="studio-tool-card">' + cardHead('globe', t('Multistream', 'Мультитрансляция'), t('YouTube, Facebook and TikTok start automatically with LIVE through Agora Media Push.', 'YouTube, Facebook и TikTok запускаются вместе с эфиром через Agora Media Push.')) + '<p class="v5-multistream-state" id="v5MultistreamState"></p></div>');
  if (restream) multistream.querySelector('.studio-tool-card').appendChild(restream);
  function renderMultistreamState() {
    const rows = Array.from(document.querySelectorAll('.restream-row'));
    const ready = rows.filter((row) => row.querySelector('.restreamEnabled')?.checked && row.querySelector('.restreamUrl')?.value.trim() && row.querySelector('.restreamKey')?.value.trim()).map((row) => row.querySelector('.restream-row-head span')?.textContent || row.dataset.platform);
    const node = byId('v5MultistreamState');
    node.classList.toggle('ok', ready.length > 0);
    node.textContent = ready.length ? t('Enabled: ', 'Включено: ') + ready.join(', ') : t('Not configured — enable a platform and add its server URL and stream key, then save.', 'Не настроено — включите платформу, добавьте адрес сервера и ключ трансляции, затем сохраните.');
  }
  restream?.addEventListener('input', renderMultistreamState);
  restream?.addEventListener('change', renderMultistreamState);
  setTimeout(renderMultistreamState, 2500); renderMultistreamState();

  const previewBanner=document.createElement('div');previewBanner.className='studio-preview-banner';previewBanner.textContent=t('PRIVATE PREVIEW — viewers still see the live scene','ЛИЧНЫЙ ПРЕДПРОСМОТР — зрители видят сцену эфира');previewBanner.hidden=true;stage?.appendChild(previewBanner);
  function renderSceneState() {
    const state = api.getSceneState?.() || { preview: previewSelect.value, live: previewSelect.value, publishing: api.isPublishing() };
    const node = byId('v5SceneState');
    node.innerHTML = '<span><small>' + t('Preview', 'Предпросмотр') + '</small><b>' + esc(sceneNames[state.preview] || state.preview) + '</b></span><span class="' + (state.publishing ? 'is-live' : '') + '"><small>' + t('Live', 'Эфир') + '</small><b>' + esc(sceneNames[state.live] || state.live) + '</b><em>' + (state.publishing ? t('on air', 'в эфире') : t('sent when LIVE starts', 'применится при старте')) + '</em></span>';
    previewBanner.hidden = state.preview === state.live;
    sceneButtons.querySelectorAll('[data-quick-scene]').forEach((node) => node.classList.toggle('is-live', node.dataset.quickScene === state.live));
  }
  production.querySelector('#previewSceneBtn').onclick=()=>{api.previewScene(previewSelect.value);renderSceneState();};
  production.querySelector('#commitSceneBtn').onclick=()=>{api.setScene(previewSelect.value);renderSceneState();hint(api.isPublishing()?t('Scene sent to viewers.','Сцена отправлена зрителям.'):t('Scene saved. Viewers get it when LIVE starts.','Сцена сохранена. Зрители увидят её при старте эфира.'));};
  window.addEventListener('duvela:scene', renderSceneState);
  production.querySelector('#studioMicVolume').oninput=(event)=>api.setMicrophoneVolume(event.target.value);
  const camera=()=>document.getElementById('hostCameraPreview');
  layoutSection.querySelector('#cameraPipSize').oninput=(event)=>{const node=camera();if(!node)return;node.classList.add('camera-pip-edit');node.style.setProperty('width',event.target.value+'%','important');node.style.setProperty('height',Math.round(event.target.value*.62)+'%','important');};
  let drag=null;stage?.addEventListener('pointerdown',(event)=>{const node=event.target.closest('#hostCameraPreview');if(!node||!document.body.classList.contains('scene-presentation'))return;event.preventDefault();node.classList.add('camera-pip-edit');const rect=node.getBoundingClientRect(),stageRect=node.closest('.stage').getBoundingClientRect();drag={node,dx:event.clientX-rect.left,dy:event.clientY-rect.top,stageRect};node.setPointerCapture?.(event.pointerId);});
  window.addEventListener('pointermove',(event)=>{if(!drag)return;const x=Math.max(0,Math.min(drag.stageRect.width-drag.node.offsetWidth,event.clientX-drag.stageRect.left-drag.dx));const y=Math.max(0,Math.min(drag.stageRect.height-drag.node.offsetHeight,event.clientY-drag.stageRect.top-drag.dy));drag.node.style.setProperty('left',x+'px','important');drag.node.style.setProperty('top',y+'px','important');drag.node.style.setProperty('right','auto','important');drag.node.style.setProperty('bottom','auto','important');});window.addEventListener('pointerup',()=>drag=null);
  sceneButtons.onclick=(event)=>{
    const button=event.target.closest('[data-quick-scene]');
    if(!button)return;
    previewSelect.value=button.dataset.quickScene;
    sceneButtons.querySelectorAll('[data-quick-scene]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));
  };
  // Scene thumbnails show the real camera frame, refreshed every two seconds.
  function drawThumbnails(){
    const video=camera();
    if(!video||video.readyState<2||!video.videoWidth||document.hidden||!tabs.querySelector('[data-studio-tab="setup"]').classList.contains('active'))return;
    sceneButtons.querySelectorAll('canvas').forEach((canvas)=>{
      const focus=canvas.closest('[data-scene="focus"]')&&canvas.width===160;
      const ctx=canvas.getContext('2d');const vw=video.videoWidth,vh=video.videoHeight;
      const scale=focus?1.45:1;const sw=vw/scale,sh=vh/scale;
      try{ctx.drawImage(video,(vw-sw)/2,(vh-sh)/2,sw,sh,0,0,canvas.width,canvas.height);}catch(_){}
    });
  }
  setInterval(drawThumbnails,2000);
  renderSceneState();

  const brandTools=addSection('design','','<div class="studio-tool-card">'+cardHead('design',t('On-screen design','Оформление эфира'),t('Titles, logo and hold screens are sent to viewers while LIVE.','Титры, логотип и экраны ожидания отправляются зрителям во время эфира.'))+'<input id="lowerTitle" aria-label="'+t('Teacher or speaker name','Имя преподавателя или спикера')+'" placeholder="'+t('Teacher or speaker name','Имя преподавателя или спикера')+'"><input id="lowerSubtitle" aria-label="'+t('Lesson topic or role','Тема урока или роль')+'" placeholder="'+t('Lesson topic or role','Тема урока или роль')+'"><div class="studio-inline"><button class="btn primary" id="showLower">'+t('Show lower third','Показать титр')+'</button><button class="btn" id="hideLower">'+t('Hide','Скрыть')+'</button></div><label class="btn">🖼 '+t('Upload logo','Загрузить логотип')+'<input id="brandLogoFile" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><div class="studio-inline"><button class="btn" id="waitingScreen">'+t('Waiting screen','Экран ожидания')+'</button><button class="btn" id="pauseScreen">'+t('Pause screen','Пауза')+'</button><button class="btn" id="resumeScreen">'+t('Return to LIVE','Вернуться в эфир')+'</button></div><button class="btn" id="captionToggle">CC '+t('Start automatic captions','Включить автосубтитры')+'</button></div>');
  brandTools.querySelector('.studio-tool-card').insertAdjacentHTML('beforeend','<button class="btn" id="serverCaptionToggle">☁ CC '+t('Server captions','Серверные субтитры')+'</button>');
  brandTools.querySelector('#serverCaptionToggle').onclick=function(){try{if(api.serverCaptionsActive()){api.stopServerCaptions();this.classList.remove('primary');this.textContent='☁ CC '+t('Server captions','Серверные субтитры');}else{api.startServerCaptions(liveI18n?.intlLocale || (ru?'ru-RU':'en-US'));this.classList.add('primary');this.textContent='■ '+t('Stop server captions','Остановить серверные субтитры');}}catch(error){alert(error.message);}};
  async function sendProduction(data){applyProductionEvent(data);if(api.isPublishing())await api.broadcastEvent(data);}
  setInterval(()=>{if(!api.isPublishing())return;api.syncLiveScene?.();if(productionState.lowerTitle)api.broadcastEvent({kind:'lower-third',title:productionState.lowerTitle,subtitle:productionState.lowerSubtitle}).catch(()=>{});if(productionState.logo)api.broadcastEvent({kind:'logo',url:productionState.logo}).catch(()=>{});if(productionState.hold)api.broadcastEvent({kind:'hold',mode:productionState.hold}).catch(()=>{});},12000);
  brandTools.querySelector('#showLower').onclick=()=>sendProduction({kind:'lower-third',title:brandTools.querySelector('#lowerTitle').value.trim(),subtitle:brandTools.querySelector('#lowerSubtitle').value.trim()});brandTools.querySelector('#hideLower').onclick=()=>sendProduction({kind:'lower-third',title:'',subtitle:''});
  brandTools.querySelector('#brandLogoFile').onchange=(event)=>{const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const scale=Math.min(1,420/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);sendProduction({kind:'logo',url:canvas.toDataURL('image/webp',.82)});};image.src=reader.result;};reader.readAsDataURL(file);};
  brandTools.querySelector('#waitingScreen').onclick=()=>sendProduction({kind:'hold',mode:'waiting'});brandTools.querySelector('#pauseScreen').onclick=()=>sendProduction({kind:'hold',mode:'pause'});brandTools.querySelector('#resumeScreen').onclick=()=>sendProduction({kind:'hold',mode:''});
  let recognition=null,captionsOn=false;brandTools.querySelector('#captionToggle').onclick=function(){const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition)return alert(t('Automatic captions are not supported by this browser.','Этот браузер не поддерживает автоматические субтитры.'));if(captionsOn){recognition?.stop();captionsOn=false;this.classList.remove('primary');this.textContent='CC '+t('Start automatic captions','Включить автосубтитры');sendProduction({kind:'caption',text:''});return;}recognition=new SpeechRecognition();recognition.continuous=true;recognition.interimResults=true;recognition.lang=liveI18n?.intlLocale || (ru?'ru-RU':'en-US');recognition.onresult=(event)=>{let text='';for(let i=event.resultIndex;i<event.results.length;i++)text+=event.results[i][0].transcript;sendProduction({kind:'caption',text:text.trim()});};recognition.onend=()=>{if(captionsOn)try{recognition.start();}catch(_){}};recognition.start();captionsOn=true;this.classList.add('primary');this.textContent='CC '+t('Stop captions','Остановить субтитры');};

  window.addEventListener('keydown',(event)=>{if(event.target.matches('input,textarea,select')||event.ctrlKey||event.metaKey||event.altKey||document.querySelector('.prelive-modal.open'))return;const scenes={Digit1:'camera',Digit2:'presentation',Digit3:'board',Digit4:'focus'};if(scenes[event.code]){event.preventDefault();api.setScene(scenes[event.code]);}if(event.code==='KeyM'){event.preventDefault();document.getElementById('toggleMic')?.click();}if(event.code==='KeyV'){event.preventDefault();document.getElementById('toggleCam')?.click();}if(event.code==='KeyS'){event.preventDefault();document.getElementById('studioShareScreen')?.click();}if(event.code==='KeyP'){event.preventDefault();brandTools.querySelector('#pauseScreen').click();}});

  const peopleTools=document.createElement('div');peopleTools.className='studio-tool-card';peopleTools.innerHTML=cardHead('invite',t('Raised hands and guests','Поднятые руки и гости'),t('Requests below form the speaking queue. Approve a learner to invite them on stage; reject to remove them from the queue.','Запросы ниже образуют очередь выступающих. Одобрите ученика, чтобы пригласить его на сцену, или отклоните, чтобы убрать из очереди.'))+'<div class="studio-inline"><span>✋ '+t('Queue is ordered by request time','Очередь по времени запроса')+'</span></div>';
  peopleSection?.insertBefore(peopleTools,peopleSection.firstChild);if(document.getElementById('guestRequestsTitle'))document.getElementById('guestRequestsTitle').textContent=t('Raised-hand queue','Очередь поднятых рук');if(byId('guestRequestsCopy'))byId('guestRequestsCopy').textContent=t('Approve or reject viewers who want to join the LIVE as guests.','Одобряйте или отклоняйте зрителей, которые хотят выйти в эфир гостем.');
  const onlineTools=document.createElement('div');onlineTools.className='studio-tool-card';onlineTools.innerHTML='<div class="studio-inline" style="justify-content:space-between"><h3>'+t('Viewers online','Зрители онлайн')+'</h3><b id="onlineViewerCount">0</b></div><div id="onlineViewerList"><p>'+t('No viewers connected yet.','Зрители пока не подключились.')+'</p></div>';
  peopleSection?.insertBefore(onlineTools,peopleTools.nextSibling);
  if(peopleSection){const queueCard=document.createElement('div');queueCard.className='studio-tool-card';const head=byId('guestRequestsTitle')?.parentElement;if(head)queueCard.appendChild(head);const list=byId('guestRequestsList');if(list)queueCard.appendChild(list);peopleSection.appendChild(queueCard);peopleSection.classList.add('v5-wrap');}
  function viewerInitials(name){return String(name||'D').trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();}
  async function refreshOnlineViewers(){if(!api.getSession())return;try{const viewers=await api.getOnlineViewers();onlineTools.querySelector('#onlineViewerCount').textContent=String(viewers.length);byId('v5Participants').textContent=String(viewers.length);onlineTools.querySelector('#onlineViewerList').innerHTML=viewers.length?viewers.map(viewer=>'<div class="online-viewer"><span class="online-viewer-avatar">'+(viewer.avatarUrl?'<img src="'+viewer.avatarUrl.replace(/"/g,'&quot;')+'" alt="">':viewerInitials(viewer.name))+'</span><span><b>'+esc(viewer.name)+'</b><small>'+t(viewer.role==='guest'?'Guest on stage':'Watching now',viewer.role==='guest'?'Гость в эфире':'Смотрит сейчас')+'</small></span><i></i></div>').join(''):'<p>'+t('No viewers connected yet.','Зрители пока не подключились.')+'</p>';}catch(error){onlineTools.querySelector('#onlineViewerList').innerHTML='<p>'+t('Could not update the viewer list.','Не удалось обновить список зрителей.')+'</p>';}}
  setInterval(refreshOnlineViewers,5000);setTimeout(refreshOnlineViewers,1200);

  const pollBox=document.createElement('div');pollBox.className='studio-tool-card';pollBox.innerHTML=cardHead('task',t('Live poll','Опрос в эфире'),'')+'<input id="pollQuestion" aria-label="'+t('Question','Вопрос')+'" placeholder="'+t('Question','Вопрос')+'"><input id="pollOptions" aria-label="'+t('Options separated by commas','Варианты через запятую')+'" placeholder="'+t('Options separated by commas','Варианты через запятую')+'"><div class="studio-inline"><button class="btn primary" id="startPoll">'+t('Launch poll','Запустить опрос')+'</button><button class="btn" id="closePoll">'+t('Close','Закрыть')+'</button><b id="pollVotes">0 '+t('votes','ответов')+'</b></div><div class="poll-results" id="pollResults"></div>';
  privateTools.appendChild(pollBox);let activePoll='',pollVotes=0,pollOptionLabels=[],pollOptionVotes=[];
  function renderPollResults(){const total=Math.max(1,pollVotes);pollBox.querySelector('#pollResults').innerHTML=pollOptionLabels.map((label,index)=>{const votes=pollOptionVotes[index]||0,pct=Math.round(votes/total*100);return '<div class="poll-result-row"><i style="width:'+pct+'%"></i><span><b>'+esc(label)+'</b><b>'+votes+' · '+pct+'%</b></span></div>';}).join('');}
  pollBox.querySelector('#startPoll').onclick=async()=>{const question=pollBox.querySelector('#pollQuestion').value.trim(),options=pollBox.querySelector('#pollOptions').value.split(',').map(x=>x.trim()).filter(Boolean);if(!question||options.length<2)return alert(t('Enter a question and at least two options.','Введите вопрос и минимум два варианта.'));let optionPayload=options;try{const saved=await api.createPoll(question,options);activePoll=saved.id;optionPayload=saved.options;}catch(_){activePoll=Date.now().toString(36);}pollVotes=0;pollOptionLabels=options;pollOptionVotes=options.map(()=>0);pollBox.querySelector('#pollVotes').textContent='0 '+t('votes','ответов');renderPollResults();await api.broadcastEvent({kind:'poll',id:activePoll,question,options:optionPayload});};
  pollBox.querySelector('#closePoll').onclick=async()=>{if(activePoll){try{await api.closePoll(activePoll);}catch(_){}await api.broadcastEvent({kind:'poll-close',pollId:activePoll});}activePoll='';};
  window.addEventListener('duvela:studio-event',(event)=>{const data=event.detail||{};if(data.kind==='poll-vote'&&data.pollId===activePoll){pollVotes++;pollOptionVotes[Number(data.option)||0]=(pollOptionVotes[Number(data.option)||0]||0)+1;pollBox.querySelector('#pollVotes').textContent=pollVotes+' '+t('votes','ответов');renderPollResults();}});
  setInterval(async()=>{if(!activePoll)return;const rows=await api.pollResults(activePoll);if(!rows.length)return;pollOptionLabels=rows.map(row=>row.label);pollOptionVotes=rows.map(row=>row.count);pollVotes=pollOptionVotes.reduce((sum,count)=>sum+count,0);pollBox.querySelector('#pollVotes').textContent=pollVotes+' '+t('votes','ответов');renderPollResults();},3000);

  // ── Health tab: only values reported by the Agora SDK or the browser; everything else says so.
  const healthSection = addSection('health', 'v5-health-card', '<div class="studio-tool-card">' + cardHead('pulse', t('Live connection (Agora SDK)', 'Соединение эфира (Agora SDK)'), t('Values come from the Agora client while LIVE is running. Before that they are not available.', 'Значения приходят от клиента Agora во время эфира. До старта данных нет.')) + '<dl class="v5-health-grid" id="v5HealthGrid"></dl></div><div class="studio-tool-card">' + cardHead('mic', t('Devices and browser network', 'Устройства и сеть браузера'), '') + '<div class="studio-health"><span id="studioNet">' + t('Network: checking', 'Сеть: проверка') + '</span><span id="studioMicState">' + t('Mic: checking', 'Микрофон: проверка') + '</span><span id="studioEcho">AEC ' + t('checking', 'проверка') + '</span><span id="studioNoise">ANS ' + t('checking', 'проверка') + '</span></div></div>');

  const net=healthSection.querySelector('#studioNet');function setNetwork(ok,label){net.className=ok?'ok':'bad';net.textContent=label;}
  let adaptiveProfile='';async function adaptQuality(){const connection=navigator.connection;const slow=!navigator.onLine||connection?.saveData||['slow-2g','2g'].includes(connection?.effectiveType),medium=connection?.effectiveType==='3g'||Number(connection?.downlink||10)<2.5;const profile=slow?'low':medium?'medium':'high';if(profile===adaptiveProfile)return;adaptiveProfile=profile;try{await api.setAdaptiveQuality(profile);net.title=t('Adaptive quality: ','Адаптивное качество: ')+profile;}catch(_){}}navigator.connection?.addEventListener('change',adaptQuality);window.addEventListener('online',adaptQuality);adaptQuality();
  setInterval(()=>{if(!api.isPublishing())return;const quality=!navigator.onLine?'offline':adaptiveProfile==='low'?'poor':adaptiveProfile==='medium'?'fair':'good';api.saveQualitySample(quality).catch(()=>{});},30000);
  setNetwork(navigator.onLine,navigator.onLine?t('Network: online','Сеть: подключена'):t('Network: offline','Сеть: отсутствует'));
  window.addEventListener('offline',()=>{setNetwork(false,t('Network: reconnecting…','Сеть: переподключение…'));const banner=document.createElement('div');banner.className='reconnect-banner';banner.id='reconnectBanner';banner.textContent=t('Connection lost. The studio will recover automatically.','Связь потеряна. Студия восстановится автоматически.');document.body.appendChild(banner);});
  window.addEventListener('online',async()=>{setNetwork(true,t('Network: restoring…','Сеть: восстановление…'));try{await api.recoverBroadcast();setNetwork(true,t('Network: online','Сеть: подключена'));document.getElementById('reconnectBanner')?.remove();}catch(error){setNetwork(false,t('Reconnect failed','Не удалось восстановить'));}});
  window.addEventListener('duvela:live-connection',(event)=>{const state=event.detail?.current;if(state==='CONNECTED')setNetwork(true,t('Broadcast connection: stable','Соединение эфира: стабильное'));if(state==='RECONNECTING')setNetwork(false,t('Reconnecting broadcast…','Восстановление эфира…'));if(state==='DISCONNECTED')setNetwork(false,t('Broadcast disconnected','Эфир отключён'));});

  // Tab order inside the inspector follows the reference: session → scene → production → status.
  const order = { setup: [setupSection, layoutSection, production, statusSection, multistream, byId('timelineSection')], design: [byId('cameraSection'), brandTools], materials: [privateTools, byId('linksTitle')?.closest('.studio-section')], people: [peopleSection, hostChatSection], health: [healthSection, byId('diagnosticsSection'), byId('checklistTitle')?.closest('.studio-section'), byId('detailsTitle')?.closest('.studio-section')] };
  Object.entries(order).forEach(([group, nodes]) => nodes.forEach((node) => { if (!node) return; node.dataset.studioGroup = group; side.appendChild(node); }));
  sections.forEach((section) => { if (section.dataset.studioGroup && !section.isConnected) side.appendChild(section); });
  showTab(tabs.querySelector('[data-studio-tab].active')?.dataset.studioTab||'setup');

  // ── One state tick drives chips, dock state, cards and Health from the real API.
  const QUALITY = { 1: t('Excellent', 'Отличная'), 2: t('Good', 'Хорошая'), 3: t('Fair', 'Средняя'), 4: t('Poor', 'Слабая'), 5: t('Bad', 'Плохая'), 6: t('Down', 'Нет связи') };
  const CONN = { CONNECTED: t('Connected', 'Подключено'), CONNECTING: t('Connecting…', 'Подключение…'), RECONNECTING: t('Reconnecting…', 'Переподключение…'), DISCONNECTING: t('Disconnecting…', 'Отключение…'), DISCONNECTED: t('Not connected', 'Не подключено') };
  const num = (value) => typeof value === 'number' && Number.isFinite(value);
  const bitrate = (bps) => !num(bps) ? NOT_AVAILABLE : bps >= 1e6 ? (bps / 1e6).toFixed(1) + ' Mbps' : Math.round(bps / 1000) + ' kbps';
  const percent = (value) => num(value) ? (value <= 1 ? value * 100 : value).toFixed(1) + '%' : NOT_AVAILABLE;
  let wasPublishing = false;
  function put(name, enabled, label, detail) {
    const item = topStatus.querySelector('[data-v5-status="' + name + '"]');
    if (!item) return;
    item.classList.toggle('is-off', !enabled);
    item.querySelector('b').textContent = label;
    item.querySelector('small').textContent = detail;
  }
  function tick() {
    renderAccount();
    const devices = api.getDeviceState?.() || { camera: 'unavailable', microphone: 'unavailable', broadcasting: api.isPublishing?.(), aec: false, ans: false };
    const health = api.getRtcHealth?.() || {};
    const publishing = Boolean(devices.broadcasting);
    // "LIVE" only once publish() resolved and Agora reports a connected client.
    const live = publishing && health.connectionState === 'CONNECTED';
    document.body.classList.toggle('v5-broadcasting', publishing);
    const video = camera();
    const height = num(health.videoHeight) && health.videoHeight > 0 ? health.videoHeight : (video?.videoHeight || 0);
    const resolution = height ? height + 'p' : '';
    put('camera', devices.camera !== 'unavailable', devices.camera === 'live' ? t('Camera live', 'Камера в эфире') : devices.camera === 'muted' ? t('Camera off', 'Камера выключена') : devices.camera === 'preview' ? t('Camera ready', 'Камера готова') : t('Camera', 'Камера'), devices.camera === 'unavailable' ? t('Not ready', 'Не готова') : (resolution || t('Preview', 'Предпросмотр')) + (devices.camera === 'preview' ? ' · ' + t('private preview', 'только вы') : ''));
    put('microphone', devices.microphone === 'live' || (devices.microphone === 'unavailable' && micChecked), devices.microphone === 'live' ? t('Mic live', 'Микрофон в эфире') : devices.microphone === 'muted' ? t('Mic muted', 'Микрофон выключен') : micChecked ? t('Mic checked', 'Микрофон проверен') : t('Microphone', 'Микрофон'), devices.microphone === 'unavailable' ? (micChecked ? t('Connects when LIVE starts', 'Подключится при старте эфира') : t('Not ready', 'Не готов')) : devices.microphone === 'muted' ? t('Viewers hear nothing', 'Зрители вас не слышат') : t('Publishing audio', 'Звук идёт в эфир'));
    const bars = topStatus.querySelectorAll('.v5-meter i');
    const level = devices.microphone === 'live' && num(health.micLevel) ? Math.min(1, health.micLevel * 2.2) : 0;
    bars.forEach((bar, index) => bar.classList.toggle('on', index < Math.round(level * bars.length)));
    put('broadcast', live, live ? t('LIVE', 'В ЭФИРЕ') : publishing ? CONN[health.connectionState] || t('Connecting…', 'Подключение…') : t('Not broadcasting', 'Не в эфире'), live ? t('Live output confirmed', 'Публикация подтверждена') : publishing ? t('Waiting for Agora', 'Ожидание Agora') : t('Preview only', 'Только предпросмотр'));
    topStatus.querySelector('[data-v5-status="broadcast"]').classList.toggle('is-live', live);
    byId('v5BrandLive').hidden = !live;
    const micState = byId('studioMicState'), echoState = byId('studioEcho'), noiseState = byId('studioNoise');
    if (micState) micState.textContent = t('Mic: ', 'Микрофон: ') + (devices.microphone === 'live' ? t('live', 'в эфире') : devices.microphone === 'muted' ? t('muted', 'выключен') : t('not ready', 'не готов'));
    if (echoState) echoState.textContent = 'AEC ' + (devices.aec ? t('active', 'активен') : t('inactive', 'не активен'));
    if (noiseState) noiseState.textContent = 'ANS ' + (devices.ans ? t('active', 'активен') : t('inactive', 'не активен'));
    // Dock state mirrors the hidden original buttons.
    const micButton = byId('v5Mic'), camButton = byId('v5Camera');
    micButton.setAttribute('aria-disabled', String(devices.microphone === 'unavailable'));
    micButton.setAttribute('aria-pressed', String(devices.microphone === 'live'));
    micButton.classList.toggle('is-off', devices.microphone === 'muted');
    setToolIcon(micButton, devices.microphone === 'muted' ? 'micOff' : 'mic');
    camButton.setAttribute('aria-disabled', String(devices.camera !== 'live' && devices.camera !== 'muted'));
    camButton.setAttribute('aria-pressed', String(devices.camera === 'live'));
    camButton.classList.toggle('is-off', devices.camera === 'muted');
    setToolIcon(camButton, devices.camera === 'muted' ? 'cameraOff' : 'camera');
    byId('v5Board').setAttribute('aria-pressed', String(document.body.classList.contains('scene-board')));
    byId('studioRecord').setAttribute('aria-disabled', String(!publishing && !api.isRecording()));
    byId('studioRecord').setAttribute('aria-pressed', String(api.isRecording()));
    recBadge.hidden = !api.isRecording();
    if (publishing && !wasPublishing) { api.setMicrophoneVolume(byId('studioMicVolume').value); renderSceneState(); }
    if (!publishing && wasPublishing) { const record = byId('studioRecord'); record.classList.remove('is-active'); setToolLabel(record, t('Record', 'Запись')); renderSceneState(); }
    wasPublishing = publishing;
    byId('v5ParticipantsLabel').textContent = api.getSession() ? t('viewers online', 'зрителей онлайн') : t('room not open', 'не открыта');
    cards.querySelector('.v5-timer').classList.toggle('is-live', live);
    // Agora status (Setup) and Health.
    const conn = byId('v5ConnState');
    conn.className = 'v5-conn ' + (health.connectionState === 'CONNECTED' ? 'ok' : health.connectionState === 'RECONNECTING' || health.connectionState === 'CONNECTING' ? 'warn' : '');
    conn.querySelector('span').textContent = CONN[health.connectionState] || CONN.DISCONNECTED;
    const connected = health.connectionState === 'CONNECTED';
    const quality = connected && QUALITY[health.uplinkQuality] ? QUALITY[health.uplinkQuality] : NOT_AVAILABLE;
    byId('v5StatNetwork').textContent = quality;
    byId('v5StatNetwork').dataset.quality = connected ? String(health.uplinkQuality || 0) : '0';
    byId('v5StatRtt').textContent = connected && num(health.rtt) ? Math.round(health.rtt) + ' ms' : NOT_AVAILABLE;
    byId('v5StatUp').textContent = connected ? bitrate(health.sendBitrate) : NOT_AVAILABLE;
    byId('v5StatDown').textContent = connected ? bitrate(health.recvBitrate) : NOT_AVAILABLE;
    if (tabs.querySelector('[data-studio-tab="health"]').classList.contains('active')) {
      const browserNet = navigator.connection ? [navigator.connection.effectiveType, num(navigator.connection.downlink) ? navigator.connection.downlink + ' Mbps' : ''].filter(Boolean).join(' · ') : '';
      const rows = [
        [t('Connection', 'Соединение'), CONN[health.connectionState] || CONN.DISCONNECTED],
        [t('Uplink quality', 'Качество отдачи'), connected && QUALITY[health.uplinkQuality] ? QUALITY[health.uplinkQuality] : NOT_AVAILABLE],
        [t('Downlink quality', 'Качество приёма'), connected && QUALITY[health.downlinkQuality] ? QUALITY[health.downlinkQuality] : NOT_AVAILABLE],
        [t('Round-trip time', 'Время отклика'), connected && num(health.rtt) ? Math.round(health.rtt) + ' ms' : NOT_AVAILABLE],
        [t('Send bitrate', 'Исходящий битрейт'), connected ? bitrate(health.sendBitrate) : NOT_AVAILABLE],
        [t('Receive bitrate', 'Входящий битрейт'), connected ? bitrate(health.recvBitrate) : NOT_AVAILABLE],
        [t('Video sent', 'Отправляемое видео'), connected && num(health.videoWidth) && health.videoWidth > 0 ? health.videoWidth + '×' + health.videoHeight + (num(health.videoFps) ? ' · ' + Math.round(health.videoFps) + ' fps' : '') : NOT_AVAILABLE],
        [t('Video packet loss', 'Потери видео'), connected ? percent(health.videoPacketLoss) : NOT_AVAILABLE],
        [t('Audio bitrate', 'Битрейт звука'), connected ? bitrate(health.audioBitrate) : NOT_AVAILABLE],
        [t('Audio packet loss', 'Потери звука'), connected ? percent(health.audioPacketLoss) : NOT_AVAILABLE],
        [t('Microphone level', 'Уровень микрофона'), devices.microphone === 'live' && num(health.micLevel) ? Math.round(health.micLevel * 100) + '%' : NOT_AVAILABLE],
        [t('Users in channel', 'Пользователей в канале'), connected && num(health.userCount) ? String(health.userCount) : NOT_AVAILABLE],
        [t('Browser network estimate', 'Оценка сети браузером'), browserNet || NOT_AVAILABLE]
      ];
      byId('v5HealthGrid').innerHTML = rows.map(([label, value]) => '<div><dt>' + esc(label) + '</dt><dd class="' + (value === NOT_AVAILABLE ? 'na' : '') + '">' + esc(value) + '</dd></div>').join('');
    }
  }
  studioTick = tick;
  tick();
  window.setInterval(tick, 1000);

  const endButton=document.getElementById('endLive');endButton?.addEventListener('click',(event)=>{if(!api.isPublishing())return;event.preventDefault();event.stopImmediatePropagation();const dialog=document.createElement('div');dialog.className='prelive-modal open';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('END LIVE','ЗАВЕРШЕНИЕ ЭФИРА')+'</span><h2>'+t('End the broadcast for everyone?','Завершить эфир для всех?')+'</h2><p>'+t('Type END to confirm. This stops the stream for every viewer.','Введите ЗАВЕРШИТЬ для подтверждения. Трансляция остановится у всех зрителей.')+'</p><input class="end-confirm-input" aria-label="'+t('Type END to confirm','Введите ЗАВЕРШИТЬ для подтверждения')+'" placeholder="'+t('END','ЗАВЕРШИТЬ')+'"><div class="studio-inline"><button class="btn" data-cancel>'+t('Cancel','Отмена')+'</button><button class="btn danger" data-end disabled>'+t('End LIVE','Завершить эфир')+'</button></div></div>';document.body.appendChild(dialog);const input=dialog.querySelector('input'),finish=dialog.querySelector('[data-end]');input.oninput=()=>finish.disabled=input.value.trim().toUpperCase()!==t('END','ЗАВЕРШИТЬ');dialog.querySelector('[data-cancel]').onclick=()=>{dialog.remove();endButton.focus();};dialog.addEventListener('keydown',(e)=>{if(e.key==='Escape'){dialog.remove();endButton.focus();}});finish.onclick=async()=>{finish.disabled=true;await api.endBroadcast();dialog.remove();};input.focus();},true);

  let reportShown=false,wasLive=false;
  new MutationObserver(()=>{
    const status=document.getElementById('statusText')?.textContent||'';
    if(api.isPublishing()){wasLive=true;return;}
    if(reportShown||!wasLive||!/Ended|Заверш/i.test(status))return;
    reportShown=true; const stats=api.getStats();const report=document.createElement('div');report.className='prelive-modal open';report.innerHTML='<div class="prelive-card"><span class="prelive-kicker">'+t('SESSION REPORT','ОТЧЁТ ОБ ЭФИРЕ')+'</span><h2>'+t('Broadcast completed','Эфир завершён')+'</h2><div class="studio-metrics"><div class="studio-metric"><span>'+t('Duration','Длительность')+'</span><b>'+(document.getElementById('elapsedText')?.textContent||'00:00')+'</b></div><div class="studio-metric"><span>'+t('Peak viewers','Пик зрителей')+'</span><b>'+stats.peakViewers+'</b></div><div class="studio-metric"><span>'+t('Reactions','Реакции')+'</span><b>'+stats.reactions+'</b></div><div class="studio-metric"><span>'+t('Messages','Сообщения')+'</span><b>'+stats.messages+'</b></div><div class="studio-metric"><span>'+t('Guests','Гости')+'</span><b>'+stats.guests+'</b></div></div><button class="btn primary">'+t('Close report','Закрыть отчёт')+'</button></div>';document.body.appendChild(report);report.querySelector('button').onclick=()=>report.remove();
  }).observe(document.getElementById('statusText'),{childList:true,subtree:true});
})();
