(function () {
  // Business "Media" studio — web mirror of the mobile Bus media screen
  // (app/(business)/media.tsx): Videos / Shorts / Photos tabs. Videos = paste a
  // YouTube link + pick a level + Add; Shorts/Photos = upload own files. Lists the
  // teacher's own posts with delete, matching the app. Learners keep the browse feed.
  function createMediaStudio(ctx) {
    const { tr, esc, supa } = ctx;
    const LEVELS = ['A1-A2', 'A2-B1', 'B1-B2', 'B2-C1', 'C1-C2'];
    let activeTab = 'videos';
    let ytLevel = null;
    let ytValue = '';
    let notice = '';
    let busy = false;
    let posts = null;
    let loadedFor = null;

    function parseYouTubeId(url) {
      if (!url) return '';
      const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
      return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : '');
    }

    async function safe(p) {
      try { const r = await p; return (r && r.error) ? { data: [] } : r; } catch (e) { return { data: [] }; }
    }

    async function loadPosts(uid) {
      const r = await safe(supa.from('posts')
        .select('id,media_url,media_type,caption,cover_url,mux_playback_id,mux_thumbnail_url,language_level,shorts_hidden,shorts_deleted_at,created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(100));
      posts = ((r && r.data) || []).filter(function (p) { return !p.shorts_deleted_at; });
    }

    // Map a stored post to the shape the shared player (ctx.openVideoItem) expects.
    function toPlayerItem(p) {
      const thumb = p.mux_thumbnail_url || p.cover_url ||
        (p.mux_playback_id ? 'https://image.mux.com/' + p.mux_playback_id + '/thumbnail.jpg?width=640' : (p.media_type === 'image' ? p.media_url : null));
      return {
        id: p.id, title: p.caption || '', level: p.language_level || '',
        media_type: p.media_type, media_url: p.media_url,
        playback_id: p.mux_playback_id || null, caption: p.caption || null, image: thumb
      };
    }

    const IC = {
      yt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.9-.5-5.8a3 3 0 00-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 001.5 6.2 62 62 0 001 12c0 3.9.5 5.8.5 5.8a3 3 0 002.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8zM10 15.5v-7l6 3.5z"/></svg>',
      play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/></svg>',
      photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>'
    };
    const TABS = [
      { id: 'videos', label: tr('Videos', 'Видео'), icon: IC.yt },
      { id: 'shorts', label: tr('Shorts', 'Shorts'), icon: IC.play },
      { id: 'photos', label: tr('Photos', 'Фото'), icon: IC.photo }
    ];

    function tabBar() {
      return '<div class="ms-tabs">' + TABS.map(function (t) {
        return '<button type="button" class="ms-tab' + (t.id === activeTab ? ' active' : '') + '" data-ms-tab="' + t.id + '">' +
          '<span class="ms-tab-ic">' + t.icon + '</span><span>' + esc(t.label) + '</span></button>';
      }).join('') + '</div>';
    }

    function ytComposer() {
      return '<div class="ms-composer">' +
        '<div class="ms-input-row">' +
          '<span class="ms-yt-badge">' + IC.yt + '</span>' +
          '<input id="msYtInput" class="ms-input" type="text" placeholder="' + esc(tr('Paste YouTube link…', 'Вставьте ссылку YouTube…')) + '" value="' + esc(ytValue) + '">' +
        '</div>' +
        '<div class="ms-level-label">' + esc(tr('Level for this video', 'Уровень для видео')) + '</div>' +
        '<div class="ms-levels">' + LEVELS.map(function (l) {
          return '<button type="button" class="ms-level' + (ytLevel === l ? ' active' : '') + '" data-ms-level="' + l + '">' + esc(l) + '</button>';
        }).join('') + '</div>' +
        (notice ? '<div class="ms-notice">' + esc(notice) + '</div>' : '') +
        '<button type="button" id="msAddVideo" class="ms-add-btn"' + (busy ? ' disabled' : '') + '>' + IC.yt +
        '<span>' + esc(busy ? tr('Saving…', 'Сохранение…') : tr('Add Video', 'Добавить видео')) + '</span></button>' +
        '</div>';
    }

    function grid(items, kind) {
      return '<div class="ms-grid">' + items.map(function (p) {
        var thumb;
        if (kind === 'videos') thumb = '<img src="https://img.youtube.com/vi/' + esc(p.media_url) + '/mqdefault.jpg" alt="">';
        else if (kind === 'photos') thumb = p.media_url ? '<img src="' + esc(p.media_url) + '" alt="">' : '';
        else {
          var t = p.mux_thumbnail_url || p.cover_url || (p.mux_playback_id ? 'https://image.mux.com/' + p.mux_playback_id + '/thumbnail.jpg?width=640' : '');
          thumb = t ? '<img src="' + esc(t) + '" alt="">' : '<span class="ms-thumb-ph">' + IC.play + '</span>';
        }
        return '<div class="ms-item">' +
          '<div class="ms-thumb" data-ms-play="' + esc(p.id) + '">' + thumb +
            (kind !== 'photos' ? '<span class="ms-thumb-play">' + IC.play + '</span>' : '') +
            (p.language_level ? '<span class="ms-thumb-lvl">' + esc(p.language_level) + '</span>' : '') +
          '</div>' +
          '<button type="button" class="ms-del" data-ms-del="' + esc(p.id) + '" aria-label="' + esc(tr('Delete', 'Удалить')) + '">' + IC.trash + '</button>' +
          '</div>';
      }).join('') + '</div>';
    }

    function emptyCard(icon, title, text) {
      return '<div class="ms-empty"><span class="ms-empty-ic">' + icon + '</span>' +
        '<b>' + esc(title) + '</b><p>' + esc(text) + '</p></div>';
    }

    function uploadCard(kind) {
      var isPhoto = kind === 'photos';
      return '<button type="button" class="ms-upload" data-ms-upload="' + kind + '"' + (busy ? ' disabled' : '') + '>' +
        (isPhoto ? IC.photo : IC.play) +
        '<span>' + esc(busy ? tr('Uploading…', 'Загрузка…') : (isPhoto ? tr('Add photo', 'Добавить фото') : tr('Upload video', 'Загрузить видео'))) + '</span>' +
        '</button>';
    }

    function body() {
      if (!posts) return '<div class="ms-loading">' + esc(tr('Loading…', 'Загрузка…')) + '</div>';
      if (activeTab === 'videos') {
        var yt = posts.filter(function (p) { return p.media_type === 'youtube'; });
        return ytComposer() + (yt.length
          ? grid(yt, 'videos')
          : emptyCard(IC.yt, tr('No YouTube videos yet', 'Пока нет видео YouTube'), tr('Paste a YouTube link above to add it to your profile.', 'Вставьте ссылку YouTube выше, чтобы добавить видео в профиль.')));
      }
      if (activeTab === 'shorts') {
        var sh = posts.filter(function (p) { return p.media_type === 'video'; });
        return uploadCard('shorts') + (notice ? '<div class="ms-notice">' + esc(notice) + '</div>' : '') + (sh.length
          ? grid(sh, 'shorts')
          : emptyCard(IC.play, tr('No shorts yet', 'Пока нет Shorts'), tr('Upload a short video to show on your profile.', 'Загрузите короткое видео для профиля.')));
      }
      var ph = posts.filter(function (p) { return p.media_type === 'image'; });
      return uploadCard('photos') + (notice ? '<div class="ms-notice">' + esc(notice) + '</div>' : '') + (ph.length
        ? grid(ph, 'photos')
        : emptyCard(IC.photo, tr('No photos yet', 'Пока нет фото'), tr('Add photos to build your gallery.', 'Добавьте фото, чтобы собрать галерею.')));
    }

    function paint() {
      const host = document.getElementById('mediaStudio');
      if (!host) return;
      host.innerHTML = tabBar() + body();
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

    async function uploadFile(file, kind) {
      busy = true; notice = ''; paint();
      try {
        const url = await ctx.uploadToBucket('posts', file);
        const payload = {
          user_id: ctx.user.id, media_url: url,
          media_type: kind === 'photos' ? 'image' : 'video',
          media_kind: kind === 'shorts' || kind === 'photos' ? 'short' : 'video',
          shorts_visibility: 'public', caption: null
        };
        let r = await supa.from('posts').insert(payload);
        if (r.error && /media_kind/i.test(r.error.message || '')) {
          delete payload.media_kind;
          r = await supa.from('posts').insert(payload);
        }
        if (r.error) throw r.error;
        await loadPosts(ctx.user.id);
      } catch (e) {
        notice = (e && e.message) || tr('Upload failed.', 'Не удалось загрузить.');
      } finally {
        busy = false; paint();
      }
    }

    function bind(host) {
      Array.prototype.forEach.call(host.querySelectorAll('[data-ms-tab]'), function (b) {
        b.addEventListener('click', function () { activeTab = b.getAttribute('data-ms-tab'); notice = ''; paint(); });
      });
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

    return { render };
  }

  window.DuvelaBusinessMediaStudio = { create: createMediaStudio };
})();
