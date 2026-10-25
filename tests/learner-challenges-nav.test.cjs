const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('learner navigation exposes the existing Challenges workspace', () => {
  const html = read('app.html');
  const challengeButton = html.match(/<button[^>]*data-view="challenges"[^>]*>/)?.[0];

  assert.ok(challengeButton, 'Challenges navigation button should exist');
  assert.doesNotMatch(challengeButton, /nav-business-only/, 'Challenges must be visible to learners');
  assert.match(challengeButton, /learner-challenges-enabled/, 'Learner navigation marker should be present');
});

test('Challenges navigation keeps the real renderer and route behavior', () => {
  const bootstrap = read('web/app-bootstrap.js');
  const page = read('web/app-page.js');

  assert.match(bootstrap, /button\.dataset\.view === 'challenges'\) ctx\.renderChallenges\(\)/);
  assert.match(bootstrap, /initialView === 'challenges'\) ctx\.renderChallenges\(\)/);
  assert.match(page, /function renderChallenges\(\) \{ return gamificationFeature\.renderChallengesPage\(\); \}/);
});

test('learner challenge search icon has a fixed compact size', () => {
  const css = read('web/event-cards.css');
  const html = read('app.html');

  assert.match(css, /\.catalog-toolbar \.catalog-search>svg\{[^}]*width:18px;[^}]*height:18px;[^}]*flex:0 0 18px/);
  assert.match(html, /event-cards\.css\?v=20261021-challenge-layout2/);
});

test('learner challenge cards use a responsive catalog grid', () => {
  const css = read('web/event-cards.css');

  assert.match(css, /#challengeList\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /#courseList,#eventList,#challengeList\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /#courseList,#eventList,#challengeList\{grid-template-columns:1fr\}/);
});

