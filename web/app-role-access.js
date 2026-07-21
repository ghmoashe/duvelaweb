(function () {
  const PROFILE_COLUMNS = 'id,full_name,avatar_url,cover_url,city,country,language,language_level,learning_languages,teaches_languages,bio,interests,profile_interests,qualifications,specialization,teaching_experience,telegram,instagram,tiktok,facebook,linkedin,youtube,website,is_teacher,is_organizer,is_admin,is_verified,score,vela_coin_balance,grammar_progress,speaking_progress,vocabulary_progress,exam_progress,weekly_minutes_goal,goal_level';

  function createRoleAccessFeature(ctx) {
    const {
      $,
      tr,
      esc,
      alert,
      supa,
      rolesApi,
      profileWritesApi,
      businessRoles,
      roleLabels,
      hasPinnedRole,
      session
    } = ctx;

    function isApprovedForRole(targetRole, currentProfile) {
      return rolesApi.isApprovedForRole(targetRole, currentProfile);
    }

    function fallbackApprovedRole(currentProfile) {
      return rolesApi.fallbackApprovedRole(currentProfile);
    }

    function normalizeRole(targetRole) {
      const normalized = rolesApi.normalizeRole(targetRole);
      return roleLabels[normalized] ? normalized : 'learner';
    }

    function resolveEffectiveRole(targetRole) {
      session.requestedBusinessRole = null;
      return fallbackApprovedRole(session.profile);
    }

    function requestedRoleStatus() {
      return session.profile?.role_request_status || (session.requestedBusinessRole ? 'pending' : '');
    }

    function syncRoleOptions() {
      const badge = $('#roleBadge');
      if (badge) badge.textContent = roleLabels[session.role] || session.role;
    }

    async function submitRoleRequest(targetRole) {
      try {
        const result = await profileWritesApi.persistBusinessRoleSelection(supa, rolesApi, {
          userId: session.user.id,
          targetRole,
          profile: session.profile,
        });
        if (result.profile) session.profile = result.profile;
        session.requestedBusinessRole = targetRole;
        return true;
      } catch (error) {
        console.warn('role request update failed', error);
        alert(tr(
          'Could not save the role request. Apply the duvela web SQL bundle first.',
          'Не удалось сохранить запрос роли. Сначала примените duvela web SQL bundle.'
        ));
        return false;
      }
    }

    function renderAccessNotice() {
      const node = $('#accessNotice');
      if (node) { node.innerHTML = ''; node.style.display = 'none'; }
    }

    async function loadProfile() {
      try {
        const result = await supa.from('profiles')
          .select(PROFILE_COLUMNS)
          .eq('id', session.user.id)
          .maybeSingle();
        if (!result.error && result.data) session.profile = result.data;
      } catch (error) {
        console.warn('profile query failed', error);
      }

      const roleProfile = await rolesApi.loadRoleProfile(supa, session.user.id);
      if (roleProfile) {
        session.profile = { ...(session.profile || {}), ...roleProfile };
      }

      const hasOrganization = session.profile?.is_organizer
        ? await rolesApi.hasActiveOrganization(supa, session.user.id)
        : false;
      session.role = normalizeRole(rolesApi.pickWebRole(session.profile, hasOrganization));
      session.selectedRole = session.role;
    }

    return {
      isApprovedForRole,
      fallbackApprovedRole,
      normalizeRole,
      renderAccessNotice,
      loadProfile,
      submitRoleRequest,
      syncRoleOptions
    };
  }

  window.DuvelaAppRoleAccess = { create: createRoleAccessFeature };
})();
