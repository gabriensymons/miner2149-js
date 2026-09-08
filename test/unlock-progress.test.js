import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LIFETIME_EARNINGS_TARGET,
  grantUnlock,
  grantUnlockForTrigger,
  isUnlocked,
  readUnlockProgress,
  recordDiridiumSale,
  writeUnlockProgress,
} from '../scripts/unlock-progress.js';
import { DEFAULT_SKIN_IDS } from '../scripts/skin-catalogue.js';
import { RANDOM_EVENT_IDS, applyRandomEvent } from '../scripts/random-events.js';

const STORAGE_KEY = 'miner2149.unlockProgress';

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => items.set(key, String(value)),
    raw: () => items.get(STORAGE_KEY),
  };
}

function hostileStorage() {
  return {
    getItem: () => null,
    setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
  };
}

test('an empty store still yields the frames that ship unlocked', () => {
  const progress = readUnlockProgress(memoryStorage());

  assert.deepEqual(progress.unlocked, [...DEFAULT_SKIN_IDS]);
  assert.equal(progress.lifetimeDiridiumCredits, 0);
});

test('granting a frame persists it and reports the change exactly once', () => {
  const storage = memoryStorage();

  const first = grantUnlock(storage, 'precursor');
  const second = grantUnlock(storage, 'precursor');

  assert.equal(first.changed, true);
  assert.equal(isUnlocked(first.progress, 'precursor'), true);
  // Triggers fire on events that repeat across a long game; the tenth storm
  // must not re-announce a frame earned during the first.
  assert.equal(second.changed, false);
  assert.equal(readUnlockProgress(storage).unlocked.filter((id) => id === 'precursor').length, 1);
});

test('granting a frame that already ships unlocked is not a change', () => {
  const storage = memoryStorage();

  assert.equal(grantUnlock(storage, DEFAULT_SKIN_IDS[0]).changed, false);
});

test('only the earned frames are written, so changing the defaults reaches existing players', () => {
  const storage = memoryStorage();

  grantUnlock(storage, 'coretech');

  assert.deepEqual(JSON.parse(storage.raw()), {
    unlocked: ['coretech'],
    lifetimeDiridiumCredits: 0,
  });
});

test('unknown ids are refused rather than written into a CSS attribute selector', () => {
  const storage = memoryStorage();

  const result = grantUnlock(storage, 'palm-iiic');

  assert.equal(result.changed, false);
  assert.equal(storage.raw(), undefined, 'nothing is persisted');
  assert.throws(
    () => writeUnlockProgress(storage, { unlocked: ['../evil'], lifetimeDiridiumCredits: 0 }),
    TypeError,
  );
});

test('corrupt, hostile, and half-valid records all read as a fresh start', () => {
  for (const raw of [
    'not json',
    'null',
    '{"unlocked":"precursor","lifetimeDiridiumCredits":0}',
    '{"unlocked":["precursor","made-up"],"lifetimeDiridiumCredits":0}',
    '{"unlocked":[],"lifetimeDiridiumCredits":-5}',
    '{"unlocked":[]}',
  ]) {
    const progress = readUnlockProgress(memoryStorage({ [STORAGE_KEY]: raw }));
    assert.deepEqual(progress.unlocked, [...DEFAULT_SKIN_IDS], raw);
    assert.equal(progress.lifetimeDiridiumCredits, 0, raw);
  }
});

test('a storage that refuses to write does not take the game down with it', () => {
  const storage = hostileStorage();

  const result = grantUnlock(storage, 'precursor');

  assert.equal(result.changed, true, 'the unlock still happened in memory');
  assert.equal(isUnlocked(result.progress, 'precursor'), true);
  assert.equal(
    writeUnlockProgress(storage, { unlocked: [], lifetimeDiridiumCredits: 0 }),
    false,
    'and the caller can tell it was not persisted',
  );
});

test('triggers resolve to their catalogue frame, and an unknown trigger is inert', () => {
  const storage = memoryStorage();

  const storm = grantUnlockForTrigger(storage, 'meteor-storm');
  const bogus = grantUnlockForTrigger(storage, 'not-a-trigger');

  assert.equal(storm.changed, true);
  assert.equal(storm.skin.id, 'dsef-102');
  assert.equal(bogus.changed, false);
  assert.equal(bogus.skin, null);
});

test('lifetime earnings accumulate across sales and survive a new colony', () => {
  const storage = memoryStorage();

  recordDiridiumSale(storage, 400_000);
  recordDiridiumSale(storage, 300_000);

  // Nothing here is touched by resetGameData(), which is the whole reason the
  // counter does not live on gameData.
  assert.equal(readUnlockProgress(storage).lifetimeDiridiumCredits, 700_000);
});

test('MegaTech is awarded on crossing the target, once, and not before', () => {
  const storage = memoryStorage();

  const under = recordDiridiumSale(storage, LIFETIME_EARNINGS_TARGET - 1);
  assert.deepEqual(under.unlocked, [], 'one credit short is still short');

  const crossing = recordDiridiumSale(storage, 1);
  assert.deepEqual(crossing.unlocked, ['megatech']);
  assert.equal(isUnlocked(crossing.progress, 'megatech'), true);

  const after = recordDiridiumSale(storage, 500_000);
  assert.deepEqual(after.unlocked, [], 'it is not re-announced on later sales');
  assert.equal(after.progress.lifetimeDiridiumCredits, LIFETIME_EARNINGS_TARGET + 500_000);
});

test('a single sale that clears the target in one go still awards it', () => {
  const storage = memoryStorage();

  const result = recordDiridiumSale(storage, LIFETIME_EARNINGS_TARGET * 3);

  assert.deepEqual(result.unlocked, ['megatech']);
});

test('non-sales are ignored rather than corrupting the total', () => {
  const storage = memoryStorage();
  recordDiridiumSale(storage, 1000);

  for (const value of [0, -50, Number.NaN, Infinity, undefined, '900']) {
    const result = recordDiridiumSale(storage, value);
    assert.equal(result.changed, false, String(value));
  }
  assert.equal(readUnlockProgress(storage).lifetimeDiridiumCredits, 1000);
});

// app.js decides which frame to award by matching on `result.effects`, because
// the effects array is the committed contract between random-events.js and the
// game. If an effect type is ever renamed the unlock stops firing silently, so
// the two types the unlocks depend on are pinned here.
test('the effect types the alien-artifact and time-shift unlocks match on still exist', () => {
  // Past day 21: the time shift is suppressed during the mother-ship grace
  // period, and this test is about the effect type, not the gate.
  const state = {
    day: 30, level: 'level1', maps: {}, efficiency: 80, morale: 70,
    diridium: 100, credits: 50_000, miningEfficiency: 60, difficulty: 3, workers: 101,
  };

  const artifact = applyRandomEvent(state, {
    id: RANDOM_EVENT_IDS.ALIEN_ARTIFACT,
    randomDraws: [],
  });
  const timeShift = applyRandomEvent(state, {
    id: RANDOM_EVENT_IDS.TIME_SHIFT,
    shift: 30,
    randomDraws: [],
  });

  assert.ok(
    artifact.effects.some(({ type }) => type === 'set-morale'),
    'the alien artifact still emits set-morale',
  );
  assert.ok(
    timeShift.effects.some(({ type }) => type === 'time-shift'),
    'the EM storm still emits time-shift',
  );
  // And they stay distinguishable: one trigger must not award both frames.
  assert.equal(artifact.effects.some(({ type }) => type === 'time-shift'), false);
  assert.equal(timeShift.effects.some(({ type }) => type === 'set-morale'), false);
});
