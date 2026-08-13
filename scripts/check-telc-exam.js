'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', 'telc-a1-exam-bank.json'), 'utf8'));
const examClient = fs.readFileSync(path.join(root, 'web', 'telc-exam.js'), 'utf8');
const examStyles = fs.readFileSync(path.join(root, 'web', 'telc-exam.css'), 'utf8');
const examLocaleSource = fs.readFileSync(path.join(root, 'web', 'telc-exam-i18n.js'), 'utf8');
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
    if (section.id === 'hoeren') {
      if (item.audio !== `./web/audio/exam/${test.id}/${item.id}.mp3`) errors.push(`${item.id}: invalid audio path.`);
      const audioPath = path.join(root, 'web', 'audio', 'exam', test.id, `${item.id}.mp3`);
      if (fs.existsSync(audioPath)) {
        const bytes = fs.readFileSync(audioPath);
        const isMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
        if (!isMp3 || bytes.length < 10_000) errors.push(`${item.id}: audio file is invalid or empty.`);
      } else {
        errors.push(`${item.id}: audio file is missing.`);
      }
    }
  }
}

for (const marker of ['testPreflightMicrophone', 'updatePreflightReady', 'submitExamEarly', 'printResultReport', 'resultRecommendation', 'renderResultProcessing', 'inline-locale']) {
  if (!examClient.includes(marker)) errors.push(`Missing exam workflow capability: ${marker}.`);
}
if (!examClient.includes('showConfirm') || examClient.includes('window.confirm(')) errors.push('Exam confirmations must use the branded accessible dialog.');
if (!examStyles.includes('@media print')) errors.push('Missing printable PDF result report styles.');
const vm = require('vm');
const localeSandbox = { window: {} };
vm.runInNewContext(examLocaleSource, localeSandbox);
const examLocales = localeSandbox.window.DUVELA_EXAM_I18N;
const requiredLocaleKeys = ['language','before','ready','intro','name','number','browser','connection','sound','microphone','rules','initial','start','back','flow','written','oral','processing','processingLead','wait','stages','nav','timeLabel','heroPrefix','heroAccent','heroDesc','factTests','factTime','factPass','assurance','configure','choose','chooseDesc','simulation','simDesc','training','trainingDesc','modelTest','germanNote','scope','allTraining','prepare','startTraining','soundCheck','disclaimer','savedAttempt','resumeCopy','resume','discard','examWord'];
if (examLocales?.locales?.length !== 25) errors.push('Exam preparation must support all 25 DUVELA locales.');
for (const locale of examLocales?.locales || []) {
  const translation = examLocales.text?.[locale.code];
  for (const key of requiredLocaleKeys) if (!translation?.[key] || (key === 'stages' && translation[key].length !== 5)) errors.push(`${locale.code}: missing exam locale key ${key}.`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`[exam] ${error}`));
  process.exit(1);
}
console.log('[exam] Five Modelltests, 75 verified MP3 files, 25 UI locales, staged result processing, strict flow and PDF report: OK');
