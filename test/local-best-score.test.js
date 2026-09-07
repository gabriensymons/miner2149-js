import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isNormalSession,
  readLocalBestScore,
  writeLocalBestScore,
} from '../scripts/local-best-score.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test('local best score persists score and difficulty without module state', () => {
  const storage = memoryStorage();

  assert.deepEqual(readLocalBestScore(storage), { score: 0, difficulty: null });
  writeLocalBestScore(storage, { score: 12345, difficulty: 4 });
  assert.deepEqual(readLocalBestScore(storage), { score: 12345, difficulty: 4 });
});

test('malformed local records safely read as empty', () => {
  for (const raw of ['nope', '{}', '{"score":-1,"difficulty":2}', '{"score":1,"difficulty":0}']) {
    assert.deepEqual(
      readLocalBestScore(memoryStorage({ 'miner2149.localBestScore': raw })),
      { score: 0, difficulty: null },
    );
  }
});

test('only selected normal asteroid sessions are record eligible', () => {
  assert.equal(isNormalSession({ difficulty: 1, asteroid: 'Class:1' }), true);
  assert.equal(isNormalSession({ difficulty: 5, asteroid: 'Class:5' }), true);
  assert.equal(isNormalSession({ difficulty: 0, asteroid: '' }), false);
  assert.equal(isNormalSession({ difficulty: 3, asteroid: 'Class:5' }), false);
});

test('a developer-sandboxed session is never a normal session', () => {
  const ranked = { difficulty: 3, asteroid: 'Class:3' };
  assert.equal(isNormalSession(ranked), true);
  assert.equal(isNormalSession({ ...ranked, devSandbox: true }), false);
  // Disaster Mode is a different game rather than a harder setting of the same
  // one, so its scores are not comparable and are not recorded.
  assert.equal(isNormalSession({ ...ranked, disasterMode: true }), false);
  assert.equal(isNormalSession({ ...ranked, disasterMode: false }), true);
});
