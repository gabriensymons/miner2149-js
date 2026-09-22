import assert from 'node:assert/strict';
import test from 'node:test';

import {
  difficultyFromLabel,
  selectAsteroid,
  surveyAsteroids,
} from '../scripts/asteroid-selection.js';
import { getDifficulty } from '../scripts/maps.js';

function scriptedRolls(labels, designations) {
  const l = [...labels];
  const d = [...designations];
  const order = [];

  return {
    order,
    rollDifficulty: () => { order.push('difficulty'); return l.shift(); },
    rollDesignation: () => { order.push('designation'); return d.shift(); },
  };
}

test('one asteroid is surveyed per probe', () => {
  const rolls = scriptedRolls(
    ['Class 1-Easiest', 'Class 5-Dangerous', 'Class 3-Few Mines'],
    ['A1', 'B2', 'C3'],
  );

  const asteroids = surveyAsteroids(3, rolls);

  assert.equal(asteroids.length, 3);
  assert.deepEqual(asteroids[1], { label: 'Class 5-Dangerous', designation: 'B2' });
});

// The two draws share one generator, so their order decides every result that
// follows. Hoisting either into its own loop would change the whole survey.
test('each probe rolls its class before its designation', () => {
  const rolls = scriptedRolls(
    ['Class 2-Smooth', 'Class 4-Rocky'],
    ['ZZ', 'YY'],
  );

  surveyAsteroids(2, rolls);

  assert.deepEqual(rolls.order, ['difficulty', 'designation', 'difficulty', 'designation']);
});

test('no probes means no draws at all', () => {
  const rolls = scriptedRolls([], []);

  assert.deepEqual(surveyAsteroids(0, rolls), []);
  assert.deepEqual(rolls.order, [], 'a zero-probe survey must not consume randomness');
});

test('the class digit is read positionally, as the original reads it', () => {
  assert.equal(difficultyFromLabel('Class 1-Easiest'), 1);
  assert.equal(difficultyFromLabel('Class 5-Dangerous'), 5);
});

// Guards the positional read against a typo in the label map: if a label's
// shape ever changes, this fails rather than silently yielding NaN difficulty.
test('every label the game can roll parses to its own class', () => {
  const seen = new Set();

  for (let i = 0; i < 500; i++) seen.add(getDifficulty());

  assert.equal(seen.size, 5, 'all five classes are reachable');

  for (const label of seen) {
    const difficulty = difficultyFromLabel(label);
    assert.ok(Number.isInteger(difficulty), `${label} parses to an integer`);
    assert.ok(difficulty >= 1 && difficulty <= 5, `${label} parses inside 1-5`);
    assert.ok(label.startsWith(`Class ${difficulty}`), `${label} parses to its own class`);
  }
});

test('picking an asteroid sets the class, the difficulty and the mining efficiency', () => {
  const asteroids = [
    { label: 'Class 1-Easiest', designation: 'A1' },
    { label: 'Class 4-Rocky', designation: 'B2' },
  ];

  assert.deepEqual(selectAsteroid(asteroids, 1), {
    asteroid: 'Class:4',
    difficulty: 4,
    // Source line 1110: meff = 110 - (diff * 10).
    miningEfficiency: 70,
  });
});

test('mining efficiency follows the source formula across all five classes', () => {
  const expected = { 1: 100, 2: 90, 3: 80, 4: 70, 5: 60 };

  for (const [difficulty, miningEfficiency] of Object.entries(expected)) {
    const label = `Class ${difficulty}-Whatever`;
    const selection = selectAsteroid([{ label, designation: 'XX' }], 0);

    assert.equal(selection.difficulty, Number(difficulty));
    assert.equal(selection.miningEfficiency, miningEfficiency);
    assert.equal(selection.asteroid, `Class:${difficulty}`);
  }
});
