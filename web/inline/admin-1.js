  if (!window.DuvelaWebConfig) {
    document.body.innerHTML = '<div class="wrap"><div class="card"><h2>Config missing</h2><p class="lead">duvela-web-config.js failed to load.</p></div></div>';
    throw new Error('Missing DuvelaWebConfig');
  }
  var client = window.DuvelaWebConfig.createSupabaseClient();
  var currentUser = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString() : '—'; }
  function fmtDateTime(d) { return d ? new Date(d).toLocaleString() : '—'; }
  function msg(id, text, kind) {
    var el = document.getElementById(id);
    el.className = 'msg ' + (kind || 'ok'); el.textContent = text;
    if (kind === 'ok') setTimeout(function () { el.className = 'msg'; }, 3500);
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      var name = t.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(function (p) {
        p.hidden = p.dataset.panel !== name;
      });
      if (name === 'overview')   { loadKpis(); loadSignups(); }
      if (name === 'leads')      { loadLeads(); }
      if (name === 'accounts')   { loadAccounts(); }
      if (name === 'moderation') { loadReports(); }
      if (name === 'finance')    { loadFinance(); }
      if (name === 'bulk')       { loadBulkAccounts(); }
      if (name === 'media')      { loadBunny(); }
      if (name === 'audit')      { loadAudit(); }
    });
  });

  // ── Media (Bunny Stream) ─────────────────────────────────────────────────
  async function loadBunny() {
    var kpi = document.getElementById('bunnyKpi');
    var body = document.getElementById('bunnyTopBody');
    kpi.innerHTML = '<div class="empty">Loading…</div>';
    body.innerHTML = '<tr><td colspan="8" class="empty">Loading…</td></tr>';

    var statsRes = await client.rpc('admin_bunny_stats');
    if (statsRes.error) {
      kpi.innerHTML = '<div class="empty">' + esc(statsRes.error.message) + '</div>';
    } else {
      var s = (statsRes.data && statsRes.data[0]) || {};
      var mb = (s.total_storage_bytes || 0) / (1024 * 1024);
      var storageLabel = mb >= 1024 ? (mb / 1024).toFixed(2) + ' GB' : mb.toFixed(1) + ' MB';
      var hours = Math.round((s.total_watch_time_seconds || 0) / 36) / 100;
      kpi.innerHTML = [
        ['Total posts',        s.posts_total || 0],
        ['Finished',           s.posts_finished || 0],
        ['Processing',         s.posts_processing || 0],
        ['Deleted at CDN',     s.posts_deleted_at_cdn || 0],
        ['Never synced',       s.posts_never_synced || 0],
        ['Total views',        Number(s.total_views || 0).toLocaleString()],
        ['Watch time',         hours.toLocaleString() + ' h'],
        ['CDN storage',        storageLabel],
        ['Synced <2h',         s.synced_recently || 0],
        ['Stale >2h',          s.synced_stale || 0],
      ].map(function (row) {
        return '<div class="kpi"><div class="kpi-num">' + row[1] + '</div><div class="kpi-label">' + row[0] + '</div></div>';
      }).join('');
    }

    var topRes = await client.rpc('admin_bunny_top_posts', { limit_rows: 25 });
    if (topRes.error || !topRes.data || topRes.data.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty">' + (topRes.error ? esc(topRes.error.message) : 'No Bunny videos yet.') + '</td></tr>';
      return;
    }
    body.innerHTML = topRes.data.map(function (p) {
      var thumb = p.bunny_thumbnail_url || '';
      var statusPill = p.bunny_status === 'finished' ? 'active' :
                       p.bunny_status === 'deleted'  ? 'cancelled' :
                       p.bunny_status === 'error' || p.bunny_status === 'upload_failed' ? 'cancelled' :
                       'trial';
      return '<tr>' +
        '<td><a href="' + esc(thumb) + '" target="_blank">' +
          (thumb
            ? '<img src="' + esc(thumb) + '" style="width:56px;height:32px;object-fit:cover;border-radius:6px;" alt="">'
            : '<span style="display:inline-block;width:56px;height:32px;background:#F1ECFF;border-radius:6px;"></span>') +
        '</a></td>' +
        '<td>' + esc(p.author_name || '') + '<br><span style="color:var(--ink-muted);font-size:11px;">' + esc(p.author_email || '') + '</span></td>' +
        '<td>' + esc((p.caption || '').slice(0, 60)) + (p.caption && p.caption.length > 60 ? '…' : '') + '</td>' +
        '<td><strong>' + Number(p.bunny_view_count || 0).toLocaleString() + '</strong></td>' +
        '<td>' + Math.round((p.bunny_watch_time_seconds || 0) / 60) + ' min</td>' +
        '<td>' + (p.bunny_length_seconds ? p.bunny_length_seconds + 's' : '—') + '</td>' +
        '<td><span class="pill ' + statusPill + '">' + esc(p.bunny_status) + '</span></td>' +
        '<td class="tight">' + (p.bunny_last_synced_at ? fmtDateTime(p.bunny_last_synced_at) : '—') + '</td>' +
      '</tr>';
    }).join('');
  }

  async function invokeBunnyOp(fnName, dry) {
    var base = (window.DuvelaWebConfig && window.DuvelaWebConfig.supabaseUrl) || '';
    var url = base + '/functions/v1/' + fnName + (dry ? '?dry=1' : '');
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    var text = await res.text();
    return { ok: res.ok, status: res.status, text: text };
  }

  document.getElementById('bunnySyncNowBtn').addEventListener('click', async function () {
    msg('bunnyOpsMsg', 'Running analytics sync…', 'ok');
    var r = await invokeBunnyOp('bunny-analytics-sync', false);
    msg('bunnyOpsMsg', r.ok ? '✓ Sync: ' + r.text : 'FAIL ' + r.status + ': ' + r.text, r.ok ? 'ok' : 'err');
    if (r.ok) loadBunny();
  });
  document.getElementById('bunnyCleanupDryBtn').addEventListener('click', async function () {
    msg('bunnyOpsMsg', 'Running dry-run cleanup…', 'ok');
    var r = await invokeBunnyOp('bunny-cleanup-orphans', true);
    msg('bunnyOpsMsg', r.ok ? '✓ Dry-run: ' + r.text : 'FAIL ' + r.status + ': ' + r.text, r.ok ? 'ok' : 'err');
  });
  document.getElementById('bunnyCleanupRunBtn').addEventListener('click', async function () {
    if (!confirm('Delete all orphaned Bunny videos (>24h old, not referenced by any post)? This is irreversible.')) return;
    msg('bunnyOpsMsg', 'Running cleanup…', 'ok');
    var r = await invokeBunnyOp('bunny-cleanup-orphans', false);
    msg('bunnyOpsMsg', r.ok ? '✓ Cleanup: ' + r.text : 'FAIL ' + r.status + ': ' + r.text, r.ok ? 'ok' : 'err');
    if (r.ok) loadBunny();
  });

  // ── Moderation ───────────────────────────────────────────────────────────
  document.getElementById('modKind').addEventListener('change', loadReports);
  document.getElementById('modOnlyOpen').addEventListener('change', loadReports);
  async function loadReports() {
    var body = document.getElementById('modBody');
    var r = await client.rpc('admin_list_reports', {
      report_kind: document.getElementById('modKind').value,
      only_open: document.getElementById('modOnlyOpen').checked,
      limit_rows: 100,
    });
    if (r.error) { body.innerHTML = '<tr><td colspan="6" class="empty">' + esc(r.error.message) + '</td></tr>'; return; }
    if (!r.data || r.data.length === 0) { body.innerHTML = '<tr><td colspan="6" class="empty">No reports.</td></tr>'; return; }
    body.innerHTML = r.data.map(function (rr) {
      var actionBtn = '';
      if (rr.kind === 'media') {
        actionBtn = (rr.status === 'open')
          ? '<button class="btn small" data-resolve="' + rr.id + '">Resolve</button> '
            + '<button class="btn small danger" data-hide="' + rr.target_id + '">Hide post</button>'
          : '<span class="pill handled">' + esc(rr.status) + '</span>';
      } else {
        actionBtn = '<button class="btn small danger" data-ban="' + rr.reported_user_id + '">Ban user</button>';
      }
      return '<tr>' +
        '<td class="tight">' + fmtDateTime(rr.created_at) + '</td>' +
        '<td>' + esc(rr.reporter_email || '—') + '</td>' +
        '<td>' + esc(rr.reported_user_email || '—') +
          '<br><span style="color:var(--ink-muted); font-size:11px;">' + esc(rr.reported_user_id || '') + '</span></td>' +
        '<td>' + esc(rr.reason || '—') + '</td>' +
        '<td>' + (rr.status === 'open' ? '<span class="pill open">' + esc(rr.status) + '</span>' :
                                          '<span class="pill handled">' + esc(rr.status) + '</span>') + '</td>' +
        '<td>' + actionBtn + '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('[data-resolve]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var note = prompt('Resolution note (optional):') || null;
        var res = await client.rpc('admin_resolve_media_report', { report_id: b.dataset.resolve, note: note });
        if (res.error) alert(res.error.message); else loadReports();
      });
    });
    body.querySelectorAll('[data-hide]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Hide this post?')) return;
        var res = await client.rpc('admin_hide_post', { post_id: b.dataset.hide, reason: 'from moderation queue' });
        if (res.error) alert(res.error.message); else msg('modMsg', '✓ Post hidden', 'ok');
      });
    });
    body.querySelectorAll('[data-ban]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var reason = prompt('Ban reason:') || 'abuse';
        var res = await client.rpc('admin_ban_user', { target_user: b.dataset.ban, reason: reason });
        if (res.error) alert(res.error.message); else msg('modMsg', '✓ User banned', 'ok');
      });
    });
  }

  document.getElementById('modHideBtn').addEventListener('click', async function () {
    var id = document.getElementById('modPostId').value.trim();
    if (!id) return;
    var r = await client.rpc('admin_hide_post', { post_id: id, reason: document.getElementById('modHideReason').value.trim() || null });
    msg('modMsg', r.error ? r.error.message : '✓ Post hidden', r.error ? 'err' : 'ok');
  });
  document.getElementById('modUnhideBtn').addEventListener('click', async function () {
    var id = document.getElementById('modPostId').value.trim();
    if (!id) return;
    var r = await client.rpc('admin_unhide_post', { post_id: id });
    msg('modMsg', r.error ? r.error.message : '✓ Post unhidden', r.error ? 'err' : 'ok');
  });
  document.getElementById('modBanBtn').addEventListener('click', async function () {
    var id = document.getElementById('modUserId').value.trim();
    var reason = document.getElementById('modBanReason').value.trim() || 'abuse';
    if (!id) return;
    var r = await client.rpc('admin_ban_user', { target_user: id, reason: reason });
    msg('modMsg', r.error ? r.error.message : '✓ User banned', r.error ? 'err' : 'ok');
  });
  document.getElementById('modUnbanBtn').addEventListener('click', async function () {
    var id = document.getElementById('modUserId').value.trim();
    if (!id) return;
    var r = await client.rpc('admin_unban_user', { target_user: id });
    msg('modMsg', r.error ? r.error.message : '✓ User unbanned', r.error ? 'err' : 'ok');
  });

  // ── Finance ──────────────────────────────────────────────────────────────
  document.getElementById('finDays').addEventListener('change', loadFinance);
  async function loadFinance() {
    var days = parseInt(document.getElementById('finDays').value, 10);
    var summary = await client.rpc('admin_financial_summary', { days: days });
    var kpi = document.getElementById('finKpi');
    if (summary.error) { kpi.innerHTML = '<div class="empty">' + esc(summary.error.message) + '</div>'; }
    else {
      var s = (summary.data && summary.data[0]) || {};
      kpi.innerHTML = [
        ['MRR', '€' + Number(s.mrr_eur || 0).toLocaleString()],
        ['Active accounts', s.active_accounts || 0],
        ['Trials', s.trial_accounts || 0],
        ['Coin revenue (' + days + 'd)', (s.coin_revenue_period || 0) + ' coins'],
        ['Coin purchases (' + days + 'd)', s.coin_purchases_count || 0],
        ['Top account', esc(s.top_account_name || '—') + ' <span style="color:var(--purple); font-size:12px;">€' + Number(s.top_account_mrr || 0).toLocaleString() + '</span>'],
      ].map(function (row) {
        return '<div class="kpi"><div class="kpi-num">' + row[1] + '</div><div class="kpi-label">' + row[0] + '</div></div>';
      }).join('');
    }

    var accRes = await client.rpc('admin_revenue_by_account');
    var accBody = document.getElementById('finAccountsBody');
    if (accRes.error || !accRes.data || accRes.data.length === 0) {
      accBody.innerHTML = '<tr><td colspan="6" class="empty">No revenue data.</td></tr>';
    } else {
      accBody.innerHTML = accRes.data.map(function (a) {
        return '<tr>' +
          '<td><strong>' + esc(a.company_name) + '</strong></td>' +
          '<td>' + esc((a.plan || '').replace('_',' ')) + '</td>' +
          '<td>' + a.seats_purchased + '</td>' +
          '<td>€' + a.monthly_price_per_seat + '</td>' +
          '<td><strong>€' + Number(a.monthly_revenue).toLocaleString() + '</strong></td>' +
          '<td><span class="pill ' + a.status + '">' + a.status + '</span></td>' +
        '</tr>';
      }).join('');
    }

    var txRes = await client.rpc('admin_list_coin_transactions', { days: 30, limit_rows: 100 });
    var txBody = document.getElementById('finTxBody');
    if (txRes.error || !txRes.data || txRes.data.length === 0) {
      txBody.innerHTML = '<tr><td colspan="6" class="empty">No coin transactions.</td></tr>';
    } else {
      txBody.innerHTML = txRes.data.map(function (t) {
        var sign = t.amount >= 0 ? '+' : '';
        var color = t.amount >= 0 ? 'var(--teal)' : 'var(--red)';
        return '<tr>' +
          '<td class="tight">' + fmtDateTime(t.created_at) + '</td>' +
          '<td>' + esc(t.user_email || '') + '</td>' +
          '<td style="color:' + color + '; font-weight:700;">' + sign + t.amount + '</td>' +
          '<td>' + (t.balance_after || 0) + '</td>' +
          '<td>' + esc(t.source || '') + '</td>' +
          '<td>' + esc(t.label || '') + '</td>' +
        '</tr>';
      }).join('');
    }
  }

  // ── Bulk ops ─────────────────────────────────────────────────────────────
  async function loadBulkAccounts() {
    var sel = document.getElementById('bulkAccount');
    var r = await client.rpc('admin_list_corporate_accounts', { status_filter: null });
    if (r.error) { sel.innerHTML = '<option>' + esc(r.error.message) + '</option>'; return; }
    sel.innerHTML = '<option value="">— choose account —</option>' + (r.data || []).map(function (a) {
      return '<option value="' + a.id + '">' + esc(a.company_name) + ' · ' + a.seats_used + '/' + a.seats_purchased + '</option>';
    }).join('');
  }
  document.getElementById('bulkEmails').addEventListener('input', function () {
    var count = (this.value.split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean)).length;
    document.getElementById('bulkCount').textContent = count ? count + ' email(s)' : '';
  });
  document.getElementById('bulkSubmitBtn').addEventListener('click', async function () {
    var accId = document.getElementById('bulkAccount').value;
    if (!accId) { msg('bulkMsg', 'Choose an account first.', 'err'); return; }
    var emails = document.getElementById('bulkEmails').value.split(/[\n,;]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!emails.length) return;
    var r = await client.rpc('admin_bulk_invite_seats', { target_account: accId, emails: emails });
    if (r.error) { msg('bulkMsg', r.error.message, 'err'); return; }
    var tbl = document.getElementById('bulkResults');
    var body = document.getElementById('bulkResultsBody');
    tbl.hidden = false;
    body.innerHTML = (r.data || []).map(function (row) {
      var pill = row.outcome === 'activated' ? 'active' :
                 row.outcome === 'pending'   ? 'trial'  :
                 row.outcome === 'skipped'   ? 'paused' : 'cancelled';
      return '<tr><td>' + esc(row.email) + '</td><td><span class="pill ' + pill + '">' + esc(row.outcome) + '</span></td><td>' + esc(row.detail || '') + '</td></tr>';
    }).join('');
    var ok = (r.data || []).filter(function (x) { return x.outcome === 'activated' || x.outcome === 'pending'; }).length;
    msg('bulkMsg', '✓ Processed ' + (r.data || []).length + ' emails, ' + ok + ' successful.', 'ok');
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function refresh() {
    var s = await client.auth.getSession();
    currentUser = s.data.session ? s.data.session.user : null;
    if (!currentUser) {
      document.getElementById('signedOut').style.display = 'block';
      document.getElementById('signedIn').style.display = 'none';
      document.getElementById('notAdmin').style.display = 'none';
      return;
    }
    var check = await client.rpc('is_admin');
    if (check.error || !check.data) {
      document.getElementById('signedOut').style.display = 'none';
      document.getElementById('signedIn').style.display = 'none';
      document.getElementById('notAdmin').style.display = 'block';
      document.getElementById('signOutBtn2').onclick = async function () {
        await client.auth.signOut(); location.reload();
      };
      return;
    }
    document.getElementById('signedOut').style.display = 'none';
    document.getElementById('notAdmin').style.display = 'none';
    document.getElementById('signedIn').style.display = 'block';
    document.getElementById('who').innerHTML =
      esc(currentUser.email) + ' · <strong>admin</strong>' +
      '<button id="signOutBtn">Sign out</button>';
    document.getElementById('signOutBtn').onclick = async function () {
      await client.auth.signOut(); location.reload();
    };
    loadKpis(); loadSignups();
  }

  document.getElementById('loginBtn').addEventListener('click', doPasswordLogin);
  document.getElementById('loginPassword').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); doPasswordLogin(); }
  });
  async function doPasswordLogin() {
    var email = document.getElementById('loginEmail').value.trim();
    var pwd   = document.getElementById('loginPassword').value;
    if (!email || !pwd) return;
    var r = await client.auth.signInWithPassword({ email: email, password: pwd });
    if (r.error) msg('loginMsg', r.error.message, 'err');
    else refresh();
  }
  document.getElementById('magicFallback').addEventListener('click', async function (e) {
    e.preventDefault();
    var email = document.getElementById('loginEmail').value.trim();
    if (!email) { msg('magicMsg', 'Type your email first.', 'err'); return; }
    var r = await client.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.href } });
    if (r.error) msg('magicMsg', r.error.message, 'err');
    else msg('magicMsg', '✓ Check your inbox for the sign-in link.', 'ok');
  });

  // ── Overview ──────────────────────────────────────────────────────────────
  async function loadKpis() {
    var r = await client.rpc('admin_platform_kpis');
    var grid = document.getElementById('kpiGrid');
    if (r.error) { grid.innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>'; return; }
    var k = (r.data && r.data[0]) || {};
    grid.innerHTML = [
      ['Total users', k.total_users],
      ['New (7d)', k.new_users_7d],
      ['Teachers', k.teachers + ' <span style="color: var(--purple); font-size: 12px;">(' + k.teachers_b2b + ' b2b)</span>'],
      ['Corp accounts', k.live_corporate_accounts],
      ['Seats sold / active', (k.seats_sold_total || 0) + ' / ' + (k.seats_active_total || 0)],
      ['Open leads', k.open_leads],
      ['MRR', '€' + Number(k.mrr_eur || 0).toLocaleString()],
    ].map(function (row) {
      return '<div class="kpi"><div class="kpi-num">' + row[1] + '</div><div class="kpi-label">' + row[0] + '</div></div>';
    }).join('');
  }

  async function loadSignups() {
    var r = await client.rpc('admin_list_recent_signups', { days_back: 7 });
    var body = document.getElementById('signupsBody');
    // Distinguish "no rows in the window" from "RPC failed" — the previous
    // check collapsed both into the empty state, hiding real bugs (RLS
    // rejection, function rename, timeout) behind a misleading message.
    if (r.error) {
      body.innerHTML = '<tr><td colspan="3" class="empty">Failed to load: ' + esc(r.error.message || 'unknown error') + '</td></tr>';
      return;
    }
    if (!r.data || r.data.length === 0) {
      body.innerHTML = '<tr><td colspan="3" class="empty">No signups in the last 7 days.</td></tr>'; return;
    }
    body.innerHTML = r.data.map(function (u) {
      return '<tr><td><strong>' + esc(u.full_name || '(no name)') + '</strong></td>' +
             '<td>' + esc(u.email || '') + '</td>' +
             '<td class="tight">' + fmtDate(u.created_at) + '</td></tr>';
    }).join('');
  }

  // ── Leads ────────────────────────────────────────────────────────────────
  var showHandled = false;
  document.getElementById('toggleAllLeads').addEventListener('click', function () {
    showHandled = !showHandled;
    this.textContent = showHandled ? 'Show only open' : 'Show handled too';
    loadLeads();
  });

  async function loadLeads() {
    var r = await client.rpc('admin_list_corporate_leads', { only_open: !showHandled });
    var body = document.getElementById('leadsBody');
    if (r.error) {
      body.innerHTML = '<tr><td colspan="7" class="empty">Failed to load: ' + esc(r.error.message || 'unknown error') + '</td></tr>'; return;
    }
    if (!r.data || r.data.length === 0) {
      body.innerHTML = '<tr><td colspan="7" class="empty">No leads.</td></tr>'; return;
    }
    body.innerHTML = r.data.map(function (l) {
      return '<tr>' +
        '<td><strong>' + esc(l.company_name) + '</strong></td>' +
        '<td>' + esc(l.contact_name) + '<br><span style="color:var(--ink-soft); font-size:11.5px;">' + esc(l.contact_email) + '</span></td>' +
        '<td>' + esc(l.team_size || '—') + '</td>' +
        '<td>' + esc(l.plan || '—') + '</td>' +
        '<td class="tight">' + fmtDate(l.created_at) + '</td>' +
        '<td>' + (l.handled ? '<span class="pill handled">handled</span>' : '<span class="pill open">open</span>') + '</td>' +
        '<td>' + (l.handled
          ? ''
          : '<button class="btn small" data-convert="' + l.id + '">Convert →</button>') + '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('[data-convert]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lead = r.data.find(function (x) { return x.id === btn.dataset.convert; });
        openConvertDialog(lead);
      });
    });
  }

  function openConvertDialog(lead) {
    document.getElementById('cvLeadId').value = lead ? lead.id : '';
    document.getElementById('cvCompany').value = lead ? lead.company_name : '';
    document.getElementById('cvHrEmail').value = lead ? lead.contact_email : '';
    document.getElementById('cvPlan').value = (lead && lead.plan) || 'full_package';
    document.getElementById('convertTitle').textContent = lead ? 'Convert lead to account' : 'Create corporate account';
    document.getElementById('convertLead').textContent = lead ? ('Lead: ' + lead.company_name + ' · ' + lead.contact_email) : '';
    document.getElementById('convertDialog').showModal();
  }
  document.getElementById('cvCancel').addEventListener('click', function () {
    document.getElementById('convertDialog').close();
  });
  document.getElementById('newAccountBtn').addEventListener('click', function () { openConvertDialog(null); });
  document.getElementById('cvSubmit').addEventListener('click', async function () {
    var body = {
      lead_id: document.getElementById('cvLeadId').value || null,
      target_company: document.getElementById('cvCompany').value.trim(),
      target_hr_email: document.getElementById('cvHrEmail').value.trim(),
      target_seats: parseInt(document.getElementById('cvSeats').value, 10) || 0,
      target_plan: document.getElementById('cvPlan').value,
      target_price_per_seat: parseFloat(document.getElementById('cvPrice').value) || null,
      target_languages: document.getElementById('cvLangs').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      target_cities: document.getElementById('cvCities').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    };
    if (!body.target_company || !body.target_hr_email || body.target_seats < 1) {
      msg('cvMsg', 'Company, HR email and seats are required.', 'err'); return;
    }
    var r = await client.rpc('admin_convert_lead_to_account', body);
    if (r.error) { msg('cvMsg', r.error.message, 'err'); return; }
    msg('cvMsg', '✓ Account created: ' + r.data, 'ok');
    setTimeout(function () {
      document.getElementById('convertDialog').close();
      loadLeads(); loadKpis();
    }, 800);
  });

  // ── Accounts ─────────────────────────────────────────────────────────────
  document.getElementById('accountStatusFilter').addEventListener('change', loadAccounts);
  async function loadAccounts() {
    var status = document.getElementById('accountStatusFilter').value || null;
    var r = await client.rpc('admin_list_corporate_accounts', { status_filter: status });
    var body = document.getElementById('accountsBody');
    if (r.error) {
      body.innerHTML = '<tr><td colspan="8" class="empty">Failed to load: ' + esc(r.error.message || 'unknown error') + '</td></tr>'; return;
    }
    if (!r.data || r.data.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="empty">No accounts.</td></tr>'; return;
    }
    body.innerHTML = r.data.map(function (a) {
      return '<tr>' +
        '<td><strong>' + esc(a.company_name) + '</strong></td>' +
        '<td>' + esc(a.hr_email || '—') + '</td>' +
        '<td>' + esc((a.plan || '').replace('_', ' ')) + '</td>' +
        '<td>' + esc(a.seats_used + ' / ' + a.seats_purchased) + '</td>' +
        '<td>€' + esc(a.monthly_price_per_seat || 0) + '</td>' +
        '<td><span class="pill ' + a.status + '">' + a.status + '</span></td>' +
        '<td class="tight">' + fmtDate(a.created_at) + '</td>' +
        '<td>' +
          '<button class="btn ghost small" data-edit="' + a.id + '">Edit</button> ' +
          (a.status === 'cancelled' ? '' :
            '<button class="btn small danger" data-cancel="' + a.id + '">Cancel</button>') +
        '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = r.data.find(function (x) { return x.id === btn.dataset.edit; });
        openEditDialog(a);
      });
    });
    body.querySelectorAll('[data-cancel]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('Cancel this corporate account?')) return;
        var res = await client.rpc('admin_cancel_corporate_account', { target_account: btn.dataset.cancel });
        if (res.error) alert(res.error.message); else { loadAccounts(); loadKpis(); }
      });
    });
  }

  function openEditDialog(a) {
    document.getElementById('edAccountId').value = a.id;
    document.getElementById('edSeats').value = a.seats_purchased;
    document.getElementById('edPlan').value = a.plan;
    document.getElementById('edPrice').value = a.monthly_price_per_seat || '';
    document.getElementById('edStatus').value = a.status;
    document.getElementById('edHrEmail').value = '';
    document.getElementById('editDialog').showModal();
  }
  document.getElementById('edCancel').addEventListener('click', function () {
    document.getElementById('editDialog').close();
  });
  document.getElementById('edSubmit').addEventListener('click', async function () {
    var payload = {
      target_account: document.getElementById('edAccountId').value,
      new_seats:  parseInt(document.getElementById('edSeats').value, 10) || null,
      new_plan:   document.getElementById('edPlan').value || null,
      new_price:  parseFloat(document.getElementById('edPrice').value) || null,
      new_status: document.getElementById('edStatus').value || null,
      new_hr_email: document.getElementById('edHrEmail').value.trim() || null,
    };
    var r = await client.rpc('admin_update_corporate_account', payload);
    if (r.error) { msg('edMsg', r.error.message, 'err'); return; }
    msg('edMsg', '✓ Saved.', 'ok');
    setTimeout(function () { document.getElementById('editDialog').close(); loadAccounts(); }, 700);
  });

  // ── Users ────────────────────────────────────────────────────────────────
  document.getElementById('searchUsersBtn').addEventListener('click', loadUsers);
  document.getElementById('userQuery').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); loadUsers(); }
  });
  async function loadUsers() {
    var q = document.getElementById('userQuery').value.trim();
    var body = document.getElementById('usersBody');
    body.innerHTML = '<tr><td colspan="6" class="empty">Searching…</td></tr>';
    var r = await client.rpc('admin_search_users', { query: q, page_size: 30 });
    if (r.error) { body.innerHTML = '<tr><td colspan="6" class="empty">' + esc(r.error.message) + '</td></tr>'; return; }
    if (!r.data || r.data.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="empty">No matches.</td></tr>'; return;
    }
    body.innerHTML = r.data.map(function (u) {
      function chk(f, v) {
        return '<label style="display:inline-flex; align-items:center; gap:4px; margin-right: 8px; font-size:12px;">' +
          '<input type="checkbox" data-flag="' + f + '" data-user="' + u.id + '"' + (v ? ' checked' : '') + '> ' + f.replace('is_','') +
        '</label>';
      }
      // Role drives is_teacher / is_organizer now (they're derived by a DB
      // trigger and can't be toggled directly), so those two show as a role
      // dropdown. is_verified / is_admin stay as independent checkboxes.
      function roleSelect(uid, current) {
        var roles = ['learner', 'teacher', 'organizer', 'organization'];
        return '<select data-role-user="' + uid + '" style="font-size:12px; padding:3px 6px; border-radius:6px;">' +
          roles.map(function (rr) {
            return '<option value="' + rr + '"' + (rr === (current || 'learner') ? ' selected' : '') + '>' + rr + '</option>';
          }).join('') +
        '</select>';
      }
      return '<tr>' +
        '<td><strong>' + esc(u.full_name || '(no name)') + '</strong></td>' +
        '<td>' + esc(u.email || '—') + '</td>' +
        '<td>' + esc([u.city, u.country].filter(Boolean).join(', ') || '—') + '</td>' +
        '<td>' + roleSelect(u.id, u.registered_web_role) +
                 '<div style="margin-top:6px;">' + chk('is_verified', u.is_verified) + chk('is_admin', u.is_admin) + '</div></td>' +
        '<td>' + esc(u.teacher_audience || '—') + '</td>' +
        '<td class="tight">' + fmtDate(u.created_at) + '</td>' +
      '</tr>';
    }).join('');
    body.querySelectorAll('input[data-flag]').forEach(function (chk) {
      chk.addEventListener('change', async function () {
        var res = await client.rpc('admin_set_profile_flag', {
          target_user: chk.dataset.user, flag: chk.dataset.flag, value: chk.checked,
        });
        if (res.error) { alert(res.error.message); chk.checked = !chk.checked; }
      });
    });
    body.querySelectorAll('select[data-role-user]').forEach(function (sel) {
      var prev = sel.value;
      sel.addEventListener('change', async function () {
        var res = await client.rpc('admin_set_account_role', {
          target_user: sel.dataset.roleUser, new_role: sel.value,
        });
        if (res.error) { alert(res.error.message); sel.value = prev; }
        else { prev = sel.value; }
      });
    });
  }

  // ── Audit ────────────────────────────────────────────────────────────────
  async function loadAudit() {
    var r = await client.rpc('admin_recent_audit', { limit_rows: 100 });
    var body = document.getElementById('auditBody');
    if (r.error) {
      body.innerHTML = '<tr><td colspan="5" class="empty">Failed to load: ' + esc(r.error.message || 'unknown error') + '</td></tr>'; return;
    }
    if (!r.data || r.data.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="empty">No entries yet.</td></tr>'; return;
    }
    body.innerHTML = r.data.map(function (l) {
      var payload = l.payload ? JSON.stringify(l.payload) : '';
      return '<tr>' +
        '<td class="tight">' + fmtDateTime(l.created_at) + '</td>' +
        '<td>' + esc(l.admin_email || '—') + '</td>' +
        '<td><strong>' + esc(l.action) + '</strong></td>' +
        '<td>' + esc(l.target_table || '') +
          (l.target_id ? '<br><span style="color:var(--ink-muted); font-size:11px;">' + esc(l.target_id) + '</span>' : '') + '</td>' +
        '<td style="font-family: ui-monospace, monospace; font-size:11.5px; color:var(--ink-soft); max-width:340px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(payload) + '</td>' +
      '</tr>';
    }).join('');
  }

  client.auth.onAuthStateChange(function () { refresh(); });
  refresh();
