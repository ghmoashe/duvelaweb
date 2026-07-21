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
  const profileWritesApi = window.DuvelaWebProfileWrites;
  const localeCatalog = window.DUVELA_WEB_I18N;
  const ROLE_KEY = config.storageKeys.role;
  const LANG_KEY = config.storageKeys.lang;
  const supa = config.createSupabaseClient();
  const alert = (message) => uiApi.legacyAlert(message);

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const params = new URLSearchParams(window.location.search);
  const hasPinnedWebRole = Boolean(params.get('role') || localStorage.getItem(ROLE_KEY));
  const supportedLocales = Array.isArray(localeCatalog?.locales) && localeCatalog.locales.length
    ? localeCatalog.locales.map((locale) => ({
        code: String(locale.code || '').toLowerCase(),
        name: locale.name || String(locale.code || '').toUpperCase(),
        dir: locale.dir || 'ltr'
      })).filter((locale) => locale.code)
    : [
        { code: 'en', name: 'English', dir: 'ltr' },
        { code: 'ru', name: 'Русский', dir: 'ltr' }
      ];
  function resolveAppLang(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'en';
    if (supportedLocales.some((locale) => locale.code === raw)) return raw;
    const base = raw.split('-')[0];
    if (supportedLocales.some((locale) => locale.code === base)) return base;
    return 'en';
  }
  const appLang = resolveAppLang(localStorage.getItem(LANG_KEY) || navigator.language || 'en');
  const isRu = appLang.startsWith('ru');
  const tr = (en, ru) => (isRu ? ru : en);
  let selectedRole = params.get('role') || localStorage.getItem(ROLE_KEY) || 'learner';
  let role = 'learner';
  let user = null;
  let profile = null;
  let requestedBusinessRole = null;

  const roleLabels = {
    learner: tr('Learner', 'Ученик'),
    teacher: tr('Teacher', 'Учитель'),
    organizer: tr('Organizer', 'Организатор'),
    organization: tr('Organization', 'Организация'),
    admin: tr('Administrator', 'Администратор')
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
    profileWritesApi,
    businessRoles,
    roleLabels,
    hasPinnedRole: hasPinnedWebRole,
    session: sessionState
  });
  const staticUiFeature = staticUiApi.create({ $, $$, tr, isRu, roleLabels, appLang, supportedLocales });
  function formatDate(value) {
    return new Date(value).toLocaleDateString(isRu ? 'ru-RU' : 'en-US');
  }
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
  function renderAccessNotice() {
    return roleAccessFeature.renderAccessNotice();
  }
  const navLabels = {
    hub: {
      home: tr('Home', 'Главная'),
      videos: tr('Media', 'Медиа'),
      live: tr('Live', 'Эфиры'),
      courses: tr('Courses', 'Курсы'),
      events: tr('Events', 'События'),
      messages: tr('Messages', 'Сообщения'),
      workspace: tr('Practice', 'Практика'),
      schedule: tr('Schedule', 'Расписание'),
      profile: tr('Profile', 'Профиль')
    },
    bus: {
      home: tr('Dashboard', 'Dashboard'),
      management: tr('Management', 'Management'),
      videos: tr('Media', 'Медиа'),
      live: tr('Live Studio', 'LIVE-студия'),
      courses: tr('Courses', 'Курсы'),
      events: tr('Events', 'События'),
      messages: tr('Messages', 'Сообщения'),
      workspace: tr('Workspace', 'Рабочая зона'),
      schedule: tr('Schedule', 'Расписание'),
      profile: tr('Profile', 'Профиль')
    }
  };
  const titles = {
    hub: {
      home: [tr('Hub dashboard', 'Панель Hub'), tr('Your learning feed, live lessons and practice tools are ready.', 'Лента обучения, эфиры и практика готовы.')],
      videos: [tr('Media', 'Медиа'), tr('Short lessons matched to your level.', 'Короткие уроки под ваш уровень.')],
      live: [tr('Live', 'Эфиры'), tr('Join active lessons with teachers.', 'Подключайтесь к активным урокам с учителями.')],
      courses: [tr('Courses', 'Курсы'), tr('Structured programs from teachers.', 'Структурированные программы от преподавателей.')],
      events: [tr('Events', 'События'), tr('Meetups, workshops and speaking practice.', 'Встречи, воркшопы и speaking practice.')],
      messages: [tr('Messages', 'Сообщения'), tr('Recent conversations and lesson updates.', 'Последние диалоги и обновления уроков.')],
      workspace: [tr('Practice', 'Практика'), tr('Daily tools for level, speaking and vocabulary work.', 'Ежедневные инструменты для уровня, speaking и vocabulary.')],
      schedule: [tr('Schedule', 'Расписание'), tr('Book a lesson with a teacher and see your bookings.', 'Забронируйте урок у преподавателя и смотрите свои записи.')],
      profile: [tr('Profile', 'Профиль'), tr('Your Duvela account and public profile.', 'Ваш аккаунт Duvela и публичный профиль.')]
    },
    bus: {
      home: [tr('Dashboard', 'Dashboard'), tr('Your web workspace for live lessons, courses and community activity.', 'Веб-кабинет для эфиров, курсов и работы с аудиторией.')],
      management: [tr('Management', 'Management'), tr('Events, courses, live and challenges in one place.', 'События, курсы, эфиры и челленджи в одном месте.')],
      videos: [tr('Media library', 'Медиатека'), tr('Prepare short lessons and public previews for learners.', 'Готовьте короткие уроки и публичные превью для учеников.')],
      live: [tr('Live Studio', 'Live Studio'), tr('Open active lessons and manage public live rooms.', 'Запускайте уроки, держите расписание под рукой и переиспользуйте недавние комнаты.')],
      courses: [tr('Courses', 'Курсы'), tr('Structure offers, cohorts and paid learning programs.', 'Собирайте офферы, потоки и платные программы обучения.')],
      events: [tr('Events', 'События'), tr('Plan workshops, meetups and online sessions.', 'Планируйте воркшопы, митапы и онлайн-сессии.')],
      messages: [tr('Messages', 'Сообщения'), tr('Learner conversations and recent platform updates.', 'Диалоги с учениками и обновления платформы.')],
      workspace: [tr('Workspace', 'Рабочая зона'), tr('Creator tools for publishing and planning.', 'Инструменты публикации и планирования.')],
      schedule: [tr('Schedule', 'Расписание'), tr('Open lesson slots for learners and see who booked.', 'Открывайте слоты для учеников и смотрите записи.')],
      profile: [tr('Profile', 'Профиль'), tr('Your Duvela Business account and public profile.', 'Ваш аккаунт Duvela Business и публичный профиль.')]
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
  const publicDataFeature = publicDataApi.create({
    supa,
    state,
    tr,
    formatDate,
    getUser: () => user,
    isBusiness: () => isBusiness()
  });

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
    if (item.is_free) return tr('Free', 'Бесплатно');
    if (item.price == null || item.price === '') return item.priceLabel || tr('Open', 'Открыто');
    return [item.price, item.currency].filter(Boolean).join(' ');
  }
  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Date.now() - Date.parse(iso);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return tr('just now', 'только что');
    if (minutes < 60) return minutes + tr('m', ' мин');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + tr('h', ' ч');
    return Math.floor(hours / 24) + tr('d', ' дн');
  }
  function staticSessionCount(count) {
    return count + ' ' + tr('sessions', 'эфиров');
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
  function renderManagement() { return managementFeature.render(); }
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
      supportedLocales,
      getAppLang: () => appLang,
      setAppLang(nextLang) {
        localStorage.setItem(LANG_KEY, resolveAppLang(nextLang));
        window.location.reload();
      },
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
      studyToolsHtml,
      bindStudyTiles,
      openStudyTool,
      openPracticeBuilder,
      openChallengeCreate,
      openClassManage,
      openCourseDetail,
      openEventDetail,
      openVideoItem,
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
  const busDashboardFeature = window.DuvelaBusinessDashboard.create(featureContext);
  featureContext.busDashboard = busDashboardFeature;
  const managementFeature = window.DuvelaBusinessManagement.create(featureContext);
  featureContext.management = managementFeature;
  const mediaStudioFeature = window.DuvelaBusinessMediaStudio.create(featureContext);
  featureContext.mediaStudio = mediaStudioFeature;
  const profileViewFeature = window.DuvelaBusinessProfileView.create(featureContext);
  featureContext.profileView = profileViewFeature;
  const catalogFeature = window.DuvelaAppCatalog.create(featureContext);
  const messagingFeature = window.DuvelaAppMessages.create(featureContext);
  const notificationsFeature = window.DuvelaAppNotifications.create(featureContext);
  const practiceFeature = window.DuvelaAppPractice.create(featureContext);
  const studyFeature = window.DuvelaAppStudy.create(featureContext);
  const gamesFeature = window.DuvelaAppGames.create(featureContext);
  const businessFeature = window.DuvelaAppBusiness.create(featureContext);
  const classesFeature = window.DuvelaAppClasses.create(featureContext);
  const scheduleFeature = window.DuvelaAppSchedule.create(featureContext);
  const gamificationFeature = window.DuvelaAppGamification.create(featureContext);
  const searchFeature = window.DuvelaAppSearch.create(featureContext);

  function renderVideos() { return mediaFeature.renderVideos(); }
  async function loadVideos() { return mediaFeature.loadVideos(); }
  function openVideo(id) { return mediaFeature.openVideo(id); }
  function openVideoItem(item) { return mediaFeature.openVideoItem(item); }
  function closeVideo() { return mediaFeature.closeVideo(); }
  async function toggleLike(postId) { return mediaFeature.toggleLike(postId); }
  function openUpload() { return mediaFeature.openUpload(); }
  async function uploadPost(event) { return mediaFeature.uploadPost(event); }

  function openPracticeBuilder() { return practiceBuilderFeature.openPracticeBuilder(); }
  function addBuilderItem() { return practiceBuilderFeature.addBuilderItem(); }
  async function submitPractice() { return practiceBuilderFeature.submitPractice(); }

  function renderProfile() { return profileFeature.renderProfile(); }
  async function saveProfile(event) { return profileFeature.saveProfile(event); }
  async function deleteAccount() { return profileFeature.deleteAccount(); }
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

  function studyToolsHtml() { return studyFeature.studyToolsHtml(); }
  function bindStudyTiles() { return studyFeature.bindStudyTiles(); }
  function openStudyTool(id) { return studyFeature.openStudyTool(id); }

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
    const folder = String(bucket || 'uploads').trim() || 'uploads';
    const path = user.id + '/' + folder + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
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
    deleteAccount,
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
    renderManagement,
    renderLive,
    renderProfile,
    renderSchedule,
    renderVideos,
    renderWorkspace,
    saveChallengeProgress,
    setAppLang: featureContext.setAppLang,
    saveProfile,
    selectClassSession,
    setView,
    startChatWith,
    submitPractice,
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
