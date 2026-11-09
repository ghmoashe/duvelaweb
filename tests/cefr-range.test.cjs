const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const box = { window: {} };
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(root, 'web/cefr-range.js'), 'utf8'), box);
const range = box.window.DuvelaCefrRange;

test('two neighbours make a pair, anything else starts over', () => {
  assert.equal(range.toggle(null, 'A1'), 'A1');
  assert.equal(range.toggle('A1', 'A2'), 'A1-A2');
  assert.equal(range.toggle('B2', 'B1'), 'B1-B2');
  assert.equal(range.toggle('A1', 'C2'), 'C2');
  assert.equal(range.toggle('A1-A2', 'B1'), 'B1');
  assert.equal(range.toggle('A1-A2', 'A1'), 'A2');
  assert.equal(range.toggle('B1', 'B1'), null);
});

test('a range answers to each of its levels', () => {
  assert.equal(range.covers('A1-A2', 'A2'), true);
  assert.equal(range.covers('A2-B1', 'b1'), true);
  assert.equal(range.covers('A1-A2', 'B1'), false);
  assert.equal(range.covers('', 'A1'), false);
});

test('hashtags on a video search the library', () => {
  const media = fs.readFileSync(path.join(root, 'web/app-feature-media-platform.js'), 'utf8');
  assert.match(media, /data-media-tag=/);
  assert.match(media, /mp\.query='#'\+n\.dataset\.mediaTag/);
  assert.match(media, /concat\(tagsOf\(x\)\)/);
});
