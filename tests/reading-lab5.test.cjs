const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const study = fs.readFileSync(path.join(root, 'web/app-feature-study.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'web/practice-hub.css'), 'utf8');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'web/content/reading-lab-bank.json'), 'utf8'));
const browserBank = fs.readFileSync(path.join(root, 'web/content/reading-lab-bank.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const targets = ['english', 'german', 'spanish', 'swedish'];

test('web Reading Lab is synchronized from the Academy Hub bank', () => {
  assert.equal(bank.source, 'vela-academy-hub/shared/reading-lab-data.ts');
  assert.equal(bank.tasks.length, 1440);
  for (const target of targets) {
    for (const level of levels) assert.equal(bank.counts[target][level], 60, `${target} ${level}`);
  }
});

test('Reading bank is available when app.html is opened directly from disk', () => {
  assert.match(browserBank, /^window\.DuvelaReadingLabBank=/);
  assert.match(app, /reading-lab-bank\.js\?v=20261022-reading6/);
  assert.ok(app.indexOf('reading-lab-bank.js') < app.indexOf('app-feature-study.js'));
  assert.match(study, /location\.protocol==='file:'\)\?Promise\.resolve\(embedded\)/);
});

test('every published reading task has authoritative answer data', () => {
  const ids = new Set();
  for (const task of bank.tasks) {
    assert.equal(task.category, 'reading');
    assert.equal(task.status, 'published');
    assert.ok(task.id && !ids.has(task.id), task.id);
    ids.add(task.id);
    assert.ok(targets.includes(task.target));
    assert.ok(levels.includes(task.level));
    assert.ok(task.title && task.text && task.questions.length >= 2);
    for (const question of task.questions) {
      assert.ok(question.id && question.prompt && question.evidence);
      assert.equal(question.options.filter((option) => option === question.answer).length, 1);
    }
  }
});

test('Reading Lab loads only exact language, CEFR, category and publication matches', () => {
  assert.match(study, /function exactReadingTasks/);
  assert.match(study, /String\(task\.target\)\.toLowerCase\(\)===target/);
  assert.match(study, /normalizePracticeLevel\(task\.level,''\)===wanted/);
  assert.match(study, /String\(task\.category \|\| 'reading'\)\.toLowerCase\(\) === 'reading'/);
  assert.doesNotMatch(study, /strictBank\(READING/);
});

test('loading, empty and error states do not initialize reading progress', () => {
  assert.match(study, /readingBankState\.status === 'idle'/);
  assert.match(study, /readingBankState\.status === 'error'/);
  assert.match(study, /No '\+studyState\.level\+' reading exercises are available yet\./);
  assert.match(study, /id="readingRetry"/);
  assert.match(study, /id="readingAlternative"/);
  assert.match(study, /id="readingBack"/);
  assert.match(css, /data-practice-tool=reading[^}]*practice-session-line/);
});

test('Reading workspace supports selection, feedback, attempts and server-authoritative XP', () => {
  assert.match(study, /id="readingAnswerForm"/);
  assert.match(study, /question\.options\.indexOf\(question\.answer\)/);
  assert.match(study, /d\.attempts=Number\(d\.attempts\|\|0\)\+1/);
  assert.match(study, /question\.evidence/);
  assert.match(study, /serverAuthoritative = finished\.tool === 'listening' \|\| finished\.tool === 'reading'/);
  assert.match(css, /grid-template-columns:minmax\(0,55fr\) minmax\(360px,45fr\)/);
  assert.match(css, /@media\(max-width:600px\)/);
});
