import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateMeteorStorm,
  applyMeteorDamage,
  clearMeteorLaserInput,
  createMeteorStorm,
  finishMeteorStorm,
  fireMeteorLaser,
  rechargeStepForClass,
  setMeteorLaserInput,
  stepMeteorStorm,
  tankGlanceToleranceForClass,
} from '../scripts/meteor-storm.js';

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

function stormOptions(overrides = {}) {
  return {
    difficulty: 3,
    day: 40,
    jobs: 80,
    efficiency: 90,
    buildingCounts: {
      bulldozer: 0,
      diridiumMine: 0,
      hydroponics: 0,
      lifeSupport: 0,
      spacePort: 0,
      powerPlant: 1,
      processor: 10,
      sickbay: 0,
      storage: 0,
    },
    meteorCount: 2,
    ...overrides,
  };
}

test('meteor storm constructor creates a serializable deterministic deployment state', () => {
  const options = stormOptions();

  const state = createMeteorStorm(options);

  assert.deepEqual(state, {
    version: 1,
    phase: 'deploying',
    total: 2,
    currentIndex: 0,
    destroyed: 0,
    missed: 0,
    power: 100,
    initialPower: 100,
    cooldown: 0,
    meteors: [],
    nextMeteorId: 1,
    laserDisabled: false,
    coreStrikes: 0,
    savedSlot: null,
    warnings: [],
    input: { held: false, aim: null },
    difficulty: 3,
    day: 40,
    jobs: 80,
    efficiency: 90,
    stepDelay: 12,
    rechargeStep: 0.6,
    glanceTolerance: 2,
    effects: [],
  });
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.deepEqual(options, stormOptions());
  assert.throws(() => createMeteorStorm(stormOptions({ rechargeStep: 0 })), RangeError);
});

test('the recharge step sets how fast the bar refills and defaults to half the source rate', () => {
  const sourceRate = stepMeteorStorm(inboundStorm({ cooldown: 6, rechargeStep: 1 }), {
    random: sequenceRandom([]),
  });
  const halfRate = stepMeteorStorm(
    inboundStorm({ cooldown: 6 }),
    { random: sequenceRandom([]) },
  );

  assert.equal(sourceRate.cooldown, 5, 'the source recovers one cooldown unit per step');
  assert.equal(halfRate.cooldown, 5.5, 'the port default takes twice as long to refill');
  assert.equal(
    stepMeteorStorm(inboundStorm({ cooldown: 0.25, rechargeStep: 0.5 }),
      { random: sequenceRandom([]) }).cooldown,
    0,
    'the bar never overfills past ready',
  );
});

test('meteor laser power is capped and gets a one-unit emergency reserve when generation is zero', () => {
  const noGeneration = createMeteorStorm(stormOptions({
    buildingCounts: {
      bulldozer: 1,
      diridiumMine: 0,
      hydroponics: 0,
      lifeSupport: 0,
      spacePort: 0,
      powerPlant: 0,
      processor: 0,
      sickbay: 0,
      storage: 0,
    },
  }));
  const gracePeriod = createMeteorStorm(stormOptions({
    day: 20,
    buildingCounts: {
      bulldozer: 1,
      diridiumMine: 0,
      hydroponics: 0,
      lifeSupport: 0,
      spacePort: 0,
      powerPlant: 0,
      processor: 0,
      sickbay: 0,
      storage: 0,
    },
  }));

  assert.equal(noGeneration.power, 1);
  assert.equal(noGeneration.initialPower, 0);
  assert.equal(gracePeriod.power, 100);
  assert.equal(gracePeriod.initialPower, 100);
});

test('activation and spawn use exclusive source ranges without moving the new meteor', () => {
  const deploying = createMeteorStorm(stormOptions());
  const active = activateMeteorStorm(deploying);
  const random = sequenceRandom([129, 2, 1]);

  const spawned = stepMeteorStorm(active, { random });

  assert.equal(active.phase, 'active');
  assert.deepEqual(spawned.meteors, [{
    id: 1,
    slot: 0,
    x: 139,
    y: -10,
    drift: -0.5,
    fallStep: 1,
    split: false,
    status: 'inbound',
  }]);
  assert.equal(spawned.currentIndex, 0);
  assert.deepEqual(random.calls, [130, 3, 2]);
  assert.equal(deploying.phase, 'deploying');
  random.assertDone();
});

test('a meteor leaving either side wraps to the opposite edge instead of counting as a miss', () => {
  const random = sequenceRandom([]);
  const active = activateMeteorStorm(createMeteorStorm(stormOptions()));
  const leavingRight = withMeteors(active, [meteorAt({ x: 145, y: 80, drift: 0.5 })]);
  const leavingLeft = withMeteors(active, [meteorAt({ x: 5, y: 80, drift: -0.5 })]);

  const wrappedLeft = stepMeteorStorm(leavingRight, { random });
  const wrappedRight = stepMeteorStorm(leavingLeft, { random });

  assert.equal(wrappedLeft.phase, 'active', 'the side is not an impact');
  assert.equal(wrappedLeft.meteors[0].status, 'inbound');
  assert.equal(wrappedLeft.meteors[0].x, 5.5, 'x=145.5 reappears 140 pixels left');
  assert.equal(wrappedLeft.meteors[0].y, 81, 'the fall continues through the wrap');
  assert.equal(wrappedLeft.missed, 0);
  assert.equal(wrappedRight.meteors[0].x, 144.5, 'x=4.5 reappears 140 pixels right');
  assert.equal(wrappedRight.missed, 0);
  random.assertDone();
});

test('a ground impact is recorded as a miss before allowing the next sequential spawn', () => {
  const random = sequenceRandom([5, 1, 0]);
  const active = activateMeteorStorm(createMeteorStorm(stormOptions()));
  const aboutToLand = withMeteors(active, [meteorAt({ x: 60, y: 132.5, drift: 0, fallStep: 1 })]);

  const landed = stepMeteorStorm(aboutToLand, { random });
  const secondMeteor = stepMeteorStorm(landed, { random });

  assert.equal(landed.phase, 'active');
  assert.deepEqual(landed.meteors, [], 'the meteor leaves the sky the step it lands');
  assert.equal(landed.currentIndex, 1);
  assert.equal(landed.missed, 1);
  assert.deepEqual(
    landed.effects.filter(({ type }) => type === 'meteor-missed'),
    [{ type: 'meteor-missed', index: 0, x: 60, y: 133.5 }],
    'the effect carries the impact point for the view to draw',
  );
  assert.deepEqual(secondMeteor.meteors, [{
    id: 2,
    slot: 1,
    x: 15,
    y: -10,
    drift: 0,
    fallStep: 0.5,
    split: false,
    status: 'inbound',
  }]);
  random.assertDone();
});

test('bottom impact completes only after the final impact state and preserves the count invariant', () => {
  const active = activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 })));
  const inbound = withMeteors(active, [meteorAt({ x: 40, y: 132, drift: 0, fallStep: 2 })]);

  const impact = stepMeteorStorm(inbound, { random: sequenceRandom([]) });
  const complete = stepMeteorStorm(impact, { random: sequenceRandom([]) });

  assert.equal(impact.phase, 'active');
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.currentIndex, 1);
  assert.equal(complete.destroyed + complete.missed, complete.total);
});

// x=40 keeps a landing meteor clear of the tank footprint at x=72..87 unless a
// test is deliberately aiming for it.
function meteorAt({ x = 50, y = 70, drift = 0, fallStep = 1, id = 1, slot = 0, split = false }) {
  return { id, slot, x, y, drift, fallStep, split, status: 'inbound' };
}

function withMeteors(state, meteors) {
  return { ...state, meteors, nextMeteorId: meteors.length + 1 };
}

function inboundStorm(overrides = {}) {
  const { meteors, ...rest } = overrides;
  return {
    ...activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 }))),
    meteors: meteors ?? [meteorAt({ x: 50, y: 70 })],
    nextMeteorId: 2,
    // Pinned so the firing and cooldown tests below measure the mechanic rather
    // than whichever class the shared options happen to name. The class
    // gradient itself is covered by its own test.
    rechargeStep: 0.5,
    ...rest,
  };
}

test('accepted laser fire clamps aim, spends seven power, and truncates cooldown from remaining power', () => {
  const state = inboundStorm();

  const fired = fireMeteorLaser(state, { x: 100, y: 200 });

  assert.equal(fired.power, 93);
  assert.equal(fired.cooldown, 6);
  assert.equal(fired.phase, 'active');
  assert.deepEqual(fired.effects, [{
    type: 'laser',
    from: { x: 80, y: 140 },
    to: { x: 100, y: 140 },
  }]);
  assert.equal(state.power, 100);
});

test('aim is clamped to the visible field so a meteor above the frame cannot be shot early', () => {
  const high = fireMeteorLaser(
    inboundStorm({ meteors: [meteorAt({ x: 50, y: -8, fallStep: 0.5 })] }),
    { x: 55, y: -8 },
  );

  assert.deepEqual(high.effects.at(0).to, { x: 55, y: 5 }, 'aim stops at the inner frame');
  assert.equal(high.phase, 'active', 'the clamped beam misses the offscreen meteor');
  assert.equal(high.destroyed, 0);
});

test('laser cooldown and zero power each reject fire without spending power', () => {
  const cooling = fireMeteorLaser(inboundStorm({ cooldown: 1 }), { x: 52, y: 70 });
  const empty = fireMeteorLaser(inboundStorm({ power: 0 }), { x: 52, y: 70 });

  assert.equal(cooling.power, 100);
  assert.equal(cooling.cooldown, 1);
  assert.deepEqual(cooling.effects, []);
  assert.equal(empty.power, 0);
  assert.deepEqual(empty.effects, []);
});

test('laser hitbox uses strict source edges and a hit can be counted only once', () => {
  const xEdge = fireMeteorLaser(inboundStorm(), { x: 51, y: 70 });
  const yEdge = fireMeteorLaser(inboundStorm(), { x: 52, y: 69 });
  const hit = fireMeteorLaser(inboundStorm(), { x: 52, y: 70 });
  const duplicate = fireMeteorLaser(hit, { x: 52, y: 70 });

  assert.equal(xEdge.destroyed, 0);
  assert.equal(yEdge.destroyed, 0);
  assert.equal(hit.phase, 'active');
  assert.deepEqual(hit.meteors, [], 'the destroyed meteor leaves the sky at once');
  assert.equal(hit.destroyed, 1);
  assert.equal(hit.currentIndex, 1);
  assert.equal(duplicate.destroyed, 1);
  assert.equal(duplicate.currentIndex, 1);
});

test('held fire waits through cooldown then auto-fires on the next eligible movement step', () => {
  const held = setMeteorLaserInput(inboundStorm({ cooldown: 1 }), {
    held: true,
    x: 100,
    y: 90,
  });

  // At the port's half rate a cooldown of 1 needs two steps to clear, and fire is
  // tested before the step's own recharge, so the shot lands on the third.
  const halfway = stepMeteorStorm(held, { random: sequenceRandom([]) });
  const recharged = stepMeteorStorm(halfway, { random: sequenceRandom([]) });
  const fired = stepMeteorStorm(recharged, { random: sequenceRandom([]) });

  assert.equal(halfway.cooldown, 0.5);
  assert.equal(recharged.cooldown, 0);
  assert.equal(recharged.power, 100, 'no power is spent while the bar is refilling');
  assert.equal(fired.power, 93);
  assert.equal(fired.cooldown, 5.5);
  assert.equal(fired.effects.filter(({ type }) => type === 'laser').length, 1);
});

test('clearing held input models release, cancel, outside, teardown, and visibility loss', () => {
  const held = setMeteorLaserInput(inboundStorm(), { held: true, x: 52, y: 70 });

  const cleared = clearMeteorLaserInput(held);
  const stepped = stepMeteorStorm(cleared, { random: sequenceRandom([]) });

  assert.deepEqual(cleared.input, { held: false, aim: null });
  assert.equal(stepped.power, 100);
  assert.equal(held.input.held, true);
});

test('low power recovers per step while drained power accelerates falling and freezes cooldown', () => {
  const low = stepMeteorStorm(inboundStorm({ power: 10 }), { random: sequenceRandom([]) });
  const drained = stepMeteorStorm(inboundStorm({ power: 1, cooldown: 3 }), {
    random: sequenceRandom([]),
  });

  assert.equal(low.power, 11);
  assert.deepEqual(low.warnings, ['low-power']);
  assert.equal(drained.power, 1);
  assert.equal(drained.cooldown, 3);
  assert.equal(drained.meteors[0].fallStep, 1.5, 'the drained penalty scales with the fall speed');
  assert.equal(drained.meteors[0].y, 71.5);
  assert.deepEqual(drained.warnings, ['power-drained']);
});

test('a hit above the split ceiling cracks the meteor into two halves', () => {
  const high = inboundStorm({ meteors: [meteorAt({ x: 50, y: 30 })] });

  const split = fireMeteorLaser(high, { x: 55, y: 35 });

  assert.equal(split.meteors.length, 2);
  assert.deepEqual(split.meteors.map(({ x, drift, split: isSplit }) => [x, drift, isSplit]), [
    [47, -0.5, true],
    [53, 0.5, true],
  ], 'the halves are thrown apart');
  assert.deepEqual(split.meteors.map(({ spread }) => spread), [20, 20]);
  assert.equal(split.currentIndex, 0, 'a split resolves nothing yet');
  assert.equal(split.destroyed, 0);
  assert.equal(split.power, 93, 'the splitting shot still costs power');
  assert.ok(split.effects.some(({ type }) => type === 'meteor-split'));
  assert.deepEqual(split.meteors.map(({ slot }) => slot), [0, 0], 'both halves share one slot');
});

test('a hit below the split ceiling is a clean kill, and halves never split again', () => {
  const low = inboundStorm({ meteors: [meteorAt({ x: 50, y: 41 })] });

  const killed = fireMeteorLaser(low, { x: 55, y: 45 });
  assert.deepEqual(killed.meteors, []);
  assert.equal(killed.destroyed, 1);

  const halfUpHigh = inboundStorm({
    meteors: [meteorAt({ x: 50, y: 20, split: true })],
  });
  const secondHit = fireMeteorLaser(halfUpHigh, { x: 55, y: 25 });
  assert.deepEqual(secondHit.meteors, [], 'a half is destroyed, not split again');
  assert.equal(secondHit.destroyed, 1);
});

test('clearing both halves refunds both shots and records a cracked core', () => {
  const pair = inboundStorm({
    meteors: [
      meteorAt({ id: 1, x: 40, y: 60, split: true }),
      meteorAt({ id: 2, x: 90, y: 60, split: true }),
    ],
    power: 86,
  });

  const first = fireMeteorLaser(pair, { x: 45, y: 65 });
  const second = fireMeteorLaser({ ...first, cooldown: 0 }, { x: 95, y: 65 });

  assert.equal(first.power, 79, 'the first half costs a shot like any other');
  assert.equal(first.coreStrikes, 0);
  assert.equal(first.currentIndex, 0, 'the slot waits for the sibling');
  assert.equal(second.power, 86, 'both shots come back when the pair is cleared');
  assert.equal(second.coreStrikes, 1);
  assert.equal(second.currentIndex, 1);
  assert.equal(second.destroyed, 1, 'a cleared split is one resolved meteor, not two');
  assert.ok(second.effects.some(({ type }) => type === 'core-strike'));
});

test('clearing a split is net-zero power, so it cannot beat the do-nothing baseline', () => {
  for (const power of [99, 86, 40]) {
    const pair = inboundStorm({
      meteors: [
        meteorAt({ id: 1, x: 40, y: 60, split: true }),
        meteorAt({ id: 2, x: 90, y: 60, split: true }),
      ],
      power,
      initialPower: 100,
    });

    const cleared = fireMeteorLaser(
      { ...fireMeteorLaser(pair, { x: 45, y: 65 }), cooldown: 0 },
      { x: 95, y: 65 },
    );

    assert.equal(cleared.power, power, `clearing a split from ${power} costs nothing net`);
    assert.ok(cleared.power <= cleared.initialPower, 'never above the untouched baseline');
  }
});

test('a split can never cost more damage than leaving the meteor alone would have', () => {
  const random = sequenceRandom([]);
  const onGround = (x, id) => meteorAt({ id, x, y: 132.9, drift: 0, fallStep: 1, split: true });

  // Both halves land: exactly the one miss the unsplit meteor would have been.
  const bothLand = stepMeteorStorm(
    inboundStorm({ meteors: [onGround(20, 1), onGround(40, 2)] }),
    { random },
  );
  assert.equal(bothLand.missed, 1, 'two halves down still costs one meteor of damage');
  assert.equal(bothLand.currentIndex, 1);

  // One half shot down, the other lands: the slot is saved, so no damage at all.
  const halfKilled = fireMeteorLaser(
    inboundStorm({ meteors: [meteorAt({ id: 1, x: 20, y: 60, split: true }), onGround(40, 2)] }),
    { x: 25, y: 65 },
  );
  const siblingLands = stepMeteorStorm({ ...halfKilled, input: { held: false, aim: null } }, { random });

  assert.equal(halfKilled.currentIndex, 0, 'still pending while the sibling falls');
  assert.equal(siblingLands.missed, 0, 'killing either half spares the colony');
  assert.equal(siblingLands.destroyed, 1);
  assert.equal(siblingLands.currentIndex, 1);
  assert.equal(siblingLands.savedSlot, null, 'the saved marker is cleared with the slot');
});

test('a meteor landing on the tank disables the laser until the recharge bar refills', () => {
  const random = sequenceRandom([]);
  // The tank occupies x=72..87; a 10px meteor overlaps it from x=63 to x=87.
  const onTank = inboundStorm({
    meteors: [meteorAt({ x: 78, y: 132.9, drift: 0, fallStep: 1 })],
    cooldown: 0,
  });

  const wrecked = stepMeteorStorm(onTank, { random });

  assert.equal(wrecked.laserDisabled, true);
  assert.equal(wrecked.cooldown, 30, 'the bar is emptied and becomes the repair timer');
  assert.equal(wrecked.missed, 1, 'the meteor still did its damage');
  assert.ok(wrecked.effects.some(({ type }) => type === 'tank-hit'));

  const blocked = fireMeteorLaser(
    { ...wrecked, cooldown: 0, meteors: [meteorAt({ x: 50, y: 70 })] },
    { x: 52, y: 70 },
  );
  assert.equal(blocked.power, 100, 'a wrecked platform cannot fire or spend power');
  assert.deepEqual(blocked.effects, []);
});

test('the tank repairs itself exactly when the bar comes back to full', () => {
  const random = sequenceRandom([]);
  const repairing = inboundStorm({
    meteors: [meteorAt({ x: 20, y: 60 })],
    laserDisabled: true,
    cooldown: 0.5,
  });

  const done = stepMeteorStorm(repairing, { random });

  assert.equal(done.cooldown, 0);
  assert.equal(done.laserDisabled, false);
  assert.ok(done.effects.some(({ type }) => type === 'tank-repaired'));
});

test('a meteor landing clear of the tank leaves the platform alone', () => {
  const random = sequenceRandom([]);
  for (const x of [50, 62, 88, 120]) {
    const landed = stepMeteorStorm(
      inboundStorm({ meteors: [meteorAt({ x, y: 132.9, drift: 0, fallStep: 1 })] }),
      { random },
    );
    assert.equal(landed.laserDisabled, false, `x=${x} misses the platform`);
  }
});

test('the outward burst is spent after twenty steps and the pair then falls parallel', () => {
  const random = sequenceRandom([]);
  let state = fireMeteorLaser(
    inboundStorm({ meteors: [meteorAt({ x: 70, y: 25, drift: 0.5, fallStep: 0.5 })] }),
    { x: 75, y: 30 },
  );
  const separation = () => Math.abs(state.meteors[0].x - state.meteors[1].x);

  assert.equal(separation(), 6, 'they are born six pixels apart');
  for (let step = 0; step < 20; step += 1) {
    state = stepMeteorStorm({ ...state, input: { held: false, aim: null } }, { random });
  }
  const spread = separation();
  assert.equal(spread, 26, 'the burst adds twenty pixels of separation');
  assert.deepEqual(state.meteors.map(({ spread: left }) => left), [0, 0]);
  assert.deepEqual(state.meteors.map(({ drift }) => drift), [0.5, 0.5],
    'both settle back onto the parent trajectory');

  for (let step = 0; step < 40; step += 1) {
    state = stepMeteorStorm({ ...state, input: { held: false, aim: null } }, { random });
  }
  assert.equal(separation(), spread, 'and stay that far apart for the rest of the fall');
});

function makeMaps(fill = 2) {
  return Object.fromEntries(['level1', 'level2', 'level3'].map((level) => [
    level,
    Object.fromEntries(Array.from({ length: 10 }, (_, row) => [
      `row${row}`,
      Array(10).fill(fill),
    ])),
  ]));
}

test('meteor damage preserves the source missed-minus-one attempts and permits duplicate cells', () => {
  const maps = makeMaps();
  const original = structuredClone(maps);
  const random = sequenceRandom([99, 99]);

  const nextMaps = applyMeteorDamage(maps, 3, { random });

  assert.equal(nextMaps.level1.row9[9], 3);
  assert.equal(nextMaps.level2.row9[9], 2);
  assert.deepEqual(maps, original);
  assert.notEqual(nextMaps, maps);
  assert.notEqual(nextMaps.level1.row9, maps.level1.row9);
  assert.deepEqual(random.calls, [100, 100]);
  random.assertDone();
});

test('finishing a perfect defense preserves efficiency and reports no map damage', () => {
  const maps = makeMaps();
  const random = sequenceRandom([]);
  const complete = {
    ...createMeteorStorm(stormOptions()),
    phase: 'complete',
    currentIndex: 2,
    destroyed: 2,
    missed: 0,
  };

  const result = finishMeteorStorm(complete, { maps, random });

  assert.equal(result.nextEfficiency, 90);
  assert.deepEqual(result.nextMaps, maps);
  assert.notEqual(result.nextMaps, maps);
  assert.equal(result.message, 'NEWS FLASH: Disaster avoided!');
  assert.deepEqual(result.messages, [
    'NEWS FLASH: Disaster avoided!',
    'NEWS FLASH: Colony defense holds. Morale is up.',
  ]);
  assert.equal(result.moraleDelta, 5, 'a perfect defense is worth ~2.5 weeks of good management');
  assert.equal(result.diridiumBonus, 0);
  assert.deepEqual(result.stats, { total: 2, destroyed: 2, missed: 0, coreStrikes: 0 });
  random.assertDone();
});

test('cracked meteor cores pay a diridium bonus and their own news flash', () => {
  const maps = makeMaps();
  const complete = {
    ...createMeteorStorm(stormOptions()),
    phase: 'complete',
    currentIndex: 2,
    destroyed: 2,
    missed: 0,
    coreStrikes: 2,
  };

  const result = finishMeteorStorm(complete, { maps, random: sequenceRandom([]) });

  assert.equal(result.diridiumBonus, 4000);
  assert.equal(result.stats.coreStrikes, 2);
  assert.deepEqual(result.messages, [
    'NEWS FLASH: Disaster avoided!',
    'NEWS FLASH: Diridium discovered in meteor core. Diridium increased by 4000 tons.',
    'NEWS FLASH: Colony defense holds. Morale is up.',
  ]);
});

test('a storm the player never touches yields exactly the original outcome', () => {
  const maps = makeMaps();
  // The untouched path: no shot fired, so power is untouched and every meteor
  // reaches the ground. Both amended-parity bonuses must be inert here.
  const untouched = {
    ...createMeteorStorm(stormOptions({ meteorCount: 3 })),
    phase: 'complete',
    currentIndex: 3,
    destroyed: 0,
    missed: 3,
  };

  const result = finishMeteorStorm(untouched, { maps, random: sequenceRandom([7, 7]) });

  assert.equal(result.nextEfficiency, 90, 'unspent power leaves efficiency alone');
  assert.equal(result.diridiumBonus, 0, 'no core can be cracked without firing');
  assert.equal(result.moraleDelta, -6, 'only the miss penalty applies');
  assert.deepEqual(result.messages, ['NEWS FLASH: Colony hit by 3 meteors. Check for damage.']);
});

test('finishing a damaged storm applies source-order efficiency conversion and surface damage', () => {
  const maps = makeMaps();
  const random = sequenceRandom([12, 34]);
  const complete = {
    ...createMeteorStorm(stormOptions({ meteorCount: 4, jobs: 73, efficiency: 81 })),
    phase: 'complete',
    currentIndex: 4,
    destroyed: 1,
    missed: 3,
    power: 80,
  };

  const result = finishMeteorStorm(complete, { maps, random });

  assert.equal(result.nextEfficiency, 69);
  assert.equal(result.nextMaps.level1.row1[2], 3);
  assert.equal(result.nextMaps.level1.row3[4], 3);
  assert.equal(result.nextMaps.level2.row1[2], 2);
  assert.equal(result.message, 'NEWS FLASH: Colony hit by 3 meteors. Check for damage.');
  assert.equal(result.moraleDelta, -6, 'two morale per missed meteor');
  assert.deepEqual(result.stats, { total: 4, destroyed: 1, missed: 3, coreStrikes: 0 });
  assert.equal(maps.level1.row1[2], 2);
  random.assertDone();
});

test('recharge and tank tolerance scale with the asteroid class, and never move the do-nothing outcome', () => {
  const byClass = [1, 2, 3, 4, 5].map((difficulty) => {
    const state = createMeteorStorm(stormOptions({ difficulty }));
    return { difficulty, rechargeStep: state.rechargeStep, glanceTolerance: state.glanceTolerance };
  });

  assert.deepEqual(byClass, [
    { difficulty: 1, rechargeStep: 0.7, glanceTolerance: 4 },
    { difficulty: 2, rechargeStep: 0.65, glanceTolerance: 3 },
    { difficulty: 3, rechargeStep: 0.6, glanceTolerance: 2 },
    { difficulty: 4, rechargeStep: 0.55, glanceTolerance: 1 },
    { difficulty: 5, rechargeStep: 0.5, glanceTolerance: 0 },
  ], 'class 5 is the measured tuning; every lower class is eased one step');

  assert.equal(
    rechargeStepForClass(3), 0.6,
    'the dev panel reads the class default from the same table the storm does',
  );
  assert.equal(tankGlanceToleranceForClass(3), 2);

  const overridden = createMeteorStorm(stormOptions({
    difficulty: 1,
    rechargeStep: 0.5,
    glanceTolerance: 0,
  }));
  assert.equal(overridden.rechargeStep, 0.5, 'the dev panel can pin any class to any rate');
  assert.equal(overridden.glanceTolerance, 0);

  assert.throws(() => createMeteorStorm(stormOptions({ glanceTolerance: -1 })), RangeError);
  assert.throws(() => createMeteorStorm(stormOptions({ glanceTolerance: 1.5 })), RangeError);
});

test('the class gradient moves only what firing can reach, so an untouched storm is identical', () => {
  // The parity rule: a player who never fires must get exactly the source
  // outcome at every class. Recharge governs when the player may fire again and
  // the tank only matters once there is a laser to disable, so neither can be
  // observed on the untouched path -- these two storms must run identically.
  function runUntouched(difficulty) {
    let state = activateMeteorStorm(createMeteorStorm(stormOptions({
      difficulty,
      meteorCount: 1,
    })));
    // The meteor is placed squarely on the tank, the case the tolerance governs.
    const random = sequenceRandom([70, 1, 1]);
    state = stepMeteorStorm(state, { random });
    for (let step = 0; step < 400 && state.phase === 'active'; step += 1) {
      state = stepMeteorStorm(state, { random: sequenceRandom([]) });
    }
    return {
      phase: state.phase,
      missed: state.missed,
      destroyed: state.destroyed,
      power: state.power,
      initialPower: state.initialPower,
    };
  }

  const easiest = runUntouched(1);
  const hardest = runUntouched(5);
  assert.deepEqual(easiest, hardest);
  assert.equal(hardest.missed, 1, 'an untouched meteor still lands');
  assert.equal(hardest.power, hardest.initialPower, 'no shot fired, no power spent');
});

test('a half whose slot was already saved lands without being counted or cratering', () => {
  // Both halves of a split share a fallStep and a y, so they always reach the
  // ground on the same step unless one was shot down first. Shooting one down
  // is therefore the only way a saved slot can have a half land at all.
  const random = sequenceRandom([]);
  let state = {
    ...activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 }))),
    meteors: [
      meteorAt({ x: 40, y: 132, slot: 0, id: 1 }),
      meteorAt({ x: 66, y: 132, slot: 0, id: 2 }),
    ],
    nextMeteorId: 3,
    // Set as though the player had already shot a third piece of this slot down.
    savedSlot: 0,
  };

  state = stepMeteorStorm(state, { random });

  const types = state.effects.map(({ type }) => type);
  assert.ok(types.includes('meteor-spent'), 'the landing is announced as spent');
  assert.ok(
    !types.includes('meteor-missed'),
    'and not as a miss, which is what leaves a crater on the field',
  );
  assert.equal(state.missed, 0, 'a saved slot costs no miss');
  assert.equal(state.destroyed, 1, 'it scores as the hit it was');

  // The rock still landed, so it can still wreck the platform under it. That is
  // deliberate: a saved slot is not a free pass for whatever is beneath it.
  let onTank = {
    ...activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 }))),
    meteors: [meteorAt({ x: 78, y: 132, slot: 0, id: 1 })],
    nextMeteorId: 2,
    savedSlot: 0,
  };
  onTank = stepMeteorStorm(onTank, { random: sequenceRandom([]) });
  const onTankTypes = onTank.effects.map(({ type }) => type);
  assert.ok(onTankTypes.includes('meteor-spent'));
  assert.ok(onTankTypes.includes('tank-hit'), 'the platform still takes it');
  assert.equal(onTank.laserDisabled, true);
});

test('an ordinary miss still announces itself as one', () => {
  let state = {
    ...activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 }))),
    meteors: [meteorAt({ x: 40, y: 132, slot: 0, id: 1 })],
    nextMeteorId: 2,
    savedSlot: null,
  };

  state = stepMeteorStorm(state, { random: sequenceRandom([]) });

  assert.ok(state.effects.some(({ type }) => type === 'meteor-missed'));
  assert.ok(!state.effects.some(({ type }) => type === 'meteor-spent'));
  assert.equal(state.missed, 1);
  assert.equal(state.destroyed, 0);
});
