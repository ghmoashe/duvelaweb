const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const loader = read('web/app-i18n-loader.js');
const langs = JSON.parse(loader.match(/var LANGS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
const holes = (text) => (text.match(/\{[^{}\s]+\}/g) || []).sort().join();

function tableFor(lang) {
  const box = { window: {} };
  vm.createContext(box);
  vm.runInContext(read(`web/content/app-phrases/${lang}.js`), box);
  return box.window.DUVELA_APP_PHRASES;
}

test('the app loads the phrase table of one language, before the pages', () => {
  const page = read('app.html');
  assert.equal(langs.length, 32);
  assert.ok(!page.includes('app-phrases-i18n.js'), 'the all-languages file must not come back');
  assert.ok(page.indexOf('web/app-i18n.js') < page.indexOf('app-i18n-loader.js'));
  assert.ok(page.indexOf('app-i18n-loader.js') < page.indexOf('web/app-page.js'));
});

test('every language has the same phrases with their placeholders', () => {
  const phrases = Object.keys(tableFor('pl'));
  assert.ok(phrases.length > 3500);
  for (const lang of langs) {
    const table = tableFor(lang);
    const missing = phrases.filter((phrase) => !table[phrase] || !table[phrase][lang]);
    assert.deepEqual(missing, [], `${lang} is missing phrases`);
    for (const phrase of phrases) assert.equal(holes(table[phrase][lang]), holes(phrase), `${lang}: ${phrase}`);
  }
});

test('one language stays small enough to load at start', () => {
  for (const lang of langs) assert.ok(read(`web/content/app-phrases/${lang}.js`).length < 450000, lang);
});
