'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const strict = process.env.DUVELA_STRICT_PUBLISH === '1';
const htmlFiles = ['index.html', 'app.html', 'live.html', 'profile.html', 'legal.html'];
const maxHtmlBytes = 140 * 1024;
const maxReferencedAssetBytes = 1024 * 1024;
const maxLocalMediaBytes = 10 * 1024 * 1024;
const failures = [];
const warnings = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function stat(relativePath) {
  return fs.statSync(path.join(root, relativePath));
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requireIncludes(file, content, needle) {
  if (!content.includes(needle)) fail(`${file} is missing ${needle}`);
}

function collectLocalReferences(file, content) {
  const references = new Set();
  const attrPattern = /\b(?:src|href|poster)=["']\.\/([^"'?#]+)(?:[?#][^"']*)?["']/g;
  let match;
  while ((match = attrPattern.exec(content))) {
    references.add(match[1]);
  }
  return [...references].map((reference) => reference.replaceAll('\\', '/'));
}

function checkHtmlBudgets() {
  for (const file of htmlFiles) {
    const size = stat(file).size;
    if (size > maxHtmlBytes) {
      fail(`${file} is ${(size / 1024).toFixed(1)} KB; keep HTML under ${maxHtmlBytes / 1024} KB before publish.`);
    }
  }
}

function checkResourceHints() {
  const index = read('index.html');
  const app = read('app.html');
  const live = read('live.html');
  const profile = read('profile.html');

  requireIncludes('index.html', index, 'rel="preconnect" href="https://cdn.jsdelivr.net"');
  requireIncludes('index.html', index, 'rel="preconnect" href="https://ohtkryanqcnwghcnipsr.supabase.co"');
  requireIncludes('index.html', index, 'preload="none"');
  requireIncludes('app.html', app, 'rel="preconnect" href="https://cdn.jsdelivr.net"');
  requireIncludes('live.html', live, 'rel="preconnect" href="https://download.agora.io"');
  requireIncludes('profile.html', profile, 'rel="preconnect" href="https://cdn.jsdelivr.net"');
}

function checkHeaders() {
  if (!exists('_headers')) {
    fail('_headers is missing; publish should define cache/security headers.');
    return;
  }
  const headers = read('_headers');
  [
    'X-Content-Type-Options: nosniff',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Permissions-Policy:',
    'Cache-Control: public, max-age=0, must-revalidate',
    'Cache-Control: public, max-age=31536000, immutable'
  ].forEach((needle) => requireIncludes('_headers', headers, needle));
}

function checkReferencedAssets() {
  const references = new Set();
  for (const file of htmlFiles) {
    const content = read(file);
    collectLocalReferences(file, content).forEach((reference) => references.add(reference));
  }

  for (const reference of references) {
    if (/^https?:\/\//.test(reference)) continue;
    if (!exists(reference)) continue;
    const size = stat(reference).size;
    if (size > maxReferencedAssetBytes) {
      fail(`Referenced asset ${reference} is ${(size / 1024).toFixed(1)} KB; host large assets separately or optimize before publish.`);
    }
  }
}

function walk(dir, result = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relativePath = path.posix.join(dir.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules'].includes(entry.name)) continue;
      walk(relativePath, result);
    } else {
      result.push(relativePath);
    }
  }
  return result;
}

function checkLargeLocalMedia() {
  const largeMedia = walk('.')
    .filter((file) => /\.(mp4|mov|avi|mkv)$/i.test(file))
    .map((file) => ({ file: file.replace(/^\.\//, ''), size: stat(file).size }))
    .filter((item) => item.size > maxLocalMediaBytes);

  for (const item of largeMedia) {
    const message = `${item.file} is ${(item.size / 1024 / 1024).toFixed(1)} MB in the local publish tree. Host it externally or exclude it from deploy output.`;
    if (strict) fail(message);
    else warn(message);
  }
}

function main() {
  checkHtmlBudgets();
  checkResourceHints();
  checkHeaders();
  checkReferencedAssets();
  checkLargeLocalMedia();

  warnings.forEach((message) => console.warn(`[publish-readiness] warning: ${message}`));
  if (failures.length) {
    failures.forEach((message) => console.error(`[publish-readiness] ${message}`));
    process.exit(1);
  }
  console.log('[publish-readiness] Publish readiness checks passed.');
}

main();
