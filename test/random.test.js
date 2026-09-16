import assert from 'node:assert/strict';
import test from 'node:test';

import { pocketRandom, randomNum } from '../scripts/random.js';

// Pocket C random(max) is exclusive: Miner30Source.txt lines 2498-2501.
test('pocketRandom maps injected draws to integers from zero through max minus one', () => {
  assert.equal(pocketRandom(90, () => 0), 0);
  assert.equal(pocketRandom(90, () => 0.9999999999999999), 89);
});

test('randomNum remains available for existing inclusive-range callers', () => {
  const value = randomNum(4, 4);

  assert.equal(value, 4);
});
