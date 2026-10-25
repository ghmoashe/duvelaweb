const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'web/app-events5.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'web/app-events5.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

test('event discovery separates confirmed dates from announcements and never exposes drafts', () => {
  for (const marker of ['function stateOf', "return 'soon'", 'isDraft(item)', "filters.view === 'upcoming' && kind !== 'upcoming'", "filters.view === 'soon' && kind !== 'soon'", 'Date to be announced']) assert.ok(source.includes(marker), marker);
  assert.match(source, /return \(state\.events \|\| \[\]\)\.filter\(function \(item\) \{ return item && item\.id && !isDraft\(item\); \}\)/);
});

test('event discovery uses existing RSVP and count services instead of inventing attendance', () => {
  for (const marker of ["from('event_rsvps')", 'eventGoingCounts', 'eventCount(supa, item.id)', 'await base.toggleRsvp(item.id)', 'max_participants', 'Public discovery intentionally excludes cancelled records']) assert.ok(source.includes(marker), marker);
  assert.doesNotMatch(source, /attendees:\s*\d+/);
});

test('event details retain organizer, venue, format and registration context', () => {
  for (const marker of ['publicProfiles(supa', 'Organized by ', 'Online — join from anywhere', 'Register for event', 'Cancel registration', 'Event details']) assert.ok(source.includes(marker), marker);
});

test('events hub has accessible mobile and desktop layouts and is wired into the learner app', () => {
  assert.match(html, /app-events5\.css\?v=20261023-events5/);
  assert.match(html, /app-events5\.js\?v=20261023-events5/);
  assert.match(css, /\.ed-grid\{display:grid;grid-template-columns:repeat\(3/);
  assert.match(css, /@media\(max-width:1180px\)\{\.ed-grid\{grid-template-columns:repeat\(2/);
  assert.match(css, /@media\(max-width:760px\).*\.ed-grid\{grid-template-columns:1fr/s);
  assert.match(source, /aria-label=/);
});
