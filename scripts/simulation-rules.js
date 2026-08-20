import { truncTowardZero } from './simulation-calculations.js';

function advanceSite(site, days) {
  if (site === 107) return 1;
  if (site <= 100) return site;

  const remaining = site - (days * 100);
  return remaining > 100 ? remaining : site % 100;
}

export function advanceConstructionProgress(maps, days) {
  return Object.fromEntries(Object.entries(maps).map(([levelName, level]) => [
    levelName,
    Object.fromEntries(Object.entries(level).map(([rowName, sites]) => [
      rowName,
      sites.map(site => advanceSite(site, days)),
    ])),
  ]));
}

export function updateDailyCore(state, counts, days, { random }) {
  const nextState = {
    ...state,
    credits: state.credits - (state.workers * state.wage * days),
  };
  const messages = [];

  if (state.day < 21) {
    const adjustedMorale = state.morale
      + (days * (state.wage - (state.sellPrice * (21 + state.difficulty))) / 200);
    nextState.morale = Math.min(100, truncTowardZero(
      ((state.morale * 2) + adjustedMorale) / 3,
    ));
    return { state: nextState, messages, deathRateTerminal: false };
  }

  nextState.workersPrev = state.workers;
  nextState.moralePrev = state.morale;
  nextState.jobsPrev = state.jobs;

  let adjustedMorale = state.morale;
  if (state.food < 90) adjustedMorale -= days / 3;
  if (state.food > 99) adjustedMorale += days / 6;
  if (state.food < 70) adjustedMorale -= days / 3;
  if (state.occupancy > 150) adjustedMorale -= days / 6;
  if (state.occupancy > 200) adjustedMorale -= days / 3;
  if (state.occupancy < 60) adjustedMorale += days / 6;
  adjustedMorale += days
    * (state.wage - (state.sellPrice * (22 + state.difficulty))) / 100;
  adjustedMorale += 2 * days * (100 - state.jobs) / 100;
  if (state.deathRate > 5) adjustedMorale -= days / 4;
  if (state.deathRate > 15) adjustedMorale -= days / 3;
  if (state.deathRate < 1) adjustedMorale += days / 6;
  if (state.health > 99) adjustedMorale += days / 6;
  if (state.health < 90) adjustedMorale -= days / 3;
  if (state.health < 70) adjustedMorale -= days / 3;
  if (state.lifeSupport < 90) adjustedMorale -= days / 3;
  nextState.morale = Math.max(0, Math.min(100, truncTowardZero(
    (state.morale + adjustedMorale) / 2,
  )));

  if (nextState.morale < 60 && nextState.morale > 29 && random(10) === 1) {
    messages.push('NEWS FLASH: Riots are breaking out all over! Workers are revolting against poor working conditions.');
  }
  if (nextState.morale < 30) {
    messages.push('NEWS FLASH: Workers threatening to remove you from the station unless working conditions are improved quickly.');
  }

  const wageBenchmark = truncTowardZero(
    700 * state.sellPrice / (17 - (2 * state.difficulty)),
  );
  let workerAdjustment = truncTowardZero(
    days * (state.wage - wageBenchmark) / 700,
  );
  if (nextState.morale > 89) workerAdjustment += 2 * days;
  if (nextState.morale < 80) workerAdjustment -= 2 * days;
  if (state.jobs < 80) workerAdjustment += 3 * days;
  if (state.jobs > 99) workerAdjustment -= 3 * days;
  let workerDeaths = truncTowardZero(state.workers * state.deathRate / 100);
  workerDeaths = truncTowardZero(workerDeaths * days / 365);
  nextState.workers = state.workers - workerDeaths;
  nextState.workers = truncTowardZero(
    nextState.workers + (workerAdjustment * (nextState.workers + 1) / 100),
  );
  if (nextState.workers < 1) nextState.workers = 1;

  const jobCapacity = ((counts['Construction Site'] ?? 0) * 5)
    + (counts.Bulldozer ?? 0)
    + ((counts['Diridium Mine'] ?? 0) * 30)
    + ((counts.Hydroponics ?? 0) * 12)
    + ((counts['Life Support'] ?? 0) * 15)
    + (counts.Quarters ?? 0)
    + ((counts['Space Port'] ?? 0) * 20)
    + ((counts['Power Plant'] ?? 0) * 30)
    + ((counts.Processor ?? 0) * 20)
    + ((counts.Sickbay ?? 0) * 12)
    + ((counts.Storage ?? 0) * 12);
  nextState.jobs = jobCapacity > 0
    ? truncTowardZero(nextState.workers * 100 / jobCapacity)
    : nextState.workers * 100;

  const powerDemand = (counts.Bulldozer ?? 0)
    + ((counts['Diridium Mine'] ?? 0) * 5)
    + ((counts.Hydroponics ?? 0) * 5)
    + ((counts['Life Support'] ?? 0) * 7)
    + (counts['Space Port'] ?? 0)
    + ((counts.Processor ?? 0) * 10)
    + ((counts.Sickbay ?? 0) * 3)
    + (counts.Storage ?? 0);
  const powerPlantCount = counts['Power Plant'] ?? 0;
  let powerPercent = powerDemand > 0
    ? truncTowardZero(100 * (powerPlantCount * 100) / powerDemand)
    : 0;
  let warnings = '';
  if (powerPercent < 80) warnings += ', Brownouts';
  if (powerPlantCount === 0 && state.day > 21) {
    warnings += ' (now on emergency batteries)';
  }
  if (powerPercent > 100) powerPercent = 100;
  nextState.efficiency = truncTowardZero(
    ((powerPercent * nextState.jobs / 100) + state.efficiency) / 2,
  );
  nextState.efficiency = Math.max(0, Math.min(100, nextState.efficiency));

  const processorCount = counts.Processor ?? 0;
  const storageCount = counts.Storage ?? 0;
  let production = truncTowardZero(
    (counts['Diridium Mine'] ?? 0)
      * nextState.efficiency
      * days
      * 15
      * state.miningEfficiency
      / 100,
  );
  const processorCapacity = processorCount * nextState.efficiency * days * 60;
  if (production > processorCapacity) production = processorCapacity;
  nextState.diridium = state.diridium + production;
  const storageCapacity = (storageCount * 50000) + (processorCount * 500);
  if (nextState.diridium > storageCapacity) nextState.diridium = storageCapacity;

  let sellPriceAccumulator = state.sellPriceAccumulator ?? state.sellPrice;
  const priceEvent = random(50);
  if (priceEvent === 0) {
    sellPriceAccumulator += sellPriceAccumulator
      * ((random(3) + 5) * days) / 100;
    messages.push('NEWS FLASH: Pirates are stealing cargos of diridium, prices have risen.');
  }
  if (priceEvent === 1) {
    sellPriceAccumulator -= sellPriceAccumulator
      * ((random(3) + 5) * days) / 100;
    messages.push('NEWS FLASH: Large vein of diridium discovered, prices falling.');
  }
  if (priceEvent > 1) {
    if (sellPriceAccumulator > 10) {
      sellPriceAccumulator += sellPriceAccumulator
        * ((random(4) - 2) * days) / 100;
    }
    if (sellPriceAccumulator <= 10) {
      sellPriceAccumulator += (random(3) - 1) * days;
    }
  }
  if (sellPriceAccumulator > 50) sellPriceAccumulator -= 5;
  if (sellPriceAccumulator < 5) sellPriceAccumulator = 5;
  if (sellPriceAccumulator < 10 && random(3) === 1) {
    sellPriceAccumulator += days / 10;
  }
  nextState.sellPriceAccumulator = sellPriceAccumulator;
  nextState.sellPrice = truncTowardZero(sellPriceAccumulator);

  const quartersCount = counts.Quarters ?? 0;
  nextState.occupancy = quartersCount > 0
    ? truncTowardZero(100 * nextState.workers / (quartersCount * 150))
    : -1;

  const hydroponicsCount = counts.Hydroponics ?? 0;
  if (hydroponicsCount > 0) {
    const foodCapacityRatio = truncTowardZero(
      100 * hydroponicsCount * 200 / nextState.workers,
    );
    nextState.food = truncTowardZero((state.food + foodCapacityRatio) / 2);
  } else nextState.food = -1;
  if (nextState.food > 100) nextState.food = 100;

  const sickbayCount = counts.Sickbay ?? 0;
  if (sickbayCount > 0) {
    const healthCapacityRatio = truncTowardZero(
      100 * sickbayCount * 300 / nextState.workers,
    );
    nextState.health = truncTowardZero((healthCapacityRatio + state.health) / 2);
  } else nextState.health = -1;
  if (nextState.health > 100) nextState.health = 100;

  const lifeSupportCount = counts['Life Support'] ?? 0;
  if (lifeSupportCount > 0) {
    const lifeCapacityRatio = truncTowardZero(
      100 * lifeSupportCount * 400 / nextState.workers,
    );
    nextState.lifeSupport = truncTowardZero((state.lifeSupport + lifeCapacityRatio) / 2);
  } else nextState.lifeSupport = -1;
  if (nextState.lifeSupport > 100) nextState.lifeSupport = 100;
  if (nextState.lifeSupport > 0 && powerPlantCount === 0) {
    nextState.lifeSupport = truncTowardZero(nextState.lifeSupport * 2 / 3);
  }

  let deathPressure = 0;
  const halfDays = truncTowardZero(days / 2);
  if (nextState.lifeSupport > 90) deathPressure -= days;
  if (nextState.lifeSupport < 70) deathPressure += halfDays;
  if (nextState.lifeSupport < 50) {
    deathPressure += days;
    warnings += ', Low Life Support';
    if (nextState.lifeSupport === -1) deathPressure += days;
  }
  if (nextState.lifeSupport === -1) deathPressure += days;
  if (nextState.food > 90) deathPressure -= days;
  if (nextState.food < 50) deathPressure += days;
  if (nextState.food < 80) {
    deathPressure += halfDays;
    warnings += ', Low Food Supply';
  }
  if (nextState.health > 90) deathPressure -= days;
  if (nextState.health < 80) {
    deathPressure += halfDays;
    warnings += ', Poor Health';
  }
  if (nextState.health < 30) deathPressure += days;

  nextState.deathRate = truncTowardZero(
    ((state.deathRate * 2) + deathPressure) / 2,
  );
  if (nextState.deathRate === 0) nextState.deathRate = 0;
  if (nextState.deathRate > 100) {
    nextState.deathRate = 100;
    return { state: nextState, messages, deathRateTerminal: true };
  }
  if (nextState.deathRate < 0) nextState.deathRate = 0;
  if (warnings) {
    messages.push(`WARNING: ${warnings.slice(2)} threatening the mining operation.`);
  }

  return { state: nextState, messages, deathRateTerminal: false };
}
