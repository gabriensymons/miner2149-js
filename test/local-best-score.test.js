import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOARD_SIZE,
  NAME_MAX_LENGTH,
  PLACEHOLDER_RECORD,
  SCORE_CATEGORIES,
  SEEDED_ENTRIES,
  addToBoard,
  isNormalSession,
  nameBoardEntry,
  placeOnBoard,
  readBoard,
  readLocalBestScore,
  scoreCategory,
} from '../scripts/local-best-score.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
  };
}

const KEY = 'miner2149.localBestScore';
const names = (board) => board.map(({ name }) => name);
const archive = SEEDED_ENTRIES.map((entry) => ({ ...entry, seeded: true }));

test("an empty board is the colony's archive, Mr. Nobody's 5,000,000 on top", () => {
  const storage = memoryStorage();

  assert.deepEqual(PLACEHOLDER_RECORD, { score: 5_000_000, name: 'Mr. Nobody' });
  assert.deepEqual(readBoard(storage, 'normal', 4), archive);
  assert.deepEqual(readLocalBestScore(storage, 'normal', 4), PLACEHOLDER_RECORD);
  assert.equal(storage.getItem(KEY), null, 'the archive is never stored');
});

test("the archive is ten names a player could have entered, best first, the source's own on top", () => {
  assert.equal(SEEDED_ENTRIES.length, BOARD_SIZE);
  assert.equal(BOARD_SIZE, 10);
  assert.equal(SEEDED_ENTRIES[0], PLACEHOLDER_RECORD);
  for (const [index, { score, name }] of SEEDED_ENTRIES.entries()) {
    if (index > 0) {
      assert.ok(name.length <= NAME_MAX_LENGTH, `${name} fits the name prompt`);
      assert.ok(score < SEEDED_ENTRIES[index - 1].score, `${name} is below the one above`);
    }
  }
  // Mr. Nobody, at ten characters, is the source's own and never passed through the prompt.
  assert.equal(PLACEHOLDER_RECORD.name.length, 10);
});

test('a place is earned by beating an entry, so a tie goes below it, and the eleventh place is none', () => {
  const board = readBoard(memoryStorage(), 'normal', 2);
  assert.equal(placeOnBoard(board, 9_000_000), 0);
  assert.equal(placeOnBoard(board, 5_000_001), 0);
  assert.equal(placeOnBoard(board, 5_000_000), 1, 'equalling Mr. Nobody is not beating him');
  assert.equal(placeOnBoard(board, 1_000_000), 7);
  assert.equal(placeOnBoard(board, 250_001), 9);
  assert.equal(placeOnBoard(board, 250_000), null);
  assert.equal(placeOnBoard(board, 0), null);
});

test('an entry takes its place and pushes the archive down, and the last of it off the board', () => {
  const storage = memoryStorage();
  addToBoard(storage, 'normal', 2, { score: 1_000_000, name: '' });

  const board = readBoard(storage, 'normal', 2);
  assert.equal(board.length, BOARD_SIZE);
  assert.deepEqual(board[7], { score: 1_000_000, name: '', seeded: false });
  assert.deepEqual(names(board).slice(6, 10), ['CyBorg', '', 'RayGun', 'Sal Vage']);
  assert.ok(!names(board).includes('RowBot'), 'pushed off the end');
  assert.deepEqual(readBoard(memoryStorage({ [KEY]: storage.getItem(KEY) }), 'normal', 2), board, 'read back from storage');
});

test('a run equal to one already entered goes below it, and entries pushed off the board are not kept', () => {
  const storage = memoryStorage();
  for (let i = 0; i < 10; i += 1) addToBoard(storage, 'normal', 1, { score: 6_000_000 + i, name: `P${i}` });
  addToBoard(storage, 'normal', 1, { score: 6_000_005, name: 'Tie' });

  const board = readBoard(storage, 'normal', 1);
  assert.deepEqual(names(board), ['P9', 'P8', 'P7', 'P6', 'P5', 'Tie', 'P4', 'P3', 'P2', 'P1']);
  assert.equal(JSON.parse(storage.getItem(KEY)).normal[1].length, BOARD_SIZE, 'P0 and the archive are gone');
});

test("a run equal to the archive's sits below it: the archive was there first", () => {
  const storage = memoryStorage();
  addToBoard(storage, 'normal', 2, { score: 5_000_000, name: 'Ada' });

  assert.deepEqual(names(readBoard(storage, 'normal', 2)).slice(0, 3), ['Mr. Nobody', 'Ada', 'PickCard']);
});

test('every board is its own: each class, in each category', () => {
  const storage = memoryStorage();
  addToBoard(storage, 'normal', 2, { score: 9_000_000, name: 'Ada' });
  addToBoard(storage, 'disaster', 2, { score: 40_000, name: 'Bo' });

  assert.deepEqual(readLocalBestScore(storage, 'normal', 2), { score: 9_000_000, name: 'Ada' });
  assert.deepEqual(readBoard(storage, 'disaster', 2), archive, '40,000 does not make the Disaster Mode board');
  for (const difficulty of [1, 3, 4, 5]) assert.deepEqual(readBoard(storage, 'normal', difficulty), archive);
  assert.deepEqual(SCORE_CATEGORIES, ['normal', 'disaster']);
});

test('an entry made under no name takes its name later; with several, the lowest', () => {
  const storage = memoryStorage();
  addToBoard(storage, 'normal', 3, { score: 2_000_000, name: '' });
  addToBoard(storage, 'normal', 3, { score: 2_000_000, name: '' });
  nameBoardEntry(storage, 'normal', 3, { score: 2_000_000, name: 'Ada' });

  const mine = readBoard(storage, 'normal', 3).filter(({ seeded }) => !seeded);
  assert.deepEqual(names(mine), ['', 'Ada']);
  nameBoardEntry(storage, 'normal', 3, { score: 1, name: 'None' });
  assert.deepEqual(names(readBoard(storage, 'normal', 3).filter(({ seeded }) => !seeded)), ['', 'Ada'], 'no entry, no change');
});

test('an entry must name a category, a class 1-5, a score and a name of at most eight characters', () => {
  const storage = memoryStorage();
  const fine = { score: 1, name: 'Ada' };

  assert.throws(() => addToBoard(storage, 'sandbox', 1, fine), TypeError);
  for (const difficulty of [0, 6, 2.5, null]) assert.throws(() => addToBoard(storage, 'normal', difficulty, fine), TypeError);
  assert.throws(() => addToBoard(storage, 'normal', 1, { score: -1, name: 'Ada' }), TypeError);
  assert.throws(() => addToBoard(storage, 'normal', 1, { score: 1, name: 'Commander' }), TypeError);
  assert.throws(() => addToBoard(storage, 'normal', 1, { score: 1 }), TypeError);
  assert.throws(() => nameBoardEntry(storage, 'normal', 1, { score: 1, name: 'Commander' }), TypeError);
  assert.equal(storage.getItem(KEY), null, 'nothing written');
});

test('every older shape becomes a board entry in the class it was set on', () => {
  const read = (stored, category, difficulty) => readBoard(memoryStorage({ [KEY]: JSON.stringify(stored) }), category, difficulty)
    .filter(({ seeded }) => !seeded);

  // Before categories: one bare record, which belongs in normal.
  assert.deepEqual(read({ score: 6_000_000, difficulty: 3 }, 'normal', 3), [{ score: 6_000_000, name: '', seeded: false }]);
  // Before classes: one record per category.
  const preClass = { normal: { score: 900_000, difficulty: 4 }, disaster: { score: 7_000_000, difficulty: 2 } };
  assert.deepEqual(read(preClass, 'normal', 4), [{ score: 900_000, name: '', seeded: false }]);
  assert.deepEqual(read(preClass, 'disaster', 2), [{ score: 7_000_000, name: '', seeded: false }]);
  // Before boards (#53): one named record per class.
  assert.deepEqual(read({ normal: { 2: { score: 5_992_000, name: 'Ada' } }, disaster: {} }, 'normal', 2),
    [{ score: 5_992_000, name: 'Ada', seeded: false }]);
});

test('an older record kept below the board is not shown, and a new entry does not keep it', () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ score: 555, difficulty: 3 }) });
  assert.deepEqual(readBoard(storage, 'normal', 3), archive);
  addToBoard(storage, 'normal', 3, { score: 3_000_000, name: 'Ada' });
  assert.deepEqual(JSON.parse(storage.getItem(KEY)).normal[3], [{ score: 3_000_000, name: 'Ada' }]);
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

test('malformed local records safely read as the archive', () => {
  const malformed = [
    'nope', 'null', '7', '{}', '{"score":-1,"difficulty":2}', '{"score":1,"difficulty":0}',
    '{"normal":{"2":{"score":1}}}', '{"normal":{"2":[{"score":9000000,"name":"Commander"}]}}', '{"normal":{"2":[{"score":"9","name":"Ada"}]}}',
  ];
  for (const raw of malformed) {
    assert.deepEqual(readBoard(memoryStorage({ [KEY]: raw }), 'normal', 2), archive, raw);
  }
  // A board for a class or category that does not exist is the archive too.
  assert.deepEqual(readBoard(memoryStorage(), 'normal', 0), archive);
  assert.deepEqual(readBoard(memoryStorage(), 'sandbox', 2), archive);
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
