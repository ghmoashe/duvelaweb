'use strict';

const crypto = require('crypto');

const SUPABASE_URL = process.env.DUVELA_SUPABASE_URL || 'https://ohtkryanqcnwghcnipsr.supabase.co';
const SUPABASE_ANON_KEY = process.env.DUVELA_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU';

const teacherEmail = process.env.DUVELA_TEST_TEACHER_EMAIL;
const teacherPassword = process.env.DUVELA_TEST_TEACHER_PASSWORD;
const learnerEmail = process.env.DUVELA_TEST_LEARNER_EMAIL;
const learnerPassword = process.env.DUVELA_TEST_LEARNER_PASSWORD;

function log(message) {
  console.log(`[web-backend-e2e] ${message}`);
}

function fail(message) {
  throw new Error(message);
}

async function request(path, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { data, response, text };
}

async function expectOk(label, promise) {
  const result = await promise;
  if (!result.response.ok) {
    fail(`${label} failed: HTTP ${result.response.status} ${result.text}`);
  }
  log(`${label}: OK`);
  return result.data;
}

async function expectStatus(label, promise, allowedStatuses) {
  const result = await promise;
  if (!allowedStatuses.includes(result.response.status)) {
    fail(`${label} expected ${allowedStatuses.join('/')} got HTTP ${result.response.status}: ${result.text}`);
  }
  log(`${label}: HTTP ${result.response.status}`);
  return result;
}

async function signIn(label, email, password) {
  const data = await expectOk(label, request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: { email, password },
  }));
  if (!data?.access_token || !data?.user?.id) fail(`${label} did not return an access token.`);
  return data;
}

function agoraUid(userId) {
  const digest = crypto.createHash('sha256').update(userId).digest();
  return (digest.readUInt32BE(0) % 2147483646) + 1;
}

async function getProfile(token, userId) {
  const rows = await expectOk('profile select', request(
    `/rest/v1/profiles?select=id,is_teacher,is_organizer,full_name,email&id=eq.${encodeURIComponent(userId)}`,
    { token },
  ));
  return Array.isArray(rows) ? rows[0] : null;
}

async function createLiveSession(token, user) {
  const channelName = `duvela-web-e2e-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const payload = {
    channel_name: channelName,
    ended_at: null,
    heartbeat_at: now,
    is_private: false,
    level: 'B1',
    price_per_minute: 0,
    started_at: now,
    status: 'live',
    teacher_id: user.id,
    teacher_name: user.user_metadata?.full_name || user.email || 'Duvela web test',
    topic: 'Web Agora E2E test',
  };
  const rows = await expectOk('teacher live_sessions insert', request('/rest/v1/live_sessions?select=*', {
    method: 'POST',
    token,
    headers: { Prefer: 'return=representation' },
    body: payload,
  }));
  const session = Array.isArray(rows) ? rows[0] : null;
  if (!session?.id || session.channel_name !== channelName) fail('live_sessions insert did not return the created session.');
  return session;
}

async function updateLiveSessionEnded(token, sessionId) {
  await expectOk('teacher live_sessions cleanup', request(
    `/rest/v1/live_sessions?id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: 'PATCH',
      token,
      headers: { Prefer: 'return=minimal' },
      body: { status: 'ended', ended_at: new Date().toISOString() },
    },
  ));
}

async function invokeAgoraToken(label, token, channelName, uid, role) {
  const data = await expectOk(label, request('/functions/v1/agora-token', {
    method: 'POST',
    token,
    body: { channelName, uid, role, ttlSeconds: 60 },
  }));
  if (!data?.token || data.channelName !== channelName || data.uid !== uid) {
    fail(`${label} returned an invalid token payload.`);
  }
  return data;
}

async function runPublicChecks() {
  await expectStatus('agora-token requires auth', request('/functions/v1/agora-token', {
    method: 'POST',
    body: { channelName: 'duvela-check', uid: 123, role: 'publisher', ttlSeconds: 60 },
  }), [401]);
  await expectStatus('notify-course-enrollment endpoint exists', request('/functions/v1/notify-course-enrollment', {
    method: 'POST',
    body: {},
  }), [400, 401]);
}

async function main() {
  await runPublicChecks();

  if (!teacherEmail || !teacherPassword) {
    log('Teacher credentials not set; skipped authenticated RLS and Agora token E2E.');
    log('Set DUVELA_TEST_TEACHER_EMAIL and DUVELA_TEST_TEACHER_PASSWORD to run the full backend test.');
    process.exitCode = 2;
    return;
  }

  const teacher = await signIn('teacher sign-in', teacherEmail, teacherPassword);
  const teacherProfile = await getProfile(teacher.access_token, teacher.user.id);
  if (!teacherProfile) fail('Teacher profile row was not found.');
  if (!teacherProfile.is_teacher && !teacherProfile.is_organizer) {
    fail('Teacher test account is not allowed to host. Set profiles.is_teacher or profiles.is_organizer to true.');
  }

  let session = null;
  try {
    session = await createLiveSession(teacher.access_token, teacher.user);
    await invokeAgoraToken(
      'teacher agora publisher token',
      teacher.access_token,
      session.channel_name,
      agoraUid(teacher.user.id),
      'publisher',
    );

    if (learnerEmail && learnerPassword) {
      const learner = await signIn('learner sign-in', learnerEmail, learnerPassword);
      const rows = await expectOk('learner live_sessions select', request(
        `/rest/v1/live_sessions?select=id,channel_name,status,teacher_name&id=eq.${encodeURIComponent(session.id)}`,
        { token: learner.access_token },
      ));
      if (!Array.isArray(rows) || rows[0]?.id !== session.id) fail('Learner could not read the live session.');
      await invokeAgoraToken(
        'learner agora subscriber token',
        learner.access_token,
        session.channel_name,
        agoraUid(learner.user.id),
        'subscriber',
      );
    } else {
      log('Learner credentials not set; skipped learner select/subscriber token check.');
    }
  } finally {
    if (session?.id) await updateLiveSessionEnded(teacher.access_token, session.id);
  }

  log('Full backend RLS + Agora token E2E completed.');
}

main().catch((error) => {
  console.error(`[web-backend-e2e] ${error.message}`);
  process.exit(1);
});
