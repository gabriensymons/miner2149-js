import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateEnding } from '../scripts/ending-model.js';

const baseState = {
  day: 729,
  morale: 30,
  credits: 100,
  diridium: 10,
  sellPrice: 5,
  difficulty: 2,
  creditFlag: 0,
  revoltRoll: 0,
  completionFlavorRoll: 0,
  localHighScore: 0,
  recordEligible: true,
};

test('a solvent mission before day 730 continues without effects', () => {
  assert.deepEqual(evaluateEnding(baseState), {
    code: 1,
    outcome: 'ongoing',
    terminal: false,
    state: {
      credits: 100,
      diridium: 10,
      creditFlag: 0,
    },
    effects: [],
  });
});

test('revolt requires morale below 30 and a roll below difficulty', () => {
  const revolt = evaluateEnding({ ...baseState, morale: 29, revoltRoll: 1 });
  assert.deepEqual(revolt, {
    code: 4,
    outcome: 'revolt',
    terminal: true,
    state: {
      credits: 100,
      diridium: 10,
      creditFlag: 0,
    },
    effects: [{ type: 'clear-active-save' }],
  });

  assert.equal(evaluateEnding({ ...baseState, morale: 30, revoltRoll: 0 }).outcome, 'ongoing');
  assert.equal(evaluateEnding({ ...baseState, morale: 29, revoltRoll: 2 }).outcome, 'ongoing');
});

test('the final available credit extension reports that the limit is reached', () => {
  const result = evaluateEnding({
    ...baseState,
    credits: -101,
    diridium: 20,
    creditFlag: 3,
  });

  assert.equal(result.outcome, 'credit-extended');
  assert.equal(result.state.creditFlag, 4);
  assert.equal(result.creditExtension.limitReached, true);
  assert.deepEqual(result.effects, [{
    type: 'credit-extended',
    debtCovered: 101,
    limitReached: true,
  }]);
});

test('exhausted credit makes negative net worth terminal at the exact extension limit', () => {
  assert.deepEqual(evaluateEnding({
    ...baseState,
    credits: -101,
    diridium: 20,
    creditFlag: 4,
  }), {
    code: 2,
    outcome: 'insolvency',
    terminal: true,
    state: {
      credits: -101,
      diridium: 20,
      creditFlag: 4,
    },
    effects: [{ type: 'clear-active-save' }],
  });
});

test('day 730 completes with source-compatible score, stats, flavor, and a local record effect', () => {
  assert.deepEqual(evaluateEnding({
    ...baseState,
    day: 730,
    localHighScore: 149,
  }), {
    code: 3,
    outcome: 'complete',
    terminal: true,
    state: {
      credits: 150,
      diridium: 10,
      creditFlag: 0,
    },
    score: 150,
    completion: {
      day: 730,
      creditsEarned: 100,
      diridiumRemaining: 10,
      sellPrice: 5,
      totalCredits: 150,
      futureUse: 'amusement-park',
    },
    localRecord: {
      eligible: true,
      previousScore: 149,
      isNewRecord: true,
    },
    effects: [
      { type: 'clear-active-save' },
      { type: 'set-local-record', score: 150 },
    ],
  });
});

test('completion flavor rolls use the three values below the exclusive upper bound', () => {
  const uses = [
    'amusement-park',
    'luxury-hotel-and-spa',
    'military-base',
  ];

  for (const [completionFlavorRoll, futureUse] of uses.entries()) {
    const result = evaluateEnding({
      ...baseState,
      day: 730,
      completionFlavorRoll,
      recordEligible: false,
    });
    assert.equal(result.completion.futureUse, futureUse);
  }
});

test('completion flavor roll enforces the exclusive upper bound', () => {
  assert.throws(
    () => evaluateEnding({ ...baseState, day: 730, completionFlavorRoll: 3 }),
    /completionFlavorRoll must be an integer from 0 through 2/,
  );
});

test('zero net worth is solvent at the exact insolvency boundary', () => {
  const state = {
    ...baseState,
    credits: -100,
    diridium: 20,
    creditFlag: 4,
  };

  assert.equal(evaluateEnding(state).outcome, 'ongoing');
  assert.equal(evaluateEnding({ ...state, day: 730 }).outcome, 'complete');
});

test('ending precedence is revolt, then insolvency or extension, then completion', () => {
  const insolventCompletion = {
    ...baseState,
    day: 730,
    credits: -101,
    diridium: 20,
    creditFlag: 4,
  };

  assert.equal(evaluateEnding({ ...insolventCompletion, morale: 29 }).outcome, 'revolt');
  assert.equal(evaluateEnding(insolventCompletion).outcome, 'insolvency');
  assert.equal(evaluateEnding({ ...insolventCompletion, creditFlag: 3 }).outcome, 'credit-extended');
});

test('local records require eligibility and a score strictly above the prior record', () => {
  const tied = evaluateEnding({ ...baseState, day: 730, localHighScore: 150 });
  const sandbox = evaluateEnding({
    ...baseState,
    day: 730,
    localHighScore: 0,
    recordEligible: false,
  });

  assert.deepEqual(tied.localRecord, {
    eligible: true,
    previousScore: 150,
    isNewRecord: false,
  });
  assert.deepEqual(sandbox.localRecord, {
    eligible: false,
    previousScore: 0,
    isNewRecord: false,
  });
  assert.deepEqual(tied.effects, [{ type: 'clear-active-save' }]);
  assert.deepEqual(sandbox.effects, [{ type: 'clear-active-save' }]);
});

test('every terminal result emits exactly one active-save cleanup signal', () => {
  const results = [
    evaluateEnding({ ...baseState, morale: 29 }),
    evaluateEnding({ ...baseState, credits: -101, diridium: 20, creditFlag: 4 }),
    evaluateEnding({ ...baseState, day: 730, localHighScore: 149 }),
  ];

  for (const result of results) {
    assert.equal(result.terminal, true);
    assert.equal(result.effects.filter(effect => effect.type === 'clear-active-save').length, 1);
  }
});

test('insolvency extends available credit and liquidates diridium with truncation toward zero', () => {
  assert.deepEqual(evaluateEnding({
    ...baseState,
    credits: -101,
    diridium: 20,
  }), {
    code: 1,
    outcome: 'credit-extended',
    terminal: false,
    state: {
      credits: 0,
      diridium: 0,
      creditFlag: 1,
    },
    creditExtension: {
      debtCovered: 101,
      extensionsAllowed: 4,
      limitReached: false,
    },
    effects: [{
      type: 'credit-extended',
      debtCovered: 101,
      limitReached: false,
    }],
  });
});
