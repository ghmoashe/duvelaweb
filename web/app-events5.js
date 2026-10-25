(function () {
  'use strict';

  var ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>'; }
  function clean(value) { return String(value || '').trim().toLowerCase(); }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))).sort(function (a, b) { return String(a).localeCompare(String(b)); }); }
  function isCancelled(item) { return ['cancelled', 'canceled'].includes(clean(item && item.status)); }
  function isDraft(item) { return ['draft', 'unpublished'].includes(clean(item && item.status)); }
  function isPublished(item) { var status = clean(item && item.status); return !status || ['published', 'active', 'upcoming'].includes(status); }
  function dateValue(item) { if (!item || !item.event_date) return null; var value = new Date(item.event_date + 'T' + (item.event_time || '12:00') + ':00'); return isNaN(value) ? null : value; }
  function stateOf(item) {
    if (isCancelled(item)) return 'cancelled';
    var date = dateValue(item);
    if (!date) return 'soon';
    return date.getTime() < Date.now() ? 'past' : 'upcoming';
  }
  function formatName(item, tr) {
    if (item.is_online) return tr('Online', 'Онлайн');
    return item.format === 'mixed' ? tr('Online & in person', 'Онлайн и очно') : tr('In person', 'Очно');
  }

  function install() {
    if (!window.DuvelaAppCatalog || window.DuvelaAppCatalog.__events5) return;
    var original = window.DuvelaAppCatalog.create;
    window.DuvelaAppCatalog.create = function (ctx) {
      var base = original(ctx);
      var $ = ctx.$, tr = ctx.tr, esc = ctx.esc, state = ctx.state, supa = ctx.supa;
      var filters = { query: '', format: '', location: '', view: 'upcoming', display: 'cards' };
      var eventCounts = {};
      var myRsvps = {};
      var loadingMembership = false;
      var membershipLoaded = false;

      function titleFor(value) {
        return value === 'upcoming' ? tr('Upcoming events', 'Ближайшие события') : value === 'soon' ? tr('Coming soon', 'Скоро') : tr('My events', 'Мои события');
      }
      function dateText(item) {
        if (!item.event_date) return tr('Date to be announced', 'Дата уточняется');
        var date = new Date(item.event_date + 'T12:00:00');
        return date.toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + (item.event_time ? ' · ' + item.event_time.slice(0, 5) : '');
      }
      function priceText(item) { return item.is_free || item.price == null || Number(item.price) === 0 ? tr('Free', 'Бесплатно') : ctx.formatMoney(item); }
      function allowedEvents() { return (state.events || []).filter(function (item) { return item && item.id && !isDraft(item); }); }
      function statusLabel(item) {
        var kind = stateOf(item);
        return kind === 'soon' ? tr('Date to be announced', 'Дата уточняется') : kind === 'cancelled' ? tr('Cancelled', 'Отменено') : kind === 'past' ? tr('Past event', 'Прошедшее') : tr('Upcoming', 'Скоро');
      }
      function matches(item) {
        var kind = stateOf(item), query = clean(filters.query), city = clean(item.city);
        if (filters.view === 'upcoming' && kind !== 'upcoming') return false;
        if (filters.view === 'soon' && kind !== 'soon') return false;
        if (filters.view === 'mine' && !myRsvps[item.id]) return false;
        if (filters.format === 'online' && !item.is_online) return false;
        if (filters.format === 'offline' && item.is_online) return false;
        if (filters.location === 'online' && !item.is_online) return false;
        if (filters.location && filters.location !== 'online' && city !== clean(filters.location)) return false;
        if (query && !clean([item.title, item.description, item.city, item.country, item.language].join(' ')).includes(query)) return false;
        return filters.view === 'mine' || isPublished(item);
      }
      function card(item) {
        var count = eventCounts[item.id];
        var capacity = Number(item.max_participants) || 0;
        var seats = capacity && typeof count === 'number' ? Math.max(capacity - count, 0) : null;
        var place = item.is_online ? tr('Join from anywhere', 'Подключение из любой точки') : [item.city, item.country].filter(Boolean).join(', ') || tr('Location to be announced', 'Место уточняется');
        var image = item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<div class="ed-cover-fallback"><span>DUVELA</span><b>' + icon('calendar') + '</b></div>';
        return '<article class="ed-card" data-event="' + esc(item.id) + '" tabindex="0">' +
          '<div class="ed-cover">' + image + '<span class="ed-format">' + esc(formatName(item, tr)) + '</span><span class="ed-status ' + stateOf(item) + '">' + esc(statusLabel(item)) + '</span></div>' +
          '<div class="ed-card-body">' +
          '<div class="ed-tags">' + (item.language ? '<span>' + esc(item.language) + '</span>' : '') + (item.level ? '<span>' + esc(item.level) + '</span>' : '') + '</div>' +
          '<h3>' + esc(item.title || tr('Event', 'Событие')) + '</h3><p>' + esc(item.description || tr('Details will be shared by the organizer.', 'Детали сообщит организатор.')) + '</p>' +
          '<dl><div>' + icon('calendar') + '<span>' + esc(dateText(item)) + '</span></div><div>' + icon('pin') + '<span>' + esc(place) + '</span></div>' +
          (capacity ? '<div>' + icon('users') + '<span>' + esc(seats === null ? tr('Capacity: ', 'Мест: ') + capacity : (seats ? tr('Places left: ', 'Свободных мест: ') + seats : tr('No places left', 'Свободных мест нет'))) + '</span></div>' : '') + '</dl>' +
          '<footer><strong>' + esc(priceText(item)) + '</strong><button type="button" data-event="' + esc(item.id) + '">' + esc(tr('View event', 'Подробнее')) + ' ' + icon('arrow') + '</button></footer></div></article>';
      }
      function agenda(items) {
        if (!items.length) return empty();
        return '<div class="ed-agenda">' + items.map(function (item) { return '<button type="button" data-event="' + esc(item.id) + '"><span class="ed-agenda-date">' + esc(item.event_date ? new Date(item.event_date + 'T12:00:00').toLocaleDateString(ctx.isRu ? 'ru-RU' : 'en-GB', { day: '2-digit', month: 'short' }) : '—') + '</span><span><b>' + esc(item.title) + '</b><small>' + esc([formatName(item, tr), item.is_online ? tr('Online', 'Онлайн') : item.city || tr('Location pending', 'Место уточняется')].join(' · ')) + '</small></span><em>' + esc(statusLabel(item)) + '</em>' + icon('arrow') + '</button>'; }).join('') + '</div>';
      }
      function empty() {
        var copy = filters.view === 'mine' ? tr('Your event registrations will appear here.', 'Здесь появятся ваши записи на события.') : filters.view === 'soon' ? tr('No announced events are waiting for a date.', 'Нет анонсов, ожидающих дату.') : tr('No matching upcoming events are available yet.', 'Пока нет подходящих ближайших событий.');
        return '<div class="ed-empty">' + icon('calendar') + '<h2>' + esc(tr('Nothing to show yet', 'Пока ничего нет')) + '</h2><p>' + esc(copy) + '</p></div>';
      }
      function renderEvents() {
        if (ctx.isBusiness()) return base.renderEvents();
        var host = $('#eventList'); if (!host) return;
        if (!membershipLoaded && !loadingMembership && (state.events || []).length) void loadMembership();
        var all = allowedEvents();
        var cities = unique(all.filter(function (item) { return !item.is_online && item.city; }).map(function (item) { return item.city; }));
        var filtered = all.filter(matches).sort(function (a, b) { return (dateValue(a) || new Date(8640000000000000)) - (dateValue(b) || new Date(8640000000000000)); });
        var closest = all.filter(function (item) { return stateOf(item) === 'upcoming' && isPublished(item); })[0];
        var locationOptions = '<option value="">' + esc(tr('All locations', 'Все места')) + '</option><option value="online">' + esc(tr('Online', 'Онлайн')) + '</option>' + cities.map(function (city) { return '<option value="' + esc(city) + '">' + esc(city) + '</option>'; }).join('');
        host.className = 'ed-page';
        host.innerHTML = '<header class="ed-header"><div><small>DUVELA HUB / COMMUNITY</small><h1>' + esc(tr('Discover Events', 'События Duvela')) + '</h1><p>' + esc(tr('Meet people, practise languages and discover new skills.', 'Встречайтесь, практикуйте языки и открывайте новое.')) + '</p></div><span>' + icon('calendar') + '</span></header>' +
          '<section class="ed-hero"><small>LEARN · MEET · CONNECT</small><h2>' + esc(tr('Learning is better together.', 'Учиться вместе лучше.')) + '</h2><p>' + esc(closest ? tr('Next: ', 'Ближайшее: ') + closest.title + ' · ' + dateText(closest) : tr('Discover local meetups, creative workshops and online community sessions.', 'Находите локальные встречи, творческие воркшопы и онлайн-сессии сообщества.')) + '</p></section>' +
          '<section class="ed-toolbar"><label>' + icon('search') + '<input data-ed-query type="search" placeholder="' + esc(tr('Search events, cities or topics…', 'Поиск событий, городов или тем…')) + '" value="' + esc(filters.query) + '"></label><div><select data-ed-format><option value="">' + esc(tr('All formats', 'Все форматы')) + '</option><option value="online">' + esc(tr('Online', 'Онлайн')) + '</option><option value="offline">' + esc(tr('In person', 'Очно')) + '</option></select><select data-ed-location>' + locationOptions + '</select></div></section>' +
          '<nav class="ed-tabs" aria-label="' + esc(tr('Event groups', 'Группы событий')) + '"><button data-ed-view="upcoming" class="' + (filters.view === 'upcoming' ? 'active' : '') + '">' + esc(tr('Upcoming', 'Ближайшие')) + '</button><button data-ed-view="soon" class="' + (filters.view === 'soon' ? 'active' : '') + '">' + esc(tr('Coming soon', 'Скоро')) + '</button><button data-ed-view="mine" class="' + (filters.view === 'mine' ? 'active' : '') + '">' + esc(tr('My events', 'Мои события')) + '</button><span></span><button class="ed-display" data-ed-display aria-label="' + esc(tr('Switch layout', 'Изменить вид')) + '">' + icon(filters.display === 'cards' ? 'list' : 'grid') + '</button></nav>' +
          '<div class="ed-results-head"><h2>' + esc(titleFor(filters.view)) + '</h2><span>' + esc(filtered.length + ' ' + tr('events', 'событий')) + '</span></div>' + (filters.display === 'cards' ? '<div class="ed-grid">' + (filtered.length ? filtered.map(card).join('') : empty()) + '</div>' : agenda(filtered));
        var query = host.querySelector('[data-ed-query]'); query.oninput = function () { filters.query = query.value; renderEvents(); };
        host.querySelector('[data-ed-format]').value = filters.format; host.querySelector('[data-ed-location]').value = filters.location;
        host.querySelector('[data-ed-format]').onchange = function (event) { filters.format = event.target.value; renderEvents(); };
        host.querySelector('[data-ed-location]').onchange = function (event) { filters.location = event.target.value; renderEvents(); };
        host.querySelectorAll('[data-ed-view]').forEach(function (button) { button.onclick = function () { filters.view = button.dataset.edView; renderEvents(); }; });
        host.querySelector('[data-ed-display]').onclick = function () { filters.display = filters.display === 'cards' ? 'agenda' : 'cards'; renderEvents(); };
      }
      async function loadMembership() {
        if (loadingMembership || !ctx.user || !ctx.user.id) return;
        loadingMembership = true;
        try {
          var result = await supa.from('event_rsvps').select('event_id,status').eq('user_id', ctx.user.id);
          myRsvps = {};
          var registeredIds = (result.data || []).filter(function (row) { return row.event_id && row.status !== 'cancelled' && row.status !== 'canceled'; }).map(function (row) { myRsvps[row.event_id] = row.status || 'going'; return row.event_id; });
          // Public discovery intentionally excludes cancelled records.  A learner who had
          // registered may still need to see that cancellation in "My events".  This
          // read is RLS-protected; if the policy does not allow it, nothing is added.
          var missing = registeredIds.filter(function (id) { return !(state.events || []).some(function (event) { return String(event.id) === String(id); }); });
          if (missing.length) {
            var privateEvents = await supa.from('events').select('id,title,description,event_date,event_time,city,country,format,language,is_paid,price_amount,max_participants,image_url,organizer_id,status').in('id', missing);
            (privateEvents.data || []).forEach(function (row) {
              if (isDraft(row) || (state.events || []).some(function (event) { return String(event.id) === String(row.id); })) return;
              state.events.push({ id:row.id, title:row.title || tr('Event', 'Событие'), description:row.description || '', image:row.image_url, price:row.is_paid ? row.price_amount : null, currency:'EUR', is_free:!row.is_paid, is_online:row.format === 'online', event_date:row.event_date, event_time:row.event_time, city:row.city, country:row.country, format:row.format, language:row.language, max_participants:row.max_participants, organizer_id:row.organizer_id, status:row.status });
            });
          }
          var ids = allowedEvents().map(function (item) { return item.id; });
          if (ids.length && window.DuvelaWebConfig && window.DuvelaWebConfig.eventGoingCounts) eventCounts = await window.DuvelaWebConfig.eventGoingCounts(supa, ids) || {};
        } catch (_) { /* Membership is optional for discovery, and no state is invented. */ }
        membershipLoaded = true;
        loadingMembership = false;
        renderEvents();
      }
      async function openEventDetail(id) {
        var item = allowedEvents().find(function (entry) { return String(entry.id) === String(id); });
        if (!item) return;
        $('#eventOverlayTitle').textContent = tr('Event details', 'Детали события');
        var overlay = $('#eventOverlay'), body = $('#eventOverlayBody');
        overlay.classList.add('open'); overlay.setAttribute('aria-hidden', 'false');
        body.innerHTML = '<div class="edd-page"><div class="edd-cover">' + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<div class="ed-cover-fallback"><span>DUVELA</span><b>' + icon('calendar') + '</b></div>') + '</div><div class="edd-copy"><div class="ed-tags"><span>' + esc(formatName(item, tr)) + '</span><span>' + esc(statusLabel(item)) + '</span></div><h1>' + esc(item.title) + '</h1><p>' + esc(item.description || tr('Details will be shared by the organizer.', 'Детали сообщит организатор.')) + '</p><dl><div>' + icon('calendar') + '<span><b>' + esc(tr('When', 'Когда')) + '</b>' + esc(dateText(item)) + '</span></div><div>' + icon('pin') + '<span><b>' + esc(tr('Where', 'Где')) + '</b>' + esc(item.is_online ? tr('Online — join from anywhere', 'Онлайн — подключайтесь откуда угодно') : [item.city, item.country].filter(Boolean).join(', ') || tr('Location to be announced', 'Место уточняется')) + '</span></div><div>' + icon('users') + '<span><b>' + esc(tr('Attendance', 'Участие')) + '</b><em data-edd-count>' + esc(item.max_participants ? tr('Capacity: ', 'Всего мест: ') + item.max_participants : tr('Registration is open', 'Регистрация открыта')) + '</em></span></div></dl><footer><strong>' + esc(priceText(item)) + '</strong><button class="edd-join" data-edd-rsvp="' + esc(item.id) + '" ' + (stateOf(item) !== 'upcoming' || !isPublished(item) ? 'disabled' : '') + '>' + esc(myRsvps[item.id] ? tr('Cancel registration', 'Отменить участие') : tr('Register for event', 'Записаться')) + ' ' + icon('arrow') + '</button></footer></div></div>';
        try {
          var results = await Promise.all([window.DuvelaWebConfig.eventCount(supa, item.id), item.organizer_id ? window.DuvelaWebConfig.publicProfiles(supa, 'id,full_name').eq('id', item.organizer_id).maybeSingle() : Promise.resolve({ data: null })]);
          var countResult = results[0], organizer = results[1] && results[1].data; eventCounts[item.id] = Number(countResult.count || 0);
          var countNode = body.querySelector('[data-edd-count]'); if (countNode) countNode.textContent = item.max_participants ? eventCounts[item.id] + ' / ' + item.max_participants + ' · ' + tr('registered', 'записались') : eventCounts[item.id] + ' ' + tr('registered', 'записались');
          if (organizer && organizer.full_name) body.querySelector('.edd-copy').insertAdjacentHTML('beforeend', '<p class="edd-organizer">' + esc(tr('Organized by ', 'Организатор: ') + organizer.full_name) + '</p>');
        } catch (_) { /* Detail remains truthful without optional metadata. */ }
        var join = body.querySelector('[data-edd-rsvp]');
        if (join) join.onclick = async function () { await base.toggleRsvp(item.id); await loadMembership(); openEventDetail(item.id); };
      }
      return Object.assign({}, base, { renderEvents: renderEvents, openEventDetail: openEventDetail });
    };
    window.DuvelaAppCatalog.__events5 = true;
  }
  install();
})();
