const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'web/app-feature-profile-view.js'), 'utf8');

test('teacher profile leads with verified teaching value and conversion actions', () => {
  for (const marker of [
    'pv-value-headline',
    'What I teach',
    'Teaching information',
    'Teaching focus and methods',
    'Book Lesson',
    'Message Teacher',
    'View Courses',
    'Join LIVE',
    'View Schedule'
  ]) assert.ok(source.includes(marker), `missing ${marker}`);
});

test('teacher offers and formats come from real profile and backend records', () => {
  assert.match(source, /from\('courses'\).*eq\('created_by', uid\)/s);
  assert.match(source, /from\('live_sessions'\).*eq\('teacher_id', uid\)/s);
  assert.match(source, /from\('events'\).*eq\('organizer_id', uid\)/s);
  assert.ok(source.includes('p.explanation_languages'));
  assert.ok(source.includes('p.teacher_audience'));
  assert.ok(source.includes('p.learning_targets'));
  assert.ok(source.includes('p.language_level'));
});

test('identity details are secondary disclosure content', () => {
  assert.ok(source.includes('<details class="pv-account-details">'));
  assert.ok(source.includes('Account and identity details'));
});
