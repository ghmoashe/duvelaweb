// Public teacher profile on profile.html (what learners and visitors see).
// Same structure as the app: hero, Super+ / Message / Follow / Book, stats, info cards,
// medals, About / Courses / Events / Reviews. Every number comes from the database;
// actions that need an account send guests to sign in first.
(function () {
  var MEDALS = [
    { id: 'founding100', img: 'first-100-teachers', en: 'First 100 Teachers', ru: 'Первые 100 учителей' },
    { id: 'firstLesson', img: 'first-lesson', en: 'First Lesson', ru: 'Первый урок' },
    { id: 'tenLessons', img: 'ten-lessons', en: '10 Lessons Together', ru: '10 уроков вместе' },
    { id: 'duvelaAuthor', img: 'duvela-author', en: 'Duvela Author', ru: 'Автор Duvela' },
    { id: 'firstGraduate', img: 'first-graduate', en: 'First Graduate', ru: 'Первый выпускник' },
    { id: 'liveTeacher', img: 'live-teacher', en: 'Live Teacher', ru: 'Учитель LIVE' },
    { id: 'studentFavorite', img: 'student-favorite', en: 'Student Favorite', ru: 'Любимец студентов' },
    { id: 'consistentTeacher', img: 'consistent-teacher', en: 'Consistent Teacher', ru: 'Стабильный учитель' },
    { id: 'mentor', img: 'mentor', en: 'Mentor', ru: 'Наставник' },
    { id: 'communityStar', img: 'community-star', en: 'Community Star', ru: 'Звезда сообщества' },
    { id: 'challengeCreator', img: 'challenge', en: 'Challenge Creator', ru: 'Создатель челленджей' },
    { id: 'onlineEventHost', img: 'online-event', en: 'Online Event Host', ru: 'Онлайн-события' },
    { id: 'offlineEventHost', img: 'offline-event', en: 'Offline Event Host', ru: 'Офлайн-события' }
  ];

  var LANG_NAMES = {
    english: ['English', 'Английский'], german: ['German', 'Немецкий'], spanish: ['Spanish', 'Испанский'],
    french: ['French', 'Французский'], italian: ['Italian', 'Итальянский'], portuguese: ['Portuguese', 'Португальский'],
    russian: ['Russian', 'Русский'], ukrainian: ['Ukrainian', 'Украинский'], turkish: ['Turkish', 'Турецкий'],
    farsi: ['Farsi', 'Фарси'], arabic: ['Arabic', 'Арабский'], chinese: ['Chinese', 'Китайский'],
    japanese: ['Japanese', 'Японский'], korean: ['Korean', 'Корейский'], polish: ['Polish', 'Польский'],
    czech: ['Czech', 'Чешский'], dutch: ['Dutch', 'Нидерландский'], swedish: ['Swedish', 'Шведский'],
    norwegian: ['Norwegian', 'Норвежский'], danish: ['Danish', 'Датский'], finnish: ['Finnish', 'Финский'],
    romanian: ['Romanian', 'Румынский'], serbian: ['Serbian', 'Сербский'], bulgarian: ['Bulgarian', 'Болгарский'],
    croatian: ['Croatian', 'Хорватский'], bosnian: ['Bosnian', 'Боснийский'], macedonian: ['Macedonian', 'Македонский'],
    slovenian: ['Slovenian', 'Словенский'], albanian: ['Albanian', 'Албанский'], kazakh: ['Kazakh', 'Казахский'],
    azerbaijani: ['Azerbaijani', 'Азербайджанский'], tajik: ['Tajik', 'Таджикский'], uzbek: ['Uzbek', 'Узбекский'],
    vietnamese: ['Vietnamese', 'Вьетнамский'], greek: ['Greek', 'Греческий'], hebrew: ['Hebrew', 'Иврит'],
    hindi: ['Hindi', 'Хинди']
  };
  var LANG_ALIASES = {
    en: 'english', de: 'german', deutsch: 'german', es: 'spanish', espanol: 'spanish', 'español': 'spanish',
    fr: 'french', francais: 'french', it: 'italian', italiano: 'italian', pt: 'portuguese', ru: 'russian',
    uk: 'ukrainian', tr: 'turkish', fa: 'farsi', persian: 'farsi', ar: 'arabic', zh: 'chinese', ja: 'japanese',
    ko: 'korean', pl: 'polish', cs: 'czech', nl: 'dutch', sv: 'swedish', no: 'norwegian', da: 'danish',
    fi: 'finnish', ro: 'romanian', sr: 'serbian', bg: 'bulgarian', hr: 'croatian', bs: 'bosnian', mk: 'macedonian',
    sl: 'slovenian', sq: 'albanian', shqip: 'albanian', kk: 'kazakh', az: 'azerbaijani', tg: 'tajik', uz: 'uzbek',
    vi: 'vietnamese', el: 'greek', he: 'hebrew', hi: 'hindi'
  };

  // Same rules as the app (shared/teacher-awards.ts).
  function earnedMedals(s, ctx) {
    var rating = s.review_avg || 0;
    var community = (s.likes || 0) + (s.comments || 0) * 2 + (s.followers || 0) * 3 + (s.videos || 0);
    var lessons = ctx.lessons, students = ctx.students;
    return {
      founding100: Boolean(ctx.verified && s.verified_rank && s.verified_rank <= 100),
      firstLesson: lessons >= 1,
      tenLessons: lessons >= 10,
      duvelaAuthor: (s.videos || 0) >= 10,
      firstGraduate: students >= 1 && lessons >= 10,
      liveTeacher: (s.live_sessions || 0) >= 1,
      studentFavorite: rating >= 4.8 && (s.review_count || 0) >= 10,
      consistentTeacher: (s.active_days || 0) >= 7,
      mentor: students >= 5 && lessons >= 10,
      communityStar: community >= 50,
      challengeCreator: (s.challenges || 0) >= 1,
      onlineEventHost: (s.online_events || 0) >= 1,
      offlineEventHost: (s.offline_events || 0) >= 1
    };
  }

  function render(opts) {
    var p = opts.profile, supa = opts.supa, isRu = opts.isRu, host = opts.host;
    var id = p.id;
    var t = function (en, ru) { return isRu ? ru : en; };
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
    var list = function (v) { return Array.isArray(v) ? v.filter(Boolean).map(String) : v ? String(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []; };
    // Stored ids ("espanol", "deutsch", "es") -> a name in the page language.
    var langName = function (code) {
      var raw = String(code || '').trim().toLowerCase();
      var key = LANG_ALIASES[raw] || LANG_ALIASES[raw.split(/[-_]/)[0]] || raw;
      var names = LANG_NAMES[key];
      return names ? names[isRu ? 1 : 0] : String(code || '').replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); });
    };
    var name = p.full_name || 'Duvela';
    var state = { user: null, following: false, superPrice: null, superActive: null, tab: 'about', busy: false };
    var loginUrl = './index.html?login=1&return_to=' + encodeURIComponent('/profile.html?id=' + id);

    document.title = name + ' — Duvela';
    var teaches = list(p.teaches_languages).map(langName);
    var level = String(p.language_level || '').trim().toUpperCase();
    var spoken = [];
    [p.language].concat(list(p.teaches_languages)).forEach(function (code) {
      var label = code ? langName(code) : '';
      if (label && spoken.every(function (s) { return s.label !== label; })) spoken.push({ label: label, native: code === p.language });
    });
    var info = [];
    if (p.language) info.push({ icon: '文A', tone: 'mint', label: t('Native', 'Родной'), value: langName(p.language) });
    if (level) info.push({ icon: '▮▮', tone: 'purple', label: t('Teaching levels', 'Уровни'), value: level === 'A1' ? 'A1' : 'A1 – ' + level });
    if (teaches.length) info.push({ icon: '🎓', tone: 'purple', label: t('Teaches', 'Преподаёт'), value: teaches.join(', ') });

    host.innerHTML =
      '<section class="pt-hero">' +
        '<span class="pt-orb a"></span><span class="pt-orb b"></span>' +
        '<span class="pt-super" id="ptSuperBadge" hidden>★ SUPER+</span>' +
        '<div class="pt-hero-main">' +
          '<div class="pt-ring">' + (p.avatar_url ? '<img src="' + esc(p.avatar_url) + '" alt="">' : '<span>' + esc(name.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase()) + '</span>') + '</div>' +
          '<div class="pt-id">' +
            '<h1>' + esc(name) + (p.is_verified ? ' <span class="pt-verified" title="' + esc(t('Verified', 'Проверен')) + '">✓</span>' : '') + '</h1>' +
            '<span class="pt-role">🎓 ' + esc(t('Teacher', 'Учитель')) + '</span>' +
            ([p.city, p.country].filter(Boolean).length ? '<div class="pt-loc">📍 ' + esc([p.city, p.country].filter(Boolean).join(', ')) + '</div>' : '') +
            (p.bio ? '<p class="pt-bio-line">' + esc(String(p.bio).split(/\r?\n/)[0]) + '</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="pt-actions">' +
          '<button type="button" class="pt-primary" id="ptPrimary">' + esc(t('Book a lesson', 'Записаться на урок')) + '</button>' +
          '<button type="button" class="pt-white" id="ptMessage">💬 ' + esc(t('Message', 'Написать')) + '</button>' +
          '<button type="button" class="pt-white pt-gift" id="ptGift" aria-label="' + esc(t('Send a gift', 'Отправить подарок')) + '" title="' + esc(t('Send a gift', 'Отправить подарок')) + '">🎁</button>' +
        '</div>' +
        '<p class="pt-error" id="ptError" hidden></p>' +
      '</section>' +
      '<div class="pt-secondary">' +
        '<button type="button" class="pt-follow" id="ptFollow">＋ ' + esc(t('Follow', 'Подписаться')) + '</button>' +
        '<button type="button" class="pt-follow" id="ptBook" hidden>📅 ' + esc(t('Book a lesson', 'Записаться на урок')) + '</button>' +
      '</div>' +
      '<div class="pt-live" id="ptLive" hidden><span><i></i>' + esc(t('LIVE now', 'Сейчас в эфире')) + '</span><a id="ptLiveLink" href="#">' + esc(t('Watch', 'Смотреть')) + '</a></div>' +
      '<section class="pt-stats">' +
        stat('students', '👥', 'pink', t('Students', 'Ученики')) +
        stat('lessons', '📘', 'blue', t('Lessons', 'Занятия')) +
        stat('rating', '★', 'gold', t('Rating', 'Рейтинг')) +
        stat('followers', '👤', 'purple', t('Followers', 'Подписчики')) +
      '</section>' +
      (info.length ? '<section class="pt-info">' + info.map(function (i) {
        return '<div class="pt-info-card"><span class="pt-info-icon ' + i.tone + '">' + esc(i.icon) + '</span><div><small>' + esc(i.label.toUpperCase()) + '</small><b>' + esc(i.value) + '</b></div></div>';
      }).join('') + '</section>' : '') +
      '<section class="pt-card pt-medals" id="ptMedals" hidden><div class="pt-head"><h2><span class="pt-mini gold">🏅</span>' + esc(t('Achievements & Medals', 'Достижения и медали')) + '</h2></div><div class="pt-medal-row" id="ptMedalRow"></div></section>' +
      '<nav class="pt-tabs" role="tablist">' +
        ['about', 'courses', 'events', 'reviews'].map(function (k) {
          var label = { about: t('About', 'О себе'), courses: t('Courses', 'Курсы'), events: t('Events', 'События'), reviews: t('Reviews', 'Отзывы') }[k];
          return '<button type="button" role="tab" data-pt-tab="' + k + '"' + (k === 'about' ? ' class="active" aria-selected="true"' : '') + '>' + esc(label) + '</button>';
        }).join('') +
      '</nav>' +
      '<section class="pt-card" id="ptTabBody"></section>' +
      '<section class="pt-card pt-app">' +
        '<b>' + esc(t('Continue in the Duvela app', 'Продолжите в приложении Duvela')) + '</b>' +
        '<div><a class="pt-white" href="duvelahub://native/other-profile?profileId=' + esc(id) + '">' + esc(t('Open in Duvela', 'Открыть в Duvela')) + '</a>' +
        '<a class="pt-white" href="./index.html#apps">' + esc(t('Get the app', 'Скачать приложение')) + '</a></div>' +
      '</section>';

    function stat(key, icon, tone, label) {
      return '<div class="pt-stat" data-stat="' + key + '"><span class="pt-stat-icon ' + tone + '">' + icon + '</span><b>–</b><span>' + esc(label) + '</span></div>';
    }
    function setStat(key, value) { var el = host.querySelector('[data-stat="' + key + '"] b'); if (el) el.textContent = value; }
    function showError(text) { var el = host.querySelector('#ptError'); el.textContent = text || ''; el.hidden = !text; }

    // ---------- About / Courses / Events / Reviews
    var cache = { courses: null, events: null, reviews: null, media: null };
    function renderTab() {
      var body = host.querySelector('#ptTabBody');
      if (state.tab === 'about') {
        var quals = list(p.qualifications);
        var spec = list(p.specialization);
        var html = '<h2>' + esc(t('About Me', 'Обо мне')) + '</h2>' + (p.bio ? '<p class="pt-about">' + esc(p.bio) + '</p>' : '');
        if (quals.length || spoken.length) {
          html += '<div class="pt-cols">';
          if (quals.length) html += '<div><h3><span class="pt-mini purple">🎓</span>' + esc(t('Qualifications', 'Квалификация')) + '</h3><ul class="pt-bullets">' + quals.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul></div>';
          if (spoken.length) html += '<div><h3><span class="pt-mini mint">💬</span>' + esc(t('Languages Spoken', 'Языки')) + '</h3><div class="pt-langs">' + spoken.map(function (l) { return '<div><span>' + esc(l.label) + '</span>' + (l.native ? '<em>' + esc(t('Native', 'Родной')) + '</em>' : '') + '</div>'; }).join('') + '</div></div>';
          html += '</div>';
        }
        if (spec.length) html += '<hr><h3><span class="pt-mini purple">◎</span>' + esc(t('Specialization', 'Специализация')) + '</h3><div class="pt-chips">' + spec.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>';
        if (p.teaching_experience) html += '<hr><h3><span class="pt-mini purple">⏱</span>' + esc(t('Experience', 'Опыт')) + '</h3><p class="pt-about">' + esc(p.teaching_experience) + '</p>';
        if (cache.media && cache.media.length) html += '<hr><h3><span class="pt-mini purple">🎬</span>' + esc(t('Media', 'Медиа')) + '</h3><div class="pt-media">' + cache.media.map(function (u) { return '<span style="background-image:url(\'' + String(u).replace(/'/g, '%27') + '\')"></span>'; }).join('') + '</div>';
        body.innerHTML = html;
        return;
      }
      if (cache[state.tab] === null) { body.innerHTML = '<p class="pt-empty">' + esc(t('Loading…', 'Загрузка…')) + '</p>'; return; }
      var rows = cache[state.tab];
      if (state.tab === 'courses') {
        body.innerHTML = rows.length ? '<div class="pt-list">' + rows.map(function (c) {
          return '<div class="pt-row"><span class="pt-thumb"' + (c.cover_image_url ? ' style="background-image:url(\'' + String(c.cover_image_url).replace(/'/g, '%27') + '\')"' : '') + '></span><div><b>' + esc(c.title) + '</b><small>' + esc([c.language, c.level].filter(Boolean).join(' · ')) + '</small></div></div>';
        }).join('') + '</div>' : empty('📚', t('No courses yet', 'Пока нет курсов'), t('Published courses will appear here.', 'Здесь появятся опубликованные курсы.'));
      } else if (state.tab === 'events') {
        body.innerHTML = rows.length ? '<div class="pt-list">' + rows.map(function (ev) {
          var d = new Date(ev.event_date + 'T12:00:00Z');
          return '<div class="pt-row"><span class="pt-date"><b>' + d.getUTCDate() + '</b>' + esc(d.toLocaleString(isRu ? 'ru' : 'en', { month: 'short', timeZone: 'UTC' })) + '</span><div><b>' + esc(ev.title) + '</b><small>' + esc([ev.event_time ? String(ev.event_time).slice(0, 5) : '', ev.format === 'online' ? t('Online', 'Онлайн') : ev.city].filter(Boolean).join(' · ')) + '</small></div></div>';
        }).join('') + '</div>' : empty('📅', t('No events yet', 'Пока нет событий'), t('Upcoming events will appear here.', 'Здесь появятся ближайшие события.'));
      } else {
        body.innerHTML = rows.length ? '<div class="pt-list">' + rows.map(function (r) {
          return '<div class="pt-review"><span class="pt-stars">' + '★★★★★'.slice(0, r.rating) + '<i>' + '★★★★★'.slice(r.rating) + '</i></span><small>' + esc(new Date(r.created_at).toLocaleDateString(isRu ? 'ru' : 'en')) + '</small>' + (r.comment ? '<p>' + esc(r.comment) + '</p>' : '') + '</div>';
        }).join('') + '</div>' : empty('★', t('No reviews yet', 'Пока нет отзывов'), t('Learners can leave a review in the Duvela app.', 'Ученики могут оставить отзыв в приложении Duvela.'));
      }
    }
    function empty(icon, title, text) { return '<div class="pt-empty-card"><span>' + icon + '</span><b>' + esc(title) + '</b><p>' + esc(text) + '</p></div>'; }

    host.querySelectorAll('[data-pt-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.dataset.ptTab;
        host.querySelectorAll('[data-pt-tab]').forEach(function (b) { var on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        renderTab();
      });
    });
    renderTab();

    // ---------- Data
    var today = new Date().toISOString().slice(0, 10);
    supa.from('courses').select('id,title,language,level,cover_image_url').eq('created_by', id).eq('status', 'active').limit(12)
      .then(function (r) { cache.courses = r.data || []; if (state.tab === 'courses') renderTab(); }, function () { cache.courses = []; });
    supa.from('events').select('id,title,city,event_date,event_time,format').eq('organizer_id', id).gte('event_date', today).order('event_date', { ascending: true }).limit(12)
      .then(function (r) { cache.events = r.data || []; if (state.tab === 'events') renderTab(); }, function () { cache.events = []; });
    supa.from('events').select('id', { count: 'exact', head: true }).eq('organizer_id', id)
      .then(function (r) { state.lessons = r.count || 0; setStat('lessons', String(state.lessons)); loadMedals(); }, function () {});
    supa.from('teacher_reviews').select('rating,comment,created_at').eq('teacher_id', id).order('created_at', { ascending: false }).limit(30)
      .then(function (r) {
        cache.reviews = (r.data || []).filter(function (x) { return x.rating >= 1 && x.rating <= 5; });
        if (cache.reviews.length) setStat('rating', (cache.reviews.reduce(function (s, x) { return s + x.rating; }, 0) / cache.reviews.length).toFixed(1));
        if (state.tab === 'reviews') renderTab();
      }, function () { cache.reviews = []; });
    supa.from('posts').select('cover_url,mux_thumbnail_url').eq('user_id', id).order('created_at', { ascending: false }).limit(6)
      .then(function (r) { cache.media = (r.data || []).map(function (x) { return x.mux_thumbnail_url || x.cover_url; }).filter(Boolean); if (state.tab === 'about') renderTab(); }, function () {});
    supa.from('live_sessions').select('id,is_private').eq('teacher_id', id).eq('status', 'live').limit(1)
      .then(function (r) {
        var s = r.data && r.data[0]; if (!s || s.is_private) return;
        host.querySelector('#ptLiveLink').href = './live.html?s=' + encodeURIComponent(s.id) + '&t=' + encodeURIComponent(name);
        host.querySelector('#ptLive').hidden = false;
      }, function () {});
    supa.rpc('teacher_super_price', { p_teacher: id }).then(function (r) {
      var price = Number(r.data);
      state.superPrice = !r.error && price > 0 ? price : null;
      renderActions();
    }, function () {});

    supa.auth.getSession().then(function (res) {
      state.user = res && res.data && res.data.session ? res.data.session.user : null;
      renderActions();
      if (!state.user) return;
      // Counters and medals need a signed-in reader (security-definer functions).
      supa.rpc('teacher_public_stats', { p_teacher: id }).then(function (r) {
        var row = Array.isArray(r.data) ? r.data[0] : r.data;
        if (!row) return;
        state.students = Number(row.students) || 0;
        setStat('students', String(state.students));
        setStat('followers', String(Number(row.followers) || 0));
        loadMedals();
      }, function () {});
      if (state.user.id !== id) {
        supa.from('user_follows').select('follower_id').eq('follower_id', state.user.id).eq('following_id', id).maybeSingle()
          .then(function (r) { state.following = Boolean(r.data); renderActions(); }, function () {});
        supa.rpc('my_teacher_subscriptions').then(function (r) {
          var mine = (r.data || []).find(function (row) { return row.teacher_id === id; });
          state.superActive = mine ? { status: mine.status, end: mine.current_period_end } : null;
          renderActions();
        }, function () {});
      }
    });

    var medalStats = null;
    function loadMedals() {
      if (!state.user) return;
      if (medalStats === null) {
        medalStats = false;
        supa.rpc('teacher_award_stats', { p_teacher: id }).then(function (r) {
          medalStats = (Array.isArray(r.data) ? r.data[0] : r.data) || false;
          drawMedals();
        }, function () {});
        return;
      }
      drawMedals();
    }
    function drawMedals() {
      if (!medalStats) return;
      var earned = earnedMedals(medalStats, { lessons: state.lessons || 0, students: state.students || 0, verified: Boolean(p.is_verified) });
      var ordered = MEDALS.filter(function (m) { return earned[m.id]; }).concat(MEDALS.filter(function (m) { return !earned[m.id]; })).slice(0, 8);
      host.querySelector('#ptMedalRow').innerHTML = ordered.map(function (m) {
        return '<div class="pt-medal' + (earned[m.id] ? '' : ' locked') + '"><span><img src="./awards/small/' + m.img + '.png" alt="" loading="lazy">' + (earned[m.id] ? '' : '<i>🔒</i>') + '</span><b>' + esc(isRu ? m.ru : m.en) + '</b></div>';
      }).join('');
      host.querySelector('#ptMedals').hidden = false;
    }

    // ---------- Actions
    function renderActions() {
      var own = state.user && state.user.id === id;
      var primary = host.querySelector('#ptPrimary');
      var bookSecondary = host.querySelector('#ptBook');
      var follow = host.querySelector('#ptFollow');
      var message = host.querySelector('#ptMessage');
      var badge = host.querySelector('#ptSuperBadge');
      badge.hidden = !state.superPrice;
      message.hidden = Boolean(own);
      host.querySelector('#ptGift').hidden = Boolean(own) || !window.DuvelaGifts;
      follow.hidden = Boolean(own);
      follow.classList.toggle('on', state.following);
      follow.textContent = state.following ? '✓ ' + t('Following', 'Вы подписаны') : '＋ ' + t('Follow', 'Подписаться');
      if (state.superPrice && !own) {
        var active = state.superActive && state.superActive.status === 'active';
        primary.textContent = active ? '✓ ' + t('Super+ active', 'Super+ активна') : '★ ' + t('Subscribe (Super+)', 'Подписка Super+') + ' · ' + state.superPrice + ' DV';
        primary.classList.toggle('active', Boolean(active));
        bookSecondary.hidden = false;
      } else {
        primary.textContent = '📅 ' + t('Book a lesson', 'Записаться на урок');
        primary.classList.remove('active');
        bookSecondary.hidden = true;
      }
      primary.hidden = Boolean(own);
    }

    function needLogin() { if (state.user) return false; window.location.href = loginUrl; return true; }
    function openBooking() { if (needLogin()) return; window.location.href = './app.html?book_teacher=' + encodeURIComponent(id) + '#schedule'; }

    host.querySelector('#ptBook').addEventListener('click', openBooking);
    host.querySelector('#ptGift').addEventListener('click', function () {
      if (needLogin() || !window.DuvelaGifts) return;
      window.DuvelaGifts.openSheet({ isRu: isRu, recipientId: id, recipientName: name, supa: supa });
    });
    host.querySelector('#ptMessage').addEventListener('click', function () {
      if (needLogin()) return;
      window.location.href = './app.html?chat_with=' + encodeURIComponent(id) + '#messages';
    });
    host.querySelector('#ptFollow').addEventListener('click', function () {
      if (needLogin() || state.busy) return;
      state.busy = true;
      var next = !state.following;
      var op = next
        ? supa.from('user_follows').insert({ follower_id: state.user.id, following_id: id })
        : supa.from('user_follows').delete().eq('follower_id', state.user.id).eq('following_id', id);
      op.then(function (r) { if (!r.error) state.following = next; else showError(t('Could not update. Try again.', 'Не удалось обновить. Попробуйте ещё раз.')); state.busy = false; renderActions(); },
        function () { state.busy = false; });
    });
    // Super+ has its own page (super-plus.html): price, benefits, terms, server-confirmed status.
    host.querySelector('#ptPrimary').addEventListener('click', function () {
      if (!state.superPrice) { openBooking(); return; }
      window.location.href = './super-plus.html?teacher=' + encodeURIComponent(id);
    });
    renderActions();
  }

  window.DuvelaPublicTeacher = { render: render };
})();
