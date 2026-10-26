const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const feature = fs.readFileSync('web/app-feature-social-practice.js', 'utf8');
const css = fs.readFileSync('web/app-social-practice.css', 'utf8');
const html = fs.readFileSync('app.html', 'utf8');

test('Premium Voice Room V2 keeps real Supabase and Agora sources of truth', () => {
  for (const rpc of ['list_voice_room_members', 'request_to_speak', 'cancel_speak_request', 'invite_to_voice_room', 'end_voice_room', 'send_voice_room_message']) {
    assert.ok(feature.includes(rpc), `missing ${rpc}`);
  }
  assert.match(feature, /client\.on\('volume-indicator'/);
  assert.match(feature, /speakingIds\(\)/);
  assert.match(feature, /fetchToken\('publisher'\)/);
  assert.match(feature, /createMicrophoneAudioTrack/);
});

test('Premium Voice Room V2 renders data-backed participant states and responsive controls', () => {
  for (const marker of ['sp-participant-grid', 'sp-member--host', 'sp-member--speaking', 'sp-member--hand', 'sp-member--listening', 'sp-invite-tile', 'sp-mic-state', 'sp-bar']) {
    assert.ok(feature.includes(marker) || css.includes(marker), `missing ${marker}`);
  }
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:350px\).*repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css, /@media\(min-width:1040px\).*repeat\(6,minmax\(0,1fr\)\)/s);
  assert.ok(html.includes('app-feature-social-practice.js?v=20261027-i18n1'));
});
