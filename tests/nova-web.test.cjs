const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.html');
const study = read('web/app-feature-study.js');
const nova = read('web/app-feature-nova.js');

function loadSounds() {
  const sandbox = { window: {} };
  vm.runInNewContext(read('web/content/nova-sounds.js'), sandbox);
  return sandbox.window.DUVELA_NOVA_SOUNDS;
}

test('NOVA sound map covers every level of the four card languages, pairs are real pairs', () => {
  const sounds = loadSounds();
  for (const lang of ['de', 'en', 'es', 'sv']) {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
      assert.ok(sounds[lang][level].length > 0, `${lang} ${level} has sounds`);
      for (const sound of sounds[lang][level]) {
        assert.ok(sound.id && sound.title && sound.en && sound.ru, `${sound.id} is complete`);
        for (const pair of sound.pairs ? sound.pairs.split(';') : []) {
          const [a, b] = pair.split('/').map((word) => word.trim());
          assert.ok(a && b && a.toLowerCase() !== b.toLowerCase(), `${sound.id}: "${pair}" is two different words`);
        }
      }
    }
  }
});

test('NOVA records each item and checks it with pronunciation_check_item, passing the pair word as alternative', () => {
  assert.match(nova, /action: 'pronunciation_lesson'/);
  assert.match(nova, /action: 'pronunciation_check_item'/);
  assert.match(nova, /alternatives: alternatives/);
  assert.match(nova, /new MediaRecorder\(/);
  assert.match(nova, /STORAGE_PREFIX = 'duvela\.nova\.v1'/);
});

test('the AI practice screen opens NOVA cards for de/en/es/sv, with a way back to the free chat', () => {
  assert.match(study, /function isNovaCardsSession\(\)/);
  assert.match(study, /aiChatState\.novaFree = true/);
  assert.match(study, /if\(bot\.id==='nova'\)\{ aiChatState\.novaFree=false; if\(isNovaCardsSession\(\)\)/);
  assert.ok(app.indexOf('content/nova-sounds.js') < app.indexOf('app-feature-nova.js'));
  assert.ok(app.indexOf('app-feature-nova.js') < app.indexOf('app-feature-study.js'));
});
