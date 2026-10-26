const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.html');
const study = read('web/app-feature-study.js');
const grammi = read('web/app-feature-grammi.js');

function loadTopics() {
  const sandbox = { window: {} };
  vm.runInNewContext(read('web/content/grammi-topics.js'), sandbox);
  return sandbox.window.DUVELA_GRAMMI_TOPICS;
}

test('GRAMMI topic map covers every level of the four card languages', () => {
  const topics = loadTopics();
  for (const lang of ['de', 'en', 'es', 'sv']) {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      const rows = topics[lang][level];
      assert.ok(rows.length > 0, `${lang} ${level} has topics`);
      for (const row of rows) assert.ok(row.id && row.title && row.en && row.ru, `${lang} ${level} ${row.id} is complete`);
    }
  }
  const ids = Object.values(topics).flatMap((bank) => Object.values(bank).flat().map((row) => row.id));
  assert.equal(new Set(ids).size, ids.length, 'topic ids are unique');
});

test('GRAMMI cards use the grammar_lesson / grammar_check actions and keep progress per learner and language', () => {
  assert.match(grammi, /action: 'grammar_lesson'/);
  assert.match(grammi, /action: 'grammar_check'/);
  assert.match(grammi, /mode: 'review'/);
  assert.match(grammi, /STORAGE_PREFIX \+ '\.' \+ \(userId \|\| 'guest'\) \+ '\.' \+ lang/);
  assert.match(grammi, /PASS_SCORE = 75/);
});

test('the AI practice screen opens GRAMMI cards for de/en/es/sv and keeps Persian on the chat drill', () => {
  assert.match(study, /function isGrammiCardsLang\(lang\)/);
  assert.match(study, /\["de", "en", "es", "sv"\]/);
  assert.match(study, /bot\.id==='grammi'&&isGrammiCardsLang\(aiChatState\.lang\)/);
  assert.match(study, /aiChatState\.partner\.id === 'grammi' && isGrammiCardsLang\(aiChatState\.lang\)\) return renderGrammiPractice\(\)/);
  assert.ok(app.indexOf('content/grammi-topics.js') < app.indexOf('app-feature-grammi.js'));
  assert.ok(app.indexOf('app-feature-grammi.js') < app.indexOf('app-feature-study.js'));
});

test('GRAMMI and NOVA progress is shared with the server copy (practice_topic_progress)', () => {
  const nova = read('web/app-feature-nova.js');
  assert.match(grammi, /from\('practice_topic_progress'\)/);
  assert.match(grammi, /rpc\('record_practice_topic_score'/);
  assert.match(grammi, /mergeServerProgress\(opts\.supa, 'grammi', opts\.lang, state\.progress\)/);
  assert.match(nova, /mergeServerProgress\(opts\.supa, 'nova', opts\.lang, state\.progress\)/);
  assert.match(nova, /recordServerScore\(opts\.supa, 'nova', opts\.lang, soundId, soundScore\)/);
});
