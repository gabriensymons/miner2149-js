import assert from 'node:assert/strict';
import test from 'node:test';

import { BOARD_SIZE, addToBoard, archiveFor, readBoard } from '../scripts/local-best-score.js';
import { boardRows, boardTitle } from '../scripts/records-board.js';

// The site's Records section, as the rows it shows.

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, String(value)); } };
}

test('a board is titled by its class, and Disaster Mode says so', () => {
  assert.equal(boardTitle({ category: 'normal', difficulty: 3 }), 'Class 3');
  assert.equal(boardTitle({ category: 'disaster', difficulty: 5 }), 'Class 5 · Disaster Mode');
});

test('an empty board shows the archive, numbered from 1, with thousands separated', () => {
  const rows = boardRows(readBoard(memoryStorage(), 'normal', 1));

  assert.equal(rows.length, BOARD_SIZE);
  assert.deepEqual(rows[0], { place: 1, name: 'Mr. Nobody', score: '5,000,000', archive: true });
  assert.deepEqual(rows.at(-1), { place: 10, name: archiveFor('normal', 1)[9].name, score: '250,000', archive: true });
});

test("a player's entry is not the archive's, and one entered under no name shows a dash", () => {
  const storage = memoryStorage();
  addToBoard(storage, 'normal', 2, { score: 6_000_000, name: 'Ada' });
  addToBoard(storage, 'normal', 2, { score: 1_000_000, name: '' });
  const rows = boardRows(readBoard(storage, 'normal', 2));

  assert.deepEqual(rows[0], { place: 1, name: 'Ada', score: '6,000,000', archive: false });
  assert.deepEqual(rows[1], { place: 2, name: 'Mr. Nobody', score: '5,000,000', archive: true });
  assert.deepEqual(rows.find(({ archive, place }) => !archive && place > 1), { place: 9, name: '—', score: '1,000,000', archive: false });
});
