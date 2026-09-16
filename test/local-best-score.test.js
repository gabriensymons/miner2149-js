import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SCORE_CATEGORIES,
  isNormalSession,
  readLocalBestScore,
  readLocalBestScores,
  scoreCategory,
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
  writeLocalBestScore(storage, 'normal', { score: 12345, difficulty: 4 });
  assert.deepEqual(readLocalBestScore(storage), { score: 12345, difficulty: 4 });
});

test('the two categories keep separate bests and cannot overwrite each other', () => {
  const storage = memoryStorage();

  writeLocalBestScore(storage, 'normal', { score: 900_000, difficulty: 2 });
  writeLocalBestScore(storage, 'disaster', { score: 40_000, difficulty: 2 });

  const bests = readLocalBestScores(storage);
  assert.deepEqual(bests.normal, { score: 900_000, difficulty: 2 });
  // A far lower Disaster Mode score is still that category's record. Ranking
  // them in one pool would make the harder category permanently unreachable.
  assert.deepEqual(bests.disaster, { score: 40_000, difficulty: 2 });
  assert.deepEqual(SCORE_CATEGORIES, ['normal', 'disaster']);
  assert.throws(() => writeLocalBestScore(storage, 'sandbox', { score: 1, difficulty: 1 }), TypeError);
});

test('a record written before categories existed is read as a normal-category best', () => {
  // The old shape was a bare { score, difficulty }. Disaster Mode did not exist
  // when it was set, so it belongs in normal rather than being discarded.
  const legacy = memoryStorage({
    'miner2149.localBestScore': JSON.stringify({ score: 555, difficulty: 3 }),
  });

  assert.deepEqual(readLocalBestScores(legacy), {
    normal: { score: 555, difficulty: 3 },
    disaster: { score: 0, difficulty: null },
  });
});

test('a colony counts as a Disaster Mode run only if it never left the mode', () => {
  const full = { day: 730, daysOutsideDisasterMode: 0 };
  assert.equal(scoreCategory(full), 'disaster');

  // Flipping it on for the last few days must not buy a Disaster Mode record
  // for a colony played on normal odds.
  assert.equal(scoreCategory({ day: 730, daysOutsideDisasterMode: 725 }), 'normal');
  // Nor does experimenting with it early and turning it back off.
  assert.equal(scoreCategory({ day: 730, daysOutsideDisasterMode: 700 }), 'normal');
  assert.equal(scoreCategory({ day: 730, daysOutsideDisasterMode: 730 }), 'normal');
  // An unplayed colony is not a Disaster Mode run by default.
  assert.equal(scoreCategory({ day: 0, daysOutsideDisasterMode: 0 }), 'normal');
  // A save from before the counter existed reads as normal rather than throwing.
  assert.equal(scoreCategory({ day: 730 }), 'normal');
});

test('the EM time shift cannot demote a full Disaster Mode run', () => {
  // The time shift moves `day` forward without a turn being played, so those
  // days belong to neither mode. Counting days OUTSIDE the mode is what makes
  // this work -- a counter of days inside it could never catch up to `day`.
  assert.equal(
    scoreCategory({ day: 760, daysOutsideDisasterMode: 0 }),
    'disaster',
    '30 days of time shift on top of a 730-day run is still a full run',
  );
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
  // Disaster Mode is NOT rejected here. A sandbox result was not earned; a
  // Disaster Mode result was earned harder. It gets its own category instead of
  // being thrown away alongside forced events.
  assert.equal(isNormalSession({ ...ranked, disasterMode: true }), true);
});
