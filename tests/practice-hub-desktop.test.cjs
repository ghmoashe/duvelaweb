const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'web/app-feature-study.js'), 'utf8');
const practiceSource = fs.readFileSync(path.join(root, 'web/app-feature-practice.js'), 'utf8');
const workspaceSource = fs.readFileSync(path.join(root, 'web/app-feature-workspace-shell.js'), 'utf8');
const aiBannerSource = fs.readFileSync(path.join(root, 'web/app-feature-elsa-exam.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'web/practice-hub.css'), 'utf8');

test('practice hub renders a desktop workspace with main content and context rail', () => {
  for (const marker of [
    'practice-dashboard-header',
    'practice-dashboard-metrics',
    'practice-desktop-shell',
    'practice-desktop-main',
    'practice-desktop-sidebar',
    'practice-recommended',
    'practice-quick-start',
    'practice-exercise-bank'
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.match(styles, /grid-template-columns:minmax\(0,2\.15fr\) minmax\(300px,\.95fr\)/);
});

test('desktop dashboard uses live learner state for its summary', () => {
  assert.match(source, /Number\(done\|\|0\)\+' XP/);
  assert.ok(source.includes('targetCompleted/targetTools.length'));
  assert.ok(source.includes('document.documentElement.lang'));
  assert.doesNotMatch(source, /Math\.max\(230,Number\(done\|\|0\)\)/);
  assert.ok(source.includes('mergePracticeRows(progress.sessions,results[4].data'));
  assert.doesNotMatch(source, /progress\.sessions = results\[4\]\.data \|\|/);
});

test('language tabs use only profile-backed learning targets', () => {
  assert.ok(source.includes('targetData.targets.filter(isLanguageTarget)'));
  assert.doesNotMatch(source, /languageTargets\.unshift\('de'\)/);
  assert.doesNotMatch(source, /languageTargets\.push\('en'\)/);
  assert.doesNotMatch(source, /targetData\.targets=\['de'\]/);
});

test('exercise filters cover the requested library workflows', () => {
  for (const filter of ['all', 'available', 'premium', 'adaptive', 'live', 'exam', 'vocabulary', 'grammar', 'writing']) {
    assert.ok(source.includes("['" + filter + "'"), `missing ${filter} filter`);
  }
  assert.ok(source.includes("['level:'+String(activeLevel).toUpperCase()"));
  assert.ok(source.includes("['in-progress'"));
  assert.ok(source.includes("['completed'"));
  assert.ok(source.includes("sourceCard('listening'"));
  assert.ok(source.includes("sourceCard('reading'"));
  assert.ok(source.includes("sourceCard('writing'"));
  assert.ok(source.includes("tile.getAttribute('data-study-access')===filter"));
  assert.ok(source.includes("tile.getAttribute('data-study-level')===filter.slice(6)"));
});

test('responsive rules preserve tablet and mobile layouts without fixed widths', () => {
  assert.ok(styles.includes('@media(max-width:1180px)'));
  assert.ok(styles.includes('@media(max-width:860px)'));
  assert.ok(styles.includes('@media(max-width:700px)'));
  assert.match(styles, /practice-desktop-main \.practice-quick-start\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles, /practice-desktop-main \.practice-exercise-bank\{grid-template-columns:repeat\(auto-fit,minmax\(250px,1fr\)\)/);
}
);

test('exercise library prioritizes verified recommendations, core skills and available tools', () => {
  const recommended = source.indexOf('recommendationHtml +');
  const core = source.indexOf('quickStart.map(quickCard)', recommended);
  const available = source.indexOf('availableItems.map(exerciseCard)', core);
  const premium = source.indexOf('premiumItems.map(exerciseCard)', available);
  assert.ok(recommended >= 0 && recommended < core && core < available && available < premium);
  assert.ok(source.includes('Recommendations use your real exercise history'));
  assert.ok(source.includes("var coreIds=['duel','listening','reading','writing']"));
  assert.ok(styles.includes('.practice-recommended'));
  assert.ok(styles.includes('.practice-library-section.premium'));
});

test('teacher sessions stay separate from Premium subscription access', () => {
  assert.ok(source.includes("sourceCard('liveTeacher','liveTeacher','video',false"));
  assert.ok(source.includes('Teacher sessions are booked separately from the Premium subscription.'));
  assert.doesNotMatch(source, /data-study="liveTeacher"'\+\(!premiumActive\?' data-premium-locked/);
});

test('locked cards open a feature-specific truthful Premium dialog', () => {
  assert.ok(source.includes("showPremiumAccess(tile.getAttribute('data-premium-feature'),tile.getAttribute('data-premium-title'))"));
  assert.ok(source.includes('Online checkout is not available yet. Join the launch list without payment.'));
  assert.ok(source.includes('data-premium-feature'));
  assert.ok(source.includes('id="premiumBack"'));
});

test('personal practice workflow includes resume, premium, sync and exam history states', () => {
  for (const marker of ['data-study-resume', 'data-premium-locked', 'practice-sync-state', 'practice-exam-history', 'Create exam plan']) {
    assert.ok(source.includes(marker), `missing ${marker}`);
  }
  assert.ok(source.includes('aria-valuenow'));
  assert.ok(styles.includes(':focus-visible'));
  assert.ok(source.includes('mph-exercise-heading'));
  assert.match(styles, /\.practice-desktop-main \.mph-premium-badge\{position:static/);
  assert.match(styles, /\.practice-desktop-main \.premium-exercise \.mph-exercise-copy\{padding-right:0\}/);
});

test('matching teacher practices are integrated once with resilient states', () => {
  assert.ok(source.includes('practice-teacher-library'));
  assert.ok(practiceSource.includes('practicesLoaded'));
  assert.ok(practiceSource.includes('practice-catalog-state offline'));
  assert.ok(practiceSource.includes('practice-catalog-state loading'));
  assert.ok(practiceSource.includes('data-practice-load-retry'));
  assert.equal((workspaceSource.match(/ctx\.practicesHtml\(\)/g) || []).length, 0);
});

test('ELSA exam practice lives inside AI Practice instead of a separate workspace banner', () => {
  assert.ok(source.includes("{ id: 'elsa', name: 'ELSA', role: 'exam'"));
  assert.ok(source.includes("document.dispatchEvent(new CustomEvent('duvela-open-elsa-exam'))"));
  assert.ok(aiBannerSource.includes("document.addEventListener('duvela-open-elsa-exam', open)"));
  assert.ok(aiBannerSource.includes('window.DuvelaOpenElsaExam = open'));
  assert.match(aiBannerSource, /function elsaExamCardHtml\(\)\s*\{\s*return '';\s*\}/);
  assert.doesNotMatch(workspaceSource, /elsaExamCardHtml|bindElsaExamCard/);
  assert.ok(source.includes("title:tr('AI Practice','AI-практика')"));
  assert.ok(source.includes("'AI Practice','Sofia, ELSA and the AI team'"));
});

test('test mode opens Premium tools without a price or launch-list gate', () => {
  assert.ok(source.includes('const PREMIUM_TEST_MODE = true;'));
  assert.ok(source.includes('PREMIUM_TEST_MODE || practicePremium'));
  assert.ok(source.includes("PREMIUM_TEST_MODE?esc(tr('✓ Test access','✓ Тестовый доступ'))"));
  assert.ok(source.includes("if (PREMIUM_TEST_MODE) { openStudyTool(featureId==='duvela'?'ai':featureId); return; }"));
});


test('AI Practice has source-backed coach setup, honest voice gating, and retry-safe chat state', () => {
  for (const marker of [
    'DUVELA / AI ACADEMY',
    'ai-coach-grid',
    'ai-session-setup',
    'aiVoiceInputSupported',
    'lessonTurnTarget: aiDurationTurnTarget(aiChatState.duration)',
    "partnerRole: partner ? partner.role : undefined",
    "if (!isGreeting && !retry)",
    'ai-session-summary'
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.ok(styles.includes('.ai-coach-grid'));
  assert.ok(styles.includes('@media(max-width:760px){#studyOverlay[data-practice-tool="ai"]'));
});

test('ELSA setup uses provider-specific parts, supported levels, explicit modes, and verified microphone states', () => {
  for (const marker of [
    'PART_SUMMARIES',
    'LEVELS_BY_BOARD',
    "trainingMode: 'exam'",
    'microphoneCheck',
    "state.trainingMode==='practice'",
    'DTZ assesses the A2–B1 range.',
    'Pronunciation is not scored because this text simulation has no recorded audio evidence.',
    'elsa-choice-grid'
  ]) assert.ok(aiBannerSource.includes(marker) || styles.includes(marker), `missing ${marker}`);
  assert.ok(styles.includes('.elsa-setup-grid'));
  assert.ok(styles.includes('@media(max-width:700px){#elsaExamOverlay'));
});

test('Goethe B1 never routes learners to the DTZ picture-description task', () => {
  assert.match(aiBannerSource, /B1: \['Gemeinsam etwas planen', 'Ein Thema präsentieren', 'Über ein Thema sprechen'\]/);
  assert.match(aiBannerSource, /return state\.board === 'dtz' && partIndex === 1;/);
  assert.doesNotMatch(aiBannerSource, /B1: \[[^\]]*Ein Bild beschreiben/);
  assert.ok(aiBannerSource.includes('elsa-active-exam'));
  assert.ok(styles.includes('.elsa-active-exam{display:grid;grid-template-columns:'));
});

test('AI voice conversation uses real media capture, speech recognition, live analyser levels and authenticated TTS', () => {
  for (const marker of [
    'navigator.mediaDevices.getUserMedia',
    'createMediaStreamSource',
    'getByteTimeDomainData',
    'startAiVoiceConversation',
    'beginAiRecognition',
    'stopAiVoiceConversation',
    "fetchFishAudioBlob({ action: 'speak'",
    'Microphone permission was denied',
    'Voice conversation needs a microphone'
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.ok(styles.includes('.ai-voice-console'));
  assert.ok(styles.includes('.ai-voice-wave'));
});

test('ELSA voice turns use genuine browser recognition and synthesize ELSA responses only after a learner enables voice', () => {
  assert.ok(aiBannerSource.includes("state.voiceConversation = true; startVoiceInput(input, voiceButton);"));
  assert.ok(aiBannerSource.includes("if (state.voiceConversation && state.speakerEnabled) speak(assistantReply);"));
  assert.ok(aiBannerSource.includes('SpeechSynthesisUtterance'));
});

test('AI chat keeps a visible microphone launcher beside Send, including from text chat', () => {
  assert.ok(source.includes('ai-mic-launch'));
  assert.ok(source.includes("Start voice conversation"));
  assert.ok(source.includes("if(await startAiVoiceConversation()){renderAiPractice();beginAiRecognition();}"));
});

test('W-questions uses the reviewed mobile starter bank in a dedicated compact trainer', () => {
  assert.ok(source.includes("case 'wquestion': return renderWQuestions();"));
  assert.ok(source.includes('function renderWQuestions()'));
  assert.ok(source.includes('W_QUESTIONS.map'));
  assert.ok(styles.includes('.w-question-trainer'));
  assert.ok(styles.includes('.w-question-options'));
});

test('W-questions validates a selected answer before feedback and explains the current source item', () => {
  for (const marker of ['data-w-check', 'data-w-continue', 'data-w-exit', 'item.full', 'item.translation[locale]', 'item.explanation[locale]', 'item.example.de']) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.ok(styles.includes('.w-question-check'));
  assert.ok(styles.includes('.w-question-footer'));
});

test('Mistake Center keeps the Academy Hub due queue and advances only after checked answers', () => {
  for (const marker of ['mistakeIntervalDays', 'mistakeDueLabel', 'data-mistake-start', 'data-mistake-check', 'data-mistake-next', "studyState.mistakePhase='review'", 'clearMistake(item.lang,item.prompt)', 'logMistake(item.lang,item.prompt,item.opts,item.a,item.kind)']) assert.ok(source.includes(marker), `missing ${marker}`);
  assert.ok(source.includes("progressDirect:id==='mistakes'"));
  assert.ok(styles.includes('.mistake-center'));
  assert.ok(styles.includes('.mistake-review'));
  assert.ok(styles.includes('.mistake-options'));
});
