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

async function checkRoleRequestContract() {
  const rolesCode = read('web/duvela-web-roles.js');
  const writesCode = read('web/duvela-web-profile-writes.js');
  const sandbox = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(rolesCode, sandbox, { filename: 'web/duvela-web-roles.js' });
  vm.runInContext(writesCode, sandbox, { filename: 'web/duvela-web-profile-writes.js' });

  const rolesApi = sandbox.window.DuvelaWebRoles;
  const profileWritesApi = sandbox.window.DuvelaWebProfileWrites;
  if (!rolesApi?.isRoleRequestable || !profileWritesApi?.persistBusinessRoleSelection) {
    fail('Role APIs were not attached to window.');
  }

  const writes = [];
  const supa = {
    from(table) {
      if (table !== 'profiles') fail(`Unexpected table write: ${table}`);
      return {
        update(patch) {
          writes.push(patch);
          return {
            eq(column, value) {
              if (column !== 'id' || value !== 'user-1') fail('Role request update did not target the current user.');
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };

  const teacherResult = await profileWritesApi.persistBusinessRoleSelection(supa, rolesApi, {
    userId: 'user-1',
    targetRole: 'teacher',
    profile: {
      is_admin: false,
      is_teacher: false,
      is_organizer: false,
    },
    now: '2026-07-13T00:00:00.000Z',
  });
  const patch = writes[0];
  if (!teacherResult.requested || teacherResult.approved) fail('Teacher role selection must create a pending request, not approval.');
  if (patch.requested_role !== 'teacher') fail('Teacher request did not persist requested_role.');
  if (patch.role_request_status !== 'pending') fail('Teacher request did not persist pending status.');
  if (patch.requested_role_at !== '2026-07-13T00:00:00.000Z') fail('Teacher request did not persist requested_role_at.');
  if ('is_teacher' in patch || 'is_organizer' in patch || 'is_admin' in patch) {
    fail('Browser role request attempted to write privileged profile flags.');
  }

  const adminResult = await profileWritesApi.persistBusinessRoleSelection(supa, rolesApi, {
    userId: 'user-1',
    targetRole: 'admin',
    profile: { is_admin: false },
    now: '2026-07-13T00:00:00.000Z',
  });
  if (adminResult.requested || adminResult.patch) fail('Browser must not create admin role requests.');

  log('role request contract: OK');
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
  await checkRoleRequestContract();
  checkLiveBackendContract();
  log('All web contracts passed.');
}

main().catch((error) => {
  console.error(`[web-contracts] ${error.message}`);
  process.exit(1);
});
