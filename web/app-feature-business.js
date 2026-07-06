(function () {
  function createBusinessFeature(ctx) {
    const { $, $$, tr, esc, alert, supa, state, avatarInner, formatDate } = ctx;

    async function publishEvent(event) {
      event.preventDefault();
      const note = $('#evNote');
      const title = $('#evTitle').value.trim();
      if (!title) return;
      const priceRaw = $('#evPrice').value.trim();
      const isPaid = priceRaw !== '' && Number(priceRaw) > 0;
      const baseDate = $('#evDate').value || null;
      const repeat = Math.max(1, Math.min(12, Number($('#evRepeat') && $('#evRepeat').value) || 1));
      const btn = $('#eventForm button[type="submit"]');
      btn.disabled = true;
      btn.textContent = tr('Publishing...', 'РџСѓР±Р»РёРєР°С†РёСЏ...');
      try {
        let imageUrl = null;
        const fileInput = $('#evImage');
        if (fileInput && fileInput.files && fileInput.files[0]) {
          imageUrl = await ctx.uploadToBucket('events', fileInput.files[0]);
        }
        const base = {
          organizer_id: ctx.user.id,
          title,
          description: $('#evDesc').value.trim() || null,
          event_time: $('#evTime').value || null,
          city: $('#evCity').value.trim() || null,
          format: $('#evFormat').value,
          language: $('#evLang').value.trim() || null,
          is_paid: isPaid,
          price_amount: isPaid ? Number(priceRaw) : null,
          image_url: imageUrl
        };
        let rows;
        if (repeat > 1 && baseDate) {
          const groupId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2));
          rows = [];
          for (let i = 0; i < repeat; i++) {
            const date = new Date(baseDate + 'T00:00:00');
            date.setDate(date.getDate() + i * 7);
            rows.push({ ...base, event_date: date.toISOString().slice(0, 10), recurrence_group_id: groupId, recurrence_rule: 'weekly', recurrence_occurrence: i + 1 });
          }
        } else {
          rows = [{ ...base, event_date: baseDate }];
        }
        const { error } = await supa.from('events').insert(rows);
        if (error) throw error;
        note.style.color = 'var(--teal)';
        note.textContent = repeat > 1
          ? tr(repeat + ' events published ✓', repeat + ' СЃРѕР±С‹С‚РёР№ РѕРїСѓР±Р»РёРєРѕРІР°РЅРѕ ✓')
          : tr('Event published ✓ Learners can see it now.', 'РЎРѕР±С‹С‚РёРµ РѕРїСѓР±Р»РёРєРѕРІР°РЅРѕ ✓ РЈС‡РµРЅРёРєРё СѓР¶Рµ РІРёРґСЏС‚ РµРіРѕ.');
        note.style.display = 'block';
        $('#eventForm').reset();
        await ctx.safeQuery(
          'events',
          () => supa.from('events').select(ctx.getEventColumns()).order('event_date', { ascending: true }).limit(12),
          ctx.mapEventRow
        );
        ctx.renderEvents();
      } catch (error) {
        note.style.color = 'var(--red)';
        note.textContent = error.message || tr('Could not publish the event.', 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСѓР±Р»РёРєРѕРІР°С‚СЊ СЃРѕР±С‹С‚РёРµ.');
        note.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = tr('Publish event', 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ СЃРѕР±С‹С‚РёРµ');
      }
    }

    async function loadBusinessWorkspace() {
      if (!ctx.isBusiness()) return;
      try {
        const { data: memberships } = await supa.from('organization_memberships')
          .select('organization_id,role,status,organizations(id,name,city,country,type)')
          .eq('user_id', ctx.user.id).eq('status', 'active');
        const org = (memberships || []).map((membership) => membership.organizations).find(Boolean) || null;
        state.myOrg = org;
        if (org) {
          const [{ data: courses }, { data: classes }] = await Promise.all([
            supa.from('courses').select('id,title,level,status,price,currency,created_at').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(30),
            supa.from('classes').select('id,name,level,language,starts_at,format').eq('organization_id', org.id).order('created_at', { ascending: false }).limit(30)
          ]);
          state.orgCourses = courses || [];
          state.orgClasses = classes || [];
        } else {
          state.orgCourses = [];
          state.orgClasses = [];
        }
      } catch (error) {
        console.warn('business workspace load failed', error);
      }
      try {
        const { data: practices } = await supa.from('teacher_practices')
          .select('id,title,target,level,status,plays_count,rating_avg,rating_count')
          .eq('creator_id', ctx.user.id).order('created_at', { ascending: false }).limit(30);
        state.myPractices = practices || [];
      } catch (error) {
        console.warn('my practices load failed', error);
      }
      try {
        const { data: portfolio } = await supa.from('organizer_portfolio')
          .select('id,title,description,image_url,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(20);
        state.portfolio = portfolio || [];
      } catch (error) {
        console.warn('portfolio load failed', error);
      }
      try {
        const { data: verification } = await supa.from('verification_requests')
          .select('id,status,note,created_at').eq('user_id', ctx.user.id).order('created_at', { ascending: false }).limit(1);
        state.verification = (verification && verification[0]) || null;
      } catch (error) {
        console.warn('verification load failed', error);
      }
      if (state.myOrg) {
        try {
          const { data: members } = await supa.from('organization_memberships')
            .select('id,user_id,role,status,profiles(full_name,avatar_url)').eq('organization_id', state.myOrg.id).eq('status', 'active');
          state.orgMembers = members || [];
        } catch (error) {
          console.warn('members load failed', error);
        }
      } else {
        state.orgMembers = [];
      }
    }

    function analyticsHtml() {
      const plays = state.myPractices.reduce((sum, practice) => sum + (practice.plays_count || 0), 0);
      const cells = [
        [tr('Courses', 'РљСѓСЂСЃС‹'), state.orgCourses.length],
        [tr('Classes', 'РљР»Р°СЃСЃС‹'), state.orgClasses.length],
        [tr('Practices', 'РџСЂР°РєС‚РёРєРё'), state.myPractices.length],
        [tr('Plays', 'РџСЂРѕС…РѕР¶РґРµРЅРёР№'), plays]
      ];
      return '<div class="grid-3" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">' +
        cells.map(([label, value]) => '<div class="card metric" style="min-height:auto;padding:12px"><span>' + esc(label) + '</span><b style="font-size:22px">' + value + '</b></div>').join('') + '</div>';
    }

    function membersHtml() {
      const roles = ['owner', 'admin', 'teacher', 'client'];
      return '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Members', 'РЈС‡Р°СЃС‚РЅРёРєРё')) + '</h2><span>' + state.orgMembers.length + '</span></div>' +
        '<p style="color:var(--muted);font-size:12px;font-weight:700;margin:0 0 8px">' + esc(tr('Invite by email is available in the app.', 'РџСЂРёРіР»Р°С€РµРЅРёРµ РїРѕ email РґРѕСЃС‚СѓРїРЅРѕ РІ РїСЂРёР»РѕР¶РµРЅРёРё.')) + '</p>' +
        (state.orgMembers.length ? state.orgMembers.map((member) => {
          const name = (member.profiles && member.profiles.full_name) || tr('Member', 'РЈС‡Р°СЃС‚РЅРёРє');
          const isMe = member.user_id === ctx.user.id;
          return '<div class="card row" style="grid-template-columns:40px minmax(0,1fr) auto auto;gap:8px"><div class="avatar" style="width:40px;height:40px">' + avatarInner(name, member.profiles && member.profiles.avatar_url) + '</div><div style="min-width:0"><h3>' + esc(name) + (isMe ? ' (' + esc(tr('you', 'РІС‹')) + ')' : '') + '</h3></div>' +
            '<select class="role-select" data-member-role="' + esc(member.id) + '" style="width:auto;padding:6px" ' + (isMe ? 'disabled' : '') + '>' + roles.map((role) => '<option value="' + role + '"' + (member.role === role ? ' selected' : '') + '>' + esc(role) + '</option>').join('') + '</select>' +
            (isMe ? '<span></span>' : '<button class="btn danger" data-member-remove="' + esc(member.id) + '" style="min-height:30px">✕</button>') +
          '</div>';
        }).join('') : '<div class="empty">' + esc(tr('No members yet.', 'РЈС‡Р°СЃС‚РЅРёРєРѕРІ РїРѕРєР° РЅРµС‚.')) + '</div>');
    }

    async function changeMemberRole(id, roleVal) {
      try {
        const { error } = await supa.from('organization_memberships').update({ role: roleVal, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        await loadBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not change the role.', 'РќРµ СѓРґР°Р»РѕСЃСЊ РёР·РјРµРЅРёС‚СЊ СЂРѕР»СЊ.'));
      }
    }

    async function removeMember(id) {
      if (!confirm(tr('Remove this member?', 'РЈРґР°Р»РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєР°?'))) return;
      try {
        const { error } = await supa.from('organization_memberships').delete().eq('id', id);
        if (error) throw error;
        await loadBusinessWorkspace();
        renderBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not remove the member.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СѓРґР°Р»РёС‚СЊ СѓС‡Р°СЃС‚РЅРёРєР°.'));
      }
    }

    function renderBusinessWorkspace() {
      const org = state.myOrg;
      const left = $('#workspaceActions');
      $('#workspacePrimaryTitle').textContent = org ? esc(org.name) : tr('Your organization', 'Р’Р°С€Р° РѕСЂРіР°РЅРёР·Р°С†РёСЏ');
      if (!org) {
        left.innerHTML =
          '<p style="font-weight:800;color:var(--soft);margin:0 0 12px">' + esc(tr('Create an organization to publish courses and classes on Duvela.', 'РЎРѕР·РґР°Р№С‚Рµ РѕСЂРіР°РЅРёР·Р°С†РёСЋ, С‡С‚РѕР±С‹ РїСѓР±Р»РёРєРѕРІР°С‚СЊ РєСѓСЂСЃС‹ Рё РєР»Р°СЃСЃС‹ РІ Duvela.')) + '</p>' +
          '<form id="orgForm">' +
            '<div class="field"><label>' + esc(tr('Organization name', 'РќР°Р·РІР°РЅРёРµ РѕСЂРіР°РЅРёР·Р°С†РёРё')) + '</label><input id="orgName" required maxlength="120"></div>' +
            '<div class="form-grid">' +
              '<div class="field"><label>' + esc(tr('City', 'Р“РѕСЂРѕРґ')) + '</label><input id="orgCity" maxlength="80"></div>' +
              '<div class="field"><label>' + esc(tr('Country', 'РЎС‚СЂР°РЅР°')) + '</label><input id="orgCountry" maxlength="80"></div>' +
            '</div>' +
            '<div class="field"><label>' + esc(tr('About', 'РћРїРёСЃР°РЅРёРµ')) + '</label><textarea id="orgDesc" maxlength="400"></textarea></div>' +
            '<button class="btn primary" type="submit" style="margin-top:10px">' + esc(tr('Create organization', 'РЎРѕР·РґР°С‚СЊ РѕСЂРіР°РЅРёР·Р°С†РёСЋ')) + '</button>' +
          '</form>';
        $('#orgForm').addEventListener('submit', createOrg);
        return;
      }
      left.innerHTML =
        analyticsHtml() +
        '<p style="font-weight:800;color:var(--soft);margin:0 0 12px">' + esc([org.city, org.country].filter(Boolean).join(', ') || tr('Your Duvela organization', 'Р’Р°С€Р° РѕСЂРіР°РЅРёР·Р°С†РёСЏ Duvela')) + '</p>' +
        '<form id="courseForm">' +
          '<div class="section-head" style="margin-bottom:8px"><h2 style="font-size:15px">' + esc(tr('New course', 'РќРѕРІС‹Р№ РєСѓСЂСЃ')) + '</h2></div>' +
          '<div class="field"><label>' + esc(tr('Title', 'РќР°Р·РІР°РЅРёРµ')) + '</label><input id="cTitle" required maxlength="140"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + esc(tr('Level', 'РЈСЂРѕРІРµРЅСЊ')) + '</label><input id="cLevel" placeholder="A1–C2" maxlength="10"></div>' +
            '<div class="field"><label>' + esc(tr('Language', 'РЇР·С‹Рє')) + '</label><input id="cLang" maxlength="40"></div>' +
            '<div class="field"><label>' + esc(tr('Price (blank = free)', 'Р¦РµРЅР° (РїСѓСЃС‚Рѕ = Р±РµСЃРїР»Р°С‚РЅРѕ)')) + '</label><input id="cPrice" type="number" min="0" step="1"></div>' +
            '<div class="field"><label>' + esc(tr('Currency', 'Р’Р°Р»СЋС‚Р°')) + '</label><input id="cCurrency" value="EUR" maxlength="8"></div>' +
          '</div>' +
          '<div class="field"><label>' + esc(tr('Schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ')) + '</label><input id="cSchedule" placeholder="' + esc(tr('Mon, Wed 18:00', 'РџРЅ, РЎСЂ 18:00')) + '" maxlength="120"></div>' +
          '<div class="field"><label>' + esc(tr('Description', 'РћРїРёСЃР°РЅРёРµ')) + '</label><textarea id="cDesc" maxlength="600"></textarea></div>' +
          '<label style="display:flex;align-items:center;gap:8px;font-weight:800;font-size:13px;margin:4px 0"><input type="checkbox" id="cPublish" checked> ' + esc(tr('Publish now (visible to learners)', 'РћРїСѓР±Р»РёРєРѕРІР°С‚СЊ СЃСЂР°Р·Сѓ (РІРёРґРЅРѕ СѓС‡РµРЅРёРєР°Рј)')) + '</label>' +
          '<button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Create course', 'РЎРѕР·РґР°С‚СЊ РєСѓСЂСЃ')) + '</button>' +
        '</form>' +
        '<div style="margin:8px 0"><input id="xlsxFile" type="file" accept=".xlsx,.xls,.csv" style="display:none"><button class="btn" id="importXlsxBtn" type="button">' + esc(tr('Import courses (Excel)', 'РРјРїРѕСЂС‚ РєСѓСЂСЃРѕРІ (Excel)')) + '</button><span id="xlsxNote" style="margin-left:10px;font-weight:800"></span></div>' +
        '<p style="color:var(--muted);font-size:11px;font-weight:700;margin:0 0 8px">' + esc(tr('Columns: title, level, language, price, schedule, description', 'РљРѕР»РѕРЅРєРё: title, level, language, price, schedule, description')) + '</p>' +
        '<div class="section-head" style="margin:16px 0 8px"><h2 style="font-size:15px">' + esc(tr('Your courses', 'Р’Р°С€Рё РєСѓСЂСЃС‹')) + '</h2><span>' + state.orgCourses.length + '</span></div>' +
        (state.orgCourses.length ? state.orgCourses.map((course) =>
          '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(course.title) + '</h3><p>' + esc([course.level, course.status].filter(Boolean).join(' В· ')) + '</p></div><span class="tag ' + (course.status === 'active' ? 'teal' : '') + '">' + esc(course.status === 'active' ? tr('Live', 'РђРєС‚РёРІРµРЅ') : (course.status || tr('Draft', 'Р§РµСЂРЅРѕРІРёРє'))) + '</span></div>'
        ).join('') : '<div class="empty">' + esc(tr('No courses yet.', 'РљСѓСЂСЃРѕРІ РїРѕРєР° РЅРµС‚.')) + '</div>') +
        '<form id="classForm" style="margin-top:18px">' +
          '<div class="section-head" style="margin-bottom:8px"><h2 style="font-size:15px">' + esc(tr('New class', 'РќРѕРІС‹Р№ РєР»Р°СЃСЃ')) + '</h2></div>' +
          '<div class="field"><label>' + esc(tr('Class name', 'РќР°Р·РІР°РЅРёРµ РєР»Р°СЃСЃР°')) + '</label><input id="clName" required maxlength="140"></div>' +
          '<div class="form-grid">' +
            '<div class="field"><label>' + esc(tr('Language', 'РЇР·С‹Рє')) + '</label><input id="clLang" maxlength="40"></div>' +
            '<div class="field"><label>' + esc(tr('Level', 'РЈСЂРѕРІРµРЅСЊ')) + '</label><input id="clLevel" placeholder="A1–C2" maxlength="10"></div>' +
            '<div class="field"><label>' + esc(tr('Format', 'Р¤РѕСЂРјР°С‚')) + '</label><select id="clFormat" class="role-select"><option value="online">' + esc(tr('Online', 'РћРЅР»Р°Р№РЅ')) + '</option><option value="offline">' + esc(tr('In person', 'РћС„С„Р»Р°Р№РЅ')) + '</option></select></div>' +
            '<div class="field"><label>' + esc(tr('Starts', 'РЎС‚Р°СЂС‚')) + '</label><input id="clStart" type="datetime-local"></div>' +
          '</div>' +
          '<button class="btn primary" type="submit" style="margin-top:6px">' + esc(tr('Create class', 'РЎРѕР·РґР°С‚СЊ РєР»Р°СЃСЃ')) + '</button>' +
        '</form>' +
        '<div class="section-head" style="margin:16px 0 8px"><h2 style="font-size:15px">' + esc(tr('Your classes', 'Р’Р°С€Рё РєР»Р°СЃСЃС‹')) + '</h2><span>' + state.orgClasses.length + '</span></div>' +
        (state.orgClasses.length ? state.orgClasses.map((item) =>
          '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto auto;gap:8px"><div><h3>' + esc(item.name) + '</h3><p>' + esc([item.language, item.level, item.starts_at ? formatDate(item.starts_at) : ''].filter(Boolean).join(' В· ')) + '</p></div><span class="tag">' + esc(item.format === 'offline' ? tr('In person', 'РћС„С„Р»Р°Р№РЅ') : tr('Online', 'РћРЅР»Р°Р№РЅ')) + '</span><button class="btn" data-class-manage="' + esc(item.id) + '" style="min-height:30px">' + esc(tr('Manage', 'РЈРїСЂР°РІР»СЏС‚СЊ')) + '</button></div>'
        ).join('') : '<div class="empty">' + esc(tr('No classes yet.', 'РљР»Р°СЃСЃРѕРІ РїРѕРєР° РЅРµС‚.')) + '</div>') +
        '<div class="section-head" style="margin:18px 0 8px"><h2 style="font-size:15px">' + esc(tr('Practices', 'РџСЂР°РєС‚РёРєРё')) + '</h2><div style="display:flex;gap:6px"><button class="btn" id="createChallengeBtn" type="button">' + esc(tr('+ Challenge', '+ Р§РµР»Р»РµРЅРґР¶')) + '</button><button class="btn primary" id="createPracticeBtn" type="button">' + esc(tr('Create practice', 'РЎРѕР·РґР°С‚СЊ РїСЂР°РєС‚РёРєСѓ')) + '</button></div></div>' +
        (state.myPractices.length ? state.myPractices.map((practice) =>
          '<div class="card row" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>' + esc(practice.title) + '</h3><p>' + esc([practice.target, practice.level].filter(Boolean).join(' В· ')) + ' В· ' + (practice.plays_count || 0) + ' ' + esc(tr('plays', 'РїСЂРѕС…РѕР¶РґРµРЅРёР№')) + ' В· ★ ' + (Number(practice.rating_avg || 0).toFixed(1)) + ' (' + (practice.rating_count || 0) + ')</p></div><span class="tag ' + (practice.status === 'published' ? 'teal' : '') + '">' + esc(practice.status === 'published' ? tr('Live', 'РђРєС‚РёРІРЅР°') : (practice.status || tr('Draft', 'Р§РµСЂРЅРѕРІРёРє'))) + '</span></div>'
        ).join('') : '<div class="empty">' + esc(tr('No practices yet.', 'РџСЂР°РєС‚РёРє РїРѕРєР° РЅРµС‚.')) + '</div>') +
        membersHtml();
      $('#courseForm').addEventListener('submit', createCourse);
      $('#classForm').addEventListener('submit', createClass);
      $('#createPracticeBtn').addEventListener('click', ctx.openPracticeBuilder);
      if ($('#createChallengeBtn')) $('#createChallengeBtn').addEventListener('click', ctx.openChallengeCreate);
      $$('[data-member-role]').forEach((select) => select.addEventListener('change', (event) => changeMemberRole(select.dataset.memberRole, event.target.value)));
      const importButton = $('#importXlsxBtn');
      if (importButton) importButton.addEventListener('click', () => $('#xlsxFile').click());
      const fileInput = $('#xlsxFile');
      if (fileInput) fileInput.addEventListener('change', importCoursesExcel);
    }

    async function createOrg(event) {
      event.preventDefault();
      const name = $('#orgName').value.trim();
      if (!name) return;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6);
      const btn = $('#orgForm button[type="submit"]');
      btn.disabled = true;
      try {
        const { data: org, error } = await supa.from('organizations').insert({
          owner_id: ctx.user.id,
          name,
          slug,
          city: $('#orgCity').value.trim() || null,
          country: $('#orgCountry').value.trim() || null,
          description: $('#orgDesc').value.trim() || null
        }).select('id,name,city,country,type').single();
        if (error) throw error;
        const { error: membershipError } = await supa.from('organization_memberships').insert({
          organization_id: org.id,
          user_id: ctx.user.id,
          role: 'owner',
          status: 'active'
        });
        if (membershipError) throw membershipError;
        await loadBusinessWorkspace();
        renderBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not create the organization.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РѕСЂРіР°РЅРёР·Р°С†РёСЋ.'));
        btn.disabled = false;
      }
    }

    async function createCourse(event) {
      event.preventDefault();
      if (!state.myOrg) return;
      const title = $('#cTitle').value.trim();
      if (!title) return;
      const priceRaw = $('#cPrice').value.trim();
      const btn = $('#courseForm button[type="submit"]');
      btn.disabled = true;
      try {
        const { error } = await supa.from('courses').insert({
          organization_id: state.myOrg.id,
          created_by: ctx.user.id,
          title,
          level: $('#cLevel').value.trim().toUpperCase() || null,
          language: $('#cLang').value.trim() || null,
          price: priceRaw !== '' ? Number(priceRaw) : null,
          currency: $('#cCurrency').value.trim() || null,
          schedule: $('#cSchedule').value.trim() || null,
          description: $('#cDesc').value.trim() || null,
          status: $('#cPublish').checked ? 'active' : 'draft'
        });
        if (error) throw error;
        await Promise.all([loadBusinessWorkspace(), ctx.loadPublicData()]);
        renderBusinessWorkspace();
        ctx.renderCourses();
      } catch (error) {
        alert(error.message || tr('Could not create the course.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РєСѓСЂСЃ.'));
        btn.disabled = false;
      }
    }

    async function createClass(event) {
      event.preventDefault();
      if (!state.myOrg) return;
      const name = $('#clName').value.trim();
      if (!name) return;
      const btn = $('#classForm button[type="submit"]');
      btn.disabled = true;
      try {
        const startVal = $('#clStart').value;
        const { error } = await supa.from('classes').insert({
          organization_id: state.myOrg.id,
          teacher_id: ctx.user.id,
          name,
          language: $('#clLang').value.trim() || null,
          level: $('#clLevel').value.trim().toUpperCase() || null,
          format: $('#clFormat').value,
          starts_at: startVal ? new Date(startVal).toISOString() : null
        });
        if (error) throw error;
        await loadBusinessWorkspace();
        renderBusinessWorkspace();
      } catch (error) {
        alert(error.message || tr('Could not create the class.', 'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕР·РґР°С‚СЊ РєР»Р°СЃСЃ.'));
        btn.disabled = false;
      }
    }

    async function importCoursesExcel(event) {
      const file = event.target.files && event.target.files[0];
      if (!file || !state.myOrg) return;
      const note = $('#xlsxNote');
      if (note) {
        note.style.color = 'var(--soft)';
        note.textContent = tr('Reading...', 'Р§С‚РµРЅРёРµ...');
      }
      try {
        if (!window.XLSX) throw new Error(tr('Spreadsheet library not loaded.', 'Р‘РёР±Р»РёРѕС‚РµРєР° С‚Р°Р±Р»РёС† РЅРµ Р·Р°РіСЂСѓР·РёР»Р°СЃСЊ.'));
        const buf = await file.arrayBuffer();
        const workbook = window.XLSX.read(buf, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const lookup = (obj, key) => {
          for (const currentKey in obj) {
            if (currentKey.toLowerCase().trim() === key) return obj[currentKey];
          }
          return '';
        };
        const payload = rows.map((row) => {
          const title = String(lookup(row, 'title') || '').trim();
          if (!title) return null;
          const priceRaw = String(lookup(row, 'price') || '').trim();
          return {
            organization_id: state.myOrg.id,
            created_by: ctx.user.id,
            title,
            level: String(lookup(row, 'level') || '').trim().toUpperCase() || null,
            language: String(lookup(row, 'language') || '').trim() || null,
            price: priceRaw && !isNaN(Number(priceRaw)) ? Number(priceRaw) : null,
            schedule: String(lookup(row, 'schedule') || '').trim() || null,
            description: String(lookup(row, 'description') || '').trim() || null,
            status: 'active'
          };
        }).filter(Boolean);
        if (!payload.length) {
          alert(tr('No valid rows — need a "title" column.', 'РќРµС‚ РІР°Р»РёРґРЅС‹С… СЃС‚СЂРѕРє — РЅСѓР¶РЅР° РєРѕР»РѕРЅРєР° "title".'));
          return;
        }
        const { error } = await supa.from('courses').insert(payload);
        if (error) throw error;
        await Promise.all([loadBusinessWorkspace(), ctx.loadPublicData()]);
        renderBusinessWorkspace();
        ctx.renderCourses();
        alert('✓ ' + payload.length + ' ' + tr('courses imported.', 'РєСѓСЂСЃРѕРІ РёРјРїРѕСЂС‚РёСЂРѕРІР°РЅРѕ.'));
      } catch (error) {
        alert(error.message || tr('Import failed.', 'РРјРїРѕСЂС‚ РЅРµ СѓРґР°Р»СЃСЏ.'));
      } finally {
        event.target.value = '';
      }
    }

    return {
      importCoursesExcel,
      loadBusinessWorkspace,
      publishEvent,
      removeMember,
      renderBusinessWorkspace
    };
  }

  window.DuvelaAppBusiness = { create: createBusinessFeature };
})();
