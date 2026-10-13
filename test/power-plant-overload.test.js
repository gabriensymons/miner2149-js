import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLAST_FRAME_MS,
  CAPTIONS,
  CONTAINED_CAPTION,
  CONTAINED_HOLD_MS,
  DURATION_MS,
  MISTAKE_PENALTY_MS,
  PENALTY_FLASH_MS,
  RESPONSE_NEWS,
  WRONG_UNIT_LOCKOUT_MS,
  advanceOverload,
  countdownFor,
  createOverload,
  faultCaption,
  faultsToContainFor,
  overloadFrame,
  overloadFrameAt,
  overloadNews,
  sparedSites,
  tapRepair,
  tapUnit,
  unitCountForClass,
} from '../scripts/power-plant-overload.js';
import { FUSE_RATINGS, KEY_GAP_MS, KEY_SHOW_MS } from '../scripts/breaker-games.js';

test('the scene runs 7.2 seconds: nine 600 ms pulses, then 400, 400, 400 and 600 ms of blast', () => {
  assert.deepEqual(BLAST_FRAME_MS, [400, 400, 400, 600]);
  assert.equal(DURATION_MS, 7200);
});

test('the plant pulses between its two bitmaps every 300 ms, starting on the first', () => {
  const pulses = [0, 299, 300, 599, 600, 5099, 5100, 5399].map((ms) => overloadFrameAt(ms).pulse);
  assert.deepEqual(pulses, ['a', 'a', 'b', 'b', 'a', 'a', 'b', 'b']);
});

test('"Red line on four!" holds for four pulses; the fifth pulse brings "It\'s going to blow!"', () => {
  assert.equal(overloadFrameAt(0).caption, CAPTIONS.redLine);
  assert.equal(overloadFrameAt(2399).caption, CAPTIONS.redLine);
  assert.equal(overloadFrameAt(2400).caption, CAPTIONS.goingToBlow, 'a == 5, on its first bitmap');
  assert.equal(overloadFrameAt(7199).caption, CAPTIONS.goingToBlow, 'and it is never cleared');
  assert.deepEqual(CAPTIONS, {
    redLine: '"Red line on four!"',
    goingToBlow: '"It\'s going to blow!"',
  });
});

test('the blast draws its four bitmaps one over another, and the last pulse stays under them', () => {
  const at = (ms) => overloadFrameAt(ms).blastFrames;
  assert.deepEqual(
    [5399, 5400, 5799, 5800, 6199, 6200, 6599, 6600, 7199].map(at),
    [0, 1, 1, 2, 2, 3, 3, 4, 4],
  );
  assert.equal(overloadFrameAt(7000).pulse, 'b', 'the source never erases the pulse bitmap');
});

test('the scene is complete once the last blast bitmap has been held for its 600 ms', () => {
  assert.equal(overloadFrameAt(7199).complete, false);
  assert.equal(overloadFrameAt(7200).complete, true);
  assert.equal(overloadFrameAt(60_000).blastFrames, 4, 'and nothing runs on past the end');
});

test('a time before the start reads as the first frame', () => {
  assert.deepEqual(overloadFrameAt(-50), overloadFrameAt(0));
});

// The player's response

const at = (state, ms) => advanceOverload(state, ms - state.elapsed);
const never = () => { throw new Error('the untouched path draws nothing'); };
/** A PocketC-style random that plays back a script of draws, then zeroes. */
function scripted(...draws) {
  const bounds = [];
  const random = (max) => { bounds.push(max); return draws.length ? draws.shift() : 0; };
  return { random, bounds };
}
const zeros = { random: () => 0 };

/** The presses that finish whatever repair is open, in order. */
function solution(game) {
  switch (game.kind) {
    case 'switches': return game.sequence.map((cell) => ({ kind: 'switch', ...cell }));
    case 'keypad': return game.sequence.map((key) => ({ kind: 'key', key }));
    case 'fuses': return [
      { kind: 'fuse', index: game.blown },
      { kind: 'part', index: game.tray.indexOf(game.ratings[game.blown]) },
      { kind: 'reset' },
    ];
    case 'breaker': return [{ kind: 'breaker' }, { kind: 'route', index: game.clearRoute }, { kind: 'prime' }, { kind: 'breaker' }];
    default: throw new Error(game.kind);
  }
}

/** Opens the lit unit's repair and finishes it, waiting out a keypad's showing first. */
function fix(state, random = zeros.random) {
  state = tapUnit(state, state.fault, { random });
  if (state.game.kind === 'keypad') state = advanceOverload(state, 10 * (KEY_SHOW_MS + KEY_GAP_MS));
  for (const target of solution(state.game)) state = tapRepair(state, target, { random });
  return state;
}

test('untouched, the scene is the source timeline at every moment, with unit four flashing', () => {
  const state = createOverload({ difficulty: 3 });
  for (let ms = 0; ms <= 7300; ms += 50) {
    const frame = overloadFrame(at(state, ms));
    const timeline = overloadFrameAt(ms);
    assert.deepEqual(
      [frame.pulse, frame.caption, frame.blastFrames, frame.complete, frame.countdown, frame.game],
      [timeline.pulse, timeline.caption, timeline.blastFrames, timeline.complete, null, null],
      `at ${ms} ms`,
    );
    assert.equal(frame.flashing, timeline.pulse === 'a' ? 4 : null);
  }
});

test('the class sets the units, the repairs to contain it, and the countdown', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(unitCountForClass), [4, 5, 6, 7, 8]);
  assert.deepEqual([1, 2, 3, 4, 5].map(faultsToContainFor), [1, 1, 2, 2, 3]);
  assert.deepEqual([1, 2, 3, 4, 5].map(countdownFor), [30_000, 26_000, 22_000, 18_000, 15_000]);
  assert.equal(MISTAKE_PENALTY_MS, 3000);
});

test('tapping the lit unit opens a repair, starts the clock, and stops the source\'s own timeline', () => {
  const { random, bounds } = scripted(0);
  // 1200 ms is on the first pulse bitmap, when an idle panel would light its unit.
  let state = tapUnit(at(createOverload({ difficulty: 3 }), 1200), 4, { random });

  assert.equal(bounds[0], 4, 'the repair is drawn from the four');
  assert.equal(state.game.kind, 'switches');
  assert.equal(overloadFrame(state).countdown, 22_000);
  assert.equal(overloadFrame(state).caption, '"Throw the switches!"');
  assert.equal(overloadFrame(state).flashing, null, 'no unit lit while a repair is open');

  state = at(state, 7200);
  const frame = overloadFrame(state);
  assert.deepEqual([frame.blastFrames, frame.complete, frame.countdown], [0, false, 16_000], 'past the source\'s blast, still running');
});

test('the countdown reaching zero blows the plant: the blast plays, then the scene ends', () => {
  let state = tapUnit(at(createOverload({ difficulty: 5 }), 0), 4, zeros);
  state = at(state, 14_999);
  assert.equal(overloadFrame(state).blastFrames, 0);
  state = at(state, 15_000);
  assert.equal(state.game, null, 'the open repair is abandoned');
  assert.deepEqual(
    [15_000, 15_400, 15_800, 16_200, 16_799].map((ms) => overloadFrame(at(state, ms)).blastFrames),
    [1, 2, 3, 4, 4],
  );
  assert.equal(overloadFrame(at(state, 16_799)).complete, false);
  assert.equal(overloadFrame(at(state, 16_800)).complete, true);
  assert.equal(overloadFrame(state).caption, CAPTIONS.goingToBlow);
  assert.equal(tapUnit(at(state, 15_100), 4, { random: never }).game, null, 'nothing opens once it has blown');
});

test('a mistake in a repair takes three seconds off the clock and flags it for a moment', () => {
  let state = tapUnit(at(createOverload({ difficulty: 3 }), 0), 4, zeros);
  const wrong = { kind: 'switch', column: 3, row: 3 };
  assert.notDeepEqual(state.game.sequence[0], { column: 3, row: 3 });
  state = tapRepair(at(state, 1000), wrong, zeros);

  assert.equal(overloadFrame(state).countdown, 22_000 - 1000 - MISTAKE_PENALTY_MS);
  assert.equal(overloadFrame(state).penalised, true);
  assert.equal(overloadFrame(at(state, 1000 + PENALTY_FLASH_MS)).penalised, false);
});

test('a mistake that empties the clock blows the plant then and there', () => {
  let state = tapUnit(at(createOverload({ difficulty: 5 }), 0), 4, zeros);
  state = at(state, 13_000);
  state = tapRepair(state, { kind: 'switch', column: 3, row: 3 }, zeros);
  assert.equal(state.blownAt, 13_000);
  assert.equal(overloadFrame(state).countdown, 0);
});

test('a finished repair fixes the fault, names the next unit, and the next repair is never the same kind', () => {
  // The repair (switches), its four cells, then the next fault.
  const { random, bounds } = scripted(0, 0, 0, 0, 0, 0);
  let state = fix(at(createOverload({ difficulty: 3 }), 500), random);
  assert.deepEqual(bounds, [4, 16, 15, 14, 13, 5]);

  assert.equal(state.faultsFixed, 1);
  assert.equal(state.game, null);
  assert.equal(state.fault, 1, 'never the unit just fixed');
  assert.equal(overloadFrame(state).caption, '"Red line on one!"');
  assert.equal(faultCaption(7), '"Red line on seven!"');

  state = at(state, 4500);
  const left = state.countdown;
  assert.ok(left < 22_000);
  const next = scripted(0);
  state = tapUnit(state, 1, next);
  assert.equal(state.countdown, left, 'one clock for the whole overload: the next repair does not reset it');
  assert.equal(next.bounds[0], 3, 'three kinds to choose from');
  assert.equal(state.game.kind, 'keypad', 'the switches just played are not offered again');
});

test('a wrong unit costs time once the clock is running, and trips the panel before it', () => {
  let state = tapUnit(at(createOverload({ difficulty: 3 }), 0), 2, { random: never });
  assert.equal(WRONG_UNIT_LOCKOUT_MS, 600);
  assert.equal(tapUnit(state, 4, { random: never }), state, 'tripped: the right unit opens nothing yet');
  assert.equal(tapUnit(at(state, 600), 4, zeros).countdown, 22_000, 'and does once the pulse is over');

  state = fix(at(createOverload({ difficulty: 3 }), 0));
  const before = state.countdown;
  state = tapUnit(state, 6, { random: never });
  assert.equal(state.countdown, before - MISTAKE_PENALTY_MS);
});

test('enough repairs contain it: the plant settles, never blows, and the scene ends after its hold', () => {
  let state = fix(at(createOverload({ difficulty: 1 }), 2100));
  assert.equal(state.faultsFixed, 1);
  assert.equal(state.containedAt, 2100);
  for (const ms of [2100, 2400, 5400, 6000, 3299]) {
    const frame = overloadFrame(at(state, ms));
    assert.deepEqual(
      [frame.pulse, frame.blastFrames, frame.flashing],
      ['a', 0, null],
      `at ${ms} ms`,
    );
  }
  assert.equal(overloadFrame(at(state, 2100)).caption, CONTAINED_CAPTION);
  assert.equal(overloadFrame(at(state, 2100 + CONTAINED_HOLD_MS - 1)).complete, false);
  assert.equal(overloadFrame(at(state, 2100 + CONTAINED_HOLD_MS)).complete, true);
  assert.equal(at(state, 60_000).blownAt, null, 'the clock stops once it is contained');
});

test('a class 5 overload takes three repairs to contain', () => {
  let state = at(createOverload({ difficulty: 5 }), 0);
  for (let fixed = 1; fixed <= 3; fixed += 1) {
    assert.equal(state.containedAt, null);
    state = fix(state);
    assert.equal(state.faultsFixed, fixed);
  }
  assert.notEqual(state.containedAt, null);
  assert.equal(state.blownAt, null);
});

test('before the clock starts, a tap once the source\'s blast has begun opens nothing', () => {
  const state = at(createOverload({ difficulty: 3 }), 5400);
  assert.equal(tapUnit(state, 4, { random: never }), state);
});

test('the dev panel can fix the countdown and the repair', () => {
  let state = createOverload({ difficulty: 2, countdownMs: 9000, kind: 'fuses' });
  state = tapUnit(state, 4, zeros);
  assert.equal(state.game.kind, 'fuses');
  assert.equal(state.countdown, 9000);
  assert.ok(state.game.ratings.every((rating) => FUSE_RATINGS.includes(rating)));
});

test('the savings are graded: the faults short of containment share the neighbours, the last saves the plant', () => {
  const plant = { row: 5 };
  const up = { row: 4 };
  const down = { row: 6 };
  const right = { row: 7 };
  const sites = [plant, up, down, right];

  assert.deepEqual(sparedSites(sites, 0, 3), [], 'nothing fixed is the source outcome');
  assert.deepEqual(sparedSites(sites, 1, 3), [up, down], 'half of three, rounded up, in the order rolled');
  assert.deepEqual(sparedSites(sites, 2, 3), [plant, up, down, right].slice(1));
  assert.deepEqual(sparedSites(sites, 3, 3), sites);
  assert.deepEqual(sparedSites(sites, 1, 2), [up, down, right], 'of two, the first saves every neighbour');
  assert.deepEqual(sparedSites(sites, 1, 1), sites, 'of one, the only repair saves everything');
  assert.deepEqual(sparedSites(sites, 0, 1), []);
  assert.deepEqual(sparedSites([plant], 1, 3), [], 'with no neighbours hit, a partial answer saves nothing');
});

test('the news says what the response saved, and nothing saved keeps the source\'s words', () => {
  const source = 'DISASTER: The power plant has overloaded and exploded. Nearby buildings destroyed.';
  const sites = [{ row: 5 }, { row: 4 }, { row: 6 }, { row: 7 }];
  assert.equal(overloadNews(source, sites, 0, 3), source);
  assert.equal(overloadNews(source, sites, 1, 3), RESPONSE_NEWS.someSaved);
  assert.equal(overloadNews(source, sites, 2, 3), RESPONSE_NEWS.neighboursSaved);
  assert.equal(overloadNews(source, sites, 3, 3), RESPONSE_NEWS.contained);
  assert.equal(overloadNews(source, sites, 1, 1), RESPONSE_NEWS.contained);
  assert.equal(overloadNews(source, [{ row: 5 }], 2, 3), source, 'no neighbours hit, nothing to tell');
});
