const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const media = fs.readFileSync('web/app-feature-media-platform.js', 'utf8');
const css = fs.readFileSync('web/app-media-hub5.css', 'utf8');
const duvi = fs.readFileSync('web/duvi-assistant.js', 'utf8');
const html = fs.readFileSync('app.html', 'utf8');

test('Media Hub uses learner context for honest recommendations', () => {
  assert.match(media, /function learnerContext\(\)/);
  assert.match(media, /function recommendationScore\(item,context\)/);
  assert.match(media, /BASED ON YOUR LANGUAGE AND LEVEL/);
  assert.doesNotMatch(media, /generic newest videos as personalized/i);
});

test('search and metadata-backed filters work together', () => {
  for (const marker of ['ytSearch', 'ytLanguage', 'ytLevel', 'ytTeacher', 'ytCategory', 'ytSort', 'data-media-clear']) assert.ok(media.includes(marker));
  assert.match(media, /x\.description,x\.level,x\.language,x\.category/);
  assert.match(media, /if\(mp\.category\)/);
});

test('cards preserve real metadata and safe image fallbacks', () => {
  assert.ok(media.includes('yt-thumb-fallback'));
  assert.ok(media.includes('loading="lazy"'));
  assert.ok(media.includes("if(x._viewsVerified)"));
  assert.ok(media.includes('x.duration_seconds'));
  assert.ok(media.includes('onerror="this.remove()"'));
});

test('library changes only after a confirmed backend response', () => {
  assert.match(media, /if\(result&&result\.error\)return \{changed:false/);
  assert.match(media, /if\(has\)set\.delete\(normalized\);else set\.add\(normalized\)/);
  assert.match(media, /The item was not saved/);
  assert.ok(media.includes("mp.tab==='library'&&mp.library==='all'"));
});

test('playback records verified native events and keeps actual learning relations', () => {
  assert.match(media, /player\.paused\)return/);
  assert.match(media, /player\.onended/);
  assert.ok(media.includes('item.course_id'));
  assert.ok(media.includes('item.challenge_id'));
  assert.ok(media.includes("preload='metadata'"));
  assert.doesNotMatch(media, /Did you complete this lesson/);
});

test('responsive layout and DUVI fallback are wired into the app', () => {
  assert.ok(html.includes('app-media-hub5.css?v=20261022-mediahub5'));
  assert.ok(html.includes('app-feature-media-platform.js?v=20261022-mediahub5'));
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:600px\)/);
  assert.ok(duvi.includes("const ASSET_ROOT = './web/assets/duvi/'"));
  assert.ok(duvi.includes('DUVI_FALLBACK'));
});
