#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const webLocalesPath = path.join(root, 'locales', 'web-locales.js');
const legalPath = path.join(root, 'legal', 'legal-content.js');
const model = process.env.OPENAI_TRANSLATION_MODEL || 'gpt-4.1-mini';
const apiKey = process.env.OPENAI_API_KEY;
const targets = ['da', 'fi', 'bg', 'bs', 'hr', 'mk', 'ro', 'sr', 'sl'];
const localeNames = {
  da: 'Danish',
  fi: 'Finnish',
  bg: 'Bulgarian',
  bs: 'Bosnian',
  hr: 'Croatian',
  mk: 'Macedonian',
  ro: 'Romanian',
  sr: 'Serbian',
  sl: 'Slovenian',
};

if (!apiKey) {
  throw new Error('OPENAI_API_KEY is required.');
}

function readCatalog(filePath, globalName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return { source, data: sandbox.window[globalName] };
}

function extractPlaceholders(value) {
  return [...String(value).matchAll(/\{[a-zA-Z][a-zA-Z0-9_]*\}/g)].map((match) => match[0]).sort();
}

function extractTags(value) {
  return String(value).match(/<\/?[a-zA-Z][^>]*>/g) ?? [];
}

function sameArray(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function ensureStringMapShape(translated, english, label) {
  const translatedKeys = Object.keys(translated).sort();
  const englishKeys = Object.keys(english).sort();
  if (!sameArray(translatedKeys, englishKeys)) {
    throw new Error(`${label}: keys do not match.`);
  }
  for (const key of englishKeys) {
    if (typeof translated[key] !== 'string' || !translated[key].trim()) {
      throw new Error(`${label}.${key}: missing translated string.`);
    }
    if (!sameArray(extractPlaceholders(translated[key]), extractPlaceholders(english[key]))) {
      throw new Error(`${label}.${key}: placeholders do not match.`);
    }
    if (!sameArray(extractTags(translated[key]), extractTags(english[key]))) {
      throw new Error(`${label}.${key}: HTML tags do not match.`);
    }
  }
}

function ensureNestedShape(translated, english, label) {
  if (Array.isArray(english)) {
    if (!Array.isArray(translated) || translated.length !== english.length) {
      throw new Error(`${label}: array shape mismatch.`);
    }
    translated.forEach((value, index) => ensureNestedShape(value, english[index], `${label}[${index}]`));
    return;
  }
  if (english && typeof english === 'object') {
    if (!translated || typeof translated !== 'object' || Array.isArray(translated)) {
      throw new Error(`${label}: object shape mismatch.`);
    }
    const englishKeys = Object.keys(english).sort();
    const translatedKeys = Object.keys(translated).sort();
    if (!sameArray(englishKeys, translatedKeys)) {
      throw new Error(`${label}: object keys do not match.`);
    }
    for (const key of englishKeys) {
      ensureNestedShape(translated[key], english[key], `${label}.${key}`);
    }
    return;
  }
  if (typeof english === 'string') {
    if (typeof translated !== 'string' || !translated.trim()) {
      throw new Error(`${label}: missing translated string.`);
    }
  }
}

async function openAIJson(system, user, attempt = 0) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    if (attempt < 5 && [408, 409, 429, 500, 502, 503, 504].includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
      return openAIJson(system, user, attempt + 1);
    }
    throw new Error(`OpenAI API failed: HTTP ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI API returned empty content.');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Could not parse OpenAI JSON: ${error.message}`);
  }
}

async function translateStringMap(locale, english, label) {
  const translated = await openAIJson(
    [
      `Translate product UI copy from English to ${localeNames[locale]} (${locale}).`,
      'Return only a JSON object with exactly the same keys and translated string values.',
      'Preserve placeholders like {count} or {role} exactly.',
      'Preserve HTML tags and entities like &amp; exactly.',
      'Keep product names and labels such as DUVELA, CEFR, telc, App Store, Google Play, YouTube, LIVE, AI, XP, A1, A2, B1, B2, C1, C2.',
      'Keep tone concise and natural for UI/marketing copy.',
    ].join(' '),
    JSON.stringify(english),
  );
  ensureStringMapShape(translated, english, label);
  return translated;
}

async function translateNested(locale, english, label) {
  const translated = await openAIJson(
    [
      `Translate this legal/content JSON from English to ${localeNames[locale]} (${locale}).`,
      'Return only JSON with exactly the same structure and keys.',
      'Translate all human-readable strings, including titles, sections, paragraphs, and list items.',
      'Preserve emails, URLs, placeholders, numbers, and product or company names where appropriate.',
      'Do not remove or merge fields. Do not add explanations.',
    ].join(' '),
    JSON.stringify(english),
  );
  ensureNestedShape(translated, english, label);
  return translated;
}

function chunkObject(object, size) {
  const entries = Object.entries(object);
  const chunks = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(Object.fromEntries(entries.slice(index, index + size)));
  }
  return chunks;
}

async function buildWebTranslations(webCatalog) {
  const english = { ...webCatalog.base.en, ...webCatalog.extra.en };
  const chunks = chunkObject(english, 40);
  const result = {};

  for (const locale of targets) {
    const translated = {};
    for (let index = 0; index < chunks.length; index += 1) {
      process.stderr.write(`[web] ${locale} chunk ${index + 1}/${chunks.length}\n`);
      Object.assign(
        translated,
        await translateStringMap(locale, chunks[index], `web.${locale}.chunk${index + 1}`),
      );
    }
    result[locale] = translated;
  }

  return result;
}

async function buildLegalTranslations(legalCatalog) {
  const result = {
    privacy: {},
    impressum: {},
    terms: {},
    consentTranslations: {},
  };

  for (const locale of targets) {
    process.stderr.write(`[legal] ${locale} privacy\n`);
    result.privacy[locale] = await translateNested(locale, legalCatalog.content.privacy.en, `legal.privacy.${locale}`);
    process.stderr.write(`[legal] ${locale} impressum\n`);
    result.impressum[locale] = await translateNested(locale, legalCatalog.content.impressum.en, `legal.impressum.${locale}`);
    process.stderr.write(`[legal] ${locale} terms\n`);
    result.terms[locale] = await translateNested(locale, legalCatalog.content.terms.en, `legal.terms.${locale}`);
    process.stderr.write(`[legal] ${locale} consent\n`);
    result.consentTranslations[locale] = await translateNested(locale, legalCatalog.consentTranslations.en, `legal.consent.${locale}`);
  }

  return result;
}

function upsertBlock(source, beginMarker, endMarker, block, insertBefore) {
  const wrapped = `${beginMarker}\n${block}\n${endMarker}\n\n`;
  const pattern = new RegExp(`${beginMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\\n`, 'm');
  if (pattern.test(source)) {
    return source.replace(pattern, wrapped);
  }
  const markerIndex = source.indexOf(insertBefore);
  if (markerIndex < 0) {
    throw new Error(`Insertion marker not found: ${insertBefore}`);
  }
  return source.slice(0, markerIndex) + wrapped + source.slice(markerIndex);
}

function writeWebTranslations(source, translations) {
  const block = `  Object.assign(global.DUVELA_WEB_I18N.extra, ${JSON.stringify(translations, null, 2).replace(/\n/g, '\n  ')});`;
  return upsertBlock(
    source,
    '  // BEGIN codex generated locale translations',
    '  // END codex generated locale translations',
    block,
    '  for (const code of Object.keys(global.DUVELA_WEB_I18N.extra)) {',
  );
}

function writeLegalTranslations(source, translations) {
  const block = [
    `  Object.assign(global.DUVELA_LEGAL.content.privacy, ${JSON.stringify(translations.privacy, null, 2).replace(/\n/g, '\n  ')});`,
    `  Object.assign(global.DUVELA_LEGAL.content.impressum, ${JSON.stringify(translations.impressum, null, 2).replace(/\n/g, '\n  ')});`,
    `  Object.assign(global.DUVELA_LEGAL.content.terms, ${JSON.stringify(translations.terms, null, 2).replace(/\n/g, '\n  ')});`,
    `  Object.assign(global.DUVELA_LEGAL.consentTranslations, ${JSON.stringify(translations.consentTranslations, null, 2).replace(/\n/g, '\n  ')});`,
  ].join('\n');
  return upsertBlock(
    source,
    '  // BEGIN codex generated legal translations',
    '  // END codex generated legal translations',
    block,
    '  const expandedInterfaceLocales = [',
  );
}

async function main() {
  const webCatalog = readCatalog(webLocalesPath, 'DUVELA_WEB_I18N');
  const legalCatalog = readCatalog(legalPath, 'DUVELA_LEGAL');

  const webTranslations = await buildWebTranslations(webCatalog.data);
  const legalTranslations = await buildLegalTranslations(legalCatalog.data);

  fs.writeFileSync(webLocalesPath, writeWebTranslations(webCatalog.source, webTranslations), 'utf8');
  fs.writeFileSync(legalPath, writeLegalTranslations(legalCatalog.source, legalTranslations), 'utf8');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
