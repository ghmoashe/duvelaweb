'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.resolve(process.argv[2] || '');
const level = String(process.argv[3] || 'A1').toUpperCase();

if (!['A1', 'A2', 'B1'].includes(level)) throw new Error('Level must be A1, A2 or B1.');

const bank = JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', `telc-${level.toLowerCase()}-exam-bank.json`), 'utf8'));
const audioFolder = level === 'B1' ? 'exam-b1' : level === 'A2' ? 'exam-a2' : 'exam';
const destinations = new Map();

for (const test of bank.tests || []) {
  for (const section of (test.sections || []).filter((entry) => entry.id === 'hoeren')) {
    for (const part of section.parts || []) {
      const audioRefs = [part.audio, ...(part.items || []).map((item) => item.audio)].filter(Boolean);
      for (const audio of audioRefs) {
        const normalized = String(audio).replace(/\\/g, '/');
        const name = path.posix.basename(normalized);
        const id = name.replace(/(?:\.mp3)+$/i, '');
        const marker = `/web/audio/${audioFolder}/`;
        const markerIndex = normalized.indexOf(marker);
        const relative = markerIndex >= 0 ? normalized.slice(markerIndex + marker.length) : `${test.id}/${name}`;
        destinations.set(id, relative);
      }
    }
  }
}

const expected = new Set(destinations.keys());

if (!process.argv[2] || !fs.existsSync(source)) {
  console.error('Usage: node scripts/import-telc-exam-audio.js <source-folder> [A1|A2|B1]');
  process.exit(1);
}

function walkMp3(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkMp3(fullPath);
    if (!entry.isFile() || !/\.mp3$/i.test(entry.name)) return [];
    return [{ name: entry.name, fullPath }];
  });
}

const candidates = walkMp3(source)
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
  const bytes = fs.readFileSync(entry.fullPath);
  const isMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);

  if (!isMp3 || bytes.length < 10_000) {
    console.error(`Invalid or empty MP3: ${entry.name}`);
    process.exit(1);
  }

  const destination = path.join(root, 'web', 'audio', audioFolder, destinations.get(id));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(entry.fullPath, destination);
}

console.log(`Imported ${found.size} verified ${level} MP3 files into ${audioFolder}/mt1-mt5. Source files were preserved.`);
