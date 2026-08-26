// Duvela web — Bunny Stream upload for Shorts video.
// Two-step: (1) reserve a video in the Bunny library via the
// `bunny-video-create` edge function; (2) PUT the file bytes directly
// to Bunny's CDN. Same flow as the mobile app; keeps the API key
// server-side (only the caller-scoped AccessKey comes back through
// the edge function response).

(function attachBunnyUpload(global) {
  'use strict';

  async function createBunnyVideo(supa, title) {
    const { data, error } = await supa.functions.invoke('bunny-video-create', {
      body: { title: (title || 'Duvela short').slice(0, 240) },
    });
    if (error) {
      const context = error.context;
      if (context && typeof context.json === 'function') {
        try {
          const body = await context.clone().json();
          if (body && body.error) throw new Error(body.error);
        } catch (_) { /* fall through */ }
      }
      throw new Error((error && error.message) || 'Could not create Bunny video.');
    }
    if (!data || !data.videoGuid || !data.uploadUrl) {
      throw new Error('Invalid Bunny response.');
    }
    return data;
  }

  function uploadFileWithProgress(create, file, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PUT', create.uploadUrl);
      Object.keys(create.uploadHeaders || {}).forEach(function (k) {
        xhr.setRequestHeader(k, create.uploadHeaders[k]);
      });
      xhr.upload.onprogress = function (event) {
        if (event.lengthComputable && typeof onProgress === 'function') {
          onProgress(event.loaded / event.total);
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('Bunny PUT ' + xhr.status + ': ' + (xhr.responseText || '').slice(0, 200)));
      };
      xhr.onerror = function () { reject(new Error('Bunny upload network error')); };
      xhr.send(file);
    });
  }

  // supa: Supabase client. file: File / Blob. options: { title, onProgress }
  // Returns { videoGuid, playbackUrl, thumbnailUrl }.
  async function uploadShortToBunny(supa, file, options) {
    var opts = options || {};
    var created = await createBunnyVideo(supa, opts.title);
    await uploadFileWithProgress(created, file, opts.onProgress);
    return {
      videoGuid: created.videoGuid,
      playbackUrl: created.playbackUrl,
      thumbnailUrl: created.thumbnailUrl,
    };
  }

  global.DuvelaBunnyUpload = {
    uploadShortToBunny: uploadShortToBunny,
    createBunnyVideo: createBunnyVideo,
  };
})(window);
