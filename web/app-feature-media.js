(function () {
  function createMediaFeature(ctx) {
    const { $, tr, esc, alert, supa, state, runtime, avatarInner } = ctx;
    const SUPPORTED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']);

    function syncUploadAccess() {
      const isLearner = ctx.role === 'learner';
      const uploadButton = $('#uploadVideoBtn');
      const uploadOverlay = $('#uploadOverlay');
      if (uploadButton) {
        uploadButton.style.display = isLearner ? 'none' : '';
        uploadButton.hidden = isLearner;
        uploadButton.disabled = isLearner;
      }
      if (uploadOverlay) {
        uploadOverlay.hidden = isLearner;
        if (isLearner) uploadOverlay.classList.remove('open');
      }
    }

    function renderVideos() {
      const studio = document.getElementById('mediaStudio');
      const browse = document.getElementById('mediaBrowse');
      // Business/creator mode gets the media studio (own Videos/Shorts/Photos); learners keep the browse feed.
      if (ctx.isBusiness() && ctx.mediaStudio) {
        if (studio) studio.hidden = false;
        if (browse) browse.hidden = true;
        ctx.mediaStudio.render();
        return;
      }
      if (studio) studio.hidden = true;
      if (browse) browse.hidden = false;
      syncUploadAccess();
      const items = state.videos.filter((item) => runtime.currentVideoFilter === 'all' || item.type === runtime.currentVideoFilter);
      $('#videoGrid').innerHTML = items.map((item) => {
        const playable = item.id ? ' data-video="' + esc(item.id) + '"' : '';
        const badge = (item.id && item.media_type !== 'image') ? '<div class="play-badge">▶</div>' : '';
        return '<article class="card video-card"' + playable + '>' +
          '<div class="video-thumb">' + badge + (item.image ? '<img src="' + esc(item.image) + '" alt="">' : esc(item.level || tr('Video', 'Видео'))) + '</div>' +
          '<div class="video-pad"><h3>' + esc(item.title) + '</h3><p>' + esc(item.meta) + '</p><span class="tag ' + esc(item.tone || '') + '">' + esc(item.level || tr('Video', 'Видео')) + '</span></div>' +
          '</article>';
      }).join('') || '<div class="card empty">' + esc(tr('No videos found for this filter.', 'Для этого фильтра видео пока нет.')) + '</div>';
    }

    function parseYouTubeId(url) {
      if (!url) return '';
      const match = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
      return match ? match[1] : (/^[A-Za-z0-9_-]{11}$/.test(url) ? url : '');
    }

    async function loadVideos() {
      try {
        const { data: posts } = await supa.from('posts')
          .select('id,user_id,media_url,media_type,caption,cover_url,mux_playback_id,mux_thumbnail_url,language_level,shorts_hidden,shorts_visibility,shorts_deleted_at,created_at')
          .in('media_type', ['video', 'youtube', 'image'])
          .not('media_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(24);
        const visible = (posts || []).filter((item) => !item.shorts_hidden && !item.shorts_deleted_at && (!item.shorts_visibility || item.shorts_visibility === 'public'));
        if (!visible.length) return;
        const authorIds = Array.from(new Set(visible.map((item) => item.user_id).filter(Boolean)));
        const { data: authors } = authorIds.length
          ? await supa.from('profiles').select('id,full_name,avatar_url').in('id', authorIds)
          : { data: [] };
        const byId = new Map((authors || []).map((author) => [author.id, author]));
        state.videos = visible.map((item) => {
          const author = byId.get(item.user_id);
          const thumb = item.mux_thumbnail_url || item.cover_url ||
            (item.mux_playback_id ? 'https://image.mux.com/' + item.mux_playback_id + '/thumbnail.jpg?width=640' : (item.media_type === 'image' ? item.media_url : null));
          return {
            id: item.id,
            title: item.caption || tr('Duvela lesson', 'Урок Duvela'),
            meta: (author && author.full_name) || 'Duvela',
            image: thumb,
            level: item.language_level || (item.media_type === 'youtube' ? 'YouTube' : tr('Video', 'Видео')),
            type: 'language',
            tone: item.media_type === 'youtube' ? 'red' : 'blue',
            media_type: item.media_type,
            media_url: item.media_url,
            playback_id: item.mux_playback_id,
            caption: item.caption || ''
          };
        });
      } catch (error) {
        console.warn('videos load failed', error);
      }
    }

    function openVideo(id) {
      const item = state.videos.find((entry) => entry.id === id);
      if (!item) return;
      $('#videoOverlayTitle').textContent = item.title;
      const body = $('#videoOverlayBody');
      if (item.media_type === 'youtube') {
        const youtubeId = parseYouTubeId(item.media_url);
        body.innerHTML = youtubeId
          ? '<div style="position:relative;padding-top:56.25%"><iframe style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px" src="https://www.youtube.com/embed/' + esc(youtubeId) + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>'
          : '<a class="btn primary" href="' + esc(item.media_url) + '" target="_blank" rel="noopener">' + esc(tr('Open video', 'Открыть видео')) + '</a>';
      } else if (item.media_type === 'image') {
        body.innerHTML = '<img src="' + esc(item.media_url) + '" style="width:100%;border-radius:10px">';
      } else {
        body.innerHTML = '<video id="vp" controls autoplay playsinline style="width:100%;border-radius:10px;background:#000;max-height:60vh"></video>';
        const player = $('#vp');
        const hlsSrc = item.playback_id ? 'https://stream.mux.com/' + item.playback_id + '.m3u8' : item.media_url;
        if (item.playback_id && window.Hls && window.Hls.isSupported()) {
          runtime.currentHls = new window.Hls();
          runtime.currentHls.loadSource(hlsSrc);
          runtime.currentHls.attachMedia(player);
        } else {
          player.src = hlsSrc;
        }
      }
      if (item.caption) body.insertAdjacentHTML('beforeend', '<p style="margin-top:12px;font-weight:800;color:var(--soft)">' + esc(item.caption) + '</p>');
      if (item.id) {
        body.insertAdjacentHTML('beforeend', '<div id="videoSocial" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px"><div class="empty">' + esc(tr('Loading…', 'Загрузка…')) + '</div></div>');
      }
      $('#videoOverlay').classList.add('open');
      if (item.id) {
        recordView(item.id);
        renderVideoSocial(item.id);
      }
    }

    function closeVideo() {
      if (runtime.currentHls) {
        try { runtime.currentHls.destroy(); } catch (error) {}
        runtime.currentHls = null;
      }
      const player = $('#vp');
      if (player && player.pause) player.pause();
      $('#videoOverlayBody').innerHTML = '';
      $('#videoOverlay').classList.remove('open');
    }

    async function recordView(postId) {
      try {
        await supa.from('post_views').insert({ post_id: postId, user_id: ctx.user.id });
      } catch (error) {
        /* duplicate/ignore */
      }
    }

    async function renderVideoSocial(postId) {
      const box = $('#videoSocial');
      if (!box) return;
      try {
        const [likeCount, myLike, comments] = await Promise.all([
          supa.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
          supa.from('post_likes').select('id').eq('post_id', postId).eq('user_id', ctx.user.id).maybeSingle(),
          supa.from('post_comments').select('id,user_id,comment,created_at').eq('post_id', postId).order('created_at', { ascending: true }).limit(50)
        ]);
        const liked = !!(myLike && myLike.data);
        const count = likeCount.count || 0;
        const rows = comments.data || [];
        const authorIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
        const { data: authors } = authorIds.length
          ? await supa.from('profiles').select('id,full_name,avatar_url').in('id', authorIds)
          : { data: [] };
        const byId = new Map((authors || []).map((author) => [author.id, author]));
        box.innerHTML =
          '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">' +
            '<button class="btn' + (liked ? ' primary' : '') + '" data-like="' + esc(postId) + '">' + (liked ? '♥' : '♡') + ' <span id="likeCount">' + count + '</span></button>' +
          '</div>' +
          '<div id="commentList">' + (rows.length ? rows.map((comment) => {
            const author = byId.get(comment.user_id);
            return '<div class="lesson-item" style="grid-template-columns:32px minmax(0,1fr)"><div class="avatar" style="width:32px;height:32px;font-size:12px">' + avatarInner(author && author.full_name, author && author.avatar_url) + '</div><div><b style="font-size:13px">' + esc((author && author.full_name) || tr('Duvela user', 'Пользователь Duvela')) + '</b><p style="color:var(--ink);font-weight:600">' + esc(comment.comment) + '</p></div></div>';
          }).join('') : '<div class="empty">' + esc(tr('No comments yet. Be the first!', 'Комментариев пока нет. Будьте первым!')) + '</div>') + '</div>' +
          '<form id="commentForm" data-post="' + esc(postId) + '" style="display:flex;gap:8px;margin-top:10px">' +
            '<input id="commentInput" placeholder="' + esc(tr('Add a comment...', 'Оставьте комментарий...')) + '" autocomplete="off" style="flex:1;border:1px solid var(--line);border-radius:999px;padding:10px 14px;background:var(--panel-soft)">' +
            '<button class="btn primary" type="submit">' + esc(tr('Send', 'Отпр.')) + '</button>' +
          '</form>';
        $('#commentForm').addEventListener('submit', (event) => {
          event.preventDefault();
          addComment(postId, $('#commentInput').value);
        });
      } catch (error) {
        box.innerHTML = '<div class="empty">' + esc(tr('Could not load reactions.', 'Не удалось загрузить реакции.')) + '</div>';
      }
    }

    async function toggleLike(postId) {
      const button = $('[data-like="' + postId + '"]');
      const liked = button && button.classList.contains('primary');
      try {
        if (liked) {
          await supa.from('post_likes').delete().eq('post_id', postId).eq('user_id', ctx.user.id);
        } else {
          await supa.from('post_likes').insert({ post_id: postId, user_id: ctx.user.id });
        }
        renderVideoSocial(postId);
      } catch (error) {
        alert(error.message || tr('Could not update the like.', 'Не удалось обновить лайк.'));
      }
    }

    async function addComment(postId, text) {
      const body = (text || '').trim();
      if (!body) return;
      $('#commentInput').value = '';
      try {
        await supa.from('post_comments').insert({ post_id: postId, user_id: ctx.user.id, comment: body });
        renderVideoSocial(postId);
      } catch (error) {
        alert(error.message || tr('Could not post the comment.', 'Не удалось отправить комментарий.'));
      }
    }

    function openUpload() {
      if (ctx.role === 'learner') return;
      $('#uploadForm').reset();
      $('#upNote').style.display = 'none';
      $('#uploadOverlay').classList.add('open');
    }

    async function uploadPost(event) {
      event.preventDefault();
      const note = $('#upNote');
      const file = $('#upFile').files && $('#upFile').files[0];
      if (!file) return;
      if (!SUPPORTED_UPLOAD_TYPES.has((file.type || '').toLowerCase())) {
        note.style.color = 'var(--red)';
        note.textContent = tr('Use JPG, PNG, WEBP, MP4 or MOV files.', 'Используйте файлы JPG, PNG, WEBP, MP4 или MOV.');
        note.style.display = 'block';
        return;
      }
      const isImage = (file.type || '').startsWith('image/');
      const button = $('#upSubmit');
      button.disabled = true;
      button.textContent = tr('Uploading...', 'Загрузка...');
      try {
        const url = await ctx.uploadToBucket('posts', file);
        const insertPayload = {
          user_id: ctx.user.id,
          media_url: url,
          media_type: isImage ? 'image' : 'video',
          caption: $('#upCaption').value.trim() || null,
          shorts_visibility: 'public'
        };
        const level = $('#upLevel').value.trim().toUpperCase();
        if (level) insertPayload.language_level = level;
        let result = await supa.from('posts').insert(insertPayload);
        if (result.error && Object.prototype.hasOwnProperty.call(insertPayload, 'language_level')) {
          result = await supa.from('posts').insert({
            user_id: insertPayload.user_id,
            media_url: insertPayload.media_url,
            media_type: insertPayload.media_type,
            caption: insertPayload.caption,
            shorts_visibility: insertPayload.shorts_visibility
          });
        }
        if (result.error) throw result.error;
        $('#uploadOverlay').classList.remove('open');
        await loadVideos();
        renderVideos();
      } catch (error) {
        note.style.color = 'var(--red)';
        note.textContent = error.message || tr('Upload failed.', 'Не удалось загрузить.');
        note.style.display = 'block';
      } finally {
        button.disabled = false;
        button.textContent = tr('Publish', 'Опубликовать');
      }
    }

    return {
      closeVideo,
      loadVideos,
      openUpload,
      openVideo,
      renderVideos,
      toggleLike,
      uploadPost
    };
  }

  window.DuvelaAppMedia = { create: createMediaFeature };
})();
