  // Pricing card CTA — prefill contact form with chosen plan.
  // (Self-serve Stripe checkout is offered separately via the "Buy now"
  // buttons below; the pricing cards themselves still route to sales so
  // the contact form path always works even without Stripe configured.)
  document.querySelectorAll('.price-cta').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var plan = btn.dataset.plan;
      var sel = document.getElementById('fPlan');
      if (plan && sel) sel.value = plan;
      document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
      setTimeout(function () { document.getElementById('fName').focus(); }, 500);
    });
  });

  // Self-serve Stripe checkout — attached to elements with data-buy-now.
  // Triggers the stripe-create-checkout edge function; requires
  // STRIPE_SECRET_KEY + STRIPE_PRICE_* env vars to be set on Supabase.
  // Falls back to the contact form section if the function returns 503.
  document.querySelectorAll('[data-buy-now]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var plan = btn.dataset.buyNow;
      var seats = prompt('How many seats?', '5');
      if (!seats) return;
      var email = prompt('Your work email:', '');
      if (!email) return;
      var company = prompt('Company name:', '');
      if (!company) return;

      btn.disabled = true;
      var originalText = btn.textContent;
      btn.textContent = 'Opening Stripe…';
      try {
        var checkoutBase = (window.DuvelaWebConfig && window.DuvelaWebConfig.supabaseUrl) || '';
        var res = await fetch(
          checkoutBase + '/functions/v1/stripe-create-checkout',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              plan: plan, seats: parseInt(seats, 10),
              hr_email: email, company_name: company,
            }),
          },
        );
        var data = await res.json();
        if (res.ok && data.url) {
          window.location.href = data.url;
        } else {
          alert('Checkout is not available yet. Please use the contact form below.\n\n' +
                (data.error || 'Reason: ' + res.status));
          document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {
        alert('Network error — please use the contact form below.');
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  // Form submit — writes to `corporate_leads` (falls back to mailto if the table
  // isn't there yet, so the page works before the migration lands).
  var form = document.getElementById('b2bForm');
  var note = document.getElementById('fNote');
  var client = null;
  try {
    if (window.DuvelaWebConfig && typeof window.DuvelaWebConfig.createSupabaseClient === 'function') {
      client = window.DuvelaWebConfig.createSupabaseClient();
    }
  } catch (_) { client = null; }

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var payload = {
      contact_name:  document.getElementById('fName').value.trim(),
      company_name:  document.getElementById('fCompany').value.trim(),
      contact_email: document.getElementById('fEmail').value.trim(),
      team_size:     document.getElementById('fSeats').value,
      plan:          document.getElementById('fPlan').value,
      notes:         document.getElementById('fNotes').value.trim()
    };

    note.classList.remove('err');
    note.classList.add('show');
    note.textContent = 'Sending…';

    // Try Supabase insert; fall back to mailto if the config didn't load.
    try {
      if (!client) throw new Error('No client');
      var res = await client.from('corporate_leads').insert(payload);
      if (res.error) throw res.error;
      note.textContent = '✓ Got it — we\'ll be in touch within 24 h.';
      form.reset();
      return;
    } catch (err) {
      // Graceful fallback
      var body = encodeURIComponent(
        'Company: ' + payload.company_name + '\n' +
        'Contact: ' + payload.contact_name + ' <' + payload.contact_email + '>\n' +
        'Team size: ' + payload.team_size + '\n' +
        'Plan: ' + payload.plan + '\n\n' +
        payload.notes
      );
      window.location.href = 'mailto:hello@vela.cafe?subject=' +
        encodeURIComponent('Duvela for Business — ' + payload.company_name) +
        '&body=' + body;
      note.textContent = '✓ Opening your email client…';
    }
  });
