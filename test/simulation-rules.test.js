import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceConstructionProgress,
  updateDailyCore,
} from '../scripts/simulation-rules.js';

function mapsWith(...sites) {
  return {
    level1: { row0: sites },
    level2: { row0: [2, 2] },
    level3: { row0: [2, 2] },
  };
}

test('construction progress advances 1, 7, or 14 days without mutating the maps', () => {
  for (const [days, sites, expected] of [
    [1, [708, 1009, 1514], [608, 909, 1414]],
    [7, [708, 1009, 1514], [8, 309, 814]],
    [14, [708, 1009, 1514], [8, 9, 114]],
  ]) {
    const maps = mapsWith(...sites);
    const original = structuredClone(maps);

    const result = advanceConstructionProgress(maps, days);

    assert.deepEqual(result.level1.row0, expected, `${days}-day advance`);
    assert.deepEqual(maps, original, `${days}-day input immutability`);
    assert.notEqual(result, maps);
    assert.notEqual(result.level1, maps.level1);
    assert.notEqual(result.level1.row0, maps.level1.row0);
  }
});

test('construction completion keeps the encoded building except bulldozer clears its site', () => {
  const maps = mapsWith(107, 708, 1009, 2, 17);

  assert.deepEqual(
    advanceConstructionProgress(maps, 1).level1.row0,
    [1, 608, 909, 2, 17],
  );
});

test('mother-ship days deduct wages and update morale before returning at the day-21 boundary', () => {
  const state = {
    credits: 1_000_000,
    day: 20,
    difficulty: 2,
    morale: 100,
    sellPrice: 19,
    wage: 400,
    workers: 20,
  };
  const original = structuredClone(state);

  const result = updateDailyCore(state, {}, 7, { random: () => 0 });

  assert.deepEqual(result, {
    state: {
      ...state,
      credits: 944_000,
      morale: 99,
    },
    messages: [],
    deathRateTerminal: false,
  });
  assert.deepEqual(state, original);
});

const matureState = {
  credits: 1_000_000,
  day: 30,
  deathRate: 10,
  difficulty: 2,
  diridium: 1_000,
  efficiency: 90,
  food: 85,
  health: 85,
  jobs: 75,
  jobsPrev: 75,
  lifeSupport: 85,
  miningEfficiency: 80,
  morale: 55,
  moralePrev: 55,
  occupancy: 160,
  sellPrice: 20,
  sellPriceAccumulator: 20,
  wage: 500,
  workers: 100,
  workersPrev: 100,
};

const matureCounts = {
  'Construction Site': 1,
  Bulldozer: 1,
  'Diridium Mine': 2,
  Hydroponics: 1,
  'Life Support': 1,
  Quarters: 1,
  'Space Port': 1,
  'Power Plant': 1,
  Processor: 1,
  Sickbay: 1,
  Storage: 1,
};

test('mature colony updates morale, signed worker changes, and jobs in source order', () => {
  const randomCalls = [];
  const original = structuredClone(matureState);
  const result = updateDailyCore(matureState, matureCounts, 7, {
    random(max) {
      randomCalls.push(max);
      if (max === 10) return 1;
      if (max === 50) return 2;
      return 2;
    },
  });

  assert.equal(result.state.credits, 650_000);
  assert.equal(result.state.moralePrev, 55);
  assert.equal(result.state.morale, 52);
  assert.equal(result.state.workersPrev, 100);
  assert.equal(result.state.workers, 102);
  assert.equal(result.state.jobsPrev, 75);
  assert.equal(result.state.jobs, 54);
  assert.equal(randomCalls[0], 10);
  assert.deepEqual(result.messages, [
    'NEWS FLASH: Riots are breaking out all over! Workers are revolting against poor working conditions.',
  ]);
  assert.deepEqual(matureState, original);
});

test('mature colony applies power, production, capacity, and life metrics after jobs', () => {
  const result = updateDailyCore(matureState, matureCounts, 7, {
    random(max) {
      if (max === 10) return 1;
      if (max === 50) return 2;
      return 2;
    },
  });

  assert.equal(result.state.efficiency, 72);
  assert.equal(result.state.diridium, 13_096);
  assert.equal(result.state.occupancy, 68);
  assert.equal(result.state.food, 100);
  assert.equal(result.state.health, 100);
  assert.equal(result.state.lifeSupport, 100);
  assert.equal(result.state.deathRate, 0);
  assert.equal(result.deathRateTerminal, false);
});

test('sell price preserves its floating accumulator across turns and truncates only display', () => {
  const start = {
    ...matureState,
    deathRate: 0,
    food: 100,
    health: 100,
    jobs: 100,
    lifeSupport: 100,
    morale: 100,
    occupancy: 100,
    sellPrice: 19,
    sellPriceAccumulator: 19,
    wage: 600,
  };
  const calls = [];
  const priceRise = max => {
    calls.push(max);
    return 0;
  };

  const first = updateDailyCore(start, matureCounts, 1, { random: priceRise });
  assert.equal(first.state.sellPriceAccumulator, 19.95);
  assert.equal(first.state.sellPrice, 19);
  assert.deepEqual(calls, [50, 3]);

  calls.length = 0;
  const second = updateDailyCore(first.state, matureCounts, 1, { random: priceRise });
  assert.ok(Math.abs(second.state.sellPriceAccumulator - 20.9475) < 1e-12);
  assert.equal(second.state.sellPrice, 20);
  assert.deepEqual(calls, [50, 3]);
  assert.deepEqual(second.messages, [
    'NEWS FLASH: Pirates are stealing cargos of diridium, prices have risen.',
  ]);
});

test('mature worker adjustment truncates the integer wage benchmark before subtraction', () => {
  const result = updateDailyCore({
    ...matureState,
    day: 30,
    deathRate: 0,
    difficulty: 1,
    food: 95,
    health: 95,
    jobs: 90,
    lifeSupport: 95,
    morale: 80,
    occupancy: 100,
    sellPrice: 5,
    sellPriceAccumulator: 5,
    wage: 333,
    workers: 100,
  }, matureCounts, 7, { random: () => 2 });

  assert.equal(result.state.morale, 88);
  assert.equal(result.state.workers, 101);
});

test('worker deaths truncate each left-to-right integer division before recruitment', () => {
  const result = updateDailyCore({
    ...matureState,
    deathRate: 1,
    difficulty: 2,
    food: 100,
    health: 100,
    jobs: 90,
    lifeSupport: 100,
    morale: 100,
    occupancy: 100,
    sellPrice: 13,
    sellPriceAccumulator: 13,
    wage: 700,
    workers: 100,
  }, matureCounts, 1, { random: () => 2 });

  assert.equal(result.state.workers, 102);
});

test('power percent truncates its all-integer division before entering float efficiency math', () => {
  const counts = {
    Bulldozer: 82,
    'Diridium Mine': 2,
    Hydroponics: 2,
    'Power Plant': 1,
  };
  const result = updateDailyCore({
    ...matureState,
    deathRate: 5,
    diridium: 0,
    efficiency: 0,
    food: 95,
    health: 95,
    jobs: 80,
    lifeSupport: 95,
    morale: 74,
    occupancy: 100,
    sellPrice: 20,
    sellPriceAccumulator: 20,
    wage: 1_640,
    workers: 100,
  }, counts, 1, { random: () => 2 });

  assert.equal(result.state.workers, 100);
  assert.equal(result.state.jobs, 51);
  assert.equal(result.state.efficiency, 24);
});

test('support ratios and half-day death pressure truncate before later integer additions', () => {
  const result = updateDailyCore({
    ...matureState,
    deathRate: 10,
    food: 100,
    health: 80,
    jobs: 0,
    lifeSupport: 100,
    morale: 0,
    occupancy: 100,
    sellPrice: 20,
    sellPriceAccumulator: 20,
    wage: 277,
    workers: 500,
  }, {
    Hydroponics: 1,
    'Life Support': 2,
    'Power Plant': 1,
    Sickbay: 1,
  }, 7, { random: () => 2 });

  assert.equal(result.state.workers, 500);
  assert.equal(result.state.food, 70);
  assert.equal(result.state.health, 70);
  assert.equal(result.state.lifeSupport, 100);
  assert.equal(result.state.deathRate, 9);
});

test('death rate is non-terminal at exactly 100 and terminal only after overshoot', () => {
  const missingSystems = {
    ...matureState,
    food: -1,
    health: -1,
    lifeSupport: -1,
    morale: 100,
    occupancy: -1,
    sellPriceAccumulator: 20,
  };
  const options = { random: () => 2 };

  const exact = updateDailyCore({ ...missingSystems, deathRate: 98 }, {}, 1, options);
  assert.equal(exact.state.deathRate, 100);
  assert.equal(exact.deathRateTerminal, false);

  const overshoot = updateDailyCore({ ...missingSystems, deathRate: 99 }, {}, 1, options);
  assert.equal(overshoot.state.deathRate, 100);
  assert.equal(overshoot.deathRateTerminal, true);
});
