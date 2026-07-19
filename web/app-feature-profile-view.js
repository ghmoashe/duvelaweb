(function () {
  // Business "Profile" view — web mirror of the mobile Bus teacher profile
  // (features/business-screens/teacher-profile.tsx): green cover + Certified badge,
  // avatar, name, location, Students/Lessons/Rating stats, Native/Teaches/Level
  // cards, About/Reviews tabs (About Me, Qualifications, Specialization,
  // Experience, Languages, Interests, Social links), action cards. "Edit Profile"
  // opens a real field-by-field editor (this module owns it, not the legacy
  // learner form); "Verification" opens its own request form.
  function createProfileView(ctx) {
    const { tr, esc, supa } = ctx;
    const TEACH_LANGUAGES = ['english', 'german', 'spanish', 'french', 'italian', 'portuguese', 'russian', 'arabic', 'persian', 'turkish', 'swedish'];
    const TEACH_LANGUAGE_LABELS = {
      english: tr('English', 'Английский'), german: tr('German', 'Немецкий'), spanish: tr('Spanish', 'Испанский'),
      french: tr('French', 'Французский'), italian: tr('Italian', 'Итальянский'), portuguese: tr('Portuguese', 'Португальский'),
      russian: tr('Russian', 'Русский'), arabic: tr('Arabic', 'Арабский'), persian: tr('Persian', 'Персидский'),
      turkish: tr('Turkish', 'Турецкий'), swedish: tr('Swedish', 'Шведский')
    };
    const INTEREST_OPTIONS = [
      ['entertainment', '🎥', tr('Entertainment', 'Развлечения')], ['sports', '🏀', tr('Sports', 'Спорт')],
      ['travel', '🛩️', tr('Travel', 'Путешествия')], ['cinema', '🍿', tr('Cinema', 'Кино')],
      ['business', '💻', tr('Business', 'Бизнес')], ['dancing', '🕺', tr('Dancing', 'Танцы')],
      ['socializing', '🌸', tr('Socializing', 'Общение')], ['socialMedia', '📱', tr('Social Media', 'Соцсети')],
      ['culture', '🗿', tr('Culture', 'Культура')], ['dating', '💌', tr('Dating', 'Знакомства')],
      ['shopping', '🛍️', tr('Shopping', 'Шопинг')], ['photography', '📷', tr('Photography', 'Фотография')],
      ['food', '🍔', tr('Food', 'Еда')], ['family', '🏡', tr('Family', 'Семья')],
      ['cooking', '🍽️', tr('Cooking', 'Готовка')], ['music', '🎵', tr('Music', 'Музыка')],
      ['tech', '🧑‍💻', tr('Tech', 'Технологии')], ['science', '🔬', tr('Science', 'Наука')],
      ['art', '🎨', tr('Art', 'Искусство')], ['gaming', '🎮', tr('Gaming', 'Игры')],
      ['finance', '💵', tr('Finance', 'Финансы')]
    ];

    let activeTab = 'about';
    let mode = 'view'; // 'view' | 'edit' | 'verify'
    let stats = null;
    let reviews = null;
    let loadedFor = null;
    let saving = false;
    let saveNotice = '';
    let draft = null;
    let verifyNote = '';
    let verifyBusy = false;

    async function safe(p) { try { const r = await p; return (r && r.error) ? null : r; } catch (e) { return null; } }

    async function loadStats(uid) {
      const ev = await safe(supa.from('events').select('id', { count: 'exact', head: true }).eq('organizer_id', uid));
      const rev = await safe(supa.from('teacher_reviews').select('rating').eq('teacher_id', uid));
      let students = 0;
      const evIdsRes = await safe(supa.from('events').select('id').eq('organizer_id', uid));
      const evIds = ((evIdsRes && evIdsRes.data) || []).map(function (r) { return r.id; });
      if (evIds.length) {
        const rs = await safe(supa.from('event_rsvps').select('user_id').in('event_id', evIds).eq('status', 'going'));
        students = new Set(((rs && rs.data) || []).map(function (r) { return r.user_id; }).filter(Boolean)).size;
      }
      const ratings = ((rev && rev.data) || []).map(function (r) { return Number(r.rating); }).filter(function (n) { return n >= 1 && n <= 5; });
      stats = {
        lessons: (ev && typeof ev.count === 'number') ? ev.count : 0,
        students: students,
        rating: ratings.length ? (ratings.reduce(function (s, n) { return s + n; }, 0) / ratings.length) : null
      };
    }

    async function loadReviews(uid) {
      const r = await safe(supa.from('teacher_reviews').select('id,rating,comment,created_at,student_id').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(20));
      reviews = (r && r.data) || [];
    }

    function socialUrl(kind, val) {
      const v = String(val || '').trim();
      if (!v) return '';
      if (/^https?:\/\//i.test(v)) return v;
      const handle = v.replace(/^@/, '');
      if (kind === 'instagram') return 'https://instagram.com/' + handle;
      if (kind === 'tiktok') return 'https://tiktok.com/@' + handle;
      if (kind === 'facebook') return 'https://facebook.com/' + handle;
      if (kind === 'linkedin') return 'https://linkedin.com/in/' + handle;
      if (kind === 'youtube') return 'https://youtube.com/' + handle;
      if (kind === 'telegram') return 'https://t.me/' + handle;
      return 'https://' + v;
    }

    function prettyList(value) {
      var arr = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
      return arr.map(function (x) { return String(x).trim(); }).filter(Boolean)
        .map(function (x) { return x.replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); });
    }

    const IC = {
      loc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.3-7-11a7 7 0 0114 0c0 4.7-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
      share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v13M8 7l4-4 4 4M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7"/></svg>',
      lang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h10M9 4v2c0 4-2 7-6 8M5 9c0 3 3 5 6 6M13 20l4-9 4 9M14.5 17h5"/></svg>',
      cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 9L12 5 2 9l10 4 10-4zM6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4"/></svg>',
      medal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
      globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
      gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13M12 8S9 3 7 5s3 3 5 3zM12 8s3-5 5-3-3 3-5 3z"/></svg>',
      cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>'
    };

    function statCell(value, label) {
      return '<div class="pv-stat"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
    }
    function infoCard(icon, label, value, tint) {
      return '<div class="pv-info"><span class="pv-info-ic ' + (tint || '') + '">' + icon + '</span>' +
        '<div><span class="pv-info-label">' + esc(label) + '</span><b>' + esc(value || '—') + '</b></div></div>';
    }
    function chips(items, cls) {
      return '<div class="pv-chips">' + items.map(function (t) { return '<span class="pv-chip ' + (cls || '') + '">' + esc(t) + '</span>'; }).join('') + '</div>';
    }

    function render() {
      const uid = ctx.user && ctx.user.id;
      if (!uid) return;
      if (loadedFor !== uid) { stats = null; reviews = null; mode = 'view'; }
      paint();
      if (loadedFor !== uid) {
        loadedFor = uid;
        Promise.all([loadStats(uid), loadReviews(uid)]).then(paint).catch(paint);
      }
    }

    function paint() {
      const host = document.getElementById('profileView');
      if (!host) return;
      if (mode === 'edit') { host.innerHTML = renderEdit(); bindEdit(host); return; }
      if (mode === 'verify') { host.innerHTML = renderVerify(); bindVerify(host); return; }
      host.innerHTML = renderView();
      bindView(host);
    }

    function renderView() {
      const p = ctx.profile || {};
      const name = (p.full_name || (ctx.user.email || 'Duvela').split('@')[0]).trim();
      const location = [p.city, p.country].filter(Boolean).join(', ');
      const teaches = prettyList(p.teaches_languages);
      const spoken = [];
      [p.language].concat(p.teaches_languages || []).forEach(function (l) {
        var s = String(l || '').trim(); if (s && spoken.indexOf(s) < 0) spoken.push(s);
      });
      const interests = prettyList(p.profile_interests && p.profile_interests.length ? p.profile_interests : p.interests);
      const qualifications = prettyList(p.qualifications);
      const specialization = prettyList(p.specialization);
      const socials = [
        ['instagram', p.instagram], ['tiktok', p.tiktok], ['facebook', p.facebook],
        ['linkedin', p.linkedin], ['youtube', p.youtube], ['telegram', p.telegram], ['website', p.website]
      ].filter(function (s) { return String(s[1] || '').trim(); });

      const cover = p.cover_url
        ? 'background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.25)),url(' + esc(p.cover_url) + ');background-size:cover;background-position:center;'
        : 'background:linear-gradient(135deg,#12B886,#37D89E);';
      let html = '<div class="pv-cover" style="' + cover + '">' +
        (p.is_verified ? '<span class="pv-certified">' + esc(tr('Certified Teacher', 'Сертифицированный учитель')) + '</span>' : '') +
        '<button type="button" class="pv-cover-cam" id="pvCoverCam" aria-label="' + esc(tr('Change cover', 'Изменить обложку')) + '">' + IC.cam + '</button>' +
        '<span class="pv-cover-avatar">' + ctx.avatarInner(name, p.avatar_url) +
          '<button type="button" class="pv-avatar-cam" id="pvAvatarCam" aria-label="' + esc(tr('Change photo', 'Изменить фото')) + '">' + IC.cam + '</button>' +
        '</span>' +
        '<input type="file" id="pvCoverFile" accept="image/*" hidden>' +
        '<input type="file" id="pvAvatarFile" accept="image/*" hidden>' +
        '</div>';

      html += '<div class="pv-headline">' +
        '<h2>' + esc(name) + '</h2>' +
        '<button type="button" class="pv-share" id="pvShare" aria-label="' + esc(tr('Share', 'Поделиться')) + '">' + IC.share + '</button>' +
        '</div>';
      if (location) html += '<div class="pv-loc">' + IC.loc + '<span>' + esc(location) + '</span></div>';
      if (saveNotice) html += '<div class="pv-toast">' + esc(saveNotice) + '</div>';

      html += '<div class="pv-stats">' +
        statCell(stats ? String(stats.students) : '0', tr('Students', 'Ученики')) +
        statCell(stats ? String(stats.lessons) : '0', tr('Lessons', 'Уроки')) +
        statCell(stats && stats.rating ? stats.rating.toFixed(1) : '—', tr('Rating', 'Рейтинг')) +
        '</div>';

      html += '<div class="pv-info-grid">' +
        infoCard(IC.lang, tr('Native', 'Родной'), (prettyList(p.language)[0] || ''), 'teal') +
        infoCard(IC.cap, tr('Teaches', 'Преподаёт'), teaches.join(', '), 'purple') +
        '</div>' +
        infoCard(IC.medal, tr('Level', 'Уровень'), p.language_level || '', 'amber');

      html += '<div class="pv-tabs">' +
        '<button type="button" class="pv-tab' + (activeTab === 'about' ? ' active' : '') + '" data-pv-tab="about">' + esc(tr('About', 'О себе')) + '</button>' +
        '<button type="button" class="pv-tab' + (activeTab === 'reviews' ? ' active' : '') + '" data-pv-tab="reviews">' + esc(tr('Reviews', 'Отзывы')) + '</button>' +
        '</div>';

      if (activeTab === 'about') {
        html += '<div class="pv-card">';
        html += '<h3>' + esc(tr('About Me', 'Обо мне')) + '</h3>';
        html += '<p class="pv-about">' + esc(p.bio || tr('No description yet.', 'Пока нет описания.')) + '</p>';
        if (qualifications.length) {
          html += '<div class="pv-sec-label">' + esc(tr('Qualifications', 'Квалификации')) + '</div>';
          html += '<div class="pv-dot-list">' + qualifications.map(function (q) {
            return '<div class="pv-dot-row"><span class="pv-dot"></span>' + esc(q) + '</div>';
          }).join('') + '</div>';
        }
        if (specialization.length) {
          html += '<div class="pv-sec-label">' + esc(tr('Specialization', 'Специализация')) + '</div>' + chips(specialization, 'pink');
        }
        if (p.teaching_experience) {
          html += '<div class="pv-sec-label">' + esc(tr('Experience', 'Опыт')) + '</div>';
          html += '<p class="pv-about">' + esc(p.teaching_experience) + '</p>';
        }
        if (spoken.length) {
          html += '<div class="pv-sec-label">' + esc(tr('Languages spoken', 'Языки')) + '</div>';
          html += '<div class="pv-lang-list">' + spoken.map(function (l) {
            return '<div class="pv-lang-row"><span>' + esc(prettyList(l)[0] || l) + '</span>' + (p.language_level ? '<span class="pv-lang-lvl">' + esc(p.language_level) + '</span>' : '') + '</div>';
          }).join('') + '</div>';
        }
        if (interests.length) {
          html += '<div class="pv-sec-label">' + esc(tr('Interests', 'Интересы')) + '</div>' + chips(interests, 'pink');
        }
        if (socials.length) {
          html += '<div class="pv-sec-label">' + esc(tr('Social links', 'Соцсети')) + '</div>';
          html += '<div class="pv-chips">' + socials.map(function (s) {
            return '<a class="pv-social" href="' + esc(socialUrl(s[0], s[1])) + '" target="_blank" rel="noopener">' + esc(s[0]) + '</a>';
          }).join('') + '</div>';
        }
        html += '</div>';
      } else {
        html += '<div class="pv-card">';
        if (!reviews) html += '<p class="pv-about">' + esc(tr('Loading…', 'Загрузка…')) + '</p>';
        else if (!reviews.length) html += '<div class="pv-empty"><b>' + esc(tr('No reviews yet', 'Пока нет отзывов')) + '</b><p>' + esc(tr('Reviews from your students will appear here.', 'Здесь появятся отзывы ваших учеников.')) + '</p></div>';
        else html += reviews.map(function (r) {
          return '<div class="pv-review"><div class="pv-review-top"><b>★ ' + esc(String(r.rating || '')) + '</b><span>' + esc(new Date(r.created_at).toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-US')) + '</span></div>' +
            (r.comment ? '<p>' + esc(r.comment) + '</p>' : '') + '</div>';
        }).join('');
        html += '</div>';
      }

      const verification = ctx.state ? ctx.state.verification : null;
      const verifyLabel = p.is_verified
        ? tr('Verified', 'Подтверждено')
        : (verification && verification.status === 'pending')
          ? tr('Pending', 'На проверке')
          : tr('Verification', 'Верификация');

      html += '<div class="pv-actions">' +
        '<button type="button" class="pv-action" data-pv-act="edit"><span class="pv-action-ic">' + IC.edit + '</span>' + esc(tr('Edit Profile', 'Редактировать')) + '</button>' +
        '<button type="button" class="pv-action" data-pv-act="verify"><span class="pv-action-ic teal">' + IC.shield + '</span>' + esc(verifyLabel) + '</button>' +
        '<button type="button" class="pv-action" data-pv-act="lang"><span class="pv-action-ic">' + IC.globe + '</span>' + esc(tr('Change Language', 'Сменить язык')) + '</button>' +
        '<button type="button" class="pv-action" data-pv-act="invite"><span class="pv-action-ic teal">' + IC.gift + '</span>' + esc(tr('Invite Friends', 'Пригласить друзей')) + '</button>' +
        '</div>';

      return html;
    }

    // ── Edit mode ──────────────────────────────────────────────────────────
    function startEdit() {
      const p = ctx.profile || {};
      draft = {
        full_name: p.full_name || '',
        city: p.city || '',
        country: p.country || '',
        language: p.language || '',
        language_level: p.language_level || '',
        teaches_languages: Array.isArray(p.teaches_languages) ? p.teaches_languages.slice() : [],
        bio: p.bio || '',
        teaching_experience: p.teaching_experience || '',
        qualifications: Array.isArray(p.qualifications) ? p.qualifications.slice() : [],
        specialization: Array.isArray(p.specialization) ? p.specialization.slice() : [],
        profile_interests: Array.isArray(p.profile_interests) ? p.profile_interests.slice() : [],
        telegram: p.telegram || '', instagram: p.instagram || '', tiktok: p.tiktok || '',
        facebook: p.facebook || '', linkedin: p.linkedin || '', youtube: p.youtube || '', website: p.website || ''
      };
      mode = 'edit';
      saveNotice = '';
      paint();
    }

    function textField(id, label, value, placeholder) {
      return '<div class="pv-field"><label>' + esc(label) + '</label>' +
        '<input type="text" id="' + id + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '" maxlength="120"></div>';
    }
    function textArea(id, label, value, placeholder, max) {
      return '<div class="pv-field"><label>' + esc(label) + '</label>' +
        '<textarea id="' + id + '" maxlength="' + (max || 600) + '" placeholder="' + esc(placeholder || '') + '">' + esc(value || '') + '</textarea></div>';
    }
    function chipEditor(title, id, values, removable) {
      return '<div class="pv-field"><label>' + esc(title) + '</label>' +
        '<div class="pv-chip-editor" data-chip-group="' + id + '">' +
          (values.length ? values.map(function (v, i) {
            return '<span class="pv-chip-edit">' + esc(v) + '<button type="button" data-chip-remove="' + id + ':' + i + '">' + IC.x + '</button></span>';
          }).join('') : '') +
        '</div>' +
        '<div class="pv-chip-add-row">' +
          '<input type="text" id="' + id + 'Input" placeholder="' + esc(tr('Type and press Enter', 'Введите и нажмите Enter')) + '" maxlength="60">' +
          '<button type="button" class="pv-chip-add-btn" data-chip-add="' + id + '">+</button>' +
        '</div></div>';
    }

    function renderEdit() {
      const d = draft;
      let html = '<button type="button" class="pv-backlink" id="pvEditCancel">' + IC.back + '<span>' + esc(tr('Cancel', 'Отмена')) + '</span></button>';
      html += '<div class="pv-card"><h3>' + esc(tr('Edit Profile', 'Редактирование профиля')) + '</h3>';

      html += '<div class="pv-sec-label">' + esc(tr('Basics', 'Основное')) + '</div>';
      html += '<div class="pv-field-grid">' +
        textField('pvName', tr('Full name', 'Имя'), d.full_name) +
        textField('pvCity', tr('City', 'Город'), d.city) +
        textField('pvCountry', tr('Country', 'Страна'), d.country) +
        textField('pvLanguage', tr('Native language', 'Родной язык'), d.language) +
        textField('pvLevel', tr('Level', 'Уровень'), d.language_level, 'A1–C2') +
        '</div>';

      html += '<div class="pv-sec-label">' + esc(tr('Teaches', 'Преподаёт')) + '</div>';
      html += '<div class="pv-toggle-chips">' + TEACH_LANGUAGES.map(function (id) {
        const on = d.teaches_languages.indexOf(id) >= 0;
        return '<button type="button" class="pv-toggle-chip' + (on ? ' active' : '') + '" data-teach-toggle="' + id + '">' + esc(TEACH_LANGUAGE_LABELS[id]) + '</button>';
      }).join('') + '</div>';

      html += '<div class="pv-sec-label">' + esc(tr('About Me', 'Обо мне')) + '</div>';
      html += textArea('pvBio', tr('Bio', 'О себе'), d.bio, tr('Tell students about yourself', 'Расскажите ученикам о себе'));

      html += chipEditor(tr('Qualifications', 'Квалификации'), 'quals', d.qualifications);
      html += chipEditor(tr('Specialization', 'Специализация'), 'spec', d.specialization);

      html += '<div class="pv-sec-label">' + esc(tr('Experience', 'Опыт')) + '</div>';
      html += textArea('pvExperience', tr('Teaching experience', 'Опыт преподавания'), d.teaching_experience, tr('Years of experience, background, achievements…', 'Стаж, бэкграунд, достижения…'));

      html += '<div class="pv-sec-label">' + esc(tr('Interests', 'Интересы')) + '</div>';
      html += '<div class="pv-toggle-chips">' + INTEREST_OPTIONS.map(function (item) {
        const on = d.profile_interests.indexOf(item[0]) >= 0;
        return '<button type="button" class="pv-toggle-chip' + (on ? ' active' : '') + '" data-interest-toggle="' + item[0] + '">' + item[1] + ' ' + esc(item[2]) + '</button>';
      }).join('') + '</div>';

      html += '<div class="pv-sec-label">' + esc(tr('Social links', 'Соцсети')) + '</div>';
      html += '<div class="pv-field-grid">' +
        textField('pvInstagram', 'Instagram', d.instagram, '@handle') +
        textField('pvTiktok', 'TikTok', d.tiktok, '@handle') +
        textField('pvFacebook', 'Facebook', d.facebook, '@handle') +
        textField('pvLinkedin', 'LinkedIn', d.linkedin, '@handle') +
        textField('pvYoutube', 'YouTube', d.youtube, '@handle') +
        textField('pvTelegram', 'Telegram', d.telegram, '@handle') +
        textField('pvWebsite', tr('Website', 'Сайт'), d.website, 'https://…') +
        '</div>';

      if (saveNotice) html += '<div class="pv-notice">' + esc(saveNotice) + '</div>';

      html += '<div class="pv-edit-actions">' +
        '<button type="button" class="pv-btn-outline" id="pvEditCancel2">' + esc(tr('Cancel', 'Отмена')) + '</button>' +
        '<button type="button" class="pv-btn-solid" id="pvEditSave"' + (saving ? ' disabled' : '') + '>' + esc(saving ? tr('Saving…', 'Сохранение…') : tr('Save changes', 'Сохранить')) + '</button>' +
        '</div>';
      html += '</div>';
      return html;
    }

    function readEditFields() {
      const val = function (id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
      draft.full_name = val('pvName'); draft.city = val('pvCity'); draft.country = val('pvCountry');
      draft.language = val('pvLanguage'); draft.language_level = val('pvLevel');
      draft.bio = val('pvBio'); draft.teaching_experience = val('pvExperience');
      draft.instagram = val('pvInstagram'); draft.tiktok = val('pvTiktok'); draft.facebook = val('pvFacebook');
      draft.linkedin = val('pvLinkedin'); draft.youtube = val('pvYoutube'); draft.telegram = val('pvTelegram'); draft.website = val('pvWebsite');
    }

    async function saveEdit() {
      readEditFields();
      saving = true; saveNotice = ''; paint();
      const patch = {
        full_name: draft.full_name || null, city: draft.city || null, country: draft.country || null,
        language: draft.language || null, language_level: draft.language_level || null,
        teaches_languages: draft.teaches_languages, bio: draft.bio || null,
        teaching_experience: draft.teaching_experience || null,
        qualifications: draft.qualifications, specialization: draft.specialization,
        profile_interests: draft.profile_interests,
        instagram: draft.instagram || null, tiktok: draft.tiktok || null, facebook: draft.facebook || null,
        linkedin: draft.linkedin || null, youtube: draft.youtube || null, telegram: draft.telegram || null,
        website: draft.website || null, updated_at: new Date().toISOString()
      };
      const r = await safe(supa.from('profiles').update(patch).eq('id', ctx.user.id));
      saving = false;
      if (!r) { saveNotice = tr('Could not save. Try again.', 'Не удалось сохранить. Попробуйте ещё раз.'); paint(); return; }
      ctx.setProfile(Object.assign({}, ctx.profile || {}, patch));
      mode = 'view';
      saveNotice = tr('Profile updated ✓', 'Профиль обновлён ✓');
      paint();
      setTimeout(function () { saveNotice = ''; paint(); }, 2500);
    }

    function bindEdit(host) {
      const cancel = function () { mode = 'view'; paint(); };
      const c1 = host.querySelector('#pvEditCancel'); if (c1) c1.addEventListener('click', cancel);
      const c2 = host.querySelector('#pvEditCancel2'); if (c2) c2.addEventListener('click', cancel);
      const save = host.querySelector('#pvEditSave'); if (save) save.addEventListener('click', function () { void saveEdit(); });

      Array.prototype.forEach.call(host.querySelectorAll('[data-teach-toggle]'), function (b) {
        b.addEventListener('click', function () {
          readEditFields();
          const id = b.getAttribute('data-teach-toggle');
          const idx = draft.teaches_languages.indexOf(id);
          if (idx >= 0) draft.teaches_languages.splice(idx, 1); else draft.teaches_languages.push(id);
          paint();
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-interest-toggle]'), function (b) {
        b.addEventListener('click', function () {
          readEditFields();
          const id = b.getAttribute('data-interest-toggle');
          const idx = draft.profile_interests.indexOf(id);
          if (idx >= 0) draft.profile_interests.splice(idx, 1); else draft.profile_interests.push(id);
          paint();
        });
      });
      function addChip(group) {
        readEditFields();
        const input = host.querySelector('#' + group + 'Input');
        const value = input ? input.value.trim() : '';
        if (!value) return;
        const key = group === 'quals' ? 'qualifications' : 'specialization';
        draft[key].push(value);
        paint();
      }
      Array.prototype.forEach.call(host.querySelectorAll('[data-chip-add]'), function (b) {
        b.addEventListener('click', function () { addChip(b.getAttribute('data-chip-add')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[id$="Input"]'), function (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); addChip(input.id.replace(/Input$/, '')); }
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-chip-remove]'), function (b) {
        b.addEventListener('click', function () {
          readEditFields();
          const parts = b.getAttribute('data-chip-remove').split(':');
          const key = parts[0] === 'quals' ? 'qualifications' : 'specialization';
          draft[key].splice(Number(parts[1]), 1);
          paint();
        });
      });
    }

    // ── Verify mode ────────────────────────────────────────────────────────
    function renderVerify() {
      const p = ctx.profile || {};
      const verification = ctx.state ? ctx.state.verification : null;
      let html = '<button type="button" class="pv-backlink" id="pvVerifyBack">' + IC.back + '<span>' + esc(tr('Back to profile', 'Назад к профилю')) + '</span></button>';
      html += '<div class="pv-card"><h3>' + esc(tr('Verification', 'Верификация')) + '</h3>';
      if (p.is_verified) {
        html += '<div class="pv-empty"><b>' + esc(tr('You are verified ✓', 'Вы верифицированы ✓')) + '</b>' +
          '<p>' + esc(tr('Your teacher account has been verified by the Duvela team.', 'Ваш аккаунт учителя подтверждён командой Duvela.')) + '</p></div>';
      } else if (verification) {
        const statusLabel = verification.status === 'approved' ? tr('Approved ✓', 'Одобрено ✓')
          : verification.status === 'rejected' || verification.status === 'denied' ? tr('Rejected', 'Отклонено')
          : tr('Pending review', 'На проверке');
        html += '<div class="pv-empty"><b>' + esc(statusLabel) + '</b>' +
          (verification.note ? '<p>' + esc(verification.note) + '</p>' : '<p>' + esc(tr('We will notify you once it is reviewed.', 'Мы сообщим вам, когда запрос будет рассмотрен.')) + '</p>') + '</div>';
      } else {
        html += '<p class="pv-about">' + esc(tr('Tell us why you should be verified as a teacher — qualifications, teaching history, credentials.', 'Расскажите, почему вас стоит верифицировать как учителя — квалификация, опыт преподавания, документы.')) + '</p>';
        html += '<div class="pv-field"><label>' + esc(tr('Your message', 'Ваше сообщение')) + '</label>' +
          '<textarea id="pvVerifyNote" maxlength="400">' + esc(verifyNote) + '</textarea></div>';
        if (saveNotice) html += '<div class="pv-notice">' + esc(saveNotice) + '</div>';
        html += '<div class="pv-edit-actions"><button type="button" class="pv-btn-solid" id="pvVerifySubmit"' + (verifyBusy ? ' disabled' : '') + '>' +
          esc(verifyBusy ? tr('Sending…', 'Отправка…') : tr('Request verification', 'Запросить верификацию')) + '</button></div>';
      }
      html += '</div>';
      return html;
    }

    function bindVerify(host) {
      const back = host.querySelector('#pvVerifyBack');
      if (back) back.addEventListener('click', function () { mode = 'view'; saveNotice = ''; paint(); });
      const noteInput = host.querySelector('#pvVerifyNote');
      if (noteInput) noteInput.addEventListener('input', function () { verifyNote = noteInput.value; });
      const submit = host.querySelector('#pvVerifySubmit');
      if (submit) submit.addEventListener('click', async function () {
        verifyBusy = true; saveNotice = ''; paint();
        const r = await safe(supa.from('verification_requests').insert({
          user_id: ctx.user.id,
          organization_id: (ctx.state && ctx.state.myOrg) ? ctx.state.myOrg.id : null,
          note: verifyNote || null
        }));
        verifyBusy = false;
        if (!r) { saveNotice = tr('Could not send the request.', 'Не удалось отправить запрос.'); paint(); return; }
        if (ctx.state) ctx.state.verification = { status: 'pending', note: verifyNote || null };
        verifyNote = '';
        paint();
      });
    }

    // ── Shared bindings for view mode ───────────────────────────────────────
    async function uploadAndSave(field, file) {
      saveNotice = tr('Uploading…', 'Загрузка…'); paint();
      try {
        const url = await ctx.uploadToBucket('posts', file);
        const patch = {}; patch[field] = url; patch.updated_at = new Date().toISOString();
        const r = await safe(supa.from('profiles').update(patch).eq('id', ctx.user.id));
        if (!r) throw new Error('save failed');
        ctx.setProfile(Object.assign({}, ctx.profile || {}, patch));
        saveNotice = tr('Updated ✓', 'Обновлено ✓');
      } catch (e) {
        saveNotice = tr('Could not upload. Try again.', 'Не удалось загрузить. Попробуйте ещё раз.');
      }
      paint();
      setTimeout(function () { saveNotice = ''; paint(); }, 2000);
    }

    function bindView(host) {
      Array.prototype.forEach.call(host.querySelectorAll('[data-pv-tab]'), function (b) {
        b.addEventListener('click', function () {
          activeTab = b.getAttribute('data-pv-tab');
          if (activeTab === 'reviews' && !reviews && ctx.user) void loadReviews(ctx.user.id).then(paint);
          else paint();
        });
      });
      const share = host.querySelector('#pvShare');
      if (share) share.addEventListener('click', function () {
        const link = window.location.origin + (ctx.profile && ctx.profile.id ? '/profile.html?id=' + encodeURIComponent(ctx.profile.id) : '/');
        if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { ctx.alert(tr('Profile link copied.', 'Ссылка на профиль скопирована.')); }).catch(function () {});
        else ctx.alert(link);
      });
      const avatarCam = host.querySelector('#pvAvatarCam');
      const avatarFile = host.querySelector('#pvAvatarFile');
      if (avatarCam && avatarFile) {
        avatarCam.addEventListener('click', function () { avatarFile.click(); });
        avatarFile.addEventListener('change', function () {
          const f = avatarFile.files && avatarFile.files[0];
          if (f) void uploadAndSave('avatar_url', f);
        });
      }
      const coverCam = host.querySelector('#pvCoverCam');
      const coverFile = host.querySelector('#pvCoverFile');
      if (coverCam && coverFile) {
        coverCam.addEventListener('click', function () { coverFile.click(); });
        coverFile.addEventListener('change', function () {
          const f = coverFile.files && coverFile.files[0];
          if (f) void uploadAndSave('cover_url', f);
        });
      }
      Array.prototype.forEach.call(host.querySelectorAll('[data-pv-act]'), function (b) {
        b.addEventListener('click', function () {
          const act = b.getAttribute('data-pv-act');
          if (act === 'edit') { startEdit(); return; }
          if (act === 'verify') {
            mode = 'verify'; saveNotice = '';
            if (ctx.loadBusinessWorkspace) void ctx.loadBusinessWorkspace().then(paint);
            else paint();
            return;
          }
          if (act === 'lang') {
            const sel = document.getElementById('langSelect') || document.getElementById('profileLangSelect');
            if (sel) { sel.focus(); if (sel.scrollIntoView) sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            return;
          }
          if (act === 'invite') {
            const link = window.location.origin + '/index.html';
            if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { ctx.alert(tr('Invite link copied.', 'Ссылка-приглашение скопирована.')); }).catch(function () {});
            else ctx.alert(link);
          }
        });
      });
    }

    return { render };
  }

  window.DuvelaBusinessProfileView = { create: createProfileView };
})();
