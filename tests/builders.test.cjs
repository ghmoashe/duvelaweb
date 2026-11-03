const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '../web', file), 'utf8');
const source = read('app-builders.js');
const sandbox = { window: {}, localStorage: { getItem() { return null; }, setItem() {} }, CustomEvent: function () {} };
vm.runInNewContext(read('app-courses4.js'), sandbox);
vm.runInNewContext(source, sandbox);
const helpers = sandbox.window.DuvelaBuilders.__test;
const tr = (en) => en;

test('challenge duration matches the Business app labels', () => {
  assert.equal(helpers.challengeDuration(tr, '2026-11-01', '2026-11-15'), '14 days');
  assert.equal(helpers.challengeDuration(tr, '2026-11-01', '2027-04-01'), '≈ 5 months');
  assert.equal(helpers.challengeDuration(tr, '2026-11-15', '2026-11-01'), 'End date is before start date');
});

test('event recurrence is written as the Business app summary', () => {
  assert.equal(helpers.recurrenceNote(tr, { recurrence: 'once' }), '');
  assert.equal(helpers.recurrenceNote(tr, { recurrence: 'weekly', days: [2, 0] }), 'Repeats on: Mon, Wed');
  assert.equal(helpers.recurrenceNote(tr, { recurrence: 'custom', customDates: ['2026-12-01'] }), 'Specific dates: 01.12.2026');
});

test('builders save the same columns as the Business app', () => {
  for (const column of ['duration_minutes', 'explanation_languages', 'image_urls', 'max_participants', 'address']) assert.ok(source.includes(column + ':'), column);
  for (const column of ['grace_days_per_week', 'warn_before_exclude', 'auto_exclude', 'daily_min_live_min', 'daily_min_listening_min', 'cover_url', 'currency']) assert.ok(source.includes(column), column);
  assert.ok(source.includes("format: online ? 'online' : 'offline'"), 'events.format only allows online/offline');
  assert.ok(sandbox.window.DuvelaCourses4.languages.list.length >= 36);
});

test('meeting links never go to the public events table', () => {
  assert.ok(!/online_url:\s*online/.test(source), 'events row must not carry online_url');
  assert.ok(source.includes("from('event_private_details').upsert"));
});
