const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'web', 'app-feature-profile.js'), 'utf8');

test('web account deletion removes the sign-in account, not only the profile row', () => {
  const body = source.slice(source.indexOf('async function deleteAccount()'), source.indexOf('function portfolioHtml()'));
  assert.match(body, /functions\.invoke\('delete-account'/);
  assert.doesNotMatch(body, /from\('profiles'\)\.delete\(\)/);
  assert.match(body, /signOut\(\{ scope: 'local' \}\)/);
});
