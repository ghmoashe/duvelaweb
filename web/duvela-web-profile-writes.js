(function attachDuvelaWebProfileWrites(global) {
  'use strict';

  function buildIdentityPatch(params) {
    return {
      id: params.userId,
      email: params.email || null,
      locale: params.locale || null,
      updated_at: params.now,
    };
  }

  async function upsertProfileIdentity(supa, params) {
    const now = params.now || new Date().toISOString();
    const patch = buildIdentityPatch({
      userId: params.userId,
      email: params.email,
      locale: params.locale,
      now,
    });
    const result = await supa.from('profiles').upsert(patch, { onConflict: 'id' });
    if (result.error) throw result.error;
    return { now, patch };
  }

  global.DuvelaWebProfileWrites = Object.freeze({
    buildIdentityPatch,
    upsertProfileIdentity,
  });
})(window);
