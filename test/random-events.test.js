import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RANDOM_EVENT_IDS,
  RANDOM_EVENT_PHASE,
  applyRandomEvent,
  selectRandomEvent,
} from '../scripts/random-events.js';

function sequenceRng(values) {
  let index = 0;
  return () => {
    assert.ok(index < values.length, 'random sequence was exhausted');
    return values[index++];
  };
}

function smoothMaps() {
  return Object.fromEntries([1, 2, 3].map((level) => [
    `level${level}`,
    Object.fromEntries(Array.from({ length: 10 }, (_, row) => [
      `row${row}`,
      Array(10).fill(2),
    ])),
  ]));
}

function baseState(overrides = {}) {
  return {
    day: 20,
    level: 'level1',
    maps: smoothMaps(),
    efficiency: 80,
    morale: 70,
    diridium: 100,
    credits: 50000,
    miningEfficiency: 60,
    difficulty: 3,
    workers: 101,
    ...overrides,
  };
}

// Pocket C source lines 2498-2503: random(700), then random(90)+5,
// before Update(a) at line 2560.
test('time shift selects exclusive source ranges and applies before the core update', () => {
  const original = baseState();
  const event = selectRandomEvent({
    state: original,
    days: 1,
    random: sequenceRng([0, 0.9999999999999999]),
  });
  const result = applyRandomEvent(original, event);

  assert.equal(event.id, 0);
  assert.equal(event.shift, 94);
  assert.deepEqual(event.randomDraws, [
    { label: 'event-id', max: 700, value: 0 },
    { label: 'time-shift-days', max: 90, value: 89 },
  ]);
  assert.equal(result.phase, RANDOM_EVENT_PHASE);
  assert.equal(result.phase, 'before-core-update');
  assert.equal(result.state.day, 114);
  assert.equal(original.day, 20);
  assert.deepEqual(result.messages, [
    'NEWS FLASH: Strange electromagnetic storm causes time shift. Time suddenly advances 94 days.',
  ]);
  assert.doesNotThrow(() => JSON.stringify(result));
});

// Pocket C source lines 2505-2526: level is random(3)+1 and each of
// two candidate cells is random(99)+1.
test('geologic survey uses source level and cell ranges without mutating maps', () => {
  const original = baseState();
  const event = selectRandomEvent({
    state: original,
    days: 1,
    random: sequenceRng([1 / 700, 0.9999999999999999, 0, 0.9999999999999999]),
  });
  const result = applyRandomEvent(original, event);

  assert.equal(event.id, 1);
  assert.deepEqual(event.geologicSurvey, { level: 3, cells: [1, 99] });
  assert.equal(result.state.maps.level3.row0[0], 4);
  assert.equal(result.state.maps.level3.row9[8], 4);
  assert.equal(result.state.maps.level3.row9[9], 2);
  assert.equal(original.maps.level3.row0[0], 2);
  assert.notEqual(result.state.maps, original.maps);
  assert.deepEqual(result.mapUpdate, {
    level: 'level3',
    cells: [
      { cell: 1, row: 0, column: 0 },
      { cell: 99, row: 9, column: 8 },
    ],
    redraw: false,
  });
  assert.deepEqual(result.messages, [
    'NEWS FLASH: Geologic survey discovers new diridium veins on level 3.',
  ]);
});

// Source lines 2505-2526 allow a survey in addition to the primary event when
// no ore remains and random(17-days) is exactly one.
test('no-ore fallback is an explicit input and keeps its exclusive source range', () => {
  const original = baseState({ level: 'level1' });
  const event = selectRandomEvent({
    state: original,
    days: 7,
    noOreVeins: true,
    random: sequenceRng([(10.1 / 700), 0.1, 0, 0, 0.9999999999999999]),
  });
  const result = applyRandomEvent(original, event);

  assert.equal(event.id, 10);
  assert.deepEqual(event.randomDraws.slice(0, 2), [
    { label: 'event-id', max: 700, value: 10 },
    { label: 'no-ore-fallback', max: 10, value: 1 },
  ]);
  assert.deepEqual(event.geologicSurvey, { level: 1, cells: [1, 99] });
  assert.equal(result.mapUpdate.redraw, true);
});

// Source lines 2528-2534.
test('processor and artifact events honor their source preconditions and caps', () => {
  assert.deepEqual(RANDOM_EVENT_IDS, {
    TIME_SHIFT: 0,
    GEOLOGIC_SURVEY: 1,
    PROCESSOR_BOOST: 2,
    ALIEN_ARTIFACT: 3,
    RICH_VEIN: 4,
    ENGINEER: 5,
    WORKERS_LEAVE: 6,
  });

  const processorState = baseState({ efficiency: 40 });
  const processor = applyRandomEvent(processorState, selectRandomEvent({
    state: processorState,
    days: 1,
    random: sequenceRng([(2.1 / 700)]),
  }));
  assert.equal(processor.state.efficiency, 100);
  assert.equal(processorState.efficiency, 40);

  const cappedState = baseState({ efficiency: 100 });
  const capped = applyRandomEvent(cappedState, selectRandomEvent({
    state: cappedState,
    days: 1,
    random: sequenceRng([(2.1 / 700)]),
  }));
  assert.deepEqual(capped.messages, []);

  const artifactState = baseState({ morale: 12 });
  const artifact = applyRandomEvent(artifactState, selectRandomEvent({
    state: artifactState,
    days: 1,
    random: sequenceRng([(3.1 / 700)]),
  }));
  assert.equal(artifact.state.morale, 100);
});

// Source lines 2536-2539: random(100)*50 is 0..4950.
test('rich vein adds at most 4950 tons using the exclusive source range', () => {
  const original = baseState({ diridium: 100 });
  const event = selectRandomEvent({
    state: original,
    days: 1,
    random: sequenceRng([(4.1 / 700), 0.9999999999999999]),
  });
  const result = applyRandomEvent(original, event);

  assert.equal(event.amount, 4950);
  assert.equal(result.state.diridium, 5050);
  assert.equal(original.diridium, 100);
});

// Source lines 2541-2553: strict credit/efficiency preconditions,
// random(15)+15 thousand cost, and only random(3)==2 succeeds.
test('engineer offer is serializable and accepted service succeeds one third of the time', () => {
  const original = baseState({ credits: 50000, miningEfficiency: 85 });
  const event = selectRandomEvent({
    state: original,
    days: 1,
    random: sequenceRng([(5.1 / 700), 0.9999999999999999]),
  });

  assert.equal(event.cost, 29000);
  assert.equal(event.pendingChoice.type, 'engineer-offer');
  assert.doesNotThrow(() => JSON.stringify(event.pendingChoice));

  const success = applyRandomEvent(original, event, {
    choice: 'accept',
    random: sequenceRng([0.9999999999999999]),
  });
  assert.equal(success.state.credits, 21000);
  assert.equal(success.state.miningEfficiency, 100);
  assert.equal(success.randomDraws.at(-1).value, 2);

  const failure = applyRandomEvent(original, event, {
    choice: 'accept',
    random: sequenceRng([1 / 3]),
  });
  assert.equal(failure.state.credits, 21000);
  assert.equal(failure.state.miningEfficiency, 85);
  assert.match(failure.messages[0], /swindled/);

  const ineligible = baseState({ credits: 30000, miningEfficiency: 85 });
  const skipped = selectRandomEvent({
    state: ineligible,
    days: 1,
    random: sequenceRng([(5.1 / 700)]),
  });
  assert.equal(skipped.pendingChoice, null);
});

// Source lines 2555-2558: (random(diff)*10)+10.
test('workers leaving ranges from 10 through difficulty times 10', () => {
  const original = baseState({ difficulty: 3, workers: 101 });
  const event = selectRandomEvent({
    state: original,
    days: 1,
    random: sequenceRng([(6.1 / 700), 0.9999999999999999]),
  });
  const result = applyRandomEvent(original, event);

  assert.equal(event.percent, 30);
  assert.equal(result.state.workers, 71);
  assert.equal(original.workers, 101);
});
