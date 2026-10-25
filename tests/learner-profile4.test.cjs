const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('learner profile is organized into Overview, Achievements and Account tabs', () => {
  const source = read('web/app-feature-profile.js');
  assert.match(source, /data-lp-tab="overview"/);
  assert.match(source, /data-lp-tab="achievements"/);
  assert.match(source, /data-lp-tab="account"/);
  assert.match(source, /data-lp-pane="account"/);
});

test('learner journey covers A1 through C2 without inferring completed levels', () => {
  const source = read('web/app-feature-profile.js');
  const goals = read('web/app-student-goal.js');
  assert.match(source, /\['A1', 'A2', 'B1', 'B2', 'C1', 'C2'\]/);
  assert.match(goals, /\['A1', 'A2', 'B1', 'B2', 'C1', 'C2'\]/);
  assert.match(source, /metadata\.completed === true/);
  assert.match(source, /Completed levels appear only after a verified milestone/);
});

test('missing progress is shown as unavailable rather than zero percent', () => {
  const source = read('web/app-feature-profile.js');
  assert.match(source, /No verified data yet/);
  assert.match(source, /percent === null/);
  assert.doesNotMatch(source, /ctx\.profile\?\.grammar_progress \?\? 0/);
});

test('private learner activity is loaded through user-scoped queries', () => {
  const source = read('web/app-feature-profile.js');
  for (const table of ['practice_progress', 'practice_streaks', 'practice_achievements', 'learner_language_profiles', 'coin_transactions', 'challenge_participants']) {
    assert.match(source, new RegExp(`from\\('${table}'\\)`));
  }
  assert.match(source, /\.eq\('user_id', userId\)/);
});

test('responsive learner profile stylesheet prevents fixed desktop-only layout', () => {
  const css = read('web/learner-profile4.css');
  assert.match(css, /grid-template-columns:minmax\(0,1\.9fr\) minmax\(300px,\.85fr\)/);
  assert.match(css, /@media\(max-width:1120px\)/);
  assert.match(css, /@media\(max-width:820px\)/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.match(css, /\.lp-pane\[hidden\]\{display:none!important\}/);
});
