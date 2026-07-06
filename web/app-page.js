(function () {
  const config = window.DuvelaWebConfig;
  const rolesApi = window.DuvelaWebRoles;
  const uiApi = window.DuvelaWebUi;
  const storeApi = window.DuvelaAppStore;
  const routerApi = window.DuvelaAppRouter;
  const bootstrapApi = window.DuvelaAppBootstrap;
  const roleAccessApi = window.DuvelaAppRoleAccess;
  const staticUiApi = window.DuvelaAppStaticUi;
  const publicDataApi = window.DuvelaAppPublicData;
  const ROLE_KEY = config.storageKeys.role;
  const LANG_KEY = config.storageKeys.lang;
  const supa = config.createSupabaseClient();
  const alert = (message) => uiApi.legacyAlert(message);

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const params = new URLSearchParams(window.location.search);
  const hasPinnedWebRole = Boolean(params.get('role') || localStorage.getItem(ROLE_KEY));
  const appLang = (localStorage.getItem(LANG_KEY) || navigator.language || 'en').toLowerCase();
  const isRu = appLang.startsWith('ru');
  const tr = (en, ru) => (isRu ? ru : en);
  let selectedRole = params.get('role') || localStorage.getItem(ROLE_KEY) || 'learner';
  let role = 'learner';
  let user = null;
  let profile = null;
  let requestedBusinessRole = null;

  const roleLabels = {
    learner: tr('Learner', 'РЈС‡РµРЅРёРє'),
    teacher: tr('Teacher', 'РЈС‡РёС‚РµР»СЊ'),
    organizer: tr('Organizer', 'РћСЂРіР°РЅРёР·Р°С‚РѕСЂ'),
    organization: tr('Organization', 'РћСЂРіР°РЅРёР·Р°С†РёСЏ'),
    admin: tr('Administrator', 'РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ')
  };
  const sessionState = {
    get selectedRole() { return selectedRole; },
    set selectedRole(value) { selectedRole = value; },
    get role() { return role; },
    set role(value) { role = value; },
    get user() { return user; },
    set user(value) { user = value; },
    get profile() { return profile; },
    set profile(value) { profile = value; },
    get requestedBusinessRole() { return requestedBusinessRole; },
    set requestedBusinessRole(value) { requestedBusinessRole = value; }
  };
  const businessRoles = rolesApi.businessRoles;
  const roleAccessFeature = roleAccessApi.create({
    $,
    $$,
    tr,
    esc,
    alert,
    supa,
    rolesApi,
    businessRoles,
    roleLabels,
    hasPinnedRole: hasPinnedWebRole,
    session: sessionState
  });
  const staticUiFeature = staticUiApi.create({ $, $$, tr, isRu, roleLabels });
  function formatDate(value) {
    return new Date(value).toLocaleDateString(isRu ? 'ru-RU' : 'en-US');
  }
  const publicDataFeature = publicDataApi.create({ supa, state, tr, formatDate });
  function isApprovedForRole(targetRole, currentProfile) {
    return roleAccessFeature.isApprovedForRole(targetRole, currentProfile);
  }
  function fallbackApprovedRole(currentProfile) {
    return roleAccessFeature.fallbackApprovedRole(currentProfile);
  }
  function normalizeRole(targetRole) {
    return roleAccessFeature.normalizeRole(targetRole);
  }
  function syncRoleOptions() {
    return roleAccessFeature.syncRoleOptions();
  }
  async function submitRoleRequest(targetRole) {
    return roleAccessFeature.submitRoleRequest(targetRole);
  }
  function renderAccessNotice() {
    return roleAccessFeature.renderAccessNotice();
  }
  const navLabels = {
    hub: {
      home: tr('Home', 'Р“Р»Р°РІРЅР°СЏ'),
      videos: tr('Videos', 'Р’РёРґРµРѕ'),
      live: tr('Live', 'Р­С„РёСЂС‹'),
      courses: tr('Courses', 'РљСѓСЂСЃС‹'),
      events: tr('Events', 'РЎРѕР±С‹С‚РёСЏ'),
      messages: tr('Messages', 'РЎРѕРѕР±С‰РµРЅРёСЏ'),
      workspace: tr('Practice', 'РџСЂР°РєС‚РёРєР°'),
      schedule: tr('Schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ'),
      profile: tr('Profile', 'РџСЂРѕС„РёР»СЊ')
    },
    bus: {
      home: tr('Dashboard', 'РџР°РЅРµР»СЊ'),
      videos: tr('Media', 'РњРµРґРёР°'),
      live: tr('Live Studio', 'Live Studio'),
      courses: tr('Courses', 'РљСѓСЂСЃС‹'),
      events: tr('Events', 'РЎРѕР±С‹С‚РёСЏ'),
      messages: tr('Messages', 'РЎРѕРѕР±С‰РµРЅРёСЏ'),
      workspace: tr('Workspace', 'Р Р°Р±РѕС‡Р°СЏ Р·РѕРЅР°'),
      schedule: tr('Schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ'),
      profile: tr('Profile', 'РџСЂРѕС„РёР»СЊ')
    }
  };
  const titles = {
    hub: {
      home: [tr('Hub dashboard', 'РџР°РЅРµР»СЊ Hub'), tr('Your learning feed, live lessons and practice tools are ready.', 'Р›РµРЅС‚Р° РѕР±СѓС‡РµРЅРёСЏ, СЌС„РёСЂС‹ Рё РїСЂР°РєС‚РёРєР° РіРѕС‚РѕРІС‹.')],
      videos: [tr('Videos', 'Р’РёРґРµРѕ'), tr('Short lessons matched to your level.', 'РљРѕСЂРѕС‚РєРёРµ СѓСЂРѕРєРё РїРѕРґ РІР°С€ СѓСЂРѕРІРµРЅСЊ.')],
      live: [tr('Live', 'Р­С„РёСЂС‹'), tr('Join active lessons with teachers.', 'РџРѕРґРєР»СЋС‡Р°Р№С‚РµСЃСЊ Рє Р°РєС‚РёРІРЅС‹Рј СѓСЂРѕРєР°Рј СЃ СѓС‡РёС‚РµР»СЏРјРё.')],
      courses: [tr('Courses', 'РљСѓСЂСЃС‹'), tr('Structured programs from teachers.', 'РЎС‚СЂСѓРєС‚СѓСЂРёСЂРѕРІР°РЅРЅС‹Рµ РїСЂРѕРіСЂР°РјРјС‹ РѕС‚ РїСЂРµРїРѕРґР°РІР°С‚РµР»РµР№.')],
      events: [tr('Events', 'РЎРѕР±С‹С‚РёСЏ'), tr('Meetups, workshops and speaking practice.', 'Р’СЃС‚СЂРµС‡Рё, РІРѕСЂРєС€РѕРїС‹ Рё speaking practice.')],
      messages: [tr('Messages', 'РЎРѕРѕР±С‰РµРЅРёСЏ'), tr('Recent conversations and lesson updates.', 'РџРѕСЃР»РµРґРЅРёРµ РґРёР°Р»РѕРіРё Рё РѕР±РЅРѕРІР»РµРЅРёСЏ СѓСЂРѕРєРѕРІ.')],
      workspace: [tr('Practice', 'РџСЂР°РєС‚РёРєР°'), tr('Daily tools for level, speaking and vocabulary work.', 'Р•Р¶РµРґРЅРµРІРЅС‹Рµ РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹ РґР»СЏ СѓСЂРѕРІРЅСЏ, speaking Рё vocabulary.')],
      schedule: [tr('Schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ'), tr('Book a lesson with a teacher and see your bookings.', 'Р—Р°Р±СЂРѕРЅРёСЂСѓР№С‚Рµ СѓСЂРѕРє Сѓ РїСЂРµРїРѕРґР°РІР°С‚РµР»СЏ Рё СЃРјРѕС‚СЂРёС‚Рµ СЃРІРѕРё Р·Р°РїРёСЃРё.')],
      profile: [tr('Profile', 'РџСЂРѕС„РёР»СЊ'), tr('Your Duvela account and public profile.', 'Р’Р°С€ Р°РєРєР°СѓРЅС‚ Duvela Рё РїСѓР±Р»РёС‡РЅС‹Р№ РїСЂРѕС„РёР»СЊ.')]
    },
    bus: {
      home: [tr('Bus dashboard', 'РџР°РЅРµР»СЊ Bus'), tr('Your web workspace for live lessons, courses and community activity.', 'Р’РµР±-РєР°Р±РёРЅРµС‚ РґР»СЏ СЌС„РёСЂРѕРІ, РєСѓСЂСЃРѕРІ Рё СЂР°Р±РѕС‚С‹ СЃ Р°СѓРґРёС‚РѕСЂРёРµР№.')],
      videos: [tr('Media library', 'РњРµРґРёР°С‚РµРєР°'), tr('Prepare short lessons and public previews for learners.', 'Р“РѕС‚РѕРІСЊС‚Рµ РєРѕСЂРѕС‚РєРёРµ СѓСЂРѕРєРё Рё РїСѓР±Р»РёС‡РЅС‹Рµ РїСЂРµРІСЊСЋ РґР»СЏ СѓС‡РµРЅРёРєРѕРІ.')],
      live: [tr('Live Studio', 'Live Studio'), tr('Open active lessons and manage public live rooms.', 'Р—Р°РїСѓСЃРєР°Р№С‚Рµ СѓСЂРѕРєРё Рё СѓРїСЂР°РІР»СЏР№С‚Рµ РїСѓР±Р»РёС‡РЅС‹РјРё live-РєРѕРјРЅР°С‚Р°РјРё.')],
      courses: [tr('Courses', 'РљСѓСЂСЃС‹'), tr('Structure offers, cohorts and paid learning programs.', 'РЎРѕР±РёСЂР°Р№С‚Рµ РѕС„С„РµСЂС‹, РїРѕС‚РѕРєРё Рё РїР»Р°С‚РЅС‹Рµ РїСЂРѕРіСЂР°РјРјС‹ РѕР±СѓС‡РµРЅРёСЏ.')],
      events: [tr('Events', 'РЎРѕР±С‹С‚РёСЏ'), tr('Plan workshops, meetups and online sessions.', 'РџР»Р°РЅРёСЂСѓР№С‚Рµ РІРѕСЂРєС€РѕРїС‹, РјРёС‚Р°РїС‹ Рё РѕРЅР»Р°Р№РЅ-СЃРµСЃСЃРёРё.')],
      messages: [tr('Messages', 'РЎРѕРѕР±С‰РµРЅРёСЏ'), tr('Learner conversations and recent platform updates.', 'Р”РёР°Р»РѕРіРё СЃ СѓС‡РµРЅРёРєР°РјРё Рё РѕР±РЅРѕРІР»РµРЅРёСЏ РїР»Р°С‚С„РѕСЂРјС‹.')],
      workspace: [tr('Workspace', 'Р Р°Р±РѕС‡Р°СЏ Р·РѕРЅР°'), tr('Creator tools for publishing and planning.', 'РРЅСЃС‚СЂСѓРјРµРЅС‚С‹ РїСѓР±Р»РёРєР°С†РёРё Рё РїР»Р°РЅРёСЂРѕРІР°РЅРёСЏ.')],
      schedule: [tr('Schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ'), tr('Open lesson slots for learners and see who booked.', 'РћС‚РєСЂС‹РІР°Р№С‚Рµ СЃР»РѕС‚С‹ РґР»СЏ СѓС‡РµРЅРёРєРѕРІ Рё СЃРјРѕС‚СЂРёС‚Рµ Р·Р°РїРёСЃРё.')],
      profile: [tr('Profile', 'РџСЂРѕС„РёР»СЊ'), tr('Your Duvela Business account and public profile.', 'Р’Р°С€ Р°РєРєР°СѓРЅС‚ Duvela Business Рё РїСѓР±Р»РёС‡РЅС‹Р№ РїСЂРѕС„РёР»СЊ.')]
    }
  };

  const fallbackVideos = [
    { title: 'German Stories - Weg 2', meta: 'German - A2-B1 - Berlin', level: 'A2-B1', type: 'language', tone: 'blue' },
    { title: 'English Speaking Club', meta: 'English - B1-B2 - London', level: 'B1-B2', type: 'language', tone: 'teal' },
    { title: 'Sketching Basics', meta: 'Drawing - beginner - studio', level: 'Art', type: 'arts', tone: 'amber' },
    { title: 'Math Made Easy - Chapter 3', meta: 'School - algebra - online', level: 'Math', type: 'school', tone: 'teal' },
    { title: 'Spanish for Travel', meta: 'Spanish - A2 - Madrid', level: 'A2', type: 'language', tone: 'red' },
    { title: 'French in 5 Minutes', meta: 'French - A1-A2 - Paris', level: 'A1-A2', type: 'language', tone: 'blue' }
  ];
  const fallbackLive = [
    { id: '', teacher_name: 'Maria Hoffmann', title: 'German small talk - B1', status: 'live' },
    { id: '', teacher_name: 'James Carter', title: 'IELTS speaking - B2-C1', status: 'live' },
    { id: '', teacher_name: 'Sofia Reyes', title: 'Spanish for travel - A2', status: 'live' }
  ];
  const fallbackCourses = [
    { title: 'German Conversation Sprint', description: '14 days of guided speaking practice.', level: 'B1', price: '29 EUR' },
    { title: 'Watercolor Foundations', description: 'Composition, color and weekly feedback.', level: 'Art', price: 'Free' },
    { title: 'IELTS Speaking Masterclass', description: 'Exam answers, fluency drills and mock tests.', level: 'B2-C1', price: '49 EUR' }
  ];
  const fallbackEvents = [
    { title: 'Berlin German Meetup', meta: 'Friday - online and in person', price: 'Free' },
    { title: 'Spanish Travel Club', meta: 'Saturday - online', price: '8 EUR' },
    { title: 'Drawing Weekend Lab', meta: 'Sunday - workshop', price: '15 EUR' }
  ];
  const fallbackMessages = [
    { title: 'Maria Hoffmann', meta: 'Your B1 live lesson starts today at 18:00.', tag: 'Lesson' },
    { title: 'Duvela', meta: 'You are 20 XP away from the daily goal.', tag: 'Goal' },
    { title: 'Sofia Reyes', meta: 'New travel phrases video is ready for you.', tag: 'Video' }
  ];
  const fallbackBusinessMessages = [
    { title: 'New learner request', meta: 'A learner asked about your next B1 speaking lesson.', tag: 'Lead' },
    { title: 'Live reminder', meta: 'Check title, level and access before the next public room.', tag: 'Live' },
    { title: 'Duvela Business', meta: 'Course and event tools are available in this web workspace.', tag: 'Bus' }
  ];

  const appStore = storeApi.create({
    fallbackVideos,
    fallbackLive,
    fallbackCourses,
    fallbackEvents,
    fallbackMessages
  });
  const state = appStore.state;
  const runtime = appStore.runtime;

  function esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }
  function initials(name) {
    return (name || 'D').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }
  function avatarHtml(target, name, url) {
    const node = $(target);
    if (!node) return;
    node.innerHTML = url ? '<img src="' + esc(url) + '" alt="">' : esc(initials(name));
  }
  function avatarInner(name, url) {
    return url ? '<img src="' + esc(url) + '" alt="">' : esc(initials(name));
  }
  function formatMoney(item) {
    if (item.is_free) return tr('Free', 'Р‘РµСЃРїР»Р°С‚РЅРѕ');
    if (item.price == null || item.price === '') return item.priceLabel || tr('Open', 'РћС‚РєСЂС‹С‚Рѕ');
    return [item.price, item.currency].filter(Boolean).join(' ');
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - Date.parse(iso);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return tr('just now', 'С‚РѕР»СЊРєРѕ С‡С‚Рѕ');
    if (minutes < 60) return minutes + tr('m', ' РјРёРЅ');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + tr('h', ' С‡');
    return Math.floor(hours / 24) + tr('d', ' РґРЅ');
  }
  function staticSessionCount(count) {
    return count + ' ' + tr('sessions', 'СЌС„РёСЂРѕРІ');
  }
  function liveUrl(item) {
    return './live.html' + (item.id ? '?s=' + encodeURIComponent(item.id) + '&t=' + encodeURIComponent(item.teacher_name || '') : '');
  }
  function teacherLiveUrl(item) {
    const query = new URLSearchParams({ app: 'business', mode: 'host' });
    if (item?.id) query.set('s', item.id);
    if (item?.teacher_name) query.set('t', item.teacher_name);
    return './live.html?' + query.toString();
  }
  function isBusiness() {
    return businessRoles.has(role);
  }
  function modeKey() {
    return isBusiness() ? 'bus' : 'hub';
  }
  function localizeStaticUI() { return staticUiFeature.localizeStaticUI(); }
  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }
  function setMetric(index, label, value, help) {
    const metric = $$('.metric')[index];
    if (!metric) return;
    metric.querySelector('span').textContent = label;
    metric.querySelector('b').textContent = value;
    metric.querySelector('p').textContent = help;
  }
  const appRouter = routerApi.create({ $, $$, tr, navLabels, titles, modeKey, setText });
  function updateShellCopy() { return appRouter.syncShell(); }
  function setView(view) { return appRouter.setView(view); }
  function row(item, actionHtml) {
    const level = item.level ? '<span class="tag">' + esc(item.level) + '</span>' : '';
    return '<div class="card row">' +
      '<div class="thumb">' + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : esc((item.title || item.teacher_name || 'D').charAt(0))) + '</div>' +
      '<div><h3>' + esc(item.title || item.teacher_name || 'Untitled') + '</h3><p>' + esc(item.meta || item.description || '') + '</p></div>' +
      (actionHtml || level) +
      '</div>';
  }
  async function openEventDetail(id) { return catalogFeature.openEventDetail(id); }
  async function toggleRsvp(eventId) { return catalogFeature.toggleRsvp(eventId); }
  async function openCourseDetail(courseId) { runtime.currentCourseId = courseId; return catalogFeature.openCourseDetail(courseId); }
  async function addLesson(courseId) { return catalogFeature.addLesson(courseId); }
  async function addTask(lessonId) { return catalogFeature.addTask(lessonId); }
  async function submitTask(taskId, lessonId) { return catalogFeature.submitTask(taskId, lessonId); }
  async function gradeSubmission(subId, max) { return catalogFeature.gradeSubmission(subId, max); }
  async function confirmEnrollment(enrollId) { return catalogFeature.confirmEnrollment(enrollId); }
  function openCertificate(courseId) { return catalogFeature.openCertificate(courseId); }
  function renderHome() { return catalogFeature.renderHome(); }
  function renderLive() { return catalogFeature.renderLive(); }
  function renderCourses() { return catalogFeature.renderCourses(); }
  function renderEvents() { return catalogFeature.renderEvents(); }
  async function publishEvent(event) { return businessFeature.publishEvent(event); }
  async function loadEnrollments() { return catalogFeature.loadEnrollments(); }
  async function enrollCourse(courseId) { return catalogFeature.enrollCourse(courseId); }
  async function unenrollCourse(courseId) { return catalogFeature.unenrollCourse(courseId); }
  function createFeatureContext() {
    return {
      $, $$, tr, esc, alert, supa, state,
      runtime,
      formatDate, formatMoney, avatarHtml, avatarInner, timeAgo,
      isRu,
      get user() { return user; },
      get profile() { return profile; },
      get role() { return role; },
      setProfile(nextProfile) { profile = nextProfile; },
      isBusiness,
      roleLabels,
      liveUrl,
      teacherLiveUrl,
      row,
      setMetric,
      staticSessionCount,
      walletHtml,
      renderHome,
      renderLive,
      renderCourses,
      renderEvents,
      renderMessages,
      renderWorkspace,
      renderSchedule,
      renderBusinessWorkspace,
      loadPublicData,
      loadBusinessWorkspace,
      loadPractices,
      loadConversations,
      uploadToBucket,
      safeQuery,
      mapEventRow,
      getEventColumns,
      publishEvent,
      practicesHtml,
      challengesHtml,
      openPracticeBuilder,
      openChallengeCreate,
      openClassManage,
      openCourseDetail,
      openEventDetail,
      openPractice,
      openChess,
      openDuel,
      startChatWith
    };
  }
  const featureContext = createFeatureContext();
  const mediaFeature = window.DuvelaAppMedia.create(featureContext);
  const practiceBuilderFeature = window.DuvelaAppPracticeBuilder.create(featureContext);
  const profileFeature = window.DuvelaAppProfile.create(featureContext);
  const workspaceShellFeature = window.DuvelaAppWorkspaceShell.create(featureContext);
  const catalogFeature = window.DuvelaAppCatalog.create(featureContext);
  const messagingFeature = window.DuvelaAppMessages.create(featureContext);
  const notificationsFeature = window.DuvelaAppNotifications.create(featureContext);
  const practiceFeature = window.DuvelaAppPractice.create(featureContext);
  const gamesFeature = window.DuvelaAppGames.create(featureContext);
  const businessFeature = window.DuvelaAppBusiness.create(featureContext);
  const classesFeature = window.DuvelaAppClasses.create(featureContext);
  const scheduleFeature = window.DuvelaAppSchedule.create(featureContext);
  const gamificationFeature = window.DuvelaAppGamification.create(featureContext);
  const searchFeature = window.DuvelaAppSearch.create(featureContext);

  function renderVideos() { return mediaFeature.renderVideos(); }
  async function loadVideos() { return mediaFeature.loadVideos(); }
  function openVideo(id) { return mediaFeature.openVideo(id); }
  function closeVideo() { return mediaFeature.closeVideo(); }
  async function toggleLike(postId) { return mediaFeature.toggleLike(postId); }
  function openUpload() { return mediaFeature.openUpload(); }
  async function uploadPost(event) { return mediaFeature.uploadPost(event); }

  function openPracticeBuilder() { return practiceBuilderFeature.openPracticeBuilder(); }
  function addBuilderItem() { return practiceBuilderFeature.addBuilderItem(); }
  async function submitPractice() { return practiceBuilderFeature.submitPractice(); }

  function renderProfile() { return profileFeature.renderProfile(); }
  async function saveProfile(event) { return profileFeature.saveProfile(event); }
  async function deletePortfolioItem(id) { return profileFeature.deletePortfolioItem(id); }
  async function renderProgressCard() { return profileFeature.renderProgressCard(); }

  function renderMessages() { return messagingFeature.renderMessages(); }
  async function loadConversations() { return messagingFeature.loadConversations(); }
  function openConversation(id) { return messagingFeature.openConversation(id); }
  function startChatWith(id) { return messagingFeature.startChatWith(id); }
  function toggleGroupPerson(id) { return messagingFeature.toggleGroupPerson(id); }
  function isGroupChatMode() { return messagingFeature.isGroupMode(); }

  async function loadNotifications() { return notificationsFeature.loadNotifications(); }
  function renderNotifBadge() { return notificationsFeature.renderNotifBadge(); }
  function subscribeNotifications() { return notificationsFeature.subscribeNotifications(); }

  async function loadPractices() { return practiceFeature.loadPractices(); }
  function practicesHtml() { return practiceFeature.practicesHtml(); }
  function openPractice(id) { return practiceFeature.openPractice(id); }

  async function loadSchedule() { return scheduleFeature.loadSchedule(); }
  function renderSchedule() { return scheduleFeature.renderSchedule(); }
  async function openTeacherSlots(teacherId) { return scheduleFeature.openTeacherSlots(teacherId); }
  async function bookSlot(slotId) { return scheduleFeature.bookSlot(slotId); }
  async function cancelBooking(slotId) { return scheduleFeature.cancelBooking(slotId); }

  async function loadBusinessWorkspace() { return businessFeature.loadBusinessWorkspace(); }
  async function removeMember(id) { return businessFeature.removeMember(id); }
  function renderBusinessWorkspace() { return businessFeature.renderBusinessWorkspace(); }

  async function loadWallet() { return gamificationFeature.loadWallet(); }
  function walletHtml() { return gamificationFeature.walletHtml(); }
  async function loadChallenges() { return gamificationFeature.loadChallenges(); }
  function challengesHtml() { return gamificationFeature.challengesHtml(); }
  async function openChallenge(id) { return gamificationFeature.openChallenge(id); }
  async function joinChallenge(id) { return gamificationFeature.joinChallenge(id); }
  async function saveChallengeProgress(id) { return gamificationFeature.saveChallengeProgress(id); }
  function openChallengeCreate() { return gamificationFeature.openChallengeCreate(); }

  function renderWorkspace() { return workspaceShellFeature.renderWorkspace(); }

  function clearClassSessionSelection() { return classesFeature.clearSelectedSession(); }
  function selectClassSession(sessionId) { return classesFeature.selectSession(sessionId); }
  async function openClassManage(classId) { return classesFeature.openClassManage(classId); }
  async function addClassStudent(clientId) { return classesFeature.addClassStudent(clientId); }
  async function createClassSession() { return classesFeature.createClassSession(); }
  async function markAttendance(clientId, status) { return classesFeature.markAttendance(clientId, status); }

  function openSearch() { return searchFeature.openSearch(); }

  function openChess() { return gamesFeature.openChess(); }
  function closeChess() { return gamesFeature.closeChess(); }
  function openDuel() { return gamesFeature.openDuel(); }
  function closeDuel() { return gamesFeature.closeDuel(); }
  function renderAll() {
    updateShellCopy();
    renderAccessNotice();
    syncRoleOptions();
    renderProfile();
    renderHome();
    renderVideos();
    renderLive();
    renderCourses();
    renderEvents();
    renderMessages();
    renderWorkspace();
    renderSchedule();
    renderNotifBadge();
  }
  async function safeQuery(label, query, map) { return publicDataFeature.safeQuery(label, query, map); }
  function loadProfile() { return roleAccessFeature.loadProfile(); }
  async function uploadToBucket(bucket, file) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = user.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const { error } = await supa.storage.from(bucket).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (error) throw error;
    return supa.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  function getEventColumns() { return publicDataFeature.getEventColumns(); }
  function mapEventRow(item) { return publicDataFeature.mapEventRow(item); }
  function loadPublicData() { return publicDataFeature.loadPublicData(); }
  const appBootstrap = bootstrapApi.create({
    $, $$, tr, supa, businessRoles, runtime,
    session: sessionState,
    storage: { roleKey: ROLE_KEY, langKey: LANG_KEY },
    searchFeature,
    notificationsFeature,
    practiceFeature,
    gamesFeature,
    messagingFeature,
    addBuilderItem,
    addClassStudent,
    addLesson,
    addTask,
    bookSlot,
    cancelBooking,
    clearClassSessionSelection,
    closeChess,
    closeDuel,
    closeVideo,
    confirmEnrollment,
    createClassSession,
    deletePortfolioItem,
    enrollCourse,
    fallbackApprovedRole,
    gradeSubmission,
    isApprovedForRole,
    isBusiness,
    isGroupChatMode,
    joinChallenge,
    loadBusinessWorkspace,
    loadChallenges,
    loadConversations,
    loadEnrollments,
    loadNotifications,
    loadPractices,
    loadProfile,
    loadPublicData,
    loadSchedule,
    loadVideos,
    loadWallet,
    localizeStaticUI,
    markAttendance,
    normalizeRole,
    openChallenge,
    openClassManage,
    openCertificate,
    openConversation,
    openCourseDetail,
    openEventDetail,
    openPractice,
    openTeacherSlots,
    openVideo,
    openUpload,
    publishEvent,
    removeMember,
    renderAll,
    renderCourses,
    renderEvents,
    renderHome,
    renderLive,
    renderSchedule,
    renderVideos,
    renderWorkspace,
    saveChallengeProgress,
    saveProfile,
    selectClassSession,
    setView,
    startChatWith,
    submitPractice,
    submitRoleRequest,
    submitTask,
    subscribeNotifications,
    syncRoleOptions,
    toggleGroupPerson,
    toggleLike,
    toggleRsvp,
    unenrollCourse,
    uploadPost
  });
  appBootstrap.start();
})();



