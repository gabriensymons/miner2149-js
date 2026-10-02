import assert from 'node:assert/strict';
import test from 'node:test';

import { createColonySnapshot } from '../scripts/dev/colony-snapshot.js';
import { gameDataInit } from '../scripts/gamedata.js';

// The development panel's snapshot, without the panel: what it captures, when
// it refuses, and what it hands the load seam to restore.

function build({ idle = true } = {}) {
  let colony = { ...structuredClone(gameDataInit), asteroid: 'Class:2', day: 12, credits: 5000 };
  const restored = [];
  const world = { idle };
  const snapshots = createColonySnapshot({
    getColony: () => colony,
    restoreColony: (next) => { restored.push(next); colony = next; },
    isIdle: () => world.idle,
  });
  const play = (change) => { colony = { ...colony, ...change, maps: structuredClone(colony.maps) }; return colony; };
  return { snapshots, restored, world, play, current: () => colony };
}

test('a restore puts back the colony as captured, marked as a sandbox, through the load seam', () => {
  const { snapshots, restored, play } = build();
  assert.deepEqual(snapshots.capture(), { ok: true, day: 12 });

  play({ day: 30, credits: 1 });
  assert.deepEqual(snapshots.restore(), { ok: true, day: 12 });

  assert.equal(restored.length, 1);
  assert.deepEqual(restored[0], { ...structuredClone(gameDataInit), asteroid: 'Class:2', day: 12, credits: 5000, devSandbox: true });
});

test('playing on after a capture cannot reach into the snapshot, even through a shared map', () => {
  const { snapshots, restored, current } = build();
  snapshots.capture();
  current().maps.level1.row0[0] = 99;
  snapshots.restore();

  assert.notEqual(restored[0].maps.level1.row0[0], 99);
});

test('the same snapshot restores again, unchanged by the colony it was restored into', () => {
  const { snapshots, restored, play } = build();
  snapshots.capture();
  snapshots.restore();
  restored[0].maps.level1.row0[0] = 99;
  play({ day: 40 });
  snapshots.restore();

  assert.equal(restored.length, 2);
  assert.notEqual(restored[1], restored[0], 'a fresh copy each time');
  assert.deepEqual([restored[1].day, restored[1].maps.level1.row0[0]], [12, gameDataInit.maps.level1.row0[0]]);
});

test('a restore with nothing captured is refused, and restores nothing', () => {
  const { snapshots, restored } = build();
  assert.equal(snapshots.hasSnapshot(), false);
  assert.deepEqual(snapshots.restore(), { ok: false, reason: 'Capture a snapshot first.' });
  assert.deepEqual(restored, []);
});

test('neither capture nor restore happens unless the mine screen is idle', () => {
  const { snapshots, restored, world, play } = build({ idle: false });
  assert.equal(snapshots.capture().ok, false);
  assert.equal(snapshots.hasSnapshot(), false, 'nothing captured');

  world.idle = true;
  snapshots.capture();
  play({ day: 30 });
  world.idle = false;
  assert.equal(snapshots.restore().ok, false);
  assert.deepEqual(restored, [], 'nothing restored');
});
