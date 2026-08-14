'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const banks = ['a1', 'a2', 'b1'].map((level) => JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', `telc-${level}-exam-bank.json`), 'utf8')));
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
  const expectedMaximum = bank.level === 'B1' ? 300 : 60;
  if (test.sections.reduce((sum, section) => sum + section.maxPoints, 0) !== expectedMaximum) errors.push(`${bank.level} ${test.id}: maximum must be ${expectedMaximum} points.`);
  const hearing = test.sections.find((section) => section.id === 'hoeren');
  const reading = test.sections.find((section) => section.id === 'lesen');
  const speaking = test.sections.find((section) => section.id === 'sprechen');
  const expectedHearing = bank.level === 'B1' ? '5/10/5' : bank.level === 'A2' ? '5/5/5' : '6/4/5';
  if (hearing.parts.map((part) => part.items.length).join('/') !== expectedHearing) errors.push(`${bank.level} ${test.id}: Hören must contain ${expectedHearing} tasks.`);
  const expectedReading = bank.level === 'B1' ? '5/5/10/10/10' : '5/5/5';
  if (reading.parts.map((part) => part.items.length).join('/') !== expectedReading) errors.push(`${bank.level} ${test.id}: Lesen must contain ${expectedReading} tasks.`);
  const expectedSpeaking = bank.level === 'B1' ? '15/30/30' : '3/6/6';
  if (speaking.parts.map((part) => part.rubric?.maxPoints).join('/') !== expectedSpeaking) errors.push(`${bank.level} ${test.id}: Sprechen rubric must be ${expectedSpeaking}.`);
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
      if (bank.level === 'B1' && part.type === 'audio-group-truefalse') continue;
      if (String(item.transcript || '').trim().split(/\s+/).length < 8) errors.push(`${item.id}: listening script is too short for a realistic ${bank.level} task.`);
      if (bank.level === 'A2' && !item.question) errors.push(`${item.id}: missing listening question.`);
      const audioFolder = bank.level === 'B1' ? 'exam-b1' : bank.level === 'A2' ? 'exam-a2' : 'exam';
      if (item.audio !== `./web/audio/${audioFolder}/${test.id}/${item.id}.mp3`) errors.push(`${item.id}: invalid audio path.`);
      const audioPath = path.join(root, 'web', 'audio', audioFolder, test.id, `${item.id}.mp3`);
      if (fs.existsSync(audioPath)) {
        const bytes = fs.readFileSync(audioPath);
        const isMp3 = bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
        if (!isMp3 || bytes.length < 10_000) errors.push(`${item.id}: audio file is invalid or empty.`);
      } else if (bank.level !== 'B1') {
        errors.push(`${item.id}: audio file is missing.`);
      }
    }
  }
  if (bank.level === 'A2') for (const part of speaking.parts.filter((entry) => entry.type === 'speak-cards')) {
    if (part.cards?.length !== 4) errors.push(`${test.id} ${part.id}: expected four speaking cards.`);
    if (part.cards?.some((card) => !card.keyword || !card.example || /Können wir über.+sprechen/i.test(card.example))) errors.push(`${test.id} ${part.id}: speaking examples must be natural and complete.`);
  }
  if (bank.level === 'B1') {
    const grouped = hearing.parts.find((part) => part.type === 'audio-group-truefalse');
    if (!grouped?.grouped || grouped.plays !== 2 || !grouped.audio || !grouped.transcript) errors.push(`${test.id}: invalid grouped B1 listening conversation.`);
    if (String(grouped?.transcript || '').trim().split(/\s+/).length < 150) errors.push(`${test.id}: B1 listening conversation is too short.`);
    const hearingPoints = hearing.parts.flatMap((part) => part.items).reduce((sum, item) => sum + Number(item.points || 0), 0);
    const readingPoints = reading.parts.flatMap((part) => part.items).reduce((sum, item) => sum + Number(item.points || 0), 0);
    if (hearingPoints !== 75) errors.push(`${test.id}: B1 Hören weights must total 75 points.`);
    if (readingPoints !== 105) errors.push(`${test.id}: B1 Lesen + Sprachbausteine weights must total 105 points.`);
    for (const part of reading.parts.filter((entry) => entry.id === 'sb1' || entry.id === 'sb2')) {
      const gaps = (part.texts?.[0]?.body?.match(/___/g) || []).length;
      if (gaps !== 10) errors.push(`${test.id} ${part.id}: expected ten language gaps.`);
    }
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

const b1Bank = banks.find((bank) => bank.level === 'B1');
const b1HearingItems = b1Bank.tests.flatMap((test) => test.sections.find((section) => section.id === 'hoeren').parts.flatMap((part) => part.items));
if (b1HearingItems.length !== 100) errors.push('B1 must contain exactly 100 listening tasks across five tests.');
if (b1Bank.passRules?.written?.minPoints !== 135 || b1Bank.passRules?.oral?.minPoints !== 45) errors.push('B1 must require 135 written and 45 oral points.');
if (Number(b1Bank.quality?.version || 0) < 3 || !b1Bank.quality?.review) errors.push('B1 content bank must include the independent-listening quality review metadata.');
const b1SeenTaskTexts = new Map();
for (const test of b1Bank.tests) {
  const writing = test.sections.find((section) => section.id === 'schreiben').parts[0];
  const sampleWords = String(writing.sample || '').trim().split(/\s+/).filter(Boolean).length;
  if (writing.minWords !== 100 || writing.leitpunkte?.length !== 4 || sampleWords < 100) errors.push(`${test.id}: B1 writing must include four points and a complete model answer of at least 100 words.`);
  const reading = test.sections.find((section) => section.id === 'lesen');
  if (reading.durationMin !== 90 || reading.parts.length !== 5) errors.push(`${test.id}: B1 reading/language block must contain five parts and 90 minutes.`);
  const hearing = test.sections.find((section) => section.id === 'hoeren');
  for (const part of hearing.parts.filter((entry) => entry.type.includes('truefalse'))) {
    const truthValues = part.items.map((item) => item.answer);
    if (!truthValues.includes(true) || !truthValues.includes(false)) errors.push(`${test.id} ${part.id}: B1 true/false tasks need both correct and incorrect statements.`);
    const expectedTrue = part.id === 'h2' ? 6 : 3;
    if (truthValues.filter(Boolean).length !== expectedTrue) errors.push(`${test.id} ${part.id}: expected ${expectedTrue} true and ${truthValues.length - expectedTrue} false answers.`);
  }
  const headingPart = reading.parts.find((part) => part.id === 'l1');
  if (new Set(headingPart.items.map((item) => item.answer)).size !== headingPart.items.length) errors.push(`${test.id}: B1 reading headings must be used only once.`);
  if (headingPart.items.some((item) => String(item.situation || '').trim().split(/\s+/).length < 28)) errors.push(`${test.id}: B1 heading texts are too short.`);
  const articlePart = reading.parts.find((part) => part.id === 'l2');
  if (String(articlePart.texts?.[0]?.body || '').trim().split(/\s+/).length < 95) errors.push(`${test.id}: B1 article is too short for the target level.`);
  const adsPart = reading.parts.find((part) => part.id === 'l3');
  if (adsPart.ads?.length !== 12 || adsPart.items?.length !== 10 || !adsPart.items.every((item) => item.options?.includes('x'))) errors.push(`${test.id}: B1 advertisements must contain twelve ads, ten situations and option x.`);
  for (const part of [...hearing.parts, ...reading.parts.filter((entry) => !entry.id.startsWith('sb'))]) for (const item of part.items || []) {
    const taskText = String(item.statement || item.question || item.situation || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!taskText) continue;
    if (b1SeenTaskTexts.has(taskText)) errors.push(`${test.id} ${item.id}: duplicates task text from ${b1SeenTaskTexts.get(taskText)}.`);
    else b1SeenTaskTexts.set(taskText, `${test.id} ${item.id}`);
  }
  const speaking = test.sections.find((section) => section.id === 'sprechen');
  if (speaking.parts.find((part) => part.id === 'sp2')?.cards?.length !== 2 || speaking.parts.find((part) => part.id === 'sp3')?.cards?.length !== 4) errors.push(`${test.id}: B1 speaking must provide two opinions and four planning points.`);
  const serialized = JSON.stringify(test);
  if (/\b(?:das Tag|das Informationsabend|das Gesundheits-|das Medienworkshop|mit der Regionalzug)\b/i.test(serialized)) errors.push(`${test.id}: B1 content contains an article/case error.`);
}
const b1Manifest = fs.readFileSync(path.join(root, 'web', 'audio', 'exam-b1', 'elevenlabs-scripts.txt'), 'utf8');
const b1AudioEntries = b1Bank.tests.flatMap((test) => {
  const parts = test.sections.find((section) => section.id === 'hoeren').parts;
  return [...parts[0].items.map((item) => ({ audio: item.audio, transcript: item.transcript })), { audio: parts[1].audio, transcript: parts[1].transcript }, ...parts[2].items.map((item) => ({ audio: item.audio, transcript: item.transcript }))];
});
if (b1AudioEntries.length !== 55) errors.push('B1 must provide exactly 55 ElevenLabs scripts.');
const normalizedB1Scripts = b1AudioEntries.map((entry) => String(entry.transcript || '').toLocaleLowerCase('de-DE')
  .replace(/[^a-zäöüß\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim());
if (new Set(normalizedB1Scripts).size !== b1AudioEntries.length) errors.push('B1 listening scripts must be unique.');
const wordShingles = (text) => {
  const words = text.split(' ');
  return new Set(words.slice(0, -2).map((word, index) => `${word} ${words[index + 1]} ${words[index + 2]}`));
};
const b1Shingles = normalizedB1Scripts.map(wordShingles);
for (let left = 0; left < b1Shingles.length; left += 1) for (let right = left + 1; right < b1Shingles.length; right += 1) {
  const intersection = [...b1Shingles[left]].filter((value) => b1Shingles[right].has(value)).length;
  const union = new Set([...b1Shingles[left], ...b1Shingles[right]]).size;
  const similarity = union ? intersection / union : 0;
  if (similarity > 0.5) errors.push(`B1 listening scripts ${left + 1} and ${right + 1} are suspiciously similar (${Math.round(similarity * 100)}%).`);
}
for (const entry of b1AudioEntries) {
  const relative = entry.audio.replace('./web/audio/exam-b1/', '');
  if (!b1Manifest.includes(relative) || !b1Manifest.includes(entry.transcript)) errors.push(`${relative}: missing from B1 ElevenLabs manifest.`);
}
if (!fs.existsSync(path.join(root, 'telc-b1-exam.html'))) errors.push('Missing B1 exam page.');

for (const marker of ['LEVEL_FORMAT', 'audio-group-truefalse', 'renderAudioGroupTrueFalse', 'examPassDetails', 'testPreflightMicrophone', 'updatePreflightReady', 'submitExamEarly', 'printResultReport', 'printTrainingCertificate', 'trainingCertificateHtml', 'resultDetailRows', 'b1StartGuideHtml', 'resultRecommendation', 'renderResultProcessing', 'inline-locale', 'progressHubHtml', 'historyDashboardHtml', 'saveLocalAttempt', 'speakingCoachHtml', 'shareResult', 'readingToolsHtml', 'trainingStrategy', 'trainingHintHtml', 'writingChecklistHtml', 'updateWritingChecklist', 'buildProductiveRubric', 'productiveRubricHtml', 'rubricStatus']) {
  if (!examClient.includes(marker)) errors.push(`Missing exam workflow capability: ${marker}.`);
}
if (!examClient.includes('showConfirm') || examClient.includes('window.confirm(')) errors.push('Exam confirmations must use the branded accessible dialog.');
if (!examStyles.includes('@media print')) errors.push('Missing printable PDF result report styles.');
for (const marker of ['exam-day-guide', 'training-strategy', 'b1-pass-gates', 'detail-report-table', 'training-certificate', 'certificate-print']) if (!examStyles.includes(marker)) errors.push(`Missing B1 interface style: ${marker}.`);
const vm = require('vm');
const passStart = examClient.indexOf('function examPassDetails');
const passEnd = examClient.indexOf('function scoreBox', passStart);
if (passStart < 0 || passEnd < 0) errors.push('Missing executable B1 pass rules.');
else {
  const passSandbox = {};
  vm.runInNewContext(`const EXAM_LEVEL='B1'; const LEVEL_FORMAT={writtenMin:135,oralMin:45,passPoints:180,totalPoints:300};\n${examClient.slice(passStart, passEnd)}`, passSandbox);
  const row = (lesen, hoeren, schreiben, sprechen) => [
    { id: 'lesen', pts: lesen, max: 105 }, { id: 'hoeren', pts: hoeren, max: 75 }, { id: 'schreiben', pts: schreiben, max: 45 }, { id: 'sprechen', pts: sprechen, max: 75 },
  ];
  if (!passSandbox.examPassDetails(row(70, 45, 20, 45), true).passed) errors.push('B1 pass rules reject a valid written/oral result.');
  if (passSandbox.examPassDetails(row(60, 40, 34, 75), true).passed) errors.push('B1 pass rules accept an insufficient written result.');
  if (passSandbox.examPassDetails(row(105, 75, 45, 44), true).passed) errors.push('B1 pass rules accept an insufficient oral result.');
}
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
const detailStart = examClient.indexOf('function resultDetailRows');
const detailEnd = examClient.indexOf('function trainingCertificateHtml', detailStart);
if (detailStart < 0 || detailEnd < 0) errors.push('Missing executable detailed result rows.');
else {
  const detailSandbox = { state: { scores: { hoeren: { pts: 50, max: 75, details: [{ id: 'h1', title: 'Teil 1', pts: 20, max: 25, got: 4, items: 5 }] } } } };
  vm.runInNewContext(examClient.slice(detailStart, detailEnd), detailSandbox);
  const detailRows = detailSandbox.resultDetailRows([{ id: 'hoeren', title: 'Hören', maxPoints: 75 }]);
  if (detailRows.length !== 2 || detailRows[0].pct !== 67 || detailRows[1].pct !== 80) errors.push('Detailed B1 result calculation is invalid.');
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
console.log('[exam] A1 + A2 + B1: fifteen Modelltests, 250 listening tasks, 55 B1 audio scripts, 25 UI locales, strict scoring and PDF reports: OK');
