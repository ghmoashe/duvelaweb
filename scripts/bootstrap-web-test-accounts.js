'use strict';

const SUPABASE_URL = process.env.DUVELA_SUPABASE_URL || 'https://ohtkryanqcnwghcnipsr.supabase.co';
const SERVICE_ROLE_KEY = process.env.DUVELA_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.DUVELA_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU';

const teacherEmail = process.env.DUVELA_TEST_TEACHER_EMAIL || 'duvela.web.teacher@example.com';
const teacherPassword = process.env.DUVELA_TEST_TEACHER_PASSWORD || 'DuvelaTeacher123!';
const learnerEmail = process.env.DUVELA_TEST_LEARNER_EMAIL || 'duvela.web.learner@example.com';
const learnerPassword = process.env.DUVELA_TEST_LEARNER_PASSWORD || 'DuvelaLearner123!';

function fail(message) {
  throw new Error(message);
}

function log(message) {
  console.log(`[bootstrap-web-test-accounts] ${message}`);
}

async function request(path, { method = 'GET', body, headers = {}, useServiceRole = false } = {}) {
  const token = useServiceRole ? SERVICE_ROLE_KEY : ANON_KEY;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data, text };
}

async function signIn(email, password) {
  const result = await request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  });
  if (!result.response.ok || !result.data?.user?.id) {
    fail(`Could not sign in with ${email}. Check the password or delete/recreate the user. HTTP ${result.response.status}: ${result.text}`);
  }
  return result.data;
}

async function createAdminUser(email, password, userMetadata) {
  const result = await request('/auth/v1/admin/users', {
    method: 'POST',
    useServiceRole: true,
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    },
  });
  if (result.response.ok && result.data?.id) {
    log(`created auth user: ${email}`);
    return result.data;
  }
  if (result.response.status === 422 || result.text.toLowerCase().includes('already')) {
    log(`auth user already exists: ${email}`);
    const session = await signIn(email, password);
    return session.user;
  }
  fail(`Could not create auth user ${email}. HTTP ${result.response.status}: ${result.text}`);
}

async function upsertProfile(payload) {
  const result = await request('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    useServiceRole: true,
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: payload,
  });
  if (!result.response.ok) {
    fail(`Could not upsert profile ${payload.email || payload.id}. HTTP ${result.response.status}: ${result.text}`);
  }
  return Array.isArray(result.data) ? result.data[0] : result.data;
}

async function main() {
  if (!SERVICE_ROLE_KEY) {
    fail('Set DUVELA_SUPABASE_SERVICE_ROLE_KEY before running this bootstrap.');
  }

  const teacherUser = await createAdminUser(teacherEmail, teacherPassword, { full_name: 'Duvela Web Teacher' });
  const learnerUser = await createAdminUser(learnerEmail, learnerPassword, { full_name: 'Duvela Web Learner' });
  const now = new Date().toISOString();

  await upsertProfile({
    id: teacherUser.id,
    email: teacherEmail,
    full_name: 'Duvela Web Teacher',
    is_teacher: true,
    is_organizer: false,
    requested_role: 'teacher',
    role_request_status: 'approved',
    requested_role_at: now,
    last_web_role: 'teacher',
    updated_at: now,
  });

  await upsertProfile({
    id: learnerUser.id,
    email: learnerEmail,
    full_name: 'Duvela Web Learner',
    is_teacher: false,
    is_organizer: false,
    requested_role: null,
    role_request_status: 'none',
    last_web_role: 'learner',
    updated_at: now,
  });

  console.log('');
  console.log('Use these env vars for backend and browser E2E:');
  console.log(`DUVELA_TEST_TEACHER_EMAIL=${teacherEmail}`);
  console.log(`DUVELA_TEST_TEACHER_PASSWORD=${teacherPassword}`);
  console.log(`DUVELA_TEST_LEARNER_EMAIL=${learnerEmail}`);
  console.log(`DUVELA_TEST_LEARNER_PASSWORD=${learnerPassword}`);
}

main().catch((error) => {
  console.error(`[bootstrap-web-test-accounts] ${error.message}`);
  process.exit(1);
});
