'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const banks = ['a1', 'a2'].map((level) => JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', `telc-${level}-exam-bank.json`), 'utf8')));
const examClient = fs.readFileSync(path.join(root, 'web', 'telc-exam.js'), 'utf8');
const examStyles = fs.readFileSync(path.join(root, 'web', 'telc-exam.css'), 'utf8');
const examLocaleSource = fs.readFileSync(path.join(root, 'web', 'telc-exam-i18n.js'), 'utf8');
const errors = [];
const requiredSections = ['hoeren', 'lesen', 'schreiben', 'sprechen'];

for (const bank of banks) {
if (bank.tests?.length !== 5) errors.push(`${bank.level}: expected exactly five Modelltests.`);
for (const test of bank.tests || []) {
  const sectionIds = test.sections.map((section) => section.id);
  if (sectionIds.join(',') !== requiredSections.join(',')) errors.push(`${test.id}: section order must be Hören, Lesen, Schreiben, Sprechen.`);
  if (test.sections.reduce((sum, section) => sum + section.maxPoints, 0) !== 60) errors.push(`${test.id}: maximum must be 60 points.`);
  const hearing = test.sections.find((section) => section.id === 'hoeren');
  const reading = test.sections.find((section) => section.id === 'lesen');
  const speaking = test.sections.find((section) => section.id === 'sprechen');
  const expectedHearing = bank.level === 'A2' ? '5/5/5' : '6/4/5';
  if (hearing.parts.map((part) => part.items.length).join('/') !== expectedHearing) errors.push(`${bank.level} ${test.id}: Hören must contain ${expectedHearing} tasks.`);
  if (reading.parts.map((part) => part.items.length).join('/') !== '5/5/5') errors.push(`${test.id}: Lesen must contain 5/5/5 tasks.`);
  if (speaking.parts.map((part) => part.rubric?.maxPoints).join('/') !== '3/6/6') errors.push(`${test.id}: Sprechen rubric must be 3/6/6.`);
  if (bank.level === 'A2' && (!Number.isInteger(test.visualPanel) || test.visualPanel < 1 || test.visualPanel > 5 || !test.topic)) errors.push(`${test.id}: missing A2 visual topic metadata.`);
  const ids = new Set();
  for (const section of test.sections) for (const part of section.parts) for (const item of part.items || []) {
    if (ids.has(item.id)) errors.push(`${test.id}: duplicate item id ${item.id}.`);
    ids.add(item.id);
    if (item.answer === undefined) errors.push(`${item.id}: missing answer.`);
    if (Array.isArray(item.options) && (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length)) errors.push(`${item.id}: answer is outside option range.`);
    if (Array.isArray(item.options) && new Set(item.options.map(String)).size !== item.options.length) errors.push(`${item.id}: duplicate answer options.`);
    if (!item.explain) errors.push(`${item.id}: missing answer explanation.`);
    if (section.id === 'hoeren') {
      if (String(item.transcript || '').trim().split(/\s+/).length < 8) errors.push(`${item.id}: listening script is too short for a realistic A2 task.`);
      if (bank.level === 'A2' && !item.question) errors.push(`${item.id}: missing listening question.`);
      const audioFolder = bank.level === 'A2' ? 'exam-a2' : 'exam';
      if (item.audio !== `./web/audio/${audioFolder}/${test.id}/${item.id}.mp3`) errors.push(`${item.id}: invalid audio path.`);
      const audioPath = path.join(root, 'web', 'audio', audioFolder, test.id, `${item.id}.mp3`);
      if (fs.existsSync(audioPath)) {
        const bytes = fs.readFileSync(audioPath);
        const isMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
        if (!isMp3 || bytes.length < 10_000) errors.push(`${item.id}: audio file is invalid or empty.`);
      } else {
        errors.push(`${item.id}: audio file is missing.`);
      }
    }
  }
  if (bank.level === 'A2') for (const part of speaking.parts.filter((entry) => entry.type === 'speak-cards')) {
    if (part.cards?.length !== 4) errors.push(`${test.id} ${part.id}: expected four speaking cards.`);
    if (part.cards?.some((card) => !card.keyword || !card.example || /Können wir über.+sprechen/i.test(card.example))) errors.push(`${test.id} ${part.id}: speaking examples must be natural and complete.`);
  }
}
}

const a2Bank = banks.find((bank) => bank.level === 'A2');
const a2AudioItems = a2Bank.tests.flatMap((test) => test.sections.find((section) => section.id === 'hoeren').parts.flatMap((part) => part.items));
if (a2AudioItems.length !== 75) errors.push('A2 must contain exactly 75 audio scripts.');
const a2AudioRoot = path.join(root, 'web', 'audio', 'exam-a2');
const a2AudioFiles = fs.readdirSync(a2AudioRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.mp3'));
if (a2AudioFiles.length !== a2AudioItems.length) errors.push(`A2 audio folder must contain exactly ${a2AudioItems.length} MP3 files, found ${a2AudioFiles.length}.`);
if (!a2Bank.tests.every((test) => test.sections.find((section) => section.id === 'schreiben').parts.find((part) => part.type === 'free-write')?.minWords === 40)) errors.push('A2 writing tasks must recommend 40 words.');
for (const test of a2Bank.tests) {
  const writing = test.sections.find((section) => section.id === 'schreiben').parts.find((part) => part.type === 'free-write');
  const sampleWords = String(writing?.sample || '').trim().split(/\s+/).filter(Boolean).length;
  if (sampleWords < 35 || !/\b(hallo|liebe[rn]?|sehr geehrte)\b/i.test(writing?.sample || '') || !/\b(grüß|dank)/i.test(writing?.sample || '')) errors.push(`${test.id}: A2 writing sample must be a complete model answer of at least 35 words.`);
}
if (new Set(a2Bank.tests.map((test) => test.topic)).size !== 5) errors.push('A2 model tests must use five distinct speaking topics.');
if (!fs.existsSync(path.join(root, 'web', 'images', 'exam-a2-topics.png'))) errors.push('Missing A2 topic illustration sprite.');
const a2Manifest = fs.readFileSync(path.join(root, 'web', 'audio', 'exam-a2', 'elevenlabs-scripts.txt'), 'utf8');
for (const item of a2AudioItems) if (!a2Manifest.includes(item.id) || !a2Manifest.includes(item.transcript)) errors.push(`${item.id}: missing from A2 ElevenLabs manifest.`);

for (const marker of ['testPreflightMicrophone', 'updatePreflightReady', 'submitExamEarly', 'printResultReport', 'resultRecommendation', 'renderResultProcessing', 'inline-locale', 'progressHubHtml', 'historyDashboardHtml', 'saveLocalAttempt', 'speakingCoachHtml', 'shareResult', 'readingToolsHtml', 'trainingHintHtml', 'writingChecklistHtml', 'updateWritingChecklist', 'buildProductiveRubric', 'productiveRubricHtml', 'rubricStatus']) {
  if (!examClient.includes(marker)) errors.push(`Missing exam workflow capability: ${marker}.`);
}
if (!examClient.includes('showConfirm') || examClient.includes('window.confirm(')) errors.push('Exam confirmations must use the branded accessible dialog.');
if (!examStyles.includes('@media print')) errors.push('Missing printable PDF result report styles.');
const vm = require('vm');
const rubricStart = examClient.indexOf('function scaleRubricEntries');
const rubricEnd = examClient.indexOf('function officialRubricPrompt', rubricStart);
if (rubricStart < 0 || rubricEnd < 0) errors.push('Missing executable productive rubric allocator.');
else {
  const rubricSandbox = {};
  vm.runInNewContext(examClient.slice(rubricStart, rubricEnd), rubricSandbox);
  for (const target of [0, 3, 5, 10]) {
    const rows = rubricSandbox.scaleRubricEntries([['Inhalt',4,4],['Form',0,2],['Zusammenhang',0,2],['Umfang',2,2]], target, 10);
    const total = rows.reduce((sum, row) => sum + row.points, 0);
    if (total !== target || rows.some((row) => row.points < 0 || row.points > row.maxPoints)) errors.push(`Productive rubric allocator failed for ${target} points.`);
  }
}
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
console.log('[exam] A1 + A2: ten Modelltests, 150 listening tasks/scripts, 25 UI locales, strict flow and PDF reports: OK');
