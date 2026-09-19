import assert from 'node:assert/strict';
import test from 'node:test';

import { cloneMaps, setSite } from '../scripts/map-grid.js';
import { gameDataInit } from '../scripts/gamedata.js';

const maps = () => structuredClone(gameDataInit.maps);

test('cloning copies every level, row and site', () => {
  const original = maps();
  const copy = cloneMaps(original);

  assert.deepEqual(copy, original);
  assert.notEqual(copy, original);
  assert.notEqual(copy.level2, original.level2);
  assert.notEqual(copy.level2.row4, original.level2.row4);
});

test('a clone cannot be changed through the original, or the other way', () => {
  const original = maps();
  const copy = cloneMaps(original);

  copy.level1.row0[0] = 9;
  original.level3.row9[9] = 7;

  assert.notEqual(original.level1.row0[0], 9);
  assert.notEqual(copy.level3.row9[9], 7);
});

test('setting a site returns new maps and leaves the original alone', () => {
  const original = maps();
  const before = original.level2.row3[5];

  const next = setSite(original, 'level2', 3, 5, 1208);

  assert.equal(next.level2.row3[5], 1208);
  assert.equal(original.level2.row3[5], before);
  assert.notEqual(next, original);
});

test('setting a site changes that site and nothing else', () => {
  const original = maps();
  const next = setSite(original, 'level1', 0, 0, 99);

  next.level1.row0[0] = original.level1.row0[0];
  assert.deepEqual(next, original);
});

test('changes compose, which is how one build writes two levels', () => {
  // A diridium mine writes its own site and the shaft on the level below. The
  // player should see one change, so the caller builds both up and commits once.
  const original = maps();

  const next = setSite(setSite(original, 'level1', 2, 4, 8), 'level2', 2, 4, 1208);

  assert.equal(next.level1.row2[4], 8);
  assert.equal(next.level2.row2[4], 1208);
  assert.equal(original.level1.row2[4], gameDataInit.maps.level1.row2[4]);
});

test('an impossible site is refused rather than written into nothing', () => {
  // Writing into `undefined` would surface much later as a map quietly missing
  // a change, which is the hardest kind of map bug to trace back.
  const original = maps();

  assert.throws(() => setSite(original, 'level4', 0, 0, 1), /no site at level4 row0/);
  assert.throws(() => setSite(original, 'level1', 10, 0, 1), /no site at level1 row10/);
  assert.throws(() => setSite(original, 'level1', 0, 10, 1), /column 10 is outside/);
  assert.throws(() => setSite(original, 'level1', 0, -1, 1), /column -1 is outside/);
});
