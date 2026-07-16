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

function removeDirRecursive(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.readdirSync(targetPath).forEach((entry) => {
    const entryPath = path.join(targetPath, entry);
    const stats = fs.lstatSync(entryPath);
    if (stats.isDirectory()) {
      removeDirRecursive(entryPath);
    } else {
      fs.unlinkSync(entryPath);
    }
  });
  fs.rmdirSync(targetPath);
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

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return '';
  const line = fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
}

const businessEnv = path.resolve(root, '..', 'vela academy for business', '.env');
const deepARLicense = process.env.DEEPAR_WEB_LICENSE_KEY
  || process.env.EXPO_PUBLIC_DEEPAR_WEB_LICENSE_KEY
  || readEnvValue(businessEnv, 'EXPO_PUBLIC_DEEPAR_WEB_LICENSE_KEY');
const generatedLicense = `(function(g){g.DUVELA_DEEPAR_WEB_LICENSE_KEY=${JSON.stringify(deepARLicense)};})(window);\n`;
fs.writeFileSync(path.join(outDir, 'web', 'duvela-deepar-license.js'), generatedLicense, 'utf8');

const bundledEffectsRoot = path.join(root, 'web', 'effects');
const externalEffectsRoot = path.resolve(root, '..', 'free_package', 'Free Filters');
const effectAssets = [
  ['Makeup Look Simple', 'MakeupLook.deepar', 'MakeupLook.deepar'],
  ['Pixel Heart Particles', '8bitHearts.deepar', 'PixelHearts.deepar']
];
const effectsOut = path.join(outDir, 'web', 'effects');
fs.mkdirSync(effectsOut, { recursive: true });
effectAssets.forEach(([folder, sourceName, outputName]) => {
  const bundledSource = path.join(bundledEffectsRoot, outputName);
  const externalSource = path.join(externalEffectsRoot, folder, sourceName);
  const source = fs.existsSync(bundledSource) ? bundledSource : externalSource;
  if (!fs.existsSync(source)) {
    throw new Error(`Missing DeepAR effect: expected ${bundledSource} or ${externalSource}`);
  }
  fs.copyFileSync(source, path.join(effectsOut, outputName));
});

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
