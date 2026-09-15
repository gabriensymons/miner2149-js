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

// --- Playtest tuning, 2026-08-20 -------------------------------------------
// The source drops a meteor 1-2 pixels per step from y=60, so it crosses the
// screen in about a second. That reads as unfair rather than tense, so the port
// halves the per-step travel and starts the fall above the frame. Scaling drift
// by the same factor keeps each meteor's approach angle identical to the
// source's; only the speed changes, and the 2:1 fast/slow variety survives.
const FALL_SPEED_SCALE = 0.5;
// One meteor height clear of the top border, so a meteor is already moving by
// the time the player can see it.
const SPAWN_Y = -10;
// The play field the meteor may occupy. Leaving the side no longer counts as a
// miss: the meteor wraps to the opposite edge and keeps falling, so every
// meteor is resolved by the player or by hitting the ground.
const PLAY_LEFT = 5;
const PLAY_RIGHT = 145;
const PLAY_SPAN = PLAY_RIGHT - PLAY_LEFT;
const GROUND_Y = 133;
// The turret cannot aim above the inner frame or below the ground line.
const AIM_TOP = PLAY_LEFT;
const AIM_BOTTOM = 140;
// Cooldown units the recharge bar recovers per simulation step. The source
// recovers exactly one, and halving the fall speed left the player with far more
// shots per meteor than the original allowed -- so this is the knob that
// rebalances it, and the dev panel drives it directly during playtesting.
// Set to 0.5 on 2026-08-20 playtest evidence: half the source rate, which is
// the same factor the fall speed was slowed by.
const DEFAULT_RECHARGE_STEP = 0.5;
// A full recharge bar, in cooldown units. Source line 300: rect(1,120,147,150-f,153,0).
const RECHARGE_FULL = 30;

// --- Class scaling, 2026-09-08 ---------------------------------------------
// The 2026-08-20 numbers were tuned on a class 5 asteroid, where a perfect
// defense is rare. Read as a fixed setting they make every class equally
// punishing, which wastes the difficulty the player chose at the survey screen.
// They are therefore the class 5 end of a gradient, and the lower classes are
// eased -- slightly, one step at a time, so that class 4 still feels like a
// class 4 storm rather than a different mini-game.
//
// Both knobs are safe under the parity rule at the top of this file: recharge
// only governs how soon the player may fire again, and the tank only matters
// once there is a laser to disable. A player who never fires sees an identical
// storm at every class, so the do-nothing outcome is untouched.
//
// `stepDelay` already scales with class from the source (30 - class * 6), so
// meteor *speed* is not on this gradient -- that one is the original's and is
// not ours to re-tune.

// Cooldown units recovered per step, by asteroid class. Class 5 is the measured
// value; each lower class recovers 0.05 more, so class 1 fires roughly a third
// more often than class 5 rather than twice as often.
const RECHARGE_STEP_BY_CLASS = Object.freeze({
  1: 0.7, 2: 0.65, 3: 0.6, 4: 0.55, 5: 0.5,
});

// Pixels of meteor-on-tank overlap forgiven as a glancing blow, by class. At
// class 5 any contact wrecks the platform, which is the measured ~18% of the
// play span; each lower class forgives one more pixel on each side, taking the
// band to 23, 21, 19 and 17 pixels -- about 16.4%, 15.0%, 13.6% and 12.1%.
//
// Expressed as forgiveness rather than as a narrower tank on purpose: the tank
// sprite does not change size, so a rule that simply shrank the hitbox would
// leave meteors visibly landing on the platform without damaging it. A meteor
// that clips the outer pixel of the housing and is shrugged off is something a
// player can see happen and believe.
const TANK_GLANCE_TOLERANCE_BY_CLASS = Object.freeze({
  1: 4, 2: 3, 3: 2, 4: 1, 5: 0,
});

/** The recharge rate a class plays at, absent a dev-panel override. */
export function rechargeStepForClass(difficulty) {
  return RECHARGE_STEP_BY_CLASS[difficulty] ?? DEFAULT_RECHARGE_STEP;
}

/** Overlap in pixels a class shrugs off before the platform is wrecked. */
export function tankGlanceToleranceForClass(difficulty) {
  return TANK_GLANCE_TOLERANCE_BY_CLASS[difficulty] ?? 0;
}

// --- Amended parity, 2026-08-20 ---------------------------------------------
// The original rule was "no action yields exactly the original outcome; an
// intervention may only reduce damage". The user amended it: no action still
// yields exactly the original outcome, but skilled play may now do better than
// the original allowed, within the calibrated caps recorded here and in the
// Master TODO decisions log.

// A hit landed above this row cracks the meteor into two halves instead of
// destroying it. Below it, a hit is a clean kill as before. The window is the
// top of the visible fall, so shooting early stops being strictly better.
const SPLIT_CEILING_Y = 40;
// The halves are thrown outwards so they separate into two distinct targets,
// but only for a burst. Left to drift apart for the whole fall they end up on
// opposite sides of the screen, and with one tank in the middle clearing both
// would be impossible -- the bonus would never fire. After the burst they fall
// parallel, about 26px apart: two adjacent targets, which is the skill test.
const SPLIT_DRIFT = 1 * FALL_SPEED_SCALE;
const SPLIT_SPREAD_STEPS = 20;
const SPLIT_BIRTH_OFFSET = 3;
// Clearing both halves refunds the two shots that killed them. The shot that
// cracked the meteor open is still paid for, so a perfect split costs exactly
// one shot -- the same as a clean kill -- and pays a cracked core on top. Since
// the refund only returns power already spent, it can never leave the player
// above the do-nothing baseline of initialPower.
const SPLIT_POWER_REFUND = 2 * 7;
// Diridium found in a cracked core. Roughly one day of production for a
// mid-game colony -- noticeable, not decisive. First calibration, to playtest.
const CORE_STRIKE_DIRIDIUM = 2000;
// Morale calibrated against the measured drift rate of +2 per 7-day advance
// under good conditions: a perfect defense is worth about two and a half weeks
// of good management, and a fully missed 12-meteor storm about twelve weeks.
const PERFECT_DEFENSE_MORALE = 5;
const MORALE_PENALTY_PER_MISS = 2;

// The armed tank occupies x=72..87 (SRCBMP-017 is 15 wide at x=72). A meteor is
// 10 wide, so their footprints overlap for meteor x in (62, 87) -- about 18% of
// the play span. A meteor landing there wrecks the platform.
const TANK_LEFT = 72;
const TANK_RIGHT = 87;
const METEOR_WIDTH = 10;

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
  rechargeStep,
  glanceTolerance,
}) {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new RangeError('difficulty must be an integer from 1 through 5');
  }
  if (!Number.isInteger(meteorCount) || meteorCount < 1) {
    throw new RangeError('meteorCount must be a positive integer');
  }
  // Both default from the class, so a caller that says nothing gets the
  // gradient; the dev panel overrides them to playtest a single step of it.
  const step = rechargeStep ?? rechargeStepForClass(difficulty);
  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError('rechargeStep must be a positive number');
  }
  const tolerance = glanceTolerance ?? tankGlanceToleranceForClass(difficulty);
  if (!Number.isInteger(tolerance) || tolerance < 0) {
    throw new RangeError('glanceTolerance must be a non-negative integer');
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
    // One meteor is spawned at a time, as the source does; the array exists
    // because a hit near the top splits one meteor into two live halves.
    meteors: [],
    nextMeteorId: 1,
    laserDisabled: false,
    coreStrikes: 0,
    // Set to a slot number once any half of that split has been shot down, so
    // the sibling landing later cannot turn a saved slot back into a miss.
    savedSlot: null,
    warnings: [],
    input: { held: false, aim: null },
    difficulty,
    day,
    jobs,
    efficiency,
    stepDelay: 30 - difficulty * 6,
    rechargeStep: step,
    glanceTolerance: tolerance,
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
    meteors: state.meteors.map((meteor) => ({ ...meteor })),
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

// A meteor that drifts past an edge reappears at the opposite one rather than
// being written off as a miss. Nothing escapes sideways, so the storm's meteor
// count always resolves into hits plus ground impacts.
function wrapHorizontally(x) {
  if (x < PLAY_LEFT) return x + PLAY_SPAN;
  if (x > PLAY_RIGHT) return x - PLAY_SPAN;
  return x;
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

// A slot is one meteor of the storm's sequence. A split turns one slot into two
// live halves that share it, so the pair can never cost more than the single
// meteor would have if the player had never fired -- the parity ceiling.
function slotOf(meteor) {
  return meteor.slot;
}

function spawnMeteor(state, random) {
  return {
    id: state.nextMeteorId,
    slot: state.currentIndex,
    x: 10 + drawExclusive(random, 130),
    y: SPAWN_Y,
    drift: (1 - drawExclusive(random, 3)) * FALL_SPEED_SCALE,
    fallStep: (1 + drawExclusive(random, 2)) * FALL_SPEED_SCALE,
    split: false,
    status: 'inbound',
  };
}

// Two halves thrown outwards from where the parent was cracked open. They keep
// the parent's slot and fall speed; only their horizontal travel differs.
function splitMeteor(state, parent) {
  return [-1, 1].map((direction, offset) => ({
    ...parent,
    id: state.nextMeteorId + offset,
    x: clamp(parent.x + direction * SPLIT_BIRTH_OFFSET, PLAY_LEFT, PLAY_RIGHT),
    drift: parent.drift + direction * SPLIT_DRIFT,
    // Restored once the outward burst is spent, so the pair settles into the
    // parent's own trajectory instead of flying apart forever.
    baseDrift: parent.drift,
    spread: SPLIT_SPREAD_STEPS,
    split: true,
    status: 'inbound',
  }));
}

function hits(aim, meteor) {
  return aim.x > meteor.x + 1
    && aim.x < meteor.x + 9
    && aim.y + 1 > meteor.y
    && aim.y < meteor.y + 9;
}

export function fireMeteorLaser(state, { x, y }) {
  if (
    state.phase !== 'active'
    || state.laserDisabled
    || state.cooldown !== 0
    || state.power <= 0
    || !state.meteors.some((meteor) => meteor.status === 'inbound')
  ) {
    return copyState(state);
  }

  const aim = { x, y: clamp(y, AIM_TOP, AIM_BOTTOM) };
  const power = state.power - 7;
  const cooldown = trunc(RECHARGE_FULL - power / 4);
  const effects = [{ type: 'laser', from: { x: 80, y: 140 }, to: aim }];

  // The lowest meteor is the most urgent, so it wins an overlapping aim.
  const target = [...state.meteors]
    .filter((meteor) => meteor.status === 'inbound')
    .sort((left, right) => right.y - left.y)
    .find((meteor) => hits(aim, meteor));

  if (!target) return copyState(state, { power, cooldown, effects });

  // A hit near the top cracks the meteor open instead of destroying it. Halves
  // do not split again, or a patient player could farm one meteor forever.
  if (!target.split && target.y < SPLIT_CEILING_Y) {
    const halves = splitMeteor(state, target);
    return copyState(state, {
      meteors: [
        ...state.meteors.filter((meteor) => meteor.id !== target.id),
        ...halves,
      ],
      nextMeteorId: state.nextMeteorId + 2,
      power,
      cooldown,
      effects: [...effects, {
        type: 'meteor-split',
        x: target.x,
        y: target.y,
        fallStep: target.fallStep,
        drift: target.drift,
      }],
    });
  }

  const remaining = state.meteors.filter((meteor) => meteor.id !== target.id);
  // `fallStep` and `drift` ride along so the view can let the wreckage keep the
  // meteor's own momentum for a moment instead of inventing a motion for it.
  // Informational only: the slot is resolved the instant the shot lands, and
  // nothing downstream of these two fields can change an outcome.
  const destroyedEffect = {
    type: 'meteor-hit',
    index: target.slot,
    x: target.x,
    y: target.y,
    fallStep: target.fallStep,
    drift: target.drift,
  };

  // Clearing both halves of a split is the reward case: the shots are refunded
  // and the cracked core is recorded for the closing news flash.
  const clearedSplit = target.split
    && !remaining.some((meteor) => meteor.slot === target.slot);
  const refunded = clearedSplit
    ? Math.min(state.initialPower, power + SPLIT_POWER_REFUND)
    : power;

  return resolveSlot(copyState(state, {
    meteors: remaining,
    power: refunded,
    cooldown,
    coreStrikes: state.coreStrikes + (clearedSplit ? 1 : 0),
    effects: clearedSplit
      ? [...effects, destroyedEffect, { type: 'core-strike', slot: target.slot }]
      : [...effects, destroyedEffect],
  }), target.slot, 'destroyed');
}

// Closes out a slot once none of its meteors are still in the air. A slot that
// lost every half to the ground is a miss; a slot where the player shot down at
// least one half is not, which is what keeps a split from ever costing more
// than leaving the meteor alone would have -- the parity ceiling.
function resolveSlot(state, slot, outcome) {
  const saved = outcome === 'destroyed' || state.savedSlot === slot;
  if (state.meteors.some((meteor) => slotOf(meteor) === slot)) {
    // A sibling half is still falling, so the slot is not decided yet.
    return copyState(state, {
      savedSlot: saved ? slot : state.savedSlot,
      effects: state.effects,
    });
  }
  return copyState(state, {
    currentIndex: state.currentIndex + 1,
    destroyed: state.destroyed + (saved ? 1 : 0),
    missed: state.missed + (saved ? 0 : 1),
    savedSlot: state.savedSlot === slot ? null : state.savedSlot,
    effects: state.effects,
  });
}

export function stepMeteorStorm(state, { random } = {}) {
  if (state.phase !== 'active') return copyState(state);

  if (state.meteors.length === 0) {
    if (state.currentIndex >= state.total) return copyState(state, { phase: 'complete' });
    return copyState(state, {
      meteors: [spawnMeteor(state, random)],
      nextMeteorId: state.nextMeteorId + 1,
    });
  }

  let working = copyState(state, { warnings: [] });
  if (working.power > 1 && working.power <= 15) {
    working = copyState(working, { power: working.power + 1, warnings: ['low-power'] });
  }

  const drained = working.power <= 1 && working.cooldown !== 0;
  if (drained) {
    working = copyState(working, {
      meteors: working.meteors.map((meteor) => ({
        ...meteor,
        fallStep: 3 * FALL_SPEED_SCALE,
      })),
      warnings: ['power-drained'],
    });
  }

  if (
    working.input.held && working.input.aim
    && !working.laserDisabled && working.cooldown === 0 && working.power > 0
  ) {
    working = fireMeteorLaser(working, working.input.aim);
  }

  // The recharge bar doubles as the tank's repair timer, so it keeps filling
  // while the platform is down.
  if (!drained && working.power > 0 && working.cooldown > 0) {
    working = copyState(working, {
      cooldown: Math.max(0, working.cooldown - (working.rechargeStep ?? DEFAULT_RECHARGE_STEP)),
      effects: working.effects,
    });
  }
  if (working.laserDisabled && working.cooldown === 0) {
    working = copyState(working, {
      laserDisabled: false,
      effects: [...working.effects, { type: 'tank-repaired' }],
    });
  }

  return moveMeteors(working);
}

function moveMeteors(state) {
  let working = state;
  const landed = [];
  const airborne = [];

  for (const meteor of working.meteors) {
    const spread = meteor.spread > 0 ? meteor.spread - 1 : 0;
    const moved = {
      ...meteor,
      x: wrapHorizontally(meteor.x + meteor.drift),
      y: meteor.y + meteor.fallStep,
      spread,
      drift: meteor.spread > 0 && spread === 0 ? meteor.baseDrift : meteor.drift,
    };
    if (moved.y >= GROUND_Y) landed.push(moved);
    else airborne.push(moved);
  }

  if (landed.length === 0) {
    return copyState(working, { meteors: airborne, effects: working.effects });
  }

  const effects = [...working.effects];
  let laserDisabled = working.laserDisabled;
  let cooldown = working.cooldown;
  for (const meteor of landed) {
    effects.push({ type: 'meteor-missed', index: meteor.slot, x: meteor.x, y: meteor.y });
    if (glancesTank(working, meteor)) {
      effects.push({ type: 'tank-glanced', x: meteor.x, y: meteor.y });
    }
    if (hitsTank(working, meteor)) {
      laserDisabled = true;
      // Empty the bar: it is the repair timer, and the caption reads from it.
      cooldown = RECHARGE_FULL;
      effects.push({ type: 'tank-hit', x: meteor.x, y: meteor.y });
    }
  }

  working = copyState(working, {
    meteors: airborne,
    laserDisabled,
    cooldown,
    effects,
  });

  // Resolve each distinct slot once. Two halves of the same split landing on the
  // same step is one meteor's worth of damage, not two -- resolving per meteor
  // here would double-count the miss and break the parity ceiling.
  // Completion is left to the next step's empty-sky check so that a storm ending
  // on a miss and one ending on a hit finish through the same path.
  for (const slot of new Set(landed.map(slotOf))) {
    working = resolveSlot(working, slot, 'missed');
  }
  return working;
}

/** Pixels of the meteor's footprint that lie over the tank's, zero if clear. */
function tankOverlap(meteor) {
  return Math.min(meteor.x + METEOR_WIDTH, TANK_RIGHT) - Math.max(meteor.x, TANK_LEFT);
}

function hitsTank(state, meteor) {
  return tankOverlap(meteor) > (state.glanceTolerance ?? 0);
}

/** Contact the class forgave: it touched the platform and did no damage. */
function glancesTank(state, meteor) {
  const overlap = tankOverlap(meteor);
  return overlap > 0 && overlap <= (state.glanceTolerance ?? 0);
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

  const messages = [
    state.missed > 0
      ? `NEWS FLASH: Colony hit by ${state.missed} meteors. Check for damage.`
      : 'NEWS FLASH: Disaster avoided!',
  ];

  // Amended parity, 2026-08-20: skilled play may now beat the original outcome,
  // within the caps at the top of this file. A player who never fires still gets
  // exactly the original result -- no misses is unreachable without firing, and
  // both bonuses below are zero on the untouched path.
  const coreStrikes = state.coreStrikes ?? 0;
  const diridiumBonus = coreStrikes * CORE_STRIKE_DIRIDIUM;
  if (coreStrikes > 0) {
    messages.push(
      `NEWS FLASH: Diridium discovered in meteor core. Diridium increased by ${diridiumBonus} tons.`,
    );
  }

  const moraleDelta = state.missed === 0
    ? PERFECT_DEFENSE_MORALE
    : -MORALE_PENALTY_PER_MISS * state.missed;
  if (state.missed === 0) {
    messages.push('NEWS FLASH: Colony defense holds. Morale is up.');
  }

  return {
    nextEfficiency,
    nextMaps,
    message: messages[0],
    messages,
    moraleDelta,
    diridiumBonus,
    stats: {
      total: state.total,
      destroyed: state.destroyed,
      missed: state.missed,
      coreStrikes,
    },
  };
}
