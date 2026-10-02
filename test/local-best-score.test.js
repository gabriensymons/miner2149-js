import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PLACEHOLDER_RECORD,
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

test("an empty class reads as the source's placeholder, and a write persists without module state", () => {
  const storage = memoryStorage();

  assert.deepEqual(PLACEHOLDER_RECORD, { score: 5_000_000, name: 'Mr. Nobody' });
  assert.deepEqual(readLocalBestScore(storage, 'normal', 4), PLACEHOLDER_RECORD);
  writeLocalBestScore(storage, 'normal', 4, { score: 12_345_678, name: 'Ada' });
  assert.deepEqual(readLocalBestScore(storage, 'normal', 4), { score: 12_345_678, name: 'Ada' });
  assert.deepEqual(readLocalBestScore(memoryStorage({ 'miner2149.localBestScore': storage.getItem('miner2149.localBestScore') }), 'normal', 4),
    { score: 12_345_678, name: 'Ada' }, 'read back from what was stored');
});

test('every class keeps its own record in each category, and none overwrites another', () => {
  const storage = memoryStorage();

  writeLocalBestScore(storage, 'normal', 2, { score: 9_000_000, name: 'Ada' });
  writeLocalBestScore(storage, 'disaster', 2, { score: 40_000, name: 'Bo' });
  writeLocalBestScore(storage, 'normal', 5, { score: 6_000_000, name: 'Cy' });

  const bests = readLocalBestScores(storage);
  assert.deepEqual(bests.normal[2], { score: 9_000_000, name: 'Ada' });
  // A far lower Disaster Mode score is still that category's record. Ranking
  // them in one pool would make the harder category permanently unreachable.
  assert.deepEqual(bests.disaster[2], { score: 40_000, name: 'Bo' });
  assert.deepEqual(bests.normal[5], { score: 6_000_000, name: 'Cy' });
  for (const difficulty of [1, 3, 4]) assert.deepEqual(bests.normal[difficulty], PLACEHOLDER_RECORD);
  assert.deepEqual(Object.keys(bests.disaster), ['1', '2', '3', '4', '5']);
  assert.deepEqual(SCORE_CATEGORIES, ['normal', 'disaster']);
});

test('a write must name a category, a class 1-5, a score and a name of at most eight characters', () => {
  const storage = memoryStorage();
  const fine = { score: 1, name: 'Ada' };

  assert.throws(() => writeLocalBestScore(storage, 'sandbox', 1, fine), TypeError);
  for (const difficulty of [0, 6, 2.5, null]) assert.throws(() => writeLocalBestScore(storage, 'normal', difficulty, fine), TypeError);
  assert.throws(() => writeLocalBestScore(storage, 'normal', 1, { score: -1, name: 'Ada' }), TypeError);
  assert.throws(() => writeLocalBestScore(storage, 'normal', 1, { score: 1, name: 'Commander' }), TypeError);
  assert.throws(() => writeLocalBestScore(storage, 'normal', 1, { score: 1 }), TypeError);
  writeLocalBestScore(storage, 'normal', 1, { score: 1, name: 'Cmdr Ada' });
  assert.equal(readLocalBestScore(storage, 'normal', 1).name, 'Cmdr Ada');
});

test('a record from before categories goes into its own class in normal, and is kept below the placeholder', () => {
  // The old shape was a bare { score, difficulty }. Disaster Mode did not exist
  // when it was set, so it belongs in normal rather than being discarded.
  const legacy = memoryStorage({
    'miner2149.localBestScore': JSON.stringify({ score: 555, difficulty: 3 }),
  });

  const bests = readLocalBestScores(legacy);
  assert.deepEqual(bests.normal[3], { score: 555, name: '' });
  assert.deepEqual([bests.normal[2], bests.disaster[3]], [PLACEHOLDER_RECORD, PLACEHOLDER_RECORD]);
});

test('records from before classes go into the class each was set on, and a write keeps them', () => {
  const storage = memoryStorage({
    'miner2149.localBestScore': JSON.stringify({ normal: { score: 900_000, difficulty: 4 }, disaster: { score: 40_000, difficulty: 2 } }),
  });

  assert.deepEqual(readLocalBestScore(storage, 'normal', 4), { score: 900_000, name: '' });
  assert.deepEqual(readLocalBestScore(storage, 'disaster', 2), { score: 40_000, name: '' });

  writeLocalBestScore(storage, 'normal', 1, { score: 7_000_000, name: 'Ada' });
  assert.deepEqual(readLocalBestScore(storage, 'normal', 4), { score: 900_000, name: '' }, 'migrated on the way through');
  assert.deepEqual(readLocalBestScore(storage, 'disaster', 2), { score: 40_000, name: '' });
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

test('malformed local records safely read as the placeholder', () => {
  const malformed = [
    'nope', 'null', '7', '{}', '{"score":-1,"difficulty":2}', '{"score":1,"difficulty":0}',
    '{"normal":{"2":{"score":1}}}', '{"normal":{"2":{"score":1,"name":"Commander"}}}', '{"normal":{"2":{"score":"9","name":"Ada"}}}',
  ];
  for (const raw of malformed) {
    assert.deepEqual(readLocalBestScore(memoryStorage({ 'miner2149.localBestScore': raw }), 'normal', 2), PLACEHOLDER_RECORD, raw);
  }
  // A read for a class or category that does not exist is the placeholder too.
  assert.deepEqual(readLocalBestScore(memoryStorage(), 'normal', 0), PLACEHOLDER_RECORD);
  assert.deepEqual(readLocalBestScore(memoryStorage(), 'sandbox', 2), PLACEHOLDER_RECORD);
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
