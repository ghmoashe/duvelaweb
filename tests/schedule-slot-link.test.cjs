const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../web/app-feature-schedule.js'), 'utf8');

test('slot room links are never read from teacher_slots directly', () => {
  for (const match of source.matchAll(/\.select\('([^']*)'\)/g)) {
    assert.ok(!match[1].split(',').includes('live_room_url'), 'select must not include live_room_url: ' + match[1]);
  }
  assert.ok(source.includes("supa.rpc('slot_live_room_urls'"));
  assert.ok(source.includes('slot.has_live_room'));
});
