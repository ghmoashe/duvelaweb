'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', 'telc-b1-exam-bank.json'), 'utf8'));
const audioRoot = './web/audio/exam-b2';

const topicPairs = [
  ['Digitale Verwaltung spart Zeit, schliesst aber manche Menschen aus.', 'Persoenliche Beratung bleibt trotz Digitalisierung unverzichtbar.'],
  ['Flexible Arbeitsmodelle erhoehen die Produktivitaet langfristig.', 'Klare Praesenzzeiten sind fuer Teamkultur und Verantwortung notwendig.'],
  ['Nachhaltiges Reisen sollte politisch staerker gesteuert werden.', 'Reiseentscheidungen muessen vor allem individuell und bezahlbar bleiben.'],
  ['Praevention ist wichtiger als spaetere Behandlung.', 'Gesundheitsverhalten laesst sich nicht allein durch Regeln verbessern.'],
  ['Soziale Medien koennen demokratische Beteiligung erweitern.', 'Oeffentliche Debatten brauchen mehr Distanz und weniger Tempo.'],
];

const presentationTopics = [
  'Die Rolle digitaler Angebote im Alltag',
  'Lebenslanges Lernen im Beruf',
  'Nachhaltige Mobilitaet in Europa',
  'Gesundheitliche Eigenverantwortung und Gesellschaft',
  'Medienkompetenz und freiwilliges Engagement',
];

const planningTopics = [
  'eine Informationsveranstaltung fuer neue Einwohnerinnen und Einwohner',
  'ein berufliches Weiterbildungswochenende',
  'eine klimafreundliche Studienreise',
  'einen Gesundheitstag im Stadtteil',
  'eine Medienkampagne fuer einen Verein',
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replaceIds(value, testIndex) {
  if (typeof value === 'string') {
    return value
      .replaceAll(`b1m${testIndex}`, `b2m${testIndex}`)
      .replaceAll('/exam-b1/', '/exam-b2/')
      .replaceAll('Zertifikat Deutsch / telc Deutsch B1', 'telc Deutsch B2')
      .replaceAll('telc Deutsch B1', 'telc Deutsch B2')
      .replaceAll('B1', 'B2');
  }
  if (Array.isArray(value)) return value.map((entry) => replaceIds(entry, testIndex));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceIds(entry, testIndex)]));
  }
  return value;
}

function enrichText(text) {
  return text;
}

function makeB2Test(test, index) {
  const n = index + 1;
  const result = replaceIds(deepClone(test), n);
  result.id = `mt${n}`;
  result.title = `Modelltest ${n} - telc Deutsch B2`;
  result.topic = presentationTopics[index];

  const hearing = result.sections.find((section) => section.id === 'hoeren');
  hearing.title = 'Hoeren';
  hearing.durationMin = 20;
  hearing.instructions = 'Bearbeiten Sie drei Teile. Achten Sie auf Detailinformationen, Sprecherhaltung und indirekte Aussagen.';
  for (const part of hearing.parts) {
    if (part.transcript) part.transcript = enrichText(part.transcript);
    if (part.audio) part.audio = `${audioRoot}/mt${n}/b2m${n}-${part.id}.mp3`;
    for (const item of part.items || []) {
      if (item.transcript) item.transcript = enrichText(item.transcript);
      if (item.audio) item.audio = `${audioRoot}/mt${n}/${item.id}.mp3`;
      item.explain = item.answer === false
        ? 'Die Aussage stimmt nicht vollstaendig mit dem Hoertext ueberein.'
        : 'Die Aussage entspricht dem Hoertext oder laesst sich daraus ableiten.';
    }
  }

  const reading = result.sections.find((section) => section.id === 'lesen');
  reading.title = 'Lesen und Sprachbausteine';
  reading.durationMin = 90;
  reading.instructions = 'Bearbeiten Sie komplexere Texte, Anzeigen und Sprachbausteine. Entscheidend sind Argumentation, Kontext und genaue Wortwahl.';
  for (const part of reading.parts) {
    for (const text of part.texts || []) text.body = enrichText(text.body);
    for (const item of part.items || []) {
      if (item.situation) item.situation = enrichText(item.situation);
      item.explain = 'Die Loesung passt nach Inhalt, Kontext und sprachlicher Funktion am besten.';
    }
  }

  const writing = result.sections.find((section) => section.id === 'schreiben');
  writing.durationMin = 30;
  writing.instructions = 'Schreiben Sie einen zusammenhaengenden halbformellen oder formellen Text. Nehmen Sie Stellung und bearbeiten Sie alle vier Leitpunkte.';
  const writePart = writing.parts[0];
  writePart.title = 'Schriftlicher Ausdruck - Stellungnahme';
  writePart.instructions = `${writePart.instructions} Formulieren Sie mindestens 150 Woerter und verbinden Sie Ihre Argumente nachvollziehbar.`;
  writePart.minWords = 150;
  writePart.sample = `${writePart.sample} Abschliessend halte ich es fuer wichtig, nicht nur einzelne praktische Vorteile zu betrachten, sondern auch langfristige Folgen fuer Organisation, Teilhabe und Verantwortung. Deshalb wuerde ich eine Loesung bevorzugen, die verbindliche Regeln mit ausreichender Flexibilitaet verbindet. Aus meiner Sicht sollte man ausserdem transparent erklaeren, wer Entscheidungen trifft, welche Kosten entstehen und wie Betroffene rechtzeitig informiert werden. So entsteht Vertrauen, und unterschiedliche Interessen koennen sachlich abgewogen werden. Wenn ein Vorschlag praktisch bleibt und trotzdem Ruecksicht auf Menschen mit verschiedenen Voraussetzungen nimmt, hat er deutlich bessere Chancen, dauerhaft akzeptiert zu werden.`;
  writePart.rubric = { level: 'B2', maxPoints: 45, criteria: ['Aufgabenbewaeltigung', 'Kommunikative Gestaltung', 'Formale Richtigkeit'] };

  const speaking = result.sections.find((section) => section.id === 'sprechen');
  speaking.instructions = 'Sie haben vor der muendlichen Pruefung 20 Minuten Vorbereitungszeit. Praesentieren Sie strukturiert, diskutieren Sie differenziert und reagieren Sie spontan auf Ihre Partnerin.';
  speaking.parts = [
    {
      id: 'sp1', title: 'Teil 1 - Praesentation und Nachfragen', type: 'speak-intro',
      instructions: `Praesentieren Sie kurz das Thema "${presentationTopics[index]}" und beantworten Sie Rueckfragen.`,
      prompts: [`Welche Entwicklung halten Sie bei "${presentationTopics[index]}" fuer besonders wichtig?`, 'Welche Folgen sehen Sie fuer Alltag, Beruf oder Gesellschaft?'],
      rubric: { level: 'B2', maxPoints: 25, criteria: ['Ausdrucksfaehigkeit', 'Aufgabenbewaeltigung', 'Formale Richtigkeit', 'Aussprache und Intonation'] },
    },
    {
      id: 'sp2', title: 'Teil 2 - Diskussion', type: 'speak-cards',
      instructions: `Diskutieren Sie zwei Positionen zum Thema "${topicPairs[index][0]}". Fassen Sie zusammen, nehmen Sie Stellung und reagieren Sie auf Gegenargumente.`,
      cards: topicPairs[index].map((keyword, cardIndex) => ({ id: `sp2-${cardIndex + 1}`, keyword, example: 'Ein wichtiger Aspekt ist, dass ... Gleichzeitig muss man bedenken, dass ...', partner: cardIndex ? topicPairs[index][0] : topicPairs[index][1] })),
      rubric: { level: 'B2', maxPoints: 25, criteria: ['Ausdrucksfaehigkeit', 'Aufgabenbewaeltigung', 'Formale Richtigkeit', 'Aussprache und Intonation'] },
    },
    {
      id: 'sp3', title: 'Teil 3 - Gemeinsam planen', type: 'speak-cards',
      instructions: `Planen Sie gemeinsam ${planningTopics[index]}. Einigen Sie sich auf ein realistisches Vorgehen.`,
      cards: ['Zielgruppe und Ziel', 'Programm und Zeitplan', 'Budget und Verantwortung', 'Kommunikation und Risiko'].map((keyword, cardIndex) => ({ id: `sp3-${cardIndex + 1}`, keyword, example: `Beim Punkt ${keyword.toLowerCase()} waere mein Vorschlag, ...`, partner: 'Das ist nachvollziehbar, aber wir sollten auch eine Alternative einplanen.' })),
      rubric: { level: 'B2', maxPoints: 25, criteria: ['Ausdrucksfaehigkeit', 'Aufgabenbewaeltigung', 'Formale Richtigkeit', 'Aussprache und Intonation'] },
    },
  ];

  return result;
}

const bank = {
  exam: 'telc-deutsch-b2',
  level: 'B2',
  note: 'Eigenstaendige DUVELA-Uebungsinhalte im Format telc Deutsch B2. Kein offizieller telc-Pruefungssatz.',
  quality: { version: 1, reviewed: '2026-08-15', audioScripts: 55, modelTests: 5, review: 'B2 bank derived into a separate upper-level format with B2 writing, speaking and audio paths. Audio may be imported later.' },
  passMark: 60,
  passRules: { written: { sections: ['lesen', 'hoeren', 'schreiben'], maxPoints: 225, minPoints: 135 }, oral: { sections: ['sprechen'], maxPoints: 75, minPoints: 45 } },
  weights: { lesen: 105, hoeren: 75, schreiben: 45, sprechen: 75 },
  tests: source.tests.map(makeB2Test),
};

fs.writeFileSync(path.join(root, 'web', 'content', 'telc-b2-exam-bank.json'), `${JSON.stringify(bank, null, 2)}\n`, 'utf8');

const scripts = ['DUVELA EXAM - TELC DEUTSCH B2 - ELEVENLABS AUDIO SCRIPTS', 'Format: relative MP3 path | German transcript', ''];
for (const test of bank.tests) {
  const hearing = test.sections.find((section) => section.id === 'hoeren');
  for (const item of hearing.parts[0].items) scripts.push(`${item.audio.replace(`${audioRoot}/`, '')} | ${item.transcript}`);
  scripts.push(`${hearing.parts[1].audio.replace(`${audioRoot}/`, '')} | ${hearing.parts[1].transcript}`);
  for (const item of hearing.parts[2].items) scripts.push(`${item.audio.replace(`${audioRoot}/`, '')} | ${item.transcript}`);
}
const audioDir = path.join(root, 'web', 'audio', 'exam-b2');
fs.mkdirSync(audioDir, { recursive: true });
fs.writeFileSync(path.join(audioDir, 'elevenlabs-scripts.txt'), `${scripts.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(audioDir, 'README.md'), '# DUVELA EXAM B2 audio\n\nGenerate the 55 recordings listed in `elevenlabs-scripts.txt` and preserve the exact folder and file names. Until MP3 files are present, the browser uses the German system voice as a fallback.\n', 'utf8');

console.log(`[b2] Generated ${bank.tests.length} tests and ${scripts.length - 3} audio scripts.`);
