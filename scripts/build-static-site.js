'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist');
const files = [
  'index.html',
  'app.html',
  'live.html',
  'profile.html',
  'legal.html',
  'logo.webp',
  'logo2.png',
  '_headers',
  'package.json'
];
const dirs = [
  '.openai',
  'web',
  'locales',
  'legal'
];

function copyFile(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(outDir, relativePath);
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(relativePath) {
  const from = path.join(root, relativePath);
  const to = path.join(outDir, relativePath);
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, {
    recursive: true,
    force: true,
    filter: (source) => !/\.(mp4|mov|avi|mkv)$/i.test(source)
  });
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
files.forEach(copyFile);
dirs.forEach(copyDir);

const serverDir = path.join(outDir, 'server');
fs.mkdirSync(serverDir, { recursive: true });
fs.writeFileSync(path.join(serverDir, 'index.js'), `function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=()');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function assetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return new Request(url, request);
}

export default {
  async fetch(request, env) {
    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
      return new Response('Duvela Web asset binding is not available.', { status: 500 });
    }
    const url = new URL(request.url);
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    const response = await env.ASSETS.fetch(assetRequest(request, pathname));
    if (response.status !== 404) return withSecurityHeaders(response);
    return withSecurityHeaders(await env.ASSETS.fetch(assetRequest(request, '/index.html')));
  }
};
`, 'utf8');

console.log(`[build-static-site] Built static site in ${path.relative(root, outDir)}`);
