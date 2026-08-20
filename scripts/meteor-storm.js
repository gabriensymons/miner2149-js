const POWER_WEIGHTS = Object.freeze({
  bulldozer: 1,
  diridiumMine: 5,
  hydroponics: 5,
  lifeSupport: 7,
  spacePort: 1,
  processor: 10,
  sickbay: 3,
  storage: 1,
});

function trunc(value) {
  const result = Math.trunc(value);
  return Object.is(result, -0) ? 0 : result;
}

function calculateInitialPower({ buildingCounts, day }) {
  const demand = Object.entries(POWER_WEIGHTS).reduce(
    (total, [name, weight]) => total + (buildingCounts[name] ?? 0) * weight,
    0,
  );
  const plants = buildingCounts.powerPlant ?? 0;
  let power = demand === 0
    ? (plants > 0 ? 100 : 0)
    : trunc(100 * (plants * 100) / demand);
  if (power > 100 || day < 21) power = 100;
  return power;
}

export function createMeteorStorm({
  difficulty,
  day,
  jobs,
  efficiency,
  buildingCounts,
  meteorCount,
}) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new RangeError('difficulty must be an integer from 1 through 5');
  }
  if (!Number.isInteger(meteorCount) || meteorCount < 1) {
    throw new RangeError('meteorCount must be a positive integer');
  }
  const initialPower = calculateInitialPower({ buildingCounts, day });
  return {
    version: 1,
    phase: 'deploying',
    total: meteorCount,
    currentIndex: 0,
    destroyed: 0,
    missed: 0,
    power: initialPower === 0 ? 1 : initialPower,
    initialPower,
    cooldown: 0,
    meteor: null,
    warnings: [],
    input: { held: false, aim: null },
    difficulty,
    day,
    jobs,
    efficiency,
    stepDelay: 30 - difficulty * 6,
    effects: [],
  };
}

function drawExclusive(random, max) {
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const value = random(max);
  if (!Number.isInteger(value) || value < 0 || value >= max) {
    throw new RangeError(`random(${max}) must return an integer from 0 through ${max - 1}`);
  }
  return value;
}

function copyState(state, overrides = {}) {
  return {
    ...state,
    meteor: state.meteor ? { ...state.meteor } : null,
    warnings: [...state.warnings],
    input: {
      held: state.input.held,
      aim: state.input.aim ? { ...state.input.aim } : null,
    },
    effects: [],
    ...overrides,
  };
}

export function activateMeteorStorm(state) {
  if (state.phase !== 'deploying') return copyState(state);
  return copyState(state, { phase: 'active' });
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function setMeteorLaserInput(state, { held, x, y }) {
  return copyState(state, {
    input: held
      ? { held: true, aim: { x, y } }
      : { held: false, aim: null },
  });
}

export function clearMeteorLaserInput(state) {
  return copyState(state, { input: { held: false, aim: null } });
}

export function fireMeteorLaser(state, { x, y }) {
  if (
    state.phase !== 'active'
    || state.meteor?.status !== 'inbound'
    || state.cooldown !== 0
    || state.power <= 0
  ) {
    return copyState(state);
  }

  const aim = { x, y: clamp(y, 60, 140) };
  const power = state.power - 7;
  const cooldown = trunc(30 - power / 4);
  const effects = [{
    type: 'laser',
    from: { x: 80, y: 140 },
    to: aim,
  }];
  const hit = aim.x > state.meteor.x + 1
    && aim.x < state.meteor.x + 9
    && aim.y + 1 > state.meteor.y
    && aim.y < state.meteor.y + 9;

  if (!hit) return copyState(state, { power, cooldown, effects });

  return copyState(state, {
    phase: 'impact',
    meteor: { ...state.meteor, status: 'destroyed' },
    currentIndex: state.currentIndex + 1,
    destroyed: state.destroyed + 1,
    power,
    cooldown,
    effects: [...effects, { type: 'meteor-hit', index: state.currentIndex }],
  });
}

export function stepMeteorStorm(state, { random } = {}) {
  if (state.phase === 'impact') {
    return copyState(state, {
      phase: state.currentIndex === state.total ? 'complete' : 'active',
      meteor: null,
    });
  }
  if (state.phase !== 'active') return copyState(state);

  if (state.meteor === null) {
    return copyState(state, {
      meteor: {
        x: 10 + drawExclusive(random, 130),
        y: 60,
        drift: 1 - drawExclusive(random, 3),
        fallStep: 1 + drawExclusive(random, 2),
        status: 'inbound',
      },
    });
  }

  let working = copyState(state, { warnings: [] });
  if (working.power > 1 && working.power <= 15) {
    working = copyState(working, {
      power: working.power + 1,
      warnings: ['low-power'],
    });
  }

  const drained = working.power <= 1 && working.cooldown !== 0;
  if (drained) {
    working = copyState(working, {
      meteor: { ...working.meteor, fallStep: 3 },
      warnings: ['power-drained'],
    });
  }

  if (working.input.held && working.input.aim && working.cooldown === 0 && working.power > 0) {
    working = fireMeteorLaser(working, working.input.aim);
  }
  if (working.phase === 'impact') return working;

  if (!drained && working.power > 0 && working.cooldown > 0) {
    working = copyState(working, {
      cooldown: Math.max(0, working.cooldown - 1),
      effects: working.effects,
    });
  }

  const meteor = {
    ...working.meteor,
    x: working.meteor.x + working.meteor.drift,
    y: working.meteor.y + working.meteor.fallStep,
  };
  if (meteor.x < 5 || meteor.x > 145 || meteor.y >= 133) {
    meteor.status = 'missed';
    return copyState(working, {
      phase: 'impact',
      meteor,
      currentIndex: working.currentIndex + 1,
      missed: working.missed + 1,
      effects: [
        ...working.effects,
        { type: 'meteor-missed', index: working.currentIndex },
      ],
    });
  }
  return copyState(working, { meteor, effects: working.effects });
}

function cloneMaps(maps) {
  return Object.fromEntries(Object.entries(maps).map(([level, rows]) => [
    level,
    Object.fromEntries(Object.entries(rows).map(([row, cells]) => [row, [...cells]])),
  ]));
}

export function applyMeteorDamage(maps, missedCount, options = {}) {
  if (!Number.isInteger(missedCount) || missedCount < 0) {
    throw new RangeError('missedCount must be a non-negative integer');
  }
  const random = typeof options === 'function' ? options : options.random;
  const nextMaps = cloneMaps(maps);
  const attempts = Math.max(0, missedCount - 1);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const index = drawExclusive(random, 100);
    const row = Math.floor(index / 10);
    const column = index % 10;
    nextMaps.level1[`row${row}`][column] = 3;
  }
  return nextMaps;
}

export function finishMeteorStorm(state, options = {}, legacyOptions = {}) {
  const wrappedOptions = options && Object.hasOwn(options, 'maps');
  const maps = wrappedOptions ? options.maps : options;
  const random = wrappedOptions ? options.random : legacyOptions.random;
  const workforceEfficiency = trunc(state.power * state.jobs / 100);
  const nextEfficiency = state.power < state.initialPower
    ? trunc((workforceEfficiency + state.efficiency) / 2)
    : state.efficiency;
  const nextMaps = applyMeteorDamage(maps, state.missed, { random });
  const message = state.missed > 0
    ? `NEWS FLASH: Colony hit by ${state.missed} meteors. Check for damage.`
    : 'NEWS FLASH: Disaster avoided!';

  return {
    nextEfficiency,
    nextMaps,
    message,
    stats: {
      total: state.total,
      destroyed: state.destroyed,
      missed: state.missed,
    },
  };
}
