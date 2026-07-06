(function () {
  function createProfileFeature(ctx) {
    const { $, tr, esc, alert, supa, state, avatarHtml, avatarInner, timeAgo, roleLabels } = ctx;

    function setInput(id, value) {
      const node = $(id);
      if (node) node.value = value == null ? '' : value;
    }

    function renderProfile() {
      const displayName = ctx.profile?.full_name || ctx.user.user_metadata?.full_name || (ctx.user.email || tr('Duvela user', 'Пользователь Duvela')).split('@')[0];
      const meta = [ctx.profile?.city, ctx.profile?.country].filter(Boolean).join(', ') || tr('Signed in to ', 'Вход выполнен в ') + (ctx.isBusiness() ? 'Bus Web' : 'Hub Web');
      $('#topName').textContent = displayName;
      $('#topEmail').textContent = (ctx.isBusiness() ? 'Bus' : 'Hub') + ' - ' + (ctx.user.email || roleLabels[ctx.role]);
      $('#profileName').textContent = displayName;
      $('#profileMeta').textContent = meta;
      setInput('#profileEmail', ctx.user.email || '');
      setInput('#profileRole', roleLabels[ctx.role] || ctx.role);
      setInput('#pfName', ctx.profile?.full_name);
      setInput('#pfCity', ctx.profile?.city);
      setInput('#pfCountry', ctx.profile?.country);
      setInput('#pfLanguage', ctx.profile?.language);
      setInput('#pfLevel', ctx.profile?.language_level);
      setInput('#pfAvatar', ctx.profile?.avatar_url);
      setInput('#pfBio', ctx.profile?.bio);
      setInput('#pfTelegram', ctx.profile?.telegram);
      setInput('#pfInstagram', ctx.profile?.instagram);
      setInput('#pfWebsite', ctx.profile?.website);
      avatarHtml('#topAvatar', displayName, ctx.profile?.avatar_url || ctx.user.user_metadata?.avatar_url);
      avatarHtml('#profileAvatar', displayName, ctx.profile?.avatar_url || ctx.user.user_metadata?.avatar_url);
      if (ctx.profile?.id) {
        $('#publicProfileLink').href = './profile.html?id=' + encodeURIComponent(ctx.profile.id);
        $('#publicProfileLink').style.display = 'inline-flex';
      }
      renderProgressCard();
    }

    async function saveProfile(event) {
      event.preventDefault();
      const patch = {
        full_name: $('#pfName').value.trim() || null,
        city: $('#pfCity').value.trim() || null,
        country: $('#pfCountry').value.trim() || null,
        language: $('#pfLanguage').value.trim() || null,
        language_level: $('#pfLevel').value.trim() || null,
        avatar_url: $('#pfAvatar').value.trim() || null,
        bio: $('#pfBio').value.trim() || null,
        telegram: $('#pfTelegram').value.trim() || null,
        instagram: $('#pfInstagram').value.trim() || null,
        website: $('#pfWebsite').value.trim() || null,
        updated_at: new Date().toISOString()
      };
      const button = $('#profileForm button[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await supa.from('profiles').update(patch).eq('id', ctx.user.id);
        if (error) throw error;
        ctx.setProfile({ ...(ctx.profile || {}), ...patch });
        $('#profileSaved').style.display = 'inline';
        setTimeout(() => { $('#profileSaved').style.display = 'none'; }, 2500);
        renderProfile();
      } catch (error) {
        alert(error.message || tr('Could not save the profile.', 'Не удалось сохранить профиль.'));
      } finally {
        button.disabled = false;
      }
    }

    function portfolioHtml() {
      return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Portfolio', 'Портфолио')) + '</h2></div>' +
        '<form id="pfAddForm" style="margin-bottom:10px">' +
          '<div class="field"><label>' + esc(tr('Title', 'Название')) + '</label><input id="pfItemTitle" maxlength="120" required></div>' +
          '<div class="field"><label>' + esc(tr('Description', 'Описание')) + '</label><textarea id="pfItemDesc" maxlength="400"></textarea></div>' +
          '<div class="field"><label>' + esc(tr('Image (optional)', 'Изображение (необязательно)')) + '</label><input id="pfItemImg" type="file" accept="image/*"></div>' +
          '<button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Add to portfolio', 'Добавить в портфолио')) + '</button>' +
        '</form>' +
        (state.portfolio.length ? state.portfolio.map((item) =>
          '<div class="card row" style="grid-template-columns:52px minmax(0,1fr) auto"><div class="thumb">' + (item.image_url ? '<img src="' + esc(item.image_url) + '" alt="">' : esc((item.title || 'P').charAt(0))) + '</div><div><h3>' + esc(item.title) + '</h3><p>' + esc(item.description || '') + '</p></div><button class="btn danger" data-del-portfolio="' + esc(item.id) + '" style="min-height:30px">' + esc(tr('Delete', 'Удалить')) + '</button></div>'
        ).join('') : '<div class="empty">' + esc(tr('No portfolio items yet.', 'В портфолио пока пусто.')) + '</div>');
    }

    function verificationHtml() {
      const verification = state.verification;
      const statuses = {
        pending: tr('Pending review', 'На проверке'),
        approved: tr('Verified ✓', 'Подтверждено ✓'),
        rejected: tr('Rejected', 'Отклонено'),
        denied: tr('Rejected', 'Отклонено')
      };
      if (verification) {
        return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Verification', 'Верификация')) + '</h2><span class="tag ' + (verification.status === 'approved' ? 'teal' : '') + '">' + esc(statuses[verification.status] || verification.status) + '</span></div>' +
          (verification.note ? '<p style="color:var(--soft);font-weight:700">' + esc(verification.note) + '</p>' : '');
      }
      return '<div class="section-head" style="margin-top:16px"><h2>' + esc(tr('Verification', 'Верификация')) + '</h2></div>' +
        '<form id="verForm"><div class="field"><label>' + esc(tr('Why should we verify you?', 'Почему стоит вас верифицировать?')) + '</label><textarea id="verNote" maxlength="400"></textarea></div><button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Request verification', 'Запросить верификацию')) + '</button></form>';
    }

    async function addPortfolioItem(event) {
      event.preventDefault();
      const title = $('#pfItemTitle').value.trim();
      if (!title) return;
      const button = $('#pfAddForm button[type="submit"]');
      button.disabled = true;
      try {
        let imageUrl = null;
        const fileInput = $('#pfItemImg');
        if (fileInput && fileInput.files && fileInput.files[0]) imageUrl = await ctx.uploadToBucket('posts', fileInput.files[0]);
        const { error } = await supa.from('organizer_portfolio').insert({
          user_id: ctx.user.id,
          title,
          description: $('#pfItemDesc').value.trim() || null,
          image_url: imageUrl
        });
        if (error) throw error;
        await ctx.loadBusinessWorkspace();
        renderProgressCard();
      } catch (error) {
        alert(error.message || tr('Could not add the item.', 'Не удалось добавить.'));
        button.disabled = false;
      }
    }

    async function deletePortfolioItem(id) {
      try {
        await supa.from('organizer_portfolio').delete().eq('id', id);
        await ctx.loadBusinessWorkspace();
        renderProgressCard();
      } catch (error) {
        alert(error.message || tr('Could not delete.', 'Не удалось удалить.'));
      }
    }

    async function submitVerification(event) {
      event.preventDefault();
      const button = $('#verForm button[type="submit"]');
      button.disabled = true;
      try {
        const { error } = await supa.from('verification_requests').insert({
          user_id: ctx.user.id,
          organization_id: state.myOrg ? state.myOrg.id : null,
          note: $('#verNote').value.trim() || null
        });
        if (error) throw error;
        await ctx.loadBusinessWorkspace();
        renderProgressCard();
      } catch (error) {
        alert(error.message || tr('Could not submit the request.', 'Не удалось отправить запрос.'));
        button.disabled = false;
      }
    }

    async function renderProgressCard() {
      const card = $('#progressCard');
      if (!card) return;
      if (ctx.isBusiness()) {
        card.innerHTML =
          '<div class="section-head"><h2>' + esc(tr('Account', 'Аккаунт')) + '</h2></div>' +
          '<p style="font-weight:800;color:var(--soft)">' + esc(tr('You are signed in as ', 'Вы вошли как ') + (roleLabels[ctx.role] || ctx.role) + '.') + '</p>' +
          ctx.walletHtml() + portfolioHtml() + verificationHtml();
        const portfolioForm = $('#pfAddForm');
        if (portfolioForm) portfolioForm.addEventListener('submit', addPortfolioItem);
        const verificationForm = $('#verForm');
        if (verificationForm) verificationForm.addEventListener('submit', submitVerification);
        return;
      }
      const bars = [
        [tr('Grammar', 'Грамматика'), ctx.profile?.grammar_progress ?? 0],
        [tr('Speaking', 'Speaking'), ctx.profile?.speaking_progress ?? 0],
        [tr('Vocabulary', 'Словарь'), ctx.profile?.vocabulary_progress ?? 0],
        [tr('Exam', 'Экзамен'), ctx.profile?.exam_progress ?? 0]
      ];
      card.innerHTML =
        '<div class="section-head"><h2>' + esc(tr('Your progress', 'Ваш прогресс')) + '</h2><span>' + esc((ctx.profile?.score ?? 0).toLocaleString() + ' XP · ' + (ctx.profile?.vela_coin_balance ?? 0).toLocaleString() + ' ' + tr('coins', 'монет')) + '</span></div>' +
        bars.map(([label, value]) => {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          return '<div class="prog-row"><div class="prog-label"><span>' + esc(label) + '</span><span>' + pct + '%</span></div><div class="prog-bar"><i style="width:' + pct + '%"></i></div></div>';
        }).join('') +
        ctx.walletHtml() +
        leaderboardShellHtml() +
        '<div id="rankBox" style="margin-top:6px"><div class="empty">' + esc(tr('Loading…', 'Загрузка…')) + '</div></div>';
      const filter = $('#rankFilter');
      if (filter) filter.addEventListener('change', () => {
        state.leaderLang = filter.value;
        renderLeaderboard();
      });
      renderLeaderboard();
    }

    function leaderboardShellHtml() {
      const languages = Array.isArray(ctx.profile?.learning_languages) ? ctx.profile.learning_languages.filter(Boolean) : [];
      const options = ['<option value="">' + esc(tr('All languages', 'Все языки')) + '</option>']
        .concat(languages.map((language) => '<option value="' + esc(language) + '"' + (state.leaderLang === language ? ' selected' : '') + '>' + esc(language) + '</option>')).join('');
      return '<div class="section-head" style="margin-top:16px"><h3 style="font-size:15px;margin:0">' + esc(tr('Leaderboard', 'Таблица лидеров')) + '</h3>' +
        (languages.length ? '<select id="rankFilter" class="role-select" style="width:auto;padding:6px 10px;font-weight:800">' + options + '</select>' : '') + '</div>';
    }

    async function renderLeaderboard() {
      const box = $('#rankBox');
      if (!box) return;
      const language = state.leaderLang;
      try {
        let query = supa.from('profiles').select('id,full_name,avatar_url,score').order('score', { ascending: false }).limit(20);
        if (language) query = query.contains('learning_languages', [language]);
        const { data } = await query;
        const rows = data || [];
        let rank = null;
        try {
          let rankQuery = supa.from('profiles').select('*', { count: 'exact', head: true }).gt('score', ctx.profile?.score ?? 0);
          if (language) rankQuery = rankQuery.contains('learning_languages', [language]);
          const { count } = await rankQuery;
          rank = (count || 0) + 1;
        } catch (error) {
          /* rank optional */
        }
        box.innerHTML =
          (rank ? '<p style="font-weight:900;color:var(--purple);margin:0 0 8px">' + esc(tr('Your rank: #', 'Ваш ранг: #')) + rank + '</p>' : '') +
          (rows.length ? rows.map((row, index) =>
            '<div class="rank-row' + (row.id === ctx.user.id ? ' me' : '') + '"><div class="rank-num">' + (index + 1) + '</div><div class="avatar" style="width:30px;height:30px;font-size:12px">' + avatarInner(row.full_name, row.avatar_url) + '</div><div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(row.full_name || tr('Duvela user', 'Пользователь Duvela')) + '</div><div style="font-weight:900;color:var(--purple)">' + Number(row.score || 0).toLocaleString() + '</div></div>'
          ).join('') : '<div class="empty">' + esc(tr('No ranking data.', 'Нет данных рейтинга.')) + '</div>');
      } catch (error) {
        box.innerHTML = '<div class="empty">' + esc(tr('Leaderboard unavailable.', 'Рейтинг недоступен.')) + '</div>';
      }
    }

    return {
      deletePortfolioItem,
      renderProfile,
      renderProgressCard,
      saveProfile
    };
  }

  window.DuvelaAppProfile = { create: createProfileFeature };
})();
