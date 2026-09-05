'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist');
const files = [
  'index.html',
  'app.html',
  'aussprache.html',
  'live.html',
  'profile.html',
  'legal.html',
  'telc-exam.html',
  'telc-a2-exam.html',
  'telc-b1-exam.html',
  'telc-b2-exam.html',
  'business.html',
  'business-admin.html',
  'admin.html',
  'reset-password.html',
  'teacher-invite.html',
  'teacher-invite-accepted.html',
  'sw.js',
  'logo.webp',
  'logo2.png',
  // Hub app icon used in the Duel panel's "Open in Duvela Academy Hub"
  // hand-off card so a learner recognises the app they're jumping to.
  'hub-app-icon.png',
  'og.png',
  'video-poster.jpg',
  'robots.txt',
  'sitemap.xml',
  '_headers',
  'package.json',
  '.openai/hosting.json'
];
const dirs = [
  'web',
  'locales',
  'legal',
  // Universal-links verification files (Apple AASA + Android assetlinks.json).
  // Both must sit at the site root under /.well-known/ or the OS will not
  // hand vela.cafe taps to the Hub app.
  '.well-known'
];

function removeDirRecursive(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.readdirSync(targetPath).forEach((entry) => {
    const entryPath = path.join(targetPath, entry);
    fs.rmSync(entryPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  });
  try {
    fs.rmdirSync(targetPath);
  } catch (error) {
    if (!error || error.code !== 'EBUSY') throw error;
  }
}

function copyFile(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDirRecursive(from, to) {
  if (!fs.existsSync(from)) return;
  const stats = fs.lstatSync(from);
  if (!stats.isDirectory()) {
    if (!/\.(mp4|mov|avi|mkv)$/i.test(from)) copyFile(from, to);
    return;
  }
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((entry) => {
    copyDirRecursive(path.join(from, entry), path.join(to, entry));
  });
}

function copyProjectFile(relativePath) {
  copyFile(path.join(root, relativePath), path.join(outDir, relativePath));
}

function copyProjectDir(relativePath) {
  copyDirRecursive(path.join(root, relativePath), path.join(outDir, relativePath));
}

removeDirRecursive(outDir);
fs.mkdirSync(outDir, { recursive: true });
files.forEach(copyProjectFile);
dirs.forEach(copyProjectDir);
copyFile(path.join(root, '.classroom-build', 'classroom.html'), path.join(outDir, 'classroom.html'));
copyDirRecursive(path.join(root, '.classroom-build', 'assets'), path.join(outDir, 'assets'));

const serverDir = path.join(outDir, 'server');
fs.mkdirSync(serverDir, { recursive: true });
fs.writeFileSync(path.join(serverDir, 'index.js'), `function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(self), microphone=(self), geolocation=(self)');
  // The Zoom Video SDK classroom needs SharedArrayBuffer (multi-thread WASM and
  // canvas self-view) on Chromium, which requires cross-origin isolation. Scope
  // it to the classroom document only so other pages (Agora live, etc.) keep
  // loading cross-origin resources normally. \`credentialless\` lets the SDK keep
  // pulling its media libs from source.zoom.us without those assets needing CORP.
  if (pathname === '/classroom.html') {
    headers.set('cross-origin-opener-policy', 'same-origin');
    headers.set('cross-origin-embedder-policy', 'credentialless');
    // Zoom's media SDK registers a (deprecated) unload handler for cleanup;
    // browsers now gate that behind Permissions-Policy and log a violation when
    // it's disallowed. Allow it just for the classroom so the console stays clean.
    headers.set('permissions-policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=(self), unload=*');
  }
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
    if (response.status !== 404) return withSecurityHeaders(response, pathname);
    return withSecurityHeaders(await env.ASSETS.fetch(assetRequest(request, '/index.html')), '/index.html');
  }
};
`, 'utf8');

console.log(`[build-static-site] Built static site in ${path.relative(root, outDir)}`);
