import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';
import { skinForTrigger } from '../scripts/skin-catalogue.js';
import { createSkinGrant } from '../scripts/skin-grants.js';
import { readUnlockProgress } from '../scripts/unlock-progress.js';

// The grant against a real session and the real unlock progress, kept in a
// fake storage. The queue and the site's announcement are recording fakes.

function fakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

const NORMAL = { difficulty: 2, asteroid: 'Class:2', devSandbox: false, disasterMode: false, day: 40 };

function build(colony = {}) {
  const session = createGameSession({ initialState: { ...NORMAL, ...colony } });
  const storage = fakeStorage();
  const queued = [];
  const announced = [];
  const grant = createSkinGrant({
    session, storage, enqueue: (text) => queued.push(text), announce: (id) => announced.push(id),
  });
  return { session, storage, queued, announced, grant };
}

const unlocked = (storage) => readUnlockProgress(storage).unlocked;

test('a trigger unlocks its frame, queues the news on the canvas and tells the site', () => {
  const { storage, queued, announced, grant } = build();
  const skin = skinForTrigger('meteor-storm');
  grant('meteor-storm');

  assert.ok(unlocked(storage).includes(skin.id));
  assert.deepEqual(queued, [`NEWS FLASH: ${skin.label} handheld issued to your field kit.`]);
  assert.deepEqual(announced, [skin.id]);
});

test('a frame already held is granted once: no second news, no second announcement', () => {
  const { queued, announced, grant } = build();
  grant('meteor-storm');
  grant('meteor-storm');

  assert.equal(queued.length, 1);
  assert.equal(announced.length, 1);
});

test('a sandbox session unlocks nothing and says nothing', () => {
  const { storage, queued, announced, grant } = build({ devSandbox: true });
  grant('meteor-storm');

  assert.ok(!unlocked(storage).includes(skinForTrigger('meteor-storm').id));
  assert.deepEqual([queued, announced], [[], []]);
});

test('the sandbox is read when the grant runs, not when it was built', () => {
  const { session, queued, grant } = build();
  session.update({ devSandbox: true });
  grant('meteor-storm');

  assert.deepEqual(queued, []);
});

test('a session whose class does not match its asteroid still unlocks: the gate is not isNormalSession', () => {
  const { storage, grant } = build({ difficulty: 4, asteroid: 'Class:2' });
  grant('meteor-storm');

  assert.ok(unlocked(storage).includes(skinForTrigger('meteor-storm').id));
});

test('a Disaster Mode run still unlocks', () => {
  const { storage, grant } = build({ disasterMode: true, daysOutsideDisasterMode: 0 });
  grant('meteor-storm');

  assert.ok(unlocked(storage).includes(skinForTrigger('meteor-storm').id));
});

test('a trigger no frame is attached to does nothing', () => {
  const { queued, announced, grant } = build();
  grant('no-such-trigger');

  assert.deepEqual([queued, announced], [[], []]);
});
