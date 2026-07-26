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
      email: '', phone: '', contactName: '', contactEmail: '', contactPhone: '', contactPosition: '',
      rate: '', availability: '', audience: '', eventType: '', verification: '',
      instagram: '', tiktok: '', facebook: '', linkedin: '', youtube: '', telegram: ''
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
          labelInput('specialization', 'Teaching headline', state.specialization, { placeholder: 'For example: Creative drawing for beginners' }) +
          labelInput('nativeLanguage', 'Native language', state.nativeLanguage, { placeholder: 'For example: Russian' }) +
          labelInput('experience', 'Years of experience', state.experience, { type: 'number', attr: 'min="0"' }) +
          '</div>' +
          '<label class="wide">Teaching category<small style="font-weight:600;color:var(--muted)">Choose what you teach</small></label>' +
          categoryCardsHtml('category', state.category) +
          '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[state.category] ? '' : ' hidden') + '>' +
            '<label class="wide">Focus areas<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
            '<div id="ob-subcats">' + subcatHtml() + '</div>' +
          '</div>' +
          ((state.category || 'languages') === 'languages' ? '<label class="wide">Languages you teach<small style="font-weight:600;color:var(--muted)">Choose up to 3</small></label>' + langScroll('teachLanguages', state.teachLanguages) : '') +
          labelInput('qualifications', 'Qualifications', state.qualifications, { wide: true, hint: 'Comma separated (degrees, certificates)' }) +
          '<div class="ob-extra-grid">' +
          labelInput('format', 'Lesson format', state.format, { placeholder: '1:1, group, online, offline or both' }) +
          labelInput('rate', 'Rate or price', state.rate, { placeholder: 'For example: 25 EUR / hour' }) +
          labelInput('availability', 'Availability', state.availability, { placeholder: 'Weekdays, evenings, weekends' }) +
          labelInput('website', 'Website', state.website, { type: 'url' }) +
          '</div>' +
          labelInput('verification', 'Credentials / verification', state.verification, { wide: true, placeholder: 'Certificates, degree, portfolio links, verification notes' }) +
          '<div class="ob-extra-title">Social media</div><div class="ob-extra-grid">' +
          labelInput('instagram', 'Instagram', state.instagram, { placeholder: '@handle or link' }) +
          labelInput('tiktok', 'TikTok', state.tiktok, { placeholder: '@handle or link' }) +
          labelInput('facebook', 'Facebook', state.facebook, { placeholder: 'Profile/page link' }) +
          labelInput('linkedin', 'LinkedIn', state.linkedin, { placeholder: 'Profile link' }) +
          labelInput('youtube', 'YouTube', state.youtube, { placeholder: 'Channel link' }) +
          labelInput('telegram', 'Telegram', state.telegram, { placeholder: '@handle or link' }) +
          '</div>' +
          '<label class="wide">Interests</label>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; });
      }
      if (role === 'organizer') {
        return '<div class="ob-extra-title">Organizer profile</div><div class="ob-extra-grid">' +
          labelInput('specialization', 'Organizer headline', state.specialization, { placeholder: 'For example: Speaking clubs and culture meetups' }) +
          labelInput('eventType', 'Event type', state.eventType, { placeholder: 'Meetups, workshops, LIVE, challenges' }) +
          labelInput('format', 'Event format', state.format, { placeholder: 'Online, offline or hybrid' }) +
          labelInput('audience', 'Audience', state.audience, { placeholder: 'Learners, teachers, teams, families...' }) +
          labelInput('website', 'Website', state.website, { type: 'url' }) +
        '</div>' +
        '<label class="wide">Organizer category<small style="font-weight:600;color:var(--muted)">Choose event direction</small></label>' +
        categoryCardsHtml('category', state.category) +
        '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[state.category] ? '' : ' hidden') + '>' +
          '<label class="wide">Focus areas<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
          '<div id="ob-subcats">' + subcatHtml() + '</div>' +
        '</div>' +
        '<label class="wide">Interests</label>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; });
      }
      // organization
      return '<label class="wide">Organization type<small style="font-weight:600;color:var(--muted)">Choose your workspace type</small></label>' +
        orgTypeCardsHtml() +
        '<div class="ob-extra-grid">' +
        labelInput('website', 'Website', state.website, { type: 'url' }) +
        labelInput('teamSize', 'Team size', state.teamSize, { type: 'number', attr: 'min="1"', placeholder: 'For example: 12' }) +
        '</div>' +
        labelInput('specialization', 'What does your organization do?', state.specialization, { wide: true, placeholder: 'Short description for learners and teachers' }) +
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

    function optionCardsHtml(kind, selected, items) {
      return '<div class="ob-option-grid wide" data-option-group="' + kind + '">' + items.map(function (it) {
        var on = selected === it.id;
        return '<button type="button" class="ob-option-card' + (on ? ' active' : '') + '" data-option-kind="' + esc(kind) + '" data-option-value="' + esc(it.id) + '"><span>' + esc(it.icon || '') + '</span><b>' + esc(it.label) + '</b><small>' + esc(it.hint || '') + '</small></button>';
      }).join('') + '</div>';
    }

    function orgTypeCardsHtml() {
      return optionCardsHtml('orgType', state.orgType, [
        { id: 'school', label: 'School', icon: '🏫', hint: 'Formal learning' },
        { id: 'academy', label: 'Academy', icon: '🎓', hint: 'Courses and tutors' },
        { id: 'company', label: 'Company', icon: '🏢', hint: 'Team training' },
        { id: 'ngo', label: 'NGO', icon: '🤝', hint: 'Community education' },
        { id: 'community', label: 'Community', icon: '🌐', hint: 'Local groups' }
      ]);
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

    function selectedLanguageSummary(list) {
      var langs = list || state.learnLanguages;
      if (!langs.length) return '<span class="muted">No language selected</span>';
      return langs.map(function (lang) {
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
      var categoryTitle = role === 'organization' ? 'Organization type' : (role === 'organizer' ? 'Event direction' : 'Category');
      var categoryValue = role === 'organization' ? (state.orgType || 'Not set') : (category ? category.label : 'Languages');
      var goalTitle = role === 'organization' ? 'Description' : (role === 'organizer' ? 'Event type' : 'Goal');
      var goalValue = role === 'organizer' ? (state.eventType || state.specialization || 'Not set') : (state.goal || state.specialization || 'Not set');
      var socialItems = [state.instagram, state.tiktok, state.facebook, state.linkedin, state.youtube, state.telegram].filter(Boolean);
      var coverStyle = state.coverPreview ? '' : ' style="background:' + esc(gradientCss(coverPresetById(state.coverPreset))) + '"';
      var cover = state.coverPreview ? '<img src="' + esc(state.coverPreview) + '" alt="" style="object-position:center ' + esc(state.coverPosition) + '">' : '';
      var avatar = state.avatarPreview ? '<img src="' + esc(state.avatarPreview) + '" alt="">' : '<span>' + esc((name || 'D').charAt(0).toUpperCase()) + '</span>';
      return '<div class="wide ob-profile-preview">' +
        '<div class="ob-preview-cover"' + coverStyle + '>' + cover + '</div>' +
        '<div class="ob-preview-head"><div class="ob-preview-avatar">' + avatar + '</div><div><h3>' + esc(name || 'Your profile') + '</h3><p>' + esc([state.city, state.country].filter(Boolean).join(', ') || 'Location not set') + '</p></div></div>' +
        '<div class="ob-preview-grid">' +
          '<div><b>Role</b><p>' + esc((copy[role] || copy.learner)[0]) + '</p></div>' +
          '<div><b>' + esc(categoryTitle) + '</b><p>' + esc(categoryValue) + '</p></div>' +
          '<div><b>' + esc(goalTitle) + '</b><p>' + esc(goalValue) + '</p></div>' +
          '<div><b>' + esc(role === 'organization' ? 'Team size' : 'Native language') + '</b><p>' + esc(role === 'organization' ? (state.teamSize || 'Not set') : (state.nativeLanguage || 'Not set')) + '</p></div>' +
        '</div>' +
        (role === 'learner' ? '<div class="ob-preview-section"><b>Selected languages and levels</b><div>' + selectedLanguageSummary(state.learnLanguages) + '</div></div>' : '') +
        (role === 'teacher' && state.teachLanguages.length ? '<div class="ob-preview-section"><b>Languages you teach</b><div>' + selectedItemsSummary(state.teachLanguages) + '</div></div>' : '') +
        (role === 'teacher' && socialItems.length ? '<div class="ob-preview-section"><b>Social media</b><div>' + selectedItemsSummary(socialItems) + '</div></div>' : '') +
        (role === 'organizer' ? '<div class="ob-preview-section"><b>Format and audience</b><div>' + selectedItemsSummary([state.format, state.audience].filter(Boolean)) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Business contacts</b><div>' + selectedItemsSummary([state.website, state.email, state.phone, state.contactName, state.contactEmail].filter(Boolean)) + '</div></div>' : '') +
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

    function showError(message, target) {
      $('#onboardingError').textContent = message || '';
      form.querySelectorAll('.ob-field-error').forEach(function (x) { x.remove(); });
      form.querySelectorAll('.ob-invalid').forEach(function (x) { x.classList.remove('ob-invalid'); });
      if (!message || !target) return;
      var el = $('#ob-' + target) || form.querySelector('[data-chip-group="' + target + '"]') || form.querySelector('[data-category-group="' + target + '"]') || form.querySelector('[data-option-group="' + target + '"]');
      if (!el) return;
      var host = el.closest('label') || el;
      host.classList.add('ob-invalid');
      host.insertAdjacentHTML('afterend', '<div class="ob-field-error wide">' + esc(message) + '</div>');
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
            state.teachLanguages = [];
            state.languageLevels = {};
          }
          render();
        };
      });
      form.querySelectorAll('[data-option-kind]').forEach(function (btn) {
        btn.onclick = function () {
          state[btn.dataset.optionKind] = btn.dataset.optionValue;
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
      ['firstName', 'lastName', 'orgName', 'bio', 'city', 'country', 'dob', 'goal', 'nativeLanguage', 'specialization', 'experience', 'qualifications', 'format', 'website', 'email', 'phone', 'contactName', 'contactEmail', 'contactPhone', 'contactPosition', 'rate', 'availability', 'audience', 'eventType', 'verification', 'teamSize', 'instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'telegram'].forEach(function (id) {
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
        if (role === 'organization' ? !state.orgName.trim() : !state.firstName.trim()) return { message: role === 'organization' ? 'Enter your organization name.' : 'Enter your first name.', target: role === 'organization' ? 'orgName' : 'firstName' };
        if (state.country.trim() && D.isKnownCountry && !D.isKnownCountry(state.country)) return { message: 'Choose a country from the list.', target: 'country' };
        // Only block a clear mismatch (city known to belong to a different
        // country). Cities not in our curated list — incl. geolocation results
        // and smaller towns — are allowed through.
        if (state.city.trim() && state.country.trim() && D.cityCountry) {
          var owner = D.cityCountry(state.city);
          if (owner && D.isKnownCountry(state.country) && owner.toLowerCase() !== state.country.trim().toLowerCase()) {
            return { message: 'This city belongs to ' + owner + ', not ' + state.country.trim() + '.', target: 'city' };
          }
        }
      }
      if (step === 3 && role === 'learner') {
        // A target language is only required for the Languages category; for
        // art / sport / digital etc. it's optional.
        var languagesCategory = !state.category || state.category === 'languages';
        if (!state.nativeLanguage.trim()) return { message: 'Enter your native language.', target: 'nativeLanguage' };
        if (languagesCategory && !state.learnLanguages.length) return { message: 'Choose at least one language to learn.', target: 'learnLanguages' };
        if (state.interests.length < 3) return { message: 'Select at least 3 interests.', target: 'interests' };
      }
      if (step === 3 && role === 'teacher') {
        var teacherLanguagesCategory = !state.category || state.category === 'languages';
        if (!state.nativeLanguage.trim()) return { message: 'Enter your native language.', target: 'nativeLanguage' };
        if (teacherLanguagesCategory && !state.teachLanguages.length) return { message: 'Choose at least one language you teach.', target: 'teachLanguages' };
        if (!teacherLanguagesCategory && !state.subcategories.length && !state.specialization.trim()) return { message: 'Choose a focus area or write your teaching headline.', target: 'subcategories' };
      }
      if (step === 3 && role === 'organizer') {
        if (!state.specialization.trim()) return { message: 'Write your organizer headline.', target: 'specialization' };
        if (!state.eventType.trim()) return { message: 'Enter your event type.', target: 'eventType' };
      }
      if (step === 3 && role === 'organization') {
        if (!state.orgType) return { message: 'Choose your organization type.', target: 'orgType' };
        if (!state.specialization.trim()) return { message: 'Write what your organization does.', target: 'specialization' };
      }
      return null;
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
        patch.language = state.nativeLanguage.trim() || null;
        patch.specialization = state.subcategories.length ? state.subcategories.slice() : (state.specialization.trim() ? [state.specialization.trim()] : []);
        patch.teaching_experience = state.experience || null;
        patch.teaches_languages = state.teachLanguages.slice();
        patch.qualifications = [state.qualifications, state.verification, state.rate ? ('Rate: ' + state.rate) : '', state.availability ? ('Availability: ' + state.availability) : '', state.format ? ('Format: ' + state.format) : ''].join(',').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.instagram = state.instagram.trim() || null;
        patch.tiktok = state.tiktok.trim() || null;
        patch.facebook = state.facebook.trim() || null;
        patch.linkedin = state.linkedin.trim() || null;
        patch.youtube = state.youtube.trim() || null;
        patch.telegram = state.telegram.trim() || null;
        patch.learning_languages = state.teachLanguages.slice();
        patch.learning_targets = [{
          category: state.category || 'languages',
          languages: state.teachLanguages.slice(),
          subcategories: state.subcategories.slice()
        }];
      }
      if (role === 'organizer') {
        patch.specialization = [state.specialization, state.eventType, state.format, state.audience].map(function (x) { return String(x || '').trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.learning_targets = [{
          category: state.category || 'languages',
          subcategories: state.subcategories.slice(),
          event_type: state.eventType.trim() || null,
          format: state.format.trim() || null,
          audience: state.audience.trim() || null
        }];
      }
      if (role === 'organization') {
        patch.specialization = [state.specialization, state.orgType, state.teamSize ? ('Team size: ' + state.teamSize) : ''].map(function (x) { return String(x || '').trim(); }).filter(Boolean);
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
        website_url: state.website.trim() || null,
        team_size: state.teamSize ? Number(state.teamSize) : null
      };
      function withoutOptionalOrgColumns(obj) {
        var copy = Object.assign({}, obj);
        delete copy.team_size;
        return copy;
      }
      var existing = await supa.from('organizations')
        .select('id')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle();
      if (existing.error) throw existing.error;
      var orgId = existing.data && existing.data.id;
      if (orgId) {
        var update = await supa.from('organizations').update(payload).eq('id', orgId);
        if (update.error && /team_size|schema cache|column/i.test(update.error.message || '')) {
          update = await supa.from('organizations').update(withoutOptionalOrgColumns(payload)).eq('id', orgId);
        }
        if (update.error) throw update.error;
      } else {
        var insert = await supa.from('organizations')
          .insert(Object.assign({}, payload, { slug: buildOrgSlug(name) }))
          .select('id')
          .single();
        if (insert.error && /team_size|schema cache|column/i.test(insert.error.message || '')) {
          insert = await supa.from('organizations')
            .insert(Object.assign({}, withoutOptionalOrgColumns(payload), { slug: buildOrgSlug(name) }))
            .select('id')
            .single();
        }
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
      showError('', '');
      var err = validate();
      if (err) { showError(err.message || err, err.target); return; }
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
    window.DuvelaResetOnboarding = function () {
      var u = ctx.getUser && ctx.getUser();
      if (u && u.id) localStorage.removeItem('duvela.onboarding.' + u.id);
      step = 1;
      role = ctx.session.role || 'learner';
      render();
      $('#onboardingOverlay').classList.add('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'false');
      return true;
    };

    form.addEventListener('submit', submit);
    $('#onboardingBack').addEventListener('click', back);
    return { openIfNeeded: openIfNeeded };
  }
  window.DuvelaAppOnboarding = { create: create };
})();
