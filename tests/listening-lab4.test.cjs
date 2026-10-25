const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const study = fs.readFileSync(path.join(root, 'web/app-feature-study.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'web/practice-hub.css'), 'utf8');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'web/content/listening-lab-bank.json'), 'utf8'));

test('Listening Lab keeps the validated exercise bank and all supported modes', () => {
  assert.equal(bank.tasks.length, 360);
  const modes = new Set(bank.tasks.map((task) => task.mode));
  assert.deepEqual([...modes].sort(), ['choice', 'cloze', 'dictation']);
  assert.match(study, /mode:task\.mode \|\| 'dictation'/);
  assert.match(study, /options:Array\.isArray\(task\.options\)/);
});

test('opening Listening Lab bypasses the generic skills hub', () => {
  assert.match(study, /skillDirect:id==='listening'[\s\S]*?!!\(restored&&restored\.skillDirect\)/);
  assert.match(study, /function renderListening\(\)[\s\S]*?if \(!studyState\.skillDirect\) return renderSkillsHub\(\)/);
});

test('Listening Lab uses exact Unicode-aware validation without fuzzy word matching', () => {
  assert.match(study, /normalize\('NFKC'\)/);
  assert.match(study, /\[\\p\{P\}\]\/gu/);
  assert.doesNotMatch(study, /hits \/ tw\.length >= 0\.8/);
  assert.match(study, /listeningAnswerDiff/);
});

test('player exposes pause, replay, speed and real progress without a fake waveform', () => {
  assert.match(study, /id="lsReplay"/);
  assert.match(study, /<option value="0\.75">0\.75×<\/option>/);
  assert.match(study, /id="lsAudioProgress"/);
  assert.match(study, /listeningAudio\.pause\(\)/);
  assert.doesNotMatch(study, /'<i><\/i>'\.repeat\(18\)/);
  assert.doesNotMatch(css, /\.listening-wave/);
});

test('hints, attempts and verified XP follow the learning rules', () => {
  assert.match(study, /id="lsHintPanel" hidden/);
  assert.match(study, /\{ used:0, max:3 \}/);
  assert.match(study, /remaining\s*>\s*0/);
  assert.match(study, /Verified XP/);
  assert.match(study, /serverAuthoritative = finished\.tool === 'listening' \|\| finished\.tool === 'reading'/);
  assert.match(study, /serverAuthoritative \? \(uid\(\) && awarded \? xp : 0\) : xp/);
  assert.match(study, /studyState\.tool === 'listening'[\s\S]*?XP after finish/);
});

test('responsive Listening Lab has one compact shell and a mobile check action', () => {
  assert.match(css, /data-practice-tool=listening[^}]*practice-stage-intro/);
  assert.match(css, /\.listening-lab\{width:min\(940px,100%\)/);
  assert.match(css, /\.listening-answer-foot \.btn\{position:fixed/);
  assert.match(css, /\.listening-options\{display:grid;grid-template-columns:repeat\(2/);
});
