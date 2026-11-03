// Event and challenge builders that follow the Business app's screens step for
// step (features/business-screens/creating-events.tsx and create-challenge.tsx):
// same steps, fields, limits, validation and saved columns. They reuse the
// course builder's wizard styles (.cr-wizard / .cr-wz-*) from app-courses4.css.
(function () {
  'use strict';

  var ICONS = {
    close: '<path d="m6 6 12 12M18 6 6 18"/>', check: '<path d="m5 12 4 4L19 6"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2l-5-4.9 6.9-1z"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 8.7A6 6 0 1 1 8.7 18.1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
  };
  var LEVELS = ['A1','A2','B1','B2','C1','C2'];
  var DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480];
  var MAX_EVENT_LANGUAGES = 2, MAX_EXPLANATION_LANGUAGES = 4, MAX_EVENT_PHOTOS = 5;
  var EXAMS = [['', null], ['goethe', 'Goethe-Zertifikat'], ['dtz', 'DTZ'], ['telc', 'TELC'], ['osd', 'ÖSD']];
  var current = null;

  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.star) + '</svg>'; }
  function catalog() { return (window.DuvelaCourses4 && window.DuvelaCourses4.languages) || { list: [], normalize: function () { return ''; }, normalizeAll: function () { return []; } }; }
  function toggleIn(list, value, max) { var i = list.indexOf(value); if (i >= 0) list.splice(i, 1); else if (!max || list.length < max) list.push(value); }
  function displayDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }

  // One wizard shell for both builders: a spec supplies steps, body, validation and save.
  function openWizard(ctx, spec) {
    if (current) return;
    var tr = ctx.tr, esc = ctx.esc;
    var w = current = { ctx: ctx, spec: spec, step: 0, notice: '', saving: false, profile: undefined, data: spec.initial() };
    function field(id, label, type, placeholder, extra) { return '<label class="cr-field"><span>' + esc(label) + '</span><input data-field="' + id + '" type="' + (type || 'text') + '" value="' + esc(w.data[id] == null ? '' : w.data[id]) + '" placeholder="' + esc(placeholder || '') + '"' + (extra || '') + '></label>'; }
    var ui = {
      tr: tr, esc: esc, icon: icon, field: field,
      block: function (title, body) { return '<section class="cr-wz-block"><h3>' + esc(title) + '</h3>' + body + '</section>'; },
      tip: function (text) { return '<div class="cr-wz-tip">' + icon('star') + '<p>' + esc(text) + '</p></div>'; },
      chip: function (attr, value, label, active, disabled) { return '<button type="button" class="cr-wz-chip' + (active ? ' active' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + (active ? 'true' : 'false') + '"' + (disabled ? ' disabled' : '') + '>' + (active ? icon('check') : '') + '<span>' + esc(label) + '</span></button>'; },
      option: function (attr, value, label, sub, active, iconName) { return '<button type="button" class="cr-wz-option' + (active ? ' active' : '') + '" ' + attr + '="' + esc(value) + '" aria-pressed="' + active + '">' + (iconName ? icon(iconName) : '') + '<b>' + esc(label) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</button>'; },
      counter: function (key, step, placeholder) { return '<div class="cr-wz-counter"><button type="button" data-count="' + key + '" data-delta="-' + step + '" aria-label="−">−</button><input data-field="' + key + '" inputmode="numeric" value="' + esc(w.data[key] == null ? '' : w.data[key]) + '" placeholder="' + esc(placeholder || '') + '" aria-label="' + esc(key) + '"><button type="button" data-count="' + key + '" data-delta="' + step + '" aria-label="+">+</button></div>'; },
      toggle: function (attr, title, sub, on) { return '<button type="button" class="cr-wz-zoom' + (on ? ' active' : '') + '" ' + attr + ' aria-pressed="' + on + '">' + icon('shield') + '<span><b>' + esc(title) + '</b><em>' + esc(sub) + '</em></span><i>' + (on ? icon('check') : '') + '</i></button>'; },
      languages: function (attr, keys, selected, max) { return '<div class="cr-wz-chips">' + keys.map(function (l) { var on = selected.indexOf(l.key) >= 0; return ui.chip(attr, l.key, l.flag + ' ' + l.label, on, max && !on && selected.length >= max); }).join('') + '</div>'; },
      levels: function (attr, isOn) { return '<div class="cr-wz-levels">' + LEVELS.map(function (key) { var on = isOn(key); return '<button type="button" class="cr-wz-level' + (on ? ' active' : '') + '" ' + attr + '="' + key + '" aria-pressed="' + on + '"><b>' + key + '</b><span>' + esc(levelName(tr, key)) + '</span></button>'; }).join('') + '</div>'; },
      explanationChoices: function () { return explanationChoices(w); },
      summary: function (title, rows) { return '<section class="cr-wz-summary"><h3>' + esc(title) + '</h3>' + rows.map(function (row) { return '<p>' + icon(row[0]) + '<span>' + esc(row[1]) + '</span></p>'; }).join('') + '</section>'; }
    };
    w.ui = ui;
    function read() { var box = document.querySelector('.cr-wizard'); if (!box) return; box.querySelectorAll('[data-field]').forEach(function (input) { w.data[input.dataset.field] = input.value; }); }
    function close() { if (w.saving) return; document.querySelector('.cr-wizard')?.remove(); current = null; document.body.classList.remove('modal-open'); }
    function paint() {
      if (current !== w) return;
      var overlay = document.querySelector('.cr-wizard'); if (!overlay) { overlay = document.createElement('div'); overlay.className = 'cr-wizard'; document.body.appendChild(overlay); }
      document.body.classList.add('modal-open');
      var steps = spec.steps(tr), last = steps.length - 1;
      overlay.innerHTML = '<div class="cr-wizard-card" role="dialog" aria-modal="true" aria-labelledby="crWizardTitle"><header><div><span class="cr-eyebrow">' + esc(spec.title(tr)) + ' · ' + esc(tr('Step {1} of {2}', 'Шаг {1} из {2}').replace('{1}', w.step + 1).replace('{2}', steps.length)) + '</span><h2 id="crWizardTitle">' + esc(steps[w.step][0]) + '</h2><p class="cr-wz-sub">' + esc(steps[w.step][1]) + '</p></div><button data-wizard-close aria-label="' + esc(tr('Close', 'Закрыть')) + '">' + icon('close') + '</button></header>' +
        '<div class="cr-stepper" style="grid-template-columns:repeat(' + steps.length + ',1fr)">' + steps.map(function (label, i) { return '<button type="button" class="' + (i === w.step ? 'active' : i < w.step ? 'done' : '') + '" data-step-jump="' + i + '"' + (i > w.step ? ' disabled' : '') + (i === w.step ? ' aria-current="step"' : '') + '><span>' + (i < w.step ? icon('check') : i + 1) + '</span><em>' + esc(label[0]) + '</em></button>'; }).join('') + '</div>' +
        '<main>' + spec.body(w, ui) + (w.notice ? '<div class="cr-notice" role="alert">' + esc(w.notice) + '</div>' : '') + '</main>' +
        '<footer><button class="cr-secondary" data-prev>' + esc(w.step ? tr('Back', 'Назад') : tr('Cancel', 'Отмена')) + '</button><button class="cr-primary" data-next' + (w.saving ? ' disabled' : '') + '>' + esc(w.saving ? tr('Saving…', 'Сохранение…') : w.step === last ? spec.submitLabel(tr) : tr('Next', 'Далее')) + (w.step === last ? '' : icon('arrow')) + '</button></footer></div>';
      overlay.querySelector('[data-wizard-close]').onclick = close;
      overlay.onclick = function (e) { if (e.target === overlay) close(); };
      overlay.querySelector('[data-prev]').onclick = function () { if (!w.step) { close(); return; } read(); w.step--; w.notice = ''; paint(); };
      overlay.querySelector('[data-next]').onclick = function () {
        read(); w.notice = spec.validate(w, tr) || '';
        if (w.notice) { paint(); return; }
        if (w.step < last) { w.step++; paint(); overlay.querySelector('main').scrollTop = 0; } else void save();
      };
      overlay.querySelectorAll('[data-step-jump]').forEach(function (button) { button.onclick = function () { read(); w.step = Number(button.dataset.stepJump); w.notice = ''; paint(); }; });
      overlay.querySelectorAll('[data-count]').forEach(function (button) { button.onclick = function () { read(); var key = button.dataset.count, delta = Number(button.dataset.delta); w.data[key] = String(Math.max(spec.counterMin ? spec.counterMin(key) : 0, (parseInt(w.data[key], 10) || 0) + delta)); paint(); }; });
      Object.keys(spec.actions).forEach(function (attr) {
        overlay.querySelectorAll('[' + attr + ']').forEach(function (button) { button.onclick = function () { read(); spec.actions[attr](w, button.getAttribute(attr)); w.notice = ''; paint(); }; });
      });
      var upload = overlay.querySelector('[data-upload]'), file = overlay.querySelector('[data-upload-file]');
      if (upload && file) { upload.onclick = function () { file.click(); }; file.onchange = function () { var picked = file.files && file.files[0]; if (picked) { read(); void uploadPhoto(picked); } }; }
    }
    async function uploadPhoto(file) {
      w.notice = tr('Uploading photo…', 'Загрузка фото…'); paint();
      try { spec.addPhoto(w, await ctx.uploadToBucket(spec.bucket, file)); w.notice = ''; }
      catch (e) { w.notice = tr('Photo upload failed', 'Не удалось загрузить фото'); }
      paint();
    }
    async function save() {
      w.saving = true; paint();
      try {
        await spec.save(w);
        w.saving = false; close();
        if (spec.onSaved) await spec.onSaved();
      } catch (error) {
        w.saving = false; w.notice = spec.saveError(tr) + (error && error.message ? ' (' + error.message + ')' : ''); paint();
      }
    }
    w.paint = paint;
    paint();
    loadProfile(w).then(function () { if (spec.onProfile) spec.onProfile(w); read(); paint(); });
  }

  async function loadProfile(w) {
    try {
      var res = await w.ctx.supa.from('profiles').select('language,teaches_languages,explanation_languages').eq('id', w.ctx.user.id).maybeSingle();
      w.profile = res.error ? null : (res.data || null);
    } catch (_) { w.profile = null; }
  }
  // Same rule as teacherExplanationLanguages and the DB guard: profile choices,
  // native language and taught languages; an empty profile is not restricted.
  function explanationChoices(w) {
    var lang = catalog();
    if (w.profile === undefined) return [];
    var p = w.profile || {};
    var known = lang.normalizeAll(p.explanation_languages).concat([lang.normalize(p.language)], lang.normalizeAll(p.teaches_languages)).filter(Boolean);
    if (!known.length) return lang.list;
    known = known.concat(w.data.explaining || []);
    return lang.list.filter(function (l) { return known.indexOf(l.key) >= 0; });
  }
  function levelName(tr, key) { return ({ A1: tr('Beginner','Начинающий'), A2: tr('Elementary','Элементарный'), B1: tr('Intermediate','Средний'), B2: tr('Upper intermediate','Выше среднего'), C1: tr('Advanced','Продвинутый'), C2: tr('Mastery','Мастерство') })[key]; }
  function durationLabel(tr, minutes) { return minutes < 60 ? minutes + ' ' + tr('min','мин') : minutes === 60 ? tr('1 hour','1 час') : minutes === 90 ? tr('1.5 hours','1,5 часа') : (minutes / 60) + ' ' + (minutes >= 300 ? tr('hours','часов') : tr('hours','часа')); }
  function weekdays(tr) { return [tr('Mon','Пн'),tr('Tue','Вт'),tr('Wed','Ср'),tr('Thu','Чт'),tr('Fri','Пт'),tr('Sat','Сб'),tr('Sun','Вс')]; }
  function languageName(key) { var item = catalog().list.find(function (l) { return l.key === key; }); return item ? item.flag + ' ' + item.label : key; }
  function photoGrid(w, ui, max) {
    var photos = w.data.photos;
    return '<div class="cr-wz-photos">' + photos.map(function (url, i) { return '<figure><img src="' + ui.esc(url) + '" alt=""><button type="button" data-remove-photo="' + i + '" aria-label="' + ui.esc(ui.tr('Remove photo', 'Удалить фото')) + '">' + icon('trash') + '</button></figure>'; }).join('') +
      (photos.length < max ? '<button class="cr-upload" type="button" data-upload>' + icon('upload') + '<b>' + ui.esc(ui.tr('Add photo', 'Добавить фото')) + '</b><span>' + photos.length + '/' + max + '</span></button><input type="file" data-upload-file accept="image/jpeg,image/png,image/webp" hidden>' : '') + '</div>';
  }

  // ── Event: About → Language and format → Date and time → Location → Price ──
  function openEvent(ctx, opts) {
    var tr = ctx.tr;
    openWizard(ctx, {
      bucket: 'events',
      title: function () { return tr('Create event', 'Создать событие'); },
      submitLabel: function () { return tr('Create event', 'Создать событие'); },
      saveError: function () { return tr('Could not create event.', 'Не удалось создать событие.'); },
      steps: function () {
        return [
          [tr('Event title', 'Название события'), tr('Description', 'Описание')],
          [tr('Language / Event type', 'Язык / Тип события'), tr('Event type', 'Тип события')],
          [tr('Date and time', 'Дата и время'), tr('Date / Time', 'Дата / Время')],
          [tr('Location', 'Место проведения'), tr('Street and building / Maximum participants', 'Улица и дом / Максимум участников')],
          [tr('Pricing', 'Стоимость'), tr('Additional information', 'Дополнительная информация')]
        ];
      },
      initial: function () { return { title: '', description: '', photos: [], languages: [], explaining: [], type: 'inPerson', date: '', time: '', duration: 60, recurrence: 'once', days: [], customDates: [], custom_date: '', online_url: '', street: '', city: '', country: '', max_participants: '', pricing: 'free', price: '', info: '' }; },
      onProfile: function (w) {
        var lang = catalog(), p = w.profile || {};
        if (!w.data.languages.length) w.data.languages = [lang.normalizeAll(p.teaches_languages)[0] || 'english'];
        var native = lang.normalize(p.language);
        if (native && !w.data.explaining.length) w.data.explaining = [native];
      },
      addPhoto: function (w, url) { if (w.data.photos.length < MAX_EVENT_PHOTOS) w.data.photos.push(url); },
      counterMin: function () { return 1; },
      actions: {
        'data-lang': function (w, key) { toggleIn(w.data.languages, key, MAX_EVENT_LANGUAGES); if (!w.data.languages.length) w.data.languages = ['english']; },
        'data-explain': function (w, key) { toggleIn(w.data.explaining, key, MAX_EXPLANATION_LANGUAGES); },
        'data-type': function (w, key) { w.data.type = key; },
        'data-duration': function (w, value) { w.data.duration = Number(value); },
        'data-recurrence': function (w, key) { w.data.recurrence = key; },
        'data-weekday': function (w, value) { toggleIn(w.data.days, Number(value)); },
        'data-add-date': function (w) { var d = w.data.custom_date; if (d && w.data.customDates.indexOf(d) < 0) { w.data.customDates.push(d); w.data.customDates.sort(); } w.data.custom_date = ''; },
        'data-remove-date': function (w, value) { w.data.customDates = w.data.customDates.filter(function (d) { return d !== value; }); },
        'data-remove-photo': function (w, index) { w.data.photos.splice(Number(index), 1); },
        'data-pricing': function (w, key) { w.data.pricing = key; }
      },
      validate: function (w) {
        var d = w.data;
        if (w.step === 0 && !d.title.trim()) return tr('Event title is required.', 'Укажите название события.');
        if (w.step === 0 && !d.description.trim()) return tr('Description is required.', 'Добавьте описание.');
        if (w.step === 2 && !d.date) return tr('Date is required.', 'Укажите дату.');
        if (w.step === 2 && !d.time) return tr('Time is required.', 'Укажите время.');
        if (w.step === 3 && d.type === 'inPerson' && !d.city.trim() && !d.street.trim()) return tr('Location is required.', 'Укажите место проведения.');
        if (w.step === 4 && d.pricing === 'paid' && !(Number(String(d.price).replace(',', '.')) > 0)) return tr('Please enter a price for paid events.', 'Укажите стоимость платного события.');
        return '';
      },
      body: function (w, ui) {
        var d = w.data, s = w.step;
        if (s === 0) return ui.block(tr('Event title', 'Название события'), '<input class="cr-wz-input" data-field="title" maxlength="120" value="' + ui.esc(d.title) + '" placeholder="' + ui.esc(tr('e.g., Spanish Conversation Meetup', 'например, Разговорный клуб испанского')) + '" aria-label="' + ui.esc(tr('Event title', 'Название события')) + '">') +
          ui.block(tr('Description', 'Описание'), '<textarea class="cr-wz-input" data-field="description" maxlength="2000" placeholder="' + ui.esc(tr('Describe your event...', 'Опишите событие...')) + '" aria-label="' + ui.esc(tr('Description', 'Описание')) + '">' + ui.esc(d.description) + '</textarea>') +
          ui.block(tr('Event Photos', 'Фото события') + ' (' + d.photos.length + '/' + MAX_EVENT_PHOTOS + ')', photoGrid(w, ui, MAX_EVENT_PHOTOS));
        if (s === 1) {
          var explain = ui.explanationChoices();
          return ui.block(tr('Language', 'Язык'), '<p class="cr-helper">' + ui.esc(tr('Pick up to {1} languages ({2}/{1})', 'Выберите до {1} языков ({2}/{1})').replace(/\{1\}/g, MAX_EVENT_LANGUAGES).replace('{2}', d.languages.length)) + '</p>' + ui.languages('data-lang', catalog().list, d.languages, MAX_EVENT_LANGUAGES)) +
            ui.block(tr('Explanation language', 'Язык объяснения') + ' (' + d.explaining.length + '/' + MAX_EXPLANATION_LANGUAGES + ')', explain.length ? ui.languages('data-explain', explain, d.explaining, MAX_EXPLANATION_LANGUAGES) : '<p class="cr-helper">' + ui.esc(tr('Loading…', 'Загрузка…')) + '</p>') +
            ui.block(tr('Event Type', 'Тип события'), '<div class="cr-wz-options">' + ui.option('data-type', 'inPerson', tr('In Person', 'Очно'), '', d.type === 'inPerson', 'users') + ui.option('data-type', 'online', tr('Online', 'Онлайн'), '', d.type === 'online', 'video') + '</div>');
        }
        if (s === 2) {
          var rec = [['once', tr('Once', 'Однократно')], ['daily', tr('Every day', 'Каждый день')], ['weekly', tr('Days of week', 'По дням недели')], ['monthly', tr('Every month', 'Каждый месяц')], ['custom', tr('Specific dates', 'Конкретные даты')]];
          return ui.block(tr('Date and time', 'Дата и время'), '<div class="cr-field-grid">' + ui.field('date', tr('Date', 'Дата'), 'date') + ui.field('time', tr('Time', 'Время'), 'time') + '</div>') +
            ui.block(tr('Duration', 'Длительность'), '<div class="cr-wz-chips">' + DURATIONS.map(function (m) { return ui.chip('data-duration', m, durationLabel(tr, m), Number(d.duration) === m); }).join('') + '</div>') +
            ui.block(tr('Recurrence', 'Повторение'), '<div class="cr-wz-chips">' + rec.map(function (r) { return ui.chip('data-recurrence', r[0], r[1], d.recurrence === r[0]); }).join('') + '</div>' +
              (d.recurrence === 'weekly' ? '<div class="cr-wz-chips cr-wz-sub-chips">' + weekdays(tr).map(function (name, i) { return ui.chip('data-weekday', i, name, d.days.indexOf(i) >= 0); }).join('') + '</div>' : '') +
              (d.recurrence === 'custom' ? '<div class="cr-wz-inline">' + ui.field('custom_date', tr('Date', 'Дата'), 'date') + '<button type="button" class="cr-secondary" data-add-date>' + ui.esc(tr('Add', 'Добавить')) + '</button></div><div class="cr-wz-chips">' + d.customDates.map(function (date) { return '<button type="button" class="cr-wz-chip active" data-remove-date="' + ui.esc(date) + '" aria-label="' + ui.esc(tr('Remove', 'Удалить') + ' ' + displayDate(date)) + '"><span>' + ui.esc(displayDate(date)) + '</span>' + icon('close') + '</button>'; }).join('') + '</div>' : ''));
        }
        if (s === 3) {
          var place = d.type === 'online'
            ? ui.block(tr('Online event', 'Онлайн-событие'), '<p class="cr-helper">' + ui.esc(tr('Enter a meeting link or platform', 'Укажите ссылку на встречу или платформу')) + '</p>' + ui.field('online_url', tr('Link or platform', 'Ссылка или платформа'), 'text', 'Zoom, Google Meet, https://...'))
            : ui.block(tr('Location', 'Место проведения'), ui.field('street', tr('Street and building', 'Улица и дом'), 'text', tr('Main Street 15, Room 3', 'Главная улица 15, кабинет 3')) + '<div class="cr-field-grid">' + ui.field('city', tr('City', 'Город'), 'text', tr('Berlin, Barcelona, Paris...', 'Берлин, Барселона, Париж...')) + ui.field('country', tr('Country', 'Страна'), 'text', tr('Germany, Spain, France...', 'Германия, Испания, Франция...')) + '</div>');
          return place + ui.block(tr('Maximum Participants', 'Максимум участников'), ui.counter('max_participants', 1, '∞') + '<p class="cr-helper">' + ui.esc(d.max_participants ? d.max_participants + ' ' + tr('participants', 'участников') : tr('No limit', 'Без ограничений')) + '</p>');
        }
        return ui.block(tr('Pricing', 'Стоимость'), '<div class="cr-wz-options">' + ui.option('data-pricing', 'free', tr('Free', 'Бесплатно'), '', d.pricing === 'free', 'star') + ui.option('data-pricing', 'paid', tr('Paid', 'Платно'), '', d.pricing === 'paid', 'coins') + '</div>' +
            (d.pricing === 'paid' ? '<div class="cr-wz-price">' + ui.field('price', tr('Amount', 'Сумма') + ' (€)', 'number', '0.00', ' min="0" step="0.01"') + '</div>' : '')) +
          ui.block(tr('Additional Information', 'Дополнительная информация'), '<textarea class="cr-wz-input" data-field="info" maxlength="1000" placeholder="' + ui.esc(tr('Add additional information...', 'Добавьте дополнительную информацию...')) + '" aria-label="' + ui.esc(tr('Additional Information', 'Дополнительная информация')) + '">' + ui.esc(d.info) + '</textarea>') +
          ui.summary(tr('Event summary', 'Итог события'), [
            ['star', d.title || '—'],
            ['users', d.languages.map(languageName).join(', ') + ' · ' + (d.type === 'online' ? tr('Online', 'Онлайн') : tr('In Person', 'Очно'))],
            ['calendar', [displayDate(d.date), d.time, durationLabel(tr, Number(d.duration))].filter(Boolean).join(' · ')],
            ['coins', d.pricing === 'paid' && d.price ? '€' + d.price : tr('Free', 'Бесплатно')]
          ]);
      },
      save: async function (w) {
        var d = w.data, online = d.type === 'online';
        var note = recurrenceNote(tr, d);
        var row = {
          organizer_id: ctx.user.id, title: d.title.trim(),
          description: [d.description.trim(), d.info.trim(), note].filter(Boolean).join('\n\n'),
          event_date: d.date, event_time: d.time, duration_minutes: Number(d.duration) || 60,
          format: online ? 'online' : 'offline',
          language: d.languages.join(', '),
          explanation_language: d.explaining[0] || null, explanation_languages: d.explaining.length ? d.explaining.slice() : null,
          city: online ? null : (d.city.trim() || null), country: online ? null : (d.country.trim() || null),
          address: online ? null : (d.street.trim() || null),
          image_url: d.photos[0] || null, image_urls: d.photos.length ? d.photos.slice() : null,
          max_participants: parseInt(d.max_participants, 10) > 0 ? parseInt(d.max_participants, 10) : null,
          is_paid: d.pricing === 'paid', price_amount: d.pricing === 'paid' ? Number(String(d.price).replace(',', '.')) : null
        };
        var res = await ctx.supa.from('events').insert(row).select('id').single();
        if (res.error) throw res.error;
        // events is publicly readable, so the meeting link lives in
        // event_private_details (organizer, admins and attendees only).
        var link = online ? d.online_url.trim() : '';
        if (link && res.data && res.data.id) {
          var linkRes = await ctx.supa.from('event_private_details').upsert({ event_id: res.data.id, online_url: link });
          if (linkRes.error) console.warn('The meeting link could not be saved.', linkRes.error);
        }
        window.dispatchEvent(new CustomEvent('duvela:events-changed'));
      },
      onSaved: opts && opts.onSaved
    });
  }
  function recurrenceNote(tr, d) {
    if (d.recurrence === 'daily') return tr('Repeats every day', 'Повторяется каждый день');
    if (d.recurrence === 'monthly') return tr('Repeats every month', 'Повторяется каждый месяц');
    if (d.recurrence === 'weekly') return tr('Repeats on: {value}', 'Повторяется по: {value}').replace('{value}', d.days.length ? [0,1,2,3,4,5,6].filter(function (i) { return d.days.indexOf(i) >= 0; }).map(function (i) { return weekdays(tr)[i]; }).join(', ') : tr('none selected', 'не выбрано'));
    if (d.recurrence === 'custom') return tr('Specific dates: {value}', 'Конкретные даты: {value}').replace('{value}', d.customDates.length ? d.customDates.map(displayDate).join(', ') : tr('none added', 'не добавлены'));
    return '';
  }

  // ── Challenge: Basics → Dates → Daily minimum → Rules ──
  var MINIMUMS = [
    ['daily_min_dialogs', 1, 'AI Dialogues', 'ИИ-диалоги', '{count} dialogue(s) per day', '{count} диалог(ов) в день'],
    ['daily_min_live_min', 5, 'Live Practice with teacher', 'Live Practice с учителем', '{count} min live practice', '{count} мин живой практики'],
    ['daily_min_audio_sec', 30, 'Audio (sec)', 'Аудио (сек)', '{count} sec · {min} min', '{count} сек · {min} мин'],
    ['daily_min_writing', 1, 'Writing Lab', 'Writing Lab', '{count} writing task(s)', '{count} задани(й) письма'],
    ['daily_min_listening_min', 5, 'Listen Lab', 'Listen Lab', '{count} min listening', '{count} мин прослушивания'],
    ['daily_min_words', 5, 'New words with article', 'Новые слова с артиклем', '{count} word(s) with article', '{count} слов(о) с артиклем']
  ];
  function challengeDuration(tr, start, end) {
    if (!start || !end) return '';
    var days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
    if (!(days > 0)) return tr('End date is before start date', 'Дата окончания раньше даты начала');
    var months = Math.round(days / 30);
    return months >= 2 ? tr('≈ {count} months', '≈ {count} месяца').replace('{count}', months) : tr('{count} days', '{count} дней').replace('{count}', days);
  }
  function openChallenge(ctx, opts) {
    var tr = ctx.tr;
    openWizard(ctx, {
      bucket: 'posts',
      title: function () { return tr('New Challenge', 'Новый челлендж'); },
      submitLabel: function () { return tr('Create', 'Создать'); },
      saveError: function () { return tr('Could not create the challenge. Please try again.', 'Не удалось создать челлендж. Попробуйте ещё раз.'); },
      steps: function () {
        return [
          [tr('Basics', 'Основное'), tr('Title · level · exam', 'Название · уровень · экзамен')],
          [tr('Dates', 'Даты'), tr('Start and end', 'Начало и окончание')],
          [tr('Daily minimum', 'Ежедневный минимум'), tr('Dialogues · audio', 'Диалоги · аудио')],
          [tr('Rules', 'Правила'), tr('Grace days · exclusion', 'Дни прощения · исключение')]
        ];
      },
      initial: function () { return { title: '', cover: '', photos: [], language: 'english', explaining: [], level: 'B1', exam: '', start: '', end: '', daily_min_dialogs: '1', daily_min_audio_sec: '0', daily_min_live_min: '0', daily_min_writing: '0', daily_min_listening_min: '0', daily_min_words: '0', grace: 1, warn: true, auto: false, pricing: 'free', price: '', currency: 'EUR' }; },
      onProfile: function (w) {
        var lang = catalog(), p = w.profile || {}, native = lang.normalize(p.language);
        var preferred = lang.normalizeAll(p.teaches_languages)[0] || native; if (preferred) w.data.language = preferred;
        if (native && !w.data.explaining.length) w.data.explaining = [native];
      },
      addPhoto: function (w, url) { w.data.photos = [url]; },
      actions: {
        'data-lang': function (w, key) { w.data.language = key; },
        'data-explain': function (w, key) { toggleIn(w.data.explaining, key, MAX_EXPLANATION_LANGUAGES); },
        'data-level': function (w, key) { w.data.level = key; },
        'data-exam': function (w, key) { w.data.exam = key; },
        'data-remove-photo': function (w) { w.data.photos = []; },
        'data-pricing': function (w, key) { w.data.pricing = key; },
        'data-currency': function (w, key) { w.data.currency = key; },
        'data-grace': function (w, value) { w.data.grace = Number(value); },
        'data-warn': function (w) { w.data.warn = !w.data.warn; },
        'data-auto': function (w) { w.data.auto = !w.data.auto; }
      },
      validate: function (w) {
        var d = w.data;
        if (w.step === 0 && !d.title.trim()) return tr('Title is required', 'Название обязательно');
        if (w.step === 1 && !d.start) return tr('Enter a start date', 'Укажите дату начала');
        if (w.step === 1 && !d.end) return tr('Enter an end date', 'Укажите дату окончания');
        if (w.step === 1 && d.end <= d.start) return tr('End date is before start date', 'Дата окончания раньше даты начала');
        if (w.step === 3 && d.pricing === 'paid' && !(Number(String(d.price).replace(',', '.')) > 0)) return tr('Enter a participation fee', 'Укажите стоимость участия');
        return '';
      },
      body: function (w, ui) {
        var d = w.data, s = w.step;
        if (s === 0) {
          var explain = ui.explanationChoices();
          return ui.block(tr('Add cover (optional)', 'Добавить обложку (необязательно)'), photoGrid(w, ui, 1)) +
            ui.block(tr('Title', 'Название'), '<input class="cr-wz-input" data-field="title" maxlength="120" value="' + ui.esc(d.title) + '" placeholder="' + ui.esc(tr('E.g. B1 in 5 months', 'Например, B1 за 5 месяцев')) + '" aria-label="' + ui.esc(tr('Title', 'Название')) + '">') +
            ui.block(tr('Teaching language', 'Язык обучения'), ui.languages('data-lang', catalog().list, [d.language])) +
            ui.block(tr('Explanation language', 'Язык объяснения') + ' (' + d.explaining.length + '/' + MAX_EXPLANATION_LANGUAGES + ')', explain.length ? ui.languages('data-explain', explain, d.explaining, MAX_EXPLANATION_LANGUAGES) : '<p class="cr-helper">' + ui.esc(tr('Loading…', 'Загрузка…')) + '</p>') +
            ui.block(tr('Target level', 'Целевой уровень'), ui.levels('data-level', function (key) { return d.level === key; })) +
            ui.block(tr('Exam type (optional)', 'Тип экзамена (опционально)'), '<div class="cr-wz-chips">' + EXAMS.map(function (e) { return ui.chip('data-exam', e[0], e[1] || tr('No exam', 'Без экзамена'), d.exam === e[0]); }).join('') + '</div>');
        }
        if (s === 1) {
          var span = challengeDuration(tr, d.start, d.end);
          return ui.block(tr('Dates', 'Даты'), '<div class="cr-field-grid">' + ui.field('start', tr('Start date', 'Дата начала'), 'date') + ui.field('end', tr('End date', 'Дата окончания'), 'date') + '</div>' + (span ? '<p class="cr-helper">' + ui.esc(tr('Duration: ', 'Продолжительность: ') + span) + '</p>' : ''));
        }
        if (s === 2) return MINIMUMS.map(function (m) {
          var value = parseInt(d[m[0]], 10) || 0;
          var hint = value ? tr(m[4], m[5]).replace('{count}', value).replace('{min}', Math.round(value / 60)) : tr('Not counted', 'Не учитывается');
          return ui.block(tr(m[2], m[3]), ui.counter(m[0], m[1], '0') + '<p class="cr-helper">' + ui.esc(hint) + '</p>');
        }).join('');
        var graceLabel = function (n) { return n === 0 ? tr('none', 'нет') : n === 1 ? tr('day', 'день') : tr('days', 'дня'); };
        return ui.block(tr('Participation fee', 'Стоимость участия'), '<div class="cr-wz-options">' + ui.option('data-pricing', 'free', tr('Free', 'Бесплатно'), '', d.pricing === 'free', 'star') + ui.option('data-pricing', 'paid', tr('Paid', 'Платно'), '', d.pricing === 'paid', 'coins') + '</div>' +
            (d.pricing === 'paid' ? '<div class="cr-wz-price"><div class="cr-wz-chips">' + ['EUR', 'USD'].map(function (c) { return ui.chip('data-currency', c, c === 'EUR' ? '€ EUR' : '$ USD', d.currency === c); }).join('') + '</div>' + ui.field('price', tr('Amount', 'Сумма'), 'number', '0.00', ' min="0" step="0.01"') + '</div>' : '')) +
          ui.block(tr('Grace days per week', 'Дней прощения в неделю'), '<div class="cr-wz-chips">' + [0, 1, 2, 3].map(function (n) { return ui.chip('data-grace', n, (n ? n + ' ' : '') + graceLabel(n), d.grace === n); }).join('') + '</div><p class="cr-helper">' + ui.esc(d.grace === 0 ? tr('Every day is required', 'Каждый день обязателен') : tr('{count} skip(s) per week without penalty', '{count} пропуск(ов) в неделю без последствий').replace('{count}', d.grace)) + '</p>') +
          ui.block(tr('Rules', 'Правила'), ui.toggle('data-warn', tr('Warn before exclusion', 'Предупреждение перед исключением'), tr('The participant will receive a notification before being excluded', 'Участник получит уведомление до того, как будет исключён'), d.warn) + '<div style="height:8px"></div>' + ui.toggle('data-auto', tr('Automatic exclusion', 'Автоматическое исключение'), d.auto ? tr('Participant is automatically excluded when skip limit is exceeded', 'Участник исключается автоматически при превышении лимита пропусков') : tr('Manual exclusion only — you confirm each case', 'Исключение только вручную — вы подтверждаете каждый случай'), d.auto)) +
          ui.summary(tr('Rules ready', 'Правила готовы'), [
            ['star', d.title || '—'],
            ['users', languageName(d.language) + ' · ' + d.level + (d.exam ? ' · ' + EXAMS.find(function (e) { return e[0] === d.exam; })[1] : '')],
            ['calendar', [displayDate(d.start), displayDate(d.end)].filter(Boolean).join(' → ')],
            ['shield', [d.grace === 0 ? tr('no skips allowed', 'пропуски не допускаются') : tr('{count} skip(s) per week', '{count} пропуск(ов) в неделю').replace('{count}', d.grace), d.warn ? tr('warn before exclusion', 'предупреждение перед исключением') : '', d.auto ? tr('auto-exclusion on', 'автоисключение включено') : tr('manual exclusion', 'исключение вручную')].filter(Boolean).join(' · ')],
            ['coins', d.pricing === 'paid' && d.price ? (d.currency === 'USD' ? '$' : '€') + d.price : tr('Free', 'Бесплатно')]
          ]);
      },
      save: async function (w) {
        var d = w.data, org = ctx.state && ctx.state.myOrg;
        if (!org && ctx.management && ctx.management.ensureOrg) org = await ctx.management.ensureOrg();
        var row = {
          organization_id: org ? org.id : null, created_by: ctx.user.id, cover_url: d.photos[0] || null,
          title: d.title.trim(), language: d.language, explanation_languages: d.explaining.length ? d.explaining.slice() : null,
          target_level: d.level, exam_type: d.exam || null, started_at: d.start, ends_at: d.end,
          grace_days_per_week: d.grace, warn_before_exclude: !!d.warn, auto_exclude: !!d.auto,
          is_paid: d.pricing === 'paid', price_amount: d.pricing === 'paid' ? Number(String(d.price).replace(',', '.')) : null, currency: d.currency
        };
        MINIMUMS.forEach(function (m) { row[m[0]] = Math.max(0, parseInt(d[m[0]], 10) || 0); });
        var res = await ctx.supa.from('challenges').insert(row);
        if (res.error) throw res.error;
        window.dispatchEvent(new CustomEvent('duvela:challenges-changed'));
      },
      onSaved: opts && opts.onSaved
    });
  }

  window.DuvelaBuilders = { openEvent: openEvent, openChallenge: openChallenge, __test: { challengeDuration: challengeDuration, recurrenceNote: recurrenceNote } };
})();
