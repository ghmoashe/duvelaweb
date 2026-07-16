(function () {
  function createStaticUiFeature(ctx) {
    const { $, $$, tr, isRu, roleLabels, appLang, supportedLocales } = ctx;

    function localizeStaticUI() {
      const currentLocale = (supportedLocales || []).find((locale) => locale.code === appLang);
      document.documentElement.lang = appLang || (isRu ? 'ru' : 'en');
      document.documentElement.dir = currentLocale?.dir || 'ltr';
      document.title = tr('Duvela Web', 'Duvela Web');
      $('#loading').textContent = tr('Opening Duvela Web...', 'Открываем Duvela Web...');
      $('#workspaceNavLabel').textContent = tr('Practice', 'Практика');

      const videoTabButtons = $$('#videoTabs button');
      if (videoTabButtons[0]) videoTabButtons[0].textContent = tr('All', 'Все');
      if (videoTabButtons[1]) videoTabButtons[1].textContent = tr('Languages', 'Языки');
      if (videoTabButtons[2]) videoTabButtons[2].textContent = tr('Arts', 'Искусство');
      if (videoTabButtons[3]) videoTabButtons[3].textContent = tr('School', 'Школа');

      const dataT = {
        email: ['Email', 'Email'],
        role: ['Role', 'Роль'],
        fullName: ['Full name', 'Имя'],
        city: ['City', 'Город'],
        country: ['Country', 'Страна'],
        language: ['Language', 'Язык'],
        level: ['Language level', 'Уровень языка'],
        avatarUrl: ['Avatar URL', 'Ссылка на аватар'],
        bio: ['Bio', 'О себе'],
        website: ['Website', 'Сайт'],
        save: ['Save changes', 'Сохранить'],
        saved: ['Saved ✓', 'Сохранено ✓'],
        openPublic: ['Open public profile', 'Открыть публичный профиль'],
        signOut: ['Sign out', 'Выйти'],
        startNewChat: ['Start a new chat', 'Начать новый чат']
      };

      $$('[data-t]').forEach((el) => {
        const key = el.getAttribute('data-t');
        if (dataT[key]) el.textContent = tr(dataT[key][0], dataT[key][1]);
      });

      const langSelect = $('#langSelect');
      if (langSelect) langSelect.value = isRu ? 'ru' : 'en';

      $('#chatSearch').placeholder = tr('Search people by name or city...', 'Поиск людей по имени или городу...');
      if ($('#groupToggleLabel')) $('#groupToggleLabel').textContent = tr('Group chat', 'Групповой чат');
      if ($('#groupTitle')) $('#groupTitle').placeholder = tr('Group name', 'Название группы');
      $('#newChatBtn').textContent = tr('New chat', 'Новый чат');
      $('#composeInput').placeholder = tr('Write a message...', 'Напишите сообщение...');
      $('#notifTitle').textContent = tr('Notifications', 'Уведомления');
      $('#markAllRead').textContent = tr('Mark all read', 'Прочитать все');
      $('#practiceOverlayTitle').textContent = tr('Practice', 'Практика');
      $('#notifBell').setAttribute('aria-label', tr('Notifications', 'Уведомления'));

      if ($('#uploadVideoBtn')) $('#uploadVideoBtn').textContent = tr('Upload', 'Загрузить');
      if ($('#uploadTitle')) $('#uploadTitle').textContent = tr('Upload a video', 'Загрузить видео');
      if ($('#upFileLabel')) $('#upFileLabel').textContent = tr('Video or image file', 'Файл видео или фото');
      if ($('#upCaptionLabel')) $('#upCaptionLabel').textContent = tr('Caption', 'Подпись');
      if ($('#upLevelLabel')) $('#upLevelLabel').textContent = tr('Level (optional)', 'Уровень (необязательно)');
      if ($('#upSubmit')) $('#upSubmit').textContent = tr('Publish', 'Опубликовать');

      if ($('#pbTitle')) $('#pbTitle').textContent = tr('Create a practice', 'Создать практику');
      if ($('#pbNameLabel')) $('#pbNameLabel').textContent = tr('Title', 'Название');
      if ($('#pbLangLabel')) $('#pbLangLabel').textContent = tr('Language', 'Язык');
      if ($('#pbLevelLabel')) $('#pbLevelLabel').textContent = tr('Level', 'Уровень');
      if ($('#pbAddLabel')) $('#pbAddLabel').textContent = tr('Add question', 'Добавить вопрос');
      if ($('#pbSubmit')) $('#pbSubmit').textContent = tr('Publish practice', 'Опубликовать практику');

      if ($('#duelOverlayTitle')) $('#duelOverlayTitle').textContent = tr('Duel', 'Дуэль');
      if ($('#chessOverlayTitle')) $('#chessOverlayTitle').textContent = tr('Chess', 'Шахматы');
      if ($('#searchTitle')) $('#searchTitle').textContent = tr('Search', 'Поиск');
      if ($('#globalSearch')) $('#globalSearch').placeholder = tr('Search courses, events, people, practices...', 'Поиск курсов, событий, людей, практик...');
      if ($('#searchBtn')) $('#searchBtn').setAttribute('aria-label', tr('Search', 'Поиск'));
    }

    return {
      localizeStaticUI
    };
  }

  window.DuvelaAppStaticUi = { create: createStaticUiFeature };
})();
