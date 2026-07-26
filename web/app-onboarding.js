// Single coherent onboarding wizard — mirrors the mobile apps' registration
// (fields, validation, per-language levels) and writes ONE consolidated payload
// to profiles (+ learner_language_profiles for learners). Replaces the previous
// base form plus the four MutationObserver enhancers that raced each other.
(function () {
  function create(ctx) {
    var $ = function (s) { return document.querySelector(s); };
    var supa = ctx.supa;
    var D = window.DuvelaOnboardingData || {};
    var roles = ['learner', 'teacher', 'organizer', 'organization'];
    var copy = {
      learner: ['Learner', 'Learn at your own pace', 'Goal, language and level — Duvela picks the right start.'],
      teacher: ['Teacher', 'Create lessons and guide students', 'Tell us your speciality so your workspace is ready.'],
      organizer: ['Organizer', 'Run events', 'Set up your organizer profile to launch events and practice.'],
      organization: ['Organization', 'Build a learning team', 'Create your organization card and team workspace.']
    };
    var icon = { learner: '✦', teacher: '✎', organizer: '◈', organization: '▦' };

    var categoryIcons = { languages: '🌐', art: '🎨', education: '🧠', digital: '💻', career: '💼', life: '🏠', sportFitness: '🏃', personalDevelopment: '✨' };
    var subcategoryIcons = { Drawing:'✏️', Painting:'🖌️', Sculpture:'🗿', Animation:'🎞️', 'Graphic design':'🖥️', Crafts:'🧶', 'Art history':'🏛️', 'Interview preparation':'💬', 'AI interview':'🤖', Programming:'💻', 'Web development':'🌐', 'Mobile development':'📱', 'UI/UX':'🎨', Figma:'🎨', 'Video editing':'🎬', 'Content creation':'✍️', Math:'➗', Physics:'⚛️', Chemistry:'🧪', Biology:'🧬', Logic:'🧩', Cooking:'🍳', 'Personal finance':'💰', Mindfulness:'🧘', Communication:'💬', Productivity:'⚡', Confidence:'💪', Running:'🏃', Fitness:'💪', Yoga:'🧘', Cycling:'🚴', Chess:'♟️' };
    var role = ctx.session.role || 'learner';
    var step = 1;
    // Structured state (not just FormData) so chips/levels survive re-renders.
    var state = {
      firstName: '', lastName: '', orgName: '', bio: '', city: '', country: '', gender: '',
      nativeLanguage: '', goal: '', level: 'A1', category: '', subcategories: [],
      learnLanguages: [], languageLevels: {}, interests: [],
      specialization: '', experience: '', teachLanguages: [], qualifications: '',
      format: '', website: '', orgType: '', teamSize: '', dob: '', avatarFile: null, coverFile: null, avatarName: '',
      avatarPreview: '', coverPreview: '', coverPosition: 'center', coverPreset: 'duvela',
      email: '', phone: '', contactName: '', contactEmail: '', contactPhone: '', contactPosition: ''
    };
    var form = $('#onboardingForm');

    function esc(v) {
      return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function labelInput(id, label, value, opts) {
      opts = opts || {};
      return '<label class="' + (opts.wide ? 'wide' : '') + '">' + esc(label) +
        (opts.hint ? '<small style="font-weight:600;color:var(--muted)">' + esc(opts.hint) + '</small>' : '') +
        '<input id="ob-' + id + '" name="' + id + '" type="' + (opts.type || 'text') +
        '" value="' + esc(value) + '" ' + (opts.attr || '') +
        ' placeholder="' + esc(opts.placeholder || '') + '" autocomplete="off"></label>';
    }

    function selectInput(id, label, value, options) {
      return '<label>' + esc(label) + '<select id="ob-' + id + '" name="' + id + '">' +
        options.map(function (o) {
          var val = typeof o === 'string' ? o : o.id;
          var text = typeof o === 'string' ? o : o.label;
          if (o && o.id && categoryIcons[o.id]) text = categoryIcons[o.id] + ' ' + text;
          return '<option value="' + esc(val) + '"' + (String(val) === String(value) ? ' selected' : '') + '>' + esc(text) + '</option>';
        }).join('') + '</select></label>';
    }

    function chipList(kind, items, selected, labelOf) {
      return '<div class="ob-chip-list" data-chip-group="' + kind + '">' + items.map(function (it) {
        var id = typeof it === 'string' ? it : it.id;
        var text = labelOf ? labelOf(it) : (typeof it === 'string' ? it : it.label);
        var on = selected.indexOf(id) !== -1;
        return '<button type="button" class="ob-chip' + (on ? ' active' : '') + '" data-chip="' + kind + '" data-value="' + esc(id) + '">' + esc(text) + '</button>';
      }).join('') + '</div>';
    }

    function coverPresetById(id) {
      var presets = D.PROFILE_COVER_PRESETS || [];
      return presets.filter(function (p) { return p.id === id; })[0] || presets[0] || { id: 'duvela', label: 'DUVELA', colors: ['#7C3AED', '#A855F7', '#22C1DC'] };
    }

    function coverPresetValue() {
      return 'preset:' + (state.coverPreset || 'duvela');
    }

    function gradientCss(preset) {
      var colors = (preset && preset.colors) || ['#7C3AED', '#A855F7', '#22C1DC'];
      return 'linear-gradient(135deg,' + colors.join(',') + ')';
    }

    function coverPresetHtml() {
      var presets = D.PROFILE_COVER_PRESETS || [];
      return '<div class="ob-cover-presets">' + presets.map(function (preset) {
        var active = (state.coverPreset || 'duvela') === preset.id && !state.coverFile;
        return '<button type="button" class="ob-cover-preset' + (active ? ' active' : '') + '" data-cover-preset="' + esc(preset.id) + '"><i style="background:' + esc(gradientCss(preset)) + '"></i><span>' + esc(preset.label) + '</span></button>';
      }).join('') + '</div>';
    }

    function title() {
      var c = copy[role] || copy.learner;
      $('#onboardingRoleBadge').textContent = c[0];
      var who = (state.firstName || state.orgName || (ctx.getUser() && ctx.getUser().email ? ctx.getUser().email.split('@')[0] : 'there'));
      $('#onboardingLead').textContent = step === 1 ? 'Choose how you want to use Duvela.'
        : step === 2 ? ('Nice to meet you, ' + who + '. Let’s build your profile.')
        : step === 3 ? c[2] : 'Your Duvela profile is ready to go.';
      $('#onboardingSubmit').textContent = step < 4 ? 'Continue →' : (role === 'learner' ? 'Open my Duvela →' : 'Open my workspace →');
      $('#onboardingKicker').textContent = 'DUVELA · STEP ' + step + ' OF 4';
    }

    function stepTwoHtml() {
      var avatarPreview = state.avatarPreview ? '<div class="ob-avatar-preview"><img src="' + esc(state.avatarPreview) + '" alt=""></div>' : '<div class="ob-avatar-preview ob-empty-preview">Photo</div>';
      var coverPreview = state.coverPreview ? '<div class="ob-cover-preview"><img src="' + esc(state.coverPreview) + '" alt="" style="object-position:center ' + esc(state.coverPosition) + '"></div>' : '<div class="ob-cover-preview" style="background:' + esc(gradientCss(coverPresetById(state.coverPreset))) + '"><span>Cover color</span></div>';
      var html = '<div class="ob-upload-grid wide"><label>Profile photo or logo' + avatarPreview + '<input id="ob-avatarFile" name="avatarFile" type="file" accept="image/*">' +
        '<small style="font-weight:600;color:var(--muted)">JPG or PNG, up to 5 MB</small></label>';
      html += '<label>Cover photo' + coverPreview + '<input id="ob-coverFile" name="coverFile" type="file" accept="image/*"><small style="font-weight:600;color:var(--muted)">JPG or PNG, up to 5 MB. Cropped to profile cover ratio.</small><select id="ob-coverPosition" name="coverPosition"><option value="top"' + (state.coverPosition === 'top' ? ' selected' : '') + '>Crop top</option><option value="center"' + (state.coverPosition === 'center' ? ' selected' : '') + '>Crop center</option><option value="bottom"' + (state.coverPosition === 'bottom' ? ' selected' : '') + '>Crop bottom</option></select>' + coverPresetHtml() + '</label></div>';
      html += '<div class="ob-extra-title">Personal details</div><div class="ob-extra-grid">';
      if (role === 'organization') {
        html += labelInput('orgName', 'Organization name', state.orgName, { attr: 'required', placeholder: 'Your organization' });
      } else {
        html += labelInput('firstName', 'First name', state.firstName, { attr: 'required', placeholder: 'Your first name' });
        html += labelInput('lastName', 'Last name', state.lastName, { placeholder: 'Your last name' });
      }
      if (role !== 'organization') html += labelInput('dob', 'Date of birth', state.dob, { type: 'date' });
      html += labelInput('country', 'Country', state.country, { placeholder: 'For example: Germany', attr: 'data-autocomplete="country"' });
      html += labelInput('city', 'City', state.city, { placeholder: 'For example: Berlin', attr: 'data-autocomplete="city"' });
      if (role !== 'organization') {
        html += selectInput('gender', 'Gender', state.gender, [{ id: '', label: 'Prefer not to say' }].concat(D.GENDERS || []));
      }
      html += '</div>';
      html += labelInput('bio', 'Short introduction', state.bio, { wide: true, hint: 'A few words about you', placeholder: 'For example: I enjoy learning languages and meeting people from different cultures.' });
      return html + '<div id="ob-autocomplete" class="ob-autocomplete" hidden></div>';
    }

    function stepThreeHtml() {
      if (role === 'learner') {
        return '<div class="ob-extra-grid">' +
          labelInput('goal', 'Your learning goal', state.goal, { placeholder: 'For example: improve speaking for work' }) +
          '</div>' +
          '<div class="ob-extra-title">Your learning profile</div><div class="ob-extra-grid">' +
          labelInput('nativeLanguage', 'Native language', state.nativeLanguage, { placeholder: 'For example: Russian' }) +
          '</div>' +
          '<label class="wide">Learning category<small style="font-weight:600;color:var(--muted)">Choose one direction</small></label>' +
          categoryCardsHtml('category', state.category) +
          '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[state.category] ? '' : ' hidden') + '>' +
            '<label class="wide">Focus areas<small style="font-weight:600;color:var(--muted)">Optional — pick what fits</small></label>' +
            '<div id="ob-subcats">' + subcatHtml() + '</div>' +
          '</div>' +
          ((state.category || 'languages') === 'languages' ?
            '<label class="wide">Languages you want to learn<small id="ob-lang-hint" style="font-weight:600;color:var(--muted)">Choose up to 3</small></label>' +
            langScroll('learnLanguages', state.learnLanguages) +
            '<div id="ob-lang-levels">' + languageLevelsHtml() + '</div>' : '') +
          '<label class="wide">Interests<small style="font-weight:600;color:var(--muted)">Select at least 3 interests to personalise your Hub</small></label>' +
          chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; }) +
          '<div id="ob-autocomplete" class="ob-autocomplete" hidden></div>';
      }
      if (role === 'teacher') {
        return '<div class="ob-extra-title">Professional profile</div><div class="ob-extra-grid">' +
          labelInput('specialization', 'Teaching speciality', state.specialization, { placeholder: 'For example: German B1–C1' }) +
          labelInput('experience', 'Years of experience', state.experience, { type: 'number', attr: 'min="0"' }) +
          '</div>' +
          '<label class="wide">Languages you teach' + '</label>' + langScroll('teachLanguages', state.teachLanguages) +
          labelInput('qualifications', 'Qualifications', state.qualifications, { wide: true, hint: 'Comma separated (degrees, certificates)' }) +
          '<div class="ob-extra-grid">' +
          labelInput('format', 'Lesson format', state.format, { placeholder: 'Online, offline or both' }) +
          labelInput('website', 'Website', state.website, { type: 'url' }) +
          '</div>' +
          '<label class="wide">Interests</label>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; });
      }
      if (role === 'organizer') {
        return '<div class="ob-extra-grid">' +
          labelInput('specialization', 'What do you organise?', state.specialization, { placeholder: 'Events, meetups, workshops' }) +
          labelInput('website', 'Website', state.website, { type: 'url' }) +
          '</div>' +
          '<label class="wide">Interests</label>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; });
      }
      // organization
      return '<div class="ob-extra-grid">' +
        selectInput('orgType', 'Organization type', state.orgType, [{ id: '', label: 'Choose a type' }, { id: 'school', label: 'School' }, { id: 'academy', label: 'Academy' }, { id: 'company', label: 'Company' }, { id: 'ngo', label: 'NGO' }, { id: 'community', label: 'Community' }]) +
        labelInput('website', 'Website', state.website, { type: 'url' }) +
        '</div>' +
        labelInput('specialization', 'What does your organization do?', state.specialization, { wide: true, placeholder: 'Short description' }) +
        '<div class="ob-extra-title">Public contacts</div><div class="ob-extra-grid">' +
        labelInput('email', 'Public email', state.email, { type: 'email', placeholder: 'hello@example.com' }) +
        labelInput('phone', 'Public phone', state.phone, { type: 'tel', placeholder: '+49...' }) +
        '</div><div class="ob-extra-title">Business contact</div><div class="ob-extra-grid">' +
        labelInput('contactName', 'Contact name', state.contactName, { placeholder: 'Responsible person' }) +
        labelInput('contactPosition', 'Contact position', state.contactPosition, { placeholder: 'Manager, Director...' }) +
        labelInput('contactEmail', 'Contact email', state.contactEmail, { type: 'email', placeholder: 'contact@example.com' }) +
        labelInput('contactPhone', 'Contact phone', state.contactPhone, { type: 'tel', placeholder: '+49...' }) +
        '</div>';
    }

    // Horizontal flag-scroll of languages (kind = learnLanguages | teachLanguages).
    function langScroll(kind, selected) {
      return '<div class="ob-lang-scroll" data-chip-group="' + kind + '">' + (D.LANGUAGES || []).map(function (l) {
        var on = selected.indexOf(l) !== -1;
        var img = D.flagImg ? D.flagImg(l) : '';
        // Image flag renders everywhere; fall back to the country code (which is
        // what emoji flags degrade to on Windows anyway) if the image fails.
        var flag = img
          ? '<img class="ob-flag-img" src="' + img + '" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'ob-flag-code\',textContent:\'' + esc((D.flagCode ? D.flagCode(l) : '').toUpperCase()) + '\'}))">'
          : '<span class="ob-flag-code">' + esc((D.flagCode ? D.flagCode(l) : '').toUpperCase()) + '</span>';
        return '<button type="button" class="ob-lang-chip' + (on ? ' active' : '') + '" data-chip="' + kind + '" data-value="' + esc(l) + '">' +
          flag + '<span>' + esc(l) + '</span></button>';
      }).join('') + '</div>';
    }

    function categoryCardsHtml(kind, selected) {
      return '<div class="ob-category-grid wide" data-category-group="' + kind + '">' + (D.CATEGORIES || []).map(function (it) {
        var on = selected === it.id || (!selected && it.id === 'languages');
        var iconText = categoryIcons[it.id] || '*';
        return '<button type="button" class="ob-category-card' + (on ? ' active' : '') + '" data-category-card="' + esc(it.id) + '"><span>' + esc(iconText) + '</span><b>' + esc(it.label) + '</b></button>';
      }).join('') + '</div>';
    }

    function langHint() {
      return (!state.category || state.category === 'languages') ? 'Choose up to 3' : 'Optional — choose up to 3';
    }

    function subcatHtml() {
      var subs = (D.SUBCATEGORIES || {})[state.category];
      if (!subs) return '';
      return '<div class="ob-selection-head"><span>Focus areas</span><b id="ob-subcat-count">' + state.subcategories.length + '/3 selected</b></div>' + chipList('subcategories', subs, state.subcategories, function (item) { return (subcategoryIcons[item] || '✦') + ' ' + item; }) + '<button type="button" class="ob-clear-selection" data-clear-selection="subcategories">Clear selection</button>';
    }

    function languageLevelsHtml() {
      if (!state.learnLanguages.length) return '';
      return '<div class="ob-summary-title">Selected languages and levels</div><div class="ob-lang-levels-grid">' + state.learnLanguages.map(function (lang) {
        var lvl = state.languageLevels[lang] || state.level;
        return '<label class="ob-lang-level">' + esc(lang) +
          '<select data-lang-level="' + esc(lang) + '">' + (D.LEVELS || ['A1']).map(function (l) {
            return '<option' + (l === lvl ? ' selected' : '') + '>' + l + '</option>';
          }).join('') + '</select></label>';
      }).join('') + '</div>';
    }

    function selectedLanguageSummary() {
      if (!state.learnLanguages.length) return '<span class="muted">No language selected</span>';
      return state.learnLanguages.map(function (lang) {
        return '<span class="ob-preview-pill">' + esc(lang) + ' · ' + esc(state.languageLevels[lang] || state.level || 'A1') + '</span>';
      }).join('');
    }

    function selectedItemsSummary(items) {
      if (!items || !items.length) return '<span class="muted">Nothing selected</span>';
      return items.map(function (x) { return '<span class="ob-preview-pill">' + esc(x) + '</span>'; }).join('');
    }

    function interestLabels() {
      return state.interests.map(function (id) {
        var found = (D.INTERESTS || []).filter(function (it) { return it.id === id; })[0];
        return found ? found.label : id;
      });
    }

    function profilePreviewHtml() {
      var name = role === 'organization' ? state.orgName : [state.firstName, state.lastName].filter(Boolean).join(' ');
      var category = (D.CATEGORIES || []).filter(function (c) { return c.id === (state.category || 'languages'); })[0];
      var coverStyle = state.coverPreview ? '' : ' style="background:' + esc(gradientCss(coverPresetById(state.coverPreset))) + '"';
      var cover = state.coverPreview ? '<img src="' + esc(state.coverPreview) + '" alt="" style="object-position:center ' + esc(state.coverPosition) + '">' : '';
      var avatar = state.avatarPreview ? '<img src="' + esc(state.avatarPreview) + '" alt="">' : '<span>' + esc((name || 'D').charAt(0).toUpperCase()) + '</span>';
      return '<div class="wide ob-profile-preview">' +
        '<div class="ob-preview-cover"' + coverStyle + '>' + cover + '</div>' +
        '<div class="ob-preview-head"><div class="ob-preview-avatar">' + avatar + '</div><div><h3>' + esc(name || 'Your profile') + '</h3><p>' + esc([state.city, state.country].filter(Boolean).join(', ') || 'Location not set') + '</p></div></div>' +
        '<div class="ob-preview-grid">' +
          '<div><b>Role</b><p>' + esc((copy[role] || copy.learner)[0]) + '</p></div>' +
          '<div><b>Category</b><p>' + esc(category ? category.label : 'Languages') + '</p></div>' +
          '<div><b>Goal</b><p>' + esc(state.goal || state.specialization || 'Not set') + '</p></div>' +
          '<div><b>Native language</b><p>' + esc(state.nativeLanguage || 'Not set') + '</p></div>' +
        '</div>' +
        (role === 'learner' ? '<div class="ob-preview-section"><b>Selected languages and levels</b><div>' + selectedLanguageSummary() + '</div></div>' : '') +
        '<div class="ob-preview-section"><b>Focus areas</b><div>' + selectedItemsSummary(state.subcategories) + '</div></div>' +
        '<div class="ob-preview-section"><b>Interests</b><div>' + selectedItemsSummary(interestLabels()) + '</div></div>' +
      '</div>';
    }

    function render() {
      title();
      document.querySelectorAll('.onboarding-step').forEach(function (x, i) {
        x.className = 'onboarding-step ' + (i + 1 <= step ? 'active' : '');
      });
      var rolesBox = $('#onboardingRoles');
      rolesBox.style.display = step === 1 ? 'grid' : 'none';
      rolesBox.innerHTML = roles.map(function (r) {
        return '<button type="button" class="' + (r === role ? 'active' : '') + '" data-ob-role="' + r + '"><span>' + icon[r] + '</span>' + copy[r][0] + '<small>' + copy[r][1] + '</small></button>';
      }).join('');

      var html = '';
      if (step === 1) html = '<div class="onboarding-welcome wide"><b>One account, your own Duvela space.</b><p>You can change your role and profile details later in settings.</p></div>';
      // Wrap in .wide so the structural divs span the full grid width and lay
      // out as normal block flow (the form itself is a 2-column grid).
      if (step === 2) html = '<div class="wide ob-section">' + stepTwoHtml() + '</div>';
      if (step === 3) html = '<div class="wide ob-section">' + stepThreeHtml() + '</div>';
      if (step === 4) html = '<div class="onboarding-welcome wide" style="text-align:center;padding:22px"><div style="font-size:48px">✨</div><h3 style="font-size:24px;margin:10px 0">Profile ready!</h3><p>Your Duvela space is personalised for ' + esc((copy[role] || copy.learner)[0]) + '. You can edit everything later in Profile.</p></div>';
      if (step === 4) html = profilePreviewHtml();
      form.innerHTML = html;

      rolesBox.querySelectorAll('[data-ob-role]').forEach(function (b) {
        b.onclick = function () { role = b.dataset.obRole; render(); };
      });
      $('#onboardingBack').style.display = step > 1 ? 'inline-flex' : 'none';
      $('#onboardingNote').textContent = step === 4 ? 'Welcome to Duvela!' : step === 1 ? 'You can update this later in Profile.' : 'Your progress is saved between steps.';
      bindStep();
    }

    function bindStep() {
      // chips
      form.querySelectorAll('[data-chip]').forEach(function (btn) {
        btn.onclick = function () { toggleChip(btn.dataset.chip, btn.dataset.value); };
      });
      form.querySelectorAll('[data-clear-selection]').forEach(function (btn) { btn.onclick = function () { state.subcategories = []; render(); }; });
      form.querySelectorAll('[data-cover-preset]').forEach(function (btn) {
        btn.onclick = function () {
          state.coverPreset = btn.dataset.coverPreset;
          state.coverFile = null;
          state.coverPreview = '';
          render();
        };
      });
      form.querySelectorAll('[data-category-card]').forEach(function (btn) {
        btn.onclick = function () {
          state.category = btn.dataset.categoryCard;
          state.subcategories = [];
          if (state.category !== 'languages') {
            state.learnLanguages = [];
            state.languageLevels = {};
          }
          render();
        };
      });
      // avatar
      var avatar = $('#ob-avatarFile');
      if (avatar) avatar.onchange = function () {
        state.avatarFile = avatar.files && avatar.files[0];
        state.avatarPreview = state.avatarFile ? URL.createObjectURL(state.avatarFile) : '';
        render();
      };
      var cover = $('#ob-coverFile');
      if (cover) cover.onchange = function () {
        state.coverFile = cover.files && cover.files[0];
        state.coverPreview = state.coverFile ? URL.createObjectURL(state.coverFile) : '';
        render();
      };
      // gender/category/level selects + native
      ['gender', 'level', 'category', 'coverPosition', 'orgType'].forEach(function (id) {
        var el = $('#ob-' + id);
        if (el) el.onchange = function () {
          state[id] = el.value;
          if (id === 'category' || id === 'coverPosition') { render(); }
        };
      });
      // per-language level selects
      form.querySelectorAll('[data-lang-level]').forEach(function (sel) {
        sel.onchange = function () { state.languageLevels[sel.dataset.langLevel] = sel.value; };
      });
      // autocomplete country / city (step 2) and native language (step 3)
      ['country', 'city', 'nativeLanguage'].forEach(function (id) {
        var el = $('#ob-' + id);
        if (el) {
          el.oninput = function () { state[id] = el.value; showAutocomplete(id, el); };
          el.onblur = function () { setTimeout(hideAutocomplete, 150); };
        }
      });
    }

    function toggleChip(kind, value) {
      var arr = kind === 'learnLanguages' ? state.learnLanguages
        : kind === 'interests' ? state.interests
        : kind === 'subcategories' ? state.subcategories
        : kind === 'teachLanguages' ? state.teachLanguages : null;
      if (!arr) return;
      var idx = arr.indexOf(value);
      if (idx === -1) {
        if (kind === 'learnLanguages' && arr.length >= 3) return;
        if (kind === 'subcategories' && arr.length >= 3) return;
        arr.push(value);
        if (kind === 'learnLanguages') state.languageLevels[value] = state.languageLevels[value] || state.level;
      } else {
        arr.splice(idx, 1);
        if (kind === 'learnLanguages') delete state.languageLevels[value];
      }
      // Re-render just the affected group + language levels without losing focus.
      var group = form.querySelector('[data-chip-group="' + kind + '"]');
      if (group) group.querySelectorAll('[data-chip]').forEach(function (b) {
        b.classList.toggle('active', arr.indexOf(b.dataset.value) !== -1);
      });
      if (kind === 'subcategories') { var count = $('#ob-subcat-count'); if (count) count.textContent = state.subcategories.length + '/3 selected'; }
      if (kind === 'learnLanguages') { var box = $('#ob-lang-levels'); if (box) { box.innerHTML = languageLevelsHtml(); form.querySelectorAll('[data-lang-level]').forEach(function (sel) { sel.onchange = function () { state.languageLevels[sel.dataset.langLevel] = sel.value; }; }); } }
    }

    function showAutocomplete(kind, input) {
      var box = $('#ob-autocomplete');
      if (!box || !D.getCountrySuggestions) return;
      var list = kind === 'country' ? D.getCountrySuggestions(input.value, 6)
        : kind === 'nativeLanguage' ? (D.getLanguageSuggestions ? D.getLanguageSuggestions(input.value, 6) : [])
        : D.getCitySuggestions(input.value, state.country, 6);
      if (!list.length) { hideAutocomplete(); return; }
      var rect = input.getBoundingClientRect(), formRect = form.getBoundingClientRect();
      box.style.top = (rect.bottom - formRect.top + form.scrollTop + 2) + 'px';
      box.style.left = (rect.left - formRect.left) + 'px';
      box.style.width = rect.width + 'px';
      box.innerHTML = list.map(function (x) { return '<button type="button" data-ac="' + esc(x) + '">' + esc(x) + '</button>'; }).join('');
      box.hidden = false;
      box.querySelectorAll('[data-ac]').forEach(function (b) {
        b.onmousedown = function (e) {
          e.preventDefault();
          state[kind] = b.dataset.ac; input.value = b.dataset.ac;
          if (kind === 'country' && state.city && !D.doesCityBelongToCountry(state.city, state.country)) { state.city = ''; var ci = $('#ob-city'); if (ci) ci.value = ''; }
          hideAutocomplete();
        };
      });
    }
    function hideAutocomplete() { var box = $('#ob-autocomplete'); if (box) { box.hidden = true; box.innerHTML = ''; } }

    function collect() {
      if (!form) return;
      ['firstName', 'lastName', 'orgName', 'bio', 'city', 'country', 'dob', 'goal', 'nativeLanguage', 'specialization', 'experience', 'qualifications', 'format', 'website', 'email', 'phone', 'contactName', 'contactEmail', 'contactPhone', 'contactPosition'].forEach(function (id) {
        var el = $('#ob-' + id);
        if (el) state[id] = el.value;
      });
      var gender = $('#ob-gender'); if (gender) state.gender = gender.value;
      var level = $('#ob-level'); if (level) state.level = level.value;
      var cat = $('#ob-category'); if (cat) state.category = cat.value;
      var orgType = $('#ob-orgType'); if (orgType) state.orgType = orgType.value;
      var coverPosition = $('#ob-coverPosition'); if (coverPosition) state.coverPosition = coverPosition.value;
    }

    function validate() {
      if (step === 2) {
        if (role === 'organization' ? !state.orgName.trim() : !state.firstName.trim()) return role === 'organization' ? 'Enter your organization name.' : 'Enter your first name.';
        if (state.country.trim() && D.isKnownCountry && !D.isKnownCountry(state.country)) return 'Choose a country from the list.';
        // Only block a clear mismatch (city known to belong to a different
        // country). Cities not in our curated list — incl. geolocation results
        // and smaller towns — are allowed through.
        if (state.city.trim() && state.country.trim() && D.cityCountry) {
          var owner = D.cityCountry(state.city);
          if (owner && D.isKnownCountry(state.country) && owner.toLowerCase() !== state.country.trim().toLowerCase()) {
            return 'This city belongs to ' + owner + ', not ' + state.country.trim() + '.';
          }
        }
      }
      if (step === 3 && role === 'learner') {
        // A target language is only required for the Languages category; for
        // art / sport / digital etc. it's optional.
        var languagesCategory = !state.category || state.category === 'languages';
        if (!state.nativeLanguage.trim()) return 'Enter your native language.';
        if (languagesCategory && !state.learnLanguages.length) return 'Choose at least one language to learn.';
        if (state.interests.length < 3) return 'Select at least 3 interests.';
      }
      return '';
    }

    function buildPatch() {
      var fullName = role === 'organization' ? state.orgName.trim()
        : [state.firstName, state.lastName].map(function (x) { return x.trim(); }).filter(Boolean).join(' ');
      var patch = {
        full_name: fullName || null,
        bio: state.bio.trim() || null,
        city: state.city.trim() || null,
        country: state.country.trim() || null,
        dob: state.dob || null,
        gender: state.gender || null,
        is_teacher: role === 'teacher',
        is_organizer: role === 'organizer' || role === 'organization',
        website: state.website.trim() || null,
        updated_at: new Date().toISOString()
      };
      if (role === 'learner') {
        var primaryLevel = (state.languageLevels[state.learnLanguages[0]] || state.level || 'A1');
        patch.language = state.nativeLanguage.trim() || null;
        patch.language_level = primaryLevel;
        patch.learning_goal = state.goal.trim() || null;
        patch.learning_languages = state.learnLanguages.slice();
        patch.profile_interests = state.interests.slice();
        patch.learning_targets = [{
          category: state.category || 'languages',
          languages: state.learnLanguages.slice(),
          levels: state.languageLevels,
          subcategories: state.subcategories.slice()
        }].concat(state.learnLanguages.map(function (lang) {
          return { category: state.category || 'languages', language: lang, level: state.languageLevels[lang] || primaryLevel, subcategories: state.subcategories.slice() };
        }));
      }
      if (role === 'teacher') {
        patch.specialization = state.specialization.trim() || null;
        patch.teaching_experience = state.experience || null;
        patch.teaches_languages = state.teachLanguages.slice();
        patch.qualifications = state.qualifications.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
      }
      if (role === 'organizer') {
        patch.specialization = state.specialization.trim() || null;
        patch.profile_interests = state.interests.slice();
      }
      if (role === 'organization') {
        patch.specialization = state.specialization.trim() || (state.category || null);
      }
      return patch;
    }

    async function saveLearnerLanguages(userId) {
      if (role !== 'learner' || !state.learnLanguages.length) return;
      var rows = state.learnLanguages.map(function (lang, i) {
        return {
          user_id: userId, language: lang,
          current_level: (state.languageLevels[lang] || state.level || 'A1'),
          goal_level: (state.level || 'A1'),
          is_active: i === 0, updated_at: new Date().toISOString()
        };
      });
      try {
        await supa.from('learner_language_profiles').update({ is_active: false, updated_at: new Date().toISOString() }).eq('user_id', userId);
        await supa.from('learner_language_profiles').upsert(rows, { onConflict: 'user_id,language' });
      } catch (e) { /* table may not exist in some environments — non-fatal */ }
    }

    function buildOrgSlug(name) {
      var base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
      return (base || 'organization') + '-' + Math.random().toString(36).slice(2, 6);
    }

    async function saveBusinessOrganization(userId, userEmail) {
      if (role !== 'organization') return;
      var name = state.orgName.trim();
      if (!name) return;
      var payload = {
        city: state.city.trim() || null,
        contact_email: state.contactEmail.trim() || null,
        contact_name: state.contactName.trim() || null,
        contact_phone: state.contactPhone.trim() || null,
        contact_position: state.contactPosition.trim() || null,
        country: state.country.trim() || null,
        description: state.specialization.trim() || state.bio.trim() || null,
        name: name,
        owner_id: userId,
        public_email: state.email.trim() || userEmail || null,
        public_phone: state.phone.trim() || null,
        type: state.orgType || null,
        website_url: state.website.trim() || null
      };
      var existing = await supa.from('organizations')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      var orgId = existing.data && existing.data.id;
      if (orgId) {
        var update = await supa.from('organizations').update(payload).eq('id', orgId);
        if (update.error) throw update.error;
      } else {
        var insert = await supa.from('organizations')
          .insert(Object.assign({}, payload, { slug: buildOrgSlug(name) }))
          .select('id')
          .single();
        if (insert.error) throw insert.error;
        orgId = insert.data && insert.data.id;
      }
      if (!orgId) return;
      var membership = await supa.from('organization_memberships')
        .select('id')
        .eq('organization_id', orgId)
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membership.error) throw membership.error;
      if (!membership.data) {
        var memberInsert = await supa.from('organization_memberships').insert({
          organization_id: orgId,
          user_id: userId,
          role: 'owner',
          status: 'active'
        });
        if (memberInsert.error) throw memberInsert.error;
      }
    }

    async function submit(e) {
      e.preventDefault();
      collect();
      $('#onboardingError').textContent = '';
      var err = validate();
      if (err) { $('#onboardingError').textContent = err; return; }
      if (step < 4) { step++; render(); return; }

      var u = ctx.getUser();
      var patch = buildPatch();
      try {
        if (state.avatarFile && state.avatarFile.size && ctx.uploadToBucket) {
          patch.avatar_url = await ctx.uploadToBucket('posts', state.avatarFile);
        }
        if (state.coverFile && state.coverFile.size && ctx.uploadToBucket) {
          patch.cover_url = await ctx.uploadToBucket('posts', state.coverFile);
        } else {
          patch.cover_url = coverPresetValue();
        }
        var res = await supa.from('profiles').update(patch).eq('id', u.id);
        if (res.error) throw res.error;
        await saveLearnerLanguages(u.id);
        await saveBusinessOrganization(u.id, u.email || '');
        ctx.setProfile(Object.assign({}, ctx.getProfile(), patch));
        localStorage.setItem('duvela.onboarding.' + u.id, '1');
        $('#onboardingOverlay').classList.remove('open');
        $('#onboardingOverlay').setAttribute('aria-hidden', 'true');
        ctx.renderAll();
      } catch (error) {
        $('#onboardingError').textContent = (error && error.message) || 'Could not save your setup. Please try again.';
      }
    }

    function back() { collect(); if (step > 1) { step--; render(); } }

    function openIfNeeded() {
      var u = ctx.getUser();
      if (!u || localStorage.getItem('duvela.onboarding.' + u.id)) return;
      step = 1; role = ctx.session.role || 'learner';
      render();
      $('#onboardingOverlay').classList.add('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'false');
    }

    form.addEventListener('submit', submit);
    $('#onboardingBack').addEventListener('click', back);
    return { openIfNeeded: openIfNeeded };
  }
  window.DuvelaAppOnboarding = { create: create };
})();
