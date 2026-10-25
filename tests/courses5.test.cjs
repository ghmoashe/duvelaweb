const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'web/app-courses5.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'web/app-courses5.css'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202610230001_course_marketplace.sql'), 'utf8');
const enrollmentMigration = fs.readFileSync(path.join(root, 'supabase/migrations/202610230002_course_enrollment_availability.sql'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app.html'), 'utf8');

test('learner catalogue loads only published non-test records and audits QA by immutable id', () => {
  assert.match(source, /\.eq\('status', 'active'\)\.eq\('is_test', false\)/);
  assert.match(source, /AUDITED_QA_IDS/);
  assert.match(source, /COURSE_FIELDS_LEGACY/);
  assert.match(source, /select\(COURSE_FIELDS_LEGACY\)/);
  assert.doesNotMatch(source, /title\.includes\(['"]QA/);
  assert.match(migration, /add column if not exists is_test boolean/);
  assert.match(migration, /using \(status = 'active' and is_test = false\)/);
  assert.match(migration, /ff941975-3029-43f4-8bb4-746494f1a4d8/);
  assert.match(migration, /b9b04e70-684f-4274-aa26-bc56f4c70bbf/);
});

test('course discovery uses real learner context and metadata-backed filters', () => {
  for (const marker of ['learnerContext', 'data-lc-filter="language"', 'data-lc-filter="level"', 'data-lc-filter="price"', 'data-lc-filter="format"', 'data-lc-saved']) assert.ok(source.includes(marker), marker);
  assert.match(source, /matchesContext/);
  assert.match(source, /Recommended for your level/);
  assert.match(source, /function formatKey\(course\)/);
  assert.match(source, /<option value="online"/);
  assert.match(source, /<option value="offline"/);
  assert.doesNotMatch(source, /selectOptions\(formats/);
});

test('cards expose teachers, course facts, safe covers and adaptive actions', () => {
  for (const marker of ['data-course-teacher', 'lesson_count', 'delivery_mode', 'cover_image_url', 'Enrollment pending', 'Continue Learning', 'Payment unavailable']) assert.ok(source.includes(marker), marker);
  assert.match(source, /onerror=/);
  assert.doesNotMatch(source, /rating:\s*[45]/);
});

test('saved courses change only after a successful backend response', () => {
  assert.match(migration, /create table if not exists public\.course_saves/);
  assert.match(source, /if \(result\.error\) throw result\.error/);
  assert.match(source, /state\.savedCourseIds\.(?:delete|add)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(.*saved.*courses/i);
});

test('course detail keeps real curriculum, schedule, and server-verified enrollment', () => {
  for (const marker of ["from('course_lessons')", "from('class_sessions')", 'Course overview', 'Learning outcomes', 'Curriculum', 'Schedule', 'Instructor', 'Related courses', 'course_enrollment_summary', 'enroll_free_course']) assert.ok(source.includes(marker), marker);
  assert.match(source, /hasPublicDescription/);
  assert.match(source, /Availability needs verification/);
  assert.match(source, /Course payment is not configured\. No enrollment was created/);
  assert.match(enrollmentMigration, /create or replace function public\.course_enrollment_summary/);
  assert.match(enrollmentMigration, /create or replace function public\.enroll_free_course/);
  assert.match(enrollmentMigration, /for update/);
});

test('course detail keeps keyboard focus in the modal and exposes a single scroll surface', () => {
  for (const marker of ['detailReturnFocus', "event.key === 'Escape'", "event.key !== 'Tab'", 'aria-hidden']) assert.ok(source.includes(marker), marker);
  assert.match(css, /#courseOverlay:has\(\.lcd-page\) \.overlay-body\{min-height:0;overflow-x:hidden;overflow-y:auto/);
  assert.match(css, /\.lcd-layout\{grid-template-columns:minmax\(0,7fr\) minmax\(250px,3fr\)/);
});

test('responsive marketplace is wired to the existing app', () => {
  assert.match(html, /app-courses5\.css\?v=20261023-courses5f/);
  assert.match(html, /app-courses5\.js\?v=20261023-courses5f/);
  assert.match(css, /grid-template-columns:repeat\(3/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(max-width:520px\).*grid-template-columns:1fr/s);
});
