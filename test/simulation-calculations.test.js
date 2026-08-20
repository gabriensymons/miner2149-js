import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateOperationsReport,
  calculatePowerDemand,
  calculatePowerPercent,
  calculateProductionReport,
  calculateStoragePercent,
  calculateThirtyDayProjection,
  countCompletedBuildingsByName,
  truncTowardZero,
} from '../scripts/simulation-calculations.js';

test('simulation calculations expose the report calculation contract', () => {
  for (const calculation of [
    calculateOperationsReport,
    calculatePowerDemand,
    calculatePowerPercent,
    calculateProductionReport,
    calculateStoragePercent,
    calculateThirtyDayProjection,
    countCompletedBuildingsByName,
    truncTowardZero,
  ]) {
    assert.equal(typeof calculation, 'function');
  }
});

test('truncTowardZero models integer assignment for positive and negative fractions', () => {
  assert.equal(truncTowardZero(2.9), 2);
  assert.equal(truncTowardZero(-2.9), -2);
});

test('calculation entry points reject non-numeric required inputs', () => {
  assert.throws(() => truncTowardZero('2'), TypeError);
  assert.throws(() => calculatePowerDemand({ Bulldozer: '1' }), TypeError);
  assert.throws(
    () => calculateProductionReport({ ...matureState, wage: undefined }, matureCounts),
    TypeError,
  );
});

const matureState = {
  day: 30,
  difficulty: 3,
  efficiency: 90,
  miningEfficiency: 80,
  diridium: 5000,
  sellPrice: 20,
  credits: 500000,
  wage: 600,
  workers: 100,
};

const matureCounts = {
  Bulldozer: 1,
  'Diridium Mine': 4,
  Hydroponics: 1,
  'Life Support': 1,
  'Space Port': 1,
  'Power Plant': 2,
  Processor: 1,
  Sickbay: 1,
  Storage: 1,
};

test('calculateProductionReport reproduces the mature-colony report values from source lines 1816-1860', () => {
  const originalState = structuredClone(matureState);
  const originalCounts = structuredClone(matureCounts);

  assert.equal(calculatePowerDemand(matureCounts), 48);
  assert.deepEqual(calculateProductionReport(matureState, matureCounts), {
    asteroidClass: { value: 3, text: 'Class 3' },
    mines: { value: 4, text: '4' },
    processors: { value: 80, text: '80%', alert: false },
    storage: { value: 9, text: '9%', alert: false },
    power: { value: 100, text: '100%', alert: false },
    diridium: { value: 5000, text: '5000 tons' },
    projectedCredits: { value: 1392000, text: '1392000', alert: false },
  });
  assert.deepEqual(matureState, originalState);
  assert.deepEqual(matureCounts, originalCounts);
});

test('processor reporting handles absent capacity and the exact 100-percent alert boundary', () => {
  const noProcessors = calculateProductionReport(matureState, {
    ...matureCounts,
    Processor: 0,
  });
  assert.deepEqual(noProcessors.processors, {
    value: null,
    text: 'None',
    alert: false,
  });

  for (const [miningEfficiency, alert] of [[100, false], [101, true]]) {
    const report = calculateProductionReport(
      { ...matureState, miningEfficiency },
      { ...matureCounts, 'Diridium Mine': 4 },
    );
    assert.equal(report.processors.value, miningEfficiency);
    assert.equal(report.processors.alert, alert);
  }
});

test('storage reporting includes processor capacity and safely handles zero capacity', () => {
  const noCapacity = calculateProductionReport(
    { ...matureState, diridium: 250 },
    { ...matureCounts, Processor: 0, Storage: 0 },
  );
  assert.deepEqual(noCapacity.storage, { value: 0, text: '0%', alert: false });

  const processorOnly = calculateProductionReport(
    { ...matureState, diridium: 250 },
    { ...matureCounts, Processor: 1, Storage: 0 },
  );
  assert.deepEqual(processorOnly.storage, { value: 50, text: '50%', alert: false });

  const exactlyFull = calculateProductionReport(
    { ...matureState, diridium: 500 },
    { ...matureCounts, Processor: 1, Storage: 0 },
  );
  assert.deepEqual(exactlyFull.storage, { value: 100, text: '100%', alert: true });
});

test('power reporting applies the source day-21 boundary and 90-percent warning threshold', () => {
  const noPlants = { Processor: 1 };
  assert.equal(calculatePowerPercent({ day: 20 }, noPlants), 100);
  assert.equal(calculatePowerPercent({ day: 21 }, noPlants), 0);

  const ninetyPercent = { 'Power Plant': 1, 'Diridium Mine': 20, Processor: 1, Bulldozer: 1 };
  const eightyNinePercent = { ...ninetyPercent, Bulldozer: 2 };
  assert.equal(calculatePowerDemand(ninetyPercent), 111);
  assert.deepEqual(
    calculateProductionReport({ ...matureState, day: 21 }, ninetyPercent).power,
    { value: 90, text: '90%', alert: false },
  );
  assert.deepEqual(
    calculateProductionReport({ ...matureState, day: 21 }, eightyNinePercent).power,
    { value: 89, text: '89%', alert: true },
  );
});

test('production text follows the diridium abbreviation and projected-credit alert boundaries', () => {
  const counts = {};
  const baseState = {
    ...matureState,
    credits: 0,
    diridium: 0,
    sellPrice: 0,
    wage: 0,
    workers: 1,
  };

  assert.equal(
    calculateProductionReport({ ...baseState, diridium: 99999 }, counts).diridium.text,
    '99999 tons',
  );
  assert.equal(
    calculateProductionReport({ ...baseState, diridium: 100000 }, counts).diridium.text,
    '100000 tns',
  );
  assert.equal(calculateProductionReport(baseState, counts).projectedCredits.alert, false);
  assert.deepEqual(
    calculateProductionReport({ ...baseState, wage: 1 }, counts).projectedCredits,
    { value: -30, text: '-30', alert: true },
  );
});

test('thirty-day projection caps mine throughput at processor throughput before applying finances', () => {
  const state = {
    ...matureState,
    efficiency: 100,
    miningEfficiency: 100,
    diridium: 0,
    sellPrice: 2,
    credits: 0,
    wage: 0,
    workers: 0,
  };
  const counts = { 'Diridium Mine': 100, Processor: 1 };

  assert.equal(calculateThirtyDayProjection(state, counts), 360000);
});

function assertFiniteReportValues(value) {
  if (typeof value === 'number') assert.equal(Number.isFinite(value), true);
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) assertFiniteReportValues(child);
  }
}

test('production reports never expose non-finite numeric values', () => {
  assertFiniteReportValues(calculateProductionReport(
    { ...matureState, efficiency: 0, diridium: 1 },
    {},
  ));
});

test('calculateOperationsReport reproduces source display values and alerts from lines 1756-1815', () => {
  const state = {
    workers: 100,
    workersPrev: 110,
    jobs: 75,
    morale: 65,
    moralePrev: 70,
    wage: 600,
    lifeSupport: 70,
    food: 79,
    health: 85,
    occupancy: 121,
    deathRate: 21,
  };

  assert.deepEqual(calculateOperationsReport(state), {
    workers: { value: 100, delta: -10, text: '100(-10)', alert: true },
    jobs: { value: 75, text: '75%', alert: false },
    morale: { value: 65, delta: -5, text: '65%(-5)', alert: true },
    wage: { value: 600, text: '600' },
    lifeSupport: { value: 70, text: '70%', alert: true },
    food: { value: 79, text: '79%', alert: true },
    health: { value: 85, text: '85%', alert: false },
    occupancy: { value: 121, text: '121%', alert: true },
    deathRate: { value: 21, text: '21%', alert: true },
  });
});

const healthyOperationsState = {
  workers: 100,
  workersPrev: 100,
  jobs: 50,
  morale: 70,
  moralePrev: 70,
  wage: 600,
  lifeSupport: 80,
  food: 80,
  health: 80,
  occupancy: 120,
  deathRate: 20,
};

test('operations alerts switch only beyond the exact source thresholds', () => {
  for (const [field, lowValue, boundaryValue] of [
    ['jobs', 49, 50],
    ['morale', 69, 70],
    ['lifeSupport', 79, 80],
    ['food', 79, 80],
    ['health', 79, 80],
  ]) {
    assert.equal(
      calculateOperationsReport({ ...healthyOperationsState, [field]: lowValue })[field].alert,
      true,
      `${field} ${lowValue}`,
    );
    assert.equal(
      calculateOperationsReport({ ...healthyOperationsState, [field]: boundaryValue })[field].alert,
      false,
      `${field} ${boundaryValue}`,
    );
  }

  for (const [field, boundaryValue, highValue] of [
    ['occupancy', 120, 121],
    ['deathRate', 20, 21],
  ]) {
    assert.equal(
      calculateOperationsReport({ ...healthyOperationsState, [field]: boundaryValue })[field].alert,
      false,
      `${field} ${boundaryValue}`,
    );
    assert.equal(
      calculateOperationsReport({ ...healthyOperationsState, [field]: highValue })[field].alert,
      true,
      `${field} ${highValue}`,
    );
  }
});

test('unavailable operations percentages render dashes without stale alerts', () => {
  for (const field of ['lifeSupport', 'food', 'health', 'occupancy']) {
    for (const value of [0, -1]) {
      assert.deepEqual(
        calculateOperationsReport({ ...healthyOperationsState, [field]: value })[field],
        { value, text: '---', alert: false },
      );
    }
  }
});

test('countCompletedBuildingsByName counts completed sites on every level and ignores construction encodings', () => {
  const maps = {
    level1: { row0: [7, 8, 107, 708] },
    level2: { row0: [8, 14, 15, 17] },
    level3: { row0: [5, 15, 15, 117] },
  };
  const names = {
    5: 'Mother Ship',
    7: 'Bulldozer',
    8: 'Diridium Mine',
    14: 'Power Plant',
    15: 'Processor',
    17: 'Storage',
  };
  const originalMaps = structuredClone(maps);

  assert.deepEqual(countCompletedBuildingsByName(maps, names), {
    Bulldozer: 1,
    'Diridium Mine': 2,
    'Power Plant': 1,
    Processor: 3,
    Storage: 1,
    'Mother Ship': 1,
  });
  assert.deepEqual(maps, originalMaps);
});
