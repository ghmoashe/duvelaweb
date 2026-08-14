(function attachDuvelaWebRoles(global) {
  'use strict';

  const ALL_ROLES = ['learner', 'teacher', 'organizer', 'organization', 'admin'];
  const SIGNUP_ROLES = ['learner', 'teacher', 'organizer', 'organization'];
  const BUSINESS_ROLES = Object.freeze(new Set(['teacher', 'organizer', 'organization', 'admin']));

  function normalizeRole(role) {
    return ALL_ROLES.includes(role) ? role : 'learner';
  }

  function normalizeSignupRole(role) {
    return SIGNUP_ROLES.includes(role) ? role : 'learner';
  }

  function isBusinessRole(role) {
    return BUSINESS_ROLES.has(role);
  }

  function isApprovedForRole(role, profile) {
    if (!profile) return role === 'learner';
    if (role === 'admin') return Boolean(profile.is_admin);
    if (SIGNUP_ROLES.includes(profile.registered_web_role)) {
      return role === profile.registered_web_role;
    }
    if (role === 'teacher') return Boolean(profile.is_teacher);
    if (role === 'organizer' || role === 'organization') return Boolean(profile.is_organizer);
    return role === 'learner';
  }

  function fallbackApprovedRole(profile) {
    if (profile && profile.is_admin) return 'admin';
    if (profile && SIGNUP_ROLES.includes(profile.registered_web_role)) return profile.registered_web_role;
    if (profile && profile.is_teacher) return 'teacher';
    if (profile && profile.is_organizer) return 'organizer';
    return 'learner';
  }

  function pickAuthRole(user) {
    const meta = user && typeof user === 'object'
      ? {
          ...(user.user_metadata || {}),
          ...(user.app_metadata || {})
        }
      : {};
    const requested = normalizeRole(
      meta.last_web_role ||
      meta.web_role ||
      meta.role ||
      meta.account_role ||
      meta.signup_role ||
      ''
    );
    return requested || 'learner';
  }

  function pickWebRole(profile, hasOrganization) {
    if (profile && profile.is_admin) return 'admin';
    if (profile && SIGNUP_ROLES.includes(profile.registered_web_role)) return profile.registered_web_role;
    const preferredRole = normalizeRole((profile && profile.last_web_role) || '');
    if (preferredRole !== 'learner' && isApprovedForRole(preferredRole, profile)) return preferredRole;
    if (profile && profile.is_teacher) return 'teacher';
    if (profile && profile.is_organizer) return hasOrganization ? 'organization' : 'organizer';
    return 'learner';
  }

  async function loadRoleProfile(supa, userId) {
    try {
      const result = await supa
        .from('profiles')
        .select('registered_web_role,registered_web_role_confirmed,is_teacher,is_organizer,is_admin,last_web_role')
        .eq('id', userId)
        .maybeSingle();
      if (!result.error && result.data) return result.data;
      if (result.error) console.warn('role profile query failed', result.error);
    } catch (error) {
      console.warn('role profile query skipped', error);
    }

    try {
      const fallback = await supa
        .from('profiles')
        .select('is_teacher,is_organizer,is_admin')
        .eq('id', userId)
        .maybeSingle();
      if (!fallback.error && fallback.data) return fallback.data;
    } catch (error) {
      console.warn('role profile fallback query skipped', error);
    }

    return null;
  }

  async function confirmLegacyRoleIfNeeded(supa, profile) {
    if (!profile || profile.registered_web_role_confirmed !== false) return profile;
    let savedRole = null;
    try {
      savedRole = global.localStorage && global.localStorage.getItem('duvela.webSignupRole');
    } catch (error) {
      console.warn('saved registration role unavailable', error);
    }
    if (!SIGNUP_ROLES.includes(savedRole)) return profile;
    try {
      const result = await supa.rpc('confirm_legacy_web_role', { chosen_role: savedRole });
      if (result.error) {
        console.warn('legacy registration role confirmation failed', result.error);
        return profile;
      }
      return {
        ...profile,
        registered_web_role: normalizeSignupRole(result.data || savedRole),
        registered_web_role_confirmed: true,
        is_teacher: (result.data || savedRole) === 'teacher',
        is_organizer: ['organizer', 'organization'].includes(result.data || savedRole),
        last_web_role: normalizeSignupRole(result.data || savedRole),
      };
    } catch (error) {
      console.warn('legacy registration role confirmation skipped', error);
      return profile;
    }
  }

  async function hasActiveOrganization(supa, userId) {
    try {
      const result = await supa
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1);
      return !result.error && Boolean(result.data && result.data.length);
    } catch (error) {
      console.warn('organization membership query skipped', error);
      return false;
    }
  }

  async function detectWebRole(supa, userId, user) {
    let profile = await loadRoleProfile(supa, userId);
    if (!profile) return pickAuthRole(user);
    profile = await confirmLegacyRoleIfNeeded(supa, profile);
    const hasOrganization = profile && profile.is_organizer
      ? await hasActiveOrganization(supa, userId)
      : false;
    return pickWebRole(profile, hasOrganization);
  }

  global.DuvelaWebRoles = Object.freeze({
    allRoles: Object.freeze(ALL_ROLES.slice()),
    signupRoles: Object.freeze(SIGNUP_ROLES.slice()),
    businessRoles: BUSINESS_ROLES,
    normalizeRole,
    normalizeSignupRole,
    isBusinessRole,
    isApprovedForRole,
    fallbackApprovedRole,
    pickAuthRole,
    pickWebRole,
    loadRoleProfile,
    confirmLegacyRoleIfNeeded,
    hasActiveOrganization,
    detectWebRole,
  });
})(window);
