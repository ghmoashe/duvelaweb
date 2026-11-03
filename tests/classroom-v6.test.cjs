const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../classroom-src', file), 'utf8');
const html = read('classroom.html');
const main = read('main.js');
const css = read('classroom-v6.css');

test('classroom V6 keeps every element main.js drives', () => {
  const ids = [...new Set([...main.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map((m) => m[1]))];
  const missing = ids.filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, []);
});

test('classroom V6 stays on the Zoom Video SDK and is scoped', () => {
  assert.ok(main.includes("import('@zoom/videosdk')"));
  assert.ok(!/agora/i.test(main), 'no Agora code in the classroom');
  assert.ok(main.includes("import './classroom-v6.css'"));
  assert.ok(html.includes('class="duvela-classroom-v6"'));
  assert.ok(css.includes('--class-primary: #793df3'));
});

test('status chips come from SDK state, not hardcoded', () => {
  assert.ok(html.includes('id="recordingChip" class="cv6-chip cv6-rec" hidden'), 'recording hidden until the SDK reports it');
  assert.ok(main.includes("client.on('recording-change'"));
  assert.ok(main.includes("client.on('connection-change'"));
  assert.ok(!/Secure & encrypted|Passcode/i.test(html));
  assert.ok(main.includes('media.switchCamera(') && main.includes('media.switchMicrophone('));
});
