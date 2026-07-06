(function () {
  const PROFILE_COLUMNS = 'id,full_name,avatar_url,city,country,language,language_level,learning_languages,bio,telegram,instagram,website,is_teacher,is_organizer,is_admin,score,vela_coin_balance,grammar_progress,speaking_progress,vocabulary_progress,exam_progress,weekly_minutes_goal,goal_level';

  function createRoleAccessFeature(ctx) {
    const {
      $,
      $$,
      tr,
      esc,
      alert,
      supa,
      rolesApi,
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
      const candidate = normalizeRole(targetRole);
      session.requestedBusinessRole = null;
      if (isApprovedForRole(candidate, session.profile)) return candidate;
      if (businessRoles.has(candidate)) session.requestedBusinessRole = session.profile?.requested_role || candidate;
      return fallbackApprovedRole(session.profile);
    }

    function requestedRoleStatus() {
      return session.profile?.role_request_status || (session.requestedBusinessRole ? 'pending' : '');
    }

    function syncRoleOptions() {
      const current = session.role;
      const hasAdmin = Boolean(session.profile?.is_admin);
      const optionLabels = {
        learner: roleLabels.learner,
        teacher: isApprovedForRole('teacher', session.profile)
          ? roleLabels.teacher
          : tr('Teacher request', 'Запрос на роль учителя'),
        organizer: isApprovedForRole('organizer', session.profile)
          ? roleLabels.organizer
          : tr('Organizer request', 'Запрос на роль организатора'),
        organization: isApprovedForRole('organization', session.profile)
          ? roleLabels.organization
          : tr('Organization request', 'Запрос на роль организации'),
        admin: roleLabels.admin
      };

      $$('#roleSelect option').forEach((option) => {
        option.textContent = optionLabels[option.value] || option.value;
        if (option.value === 'admin') option.hidden = !hasAdmin;
      });

      $('#roleSelect').value = current;
    }

    async function submitRoleRequest(targetRole) {
      const now = new Date().toISOString();

      try {
        const { error } = await supa.from('profiles').update({
          requested_role: targetRole,
          role_request_status: 'pending',
          requested_role_at: now,
          last_web_role: targetRole,
          updated_at: now
        }).eq('id', session.user.id);

        if (error) throw error;

        session.profile = {
          ...(session.profile || {}),
          requested_role: targetRole,
          role_request_status: 'pending',
          requested_role_at: now,
          last_web_role: targetRole
        };
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
      const requestedRole = session.requestedBusinessRole || session.profile?.requested_role;
      const status = requestedRoleStatus();
      const hasPending = requestedRole && !isApprovedForRole(requestedRole, session.profile);

      if (!node || !hasPending) {
        if (node) node.style.display = 'none';
        return;
      }

      const requestedLabel = roleLabels[requestedRole] || requestedRole;
      const denied = status === 'denied' || status === 'rejected';

      node.className = 'notice' + (denied ? ' warn' : '');
      node.innerHTML = denied
        ? '<h2>' + esc(tr('Business access needs review', 'Доступ в Bus ожидает пересмотра')) + '</h2><p>' + esc(tr(
            requestedLabel + ' access was not approved yet. You still have Hub Web, and the account can request another review from support or the admin team.',
            'Доступ для роли «' + requestedLabel + '» пока не подтверждён. Hub Web доступен, а повторный запрос можно отправить через support или админ-команду.'
          )) + '</p>'
        : '<h2>' + esc(tr('Business access pending', 'Доступ в Bus ожидает подтверждения')) + '</h2><p>' + esc(tr(
            requestedLabel + ' access was requested for this account. Until approval, the browser opens Hub Web and keeps learner-safe permissions.',
            'Для этого аккаунта отправлен запрос на роль «' + requestedLabel + '». До подтверждения браузер открывает Hub Web и сохраняет безопасные права ученика.'
          )) + '</p>';
      node.style.display = 'block';
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

      const pinnedRole = normalizeRole(session.selectedRole);
      let nextRole = pinnedRole;

      if (!hasPinnedRole && session.profile) {
        const hasOrganization = session.profile.is_organizer
          ? await rolesApi.hasActiveOrganization(supa, session.user.id)
          : false;
        nextRole = normalizeRole(rolesApi.pickWebRole(session.profile, hasOrganization));
      }

      session.role = resolveEffectiveRole(nextRole);
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
