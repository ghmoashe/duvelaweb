const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadEngine() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'web', 'duel-engine.generated.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source + ';this.engine = DuvelaDuelEngine;', context);
  return context.engine;
}

const engine = loadEngine();
const MODES = ['classic', 'article', 'sentence', 'prep', 'case', 'verb', 'sentence-check'];

test('the same match id yields the same deck for every mode', () => {
  for (const mode of MODES) {
    const input = { level: 'a2', mode, seed: '6f1c2d4e-match', target: 'german' };
    const first = engine.buildLiveDuelDeck(input);
    const second = engine.buildLiveDuelDeck(input);
    assert.ok(first.length > 0, mode + ' deck is empty');
    assert.deepEqual(JSON.parse(JSON.stringify(first)), JSON.parse(JSON.stringify(second)), mode);
  }
});

test('different match ids shuffle the classic bank differently', () => {
  const a = engine.buildLiveDuelDeck({ level: 'a2', mode: 'classic', seed: 'match-a', target: 'german' });
  const b = engine.buildLiveDuelDeck({ level: 'a2', mode: 'classic', seed: 'match-b', target: 'german' });
  assert.equal(a.length, engine.CLASSIC_BANK_QUESTION_COUNT);
  assert.notDeepEqual(a.map((item) => item.id), b.map((item) => item.id));
});

test('a published teacher practice wins over the built-in classic bank', () => {
  const practiceItems = [{ id: 'p1', practiceId: 'x', orderIndex: 0, type: 'mcq', prompt: 'Q', options: ['a', 'b'], answer: '1', explanation: null }];
  const deck = engine.buildLiveDuelDeck({ level: 'b1', mode: 'classic', practiceItems, seed: 'm', target: 'german' });
  assert.equal(deck.length, 1);
  assert.equal(deck[0].id, 'p1');
});

test('non-German classic duels use the sentence bank', () => {
  const deck = engine.buildLiveDuelDeck({ level: 'a1', mode: 'classic', seed: 'm', target: 'english' });
  assert.ok(deck.length > 0);
  assert.ok(deck.every((item) => item.type === 'mcq' && item.options.length >= 2));
});

test('round scoring matches the Hub rules', () => {
  const round = engine.buildDuelRound({ id: 'q', type: 'mcq', prompt: '', options: [], answer: '0' }, 0);
  assert.equal(round.duelType, 'blitz');
  assert.equal(round.roundSeconds, 11);
  assert.deepEqual(
    JSON.parse(JSON.stringify(engine.scoreDuelRound({ correct: true, duelType: 'blitz', previousCombo: 1, responseMs: 1000, roundSeconds: 11 }))),
    { awarded: 5, comboBonus: 1, nextCombo: 2, speedBonus: 2 },
  );
  assert.equal(engine.scoreDuelRound({ correct: false, duelType: 'trap', previousCombo: 4, responseMs: 500, roundSeconds: 13 }).awarded, 0);
  assert.equal(engine.INTRO_TOTAL_MS, 5400);
});
