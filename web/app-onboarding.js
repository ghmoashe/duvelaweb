// Single coherent onboarding wizard — mirrors the mobile apps' registration
// (fields, validation, per-language levels) and writes ONE consolidated payload
// to profiles (+ learner_language_profiles for learners). Replaces the previous
// base form plus the four MutationObserver enhancers that raced each other.
(function () {
  function create(ctx) {
    var $ = function (s) { return document.querySelector(s); };
    var supa = ctx.supa;
    var tr = ctx.tr || function (en) { return en; };
    var RU = {
      'Choose your workspace':'Выберите пространство','Basic profile details':'Основные данные профиля','Preview & confirm':'Проверка и подтверждение',
      'Learner':'Ученик','Teacher':'Преподаватель','Organizer':'Организатор','Organization':'Организация',
      'Learn at your own pace':'Учитесь в своём темпе','Create lessons and guide students':'Создавайте уроки и обучайте учеников','Run events':'Проводите события','Manage learning programs':'Управляйте учебными программами',
      'Current workspace:':'Текущее пространство:','Account workspaces:':'Пространства аккаунта:','Configuring:':'Настраивается:','Server confirmed':'Подтверждено сервером',
      'Not activated':'Не активировано','None yet':'Пока нет',
      'Continue →':'Продолжить →','Open my Duvela →':'Открыть DUVELA →','Open my workspace →':'Открыть пространство →','← Back':'← Назад',
      'Draft saved locally.':'Черновик сохранён локально.','Nothing changes until server confirmation.':'Изменения вступят в силу только после подтверждения сервера.',
      'Save & exit':'Сохранить и выйти','Sign out':'Выйти','Professional profile':'Профессиональный профиль','Teaching headline':'Заголовок преподавателя',
      'Years of experience':'Опыт преподавания','Native language':'Родной язык','Choose one':'Выберите один','Teaching category':'Категория преподавания',
      'Choose what you teach':'Выберите, чему вы обучаете','Focus areas':'Специализации','Languages you teach':'Языки преподавания','Choose up to 3':'Выберите до 3',
      'Explanation languages':'Языки объяснения','Languages you use to explain lessons':'Языки, на которых вы объясняете материал',
      'Supported CEFR levels':'Уровни CEFR','Teaching formats':'Форматы обучения','Qualifications':'Квалификация','Lesson format':'Формат урока',
      'Availability':'Доступное время','Credentials / verification':'Документы и подтверждение','Your learning profile':'Ваш учебный профиль',
      'Learning category':'Категория обучения','Choose one direction':'Выберите направление','Languages you want to learn':'Языки для изучения','Interests':'Интересы',
      'Organizer profile':'Профиль организатора','Organizer headline':'Заголовок организатора','Capacity / group size':'Размер группы','Organizer type':'Тип организатора',
      'Event type':'Тип события','Organizer category':'Категория события','Event languages':'Языки события','Location mode':'Формат проведения',
      'Audience':'Аудитория','Frequency':'Частота','Organization setup':'Настройка организации','Organization type':'Тип организации',
      'What does your organization do?':'Чем занимается ваша организация?','Learning / business categories':'Учебные и бизнес-категории',
      'Languages / markets':'Языки и рынки','Program format':'Формат программ','Authorized organization membership':'Полномочия в организации',
      'Business verification':'Проверка организации','Role':'Роль','Category':'Категория','Goal':'Цель','Not set':'Не указано','Selected':'Выбрано',
      'Profile appearance':'Внешний вид профиля','Personal details':'Личные данные','Additional details (optional)':'Дополнительные сведения (необязательно)',
      'First name':'Имя','Last name':'Фамилия','Country':'Страна','City':'Город','Short introduction (optional)':'Коротко о себе (необязательно)',
      'Profile photo':'Фото профиля','Cover image':'Изображение обложки','Upload avatar':'Загрузить аватар','Upload cover':'Загрузить обложку','Replace':'Заменить','Remove':'Удалить','Cover theme':'Тема обложки',
      'Crop preview':'Кадрирование','Crop top':'Верх','Crop center':'По центру','Crop bottom':'Низ','Date of birth':'Дата рождения','Gender':'Пол',
      'Teacher setup':'Настройка преподавателя','sections ready':'раздела готовы','Subjects & Specializations':'Предметы и специализации','Teaching Preferences':'Параметры преподавания','Professional Information':'Профессиональная информация',
      'What do you teach?':'Чему вы обучаете?','Choose one main category. Your selections are preserved when you switch categories.':'Выберите основную категорию. Выбор сохраняется при переключении категорий.','Teaching languages':'Языки преподавания','Choose up to three languages':'Выберите до трёх языков','Teaching specializations':'Специализации преподавания','Subjects & specializations':'Предметы и специализации','Select up to three relevant areas':'Выберите до трёх направлений',
      'Saved locally as you work.':'Сохраняется локально во время заполнения.','Next: Teaching preferences →':'Далее: параметры преподавания →','Teaching preferences':'Параметры преподавания','Set the structure learners will see when choosing lessons.':'Настройте данные, которые ученики увидят при выборе урока.','Selected teaching subjects':'Выбранные языки преподавания','Languages used to explain lessons':'Языки для объяснения материала','Choose every level you currently support':'Выберите все поддерживаемые уровни','Choose at least one':'Выберите хотя бы один','Skill level':'Уровень навыка','Choose all that apply':'Выберите подходящие варианты','Target audience':'Целевая аудитория','Who you teach':'Кого вы обучаете',
      '← Subjects':'← Предметы','Next: Professional information →':'Далее: профессиональная информация →','Professional information':'Профессиональная информация','These details are optional and can be completed later in Teacher Profile.':'Эти сведения необязательны; их можно добавить позже в профиле преподавателя.','Formal qualifications are optional':'Формальная квалификация необязательна','Teaching approach':'Методика преподавания','How you help learners progress':'Как вы помогаете ученикам развиваться','Certificates (optional)':'Сертификаты (необязательно)','Availability summary':'Доступное время','Starting price (optional)':'Начальная цена (необязательно)','Credentials are shown as unverified until an authorized DUVELA review is completed.':'Документы отображаются как непроверенные до официальной проверки DUVELA.','Advanced profile settings (optional)':'Расширенные настройки профиля (необязательно)','Existing values are preserved. You can also edit these later in Teacher Profile.':'Существующие значения сохраняются. Их также можно изменить позже в профиле преподавателя.','Personal interests':'Личные интересы','Continue below when ready.':'Когда всё готово, нажмите «Продолжить» ниже.','Search language or ISO code':'Поиск языка или ISO-кода','No language selected':'Язык не выбран','Clear selection':'Очистить выбор',
      'Your learning setup':'Ваша учебная настройка','Choose a direction and tell DUVELA where you want to go next.':'Выберите направление и расскажите DUVELA о своей цели.','Saved locally':'Сохранено локально','Unsaved changes':'Есть несохранённые изменения','Fields below adapt to your selected direction':'Поля ниже меняются в зависимости от выбранного направления','Languages to learn':'Языки для изучения','Choose one language':'Выберите один язык','Choose up to three languages':'Выберите до трёх языков','Current and target levels':'Текущий и целевой уровни','Learning plan':'Учебный план','Current level':'Текущий уровень','Target level':'Целевой уровень','Learning focus':'Фокус обучения','Optional':'Необязательно','Recommended next step:':'Рекомендуемый следующий шаг:','Use recommendation':'Выбрать рекомендацию','Selection summary':'Сводка выбора','Ready for Continue':'Можно продолжить','No selection yet':'Пока ничего не выбрано','learning language':'изучаемый язык','learning languages':'изучаемых языка','Interests':'Интересы','Optional — helps personalize recommendations':'Необязательно — помогает персонализировать рекомендации','Show more interests':'Показать больше интересов','Subject':'Предмет','Discipline':'Направление','Relevant subject':'Подходящий предмет','Choose up to three areas':'Выберите до трёх направлений','Search subjects':'Поиск предметов','Current experience':'Текущий опыт','Select the closest match':'Выберите наиболее подходящий вариант','Desired outcome':'Желаемый результат','What would you like to achieve?':'Чего вы хотите достичь?','Beginner':'Начинающий','Not assessed':'Не определён','Some experience':'Есть опыт','Intermediate':'Средний','Advanced':'Продвинутый','Starting now':'Начинаю сейчас','Know the basics':'Знаю основы','Building skill':'Развиваю навык','Deepening expertise':'Углубляю знания','Native':'Родной','Learning':'Изучаемые','Languages':'Языки','Art & creativity':'Творчество','Education':'Образование','Digital skills':'Цифровые навыки','Career':'Карьера','Life skills':'Жизненные навыки','Sport & fitness':'Спорт и фитнес','Personal development':'Личностное развитие','Entertainment':'Развлечения','Sports':'Спорт','Travel':'Путешествия','Cinema':'Кино','Business':'Бизнес','Dancing':'Танцы','Socializing':'Общение','Culture':'Культура','Gardening':'Садоводство','Dating':'Знакомства','Yoga':'Йога','Shopping':'Покупки','Photography':'Фотография','Food':'Еда','Biking':'Велоспорт','Family':'Семья','Handcraft':'Рукоделие','Cooking':'Кулинария','Golf':'Гольф','Music':'Музыка','Tech':'Технологии','Science':'Наука','Interview':'Собеседование','Art':'Искусство','Chatting':'Общение','Gaming':'Игры','Finance':'Финансы','English':'Английский','Spanish':'Испанский','French':'Французский','German':'Немецкий','Italian':'Итальянский','Portuguese':'Португальский','Dutch':'Нидерландский','Russian':'Русский','Ukrainian':'Украинский','Polish':'Польский','Swedish':'Шведский','Norwegian':'Норвежский','Danish':'Датский','Finnish':'Финский','Greek':'Греческий','Czech':'Чешский','Hungarian':'Венгерский','Romanian':'Румынский','Turkish':'Турецкий','Chinese':'Китайский','Japanese':'Японский','Korean':'Корейский','Hindi':'Хинди','Thai':'Тайский','Vietnamese':'Вьетнамский','Indonesian':'Индонезийский','Arabic':'Арабский','Hebrew':'Иврит','Persian':'Персидский','Saved to account':'Сохранено в аккаунте','Saving to account…':'Сохранение в аккаунт…','Save failed':'Ошибка сохранения','Verifying saved data…':'Проверка сохранённых данных…','Choose your native language.':'Выберите родной язык.','Choose at least one language to learn.':'Выберите хотя бы один язык для изучения.','Your native language cannot also be a learning language.':'Родной язык нельзя одновременно выбрать как изучаемый.','Choose up to 3 languages.':'Выберите не более трёх языков.','Choose at least one subject.':'Выберите хотя бы один предмет.','Choose your current experience.':'Выберите текущий уровень опыта.','Describe your desired outcome.':'Опишите желаемый результат.','Selected languages and levels':'Выбранные языки и уровни','Learning setup':'Учебная настройка','Nothing selected':'Ничего не выбрано','Speaking, grammar, exam preparation…':'Разговорная речь, грамматика, подготовка к экзамену…','For example: build my first website or improve my drawing technique':'Например: создать первый сайт или улучшить технику рисования','Speaking':'Разговорная речь','Grammar':'Грамматика','Pronunciation':'Произношение','Exam preparation':'Подготовка к экзамену','Business language':'Деловой язык','Conversation':'Разговорная практика','Writing':'Письмо','Drawing':'Рисование','Painting':'Живопись','Sculpture':'Скульптура','Animation':'Анимация','Graphic design':'Графический дизайн','Crafts':'Ремёсла','Art history':'История искусства','Interview preparation':'Подготовка к собеседованию','AI interview':'Собеседование с ИИ','Programming':'Программирование','Web development':'Веб-разработка','Cybersecurity':'Кибербезопасность','Design':'Дизайн','Data analysis':'Анализ данных','Mobile development':'Мобильная разработка','Video editing':'Видеомонтаж','Content creation':'Создание контента','Audio & podcast':'Аудио и подкасты','Digital marketing':'Цифровой маркетинг','Social media':'Социальные сети','Math':'Математика','Physics':'Физика','Chemistry':'Химия','Biology':'Биология','Logic':'Логика','Sign language':'Жестовый язык','Personal finance':'Личные финансы','Home organization':'Организация дома','Mindfulness':'Осознанность','Communication':'Коммуникация','Productivity':'Продуктивность','Confidence':'Уверенность','Running':'Бег','Fitness':'Фитнес','Cycling':'Велоспорт','Chess':'Шахматы'
    };
    function tx(value) { return tr(value, RU[value] || value); }
    var D = window.DuvelaOnboardingData || {};
    var roles = ['learner', 'teacher', 'organizer', 'organization'];
    var copy = {
      learner: [tx('Learner'), tx('Learn at your own pace'), tr('Goal, language and level — Duvela picks the right start.', 'Цель, язык и уровень — DUVELA подберёт правильный старт.')],
      teacher: [tx('Teacher'), tx('Create lessons and guide students'), tr('Tell us your speciality so your workspace is ready.', 'Расскажите о специализации, чтобы подготовить пространство.')],
      organizer: [tx('Organizer'), tx('Run events'), tr('Set up your organizer profile to launch events and practice.', 'Настройте профиль для проведения событий и практики.')],
      organization: [tx('Organization'), tx('Manage learning programs'), tr('Create your organization profile, directions and programs.', 'Создайте профиль организации, направления и программы.')]
    };
    var icon = { learner: '\uD83C\uDF92', teacher: '\u270F\uFE0F', organizer: '\uD83D\uDCC5', organization: '\uD83C\uDFE2' };
    var roleBenefits = {
      learner: ['Learn', 'Practice', 'Join live'],
      teacher: ['Teach', 'Earn', 'Build profile'],
      organizer: ['Host events', 'Build community', 'Manage attendees'],
      organization: ['Organization profile', 'Courses/events', 'Contacts']
    };
    var roleSummary = {
      learner: {
        title: 'Learner Hub',
        body: 'Best for people learning languages, skills or hobbies with courses, LIVE sessions and practice.',
        best: ['Personal recommendations', 'Language levels', 'Progress tracking']
      },
      teacher: {
        title: 'Teacher workspace',
        body: 'Best for tutors, coaches and experts who teach languages or other categories.',
        best: ['Teaching profile', 'Students and lessons', 'Social/contact fields']
      },
      organizer: {
        title: 'Organizer profile',
        body: 'Best for people who run events, clubs, workshops, speaking practice or community sessions.',
        best: ['Event type', 'Audience and location', 'Capacity and schedule']
      },
      organization: {
        title: 'Organization profile',
        body: 'Best for schools, academies, companies and communities that offer learning programs.',
        best: ['Business profile', 'Learning directions', 'Contacts']
      }
    };
    var studentGoal = window.DuvelaStudentGoal || {
      LEVELS: ['A2', 'B1', 'B2', 'C1'],
      normalize: function (value, fallback) {
        var levels = ['A2', 'B1', 'B2', 'C1'];
        var raw = String(value || '').trim().toUpperCase();
        var safeFallback = String(fallback || '').trim().toUpperCase();
        return levels.indexOf(raw) >= 0 ? raw : (levels.indexOf(safeFallback) >= 0 ? safeFallback : 'A2');
      },
      legacyPatch: function (value) { var level = String(value || 'A2').toUpperCase(); return { goal_level: level, learning_goal: level }; }
    };

    var categoryIcons = { languages: '🌐', art: '🎨', education: '🧠', digital: '💻', career: '💼', life: '🏠', sportFitness: '🏃', personalDevelopment: '✨' };
    var subcategoryIcons = { Speaking:'💬', Grammar:'Aa', Pronunciation:'🔊', 'Exam preparation':'🎓', 'Business language':'💼', Conversation:'🗣️', Writing:'✍️', Drawing:'✏️', Painting:'🖌️', Sculpture:'🗿', Animation:'🎞️', 'Graphic design':'🖥️', Crafts:'🧶', 'Art history':'🏛️', 'Interview preparation':'💬', 'AI interview':'🤖', Programming:'💻', 'Web development':'🌐', AI:'🤖', Cybersecurity:'🛡️', Design:'🎨', 'Data analysis':'📊', 'Mobile development':'📱', 'UI/UX':'🎨', Figma:'🎨', 'Video editing':'🎬', 'Content creation':'✍️', Math:'➗', Physics:'⚛️', Chemistry:'🧪', Biology:'🧬', Logic:'🧩', Cooking:'🍳', 'Personal finance':'💰', Mindfulness:'🧘', Communication:'💬', Productivity:'⚡', Confidence:'💪', Running:'🏃', Fitness:'💪', Yoga:'🧘', Cycling:'🚴', Chess:'♟️' };
    var role = '';
    var step = 1;
    var minStep = 1;
    var roleLocked = false;
    var activeRole = 'learner';
    var existingRoles = [];
    var hasConfirmedRole = false;
    var draftKey = '';
    var draftDirty = false;
    var saveStatus = 'local';
    var teacherInviteRef = '';
    var fileFeedback = { avatar: '', cover: '' };
    // Structured state (not just FormData) so chips/levels survive re-renders.
    var state = {
      firstName: '', lastName: '', orgName: '', bio: '', city: '', country: '', gender: '',
      nativeLanguage: '', goal: '', level: 'A1', category: '', subcategories: [],
      learnLanguages: [], languageLevels: {}, goalLevels: {}, languageGoals: {}, interests: [],
      learnerCategoryDrafts: {}, learnerExperience: '', learningOutcome: '', learnerLanguageTab: 'native',
      specialization: '', experience: '', teachLanguages: [], explanationLanguages: [], teachingLevels: [], teachingFormats: [], qualifications: '',
      learningPreferences: [], authorizedMembership: '', teacherSetupTab: 'subjects', teacherCategorySubjects: {}, teacherSkillLevels: [], teacherAudience: [], teachingApproach: '', certificates: '',
      format: '', website: '', orgType: '', dob: '', avatarFile: null, coverFile: null, avatarName: '', coverName: '',
      avatarPreview: '', coverPreview: '', coverPosition: 'center', coverPreset: 'duvela',
      email: '', phone: '', contactName: '', contactEmail: '', contactPhone: '', contactPosition: '',
      rate: '', availability: '', audience: '', eventType: '', verification: '',
      instagram: '', tiktok: '', facebook: '', linkedin: '', youtube: '', telegram: '',
      organizerType: '', locationMode: '', frequency: '', capacity: '', eventLanguages: [],
      organizationCategories: ['languages'], organizationSubcategories: { languages: [] },
      organizationLanguages: [], organizationAudience: [], programFormat: []
    };
    var form = $('#onboardingForm');

    function safeDraftState() {
      var draft = {};
      Object.keys(state).forEach(function (key) {
        if (key !== 'avatarFile' && key !== 'coverFile' && key !== 'avatarPreview' && key !== 'coverPreview' && key !== 'avatarName' && key !== 'coverName') draft[key] = state[key];
      });
      return draft;
    }

    function saveDraft(message) {
      if (!draftKey) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify({ version: 4, role: role, step: step, state: safeDraftState(), savedAt: new Date().toISOString() }));
        draftDirty = false;
        setSaveStatus('local', message || tx('Draft saved locally.'));
      } catch (_) { setSaveStatus('error', tx('Save failed')); }
    }

    function setSaveStatus(kind, message) {
      saveStatus = kind || 'local';
      var note = $('#onboardingNote');
      if (note) { note.dataset.saveStatus = saveStatus; note.textContent = message || ''; }
      var badge = form && form.querySelector('[data-save-state]');
      if (badge) {
        badge.dataset.saveState = saveStatus;
        badge.textContent = saveStatus === 'account' ? tx('Saved to account') : saveStatus === 'saving' ? tx('Saving to account…') : saveStatus === 'error' ? tx('Save failed') : saveStatus === 'dirty' ? tx('Unsaved changes') : tx('Saved locally');
      }
    }

    function restoreDraft() {
      if (!draftKey) return false;
      try {
        var draft = JSON.parse(localStorage.getItem(draftKey) || 'null');
        if (!draft || draft.version !== 4 || !draft.state) return false;
        Object.assign(state, draft.state);
        // Browsers cannot safely restore File objects after reload. Never show
        // a stale filename as if an image were still selected or uploaded.
        state.avatarFile = null; state.coverFile = null;
        state.avatarPreview = ''; state.coverPreview = '';
        state.avatarName = ''; state.coverName = '';
        if (!roleLocked && roles.indexOf(draft.role) !== -1) role = draft.role;
        step = Math.max(minStep, Math.min(4, Number(draft.step) || 1));
        return true;
      } catch (_) { return false; }
    }

    function roleContextHtml() {
      var configuring = role ? (copy[role] || copy.learner)[0] : 'Not selected';
      var current = hasConfirmedRole ? (copy[activeRole] || copy.learner)[0] : tx('Not activated');
      var owned = existingRoles.map(function (item) { return (copy[item] || copy.learner)[0]; }).join(', ') || tx('None yet');
      return '<span>' + esc(tx('Current workspace:')) + ' <b>' + esc(current) + '</b></span><span class="ob-context-sep">•</span><span>' + esc(tx('Account workspaces:')) + ' <b>' + esc(owned) + '</b></span><span class="ob-context-sep">•</span><span>' + esc(tx('Configuring:')) + ' <b>' + esc(configuring) + '</b></span>' + (roleLocked ? '<span class="ob-role-lock">' + esc(tx('Server confirmed')) + '</span>' : '');
    }

    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function localizeRendered(root) {
      if (!root) return;
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var raw = node.nodeValue;
        var key = raw.trim();
        if (key && RU[key]) node.nodeValue = raw.replace(key, tx(key));
      }
    }

    function labelInput(id, label, value, opts) {
      opts = opts || {};
      return '<label class="' + (opts.wide ? 'wide' : '') + '">' + esc(label) +
        (opts.hint ? '<small style="font-weight:600;color:var(--muted)">' + esc(opts.hint) + '</small>' : '') +
        '<input id="ob-' + id + '" name="' + id + '" type="' + (opts.type || 'text') +
        '" value="' + esc(value) + '" ' + (opts.attr || '') +
        ' placeholder="' + esc(opts.placeholder || '') + '" autocomplete="off"></label>';
    }

    function selectInput(id, label, value, options) {
      return '<label>' + esc(label) + '<select id="ob-' + id + '" name="' + id + '">' +
        options.map(function (o) {
          var val = typeof o === 'string' ? o : o.id;
          var text = typeof o === 'string' ? o : o.label;
          if (o && o.id && categoryIcons[o.id]) text = categoryIcons[o.id] + ' ' + text;
          return '<option value="' + esc(val) + '"' + (String(val) === String(value) ? ' selected' : '') + '>' + esc(text) + '</option>';
        }).join('') + '</select></label>';
    }

    function chipList(kind, items, selected, labelOf) {
      return '<div class="ob-chip-list" data-chip-group="' + kind + '">' + items.map(function (it) {
        var id = typeof it === 'string' ? it : it.id;
        var text = labelOf ? labelOf(it) : (typeof it === 'string' ? it : it.label);
        var on = selected.indexOf(id) !== -1;
        return '<button type="button" class="ob-chip' + (on ? ' active' : '') + '" data-chip="' + kind + '" data-value="' + esc(id) + '" data-search-value="' + esc((String(id) + ' ' + String(text)).toLowerCase()) + '">' + esc(text) + '</button>';
      }).join('') + '</div>';
    }

    function coverPresetById(id) {
      var presets = D.PROFILE_COVER_PRESETS || [];
      return presets.filter(function (p) { return p.id === id; })[0] || presets[0] || { id: 'duvela', label: 'DUVELA', colors: ['#7C3AED', '#A855F7', '#22C1DC'] };
    }

    function coverPresetValue() {
      return 'preset:' + (state.coverPreset || 'duvela');
    }

    function gradientCss(preset) {
      var colors = (preset && preset.colors) || ['#7C3AED', '#A855F7', '#22C1DC'];
      return 'linear-gradient(135deg,' + colors.join(',') + ')';
    }

    function coverPresetHtml() {
      var presets = D.PROFILE_COVER_PRESETS || [];
      return '<div class="ob-cover-presets">' + presets.map(function (preset) {
        var active = (state.coverPreset || 'duvela') === preset.id && !state.coverFile;
        return '<button type="button" class="ob-cover-preset' + (active ? ' active' : '') + '" data-cover-preset="' + esc(preset.id) + '"><i style="background:' + esc(gradientCss(preset)) + '"></i><span>' + esc(preset.label) + '</span></button>';
      }).join('') + '</div>';
    }

    function filePickerHtml(kind, label, selectedName) {
      var id = kind === 'cover' ? 'ob-coverFile' : 'ob-avatarFile';
      var name = kind === 'cover' ? 'coverFile' : 'avatarFile';
      return '<span class="ob-file-picker"><input id="' + id + '" name="' + name + '" type="file" accept="image/jpeg,image/png" aria-label="' + esc(label) + '">' +
        '<span class="ob-file-button">' + esc(selectedName ? tx('Replace') : label) + '</span><b>' + esc(selectedName || 'JPG or PNG · max 5 MB') + '</b></span>';
    }

    function uploadControlHtml(kind, heading, label, selectedName) {
      return '<div class="ob-upload-control"><span class="ob-upload-label">' + esc(heading) + '</span><div class="ob-upload-control-row">' + filePickerHtml(kind, label, selectedName) +
        (selectedName ? '<button type="button" class="ob-remove-file" data-remove-upload="' + kind + '">' + esc(tx('Remove')) + '</button>' : '') +
        '</div><small class="ob-file-status' + (fileFeedback[kind] ? ' error' : '') + '" aria-live="polite">' +
        esc(fileFeedback[kind] || (selectedName ? 'Preview ready locally — uploaded after final confirmation.' : 'Choose a JPG or PNG image up to 5 MB.')) + '</small></div>';
    }

    function validateProfileImage(file) {
      if (!file) return '';
      if (['image/jpeg', 'image/png'].indexOf(file.type) === -1) return 'Use a JPG or PNG image.';
      if (file.size > 5 * 1024 * 1024) return 'Image must be 5 MB or smaller.';
      return '';
    }

    function clearProfileImage(kind) {
      var previewKey = kind + 'Preview';
      if (state[previewKey] && String(state[previewKey]).indexOf('blob:') === 0) URL.revokeObjectURL(state[previewKey]);
      state[kind + 'File'] = null;
      state[kind + 'Name'] = '';
      state[previewKey] = '';
      fileFeedback[kind] = '';
    }

    function initials() {
      var value = role === 'organization' ? state.orgName : [state.firstName, state.lastName].filter(Boolean).join(' ');
      value = value.trim();
      return value ? value.split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join('') : 'D';
    }

    function title() {
      var c = copy[role] || copy.learner;
      var who = (state.firstName || state.orgName || (ctx.getUser() && ctx.getUser().email ? ctx.getUser().email.split('@')[0] : 'there'));
      $('#onboardingLead').textContent = step === 1 && teacherInviteRef ? 'Your invite is set for a teacher account. Confirm it here and Duvela will prepare your workspace.'
        : step === 1 ? 'Choose your starting role. Duvela will tailor the setup and Hub for you.'
        : step === 2 ? ('Nice to meet you, ' + who + '. Let’s build your profile.')
        : step === 3 ? c[2] : 'Your Duvela profile is ready to go.';
      $('#onboardingSubmit').textContent = tx(step < 4 ? 'Continue →' : (role === 'learner' ? 'Open my Duvela →' : 'Open my workspace →'));
      $('#onboardingKicker').textContent = 'DUVELA · STEP ' + step + ' OF 4';
      $('#onboardingTitle').textContent = step === 1 ? tx('Choose your workspace') : step === 2 ? tx('Basic profile details') : step === 3 ? ((copy[role] || copy.learner)[0] + tr(' setup', ' · Настройка')) : tx('Preview & confirm');
    }

    function stepTwoHtml() {
      var displayName = role === 'organization' ? state.orgName : [state.firstName, state.lastName].filter(Boolean).join(' ');
      var location = [state.city, state.country].filter(Boolean).join(', ');
      var avatar = state.avatarPreview ? '<img src="' + esc(state.avatarPreview) + '" alt="">' : '<span>' + esc(initials()) + '</span>';
      var html = '<section class="ob-step2-appearance wide" aria-labelledby="ob-appearance-title"><div class="ob-section-heading"><div><h3 id="ob-appearance-title">' + esc(tx('Profile appearance')) + '</h3><p>Compact public-profile preview</p></div><span class="ob-local-state">Local preview</span></div>' +
        '<div class="ob-avatar-appearance"><div class="ob-avatar-preview-card"><div class="ob-appearance-avatar">' + avatar + '</div><div><strong data-appearance-name>' + esc(displayName || 'Your name') + '</strong><span data-appearance-location>' + esc(location || 'City, country') + '</span></div></div>' +
        '<div class="ob-avatar-control">' + uploadControlHtml('avatar', tx('Profile photo'), tx('Upload avatar'), state.avatarName) +
        '<p class="ob-storage-note"><b>Local preview:</b> the profile photo uploads to your account only after Step 4 server confirmation.</p></div></div></section>';
      html += '<section class="ob-step2-details wide" aria-labelledby="ob-details-title"><div class="ob-section-heading"><div><h3 id="ob-details-title">' + esc(tx('Personal details')) + '</h3><p>Shared identity details for every workspace.</p></div></div><div class="ob-extra-grid ob-personal-grid">';
      if (role === 'organization') {
        html += labelInput('orgName', 'Organization name', state.orgName, { attr: 'required', placeholder: 'Your organization' });
      } else {
        html += labelInput('firstName', tx('First name'), state.firstName, { attr: 'required', placeholder: 'Your first name' });
        html += labelInput('lastName', tx('Last name'), state.lastName, { placeholder: 'Your last name' });
      }
      html += labelInput('country', tx('Country'), state.country, { placeholder: 'Search country', attr: 'data-autocomplete="country" role="combobox" aria-autocomplete="list" aria-controls="ob-autocomplete"' });
      html += labelInput('city', tx('City'), state.city, { placeholder: 'Search or enter city', attr: 'data-autocomplete="city" role="combobox" aria-autocomplete="list" aria-controls="ob-autocomplete"' });
      html += '</div><p class="ob-location-purpose">My location is optional. With permission, DUVELA uses approximate location only to suggest city and country; exact coordinates are never saved or shown publicly.</p>';
      if (role === 'organization') {
        html += '<label class="wide ob-bio-field">Organization description <small>Optional</small><textarea id="ob-bio" name="bio" rows="2" maxlength="280" placeholder="A short public introduction">' + esc(state.bio) + '</textarea></label>';
      } else {
        html += '<label class="wide ob-bio-field">' + esc(tx('Short introduction (optional)')) + '<textarea id="ob-bio" name="bio" rows="2" maxlength="280" placeholder="Tell learners and teachers something about yourself">' + esc(state.bio) + '</textarea></label>';
        html += '<details class="ob-additional wide"><summary>' + esc(tx('Additional details (optional)')) + '</summary><div class="ob-extra-grid">' +
          labelInput('dob', tx('Date of birth'), state.dob, { type: 'date' }) + selectInput('gender', tx('Gender'), state.gender, [{ id: '', label: 'Prefer not to say' }].concat(D.GENDERS || [])) + '</div><p>These fields are optional in the current onboarding flow.</p></details>';
      }
      return html + '</section><div id="ob-autocomplete" class="ob-autocomplete" role="listbox" hidden></div>';
    }

    function languageIso(language) {
      var ids = { English:'EN', Spanish:'ES', French:'FR', German:'DE', Italian:'IT', Portuguese:'PT', Dutch:'NL', Russian:'RU', Ukrainian:'UK', Polish:'PL', Swedish:'SV', Norwegian:'NO', Danish:'DA', Finnish:'FI', Greek:'EL', Czech:'CS', Hungarian:'HU', Romanian:'RO', Turkish:'TR', Chinese:'ZH', Japanese:'JA', Korean:'KO', Hindi:'HI', Thai:'TH', Vietnamese:'VI', Indonesian:'ID', Arabic:'AR', Hebrew:'HE', Persian:'FA' };
      return ids[language] || String(language || '').slice(0, 2).toUpperCase();
    }

    function languageFlagHtml(language, className) {
      var image = D.flagImg ? D.flagImg(language) : '';
      var code = D.flagCode ? String(D.flagCode(language) || '').toUpperCase() : '';
      return image ? '<img class="' + esc(className) + '" src="' + esc(image) + '" alt="" loading="lazy" data-flag-code="' + esc(code) + '">' : '<span class="' + esc(className) + ' ob-language-flag-fallback">' + esc(code || '🌐') + '</span>';
    }

    function languagePickerHtml(kind, selected, single, title, hint) {
      selected = selected || [];
      var choices = (D.LANGUAGES || []).map(function (language) {
        var on = selected.indexOf(language) !== -1;
        return '<button type="button" class="ob-language-choice' + (on ? ' active' : '') + '" data-language-option="' + esc(kind) + '" data-language-value="' + esc(language) + '" data-language-search-value="' + esc((language + ' ' + languageIso(language)).toLowerCase()) + '"><span class="ob-language-marker">' + languageFlagHtml(language, 'ob-language-flag') + '<b>' + esc(languageIso(language)) + '</b></span><span>' + esc(language) + '</span><i aria-hidden="true">' + (on ? '✓' : '+') + '</i></button>';
      }).join('');
      var chips = selected.length ? selected.map(function (language) {
        return '<button type="button" class="ob-selected-language" data-language-remove="' + esc(kind) + '" data-language-value="' + esc(language) + '" aria-label="' + esc(tx('Remove') + ' ' + language) + '">' + languageFlagHtml(language, 'ob-selected-language-flag') + '<b>' + esc(languageIso(language)) + '</b>' + esc(language) + '<span aria-hidden="true">×</span></button>';
      }).join('') : '<span class="ob-language-empty">' + esc(tx('No language selected')) + '</span>';
      return '<section class="ob-language-picker wide" data-language-picker="' + esc(kind) + '" data-language-single="' + (single ? 'true' : 'false') + '"><div class="ob-field-heading"><div><b>' + esc(tx(title)) + '</b><small>' + esc(tx(hint || '')) + '</small></div><span>' + selected.length + (single ? '/1' : '/3') + '</span></div><div class="ob-language-search"><span aria-hidden="true">⌕</span><input type="search" data-language-search="' + esc(kind) + '" placeholder="' + esc(tx('Search language or ISO code')) + '" role="combobox" aria-label="' + esc(tx('Search language or ISO code')) + '" aria-expanded="false"></div><div class="ob-selected-languages">' + chips + '</div><div class="ob-language-results" role="listbox" hidden>' + choices + '</div>' + (selected.length ? '<button type="button" class="ob-language-clear" data-clear-language="' + esc(kind) + '">' + esc(tx('Clear selection')) + '</button>' : '') + '</section>';
    }

    function teacherTabCompletion() {
      var languageCategory = !state.category || state.category === 'languages';
      var subjects = languageCategory ? state.teachLanguages.length > 0 : state.subcategories.length > 0;
      var preferences = state.teachingFormats.length > 0 && (!languageCategory || state.teachingLevels.length > 0);
      var professional = !!(state.specialization.trim() || state.experience || state.qualifications.trim() || state.teachingApproach.trim() || state.availability.trim() || state.rate.trim());
      return { subjects: subjects, preferences: preferences, professional: professional };
    }

    function teacherTabsHtml() {
      var completion = teacherTabCompletion();
      var completed = Object.keys(completion).filter(function (key) { return completion[key]; }).length;
      var tabs = [
        { id:'subjects', label:'Subjects & Specializations' },
        { id:'preferences', label:'Teaching Preferences' },
        { id:'professional', label:'Professional Information' }
      ];
      return '<div class="ob-teacher-progress wide"><div><b>Teacher setup</b><span>' + completed + '/3 <em>' + esc(tx('sections ready')) + '</em></span></div><progress max="3" value="' + completed + '">' + completed + '/3</progress></div><div class="ob-teacher-tabs wide" role="tablist" aria-label="Teacher setup sections">' + tabs.map(function (tab, index) {
        var active = state.teacherSetupTab === tab.id;
        return '<button type="button" role="tab" aria-selected="' + active + '" class="' + (active ? 'active ' : '') + (completion[tab.id] ? 'complete' : '') + '" data-teacher-tab="' + tab.id + '"><span>' + (index + 1) + '</span><b>' + esc(tab.label) + '</b>' + (completion[tab.id] ? '<i aria-label="Complete">✓</i>' : '') + '</button>';
      }).join('') + '</div>';
    }

    function teacherSubjectsHtml() {
      var languageCategory = !state.category || state.category === 'languages';
      return '<section class="ob-teacher-panel wide" role="tabpanel"><div class="ob-teacher-panel-head"><div><h3>What do you teach?</h3><p>Choose one main category. Your selections are preserved when you switch categories.</p></div></div><div class="ob-teacher-categories">' + categoryCardsHtml('category', state.category) + '</div>' +
        (languageCategory ? languagePickerHtml('teachLanguages', state.teachLanguages, false, 'Teaching languages', 'Choose up to three languages') : '') +
        '<div class="ob-teacher-focus"><div class="ob-field-heading"><div><b>' + (languageCategory ? 'Teaching specializations' : 'Subjects & specializations') + '</b><small>Select up to three relevant areas</small></div></div><div id="ob-subcats" data-category-subjects="' + esc(state.category || 'languages') + '">' + subcatHtml() + '</div></div>' +
        '<div class="ob-teacher-panel-nav"><span>Saved locally as you work.</span><button type="button" data-teacher-next="preferences">Next: Teaching preferences →</button></div></section>';
    }

    function teacherPreferencesHtml() {
      var languageCategory = !state.category || state.category === 'languages';
      var html = '<section class="ob-teacher-panel wide" role="tabpanel"><div class="ob-teacher-panel-head"><div><h3>Teaching preferences</h3><p>Set the structure learners will see when choosing lessons.</p></div></div>';
      if (languageCategory) {
        html += languagePickerHtml('teachLanguages', state.teachLanguages, false, 'Teaching languages', 'Selected teaching subjects') +
          languagePickerHtml('nativeLanguage', state.nativeLanguage ? [state.nativeLanguage] : [], true, 'Native language', 'Choose one language') +
          languagePickerHtml('explanationLanguages', state.explanationLanguages, false, 'Explanation languages', 'Languages used to explain lessons') +
          '<div class="ob-structured-field"><div class="ob-field-heading"><div><b>Supported CEFR levels</b><small>Choose every level you currently support</small></div></div>' + chipList('teachingLevels', D.LEVELS || ['A1','A2','B1','B2','C1','C2'], state.teachingLevels) + '</div>';
      } else {
        html += '<div class="ob-selected-panel"><div class="ob-field-heading"><div><b>Selected subjects</b><small>' + esc(categoryLabel(state.category)) + '</small></div></div>' + selectedItemsSummary(state.subcategories) + '</div>' +
          '<div class="ob-preference-grid"><div class="ob-structured-field"><div class="ob-field-heading"><div><b>Skill level</b><small>Choose all that apply</small></div></div>' + chipList('teacherSkillLevels', ['Beginner','Intermediate','Advanced'], state.teacherSkillLevels) + '</div><div class="ob-structured-field"><div class="ob-field-heading"><div><b>Target audience</b><small>Who you teach</small></div></div>' + chipList('teacherAudience', ['Kids','Teens','Adults','Professionals','Teams'], state.teacherAudience) + '</div></div>';
      }
      html += '<div class="ob-structured-field"><div class="ob-field-heading"><div><b>Teaching formats</b><small>Choose at least one</small></div></div>' + chipList('teachingFormats', ['1:1','Group','LIVE','Online','Offline'], state.teachingFormats) + '</div><div class="ob-teacher-panel-nav"><button type="button" data-teacher-next="subjects">← Subjects</button><button type="button" data-teacher-next="professional">Next: Professional information →</button></div></section>';
      return html;
    }

    function teacherProfessionalHtml() {
      return '<section class="ob-teacher-panel wide" role="tabpanel"><div class="ob-teacher-panel-head"><div><h3>Professional information</h3><p>These details are optional and can be completed later in Teacher Profile.</p></div></div><div class="ob-professional-grid">' +
        labelInput('specialization', 'Teaching headline', state.specialization, { placeholder: 'For example: German speaking coach for A1–B2' }) +
        labelInput('experience', 'Years of experience', state.experience, { type: 'number', attr: 'min="0"', placeholder: 'For example: 4' }) +
        '<label class="wide">Qualifications <small>Formal qualifications are optional</small><textarea id="ob-qualifications" rows="2" placeholder="Degrees, training or relevant experience">' + esc(state.qualifications) + '</textarea></label>' +
        '<label class="wide">Teaching approach <small>How you help learners progress</small><textarea id="ob-teachingApproach" rows="2" placeholder="Describe your lesson style and methods">' + esc(state.teachingApproach) + '</textarea></label>' +
        labelInput('certificates', 'Certificates (optional)', state.certificates, { placeholder: 'Certificate names; upload is available at confirmation' }) +
        labelInput('availability', 'Availability summary', state.availability, { placeholder: 'Weekday evenings, weekends…' }) +
        labelInput('rate', 'Starting price (optional)', state.rate, { placeholder: 'For example: 25 EUR / hour' }) +
        '</div><p class="ob-verification-note">Credentials are shown as unverified until an authorized DUVELA review is completed.</p><details class="ob-advanced-settings"><summary>Advanced profile settings (optional)</summary><p>Existing values are preserved. You can also edit these later in Teacher Profile.</p><div class="ob-extra-grid">' +
        labelInput('website', 'Website', state.website, { type: 'url' }) + labelInput('verification', 'Verification notes', state.verification, { placeholder: 'Portfolio or context for later review' }) +
        labelInput('instagram', 'Instagram', state.instagram, { placeholder: '@handle or link' }) + labelInput('tiktok', 'TikTok', state.tiktok, { placeholder: '@handle or link' }) + labelInput('facebook', 'Facebook', state.facebook, { placeholder: 'Profile/page link' }) + labelInput('linkedin', 'LinkedIn', state.linkedin, { placeholder: 'Profile link' }) + labelInput('youtube', 'YouTube', state.youtube, { placeholder: 'Channel link' }) + labelInput('telegram', 'Telegram', state.telegram, { placeholder: '@handle or link' }) +
        '</div><div class="ob-advanced-interests"><b>Personal interests</b>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; }) + '</div></details><div class="ob-teacher-panel-nav"><button type="button" data-teacher-next="preferences">← Teaching preferences</button><span>Continue below when ready.</span></div></section>';
    }

    function teacherStepThreeHtml() {
      if (!state.category) state.category = 'languages';
      var panel = state.teacherSetupTab === 'preferences' ? teacherPreferencesHtml() : state.teacherSetupTab === 'professional' ? teacherProfessionalHtml() : teacherSubjectsHtml();
      return teacherTabsHtml() + panel;
    }

    function stepThreeHtml() {
      if (role === 'learner') {
        var languageCategory = !state.category || state.category === 'languages';
        var popularInterests = (D.INTERESTS || []).slice(0, 6);
        var moreInterests = (D.INTERESTS || []).slice(6);
        return '<section class="ob-learner-setup wide"><div class="ob-learner-heading"><div><h3>' + esc(tx('Your learning setup')) + '</h3><p>' + esc(tx('Choose a direction and tell DUVELA where you want to go next.')) + '</p></div><span data-save-state="local">' + esc(tx('Saved locally')) + '</span></div>' +
          '<div class="ob-field-heading"><div><b>' + esc(tx('Learning category')) + '</b><small>' + esc(tx('Fields below adapt to your selected direction')) + '</small></div></div><div class="ob-learner-categories">' + categoryCardsHtml('category', state.category) + '</div>' +
          (languageCategory ? '<div class="ob-learner-language-tabs" role="tablist"><button type="button" role="tab" data-learner-language-tab="native" class="' + (state.learnerLanguageTab === 'native' ? 'active' : '') + '">' + esc(tx('Native')) + '</button><button type="button" role="tab" data-learner-language-tab="learning" class="' + (state.learnerLanguageTab === 'learning' ? 'active' : '') + '">' + esc(tx('Learning')) + ' <b>' + state.learnLanguages.length + '/3</b></button></div><div class="ob-learner-language-grid" data-mobile-language-tab="' + esc(state.learnerLanguageTab || 'native') + '">' +
            languagePickerHtml('nativeLanguage', state.nativeLanguage ? [state.nativeLanguage] : [], true, 'Native language', 'Choose one language') +
            languagePickerHtml('learnLanguages', state.learnLanguages, false, 'Languages to learn', 'Choose up to three languages') +
            '</div><div id="ob-lang-levels">' + languageLevelsHtml() + '</div>' : generalGoalHtml()) +
          '<section class="ob-learner-interests"><div class="ob-field-heading"><div><b>' + esc(tx('Interests')) + '</b><small>' + esc(tx('Optional — helps personalize recommendations')) + '</small></div><span>' + esc(tx('Optional')) + '</span></div>' +
          chipList('interests', popularInterests, state.interests, function (it) { return it.icon + ' ' + tx(it.label); }) +
          (moreInterests.length ? '<details><summary>' + esc(tx('Show more interests')) + '</summary>' + chipList('interests', moreInterests, state.interests, function (it) { return it.icon + ' ' + tx(it.label); }) + '</details>' : '') + '</section>' + learnerSelectionSummaryHtml() + '</section>' +
          '<div id="ob-autocomplete" class="ob-autocomplete" hidden></div>';
      }
      if (role === 'teacher') {
        return teacherStepThreeHtml();
      }
      if (role === 'organizer') {
        return '<div class="ob-extra-title">Organizer profile</div><div class="ob-extra-grid">' +
          labelInput('specialization', 'Organizer headline', state.specialization, { placeholder: 'For example: Speaking clubs and culture meetups' }) +
          labelInput('capacity', 'Capacity / group size', state.capacity, { type: 'number', attr: 'min="1"', placeholder: 'For example: 20' }) +
          labelInput('website', 'Website', state.website, { type: 'url' }) +
        '</div>' +
        '<label class="wide">Organizer type<small style="font-weight:600;color:var(--muted)">Choose who organizes</small></label>' +
        organizerTypeCardsHtml() +
        '<label class="wide">Event type<small style="font-weight:600;color:var(--muted)">Choose your main event format</small></label>' +
        eventTypeCardsHtml() +
        '<label class="wide">Organizer category<small style="font-weight:600;color:var(--muted)">Choose event direction</small></label>' +
        categoryCardsHtml('category', state.category) +
        '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[state.category] ? '' : ' hidden') + '>' +
          '<label class="wide">Focus areas<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
          '<div id="ob-subcats">' + subcatHtml() + '</div>' +
        '</div>' +
        '<label class="wide">Event languages<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
        langScroll('eventLanguages', state.eventLanguages) +
        '<label class="wide">Location mode<small style="font-weight:600;color:var(--muted)">Where events happen</small></label>' +
        locationModeCardsHtml() +
        '<label class="wide">Audience<small style="font-weight:600;color:var(--muted)">Who the event is for</small></label>' +
        audienceCardsHtml() +
        '<label class="wide">Frequency<small style="font-weight:600;color:var(--muted)">How often you organize</small></label>' +
        frequencyCardsHtml() +
        '<div class="ob-extra-title">Contact / social media</div><div class="ob-extra-grid">' +
        labelInput('instagram', 'Instagram', state.instagram, { placeholder: '@handle or link' }) +
        labelInput('tiktok', 'TikTok', state.tiktok, { placeholder: '@handle or link' }) +
        labelInput('telegram', 'Telegram', state.telegram, { placeholder: '@handle or link' }) +
        labelInput('email', 'Contact email', state.email, { type: 'email', placeholder: 'hello@example.com' }) +
        '</div>' +
        labelInput('verification', 'Organizer verification', state.verification, { wide: true, placeholder: 'Past events, links, community proof, documents later' }) +
        '<label class="wide">Interests</label>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; });
      }
      // organization
      var activeOrganizationCategory = organizationActiveCategory();
      return '<div class="ob-extra-title">Organization setup</div>' +
        '<label class="wide">Organization type<small style="font-weight:600;color:var(--muted)">Choose your workspace type</small></label>' +
        orgTypeCardsHtml() +
        labelInput('specialization', 'What does your organization do?', state.specialization, { wide: true, placeholder: 'Short description for learners, teachers and partners' }) +
        '<div id="ob-org-selected" class="wide">' + organizationSelectedSummaryHtml() + '</div>' +
        '<label class="wide">Learning / business categories<small style="font-weight:600;color:var(--muted)">Choose one or more directions. Selected categories stay saved.</small></label>' +
        categoryCardsHtml('category', state.organizationCategories, activeOrganizationCategory) +
        '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[activeOrganizationCategory] ? '' : ' hidden') + '>' +
          '<label class="wide">Focus areas for ' + esc(categoryLabel(activeOrganizationCategory)) + '<small style="font-weight:600;color:var(--muted)">Optional — choose as many as needed</small></label>' +
          '<div id="ob-subcats">' + subcatHtml() + '</div>' +
        '</div>' +
        '<label class="wide">Languages / markets<small style="font-weight:600;color:var(--muted)">Optional — choose as many as needed</small></label>' +
        langScroll('organizationLanguages', state.organizationLanguages) +
        '<label class="wide">Audience<small style="font-weight:600;color:var(--muted)">Choose all that apply</small></label>' +
        organizationAudienceCardsHtml() +
        '<label class="wide">Program format<small style="font-weight:600;color:var(--muted)">Choose all that apply</small></label>' +
        organizationFormatCardsHtml() +
        '<div class="ob-extra-title">Public contacts</div><div class="ob-extra-grid">' +
        labelInput('website', 'Website', state.website, { type: 'url', placeholder: 'https://example.com' }) +
        labelInput('email', 'Public email', state.email, { type: 'email', placeholder: 'hello@example.com' }) +
        labelInput('phone', 'Public phone', state.phone, { type: 'tel', placeholder: '+49...' }) +
        labelInput('telegram', 'Telegram', state.telegram, { placeholder: '@channel or link' }) +
        labelInput('instagram', 'Instagram', state.instagram, { placeholder: '@handle or link' }) +
        labelInput('linkedin', 'LinkedIn', state.linkedin, { placeholder: 'Company page link' }) +
        '</div><div class="ob-extra-title">Business contact</div><div class="ob-extra-grid">' +
        labelInput('contactName', 'Contact name', state.contactName, { placeholder: 'Responsible person' }) +
        labelInput('contactPosition', 'Contact position', state.contactPosition, { placeholder: 'Manager, Director...' }) +
        labelInput('contactEmail', 'Contact email', state.contactEmail, { type: 'email', placeholder: 'contact@example.com' }) +
        labelInput('contactPhone', 'Contact phone', state.contactPhone, { type: 'tel', placeholder: '+49...' }) +
        '</div>' +
        labelInput('authorizedMembership', 'Authorized organization membership', state.authorizedMembership, { wide: true, placeholder: 'Your position or authorization to create this workspace' }) +
        labelInput('verification', 'Business verification', state.verification, { wide: true, placeholder: 'Registration number, website, public profile, documents later' });
    }

    // Horizontal flag-scroll of languages (kind = learnLanguages | teachLanguages).
    function langScroll(kind, selected) {
      return '<div class="ob-lang-scroll" data-chip-group="' + kind + '">' + (D.LANGUAGES || []).map(function (l) {
        var on = selected.indexOf(l) !== -1;
        var img = D.flagImg ? D.flagImg(l) : '';
        // Image flag renders everywhere; fall back to the country code (which is
        // what emoji flags degrade to on Windows anyway) if the image fails.
        var flag = img
          ? '<img class="ob-flag-img" src="' + img + '" alt="" loading="lazy" data-flag-code="' + esc((D.flagCode ? D.flagCode(l) : '').toUpperCase()) + '">'
          : '<span class="ob-flag-code">' + esc((D.flagCode ? D.flagCode(l) : '').toUpperCase()) + '</span>';
        return '<button type="button" class="ob-lang-chip' + (on ? ' active' : '') + '" data-chip="' + kind + '" data-value="' + esc(l) + '">' +
          flag + '<span>' + esc(l) + '</span></button>';
      }).join('') + '</div>';
    }

    function nativeLanguagePickerHtml() {
      return '<label class="wide">Native language<small style="font-weight:600;color:var(--muted)">Choose one</small></label>' +
        langScroll('nativeLanguage', state.nativeLanguage ? [state.nativeLanguage] : []);
    }

    function languageLimitCounter(kind, selected) {
      return '<div class="ob-selection-head ob-lang-counter" data-lang-counter="' + esc(kind) + '"><span></span><b>' + selected.length + '/3 selected</b></div>';
    }

    function categoryCardsHtml(kind, selected, current) {
      return '<div class="ob-category-grid wide" data-category-group="' + kind + '">' + (D.CATEGORIES || []).map(function (it) {
        var on = Array.isArray(selected) ? selected.indexOf(it.id) !== -1 : (selected === it.id || (!selected && it.id === 'languages'));
        var editing = Array.isArray(selected) && current === it.id;
        var iconText = categoryIcons[it.id] || '*';
        return '<button type="button" class="ob-category-card' + (on ? ' active' : '') + (editing ? ' editing' : '') + '" data-category-card="' + esc(it.id) + '"><span>' + esc(iconText) + '</span><b>' + esc(it.label) + '</b>' + (editing ? '<small>Editing focus areas</small>' : '') + '</button>';
      }).join('') + '</div>';
    }

    function optionCardsHtml(kind, selected, items) {
      return '<div class="ob-option-grid wide" data-option-group="' + kind + '">' + items.map(function (it) {
        var on = Array.isArray(selected) ? selected.indexOf(it.id) !== -1 : selected === it.id;
        return '<button type="button" class="ob-option-card' + (on ? ' active' : '') + '" data-option-kind="' + esc(kind) + '" data-option-value="' + esc(it.id) + '"><span>' + esc(it.icon || '') + '</span><b>' + esc(it.label) + '</b><small>' + esc(it.hint || '') + '</small></button>';
      }).join('') + '</div>';
    }

    function orgTypeCardsHtml() {
      return optionCardsHtml('orgType', state.orgType, [
        { id: 'school', label: 'School', icon: '🏫', hint: 'Formal learning' },
        { id: 'academy', label: 'Academy', icon: '🎓', hint: 'Courses and tutors' },
        { id: 'company', label: 'Company', icon: '🏢', hint: 'Team training' },
        { id: 'ngo', label: 'NGO', icon: '🤝', hint: 'Community education' },
        { id: 'community', label: 'Community', icon: '🌐', hint: 'Local groups' }
      ]);
    }

    function organizerTypeCardsHtml() {
      return optionCardsHtml('organizerType', state.organizerType, [
        { id: 'individual', label: 'Individual', icon: '👤', hint: 'Solo organizer' },
        { id: 'community', label: 'Community', icon: '🌐', hint: 'Local group' },
        { id: 'academy', label: 'School/Academy', icon: '🎓', hint: 'Learning provider' },
        { id: 'company', label: 'Company', icon: '🏢', hint: 'Team events' },
        { id: 'nonprofit', label: 'Non-profit', icon: '🤝', hint: 'Open programs' }
      ]);
    }

    function eventTypeCardsHtml() {
      return optionCardsHtml('eventType', state.eventType, [
        { id: 'meetup', label: 'Meetup', icon: '📍', hint: 'Community gathering' },
        { id: 'workshop', label: 'Workshop', icon: '🛠️', hint: 'Hands-on practice' },
        { id: 'speaking_club', label: 'Speaking club', icon: '💬', hint: 'Conversation' },
        { id: 'live_session', label: 'Live session', icon: '🎥', hint: 'Online live' },
        { id: 'challenge', label: 'Challenge', icon: '🏁', hint: 'Goal-based' },
        { id: 'course_event', label: 'Course event', icon: '📚', hint: 'Class session' }
      ]);
    }

    function locationModeCardsHtml() {
      return optionCardsHtml('locationMode', state.locationMode, [
        { id: 'online', label: 'Online', icon: '💻', hint: 'Remote events' },
        { id: 'offline', label: 'Offline', icon: '📍', hint: 'In person' },
        { id: 'hybrid', label: 'Hybrid', icon: '🔁', hint: 'Both modes' }
      ]);
    }

    function organizationAudienceCardsHtml() {
      return optionCardsHtml('organizationAudience', state.organizationAudience, [
        { id: 'employees', label: 'Employees', icon: '\uD83D\uDC65', hint: 'Internal training' },
        { id: 'students', label: 'Students', icon: '\uD83C\uDF93', hint: 'School or academy' },
        { id: 'teachers', label: 'Teachers', icon: '\uD83E\uDDD1\u200D\uD83C\uDFEB', hint: 'Tutor team' },
        { id: 'clients', label: 'Clients', icon: '\uD83E\uDD1D', hint: 'Customer education' },
        { id: 'community', label: 'Community', icon: '\uD83C\uDF10', hint: 'Open programs' },
        { id: 'families', label: 'Families', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', hint: 'Family learning' }
      ]);
    }

    function organizationFormatCardsHtml() {
      return optionCardsHtml('programFormat', state.programFormat, [
        { id: 'online', label: 'Online', icon: '\uD83D\uDCBB', hint: 'Remote learning' },
        { id: 'offline', label: 'Offline', icon: '\uD83D\uDCCD', hint: 'In person' },
        { id: 'hybrid', label: 'Hybrid', icon: '\uD83D\uDD01', hint: 'Both modes' },
        { id: 'courses', label: 'Courses', icon: '\uD83D\uDCDA', hint: 'Structured programs' },
        { id: 'events', label: 'Events', icon: '\uD83D\uDCC5', hint: 'Workshops/LIVE' },
        { id: 'custom', label: 'Custom', icon: '\u2699\uFE0F', hint: 'Flexible setup' }
      ]);
    }
    function audienceCardsHtml() {
      return optionCardsHtml('audience', state.audience, [
        { id: 'learners', label: 'Learners', icon: '🎒', hint: 'Students' },
        { id: 'teachers', label: 'Teachers', icon: '🧑‍🏫', hint: 'Educators' },
        { id: 'kids', label: 'Kids', icon: '🧒', hint: 'Children' },
        { id: 'adults', label: 'Adults', icon: '🧑', hint: 'Adult learners' },
        { id: 'teams', label: 'Teams', icon: '👥', hint: 'Companies' },
        { id: 'families', label: 'Families', icon: '👨‍👩‍👧', hint: 'Family groups' }
      ]);
    }

    function frequencyCardsHtml() {
      return optionCardsHtml('frequency', state.frequency, [
        { id: 'one_time', label: 'One-time', icon: '①', hint: 'Single event' },
        { id: 'weekly', label: 'Weekly', icon: '📅', hint: 'Every week' },
        { id: 'monthly', label: 'Monthly', icon: '🗓️', hint: 'Every month' },
        { id: 'custom', label: 'Custom', icon: '⚙️', hint: 'Flexible' }
      ]);
    }

    function langHint() {
      return (!state.category || state.category === 'languages') ? 'Choose up to 3' : 'Optional — choose up to 3';
    }

    function subcatHtml() {
      var category = role === 'organization' ? organizationActiveCategory() : state.category;
      var subs = (D.SUBCATEGORIES || {})[category];
      if (!subs) return '';
      var counter = role === 'organization' ? (state.subcategories.length + ' selected') : (state.subcategories.length + '/3 selected');
      return '<div class="ob-selection-head"><span>Focus areas</span><b id="ob-subcat-count">' + counter + '</b></div>' + chipList('subcategories', subs, state.subcategories, function (item) { return (subcategoryIcons[item] || '✦') + ' ' + tx(item); }) + '<button type="button" class="ob-clear-selection" data-clear-selection="subcategories">Clear selection</button>';
    }

    function languageLevelsHtml() {
      if (!state.learnLanguages.length) return '';
      var currentOptions = ['Not assessed', 'Beginner'].concat(D.LEVELS || ['A1','A2','B1','B2','C1','C2']);
      return '<div class="ob-summary-title">' + esc(tx('Current and target levels')) + '</div><div class="ob-lang-goals-grid">' + state.learnLanguages.map(function (lang) {
        var currentLevel = state.languageLevels[lang] || 'Not assessed';
        var targetLevel = normalizeLearnerTarget(state.goalLevels[lang], currentLevel);
        var recommendation = recommendedLearnerTarget(currentLevel);
        return '<section class="ob-lang-goal-card" aria-label="' + esc(lang) + '"><div class="ob-lang-goal-title">' + languageFlagHtml(lang, 'ob-selected-language-flag') + '<b>' + esc(tx('Learning plan')) + '</b><small>' + esc(languageIso(lang)) + ' · ' + esc(tx(currentLevel)) + ' → ' + esc(targetLevel) + '</small></div>' +
          '<label class="ob-lang-level">' + esc(tx('Current level')) + '<select data-lang-level="' + esc(lang) + '">' + currentOptions.map(function (l) {
            return '<option value="' + esc(l) + '"' + (l === currentLevel ? ' selected' : '') + '>' + esc(tx(l)) + '</option>';
          }).join('') + '</select></label>' +
          '<label class="ob-lang-level">' + esc(tx('Target level')) + '<select data-lang-goal-level="' + esc(lang) + '">' + (D.LEVELS || ['A1','A2','B1','B2','C1','C2']).map(function (l) {
            return '<option' + (l === targetLevel ? ' selected' : '') + '>' + l + '</option>';
          }).join('') + '</select></label><div class="ob-level-recommendation"><span>' + esc(tx('Recommended next step:')) + ' <b>' + esc(recommendation) + '</b></span>' + (targetLevel !== recommendation ? '<button type="button" data-use-level-recommendation="' + esc(lang) + '" data-recommended-level="' + esc(recommendation) + '">' + esc(tx('Use recommendation')) + '</button>' : '') + '</div><label class="ob-learning-focus">' + esc(tx('Learning focus')) + ' <small>' + esc(tx('Optional')) + '</small><input data-lang-goal="' + esc(lang) + '" value="' + esc(state.languageGoals[lang] || '') + '" placeholder="' + esc(tx('Speaking, grammar, exam preparation…')) + '"></label></section>';
      }).join('') + '</div>';
    }

    function recommendedLearnerTarget(currentLevel) {
      var levels = D.LEVELS || ['A1','A2','B1','B2','C1','C2'];
      var current = String(currentLevel || 'Not assessed').toUpperCase();
      var index = levels.indexOf(current);
      if (index < 0) return levels[0] || 'A1';
      return levels[Math.min(index + 1, levels.length - 1)] || current;
    }

    function normalizeLearnerTarget(value, currentLevel) {
      var levels = D.LEVELS || ['A1','A2','B1','B2','C1','C2'];
      var target = String(value || '').toUpperCase();
      if (levels.indexOf(target) !== -1) return target;
      var current = String(currentLevel || '').toUpperCase();
      return levels.indexOf(current) !== -1 ? current : 'A1';
    }

    function generalGoalKey() {
      return 'category:' + (state.category || 'languages');
    }

    function generalGoalHtml() {
      var subjectLabel = state.category === 'digital' ? 'Subject' : state.category === 'art' ? 'Discipline' : 'Relevant subject';
      return '<section id="ob-general-goal" class="ob-general-learning"><div class="ob-field-heading"><div><b>' + esc(tx(subjectLabel)) + '</b><small>' + esc(tx('Choose up to three areas')) + '</small></div></div><label class="ob-subject-search"><span aria-hidden="true">⌕</span><input type="search" data-subject-search placeholder="' + esc(tx('Search subjects')) + '" aria-label="' + esc(tx('Search subjects')) + '"></label><div id="ob-subcats">' + subcatHtml() + '</div>' +
        '<div class="ob-field-heading"><div><b>' + esc(tx('Current experience')) + '</b><small>' + esc(tx('Select the closest match')) + '</small></div></div>' + optionCardsHtml('learnerExperience', state.learnerExperience, [
          { id:'beginner', label:'Beginner', icon:'🌱', hint:'Starting now' }, { id:'some', label:'Some experience', icon:'📘', hint:'Know the basics' }, { id:'intermediate', label:'Intermediate', icon:'📈', hint:'Building skill' }, { id:'advanced', label:'Advanced', icon:'⭐', hint:'Deepening expertise' }
        ]) +
        '<label class="wide ob-learning-outcome">' + esc(tx('Desired outcome')) + '<small>' + esc(tx('What would you like to achieve?')) + '</small><textarea id="ob-learningOutcome" rows="2" placeholder="' + esc(tx('For example: build my first website or improve my drawing technique')) + '">' + esc(state.learningOutcome) + '</textarea></label></section>';
    }

    function learnerSelectionSummaryHtml() {
      var languagesCategory = !state.category || state.category === 'languages';
      var items = languagesCategory ? state.learnLanguages.map(function (lang) {
        var current = state.languageLevels[lang] || 'Not assessed';
        return languageFlagHtml(lang, 'ob-selected-language-flag') + '<span>' + esc(tx(lang)) + ' · ' + esc(tx(current)) + ' → ' + esc(normalizeLearnerTarget(state.goalLevels[lang], current)) + '</span>';
      }) : state.subcategories.map(function (subject) { return '<span>' + esc(subject) + '</span>'; });
      var category = categoryLabel(state.category || 'languages');
      return '<section class="ob-learner-summary" aria-label="' + esc(tx('Selection summary')) + '"><div><b>' + esc(tx('Selection summary')) + '</b><small>' + esc(tx('Ready for Continue')) + '</small></div><span class="ob-summary-category">' + esc(tx(category)) + '</span><div class="ob-summary-items">' + (items.length ? items.map(function (item) { return '<span class="ob-summary-chip">' + item + '</span>'; }).join('') : '<span class="muted">' + esc(tx('No selection yet')) + '</span>') + '</div>' + (state.interests.length ? '<span class="ob-summary-meta">' + state.interests.length + ' ' + esc(tx('Interests')) + '</span>' : '') + '</section>';
    }

    function selectedLanguageSummary(list) {
      var langs = list || state.learnLanguages;
      if (!langs.length) return '<span class="muted">No language selected</span>';
      return langs.map(function (lang) {
        var currentLevel = state.languageLevels[lang] || 'Not assessed';
        var targetLevel = normalizeLearnerTarget(state.goalLevels[lang], currentLevel);
        return '<span class="ob-preview-pill">' + esc(tx(lang)) + ' ' + esc(tx(currentLevel)) + ' → ' + esc(targetLevel) + '</span>';
      }).join('');
    }
    function selectedItemsSummary(items) {
      if (!items || !items.length) return '<span class="muted">Nothing selected</span>';
      return items.map(function (x) { return '<span class="ob-preview-pill">' + esc(x) + '</span>'; }).join('');
    }

    function interestLabels() {
      return state.interests.map(function (id) {
        var found = (D.INTERESTS || []).filter(function (it) { return it.id === id; })[0];
        return found ? found.label : id;
      });
    }

    function categoryLabel(id) {
      var found = (D.CATEGORIES || []).filter(function (it) { return it.id === id; })[0];
      return found ? found.label : (id || 'Languages');
    }

    function organizationActiveCategory() {
      var selected = state.organizationCategories.length ? state.organizationCategories : ['languages'];
      return selected.indexOf(state.category) !== -1 ? state.category : selected[0];
    }

    function saveActiveOrganizationFocusAreas() {
      var category = organizationActiveCategory();
      state.organizationSubcategories[category] = state.subcategories.slice();
    }

    function organizationFocusItems() {
      saveActiveOrganizationFocusAreas();
      var items = [];
      state.organizationCategories.forEach(function (category) {
        (state.organizationSubcategories[category] || []).forEach(function (focus) {
          items.push(categoryLabel(category) + ': ' + focus);
        });
      });
      return items;
    }

    function organizationCategoryPillsHtml() {
      var canRemove = state.organizationCategories.length > 1;
      return state.organizationCategories.map(function (category) {
        return '<button type="button" class="ob-preview-pill ob-removable-pill" data-remove-organization-category="' + esc(category) + '"' + (canRemove ? '' : ' disabled aria-disabled="true"') + '>' +
          esc(categoryLabel(category)) + (canRemove ? '<span aria-hidden="true">×</span>' : '') +
        '</button>';
      }).join('');
    }

    function organizationSelectedSummaryHtml() {
      var focusItems = organizationFocusItems();
      var items = [];
      focusItems.forEach(function (x) { items.push('Focus: ' + x); });
      state.organizationLanguages.forEach(function (x) { items.push('Market: ' + x); });
      state.organizationAudience.forEach(function (x) { items.push('Audience: ' + x); });
      state.programFormat.forEach(function (x) { items.push('Format: ' + x); });
      var total = state.organizationCategories.length + items.length;
      return '<section class="ob-selected-panel"><div class="ob-selection-head"><span>Selected directions</span><b>' + total + ' selected</b></div>' +
        '<div class="ob-selected-categories">' + organizationCategoryPillsHtml() + '</div>' +
        '<div>' + (items.length ? selectedItemsSummary(items) : '<span class="muted">Add focus areas, languages / markets, audience and format. Click a category below to edit its focus areas.</span>') + '</div>' +
      '</section>';
    }

    function profilePreviewHtml() {
      var name = role === 'organization' ? state.orgName : [state.firstName, state.lastName].filter(Boolean).join(' ');
      var category = (D.CATEGORIES || []).filter(function (c) { return c.id === (state.category || 'languages'); })[0];
      var categoryTitle = role === 'organization' ? 'Organization type' : (role === 'organizer' ? 'Event direction' : 'Category');
      var categoryValue = role === 'organization' ? (state.orgType || 'Not set') : (category ? category.label : 'Languages');
      var goalTitle = role === 'organization' ? 'Description' : (role === 'organizer' ? 'Event type' : 'Goal');
      var learnerPrimaryLanguage = state.learnLanguages[0] || '';
      var learnerGoalValue = (state.category || 'languages') === 'languages'
        ? (learnerPrimaryLanguage ? normalizeLearnerTarget(state.goalLevels[learnerPrimaryLanguage], state.languageLevels[learnerPrimaryLanguage] || 'Not assessed') : 'Not set')
        : (state.learningOutcome || 'Not set');
      var goalValue = role === 'organization' ? (state.specialization || 'Not set') : (role === 'organizer' ? (state.eventType || state.specialization || 'Not set') : (role === 'teacher' ? (state.specialization || state.subcategories.join(', ') || state.teachLanguages.join(', ') || 'Not set') : learnerGoalValue));
      var socialItems = [state.instagram, state.tiktok, state.facebook, state.linkedin, state.youtube, state.telegram].filter(Boolean);
      var organizerContact = [state.website, state.email, state.instagram, state.tiktok, state.telegram].filter(Boolean);
      var organizationDirections = role === 'organization' ? state.organizationCategories.map(categoryLabel) : [];
      var organizationFocus = role === 'organization' ? organizationFocusItems() : [];
      var verificationStatus = role === 'organization' ? (state.verification.trim() ? 'Pending verification' : 'Not verified yet') : '';
      var avatar = state.avatarPreview ? '<img src="' + esc(state.avatarPreview) + '" alt="">' : '<span>' + esc((name || 'D').charAt(0).toUpperCase()) + '</span>';
      return '<div class="wide ob-profile-preview">' +
        '<div class="ob-preview-head ob-preview-head-plain"><div class="ob-preview-avatar">' + avatar + '</div><div><h3>' + esc(name || 'Your profile') + '</h3><p>' + esc([state.city, state.country].filter(Boolean).join(', ') || 'Location not set') + '</p></div></div>' +
        '<div class="ob-preview-grid">' +
          '<div><b>Role</b><p>' + esc((copy[role] || copy.learner)[0]) + '</p></div>' +
          '<div><b>' + esc(categoryTitle) + '</b><p>' + esc(categoryValue) + '</p></div>' +
          '<div><b>' + esc(goalTitle) + '</b><p>' + esc(goalValue) + '</p></div>' +
          '<div><b>' + esc(role === 'organization' ? 'Program format' : 'Native language') + '</b><p>' + esc(role === 'organization' ? (state.programFormat.join(', ') || 'Not set') : (state.nativeLanguage || 'Not set')) + '</p></div>' +
        '</div>' +
        (role === 'learner' && (state.category || 'languages') === 'languages' ? '<div class="ob-preview-section"><b>Selected languages and levels</b><div>' + selectedLanguageSummary(state.learnLanguages) + '</div></div>' : '') +
        (role === 'learner' && (state.category || 'languages') !== 'languages' ? '<div class="ob-preview-section"><b>Learning setup</b><div>' + selectedItemsSummary(state.subcategories.concat(state.learnerExperience ? [state.learnerExperience] : [])) + '</div></div><div class="ob-preview-section"><b>Desired outcome</b><p>' + esc(state.learningOutcome || 'Not set') + '</p></div>' : '') +
        (role === 'teacher' && state.teachLanguages.length ? '<div class="ob-preview-section"><b>Languages you teach</b><div>' + selectedItemsSummary(state.teachLanguages) + '</div></div>' : '') +
        (role === 'teacher' && socialItems.length ? '<div class="ob-preview-section"><b>Social media</b><div>' + selectedItemsSummary(socialItems) + '</div></div>' : '') +
        (role === 'organizer' ? '<div class="ob-preview-section"><b>Organizer setup</b><div>' + selectedItemsSummary([state.organizerType, state.locationMode, state.audience, state.frequency, state.capacity ? ('Capacity ' + state.capacity) : ''].filter(Boolean)) + '</div></div>' : '') +
        (role === 'organizer' && state.eventLanguages.length ? '<div class="ob-preview-section"><b>Event languages</b><div>' + selectedItemsSummary(state.eventLanguages) + '</div></div>' : '') +
        (role === 'organizer' && organizerContact.length ? '<div class="ob-preview-section"><b>Contact / social</b><div>' + selectedItemsSummary(organizerContact) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Organization setup</b><div>' + selectedItemsSummary([state.specialization].concat(state.organizationAudience, state.programFormat).filter(Boolean)) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Learning directions</b><div>' + selectedItemsSummary(organizationDirections) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Verification status</b><div>' + selectedItemsSummary([verificationStatus]) + '</div></div>' : '') +
        (role === 'organization' && state.organizationLanguages.length ? '<div class="ob-preview-section"><b>Languages / markets</b><div>' + selectedItemsSummary(state.organizationLanguages) + '</div></div>' : '') +
        (role === 'organization' && socialItems.length ? '<div class="ob-preview-section"><b>Social media</b><div>' + selectedItemsSummary(socialItems) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Business contacts</b><div>' + selectedItemsSummary([state.website, state.email, state.phone, state.contactName, state.contactEmail].filter(Boolean)) + '</div></div>' : '') +
        (role !== 'learner' ? '<div class="ob-preview-section"><b>Focus areas</b><div>' + selectedItemsSummary(role === 'organization' ? organizationFocus : state.subcategories) + '</div></div>' : '') +
        (role !== 'organization' ? '<div class="ob-preview-section"><b>Interests</b><div>' + selectedItemsSummary(interestLabels()) + '</div></div>' : '') +
        (role !== 'learner' ? '<label class="ob-preview-section"><b>Optional verification document</b><p>If you want a verified badge, upload a qualification, license or organization document. Your account role stays the same.</p><input id="ob-verificationFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></label>' : '') +
      '</div>';
    }

    function stepOneHtml() {
      var summary = role ? (roleSummary[role] || roleSummary.learner) : {
        title: 'Choose your role',
        body: 'Select how you want to use Duvela. The next steps will match this choice.',
        best: ['Learner Hub', 'Teacher workspace', 'Organizer tools', 'Organization profile']
      };
      var next = role === 'organization'
        ? ['Business details', 'Learning directions', 'Preview and save']
        : role === 'organizer'
          ? ['Profile details', 'Event setup', 'Preview and save']
          : role === 'teacher'
            ? ['Profile details', 'Teaching setup', 'Preview and save']
            : ['Profile details', 'Learning setup', 'Preview and save'];
      return '<div class="ob-role-info wide">' +
        '<section class="ob-role-summary"><div class="ob-role-summary-icon">' + esc(icon[role]) + '</div><h3>' + esc(summary.title) + '</h3><p>' + esc(summary.body) + '</p><ul>' +
          summary.best.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ul><small>' + esc('Choose once, then continue to your matching setup.') + '</small></section>' +
        '<section class="ob-next-steps"><h3>What happens next</h3><ol>' +
          next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ol><p class="ob-account-note">One account can later access multiple spaces.</p></section>' +
      '</div>';
    }

    function enforceSelectionLimits() {
      state.learnLanguages = state.learnLanguages.slice(0, 3);
      state.teachLanguages = state.teachLanguages.slice(0, 3);
      state.eventLanguages = state.eventLanguages.slice(0, 3);
      if (role !== 'organization') state.subcategories = state.subcategories.slice(0, 3);
      var allowed = {};
      state.learnLanguages.forEach(function (language) { allowed[language] = true; });
      Object.keys(state.languageLevels || {}).forEach(function (language) { if (!allowed[language]) delete state.languageLevels[language]; });
      Object.keys(state.goalLevels || {}).forEach(function (target) { if (target.indexOf('category:') !== 0 && !allowed[target]) delete state.goalLevels[target]; });
      Object.keys(state.languageGoals || {}).forEach(function (target) { if (target.indexOf('category:') !== 0 && !allowed[target]) delete state.languageGoals[target]; });
    }

    function bindLanguageGoalFields() {
      form.querySelectorAll('[data-lang-level]').forEach(function (sel) {
        sel.onchange = function () {
          state.languageLevels[sel.dataset.langLevel] = sel.value;
          if (!state.goalLevels[sel.dataset.langLevel]) state.goalLevels[sel.dataset.langLevel] = recommendedLearnerTarget(sel.value);
          showError('', '');
          saveDraft('Learning level saved locally.');
          var box = $('#ob-lang-levels'); if (box) { box.innerHTML = languageLevelsHtml(); bindLanguageGoalFields(); }
        };
      });
      form.querySelectorAll('[data-lang-goal-level]').forEach(function (sel) {
        sel.onchange = function () {
          state.goalLevels[sel.dataset.langGoalLevel] = normalizeLearnerTarget(sel.value, 'A1');
          if (sel.dataset.langGoalLevel === generalGoalKey()) state.goal = state.goalLevels[sel.dataset.langGoalLevel];
          showError('', '');
          saveDraft('Learning goal saved locally.');
        };
      });
      form.querySelectorAll('[data-lang-goal]').forEach(function (input) {
        input.oninput = function () {
          state.languageGoals[input.dataset.langGoal] = input.value;
          if (input.dataset.langGoal === generalGoalKey()) state.goal = input.value;
        };
      });
      form.querySelectorAll('[data-use-level-recommendation]').forEach(function (button) {
        button.onclick = function () {
          state.goalLevels[button.dataset.useLevelRecommendation] = button.dataset.recommendedLevel;
          saveDraft('Learning goal saved locally.');
          var box = $('#ob-lang-levels'); if (box) { box.innerHTML = languageLevelsHtml(); bindLanguageGoalFields(); }
        };
      });
    }

    function render() {
      enforceSelectionLimits();
      title();
      document.querySelectorAll('.onboarding-step').forEach(function (x, i) {
        x.className = 'onboarding-step ' + (i + 1 <= step ? 'active' : '');
      });
      var rolesBox = $('#onboardingRoles');
      var roleContext = $('#onboardingRoleContext');
      if (roleContext) roleContext.innerHTML = roleContextHtml();
      rolesBox.hidden = !(step === 1 && minStep <= 1);
      rolesBox.style.display = step === 1 && minStep <= 1 ? 'grid' : 'none';
      rolesBox.innerHTML = roles.map(function (r) {
        var disabled = roleLocked && r !== role ? ' disabled aria-disabled="true"' : '';
        return '<button type="button" class="' + (r === role ? 'active' : '') + '" data-ob-role="' + r + '"' + disabled + '><span class="role-icon">' + esc(icon[r]) + '</span><b>' + esc(copy[r][0]) + '</b><small>' + esc(copy[r][1]) + '</small><em class="role-selected">Selected</em></button>';
      }).join('');

      var html = '';
      if (step === 1) html = stepOneHtml();
      // Wrap in .wide so the structural divs span the full grid width and lay
      // out as normal block flow (the form itself is a 2-column grid).
      if (step === 2) html = '<div class="wide ob-section">' + stepTwoHtml() + '</div>';
      if (step === 3) html = '<div class="wide ob-section">' + stepThreeHtml() + '</div>';
      if (step === 4) html = '<div class="onboarding-welcome wide" style="text-align:center;padding:22px"><div style="font-size:48px">✨</div><h3 style="font-size:24px;margin:10px 0">Profile ready!</h3><p>Your Duvela space is personalised for ' + esc((copy[role] || copy.learner)[0]) + '. You can edit everything later in Profile.</p></div>';
      if (step === 4) html = profilePreviewHtml();
      form.innerHTML = html;
      localizeRendered(form);
      localizeRendered(rolesBox);
      localizeRendered($('#onboardingAccountMenu'));
      $('#onboardingBack').textContent = tx('← Back');

      rolesBox.querySelectorAll('[data-ob-role]').forEach(function (b) {
        b.onclick = function () { if (roleLocked) return; role = b.dataset.obRole; draftDirty = true; saveDraft('Workspace selection saved.'); render(); };
      });
      $('#onboardingBack').style.display = step > minStep ? 'inline-flex' : 'none';
      setSaveStatus(step === 4 ? 'local' : saveStatus, step === 4 ? tx('Nothing changes until server confirmation.') : tx('Draft saved locally.'));
      bindStep();
      form.oninput = function () {
        draftDirty = true;
        setSaveStatus('dirty', tx('Unsaved changes'));
        if (step === 2) {
          collect();
          var appearanceName = form.querySelector('[data-appearance-name]');
          var appearanceLocation = form.querySelector('[data-appearance-location]');
          var currentName = role === 'organization' ? state.orgName : [state.firstName, state.lastName].filter(Boolean).join(' ');
          if (appearanceName) appearanceName.textContent = currentName.trim() || 'Your name';
          if (appearanceLocation) appearanceLocation.textContent = [state.city, state.country].filter(Boolean).join(', ') || 'City, country';
        }
      };
      form.onchange = function () { collect(); draftDirty = true; saveDraft(); };
    }

    function showError(message, target) {
      message = message ? tx(message) : '';
      $('#onboardingError').textContent = target ? '' : (message || '');
      form.querySelectorAll('.ob-field-error').forEach(function (x) { x.remove(); });
      form.querySelectorAll('.ob-invalid').forEach(function (x) { x.classList.remove('ob-invalid'); });
      if (!message || !target) return;
      var el = $('#ob-' + target) || form.querySelector('[data-chip-group="' + target + '"]') || form.querySelector('[data-language-picker="' + target + '"]') || form.querySelector('[data-category-group="' + target + '"]') || form.querySelector('[data-option-group="' + target + '"]');
      if (!el) return;
      var host = el.closest('label') || el;
      host.classList.add('ob-invalid');
      host.insertAdjacentHTML('afterend', '<div class="ob-field-error wide">' + esc(message) + '</div>');
      if (!el.matches('input,select,textarea,button,[tabindex]')) el.setAttribute('tabindex', '-1');
      requestAnimationFrame(function () {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); } catch (_) {}
      });
    }

    function removeOrganizationCategory(category) {
      if (state.organizationCategories.length <= 1) return;
      saveActiveOrganizationFocusAreas();
      state.organizationCategories = state.organizationCategories.filter(function (item) { return item !== category; });
      delete state.organizationSubcategories[category];
      if (state.category === category || state.organizationCategories.indexOf(state.category) === -1) {
        state.category = state.organizationCategories[0];
        state.subcategories = (state.organizationSubcategories[state.category] || []).slice();
      }
      render();
    }

    function bindOrganizationSummary() {
      form.querySelectorAll('[data-remove-organization-category]').forEach(function (btn) {
        btn.onclick = function () { removeOrganizationCategory(btn.dataset.removeOrganizationCategory); };
      });
    }

    function setTeacherLanguage(kind, language, remove) {
      var single = kind === 'nativeLanguage';
      var list = single ? (state.nativeLanguage ? [state.nativeLanguage] : []) : (kind === 'teachLanguages' ? state.teachLanguages : (kind === 'learnLanguages' ? state.learnLanguages : state.explanationLanguages));
      var index = list.indexOf(language);
      if (!remove && role === 'learner' && ((kind === 'nativeLanguage' && state.learnLanguages.indexOf(language) !== -1) || (kind === 'learnLanguages' && state.nativeLanguage === language))) {
        showError('Your native language cannot also be a learning language.', kind);
        return;
      }
      if (single) state.nativeLanguage = remove || index !== -1 ? '' : language;
      else if (remove || index !== -1) {
        list.splice(index, 1);
        if (kind === 'learnLanguages') { delete state.languageLevels[language]; delete state.goalLevels[language]; delete state.languageGoals[language]; }
      }
      else if (list.length < 3) {
        list.push(language);
        if (kind === 'learnLanguages') { state.languageLevels[language] = state.languageLevels[language] || 'Not assessed'; state.goalLevels[language] = state.goalLevels[language] || recommendedLearnerTarget(state.languageLevels[language]); }
      }
      else { showError('Choose up to 3 languages.', kind); return; }
      showError('', '');
      draftDirty = true;
      saveDraft(role === 'learner' ? 'Learning setup saved locally.' : 'Teacher setup saved locally.');
      render();
    }

    function bindTeacherStep() {
      form.querySelectorAll('[data-learner-language-tab]').forEach(function (button) {
        button.onclick = function () {
          state.learnerLanguageTab = button.dataset.learnerLanguageTab;
          render();
        };
      });
      form.querySelectorAll('[data-teacher-tab],[data-teacher-next]').forEach(function (button) {
        button.onclick = function () {
          collect();
          state.teacherSetupTab = button.dataset.teacherTab || button.dataset.teacherNext;
          draftDirty = true;
          saveDraft('Teacher setup section saved locally.');
          render();
        };
      });
      form.querySelectorAll('[data-language-option]').forEach(function (button) {
        button.onclick = function () { setTeacherLanguage(button.dataset.languageOption, button.dataset.languageValue, false); };
      });
      form.querySelectorAll('[data-language-remove]').forEach(function (button) {
        button.onclick = function () { setTeacherLanguage(button.dataset.languageRemove, button.dataset.languageValue, true); };
      });
      form.querySelectorAll('[data-clear-language]').forEach(function (button) {
        button.onclick = function () {
          var kind = button.dataset.clearLanguage;
          if (kind === 'nativeLanguage') state.nativeLanguage = '';
          else if (kind === 'teachLanguages') state.teachLanguages = [];
          else if (kind === 'learnLanguages') { state.learnLanguages = []; state.languageLevels = {}; state.goalLevels = {}; state.languageGoals = {}; }
          else if (kind === 'explanationLanguages') state.explanationLanguages = [];
          draftDirty = true;
          saveDraft('Language selection cleared locally.');
          render();
        };
      });
      form.querySelectorAll('[data-language-search]').forEach(function (input) {
        var picker = input.closest('[data-language-picker]');
        var results = picker.querySelector('.ob-language-results');
        function openResults() { picker.classList.add('is-open'); if (results) results.hidden = false; input.setAttribute('aria-expanded', 'true'); }
        function closeResults() { picker.classList.remove('is-open'); if (results) results.hidden = true; input.setAttribute('aria-expanded', 'false'); }
        function visibleChoices() { return Array.from(picker.querySelectorAll('[data-language-search-value]:not([hidden])')); }
        input.onfocus = openResults;
        input.oninput = function () {
          openResults();
          var query = input.value.trim().toLowerCase();
          picker.querySelectorAll('[data-language-search-value]').forEach(function (choice) {
            choice.hidden = !!query && choice.dataset.languageSearchValue.indexOf(query) === -1;
          });
          input.setAttribute('aria-expanded', visibleChoices().length ? 'true' : 'false');
        };
        input.onkeydown = function (event) {
          var visible = visibleChoices();
          if (!visible.length) return;
          if (event.key === 'ArrowDown') { event.preventDefault(); visible[0].focus(); }
          if (event.key === 'Enter' && visible.length === 1) { event.preventDefault(); visible[0].click(); }
        };
        picker.addEventListener('focusout', function () { setTimeout(function () { if (!picker.contains(document.activeElement)) closeResults(); }, 0); });
      });
      form.querySelectorAll('.ob-language-choice').forEach(function (choice) {
        choice.onkeydown = function (event) {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          var visible = Array.from(choice.closest('.ob-language-results').querySelectorAll('.ob-language-choice:not([hidden])'));
          var index = visible.indexOf(choice);
          visible[(index + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length].focus();
        };
      });
      var subjectSearch = form.querySelector('[data-subject-search]');
      if (subjectSearch) subjectSearch.oninput = function () {
        var query = subjectSearch.value.trim().toLowerCase();
        form.querySelectorAll('#ob-subcats [data-chip="subcategories"]').forEach(function (button) {
          button.hidden = !!query && String(button.dataset.searchValue || button.textContent).toLowerCase().indexOf(query) === -1;
        });
      };
    }

    function bindStep() {
      if ((role === 'teacher' || role === 'learner') && step === 3) bindTeacherStep();
      // chips
      form.querySelectorAll('[data-chip]').forEach(function (btn) {
        btn.onclick = function () { toggleChip(btn.dataset.chip, btn.dataset.value); };
      });
      form.querySelectorAll('[data-clear-selection]').forEach(function (btn) {
        btn.onclick = function () {
          state.subcategories = [];
          if (role === 'teacher') state.teacherCategorySubjects[state.category || 'languages'] = [];
          if (role === 'organization') saveActiveOrganizationFocusAreas();
          draftDirty = true;
          saveDraft('Subject selection cleared locally.');
          render();
        };
      });
      bindOrganizationSummary();
      form.querySelectorAll('[data-cover-preset]').forEach(function (btn) {
        btn.onclick = function () {
          collect();
          state.coverPreset = btn.dataset.coverPreset;
          clearProfileImage('cover');
          draftDirty = true;
          saveDraft('Cover theme saved locally.');
          render();
        };
      });
      form.querySelectorAll('[data-remove-upload]').forEach(function (btn) {
        btn.onclick = function () {
          collect();
          clearProfileImage(btn.dataset.removeUpload);
          draftDirty = true;
          saveDraft('Image removed from the local draft.');
          render();
        };
      });
      form.querySelectorAll('[data-category-card]').forEach(function (btn) {
        btn.onclick = function () {
          if (role === 'organization') {
            saveActiveOrganizationFocusAreas();
            var organizationCategory = btn.dataset.categoryCard;
            if (state.organizationCategories.indexOf(organizationCategory) === -1) {
              state.organizationCategories.push(organizationCategory);
            }
            state.category = organizationCategory;
            state.subcategories = (state.organizationSubcategories[organizationCategory] || []).slice();
            render();
            return;
          }
          if (role === 'teacher') {
            var previousCategory = state.category || 'languages';
            state.teacherCategorySubjects[previousCategory] = state.subcategories.slice();
            state.category = btn.dataset.categoryCard;
            state.subcategories = (state.teacherCategorySubjects[state.category] || []).slice();
            draftDirty = true;
            saveDraft('Teaching category saved locally.');
            render();
            return;
          }
          if (role === 'learner') {
            collect();
            var learnerPreviousCategory = state.category || 'languages';
            if (learnerPreviousCategory !== 'languages') state.learnerCategoryDrafts[learnerPreviousCategory] = { subjects: state.subcategories.slice(), experience: state.learnerExperience, outcome: state.learningOutcome };
            state.category = btn.dataset.categoryCard;
            if (state.category === 'languages') {
              state.subcategories = [];
              state.learnerExperience = '';
              state.learningOutcome = '';
            } else {
              var learnerSaved = state.learnerCategoryDrafts[state.category] || {};
              state.subcategories = (learnerSaved.subjects || []).slice();
              state.learnerExperience = learnerSaved.experience || '';
              state.learningOutcome = learnerSaved.outcome || '';
            }
            showError('', '');
            draftDirty = true;
            saveDraft('Learning category saved locally.');
            render();
            return;
          }
          state.category = btn.dataset.categoryCard;
          state.subcategories = [];
          if (state.category !== 'languages') {
            state.learnLanguages = [];
            state.teachLanguages = [];
            if (role !== 'organization') state.organizationLanguages = [];
            state.languageLevels = {};
            state.goalLevels = {};
            state.languageGoals = {};
          }
          render();
        };
      });
      form.querySelectorAll('[data-option-kind]').forEach(function (btn) {
        btn.onclick = function () {
          var kind = btn.dataset.optionKind;
          var value = btn.dataset.optionValue;
          if (kind === 'organizationAudience' || kind === 'programFormat') {
            var arr = state[kind] || [];
            var idx = arr.indexOf(value);
            if (idx === -1) arr.push(value);
            else arr.splice(idx, 1);
            state[kind] = arr;
          } else {
            state[kind] = value;
          }
          if (role === 'learner' && kind === 'learnerExperience' && state.category !== 'languages') {
            var learnerCategoryState = state.learnerCategoryDrafts[state.category] || {};
            learnerCategoryState.subjects = state.subcategories.slice(); learnerCategoryState.experience = state.learnerExperience; learnerCategoryState.outcome = state.learningOutcome;
            state.learnerCategoryDrafts[state.category] = learnerCategoryState;
            saveDraft('Learning experience saved locally.');
          }
          render();
        };
      });
      // avatar
      var avatar = $('#ob-avatarFile');
      if (avatar) avatar.onchange = function () {
        collect();
        var file = avatar.files && avatar.files[0];
        var error = validateProfileImage(file);
        if (error) {
          fileFeedback.avatar = error;
          avatar.value = '';
          render();
          return;
        }
        clearProfileImage('avatar');
        state.avatarFile = file;
        state.avatarName = file ? file.name : '';
        state.avatarPreview = file ? URL.createObjectURL(file) : '';
        fileFeedback.avatar = '';
        render();
      };
      var cover = $('#ob-coverFile');
      if (cover) cover.onchange = function () {
        collect();
        var file = cover.files && cover.files[0];
        var error = validateProfileImage(file);
        if (error) {
          fileFeedback.cover = error;
          cover.value = '';
          render();
          return;
        }
        clearProfileImage('cover');
        state.coverFile = file;
        state.coverName = file ? file.name : '';
        state.coverPreview = file ? URL.createObjectURL(file) : '';
        fileFeedback.cover = '';
        render();
      };
      // gender/category/level selects + native
      ['gender', 'level', 'category', 'coverPosition', 'orgType'].forEach(function (id) {
        var el = $('#ob-' + id);
        if (el) el.onchange = function () {
          state[id] = el.value;
          if (id === 'category' || id === 'coverPosition') { render(); }
        };
      });
      // per-language level and goal controls
      bindLanguageGoalFields();
      // autocomplete country / city (step 2) and native language (step 3)
      ['country', 'city', 'nativeLanguage'].forEach(function (id) {
        var el = $('#ob-' + id);
        if (el) {
          el.oninput = function () { state[id] = el.value; showAutocomplete(id, el); };
          el.onblur = function () { setTimeout(hideAutocomplete, 150); };
        }
      });
    }

    function toggleChip(kind, value) {
      if (kind === 'nativeLanguage') {
        state.nativeLanguage = value;
        var nativeGroup = form.querySelector('[data-chip-group="nativeLanguage"]');
        if (nativeGroup) nativeGroup.querySelectorAll('[data-chip]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.value === value);
        });
        showError('', '');
        return;
      }
      var arr = kind === 'learnLanguages' ? state.learnLanguages
        : kind === 'interests' ? state.interests
        : kind === 'subcategories' ? state.subcategories
        : kind === 'teachLanguages' ? state.teachLanguages
        : kind === 'explanationLanguages' ? state.explanationLanguages
        : kind === 'teachingLevels' ? state.teachingLevels
        : kind === 'teachingFormats' ? state.teachingFormats
        : kind === 'teacherSkillLevels' ? state.teacherSkillLevels
        : kind === 'teacherAudience' ? state.teacherAudience
        : kind === 'organizationLanguages' ? state.organizationLanguages
        : kind === 'eventLanguages' ? state.eventLanguages : null;
      if (!arr) return;
      var idx = arr.indexOf(value);
      if (idx === -1) {
        if (kind === 'learnLanguages' && arr.length >= 3) return;
        if (kind === 'teachLanguages' && arr.length >= 3) {
          showError('Choose up to 3 languages you teach.', 'teachLanguages');
          return;
        }
        if (kind === 'eventLanguages' && arr.length >= 3) return;
        if (kind === 'subcategories' && role !== 'organization' && arr.length >= 3) return;
        arr.push(value);
        if (kind === 'learnLanguages') {
          state.languageLevels[value] = state.languageLevels[value] || state.level;
          state.goalLevels[value] = state.goalLevels[value] || state.languageLevels[value] || state.level;
        }
      } else {
        arr.splice(idx, 1);
        if (kind === 'learnLanguages') {
          delete state.languageLevels[value];
          delete state.goalLevels[value];
          delete state.languageGoals[value];
        }
      }
      // Re-render just the affected group + language levels without losing focus.
      var groups = form.querySelectorAll('[data-chip-group="' + kind + '"]');
      groups.forEach(function (group) { group.querySelectorAll('[data-chip]').forEach(function (b) {
        b.classList.toggle('active', arr.indexOf(b.dataset.value) !== -1);
      }); });
      var langCounter = form.querySelector('[data-lang-counter="' + kind + '"] b');
      if (langCounter) langCounter.textContent = arr.length + '/3 selected';
      if (kind === 'subcategories') {
        if (role === 'teacher') state.teacherCategorySubjects[state.category || 'languages'] = state.subcategories.slice();
        if (role === 'learner' && state.category !== 'languages') {
          var learnerCategoryState = state.learnerCategoryDrafts[state.category] || {};
          learnerCategoryState.subjects = state.subcategories.slice(); learnerCategoryState.experience = state.learnerExperience; learnerCategoryState.outcome = state.learningOutcome;
          state.learnerCategoryDrafts[state.category] = learnerCategoryState;
        }
        if (role === 'organization') saveActiveOrganizationFocusAreas();
        var count = $('#ob-subcat-count');
        if (count) count.textContent = role === 'organization' ? (state.subcategories.length + ' selected') : (state.subcategories.length + '/3 selected');
      }
      if (role === 'organization' && (kind === 'subcategories' || kind === 'organizationLanguages')) {
        var selectedBox = $('#ob-org-selected');
        if (selectedBox) {
          selectedBox.innerHTML = organizationSelectedSummaryHtml();
          bindOrganizationSummary();
        }
      }
      if (role === 'learner') showError('', '');
      if (kind === 'learnLanguages') { var box = $('#ob-lang-levels'); if (box) { box.innerHTML = languageLevelsHtml(); bindLanguageGoalFields(); } }
      draftDirty = true;
      saveDraft();
      if (role === 'teacher' && step === 3) render();
    }

    function showAutocomplete(kind, input) {
      var box = $('#ob-autocomplete');
      if (!box) return;
      var query = String(input.value || '').trim().toLowerCase();
      var list = [];
      if (kind === 'nativeLanguage') {
        list = D.getLanguageSuggestions
          ? D.getLanguageSuggestions(input.value, 6)
          : (D.LANGUAGES || []).filter(function (lang) {
              return !query || String(lang).toLowerCase().indexOf(query) !== -1;
            }).slice(0, 6);
      } else if (kind === 'country' && D.getCountrySuggestions) {
        list = D.getCountrySuggestions(input.value, 6);
      } else if (kind === 'city' && D.getCitySuggestions) {
        list = D.getCitySuggestions(input.value, state.country, 6);
      }
      if (!list.length) { hideAutocomplete(); return; }
      var rect = input.getBoundingClientRect(), formRect = form.getBoundingClientRect();
      box.style.top = (rect.bottom - formRect.top + form.scrollTop + 2) + 'px';
      box.style.left = (rect.left - formRect.left) + 'px';
      box.style.width = rect.width + 'px';
      box.innerHTML = list.map(function (x) { return '<button type="button" data-ac="' + esc(x) + '">' + esc(x) + '</button>'; }).join('');
      box.hidden = false;
      box.querySelectorAll('[data-ac]').forEach(function (b) {
        b.onmousedown = function (e) {
          e.preventDefault();
          state[kind] = b.dataset.ac; input.value = b.dataset.ac;
          if (kind === 'country' && state.city && !D.doesCityBelongToCountry(state.city, state.country)) { state.city = ''; var ci = $('#ob-city'); if (ci) ci.value = ''; }
          hideAutocomplete();
        };
      });
    }
    function hideAutocomplete() { var box = $('#ob-autocomplete'); if (box) { box.hidden = true; box.innerHTML = ''; } }

    function collect() {
      if (!form) return;
      ['firstName', 'lastName', 'orgName', 'bio', 'city', 'country', 'dob', 'goal', 'nativeLanguage', 'learningOutcome', 'specialization', 'experience', 'qualifications', 'teachingApproach', 'certificates', 'format', 'website', 'email', 'phone', 'contactName', 'contactEmail', 'contactPhone', 'contactPosition', 'rate', 'availability', 'audience', 'eventType', 'verification', 'authorizedMembership', 'capacity', 'organizerType', 'locationMode', 'frequency', 'instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'telegram'].forEach(function (id) {
        var el = $('#ob-' + id);
        if (el) state[id] = el.value;
      });
      var gender = $('#ob-gender'); if (gender) state.gender = gender.value;
      var level = $('#ob-level'); if (level) state.level = level.value;
      var cat = $('#ob-category'); if (cat) state.category = cat.value;
      var orgType = $('#ob-orgType'); if (orgType) state.orgType = orgType.value;
      var coverPosition = $('#ob-coverPosition'); if (coverPosition) state.coverPosition = coverPosition.value;
    }

    function validate() {
      if (step === 1 && roles.indexOf(role) === -1) return { message: 'Choose your role first.', target: '' };
      if (step === 2) {
        if (role === 'organization' ? !state.orgName.trim() : !state.firstName.trim()) return { message: role === 'organization' ? 'Enter your organization name.' : 'Enter your first name.', target: role === 'organization' ? 'orgName' : 'firstName' };
        // Country: only used for city suggestions. Blocking every country not
        // in our curated list rejected valid answers like Uzbekistan and
        // stranded learners on this step. Trust whatever the learner typed;
        // the mismatch check below still catches "wrong country for city".
        // Only block a clear mismatch (city known to belong to a different
        // country). Cities not in our curated list — incl. geolocation results
        // and smaller towns — are allowed through.
        if (state.city.trim() && state.country.trim() && D.cityCountry) {
          var owner = D.cityCountry(state.city);
          if (owner && D.isKnownCountry(state.country) && owner.toLowerCase() !== state.country.trim().toLowerCase()) {
            return { message: 'This city belongs to ' + owner + ', not ' + state.country.trim() + '.', target: 'city' };
          }
        }
      }
      if (step === 3 && role === 'learner') {
        // A target language is only required for the Languages category; for
        // art / sport / digital etc. it's optional.
        var languagesCategory = !state.category || state.category === 'languages';
        if (languagesCategory && !state.nativeLanguage.trim()) return { message: 'Choose your native language.', target: 'nativeLanguage' };
        if (languagesCategory && !state.learnLanguages.length) return { message: 'Choose at least one language to learn.', target: 'learnLanguages' };
        if (languagesCategory && state.learnLanguages.indexOf(state.nativeLanguage) !== -1) return { message: 'Your native language cannot also be a learning language.', target: 'learnLanguages' };
        if (!languagesCategory && !state.subcategories.length) return { message: 'Choose at least one subject.', target: 'subcategories' };
        if (!languagesCategory && !state.learnerExperience) return { message: 'Choose your current experience.', target: 'learnerExperience' };
        if (!languagesCategory && !state.learningOutcome.trim()) return { message: 'Describe your desired outcome.', target: 'learningOutcome' };
      }
      if (step === 3 && role === 'teacher') {
        var teacherLanguagesCategory = !state.category || state.category === 'languages';
        if (teacherLanguagesCategory && !state.teachLanguages.length) return { message: 'Choose at least one language you teach.', target: 'teachLanguages' };
        if (teacherLanguagesCategory && !state.teachingLevels.length) return { message: 'Choose at least one supported CEFR level.', target: 'teachingLevels' };
        if (!state.teachingFormats.length) return { message: 'Choose at least one teaching format.', target: 'teachingFormats' };
        if (!teacherLanguagesCategory && !state.subcategories.length) return { message: 'Choose at least one subject or specialization.', target: 'subcategories' };
      }
      if (step === 3 && role === 'organizer') {
        if (!state.specialization.trim()) return { message: 'Write your organizer headline.', target: 'specialization' };
        if (!state.organizerType) return { message: 'Choose your organizer type.', target: 'organizerType' };
        if (!state.eventType) return { message: 'Choose your event type.', target: 'eventType' };
        if (!state.locationMode) return { message: 'Choose your location mode.', target: 'locationMode' };
        if (!state.audience) return { message: 'Choose your audience.', target: 'audience' };
      }
      if (step === 3 && role === 'organization') {
        if (!state.orgType) return { message: 'Choose your organization type.', target: 'orgType' };
        if (!state.specialization.trim()) return { message: 'Write what your organization does.', target: 'specialization' };
        if (!state.organizationCategories.length) return { message: 'Choose at least one learning or business category.', target: 'category' };
        if (!state.organizationAudience.length) return { message: 'Choose your audience.', target: 'organizationAudience' };
        if (!state.programFormat.length) return { message: 'Choose your program format.', target: 'programFormat' };
        if (!state.authorizedMembership.trim()) return { message: 'Describe your authorized organization membership.', target: 'authorizedMembership' };
      }
      return null;
    }

    function cleanGoalText(value) {
      return String(value || '').replace(/\b(A1|A2|B1|B2|C1|C2)\b/gi, '').replace(/\s+/g, ' ').trim();
    }

    function buildLearningGoalSummary(languages, goals, goalLevels, fallbackGoal) {
      var list = (languages || []).map(function (language) {
        var targetLevel = normalizeLearnerTarget(goalLevels[language], state.languageLevels[language] || 'Not assessed');
        var goal = cleanGoalText(goals[language] || fallbackGoal);
        return [language, goal, targetLevel].filter(Boolean).join(' ');
      });
      if (!list.length) {
        var key = generalGoalKey();
        var categoryGoal = cleanGoalText(goals[key] || fallbackGoal);
        var categoryLevel = normalizeLearnerTarget(goalLevels[key], state.level || 'A1');
        list.push([categoryLabel(state.category), categoryGoal, categoryLevel].filter(Boolean).join(' '));
      }
      return list.filter(Boolean).join(' | ');
    }

    function buildPatch() {
      var fullName = role === 'organization' ? state.orgName.trim()
        : [state.firstName, state.lastName].map(function (x) { return x.trim(); }).filter(Boolean).join(' ');
      var patch = {
        full_name: fullName || null,
        bio: state.bio.trim() || null,
        city: state.city.trim() || null,
        country: state.country.trim() || null,
        dob: state.dob || null,
        gender: state.gender || null,
        website: state.website.trim() || null,
        updated_at: new Date().toISOString()
      };
      if (role === 'learner') {
        var learningCategory = state.category || 'languages';
        var isLanguageLearning = learningCategory === 'languages';
        var generalKey = generalGoalKey();
        var primaryLanguage = state.learnLanguages[0];
        var primaryLevel = isLanguageLearning ? (state.languageLevels[primaryLanguage] || 'Not assessed') : null;
        var primaryGoalLevel = isLanguageLearning ? normalizeLearnerTarget(state.goalLevels[primaryLanguage] || state.goalLevels[generalKey], primaryLevel) : null;
        var selectedGoalLevels = {};
        var selectedLanguageGoals = {};
        (isLanguageLearning ? state.learnLanguages : []).forEach(function (language) {
          selectedGoalLevels[language] = normalizeLearnerTarget(state.goalLevels[language], state.languageLevels[language] || 'Not assessed');
          if (state.languageGoals[language]) selectedLanguageGoals[language] = cleanGoalText(state.languageGoals[language]);
        });
        if (isLanguageLearning && !state.learnLanguages.length) {
          selectedGoalLevels[generalKey] = primaryGoalLevel;
          if (state.languageGoals[generalKey] || state.goal) selectedLanguageGoals[generalKey] = cleanGoalText(state.languageGoals[generalKey] || state.goal);
        }
        var learningGoal = isLanguageLearning ? buildLearningGoalSummary(state.learnLanguages, selectedLanguageGoals, selectedGoalLevels, state.goal) : state.learningOutcome.trim();
        patch.language = state.nativeLanguage.trim() || null;
        patch.language_level = primaryLevel;
        patch.goal_level = primaryGoalLevel;
        patch.learning_goal = learningGoal || primaryGoalLevel;
        patch.learning_languages = isLanguageLearning ? state.learnLanguages.slice() : [];
        patch.profile_interests = state.interests.slice();
        patch.learning_targets = isLanguageLearning ? [{
          category: learningCategory,
          languages: state.learnLanguages.slice(),
          levels: state.languageLevels,
          goal: primaryGoalLevel,
          goalLevel: primaryGoalLevel,
          goals: selectedLanguageGoals,
          goalLevels: selectedGoalLevels,
          subcategories: state.subcategories.slice()
        }].concat(state.learnLanguages.map(function (lang) {
          return {
            category: learningCategory,
            language: lang,
            level: state.languageLevels[lang] || primaryLevel,
            goal: selectedGoalLevels[lang] || primaryGoalLevel,
            goalLevel: selectedGoalLevels[lang] || primaryGoalLevel,
            subcategories: state.subcategories.slice()
          };
        })) : [{ category: learningCategory, subcategories: state.subcategories.slice(), experience: state.learnerExperience || null, outcome: state.learningOutcome.trim() || null }];
      }
      if (role === 'teacher') {
        patch.language = state.nativeLanguage.trim() || null;
        patch.specialization = [state.specialization.trim()].concat(state.subcategories).filter(Boolean);
        patch.teaching_experience = state.experience || null;
        patch.teaches_languages = state.teachLanguages.slice();
        patch.qualifications = [state.qualifications, state.certificates, state.teachingApproach ? ('Approach: ' + state.teachingApproach) : '', state.verification, state.rate ? ('Rate: ' + state.rate) : '', state.availability ? ('Availability: ' + state.availability) : '', state.teachingFormats.length ? ('Formats: ' + state.teachingFormats.join('/')) : '', state.teachingLevels.length ? ('CEFR: ' + state.teachingLevels.join('/')) : '', state.teacherSkillLevels.length ? ('Skill levels: ' + state.teacherSkillLevels.join('/')) : '', state.teacherAudience.length ? ('Audience: ' + state.teacherAudience.join('/')) : '', state.explanationLanguages.length ? ('Explains in: ' + state.explanationLanguages.join('/')) : ''].join(',').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.instagram = state.instagram.trim() || null;
        patch.tiktok = state.tiktok.trim() || null;
        patch.facebook = state.facebook.trim() || null;
        patch.linkedin = state.linkedin.trim() || null;
        patch.youtube = state.youtube.trim() || null;
        patch.telegram = state.telegram.trim() || null;
        patch.learning_languages = state.teachLanguages.slice();
        patch.learning_targets = [{
          category: state.category || 'languages',
          languages: state.teachLanguages.slice(),
          subcategories: state.subcategories.slice(),
          invite_ref: teacherInviteRef || null,
          invited_role: teacherInviteRef ? 'teacher' : null,
          explanation_languages: state.explanationLanguages.slice(),
          cefr_levels: state.teachingLevels.slice(),
          teaching_formats: state.teachingFormats.slice(),
          skill_levels: state.teacherSkillLevels.slice(),
          target_audience: state.teacherAudience.slice(),
          category_subjects: Object.assign({}, state.teacherCategorySubjects, (function () { var current = {}; current[state.category || 'languages'] = state.subcategories.slice(); return current; })())
        }];
      }
      if (role === 'organizer') {
        patch.specialization = [state.specialization, state.organizerType, state.eventType, state.locationMode, state.audience, state.frequency, state.capacity ? ('Capacity: ' + state.capacity) : '', state.verification].map(function (x) { return String(x || '').trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.instagram = state.instagram.trim() || null;
        patch.tiktok = state.tiktok.trim() || null;
        patch.telegram = state.telegram.trim() || null;
        patch.website = state.website.trim() || null;
        patch.phone = state.phone.trim() || null;
        patch.learning_targets = [{
          category: state.category || 'languages',
          subcategories: state.subcategories.slice(),
          languages: state.eventLanguages.slice(),
          organizer_type: state.organizerType || null,
          event_type: state.eventType || null,
          location_mode: state.locationMode || null,
          audience: state.audience || null,
          frequency: state.frequency || null,
          capacity: state.capacity ? Number(state.capacity) : null,
          contact_email: state.email.trim() || null,
          verification: state.verification.trim() || null
        }];
      }
      if (role === 'organization') {
        patch.specialization = [state.specialization, state.orgType].concat(state.organizationAudience, state.programFormat, [state.verification]).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.instagram = state.instagram.trim() || null;
        patch.linkedin = state.linkedin.trim() || null;
        patch.telegram = state.telegram.trim() || null;
        patch.phone = state.phone.trim() || null;
        patch.learning_languages = state.organizationLanguages.slice();
        saveActiveOrganizationFocusAreas();
        patch.learning_targets = state.organizationCategories.map(function (category) {
          return {
            category: category,
            subcategories: (state.organizationSubcategories[category] || []).slice(),
            languages: state.organizationLanguages.slice(),
            organization_type: state.orgType || null,
            audience: state.organizationAudience.slice(),
            format: state.programFormat.slice(),
            verification_status: state.verification.trim() ? 'pending' : 'not_verified',
            verification: state.verification.trim() || null,
            authorized_membership: state.authorizedMembership.trim() || null
          };
        });
      }
      return patch;
    }

    function comparable(value) {
      if (Array.isArray(value)) return value.map(comparable);
      if (value && typeof value === 'object') {
        var ordered = {};
        Object.keys(value).sort().forEach(function (key) { ordered[key] = comparable(value[key]); });
        return ordered;
      }
      return value == null ? null : value;
    }

    function sameSavedValue(expected, actual) {
      return JSON.stringify(comparable(expected)) === JSON.stringify(comparable(actual));
    }

    async function saveAndVerifyProfile(userId, patch) {
      var fields = ['id'].concat(Object.keys(patch));
      var result = await supa.from('profiles').update(patch).eq('id', userId).select(fields.join(',')).single();
      if (result.error) throw result.error;
      if (!result.data || String(result.data.id) !== String(userId)) throw new Error('Profile ownership verification failed. Nothing was confirmed.');
      var verifyKeys = ['full_name','bio','city','country','language','language_level','goal_level','learning_goal','learning_languages','profile_interests','learning_targets','teaches_languages','specialization','qualifications'];
      var mismatch = verifyKeys.filter(function (key) { return Object.prototype.hasOwnProperty.call(patch, key) && !sameSavedValue(patch[key], result.data[key]); });
      if (mismatch.length) throw new Error('Saved profile could not be verified: ' + mismatch.join(', ') + '.');
      return result.data;
    }

    async function saveLearnerLanguages(userId) {
      if (role !== 'learner' || (state.category && state.category !== 'languages') || !state.learnLanguages.length) return;
      var rows = state.learnLanguages.map(function (lang, i) {
        var currentLevel = state.languageLevels[lang] || state.level || 'A1';
        return {
          user_id: userId, language: lang,
          current_level: currentLevel,
          goal_level: normalizeLearnerTarget(state.goalLevels[lang], currentLevel),
          is_active: i === 0, updated_at: new Date().toISOString()
        };
      });
      var deactivate = await supa.from('learner_language_profiles').update({ is_active: false, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (deactivate.error) throw deactivate.error;
      var write = await supa.from('learner_language_profiles').upsert(rows, { onConflict: 'user_id,language' });
      if (write.error) throw write.error;
      var readback = await supa.from('learner_language_profiles').select('user_id,language,current_level,goal_level,is_active').eq('user_id', userId).in('language', state.learnLanguages);
      if (readback.error) throw readback.error;
      var savedRows = readback.data || [];
      if (savedRows.length !== rows.length || rows.some(function (expected) {
        var actual = savedRows.filter(function (item) { return item.language === expected.language; })[0];
        return !actual || String(actual.user_id) !== String(userId) || actual.current_level !== expected.current_level || actual.goal_level !== expected.goal_level || !!actual.is_active !== !!expected.is_active;
      })) throw new Error('Learning languages were not confirmed by the server.');
    }

    function buildOrgSlug(name) {
      var base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      return (base || 'organization') + '-' + Math.random().toString(36).slice(2, 6);
    }

    async function saveBusinessOrganization(userId, userEmail) {
      if (role !== 'organization') return;
      var name = state.orgName.trim();
      if (!name) return;
      var payload = {
        city: state.city.trim() || null,
        contact_email: state.contactEmail.trim() || null,
        contact_name: state.contactName.trim() || null,
        contact_phone: state.contactPhone.trim() || null,
        contact_position: state.contactPosition.trim() || null,
        country: state.country.trim() || null,
        description: [state.specialization].concat(state.organizationAudience, state.programFormat).map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' · ') || state.bio.trim() || null,
        name: name,
        owner_id: userId,
        public_email: state.email.trim() || userEmail || null,
        public_phone: state.phone.trim() || null,
        type: state.orgType || null,
        website_url: state.website.trim() || null
      };
      var existing = await supa.from('organizations')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      var orgId = existing.data && existing.data.id;
      if (orgId) {
        var update = await supa.from('organizations').update(payload).eq('id', orgId);
        if (update.error) throw update.error;
      } else {
        var insert = await supa.from('organizations')
          .insert(Object.assign({}, payload, { slug: buildOrgSlug(name) }))
          .select('id')
          .single();
        if (insert.error) throw insert.error;
        orgId = insert.data && insert.data.id;
      }
      if (!orgId) return;
      var membership = await supa.from('organization_memberships')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) {
        var memberInsert = await supa.from('organization_memberships').insert({
          organization_id: orgId,
          user_id: userId,
          role: 'owner',
          status: 'active'
        });
        if (memberInsert.error) throw memberInsert.error;
      }
    }

    async function confirmRegistrationRole(userId) {
      if (roles.indexOf(role) === -1) throw new Error('Choose your role first.');
      var result = await supa.rpc('confirm_legacy_web_role', { chosen_role: role });
      if (result.error) throw result.error;
      var confirmedRole = roles.indexOf(result.data) !== -1 ? result.data : null;
      if (confirmedRole !== role) throw new Error('The saved account role differs from your selection. Please contact support.');
      if (ctx.session) {
        ctx.session.role = confirmedRole;
        ctx.session.selectedRole = confirmedRole;
      }
      try {
        localStorage.setItem('duvela.webRole', confirmedRole);
        history.replaceState(null, '', './app.html?role=' + encodeURIComponent(confirmedRole) + (window.location.hash || (confirmedRole === 'learner' ? '#home' : '#workspace')));
      } catch (ignore) {}
      return confirmedRole;
    }

    async function submit(e) {
      e.preventDefault();
      collect();
      showError('', '');
      var err = validate();
      if (err) {
        if (step === 3 && role === 'teacher') {
          var subjectTargets = ['teachLanguages', 'subcategories', 'category'];
          var preferenceTargets = ['teachingLevels', 'teachingFormats', 'nativeLanguage', 'explanationLanguages', 'teacherSkillLevels', 'teacherAudience'];
          var requiredTab = subjectTargets.indexOf(err.target) !== -1 ? 'subjects' : (preferenceTargets.indexOf(err.target) !== -1 ? 'preferences' : 'professional');
          if (state.teacherSetupTab !== requiredTab) { state.teacherSetupTab = requiredTab; render(); }
        }
        showError(err.message || err, err.target);
        return;
      }
      if (step < 4) {
        step++;
        saveDraft('Step ' + step + ' saved.');
        render();
        var forwardScroll = document.querySelector('.onboarding-scroll');
        if (forwardScroll) forwardScroll.scrollTop = 0;
        return;
      }

      var u = ctx.getUser();
      var patch = buildPatch();
      var submitButton = $('#onboardingSubmit');
      submitButton.disabled = true;
      submitButton.textContent = tx('Saving to account…');
      setSaveStatus('saving', tx('Saving to account…'));
      try {
        var verificationFile = $('#ob-verificationFile')?.files?.[0];
        if (verificationFile && (verificationFile.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(verificationFile.type))) throw new Error('Choose a PDF, JPG, PNG or WebP document up to 10 MB.');
        patch = buildPatch();
        if (state.avatarFile && state.avatarFile.size && ctx.uploadToBucket) {
          setSaveStatus('saving', 'Uploading avatar to your account…');
          patch.avatar_url = await ctx.uploadToBucket('posts', state.avatarFile);
        }
        setSaveStatus('saving', tx('Saving to account…'));
        var savedProfile = await saveAndVerifyProfile(u.id, patch);
        if (verificationFile) {
          var ext = verificationFile.type === 'application/pdf' ? 'pdf' : verificationFile.type === 'image/png' ? 'png' : verificationFile.type === 'image/webp' ? 'webp' : 'jpg';
          var documentPath = u.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
          var upload = await supa.storage.from('verification').upload(documentPath, verificationFile, { contentType: verificationFile.type, upsert: false });
          if (upload.error) throw upload.error;
          var request = await supa.from('verification_requests').insert({ user_id: u.id, document_path: documentPath, note: state.verification.trim() || null, status: 'pending' });
          if (request.error) throw request.error;
        }
        setSaveStatus('saving', tx('Verifying saved data…'));
        await saveLearnerLanguages(u.id);
        if (role === 'organization') await saveBusinessOrganization(u.id, u.email || '');
        var accountRole = await confirmRegistrationRole(u.id);
        ctx.setProfile(Object.assign({}, ctx.getProfile(), savedProfile, patch, {
          registered_web_role: accountRole,
          registered_web_role_confirmed: true,
          last_web_role: accountRole
        }));
        localStorage.setItem('duvela.onboarding.' + u.id, '1');
        if (draftKey) localStorage.removeItem(draftKey);
        setSaveStatus('account', tx('Saved to account'));
        $('#onboardingOverlay').classList.remove('open');
        $('#onboardingOverlay').setAttribute('aria-hidden', 'true');
        if (accountRole === 'teacher' && teacherInviteRef) {
          try {
            sessionStorage.removeItem('duvela.teacherInviteRef');
            localStorage.removeItem('duvela.teacherInviteRef');
            localStorage.removeItem('duvela.teacherInviteRole');
          } catch (_) {}
          window.location.href = './teacher-invite-accepted.html?ref=' + encodeURIComponent(teacherInviteRef);
          return;
        }
        ctx.renderAll();
        if (verificationFile) {
          alert('Your optional verification document was sent for review. Your account role is unchanged.');
        }
      } catch (error) {
        $('#onboardingError').textContent = (error && error.message) || 'Could not save your setup. Please try again.';
        submitButton.disabled = false;
        title();
        setSaveStatus('error', tx('Save failed') + '. ' + ((error && error.message) || ''));
      }
    }

    function back() {
      collect();
      if (step > minStep) {
        step--;
        saveDraft('Step ' + step + ' restored.');
        render();
        var backScroll = document.querySelector('.onboarding-scroll');
        if (backScroll) backScroll.scrollTop = 0;
      }
    }

    async function signOut() {
      var button = $('#onboardingSignOut');
      if (!button || button.disabled) return;
      if (draftDirty && !window.confirm('Your latest unsaved edits may be lost. Sign out anyway?')) return;
      button.disabled = true;
      showError('', '');
      try {
        var result = await supa.auth.signOut();
        if (result && result.error) throw result.error;
        window.location.href = './index.html';
      } catch (error) {
        button.disabled = false;
        showError((error && error.message) || 'Could not sign out. Please try again.', '');
      }
    }

    function hasList(value) {
      return Array.isArray(value) && value.some(function (item) { return String(item || '').trim(); });
    }

    function hasCompletedProfile(profile) {
      if (!profile) return false;
      if (profile.is_admin || profile.is_teacher || profile.is_organizer) return true;
      if (String(profile.full_name || '').trim()) return true;
      if (String(profile.bio || '').trim()) return true;
      if (String(profile.city || '').trim() || String(profile.country || '').trim()) return true;
      if (String(profile.language || '').trim()) return true;
      if (String(profile.website || '').trim()) return true;
      if (String(profile.avatar_url || '').trim()) return true;
      if (hasList(profile.learning_languages) || hasList(profile.teaches_languages)) return true;
      if (hasList(profile.learning_targets) || hasList(profile.profile_interests)) return true;
      if (hasList(profile.specialization) || hasList(profile.qualifications)) return true;
      return false;
    }

    function openIfNeeded() {
      var u = ctx.getUser();
      if (!u || localStorage.getItem('duvela.onboarding.' + u.id)) return;
      if (hasCompletedProfile(ctx.getProfile && ctx.getProfile())) {
        localStorage.setItem('duvela.onboarding.' + u.id, '1');
        return;
      }
      minStep = 1;
      step = 1;
      draftKey = 'duvela.onboarding.draft.v4.' + u.id;
      teacherInviteRef = '';
      try {
        var params = new URLSearchParams(window.location.search);
        teacherInviteRef = String(params.get('invite') || sessionStorage.getItem('duvela.teacherInviteRef') || localStorage.getItem('duvela.teacherInviteRef') || '').trim().slice(0, 120);
      } catch (_) {}
      var profile = ctx.getProfile ? (ctx.getProfile() || {}) : {};
      activeRole = roles.indexOf(ctx.session && ctx.session.role) !== -1 ? ctx.session.role : (roles.indexOf(profile.registered_web_role) !== -1 ? profile.registered_web_role : 'learner');
      hasConfirmedRole = profile.registered_web_role_confirmed === true;
      existingRoles = hasConfirmedRole ? [activeRole] : [];
      if (hasConfirmedRole && profile.is_teacher && existingRoles.indexOf('teacher') === -1) existingRoles.push('teacher');
      if (hasConfirmedRole && profile.is_organizer && existingRoles.indexOf('organizer') === -1) existingRoles.push('organizer');
      roleLocked = !!teacherInviteRef || hasConfirmedRole;
      role = teacherInviteRef ? 'teacher' : (roleLocked ? activeRole : '');
      restoreDraft();
      render();
      $('#onboardingOverlay').classList.add('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'false');
    }
    window.DuvelaResetOnboarding = function () {
      var u = ctx.getUser && ctx.getUser();
      if (u && u.id) localStorage.removeItem('duvela.onboarding.' + u.id);
      minStep = 1;
      step = 1;
      roleLocked = false;
      teacherInviteRef = '';
      role = '';
      var resetProfile = ctx.getProfile ? (ctx.getProfile() || {}) : {};
      activeRole = roles.indexOf(ctx.session && ctx.session.role) !== -1 ? ctx.session.role : (roles.indexOf(resetProfile.registered_web_role) !== -1 ? resetProfile.registered_web_role : 'learner');
      hasConfirmedRole = resetProfile.registered_web_role_confirmed === true;
      existingRoles = hasConfirmedRole ? [activeRole] : [];
      roleLocked = hasConfirmedRole;
      role = roleLocked ? activeRole : '';
      render();
      $('#onboardingOverlay').classList.add('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'false');
      return true;
    };

    function closeAccountMenu() {
      var menu = $('#onboardingAccountMenu');
      var button = $('#onboardingAccountButton');
      if (menu) menu.hidden = true;
      if (button) button.setAttribute('aria-expanded', 'false');
    }

    $('#onboardingAccountButton').addEventListener('click', function () {
      var menu = $('#onboardingAccountMenu');
      var open = menu.hidden;
      menu.hidden = !open;
      this.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    $('#onboardingSaveExit').addEventListener('click', function () {
      collect();
      saveDraft('Progress saved.');
      closeAccountMenu();
      $('#onboardingOverlay').classList.remove('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'true');
    });

    form.addEventListener('submit', submit);
    $('#onboardingBack').addEventListener('click', back);
    $('#onboardingSignOut').addEventListener('click', signOut);
    return { openIfNeeded: openIfNeeded };
  }
  window.DuvelaAppOnboarding = { create: create };
})();

