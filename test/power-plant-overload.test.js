import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLAST_FRAME_MS,
  CAPTIONS,
  DURATION_MS,
  overloadFrameAt,
  CONTAINED_CAPTION,
  CONTAINED_HOLD_MS,
  FAULTS_TO_CONTAIN,
  WRONG_UNIT_LOCKOUT_MS,
  advanceOverload,
  createOverload,
  faultCaption,
  overloadFrame,
  overloadNews,
  RESPONSE_NEWS,
  sparedSites,
  tapUnit,
  unitCountForClass,
} from '../scripts/power-plant-overload.js';

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
/** A PocketC-style random that hands back a script of draws, recording each bound. */
function scripted(...draws) {
  const bounds = [];
  const random = (max) => { bounds.push(max); return draws.shift(); };
  return { random, bounds };
}

test('untouched, the scene is the source timeline at every moment, with unit four flashing', () => {
  const state = createOverload({ difficulty: 3 });
  for (let ms = 0; ms <= 7300; ms += 50) {
    const frame = overloadFrame(at(state, ms));
    const timeline = overloadFrameAt(ms);
    assert.deepEqual(
      [frame.pulse, frame.caption, frame.blastFrames, frame.complete],
      [timeline.pulse, timeline.caption, timeline.blastFrames, timeline.complete],
      `at ${ms} ms`,
    );
    assert.equal(frame.flashing, timeline.pulse === 'a' && timeline.blastFrames === 0 ? 4 : null);
  }
});

test('the class sets how many units there are, four at class 1 and eight at class 5', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(unitCountForClass), [4, 5, 6, 7, 8]);
  assert.equal(overloadFrame(createOverload({ difficulty: 5 })).unitCount, 8);
});

test('fixing unit four names the next fault in the source\'s words, never the unit just fixed', () => {
  const { random, bounds } = scripted(3);
  const state = tapUnit(at(createOverload({ difficulty: 3 }), 1000), 4, { random });

  assert.deepEqual(bounds, [5], 'one draw among the six units other than four');
  assert.equal(state.fault, 5, 'draws at or past the fixed unit step over it');
  assert.equal(state.faultsFixed, 1);
  assert.equal(overloadFrame(state).caption, '"Red line on five!"');
  assert.equal(faultCaption(2), '"Red line on two!"');
  assert.equal(tapUnit(at(createOverload({ difficulty: 3 }), 0), 4, scripted(1)).fault, 2, 'draws below it do not');
});

test('"It\'s going to blow!" still arrives at the fifth pulse, and a later fault replaces it', () => {
  let state = tapUnit(at(createOverload({ difficulty: 3 }), 1000), 4, scripted(0));
  assert.equal(overloadFrame(at(state, 2400)).caption, '"It\'s going to blow!"');
  state = tapUnit(at(state, 3000), 1, scripted(4));
  assert.equal(overloadFrame(state).caption, '"Red line on six!"');
});

test('three faults fixed contain the overload: the plant stops pulsing, never blows, and the scene ends after its hold', () => {
  let state = createOverload({ difficulty: 3 });
  state = tapUnit(at(state, 500), 4, scripted(0));
  state = tapUnit(at(state, 1500), 1, scripted(0));
  state = tapUnit(at(state, 2000), 2, scripted());

  assert.equal(state.faultsFixed, FAULTS_TO_CONTAIN);
  for (const ms of [2000, 2400, 3000, 3199]) {
    const frame = overloadFrame(at(state, ms));
    assert.deepEqual(
      [frame.pulse, frame.caption, frame.blastFrames, frame.flashing, frame.complete],
      ['a', CONTAINED_CAPTION, 0, null, false],
      `at ${ms} ms: the source's own caption change is not shown after it is contained`,
    );
  }
  assert.equal(overloadFrame(at(state, 2000 + CONTAINED_HOLD_MS)).complete, true);
});

test('contained on the second pulse bitmap, the plant still settles on the first', () => {
  let state = createOverload({ difficulty: 3 });
  state = tapUnit(at(state, 300), 4, scripted(0));
  state = tapUnit(at(state, 400), 1, scripted(0));
  state = tapUnit(at(state, 2100), 2, scripted());
  assert.equal(overloadFrameAt(2100).pulse, 'b');
  assert.equal(overloadFrame(state).pulse, 'a');
});

test('the news says what the response saved, and nothing saved keeps the source\'s words', () => {
  const source = 'DISASTER: The power plant has overloaded and exploded. Nearby buildings destroyed.';
  const sites = [{ row: 5 }, { row: 4 }, { row: 6 }, { row: 5 }];
  assert.equal(overloadNews(source, sites, 0), source);
  assert.equal(overloadNews(source, sites, 1), RESPONSE_NEWS.someSaved);
  assert.equal(overloadNews(source, sites, 2), RESPONSE_NEWS.neighboursSaved);
  assert.equal(overloadNews(source, sites, 3), RESPONSE_NEWS.contained);
  assert.equal(overloadNews(source, [{ row: 5 }], 2), source, 'no neighbours hit, nothing to tell');
  assert.equal(overloadNews(source, [{ row: 5 }, { row: 4 }], 1), RESPONSE_NEWS.neighboursSaved, 'half of one is all of it');
});

test('a wrong unit trips the panel for one pulse, and taps in that time do nothing', () => {
  let state = tapUnit(at(createOverload({ difficulty: 3 }), 1000), 2, { random: never });
  assert.equal(WRONG_UNIT_LOCKOUT_MS, 600);
  assert.deepEqual([overloadFrame(state).locked, overloadFrame(state).wrongUnit], [true, 2]);

  const tripped = tapUnit(at(state, 1599), 4, { random: never });
  assert.equal(tripped.faultsFixed, 0, 'the right unit, but the panel is still tripped');
  state = at(state, 1600);
  assert.deepEqual([overloadFrame(state).locked, overloadFrame(state).wrongUnit], [false, null]);
  assert.equal(tapUnit(state, 4, scripted(0)).faultsFixed, 1);
});

test('once the blast has started, a tap changes nothing', () => {
  const state = at(createOverload({ difficulty: 3 }), 5400);
  assert.equal(tapUnit(state, 4, { random: never }), state);
  assert.equal(tapUnit(at(createOverload({ difficulty: 3 }), 5399), 4, scripted(0)).faultsFixed, 1);
});

test('the savings are graded: half the neighbours, then all of them, then the plant too', () => {
  const plant = { level: 'level1', row: 5, column: 5, value: 2 };
  const up = { level: 'level1', row: 4, column: 5, value: 3 };
  const down = { level: 'level1', row: 6, column: 5, value: 1 };
  const right = { level: 'level1', row: 5, column: 6, value: 2 };
  const sites = [plant, up, down, right];

  assert.deepEqual(sparedSites(sites, 0), [], 'nothing fixed is the source outcome');
  assert.deepEqual(sparedSites(sites, 1), [up, down], 'half of three, rounded up, in the order rolled');
  assert.deepEqual(sparedSites(sites, 2), [up, down, right]);
  assert.deepEqual(sparedSites(sites, 3), [plant, up, down, right]);
  assert.deepEqual(sparedSites([plant], 1), [], 'with no neighbours hit, one fault saves nothing');
  assert.deepEqual(sparedSites([plant], 3), [plant]);
});
