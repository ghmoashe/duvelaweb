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

  async function persistBusinessRoleSelection(supa, rolesApi, params) {
    const targetRole = rolesApi.normalizeRole(params.targetRole);
    const now = params.now || new Date().toISOString();

    if (!rolesApi.isBusinessRole(targetRole)) {
      return {
        approved: false,
        requested: false,
        now,
        patch: null,
        profile: params.profile || null,
      };
    }

    const roleProfile = params.profile || await rolesApi.loadRoleProfile(supa, params.userId);
    if (!roleProfile) {
      return {
        approved: false,
        requested: false,
        now,
        patch: null,
        profile: null,
      };
    }

    if (rolesApi.isApprovedForRole(targetRole, roleProfile)) {
      const patch = {
        last_web_role: targetRole,
        updated_at: now,
      };
      const result = await supa.from('profiles').update(patch).eq('id', params.userId);
      if (result.error) throw result.error;
      return {
        approved: true,
        requested: false,
        now,
        patch,
        profile: { ...roleProfile, ...patch },
      };
    }

    const patch = {
      requested_role: targetRole,
      role_request_status: 'pending',
      requested_role_at: now,
      last_web_role: targetRole,
      updated_at: now,
    };
    const result = await supa.from('profiles').update(patch).eq('id', params.userId);
    if (result.error) throw result.error;
    return {
      approved: false,
      requested: true,
      now,
      patch,
      profile: { ...roleProfile, ...patch },
    };
  }

  global.DuvelaWebProfileWrites = Object.freeze({
    buildIdentityPatch,
    upsertProfileIdentity,
    persistBusinessRoleSelection,
  });
})(window);
