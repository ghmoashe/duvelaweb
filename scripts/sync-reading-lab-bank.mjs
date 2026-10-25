import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const webRoot = path.resolve(import.meta.dirname, '..');
const academyRoot = path.resolve(
  process.env.DUVELA_ACADEMY_HUB || path.join(webRoot, '..', 'vela academy hub'),
);
const sourceFile = path.join(academyRoot, 'shared', 'reading-lab-data.ts');
const outputFile = path.join(webRoot, 'web', 'content', 'reading-lab-bank.json');
const browserOutputFile = path.join(webRoot, 'web', 'content', 'reading-lab-bank.js');

const module = await import(pathToFileURL(sourceFile).href);
const passages = module.getReadingLabPassageBank();
const tasks = passages.map((passage) => ({
  ...passage,
  category: 'reading',
  level: String(passage.level).toUpperCase(),
  status: 'published',
  source: passage.source || 'duvela-academy-hub',
}));

const counts = {};
for (const task of tasks) {
  counts[task.target] ||= {};
  counts[task.target][task.level] = (counts[task.target][task.level] || 0) + 1;
}

const bank = {
  schemaVersion: 1,
  source: 'vela-academy-hub/shared/reading-lab-data.ts',
  generatedAt: new Date().toISOString(),
  counts,
  tasks,
};

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(bank, null, 2)}\n`);
const browserPayload = JSON.stringify(bank).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
await fs.writeFile(browserOutputFile, `window.DuvelaReadingLabBank=${browserPayload};\n`);

console.log(`Synced ${tasks.length} Reading Lab passages to ${outputFile} and ${browserOutputFile}`);
console.log(JSON.stringify(counts, null, 2));
