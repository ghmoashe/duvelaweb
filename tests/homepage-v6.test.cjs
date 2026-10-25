const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('homepage ships the optimized real product experience', () => {
  const html = read('index.html');
  assert.match(html, /assets\/product\/duvela-live-duel-en\.jpg/);
  assert.match(html, /assets\/product\/duvela-live-duel-en-480\.webp/);
  assert.match(html, /assets\/product\/duvela-logo-480\.webp/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /\.hero \.h-anim \{ opacity:1; animation:none/);
  assert.doesNotMatch(html, /Interface preview · sample data/);
  assert.doesNotMatch(html, /web\/vendor\/lucide\.js/);
  assert.doesNotMatch(html, /locales\/(web-locales|landing-2026-copy|landing-2026-auto)\.js/);
  assert.doesNotMatch(html, /<script[^>]+(?:supabase-js-v2|index-auth|index-public-data|duvi-assistant)\.js/);
  assert.match(html, /legal\/consent-content\.js/);
  assert.ok(fs.statSync(path.join(root, 'assets/product/duvela-live-duel-en.jpg')).size < 100000);
  assert.ok(fs.statSync(path.join(root, 'assets/product/duvela-live-duel-en-480.webp')).size < 25000);
  assert.ok(fs.statSync(path.join(root, 'assets/product/duvela-logo-480.webp')).size < 20000);
});

test('heavy homepage services load only when the visitor needs them', () => {
  const page = read('web/index-page.js');
  assert.match(page, /function ensureAuth\(\)/);
  assert.match(page, /function ensurePublicData\(\)/);
  assert.match(page, /IntersectionObserver/);
  assert.match(page, /pointerdown.*ensureAssistant/);
});

test('consent translations use the compact generated bundle', () => {
  const sandbox = { window: {} };
  vm.runInNewContext(read('legal/consent-content.js'), sandbox);
  assert.equal(sandbox.window.DUVELA_LEGAL.supportedLocales.length, 34);
  assert.ok(sandbox.window.DUVELA_LEGAL.consentTranslations.en.consentModal.title);
  assert.ok(fs.statSync(path.join(root, 'legal/consent-content.js')).size < 50000);
});

test('homepage locale bundle is complete for every supported language', () => {
  const sandbox = {
    window: { location: { search: '' } },
    URLSearchParams,
    navigator: { language: 'en' },
    localStorage: { getItem: () => null },
    Promise,
  };
  vm.runInNewContext(read('locales/homepage-locales.js'), sandbox);
  const catalog = sandbox.window.DUVELA_WEB_I18N;
  assert.equal(catalog.locales.length, 34);
  for (const { code, dir } of catalog.locales) {
    assert.ok(['ltr', 'rtl'].includes(dir));
    if (code !== 'en') vm.runInNewContext(read(`locales/homepage/${code}.js`), sandbox);
    for (const key of ['metaTitle', 'metaDescription', 'heroTitle', 'heroSub', 'productShowcaseTitle', 'faqTitle']) {
      assert.equal(typeof catalog.base[code][key], 'string', `${code}.${key}`);
      assert.ok(catalog.base[code][key].trim().length > 0, `${code}.${key}`);
    }
  }
  assert.ok(fs.statSync(path.join(root, 'locales/homepage-locales.js')).size < 25000);
});

test('SEO discovery files include canonical homepage locales and protect private surfaces', () => {
  const sitemap = read('sitemap.xml');
  const robots = read('robots.txt');
  assert.equal((sitemap.match(/xhtml:link rel="alternate"/g) || []).length, 35);
  assert.match(sitemap, /hreflang="x-default"/);
  assert.match(robots, /Sitemap: https:\/\/www\.vela\.cafe\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/admin\.html/);
  assert.match(robots, /Disallow: \/app\.html/);
});

test('cookie analytics remains opt-in', () => {
  const html = read('index.html');
  const consent = read('legal/consent.js');
  assert.doesNotMatch(html, /_vercel\/(insights|speed-insights)\/script\.js/);
  assert.match(consent, /if \(!consent\?\.ga\) return/);
  assert.match(consent, /saveConsent\(stateFor\(false\)\)/);
});
