const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const study = fs.readFileSync('web/app-feature-study.js', 'utf8');
const css = fs.readFileSync('web/practice-hub.css', 'utf8');
const edge = fs.readFileSync('supabase/functions/openai-assistant/index.ts', 'utf8');
const html = fs.readFileSync('app.html', 'utf8');

test('Writing Studio uses a focused editor and responsive support panel', () => {
  for (const marker of ['writing-studio-grid','writing-editor-panel','writing-support-panel','writing-task-card','writing-studio-toolbar']) assert.ok(study.includes(marker));
  const writingRenderer = study.slice(study.indexOf('function renderWriting()'), study.indexOf('function renderMockExam()'));
  assert.doesNotMatch(writingRenderer, /renderSkillsHub\(\)/, 'Writing must open the studio directly');
  assert.match(css, /grid-template-columns:minmax\(0,68fr\) minmax\(290px,32fr\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.ok(html.includes('practice-hub.css?v=20261025-exam-mode-v2'));
  assert.ok(html.includes('app-feature-study.js?v=20261029-stella-native-lang'));
});

test('Writing drafts distinguish local, account, saving and failure states', () => {
  for (const marker of ['Saved locally','Saving to account','Saved to account','Account save failed','practice_resume','writingDraft']) assert.ok(study.includes(marker));
  assert.ok(study.includes("if(id==='writing'&&!restored)"));
});

test('Writing evaluation uses the authenticated OpenAI edge function and structured formative feedback', () => {
  assert.ok(study.includes("supa.functions.invoke(tool === 'writing' ? 'openai-assistant'"));
  for (const marker of ['taskCompletion','grammar','vocabulary','structure','improvedVersion','corrections']) assert.ok(edge.includes(marker));
  assert.ok(edge.includes('action !== "evaluate_writing"'));
  assert.match(edge, /official exam or certification result/i);
});

test('Teacher sharing uses an eligible assignment and confirmed server insert', () => {
  assert.ok(study.includes("from('practice_assignments')"));
  assert.ok(study.includes("from('practice_submissions').insert"));
  assert.ok(study.includes('data-teacher-id'));
  assert.ok(study.includes('Delivered to the teacher for review'));
});

test('Writing completion is server-authoritative and unchanged text has a stable session id', () => {
  assert.ok(study.includes("finished.tool === 'writing'"));
  assert.ok(study.includes("'writing-'+task.id+'-'+studyState.writingEvaluationHash"));
  assert.ok(study.includes('writingTextHash'));
});



