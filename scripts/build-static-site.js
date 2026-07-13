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
fs.writeFileSync(path.join(serverDir, 'index.js'), `import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const port = Number(process.env.PORT || 3000);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]).replace(/^\\/+/, '');
  const target = path.resolve(root, clean || 'index.html');
  if (!target.startsWith(root)) return null;
  return target;
}

function send(response, status, body, type) {
  response.writeHead(status, {
    'content-type': type || 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin'
  });
  response.end(body);
}

http.createServer((request, response) => {
  const target = safePath(request.url || '/');
  if (!target) return send(response, 403, 'Forbidden');
  const file = fs.existsSync(target) && fs.statSync(target).isDirectory()
    ? path.join(target, 'index.html')
    : target;
  fs.readFile(file, (error, data) => {
    if (error) return send(response, 404, 'Not found');
    send(response, 200, data, types[path.extname(file).toLowerCase()] || 'application/octet-stream');
  });
}).listen(port, '0.0.0.0', () => {
  console.log('Duvela Web listening on ' + port);
});
`, 'utf8');

console.log(`[build-static-site] Built static site in ${path.relative(root, outDir)}`);
