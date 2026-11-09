const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('the teacher form goes through the checked function, never straight to the table', () => {
  const page = read('teacher-invite.html');
  const script = read('web/teacher-invite.js');
  assert.match(page, /class="cf-turnstile" data-sitekey=/);
  assert.match(page, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(script, /functions\.invoke\("submit-teacher-application"/);
  assert.doesNotMatch(script, /from\("teacher_applications"\)\.insert/);
});
