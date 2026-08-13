'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'web', 'content', 'telc-a1-exam-bank.json'), 'utf8'));
const lines = [
  '# DUVELA EXAM — ElevenLabs Hören-Skript',
  '',
  'Eine Audiodatei pro Aufgabe exportieren. Dateiname exakt übernehmen.',
  'Empfehlung: natürliches Hochdeutsch, Stability 55–70, Similarity 75–85, Speed 0.92–0.98.',
  'Dialoge mit zwei Stimmen erzeugen; Ansagen mit einer klaren neutralen Stimme.',
  'Keine Musik. Leichte Umgebungsgeräusche nur sehr dezent und nur passend zur Situation.',
  '',
];

for (const test of bank.tests) {
  const listening = test.sections.find((section) => section.id === 'hoeren');
  const speaking = test.sections.find((section) => section.id === 'sprechen');
  speaking.instructions = 'Sprechen Sie mit der Prüferin und Ihrer virtuellen Prüfungspartnerin. Es gibt keine Vorbereitungszeit.';
  speaking.parts[0].rubric = { level: 'A1', maxPoints: 3, criteria: ['Vorstellung: 1 / 0,5 / 0', 'Buchstabieren: 1 / 0,5 / 0', 'Zahlenangabe: 1 / 0,5 / 0'] };
  speaking.parts[1].rubric = { level: 'A1', maxPoints: 6, criteria: ['Zwei Fragen: je 2 / 1 / 0', 'Zwei Antworten: je 1 / 0,5 / 0'] };
  speaking.parts[2].rubric = { level: 'A1', maxPoints: 6, criteria: ['Zwei Bitten: je 2 / 1 / 0', 'Zwei Reaktionen: je 1 / 0,5 / 0'] };
  lines.push(`## ${test.title}`, '');
  for (const part of listening.parts) {
    const repeats = part.type === 'audio-truefalse' ? 1 : 2;
    lines.push(`### ${part.title} — in der Prüfung ${repeats === 1 ? 'einmal' : 'zweimal'} abspielen`, '');
    for (const item of part.items) {
      const file = `${item.id}.mp3`;
      item.audio = `./web/audio/exam/${test.id}/${file}`;
      lines.push(`#### ${file}`, '', item.transcript.trim(), '');
    }
  }
}

fs.mkdirSync(path.join(root, 'web', 'audio', 'exam'), { recursive: true });
fs.writeFileSync(path.join(root, 'ELEVENLABS_HOEREN_SCRIPT.md'), `${lines.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(root, 'web', 'content', 'telc-a1-exam-bank.json'), `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
console.log(`Exported ${bank.tests.length * 15} Hören scripts and audio paths.`);
