const POWER_DEMAND_WEIGHTS = {
  Bulldozer: 1,
  'Diridium Mine': 5,
  Hydroponics: 5,
  'Life Support': 7,
  'Space Port': 1,
  Processor: 10,
  Sickbay: 3,
  Storage: 1,
};

function requireNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function count(counts, buildingName) {
  const value = counts[buildingName] ?? 0;
  return requireNumber(value, `counts.${buildingName}`);
}

export function truncTowardZero(value) {
  return Math.trunc(requireNumber(value, 'value'));
}

export function countCompletedBuildingsByName(maps, buildingNames) {
  const counts = {};

  for (const level of Object.values(maps)) {
    for (const row of Object.values(level)) {
      for (const site of row) {
        if (site > 100) continue;
        const buildingName = buildingNames[site];
        if (buildingName) counts[buildingName] = (counts[buildingName] ?? 0) + 1;
      }
    }
  }

  return counts;
}

export function calculatePowerDemand(counts) {
  return Object.entries(POWER_DEMAND_WEIGHTS).reduce(
    (demand, [buildingName, weight]) => demand + (count(counts, buildingName) * weight),
    0,
  );
}

export function calculatePowerPercent(state, counts) {
  const day = requireNumber(state.day, 'state.day');
  if (day < 21) return 100;

  const demand = calculatePowerDemand(counts);
  const capacity = count(counts, 'Power Plant') * 100;
  if (demand === 0) return capacity > 0 ? 100 : 0;

  return Math.min(100, truncTowardZero(100 * capacity / demand));
}

export function calculateStoragePercent(state, counts) {
  const diridium = requireNumber(state.diridium, 'state.diridium');
  const capacity = (count(counts, 'Storage') * 50000)
    + (count(counts, 'Processor') * 500);
  if (capacity === 0) return 0;
  return truncTowardZero(100 * diridium / capacity);
}

export function calculateThirtyDayProjection(state, counts) {
  const efficiency = requireNumber(state.efficiency, 'state.efficiency');
  const miningEfficiency = requireNumber(state.miningEfficiency, 'state.miningEfficiency');
  const diridium = requireNumber(state.diridium, 'state.diridium');
  const sellPrice = requireNumber(state.sellPrice, 'state.sellPrice');
  const credits = requireNumber(state.credits, 'state.credits');
  const wage = requireNumber(state.wage, 'state.wage');
  const workers = requireNumber(state.workers, 'state.workers');
  const mineOutput = truncTowardZero(
    count(counts, 'Diridium Mine')
      * efficiency
      * 30
      * 15
      * miningEfficiency
      / 100,
  );
  const processorCapacity = count(counts, 'Processor') * efficiency * 30 * 60;
  const processedOutput = Math.min(mineOutput, processorCapacity);

  return truncTowardZero(
    (processedOutput * sellPrice)
      + (diridium * sellPrice)
      + credits
      - (wage * workers * 30),
  );
}

function calculateProcessorPercent(state, counts) {
  const processorCount = count(counts, 'Processor');
  const efficiency = requireNumber(state.efficiency, 'state.efficiency');
  const miningEfficiency = requireNumber(state.miningEfficiency, 'state.miningEfficiency');
  if (processorCount === 0 || efficiency === 0) return null;

  return truncTowardZero(
    count(counts, 'Diridium Mine')
      * efficiency
      * 15
      * miningEfficiency
      / (processorCount * efficiency * 60),
  );
}

export function calculateProductionReport(state, counts) {
  const difficulty = requireNumber(state.difficulty, 'state.difficulty');
  const diridium = requireNumber(state.diridium, 'state.diridium');
  const mines = count(counts, 'Diridium Mine');
  const processorPercent = calculateProcessorPercent(state, counts);
  const storagePercent = calculateStoragePercent(state, counts);
  const powerPercent = calculatePowerPercent(state, counts);
  const projectedCredits = calculateThirtyDayProjection(state, counts);

  return {
    asteroidClass: { value: difficulty, text: `Class ${difficulty}` },
    mines: { value: mines, text: `${mines}` },
    processors: {
      value: processorPercent,
      text: processorPercent === null ? 'None' : `${processorPercent}%`,
      alert: processorPercent !== null && processorPercent > 100,
    },
    storage: {
      value: storagePercent,
      text: `${storagePercent}%`,
      alert: storagePercent === 100,
    },
    power: {
      value: powerPercent,
      text: `${powerPercent}%`,
      alert: powerPercent < 90,
    },
    diridium: {
      value: diridium,
      text: `${diridium} ${diridium < 100000 ? 'tons' : 'tns'}`,
    },
    projectedCredits: {
      value: projectedCredits,
      text: `${projectedCredits}`,
      alert: projectedCredits < 0,
    },
  };
}

function percentageField(value, alertWhen, unavailableWhenNonPositive = false) {
  if (unavailableWhenNonPositive && value <= 0) {
    return { value, text: '---', alert: false };
  }
  return { value, text: `${value}%`, alert: alertWhen(value) };
}

export function calculateOperationsReport(state) {
  const workers = requireNumber(state.workers, 'state.workers');
  const workersPrev = requireNumber(state.workersPrev, 'state.workersPrev');
  const jobs = requireNumber(state.jobs, 'state.jobs');
  const morale = requireNumber(state.morale, 'state.morale');
  const moralePrev = requireNumber(state.moralePrev, 'state.moralePrev');
  const wage = requireNumber(state.wage, 'state.wage');
  const lifeSupport = requireNumber(state.lifeSupport, 'state.lifeSupport');
  const food = requireNumber(state.food, 'state.food');
  const health = requireNumber(state.health, 'state.health');
  const occupancy = requireNumber(state.occupancy, 'state.occupancy');
  const deathRate = requireNumber(state.deathRate, 'state.deathRate');
  const workersDelta = workers - workersPrev;
  const moraleDelta = morale - moralePrev;

  return {
    workers: {
      value: workers,
      delta: workersDelta,
      text: `${workers}(${workersDelta})`,
      alert: workersDelta < 0,
    },
    jobs: percentageField(jobs, value => value < 50),
    morale: {
      value: morale,
      delta: moraleDelta,
      text: `${morale}%(${moraleDelta})`,
      alert: morale < 70,
    },
    wage: { value: wage, text: `${wage}` },
    lifeSupport: percentageField(lifeSupport, value => value < 80, true),
    food: percentageField(food, value => value < 80, true),
    health: percentageField(health, value => value < 80, true),
    occupancy: percentageField(occupancy, value => value > 120, true),
    deathRate: percentageField(deathRate, value => value > 20),
  };
}
