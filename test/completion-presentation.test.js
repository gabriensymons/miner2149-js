import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCompletionPresentation } from '../scripts/completion-presentation.js';

const completion = {
  creditsEarned: 1234,
  diridiumRemaining: 56,
  sellPrice: 7,
  totalCredits: 1626,
  futureUse: 'amusement-park',
};

test('completion presentation includes every source score line and its future-use message', () => {
  assert.deepEqual(buildCompletionPresentation(completion), {
    lines: [
      'Mission Status: COMPLETE',
      'Credits Earned: 1234',
      'Diridium Remaining: 56',
      'Current Selling Price: 7',
      'Total Credits: 1626',
    ],
    futureMessage: 'You have completed your mission. The mine soon will be turned into an amusement park.',
  });
});

test('completion presentation supports all three source future uses', () => {
  assert.match(buildCompletionPresentation({ ...completion, futureUse: 'luxury-hotel-and-spa' }).futureMessage, /luxury hotel and spa/);
  assert.match(buildCompletionPresentation({ ...completion, futureUse: 'military-base' }).futureMessage, /military base/);
  assert.throws(() => buildCompletionPresentation({ ...completion, futureUse: 'moon' }), /Unknown future use/);
});
