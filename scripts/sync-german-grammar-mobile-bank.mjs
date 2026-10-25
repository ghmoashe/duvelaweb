import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const mobileRoot = path.resolve(webRoot, '..', 'vela academy hub');
const grammarSourcePath = path.join(mobileRoot, 'features', 'native-flow', 'native-practice-grammar-task-screen.tsx');
const c2SourcePath = path.join(mobileRoot, 'shared', 'german-grammar-c2-data.ts');
const grammarSource = fs.readFileSync(grammarSourcePath, 'utf8');
const c2Source = fs.readFileSync(c2SourcePath, 'utf8');

function balanced(source, marker, open, close) {
  const markerAt = source.indexOf(marker);
  if (markerAt < 0) throw new Error(`Missing ${marker}`);
  const start = source.indexOf(open, markerAt + marker.length);
  if (start < 0) throw new Error(`Missing ${open} after ${marker}`);
  let depth = 0, quote = '', escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unclosed ${marker}`);
}

function functionSource(source, marker, nextMarker) {
  const start = source.indexOf(marker);
  const end = source.indexOf(nextMarker, start);
  if (start < 0 || end < 0) throw new Error(`Could not extract ${marker}`);
  return source.slice(start, end);
}

function evalObject(literal, label) {
  try { return Function(`"use strict"; return (${literal});`)(); }
  catch (error) { throw new Error(`Could not evaluate ${label}: ${error.message}`); }
}

const baseTopics = evalObject(balanced(grammarSource, 'const germanGrammarTopics: GermanGrammarTopic[] =', '[', ']'), 'germanGrammarTopics');
const extensions = evalObject(balanced(grammarSource, 'const germanGrammarLessonExtensions: Partial<Record<string, GermanGrammarLessonExtension>> =', '{', '}'), 'germanGrammarLessonExtensions');
const c2Literal = balanced(c2Source, 'export const germanGrammarC2Topics: GermanGrammarC2Topic[] =', '[', ']');
const c2Exercises = (topicId, skillTag, seeds) => seeds.map(([sentence, answer, distractorA, distractorB], index) => ({
  answer, feedbackEn: `The precise form here is “${answer}”.`, feedbackRu: `Здесь точная форма — «${answer}».`, feedbackTr: `Burada en doğru biçim “${answer}”.`,
  id: `${topicId}-exercise-${index + 1}`, options: [answer, distractorA, distractorB], prompt: 'Wähle die stilistisch und grammatisch präziseste Form.', sentence, skillTag,
  type: index % 3 === 0 ? 'transform' : index % 3 === 1 ? 'fix-error' : 'choose',
}));
const c2Topics = Function('exercises', `"use strict"; return (${c2Literal});`)(c2Exercises);

let generatedSource = functionSource(grammarSource, 'function getGeneratedGermanExerciseSeeds', 'function getGermanTopicExercises');
generatedSource = generatedSource.replace(/function getGeneratedGermanExerciseSeeds\(topic:\s*GermanGrammarTopic\):\s*GermanExerciseSeed\[\]/, 'function getGeneratedGermanExerciseSeeds(topic)');
const getGeneratedGermanExerciseSeeds = Function(`"use strict"; ${generatedSource}; return getGeneratedGermanExerciseSeeds;`)();

function clean(value) { return String(value ?? '').replace(/Ã¼/g, 'ü').replace(/Ã¶/g, 'ö').replace(/Ã¤/g, 'ä').replace(/ÃŸ/g, 'ß'); }
function sourceHash() { return crypto.createHash('sha256').update(grammarSource).update(c2Source).digest('hex'); }
function normalizedExercises(topic, extension) {
  const generated = getGeneratedGermanExerciseSeeds(topic);
  const intensive = new Set(['a1-personalpronomen-sein']);
  const total = intensive.has(topic.id) ? 30 : 15;
  if (generated.length) return Array.from({ length: total }, (_, index) => {
    const seed = generated[index % generated.length];
    return {
      id: `${topic.id}-exercise-${index + 1}`, answer: clean(seed.answer), options: (function () { var options = seed.options.map(clean), answer = clean(seed.answer), index = options.findIndex(function (option) { return option.toLocaleLowerCase() === answer.toLocaleLowerCase(); }); if (index >= 0) options[index] = answer; else options.unshift(answer); return options; })(), prompt: clean(seed.prompt), sentence: clean(seed.sentence),
      feedbackEn: `Use “${clean(seed.answer)}” here. ${clean(topic.ruleEn)}`,
      feedbackRu: `Здесь нужен ответ «${clean(seed.answer)}». ${clean(topic.ruleRu)}`,
      feedbackTr: `Burada doğru cevap “${clean(seed.answer)}”. ${clean(topic.ruleTr)}`,
      type: seed.type || 'choose', skillTag: seed.skillTag || topic.focus,
    };
  });
  const source = [...(topic.exercises || []), ...((extension && extension.exercises) || [])];
  if (!source.length) return [];
  return Array.from({ length: total }, (_, index) => {
    const item = source[index % source.length];
    return { ...item, id: `${topic.id}-exercise-${index + 1}`, answer: clean(item.answer), options: (item.options || []).map(clean), prompt: clean(item.prompt), sentence: clean(item.sentence), feedbackEn: clean(item.feedbackEn), feedbackRu: clean(item.feedbackRu), feedbackTr: clean(item.feedbackTr) };
  });
}

const topics = [...baseTopics, ...c2Topics].map((raw) => {
  const extension = extensions[raw.id] || {};
  const topic = { ...raw, ...extension, exercises: normalizedExercises(raw, extension) };
  return {
    id: topic.id, level: topic.level, unit: clean(topic.unit), title: clean(topic.title), focus: clean(topic.focus), example: clean(topic.example),
    ruleDe: clean(topic.ruleDe), ruleEn: clean(topic.ruleEn), ruleRu: clean(topic.ruleRu), ruleTr: clean(topic.ruleTr),
    pattern: clean(topic.pattern), tips: Array.isArray(topic.tips) ? topic.tips.map(clean) : [], examples: Array.isArray(topic.examples) ? topic.examples.map(clean) : [],
    exercises: topic.exercises,
  };
});
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
for (const level of levels) {
  const selected = topics.filter((topic) => topic.level === level);
  if (!selected.length || selected.some((topic) => !topic.exercises.length)) throw new Error(`Incomplete mobile grammar bank for ${level}: ${selected.filter((topic) => !topic.exercises.length).map((topic) => topic.id).join(',')}`);
}
const bank = { source: 'Duvela Academy Hub Mobile Grammar Aktiv', sourceHash: sourceHash(), syncedAt: new Date().toISOString(), levels, topics };
const target = path.join(webRoot, 'web', 'content', 'german-grammar-mobile-bank.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `/* Generated by scripts/sync-german-grammar-mobile-bank.mjs. Do not edit manually. */\nwindow.DuvelaGermanGrammarMobileBank = Object.freeze(${JSON.stringify(bank)});\n`, 'utf8');
console.log(`Synced ${topics.length} Grammar Aktiv topics and ${topics.reduce((sum, topic) => sum + topic.exercises.length, 0)} exercises from Duvela Academy Hub Mobile.`);






