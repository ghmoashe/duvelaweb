const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve('..');
const read = (...segments) => fs.readFileSync(path.join(...segments), 'utf8');

const webFeature = read(process.cwd(), 'web', 'app-feature-social-practice.js');
const migration = read(projectRoot, 'supabase', 'migrations', '20261026141000_voice_room_teacher_access.sql');
const businessScreen = read(projectRoot, 'vela academy for business', 'features', 'business-screens', 'voice-rooms.tsx');
const hubScreen = read(projectRoot, 'vela academy hub', 'app', 'native', 'voice-rooms.tsx');

test('subscriber-only teacher rooms are enforced by the database policy', () => {
  for (const marker of [
    'add column if not exists host_role text not null',
    "r.room_type = 'subscribers'",
    'public.teacher_subscriptions',
    'super_subscription_price_dv',
    'list_voice_rooms_v2',
  ]) {
    assert.ok(migration.includes(marker), `missing database enforcement: ${marker}`);
  }
});

test('all clients display a teacher host independently of room access', () => {
  assert.match(webFeature, /list_voice_rooms_v2/);
  assert.match(webFeature, /item\.host_role === 'teacher'/);
  assert.match(webFeature, /roomTypes\.subscribers/);
  assert.match(businessScreen, /\['open', 'subscribers'\]/);
  assert.match(businessScreen, /room\.hostRole === 'teacher'/);
  assert.match(hubScreen, /room\.hostRole === 'teacher'/);
});

test('a learner without access is sent to the teacher Super subscription before joining', () => {
  assert.match(hubScreen, /fetchMyTeacherSubscriptions/);
  assert.match(hubScreen, /room\.roomType === 'subscribers' && !hasSuperSubscription/);
  assert.match(hubScreen, /viewSuperSubscription/);
  assert.match(hubScreen, /\/native\/other-profile\?profileId=/);
});
