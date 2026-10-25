(function () {
  // Business "Media" studio — web mirror of the mobile Bus media screen
  // (app/(business)/media.tsx): Videos / Shorts / Photos tabs. Videos = paste a
  // YouTube link + pick a level + Add; Shorts/Photos = upload own files. Lists the
  // teacher's own posts with delete, matching the app. Learners keep the browse feed.
  function createMediaStudio(ctx) {
    const { tr, esc, supa } = ctx;
    const LEVELS = ['A1-A2', 'A2-B1', 'B1-B2', 'B2-C1', 'C1-C2'];
    let activeTab = 'all';
    let ytLevel = null;
    let ytValue = '';
    let notice = '';
    let busy = false;
    let posts = null;
    let mediaComments = new Map();
    let mediaLikes = new Map();
    let mediaViews = new Map();
    let loadedFor = null;
    let librarySearch = '';
    let libraryLanguage = '';
    let libraryLevel = '';
    let libraryCategory = '';
    let libraryStatus = '';
    let librarySort = 'newest';

    function parseYouTubeId(url) {
      if (!url) return '';
      const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : '');
    }

    async function safe(p) {
      try { const r = await p; return (r && r.error) ? { data: [], error: r.error } : r; } catch (e) { return { data: [], error: e }; }
    }

    async function loadPosts(uid) {
      let r = await safe(supa.from('posts')
        .select('id,media_url,media_type,media_kind,caption,description,language,category,visibility,content_status,cefr_levels,tags,course_id,challenge_id,cover_url,bunny_video_guid,bunny_thumbnail_url,mux_playback_id,mux_thumbnail_url,language_level,duration_seconds,shorts_hidden,shorts_deleted_at,created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(100));
      if (!r || (!r.data && r.error)) r = await safe(supa.from('posts').select('id,media_url,media_type,media_kind,caption,cover_url,bunny_video_guid,bunny_thumbnail_url,mux_playback_id,mux_thumbnail_url,language_level,duration_seconds,shorts_hidden,shorts_deleted_at,created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(100));
      posts = ((r && r.data) || []).filter(function (p) { return !p.shorts_deleted_at; });
      mediaComments = new Map();
      mediaLikes = new Map();
      mediaViews = new Map();
      const ids = posts.map(function (p) { return p.id; }).filter(Boolean);
      if (ids.length) {
        const [comments, likes, views] = await Promise.all([
          safe(supa.from('post_comments').select('post_id,id').in('post_id', ids).limit(1000)),
          safe(supa.from('post_likes').select('post_id,id').in('post_id', ids).limit(5000)),
          safe(supa.from('post_views').select('post_id,id').in('post_id', ids).limit(10000))
        ]);
        ((comments && comments.data) || []).forEach(function (row) {
          mediaComments.set(row.post_id, (mediaComments.get(row.post_id) || 0) + 1);
        });
        ((likes && likes.data) || []).forEach(function (row) {
          mediaLikes.set(row.post_id, (mediaLikes.get(row.post_id) || 0) + 1);
        });
        ((views && views.data) || []).forEach(function (row) {
          mediaViews.set(row.post_id, (mediaViews.get(row.post_id) || 0) + 1);
        });
      }
    }

    // Map a stored post to the shape the shared player (ctx.openVideoItem) expects.
    // Thumbnail priority: bunny_thumbnail_url → cover_url → mux_thumbnail_url →
    // derived from bunny_video_guid → derived from mux_playback_id → image src.
    function toPlayerItem(p) {
      var cdn = window.DuvelaWebConfig && window.DuvelaWebConfig.bunnyCdnHostname;
      var bunnyThumb = p.bunny_thumbnail_url ||
        (p.bunny_video_guid && cdn ? 'https://' + cdn + '/' + p.bunny_video_guid + '/thumbnail.jpg' : null);
      var muxThumb = p.mux_thumbnail_url ||
        (p.mux_playback_id ? 'https://image.mux.com/' + p.mux_playback_id + '/thumbnail.jpg?width=640' : null);
      var thumb = bunnyThumb || p.cover_url || muxThumb || (p.media_type === 'image' ? p.media_url : null);
      return {
        id: p.id, title: p.caption || '', level: p.language_level || '',
        media_type: p.media_type, media_url: p.media_url,
        playback_id: p.mux_playback_id || null,
        bunny_video_guid: p.bunny_video_guid || null,
        caption: p.caption || null, image: thumb
      };
    }

    const IC = {
      yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.9-.5-5.8a3 3 0 00-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 001.5 6.2 62 62 0 001 12c0 3.9.5 5.8.5 5.8a3 3 0 002.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8zM10 15.5v-7l6 3.5z"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/></svg>',
      photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>'
    };
    const TABS = [
      { id: 'all', label: tr('All', 'Все'), icon: IC.play },
      { id: 'videos', label: tr('Videos', 'Видео'), icon: IC.yt },
      { id: 'shorts', label: tr('Shorts', 'Shorts'), icon: IC.play },
      { id: 'photos', label: tr('Photos', 'Фото'), icon: IC.photo },
      { id: 'drafts', label: tr('Drafts', 'Черновики'), icon: IC.photo }
    ];

    function countByTab(tab) {
      var list = posts || [];
      if (tab === 'all') return list.filter(function (p) { return (p.content_status || 'published') === 'published'; }).length;
      if (tab === 'drafts') return list.filter(function (p) { return p.content_status === 'draft'; }).length;
      if (tab === 'videos') return list.filter(function (p) { return p.media_type === 'youtube'; }).length;
      if (tab === 'shorts') return list.filter(function (p) { return p.media_type === 'video' && (p.media_kind === 'short' || p.media_kind === 'shorts'); }).length;
      return list.filter(function (p) { return p.media_type === 'image'; }).length;
    }

    function tabBar() {
      return '<div class="ms-tabs">' + TABS.map(function (t) {
        return '<button type="button" class="ms-tab' + (t.id === activeTab ? ' active' : '') + '" data-ms-tab="' + t.id + '">' +
          '<span class="ms-tab-ic">' + t.icon + '</span><span>' + esc(t.label) + '</span><b>' + countByTab(t.id) + '</b></button>';
      }).join('') + '</div>';
    }

    function filteredLibrary() {
      var list = (posts || []).filter(function (p) {
        var status = p.content_status || 'published';
        if (activeTab === 'videos' && p.media_type !== 'youtube') return false;
        if (activeTab === 'shorts' && p.media_type !== 'video') return false;
        if (activeTab === 'photos' && p.media_type !== 'image') return false;
        if (activeTab === 'drafts' && status !== 'draft') return false;
        if (activeTab === 'all' && status === 'draft') return false;
        if (libraryStatus && status !== libraryStatus) return false;
        if (libraryLanguage && p.language !== libraryLanguage) return false;
        if (libraryLevel && (p.language_level || (p.cefr_levels || [])[0]) !== libraryLevel) return false;
        if (libraryCategory && p.category !== libraryCategory) return false;
        if (librarySearch) {
          var needle = librarySearch.toLowerCase();
          if ((p.caption || '').toLowerCase().indexOf(needle) < 0 && (p.description || '').toLowerCase().indexOf(needle) < 0) return false;
        }
        return true;
      });
      return list.sort(function (a, b) {
        if (librarySort === 'title') return String(a.caption || '').localeCompare(String(b.caption || ''));
        if (librarySort === 'views') return (mediaViews.get(b.id) || 0) - (mediaViews.get(a.id) || 0);
        return String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
    }

    function libraryToolbar() {
      var langs = Array.from(new Set((posts || []).map(function (p) { return p.language; }).filter(Boolean))).sort();
      return '<div class="ms-library-toolbar"><input data-ms-search type="search" value="' + esc(librarySearch) + '" placeholder="' + esc(tr('Search content', 'Поиск по контенту')) + '">' +
        '<select data-ms-language><option value="">' + esc(tr('All languages', 'Все языки')) + '</option>' + langs.map(function (l) { return '<option value="' + esc(l) + '"' + (libraryLanguage === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>' +
        '<select data-ms-filter-level><option value="">' + esc(tr('All levels', 'Все уровни')) + '</option>' + ['A1','A2','B1','B2','C1','C2'].map(function (l) { return '<option value="' + l + '"' + (libraryLevel === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>' +
        '<select data-ms-category><option value="">' + esc(tr('All categories', 'Все категории')) + '</option>' + ['Vocabulary','Grammar','Speaking','Listening','Reading','Writing','Exam Preparation','Everyday Conversations','Culture','Other'].map(function (c) { return '<option value="' + esc(c) + '"' + (libraryCategory === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<select data-ms-status><option value="">' + esc(tr('All statuses', 'Все статусы')) + '</option><option value="published"' + (libraryStatus === 'published' ? ' selected' : '') + '>' + esc(tr('Published', 'Опубликовано')) + '</option><option value="draft"' + (libraryStatus === 'draft' ? ' selected' : '') + '>' + esc(tr('Draft', 'Черновик')) + '</option><option value="processing"' + (libraryStatus === 'processing' ? ' selected' : '') + '>' + esc(tr('Processing', 'Обработка')) + '</option></select>' +
        '<select data-ms-sort><option value="newest"' + (librarySort === 'newest' ? ' selected' : '') + '>' + esc(tr('Newest first', 'Сначала новые')) + '</option><option value="title"' + (librarySort === 'title' ? ' selected' : '') + '>' + esc(tr('Title', 'По названию')) + '</option><option value="views"' + (librarySort === 'views' ? ' selected' : '') + '>' + esc(tr('Most viewed', 'По просмотрам')) + '</option></select></div>';
    }

    function analytics() {
      var total = (posts || []).filter(function (p) { return (p.content_status || 'published') === 'published'; }).length;
      var videos = countByTab('videos');
      var shorts = countByTab('shorts');
      var comments = Array.from(mediaComments.values()).reduce(function (sum, value) { return sum + value; }, 0);
      var likes = Array.from(mediaLikes.values()).reduce(function (sum, value) { return sum + value; }, 0);
      var views = Array.from(mediaViews.values()).reduce(function (sum, value) { return sum + value; }, 0);
      return '<section class="ms-analytics-pro"><div class="ms-card-head"><h2>' + esc(tr('Media analytics', '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430 \u043c\u0435\u0434\u0438\u0430')) + '</h2><select aria-label="Period"><option>' + esc(tr('Last 30 days', '\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 30 \u0434\u043d\u0435\u0439')) + '</option></select></div>' +
        '<div class="ms-analytics-grid">' +
          '<div class="purple"><span>' + IC.yt + '</span><b>' + esc(fmtCount(views)) + '</b><p>' + esc(tr('Views', '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u044b')) + '</p><small>' + esc(videos + ' ' + tr('videos', '\u0432\u0438\u0434\u0435\u043e')) + '</small></div>' +
          '<div class="pink"><span>' + IC.play + '</span><b>' + esc(String(shorts)) + '</b><p>' + esc(tr('Shorts', 'Shorts')) + '</p><small>' + esc(tr('real data', '\u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435')) + '</small></div>' +
          '<div class="blue"><span>&#9825;</span><b>' + esc(fmtCount(likes)) + '</b><p>' + esc(tr('Likes', '\u041b\u0430\u0439\u043a\u0438')) + '</p><small>' + esc(tr('real data', '\u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435')) + '</small></div>' +
          '<div class="teal"><span>' + IC.photo + '</span><b>' + esc(String(total)) + '</b><p>' + esc(tr('Published media', '\u041f\u0443\u0431\u043b\u0438\u043a\u0430\u0446\u0438\u0438')) + '</p><small>' + esc(comments + ' ' + tr('comments', '\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432')) + '</small></div>' +
        '</div></section>';
    }
    function ytComposer() {
      return '<div class="ms-composer ms-composer-pro">' +
        '<div class="ms-compose-head"><span class="ms-yt-badge">' + IC.yt + '</span><div><b>' + esc(tr('Add new video', '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0432\u0438\u0434\u0435\u043e')) + '</b><p>' + esc(tr('Paste a YouTube link or upload your video and set the details.', '\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 YouTube \u0441\u0441\u044b\u043b\u043a\u0443 \u0438\u043b\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0432\u0438\u0434\u0435\u043e \u0438 \u0437\u0430\u0434\u0430\u0439\u0442\u0435 \u0434\u0435\u0442\u0430\u043b\u0438.')) + '</p></div><button type="button" class="ms-upload-mini" data-ms-upload="shorts">&#8679; ' + esc(tr('Upload file', '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0444\u0430\u0439\u043b')) + '</button></div>' +
        '<div class="ms-input-row"><input id="msYtInput" class="ms-input" type="text" placeholder="' + esc(tr('Paste YouTube link here...', '\u0412\u0441\u0442\u0430\u0432\u044c\u0442\u0435 YouTube \u0441\u0441\u044b\u043b\u043a\u0443...')) + '" value="' + esc(ytValue) + '"></div>' +
        '<div class="ms-compose-grid"><div><div class="ms-level-label">' + esc(tr('Level', '\u0423\u0440\u043e\u0432\u0435\u043d\u044c')) + '</div><div class="ms-levels">' + LEVELS.map(function (l) {
          return '<button type="button" class="ms-level' + (ytLevel === l ? ' active' : '') + '" data-ms-level="' + l + '">' + esc(l) + '</button>';
        }).join('') + '</div></div><label><span>' + esc(tr('Language', '\u042f\u0437\u044b\u043a')) + '</span><select><option>German</option><option>English</option></select></label><label><span>' + esc(tr('Category', '\u041a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u044f')) + '</span><select><option>Vocabulary</option><option>Grammar</option><option>Conversation</option></select></label>' +
        '<button type="button" id="msAddVideo" class="ms-add-btn"' + (busy ? ' disabled' : '') + '>&#9992; <span>' + esc(busy ? tr('Saving...', '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...') : tr('Publish video', '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u0442\u044c')) + '</span></button></div>' +
        (notice ? '<div class="ms-notice">' + esc(notice) + '</div>' : '') + (uploadProgress !== null ? renderProgressBar(uploadProgress) : '') +
        '</div>';
    }
    function fmtDuration(seconds) {
      var value = Math.max(0, Math.floor(Number(seconds) || 0));
      var mins = Math.floor(value / 60);
      var secs = String(value % 60).padStart(2, '0');
      return mins + ':' + secs;
    }

    function fmtCount(value) {
      return Number(value || 0).toLocaleString();
    }

    function thumbFor(p, kind) {
      if (kind === 'videos') return '<img src="https://img.youtube.com/vi/' + esc(p.media_url) + '/mqdefault.jpg" alt="">';
      if (kind === 'photos') return p.media_url ? '<img src="' + esc(p.media_url) + '" alt="">' : '';
      var cdn = window.DuvelaWebConfig && window.DuvelaWebConfig.bunnyCdnHostname;
      var t = p.bunny_thumbnail_url || (p.bunny_video_guid && cdn ? 'https://' + cdn + '/' + p.bunny_video_guid + '/thumbnail.jpg' : '') || p.cover_url || p.mux_thumbnail_url || (p.mux_playback_id ? 'https://image.mux.com/' + p.mux_playback_id + '/thumbnail.jpg?width=640' : '');
      return t ? '<img src="' + esc(t) + '" alt="">' : '<span class="ms-thumb-ph">' + IC.play + '</span>';
    }

    function grid(items, kind) {
      return '<div class="ms-grid ms-grid-pro">' + items.map(function (p) {
        var cardKind = p.media_type === 'youtube' ? 'videos' : p.media_type === 'image' ? 'photos' : 'shorts';
        var title = p.caption || (cardKind === 'videos' ? tr('Learning video', '\u0423\u0447\u0435\u0431\u043d\u043e\u0435 \u0432\u0438\u0434\u0435\u043e') : cardKind === 'shorts' ? tr('Short video', '\u041a\u043e\u0440\u043e\u0442\u043a\u043e\u0435 \u0432\u0438\u0434\u0435\u043e') : tr('Teacher photo', '\u0424\u043e\u0442\u043e \u0443\u0447\u0438\u0442\u0435\u043b\u044f'));
        var comments = mediaComments.get(p.id) || 0;
        var likes = mediaLikes.get(p.id) || 0;
        var views = mediaViews.get(p.id) || 0;
        var duration = p.duration_seconds ? fmtDuration(p.duration_seconds) : (cardKind === 'photos' ? 'Photo' : '&mdash;');
        var status = p.content_status || 'published';
        return '<article class="ms-item ms-item-pro">' +
          '<div class="ms-thumb" data-ms-play="' + esc(p.id) + '">' + thumbFor(p, cardKind) +
            (cardKind !== 'photos' ? '<span class="ms-thumb-play">' + IC.play + '</span>' : '') +
            '<span class="ms-duration">' + duration + '</span></div>' +
          '<div class="ms-item-body"><div class="ms-item-tags"><span class="' + (status === 'published' ? 'ok' : '') + '">' + esc(status === 'draft' ? tr('Draft', '\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a') : status === 'processing' ? tr('Processing', '\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0430') : tr('Published', '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043e')) + '</span>' + (p.language_level ? '<span>' + esc(p.language_level) + '</span>' : '') + '<span>' + esc(p.language || tr('German', '\u041d\u0435\u043c\u0435\u0446\u043a\u0438\u0439')) + '</span></div>' +
            '<h3>' + esc(title) + '</h3><div class="ms-item-stats"><span>&#9673; ' + esc(fmtCount(views)) + '</span><span>&#9825; ' + esc(fmtCount(likes)) + '</span><span>&#9634; ' + esc(fmtCount(comments)) + '</span></div></div>' +
          '<div class="ms-item-actions"><button type="button" data-ms-edit="' + esc(p.id) + '">' + esc(tr('Edit', '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c')) + '</button><button type="button">' + esc(tr('Analytics', '\u0410\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430')) + '</button><button type="button">' + esc(tr('Share', '\u041f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f')) + '</button><button type="button" class="danger" data-ms-del="' + esc(p.id) + '">' + IC.trash + '</button></div>' +
          '</article>';
      }).join('') + '</div>';
    }
    function emptyCard(icon, title, text) {
      return '<div class="ms-empty"><span class="ms-empty-ic">' + icon + '</span>' +
        '<b>' + esc(title) + '</b><p>' + esc(text) + '</p></div>';
    }

    function uploadCard(kind) {
      var isPhoto = kind === 'photos';
      return '<button type="button" class="ms-upload ms-upload-pro" data-ms-upload="' + kind + '"' + (busy ? ' disabled' : '') + '>' +
        (isPhoto ? IC.photo : IC.play) +
        '<span>' + esc(busy ? tr('Uploading...', '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...') : (isPhoto ? tr('Add photo', '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0444\u043e\u0442\u043e') : tr('Upload video', '\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0432\u0438\u0434\u0435\u043e'))) + '</span>' +
        '</button>';
    }
    function sectionHead(title, text, placeholder) {
      return '<div class="ms-section-head"><div><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p></div><input placeholder="' + esc(placeholder) + '"></div>';
    }

    function body() {
      if (!posts) return '<div class="ms-loading">' + esc(tr('Loading...', 'Загрузка...')) + '</div>';
      var items = filteredLibrary();
      if (!items.length) {
        var hasFilters = librarySearch || libraryLanguage || libraryLevel || libraryCategory || libraryStatus || activeTab !== 'all';
        return libraryToolbar() + emptyCard(IC.photo, hasFilters ? tr('No content matches these filters.', 'По этим фильтрам ничего не найдено.') : tr('Your content library is empty.', 'Ваша библиотека контента пуста.'), hasFilters ? tr('Try changing the search or filters.', 'Измените поиск или фильтры.') : tr('Upload your first lesson, create a Short or share an educational photo.', 'Загрузите первый урок, создайте Short или поделитесь учебным фото.')) + '<button type="button" class="ms-empty-cta" data-ms-create>' + esc(tr('Create Content', 'Создать контент')) + '</button>';
      }
      var kind = activeTab === 'videos' ? 'videos' : activeTab === 'photos' ? 'photos' : 'shorts';
      return libraryToolbar() + '<div class="ms-library-meta"><div><h2>' + esc(tr('Content library', 'Библиотека контента')) + '</h2><p>' + esc(tr('Manage lessons, Shorts and photos from one place.', 'Управляйте уроками, Shorts и фото в одном месте.')) + '</p></div><span>' + esc(String(items.length)) + ' ' + esc(tr('items', 'материалов')) + '</span></div>' + grid(items, kind);
    }    function sidePanel() {
      var top = (posts || []).slice(0, 3);
      return '<aside class="ms-side"><section class="ms-side-card"><div class="ms-side-head"><h3>' + esc(tr('Recent media', '\u041d\u0435\u0434\u0430\u0432\u043d\u0438\u0435 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b')) + '</h3><a>' + esc(tr('View all', '\u0412\u0441\u0435')) + ' &rarr;</a></div>' +
        (top.length ? top.map(function (p, i) {
          var item = toPlayerItem(p);
          return '<div class="ms-top-item"><b>' + (i + 1) + '</b>' + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : '<span>' + IC.play + '</span>') + '<div><strong>' + esc(p.caption || tr('Learning media', '\u0423\u0447\u0435\u0431\u043d\u044b\u0439 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b')) + '</strong><small>' + esc((mediaComments.get(p.id) || 0) + ' ' + tr('comments', '\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0435\u0432')) + '</small></div></div>';
        }).join('') : '<div class="ms-side-empty">' + esc(tr('Publish media to see leaders.', '\u041e\u043f\u0443\u0431\u043b\u0438\u043a\u0443\u0439\u0442\u0435 \u043c\u0435\u0434\u0438\u0430, \u0447\u0442\u043e\u0431\u044b \u0443\u0432\u0438\u0434\u0435\u0442\u044c \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u044b.')) + '</div>') + '</section>' +
        '<section class="ms-side-card"><div class="ms-side-head"><h3>' + esc(tr('Media goals', '\u0426\u0435\u043b\u0438 \u043c\u0435\u0434\u0438\u0430')) + '</h3><a>' + esc(tr('This month', '\u042d\u0442\u043e\u0442 \u043c\u0435\u0441\u044f\u0446')) + '</a></div><div class="ms-goal"><div><b>&mdash;</b><span>' + esc(tr('goal not set', '\u0446\u0435\u043b\u044c \u043d\u0435 \u0437\u0430\u0434\u0430\u043d\u0430')) + '</span></div><strong>' + esc(tr('Create a monthly target to track progress.', '\u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u0446\u0435\u043b\u044c \u043d\u0430 \u043c\u0435\u0441\u044f\u0446, \u0447\u0442\u043e\u0431\u044b \u0432\u0438\u0434\u0435\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0435\u0441\u0441.')) + '</strong><em><i style="width:0%"></i></em></div></section>' +
        '<section class="ms-side-card"><div class="ms-side-head"><h3>' + esc(tr('Tips for better videos', '\u0421\u043e\u0432\u0435\u0442\u044b \u0434\u043b\u044f \u0432\u0438\u0434\u0435\u043e')) + '</h3><a>' + esc(tr('View all', '\u0412\u0441\u0435')) + ' &rarr;</a></div>' +
        [
          tr('Use clear titles and thumbnails.', '\u0414\u0435\u043b\u0430\u0439\u0442\u0435 \u043f\u043e\u043d\u044f\u0442\u043d\u044b\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044f \u0438 \u043e\u0431\u043b\u043e\u0436\u043a\u0438.'),
          tr('Keep it short and focused.', '\u0414\u0435\u0440\u0436\u0438\u0442\u0435 \u0432\u0438\u0434\u0435\u043e \u043a\u043e\u0440\u043e\u0442\u043a\u0438\u043c \u0438 \u0442\u043e\u0447\u043d\u044b\u043c.'),
          tr('Add levels and categories.', '\u0414\u043e\u0431\u0430\u0432\u043b\u044f\u0439\u0442\u0435 \u0443\u0440\u043e\u0432\u043d\u0438 \u0438 \u043a\u0430\u0442\u0435\u0433\u043e\u0440\u0438\u0438.'),
          tr('Be consistent.', '\u041f\u0443\u0431\u043b\u0438\u043a\u0443\u0439\u0442\u0435 \u0440\u0435\u0433\u0443\u043b\u044f\u0440\u043d\u043e.')
        ].map(function (t, i) { return '<div class="ms-tip"><span>' + [IC.photo, '&#9719;', '&#9670;', IC.play][i] + '</span><b>' + esc(t) + '</b></div>'; }).join('') + '</section></aside>';
    }
    function paint() {
      const host = document.getElementById('mediaStudio');
      if (!host) return;
      host.innerHTML = '<div class="ms-studio-head"><div><span>DUVELA / CREATOR STUDIO</span><h1>' + esc(tr('Create and publish learning media', 'Создавайте и публикуйте учебный контент')) + '</h1><p>' + esc(tr('Build videos, Shorts and photos in one guided workflow.', 'Создавайте видео, Shorts и фото в одном рабочем процессе.')) + '</p></div><div><button type="button" class="ms-create-content" data-ms-create>+ ' + esc(tr('Create content', 'Создать контент')) + '</button>' + (ctx.contentWizard && ctx.contentWizard.hasDraft() ? '<button type="button" class="ms-resume-content" data-ms-resume>' + esc(tr('Resume draft', 'Продолжить черновик')) + '</button>' : '') + '</div></div><div class="ms-shell"><main class="ms-main">' + analytics() + tabBar() + body() + '</main>' + sidePanel() + '</div>';
      bind(host);
    }

    async function addYoutube() {
      const id = parseYouTubeId(ytValue);
      if (!id) { notice = tr('Enter a valid YouTube link.', 'Введите корректную ссылку YouTube.'); paint(); return; }
      if (!ytLevel) { notice = tr('Choose a level for this video.', 'Выберите уровень для видео.'); paint(); return; }
      notice = ''; busy = true; paint();
      const r = await safe(supa.from('posts').insert({
        user_id: ctx.user.id, media_type: 'youtube', media_url: id,
        media_kind: 'video', language_level: ytLevel, shorts_visibility: 'public', caption: null
      }));
      busy = false;
      if (r && r.error) { notice = tr('Could not save the video.', 'Не удалось сохранить видео.'); paint(); return; }
      void supa.functions.invoke('notify-new-post', { body: { postTitle: null, teacherId: ctx.user.id } }).catch(function () {});
      ytValue = ''; ytLevel = null;
      await loadPosts(ctx.user.id); paint();
    }

    async function removePost(id) {
      if (posts) posts = posts.filter(function (p) { return p.id !== id; });
      paint();
      await safe(supa.from('posts').delete().eq('id', id).eq('user_id', ctx.user.id));
    }

    function pickFile(kind) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = kind === 'photos' ? 'image/*' : 'video/*';
      input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        if (file) void uploadFile(file, kind);
      });
      input.click();
    }

    // Progress fraction for the current upload (video → Bunny only; image
    // uploads go through Supabase Storage in one request and don't emit
    // progress events).
    var uploadProgress = null;

    async function uploadFile(file, kind) {
      busy = true; notice = ''; uploadProgress = null; paint();
      try {
        var payload = {
          user_id: ctx.user.id,
          media_type: kind === 'photos' ? 'image' : 'video',
          media_kind: kind === 'shorts' || kind === 'photos' ? 'short' : 'video',
          shorts_visibility: 'public', caption: null,
        };

        if (kind === 'photos') {
          // Images stay on Supabase Storage.
          payload.media_url = await ctx.uploadToBucket('posts', file);
        } else {
          // Videos go straight to Bunny Stream via the shared uploader —
          // AccessKey never touches the browser bundle; the edge function
          // hands it back for this one upload only.
          if (!window.DuvelaBunnyUpload) {
            throw new Error('Bunny uploader not loaded');
          }
          var result = await window.DuvelaBunnyUpload.uploadShortToBunny(supa, file, {
            title: file.name || 'Duvela short',
            onProgress: function (fraction) {
              uploadProgress = fraction;
              // Repaint at most every ~5% to avoid thrashing the DOM.
              if (Math.round(fraction * 20) !== Math.round((uploadProgress || 0) * 20)) paint();
            },
          });
          payload.media_url = result.playbackUrl;
          payload.bunny_video_guid = result.videoGuid;
          payload.bunny_thumbnail_url = result.thumbnailUrl;
          payload.cover_url = result.thumbnailUrl;
        }

        var r = await supa.from('posts').insert(payload);
        if (r.error && /media_kind/i.test(r.error.message || '')) {
          delete payload.media_kind;
          r = await supa.from('posts').insert(payload);
        }
        // Older DBs may not yet have the bunny_* columns — drop them and retry.
        if (r.error && /bunny_video_guid|bunny_thumbnail_url/i.test(r.error.message || '')) {
          delete payload.bunny_video_guid;
          delete payload.bunny_thumbnail_url;
          r = await supa.from('posts').insert(payload);
        }
        if (r.error) throw r.error;
        void supa.functions.invoke('notify-new-post', { body: { postTitle: payload.caption, teacherId: ctx.user.id } }).catch(function () {});
        await loadPosts(ctx.user.id);
      } catch (e) {
        notice = (e && e.message) || tr('Upload failed.', 'Не удалось загрузить.');
      } finally {
        busy = false; uploadProgress = null; paint();
      }
    }

    // Expose progress to the render body so it can show a progress bar.
    function progressFraction() { return uploadProgress; }

    function renderProgressBar(fraction) {
      var pct = Math.max(4, Math.round(fraction * 100));
      return '<div style="margin-top:8px;padding:10px 12px;border-radius:12px;background:#F0ECFF;">' +
        '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#5A2FCB;margin-bottom:6px;">' +
        '<span>' + esc(tr('Uploading video to Bunny…', 'Загрузка видео в Bunny…')) + '</span>' +
        '<span>' + Math.round(fraction * 100) + '%</span>' +
        '</div>' +
        '<div style="height:6px;border-radius:999px;background:rgba(90,47,203,0.18);overflow:hidden;">' +
        '<div style="height:100%;width:' + pct + '%;background:#5A2FCB;border-radius:999px;transition:width 0.15s;"></div>' +
        '</div></div>';
    }

    function bind(host) {
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-tab]'), function (b) {
        b.addEventListener('click', function () { activeTab = b.getAttribute('data-ms-tab'); notice = ''; paint(); });
      });
      var search = host.querySelector('[data-ms-search]');
      if (search) search.addEventListener('input', function () { librarySearch = search.value.trim(); paint(); });
      var language = host.querySelector('[data-ms-language]');
      if (language) language.addEventListener('change', function () { libraryLanguage = language.value; paint(); });
      var levelFilter = host.querySelector('[data-ms-filter-level]');
      if (levelFilter) levelFilter.addEventListener('change', function () { libraryLevel = levelFilter.value; paint(); });
      var category = host.querySelector('[data-ms-category]');
      if (category) category.addEventListener('change', function () { libraryCategory = category.value; paint(); });
      var statusFilter = host.querySelector('[data-ms-status]');
      if (statusFilter) statusFilter.addEventListener('change', function () { libraryStatus = statusFilter.value; paint(); });
      var sort = host.querySelector('[data-ms-sort]');
      if (sort) sort.addEventListener('change', function () { librarySort = sort.value; paint(); });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-level]'), function (b) {
        b.addEventListener('click', function () { ytLevel = b.getAttribute('data-ms-level'); paint(); });
      });
      const input = host.querySelector('#msYtInput');
      if (input) {
        input.addEventListener('input', function () { ytValue = input.value; });
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { ytValue = input.value; void addYoutube(); } });
      }
      const add = host.querySelector('#msAddVideo');
      if (add) add.addEventListener('click', function () { const i = host.querySelector('#msYtInput'); if (i) ytValue = i.value; void addYoutube(); });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-del]'), function (b) {
        b.addEventListener('click', function () { void removePost(b.getAttribute('data-ms-del')); });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-play]'), function (t) {
        t.addEventListener('click', function () {
          const id = t.getAttribute('data-ms-play');
          const post = (posts || []).filter(function (p) { return p.id === id; })[0];
          if (post && ctx.openVideoItem) ctx.openVideoItem(toPlayerItem(post));
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-upload]'), function (b) {
        b.addEventListener('click', function () { pickFile(b.getAttribute('data-ms-upload')); });
      });
      var create = host.querySelector('[data-ms-create]');
      if (create && ctx.contentWizard) create.addEventListener('click', function () { ctx.contentWizard.open(); });
      var resume = host.querySelector('[data-ms-resume]');
      if (resume && ctx.contentWizard) resume.addEventListener('click', function () { ctx.contentWizard.open(); });
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-edit]'), function (b) {
        b.addEventListener('click', function () { var post = (posts || []).filter(function (p) { return String(p.id) === String(b.getAttribute('data-ms-edit')); })[0]; if (ctx.contentWizard && post) ctx.contentWizard.open(post); });
      });
    }

    function render() {
      const uid = ctx.user && ctx.user.id;
      if (!uid) return;
      if (loadedFor !== uid) { posts = null; }
      paint();
      if (loadedFor !== uid) {
        loadedFor = uid;
        loadPosts(uid).then(paint).catch(function () { posts = []; paint(); });
      }
    }

    window.addEventListener('duvela:media-changed', function () {
      if (!ctx.user || !ctx.user.id) return;
      loadPosts(ctx.user.id).then(paint).catch(function () { paint(); });
    });

    return { render };
  }

  window.DuvelaBusinessMediaStudio = { create: createMediaStudio };
})();