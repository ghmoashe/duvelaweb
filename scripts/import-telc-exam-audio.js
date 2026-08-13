'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || '');
const level = String(process.argv[3] || 'A1').toUpperCase();
if (!['A1', 'A2'].includes(level)) throw new Error('Level must be A1 or A2.');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', `telc-${level.toLowerCase()}-exam-bank.json`), 'utf8'));
const audioFolder = level === 'A2' ? 'exam-a2' : 'exam';
const destinations = new Map(bank.tests.flatMap((test) => test.sections
  .filter((section) => section.id === 'hoeren')
  .flatMap((section) => section.parts.flatMap((part) => part.items.map((item) => [item.id, test.id])))));
const expected = new Set(destinations.keys());

if (!process.argv[2] || !fs.existsSync(source)) {
  console.error('Usage: node scripts/import-telc-exam-audio.js <source-folder> [A1|A2]');
  process.exit(1);
}

const candidates = fs.readdirSync(source, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.mp3$/i.test(entry.name))
  .map((entry) => ({ entry, id: entry.name.replace(/(?:\.mp3)+$/i, '') }))
  .filter(({ id }) => expected.has(id));

const found = new Set(candidates.map(({ id }) => id));
const missing = [...expected].filter((id) => !found.has(id));
const duplicates = candidates.filter(({ id }, index) => candidates.findIndex((item) => item.id === id) !== index);
if (missing.length || duplicates.length || found.size !== expected.size) {
  if (missing.length) console.error(`Missing: ${missing.join(', ')}`);
  if (duplicates.length) console.error(`Duplicates: ${duplicates.map(({ entry }) => entry.name).join(', ')}`);
  process.exit(1);
}

for (const { entry, id } of candidates) {
  const sourceFile = path.join(source, entry.name);
  const bytes = fs.readFileSync(sourceFile);
  const isMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (!isMp3 || bytes.length < 10_000) {
    console.error(`Invalid or empty MP3: ${entry.name}`);
    process.exit(1);
  }
  const testId = destinations.get(id);
  const destinationDir = path.join(root, 'web', 'audio', audioFolder, testId);
  fs.mkdirSync(destinationDir, { recursive: true });
  fs.copyFileSync(sourceFile, path.join(destinationDir, `${id}.mp3`));
}

console.log(`Imported ${found.size} verified ${level} MP3 files into ${audioFolder}/mt1–mt5. Source files were preserved.`);
