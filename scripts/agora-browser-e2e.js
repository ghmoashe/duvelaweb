'use strict';

const path = require('path');

const WEB_URL = process.env.DUVELA_WEB_URL || 'http://127.0.0.1:5173';
const SUPABASE_URL = process.env.DUVELA_SUPABASE_URL || 'https://ohtkryanqcnwghcnipsr.supabase.co';
const SUPABASE_ANON_KEY = process.env.DUVELA_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odGtyeWFucWNud2doY25pcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjA1NDEsImV4cCI6MjA4NjM5NjU0MX0.YjPRrv4grr-17PaWqCwwR464rxMJRYI7BDvjMi9gdnU';
const STORAGE_KEY = 'sb-ohtkryanqcnwghcnipsr-auth-token';

const teacherEmail = process.env.DUVELA_TEST_TEACHER_EMAIL;
const teacherPassword = process.env.DUVELA_TEST_TEACHER_PASSWORD;
const learnerEmail = process.env.DUVELA_TEST_LEARNER_EMAIL;
const learnerPassword = process.env.DUVELA_TEST_LEARNER_PASSWORD;

function log(message) {
  console.log(`[agora-browser-e2e] ${message}`);
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {}

  const sibling = path.resolve(__dirname, '..', '..', 'vela academy hub', 'node_modules', 'playwright');
  try {
    return require(sibling);
  } catch {
    throw new Error('Playwright is not installed. Install it or keep the sibling "vela academy hub" node_modules available.');
  }
}

async function signIn(label, email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok || !data?.access_token || !data?.user?.id) {
    throw new Error(`${label} sign-in failed: HTTP ${response.status} ${text}`);
  }
  log(`${label} sign-in: OK`);
  return data;
}

async function authedContext(browser, session) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 860 },
    permissions: ['camera', 'microphone'],
  });
  await context.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEY, value: session });
  return context;
}

async function collectErrors(page, label, errors) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${label}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`));
}

async function main() {
  if (!teacherEmail || !teacherPassword) {
    log('Teacher credentials not set; skipped real browser Agora E2E.');
    log('Set DUVELA_TEST_TEACHER_EMAIL and DUVELA_TEST_TEACHER_PASSWORD.');
    process.exitCode = 2;
    return;
  }

  const { chromium } = loadPlaywright();
  const teacherSession = await signIn('teacher', teacherEmail, teacherPassword);
  const learnerSession = learnerEmail && learnerPassword
    ? await signIn('learner', learnerEmail, learnerPassword)
    : null;

  const browser = await chromium.launch({
    channel: process.env.DUVELA_PLAYWRIGHT_CHANNEL || 'msedge',
    headless: process.env.DUVELA_HEADLESS !== '0',
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const errors = [];

  try {
    const teacherContext = await authedContext(browser, teacherSession);
    const teacherPage = await teacherContext.newPage();
    await collectErrors(teacherPage, 'teacher', errors);
    await teacherPage.goto(`${WEB_URL}/live.html?app=business&mode=host`, { waitUntil: 'networkidle' });
    await teacherPage.locator('#mainAction').click();
    // statusText is localized (en/ru), so accept either variant.
    await teacherPage.waitForFunction(
      () => {
        const text = document.querySelector('#statusText')?.textContent || '';
        return text.includes('Teacher is LIVE') || text.includes('Преподаватель в эфире');
      },
      { timeout: 45000 },
    );
    const shareUrl = await teacherPage.locator('#shareUrl').inputValue({ timeout: 10000 });
    if (!shareUrl || !shareUrl.includes('/live.html?s=')) {
      throw new Error('Teacher live started, but no student share URL was generated.');
    }
    log(`teacher LIVE started: ${shareUrl}`);

    const viewerContext = learnerSession
      ? await authedContext(browser, learnerSession)
      : await browser.newContext({ viewport: { width: 1366, height: 860 } });
    const viewerPage = await viewerContext.newPage();
    await collectErrors(viewerPage, 'viewer', errors);
    await viewerPage.goto(shareUrl, { waitUntil: 'networkidle' });
    // Authenticated viewers auto-connect (the join button is hidden); anonymous
    // viewers need a click. Only click when the button is actually visible.
    if (await viewerPage.locator('#mainAction').isVisible().catch(() => false)) {
      await viewerPage.locator('#mainAction').click().catch(() => {});
    }
    await viewerPage.waitForFunction(
      () => {
        const text = document.querySelector('#statusText')?.textContent || '';
        return text.includes('Watching LIVE') || text.includes('Смотрите эфир');
      },
      { timeout: 60000 },
    );
    log('viewer received Agora LIVE stream.');

    await teacherPage.locator('#endLive').click();
    await teacherPage.waitForFunction(
      () => {
        const text = document.querySelector('#statusText')?.textContent || '';
        return text.includes('LIVE ended') || text.includes('Эфир завершён');
      },
      { timeout: 15000 },
    );
    log('teacher LIVE ended and cleaned up.');

    await viewerContext.close();
    await teacherContext.close();
  } finally {
    await browser.close();
  }

  if (errors.length) {
    throw new Error(`Browser console/page errors:\n${errors.join('\n')}`);
  }

  log('Real browser Agora E2E completed.');
}

main().catch((error) => {
  console.error(`[agora-browser-e2e] ${error.message}`);
  process.exit(1);
});
