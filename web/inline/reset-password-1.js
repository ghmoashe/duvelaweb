  if (!window.DuvelaWebConfig) {
    document.body.innerHTML = '<div class="card"><h1>Config missing</h1></div>';
    throw new Error('Missing DuvelaWebConfig');
  }
  var client = window.DuvelaWebConfig.createSupabaseClient();

  function show(which) {
    ['loadingView','setView','errView'].forEach(function (id) {
      document.getElementById(id).hidden = id !== which;
    });
  }
  function msg(text, kind) {
    var el = document.getElementById('msg');
    el.className = 'msg ' + kind; el.textContent = text;
  }

  // Password strength (simple heuristic)
  document.getElementById('newPwd').addEventListener('input', function () {
    var v = this.value;
    var s = document.getElementById('strength');
    if (!v) { s.textContent = ''; s.className = 'strength'; return; }
    var score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    if (score <= 2) { s.textContent = 'Weak'; s.className = 'strength weak'; }
    else if (score <= 3) { s.textContent = 'OK'; s.className = 'strength medium'; }
    else { s.textContent = 'Strong'; s.className = 'strength strong'; }
  });

  document.getElementById('saveBtn').addEventListener('click', savePassword);
  document.getElementById('confirmPwd').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); savePassword(); }
  });
  async function savePassword() {
    var p1 = document.getElementById('newPwd').value;
    var p2 = document.getElementById('confirmPwd').value;
    if (p1.length < 8) { msg('Password must be at least 8 characters.', 'err'); return; }
    if (p1 !== p2)     { msg('Passwords don\'t match.', 'err'); return; }

    var btn = document.getElementById('saveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    var r = await client.auth.updateUser({ password: p1 });
    btn.disabled = false; btn.textContent = 'Save password';
    if (r.error) { msg(r.error.message, 'err'); return; }

    msg('✓ Password saved. Redirecting…', 'ok');
    // Route by admin flag if we can tell.
    setTimeout(async function () {
      var check = await client.rpc('is_admin');
      var target = (check && check.data === true) ? './admin.html' : './business-admin.html';
      window.location.replace(target);
    }, 900);
  }

  // Supabase JS auto-detects recovery tokens in the URL hash on load. We
  // listen for the resulting event and only show the form once the client
  // has a session — otherwise the updateUser call would fail silently.
  client.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
      var setLead = document.getElementById('setLead');
      if (session && session.user && session.user.email) {
        setLead.textContent = 'Signed in as ' + session.user.email + '. Choose a new password to finish.';
      }
      show('setView');
    }
  });

  // If there's no hash (someone hit the URL directly) OR the token failed
  // silently, fall back to the error view after a short delay.
  (async function () {
    var s = await client.auth.getSession();
    var hasHash = /access_token|type=recovery/.test(location.hash || '');
    if (s.data.session) {
      show('setView');
      return;
    }
    if (!hasHash) {
      show('errView');
      document.getElementById('errLead').textContent =
        "You reached this page without a recovery link. If you meant to sign in, use the admin or HR sign-in page.";
      return;
    }
    // Give supabase a moment to process the hash.
    setTimeout(async function () {
      var s2 = await client.auth.getSession();
      if (!s2.data.session) show('errView');
    }, 1500);
  })();
