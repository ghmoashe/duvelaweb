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

console.log(`[build-static-site] Built static site in ${path.relative(root, outDir)}`);
