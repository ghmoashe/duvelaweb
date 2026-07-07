(function () {
  function cloneList(items) {
    return Array.isArray(items) ? items.slice() : [];
  }

  function createAppStore(seed) {
    return {
      state: {
        videos: cloneList(seed.fallbackVideos),
        live: cloneList(seed.fallbackLive),
        liveScheduled: [],
        liveHistory: [],
        courses: cloneList(seed.fallbackCourses),
        events: cloneList(seed.fallbackEvents),
        messages: cloneList(seed.fallbackMessages),
        myCourses: [],
        enrolledIds: new Set(),
        conversations: [],
        activeConversationId: null,
        notifications: [],
        practices: [],
        myRatings: {},
        scheduleTeachers: [],
        myBookings: [],
        mySlots: [],
        myOrg: null,
        orgCourses: [],
        orgClasses: [],
        myPractices: [],
        walletTx: [],
        portfolio: [],
        verification: null,
        orgMembers: [],
        leaderLang: '',
        myRank: null,
        challenges: [],
        myChallengeIds: new Set()
      },
      runtime: {
        currentCourseId: null,
        currentHls: null,
        currentVideoFilter: 'all',
        liveRefreshTimer: null
      }
    };
  }

  window.DuvelaAppStore = { create: createAppStore };
})();
