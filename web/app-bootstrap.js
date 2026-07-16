(function () {
  function createAppBootstrap(ctx) {
    const { $, $$, tr, supa, runtime, session } = ctx;

    function closeOverlays() {
      ctx.closeVideo();
      $('#courseOverlay').classList.remove('open');
      $('#eventOverlay').classList.remove('open');
      $('#uploadOverlay').classList.remove('open');
      $('#pbOverlay').classList.remove('open');
      $('#searchOverlay').classList.remove('open');
      $('#classOverlay').classList.remove('open');
      $('#challengeOverlay').classList.remove('open');
      $('#newChatOverlay').classList.remove('open');
      $('#notifOverlay').classList.remove('open');
      $('#practiceOverlay').classList.remove('open');
      if ($('#duelOverlay').classList.contains('open')) ctx.closeDuel();
      if ($('#chessOverlay').classList.contains('open')) ctx.closeChess();
    }

    function bindOverlayA11y() {
      const openedState = new WeakMap();
      const focusableSelector = [
        'button:not([disabled])',
        '[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');

      const syncOverlay = (overlay) => {
        const isOpen = overlay.classList.contains('open');
        const wasOpen = openedState.get(overlay) === true;
        overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        openedState.set(overlay, isOpen);
        document.body.classList.toggle('modal-open', $$('.overlay.open').length > 0);
        if (!isOpen || wasOpen) return;
        const focusTarget = overlay.querySelector(focusableSelector);
        if (focusTarget) setTimeout(() => focusTarget.focus(), 0);
      };

      $$('.overlay').forEach((overlay) => {
        syncOverlay(overlay);
        new MutationObserver(() => syncOverlay(overlay)).observe(overlay, {
          attributes: true,
          attributeFilter: ['class']
        });
      });
    }

    function bindEvents() {
      bindOverlayA11y();

      $$('.nav button').forEach((button) => button.addEventListener('click', () => {
        ctx.setView(button.dataset.view);
        if (button.dataset.view === 'schedule') ctx.loadSchedule().then(ctx.renderSchedule);
        if (button.dataset.view === 'workspace') {
          if (ctx.isBusiness()) ctx.loadBusinessWorkspace().then(ctx.renderWorkspace);
          else ctx.loadPractices().then(ctx.renderWorkspace);
        }
      }));

      $('#videoTabs').addEventListener('click', (event) => {
        const button = event.target.closest('button[data-filter]');
        if (!button) return;
        runtime.currentVideoFilter = button.dataset.filter;
        $$('#videoTabs button').forEach((node) => node.classList.toggle('active', node === button));
        ctx.renderVideos();
      });

      document.addEventListener('click', (event) => {
        const go = event.target.closest('[data-go]');
        if (go) {
          event.preventDefault();
          ctx.setView(go.dataset.go);
        }
        const enroll = event.target.closest('[data-enroll]');
        if (enroll) { event.preventDefault(); ctx.enrollCourse(enroll.dataset.enroll); return; }
        const unenroll = event.target.closest('[data-unenroll]');
        if (unenroll) { event.preventDefault(); ctx.unenrollCourse(unenroll.dataset.unenroll); return; }
        const conversation = event.target.closest('[data-conv]');
        if (conversation) { ctx.openConversation(conversation.dataset.conv); return; }
        const person = event.target.closest('[data-person]');
        if (person) {
          if (ctx.isGroupChatMode()) ctx.toggleGroupPerson(person.dataset.person);
          else ctx.startChatWith(person.dataset.person);
          return;
        }
        const video = event.target.closest('[data-video]');
        if (video) { ctx.openVideo(video.dataset.video); return; }
        const course = event.target.closest('[data-course]');
        if (course) { ctx.openCourseDetail(course.dataset.course); return; }
        const addLesson = event.target.closest('[data-add-lesson]');
        if (addLesson) { event.preventDefault(); ctx.addLesson(runtime.currentCourseId); return; }
        const addTask = event.target.closest('[data-add-task]');
        if (addTask) { event.preventDefault(); ctx.addTask(addTask.dataset.addTask); return; }
        const submitTask = event.target.closest('[data-submit-task]');
        if (submitTask) { event.preventDefault(); ctx.submitTask(submitTask.dataset.submitTask, submitTask.dataset.lesson); return; }
        const grade = event.target.closest('[data-grade]');
        if (grade) { event.preventDefault(); ctx.gradeSubmission(grade.dataset.grade, Number(grade.dataset.max) || 100); return; }
        const confirmEnroll = event.target.closest('[data-confirm-enroll]');
        if (confirmEnroll) { event.preventDefault(); ctx.confirmEnrollment(confirmEnroll.dataset.confirmEnroll); return; }
        const certificate = event.target.closest('[data-cert]');
        if (certificate) { event.preventDefault(); ctx.openCertificate(certificate.dataset.cert); return; }
        const deletePortfolio = event.target.closest('[data-del-portfolio]');
        if (deletePortfolio) { event.preventDefault(); ctx.deletePortfolioItem(deletePortfolio.dataset.delPortfolio); return; }
        const challenge = event.target.closest('[data-challenge]');
        if (challenge) { ctx.openChallenge(challenge.dataset.challenge); return; }
        const joinChallenge = event.target.closest('[data-join-challenge]');
        if (joinChallenge) { event.preventDefault(); ctx.joinChallenge(joinChallenge.dataset.joinChallenge); return; }
        const saveChallenge = event.target.closest('[data-save-challenge]');
        if (saveChallenge) { event.preventDefault(); ctx.saveChallengeProgress(saveChallenge.dataset.saveChallenge); return; }
        const classManage = event.target.closest('[data-class-manage]');
        if (classManage) { event.preventDefault(); ctx.clearClassSessionSelection(); ctx.openClassManage(classManage.dataset.classManage); return; }
        const addSession = event.target.closest('[data-add-session]');
        if (addSession) { event.preventDefault(); ctx.createClassSession(); return; }
        const sessionAttendance = event.target.closest('[data-session-att]');
        if (sessionAttendance) { event.preventDefault(); ctx.selectClassSession(sessionAttendance.dataset.sessionAtt); return; }
        const attendance = event.target.closest('[data-att]');
        if (attendance) { event.preventDefault(); ctx.markAttendance(attendance.dataset.client, attendance.dataset.att); return; }
        const addStudent = event.target.closest('[data-add-student]');
        if (addStudent) { event.preventDefault(); ctx.addClassStudent(addStudent.dataset.addStudent); return; }
        const removeMember = event.target.closest('[data-member-remove]');
        if (removeMember) { event.preventDefault(); ctx.removeMember(removeMember.dataset.memberRemove); return; }
        const practice = event.target.closest('[data-practice]');
        if (practice) { ctx.openPractice(practice.dataset.practice); return; }
        const teacherSlots = event.target.closest('[data-teacher]');
        if (teacherSlots) { ctx.openTeacherSlots(teacherSlots.dataset.teacher); return; }
        const book = event.target.closest('[data-book]');
        if (book) { ctx.bookSlot(book.dataset.book); return; }
        const cancelBooking = event.target.closest('[data-cancel-booking]');
        if (cancelBooking) { event.preventDefault(); ctx.cancelBooking(cancelBooking.dataset.cancelBooking); return; }
        const rsvp = event.target.closest('[data-rsvp]');
        if (rsvp) { event.preventDefault(); ctx.toggleRsvp(rsvp.dataset.rsvp); return; }
        const eventCard = event.target.closest('[data-event]');
        if (eventCard) { ctx.openEventDetail(eventCard.dataset.event); return; }
        const like = event.target.closest('[data-like]');
        if (like) { event.preventDefault(); ctx.toggleLike(like.dataset.like); return; }
      });

      $('#profileForm').addEventListener('submit', ctx.saveProfile);
      const legacyLanguageSelect = $('#langSelect');
      if (legacyLanguageSelect) legacyLanguageSelect.style.display = 'none';

      $('#videoClose').addEventListener('click', ctx.closeVideo);
      $('#videoOverlay').addEventListener('click', (event) => { if (event.target === $('#videoOverlay')) ctx.closeVideo(); });
      $('#courseClose').addEventListener('click', () => $('#courseOverlay').classList.remove('open'));
      $('#courseOverlay').addEventListener('click', (event) => { if (event.target === $('#courseOverlay')) $('#courseOverlay').classList.remove('open'); });
      $('#eventClose').addEventListener('click', () => $('#eventOverlay').classList.remove('open'));
      $('#eventOverlay').addEventListener('click', (event) => { if (event.target === $('#eventOverlay')) $('#eventOverlay').classList.remove('open'); });
      $('#uploadVideoBtn').addEventListener('click', ctx.openUpload);
      $('#uploadClose').addEventListener('click', () => $('#uploadOverlay').classList.remove('open'));
      $('#uploadOverlay').addEventListener('click', (event) => { if (event.target === $('#uploadOverlay')) $('#uploadOverlay').classList.remove('open'); });
      $('#uploadForm').addEventListener('submit', ctx.uploadPost);
      $('#pbClose').addEventListener('click', () => $('#pbOverlay').classList.remove('open'));
      $('#pbOverlay').addEventListener('click', (event) => { if (event.target === $('#pbOverlay')) $('#pbOverlay').classList.remove('open'); });
      $('#pbAddItem').addEventListener('click', ctx.addBuilderItem);
      $('#pbSubmit').addEventListener('click', ctx.submitPractice);
      $('#pbItems').addEventListener('click', (event) => {
        const remove = event.target.closest('.pb-remove');
        if (remove) remove.closest('.pb-item').remove();
      });
      $('#challengeClose').addEventListener('click', () => $('#challengeOverlay').classList.remove('open'));
      $('#challengeOverlay').addEventListener('click', (event) => { if (event.target === $('#challengeOverlay')) $('#challengeOverlay').classList.remove('open'); });
      $('#classClose').addEventListener('click', () => $('#classOverlay').classList.remove('open'));
      $('#classOverlay').addEventListener('click', (event) => { if (event.target === $('#classOverlay')) $('#classOverlay').classList.remove('open'); });

      ctx.searchFeature.bindEvents();
      ctx.notificationsFeature.bindEvents();
      ctx.practiceFeature.bindEvents();
      ctx.gamesFeature.bindEvents();
      ctx.messagingFeature.bindEvents();

      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeOverlays();
      });

      document.addEventListener('change', (event) => {
        const languageSelect = event.target.closest('#profileLangSelect');
        if (!languageSelect) return;
        ctx.setAppLang(languageSelect.value);
      });

      $('#signOut').addEventListener('click', async () => {
        ctx.messagingFeature.cleanup();
        ctx.gamesFeature.cleanup();
        clearInterval(runtime.liveRefreshTimer);
        await supa.auth.signOut();
        window.location.href = './index.html';
      });
      if ($('#deleteAccountBtn')) $('#deleteAccountBtn').addEventListener('click', ctx.deleteAccount);

      supa.auth.onAuthStateChange((event, nextSession) => {
        if (!nextSession?.user && event === 'SIGNED_OUT') window.location.href = './index.html';
      });
    }

    async function init() {
      ctx.localizeStaticUI();
      session.selectedRole = ctx.normalizeRole(session.selectedRole);
      localStorage.setItem(ctx.storage.roleKey, session.selectedRole);
      const sessionResult = await supa.auth.getSession();
      const authSession = sessionResult.data.session;
      if (!authSession?.user) {
        window.location.href = './index.html?login=1';
        return;
      }
      session.user = authSession.user;
      bindEvents();
      await ctx.loadProfile();
      localStorage.setItem(ctx.storage.roleKey, session.role);
      history.replaceState(null, '', './app.html?role=' + encodeURIComponent(session.role) + (window.location.hash || '#home'));
      await Promise.all([
        ctx.loadPublicData(),
        ctx.loadEnrollments(),
        ctx.loadVideos(),
        ctx.loadPractices(),
        ctx.loadNotifications(),
        ctx.loadSchedule(),
        ctx.loadBusinessWorkspace(),
        ctx.loadWallet(),
        ctx.loadChallenges()
      ]);
      ctx.renderAll();
      ctx.syncRoleOptions();
      $('#loading').style.display = 'none';
      $('#app').style.display = 'grid';
      ctx.setView((window.location.hash || '#home').slice(1));
      ctx.loadConversations();
      ctx.subscribeNotifications();
      clearInterval(runtime.liveRefreshTimer);
      runtime.liveRefreshTimer = setInterval(() => {
        ctx.loadPublicData().then(() => {
          ctx.renderHome();
          ctx.renderLive();
          ctx.renderCourses();
          ctx.renderEvents();
        });
      }, 30000);
    }

    function start() {
      return init().catch((error) => {
        console.error(error);
        $('#loading').textContent = tr('Could not open Duvela Web. Please sign in again.', 'Не удалось открыть Duvela Web. Войдите заново.');
        setTimeout(() => { window.location.href = './index.html?login=1'; }, 1400);
      });
    }

    return {
      bindEvents,
      init,
      start
    };
  }

  window.DuvelaAppBootstrap = { create: createAppBootstrap };
})();
