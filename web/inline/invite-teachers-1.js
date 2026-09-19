  if (!window.DuvelaWebConfig || typeof window.DuvelaWebConfig.createSupabaseClient !== 'function') {
    document.body.innerHTML = '<div class="wrap"><div class="card"><h2>Configuration missing</h2>' +
      '<p class="lead">DuvelaWebConfig isn\'t loaded. Ensure ./web/duvela-web-config.js is served.</p></div></div>';
    throw new Error('Missing DuvelaWebConfig');
  }
  var client = window.DuvelaWebConfig.createSupabaseClient();
  var currentUser = null;
  var orgs = [];
  var selectedOrgId = null;

  function joinBase() {
    // Deep-link the teacher back to the same origin the org owner is on so
    // they land on the correct workspace after accepting.
    return location.origin + location.pathname.replace(/invite-teacher\.html.*$/, '') + 'app.html';
  }

  function showMsg(id, text, kind) {
    var el = document.getElementById(id);
    el.className = 'msg ' + (kind || 'ok');
    el.textContent = text;
    if (kind === 'ok') setTimeout(function () { el.className = 'msg'; el.textContent = ''; }, 5000);
  }

  async function boot() {
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
    await loadOrgs();
  }

  async function loadOrgs() {
    // Show every organization where the current user is admin or owner (RLS
    // hides the rest anyway, so the query is a formality — but keeping it
    // explicit makes an accidental "student in an org" case not clutter the
    // dropdown).
    var r = await client.from('organization_memberships')
      .select('organization_id, role, organizations!organization_memberships_organization_id_fkey(id, name)')
      .eq('user_id', currentUser.id)
      .eq('status', 'active')
      .in('role', ['owner', 'admin']);
    orgs = ((r.data || []).map(function (row) {
      return row.organizations
        ? { id: row.organizations.id, name: row.organizations.name, role: row.role }
        : null;
    })).filter(Boolean);
    if (!orgs.length) {
      document.getElementById('noOrg').style.display = 'block';
      document.getElementById('orgUi').style.display = 'none';
      return;
    }
    document.getElementById('orgUi').style.display = 'block';
    var select = document.getElementById('orgSelect');
    select.innerHTML = orgs.map(function (org) {
      return '<option value="' + org.id + '">' + escapeHtml(org.name) + '  ·  ' + org.role + '</option>';
    }).join('');
    selectedOrgId = orgs[0].id;
    select.value = selectedOrgId;
    select.addEventListener('change', function () {
      selectedOrgId = select.value;
      void loadPending();
    });
    await loadPending();
  }

  async function loadPending() {
    var body = document.getElementById('pendingBody');
    body.innerHTML = '<tr><td colspan="4" class="empty">Loading…</td></tr>';
    var r = await client.from('organization_invitations')
      .select('id, email, role, token, status, expires_at, created_at')
      .eq('organization_id', selectedOrgId)
      .eq('role', 'teacher')
      .order('created_at', { ascending: false });
    if (r.error) {
      body.innerHTML = '<tr><td colspan="4" class="empty">' + escapeHtml(r.error.message) + '</td></tr>';
      return;
    }
    var rows = (r.data || []).filter(function (row) { return row.status === 'pending'; });
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="4" class="empty">No pending teacher invitations. Send one above.</td></tr>';
      return;
    }
    var now = Date.now();
    body.innerHTML = rows.map(function (row) {
      var expires = new Date(row.expires_at).getTime();
      var expired = expires < now;
      var expLabel = expired ? 'Expired' : timeLeft(expires - now);
      return '<tr data-token="' + escapeHtml(row.token) + '">' +
        '<td>' + escapeHtml(row.email) + '</td>' +
        '<td><span class="pill ' + (expired ? 'expired' : 'pending') + '">' + (expired ? 'expired' : 'pending') + '</span></td>' +
        '<td>' + expLabel + '</td>' +
        '<td style="text-align:right;">' +
        (expired ? '' : '<button class="btn small ghost" data-copy="' + escapeHtml(row.token) + '">Copy link</button>') +
        '</td></tr>';
    }).join('');
    Array.prototype.forEach.call(body.querySelectorAll('[data-copy]'), function (button) {
      button.addEventListener('click', function () {
        var link = joinBase() + '?invite=' + encodeURIComponent(button.getAttribute('data-copy'));
        copyToClipboard(link, button);
      });
    });
  }

  document.getElementById('createBtn').addEventListener('click', async function () {
    var email = document.getElementById('inviteEmail').value.trim();
    if (!email || !selectedOrgId) return;
    var btn = this;
    btn.disabled = true;
    var previous = btn.textContent;
    btn.textContent = 'Creating…';
    var r = await client.rpc('create_organization_invitation', {
      target_email: email,
      target_organization_id: selectedOrgId,
      target_role: 'teacher',
    });
    btn.disabled = false;
    btn.textContent = previous;
    if (r.error) {
      showMsg('createMsg', r.error.message || 'Could not create invitation.', 'err');
      return;
    }
    var row = (r.data || [])[0];
    if (!row || !row.token) {
      showMsg('createMsg', 'The server did not return an invitation token.', 'err');
      return;
    }
    document.getElementById('createMsg').className = 'msg';
    document.getElementById('createMsg').textContent = '';
    var link = joinBase() + '?invite=' + encodeURIComponent(row.token);
    document.getElementById('linkBox').style.display = 'block';
    document.getElementById('inviteLink').value = link;
    document.getElementById('linkHint').textContent =
      'Expires ' + new Date(row.expires_at).toLocaleString();
    document.getElementById('inviteEmail').value = '';
    document.getElementById('inviteName').value = '';
    await loadPending();
  });

  document.getElementById('copyLinkBtn').addEventListener('click', function () {
    var input = document.getElementById('inviteLink');
    copyToClipboard(input.value, this);
  });

  function copyToClipboard(text, button) {
    var previous = button.textContent;
    var done = function () {
      button.textContent = 'Copied ✓';
      setTimeout(function () { button.textContent = previous; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallback);
    } else {
      fallback();
    }
    function fallback() {
      var tmp = document.createElement('textarea');
      tmp.value = text;
      tmp.setAttribute('readonly', '');
      tmp.style.position = 'absolute';
      tmp.style.left = '-9999px';
      document.body.appendChild(tmp);
      tmp.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(tmp);
      done();
    }
  }

  function timeLeft(ms) {
    if (ms <= 0) return '—';
    var days = Math.floor(ms / 86400000);
    if (days >= 1) return days + 'd left';
    var hours = Math.floor(ms / 3600000);
    if (hours >= 1) return hours + 'h left';
    return Math.floor(ms / 60000) + 'm left';
  }

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  void boot();
