import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BREAKER_STEPS,
  GAME_KINDS,
  KEY_GAP_MS,
  KEY_SHOW_MS,
  advanceBreakerGame,
  breakerGameCaption,
  createBreakerGame,
  fusesFor,
  keypadLengthFor,
  keypadLit,
  keypadShowing,
  routesFor,
  switchLabel,
  switchesFor,
  tapBreakerGame,
} from '../scripts/breaker-games.js';

/** A PocketC-style random that plays back a script of draws, recording each bound. */
function scripted(...draws) {
  const bounds = [];
  const random = (max) => {
    bounds.push(max);
    const value = draws.length ? draws.shift() : 0;
    assert.ok(value >= 0 && value < max, `draw ${value} out of range for ${max}`);
    return value;
  };
  return { random, bounds };
}

function play(state, ...targets) {
  const results = [];
  for (const target of targets) {
    const answer = tapBreakerGame(state, target);
    results.push(answer.result);
    state = answer.state;
  }
  return { state, results };
}

// Choosing a repair

test('a repair is drawn from the four, and never the one just played', () => {
  const { random, bounds } = scripted(0);
  assert.equal(createBreakerGame({ difficulty: 3, random }).kind, 'switches');
  assert.equal(bounds[0], 4);

  const again = scripted(0);
  const next = createBreakerGame({ difficulty: 3, random: again.random, previousKind: 'switches' });
  assert.equal(again.bounds[0], 3, 'three left to choose from');
  assert.equal(next.kind, 'keypad');
  assert.deepEqual(GAME_KINDS, ['switches', 'keypad', 'fuses', 'breaker']);
});

// Throw the switches

test('the switch grid is 3x3 with three to throw at classes 1-2, and 4x4 with four or five above', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(switchesFor), [
    { size: 3, length: 3 }, { size: 3, length: 3 },
    { size: 4, length: 4 }, { size: 4, length: 4 }, { size: 4, length: 5 },
  ]);
});

test('the switches are distinct cells, labelled column letter then row number', () => {
  // Kind first, then each draw takes from what is left of the 16 cells.
  const { random, bounds } = scripted(0, 1, 0, 0, 0);
  const game = createBreakerGame({ difficulty: 3, random });
  assert.deepEqual(bounds, [4, 16, 15, 14, 13]);
  assert.deepEqual(game.sequence.map(switchLabel), ['B-1', 'A-1', 'C-1', 'D-1']);
});

test('switches thrown in order finish the repair; a wrong one is a mistake that loses nothing', () => {
  const game = createBreakerGame({ difficulty: 1, random: scripted(0, 4, 0, 0).random });
  const [first, second, third] = game.sequence;
  assert.deepEqual(game.sequence.map(switchLabel), ['B-2', 'A-1', 'B-1']);

  const { state, results } = play(
    game,
    { kind: 'switch', ...first },
    { kind: 'switch', column: 2, row: 2 },
    { kind: 'switch', ...first },
    { kind: 'switch', ...second },
    { kind: 'key', key: 1 },
    { kind: 'switch', ...third },
  );
  assert.deepEqual(results, ['progress', 'mistake', 'ignored', 'progress', 'ignored', 'done']);
  assert.equal(state.thrown, 3);
});

// Repeat the keypad

test('the keypad shows its code a key at a time, and ignores presses until it has finished', () => {
  const game = createBreakerGame({ difficulty: 3, random: scripted(1, 6, 2, 8, 0).random });
  assert.deepEqual(game.sequence, [7, 3, 9, 1]);
  assert.deepEqual([1, 2, 3, 4, 5].map(keypadLengthFor), [3, 3, 4, 4, 5]);

  const at = (ms) => advanceBreakerGame(game, ms);
  assert.equal(keypadLit(at(0)), 7);
  assert.equal(keypadLit(at(KEY_SHOW_MS)), null, 'a gap between keys');
  assert.equal(keypadLit(at(KEY_SHOW_MS + KEY_GAP_MS)), 3);
  assert.equal(breakerGameCaption(at(0)), '"Watch the keypad!"');
  assert.equal(tapBreakerGame(at(100), { kind: 'key', key: 7 }).result, 'ignored');

  const shown = at(4 * (KEY_SHOW_MS + KEY_GAP_MS));
  assert.equal(keypadShowing(shown), false);
  assert.equal(keypadLit(shown), null);
  assert.equal(breakerGameCaption(shown), '"Repeat the code!"');
});

test('the code entered in order finishes the repair; a wrong key costs time and is not counted', () => {
  const game = advanceBreakerGame(createBreakerGame({ difficulty: 1, random: scripted(1, 4, 4, 0).random }), 10_000);
  assert.deepEqual(game.sequence, [5, 5, 1]);
  const { results } = play(game, ...[5, 2, 5, 1].map((key) => ({ kind: 'key', key })));
  assert.deepEqual(results, ['progress', 'mistake', 'progress', 'done']);
});

// Replace the fuse

test('the fuse board grows with the class, and its ratings come from the tray', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(fusesFor), [
    { fuses: 3, parts: 3 }, { fuses: 4, parts: 3 }, { fuses: 4, parts: 4 },
    { fuses: 5, parts: 4 }, { fuses: 5, parts: 4 },
  ]);
  const game = createBreakerGame({ difficulty: 1, random: scripted(2, 0, 2, 1, 1).random });
  assert.deepEqual(game.ratings, ['10A', '20A', '15A']);
  assert.equal(game.blown, 1);
  assert.deepEqual(game.tray, ['10A', '15A', '20A']);
});

test('find the blown fuse, fit the same rating, reset: out of order is a mistake', () => {
  const game = createBreakerGame({ difficulty: 1, random: scripted(2, 0, 2, 1, 1).random });
  const { state, results } = play(
    game,
    { kind: 'reset' },
    { kind: 'fuse', index: 0 },
    { kind: 'fuse', index: 1 },
    { kind: 'part', index: 0 },
    { kind: 'part', index: 2 },
    { kind: 'switch', column: 0, row: 0 },
    { kind: 'reset' },
  );
  assert.deepEqual(results, ['mistake', 'mistake', 'progress', 'mistake', 'progress', 'ignored', 'done']);
  assert.equal(state.step, 'done');
  assert.deepEqual(
    ['find', 'fit', 'reset'].map((step) => breakerGameCaption({ ...game, step })),
    ['"Find the blown fuse!"', '"Fit the right fuse!"', '"Reset the board!"'],
  );
});

// Work the breaker

test('off, route around the burnt junction, prime, on: each only in its turn', () => {
  assert.deepEqual(BREAKER_STEPS, ['off', 'route', 'prime', 'on']);
  assert.deepEqual([1, 2, 3, 4, 5].map(routesFor), [2, 2, 3, 3, 3]);
  const game = createBreakerGame({ difficulty: 3, random: scripted(3, 1).random });
  assert.deepEqual([game.kind, game.routes, game.clearRoute, game.breakerOn], ['breaker', 3, 1, true]);

  const { state, results } = play(
    game,
    { kind: 'prime' },
    { kind: 'breaker' },
    { kind: 'route', index: 0 },
    { kind: 'route', index: 1 },
    { kind: 'breaker' },
    { kind: 'prime' },
    { kind: 'breaker' },
  );
  assert.deepEqual(results, ['mistake', 'progress', 'mistake', 'progress', 'mistake', 'progress', 'done']);
  assert.deepEqual([state.breakerOn, state.routed], [true, 1]);
  assert.deepEqual(
    [0, 1, 2, 3].map((step) => breakerGameCaption({ ...game, step })),
    ['"Turn off the breaker!"', '"Re-route the cable!"', '"Prime the fuse!"', '"Turn on the breaker!"'],
  );
});

test('the breaker is off between the first step and the last', () => {
  const game = createBreakerGame({ difficulty: 1, random: scripted(3, 0).random });
  const { state } = play(game, { kind: 'breaker' }, { kind: 'route', index: 0 }, { kind: 'prime' });
  assert.equal(state.breakerOn, false);
});

test('a draw out of range is refused rather than laid out', () => {
  assert.throws(() => createBreakerGame({ difficulty: 1, random: () => 4 }), RangeError);
});
