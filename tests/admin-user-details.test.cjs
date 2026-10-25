const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('admin users view exposes a protected full-details workflow', () => {
  const html = read('admin.html');
  const js = read('web/inline/admin-1.js');
  assert.match(html, /id="userDetailDialog"/);
  assert.match(html, /data-panel="users"/);
  assert.match(js, /data-user-details/);
  assert.match(js, /admin_search_users_v2/);
  assert.match(js, /admin_get_user_details_v1/);
  assert.match(js, /Account & authentication/);
  assert.match(js, /Learning/);
  assert.match(js, /Teaching/);
});

test('details RPC is server-authorized and excludes authentication secrets', () => {
  const sql = read('supabase/migrations/202610210002_admin_user_details.sql');
  assert.match(sql, /admin_require_capability\('support'\)/);
  assert.match(sql, /security definer/);
  assert.match(sql, /revoke all on function public\.admin_get_user_details_v1/);
  assert.doesNotMatch(sql, /encrypted_password|confirmation_token|recovery_token|access_token|refresh_token/);
  assert.match(sql, /last_sign_in_at/);
  assert.match(sql, /registered_web_role/);
});
