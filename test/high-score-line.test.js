import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_BOARD, createHighScoreLine, formatHighScore, readLastBoard } from '../scripts/high-score-line.js';
import { PLACEHOLDER_RECORD, writeLocalBestScore } from '../scripts/local-best-score.js';

// Which record the start screen's one line shows, and how it is worded.

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

function build(storage = memoryStorage()) {
  const label = { text: '', setText(line) { this.text = line; } };
  return { label, storage, line: createHighScoreLine({ label, storage }) };
}

const colony = (change = {}) => ({ day: 40, daysOutsideDisasterMode: 40, difficulty: 3, asteroid: 'Class:3', ...change });

test("the line is the source's own wording", () => {
  assert.equal(formatHighScore(PLACEHOLDER_RECORD), 'Hi Score:5000000 by Mr. Nobody');
  assert.equal(formatHighScore({ score: 6000000, name: '' }), 'Hi Score:6000000 by ');
});

test('before any colony, the line is class 1 in normal -- the placeholder until one is set', () => {
  const { label, storage, line } = build();
  assert.deepEqual(readLastBoard(storage), DEFAULT_BOARD);
  assert.deepEqual(DEFAULT_BOARD, { category: 'normal', difficulty: 1 });

  line.showLast();
  assert.equal(label.text, 'Hi Score:5000000 by Mr. Nobody');
  writeLocalBestScore(storage, 'normal', 1, { score: 7000000, name: 'Ada' });
  line.showLast();
  assert.equal(label.text, 'Hi Score:7000000 by Ada');
});

test("a colony shows its own class and category, and is remembered for the next start", () => {
  const storage = memoryStorage();
  writeLocalBestScore(storage, 'normal', 3, { score: 8000000, name: 'Bo' });
  writeLocalBestScore(storage, 'disaster', 3, { score: 6500000, name: 'Cy' });
  writeLocalBestScore(storage, 'normal', 1, { score: 9000000, name: 'Ada' });
  const { label, line } = build(storage);

  line.showColony(colony());
  assert.equal(label.text, 'Hi Score:8000000 by Bo');
  line.showColony(colony({ daysOutsideDisasterMode: 0 }));
  assert.equal(label.text, 'Hi Score:6500000 by Cy', 'never left Disaster Mode');

  const next = build(storage);
  next.line.showLast();
  assert.equal(next.label.text, 'Hi Score:6500000 by Cy', 'the board of the last colony played');
});

test('a colony without a real class leaves the last board on the line', () => {
  const storage = memoryStorage();
  writeLocalBestScore(storage, 'normal', 2, { score: 8000000, name: 'Bo' });
  const { label, line } = build(storage);
  line.showColony(colony({ difficulty: 2 }));

  line.showColony(colony({ difficulty: 0, asteroid: '' }));
  assert.equal(label.text, 'Hi Score:8000000 by Bo');
  assert.deepEqual(readLastBoard(storage), { category: 'normal', difficulty: 2 });
});

test('an unreadable or unwritable board falls back without failing the screen', () => {
  for (const raw of ['nope', '{"category":"sandbox","difficulty":2}', '{"category":"normal","difficulty":9}']) {
    assert.deepEqual(readLastBoard(memoryStorage({ 'miner2149.highScoreBoard': raw })), DEFAULT_BOARD, raw);
  }
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  const { label, line } = build(broken);
  assert.doesNotThrow(() => line.showColony(colony()));
  assert.equal(label.text, 'Hi Score:5000000 by Mr. Nobody');
});
