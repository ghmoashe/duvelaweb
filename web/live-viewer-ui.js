(function () {
  // Viewer V5: re-homes the existing viewer controls from live.html into the
  // V5 layout (stage + lesson card on the left, chat and room panel on the
  // right). Playback, chat, gifts and guest requests stay in live-page.js.
  const api = window.DuvelaLiveStudioApi;
  if (!api || api.isHost) return;
  const liveI18n = window.DuvelaLiveI18n || window.DuvelaAppI18n?.create({ localeCatalog: window.DUVELA_WEB_I18N, storageKeys: window.DuvelaWebConfig?.storageKeys });
  const ru = Boolean(liveI18n?.isRu) || (localStorage.getItem('duvela.web.lang') || localStorage.getItem('duvela.webLang') || navigator.language || '').toLowerCase().startsWith('ru');
  const t = liveI18n?.tr || ((en, rus) => ru ? rus : en);
  const byId = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const ICONS = {
    chat: '<path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.3-4A8 8 0 1 1 20 11.5z"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3.5-5.5-3.5-5.5-1S10 8 12 8zM12 8c1.5-3.5 5.5-3.5 5.5-1S14 8 12 8z"/>',
    hand: '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5v-6a1.5 1.5 0 0 1 3 0v6M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5a6.5 6.5 0 0 1-11.6 4L3.7 14.6a1.6 1.6 0 0 1 2.5-2L8 14.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };
  const icon = (name) => '<svg class="v5-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
  document.body.classList.add('duvela-viewer-v5');

  const topbar = document.querySelector('.topbar');
  const brand = topbar?.querySelector('.brand');
  const stage = document.querySelector('.stage');
  const side = document.querySelector('.side-card');

  // ── Top bar
  const brandName = brand?.querySelector('span');
  if (brandName) {
    const copy = document.createElement('span');
    copy.className = 'brand-copy';
    copy.innerHTML = '<span class="v5-brand-name"><span>DUVELA LIVE</span><em id="vwBrandLive" hidden>LIVE</em></span><small>' + t('Live lesson', 'Живой урок') + '</small>';
    brandName.replaceWith(copy);
  }
  const topActions = document.createElement('div');
  topActions.className = 'vw-top-actions';
  topActions.innerHTML =
    '<div class="vw-status-chip" id="vwStatusChip" role="status"><i class="v5-dot" aria-hidden="true"></i><span id="vwStatusText">' + t('Waiting', 'Ожидание') + '</span></div>' +
    '<button type="button" class="btn vw-share" id="vwShare">' + icon('share') + '<span>' + t('Share', 'Поделиться') + '</span></button>' +
    '<button type="button" class="btn primary vw-open-app" id="vwOpenApp">' + icon('phone') + '<span>' + t('Open in app', 'Открыть в приложении') + '</span></button>';
  topbar?.appendChild(topActions);

  const toast = document.createElement('div');
  toast.className = 'v5-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  let toastTimer = 0;
  function hint(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000); }
  byId('vwOpenApp').addEventListener('click', () => byId('openApp')?.click());
  byId('vwShare').addEventListener('click', async () => {
    const url = byId('shareUrl')?.value || location.href;
    try {
      if (navigator.share) { await navigator.share({ title: document.title, url }); return; }
      await navigator.clipboard.writeText(url);
      hint(t('Link copied.', 'Ссылка скопирована.'));
    } catch (error) {
      if (error?.name !== 'AbortError') hint(url);
    }
  });

  // ── Stage: teacher chip + fullscreen
  const teacherChip = document.createElement('div');
  teacherChip.className = 'vw-teacher-chip';
  teacherChip.innerHTML = '<span class="vw-avatar" id="vwStageAvatar">D</span><span><b id="vwStageTeacher">' + t('Teacher', 'Преподаватель') + '</b><small id="vwStageMeta"></small></span>';
  const stageTools = document.createElement('div');
  stageTools.className = 'v5-stage-tools vw-stage-tools';
  stageTools.innerHTML = '<button type="button" class="v5-stage-btn" id="vwFullscreen" aria-label="' + t('Full screen', 'Полный экран') + '" title="' + t('Full screen', 'Полный экран') + '">' + icon('fullscreen') + '</button>';
  stage?.append(teacherChip, stageTools);
  byId('vwFullscreen').addEventListener('click', () => byId('toggleFullscreen')?.click());
  stage?.querySelector(':scope > .reaction-dock')?.setAttribute('aria-label', t('Send a reaction', 'Отправить реакцию'));
  // live.html ships this overlay copy in English only; live-page.js never localizes it for viewers.
  const subtitle = byId('subtitle');
  if (subtitle && subtitle.textContent.trim() === 'Watch the lesson right here, or open the app to join in.') subtitle.textContent = t('Watch the lesson right here, or open the app to join in.', 'Смотрите урок прямо здесь или откройте приложение, чтобы участвовать.');

  // ── Lesson card under the stage
  const lesson = document.createElement('section');
  lesson.className = 'vw-lesson';
  lesson.setAttribute('aria-labelledby', 'vwTitle');
  lesson.innerHTML =
    '<div class="vw-lesson-head"><span class="vw-avatar vw-avatar-lg" id="vwAvatar">D</span><div class="vw-lesson-copy"><h1 id="vwTitle">' + t('Live lesson', 'Живой урок') + '</h1><p id="vwTeacher"></p><div class="vw-chips" id="vwChips"></div></div>' +
    '<div class="vw-timer"><span class="vw-timer-label">' + icon('clock') + t('On air', 'В эфире') + '</span></div></div>' +
    '<div class="vw-lesson-actions" id="vwActions"></div>';
  stage?.after(lesson);
  const timer = lesson.querySelector('.vw-timer');
  ['elapsedText', 'statusText'].forEach((id) => { const node = byId(id); if (node) timer.appendChild(node); });
  const actions = byId('vwActions');
  const follow = byId('viewerFollow');
  if (follow) actions.appendChild(follow);
  const giftButton = byId('openGift');
  if (giftButton) { giftButton.classList.add('vw-gift'); giftButton.insertAdjacentHTML('afterbegin', icon('gift')); actions.appendChild(giftButton); }
  const balance = byId('viewerBalance');
  if (balance) actions.appendChild(balance);
  const oldFooter = document.querySelector('.stage-footer');
  if (oldFooter) oldFooter.hidden = true;

  // ── Right panel: chat, stage requests, room details
  const panelHead = (iconName, title, copy) => '<div class="v5-card-head"><span class="v5-card-icon">' + icon(iconName) + '</span><div><h3>' + title + '</h3>' + (copy ? '<p>' + copy + '</p>' : '') + '</div></div>';
  const chatCard = document.createElement('section');
  chatCard.className = 'vw-card vw-chat';
  chatCard.setAttribute('aria-label', t('Live chat', 'Чат эфира'));
  chatCard.innerHTML = panelHead('chat', t('Live chat', 'Чат эфира'), t('Say hi to the teacher and the class.', 'Поздоровайтесь с преподавателем и группой.'));
  const chatShell = byId('chatShell');
  if (chatShell) { chatShell.style.display = 'grid'; chatCard.appendChild(chatShell); }
  byId('chatInput')?.setAttribute('aria-label', t('Message to the live chat', 'Сообщение в чат эфира'));
  byId('openChat')?.setAttribute('hidden', '');

  const stageCard = document.createElement('section');
  stageCard.className = 'vw-card vw-join';
  stageCard.innerHTML = panelHead('hand', t('Join on stage', 'Выйти в эфир'), t('Ask the teacher to bring you on camera.', 'Попросите преподавателя пригласить вас в кадр.'));
  ['viewerGuestRequestBox', 'viewerGuestRequestStatus'].forEach((id) => { const node = byId(id); if (node) stageCard.appendChild(node); });

  const details = document.createElement('details');
  details.className = 'vw-card vw-details';
  details.innerHTML = '<summary>' + icon('info') + '<span>' + t('Room details and help', 'О комнате и помощь') + '</span></summary><div class="vw-details-body"></div>';
  const detailsBody = details.querySelector('.vw-details-body');
  [byId('detailsTitle'), byId('linksTitle'), byId('checklistTitle'), byId('diagnosticsTitle')].forEach((node) => { const section = node?.closest('.studio-section'); if (section) detailsBody.appendChild(section); });

  const note = byId('note');
  side.prepend(chatCard);
  if (note) chatCard.before(note);
  chatCard.after(stageCard);
  stageCard.after(details);

  // ── State tick: everything below reads live-page.js state, nothing is invented.
  function initials(name) { return String(name || 'D').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || 'D'; }
  function setAvatar(node, url, name) {
    if (!node) return;
    if (url) { if (node.dataset.url !== url) { node.dataset.url = url; node.textContent = ''; const img = document.createElement('img'); img.alt = ''; img.src = url; node.appendChild(img); } }
    else if (!node.dataset.url) node.textContent = initials(name);
  }
  function tick() {
    const session = api.getSession() || {};
    const statusNode = byId('statusText');
    const live = Boolean(statusNode?.classList.contains('live'));
    const statusText = statusNode?.textContent || t('Waiting', 'Ожидание');
    byId('vwStatusText').textContent = statusText;
    byId('vwStatusChip').classList.toggle('is-live', live);
    byId('vwBrandLive').hidden = !live;
    document.body.classList.toggle('vw-live', live);
    const name = session.teacher_name || new URLSearchParams(location.search).get('t') || t('Teacher', 'Преподаватель');
    byId('vwStageTeacher').textContent = name;
    byId('vwTeacher').textContent = name;
    const topic = session.topic || '';
    byId('vwTitle').textContent = topic || byId('title')?.textContent || t('Live lesson', 'Живой урок');
    setAvatar(byId('vwAvatar'), session.teacher_avatar_url, name);
    setAvatar(byId('vwStageAvatar'), session.teacher_avatar_url, name);
    const chips = [session.level, session.language, session.id ? (session.is_private ? t('Private', 'Закрытый') : t('Public', 'Открытый')) : '', session.min_viewer_age === 18 ? '18+' : ''].filter(Boolean);
    const chipHtml = chips.map((chip) => '<span>' + esc(String(chip).replace('-', '–')) + '</span>').join('');
    if (byId('vwChips').innerHTML !== chipHtml) byId('vwChips').innerHTML = chipHtml;
    byId('vwStageMeta').textContent = live ? t('LIVE now', 'Сейчас в эфире') : statusText;
    lesson.classList.toggle('is-live', live);
    const requestBox = byId('viewerGuestRequestBox');
    stageCard.hidden = !requestBox || requestBox.style.display === 'none';
    const input = byId('chatInput');
    if (input) input.placeholder = input.disabled ? t('Chat opens when you join the lesson', 'Чат откроется, когда вы войдёте в урок') : t('Write to the teacher…', 'Напишите преподавателю…');
  }
  tick();
  setInterval(tick, 1000);
})();
