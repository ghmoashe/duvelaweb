'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function log(message) {
  console.log(`[web-contracts] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function expectIncludes(file, content, needle) {
  if (!content.includes(needle)) fail(`${file} is missing: ${needle}`);
}

function checkRegistrationRoleContract() {
  const rolesCode = read('web/duvela-web-roles.js');
  const writesCode = read('web/duvela-web-profile-writes.js');
  const authCode = read('web/index-auth.js');
  const roleAccessCode = read('web/app-role-access.js');
  const onboardingCode = read('web/app-onboarding.js');
  const fixedRoleSql = read('scripts/fixed-registration-roles.sql');
  const migrationSql = read('supabase/migrations/20260814173000_registered_web_role_repair.sql');
  const legacyMigrationSql = read('supabase/migrations/20260814181500_confirm_legacy_registration_role.sql');
  const roleFlagMigrationSql = read('supabase/migrations/20260814183000_sync_registered_role_flags.sql');
  const roleSecurityMigrationSql = read('supabase/migrations/20260814184500_secure_legacy_role_confirmation.sql');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(rolesCode, sandbox, { filename: 'web/duvela-web-roles.js' });
  vm.runInContext(writesCode, sandbox, { filename: 'web/duvela-web-profile-writes.js' });

  const rolesApi = sandbox.window.DuvelaWebRoles;
  const profileWritesApi = sandbox.window.DuvelaWebProfileWrites;
  if (!rolesApi?.pickWebRole || !profileWritesApi?.upsertProfileIdentity) fail('Role APIs were not attached to window.');
  if (!rolesApi?.confirmLegacyRoleIfNeeded) fail('Legacy registration role confirmation API is missing.');
  if (rolesApi.pickWebRole({ registered_web_role: 'teacher', is_teacher: false, is_organizer: false, is_admin: false, last_web_role: 'learner' }, false) !== 'teacher') fail('The immutable registered role must be authoritative.');
  if (rolesApi.pickWebRole({ is_teacher: true, is_organizer: false, is_admin: false, last_web_role: 'learner' }, false) !== 'teacher') fail('Registered teacher must always open Teacher Dashboard.');
  if (rolesApi.pickWebRole({ is_teacher: false, is_organizer: false, is_admin: false, last_web_role: 'teacher' }, false) !== 'learner') fail('Learner must not become a teacher from a stale browser role.');
  if (profileWritesApi.persistBusinessRoleSelection || /submitRoleRequest|request:teacher/.test(roleAccessCode)) fail('The old role-request flow must not be available.');
  expectIncludes('web/index-auth.js', authCode, 'web_role: currentRole');
  expectIncludes('web/index-auth.js', authCode, 'data: { web_role: savedSignupRole }');
  expectIncludes('web/app-onboarding.js', onboardingCode, 'var minStep = 1');
  expectIncludes('web/app-onboarding.js', onboardingCode, 'var roleLocked = true');
  expectIncludes('web/app-onboarding.js', onboardingCode, 'step > minStep');
  expectIncludes('web/app-onboarding.js', onboardingCode, 'step = 1');
  expectIncludes('web/app-onboarding.js', onboardingCode, 'Role is fixed from registration.');
  if (/is_teacher:\s*role\s*===|is_organizer:\s*role\s*===/.test(onboardingCode)) fail('Onboarding must not change the immutable account role.');
  for (const [file, sql] of [['scripts/fixed-registration-roles.sql', fixedRoleSql], ['registration repair migration', migrationSql]]) {
    expectIncludes(file, sql, "raw_user_meta_data ->> 'web_role'");
    expectIncludes(file, sql, 'create or replace function public.assign_initial_web_role()');
    expectIncludes(file, sql, 'create or replace function public.lock_registered_web_role()');
  }
  expectIncludes('registration repair migration', migrationSql, 'registered_web_role');
  expectIncludes('registration repair migration', migrationSql, 'create or replace function public.lock_auth_web_role()');
  expectIncludes('registration repair migration', migrationSql, 'after insert or update of raw_user_meta_data');
  expectIncludes('registration repair migration', migrationSql, 'Duvela users can read own profile');
  expectIncludes('legacy role migration', legacyMigrationSql, 'registered_web_role_confirmed');
  expectIncludes('legacy role migration', legacyMigrationSql, 'public.confirm_legacy_web_role');
  expectIncludes('legacy role migration', legacyMigrationSql, "set_config('duvela.role_assignment', '1', true)");
  expectIncludes('role flag migration', roleFlagMigrationSql, "current_setting('duvela.role_assignment', true)");
  expectIncludes('role flag migration', roleFlagMigrationSql, "is_teacher = registered_web_role = 'teacher'");
  expectIncludes('role security migration', roleSecurityMigrationSql, 'from public');
  expectIncludes('role security migration', roleSecurityMigrationSql, 'to authenticated');
  log('immutable registration role contract: OK');
}

function checkLiveBackendContract() {
  const sql = read('scripts/duvela-web-supabase.sql');
  const livePage = read('web/live-page.js');
  const readme = read('README.md');
  const paymentFunction = read('supabase/functions/live-payment/index.ts');
  const restreamFunction = read('supabase/functions/live-restream/index.ts');

  [
    'create table if not exists public.live_sessions',
    'create table if not exists public.live_participants',
    'create table if not exists public.live_messages',
    'create table if not exists public.live_gifts',
    'create table if not exists public.live_restream_targets',
    'create or replace function public.send_live_gift',
    'grant execute on function public.send_live_gift',
  ].forEach((needle) => expectIncludes('scripts/duvela-web-supabase.sql', sql, needle));

  expectIncludes('web/live-page.js', livePage, ".select('vela_coin_balance')");
  if (livePage.includes('duvela_coin_balance')) fail('LIVE page still references duvela_coin_balance.');
  expectIncludes('web/live-page.js', livePage, "supa.functions.invoke('live-payment'");
  expectIncludes('web/live-page.js', livePage, "supa.functions.invoke('live-restream'");

  expectIncludes('supabase/functions/live-payment/index.ts', paymentFunction, 'send_live_gift');
  expectIncludes('supabase/functions/live-payment/index.ts', paymentFunction, 'SUPABASE_SERVICE_ROLE_KEY');
  expectIncludes('supabase/functions/live-restream/index.ts', restreamFunction, 'live_restream_targets');
  expectIncludes('README.md', readme, 'live-payment');
  expectIncludes('README.md', readme, 'live-restream');

  log('LIVE backend contract: OK');
}

async function main() {
  checkRegistrationRoleContract();
  checkLiveBackendContract();
  log('All web contracts passed.');
}

main().catch((error) => {
  console.error(`[web-contracts] ${error.message}`);
  process.exit(1);
});
