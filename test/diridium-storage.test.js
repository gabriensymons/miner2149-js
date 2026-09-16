import assert from 'node:assert/strict';
import test from 'node:test';

import { getDiridiumStorageState } from '../scripts/diridium-storage.js';

const stateAtPercent = percentage => getDiridiumStorageState({
  diridium: percentage * 5,
  processorCount: 1,
  storageCount: 0,
});

test('getDiridiumStorageState selects the four fill bands at their exact boundaries', () => {
  for (const [percentage, expectedFill] of [
    [0, 'empty'],
    [32, 'empty'],
    [33, 'third'],
    [65, 'third'],
    [66, 'twoThirds'],
    [98, 'twoThirds'],
    [99, 'full'],
  ]) {
    assert.deepEqual(stateAtPercent(percentage), {
      capacity: 500,
      fill: expectedFill,
      percentage,
    });
  }
});

test('getDiridiumStorageState includes processor capacity', () => {
  assert.deepEqual(getDiridiumStorageState({
    diridium: 500,
    processorCount: 1,
    storageCount: 0,
  }), {
    capacity: 500,
    fill: 'full',
    percentage: 100,
  });
});

test('getDiridiumStorageState treats positive inventory without capacity as full', () => {
  assert.deepEqual(getDiridiumStorageState({
    diridium: 1,
    processorCount: 0,
    storageCount: 0,
  }), {
    capacity: 0,
    fill: 'full',
    percentage: Infinity,
  });
});
