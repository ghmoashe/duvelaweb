(function () {
  function createSearchFeature(ctx) {
    const { $, tr, esc, supa, state, avatarInner } = ctx;
    let searchTimer = null;
    let lastSearch = { courses: [], events: [], practices: [] };

    function openSearch() {
      $('#globalSearch').value = '';
      $('#searchResults').innerHTML = '<div class="empty">' + esc(tr('Type to search across Duvela.', 'Введите запрос для поиска по Duvela.')) + '</div>';
      $('#searchOverlay').classList.add('open');
      setTimeout(() => $('#globalSearch').focus(), 50);
    }

    async function runGlobalSearch(value) {
      const box = $('#searchResults');
      const query = value.trim();
      if (query.length < 2) {
        box.innerHTML = '<div class="empty">' + esc(tr('Type at least 2 characters.', 'Введите минимум 2 символа.')) + '</div>';
        return;
      }
      const like = '%' + query.replace(/[%,()]/g, '') + '%';
      try {
        const [peopleResult, coursesResult, eventsResult, practicesResult] = await Promise.all([
          supa.from('profiles').select('id,full_name,avatar_url,city').ilike('full_name', like).neq('id', ctx.user.id).limit(6),
          supa.from('courses').select('id,title,description,cover_image_url,level,price,currency,schedule,status').eq('status', 'active').ilike('title', like).limit(6),
          supa.from('events').select(ctx.getEventColumns()).ilike('title', like).limit(6),
          supa.from('teacher_practices').select('id,creator_name,target,level,format,title,description,cover_image_url,rating_avg,rating_count,plays_count').eq('status', 'published').ilike('title', like).limit(6)
        ]);
        const people = peopleResult.data || [];
        const courses = (coursesResult.data || []).map((course) => ({
          id: course.id,
          title: course.title,
          description: course.description || course.schedule || '',
          image: course.cover_image_url,
          level: course.level || '',
          price: course.price,
          currency: course.currency,
          schedule: course.schedule || '',
          is_free: course.price == null || Number(course.price) === 0
        }));
        const events = (eventsResult.data || []).map(ctx.mapEventRow);
        const practices = practicesResult.data || [];
        lastSearch = { courses, events, practices };
        function section(title, rows) {
          return rows.length ? '<h3 style="margin:12px 0 4px;font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:1px">' + esc(title) + '</h3>' + rows.join('') : '';
        }
        const html =
          section(tr('People', 'Люди'), people.map((person) => '<div class="conv" data-search-kind="person" data-search-id="' + esc(person.id) + '"><div class="avatar">' + avatarInner(person.full_name, person.avatar_url) + '</div><div><h3>' + esc(person.full_name || 'Duvela') + '</h3><p>' + esc(person.city || '') + '</p></div><div>💬</div></div>')) +
          section(tr('Courses', 'Курсы'), courses.map((course) => '<div class="conv" data-search-kind="course" data-search-id="' + esc(course.id) + '"><div class="avatar">' + esc((course.title || 'C').charAt(0)) + '</div><div><h3>' + esc(course.title) + '</h3><p>' + esc(course.level || tr('Course', 'Курс')) + '</p></div><div>›</div></div>')) +
          section(tr('Events', 'События'), events.map((item) => '<div class="conv" data-search-kind="event" data-search-id="' + esc(item.id) + '"><div class="avatar">' + esc((item.title || 'E').charAt(0)) + '</div><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.meta || '') + '</p></div><div>›</div></div>')) +
          section(tr('Practices', 'Практики'), practices.map((practice) => '<div class="conv" data-search-kind="practice" data-search-id="' + esc(practice.id) + '"><div class="avatar">' + esc((practice.title || 'P').charAt(0)) + '</div><div><h3>' + esc(practice.title) + '</h3><p>' + esc([practice.target, practice.level].filter(Boolean).join(' · ')) + '</p></div><div>›</div></div>'));
        box.innerHTML = html || '<div class="empty">' + esc(tr('Nothing found.', 'Ничего не найдено.')) + '</div>';
      } catch (error) {
        box.innerHTML = '<div class="empty">' + esc(tr('Search is unavailable right now.', 'Поиск сейчас недоступен.')) + '</div>';
      }
    }

    function openSearchItem(kind, id) {
      $('#searchOverlay').classList.remove('open');
      if (kind === 'person') {
        ctx.startChatWith(id);
        return;
      }
      if (kind === 'course') {
        if (!state.courses.find((item) => item.id === id)) {
          const item = lastSearch.courses.find((entry) => entry.id === id);
          if (item) state.courses.push(item);
        }
        ctx.openCourseDetail(id);
        return;
      }
      if (kind === 'event') {
        if (!state.events.find((item) => item.id === id)) {
          const item = lastSearch.events.find((entry) => entry.id === id);
          if (item) state.events.push(item);
        }
        ctx.openEventDetail(id);
        return;
      }
      if (kind === 'practice') {
        if (!state.practices.find((item) => item.id === id)) {
          const item = lastSearch.practices.find((entry) => entry.id === id);
          if (item) state.practices.push(item);
        }
        ctx.openPractice(id);
      }
    }

    function bindEvents() {
      $('#searchBtn').addEventListener('click', openSearch);
      $('#searchClose').addEventListener('click', () => $('#searchOverlay').classList.remove('open'));
      $('#searchOverlay').addEventListener('click', (event) => {
        if (event.target === $('#searchOverlay')) $('#searchOverlay').classList.remove('open');
      });
      $('#globalSearch').addEventListener('input', (event) => {
        clearTimeout(searchTimer);
        const value = event.target.value;
        searchTimer = setTimeout(() => runGlobalSearch(value), 280);
      });
      $('#searchResults').addEventListener('click', (event) => {
        const item = event.target.closest('[data-search-kind]');
        if (item) openSearchItem(item.dataset.searchKind, item.dataset.searchId);
      });
    }

    return {
      bindEvents,
      openSearch
    };
  }

  window.DuvelaAppSearch = { create: createSearchFeature };
})();
