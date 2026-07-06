'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const indexPagePath = path.join(root, 'web', 'index-page.js');
const catalogPath = path.join(root, 'locales', 'web-locales.js');
const legalHtmlPath = path.join(root, 'legal.html');
const legalCatalogPath = path.join(root, 'legal', 'legal-content.js');
const expectedLocaleOrder = [
  'en', 'de', 'es', 'fr', 'it', 'pt', 'nl', 'sv', 'no', 'pl', 'cs', 'sq',
  'tr', 'ru', 'uk', 'kk', 'az', 'uz', 'tg', 'fa', 'ar', 'vi', 'zh', 'ja',
  'ko',
];
const expectedLocales = new Set(expectedLocaleOrder);
const expectedRtlLocales = new Set(['ar', 'fa']);
const errors = [];

function fail(message) {
  errors.push(message);
}

function loadCatalog() {
  const source = fs.readFileSync(catalogPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: catalogPath });
  return { catalog: sandbox.window.DUVELA_WEB_I18N, source };
}

function loadLegalCatalog() {
  const source = fs.readFileSync(legalCatalogPath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: legalCatalogPath });
  return { catalog: sandbox.window.DUVELA_LEGAL, source };
}

function sorted(values) {
  return [...values].sort();
}

function sameValues(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function extractPlaceholders(value) {
  return sorted(value.match(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g) ?? []);
}

function extractTags(value) {
  return value.match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
}

function hasDamagedEncoding(value) {
  if (/[\uFFFD\u0080-\u009F]/u.test(value)) return true;
  if (/(?:\?\s*){3,}/u.test(value)) return true;

  const questionCount = (value.match(/\?/g) ?? []).length;
  if (questionCount >= 3 && questionCount / Math.max(value.length, 1) > 0.08) {
    return true;
  }

  return /(?:Ã.|Â.|â€|ðŸ|Рњ|Р°|Рµ|СЃ|С‚|Ш§|Щ„|ж–|гЃ){2,}/u.test(value);
}

function validateCatalog(catalog, source) {
  if (!catalog || typeof catalog !== 'object') {
    fail('Locale catalog did not attach to window.DUVELA_WEB_I18N.');
    return;
  }

  if (catalog.version !== 1) fail(`Unsupported catalog version: ${catalog.version}`);
  if (catalog.storageKey !== 'duvela.webLang') fail('Unexpected language storage key.');
  if (!Array.isArray(catalog.locales)) fail('catalog.locales must be an array.');
  if (!catalog.base?.en || !catalog.extra?.en) fail('English base and extra dictionaries are required.');
  if (hasDamagedEncoding(source)) fail('The locale catalog source contains damaged encoding.');

  const localeCodes = catalog.locales.map((locale) => locale.code);
  if (new Set(localeCodes).size !== localeCodes.length) fail('Locale metadata contains duplicate codes.');
  if (!sameValues(localeCodes, expectedLocales)) {
    fail(`Locale metadata must contain exactly: ${sorted(expectedLocales).join(', ')}`);
  }
  if (localeCodes.join(',') !== expectedLocaleOrder.join(',')) {
    fail('Locale metadata order must match the shared Hub/Business interface language order.');
  }

  for (const locale of catalog.locales) {
    if (!locale.name?.trim()) fail(`${locale.code}: missing native language name.`);
    if (!locale.flag?.trim()) fail(`${locale.code}: missing flag.`);
    const expectedDirection = expectedRtlLocales.has(locale.code) ? 'rtl' : 'ltr';
    if (locale.dir !== expectedDirection) {
      fail(`${locale.code}: expected direction ${expectedDirection}, got ${locale.dir}.`);
    }
  }

  const dictionaryCodes = new Set([
    ...Object.keys(catalog.base ?? {}),
    ...Object.keys(catalog.extra ?? {}),
  ]);
  if (!sameValues(dictionaryCodes, expectedLocales)) {
    fail('Dictionary locale set does not match the 25 supported locales.');
  }

  const english = Object.assign({}, catalog.base.en, catalog.extra.en);
  const englishKeys = Object.keys(english);

  for (const code of expectedLocales) {
    const dictionary = Object.assign(
      {},
      catalog.base[code] ?? {},
      catalog.extra[code] ?? {},
    );

    for (const key of englishKeys) {
      const value = dictionary[key];
      if (typeof value !== 'string' || !value.trim()) {
        fail(`${code}.${key}: missing or empty translation.`);
        continue;
      }
      if (hasDamagedEncoding(value)) fail(`${code}.${key}: damaged encoding detected.`);

      const expectedPlaceholders = extractPlaceholders(english[key]);
      const actualPlaceholders = extractPlaceholders(value);
      if (!sameValues(actualPlaceholders, expectedPlaceholders)) {
        fail(`${code}.${key}: placeholders do not match English.`);
      }

      const expectedTags = extractTags(english[key]);
      const actualTags = extractTags(value);
      if (JSON.stringify(actualTags) !== JSON.stringify(expectedTags)) {
        fail(`${code}.${key}: HTML fragments do not match English.`);
      }
    }
  }
}

function validateHtml(html, indexPageSource, catalog) {
  const externalScript = '<script src="./locales/web-locales.js"></script>';
  const externalIndex = html.indexOf(externalScript);
  const pageScript = '<script src="./web/index-page.js"></script>';
  const pageScriptIndex = html.indexOf(pageScript, externalIndex + externalScript.length);
  if (externalIndex < 0) fail('index.html does not load locales/web-locales.js.');
  if (pageScriptIndex < externalIndex) fail('Locale catalog must load before the main page script.');

  if (/class="lang-item"\s+data-val=/u.test(html)) {
    fail('Language selector options must be rendered from the locale catalog, not duplicated in HTML.');
  }
  if (!indexPageSource.includes('function renderLanguageMenu()') || !indexPageSource.includes('renderLanguageMenu();')) {
    fail('Language selector is not rendered from the locale catalog.');
  }
  for (const id of ['footPrivacy', 'footImpressum', 'footTerms']) {
    if (new RegExp(`id="${id}"[^>]+href="#"`, 'u').test(html)) {
      fail(`${id} must link to legal.html instead of "#".`);
    }
  }
  if (!indexPageSource.includes('window.DUVELA_CONSENT.init(initialLang);')) {
    fail('Cookie consent is not initialized from the active web language.');
  }

  const mapStart = indexPageSource.indexOf('const I18N_MAP = [');
  const mapEnd = indexPageSource.indexOf('\n  ];', mapStart);
  if (mapStart < 0 || mapEnd < 0) {
    fail('I18N_MAP was not found in web/index-page.js.');
    return;
  }

  const mapSource = indexPageSource.slice(mapStart, mapEnd);
  const usedKeys = new Set(
    [...mapSource.matchAll(/\['[^']+', '([^']+)'(?:, true)?\]/g)].map((match) => match[1]),
  );
  const english = Object.assign({}, catalog.base.en, catalog.extra.en);
  for (const key of usedKeys) {
    if (!english[key]) fail(`I18N_MAP references unknown key: ${key}`);
  }

  try {
    new Function(indexPageSource);
  } catch (error) {
    fail(`web/index-page.js has invalid syntax: ${error.message}`);
  }
}

function validateLegal(legalHtml, legalCatalog, source) {
  if (!legalCatalog || legalCatalog.version !== 1) {
    fail('Invalid DUVELA_LEGAL catalog.');
    return;
  }
  if (hasDamagedEncoding(source)) fail('The legal catalog contains damaged encoding.');
  if (!sameValues(legalCatalog.supportedLocales ?? [], expectedLocales)) {
    fail('Legal catalog locale set does not match the 25 supported locales.');
  }

  const kinds = ['privacy', 'impressum', 'terms'];
  for (const kind of kinds) {
    const localeContent = legalCatalog.content?.[kind];
    if (!localeContent || !sameValues(Object.keys(localeContent), expectedLocales)) {
      fail(`${kind}: locale set does not match the 25 supported locales.`);
      continue;
    }
    for (const code of expectedLocales) {
      const content = localeContent[code];
      if (!content.title?.trim() || !Array.isArray(content.sections) || !content.sections.length) {
        fail(`${kind}.${code}: legal document is empty.`);
      }
    }
  }

  if (!sameValues(Object.keys(legalCatalog.consentTranslations ?? {}), expectedLocales)) {
    fail('Cookie consent locale set does not match the 25 supported locales.');
  }

  const services = legalCatalog.services ?? [];
  if (!services.some((service) => service.id === 'necessary' && service.required)) {
    fail('Cookie catalog must contain the required necessary service.');
  }
  for (const id of ['ga', 'metaPixel', 'youtube']) {
    if (!services.some((service) => service.id === id && !service.required)) {
      fail(`Cookie catalog is missing optional service: ${id}.`);
    }
  }

  for (const script of [
    './locales/web-locales.js',
    './legal/legal-content.js',
    './legal/consent.js',
    './legal/legal-page.js',
  ]) {
    if (!legalHtml.includes(`<script src="${script}"></script>`)) {
      fail(`legal.html does not load ${script}.`);
    }
  }

  for (const relativePath of ['legal/consent.js', 'legal/legal-page.js']) {
    const sourceCode = fs.readFileSync(path.join(root, relativePath), 'utf8');
    try {
      new Function(sourceCode);
    } catch (error) {
      fail(`${relativePath} has invalid syntax: ${error.message}`);
    }
  }
}

try {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const indexPageSource = fs.readFileSync(indexPagePath, 'utf8');
  const { catalog, source } = loadCatalog();
  const legalHtml = fs.readFileSync(legalHtmlPath, 'utf8');
  const { catalog: legalCatalog, source: legalSource } = loadLegalCatalog();
  validateCatalog(catalog, source);
  if (catalog) validateHtml(html, indexPageSource, catalog);
  validateLegal(legalHtml, legalCatalog, legalSource);
} catch (error) {
  fail(error.stack || error.message);
}

if (errors.length) {
  console.error(`i18n check failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('i18n check passed: 25 locales, complete keys, valid encoding and RTL metadata.');
