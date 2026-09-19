import { cloneMaps } from './map-grid.js';

export const DISASTER_IDS = Object.freeze({
  PIRATE_RAID: 'pirate-raid',
  METEOR_STORM: 'meteor-storm',
  SPACEPORT_CRASH: 'spaceport-crash',
  POWER_PLANT_EXPLOSION: 'power-plant-explosion',
  PLAGUE: 'plague',
  RADIATION_STORM: 'radiation-storm',
  MINE_CAVE_IN: 'mine-cave-in',
});

const DISASTER_TABLE = Object.freeze(Object.values(DISASTER_IDS));

function assertDifficulty(difficulty) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new RangeError('difficulty must be an integer from 1 through 5');
  }
}

function drawExclusive(random, max) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const value = random(max);
  if (!Number.isInteger(value) || value < 0 || value >= max) {
    throw new RangeError(`random(${max}) must return an integer from 0 through ${max - 1}`);
  }
  return value;
}

/**
 * Disaster Mode divides the odds denominator, making disasters that much more
 * frequent. The v3.2 manual says "about 10 times normal", which is prose rather
 * than a formula -- this is the port's reading of it and has not been confirmed
 * against the binary. Note the effect is severe at high difficulty: class 5
 * already has a denominator of 20, so Disaster Mode takes it to 2.
 */
export const DISASTER_MODE_DIVISOR = 10;

export function selectDisaster({ day, difficulty, disasterMode = false }, { random, force = false } = {}) {
  assertDifficulty(difficulty);
  const normalDenominator = 20 * (6 - difficulty);
  // Never below 1: a denominator of 0 would make drawExclusive throw, and 1
  // would mean a guaranteed disaster every single day.
  const denominator = disasterMode
    ? Math.max(2, Math.round(normalDenominator / DISASTER_MODE_DIVISOR))
    : normalDenominator;
  const chance = { numerator: 1, denominator };

  if (!force && day <= 21) {
    return { selected: false, disasterId: null, reason: 'grace-period', chance, trace: [] };
  }

  const trace = [];
  if (!force) {
    const gate = drawExclusive(random, denominator);
    trace.push({ draw: 'gate', max: denominator, value: gate });
    if (gate !== 1) {
      return { selected: false, disasterId: null, reason: 'chance-miss', chance, trace };
    }
  }

  const selection = drawExclusive(random, DISASTER_TABLE.length);
  trace.push({ draw: 'disaster', max: DISASTER_TABLE.length, value: selection });
  return {
    selected: true,
    disasterId: DISASTER_TABLE[selection],
    reason: 'selected',
    chance,
    trace,
  };
}

export function applyPirateRaid(state, { random } = {}) {
  assertDifficulty(state.difficulty);
  const max = 10 * state.difficulty;
  const percentage = drawExclusive(random, max);
  const stolen = Math.trunc(state.diridium * percentage / 100);
  return {
    state: { ...state, diridium: state.diridium - stolen },
    outcome: { disasterId: DISASTER_IDS.PIRATE_RAID, applied: true, stolen },
    effects: [{
      type: 'message',
      text: `DISASTER: Pirate raiders have stolen ${stolen} tons of processed diridium.`,
    }],
    trace: [{ draw: 'theft-percent', max, value: percentage }],
  };
}

export function calculateMeteorCount(difficulty, { random } = {}) {
  assertDifficulty(difficulty);
  return 10 + drawExclusive(random, 4 * difficulty);
}

export function createMeteorStormCommand(state, { buildingCounts, random } = {}) {
  const meteorCount = calculateMeteorCount(state.difficulty, { random });
  const command = {
    day: state.day,
    difficulty: state.difficulty,
    jobs: state.jobs,
    efficiency: state.efficiency,
    buildingCounts: { ...buildingCounts },
    meteorCount,
  };
  return {
    state: { ...state },
    outcome: { disasterId: DISASTER_IDS.METEOR_STORM, applied: true, meteorCount },
    effects: [{ type: 'run-meteor-storm', command }],
    trace: [{ draw: 'meteor-count', max: 4 * state.difficulty, value: meteorCount - 10 }],
  };
}

function siteAt(level, index) {
  return { level, index, row: Math.floor(index / 10), column: index % 10 };
}

function readCell(maps, { level, row, column }) {
  return maps[level][`row${row}`][column];
}

function writeCell(maps, { level, row, column }, value) {
  maps[level][`row${row}`][column] = value;
}

function findSites(maps, level, buildingId) {
  const sites = [];
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      const site = siteAt(level, row * 10 + column);
      if (readCell(maps, site) === buildingId) sites.push(site);
    }
  }
  return sites;
}

function blastBuilding(maps, { buildingId, level, random }) {
  const candidates = findSites(maps, level, buildingId);
  if (candidates.length === 0) return null;

  let selected = null;
  const trace = [];
  for (const candidate of candidates) {
    const value = drawExclusive(random, 2);
    trace.push({ draw: 'site-selection', max: 2, value, site: candidate });
    if (value === 1) selected = candidate;
  }
  selected ??= candidates.at(-1);

  const centerValue = 3 - drawExclusive(random, 2);
  writeCell(maps, selected, centerValue);
  const damagedSites = [{ ...selected, value: centerValue }];

  if (level !== 'level1' || buildingId === 8) {
    return { site: selected, damagedSites, trace };
  }

  const neighbors = [
    { name: 'up', rowDelta: -1, columnDelta: 0, chanceMax: 3, damageMax: 2 },
    { name: 'down', rowDelta: 1, columnDelta: 0, chanceMax: 3, damageMax: 3 },
    { name: 'left', rowDelta: 0, columnDelta: -1, chanceMax: 3, damageMax: 3 },
    { name: 'right', rowDelta: 0, columnDelta: 1, chanceMax: 4, damageMax: 3 },
  ];

  for (const neighbor of neighbors) {
    const row = selected.row + neighbor.rowDelta;
    const column = selected.column + neighbor.columnDelta;
    if (row < 0 || row > 9 || column < 0 || column > 9) continue;
    const chance = drawExclusive(random, neighbor.chanceMax);
    trace.push({ draw: `${neighbor.name}-chance`, max: neighbor.chanceMax, value: chance });
    if (chance !== 1) continue;
    const damageDraw = drawExclusive(random, neighbor.damageMax);
    const value = 3 - damageDraw;
    const site = siteAt(level, row * 10 + column);
    writeCell(maps, site, value);
    damagedSites.push({ ...site, value });
    trace.push({ draw: `${neighbor.name}-damage`, max: neighbor.damageMax, value: damageDraw });
  }

  return { site: selected, damagedSites, trace };
}

function applySurfaceExplosion(state, { buildingId, disasterId, missingReason, message, random }) {
  const maps = cloneMaps(state.maps);
  if (findSites(maps, 'level1', buildingId).length === 0) {
    return {
      state: { ...state, maps },
      outcome: { disasterId, applied: false, reason: missingReason },
      effects: [],
      trace: [],
    };
  }
  const blast = blastBuilding(maps, { buildingId, level: 'level1', random });
  return {
    state: { ...state, maps },
    outcome: {
      disasterId,
      applied: true,
      site: blast.site,
      damagedSites: blast.damagedSites,
    },
    effects: [{ type: 'message', text: message }],
    trace: blast.trace,
  };
}

export function applySpaceportCrash(state, { random } = {}) {
  return applySurfaceExplosion(state, {
    buildingId: 13,
    disasterId: DISASTER_IDS.SPACEPORT_CRASH,
    missingReason: 'missing-spaceport',
    message: 'DISASTER: There has been a crash in the space port. Nearby buildings might be damaged or destroyed.',
    random,
  });
}

export function applyPowerPlantExplosion(state, { random } = {}) {
  return applySurfaceExplosion(state, {
    buildingId: 14,
    disasterId: DISASTER_IDS.POWER_PLANT_EXPLOSION,
    missingReason: 'missing-power-plant',
    message: 'DISASTER: The power plant has overloaded and exploded. Nearby buildings destroyed.',
    random,
  });
}

export function applyMineCaveIn(state, { random } = {}) {
  const levelDraw = drawExclusive(random, 3);
  const deathDraw = drawExclusive(random, 10);
  const level = `level${levelDraw + 1}`;
  const maps = cloneMaps(state.maps);
  const trace = [
    { draw: 'level', max: 3, value: levelDraw },
    { draw: 'workers-killed', max: 10, value: deathDraw },
  ];
  if (findSites(maps, level, 8).length === 0) {
    return {
      state: { ...state, maps },
      outcome: {
        disasterId: DISASTER_IDS.MINE_CAVE_IN,
        applied: false,
        reason: 'missing-mine-on-selected-level',
        level,
      },
      effects: [],
      trace,
    };
  }

  const workersKilled = Math.min(10 + deathDraw, Math.max(0, state.workers - 1));
  const blast = blastBuilding(maps, { buildingId: 8, level, random });
  return {
    state: { ...state, maps, workers: state.workers - workersKilled },
    outcome: {
      disasterId: DISASTER_IDS.MINE_CAVE_IN,
      applied: true,
      level,
      workersKilled,
      site: blast.site,
      damagedSites: blast.damagedSites,
    },
    effects: [{
      type: 'message',
      text: `DISASTER: Mine cave in on level ${levelDraw + 1}. Mine destroyed. ${workersKilled} workers killed.`,
    }],
    trace: [...trace, ...blast.trace],
  };
}

function trunc(value) {
  const result = Math.trunc(value);
  return Object.is(result, -0) ? 0 : result;
}

export function applyPlague(state, { sickbayCount, random } = {}) {
  assertDifficulty(state.difficulty);
  if (!Number.isInteger(sickbayCount) || sickbayCount <= 0) {
    return {
      state: { ...state },
      outcome: {
        disasterId: DISASTER_IDS.PLAGUE,
        applied: false,
        reason: 'missing-sickbay',
        workersKilled: 0,
      },
      effects: [],
      trace: [],
    };
  }

  const severity = drawExclusive(random, state.difficulty);
  const capacityShare = trunc(state.workers / sickbayCount);
  const workersKilled = trunc(capacityShare * (severity + 1) / 25);
  const workers = state.workers - workersKilled;
  const deathRateIncrease = workers > 0 ? trunc(100 * workersKilled / workers) : 0;
  return {
    state: { ...state, workers, deathRate: state.deathRate + deathRateIncrease },
    outcome: { disasterId: DISASTER_IDS.PLAGUE, applied: true, workersKilled },
    effects: [{
      type: 'message',
      text: `DISASTER: A plague has struck. Sickbays are full. ${workersKilled} workers have died.`,
    }],
    trace: [{ draw: 'severity', max: state.difficulty, value: severity }],
  };
}

export function applyRadiationStorm(state) {
  return {
    state: {
      ...state,
      health: trunc(state.health / 3),
      efficiency: trunc(state.efficiency / 3),
      deathRate: state.deathRate + 5,
    },
    outcome: { disasterId: DISASTER_IDS.RADIATION_STORM, applied: true },
    effects: [{
      type: 'message',
      text: "DISASTER: Radiation storm! Workers' health and efficiency have dropped significantly.",
    }],
    trace: [],
  };
}
