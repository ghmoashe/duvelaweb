(function () {
  var config = window.DuvelaWebConfig;
  var supa = config.createSupabaseClient();

  var isRu = (navigator.language || '').toLowerCase().indexOf('ru') === 0;
  var T = isRu ? {
    loading: 'Загружаем профиль…', notFound: 'Профиль не найден.',
    teacher: 'Учитель', organizer: 'Организатор', organization: 'Организация',
    liveNow: 'Сейчас в эфире', watch: 'Смотреть',
    openApp: 'Открыть в Duvela', getApp: 'Скачать приложение',
    courses: 'Курсы', events: 'Ближайшие события', videos: 'Видео',
    org: 'Организация', free: 'Бесплатно',
    online: 'Онлайн', inPerson: 'Офлайн'
  } : {
    loading: 'Loading profile…', notFound: 'Profile not found.',
    teacher: 'Teacher', organizer: 'Organizer', organization: 'Organization',
    liveNow: 'LIVE now', watch: 'Watch',
    openApp: 'Open in Duvela', getApp: 'Get the app',
    courses: 'Courses', events: 'Upcoming events', videos: 'Videos',
    org: 'Organization', free: 'Free',
    online: 'Online', inPerson: 'In person'
  };

  document.getElementById('loading').textContent = T.loading;
  document.getElementById('notfound').textContent = T.notFound;
  document.getElementById('openApp').textContent = T.openApp;
  document.getElementById('getApp').textContent = T.getApp;
  document.getElementById('coursesTitle').textContent = T.courses;
  document.getElementById('eventsTitle').textContent = T.events;
  document.getElementById('shortsTitle').textContent = T.videos;
  document.getElementById('orgTitle').textContent = T.org;
  document.getElementById('liveWatch').textContent = T.watch;

  var id = new URLSearchParams(window.location.search).get('id') || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    showNotFound();
    return;
  }

  document.getElementById('openApp').href = 'duvelahub://native/other-profile?profileId=' + id;

  function showNotFound() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('notfound').style.display = 'block';
  }
  function initials(name) {
    return (name || 'D').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function esc(s) {
    var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML;
  }
  function cssUrl(u) { return "url('" + String(u).replace(/'/g, "%27") + "')"; }
  function show(sectionId) { document.getElementById(sectionId).classList.add('show'); }

  supa.from('profiles')
    .select('id,full_name,avatar_url,cover_url,city,country,bio,is_teacher,is_organizer,language,language_level')
    .eq('id', id).maybeSingle()
    .then(function (res) {
      var p = res.data;
      if (!p) { showNotFound(); return; }
      renderHeader(p);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      loadExtras(p);
    })
    .catch(showNotFound);

  function renderHeader(p) {
    var name = p.full_name || 'Duvela user';
    document.title = name + ' — Duvela';
    document.getElementById('name').textContent = name;
    if (p.cover_url) document.getElementById('cover').style.backgroundImage = cssUrl(p.cover_url);
    var av = document.getElementById('avatar');
    if (p.avatar_url) {
      var img = document.createElement('img');
      img.src = p.avatar_url; img.alt = name; img.className = 'avatar';
      av.replaceWith(img);
    } else {
      av.textContent = initials(name);
    }
    var metaParts = [];
    if (p.city) metaParts.push(p.city);
    if (p.country) metaParts.push(p.country);
    document.getElementById('meta').textContent = metaParts.join(', ');
    var chips = document.getElementById('chips');
    if (p.is_teacher) chips.insertAdjacentHTML('beforeend', '<span class="chip">' + T.teacher + '</span>');
    if (p.is_organizer) chips.insertAdjacentHTML('beforeend', '<span class="chip">' + T.organizer + '</span>');
    if (p.language) chips.insertAdjacentHTML('beforeend', '<span class="chip teal">' + esc(p.language) + (p.language_level ? ' · ' + esc(p.language_level) : '') + '</span>');
    if (p.bio) {
      var bio = document.getElementById('bio');
      bio.textContent = p.bio; bio.style.display = 'block';
    }
  }

  function loadExtras(p) {
    // 🔴 LIVE badge — public sessions only; links into the live landing page.
    supa.from('live_sessions')
      .select('id,teacher_name,is_private')
      .eq('teacher_id', id).eq('status', 'live').limit(1)
      .then(function (res) {
        var s = res.data && res.data[0];
        if (!s || s.is_private) return;
        document.getElementById('liveText').textContent = T.liveNow;
        document.getElementById('liveWatch').href =
          './live.html?s=' + encodeURIComponent(s.id) + '&t=' + encodeURIComponent(p.full_name || '');
        document.getElementById('liveBanner').classList.add('show');
      }).catch(function () {});

    // Courses created by this profile (teacher view).
    supa.from('courses')
      .select('id,title,description,language,level,cover_image_url,price,currency')
      .eq('created_by', id).eq('status', 'active').limit(12)
      .then(function (res) {
        var rows = res.data || [];
        if (!rows.length) return;
        var host = document.getElementById('courses');
        rows.forEach(function (c) {
          var sub = [c.language, c.level].filter(Boolean).join(' · ');
          var price = c.price ? esc(c.price) + ' ' + esc(c.currency || '') : T.free;
          var thumb = c.cover_image_url ? ' style="background-image:' + cssUrl(c.cover_image_url) + '"' : '';
          host.insertAdjacentHTML('beforeend',
            '<div class="tile">' +
              '<div class="thumb"' + thumb + '></div>' +
              '<div class="pad"><h3>' + esc(c.title) + '</h3>' +
              (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
              '<div class="price">' + price + '</div></div>' +
            '</div>');
        });
        show('coursesSection');
      }).catch(function () {});

    // Organizer events (future ones first).
    supa.from('events')
      .select('id,title,city,country,event_date,event_time,format,is_paid,price_amount')
      .eq('organizer_id', id)
      .gte('event_date', new Date().toISOString().slice(0, 10))
      .order('event_date', { ascending: true }).limit(8)
      .then(function (res) {
        var rows = res.data || [];
        if (!rows.length) return;
        var host = document.getElementById('events');
        rows.forEach(function (ev) {
          var d = new Date(ev.event_date + 'T00:00:00');
          var day = d.getDate();
          var mon = d.toLocaleString(isRu ? 'ru' : 'en', { month: 'short' });
          var sub = [ev.city, ev.event_time, ev.format === 'online' ? T.online : ev.format ? T.inPerson : ''].filter(Boolean).join(' · ');
          var price = ev.is_paid && ev.price_amount ? ' · ' + esc(ev.price_amount) + '€' : ' · ' + T.free;
          host.insertAdjacentHTML('beforeend',
            '<div class="event-row">' +
              '<div class="event-date"><b>' + day + '</b><span>' + esc(mon) + '</span></div>' +
              '<div class="event-info"><h3>' + esc(ev.title) + '</h3>' +
              '<div class="sub">' + esc(sub) + price + '</div></div>' +
            '</div>');
        });
        show('eventsSection');
      }).catch(function () {});

    // Shorts / video posts.
    supa.from('posts')
      .select('id,cover_url,mux_thumbnail_url,media_url,media_type')
      .eq('user_id', id).order('created_at', { ascending: false }).limit(9)
      .then(function (res) {
        var rows = (res.data || []).filter(function (r) { return r.cover_url || r.mux_thumbnail_url; });
        if (!rows.length) return;
        var host = document.getElementById('shorts');
        rows.forEach(function (r) {
          var thumb = r.mux_thumbnail_url || r.cover_url;
          host.insertAdjacentHTML('beforeend',
            '<div class="short" style="background-image:' + cssUrl(thumb) + '"></div>');
        });
        show('shortsSection');
      }).catch(function () {});

    // Organization owned by this profile (needs the public-read RLS policy).
    supa.from('organizations')
      .select('id,name,description,city,country')
      .eq('owner_id', id).limit(1)
      .then(function (res) {
        var org = res.data && res.data[0];
        if (!org) return;
        document.getElementById('orgName').textContent = org.name;
        document.getElementById('orgMeta').textContent = [org.city, org.country].filter(Boolean).join(', ');
        if (org.description) {
          var el = document.getElementById('orgDesc');
          el.textContent = org.description; el.style.display = 'block';
        }
        show('orgSection');
        loadTeam(org.id);
      }).catch(function () {});
  }

  function loadTeam(orgId) {
    supa.from('organization_memberships')
      .select('user_id,role').eq('organization_id', orgId).eq('status', 'active').limit(20)
      .then(function (res) {
        var rows = res.data || [];
        if (!rows.length) return;
        var ids = rows.map(function (r) { return r.user_id; });
        supa.from('profiles').select('id,full_name,avatar_url').in('id', ids)
          .then(function (pr) {
            var profiles = pr.data || [];
            var byId = {};
            profiles.forEach(function (x) { byId[x.id] = x; });
            var host = document.getElementById('team');
            rows.forEach(function (m) {
              var prof = byId[m.user_id];
              if (!prof) return;
              var avatar = prof.avatar_url
                ? '<img src="' + esc(prof.avatar_url) + '" alt="">'
                : '<span class="mini">' + esc(initials(prof.full_name)) + '</span>';
              host.insertAdjacentHTML('beforeend',
                '<a class="member" href="./profile.html?id=' + encodeURIComponent(m.user_id) + '">' + avatar +
                '<span><b>' + esc(prof.full_name || 'Duvela user') + '</b><span>' + esc(m.role || '') + '</span></span></a>');
            });
          });
      }).catch(function () {});
  }
})();
