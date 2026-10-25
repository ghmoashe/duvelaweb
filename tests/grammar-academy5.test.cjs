const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(root, '..', 'vela academy hub');
const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
const study = fs.readFileSync(path.join(root, 'web/app-feature-study.js'), 'utf8');
const generated = fs.readFileSync(path.join(root, 'web/content/german-grammar-mobile-bank.js'), 'utf8');
const bank = JSON.parse(generated.match(/Object\.freeze\((.*)\);\s*$/s)[1]);

function mobileHash() {
  const screen = fs.readFileSync(path.join(mobileRoot, 'features/native-flow/native-practice-grammar-task-screen.tsx'));
  const c2 = fs.readFileSync(path.join(mobileRoot, 'shared/german-grammar-c2-data.ts'));
  return crypto.createHash('sha256').update(screen).update(c2).digest('hex');
}

test('Grammar Aktiv web bank is generated from the current Academy Hub Mobile source', () => {
  assert.ok(app.indexOf('german-grammar-mobile-bank.js') < app.indexOf('app-feature-study.js'));
  assert.equal(bank.source, 'Duvela Academy Hub Mobile Grammar Aktiv');
  assert.equal(bank.sourceHash, mobileHash());
  assert.deepEqual(bank.levels, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
});

test('shared Grammar Aktiv bank has answerable topics at every CEFR level', () => {
  for (const level of bank.levels) {
    const topics = bank.topics.filter((topic) => topic.level === level);
    assert.ok(topics.length, `missing ${level} topics`);
    for (const topic of topics) {
      assert.ok(topic.ruleDe && topic.ruleEn && topic.ruleRu, topic.id);
      assert.ok(topic.exercises.length >= 15, topic.id);
      for (const exercise of topic.exercises) {
        assert.ok(exercise.answer, exercise.id);
        assert.ok(exercise.options.includes(exercise.answer), exercise.id);
      }
    }
  }
});

test('web Grammar Aktiv uses mobile topics and authoritative feedback rather than a curated subset', () => {
  for (const marker of ['DuvelaGermanGrammarMobileBank', 'grammarAcademyTopics', 'grammarAcademyPool', 'grammarLocaleValue(item, \'feedback\')', 'GRAMMATIK AKTIV']) assert.ok(study.includes(marker), marker);
  assert.ok(!study.includes("return [\n        { id:'articles'"));
});

test('A2 Academy provides a compact learning path with only recorded topic progress', () => {
  const a2 = bank.topics.filter((topic) => topic.level === 'A2');
  assert.equal(a2.length, 15);
  assert.equal(a2.reduce((sum, topic) => sum + topic.exercises.length, 0), 225);
  for (const marker of ['grammarTopicProgress', 'recordGrammarTopicAnswer', 'grammarTopicMistakes', 'GRAMMAR_TOPIC_MASTERY_THRESHOLD', 'data-grammar-search', 'data-grammar-category', 'data-grammar-status', 'MISTAKE REVIEW', 'grammar-academy']) assert.ok(study.includes(marker), marker);
  assert.ok(!study.includes('verified exercises'));
});

test('a topic lesson has connected Learn, Examples, Practice and Review stages', () => {
  const perfekt = bank.topics.find((topic) => topic.id === 'a2-perfekt');
  assert.equal(perfekt.exercises.length, 15);
  for (const marker of ['grammarLessonTabs', 'grammarLearnHtml', 'grammarExamplesHtml', 'grammarPracticeHtml', 'grammarReviewHtml', 'data-grammar-practice', 'grammarLocaleValue(topic, \'rule\')', 'grammarExampleHtml']) assert.ok(study.includes(marker), marker);
  assert.match(study, /if \(!topic\.exercises\.length\) return/);
});

test('Grammar Aktiv exercise mode keeps the source answer and a compact four-option flow', () => {
  const perfekt = bank.topics.find((topic) => topic.id === 'a2-perfekt');
  for (const exercise of perfekt.exercises) {
    assert.ok(exercise.feedbackEn.includes(exercise.answer), `${exercise.id} feedback must name its answer`);
    assert.ok(exercise.feedbackRu.includes(exercise.answer), `${exercise.id} Russian feedback must name its answer`);
  }
  for (const marker of ['renderGrammarExercise', 'grammarExerciseOptions', 'options.length < 4', 'sourceAnswer:item.answer', 'data-grammar-option', 'data-grammar-continue', 'The correct form in this sentence']) assert.ok(study.includes(marker), marker);
  assert.ok(!study.includes('quizStep(studyState.data, renderGrammar'));
});

test('Word Usage begins with mobile-style cards and keeps the existing quick exercise', () => {
  for (const marker of ['MOBILE_WORD_USAGE_EXAMPLES', 'wordUsageCards', 'renderWordUsageCards', 'data-word-generate', 'data-word-reveal', 'data-word-rate', 'data-word-practice', "studyState.wordUsageMode='practice'"]) assert.ok(study.includes(marker), marker);
  assert.ok(study.includes("['weil','doch','während','sich freuen'"));
});

test('Word Usage Studio exposes reviewed word details without inventing metadata', () => {
  for (const marker of ['VERIFIED_WORD_USAGE_DETAILS', "'während'", 'renderWordUsageStudio', 'data-word-tab="grammar"', 'data-word-save', 'toggleSavedWord', 'data-word-practice', 'loadMistakes().filter']) assert.ok(study.includes(marker), marker);
  assert.match(study, /No reviewed grammar note is available/);
});

test('Guess the Article uses the generated Academy Hub Mobile bank', () => {
  const articleSource = fs.readFileSync(path.join(mobileRoot, 'shared', 'practice-article-exercises-data.ts'));
  const articleGenerated = fs.readFileSync(path.join(root, 'web/content/mobile-article-bank.js'), 'utf8');
  const articleBank = JSON.parse(articleGenerated.match(/Object\.freeze\((.*)\);\s*$/s)[1]);
  assert.equal(articleBank.sourceHash, crypto.createHash('sha256').update(articleSource).digest('hex'));
  assert.ok(articleBank.exercises.length > 3000);
  for (const marker of ['DuvelaMobileArticleBank', 'mobileArticleBank', 'article-exercise', 'data-art', 'mobile.length ? mobile']) assert.ok(study.includes(marker), marker);
});

test('Article game keeps one deck counter and exposes only data-backed review modes', () => {
  for (const marker of ["studyState.total=studyState.data.length", "data-article-mode=\"speed\"", "data-article-mode=\"mistakes\"", "item.kind==='article'", "item.hint?' · '", 'article-feedback']) assert.ok(study.includes(marker), marker);
});

test('Article mobile rows are normalized from article to the trainer art field', () => {
  assert.ok(study.includes('art:item.art||item.article'));
});

test('Memory Cards reuse the Academy Hub Mobile German word deck for the selected level', () => {
  assert.ok(app.indexOf('mobile-article-bank.js') < app.indexOf('app-feature-study.js'));
  for (const marker of ['mobileMemoryPairs', 'memoryPool', 'DuvelaMobileArticleBank', 'ACADEMY HUB MOBILE DECK', 'memory-match-grid']) assert.ok(study.includes(marker), marker);
  const articleGenerated = fs.readFileSync(path.join(root, 'web/content/mobile-article-bank.js'), 'utf8');
  const articleBank = JSON.parse(articleGenerated.match(/Object\.freeze\((.*)\);\s*$/s)[1]);
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    assert.ok(articleBank.exercises.filter((item) => item.level === level && item.article && item.noun && item.hint).length >= 6, level);
  }
});

test('Flashcards use a bounded source-backed session and persist four self-reported review grades', () => {
  for (const marker of ['FLASHCARD_SESSION_LIMIT = 20', 'FLASHCARD_SCHEDULER_VERSION', 'flashcardDueAt', 'recordFlashcardReview', 'data-flash-grade', 'flashcard-srs', 'mobileArticleBank().filter']) assert.ok(study.includes(marker), marker);
  assert.ok(study.includes("['again','1'"));
  assert.ok(study.includes("['hard','2'"));
  assert.ok(study.includes("['good','3'"));
  assert.ok(study.includes("['easy','4'"));
  assert.ok(study.includes('ease:Number(w.ease||2.5),repetitions:Number(w.reps||0)'));
  assert.ok(!study.includes('FSRS'));
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202610230003_flashcard_srs.sql'), 'utf8');
  for (const column of ['scheduler_version', 'last_reviewed_at', 'review_history']) assert.ok(migration.includes(column), column);
});
