const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../web/app-courses4.js'), 'utf8');
const sandbox = { window: {}, localStorage: { getItem() { return null; }, setItem() {} }, CustomEvent: function () {} };
vm.runInNewContext(source, sandbox);
const helpers = sandbox.window.DuvelaCourses4.__test;

const courses = [
  { title: 'German A2', language: 'German', level: 'A2', status: 'active', price: 0, created_at: '2026-02-01', studentCount: 4 },
  { title: 'English B1', language: 'English', level: 'B1', status: 'draft', price: 25, created_at: '2026-03-01', studentCount: 2 },
  { title: 'German C1', language: 'German', level: 'C1', status: 'archived', price: 40, created_at: '2026-01-01', studentCount: 9 }
];

test('normalizes active courses as published', () => {
  assert.equal(helpers.statusKey('active'), 'published');
  assert.equal(helpers.statusKey('draft'), 'draft');
});

test('filters by search, status, price, language and level', () => {
  assert.equal(helpers.filterCourses(courses, { query: 'German', status: 'all', price: 'all', language: '', level: '' }).length, 2);
  assert.equal(helpers.filterCourses(courses, { query: '', status: 'published', price: 'free', language: 'German', level: 'A2' }).length, 1);
  assert.equal(helpers.filterCourses(courses, { query: '', status: 'draft', price: 'paid', language: 'English', level: 'B1' }).length, 1);
});

test('sorts by newest, title and enrollment count', () => {
  assert.equal(helpers.sortCourses(courses, 'date')[0].title, 'English B1');
  assert.equal(helpers.sortCourses(courses, 'title')[0].title, 'English B1');
  assert.equal(helpers.sortCourses(courses, 'enrollment')[0].title, 'German C1');
});

test('treats null and zero prices as free', () => {
  assert.equal(helpers.isFree({ price: null }), true);
  assert.equal(helpers.isFree({ price: 0 }), true);
  assert.equal(helpers.isFree({ price: 9 }), false);
});
