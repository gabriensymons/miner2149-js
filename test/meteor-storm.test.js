import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activateMeteorStorm,
  applyMeteorDamage,
  clearMeteorLaserInput,
  createMeteorStorm,
  finishMeteorStorm,
  fireMeteorLaser,
  setMeteorLaserInput,
  stepMeteorStorm,
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
    meteor: null,
    warnings: [],
    input: { held: false, aim: null },
    difficulty: 3,
    day: 40,
    jobs: 80,
    efficiency: 90,
    stepDelay: 12,
    effects: [],
  });
  assert.doesNotThrow(() => JSON.stringify(state));
  assert.deepEqual(options, stormOptions());
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
  assert.deepEqual(spawned.meteor, {
    x: 139,
    y: 60,
    drift: -1,
    fallStep: 2,
    status: 'inbound',
  });
  assert.equal(spawned.currentIndex, 0);
  assert.deepEqual(random.calls, [130, 3, 2]);
  assert.equal(deploying.phase, 'deploying');
  random.assertDone();
});

test('movement records a sideways escape as a miss before allowing the next sequential spawn', () => {
  const random = sequenceRandom([5, 1, 0]);
  const active = activateMeteorStorm(createMeteorStorm(stormOptions()));
  const aboutToEscape = {
    ...active,
    meteor: { x: 145, y: 80, drift: 1, fallStep: 1, status: 'inbound' },
  };

  const impact = stepMeteorStorm(aboutToEscape, { random });
  const betweenMeteors = stepMeteorStorm(impact, { random });
  const secondMeteor = stepMeteorStorm(betweenMeteors, { random });

  assert.equal(impact.phase, 'impact');
  assert.equal(impact.meteor.status, 'missed');
  assert.equal(impact.currentIndex, 1);
  assert.equal(impact.missed, 1);
  assert.equal(betweenMeteors.phase, 'active');
  assert.equal(betweenMeteors.meteor, null);
  assert.deepEqual(secondMeteor.meteor, {
    x: 15,
    y: 60,
    drift: 0,
    fallStep: 1,
    status: 'inbound',
  });
  random.assertDone();
});

test('bottom impact completes only after the final impact state and preserves the count invariant', () => {
  const active = activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 })));
  const inbound = {
    ...active,
    meteor: { x: 80, y: 132, drift: 0, fallStep: 2, status: 'inbound' },
  };

  const impact = stepMeteorStorm(inbound, { random: sequenceRandom([]) });
  const complete = stepMeteorStorm(impact, { random: sequenceRandom([]) });

  assert.equal(impact.phase, 'impact');
  assert.equal(complete.phase, 'complete');
  assert.equal(complete.currentIndex, 1);
  assert.equal(complete.destroyed + complete.missed, complete.total);
});

function inboundStorm(overrides = {}) {
  return {
    ...activateMeteorStorm(createMeteorStorm(stormOptions({ meteorCount: 1 }))),
    meteor: { x: 50, y: 70, drift: 0, fallStep: 1, status: 'inbound' },
    ...overrides,
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
  assert.equal(hit.phase, 'impact');
  assert.equal(hit.meteor.status, 'destroyed');
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

  const recharged = stepMeteorStorm(held, { random: sequenceRandom([]) });
  const fired = stepMeteorStorm(recharged, { random: sequenceRandom([]) });

  assert.equal(recharged.cooldown, 0);
  assert.equal(recharged.power, 100);
  assert.equal(fired.power, 93);
  assert.equal(fired.cooldown, 5);
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
  assert.equal(drained.meteor.fallStep, 3);
  assert.equal(drained.meteor.y, 73);
  assert.deepEqual(drained.warnings, ['power-drained']);
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
  assert.deepEqual(result.stats, { total: 2, destroyed: 2, missed: 0 });
  random.assertDone();
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
  assert.deepEqual(result.stats, { total: 4, destroyed: 1, missed: 3 });
  assert.equal(maps.level1.row1[2], 2);
  random.assertDone();
});
