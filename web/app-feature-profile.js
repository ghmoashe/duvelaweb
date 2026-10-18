(function () {
  function createProfileFeature(ctx) {
    const { $, tr, esc, alert, supa, state, avatarHtml, avatarInner, timeAgo, roleLabels } = ctx;
    const studentGoal = window.DuvelaStudentGoal || {
      LEVELS: ['A2', 'B1', 'B2', 'C1'],
      normalize: (value, fallback) => {
        const raw = String(value || '').trim().toUpperCase();
        const safeFallback = String(fallback || '').trim().toUpperCase();
        return ['A2', 'B1', 'B2', 'C1'].includes(raw) ? raw : (['A2', 'B1', 'B2', 'C1'].includes(safeFallback) ? safeFallback : 'A2');
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
      field.style.marginTop = '14px';
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
      const section = document.createElement('section');
      section.id = 'publicationConsentPanel'; section.className = 'card';
      const heading = document.createElement('h3'); heading.textContent = tr('Public profile', 'Публичный профиль'); section.append(heading);
      const notice = document.createElement('p');
      notice.textContent = tr('Selected information will be visible to anyone, including people without an account. Choose only information you want to publish. City, social-link and ranking privacy settings still apply. Select the matching discovery field to appear as a teacher or organizer. You can withdraw at any time. Copies already downloaded by others cannot be recalled.', 'Выбранные сведения будут доступны всем, в том числе без аккаунта. Выберите только то, что хотите опубликовать. Настройки скрытия города, соцсетей и рейтинга продолжают действовать. Для поиска преподавателей или организаторов выберите соответствующее поле. Согласие можно отозвать. Уже скачанные другими людьми копии отозвать невозможно.'); section.append(notice);
      const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = tr('Loading…', 'Загрузка…'); section.append(status);
      const options = [
        ['full_name','Name','Имя'],['avatar_url','Profile photo','Фото профиля'],['cover_url','Cover photo','Обложка'],
        ['city','City','Город'],['country','Country','Страна'],['bio','Biography (full text)','Биография (весь текст)'],
        ['teaches_languages','Teaching languages','Языки преподавания'],['explanation_languages','Explanation languages','Языки объяснения'],
        ['qualifications','Qualifications','Квалификации'],['specialization','Specializations','Специализации'],
        ['teaching_experience','Teaching experience','Опыт преподавания'],['teacher_audience','Teaching audience','Аудитория преподавания'],
        ['is_teacher','Teacher discovery','Поиск преподавателей'],['is_organizer','Organizer discovery','Поиск организаторов'],
        ['registered_web_role','Profile category','Категория профиля'],['is_verified','Verification badge','Знак проверки'],
        ['score','Ranking score','Баллы рейтинга'],['language','Profile language','Язык профиля'],['language_level','Language level','Уровень языка'],
        ['instagram','Instagram','Instagram'],['tiktok','TikTok','TikTok'],['youtube','YouTube','YouTube'],
        ['facebook','Facebook','Facebook'],['linkedin','LinkedIn','LinkedIn'],['website','Website','Сайт'],
      ];
      const boxes = options.map(([key,en,ru]) => {
        const label = document.createElement('label'); label.style.display = 'block';
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = key; input.disabled = true;
        label.append(input, document.createTextNode(' ' + tr(en,ru))); section.append(label); return input;
      });
      const publish = document.createElement('button'); publish.type = 'button'; publish.disabled = true;
      publish.textContent = tr('I agree — publish selected fields', 'Согласен — опубликовать выбранные поля');
      const revoke = document.createElement('button'); revoke.type = 'button'; revoke.disabled = true;
      section.append(publish,revoke);
      host.append(section);
      let current = null; let busy = false;
      function refresh() {
        boxes.forEach(box => { box.disabled = busy || !current; });
        publish.disabled = busy || !current || !boxes.some(b => b.checked);
        revoke.disabled = busy || !current || (!intake && !current.published);
        revoke.textContent = current?.published
          ? tr('Withdraw publication consent', 'Отозвать согласие на публикацию')
          : tr('Keep my profile closed', 'Оставить профиль закрытым');
      }
      // Since the base profiles table closed, this choice decides live public
      // visibility — so the status reads as current, not as a "future" approval.
      function apply(data) {
        if (!data || typeof data.published !== 'boolean' || !Array.isArray(data.approved_fields) || data.approved_fields.some(f => !options.some(([key]) => key === f))) throw new Error('Invalid consent response');
        current = data; boxes.forEach(box => { box.checked = data.approved_fields.includes(box.value); });
        status.textContent = data.published ? tr('Published', 'Опубликован') : tr('Not published', 'Не опубликован'); refresh();
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
      }).catch(() => { status.textContent = tr('Could not load publication settings. Reopen your profile to retry.', 'Не удалось загрузить настройки публикации. Откройте профиль заново для повтора.'); });
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
      renderPublicationConsent(pe?.parentElement || pv?.parentElement);
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
      if ($('#pfNativeLanguageLabel')) $('#pfNativeLanguageLabel').textContent = tr('Native language', 'Родной язык');
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
      if (profileGrid) profileGrid.style.gridTemplateColumns = '';
      card.style.display = '';
      card.classList.add('learner-progress-card');
      const bars = [
        [tr('Grammar', 'Грамматика'), ctx.profile?.grammar_progress ?? 0],
        [tr('Speaking', 'Speaking'), ctx.profile?.speaking_progress ?? 0],
        [tr('Vocabulary', 'Словарь'), ctx.profile?.vocabulary_progress ?? 0],
        [tr('Exam', 'Экзамен'), ctx.profile?.exam_progress ?? 0]
      ];
      card.innerHTML =
        '<div class="section-head"><h2>' + esc(tr('Your progress', 'Ваш прогресс')) + '</h2><span>' + esc((ctx.profile?.score ?? 0).toLocaleString() + ' XP · ' + (ctx.profile?.vela_coin_balance ?? 0).toLocaleString() + ' ' + tr('coins', 'монет')) + '</span></div>' +
        bars.map(([label, value]) => {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          return '<div class="prog-row"><div class="prog-label"><span>' + esc(label) + '</span><span>' + pct + '%</span></div><div class="prog-bar"><i style="width:' + pct + '%"></i></div></div>';
        }).join('') +
        ctx.walletHtml() +
        leaderboardShellHtml();
      card.insertAdjacentHTML('afterbegin',
        '<div class="learner-stat-grid">' +
          '<div><b>' + Number(ctx.profile?.score || 0).toLocaleString() + '</b><span>XP</span></div>' +
          '<div><b>' + Number(ctx.profile?.vela_coin_balance || 0).toLocaleString() + '</b><span>' + esc(tr('Coins', 'Монеты')) + '</span></div>' +
          '<div><b>' + esc(ctx.profile?.language_level || 'A1') + '</b><span>' + esc(tr('Level', 'Уровень')) + '</span></div>' +
          '<div><b>' + esc(studentGoal.fromProfile(ctx.profile, 'A1')) + '</b><span>' + esc(tr('Goal', 'Цель')) + '</span></div>' +
        '</div>');
      const filter = $('#rankFilter');
      if (filter) filter.addEventListener('change', () => {
        state.leaderScope = filter.value;
        renderLeaderboard();
      });
      renderLeaderboard();
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
