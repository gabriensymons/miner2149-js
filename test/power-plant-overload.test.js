import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BLAST_FRAME_MS,
  CAPTIONS,
  DURATION_MS,
  overloadFrameAt,
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
