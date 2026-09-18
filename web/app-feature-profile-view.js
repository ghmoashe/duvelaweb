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
    // Keys match the shared mobile catalog (shared/teaching-languages.ts) so a
    // language chosen on the web reads back correctly in the apps. Farsi is
    // 'farsi', not 'persian' — that mismatch used to make web-set Farsi
    // invisible in the mobile course/event language filters.
    const TEACH_LANGUAGES = [
      'english', 'spanish', 'german', 'french', 'italian', 'russian', 'ukrainian',
      'turkish', 'azerbaijani', 'uzbek', 'farsi', 'arabic', 'hebrew', 'hindi',
      'urdu', 'bengali', 'chinese', 'korean', 'japanese', 'vietnamese', 'thai',
      'indonesian', 'polish', 'czech', 'slovak', 'hungarian', 'romanian',
      'serbian', 'greek', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish',
      'estonian', 'portuguese'
    ];
    const TEACH_LANGUAGE_LABELS = {
      english: tr('English', 'Английский'), spanish: tr('Spanish', 'Испанский'), german: tr('German', 'Немецкий'),
      french: tr('French', 'Французский'), italian: tr('Italian', 'Итальянский'), russian: tr('Russian', 'Русский'),
      ukrainian: tr('Ukrainian', 'Украинский'), turkish: tr('Turkish', 'Турецкий'), azerbaijani: tr('Azerbaijani', 'Азербайджанский'),
      uzbek: tr('Uzbek', 'Узбекский'), farsi: tr('Farsi', 'Фарси'), arabic: tr('Arabic', 'Арабский'),
      hebrew: tr('Hebrew', 'Иврит'), hindi: tr('Hindi', 'Хинди'), urdu: tr('Urdu', 'Урду'),
      bengali: tr('Bengali', 'Бенгальский'), chinese: tr('Chinese', 'Китайский'), korean: tr('Korean', 'Корейский'),
      japanese: tr('Japanese', 'Японский'), vietnamese: tr('Vietnamese', 'Вьетнамский'), thai: tr('Thai', 'Тайский'),
      indonesian: tr('Indonesian', 'Индонезийский'), polish: tr('Polish', 'Польский'), czech: tr('Czech', 'Чешский'),
      slovak: tr('Slovak', 'Словацкий'), hungarian: tr('Hungarian', 'Венгерский'), romanian: tr('Romanian', 'Румынский'),
      serbian: tr('Serbian', 'Сербский'), greek: tr('Greek', 'Греческий'), dutch: tr('Dutch', 'Нидерландский'),
      swedish: tr('Swedish', 'Шведский'), norwegian: tr('Norwegian', 'Норвежский'), danish: tr('Danish', 'Датский'),
      finnish: tr('Finnish', 'Финский'), estonian: tr('Estonian', 'Эстонский'), portuguese: tr('Portuguese', 'Португальский')
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

    const AWARDS = [
      { key: 'first-100-teachers', title: 'First 100 Teachers', text: 'With Duvela from the start.', img: './awards/first-100-teachers.png', unlocked: true },
      { key: 'first-lesson', title: 'First Lesson', text: 'Created or hosted the first lesson.', img: './awards/first-lesson.png', unlocked: true },
      { key: '10-lessons-together', title: '10 Lessons Together', text: 'Built steady learning rhythm.', img: './awards/10-lessons-together.png', unlocked: false },
      { key: 'duvela-author', title: 'Duvela Author', text: 'Published learning media for students.', img: './awards/duvela-author.png', unlocked: true },
      { key: 'live-teacher', title: 'Live Teacher', text: 'Hosted the first LIVE lesson.', img: './awards/live-teacher.png', unlocked: false }
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
    let selectedAwardKey = localStorage.getItem('duvela.teacher.selectedAward') || 'first-100-teachers';

    async function safe(p) { try { const r = await p; return (r && r.error) ? null : r; } catch (e) { return null; } }

    function coverPresetStyle(value) {
      const presets = {
        duvela: ['#7C3AED', '#A855F7', '#22C1DC'],
        ocean: ['#0EA5E9', '#2563EB', '#312E81'],
        sunset: ['#F97316', '#EC4899', '#7C3AED'],
        premium: ['#111827', '#4338CA', '#7C3AED'],
        fresh: ['#14B8A6', '#22C55E', '#84CC16']
      };
      const raw = String(value || '').trim();
      if (raw.indexOf('preset:') !== 0) return '';
      const colors = presets[raw.slice(7)] || presets.duvela;
      return 'background:linear-gradient(135deg,' + colors.join(',') + ');';
    }

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
      const r = await safe(supa.from('teacher_reviews').select('id,rating,comment,created_at').eq('teacher_id', uid).order('created_at', { ascending: false }).limit(20));
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
      chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.7 8.7 0 01-3.7-.8L3 21l1.9-5.1A8.4 8.4 0 1112 19.9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>',
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
    function selectedAward() {
      return AWARDS.find(function (a) { return a.key === selectedAwardKey && a.unlocked; }) || AWARDS.find(function (a) { return a.unlocked; }) || AWARDS[0];
    }
    function awardBadge(cls) {
      const award = selectedAward();
      return '<span class="pv-award-badge ' + (cls || '') + '"><img src="' + esc(award.img) + '" alt=""><span>' + esc(award.title) + '</span></span>';
    }

    function renderDesktopView(data) {
      const p = data.profile;
      const name = data.name;
      const location = data.location;
      const teachText = data.teaches.join(', ') || tr('German, English', 'German, English');
      const nativeText = prettyList(p.language)[0] || tr('Not set', 'Not set');
      const levelText = p.language_level || 'A1';
      const ratingText = stats && stats.rating ? stats.rating.toFixed(1) : '0.0';
      const studentsText = stats ? String(stats.students) : '0';
      const lessonsText = stats ? String(stats.lessons) : '0';
      const bioText = p.bio || tr('Tell students who you help, what level you teach, and how your lessons feel.', 'Tell students who you help, what level you teach, and how your lessons feel.');
      const spec = data.specialization.length ? data.specialization : ['Conversation', 'Grammar', 'Pronunciation'];
      let html = '<div class="pv-desktop"><main class="pv-main">';
      html += '<section class="pv-hero" style="' + data.cover + '">' +
        '<p class="pv-quote">"' + esc(tr('Languages open doors - good teaching makes the way easier.', 'Languages open doors - good teaching makes the way easier.')) + '"</p>' +
        '<button type="button" class="pv-hero-edit" data-pv-act="edit">' + IC.edit + '<span>' + esc(tr('Edit Profile', 'Edit Profile')) + '</span></button>' +
        '<span class="pv-hero-avatar">' + ctx.avatarInner(name, p.avatar_url) +
          '<button type="button" class="pv-avatar-cam" id="pvAvatarCam" aria-label="' + esc(tr('Change photo', 'Change photo')) + '">' + IC.cam + '</button>' +
        '</span>' +
        '<div class="pv-hero-main"><h2>' + esc(name) + awardBadge('hero') + '</h2>' +
          (location ? '<div class="pv-hero-loc">' + IC.loc + '<span>' + esc(location) + '</span></div>' : '') +
        '</div>' +
        '<div class="pv-avatar-panel"><button type="button" class="pv-cover-cam" id="pvCoverCam" aria-label="' + esc(tr('Change cover', 'Change cover')) + '">' + IC.cam + '</button><b>' + esc(tr('Avatar & cover', 'Avatar & cover')) + '</b><span>JPG, PNG, WebP</span><div class="pv-media-actions"><button type="button" class="pv-small-outline" id="pvAvatarPick">' + esc(tr('Change avatar', 'Change avatar')) + '</button><button type="button" class="pv-small-outline" id="pvCoverPick">' + esc(tr('Change cover', 'Change cover')) + '</button><button type="button" class="pv-small-danger" id="pvAvatarRemove"' + (!p.avatar_url ? ' disabled' : '') + '>' + esc(tr('Remove avatar', 'Remove avatar')) + '</button><button type="button" class="pv-small-danger" id="pvCoverRemove"' + (!p.cover_url ? ' disabled' : '') + '>' + esc(tr('Remove cover', 'Remove cover')) + '</button></div><div class="pv-cover-presets"><button type="button" class="pv-cover-preset duvela" data-cover-preset="duvela"><i></i>Duvela</button><button type="button" class="pv-cover-preset ocean" data-cover-preset="ocean"><i></i>Ocean</button><button type="button" class="pv-cover-preset sunset" data-cover-preset="sunset"><i></i>Sunset</button><button type="button" class="pv-cover-preset premium" data-cover-preset="premium"><i></i>Pro</button><button type="button" class="pv-cover-preset fresh" data-cover-preset="fresh"><i></i>Fresh</button></div></div>' +
        '<div class="pv-hero-tags"><span><i>' + IC.cap + '</i>Teacher</span><span><i>' + IC.globe + '</i>' + esc(nativeText) + '</span><span><i>*</i>' + esc(ratingText + ' rating') + '</span><span><i>G</i>' + esc(studentsText + ' students') + '</span><span><i>B</i>' + esc(lessonsText + ' lessons') + '</span></div>' +
        '<div class="pv-hero-tags pv-hero-tags-soft"><span><i>' + IC.lang + '</i>' + esc(teachText) + '</span><span><i>A</i>' + esc(levelText) + '</span>' + spec.slice(0, 4).map(function (x) { return '<span><i>✓</i>' + esc(x) + '</span>'; }).join('') + '</div>' +
        '<p class="pv-hero-bio">' + esc(bioText) + '</p>' +
        '<input type="file" id="pvCoverFile" accept="image/*" hidden><input type="file" id="pvAvatarFile" accept="image/*" hidden>' +
        '</section>';

      const sideHtml = '<aside class="pv-side">' +
        '<div class="pv-side-card"><div class="pv-mini-stats"><div><i>*</i><b>' + esc(ratingText) + '</b><span>' + esc(tr('Rating', 'Rating')) + '</span></div><div><i>G</i><b>' + esc(studentsText) + '</b><span>' + esc(tr('Students', 'Students')) + '</span></div><div><i>B</i><b>' + esc(lessonsText) + '</b><span>' + esc(tr('Lessons', 'Lessons')) + '</span></div><div><i>Z</i><b>98%</b><span>' + esc(tr('Response', 'Response')) + '</span></div></div>' +
        '<h3>' + esc(tr('Your performance', 'Your performance')) + '</h3><div class="pv-bars"><span><b>' + esc(tr('Teaching quality', 'Teaching quality')) + '</b><i>92%</i></span><em><u style="width:92%"></u></em><span><b>' + esc(tr('Punctuality', 'Punctuality')) + '</b><i>96%</i></span><em><u style="width:96%"></u></em><span><b>' + esc(tr('Speaking practice', 'Speaking practice')) + '</b><i>88%</i></span><em><u style="width:88%"></u></em></div></div>' +
        '<div class="pv-side-card pv-coins"><img src="./assets/coins/duvela-coin.png" alt=""><div><b>2,450</b><span>Duvela Coins</span><p>' + esc(tr('Earn coins from lessons, events and active engagement.', 'Earn coins from lessons, events and active engagement.')) + '</p></div></div>' +
        '<div class="pv-side-card"><h3>' + esc(tr('Latest activity', 'Latest activity')) + '</h3><div class="pv-activity"><span>LIVE</span><b>' + esc(tr('Live lesson finished', 'Live lesson finished')) + '</b><i>+80</i></div><div class="pv-activity"><span>NEW</span><b>' + esc(tr('New student joined', 'New student joined')) + '</b><i>+1</i></div></div>' +
        '</aside>';

      html += '<section class="pv-card pv-identity"><h3>' + esc(tr('Identity', 'Identity')) + '</h3><button type="button" class="pv-link-btn" data-pv-act="edit">' + IC.edit + '<span>' + esc(tr('Edit details', 'Edit details')) + '</span></button><div class="pv-id-grid"><div><span>E-Mail</span><b>' + esc(ctx.user.email || '') + '</b></div><div><span>' + esc(tr('Role', 'Role')) + '</span><b>Teacher</b></div><div><span>' + esc(tr('Full name', 'Full name')) + '</span><b>' + esc(name) + '</b></div><div><span>' + esc(tr('City', 'City')) + '</span><b>' + esc(location || '-') + '</b></div></div></section>';
      html += '<div class="pv-lower-grid"><section class="pv-card pv-goals"><h3>' + esc(tr('Teaching & goals', 'Teaching & goals')) + '</h3><p class="pv-about">' + esc(p.teaching_experience || tr('Help learners move from first confidence to clear results with structured lessons.', 'Help learners move from first confidence to clear results with structured lessons.')) + '</p><div class="pv-check-list"><span>' + esc(teachText) + '</span><span>' + esc(levelText) + '</span><span>Live teaching</span></div></section>';
      html += '<section class="pv-card pv-about-card"><h3>' + esc(tr('About me', 'About me')) + '</h3><button type="button" class="pv-link-btn" data-pv-act="edit"><span>' + esc(tr('Edit', 'Edit')) + '</span></button><p class="pv-about">' + esc(bioText) + '</p>' + chips(spec.slice(0, 6), '') + '</section></div>';
      html += '<section class="pv-card pv-awards-card"><div class="pv-awards-head"><div><h3>' + esc(tr('Awards', 'Awards')) + '</h3><p>' + esc(tr('Choose which badge appears next to your name.', 'Choose which badge appears next to your name.')) + '</p></div>' + awardBadge('selected') + '</div><div class="pv-awards-grid">' + AWARDS.map(function (a) {
        return '<button type="button" class="pv-award-tile' + (a.key === selectedAwardKey ? ' active' : '') + (!a.unlocked ? ' locked' : '') + '" data-award-select="' + esc(a.key) + '"' + (!a.unlocked ? ' disabled' : '') + '><img src="' + esc(a.img) + '" alt=""><b>' + esc(a.title) + '</b><span>' + esc(a.text) + '</span></button>';
      }).join('') + '</div></section>';
      html += '<section class="pv-card pv-reviews-card"><h3>' + esc(tr('Reviews', 'Reviews')) + '</h3>';
      if (!reviews) {
        html += '<div class="pv-review-empty"><i>' + IC.chat + '</i><b>' + esc(tr('Loading reviews...', 'Loading reviews...')) + '</b><p>' + esc(tr('Reviews will appear here after your first meetup, session, or business exchange.', 'Reviews will appear here after your first meetup, session, or business exchange.')) + '</p></div>';
      } else if (!reviews.length) {
        html += '<div class="pv-review-empty"><i>' + IC.chat + '</i><b>' + esc(tr('No reviews yet', 'No reviews yet')) + '</b><p>' + esc(tr('Reviews will appear here after your first meetup, session, or business exchange.', 'Reviews will appear here after your first meetup, session, or business exchange.')) + '</p></div>';
      } else {
        html += '<div class="pv-review-list">' + reviews.slice(0, 3).map(function (r) {
          return '<article class="pv-review"><div class="pv-review-top"><b>* ' + esc(String(r.rating || '')) + '</b><span>' + esc(new Date(r.created_at).toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-US')) + '</span></div>' + (r.comment ? '<p>' + esc(r.comment) + '</p>' : '') + '</article>';
        }).join('') + '</div>';
      }
      html += '</section>';

      const verification = ctx.state ? ctx.state.verification : null;
      const verifyLabel = p.is_verified ? tr('Verified', 'Verified') : (verification && verification.status === 'pending') ? tr('Pending', 'Pending') : tr('Verification', 'Verification');
      html += '<section class="pv-actions pv-wide-actions"><button type="button" class="pv-action" data-pv-act="edit"><span class="pv-action-ic">' + IC.edit + '</span>' + esc(tr('Edit Profile', 'Edit Profile')) + '</button><button type="button" class="pv-action" data-pv-act="verify"><span class="pv-action-ic teal">' + IC.shield + '</span>' + esc(verifyLabel) + '</button><button type="button" class="pv-action" data-pv-act="lang"><span class="pv-action-ic">' + IC.globe + '</span>' + esc(tr('Change Language', 'Change Language')) + '</button><button type="button" class="pv-action" data-pv-act="invite"><span class="pv-action-ic teal">' + IC.gift + '</span>' + esc(tr('Invite Friends', 'Invite Friends')) + '</button></section>';
      html += '<section class="pv-account-card pv-desktop-account"><div><h3>' + esc(tr('Account', 'Account')) + '</h3><p>' + esc(tr('Sign out of this browser or permanently delete your account.', 'Sign out of this browser or permanently delete your account.')) + '</p></div><div class="pv-account-actions"><button type="button" class="pv-account-btn" data-pv-act="signout">← ' + esc(tr('Sign out', 'Sign out')) + '</button><button type="button" class="pv-account-btn danger" data-pv-act="delete">⌫ ' + esc(tr('Delete account', 'Delete account')) + '</button></div></section>';
      html += '</main>' + sideHtml + '</div>';
      if (saveNotice) html += '<div class="pv-toast">' + esc(saveNotice) + '</div>';
      return html;
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

      const presetCover = coverPresetStyle(p.cover_url);
      const cover = presetCover || (p.cover_url
        ? 'background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.25)),url(' + esc(p.cover_url) + ');background-size:cover;background-position:center;'
        : 'background:linear-gradient(135deg,#12B886,#37D89E);');
      return renderDesktopView({ profile: p, name: name, location: location, teaches: teaches, specialization: specialization, cover: cover });
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
      html += '<div class="pv-account-card"><div><h3>' + esc(tr('Account', 'Аккаунт')) + '</h3><p>' + esc(tr('Manage your session or permanently remove the web profile.', 'Управляйте текущей сессией или удалите профиль без возможности восстановления.')) + '</p></div>' +
        '<div class="pv-account-actions"><button type="button" class="pv-account-btn" data-pv-act="signout">↪ ' + esc(tr('Sign out', 'Выйти')) + '</button>' +
        '<button type="button" class="pv-account-btn danger" data-pv-act="delete">♲ ' + esc(tr('Delete account', 'Удалить аккаунт')) + '</button></div></div>';

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
      const name = (d.full_name || (ctx.user.email || 'Duvela').split('@')[0]).trim();
      const location = [d.city, d.country].filter(Boolean).join(', ');
      const teaches = d.teaches_languages.map(function (id) { return TEACH_LANGUAGE_LABELS[id] || id; }).join(', ') || tr('German, English', 'German, English');
      const spec = d.specialization.length ? d.specialization : ['Conversation', 'Grammar', 'Pronunciation'];
      let html = '<div class="pv-edit-shell">';
      html += '<div class="pv-edit-top"><button type="button" class="pv-backlink" id="pvEditCancel">' + IC.back + '<span>' + esc(tr('Back to profile', 'Back to profile')) + '</span></button>' +
        '<div><h2>' + esc(tr('Edit Profile', 'Edit Profile')) + '</h2><p>' + esc(tr('Keep your public teacher profile clear, polished and ready for students.', 'Keep your public teacher profile clear, polished and ready for students.')) + '</p></div></div>';

      html += '<div class="pv-edit-layout"><main class="pv-edit-main">';
      html += '<section class="pv-edit-card"><div class="pv-edit-card-head"><span>' + IC.cap + '</span><div><h3>' + esc(tr('Basics', 'Basics')) + '</h3><p>' + esc(tr('Name, location, native language and level.', 'Name, location, native language and level.')) + '</p></div></div>';
      html += '<div class="pv-field-grid">' +
        textField('pvName', tr('Full name', 'Имя'), d.full_name) +
        textField('pvCity', tr('City', 'Город'), d.city) +
        textField('pvCountry', tr('Country', 'Страна'), d.country) +
        textField('pvLanguage', tr('Native language', 'Родной язык'), d.language) +
        textField('pvLevel', tr('Level', 'Уровень'), d.language_level, 'A1–C2') +
        '</div></section>';

      html += '<section class="pv-edit-card"><div class="pv-edit-card-head"><span>' + IC.lang + '</span><div><h3>' + esc(tr('Teaches', 'Teaches')) + '</h3><p>' + esc(tr('Choose the languages students can book with you.', 'Choose the languages students can book with you.')) + '</p></div></div>';
      html += '<div class="pv-toggle-chips">' + TEACH_LANGUAGES.map(function (id) {
        const on = d.teaches_languages.indexOf(id) >= 0;
        return '<button type="button" class="pv-toggle-chip' + (on ? ' active' : '') + '" data-teach-toggle="' + id + '"><span>' + (on ? '✓' : '+') + '</span>' + esc(TEACH_LANGUAGE_LABELS[id]) + '</button>';
      }).join('') + '</div></section>';

      html += '<section class="pv-edit-card"><div class="pv-edit-card-head"><span>' + IC.edit + '</span><div><h3>' + esc(tr('About me', 'About me')) + '</h3><p>' + esc(tr('Write what students should understand before booking.', 'Write what students should understand before booking.')) + '</p></div></div>';
      html += textArea('pvBio', tr('Bio', 'О себе'), d.bio, tr('Tell students about yourself', 'Расскажите ученикам о себе'));

      html += chipEditor(tr('Qualifications', 'Квалификации'), 'quals', d.qualifications);
      html += chipEditor(tr('Specialization', 'Специализация'), 'spec', d.specialization);
      html += '</section>';

      html += '<section class="pv-edit-card"><div class="pv-edit-card-head"><span>' + IC.medal + '</span><div><h3>' + esc(tr('Experience', 'Experience')) + '</h3><p>' + esc(tr('Describe your teaching background and results.', 'Describe your teaching background and results.')) + '</p></div></div>';
      html += textArea('pvExperience', tr('Teaching experience', 'Опыт преподавания'), d.teaching_experience, tr('Years of experience, background, achievements...', 'Years of experience, background, achievements...'));
      html += '</section>';

      html += '<section class="pv-edit-card"><div class="pv-edit-card-head"><span>' + IC.gift + '</span><div><h3>' + esc(tr('Interests', 'Interests')) + '</h3><p>' + esc(tr('Small signals that make the profile feel human.', 'Small signals that make the profile feel human.')) + '</p></div></div>';
      html += '<div class="pv-toggle-chips">' + INTEREST_OPTIONS.map(function (item) {
        const on = d.profile_interests.indexOf(item[0]) >= 0;
        return '<button type="button" class="pv-toggle-chip' + (on ? ' active' : '') + '" data-interest-toggle="' + item[0] + '">' + item[1] + ' ' + esc(item[2]) + '</button>';
      }).join('') + '</div></section>';

      html += '<section class="pv-edit-card"><div class="pv-edit-card-head"><span>' + IC.share + '</span><div><h3>' + esc(tr('Social links', 'Social links')) + '</h3><p>' + esc(tr('Optional links for students who want to know more.', 'Optional links for students who want to know more.')) + '</p></div></div>';
      html += '<div class="pv-field-grid">' +
        textField('pvInstagram', 'Instagram', d.instagram, '@handle') +
        textField('pvTiktok', 'TikTok', d.tiktok, '@handle') +
        textField('pvFacebook', 'Facebook', d.facebook, '@handle') +
        textField('pvLinkedin', 'LinkedIn', d.linkedin, '@handle') +
        textField('pvYoutube', 'YouTube', d.youtube, '@handle') +
        textField('pvTelegram', 'Telegram', d.telegram, '@handle') +
        textField('pvWebsite', tr('Website', 'Сайт'), d.website, 'https://…') +
        '</div></section>';
      html += '</main>';

      html += '<aside class="pv-edit-side"><section class="pv-edit-preview"><div class="pv-edit-preview-cover"><span class="pv-edit-preview-avatar">' + ctx.avatarInner(name, (ctx.profile || {}).avatar_url) + '</span></div>' +
        '<h3>' + esc(name) + '</h3>' + (location ? '<p>' + IC.loc + '<span>' + esc(location) + '</span></p>' : '') +
        '<div class="pv-hero-tags pv-edit-preview-tags"><span><i>' + IC.cap + '</i>Teacher</span><span><i>' + IC.globe + '</i>' + esc(d.language || 'ru') + '</span><span><i>A</i>' + esc(d.language_level || 'A1') + '</span></div>' +
        '<div class="pv-hero-tags pv-hero-tags-soft pv-edit-preview-tags"><span><i>' + IC.lang + '</i>' + esc(teaches) + '</span>' + spec.slice(0, 3).map(function (x) { return '<span><i>+</i>' + esc(x) + '</span>'; }).join('') + '</div>' +
        '<p class="pv-about">' + esc(d.bio || tr('Your short teacher bio will appear here.', 'Your short teacher bio will appear here.')) + '</p></section>';

      if (saveNotice) html += '<div class="pv-notice">' + esc(saveNotice) + '</div>';

      html += '<div class="pv-edit-actions">' +
        '<button type="button" class="pv-btn-outline" id="pvEditCancel2">' + esc(tr('Cancel', 'Отмена')) + '</button>' +
        '<button type="button" class="pv-btn-solid" id="pvEditSave"' + (saving ? ' disabled' : '') + '>' + esc(saving ? tr('Saving…', 'Сохранение…') : tr('Save changes', 'Сохранить')) + '</button>' +
        '</div></aside></div></div>';
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

    async function clearMediaField(field) {
      saveNotice = tr('Updating...', 'Updating...'); paint();
      const patch = {}; patch[field] = null; patch.updated_at = new Date().toISOString();
      const r = await safe(supa.from('profiles').update(patch).eq('id', ctx.user.id));
      if (!r) { saveNotice = tr('Could not update. Try again.', 'Could not update. Try again.'); paint(); return; }
      ctx.setProfile(Object.assign({}, ctx.profile || {}, patch));
      saveNotice = tr('Updated', 'Updated');
      paint();
      setTimeout(function () { saveNotice = ''; paint(); }, 2000);
    }
    async function setCoverPreset(preset) {
      if (!preset) return;
      saveNotice = tr('Updating...', 'Updating...'); paint();
      const patch = { cover_url: 'preset:' + preset, updated_at: new Date().toISOString() };
      const r = await safe(supa.from('profiles').update(patch).eq('id', ctx.user.id));
      if (!r) { saveNotice = tr('Could not update. Try again.', 'Could not update. Try again.'); paint(); return; }
      ctx.setProfile(Object.assign({}, ctx.profile || {}, patch));
      saveNotice = tr('Updated', 'Updated');
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
      const avatarFile = host.querySelector('#pvAvatarFile');
      const coverFile = host.querySelector('#pvCoverFile');
      Array.prototype.forEach.call(host.querySelectorAll('#pvAvatarCam,#pvAvatarPick'), function (button) {
        if (button && avatarFile) button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          avatarFile.click();
        });
      });
      if (avatarFile) {
        avatarFile.addEventListener('change', function () {
          const f = avatarFile.files && avatarFile.files[0];
          if (f) void uploadAndSave('avatar_url', f);
        });
      }
      Array.prototype.forEach.call(host.querySelectorAll('#pvCoverCam,#pvCoverPick'), function (button) {
        if (button && coverFile) button.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          coverFile.click();
        });
      });
      if (coverFile) {
        coverFile.addEventListener('change', function () {
          const f = coverFile.files && coverFile.files[0];
          if (f) void uploadAndSave('cover_url', f);
        });
      }
      const avatarRemove = host.querySelector('#pvAvatarRemove');
      const coverRemove = host.querySelector('#pvCoverRemove');
      if (avatarRemove) avatarRemove.addEventListener('click', function () { void clearMediaField('avatar_url'); });
      if (coverRemove) coverRemove.addEventListener('click', function () { void clearMediaField('cover_url'); });
      Array.prototype.forEach.call(host.querySelectorAll('[data-cover-preset]'), function (b) {
        b.addEventListener('click', function () { void setCoverPreset(b.getAttribute('data-cover-preset')); });
      });
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
            return;
          }
          if (act === 'signout') { document.getElementById('signOut')?.click(); return; }
          if (act === 'delete') { document.getElementById('deleteAccountBtn')?.click(); }
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-award-select]'), function (b) {
        b.addEventListener('click', function () {
          selectedAwardKey = b.getAttribute('data-award-select') || selectedAwardKey;
          localStorage.setItem('duvela.teacher.selectedAward', selectedAwardKey);
          paint();
        });
      });
    }

    return { render };
  }

  window.DuvelaBusinessProfileView = { create: createProfileView };
})();
