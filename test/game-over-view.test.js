import assert from 'node:assert/strict';
import test from 'node:test';

import { describeEnding, showEnding } from '../scripts/game-over-view.js';

const completion = {
  creditsEarned: 1234,
  diridiumRemaining: 56,
  sellPrice: 7,
  totalCredits: 1626,
  futureUse: 'amusement-park',
};

test('a resignation reports the day and the credits it was given', () => {
  assert.deepEqual(describeEnding({ day: 40, credits: 812500 }).lines, [
    'Mission Status: RESIGNED on day 40',
    'Credits Remaining: 812500',
  ]);
});

test('a failure names its cause, for each way a colony can fail', () => {
  for (const cause of ['Death Rate Reached 100%', 'Worker Revolt', 'Insufficient Funds']) {
    assert.deepEqual(describeEnding({ failure: cause, day: 88, credits: 0 }).lines, [
      'Mission Status: FAILURE on day 88',
      `Cause: ${cause}`,
    ]);
  }
});

test('a completed mission lists its score and leaves the second line empty', () => {
  const { lines } = describeEnding({ completion, day: 730, credits: 1 });

  assert.equal(lines[0], [
    'Mission Status: COMPLETE',
    'Credits Earned: 1234',
    'Diridium Remaining: 56',
    'Current Selling Price: 7',
    'Total Credits: 1626',
  ].join('\n'));
  assert.equal(lines[1], '');
});

test('only a completed mission has something to say once game over is up', () => {
  assert.match(describeEnding({ completion, day: 730, credits: 1 }).followUp, /amusement park/);
  assert.equal(describeEnding({ failure: 'Worker Revolt', day: 9, credits: 1 }).followUp, null);
  assert.equal(describeEnding({ day: 9, credits: 1 }).followUp, null);
});

test('completion outranks failure, and failure outranks resignation', () => {
  assert.match(describeEnding({ completion, failure: 'Worker Revolt', day: 730, credits: 1 }).lines[0], /COMPLETE/);
  assert.match(describeEnding({ failure: 'Worker Revolt', day: 9, credits: 1 }).lines[0], /FAILURE/);
});

test('a completed mission is laid out from the corner, the others centred lower down', () => {
  assert.deepEqual(describeEnding({ completion, day: 730, credits: 1 }).layout, { anchor: [0, 0], position: [18, 20] });
  assert.deepEqual(describeEnding({ day: 9, credits: 1 }).layout, { anchor: [0.5, 0], position: [75, 37] });
  assert.deepEqual(describeEnding({ failure: 'x', day: 9, credits: 1 }).layout, { anchor: [0.5, 0], position: [75, 37] });
});

/** A stand-in for a Pixi BitmapText: records anchor, position and text. */
function line() {
  return {
    text: 'stale',
    anchor: { set(x, y) { this.value = [x, y]; } },
    position: { set(x, y) { this.value = [x, y]; } },
  };
}

test('showing an ending writes both lines and moves only the first', () => {
  const first = line();
  const second = line();

  showEnding({ first, second }, describeEnding({ completion, day: 730, credits: 1 }));

  assert.match(first.text, /^Mission Status: COMPLETE\n/);
  assert.deepEqual(first.anchor.value, [0, 0]);
  assert.deepEqual(first.position.value, [18, 20]);
  assert.equal(second.text, '', 'the stale text from an earlier ending is cleared');
  assert.equal(second.position.value, undefined, 'the second line keeps where it was built');
});

test('an ending shown after a completion puts the first line back where it belongs', () => {
  const first = line();
  const second = line();

  showEnding({ first, second }, describeEnding({ completion, day: 730, credits: 1 }));
  showEnding({ first, second }, describeEnding({ day: 3, credits: 5 }));

  assert.deepEqual(first.anchor.value, [0.5, 0]);
  assert.deepEqual(first.position.value, [75, 37]);
  assert.equal(second.text, 'Credits Remaining: 5');
});
