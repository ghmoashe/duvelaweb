const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('learner home is routed to Practice while business keeps Dashboard', () => {
  const router = read('web/app-router.js');
  const bootstrap = read('web/app-bootstrap.js');

  assert.match(router, /mode === 'bus' \? 'home' : 'workspace'/);
  assert.match(router, /view === 'home' \? defaultView : view/);
  assert.match(bootstrap, /session\.role === 'learner' \? '#workspace' : '#home'/);
});

test('Home navigation is hidden for learners', () => {
  const router = read('web/app-router.js');

  assert.match(router, /homeNav\.hidden = mode !== 'bus'/);
  assert.match(router, /homeNav\.style\.display = mode === 'bus' \? '' : 'none'/);
});

test('hidden teacher dashboard cannot be exposed by its grid style', () => {
  const css = read('web/app-inline.css');

  assert.match(css, /#busDashboard\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test('public learner entry links open Practice Hub', () => {
  const index = read('index.html');
  const i18n = read('web/index-i18n.js');

  assert.doesNotMatch(index, /role=learner#home/);
  assert.doesNotMatch(i18n, /role=learner#home/);
  assert.match(index, /role=learner#workspace/);
  assert.match(i18n, /role=learner#workspace/);
});
