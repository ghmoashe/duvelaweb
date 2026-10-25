// Builds web/content/practice-extras.js from the Duvela Academy Hub sources, so the web
// app shows the same STELLA word cards, German alphabet + letter combinations and Persian
// track (alphabet, reading, listening, numbers) as the mobile app. Audio paths point at
// the clips already uploaded to the public `exams` bucket.
//
//   node --experimental-strip-types scripts/sync-practice-extras.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const webRoot = path.resolve(import.meta.dirname, '..');
const academyRoot = path.resolve(
  process.env.DUVELA_ACADEMY_HUB || path.join(webRoot, '..', 'vela academy hub'),
);
const hub = (file) => import(pathToFileURL(path.join(academyRoot, 'shared', file)).href);

const stella = await hub('stella-word-bank.ts');
const german = await hub('german-alphabet-data.ts');
const persian = await hub('persian-practice-data.ts');
const reading = await hub('persian-reading-data.ts');
const listening = await hub('persian-listening-data.ts');
const numbers = await hub('persian-numbers-data.ts');
const glossary = await hub('practice-mini-games-glossary.ts');

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Same rule as normalizePracticeHintSource in the Hub (that module is not importable here).
const glossKey = (gloss) => gloss.split(/[;,/|]/)[0].split('(')[0].replace(/\s+/g, ' ').trim();

const stellaBank = {};
for (const [webLang, target] of [['de', 'german'], ['en', 'english'], ['es', 'spanish']]) {
  stellaBank[webLang] = {};
  for (const level of LEVELS) {
    stellaBank[webLang][level] = stella.getStellaCardsAtLevel(target, level).map((card) => ({
      word: card.word,
      meaning: card.meaning,
      pos: card.partOfSpeech,
      example: card.example || undefined,
    }));
  }
}

const germanAlphabet = {
  letters: german.GERMAN_ALPHABET.map((letter) => ({
    id: letter.id,
    letter: `${letter.upper}${letter.lower}`,
    name: letter.name,
    sound: letter.sound,
    example: letter.example.word,
    meaning: letter.example.meaning,
    note: letter.note,
    speech: german.getGermanLetterSpeech(letter),
    exampleSpeech: german.getGermanExampleSpeech(letter),
    audio: german.getGermanLetterAudioPath(letter),
    exampleAudio: german.getGermanExampleAudioPath(letter),
  })),
  combos: german.GERMAN_LETTER_COMBOS.map((combo) => ({
    id: combo.id,
    letter: combo.combo,
    name: `${combo.example.noun}, ${combo.also}`,
    sound: combo.sound,
    quizHint: combo.example.noun,
    example: combo.example.word,
    meaning: combo.example.meaning,
    note: combo.note,
    speech: german.getGermanComboSpeech(combo),
    exampleSpeech: german.getGermanComboExampleSpeech(combo),
    audio: german.getGermanComboAudioPath(combo),
    exampleAudio: german.getGermanComboExampleAudioPath(combo),
  })),
};

const persianTrack = {
  alphabet: persian.PERSIAN_ALPHABET.map((letter) => {
    const forms = persian.getPersianLetterForms(letter);
    return {
      id: letter.id,
      letter: letter.letter,
      name: letter.name,
      sound: letter.sound,
      nonJoining: Boolean(letter.nonJoining),
      forms: [forms.final, forms.medial, forms.initial, forms.isolated],
      example: letter.example.fa,
      translit: letter.example.translit,
      meaning: letter.example.meaning,
      note: letter.note,
      speech: persian.getPersianLetterSpeech(letter),
      exampleSpeech: persian.asSpokenWord(letter.example.spoken),
      audio: persian.getPersianLetterAudioPath(letter),
      exampleAudio: persian.getPersianExampleAudioPath(letter),
    };
  }),
  readingWords: reading.PERSIAN_READING_WORDS.map((word) => ({
    fa: word.fa,
    vowelled: word.vowelled,
    translit: word.translit,
    meaning: word.meaning,
    audio: reading.getPersianReadingClip(word).storagePath,
    speech: reading.getPersianReadingClip(word).text,
  })),
  listeningWords: listening.PERSIAN_LISTENING_WORDS.map((word) => ({
    fa: word.fa,
    translit: word.translit,
    meaning: {
      en: glossary.getMiniGamesGloss(glossKey(word.gloss), 'en'),
      ru: glossary.getMiniGamesGloss(glossKey(word.gloss), 'ru'),
    },
    audio: listening.getPersianListeningClip(word).storagePath,
    speech: listening.getPersianListeningClip(word).text,
  })),
  numbers: numbers.PERSIAN_NUMBER_ITEMS.map((item) => ({
    id: item.id,
    section: item.section,
    fa: item.fa,
    translit: item.translit,
    value: item.value,
    meaning: item.meaning,
    note: item.note,
    audio: numbers.getPersianNumberClip(item).storagePath,
    speech: numbers.getPersianNumberClip(item).text,
  })),
};

// Mini grammar, A1–C1 (50 tasks per level), with prompt/topic/explanation in English
// and Russian. Options keep the bank order (answer first); the screen shuffles them.
persianTrack.grammar = {};
for (const locale of ['en', 'ru']) {
  persianTrack.grammar[locale] = {};
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
    persianTrack.grammar[locale][level] = persian.getPersianGrammarTasks(level, locale).map((task) => ({
      id: task.id,
      prompt: task.prompt,
      sentence: task.sentence,
      options: task.options,
      answer: task.answer,
      explanation: task.explanation,
      topic: task.topic,
    }));
  }
}

const payload = {
  schemaVersion: 1,
  source: 'vela-academy-hub/shared (stella-word-bank, german-alphabet-data, persian-*)',
  stella: stellaBank,
  germanAlphabet,
  persian: persianTrack,
};

const outputFile = path.join(webRoot, 'web', 'content', 'practice-extras.js');
// U+2028/U+2029 are valid in JSON but end a line in older JS parsers.
const json = JSON.stringify(payload).split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');
await fs.writeFile(outputFile, `window.DuvelaPracticeExtrasData=${json};\n`);

const count = (bank) => Object.values(bank).reduce((sum, level) => sum + level.length, 0);
console.log(
  `practice-extras.js: STELLA de ${count(stellaBank.de)} / en ${count(stellaBank.en)} / es ${count(stellaBank.es)} words,`,
  `German ${germanAlphabet.letters.length} letters + ${germanAlphabet.combos.length} combos,`,
  `Persian ${persianTrack.alphabet.length} letters, ${persianTrack.readingWords.length} reading,`,
  `${persianTrack.listeningWords.length} listening, ${persianTrack.numbers.length} numbers,`,
  `${Object.values(persianTrack.grammar.en).reduce((sum, list) => sum + list.length, 0)} grammar tasks;`,
  `${Math.round(json.length / 1024)} KB`,
);
