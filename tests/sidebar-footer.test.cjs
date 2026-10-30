const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('sidebar footer uses the dark sidebar design instead of the old light card', () => {
  const css = read('web/app-inline.css');
  const footer = css.match(/\.side-foot \{[\s\S]*?\n  \}/)?.[0] || '';

  assert.match(footer, /border-top: 1px solid #29414D/);
  assert.match(footer, /background: transparent/);
  assert.match(footer, /color: #E8F2F5/);
  assert.doesNotMatch(footer, /var\(--panel-soft\)/);
});

test('footer controls retain accessible interaction and compact icon sizing', () => {
  const css = read('web/app-inline.css');

  assert.match(css, /\.side-settings-row:hover \{ color: #FFFFFF; background: #244753; \}/);
  assert.match(css, /\.side-settings-row\[aria-current="page"\] \{ color: #FFFFFF; background: #20524C; \}/);
  assert.match(css, /\.side-settings-row:focus-visible \{ outline: 3px solid #70D9B6/);
  assert.match(css, /\.side-settings-row \.nav-icon svg \{ width: 19px; height: 19px; color: #AABFCB; \}/);
});

test('footer language selector is dark, readable and RTL-aware', () => {
  const css = read('web/app-inline.css');
  const profile = read('web/app-feature-profile.js');

  assert.match(css, /\.side-foot \.role-select \{[\s\S]*?background-color: #183743;[\s\S]*?color: #E8F2F5/);
  assert.match(css, /html\[dir="rtl"\] \.side-foot \.role-select/);
  assert.doesNotMatch(profile, /field\.style\.marginTop/);
  assert.match(read('web/app-bootstrap.js'), /event\.target\.closest\('#profileLangSelect, #langSelect'\)[\s\S]*?ctx\.setAppLang\(languageSelect\.value\)/);
});

test('Settings remains a routed active footer action', () => {
  const bootstrap = read('web/app-bootstrap.js');
  const router = read('web/app-router.js');

  assert.match(bootstrap, /action === 'settings'[\s\S]*?ctx\.setView\('settings'\)/);
  assert.match(bootstrap, /action === 'support'[\s\S]*?mailto:info@duvela\.de/);
  assert.match(router, /button\.dataset\.sidebarAction === 'settings' && known === 'settings'/);
  assert.match(router, /button\.setAttribute\('aria-current', 'page'\)/);
});

test('collapsed sidebar is shared by Hub and Business and keeps compact icons', () => {
  const css = read('web/app-inline.css');
  const bootstrap = read('web/app-bootstrap.js');
  assert.match(css, /body\.sidebar-compact \.app\{grid-template-columns:96px minmax\(0,1fr\)\}/);
  assert.match(css, /body\.sidebar-compact \.side-settings-row \.nav-icon svg\{width:20px;height:20px\}/);
  assert.match(css, /body\.sidebar-compact \.side-settings-row\[aria-current="page"\]\{background:#20524C\}/);
  assert.doesNotMatch(css, /body\.business-mode\.sidebar-compact \.app\{grid-template-columns/);
  assert.match(bootstrap, /window\.matchMedia\('\(min-width: 981px\)'\)/);
  assert.match(bootstrap, /localStorage\.setItem\('duvela\.sidebar\.compact', compact \? '1' : '0'\)/);
  assert.match(bootstrap, /sidebarToggle\.setAttribute\('aria-label', label\)/);
  assert.match(read('app.html'), /body\.premium-workspace\.business-mode\.sidebar-compact \.app\{grid-template-columns:96px minmax\(0,1fr\)\}/);
});

test('sidebar footer assets use a cache-busted release marker', () => {
  const html = read('app.html');
  assert.match(html, /app-inline\.css\?v=20261021-learner-wallet1/);
  assert.match(html, /app-bootstrap\.js\?v=20261023-courses5/);
  assert.match(html, /app-router\.js\?v=20261021-student-wallet2/);
  assert.match(html, /app-feature-profile\.js\?v=20261030-accordion/);
});
