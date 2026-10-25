'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('index.html');
const consent = read('legal/consent.js');
const consentBootstrap = read('web/consent-bootstrap.js');
const homepage = read('web/homepage-v6.js');
const i18n = read('web/index-i18n.js');
const sitemap = read('sitemap.xml');
const localeBundle = read('locales/homepage-locales.js');

const jsonLdBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert(jsonLdBlocks.length > 0, 'Homepage must include JSON-LD.');
jsonLdBlocks.forEach((match) => JSON.parse(match[1]));

const alternates = [...html.matchAll(/rel="alternate" hreflang="([^"]+)"/g)].map((match) => match[1]);
assert(alternates.includes('x-default'), 'Homepage must expose an x-default alternate.');
assert(alternates.length >= 35, 'Homepage must expose all supported locale alternates.');
assert(i18n.includes("new URLSearchParams(window.location.search).get('lang')"), 'Locale query routing is required.');
const localeSandbox = {
  window: { location: { search: '' } },
  URLSearchParams,
  navigator: { language: 'en' },
  localStorage: { getItem: () => null },
  Promise,
};
vm.runInNewContext(localeBundle, localeSandbox);
const localeCatalog = localeSandbox.window.DUVELA_WEB_I18N;
assert.strictEqual(localeCatalog.locales.length, 34, 'Optimized homepage bundle must include all 34 locales.');
for (const { code } of localeCatalog.locales) {
  if (code !== 'en') {
    vm.runInNewContext(read(`locales/homepage/${code}.js`), localeSandbox);
  }
  for (const key of ['metaTitle', 'metaDescription', 'heroTitle', 'heroSub', 'productShowcaseTitle', 'faqTitle']) {
    assert(localeCatalog.base[code]?.[key], `Homepage locale ${code} is missing ${key}.`);
  }
}
assert(fs.statSync(path.join(root, 'locales/homepage-locales.js')).size < 25000, 'Homepage locale bootstrap must remain below 25 KB.');
assert(i18n.includes('localeLoader.ensure'), 'Homepage must lazy-load non-English locale dictionaries.');
assert(!html.includes('locales/web-locales.js'), 'Homepage must use the optimized locale bundle.');
assert(!html.includes('web/vendor/lucide.js'), 'Homepage must not download the full Lucide runtime.');
assert(!/<script[^>]+(?:supabase-js-v2|index-auth|index-public-data|duvi-assistant)\.js/.test(html), 'Heavy services must be loaded on demand.');
assert(html.includes('legal/consent-content.js'), 'Homepage must use the compact consent locale bundle.');
assert(fs.statSync(path.join(root, 'legal/consent-content.js')).size < 50000, 'Consent locale bundle must remain below 50 KB.');

assert(!html.includes('src="/_vercel/insights/script.js"'), 'Analytics must not load before consent.');
assert(!html.includes('src="/_vercel/speed-insights/script.js"'), 'Speed Insights must not load before consent.');
assert(consent.includes('if (!consent?.ga'), 'Analytics loading must be gated by consent.');
assert(consent.includes("speed.src = '/_vercel/speed-insights/script.js'"), 'Consent-gated Core Web Vitals collection is required.');
assert(consentBootstrap.includes('DUVELA_CONSENT.init(locale)'), 'Consent UI must initialize before application services.');
assert(consent.includes('saveConsent(stateFor(false))'), 'Reject optional must persist a declined state.');
assert(homepage.includes('analyticsAllowed()'), 'Conversion events must use the consent guard.');
assert(homepage.includes("track('home_start_learning'" ) === false, 'Events should be delegated through data attributes.');
assert(homepage.includes('home_start_learning'), 'Learner conversion event is missing.');
assert(homepage.includes('home_start_teaching'), 'Teacher conversion event is missing.');

assert(html.includes('class="skip-link"'), 'Skip link is required.');
assert(html.includes(':focus-visible'), 'Visible keyboard focus is required.');
assert(html.includes('aria-controls="productTabPanel"'), 'Product tabs must expose their controlled panel.');
assert(homepage.includes("event.key === 'ArrowRight'"), 'Product tabs need keyboard navigation.');
assert(consent.includes("event.key === 'Escape'"), 'Consent dialog must close with Escape.');

assert(html.includes('preload="none"'), 'Homepage video must avoid eager media loading.');
assert(homepage.includes("image.loading = 'lazy'"), 'Below-the-fold images must be lazy loaded.');
assert(html.includes('prefers-reduced-motion:reduce'), 'Reduced motion preference must be respected.');
assert(html.includes('assets/product/duvela-live-duel-en.jpg'), 'Hero must use the real English DUVELA product screen.');
assert(fs.statSync(path.join(root, 'assets/product/duvela-live-duel-en.jpg')).size < 100000, 'Hero product screen must remain below 100 KB.');
assert(fs.statSync(path.join(root, 'assets/product/duvela-live-duel-en-480.webp')).size < 25000, 'Responsive hero screen must remain below 25 KB.');
assert(fs.statSync(path.join(root, 'assets/product/duvela-logo-480.webp')).size < 20000, 'Responsive logo must remain below 20 KB.');
assert(!html.includes('fonts.googleapis.com'), 'Homepage must self-host Inter without a render-blocking Google Fonts stylesheet.');
assert(html.includes('.hero .h-anim { opacity:1; animation:none'), 'Above-the-fold content must render without delayed entrance animation.');
assert((sitemap.match(/xhtml:link rel="alternate"/g) || []).length >= 35, 'Sitemap must expose every locale alternate.');

console.log('[homepage-readiness] SEO, localization, consent, analytics, accessibility and performance contracts passed.');
