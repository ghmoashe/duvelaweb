const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const webFeature = fs.readFileSync('web/app-feature-social-practice.js', 'utf8');
const nativeScreen = fs.readFileSync(path.resolve('..', 'vela academy hub', 'app', 'native', 'language-match.tsx'), 'utf8');
const nativeService = fs.readFileSync(path.resolve('..', 'vela academy hub', 'shared', 'supabase', 'language-match.ts'), 'utf8');
const migration = fs.readFileSync(path.resolve('..', 'supabase', 'migrations', '20261026123720_language_match_profile_languages.sql'), 'utf8');

test('Language Match shows native and learning languages from the account profile', () => {
  assert.match(webFeature, /function accountLanguageSnapshot\(\)/);
  assert.match(webFeature, /ctx\.profile\?\.language/);
  assert.match(webFeature, /ctx\.profile\?\.learning_languages/);
  assert.match(webFeature, /profileSource/);
  assert.match(nativeScreen, /function sourceLanguages\(/);
  assert.match(nativeScreen, /fetchProfileById\(user\.id\)/);
  assert.match(nativeScreen, /source=\{sourceLanguages\(accountProfile, registrationDraft\)\}/);
});

test('Language Match saves privacy fields through a server-authoritative profile RPC', () => {
  for (const source of [webFeature, nativeService]) {
    assert.match(source, /save_my_language_partner_profile/);
  }
  assert.match(migration, /security definer/);
  assert.match(migration, /from public\.profiles where id = auth\.uid\(\)/);
  assert.match(migration, /revoke insert, update, truncate, references, trigger on public\.language_partner_profiles from authenticated/);
  assert.match(migration, /allowed_languages/);
  assert.match(migration, /create trigger sync_language_partner_profile_from_account/);
});
