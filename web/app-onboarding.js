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
      organization: ['Organization', 'Manage learning programs', 'Create your organization profile, directions and programs.']
    };
    var icon = { learner: '\uD83C\uDF92', teacher: '\u270F\uFE0F', organizer: '\uD83D\uDCC5', organization: '\uD83C\uDFE2' };
    var roleBenefits = {
      learner: ['Learn', 'Practice', 'Join live'],
      teacher: ['Teach', 'Earn', 'Build profile'],
      organizer: ['Host events', 'Build community', 'Manage attendees'],
      organization: ['Organization profile', 'Courses/events', 'Contacts']
    };
    var roleSummary = {
      learner: {
        title: 'Learner Hub',
        body: 'Best for people learning languages, skills or hobbies with courses, LIVE sessions and practice.',
        best: ['Personal recommendations', 'Language levels', 'Progress tracking']
      },
      teacher: {
        title: 'Teacher workspace',
        body: 'Best for tutors, coaches and experts who teach languages or other categories.',
        best: ['Teaching profile', 'Students and lessons', 'Social/contact fields']
      },
      organizer: {
        title: 'Organizer profile',
        body: 'Best for people who run events, clubs, workshops, speaking practice or community sessions.',
        best: ['Event type', 'Audience and location', 'Capacity and schedule']
      },
      organization: {
        title: 'Organization profile',
        body: 'Best for schools, academies, companies and communities that offer learning programs.',
        best: ['Business profile', 'Learning directions', 'Contacts']
      }
    };
    var studentGoal = window.DuvelaStudentGoal || {
      LEVELS: ['A2', 'B1', 'B2', 'C1'],
      normalize: function (value, fallback) {
        var levels = ['A2', 'B1', 'B2', 'C1'];
        var raw = String(value || '').trim().toUpperCase();
        var safeFallback = String(fallback || '').trim().toUpperCase();
        return levels.indexOf(raw) >= 0 ? raw : (levels.indexOf(safeFallback) >= 0 ? safeFallback : 'A2');
      },
      legacyPatch: function (value) { var level = String(value || 'A2').toUpperCase(); return { goal_level: level, learning_goal: level }; }
    };

    var categoryIcons = { languages: '🌐', art: '🎨', education: '🧠', digital: '💻', career: '💼', life: '🏠', sportFitness: '🏃', personalDevelopment: '✨' };
    var subcategoryIcons = { Drawing:'✏️', Painting:'🖌️', Sculpture:'🗿', Animation:'🎞️', 'Graphic design':'🖥️', Crafts:'🧶', 'Art history':'🏛️', 'Interview preparation':'💬', 'AI interview':'🤖', Programming:'💻', 'Web development':'🌐', 'Mobile development':'📱', 'UI/UX':'🎨', Figma:'🎨', 'Video editing':'🎬', 'Content creation':'✍️', Math:'➗', Physics:'⚛️', Chemistry:'🧪', Biology:'🧬', Logic:'🧩', Cooking:'🍳', 'Personal finance':'💰', Mindfulness:'🧘', Communication:'💬', Productivity:'⚡', Confidence:'💪', Running:'🏃', Fitness:'💪', Yoga:'🧘', Cycling:'🚴', Chess:'♟️' };
    var role = '';
    var step = 1;
    var minStep = 1;
    var roleLocked = false;
    // Structured state (not just FormData) so chips/levels survive re-renders.
    var state = {
      firstName: '', lastName: '', orgName: '', bio: '', city: '', country: '', gender: '',
      nativeLanguage: '', goal: '', level: 'A1', category: '', subcategories: [],
      learnLanguages: [], languageLevels: {}, goalLevels: {}, languageGoals: {}, interests: [],
      specialization: '', experience: '', teachLanguages: [], qualifications: '',
      format: '', website: '', orgType: '', dob: '', avatarFile: null, coverFile: null, avatarName: '', coverName: '',
      avatarPreview: '', coverPreview: '', coverPosition: 'center', coverPreset: 'duvela',
      email: '', phone: '', contactName: '', contactEmail: '', contactPhone: '', contactPosition: '',
      rate: '', availability: '', audience: '', eventType: '', verification: '',
      instagram: '', tiktok: '', facebook: '', linkedin: '', youtube: '', telegram: '',
      organizerType: '', locationMode: '', frequency: '', capacity: '', eventLanguages: [],
      organizationCategories: ['languages'], organizationSubcategories: { languages: [] },
      organizationLanguages: [], organizationAudience: [], programFormat: []
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

    function filePickerHtml(kind, label, selectedName) {
      var id = kind === 'cover' ? 'ob-coverFile' : 'ob-avatarFile';
      var name = kind === 'cover' ? 'coverFile' : 'avatarFile';
      return '<span class="ob-file-picker"><input id="' + id + '" name="' + name + '" type="file" accept="image/*">' +
        '<span class="ob-file-button">' + esc(label) + '</span><b>' + esc(selectedName || 'No file selected') + '</b></span>';
    }

    function title() {
      var c = copy[role] || copy.learner;
      $('#onboardingRoleBadge').textContent = role ? c[0] : 'Choose role';
      var who = (state.firstName || state.orgName || (ctx.getUser() && ctx.getUser().email ? ctx.getUser().email.split('@')[0] : 'there'));
      $('#onboardingLead').textContent = step === 1 ? 'Choose your starting role. Duvela will tailor the setup and Hub for you.'
        : step === 2 ? ('Nice to meet you, ' + who + '. Let’s build your profile.')
        : step === 3 ? c[2] : 'Your Duvela profile is ready to go.';
      $('#onboardingSubmit').textContent = step < 4 ? 'Continue →' : (role === 'learner' ? 'Open my Duvela →' : 'Open my workspace →');
      $('#onboardingKicker').textContent = 'DUVELA · STEP ' + step + ' OF 4';
    }

    function stepTwoHtml() {
      var avatarPreview = state.avatarPreview ? '<div class="ob-avatar-preview"><img src="' + esc(state.avatarPreview) + '" alt=""></div>' : '<div class="ob-avatar-preview ob-empty-preview">Photo</div>';
      var coverPreview = state.coverPreview ? '<div class="ob-cover-preview"><img src="' + esc(state.coverPreview) + '" alt="" style="object-position:center ' + esc(state.coverPosition) + '"></div>' : '<div class="ob-cover-preview" style="background:' + esc(gradientCss(coverPresetById(state.coverPreset))) + '"><span>Cover color</span></div>';
      var html = '<div class="ob-upload-grid wide"><label class="ob-upload-card"><span class="ob-upload-title">Profile photo or logo</span>' + avatarPreview + filePickerHtml('avatar', 'Choose photo', state.avatarName) +
        '<small style="font-weight:600;color:var(--muted)">JPG or PNG, up to 5 MB</small></label>';
      html += '<label class="ob-upload-card"><span class="ob-upload-title">Cover photo</span>' + coverPreview + filePickerHtml('cover', 'Choose cover', state.coverName) + '<small style="font-weight:600;color:var(--muted)">JPG or PNG, up to 5 MB. Cropped to profile cover ratio.</small><select id="ob-coverPosition" name="coverPosition"><option value="top"' + (state.coverPosition === 'top' ? ' selected' : '') + '>Crop top</option><option value="center"' + (state.coverPosition === 'center' ? ' selected' : '') + '>Crop center</option><option value="bottom"' + (state.coverPosition === 'bottom' ? ' selected' : '') + '>Crop bottom</option></select>' + coverPresetHtml() + '</label></div>';
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
      if (role === 'organization') {
        html += labelInput('bio', 'Organization description', state.bio, { wide: true, hint: 'A few words about your organization', placeholder: 'For example: We run language courses, workshops and community learning programs.' });
      } else {
        html += labelInput('bio', 'Short introduction', state.bio, { wide: true, hint: 'A few words about you', placeholder: 'For example: I enjoy learning languages and meeting people from different cultures.' });
      }
      return html + '<div id="ob-autocomplete" class="ob-autocomplete" hidden></div>';
    }

    function stepThreeHtml() {
      if (role === 'learner') {
        return '<div class="ob-extra-title">Your learning profile</div>' +
          nativeLanguagePickerHtml() +
          '<label class="wide">Learning category<small style="font-weight:600;color:var(--muted)">Choose one direction</small></label>' +
          categoryCardsHtml('category', state.category) +
          ((state.category || 'languages') === 'languages' ?
            '<label class="wide">Languages you want to learn<small id="ob-lang-hint" style="font-weight:600;color:var(--muted)">Choose up to 3</small></label>' +
            langScroll('learnLanguages', state.learnLanguages) +
            '<div id="ob-lang-levels">' + languageLevelsHtml() + '</div>' : generalGoalHtml()) +
          '<label class="wide">Interests<small style="font-weight:600;color:var(--muted)">Select at least 3 interests to personalise your Hub</small></label>' +
          chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; }) +
          '<div id="ob-autocomplete" class="ob-autocomplete" hidden></div>';
      }
      if (role === 'teacher') {
        return '<div class="ob-extra-title">Professional profile</div><div class="ob-extra-grid">' +
          labelInput('specialization', 'Teaching headline', state.specialization, { placeholder: 'For example: Creative drawing for beginners' }) +
          labelInput('experience', 'Years of experience', state.experience, { type: 'number', attr: 'min="0"' }) +
          '</div>' +
          nativeLanguagePickerHtml() +
          '<label class="wide">Teaching category<small style="font-weight:600;color:var(--muted)">Choose what you teach</small></label>' +
          categoryCardsHtml('category', state.category) +
          '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[state.category] ? '' : ' hidden') + '>' +
            '<label class="wide">Focus areas<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
            '<div id="ob-subcats">' + subcatHtml() + '</div>' +
          '</div>' +
          ((state.category || 'languages') === 'languages' ? '<label class="wide">Languages you teach<small style="font-weight:600;color:var(--muted)">Choose up to 3</small></label>' + langScroll('teachLanguages', state.teachLanguages) + languageLimitCounter('teachLanguages', state.teachLanguages) : '') +
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
          labelInput('capacity', 'Capacity / group size', state.capacity, { type: 'number', attr: 'min="1"', placeholder: 'For example: 20' }) +
          labelInput('website', 'Website', state.website, { type: 'url' }) +
        '</div>' +
        '<label class="wide">Organizer type<small style="font-weight:600;color:var(--muted)">Choose who organizes</small></label>' +
        organizerTypeCardsHtml() +
        '<label class="wide">Event type<small style="font-weight:600;color:var(--muted)">Choose your main event format</small></label>' +
        eventTypeCardsHtml() +
        '<label class="wide">Organizer category<small style="font-weight:600;color:var(--muted)">Choose event direction</small></label>' +
        categoryCardsHtml('category', state.category) +
        '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[state.category] ? '' : ' hidden') + '>' +
          '<label class="wide">Focus areas<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
          '<div id="ob-subcats">' + subcatHtml() + '</div>' +
        '</div>' +
        '<label class="wide">Event languages<small style="font-weight:600;color:var(--muted)">Optional — choose up to 3</small></label>' +
        langScroll('eventLanguages', state.eventLanguages) +
        '<label class="wide">Location mode<small style="font-weight:600;color:var(--muted)">Where events happen</small></label>' +
        locationModeCardsHtml() +
        '<label class="wide">Audience<small style="font-weight:600;color:var(--muted)">Who the event is for</small></label>' +
        audienceCardsHtml() +
        '<label class="wide">Frequency<small style="font-weight:600;color:var(--muted)">How often you organize</small></label>' +
        frequencyCardsHtml() +
        '<div class="ob-extra-title">Contact / social media</div><div class="ob-extra-grid">' +
        labelInput('instagram', 'Instagram', state.instagram, { placeholder: '@handle or link' }) +
        labelInput('tiktok', 'TikTok', state.tiktok, { placeholder: '@handle or link' }) +
        labelInput('telegram', 'Telegram', state.telegram, { placeholder: '@handle or link' }) +
        labelInput('email', 'Contact email', state.email, { type: 'email', placeholder: 'hello@example.com' }) +
        '</div>' +
        labelInput('verification', 'Organizer verification', state.verification, { wide: true, placeholder: 'Past events, links, community proof, documents later' }) +
        '<label class="wide">Interests</label>' + chipList('interests', D.INTERESTS || [], state.interests, function (it) { return it.icon + ' ' + it.label; });
      }
      // organization
      var activeOrganizationCategory = organizationActiveCategory();
      return '<div class="ob-extra-title">Organization setup</div>' +
        '<label class="wide">Organization type<small style="font-weight:600;color:var(--muted)">Choose your workspace type</small></label>' +
        orgTypeCardsHtml() +
        labelInput('specialization', 'What does your organization do?', state.specialization, { wide: true, placeholder: 'Short description for learners, teachers and partners' }) +
        '<div id="ob-org-selected" class="wide">' + organizationSelectedSummaryHtml() + '</div>' +
        '<label class="wide">Learning / business categories<small style="font-weight:600;color:var(--muted)">Choose one or more directions. Selected categories stay saved.</small></label>' +
        categoryCardsHtml('category', state.organizationCategories, activeOrganizationCategory) +
        '<div id="ob-subcats-wrap"' + ((D.SUBCATEGORIES || {})[activeOrganizationCategory] ? '' : ' hidden') + '>' +
          '<label class="wide">Focus areas for ' + esc(categoryLabel(activeOrganizationCategory)) + '<small style="font-weight:600;color:var(--muted)">Optional — choose as many as needed</small></label>' +
          '<div id="ob-subcats">' + subcatHtml() + '</div>' +
        '</div>' +
        '<label class="wide">Languages / markets<small style="font-weight:600;color:var(--muted)">Optional — choose as many as needed</small></label>' +
        langScroll('organizationLanguages', state.organizationLanguages) +
        '<label class="wide">Audience<small style="font-weight:600;color:var(--muted)">Choose all that apply</small></label>' +
        organizationAudienceCardsHtml() +
        '<label class="wide">Program format<small style="font-weight:600;color:var(--muted)">Choose all that apply</small></label>' +
        organizationFormatCardsHtml() +
        '<div class="ob-extra-title">Public contacts</div><div class="ob-extra-grid">' +
        labelInput('website', 'Website', state.website, { type: 'url', placeholder: 'https://example.com' }) +
        labelInput('email', 'Public email', state.email, { type: 'email', placeholder: 'hello@example.com' }) +
        labelInput('phone', 'Public phone', state.phone, { type: 'tel', placeholder: '+49...' }) +
        labelInput('telegram', 'Telegram', state.telegram, { placeholder: '@channel or link' }) +
        labelInput('instagram', 'Instagram', state.instagram, { placeholder: '@handle or link' }) +
        labelInput('linkedin', 'LinkedIn', state.linkedin, { placeholder: 'Company page link' }) +
        '</div><div class="ob-extra-title">Business contact</div><div class="ob-extra-grid">' +
        labelInput('contactName', 'Contact name', state.contactName, { placeholder: 'Responsible person' }) +
        labelInput('contactPosition', 'Contact position', state.contactPosition, { placeholder: 'Manager, Director...' }) +
        labelInput('contactEmail', 'Contact email', state.contactEmail, { type: 'email', placeholder: 'contact@example.com' }) +
        labelInput('contactPhone', 'Contact phone', state.contactPhone, { type: 'tel', placeholder: '+49...' }) +
        '</div>' +
        labelInput('verification', 'Business verification', state.verification, { wide: true, placeholder: 'Registration number, website, public profile, documents later' });
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

    function nativeLanguagePickerHtml() {
      return '<label class="wide">Native language<small style="font-weight:600;color:var(--muted)">Choose one</small></label>' +
        langScroll('nativeLanguage', state.nativeLanguage ? [state.nativeLanguage] : []);
    }

    function languageLimitCounter(kind, selected) {
      return '<div class="ob-selection-head ob-lang-counter" data-lang-counter="' + esc(kind) + '"><span></span><b>' + selected.length + '/3 selected</b></div>';
    }

    function categoryCardsHtml(kind, selected, current) {
      return '<div class="ob-category-grid wide" data-category-group="' + kind + '">' + (D.CATEGORIES || []).map(function (it) {
        var on = Array.isArray(selected) ? selected.indexOf(it.id) !== -1 : (selected === it.id || (!selected && it.id === 'languages'));
        var editing = Array.isArray(selected) && current === it.id;
        var iconText = categoryIcons[it.id] || '*';
        return '<button type="button" class="ob-category-card' + (on ? ' active' : '') + (editing ? ' editing' : '') + '" data-category-card="' + esc(it.id) + '"><span>' + esc(iconText) + '</span><b>' + esc(it.label) + '</b>' + (editing ? '<small>Editing focus areas</small>' : '') + '</button>';
      }).join('') + '</div>';
    }

    function optionCardsHtml(kind, selected, items) {
      return '<div class="ob-option-grid wide" data-option-group="' + kind + '">' + items.map(function (it) {
        var on = Array.isArray(selected) ? selected.indexOf(it.id) !== -1 : selected === it.id;
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

    function organizerTypeCardsHtml() {
      return optionCardsHtml('organizerType', state.organizerType, [
        { id: 'individual', label: 'Individual', icon: '👤', hint: 'Solo organizer' },
        { id: 'community', label: 'Community', icon: '🌐', hint: 'Local group' },
        { id: 'academy', label: 'School/Academy', icon: '🎓', hint: 'Learning provider' },
        { id: 'company', label: 'Company', icon: '🏢', hint: 'Team events' },
        { id: 'nonprofit', label: 'Non-profit', icon: '🤝', hint: 'Open programs' }
      ]);
    }

    function eventTypeCardsHtml() {
      return optionCardsHtml('eventType', state.eventType, [
        { id: 'meetup', label: 'Meetup', icon: '📍', hint: 'Community gathering' },
        { id: 'workshop', label: 'Workshop', icon: '🛠️', hint: 'Hands-on practice' },
        { id: 'speaking_club', label: 'Speaking club', icon: '💬', hint: 'Conversation' },
        { id: 'live_session', label: 'Live session', icon: '🎥', hint: 'Online live' },
        { id: 'challenge', label: 'Challenge', icon: '🏁', hint: 'Goal-based' },
        { id: 'course_event', label: 'Course event', icon: '📚', hint: 'Class session' }
      ]);
    }

    function locationModeCardsHtml() {
      return optionCardsHtml('locationMode', state.locationMode, [
        { id: 'online', label: 'Online', icon: '💻', hint: 'Remote events' },
        { id: 'offline', label: 'Offline', icon: '📍', hint: 'In person' },
        { id: 'hybrid', label: 'Hybrid', icon: '🔁', hint: 'Both modes' }
      ]);
    }

    function organizationAudienceCardsHtml() {
      return optionCardsHtml('organizationAudience', state.organizationAudience, [
        { id: 'employees', label: 'Employees', icon: '\uD83D\uDC65', hint: 'Internal training' },
        { id: 'students', label: 'Students', icon: '\uD83C\uDF93', hint: 'School or academy' },
        { id: 'teachers', label: 'Teachers', icon: '\uD83E\uDDD1\u200D\uD83C\uDFEB', hint: 'Tutor team' },
        { id: 'clients', label: 'Clients', icon: '\uD83E\uDD1D', hint: 'Customer education' },
        { id: 'community', label: 'Community', icon: '\uD83C\uDF10', hint: 'Open programs' },
        { id: 'families', label: 'Families', icon: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', hint: 'Family learning' }
      ]);
    }

    function organizationFormatCardsHtml() {
      return optionCardsHtml('programFormat', state.programFormat, [
        { id: 'online', label: 'Online', icon: '\uD83D\uDCBB', hint: 'Remote learning' },
        { id: 'offline', label: 'Offline', icon: '\uD83D\uDCCD', hint: 'In person' },
        { id: 'hybrid', label: 'Hybrid', icon: '\uD83D\uDD01', hint: 'Both modes' },
        { id: 'courses', label: 'Courses', icon: '\uD83D\uDCDA', hint: 'Structured programs' },
        { id: 'events', label: 'Events', icon: '\uD83D\uDCC5', hint: 'Workshops/LIVE' },
        { id: 'custom', label: 'Custom', icon: '\u2699\uFE0F', hint: 'Flexible setup' }
      ]);
    }
    function audienceCardsHtml() {
      return optionCardsHtml('audience', state.audience, [
        { id: 'learners', label: 'Learners', icon: '🎒', hint: 'Students' },
        { id: 'teachers', label: 'Teachers', icon: '🧑‍🏫', hint: 'Educators' },
        { id: 'kids', label: 'Kids', icon: '🧒', hint: 'Children' },
        { id: 'adults', label: 'Adults', icon: '🧑', hint: 'Adult learners' },
        { id: 'teams', label: 'Teams', icon: '👥', hint: 'Companies' },
        { id: 'families', label: 'Families', icon: '👨‍👩‍👧', hint: 'Family groups' }
      ]);
    }

    function frequencyCardsHtml() {
      return optionCardsHtml('frequency', state.frequency, [
        { id: 'one_time', label: 'One-time', icon: '①', hint: 'Single event' },
        { id: 'weekly', label: 'Weekly', icon: '📅', hint: 'Every week' },
        { id: 'monthly', label: 'Monthly', icon: '🗓️', hint: 'Every month' },
        { id: 'custom', label: 'Custom', icon: '⚙️', hint: 'Flexible' }
      ]);
    }

    function langHint() {
      return (!state.category || state.category === 'languages') ? 'Choose up to 3' : 'Optional — choose up to 3';
    }

    function subcatHtml() {
      var category = role === 'organization' ? organizationActiveCategory() : state.category;
      var subs = (D.SUBCATEGORIES || {})[category];
      if (!subs) return '';
      var counter = role === 'organization' ? (state.subcategories.length + ' selected') : (state.subcategories.length + '/3 selected');
      return '<div class="ob-selection-head"><span>Focus areas</span><b id="ob-subcat-count">' + counter + '</b></div>' + chipList('subcategories', subs, state.subcategories, function (item) { return (subcategoryIcons[item] || '✦') + ' ' + item; }) + '<button type="button" class="ob-clear-selection" data-clear-selection="subcategories">Clear selection</button>';
    }

    function languageLevelsHtml() {
      if (!state.learnLanguages.length) return '';
      return '<div class="ob-summary-title">Selected languages and exam goals</div><div class="ob-lang-goals-grid">' + state.learnLanguages.map(function (lang) {
        var currentLevel = state.languageLevels[lang] || state.level || 'A1';
        var targetLevel = studentGoal.normalize(state.goalLevels[lang], currentLevel);
        return '<section class="ob-lang-goal-card"><div><b>' + esc(lang) + '</b><small>' + esc(currentLevel) + ' -> ' + esc(targetLevel) + '</small></div>' +
          '<label class="ob-lang-level">Current level<select data-lang-level="' + esc(lang) + '">' + (D.LEVELS || ['A1']).map(function (l) {
            return '<option' + (l === currentLevel ? ' selected' : '') + '>' + l + '</option>';
          }).join('') + '</select></label>' +
          '<label class="ob-lang-level">My goal<select data-lang-goal-level="' + esc(lang) + '">' + studentGoal.LEVELS.map(function (l) {
            return '<option' + (l === targetLevel ? ' selected' : '') + '>' + l + '</option>';
          }).join('') + '</select></label></section>';
      }).join('') + '</div>';
    }

    function generalGoalKey() {
      return 'category:' + (state.category || 'languages');
    }

    function generalGoalHtml() {
      var key = generalGoalKey();
      var targetLevel = studentGoal.normalize(state.goalLevels[key], state.level || 'A1');
      return '<div id="ob-general-goal"><div class="ob-summary-title">Your goal</div><section class="ob-lang-goal-card">' +
        '<div><b>' + esc(categoryLabel(state.category)) + '</b><small>' + esc(targetLevel) + '</small></div>' +
        '<label class="ob-lang-level wide">My goal<select id="ob-goal" data-lang-goal-level="' + esc(key) + '">' + studentGoal.LEVELS.map(function (l) {
          return '<option' + (l === targetLevel ? ' selected' : '') + '>' + l + '</option>';
        }).join('') + '</select></label></section></div>';
    }

    function selectedLanguageSummary(list) {
      var langs = list || state.learnLanguages;
      if (!langs.length) return '<span class="muted">No language selected</span>';
      return langs.map(function (lang) {
        var currentLevel = state.languageLevels[lang] || state.level || 'A1';
        var targetLevel = studentGoal.normalize(state.goalLevels[lang], currentLevel);
        return '<span class="ob-preview-pill">' + esc(lang) + ' ' + esc(currentLevel) + ' -> ' + esc(targetLevel) + '</span>';
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

    function categoryLabel(id) {
      var found = (D.CATEGORIES || []).filter(function (it) { return it.id === id; })[0];
      return found ? found.label : (id || 'Languages');
    }

    function organizationActiveCategory() {
      var selected = state.organizationCategories.length ? state.organizationCategories : ['languages'];
      return selected.indexOf(state.category) !== -1 ? state.category : selected[0];
    }

    function saveActiveOrganizationFocusAreas() {
      var category = organizationActiveCategory();
      state.organizationSubcategories[category] = state.subcategories.slice();
    }

    function organizationFocusItems() {
      saveActiveOrganizationFocusAreas();
      var items = [];
      state.organizationCategories.forEach(function (category) {
        (state.organizationSubcategories[category] || []).forEach(function (focus) {
          items.push(categoryLabel(category) + ': ' + focus);
        });
      });
      return items;
    }

    function organizationCategoryPillsHtml() {
      var canRemove = state.organizationCategories.length > 1;
      return state.organizationCategories.map(function (category) {
        return '<button type="button" class="ob-preview-pill ob-removable-pill" data-remove-organization-category="' + esc(category) + '"' + (canRemove ? '' : ' disabled aria-disabled="true"') + '>' +
          esc(categoryLabel(category)) + (canRemove ? '<span aria-hidden="true">×</span>' : '') +
        '</button>';
      }).join('');
    }

    function organizationSelectedSummaryHtml() {
      var focusItems = organizationFocusItems();
      var items = [];
      focusItems.forEach(function (x) { items.push('Focus: ' + x); });
      state.organizationLanguages.forEach(function (x) { items.push('Market: ' + x); });
      state.organizationAudience.forEach(function (x) { items.push('Audience: ' + x); });
      state.programFormat.forEach(function (x) { items.push('Format: ' + x); });
      var total = state.organizationCategories.length + items.length;
      return '<section class="ob-selected-panel"><div class="ob-selection-head"><span>Selected directions</span><b>' + total + ' selected</b></div>' +
        '<div class="ob-selected-categories">' + organizationCategoryPillsHtml() + '</div>' +
        '<div>' + (items.length ? selectedItemsSummary(items) : '<span class="muted">Add focus areas, languages / markets, audience and format. Click a category below to edit its focus areas.</span>') + '</div>' +
      '</section>';
    }

    function profilePreviewHtml() {
      var name = role === 'organization' ? state.orgName : [state.firstName, state.lastName].filter(Boolean).join(' ');
      var category = (D.CATEGORIES || []).filter(function (c) { return c.id === (state.category || 'languages'); })[0];
      var categoryTitle = role === 'organization' ? 'Organization type' : (role === 'organizer' ? 'Event direction' : 'Category');
      var categoryValue = role === 'organization' ? (state.orgType || 'Not set') : (category ? category.label : 'Languages');
      var goalTitle = role === 'organization' ? 'Description' : (role === 'organizer' ? 'Event type' : 'Goal');
      var goalValue = role === 'organization' ? (state.specialization || 'Not set') : (role === 'organizer' ? (state.eventType || state.specialization || 'Not set') : (state.level || state.goal || state.specialization || 'Not set'));
      var socialItems = [state.instagram, state.tiktok, state.facebook, state.linkedin, state.youtube, state.telegram].filter(Boolean);
      var organizerContact = [state.website, state.email, state.instagram, state.tiktok, state.telegram].filter(Boolean);
      var organizationDirections = role === 'organization' ? state.organizationCategories.map(categoryLabel) : [];
      var organizationFocus = role === 'organization' ? organizationFocusItems() : [];
      var verificationStatus = role === 'organization' ? (state.verification.trim() ? 'Pending verification' : 'Not verified yet') : '';
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
          '<div><b>' + esc(role === 'organization' ? 'Program format' : 'Native language') + '</b><p>' + esc(role === 'organization' ? (state.programFormat.join(', ') || 'Not set') : (state.nativeLanguage || 'Not set')) + '</p></div>' +
        '</div>' +
        (role === 'learner' ? '<div class="ob-preview-section"><b>Selected languages and levels</b><div>' + selectedLanguageSummary(state.learnLanguages) + '</div></div>' : '') +
        (role === 'teacher' && state.teachLanguages.length ? '<div class="ob-preview-section"><b>Languages you teach</b><div>' + selectedItemsSummary(state.teachLanguages) + '</div></div>' : '') +
        (role === 'teacher' && socialItems.length ? '<div class="ob-preview-section"><b>Social media</b><div>' + selectedItemsSummary(socialItems) + '</div></div>' : '') +
        (role === 'organizer' ? '<div class="ob-preview-section"><b>Organizer setup</b><div>' + selectedItemsSummary([state.organizerType, state.locationMode, state.audience, state.frequency, state.capacity ? ('Capacity ' + state.capacity) : ''].filter(Boolean)) + '</div></div>' : '') +
        (role === 'organizer' && state.eventLanguages.length ? '<div class="ob-preview-section"><b>Event languages</b><div>' + selectedItemsSummary(state.eventLanguages) + '</div></div>' : '') +
        (role === 'organizer' && organizerContact.length ? '<div class="ob-preview-section"><b>Contact / social</b><div>' + selectedItemsSummary(organizerContact) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Organization setup</b><div>' + selectedItemsSummary([state.specialization].concat(state.organizationAudience, state.programFormat).filter(Boolean)) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Learning directions</b><div>' + selectedItemsSummary(organizationDirections) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Verification status</b><div>' + selectedItemsSummary([verificationStatus]) + '</div></div>' : '') +
        (role === 'organization' && state.organizationLanguages.length ? '<div class="ob-preview-section"><b>Languages / markets</b><div>' + selectedItemsSummary(state.organizationLanguages) + '</div></div>' : '') +
        (role === 'organization' && socialItems.length ? '<div class="ob-preview-section"><b>Social media</b><div>' + selectedItemsSummary(socialItems) + '</div></div>' : '') +
        (role === 'organization' ? '<div class="ob-preview-section"><b>Business contacts</b><div>' + selectedItemsSummary([state.website, state.email, state.phone, state.contactName, state.contactEmail].filter(Boolean)) + '</div></div>' : '') +
        (role !== 'learner' ? '<div class="ob-preview-section"><b>Focus areas</b><div>' + selectedItemsSummary(role === 'organization' ? organizationFocus : state.subcategories) + '</div></div>' : '') +
        (role !== 'organization' ? '<div class="ob-preview-section"><b>Interests</b><div>' + selectedItemsSummary(interestLabels()) + '</div></div>' : '') +
      '</div>';
    }

    function stepOneHtml() {
      var summary = role ? (roleSummary[role] || roleSummary.learner) : {
        title: 'Choose your role',
        body: 'Select how you want to use Duvela. The next steps will match this choice.',
        best: ['Learner Hub', 'Teacher workspace', 'Organizer tools', 'Organization profile']
      };
      var next = role === 'organization'
        ? ['Business details', 'Learning directions', 'Preview and save']
        : role === 'organizer'
          ? ['Profile details', 'Event setup', 'Preview and save']
          : role === 'teacher'
            ? ['Profile details', 'Teaching setup', 'Preview and save']
            : ['Profile details', 'Learning setup', 'Preview and save'];
      return '<div class="ob-role-info wide">' +
        '<section class="ob-role-summary"><div class="ob-role-summary-icon">' + esc(icon[role]) + '</div><h3>' + esc(summary.title) + '</h3><p>' + esc(summary.body) + '</p><ul>' +
          summary.best.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ul><small>' + esc('Choose once, then continue to your matching setup.') + '</small></section>' +
        '<section class="ob-next-steps"><h3>What happens next</h3><ol>' +
          next.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
        '</ol><p class="ob-account-note">One account can later access multiple spaces.</p></section>' +
      '</div>';
    }

    function enforceSelectionLimits() {
      state.learnLanguages = state.learnLanguages.slice(0, 3);
      state.teachLanguages = state.teachLanguages.slice(0, 3);
      state.eventLanguages = state.eventLanguages.slice(0, 3);
      if (role !== 'organization') state.subcategories = state.subcategories.slice(0, 3);
      var allowed = {};
      state.learnLanguages.forEach(function (language) { allowed[language] = true; });
      Object.keys(state.languageLevels || {}).forEach(function (language) { if (!allowed[language]) delete state.languageLevels[language]; });
      Object.keys(state.goalLevels || {}).forEach(function (target) { if (target.indexOf('category:') !== 0 && !allowed[target]) delete state.goalLevels[target]; });
      Object.keys(state.languageGoals || {}).forEach(function (target) { if (target.indexOf('category:') !== 0 && !allowed[target]) delete state.languageGoals[target]; });
    }

    function bindLanguageGoalFields() {
      form.querySelectorAll('[data-lang-level]').forEach(function (sel) {
        sel.onchange = function () {
          state.languageLevels[sel.dataset.langLevel] = sel.value;
          if (!state.goalLevels[sel.dataset.langLevel]) state.goalLevels[sel.dataset.langLevel] = sel.value;
        };
      });
      form.querySelectorAll('[data-lang-goal-level]').forEach(function (sel) {
        sel.onchange = function () {
          state.goalLevels[sel.dataset.langGoalLevel] = studentGoal.normalize(sel.value, 'A2');
          if (sel.dataset.langGoalLevel === generalGoalKey()) state.goal = state.goalLevels[sel.dataset.langGoalLevel];
        };
      });
      form.querySelectorAll('[data-lang-goal]').forEach(function (input) {
        input.oninput = function () {
          state.languageGoals[input.dataset.langGoal] = input.value;
          if (input.dataset.langGoal === generalGoalKey()) state.goal = input.value;
        };
      });
    }

    function render() {
      enforceSelectionLimits();
      title();
      document.querySelectorAll('.onboarding-step').forEach(function (x, i) {
        x.className = 'onboarding-step ' + (i + 1 <= step ? 'active' : '');
      });
      var rolesBox = $('#onboardingRoles');
      rolesBox.style.display = step === 1 && minStep <= 1 ? 'grid' : 'none';
      rolesBox.innerHTML = roles.map(function (r) {
        var benefits = (roleBenefits[r] || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
        var disabled = roleLocked && r !== role ? ' disabled aria-disabled="true"' : '';
        return '<button type="button" class="' + (r === role ? 'active' : '') + '" data-ob-role="' + r + '"' + disabled + '><span class="role-icon">' + esc(icon[r]) + '</span><b>' + esc(copy[r][0]) + '</b><small>' + esc(copy[r][1]) + '</small><em class="role-selected">Selected</em><ul class="ob-role-benefits">' + benefits + '</ul></button>';
      }).join('');

      var html = '';
      if (step === 1) html = stepOneHtml();
      // Wrap in .wide so the structural divs span the full grid width and lay
      // out as normal block flow (the form itself is a 2-column grid).
      if (step === 2) html = '<div class="wide ob-section">' + stepTwoHtml() + '</div>';
      if (step === 3) html = '<div class="wide ob-section">' + stepThreeHtml() + '</div>';
      if (step === 4) html = '<div class="onboarding-welcome wide" style="text-align:center;padding:22px"><div style="font-size:48px">✨</div><h3 style="font-size:24px;margin:10px 0">Profile ready!</h3><p>Your Duvela space is personalised for ' + esc((copy[role] || copy.learner)[0]) + '. You can edit everything later in Profile.</p></div>';
      if (step === 4) html = profilePreviewHtml();
      form.innerHTML = html;

      rolesBox.querySelectorAll('[data-ob-role]').forEach(function (b) {
        b.onclick = function () { if (roleLocked) return; role = b.dataset.obRole; render(); };
      });
      $('#onboardingBack').style.display = step > minStep ? 'inline-flex' : 'none';
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

    function removeOrganizationCategory(category) {
      if (state.organizationCategories.length <= 1) return;
      saveActiveOrganizationFocusAreas();
      state.organizationCategories = state.organizationCategories.filter(function (item) { return item !== category; });
      delete state.organizationSubcategories[category];
      if (state.category === category || state.organizationCategories.indexOf(state.category) === -1) {
        state.category = state.organizationCategories[0];
        state.subcategories = (state.organizationSubcategories[state.category] || []).slice();
      }
      render();
    }

    function bindOrganizationSummary() {
      form.querySelectorAll('[data-remove-organization-category]').forEach(function (btn) {
        btn.onclick = function () { removeOrganizationCategory(btn.dataset.removeOrganizationCategory); };
      });
    }

    function bindStep() {
      // chips
      form.querySelectorAll('[data-chip]').forEach(function (btn) {
        btn.onclick = function () { toggleChip(btn.dataset.chip, btn.dataset.value); };
      });
      form.querySelectorAll('[data-clear-selection]').forEach(function (btn) {
        btn.onclick = function () {
          state.subcategories = [];
          if (role === 'organization') saveActiveOrganizationFocusAreas();
          render();
        };
      });
      bindOrganizationSummary();
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
          if (role === 'organization') {
            saveActiveOrganizationFocusAreas();
            var organizationCategory = btn.dataset.categoryCard;
            if (state.organizationCategories.indexOf(organizationCategory) === -1) {
              state.organizationCategories.push(organizationCategory);
            }
            state.category = organizationCategory;
            state.subcategories = (state.organizationSubcategories[organizationCategory] || []).slice();
            render();
            return;
          }
          state.category = btn.dataset.categoryCard;
          state.subcategories = [];
          if (state.category !== 'languages') {
            state.learnLanguages = [];
            state.teachLanguages = [];
            if (role !== 'organization') state.organizationLanguages = [];
            state.languageLevels = {};
            state.goalLevels = {};
            state.languageGoals = {};
          }
          render();
        };
      });
      form.querySelectorAll('[data-option-kind]').forEach(function (btn) {
        btn.onclick = function () {
          var kind = btn.dataset.optionKind;
          var value = btn.dataset.optionValue;
          if (kind === 'organizationAudience' || kind === 'programFormat') {
            var arr = state[kind] || [];
            var idx = arr.indexOf(value);
            if (idx === -1) arr.push(value);
            else arr.splice(idx, 1);
            state[kind] = arr;
          } else {
            state[kind] = value;
          }
          render();
        };
      });
      // avatar
      var avatar = $('#ob-avatarFile');
      if (avatar) avatar.onchange = function () {
        state.avatarFile = avatar.files && avatar.files[0];
        state.avatarName = state.avatarFile ? state.avatarFile.name : '';
        state.avatarPreview = state.avatarFile ? URL.createObjectURL(state.avatarFile) : '';
        render();
      };
      var cover = $('#ob-coverFile');
      if (cover) cover.onchange = function () {
        state.coverFile = cover.files && cover.files[0];
        state.coverName = state.coverFile ? state.coverFile.name : '';
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
      // per-language level and goal controls
      bindLanguageGoalFields();
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
      if (kind === 'nativeLanguage') {
        state.nativeLanguage = value;
        var nativeGroup = form.querySelector('[data-chip-group="nativeLanguage"]');
        if (nativeGroup) nativeGroup.querySelectorAll('[data-chip]').forEach(function (b) {
          b.classList.toggle('active', b.dataset.value === value);
        });
        showError('', '');
        return;
      }
      var arr = kind === 'learnLanguages' ? state.learnLanguages
        : kind === 'interests' ? state.interests
        : kind === 'subcategories' ? state.subcategories
        : kind === 'teachLanguages' ? state.teachLanguages
        : kind === 'organizationLanguages' ? state.organizationLanguages
        : kind === 'eventLanguages' ? state.eventLanguages : null;
      if (!arr) return;
      var idx = arr.indexOf(value);
      if (idx === -1) {
        if (kind === 'learnLanguages' && arr.length >= 3) return;
        if (kind === 'teachLanguages' && arr.length >= 3) {
          showError('Choose up to 3 languages you teach.', 'teachLanguages');
          return;
        }
        if (kind === 'eventLanguages' && arr.length >= 3) return;
        if (kind === 'subcategories' && role !== 'organization' && arr.length >= 3) return;
        arr.push(value);
        if (kind === 'learnLanguages') {
          state.languageLevels[value] = state.languageLevels[value] || state.level;
          state.goalLevels[value] = state.goalLevels[value] || state.languageLevels[value] || state.level;
        }
      } else {
        arr.splice(idx, 1);
        if (kind === 'learnLanguages') {
          delete state.languageLevels[value];
          delete state.goalLevels[value];
          delete state.languageGoals[value];
        }
      }
      // Re-render just the affected group + language levels without losing focus.
      var group = form.querySelector('[data-chip-group="' + kind + '"]');
      if (group) group.querySelectorAll('[data-chip]').forEach(function (b) {
        b.classList.toggle('active', arr.indexOf(b.dataset.value) !== -1);
      });
      var langCounter = form.querySelector('[data-lang-counter="' + kind + '"] b');
      if (langCounter) langCounter.textContent = arr.length + '/3 selected';
      if (kind === 'subcategories') {
        if (role === 'organization') saveActiveOrganizationFocusAreas();
        var count = $('#ob-subcat-count');
        if (count) count.textContent = role === 'organization' ? (state.subcategories.length + ' selected') : (state.subcategories.length + '/3 selected');
      }
      if (role === 'organization' && (kind === 'subcategories' || kind === 'organizationLanguages')) {
        var selectedBox = $('#ob-org-selected');
        if (selectedBox) {
          selectedBox.innerHTML = organizationSelectedSummaryHtml();
          bindOrganizationSummary();
        }
      }
      if (kind === 'learnLanguages') { var box = $('#ob-lang-levels'); if (box) { box.innerHTML = languageLevelsHtml(); bindLanguageGoalFields(); } }
    }

    function showAutocomplete(kind, input) {
      var box = $('#ob-autocomplete');
      if (!box) return;
      var query = String(input.value || '').trim().toLowerCase();
      var list = [];
      if (kind === 'nativeLanguage') {
        list = D.getLanguageSuggestions
          ? D.getLanguageSuggestions(input.value, 6)
          : (D.LANGUAGES || []).filter(function (lang) {
              return !query || String(lang).toLowerCase().indexOf(query) !== -1;
            }).slice(0, 6);
      } else if (kind === 'country' && D.getCountrySuggestions) {
        list = D.getCountrySuggestions(input.value, 6);
      } else if (kind === 'city' && D.getCitySuggestions) {
        list = D.getCitySuggestions(input.value, state.country, 6);
      }
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
      ['firstName', 'lastName', 'orgName', 'bio', 'city', 'country', 'dob', 'goal', 'nativeLanguage', 'specialization', 'experience', 'qualifications', 'format', 'website', 'email', 'phone', 'contactName', 'contactEmail', 'contactPhone', 'contactPosition', 'rate', 'availability', 'audience', 'eventType', 'verification', 'capacity', 'organizerType', 'locationMode', 'frequency', 'instagram', 'tiktok', 'facebook', 'linkedin', 'youtube', 'telegram'].forEach(function (id) {
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
      if (step === 1 && roles.indexOf(role) === -1) return { message: 'Choose your role first.', target: '' };
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
        if (!state.organizerType) return { message: 'Choose your organizer type.', target: 'organizerType' };
        if (!state.eventType) return { message: 'Choose your event type.', target: 'eventType' };
        if (!state.locationMode) return { message: 'Choose your location mode.', target: 'locationMode' };
        if (!state.audience) return { message: 'Choose your audience.', target: 'audience' };
      }
      if (step === 3 && role === 'organization') {
        if (!state.orgType) return { message: 'Choose your organization type.', target: 'orgType' };
        if (!state.specialization.trim()) return { message: 'Write what your organization does.', target: 'specialization' };
        if (!state.organizationCategories.length) return { message: 'Choose at least one learning or business category.', target: 'category' };
        if (!state.organizationAudience.length) return { message: 'Choose your audience.', target: 'organizationAudience' };
        if (!state.programFormat.length) return { message: 'Choose your program format.', target: 'programFormat' };
      }
      return null;
    }

    function cleanGoalText(value) {
      return String(value || '').replace(/\b(A1|A2|B1|B2|C1|C2)\b/gi, '').replace(/\s+/g, ' ').trim();
    }

    function buildLearningGoalSummary(languages, goals, goalLevels, fallbackGoal) {
      var list = (languages || []).map(function (language) {
        var targetLevel = studentGoal.normalize(goalLevels[language], state.languageLevels[language] || state.level || 'A1');
        var goal = cleanGoalText(goals[language] || fallbackGoal);
        return [language, goal, targetLevel].filter(Boolean).join(' ');
      });
      if (!list.length) {
        var key = generalGoalKey();
        var categoryGoal = cleanGoalText(goals[key] || fallbackGoal);
        var categoryLevel = studentGoal.normalize(goalLevels[key], state.level || 'A1');
        list.push([categoryLabel(state.category), categoryGoal, categoryLevel].filter(Boolean).join(' '));
      }
      return list.filter(Boolean).join(' | ');
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
        website: state.website.trim() || null,
        updated_at: new Date().toISOString()
      };
      if (role === 'learner') {
        var learningCategory = state.category || 'languages';
        var generalKey = generalGoalKey();
        var primaryLanguage = state.learnLanguages[0];
        var primaryLevel = (state.languageLevels[primaryLanguage] || state.level || 'A1');
        var primaryGoalLevel = studentGoal.normalize(state.goalLevels[primaryLanguage] || state.goalLevels[generalKey], primaryLevel);
        var selectedGoalLevels = {};
        var selectedLanguageGoals = {};
        state.learnLanguages.forEach(function (language) {
          selectedGoalLevels[language] = studentGoal.normalize(state.goalLevels[language], state.languageLevels[language] || state.level || 'A1');
          if (state.languageGoals[language]) selectedLanguageGoals[language] = cleanGoalText(state.languageGoals[language]);
        });
        if (!state.learnLanguages.length) {
          selectedGoalLevels[generalKey] = primaryGoalLevel;
          if (state.languageGoals[generalKey] || state.goal) selectedLanguageGoals[generalKey] = cleanGoalText(state.languageGoals[generalKey] || state.goal);
        }
        var learningGoal = buildLearningGoalSummary(state.learnLanguages, selectedLanguageGoals, selectedGoalLevels, state.goal);
        patch.language = state.nativeLanguage.trim() || null;
        patch.language_level = primaryLevel;
        patch.goal_level = primaryGoalLevel;
        patch.learning_goal = primaryGoalLevel;
        patch.learning_languages = state.learnLanguages.slice();
        patch.profile_interests = state.interests.slice();
        patch.learning_targets = [{
          category: learningCategory,
          languages: state.learnLanguages.slice(),
          levels: state.languageLevels,
          goal: primaryGoalLevel,
          goalLevel: primaryGoalLevel,
          goals: selectedLanguageGoals,
          goalLevels: selectedGoalLevels,
          subcategories: state.subcategories.slice()
        }].concat(state.learnLanguages.map(function (lang) {
          return {
            category: learningCategory,
            language: lang,
            level: state.languageLevels[lang] || primaryLevel,
            goal: selectedGoalLevels[lang] || primaryGoalLevel,
            goalLevel: selectedGoalLevels[lang] || primaryGoalLevel,
            subcategories: state.subcategories.slice()
          };
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
        patch.specialization = [state.specialization, state.organizerType, state.eventType, state.locationMode, state.audience, state.frequency, state.capacity ? ('Capacity: ' + state.capacity) : '', state.verification].map(function (x) { return String(x || '').trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.instagram = state.instagram.trim() || null;
        patch.tiktok = state.tiktok.trim() || null;
        patch.telegram = state.telegram.trim() || null;
        patch.website = state.website.trim() || null;
        patch.phone = state.phone.trim() || null;
        patch.learning_targets = [{
          category: state.category || 'languages',
          subcategories: state.subcategories.slice(),
          languages: state.eventLanguages.slice(),
          organizer_type: state.organizerType || null,
          event_type: state.eventType || null,
          location_mode: state.locationMode || null,
          audience: state.audience || null,
          frequency: state.frequency || null,
          capacity: state.capacity ? Number(state.capacity) : null,
          contact_email: state.email.trim() || null,
          verification: state.verification.trim() || null
        }];
      }
      if (role === 'organization') {
        patch.specialization = [state.specialization, state.orgType].concat(state.organizationAudience, state.programFormat, [state.verification]).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
        patch.profile_interests = state.interests.slice();
        patch.instagram = state.instagram.trim() || null;
        patch.linkedin = state.linkedin.trim() || null;
        patch.telegram = state.telegram.trim() || null;
        patch.phone = state.phone.trim() || null;
        patch.learning_languages = state.organizationLanguages.slice();
        saveActiveOrganizationFocusAreas();
        patch.learning_targets = state.organizationCategories.map(function (category) {
          return {
            category: category,
            subcategories: (state.organizationSubcategories[category] || []).slice(),
            languages: state.organizationLanguages.slice(),
            organization_type: state.orgType || null,
            audience: state.organizationAudience.slice(),
            format: state.programFormat.slice(),
            verification_status: state.verification.trim() ? 'pending' : 'not_verified',
            verification: state.verification.trim() || null
          };
        });
      }
      return patch;
    }

    async function saveLearnerLanguages(userId) {
      if (role !== 'learner' || !state.learnLanguages.length) return;
      var rows = state.learnLanguages.map(function (lang, i) {
        var currentLevel = state.languageLevels[lang] || state.level || 'A1';
        return {
          user_id: userId, language: lang,
          current_level: currentLevel,
          goal_level: studentGoal.normalize(state.goalLevels[lang], currentLevel),
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
        description: [state.specialization].concat(state.organizationAudience, state.programFormat).map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' · ') || state.bio.trim() || null,
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

    async function confirmRegistrationRole(userId) {
      if (roles.indexOf(role) === -1) throw new Error('Choose your role first.');
      var result = await supa.rpc('confirm_legacy_web_role', { chosen_role: role });
      if (result.error) throw result.error;
      var confirmedRole = roles.indexOf(result.data) !== -1 ? result.data : role;
      role = confirmedRole;
      if (ctx.session) {
        ctx.session.role = confirmedRole;
        ctx.session.selectedRole = confirmedRole;
      }
      try {
        localStorage.setItem('duvela.webRole', confirmedRole);
        history.replaceState(null, '', './app.html?role=' + encodeURIComponent(confirmedRole) + (window.location.hash || (confirmedRole === 'learner' ? '#home' : '#workspace')));
      } catch (ignore) {}
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
        await confirmRegistrationRole(u.id);
        patch = buildPatch();
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
        ctx.setProfile(Object.assign({}, ctx.getProfile(), patch, {
          registered_web_role: role,
          registered_web_role_confirmed: true,
          last_web_role: role
        }));
        localStorage.setItem('duvela.onboarding.' + u.id, '1');
        $('#onboardingOverlay').classList.remove('open');
        $('#onboardingOverlay').setAttribute('aria-hidden', 'true');
        ctx.renderAll();
      } catch (error) {
        $('#onboardingError').textContent = (error && error.message) || 'Could not save your setup. Please try again.';
      }
    }

    function back() { collect(); if (step > minStep) { step--; render(); } }

    async function signOut() {
      var button = $('#onboardingSignOut');
      if (!button || button.disabled) return;
      button.disabled = true;
      showError('', '');
      try {
        var result = await supa.auth.signOut();
        if (result && result.error) throw result.error;
        window.location.href = './index.html';
      } catch (error) {
        button.disabled = false;
        showError((error && error.message) || 'Could not sign out. Please try again.', '');
      }
    }

    function hasList(value) {
      return Array.isArray(value) && value.some(function (item) { return String(item || '').trim(); });
    }

    function hasCompletedProfile(profile) {
      if (!profile) return false;
      if (profile.is_admin || profile.is_teacher || profile.is_organizer) return true;
      if (String(profile.full_name || '').trim()) return true;
      if (String(profile.bio || '').trim()) return true;
      if (String(profile.city || '').trim() || String(profile.country || '').trim()) return true;
      if (String(profile.language || '').trim()) return true;
      if (String(profile.website || '').trim()) return true;
      if (String(profile.avatar_url || '').trim()) return true;
      if (hasList(profile.learning_languages) || hasList(profile.teaches_languages)) return true;
      if (hasList(profile.learning_targets) || hasList(profile.profile_interests)) return true;
      if (hasList(profile.specialization) || hasList(profile.qualifications)) return true;
      return false;
    }

    function openIfNeeded() {
      var u = ctx.getUser();
      if (!u || localStorage.getItem('duvela.onboarding.' + u.id)) return;
      if (hasCompletedProfile(ctx.getProfile && ctx.getProfile())) {
        localStorage.setItem('duvela.onboarding.' + u.id, '1');
        return;
      }
      minStep = 1;
      step = 1;
      role = '';
      render();
      $('#onboardingOverlay').classList.add('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'false');
    }
    window.DuvelaResetOnboarding = function () {
      var u = ctx.getUser && ctx.getUser();
      if (u && u.id) localStorage.removeItem('duvela.onboarding.' + u.id);
      minStep = 1;
      step = 1;
      role = '';
      render();
      $('#onboardingOverlay').classList.add('open');
      $('#onboardingOverlay').setAttribute('aria-hidden', 'false');
      return true;
    };

    form.addEventListener('submit', submit);
    $('#onboardingBack').addEventListener('click', back);
    $('#onboardingSignOut').addEventListener('click', signOut);
    return { openIfNeeded: openIfNeeded };
  }
  window.DuvelaAppOnboarding = { create: create };
})();

