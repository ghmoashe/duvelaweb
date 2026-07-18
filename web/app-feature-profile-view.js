(function () {
  // Business "Profile" view — web mirror of the mobile Bus teacher profile
  // (features/business-screens/teacher-profile.tsx): green cover + Certified badge,
  // avatar, name, location, Students/Lessons/Rating stats, Native/Teaches/Level
  // cards, About/Reviews tabs (About Me, Languages, Interests, Social links) and
  // action cards. Reads ctx.profile; the editable form stays behind "Edit Profile".
  function createProfileView(ctx) {
    const { tr, esc, supa } = ctx;
    let activeTab = 'about';
    let stats = null;
    let reviews = null;
    let loadedFor = null;

    async function safe(p) { try { const r = await p; return (r && r.error) ? null : r; } catch (e) { return null; } }

    async function loadStats(uid) {
      const [ev, rev] = await Promise.all([
        safe(supa.from('events').select('id', { count: 'exact', head: true }).eq('organizer_id', uid)),
        safe(supa.from('teacher_reviews').select('rating').eq('teacher_id', uid))
      ]);
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
      cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
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
      if (loadedFor !== uid) { stats = null; reviews = null; }
      paint();
      if (loadedFor !== uid) {
        loadedFor = uid;
        Promise.all([loadStats(uid), loadReviews(uid)]).then(paint).catch(paint);
      }
    }

    function paint() {
      const host = document.getElementById('profileView');
      if (!host) return;
      const p = ctx.profile || {};
      const name = (p.full_name || (ctx.user.email || 'Duvela').split('@')[0]).trim();
      const location = [p.city, p.country].filter(Boolean).join(', ');
      const teaches = prettyList(p.teaches_languages);
      const spoken = [];
      [p.language].concat(p.teaches_languages || []).forEach(function (l) {
        var s = String(l || '').trim(); if (s && spoken.indexOf(s) < 0) spoken.push(s);
      });
      const interests = prettyList(p.profile_interests && p.profile_interests.length ? p.profile_interests : p.interests);
      const socials = [
        ['instagram', p.instagram], ['tiktok', p.tiktok], ['facebook', p.facebook],
        ['linkedin', p.linkedin], ['youtube', p.youtube], ['telegram', p.telegram], ['website', p.website]
      ].filter(function (s) { return String(s[1] || '').trim(); });

      // Cover + avatar
      const cover = p.cover_url
        ? 'background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.25)),url(' + esc(p.cover_url) + ');background-size:cover;background-position:center;'
        : 'background:linear-gradient(135deg,#12B886,#37D89E);';
      let html = '<div class="pv-cover" style="' + cover + '">' +
        (p.is_verified ? '<span class="pv-certified">' + esc(tr('Certified Teacher', 'Сертифицированный учитель')) + '</span>' : '') +
        '<span class="pv-cover-avatar">' + ctx.avatarInner(name, p.avatar_url) + '</span>' +
        '</div>';

      html += '<div class="pv-headline">' +
        '<h2>' + esc(name) + '</h2>' +
        '<button type="button" class="pv-share" id="pvShare" aria-label="' + esc(tr('Share', 'Поделиться')) + '">' + IC.share + '</button>' +
        '</div>';
      if (location) html += '<div class="pv-loc">' + IC.loc + '<span>' + esc(location) + '</span></div>';

      // Stats
      html += '<div class="pv-stats">' +
        statCell(stats ? String(stats.students) : '0', tr('Students', 'Ученики')) +
        statCell(stats ? String(stats.lessons) : '0', tr('Lessons', 'Уроки')) +
        statCell(stats && stats.rating ? stats.rating.toFixed(1) : '—', tr('Rating', 'Рейтинг')) +
        '</div>';

      // Native / Teaches / Level
      html += '<div class="pv-info-grid">' +
        infoCard(IC.lang, tr('Native', 'Родной'), (prettyList(p.language)[0] || ''), 'teal') +
        infoCard(IC.cap, tr('Teaches', 'Преподаёт'), teaches.join(', '), 'purple') +
        '</div>' +
        infoCard(IC.medal, tr('Level', 'Уровень'), p.language_level || '', 'amber');

      // Tabs
      html += '<div class="pv-tabs">' +
        '<button type="button" class="pv-tab' + (activeTab === 'about' ? ' active' : '') + '" data-pv-tab="about">' + esc(tr('About', 'О себе')) + '</button>' +
        '<button type="button" class="pv-tab' + (activeTab === 'reviews' ? ' active' : '') + '" data-pv-tab="reviews">' + esc(tr('Reviews', 'Отзывы')) + '</button>' +
        '</div>';

      if (activeTab === 'about') {
        html += '<div class="pv-card">';
        html += '<h3>' + esc(tr('About Me', 'Обо мне')) + '</h3>';
        html += '<p class="pv-about">' + esc(p.bio || tr('No description yet.', 'Пока нет описания.')) + '</p>';
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

      // Action cards
      html += '<div class="pv-actions">' +
        '<button type="button" class="pv-action" data-pv-act="edit"><span class="pv-action-ic">' + IC.edit + '</span>' + esc(tr('Edit Profile', 'Редактировать')) + '</button>' +
        '<button type="button" class="pv-action" data-pv-act="verify"><span class="pv-action-ic teal">' + IC.shield + '</span>' + esc(tr('Verification', 'Верификация')) + '</button>' +
        '<button type="button" class="pv-action" data-pv-act="lang"><span class="pv-action-ic">' + IC.globe + '</span>' + esc(tr('Change Language', 'Сменить язык')) + '</button>' +
        '<button type="button" class="pv-action" data-pv-act="invite"><span class="pv-action-ic teal">' + IC.gift + '</span>' + esc(tr('Invite Friends', 'Пригласить друзей')) + '</button>' +
        '</div>';

      host.innerHTML = html;
      bind(host);
    }

    function showEdit() {
      const view = document.getElementById('profileView');
      const edit = document.getElementById('profileEdit');
      const back = document.getElementById('profileBackBtn');
      if (view) view.hidden = true;
      if (edit) edit.hidden = false;
      if (back) back.hidden = false;
      window.scrollTo(0, 0);
    }

    function bind(host) {
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
      Array.prototype.forEach.call(host.querySelectorAll('[data-pv-act]'), function (b) {
        b.addEventListener('click', function () {
          const act = b.getAttribute('data-pv-act');
          if (act === 'edit' || act === 'verify') { showEdit(); return; }
          if (act === 'lang') {
            const sel = document.getElementById('langSelect');
            if (sel) { sel.focus(); if (sel.scrollIntoView) sel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            else showEdit();
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
