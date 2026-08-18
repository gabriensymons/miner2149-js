import assert from 'node:assert/strict';
import test from 'node:test';

import { createRowRevealStates } from '../scripts/map-animation.js';

test('createRowRevealStates inverts the row then reveals tiles from left to right', () => {
  const row = [1, 2, 3, 4];

  const states = createRowRevealStates(row);

  assert.deepEqual(states, [
    [-1, -2, -3, -4],
    [1, -2, -3, -4],
    [1, 2, -3, -4],
    [1, 2, 3, -4],
    [1, 2, 3, 4],
  ]);
  assert.deepEqual(row, [1, 2, 3, 4]);
});
