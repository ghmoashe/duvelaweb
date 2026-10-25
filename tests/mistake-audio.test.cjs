const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const study = fs.readFileSync(path.join(root, 'web/app-feature-study.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'web/practice-hub.css'), 'utf8');

test('listening mistakes keep their recording and text through local storage and the server', () => {
  assert.match(study, /audioClip:meta\.audioClip\|\|null,audioText:meta\.audioText\|\|''/);
  assert.match(study, /0,'listening',\{sourceTool:'listening',audioClip:item\.audioClip\|\|null,audioText:item\.text\|\|''\}\)/);
  assert.match(study, /audioClip:m\.audioClip \|\| null, audioText:m\.audioText \|\| ''/);
  assert.match(study, /audioClip:details\.audioClip \|\| null, audioText:details\.audioText \|\| ''/);
});

test('the Mistake Center review card can play a listening mistake again', () => {
  assert.ok(study.includes('data-mistake-listen'));
  assert.ok(study.includes('function playMistakeAudio(item, button)'));
  assert.match(study, /prepareListeningRecording\(item\.audioClip\)/);
  assert.match(study, /prepareListeningFish\(item\.audioText, item\.lang, 1\)/);
  assert.ok(styles.includes('.mistake-listen{'));
});

test('Persian word cards can save a word to My words', () => {
  const extras = fs.readFileSync(path.join(root, 'web/app-feature-practice-extras.js'), 'utf8');
  assert.ok(extras.includes("id=\"pxSave\""));
  assert.match(extras, /opts\.saveWord\(word\.fa, word\.translit \+ ' — ' \+ localized\(word\.meaning, opts\)\)/);
  assert.match(study, /isSaved: function \(word\) \{ return isWordSaved\('fa', word\); \}/);
});

test('the web adaptive route keeps progress made in the app by activityId', () => {
  assert.match(study, /activityId:kind, tool:kind/);
  assert.match(study, /\(item\.activityId \|\| item\.tool\) === step\.activityId/);
});
