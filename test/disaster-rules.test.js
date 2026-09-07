import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DISASTER_MODE_DIVISOR,
  applyMineCaveIn,
  applyPirateRaid,
  applyPlague,
  applyPowerPlantExplosion,
  applyRadiationStorm,
  applySpaceportCrash,
  calculateMeteorCount,
  createMeteorStormCommand,
  DISASTER_IDS,
  selectDisaster,
} from '../scripts/disaster-rules.js';

function sequenceRandom(values) {
  const remaining = [...values];
  const calls = [];
  const random = (max) => {
    calls.push(max);
    assert.ok(remaining.length > 0, `unexpected random(${max}) call`);
    const value = remaining.shift();
    assert.ok(Number.isInteger(value) && value >= 0 && value < max, `${value} is outside random(${max})`);
    return value;
  };
  random.calls = calls;
  random.assertDone = () => assert.deepEqual(remaining, []);
  return random;
}

function makeMaps(fill = 2) {
  return Object.fromEntries(['level1', 'level2', 'level3'].map((level) => [
    level,
    Object.fromEntries(Array.from({ length: 10 }, (_, row) => [
      `row${row}`,
      Array(10).fill(fill),
    ])),
  ]));
}

function setCell(maps, level, index, value) {
  maps[level][`row${Math.floor(index / 10)}`][index % 10] = value;
}

function getCell(maps, level, index) {
  return maps[level][`row${Math.floor(index / 10)}`][index % 10];
}

test('normal disaster selection is gated until after day 21 without consuming randomness', () => {
  const random = sequenceRandom([]);

  const result = selectDisaster({ day: 21, difficulty: 3 }, { random });

  assert.deepEqual(result, {
    selected: false,
    disasterId: null,
    reason: 'grace-period',
    chance: { numerator: 1, denominator: 60 },
    trace: [],
  });
  random.assertDone();
});

test('normal disaster chance is exactly one in 20 times six minus difficulty', () => {
  const missRandom = sequenceRandom([0]);
  const hitRandom = sequenceRandom([1, 6]);

  assert.equal(selectDisaster({ day: 22, difficulty: 5 }, { random: missRandom }).selected, false);
  assert.deepEqual(selectDisaster({ day: 22, difficulty: 5 }, { random: hitRandom }), {
    selected: true,
    disasterId: DISASTER_IDS.MINE_CAVE_IN,
    reason: 'selected',
    chance: { numerator: 1, denominator: 20 },
    trace: [
      { draw: 'gate', max: 20, value: 1 },
      { draw: 'disaster', max: 7, value: 6 },
    ],
  });
  missRandom.assertDone();
  hitRandom.assertDone();
});

test('forced developer selection bypasses only the gate and still uses the seven-way draw', () => {
  const random = sequenceRandom([0]);

  const result = selectDisaster({ day: 0, difficulty: 2 }, { random, force: true });

  assert.equal(result.disasterId, DISASTER_IDS.PIRATE_RAID);
  assert.deepEqual(random.calls, [7]);
  random.assertDone();
});

test('pirate theft uses an exclusive ten-times-difficulty percentage draw and truncates tons', () => {
  const state = { difficulty: 3, diridium: 1234, untouched: true };
  const random = sequenceRandom([29]);

  const result = applyPirateRaid(state, { random });

  assert.deepEqual(result.state, { difficulty: 3, diridium: 877, untouched: true });
  assert.deepEqual(result.outcome, {
    disasterId: DISASTER_IDS.PIRATE_RAID,
    applied: true,
    stolen: 357,
  });
  assert.deepEqual(result.trace, [{ draw: 'theft-percent', max: 30, value: 29 }]);
  assert.deepEqual(state, { difficulty: 3, diridium: 1234, untouched: true });
  random.assertDone();
});

test('meteor count spans 10 through 10 plus four-times-difficulty minus one', () => {
  const minimumRandom = sequenceRandom([0]);
  const maximumRandom = sequenceRandom([19]);

  assert.equal(calculateMeteorCount(5, { random: minimumRandom }), 10);
  assert.equal(calculateMeteorCount(5, { random: maximumRandom }), 29);
});

test('meteor command is serializable and carries only data needed by the independent model', () => {
  const state = { day: 44, difficulty: 2, jobs: 73, efficiency: 81 };
  const buildingCounts = { powerPlant: 2, sickbay: 1 };
  const random = sequenceRandom([7]);

  const result = createMeteorStormCommand(state, { buildingCounts, random });

  assert.deepEqual(result.state, state);
  assert.deepEqual(result.effects, [{
    type: 'run-meteor-storm',
    command: {
      day: 44,
      difficulty: 2,
      jobs: 73,
      efficiency: 81,
      buildingCounts,
      meteorCount: 17,
    },
  }]);
  assert.doesNotThrow(() => JSON.stringify(result));
  assert.notEqual(result.state, state);
  assert.notEqual(result.effects[0].command.buildingCounts, buildingCounts);
  random.assertDone();
});

test('spaceport crash chooses among every matching site and independently damages its neighbors', () => {
  const maps = makeMaps();
  setCell(maps, 'level1', 44, 13);
  setCell(maps, 'level1', 55, 13);
  const original = structuredClone(maps);
  const random = sequenceRandom([1, 0, 0, 1, 1, 1, 2, 1, 0, 1, 1]);

  const result = applySpaceportCrash({ maps }, { random });

  assert.equal(result.outcome.applied, true);
  assert.equal(result.outcome.site.index, 44);
  assert.equal(getCell(result.state.maps, 'level1', 44), 3);
  assert.equal(getCell(result.state.maps, 'level1', 34), 2);
  assert.equal(getCell(result.state.maps, 'level1', 54), 1);
  assert.equal(getCell(result.state.maps, 'level1', 43), 3);
  assert.equal(getCell(result.state.maps, 'level1', 45), 2);
  assert.equal(getCell(result.state.maps, 'level1', 55), 13);
  assert.deepEqual(maps, original);
  assert.deepEqual(random.calls, [2, 2, 2, 3, 2, 3, 3, 3, 3, 4, 3]);
  random.assertDone();
});

test('spaceport crash is a no-op and consumes no randomness when no spaceport exists', () => {
  const maps = makeMaps();
  const random = sequenceRandom([]);

  const result = applySpaceportCrash({ maps, marker: 1 }, { random });

  assert.equal(result.outcome.applied, false);
  assert.equal(result.outcome.reason, 'missing-spaceport');
  assert.deepEqual(result.state, { maps, marker: 1 });
  assert.notEqual(result.state.maps, maps);
  random.assertDone();
});

test('power-plant explosion falls back to the last matching site when no selection draw succeeds', () => {
  const maps = makeMaps();
  setCell(maps, 'level1', 10, 14);
  setCell(maps, 'level1', 89, 14);
  const random = sequenceRandom([0, 0, 1, 0, 0, 0]);

  const result = applyPowerPlantExplosion({ maps }, { random });

  assert.equal(result.outcome.site.index, 89);
  assert.equal(getCell(result.state.maps, 'level1', 10), 14);
  assert.equal(getCell(result.state.maps, 'level1', 89), 2);
  random.assertDone();
});

test('mine cave-in damages only one mine on its selected level and leaves at least one worker', () => {
  const maps = makeMaps();
  setCell(maps, 'level2', 20, 8);
  setCell(maps, 'level2', 21, 8);
  const random = sequenceRandom([1, 9, 0, 1, 0]);

  const result = applyMineCaveIn({ maps, workers: 8, level: 'level2' }, { random });

  assert.equal(result.outcome.applied, true);
  assert.equal(result.outcome.level, 'level2');
  assert.equal(result.outcome.workersKilled, 7);
  assert.equal(result.state.workers, 1);
  assert.equal(getCell(result.state.maps, 'level2', 21), 3);
  assert.equal(getCell(result.state.maps, 'level2', 20), 8);
  assert.deepEqual(random.calls, [3, 10, 2, 2, 2]);
  random.assertDone();
});

test('mine cave-in preserves the worker count when its randomly selected level has no mine', () => {
  const maps = makeMaps();
  setCell(maps, 'level1', 4, 8);
  const random = sequenceRandom([2, 4]);

  const result = applyMineCaveIn({ maps, workers: 20 }, { random });

  assert.equal(result.outcome.applied, false);
  assert.equal(result.outcome.reason, 'missing-mine-on-selected-level');
  assert.equal(result.state.workers, 20);
  assert.equal(getCell(result.state.maps, 'level1', 4), 8);
  random.assertDone();
});

test('plague deaths and death-rate increase use source-order integer conversion', () => {
  const state = { difficulty: 4, workers: 100, deathRate: 10 };
  const random = sequenceRandom([3]);

  const result = applyPlague(state, { sickbayCount: 2, random });

  assert.deepEqual(result.state, { difficulty: 4, workers: 92, deathRate: 18 });
  assert.deepEqual(result.outcome, {
    disasterId: DISASTER_IDS.PLAGUE,
    applied: true,
    workersKilled: 8,
  });
  assert.deepEqual(random.calls, [4]);
  assert.deepEqual(state, { difficulty: 4, workers: 100, deathRate: 10 });
  random.assertDone();
});

test('plague safely remains a no-op with zero sickbays', () => {
  const state = { difficulty: 5, workers: 40, deathRate: 3 };
  const random = sequenceRandom([]);

  const result = applyPlague(state, { sickbayCount: 0, random });

  assert.deepEqual(result.state, state);
  assert.notEqual(result.state, state);
  assert.deepEqual(result.outcome, {
    disasterId: DISASTER_IDS.PLAGUE,
    applied: false,
    reason: 'missing-sickbay',
    workersKilled: 0,
  });
  random.assertDone();
});

test('radiation storm truncates health and efficiency to thirds and adds five death-rate points', () => {
  const state = { health: 82, efficiency: 80, deathRate: 7, marker: true };

  const result = applyRadiationStorm(state);

  assert.deepEqual(result.state, { health: 27, efficiency: 26, deathRate: 12, marker: true });
  assert.equal(result.outcome.disasterId, DISASTER_IDS.RADIATION_STORM);
  assert.equal(result.outcome.applied, true);
  assert.deepEqual(state, { health: 82, efficiency: 80, deathRate: 7, marker: true });
});

test('Disaster Mode divides the odds denominator and keeps the grace period', () => {
  // Normal odds are 1 in 20 * (6 - difficulty): 100 at class 1, 20 at class 5.
  const normalClassOne = selectDisaster(
    { day: 100, difficulty: 1 },
    { random: () => 0 },
  );
  const modeClassOne = selectDisaster(
    { day: 100, difficulty: 1, disasterMode: true },
    { random: () => 0 },
  );

  assert.equal(normalClassOne.chance.denominator, 100);
  assert.equal(modeClassOne.chance.denominator, 10, '100 / 10');
  assert.equal(DISASTER_MODE_DIVISOR, 10);

  // Class 5 already sits at 20, so Disaster Mode takes it to 2 -- a disaster
  // roughly every other day. Severe, and the reason the divisor is one named
  // constant rather than a number buried in the formula.
  const modeClassFive = selectDisaster(
    { day: 100, difficulty: 5, disasterMode: true },
    { random: () => 0 },
  );
  assert.equal(modeClassFive.chance.denominator, 2);

  // The day <= 21 grace period is untouched: nothing suggests v3.2 removed it,
  // and inventing that would be a parity break rather than a guess at a number.
  const early = selectDisaster(
    { day: 21, difficulty: 5, disasterMode: true },
    { random: () => 0 },
  );
  assert.equal(early.selected, false);
  assert.equal(early.reason, 'grace-period');
});

test('Disaster Mode never drives the denominator below two', () => {
  // A denominator of 0 would make the exclusive draw throw and 1 would mean a
  // guaranteed disaster every single day.
  for (const difficulty of [1, 2, 3, 4, 5]) {
    const { chance } = selectDisaster(
      { day: 100, difficulty, disasterMode: true },
      { random: () => 0 },
    );
    assert.ok(chance.denominator >= 2, `class ${difficulty} -> ${chance.denominator}`);
  }
});

test('an absent disasterMode flag behaves exactly like a normal run', () => {
  const absent = selectDisaster({ day: 100, difficulty: 3 }, { random: () => 0 });
  const explicit = selectDisaster(
    { day: 100, difficulty: 3, disasterMode: false },
    { random: () => 0 },
  );

  assert.deepEqual(absent.chance, explicit.chance);
  assert.equal(absent.chance.denominator, 60);
});
