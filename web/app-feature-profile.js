(function () {
  function createProfileFeature(ctx) {
    const { $, tr, esc, alert, supa, state, avatarHtml, avatarInner, timeAgo, roleLabels } = ctx;
    const studentGoal = window.DuvelaStudentGoal || {
      LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      normalize: (value, fallback) => {
        const raw = String(value || '').trim().toUpperCase();
        const safeFallback = String(fallback || '').trim().toUpperCase();
        return ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(raw) ? raw : (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(safeFallback) ? safeFallback : 'A2');
      },
      fromProfile: function (profile, fallback) { return this.normalize(profile && profile.goal_level, fallback); },
      legacyPatch: function (value) {
        const level = this.normalize(value, 'A2');
        return { goal_level: level, learning_goal: level };
      }
    };
    const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
    const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const AVATAR_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
    let avatarPreviewUrl = '';
    let removeAvatarOnSave = false;
    let businessProfileTab = 'profile';
    let learnerProfileTab = 'overview';
    const localeNames = {
      en: 'English',
      de: 'Deutsch',
      es: 'Español',
      fr: 'Français',
      it: 'Italiano',
      pt: 'Português',
      nl: 'Nederlands',
      sv: 'Svenska',
      no: 'Norsk',
      pl: 'Polski',
      cs: 'Čeština',
      sq: 'Shqip',
      tr: 'Türkçe',
      ru: 'Русский',
      uk: 'Українська',
      kk: 'Қазақша',
      az: 'Azərbaycanca',
      uz: 'Oʻzbek',
      tg: 'Тоҷикӣ',
      fa: 'فارسی',
      ar: 'العربية',
      vi: 'Tiếng Việt',
      zh: '中文',
      ja: '日本語',
      ko: '한국어'
    };
    const localeFlags = {
      en: '🇬🇧',
      de: '🇩🇪',
      es: '🇪🇸',
      fr: '🇫🇷',
      it: '🇮🇹',
      pt: '🇵🇹',
      nl: '🇳🇱',
      sv: '🇸🇪',
      no: '🇳🇴',
      pl: '🇵🇱',
      cs: '🇨🇿',
      sq: '🇦🇱',
      tr: '🇹🇷',
      ru: '🇷🇺',
      uk: '🇺🇦',
      kk: '🇰🇿',
      az: '🇦🇿',
      uz: '🇺🇿',
      tg: '🇹🇯',
      fa: '🇮🇷',
      ar: '🇸🇦',
      vi: '🇻🇳',
      zh: '🇨🇳',
      ja: '🇯🇵',
      ko: '🇰🇷'
    };

    function setInput(id, value) {
      const node = $(id);
      if (node) node.value = value == null ? '' : value;
    }

    function setAvatarStatus(text, tone) {
      const node = $('#avatarUploadStatus');
      if (!node) return;
      node.textContent = text || '';
      node.dataset.tone = tone || '';
    }

    function clearAvatarPreviewUrl() {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
      avatarPreviewUrl = '';
    }

    function getAvatarFileError(file) {
      if (!file) return '';
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (file.size > AVATAR_MAX_BYTES) return tr('Avatar image must be 5 MB or smaller.', 'Фото аватара должно быть не больше 5 MB.');
      if (file.type && !AVATAR_TYPES.includes(file.type)) return tr('Use JPG, PNG or WebP for the avatar.', 'Для аватара используйте JPG, PNG или WebP.');
      if (!file.type && !AVATAR_EXTS.includes(ext)) return tr('Use JPG, PNG or WebP for the avatar.', 'Для аватара используйте JPG, PNG или WebP.');
      return '';
    }

    function bindAvatarControls(displayName) {
      const input = $('#pfAvatarFile');
      const remove = $('#avatarRemoveBtn');
      if (input && !input.dataset.profileAvatarBound) {
        input.dataset.profileAvatarBound = 'true';
        input.addEventListener('change', () => {
          const file = input.files && input.files[0];
          clearAvatarPreviewUrl();
          removeAvatarOnSave = false;
          if (!file) {
            setAvatarStatus('', '');
            return;
          }
          const error = getAvatarFileError(file);
          if (error) {
            input.value = '';
            setAvatarStatus(error, 'error');
            alert(error);
            return;
          }
          avatarPreviewUrl = URL.createObjectURL(file);
          const currentName = $('#pfName')?.value.trim() || displayName;
          avatarHtml('#profileAvatar', currentName, avatarPreviewUrl);
          avatarHtml('#topAvatar', currentName, avatarPreviewUrl);
          if (remove) remove.hidden = false;
          setAvatarStatus(tr('Photo selected. Save the profile to apply it.', 'Фото выбрано. Нажмите «Сохранить», чтобы применить.'), 'ready');
        });
      }
      if (remove && !remove.dataset.profileAvatarBound) {
        remove.dataset.profileAvatarBound = 'true';
        remove.addEventListener('click', () => {
          clearAvatarPreviewUrl();
          if (input) input.value = '';
          setInput('#pfAvatar', '');
          removeAvatarOnSave = true;
          const currentName = $('#pfName')?.value.trim() || displayName;
          avatarHtml('#profileAvatar', currentName, '');
          avatarHtml('#topAvatar', currentName, '');
          remove.hidden = true;
          setAvatarStatus(tr('Avatar will be removed after saving.', 'Аватар будет удалён после сохранения.'), 'ready');
        });
      }
      if (remove) remove.hidden = !(ctx.profile?.avatar_url || avatarPreviewUrl);
    }

    function ensureAppLanguageField() {
      const sideFoot = document.querySelector('.side-foot');
      if (!sideFoot) return null;
      let select = $('#profileLangSelect');
      let field = $('#sidebarLanguageField');
      if (select && field) return select;
      field = document.createElement('div');
      field.className = 'field';
      field.id = 'sidebarLanguageField';
      field.innerHTML =
        '<label for="profileLangSelect">' + esc(tr('Switch language', 'Сменить язык')) + '</label>' +
        '<select id="profileLangSelect" class="role-select" aria-label="' + esc(tr('Switch language', 'Сменить язык')) + '"></select>';
      if (select && select.parentNode) select.parentNode.remove();
      sideFoot.appendChild(field);
      select = $('#profileLangSelect');
      if (select) {
        select.innerHTML = (ctx.supportedLocales || []).map((locale) => {
          const code = String(locale.code || '').toLowerCase();
          const flag = localeFlags[code] || '🌐';
          const label = localeNames[code] || locale.name || code.toUpperCase();
          const title = flag + ' ' + label;
          return '<option value="' + esc(locale.code) + '">' + esc(title) + '</option>';
        }).join('');
      }
      return select;
    }

    function renderPublicationConsent(host) {
      const existing = document.getElementById('publicationConsentPanel');
      if (existing) existing.remove();
      const runtime = window.DuvelaRuntimeConfig || {};
      const intake = runtime.publicationIntake === true;
      if (!host || (!intake && (runtime.publicationConsent !== true || !window.DuvelaWebConfig.securityReadV2)) || !ctx.user?.id) return;
      const owner = ctx.user.id;
      // Accordion layout: a summary card, six collapsible groups (all closed on open,
      // one open at a time) and the publication actions in their own card. Opening or
      // closing a group never touches the selection; only the switches change the
      // draft, and only "publish" / "keep closed" save it.
      const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
      const ICONS = {
        basic: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/>',
        about: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
        teaching: '<path d="m3 9 9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/>',
        discovery: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>',
        ranking: '<path d="M5 20V11M10 20V6M15 20v-9M20 20V4"/>',
        social: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
      };
      const svg = (paths, className) => '<svg class="' + className + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
      const GROUPS = [
        ['basic', 'Basic information', 'Основная информация', 'Name, photos, city and country', 'Имя, фото, город и страна'],
        ['about', 'About you', 'О вас', 'Biography and introduction', 'Биография и знакомство'],
        ['teaching', 'Teaching profile', 'Профиль преподавателя', 'Languages, qualifications and experience', 'Языки, квалификации и опыт'],
        ['discovery', 'Discovery', 'Поиск', 'Teacher and organizer visibility', 'Видимость преподавателя и организатора'],
        ['ranking', 'Language & ranking', 'Язык и рейтинг', 'Levels, badge and ranking', 'Уровни, значок и рейтинг'],
        ['social', 'Social links', 'Социальные ссылки', 'Instagram, TikTok, YouTube and more', 'Instagram, TikTok, YouTube и другое'],
      ];
      const options = [
        ['basic','full_name','Name','Имя'],['basic','avatar_url','Profile photo','Фото профиля'],['basic','cover_url','Cover photo','Обложка'],
        ['basic','city','City','Город'],['basic','country','Country','Страна'],['about','bio','Biography (full text)','Биография (весь текст)'],
        ['teaching','teaches_languages','Teaching languages','Языки преподавания'],['teaching','explanation_languages','Explanation languages','Языки объяснения'],
        ['teaching','qualifications','Qualifications','Квалификации'],['teaching','specialization','Specializations','Специализации'],
        ['teaching','teaching_experience','Teaching experience','Опыт преподавания'],['teaching','teacher_audience','Teaching audience','Аудитория преподавания'],
        ['discovery','is_teacher','Teacher discovery','Поиск преподавателей'],['discovery','is_organizer','Organizer discovery','Поиск организаторов'],
        ['discovery','registered_web_role','Profile category','Категория профиля'],['ranking','is_verified','Verification badge','Знак проверки'],
        ['ranking','score','Ranking score','Баллы рейтинга'],['ranking','language','Profile language','Язык профиля'],['ranking','language_level','Language level','Уровень языка'],
        ['social','instagram','Instagram','Instagram'],['social','tiktok','TikTok','TikTok'],['social','youtube','YouTube','YouTube'],
        ['social','facebook','Facebook','Facebook'],['social','linkedin','LinkedIn','LinkedIn'],['social','website','Website','Сайт'],
      ];
      const section = el('section', 'pc-panel'); section.id = 'publicationConsentPanel';

      // Summary: status, selected count, public preview.
      const summary = el('div', 'pc-card pc-summary');
      const summaryHead = el('div', 'pc-summary-head');
      const summaryTitle = el('div');
      summaryTitle.append(el('h3', 'pc-title', tr('Public profile', 'Публичный профиль')), el('p', 'pc-subtitle', tr('Control what others can see', 'Управляйте тем, что видят другие')));
      const statusPill = el('span', 'pc-status', tr('Loading…', 'Загрузка…')); statusPill.setAttribute('role', 'status');
      summaryHead.append(summaryTitle, statusPill);
      const summaryStats = el('div', 'pc-summary-stats');
      const countBox = el('div', 'pc-count');
      const countValue = el('b', '', '0 / ' + options.length);
      countBox.append(countValue, el('small', '', tr('selected fields', 'выбрано полей')));
      const preview = el('a', 'pc-preview', '👁 ' + tr('Preview public profile', 'Предпросмотр публичного профиля'));
      preview.href = './profile.html?id=' + encodeURIComponent(owner); preview.target = '_blank'; preview.rel = 'noopener';
      summaryStats.append(countBox, preview);
      summary.append(summaryHead, summaryStats);
      const notice = el('p', 'pc-intro', tr('Selected information will be visible to anyone, including people without an account. Choose only information you want to publish. City, social-link and ranking privacy settings still apply. Select the matching discovery field to appear as a teacher or organizer. You can withdraw at any time. Copies already downloaded by others cannot be recalled.', 'Выбранные сведения будут доступны всем, в том числе без аккаунта. Выберите только то, что хотите опубликовать. Настройки скрытия города, соцсетей и рейтинга продолжают действовать. Для поиска преподавателей или организаторов выберите соответствующее поле. Согласие можно отозвать. Уже скачанные другими людьми копии отозвать невозможно.'));
      section.append(summary, notice);

      // Groups (collapsed by default, one open at a time).
      const groupsWrap = el('div', 'pc-groups');
      const groupNodes = {};
      GROUPS.forEach(([id, enTitle, ruTitle, enDesc, ruDesc]) => {
        const card = el('div', 'pc-card pc-group');
        const head = el('button', 'pc-group-head'); head.type = 'button'; head.setAttribute('aria-expanded', 'false');
        const bodyId = 'pcGroup-' + id; head.setAttribute('aria-controls', bodyId);
        head.innerHTML = '<span class="pc-icon">' + svg(ICONS[id], 'pc-icon-svg') + '</span>';
        const copy = el('span', 'pc-group-copy');
        copy.append(el('b', '', tr(enTitle, ruTitle)), el('small', '', tr(enDesc, ruDesc)));
        const counter = el('span', 'pc-group-count');
        head.append(copy, counter);
        head.insertAdjacentHTML('beforeend', svg('<path d="m6 9 6 6 6-6"/>', 'pc-chevron'));
        const body = el('div', 'pc-group-body'); body.id = bodyId; body.setAttribute('role', 'region');
        const inner = el('div', 'pc-group-inner');
        body.append(inner);
        card.append(head, body);
        groupsWrap.append(card);
        groupNodes[id] = { card, head, inner, counter };
        head.addEventListener('click', () => {
          const open = card.classList.contains('open');
          Object.values(groupNodes).forEach((node) => { node.card.classList.remove('open'); node.head.setAttribute('aria-expanded', 'false'); });
          if (!open) { card.classList.add('open'); head.setAttribute('aria-expanded', 'true'); }
        });
      });
      section.append(groupsWrap);
      const boxes = options.map(([group,key,en,ru]) => {
        const row = el('label', 'pc-field');
        row.append(el('span', 'pc-field-label', tr(en,ru)));
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = key; input.disabled = true;
        input.className = 'pc-switch'; input.setAttribute('role', 'switch');
        row.append(input); groupNodes[group].inner.append(row); return input;
      });

      // Publication actions in their own card.
      const actions = el('div', 'pc-card pc-actions');
      actions.append(el('h4', 'pc-actions-title', tr('Publication', 'Публикация')), el('p', 'pc-actions-copy', tr('Opening groups never changes your privacy settings. Only switches change the draft; publishing saves it after confirmation.', 'Открытие разделов не меняет настройки приватности. Черновик меняют только переключатели; публикация сохраняет его после подтверждения.')));
      const publish = el('button', 'pc-publish'); publish.type = 'button'; publish.disabled = true;
      publish.textContent = '🌐 ' + tr('I agree — publish selected fields', 'Согласен — опубликовать выбранные поля');
      const revoke = el('button', 'pc-revoke'); revoke.type = 'button'; revoke.disabled = true;
      const status = el('p', 'pc-message'); status.setAttribute('aria-live', 'polite');
      actions.append(publish, revoke, status);
      section.append(actions);
      host.append(section);
      let current = null; let busy = false;
      function refresh() {
        boxes.forEach(box => { box.disabled = busy || !current; box.setAttribute('aria-checked', box.checked ? 'true' : 'false'); });
        publish.disabled = busy || !current || !boxes.some(b => b.checked);
        revoke.disabled = busy || !current || (!intake && !current.published);
        revoke.textContent = current?.published
          ? tr('Withdraw publication consent', 'Отозвать согласие на публикацию')
          : tr('Keep my profile closed', 'Оставить профиль закрытым');
        countValue.textContent = boxes.filter(b => b.checked).length + ' / ' + boxes.length;
        GROUPS.forEach(([id]) => {
          const inGroup = boxes.filter((box, index) => options[index][0] === id);
          groupNodes[id].counter.textContent = inGroup.filter(b => b.checked).length + '/' + inGroup.length;
        });
      }
      // Since the base profiles table closed, this choice decides live public
      // visibility — so the status reads as current, not as a "future" approval.
      function apply(data) {
        if (!data || typeof data.published !== 'boolean' || !Array.isArray(data.approved_fields) || data.approved_fields.some(f => !options.some(([,key]) => key === f))) throw new Error('Invalid consent response');
        current = data; boxes.forEach(box => { box.checked = data.approved_fields.includes(box.value); });
        statusPill.textContent = data.published ? tr('Published', 'Опубликован') : tr('Not published', 'Не опубликован');
        statusPill.classList.toggle('published', data.published);
        status.textContent = ''; refresh();
      }
      boxes.forEach(box => box.addEventListener('change', refresh));
      refresh();
      async function save(value) {
        if (busy || ctx.user?.id !== owner) return;
        busy = true; refresh();
        try {
          const result = await supa.rpc(intake ? 'set_my_publication_intake_v2' : 'set_my_profile_publication_v2', { publish: value, public_fields: value ? boxes.filter(b => b.checked).map(b => b.value) : [], notice_version: intake ? 'profile-publication-intake-v1' : 'profile-publication-v1', expected_profile_id: owner });
          if (result.error) throw result.error;
          if (section.isConnected && ctx.user?.id === owner) apply(result.data);
        } catch { status.textContent = tr('Could not save. Publication status has not been confirmed.', 'Не удалось сохранить. Статус публикации не подтверждён.'); }
        finally { busy = false; refresh(); }
      }
      publish.addEventListener('click', () => void save(true)); revoke.addEventListener('click', () => void save(false));
      void supa.rpc(intake ? 'get_my_publication_intake_v2' : 'get_my_profile_publication_v2').then(result => {
        if (!section.isConnected || ctx.user?.id !== owner) return;
        if (result.error) throw result.error; apply(result.data);
      }).catch(() => { statusPill.textContent = '—'; status.textContent = tr('Could not load publication settings. Reopen your profile to retry.', 'Не удалось загрузить настройки публикации. Откройте профиль заново для повтора.'); });
    }

    function ensureBusinessProfileTabs() {
      const panel = document.querySelector('[data-panel="profile"]');
      if (!panel || !ctx.isBusiness()) return null;
      let tabs = panel.querySelector('#teacherProfileTabs');
      if (!tabs) {
        tabs = document.createElement('div');
        tabs.id = 'teacherProfileTabs';
        tabs.className = 'teacher-profile-tabs';
        tabs.setAttribute('role', 'tablist');
        tabs.innerHTML = '<button type="button" role="tab" data-profile-tab="profile">' + esc(tr('Profile', 'Профиль')) + '</button>' +
          '<button type="button" role="tab" data-profile-tab="visibility">' + esc(tr('Visibility & privacy', 'Видимость и приватность')) + '</button>' +
          '<button type="button" role="tab" data-profile-tab="preview">' + esc(tr('Student preview', 'Просмотр ученика')) + '</button>';
        panel.insertBefore(tabs, panel.firstElementChild);
        tabs.querySelectorAll('[data-profile-tab]').forEach((button) => button.addEventListener('click', () => {
          businessProfileTab = button.dataset.profileTab || 'profile';
          renderProfile();
        }));
      }
      tabs.querySelectorAll('[data-profile-tab]').forEach((button) => {
        const active = button.dataset.profileTab === businessProfileTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      return tabs;
    }

    function renderBusinessProfileTabContent() {
      if (!ctx.isBusiness()) return;
      const panel = document.querySelector('[data-panel="profile"]');
      const profileView = document.getElementById('profileView');
      const profileEdit = document.getElementById('profileEdit');
      if (!panel || !profileView || !profileEdit) return;
      let host = panel.querySelector('#profileVisibilityWorkspace');
      if (!host) {
        host = document.createElement('section');
        host.id = 'profileVisibilityWorkspace';
        host.className = 'profile-privacy-workspace';
        panel.appendChild(host);
      }
      let preview = panel.querySelector('#profileStudentPreview');
      if (!preview) {
        preview = document.createElement('section');
        preview.id = 'profileStudentPreview';
        preview.className = 'profile-student-preview';
        panel.appendChild(preview);
      }
      profileView.hidden = businessProfileTab !== 'profile';
      profileEdit.hidden = true;
      host.hidden = businessProfileTab !== 'visibility';
      preview.hidden = businessProfileTab !== 'preview';
      if (businessProfileTab === 'visibility') {
        host.innerHTML = '<div class="profile-tab-heading"><span class="settings-eyebrow">DUVELA / TEACHER WORKSPACE</span><h2>' + esc(tr('Public Profile & Privacy', 'Публичный профиль и приватность')) + '</h2><p>' + esc(tr('Control what students and visitors can discover about you.', 'Управляйте тем, что ученики и посетители могут узнать о вас.')) + '</p></div><div id="profileVisibilityConsent"></div>';
        renderPublicationConsent(host.querySelector('#profileVisibilityConsent'));
      } else if (businessProfileTab === 'preview') {
        const id = ctx.profile?.id || ctx.user?.id || '';
        preview.innerHTML = '<div class="profile-tab-heading"><span class="settings-eyebrow">DUVELA / STUDENT VIEW</span><h2>' + esc(tr('How students see your profile', 'Как ученики видят ваш профиль')) + '</h2><p>' + esc(tr('This preview uses the real public profile route and current visibility rules.', 'Предпросмотр использует реальный публичный маршрут и текущие правила видимости.')) + '</p></div>' +
          (id ? '<iframe title="' + esc(tr('Student profile preview', 'Предпросмотр профиля для ученика')) + '" src="./profile.html?id=' + encodeURIComponent(id) + '" loading="lazy"></iframe>' : '<div class="profile-preview-empty">' + esc(tr('Complete your profile to preview it.', 'Заполните профиль, чтобы увидеть предпросмотр.')) + '</div>');
      } else {
        host.innerHTML = '';
        preview.innerHTML = '';
      }
    }

    // What "Open profile" publishes for each role (same bundles as the Hub and
    // Business apps). City and social links still follow show_city /
    // show_social_links.
    const PROFESSIONAL_FIELDS = [
      'full_name', 'avatar_url', 'cover_url', 'city', 'country', 'bio', 'teaches_languages',
      'explanation_languages', 'qualifications', 'specialization', 'teaching_experience',
      'teacher_audience', 'registered_web_role', 'is_verified', 'language',
      'instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'website',
    ];
    const OPEN_PROFILE_FIELDS = {
      teacher: PROFESSIONAL_FIELDS.concat('is_teacher'),
      organizer: PROFESSIONAL_FIELDS.concat('is_organizer'),
      learner: ['full_name', 'avatar_url', 'language', 'language_level', 'score'],
    };

    // One-time "open or closed profile" choice for signed-in users who never
    // made one — since the base profiles table closed, nobody appears in search,
    // the marketplace or rankings without it. Both options are equal and nothing
    // is preselected, so "open" is an affirmative consent. Waits until the
    // onboarding wizard is done and the profile has a name.
    function promptPublicationChoice() {
      const runtime = window.DuvelaRuntimeConfig || {};
      const owner = ctx.user?.id;
      const profile = ctx.profile;
      if (runtime.publicationIntake !== true || !owner || !profile || !String(profile.full_name || '').trim()) return;
      let onboardingDone = false;
      try { onboardingDone = Boolean(localStorage.getItem('duvela.onboarding.' + owner)); } catch (_) { onboardingDone = true; }
      if (!onboardingDone || document.getElementById('publicationChoiceModal')) return;
      void supa.rpc('my_publication_decided').then(({ data, error }) => {
        if (error || data !== false || ctx.user?.id !== owner) return;
        const role = profile.is_teacher ? 'teacher' : profile.is_organizer ? 'organizer' : 'learner';
        openPublicationChoiceModal(owner, role);
      }).catch(() => {});
    }

    function openPublicationChoiceModal(owner, role) {
      const isLearner = role === 'learner';
      const overlay = document.createElement('div');
      overlay.id = 'publicationChoiceModal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'publicationChoiceTitle');
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '10000', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '16px', background: 'rgba(20, 12, 38, 0.55)',
      });
      const sheet = document.createElement('div');
      Object.assign(sheet.style, {
        width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', background: '#FFFFFF',
        borderRadius: '22px', padding: '22px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px',
        color: '#211A2D', fontFamily: 'inherit',
      });
      const title = document.createElement('h2');
      title.id = 'publicationChoiceTitle';
      title.textContent = tr('Your profile on Duvela', 'Ваш профиль на Duvela');
      Object.assign(title.style, { margin: '0', fontSize: '21px', fontWeight: '900' });
      const lead = document.createElement('p');
      lead.textContent = isLearner
        ? tr('Choose whether other learners can see you in rankings, duels and among friends.', 'Выберите, видят ли вас другие ученики в рейтингах, дуэлях и среди друзей.')
        : tr('Choose whether students can find you in search and on the marketplace and open your page.', 'Выберите, могут ли ученики найти вас в поиске и на маркетплейсе и открыть вашу страницу.');
      Object.assign(lead.style, { margin: '0', color: '#4A4258', lineHeight: '1.45' });

      let choice = null;
      const optionButtons = [];
      function option(value, heading, subtitle, details) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', 'false');
        Object.assign(button.style, {
          textAlign: 'left', border: '1.5px solid #E5DDF5', borderRadius: '16px', background: '#FFFFFF',
          padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px', font: 'inherit', color: 'inherit',
        });
        const strong = document.createElement('strong');
        strong.textContent = heading;
        strong.style.fontSize = '16px';
        const sub = document.createElement('span');
        sub.textContent = subtitle;
        sub.style.color = '#4A4258';
        button.append(strong, sub);
        if (details) {
          const small = document.createElement('small');
          small.textContent = details;
          small.style.color = '#7A7088';
          button.append(small);
        }
        button.addEventListener('click', () => {
          choice = value;
          optionButtons.forEach(({ value: v, el }) => {
            const active = v === value;
            el.setAttribute('aria-checked', active ? 'true' : 'false');
            el.style.borderColor = active ? '#683FDC' : '#E5DDF5';
            el.style.background = active ? '#F6F1FE' : '#FFFFFF';
          });
          save.disabled = false;
          save.style.opacity = '1';
        });
        optionButtons.push({ value, el: button });
        return button;
      }
      const openOption = option(
        'open',
        tr('Open profile', 'Открытый профиль'),
        isLearner
          ? tr('Others see you in rankings, duels and friend lists.', 'Вас видят в рейтингах, дуэлях и у друзей.')
          : role === 'organizer'
            ? tr('You appear in organizer search and people can open your page.', 'Вы появляетесь в поиске организаторов, вашу страницу можно открыть.')
            : tr('Students find you in teacher search and the marketplace.', 'Ученики находят вас в поиске преподавателей и на маркетплейсе.'),
        isLearner
          ? tr('Visible: name, photo, language, level and ranking score.', 'Видно: имя, фото, язык, уровень и баллы рейтинга.')
          : tr('Visible: name, photos, city and country, bio, languages, qualifications, experience, social links and the verification badge.', 'Видно: имя, фото и обложка, город и страна, о себе, языки, квалификации и опыт, соцсети и знак проверки.'),
      );
      const closedOption = option(
        'closed',
        tr('Closed profile', 'Закрытый профиль'),
        isLearner
          ? tr('Only you see your profile. You won’t appear in rankings or search.', 'Профиль видите только вы. В рейтингах и поиске вас не будет.')
          : tr('Only you see your profile. Students won’t find you in search or on the marketplace.', 'Профиль видите только вы. Ученики не найдут вас в поиске и на маркетплейсе.'),
      );
      const legal = document.createElement('p');
      legal.textContent = tr(
        'Information in an open profile is visible to anyone, including people without an account. City and social links follow your privacy settings. You can change or withdraw this at any time in your profile → Public profile.',
        'Сведения открытого профиля видны всем, в том числе без аккаунта. Город и соцсети показываются по вашим настройкам приватности. Изменить или отозвать можно в любой момент: Профиль → Публичный профиль.',
      );
      Object.assign(legal.style, { margin: '0', fontSize: '12px', color: '#7A7088', lineHeight: '1.4' });
      const errorLine = document.createElement('p');
      errorLine.setAttribute('role', 'alert');
      Object.assign(errorLine.style, { margin: '0', color: '#A02020', fontWeight: '700', display: 'none' });
      errorLine.textContent = tr('Could not save. Check your connection and try again.', 'Не удалось сохранить. Проверьте соединение и попробуйте ещё раз.');
      const save = document.createElement('button');
      save.type = 'button';
      save.disabled = true;
      save.textContent = tr('Save', 'Сохранить');
      Object.assign(save.style, {
        font: 'inherit', border: '0', borderRadius: '14px', padding: '14px', background: '#683FDC',
        color: '#FFFFFF', fontWeight: '900', fontSize: '16px', cursor: 'pointer', opacity: '0.45',
      });
      const customise = document.createElement('button');
      customise.type = 'button';
      customise.textContent = tr('Choose fields in detail', 'Настроить поля подробно');
      Object.assign(customise.style, { border: '0', background: 'transparent', color: '#683FDC', fontWeight: '800', cursor: 'pointer', font: 'inherit' });

      save.addEventListener('click', async () => {
        if (!choice || save.disabled) return;
        save.disabled = true;
        errorLine.style.display = 'none';
        try {
          const publish = choice === 'open';
          const result = await supa.rpc('set_my_publication_intake_v2', {
            publish,
            public_fields: publish ? OPEN_PROFILE_FIELDS[role] : [],
            notice_version: 'profile-publication-intake-v1',
            expected_profile_id: owner,
          });
          if (result.error) throw result.error;
          overlay.remove();
          if (document.getElementById('publicationConsentPanel')) renderProfile();
        } catch (_) {
          errorLine.style.display = 'block';
          save.disabled = false;
        }
      });
      customise.addEventListener('click', () => {
        overlay.remove();
        window.location.hash = '#profile';
      });

      sheet.append(title, lead, openOption, closedOption, legal, errorLine, save, customise);
      overlay.append(sheet);
      document.body.append(overlay);
      openOption.focus();
    }

    function renderProfile() {
      // Business gets the mobile-style profile view (which owns its own Edit and
      // Verification screens internally); learners keep the plain editable form.
      const pv = document.getElementById('profileView');
      const pe = document.getElementById('profileEdit');
      ensureBusinessProfileTabs();
      // Public publication controls belong to the account Settings workspace;
      // keep Profile focused on identity and editable account details.
      renderPublicationConsent(document.getElementById('settingsPublicProfile'));
      if (ctx.isBusiness() && ctx.profileView) {
        if (pe) pe.classList.remove('learner-profile-edit');
        if (pv) pv.hidden = false;
        if (pe) pe.hidden = true;
        ctx.profileView.render();
      } else {
        if (pv) pv.hidden = true;
        if (pe) {
          pe.hidden = false;
          pe.classList.add('learner-profile-edit');
        }
        ensureLearnerProfileWorkspace();
      }
      const appLanguageSelect = ensureAppLanguageField();
      if ($('#profileKicker')) $('#profileKicker').textContent = tr('Profile', 'Профиль');
      if ($('#profileIdentityTitle')) $('#profileIdentityTitle').textContent = tr('Identity', 'Основное');
      if ($('#profileIdentitySub')) $('#profileIdentitySub').textContent = tr('Basic account details shown across Duvela.', 'Основные данные аккаунта, которые используются в Duvela.');
      if ($('#profilePublicTitle')) $('#profilePublicTitle').textContent = tr('Public profile', 'Публичный профиль');
      if ($('#profilePublicSub')) $('#profilePublicSub').textContent = tr('What learners and visitors can see about you.', 'То, что видят ученики и посетители на вашей странице.');
      if ($('#profileContactsTitle')) $('#profileContactsTitle').textContent = tr('Contacts', 'Контакты');
      if ($('#profileContactsSub')) $('#profileContactsSub').textContent = tr('Optional links for students, partners and your audience.', 'Дополнительные контакты для учеников, партнёров и вашей аудитории.');
      if ($('#profileActionsTitle')) $('#profileActionsTitle').textContent = tr('Account actions', 'Действия с аккаунтом');
      if ($('#profileActionsSub')) $('#profileActionsSub').textContent = tr('Save changes, open your public card or leave the web cabinet.', 'Сохраните изменения, откройте публичную страницу или выйдите из кабинета.');
      if ($('#avatarUploadLabel')) $('#avatarUploadLabel').textContent = tr('Choose avatar from device', 'Выбрать аватар с устройства');
      if ($('#avatarUploadHint')) $('#avatarUploadHint').textContent = tr('Your browser will ask for access to photos or camera on this device.', 'Браузер запросит доступ к фото или камере устройства.');
      if ($('#deleteAccountTitle')) $('#deleteAccountTitle').textContent = tr('Delete account', 'Удалить аккаунт');
      if ($('#deleteAccountHint')) $('#deleteAccountHint').textContent = tr('Permanently removes your Duvela web profile and signs you out from this browser.', 'Полностью удаляет ваш профиль Duvela Web и завершает сессию в этом браузере.');
      if ($('#deleteAccountBtn')) $('#deleteAccountBtn').textContent = tr('Delete account', 'Удалить аккаунт');
      const displayName = ctx.profile?.full_name || ctx.user.user_metadata?.full_name || (ctx.user.email || tr('Duvela user', 'Пользователь Duvela')).split('@')[0];
      const meta = [ctx.profile?.city, ctx.profile?.country].filter(Boolean).join(', ') || tr('Signed in to ', 'Вход выполнен в ') + (ctx.isBusiness() ? 'Duvela Business' : 'Duvela Hub');
      if ($('#topName')) $('#topName').textContent = displayName;
      if ($('#topEmail')) $('#topEmail').textContent = (ctx.isBusiness() ? 'Duvela Business' : 'Duvela Hub') + ' - ' + (ctx.user.email || roleLabels[ctx.role]);
      $('#profileName').textContent = displayName;
      $('#profileMeta').textContent = meta;
      setInput('#profileEmail', ctx.user.email || '');
      setInput('#profileRole', roleLabels[ctx.role] || ctx.role);
      setInput('#pfName', ctx.profile?.full_name);
      setInput('#pfCity', ctx.profile?.city);
      setInput('#pfCountry', ctx.profile?.country);
      setInput('#pfLanguage', ctx.profile?.language);
      setInput('#pfLevel', ctx.profile?.language_level);
      setInput('#pfGoal', studentGoal.fromProfile(ctx.profile, ''));
      setInput('#pfAvatar', ctx.profile?.avatar_url);
      if ($('#pfNativeLanguageLabel')) $('#pfNativeLanguageLabel').textContent = ctx.isBusiness() ? tr('Native language', 'Родной язык') : tr('Learning language', 'Язык обучения');
      if ($('#pfGoalLabel')) $('#pfGoalLabel').textContent = tr('Student Goal', 'Цель ученика');
      if ($('#pfGoalField')) $('#pfGoalField').style.display = ctx.isBusiness() ? 'none' : '';
      if ($('#avatarRemoveBtn')) $('#avatarRemoveBtn').textContent = tr('Remove avatar', 'Удалить аватар');
      if ($('#avatarUploadHint')) $('#avatarUploadHint').textContent = tr('Choose JPG, PNG or WebP up to 5 MB. On mobile you can pick from photos or camera.', 'Выберите JPG, PNG или WebP до 5 MB. На телефоне можно выбрать фото или камеру.');
      setInput('#pfBio', ctx.profile?.bio);
      setInput('#pfTelegram', ctx.profile?.telegram);
      setInput('#pfInstagram', ctx.profile?.instagram);
      setInput('#pfTiktok', ctx.profile?.tiktok);
      setInput('#pfWebsite', ctx.profile?.website);
      if (appLanguageSelect) appLanguageSelect.value = ctx.getAppLang();
      avatarHtml('#topAvatar', displayName, ctx.profile?.avatar_url);
      avatarHtml('#profileAvatar', displayName, ctx.profile?.avatar_url);
      bindAvatarControls(displayName);
      renderLearnerProfileHero(displayName, meta);
      if (ctx.profile?.id) {
        $('#publicProfileLink').href = './profile.html?id=' + encodeURIComponent(ctx.profile.id);
        $('#publicProfileLink').style.display = 'inline-flex';
      }
      renderProgressCard();
      renderBusinessProfileTabContent();
    }

    function learnerGoalItems() {
      const profile = ctx.profile || {};
      const targets = Array.isArray(profile.learning_targets) ? profile.learning_targets : [];
      const aggregate = targets.find((item) => item && typeof item === 'object' && (item.goalLevels || item.goals || item.levels || Array.isArray(item.languages))) || {};
      const languages = Array.isArray(aggregate.languages) && aggregate.languages.length
        ? aggregate.languages
        : Array.isArray(profile.learning_languages) ? profile.learning_languages : [];
      const levels = aggregate.levels && typeof aggregate.levels === 'object' ? aggregate.levels : {};
      const goalLevels = aggregate.goalLevels && typeof aggregate.goalLevels === 'object' ? aggregate.goalLevels : {};
      const goals = aggregate.goals && typeof aggregate.goals === 'object' ? aggregate.goals : {};
      const items = languages.map((language) => {
        const individual = targets.find((item) => item && typeof item === 'object' && String(item.language || '') === String(language)) || {};
        const currentLevel = levels[language] || individual.level || profile.language_level || 'A1';
        const targetLevel = goalLevels[language] || individual.goalLevel || profile.goal_level || currentLevel;
        const rawGoal = goals[language] || individual.goal || '';
        const goal = String(rawGoal || '').toUpperCase() === String(targetLevel || '').toUpperCase() ? '' : rawGoal;
        return { language, currentLevel, targetLevel, goal };
      });
      if (!items.length && profile.language) {
        const targetLevel = profile.goal_level || profile.language_level || 'A1';
        const rawGoal = profile.learning_goal || '';
        items.push({
          language: profile.language,
          currentLevel: profile.language_level || 'A1',
          targetLevel: targetLevel,
          goal: String(rawGoal || '').toUpperCase() === String(targetLevel || '').toUpperCase() ? '' : rawGoal
        });
      }
      return items;
    }

    function renderLearnerProfileHero(displayName, meta) {
      if (ctx.isBusiness()) return;
      const intro = document.querySelector('#profileForm .profile-intro');
      if (!intro) return;
      let summary = $('#learnerProfileSummary');
      if (!summary) {
        summary = document.createElement('div');
        summary.id = 'learnerProfileSummary';
        summary.className = 'learner-profile-summary';
        intro.appendChild(summary);
      }
      const goalItems = learnerGoalItems();
      const level = goalItems[0]?.currentLevel || ctx.profile?.language_level || 'A1';
      const goal = goalItems[0]?.targetLevel || studentGoal.fromProfile(ctx.profile, '');
      summary.innerHTML =
        '<div class="learner-profile-badges">' +
          '<span>🎓 ' + esc(tr('Learner', 'Ученик')) + '</span>' +
          '<span>✨ ' + esc(tr('Level', 'Уровень')) + ' ' + esc(level) + '</span>' +
          (goal ? '<span>⚑ ' + esc(tr('Goal', 'Цель')) + ' ' + esc(goal) + '</span>' : '') +
          goalItems.slice(0, 4).map((item) => '<span>🌐 ' + esc(item.language) + ' ' + esc(item.currentLevel) + ' -> ' + esc(item.targetLevel) + (item.goal ? ' - ' + esc(item.goal) : '') + '</span>').join('') +
        '</div>' +
        '<p class="learner-profile-welcome">' + esc(tr('Your learning profile, goals and progress in one place.', 'Ваш учебный профиль, цели и прогресс в одном месте.')) + '</p>';
      const name = $('#profileName');
      const location = $('#profileMeta');
      if (name) name.textContent = displayName;
      if (location) location.textContent = meta;
    }

    function ensureLearnerProfileWorkspace() {
      const host = $('#profileEdit');
      if (!host || ctx.isBusiness()) return null;
      let workspace = $('#learnerProfileWorkspace');
      if (!workspace) {
        const legacyGrid = $('#profileForm')?.closest('.grid-2');
        if (!legacyGrid) return null;
        workspace = document.createElement('div');
        workspace.id = 'learnerProfileWorkspace';
        workspace.className = 'lp-workspace';
        workspace.innerHTML =
          '<header class="lp-page-head"><div><span>' + esc(tr('DUVELA HUB · LEARNER', 'DUVELA HUB · УЧЕНИК')) + '</span><h2>' + esc(tr('My Learning Profile', 'Мой учебный профиль')) + '</h2><p>' + esc(tr('Your progress, achievements and learning journey.', 'Ваш прогресс, достижения и учебный путь.')) + '</p></div></header>' +
          '<nav class="lp-tabs" role="tablist" aria-label="' + esc(tr('Learner profile sections', 'Разделы профиля ученика')) + '">' +
            '<button type="button" role="tab" data-lp-tab="overview">' + esc(tr('Overview', 'Обзор')) + '</button>' +
            '<button type="button" role="tab" data-lp-tab="achievements">' + esc(tr('Achievements', 'Достижения')) + '</button>' +
            '<button type="button" role="tab" data-lp-tab="account">' + esc(tr('Account & Privacy', 'Аккаунт и приватность')) + '</button>' +
          '</nav>' +
          '<section class="lp-pane" data-lp-pane="overview" role="tabpanel"><div class="lp-loading">' + esc(tr('Loading your learning journey…', 'Загружаем ваш учебный путь…')) + '</div></section>' +
          '<section class="lp-pane" data-lp-pane="achievements" role="tabpanel"><div class="lp-loading">' + esc(tr('Loading achievements…', 'Загружаем достижения…')) + '</div></section>' +
          '<section class="lp-pane" data-lp-pane="account" role="tabpanel"><header class="lp-account-head"><div><span class="lp-eyebrow">' + esc(tr('ACCOUNT & PRIVACY', 'АККАУНТ И ПРИВАТНОСТЬ')) + '</span><h3>' + esc(tr('Profile details and visibility', 'Данные профиля и видимость')) + '</h3><p>' + esc(tr('Private account fields stay in this section. Public visibility remains controlled by your Duvela privacy settings.', 'Личные данные находятся в этом разделе. Публичность профиля по-прежнему управляется настройками приватности Duvela.')) + '</p></div><a class="btn" href="#settings" data-go="settings"><i data-lucide="shield"></i>' + esc(tr('Privacy settings', 'Настройки приватности')) + '</a></header></section>';
        host.insertBefore(workspace, legacyGrid);
        workspace.querySelector('[data-lp-pane="account"]').appendChild(legacyGrid);
        workspace.addEventListener('click', (event) => {
          const tab = event.target.closest('[data-lp-tab]');
          const edit = event.target.closest('[data-lp-edit]');
          if (tab) setLearnerProfileTab(tab.dataset.lpTab);
          if (edit) setLearnerProfileTab('account');
        });
      }
      setLearnerProfileTab(learnerProfileTab);
      return workspace;
    }

    function setLearnerProfileTab(tab) {
      const workspace = $('#learnerProfileWorkspace');
      if (!workspace) return;
      learnerProfileTab = ['overview', 'achievements', 'account'].includes(tab) ? tab : 'overview';
      workspace.querySelectorAll('[data-lp-tab]').forEach((button) => {
        const active = button.dataset.lpTab === learnerProfileTab;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
      });
      workspace.querySelectorAll('[data-lp-pane]').forEach((pane) => {
        pane.hidden = pane.dataset.lpPane !== learnerProfileTab;
      });
    }

    async function learnerProfileQuery(factory) {
      try {
        const result = await factory();
        return result && !result.error ? { available: true, data: result.data } : { available: false, data: null };
      } catch (_) {
        return { available: false, data: null };
      }
    }

    async function loadLearnerProfileInsights() {
      if (!ctx.user?.id) return {};
      const userId = ctx.user.id;
      const [practice, streak, achievements, languageProfiles, coins, challenges] = await Promise.all([
        learnerProfileQuery(() => supa.from('practice_progress').select('tool_id,sessions,xp,best_score,correct,attempted').eq('user_id', userId)),
        learnerProfileQuery(() => supa.from('practice_streaks').select('current_streak,longest_streak,today_sessions,daily_goal').eq('user_id', userId).maybeSingle()),
        learnerProfileQuery(() => supa.from('practice_achievements').select('achievement_id,unlocked_at,metadata').eq('user_id', userId).order('unlocked_at', { ascending: false })),
        learnerProfileQuery(() => supa.from('learner_language_profiles').select('language,current_level,goal_level,is_active,practice_progress,score').eq('user_id', userId)),
        learnerProfileQuery(() => supa.from('coin_transactions').select('amount,balance_after,source,label,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(8)),
        learnerProfileQuery(() => supa.from('challenge_participants').select('challenge_id,status').eq('user_id', userId))
      ]);
      return { practice, streak, achievements, languageProfiles, coins, challenges };
    }

    function verifiedPercent(value) {
      if (value === null || value === undefined || value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
    }

    function learnerSkillRow(label, value) {
      const percent = verifiedPercent(value);
      if (percent === null) {
        return '<div class="lp-skill unavailable"><div><span>' + esc(label) + '</span><em>' + esc(tr('No verified data yet', 'Подтверждённых данных пока нет')) + '</em></div><div class="lp-progress"><i></i></div></div>';
      }
      return '<div class="lp-skill"><div><span>' + esc(label) + '</span><b>' + percent + '%</b></div><div class="lp-progress"><i style="width:' + percent + '%"></i></div></div>';
    }

    function learnerLevelTimeline(current, target, achievements) {
      const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const completed = new Set();
      (achievements || []).forEach((row) => {
        const metadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const explicit = metadata.completed_level || (metadata.completed === true ? metadata.level : '');
        if (levels.includes(String(explicit || '').toUpperCase())) completed.add(String(explicit).toUpperCase());
      });
      return '<div class="lp-level-track">' + levels.map((level) => {
        const classes = [level === current ? 'current' : '', level === target ? 'target' : '', completed.has(level) ? 'completed' : ''].filter(Boolean).join(' ');
        const note = level === current ? tr('Current', 'Сейчас') : level === target ? tr('Target', 'Цель') : completed.has(level) ? tr('Verified', 'Подтверждено') : '';
        return '<div class="' + classes + '"><span>' + level + '</span>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div>';
      }).join('') + '</div>';
    }

    function learnerMetric(icon, value, label, help) {
      return '<article class="lp-metric"><i data-lucide="' + icon + '"></i><div><strong>' + esc(value) + '</strong><span>' + esc(label) + '</span>' + (help ? '<small>' + esc(help) + '</small>' : '') + '</div></article>';
    }

    function formatAchievementName(value) {
      return String(value || tr('Learning milestone', 'Учебная цель')).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function renderLearnerProfileWorkspace(insights) {
      const workspace = ensureLearnerProfileWorkspace();
      if (!workspace) return;
      const overview = workspace.querySelector('[data-lp-pane="overview"]');
      const achievementsPane = workspace.querySelector('[data-lp-pane="achievements"]');
      const displayName = ctx.profile?.full_name || ctx.user.user_metadata?.full_name || (ctx.user.email || tr('Duvela learner', 'Ученик Duvela')).split('@')[0];
      const goals = learnerGoalItems();
      const activeLanguageProfile = (insights.languageProfiles?.data || []).find((item) => item?.is_active) || (insights.languageProfiles?.data || [])[0] || {};
      const firstGoal = goals[0] || {};
      const language = activeLanguageProfile.language || firstGoal.language || ctx.profile?.language || tr('Learning language not set', 'Язык обучения не выбран');
      const current = String(activeLanguageProfile.current_level || firstGoal.currentLevel || ctx.profile?.language_level || 'A1').toUpperCase();
      const target = String(activeLanguageProfile.goal_level || firstGoal.targetLevel || studentGoal.fromProfile(ctx.profile, current) || current).toUpperCase();
      const xp = ctx.profile?.score;
      const coins = ctx.profile?.vela_coin_balance;
      const progressValue = verifiedPercent(activeLanguageProfile.practice_progress?.overall ?? activeLanguageProfile.practice_progress);
      const achievementRows = insights.achievements?.data || [];
      const streak = insights.streak?.data || null;
      const city = [ctx.profile?.city, ctx.profile?.country].filter(Boolean).join(', ');
      const bio = String(ctx.profile?.bio || '').trim();
      const recommendation = target !== current
        ? tr('Continue ', 'Продолжить ') + language + ' ' + current + tr(' practice', ' — практика')
        : tr('Keep building your ', 'Продолжайте развивать ') + language + ' ' + current;
      const nextText = target !== current
        ? tr('Your next verified target is ', 'Следующая подтверждённая цель — ') + target + '.'
        : tr('Choose a new target in Account & Privacy when you are ready.', 'Когда будете готовы, выберите новую цель в разделе «Аккаунт и приватность».');

      overview.innerHTML =
        '<div class="lp-overview-grid"><main class="lp-main-column">' +
          '<section class="lp-hero"><div class="lp-avatar" id="lpAvatar"></div><div class="lp-hero-copy"><span class="lp-eyebrow">' + esc(tr('LEARNER PROFILE', 'ПРОФИЛЬ УЧЕНИКА')) + '</span><h2>' + esc(displayName) + '</h2><p class="lp-hero-line">' + esc(language + ' · ' + current + ' → ' + target) + '</p>' + (bio ? '<p class="lp-bio">' + esc(bio) + '</p>' : '') + '<div class="lp-chips"><span>' + esc(language) + '</span><span>' + esc(tr('Current ', 'Сейчас ') + current) + '</span><span>' + esc(tr('Goal ', 'Цель ') + target) + '</span>' + (city ? '<span>' + esc(city) + '</span>' : '') + '</div></div><button type="button" class="btn primary" data-lp-edit><i data-lucide="pencil"></i>' + esc(tr('Edit Profile', 'Редактировать профиль')) + '</button></section>' +
          '<section class="lp-card lp-journey"><div class="lp-card-head"><div><span class="lp-eyebrow">' + esc(tr('LEARNING JOURNEY', 'УЧЕБНЫЙ ПУТЬ')) + '</span><h3>' + esc(language + ' · ' + current + ' → ' + target) + '</h3></div><span class="lp-status">' + esc(tr('Recommended next: ', 'Следующий шаг: ') + (target !== current ? target : tr('keep practising', 'продолжать практику'))) + '</span></div>' + learnerLevelTimeline(current, target, achievementRows) + '<p class="lp-data-note"><i data-lucide="shield-check"></i>' + esc(tr('Completed levels appear only after a verified milestone is recorded.', 'Завершённые уровни отмечаются только после подтверждённой учебной цели.')) + '</p></section>' +
          '<section class="lp-card"><div class="lp-card-head"><div><span class="lp-eyebrow">' + esc(tr('LEARNING ANALYTICS', 'УЧЕБНАЯ АНАЛИТИКА')) + '</span><h3>' + esc(tr('Skill progress', 'Прогресс навыков')) + '</h3></div></div><div class="lp-skills">' +
            learnerSkillRow(tr('Grammar', 'Грамматика'), ctx.profile?.grammar_progress) + learnerSkillRow(tr('Speaking', 'Разговорная речь'), ctx.profile?.speaking_progress) + learnerSkillRow(tr('Vocabulary', 'Словарный запас'), ctx.profile?.vocabulary_progress) + learnerSkillRow(tr('Exam preparation', 'Подготовка к экзамену'), ctx.profile?.exam_progress) +
          '</div></section>' +
          '<section class="lp-continue"><div><span class="lp-eyebrow">' + esc(tr('CONTINUE LEARNING', 'ПРОДОЛЖИТЬ ОБУЧЕНИЕ')) + '</span><h3>' + esc(recommendation) + '</h3><p>' + esc(nextText) + '</p></div><div><a class="btn primary" href="#workspace" data-go="workspace">' + esc(tr('Open Practice', 'Открыть практику')) + '</a><a class="btn" href="#courses" data-go="courses">' + esc(tr('View Courses', 'Посмотреть курсы')) + '</a><a class="btn" href="#live" data-go="live">' + esc(tr('Upcoming LIVE', 'Ближайшие LIVE')) + '</a></div></section>' +
        '</main><aside class="lp-side-column"><section class="lp-metrics">' +
          learnerMetric('zap', xp === null || xp === undefined ? '—' : Number(xp).toLocaleString(), 'XP', xp === null || xp === undefined ? tr('Not reported', 'Нет данных') : '') +
          learnerMetric('coins', coins === null || coins === undefined ? '—' : Number(coins).toLocaleString(), tr('Duvela Coins', 'Монеты Duvela'), tr('Internal balance', 'Внутренний баланс')) +
          learnerMetric('target', target, tr('Goal level', 'Целевой уровень'), '') +
          learnerMetric('chart-no-axes-column-increasing', progressValue === null ? '—' : progressValue + '%', tr('Learning progress', 'Прогресс обучения'), progressValue === null ? tr('Awaiting verified activity', 'Ожидается подтверждённая активность') : '') +
        '</section><section class="lp-card lp-personal-goal"><span class="lp-eyebrow">' + esc(tr('CURRENT GOAL', 'ТЕКУЩАЯ ЦЕЛЬ')) + '</span><h3>' + esc(target !== current ? tr('Reach ', 'Достичь ') + target : tr('Strengthen ', 'Закрепить ') + current) + '</h3><p>' + esc(firstGoal.goal || nextText) + '</p></section>' + leaderboardShellHtml() + '</aside></div>';
      avatarHtml('#lpAvatar', displayName, ctx.profile?.avatar_url);

      const practiceRows = insights.practice?.data || [];
      const coinRows = insights.coins?.data || [];
      const completedChallenges = (insights.challenges?.data || []).filter((row) => String(row?.status || '').toLowerCase() === 'completed');
      achievementsPane.innerHTML =
        '<div class="lp-achievement-grid"><main>' +
          '<section class="lp-achievement-hero"><div><span class="lp-eyebrow">' + esc(tr('ACHIEVEMENTS', 'ДОСТИЖЕНИЯ')) + '</span><h2>' + esc(tr('Your verified learning record', 'Ваши подтверждённые результаты')) + '</h2><p>' + esc(tr('Only activity stored in your Duvela account appears here.', 'Здесь отображается только активность, сохранённая в вашем аккаунте Duvela.')) + '</p></div><div class="lp-streak"><i data-lucide="flame"></i><strong>' + esc(streak ? String(Number(streak.current_streak || 0)) : '—') + '</strong><span>' + esc(tr('day streak', 'дней подряд')) + '</span></div></section>' +
          '<section class="lp-card"><div class="lp-card-head"><div><span class="lp-eyebrow">' + esc(tr('BADGES & MILESTONES', 'ЗНАЧКИ И ЦЕЛИ')) + '</span><h3>' + esc(tr('Unlocked achievements', 'Полученные достижения')) + '</h3></div></div>' +
            (achievementRows.length ? '<div class="lp-badge-grid">' + achievementRows.map((row) => '<article><i data-lucide="award"></i><div><b>' + esc(formatAchievementName(row.achievement_id)) + '</b><span>' + esc(row.unlocked_at ? new Date(row.unlocked_at).toLocaleDateString() : tr('Verified', 'Подтверждено')) + '</span></div></article>').join('') + '</div>' : '<div class="lp-empty">' + esc(insights.achievements?.available ? tr('No verified achievements yet. Complete practice activities to unlock your first milestone.', 'Подтверждённых достижений пока нет. Выполняйте упражнения, чтобы открыть первую цель.') : tr('Achievements are currently unavailable.', 'Достижения сейчас недоступны.')) + '</div>') +
          '</section><section class="lp-card"><div class="lp-card-head"><div><span class="lp-eyebrow">' + esc(tr('XP ACTIVITY', 'АКТИВНОСТЬ XP')) + '</span><h3>' + esc(tr('Practice record', 'История практики')) + '</h3></div></div>' +
            (practiceRows.length ? '<div class="lp-activity-list">' + practiceRows.map((row) => '<article><div><b>' + esc(formatAchievementName(row.tool_id)) + '</b><span>' + esc(Number(row.sessions || 0) + ' ' + tr('sessions', 'занятий')) + '</span></div><strong>+' + Number(row.xp || 0).toLocaleString() + ' XP</strong></article>').join('') + '</div>' : '<div class="lp-empty">' + esc(insights.practice?.available ? tr('No practice XP history yet.', 'Истории XP за практику пока нет.') : tr('XP history is currently unavailable.', 'История XP сейчас недоступна.')) + '</div>') +
          '</section></main><aside><section class="lp-card"><span class="lp-eyebrow">' + esc(tr('STREAK', 'СЕРИЯ')) + '</span><div class="lp-streak-details"><div><strong>' + esc(streak ? String(Number(streak.current_streak || 0)) : '—') + '</strong><span>' + esc(tr('Current', 'Текущая')) + '</span></div><div><strong>' + esc(streak ? String(Number(streak.longest_streak || 0)) : '—') + '</strong><span>' + esc(tr('Best', 'Лучшая')) + '</span></div></div></section>' +
          '<section class="lp-card"><span class="lp-eyebrow">' + esc(tr('CHALLENGES', 'ЧЕЛЛЕНДЖИ')) + '</span><h3>' + esc(completedChallenges.length ? completedChallenges.length + ' ' + tr('completed', 'завершено') : tr('No completed challenges yet', 'Завершённых челленджей пока нет')) + '</h3><a href="#challenges" data-go="challenges">' + esc(tr('Open challenges', 'Открыть челленджи')) + ' →</a></section>' +
          '<section class="lp-card"><span class="lp-eyebrow">' + esc(tr('COIN ACTIVITY', 'ОПЕРАЦИИ С МОНЕТАМИ')) + '</span><h3>' + esc(coins === null || coins === undefined ? tr('Balance unavailable', 'Баланс недоступен') : Number(coins).toLocaleString() + ' DC') + '</h3><p class="lp-data-note">' + esc(tr('Duvela Coins are an internal balance and are not EUR.', 'Монеты Duvela — внутренний баланс, а не EUR.')) + '</p>' +
            (coinRows.length ? '<div class="lp-coin-list">' + coinRows.slice(0, 5).map((row) => '<div><span>' + esc(row.label || row.source || tr('Coin activity', 'Операция')) + '</span><b class="' + (Number(row.amount) >= 0 ? 'positive' : '') + '">' + (Number(row.amount) >= 0 ? '+' : '') + Number(row.amount || 0).toLocaleString() + '</b></div>').join('') + '</div>' : '<div class="lp-empty compact">' + esc(insights.coins?.available ? tr('No coin activity yet.', 'Операций с монетами пока нет.') : tr('Coin history is unavailable.', 'История монет недоступна.')) + '</div>') + '</section></aside></div>';

      const filter = $('#rankFilter');
      if (filter && !filter.dataset.lpBound) {
        filter.dataset.lpBound = 'true';
        filter.addEventListener('change', () => {
          state.leaderScope = filter.value;
          renderLeaderboard();
        });
      }
      renderLeaderboard();
      if (window.lucide?.createIcons) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
      setLearnerProfileTab(learnerProfileTab);
    }

    async function saveProfile(event) {
      event.preventDefault();
      const avatarFile = $('#pfAvatarFile')?.files?.[0] || null;
      const goalPatch = ctx.isBusiness() ? {} : studentGoal.legacyPatch($('#pfGoal')?.value || ctx.profile?.goal_level || 'A2');
      const patch = {
        full_name: $('#pfName').value.trim() || null,
        city: $('#pfCity').value.trim() || null,
        country: $('#pfCountry').value.trim() || null,
        language: $('#pfLanguage').value.trim() || null,
        language_level: $('#pfLevel').value.trim() || null,
        ...goalPatch,
        avatar_url: $('#pfAvatar').value.trim() || null,
        bio: $('#pfBio').value.trim() || null,
        telegram: $('#pfTelegram').value.trim() || null,
        instagram: $('#pfInstagram').value.trim() || null,
        tiktok: $('#pfTiktok').value.trim() || null,
        updated_at: new Date().toISOString()
      };
      if ($('#pfWebsite')) patch.website = $('#pfWebsite').value.trim() || null;
      const button = $('#profileForm button[type="submit"]');
      button.disabled = true;
      try {
        const avatarError = getAvatarFileError(avatarFile);
        if (avatarError) throw new Error(avatarError);
        if (avatarFile) {
          setAvatarStatus(tr('Uploading avatar...', 'Загружаем аватар...'), 'ready');
          patch.avatar_url = await (ctx.uploadAvatar ? ctx.uploadAvatar(avatarFile) : ctx.uploadToBucket('posts', avatarFile));
          setInput('#pfAvatar', patch.avatar_url);
        } else if (removeAvatarOnSave) {
          patch.avatar_url = null;
        }
        const { error } = await supa.from('profiles').update(patch).eq('id', ctx.user.id);
        if (error) throw error;
        if (!ctx.isBusiness()) {
          try {
            await supa.from('learner_language_profiles')
              .update({ is_active: false, updated_at: patch.updated_at })
              .eq('user_id', ctx.user.id);
            await supa.from('learner_language_profiles').upsert({
              user_id: ctx.user.id,
              language: patch.language || 'Language',
              current_level: patch.language_level || 'A1',
              goal_level: patch.goal_level,
              is_active: true,
              updated_at: patch.updated_at
            }, { onConflict: 'user_id,language' });
          } catch (syncError) {
            // Older projects may not have the cross-platform learner profile table yet.
          }
        }
        ctx.setProfile({ ...(ctx.profile || {}), ...patch });
        $('#profileSaved').style.display = 'inline';
        setTimeout(() => { $('#profileSaved').style.display = 'none'; }, 2500);
        if ($('#pfAvatarFile')) $('#pfAvatarFile').value = '';
        clearAvatarPreviewUrl();
        removeAvatarOnSave = false;
        setAvatarStatus(tr('Avatar saved.', 'Аватар сохранён.'), 'saved');
        renderProfile();
      } catch (error) {
        setAvatarStatus(error.message || tr('Could not save the profile.', 'Не удалось сохранить профиль.'), 'error');
        alert(error.message || tr('Could not save the profile.', 'Не удалось сохранить профиль.'));
      } finally {
        button.disabled = false;
      }
    }

    async function deleteAccount() {
      const confirmed = window.confirm(tr(
        'Delete your Duvela web profile? This will remove your profile data from the web cabinet and sign you out from this browser.',
        'Удалить ваш профиль Duvela Web? Это удалит данные профиля из веб-кабинета и выполнит выход из этого браузера.'
      ));
      if (!confirmed) return;
      const button = $('#deleteAccountBtn');
      if (button) button.disabled = true;
      try {
        const { error } = await supa.from('profiles').delete().eq('id', ctx.user.id);
        if (error) throw error;
        await supa.auth.signOut();
        window.location.href = './index.html';
      } catch (error) {
        alert(error.message || tr('Could not delete the account.', 'Не удалось удалить аккаунт.'));
        if (button) button.disabled = false;
      }
    }

    function portfolioHtml() {
      return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Portfolio', 'Портфолио')) + '</h2></div>' +
        '<form id="pfAddForm" style="margin-bottom:10px">' +
          '<div class="field"><label>' + esc(tr('Title', 'Название')) + '</label><input id="pfItemTitle" maxlength="120" required></div>' +
          '<div class="field"><label>' + esc(tr('Description', 'Описание')) + '</label><textarea id="pfItemDesc" maxlength="400"></textarea></div>' +
          '<div class="field"><label>' + esc(tr('Image (optional)', 'Изображение (необязательно)')) + '</label><input id="pfItemImg" type="file" accept="image/*"></div>' +
          '<button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Add to portfolio', 'Добавить в портфолио')) + '</button>' +
        '</form>' +
        (state.portfolio.length ? state.portfolio.map((item) =>
          '<div class="card row" style="grid-template-columns:52px minmax(0,1fr) auto"><div class="thumb">' + (item.image_url ? '<img src="' + esc(item.image_url) + '" alt="">' : esc((item.title || 'P').charAt(0))) + '</div><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.description || '') + '</p></div><button class="btn danger" data-del-portfolio="' + esc(item.id) + '" style="min-height:30px">' + esc(tr('Delete', 'Удалить')) + '</button></div>'
        ).join('') : '<div class="empty">' + esc(tr('No portfolio items yet.', 'В портфолио пока пусто.')) + '</div>');
    }

    function verificationHtml() {
      const verification = state.verification;
      const statuses = {
        pending: tr('Pending review', 'На проверке'),
        approved: tr('Verified ✓', 'Подтверждено ✓'),
        rejected: tr('Rejected', 'Отклонено'),
        denied: tr('Rejected', 'Отклонено')
      };
      if (verification) {
        return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Verification', 'Верификация')) + '</h2><span class="tag ' + (verification.status === 'approved' ? 'teal' : '') + '">' + esc(statuses[verification.status] || verification.status) + '</span></div>' +
          (verification.note ? '<p style="color:var(--soft);font-weight:700">' + esc(verification.note) + '</p>' : '');
      }
      return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Verification', 'Верификация')) + '</h2></div>' +
        '<form id="verForm"><div class="field"><label>' + esc(tr('Why should we verify you?', 'Почему стоит вас верифицировать?')) + '</label><textarea id="verNote" maxlength="400"></textarea></div><button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Request verification', 'Запросить верификацию')) + '</button></form>';
    }

    async function addPortfolioItem(event) {
      event.preventDefault();
      const title = $('#pfItemTitle').value.trim();
      if (!title) return;
      const button = $('#pfAddForm button[type="submit"]');
      button.disabled = true;
      try {
        let imageUrl = null;
        const fileInput = $('#pfItemImg');
        if (fileInput && fileInput.files && fileInput.files[0]) imageUrl = await ctx.uploadToBucket('posts', fileInput.files[0]);
        const { error } = await supa.from('organizer_portfolio').insert({
          user_id: ctx.user.id,
          title,
          description: $('#pfItemDesc').value.trim() || null,
          image_url: imageUrl
        });
        if (error) throw error;
        await ctx.loadBusinessWorkspace();
        renderProgressCard();
      } catch (error) {
        alert(error.message || tr('Could not add the item.', 'Не удалось добавить.'));
        button.disabled = false;
      }
    }

    async function deletePortfolioItem(id) {
      try {
        await supa.from('organizer_portfolio').delete().eq('id', id);
        await ctx.loadBusinessWorkspace();
        renderProgressCard();
      } catch (error) {
        alert(error.message || tr('Could not delete.', 'Не удалось удалить.'));
      }
    }

    async function submitVerification(event) {
      event.preventDefault();
      const button = $('#verForm button[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await supa.from('verification_requests').insert({
          user_id: ctx.user.id,
          organization_id: state.myOrg ? state.myOrg.id : null,
          note: $('#verNote').value.trim() || null
        });
        if (error) throw error;
        await ctx.loadBusinessWorkspace();
        renderProgressCard();
      } catch (error) {
        alert(error.message || tr('Could not submit the request.', 'Не удалось отправить запрос.'));
        button.disabled = false;
      }
    }

    async function renderProgressCard() {
      const card = $('#progressCard');
      if (!card) return;
      const profileGrid = card.parentElement;
      if (ctx.isBusiness()) {
        card.style.display = 'none';
        if (profileGrid) profileGrid.style.gridTemplateColumns = 'minmax(0, 1fr)';
        card.innerHTML =
          '<div class="section-head"><h2>' + esc(tr('Account', 'Аккаунт')) + '</h2></div>' +
          '<p style="font-weight:800;color:var(--soft)">' + esc(tr('You are signed in as ', 'Вы вошли как ') + (roleLabels[ctx.role] || ctx.role) + '.') + '</p>' +
          ctx.walletHtml() + portfolioHtml() + verificationHtml();
        const portfolioForm = $('#pfAddForm');
        if (portfolioForm) portfolioForm.addEventListener('submit', addPortfolioItem);
        const verificationForm = $('#verForm');
        if (verificationForm) verificationForm.addEventListener('submit', submitVerification);
        return;
      }
      if (profileGrid) profileGrid.style.gridTemplateColumns = 'minmax(0, 1fr)';
      card.style.display = 'none';
      const workspace = ensureLearnerProfileWorkspace();
      if (workspace) {
        const insights = await loadLearnerProfileInsights();
        renderLearnerProfileWorkspace(insights);
      }
    }

    function listFrom(value) {
      if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
      if (value == null) return [];
      return String(value).split(',').map((item) => item.trim()).filter(Boolean);
    }

    function addUnique(list, value) {
      const text = String(value || '').trim();
      if (!text) return;
      if (!list.some((item) => item.toLowerCase() === text.toLowerCase())) list.push(text);
    }

    function activeRoleKind() {
      if (['teacher', 'organizer', 'organization'].includes(ctx.role)) return ctx.role;
      if (ctx.profile?.is_teacher) return 'teacher';
      if (ctx.profile?.is_organizer) return 'organizer';
      return 'learner';
    }

    function leaderboardConfig() {
      const kind = activeRoleKind();
      if (kind === 'teacher') {
        return {
          kind,
          field: 'teaches_languages',
          fallback: 'learning_languages',
          title: tr('Teacher leaderboard', 'Рейтинг учителей'),
          subtitle: tr('Only teachers who teach this direction are shown.', 'Показываются только учителя, которые преподают это направление.'),
          empty: tr('No teachers found for this direction.', 'По этому направлению учителей пока нет.'),
          scopeLabel: tr('Teaches', 'Преподаёт')
        };
      }
      if (kind === 'organization') {
        return {
          kind,
          field: 'learning_languages',
          fallback: 'teaches_languages',
          title: tr('Organization leaderboard', 'Рейтинг организаций'),
          subtitle: tr('Only organizations in this direction are shown.', 'Показываются только организации по этому направлению.'),
          empty: tr('No organizations found for this direction.', 'По этому направлению организаций пока нет.'),
          scopeLabel: tr('Direction', 'Направление')
        };
      }
      if (kind === 'organizer') {
        return {
          kind,
          field: 'learning_languages',
          fallback: 'teaches_languages',
          title: tr('Organizer leaderboard', 'Рейтинг организаторов'),
          subtitle: tr('Only organizers in this event direction are shown.', 'Показываются только организаторы по этому направлению.'),
          empty: tr('No organizers found for this direction.', 'По этому направлению организаторов пока нет.'),
          scopeLabel: tr('Direction', 'Направление')
        };
      }
      return {
        kind: 'learner',
        field: 'learning_languages',
        fallback: 'teaches_languages',
        title: tr('Learner leaderboard', 'Рейтинг учеников'),
        subtitle: tr('Only learners studying this language or subject are shown.', 'Показываются только ученики, которые изучают этот язык или предмет.'),
        empty: tr('No learners found for this direction.', 'По этому направлению учеников пока нет.'),
        scopeLabel: tr('Studies', 'Изучает')
      };
    }

    function addTargetScopes(list, targets) {
      if (!Array.isArray(targets)) {
        listFrom(targets).forEach((target) => addUnique(list, target));
        return;
      }
      targets.forEach((target) => {
        if (!target || typeof target !== 'object') return;
        addUnique(list, target.language);
        listFrom(target.languages).forEach((item) => addUnique(list, item));
        listFrom(target.subcategories).forEach((item) => addUnique(list, item));
        addUnique(list, target.category);
      });
    }

    function profileScopes(profile, config) {
      const scopes = [];
      listFrom(profile?.[config.field]).forEach((item) => addUnique(scopes, item));
      listFrom(profile?.[config.fallback]).forEach((item) => addUnique(scopes, item));
      addTargetScopes(scopes, profile?.learning_targets);
      listFrom(profile?.specialization).forEach((item) => addUnique(scopes, item));
      return scopes;
    }

    function activeLeaderboardScope(config) {
      const scopes = profileScopes(ctx.profile || {}, config);
      if (!scopes.length) scopes.push(tr('General', 'Общее'));
      if (!state.leaderScope || !scopes.some((item) => item.toLowerCase() === String(state.leaderScope).toLowerCase())) {
        state.leaderScope = scopes[0];
      }
      return { scopes, selected: state.leaderScope };
    }

    function targetLooksOrganization(row) {
      if (row?.registered_web_role === 'organization' || row?.last_web_role === 'organization') return true;
      const targets = Array.isArray(row?.learning_targets) ? row.learning_targets : [];
      return targets.some((target) => target && typeof target === 'object' && (target.organization_type || Array.isArray(target.audience)));
    }

    function matchesLeaderboardRole(row, config) {
      if (config.kind === 'teacher') return Boolean(row?.is_teacher);
      if (config.kind === 'organization') return Boolean(row?.is_organizer) && targetLooksOrganization(row);
      if (config.kind === 'organizer') return Boolean(row?.is_organizer) && !targetLooksOrganization(row);
      return !row?.is_teacher && !row?.is_organizer;
    }

    function matchesScope(row, config, scope) {
      const wanted = String(scope || '').trim().toLowerCase();
      if (!wanted || wanted === tr('General', 'Общее').toLowerCase()) return true;
      return profileScopes(row || {}, config).some((item) => item.toLowerCase() === wanted);
    }

    function applyRoleQuery(query, config) {
      if (config.kind === 'teacher') return query.eq('is_teacher', true);
      if (config.kind === 'organizer' || config.kind === 'organization') return query.eq('is_organizer', true);
      return query.or('is_teacher.is.null,is_teacher.eq.false').or('is_organizer.is.null,is_organizer.eq.false');
    }

    function leaderboardShellHtml() {
      const config = leaderboardConfig();
      const scopeState = activeLeaderboardScope(config);
      const optionsNew = scopeState.scopes.map((scope) =>
        '<option value="' + esc(scope) + '"' + (scopeState.selected.toLowerCase() === scope.toLowerCase() ? ' selected' : '') + '>' + esc(scope) + '</option>'
      ).join('');
      return '<section class="leaderboard-panel">' +
        '<div class="leaderboard-head"><div><h3>' + esc(config.title) + '</h3><p>' + esc(config.subtitle) + '</p></div>' +
        '<select id="rankFilter" class="role-select" aria-label="' + esc(config.scopeLabel) + '">' + optionsNew + '</select></div>' +
        '<div id="rankBox" class="rank-list"><div class="empty">' + esc(tr('Loading...', 'Загрузка...')) + '</div></div>' +
      '</section>';
    }

    async function renderLeaderboard() {
      const box = $('#rankBox');
      if (!box) return;
      const config = leaderboardConfig();
      const scopeState = activeLeaderboardScope(config);
      const selectedScope = scopeState.selected;
      try {
        let scopedQuery = window.DuvelaWebConfig.publicProfiles(supa, 'id,full_name,avatar_url,score,is_teacher,is_organizer,last_web_role,learning_languages,teaches_languages,learning_targets,specialization')
          .order('score', { ascending: false })
          .limit(300);
        scopedQuery = applyRoleQuery(scopedQuery, config);
        if (window.DuvelaWebConfig.securityReadV2) scopedQuery = scopedQuery.not('score', 'is', null);
        const { data } = await scopedQuery;
        const scopedRows = (data || [])
          .filter((row) => matchesLeaderboardRole(row, config))
          .filter((row) => matchesScope(row, config, selectedScope))
          .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        const rows = scopedRows.slice(0, 20);
        const myIndex = scopedRows.findIndex((row) => row.id === ctx.user.id);
        const rank = myIndex >= 0 ? myIndex + 1 : null;
        const userLabel = tr('Duvela user', 'Пользователь Duvela');
        box.innerHTML =
          '<div class="rank-summary"><span>' + esc(config.scopeLabel) + ': ' + esc(selectedScope) + '</span>' +
            '<strong>' + esc(rank ? tr('Your rank: #', 'Ваш ранг: #') + rank : tr('You are not in this list yet', 'Вас пока нет в этом списке')) + '</strong></div>' +
          (rows.length ? rows.map((row, index) =>
            '<div class="rank-row' + (row.id === ctx.user.id ? ' me' : '') + '">' +
              '<div class="rank-num">' + (index + 1) + '</div>' +
              '<div class="avatar">' + avatarInner(row.full_name, row.avatar_url) + '</div>' +
              '<div class="rank-person"><b>' + esc(row.full_name || userLabel) + '</b><span>' + esc(config.scopeLabel) + ': ' + esc(selectedScope) + '</span></div>' +
              '<div class="rank-score"><b>' + Number(row.score || 0).toLocaleString() + '</b><span>XP</span></div>' +
            '</div>'
          ).join('') : '<div class="empty">' + esc(config.empty) + '</div>');
        return;
      } catch (error) {
        box.innerHTML = '<div class="empty">' + esc(tr('Leaderboard unavailable.', 'Рейтинг недоступен.')) + '</div>';
        return;
      }
    }

    return {
      deleteAccount,
      deletePortfolioItem,
      ensureAppLanguageField,
      promptPublicationChoice,
      renderProfile,
      renderProgressCard,
      saveProfile
    };
  }

  window.DuvelaAppProfile = { create: createProfileFeature };
})();
