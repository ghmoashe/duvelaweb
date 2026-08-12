'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', 'telc-a1-exam-bank.json'), 'utf8'));
const errors = [];
const requiredSections = ['hoeren', 'lesen', 'schreiben', 'sprechen'];

if (bank.tests?.length !== 5) errors.push('Expected exactly five Modelltests.');
for (const test of bank.tests || []) {
  const sectionIds = test.sections.map((section) => section.id);
  if (sectionIds.join(',') !== requiredSections.join(',')) errors.push(`${test.id}: section order must be Hören, Lesen, Schreiben, Sprechen.`);
  if (test.sections.reduce((sum, section) => sum + section.maxPoints, 0) !== 60) errors.push(`${test.id}: maximum must be 60 points.`);
  const hearing = test.sections.find((section) => section.id === 'hoeren');
  const reading = test.sections.find((section) => section.id === 'lesen');
  const speaking = test.sections.find((section) => section.id === 'sprechen');
  if (hearing.parts.map((part) => part.items.length).join('/') !== '6/4/5') errors.push(`${test.id}: Hören must contain 6/4/5 tasks.`);
  if (reading.parts.map((part) => part.items.length).join('/') !== '5/5/5') errors.push(`${test.id}: Lesen must contain 5/5/5 tasks.`);
  if (speaking.parts.map((part) => part.rubric?.maxPoints).join('/') !== '3/6/6') errors.push(`${test.id}: Sprechen rubric must be 3/6/6.`);
  const ids = new Set();
  for (const section of test.sections) for (const part of section.parts) for (const item of part.items || []) {
    if (ids.has(item.id)) errors.push(`${test.id}: duplicate item id ${item.id}.`);
    ids.add(item.id);
    if (item.answer === undefined) errors.push(`${item.id}: missing answer.`);
    if (section.id === 'hoeren' && item.audio !== `./web/audio/exam/${test.id}/${item.id}.mp3`) errors.push(`${item.id}: invalid audio path.`);
  }
}

if (errors.length) {
  errors.forEach((error) => console.error(`[exam] ${error}`));
  process.exit(1);
}
console.log('[exam] Five Modelltests, 60-point rubric, task counts and 75 audio paths: OK');
