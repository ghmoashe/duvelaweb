const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('onboarding 4 uses compact scroll body and sticky action footer', () => {
  const html = read('app.html');
  const css = read('web/app-onboarding4.css');
  assert.match(html, /class="onboarding-scroll"/);
  assert.match(html, /id="onboardingSaveExit"/);
  assert.match(css, /grid-template-rows:auto auto auto minmax\(0,1fr\) auto/);
  assert.match(css, /height:100dvh/);
  assert.match(css, /onboarding-role\[hidden\]\{display:none!important\}/);
});

test('workspace selection is separate from the active URL role and persists as draft', () => {
  const js = read('web/app-onboarding.js');
  assert.match(js, /activeRole/);
  assert.match(js, /Configuring:/);
  assert.match(js, /duvela\.onboarding\.draft\.v4\./);
  assert.match(js, /hasConfirmedRole = profile\.registered_web_role_confirmed === true/);
  assert.match(js, /Not activated/);
  assert.match(js, /None yet/);
});

test('role is confirmed only through the protected server RPC on final submit', () => {
  const js = read('web/app-onboarding.js');
  const submitStart = js.indexOf('async function submit');
  const rpcAt = js.indexOf("supa.rpc('confirm_legacy_web_role'");
  assert.ok(rpcAt > 0 && rpcAt < submitStart, 'confirmation is isolated in confirmRegistrationRole');
  assert.match(js.slice(submitStart), /if \(step < 4\)/);
  assert.match(js.slice(submitStart), /confirmRegistrationRole\(u\.id\)/);
  assert.match(js, /confirmedRole !== role/);
});

test('all four role-specific setup contracts are represented', () => {
  const js = read('web/app-onboarding.js');
  for (const role of ['learner','teacher','organizer','organization']) assert.match(js, new RegExp("role === '"+role+"'"));
  for (const field of ['explanationLanguages','teachingLevels','teachingFormats','authorizedMembership','organizationAudience','programFormat','eventType','locationMode','goalLevels']) assert.match(js, new RegExp(field));
});

test('onboarding is connected to application localization', () => {
  const page = read('web/app-page.js');
  const js = read('web/app-onboarding.js');
  assert.match(page, /onboardingApi\.create\(\{ \$, supa, session: sessionState, tr,/);
  assert.match(js, /var tr = ctx\.tr/);
  assert.match(js, /Выберите пространство/);
  assert.match(js, /localizeRendered/);
});

test('step 2 uses a compact profile preview and keeps professional setup in step 3', () => {
  const js = read('web/app-onboarding.js');
  const css = read('web/app-onboarding4.css');
  const step2 = js.slice(js.indexOf('function stepTwoHtml'), js.indexOf('function languageIso'));
  assert.match(step2, /ob-step2-appearance/);
  assert.match(step2, /ob-step2-details/);
  assert.match(step2, /Short introduction \(optional\)/);
  assert.match(step2, /Additional details \(optional\)/);
  assert.doesNotMatch(step2, /Cover image|Cover theme|Crop preview|ob-coverFile/);
  assert.match(step2, /ob-avatar-preview-card/);
  assert.match(step2, /exact coordinates are never saved or shown publicly/);
  assert.doesNotMatch(step2, /Teaching headline|Supported CEFR levels|Teaching formats/);
  assert.match(css, /ob-appearance-layout/);
  assert.match(css, /height:min\(880px,calc\(100dvh - 28px\)\)/);
});

test('teacher step 3 is organized into three persistent internal sections', () => {
  const js = read('web/app-onboarding.js');
  const css = read('web/app-onboarding4.css');
  for (const label of ['Subjects & Specializations','Teaching Preferences','Professional Information']) assert.match(js, new RegExp(label));
  assert.match(js, /teacherSetupTab/);
  assert.match(js, /teacherTabCompletion/);
  assert.match(js, /data-teacher-tab/);
  assert.match(js, /data-teacher-next/);
  assert.match(css, /\.ob-teacher-tabs/);
  assert.match(css, /\.ob-teacher-progress/);
});

test('teacher language fields use searchable ISO multi-selects with accessible flag markers', () => {
  const js = read('web/app-onboarding.js');
  const teacher = js.slice(js.indexOf('function languageIso'), js.indexOf('function stepThreeHtml'));
  assert.match(teacher, /Search language or ISO code/);
  assert.match(teacher, /data-language-search/);
  assert.match(teacher, /role="combobox"/);
  assert.match(js, /ArrowDown/);
  assert.match(teacher, /Teaching languages/);
  assert.match(teacher, /Explanation languages/);
  assert.match(teacher, /languageFlagHtml/);
  assert.match(teacher, /D\.flagImg/);
  assert.match(teacher, /data-flag-code/);
});

test('teacher categories preserve their subjects and adapt preference fields', () => {
  const js = read('web/app-onboarding.js');
  assert.match(js, /teacherCategorySubjects\[previousCategory\] = state\.subcategories\.slice/);
  assert.match(js, /state\.subcategories = \(state\.teacherCategorySubjects\[state\.category\] \|\| \[\]\)\.slice/);
  assert.match(js, /teacherLanguagesCategory/);
  assert.match(js, /teacherSkillLevels/);
  assert.match(js, /teacherAudience/);
  assert.match(js, /Choose at least one teaching format/);
});

test('teacher professional details remain optional and advanced social fields are collapsed', () => {
  const js = read('web/app-onboarding.js');
  assert.match(js, /Teaching approach/);
  assert.match(js, /Certificates \(optional\)/);
  assert.match(js, /Advanced profile settings \(optional\)/);
  assert.match(js, /Credentials are shown as unverified/);
  assert.match(js, /class="ob-advanced-settings"/);
  assert.match(js, /category_subjects/);
});

test('learner step 3 uses searchable language pickers without horizontal carousels', () => {
  const js = read('web/app-onboarding.js');
  const learner = js.slice(js.indexOf("if (role === 'learner')"), js.indexOf("if (role === 'teacher')"));
  assert.match(learner, /languagePickerHtml\('nativeLanguage'/);
  assert.match(learner, /languagePickerHtml\('learnLanguages'/);
  assert.doesNotMatch(learner, /langScroll\('learnLanguages'/);
  assert.match(js, /kind === 'learnLanguages'/);
  assert.match(js, /Choose up to 3 languages/);
});

test('learner validation maps each error to its own field and interests are optional', () => {
  const js = read('web/app-onboarding.js');
  const validation = js.slice(js.indexOf('function validate()'), js.indexOf('function cleanGoalText'));
  assert.match(validation, /Choose at least one language to learn[\s\S]*target: 'learnLanguages'/);
  assert.doesNotMatch(validation, /Select at least 3 interests/);
  assert.match(js, /target \? '' : \(message \|\| ''\)/);
  assert.match(js, /scrollIntoView/);
  assert.match(js, /el\.focus/);
});

test('learner language levels support not assessed and category-specific setup', () => {
  const js = read('web/app-onboarding.js');
  assert.match(js, /\['Not assessed', 'Beginner'\]\.concat/);
  assert.match(js, /Target level/);
  assert.match(js, /learnerCategoryDrafts/);
  assert.match(js, /learnerExperience/);
  assert.match(js, /learningOutcome/);
  assert.match(js, /state\.category === 'digital' \? 'Subject'/);
  assert.match(js, /state\.category === 'art' \? 'Discipline'/);
});

test('learner interests use a compact optional show-more section', () => {
  const js = read('web/app-onboarding.js');
  const css = read('web/app-onboarding4.css');
  assert.match(js, /Show more interests/);
  assert.match(js, /Optional — helps personalize recommendations/);
  assert.match(css, /\.ob-learner-interests/);
  assert.match(css, /\.ob-learner-language-grid/);
});

test('learner step 3 has localized compact selectors, recommendations and a review summary', () => {
  const js = read('web/app-onboarding.js');
  const css = read('web/app-onboarding4.css');
  assert.match(js, /Ваша учебная настройка/);
  assert.match(js, /Recommended next step:/);
  assert.match(js, /recommendedLearnerTarget/);
  assert.match(js, /learnerSelectionSummaryHtml/);
  assert.match(js, /data-learner-language-tab/);
  assert.match(js, /data-subject-search/);
  assert.match(js, /aria-expanded="false"/);
  assert.match(js, /class="ob-language-results" role="listbox" hidden/);
  assert.match(css, /\.ob-learner-language-tabs/);
  assert.match(css, /\.ob-learner-summary/);
  assert.match(css, /\.ob-subject-search/);
  assert.match(css, /\.ob-language-results\[hidden\]/);
});

test('server persistence is read back under the current owner before role confirmation', () => {
  const js = read('web/app-onboarding.js');
  const submit = js.slice(js.indexOf('async function submit'));
  assert.match(js, /async function saveAndVerifyProfile/);
  assert.match(js, /Profile ownership verification failed/);
  assert.match(js, /Saved profile could not be verified/);
  assert.match(js, /Learning languages were not confirmed by the server/);
  assert.match(js, /learner_language_profiles'\)\.select\('user_id,language,current_level,goal_level,is_active'\)\.eq\('user_id', userId\)/);
  assert.ok(submit.indexOf('saveAndVerifyProfile') < submit.indexOf('confirmRegistrationRole'), 'profile read-back must finish before role activation');
  assert.match(js, /note\.dataset\.saveStatus/);
});

test('learner preview uses the selected language goal and rejects native-language duplication', () => {
  const js = read('web/app-onboarding.js');
  const preview = js.slice(js.indexOf('function profilePreviewHtml'), js.indexOf('function stepOneHtml'));
  const validation = js.slice(js.indexOf('function validate()'), js.indexOf('function cleanGoalText'));
  assert.match(preview, /learnerPrimaryLanguage/);
  assert.match(preview, /state\.goalLevels\[learnerPrimaryLanguage\]/);
  assert.doesNotMatch(preview, /state\.level \|\| state\.goal/);
  assert.match(js, /Your native language cannot also be a learning language/);
  assert.match(validation, /state\.learnLanguages\.indexOf\(state\.nativeLanguage\) !== -1/);
  assert.match(js, /→/);
});

test('step 2 avatar control validates, previews, replaces and removes without cover UI', () => {
  const js = read('web/app-onboarding.js');
  assert.match(js, /accept="image\/jpeg,image\/png"/);
  assert.match(js, /5 \* 1024 \* 1024/);
  assert.match(js, /data-remove-upload/);
  assert.match(js, /key !== 'avatarName' && key !== 'coverName'/);
  assert.match(js, /Never show[\s\S]*stale filename/);
  assert.match(js, /Preview ready locally — uploaded after final confirmation/);
  assert.match(js, /Uploading avatar to your account/);
  assert.match(js, /Saved to account/);
  const step2 = js.slice(js.indexOf('function stepTwoHtml'), js.indexOf('function languageIso'));
  const preview = js.slice(js.indexOf('function profilePreviewHtml'), js.indexOf('function stepOneHtml'));
  const submit = js.slice(js.indexOf('async function submit'));
  assert.doesNotMatch(step2, /uploadControlHtml\('cover'|coverPresetHtml|coverPosition/);
  assert.doesNotMatch(preview, /ob-preview-cover|coverPreview|coverPreset/);
  assert.doesNotMatch(submit, /patch\.cover_url|Uploading cover/);
});
