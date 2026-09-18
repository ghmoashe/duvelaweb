// Duvela web — Bunny Stream upload for Shorts video.
// Two-step: (1) reserve a video in the Bunny library via the
// `bunny-video-create` edge function, which returns a per-video TUS
// signature (the library API key stays server-side); (2) run a minimal
// TUS session straight against Bunny: POST to create the upload, one
// PATCH with the bytes. Same flow as the mobile apps.

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
    if (!data || !data.videoGuid || !data.tusEndpoint || !data.tusHeaders) {
      throw new Error('Invalid Bunny response.');
    }
    return data;
  }

  // TUS Upload-Metadata values are base64 of UTF-8 bytes.
  function base64Utf8(value) {
    return btoa(unescape(encodeURIComponent(String(value))));
  }

  async function tusCreate(create, file, title) {
    var res = await fetch(create.tusEndpoint, {
      method: 'POST',
      headers: Object.assign({}, create.tusHeaders, {
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(file.size),
        'Upload-Metadata': [
          'filetype ' + base64Utf8(file.type || 'video/mp4'),
          'title ' + base64Utf8(title || file.name || 'Duvela short'),
        ].join(','),
      }),
    });
    if (res.status !== 201) {
      var text = await res.text().catch(function () { return ''; });
      throw new Error('Bunny TUS create ' + res.status + ': ' + text.slice(0, 200));
    }
    var location = res.headers.get('location');
    if (!location) throw new Error('Bunny TUS create returned no Location.');
    return new URL(location, create.tusEndpoint).toString();
  }

  function tusPatch(create, uploadUrl, file, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PATCH', uploadUrl);
      Object.keys(create.tusHeaders || {}).forEach(function (k) {
        xhr.setRequestHeader(k, create.tusHeaders[k]);
      });
      xhr.setRequestHeader('Tus-Resumable', '1.0.0');
      xhr.setRequestHeader('Upload-Offset', '0');
      xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');
      xhr.upload.onprogress = function (event) {
        if (event.lengthComputable && typeof onProgress === 'function') {
          onProgress(event.loaded / event.total);
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('Bunny TUS PATCH ' + xhr.status + ': ' + (xhr.responseText || '').slice(0, 200)));
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
    var uploadUrl = await tusCreate(created, file, opts.title);
    await tusPatch(created, uploadUrl, file, opts.onProgress);
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
