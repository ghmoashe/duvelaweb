  if (!window.DuvelaWebConfig || typeof window.DuvelaWebConfig.createSupabaseClient !== 'function') {
    document.body.innerHTML = '<div class="wrap"><div class="card"><h2>Configuration missing</h2>' +
      '<p class="lead">DuvelaWebConfig isn\'t loaded. Ensure ./web/duvela-web-config.js is served.</p></div></div>';
    throw new Error('Missing DuvelaWebConfig');
  }
  var client = window.DuvelaWebConfig.createSupabaseClient();
  var currentUser = null;
  var currentAccount = null;

  function showMsg(id, text, kind) {
    var el = document.getElementById(id);
    el.className = 'msg ' + (kind || 'ok');
    el.textContent = text;
    if (kind === 'ok') setTimeout(function () { el.className = 'msg'; }, 4000);
  }

  async function refresh() {
    var s = await client.auth.getSession();
    currentUser = s.data.session ? s.data.session.user : null;
    if (!currentUser) {
      document.getElementById('signedOut').style.display = 'block';
      document.getElementById('signedIn').style.display = 'none';
      return;
    }
    document.getElementById('signedOut').style.display = 'none';
    document.getElementById('signedIn').style.display = 'block';
    document.getElementById('who').innerHTML =
      currentUser.email + '<button id="signOutBtn">Sign out</button>';
    document.getElementById('signOutBtn').addEventListener('click', async function () {
      await client.auth.signOut();
      location.reload();
    });
    await loadAccount();
  }

  async function loadAccount() {
    var res = await client.from('corporate_accounts')
      .select('id, company_name, plan, seats_purchased, languages, status')
      .eq('hr_contact_id', currentUser.id)
      .limit(1);
    if (res.error || !res.data || res.data.length === 0) {
      document.getElementById('accountLine').textContent =
        'No corporate account is linked to this email yet. Reach out to sales — we\'ll set it up.';
      document.querySelector('#signedIn .grid').style.opacity = .4;
      document.querySelector('#signedIn .grid').style.pointerEvents = 'none';
      document.getElementById('seatsBody').innerHTML =
        '<tr><td colspan="5" class="empty">No seats yet.</td></tr>';
      return;
    }
    currentAccount = res.data[0];
    document.getElementById('accountLine').textContent =
      currentAccount.company_name + ' · ' + currentAccount.status.toUpperCase();
    document.getElementById('kpiSeats').textContent = currentAccount.seats_purchased;
    document.getElementById('kpiPlan').textContent = currentAccount.plan.replace('_', ' ');
    document.getElementById('seatsInput').value = currentAccount.seats_purchased;
    document.getElementById('planSelect').value = currentAccount.plan;
    document.getElementById('languagesInput').value = (currentAccount.languages || []).join(', ');
    await loadSeats();
  }

  async function loadSeats() {
    var body = document.getElementById('seatsBody');
    var used = await client.rpc('corporate_seats_used', { target_account: currentAccount.id });
    if (!used.error) document.getElementById('kpiUsed').textContent = used.data;

    // Active seats — RPC joins auth.users on our behalf so we get emails.
    var seatsRes = await client.rpc('list_corporate_seats', { target_account: currentAccount.id });
    if (seatsRes.error || !seatsRes.data || seatsRes.data.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="empty">No seats yet — invite someone above.</td></tr>';
    } else {
      body.innerHTML = seatsRes.data.map(function (s) {
        var name = s.full_name || '(no name)';
        var email = s.email || '';
        var joined = s.accepted_at ? new Date(s.accepted_at).toLocaleDateString() : '—';
        return '<tr>' +
          '<td><strong>' + escapeHtml(name) + '</strong></td>' +
          '<td>' + escapeHtml(email) + '</td>' +
          '<td><span class="pill ' + s.status + '">' + s.status + '</span></td>' +
          '<td>' + joined + '</td>' +
          '<td><button class="btn ghost small" data-remove="' + s.learner_id + '">Remove</button></td>' +
        '</tr>';
      }).join('');
      body.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () { removeSeat(btn.dataset.remove); });
      });
    }

    // Pending invites — only render the card when there are any.
    var pendingRes = await client.rpc('list_corporate_pending', { target_account: currentAccount.id });
    var pendingCard = document.getElementById('pendingCard');
    var pendingBody = document.getElementById('pendingBody');
    if (!pendingRes.error && pendingRes.data && pendingRes.data.length > 0) {
      pendingCard.hidden = false;
      pendingBody.innerHTML = pendingRes.data.map(function (p) {
        return '<tr><td>' + escapeHtml(p.email) + '</td><td>' +
          new Date(p.invited_at).toLocaleDateString() + '</td></tr>';
      }).join('');
    } else {
      pendingCard.hidden = true;
      pendingBody.innerHTML = '';
    }

    // Suggested teachers matched to account languages/cities.
    loadSuggestedTeachers();

    // Team roster (co-admins / billing / observers)
    loadTeam();
  }

  async function loadTeam() {
    var body = document.getElementById('teamBody');
    var r = await client.rpc('list_corporate_admins', { target_account: currentAccount.id });
    if (r.error) { body.innerHTML = '<tr><td colspan="4" class="empty">' + escapeHtml(r.error.message) + '</td></tr>'; return; }
    if (!r.data || r.data.length === 0) { body.innerHTML = '<tr><td colspan="4" class="empty">Just you.</td></tr>'; return; }
    body.innerHTML = r.data.map(function (m) {
      var isSelf = m.user_id === currentUser.id;
      var pill = m.role === 'admin' ? 'active' : m.role === 'billing' ? 'invited' : 'removed';
      return '<tr>' +
        '<td><strong>' + escapeHtml(m.full_name || '(no name)') + '</strong>' + (isSelf ? ' <span style="color:var(--purple); font-size:11px; font-weight:700;">YOU</span>' : '') + '</td>' +
        '<td>' + escapeHtml(m.email || '') + '</td>' +
        '<td><span class="pill ' + pill + '">' + escapeHtml(m.role) + '</span></td>' +
        '<td>' + (isSelf ? '' : '<button class="btn ghost small" data-remove-admin="' + m.user_id + '">Remove</button>') + '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('[data-remove-admin]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Remove this person from the team?')) return;
        var res = await client.rpc('corporate_admin_remove', { target_account: currentAccount.id, target_user: btn.dataset.removeAdmin });
        if (res.error) alert(res.error.message); else loadTeam();
      });
    });
  }

  async function loadSuggestedTeachers() {
    var body = document.getElementById('teachersBody');
    var res = await client.rpc('list_corporate_teachers', {
      target_account: currentAccount.id,
      page_size: 12,
      page_offset: 0,
    });
    if (res.error) {
      body.innerHTML = '<tr><td colspan="4" class="empty">Could not load: ' +
        escapeHtml(res.error.message) + '</td></tr>';
      return;
    }
    if (!res.data || res.data.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No teachers opted in for corporate lessons in your languages yet.</td></tr>';
      return;
    }
    body.innerHTML = res.data.map(function (t) {
      var langs = (t.teaches_languages || []).join(', ') || '—';
      var city = [t.city, t.country].filter(Boolean).join(', ') || '—';
      return '<tr>' +
        '<td><strong>' + escapeHtml(t.full_name || '(unnamed)') + '</strong></td>' +
        '<td>' + escapeHtml(langs) + '</td>' +
        '<td>' + escapeHtml(city) + '</td>' +
        '<td><span class="pill active">' + escapeHtml(t.teacher_audience) + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  async function removeSeat(learnerId) {
    if (!confirm('Remove this employee from your account?')) return;
    var r = await client.from('corporate_seats')
      .update({ status: 'removed' })
      .eq('account_id', currentAccount.id)
      .eq('learner_id', learnerId);
    if (r.error) alert(r.error.message);
    else loadSeats();
  }

  // Password sign-in (primary) + magic-link fallback
  document.getElementById('loginBtn').addEventListener('click', doPasswordLogin);
  document.getElementById('loginPassword').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doPasswordLogin(); }
  });
  async function doPasswordLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var pwd   = document.getElementById('loginPassword').value;
    if (!email || !pwd) return;
    var r = await client.auth.signInWithPassword({ email: email, password: pwd });
    if (r.error) showMsg('loginMsg', r.error.message, 'err');
    else refresh();
  }
  document.getElementById('magicFallback').addEventListener('click', async function (e) {
    e.preventDefault();
    var email = document.getElementById('loginEmail').value.trim();
    if (!email) { showMsg('magicMsg', 'Type your email first.', 'err'); return; }
    var r = await client.auth.signInWithOtp({
      email: email, options: { emailRedirectTo: location.href },
    });
    if (r.error) showMsg('magicMsg', r.error.message, 'err');
    else showMsg('magicMsg', '✓ Check your inbox for the sign-in link.', 'ok');
  });

  // Save account
  document.getElementById('saveAccountBtn').addEventListener('click', async function () {
    if (!currentAccount) return;
    var seats = Number(document.getElementById('seatsInput').value) || 0;
    var plan  = document.getElementById('planSelect').value;
    var langs = document.getElementById('languagesInput').value
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var r = await client.from('corporate_accounts')
      .update({ seats_purchased: seats, plan: plan, languages: langs })
      .eq('id', currentAccount.id);
    if (r.error) showMsg('accountMsg', r.error.message, 'err');
    else { showMsg('accountMsg', '✓ Saved.', 'ok'); loadAccount(); }
  });

  // Bulk invite
  document.getElementById('inviteBtn').addEventListener('click', async function () {
    if (!currentAccount) return;
    var emails = document.getElementById('inviteBox').value
      .split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!emails.length) return;
    var ok = 0, err = 0, msgs = [];
    for (var i = 0; i < emails.length; i++) {
      var r = await client.rpc('corporate_invite_seat', {
        target_account: currentAccount.id,
        target_email: emails[i]
      });
      if (r.error) { err++; msgs.push(emails[i] + ': ' + r.error.message); }
      else ok++;
    }
    var text = '✓ Invited ' + ok + (err ? ' (' + err + ' failed: ' + msgs.slice(0, 2).join('; ') + ')' : '');
    showMsg('inviteMsg', text, err ? 'err' : 'ok');
    document.getElementById('inviteBox').value = '';
    loadSeats();
  });

  document.getElementById('teamInviteBtn').addEventListener('click', async function () {
    var email = document.getElementById('teamInviteEmail').value.trim();
    var role  = document.getElementById('teamInviteRole').value;
    if (!email) return;
    var r = await client.rpc('corporate_admin_invite', {
      target_account: currentAccount.id, target_email: email, target_role: role,
    });
    if (r.error) showMsg('teamMsg', r.error.message, 'err');
    else {
      showMsg('teamMsg', '✓ Invited', 'ok');
      document.getElementById('teamInviteEmail').value = '';
      loadTeam();
    }
  });

  client.auth.onAuthStateChange(function () { refresh(); });
  refresh();
