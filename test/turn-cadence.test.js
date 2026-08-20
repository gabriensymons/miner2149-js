import assert from 'node:assert/strict';
import test from 'node:test';

import { runTurnCadence } from '../scripts/turn-cadence.js';

test('a positive advance applies its random event before the core and post-update phases', () => {
  const calls = [];
  const state = { day: 1 };

  runTurnCadence({
    days: 1,
    state,
    noOreVeins: true,
    selectEvent(options) {
      calls.push(['select-event', options]);
      return { id: 42 };
    },
    applyEvent(selectedState, event, options) {
      calls.push(['apply-event', selectedState, event, options]);
      return { state: { ...selectedState, eventApplied: true }, pendingChoice: null };
    },
    commitEvent(result) {
      calls.push(['commit-event', result.state]);
    },
    requestChoice() {
      assert.fail('an ordinary event must not request a choice');
    },
    coreUpdate() {
      calls.push(['core-update']);
    },
  });

  assert.deepEqual(calls, [
    ['select-event', { state, days: 1, noOreVeins: true }],
    ['apply-event', state, { id: 42 }, undefined],
    ['commit-event', { day: 1, eventApplied: true }],
    ['core-update'],
  ]);
});

test('an engineer choice resumes the core update exactly once after either answer', () => {
  for (const answer of ['accept', 'decline']) {
    const calls = [];
    let accept;
    let decline;
    const state = { day: 20 };
    const event = { id: 5 };

    runTurnCadence({
      days: 1,
      state,
      noOreVeins: false,
      selectEvent() {
        calls.push('select-event');
        return event;
      },
      applyEvent(selectedState, selectedEvent, options) {
        calls.push(['apply-event', options?.choice]);
        if (!options) {
          return {
            state: selectedState,
            pendingChoice: { type: 'engineer-offer', message: 'Engineer?' },
          };
        }
        return {
          state: { ...selectedState, answer: options.choice },
          pendingChoice: null,
        };
      },
      commitEvent(result) {
        calls.push(['commit-event', result.state.answer]);
      },
      requestChoice(choice, acceptChoice, declineChoice) {
        calls.push(['request-choice', choice.type]);
        accept = acceptChoice;
        decline = declineChoice;
      },
      coreUpdate() {
        calls.push('core-update');
      },
    });

    assert.deepEqual(calls, [
      'select-event',
      ['apply-event', undefined],
      ['request-choice', 'engineer-offer'],
    ]);

    const selected = answer === 'accept' ? accept : decline;
    const stale = answer === 'accept' ? decline : accept;
    selected();
    stale();

    assert.deepEqual(calls, [
      'select-event',
      ['apply-event', undefined],
      ['request-choice', 'engineer-offer'],
      ['apply-event', answer],
      ['commit-event', answer],
      'core-update',
    ]);
  }
});

test('zero and negative advances do not select random events or update the core', () => {
  for (const days of [0, -1]) {
    const result = runTurnCadence({
      days,
      state: {},
      selectEvent() { assert.fail('must not select'); },
      applyEvent() { assert.fail('must not apply'); },
      commitEvent() { assert.fail('must not commit'); },
      requestChoice() { assert.fail('must not request'); },
      coreUpdate() { assert.fail('must not update'); },
    });
    assert.equal(result, false);
  }
});
