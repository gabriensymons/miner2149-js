import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTO_SAVE_SLOT,
  SAVE_SLOTS,
  buildSaveEntry,
  deriveSaveName,
  emptySlot,
  isSaveSlot,
  prepareLoad,
} from '../scripts/save-controller.js';
import { gameDataInit } from '../scripts/gamedata.js';

// This logic lived inside saveload.js, which imports localStorage and the
// Supabase adapter and therefore could never be imported in a Node test. These
// are its first tests.

function colony(overrides = {}) {
  return { ...structuredClone(gameDataInit), day: 12, asteroid: 'Class:2', ...overrides };
}

test('the four slots are the ones the game actually writes', () => {
  assert.deepEqual([...SAVE_SLOTS], ['autoSave', 'save1', 'save2', 'save3']);
  for (const slot of SAVE_SLOTS) assert.equal(isSaveSlot(slot), true);
});

test('anything that is not a slot is rejected rather than written', () => {
  for (const slot of ['save4', 'autosave', '', null, undefined, '__proto__', 'toString']) {
    assert.equal(isSaveSlot(slot), false, `${String(slot)} is not a slot`);
  }
  assert.throws(() => emptySlot('save4'));
  assert.throws(() => buildSaveEntry({ slot: 'save4', state: colony() }));
});

test('an untouched slot is labelled by its position, and reads as empty', () => {
  assert.deepEqual(emptySlot('autoSave'), {
    name: 'Empty Auto Slot', hasCustomName: false, empty: true, saveData: {},
  });
  assert.equal(emptySlot('save2').name, 'Empty Slot 2');
  assert.equal(emptySlot('save3').empty, true);
});

test('a slot with no custom name is labelled by day and asteroid', () => {
  assert.equal(
    deriveSaveName({ slot: 'save1', day: 12, asteroid: 'Class:2' }),
    'Day:12 | Class:2',
  );
});

test('a player name replaces the derived label', () => {
  assert.equal(
    deriveSaveName({ slot: 'save1', customName: 'deep shaft run', day: 12, asteroid: 'Class:2' }),
    'deep shaft run',
  );
});

test('the autosave slot keeps its fixed label whatever it is passed', () => {
  // The player is never prompted to name it, so a name reaching it means
  // something upstream is wrong; the label should not silently change.
  assert.equal(
    deriveSaveName({ slot: AUTO_SAVE_SLOT, customName: 'mine', day: 400, asteroid: 'Class:5' }),
    'Auto Save Slot',
  );
  assert.equal(buildSaveEntry({ slot: AUTO_SAVE_SLOT, state: colony(), customName: 'mine' }).entry.hasCustomName, false);
});

test('saving records the name on the slot and inside the save itself', () => {
  // saveName is a field of the template, so a record reloaded later still knows
  // what it was called.
  const { saveName, entry } = buildSaveEntry({ slot: 'save1', state: colony(), customName: 'first light' });

  assert.equal(saveName, 'first light');
  assert.equal(entry.name, 'first light');
  assert.equal(entry.saveData.saveName, 'first light');
  assert.equal(entry.hasCustomName, true);
  assert.equal(entry.empty, false);
});

test('saving copies the colony rather than aliasing it', () => {
  // The running game keeps mutating its state; a save that shared structure with
  // it would keep changing after it was written.
  const state = colony();
  const { entry } = buildSaveEntry({ slot: 'save1', state });

  state.credits = 1;
  state.maps.level1.row0[0] = 9;

  assert.notEqual(entry.saveData.credits, 1);
  assert.notEqual(entry.saveData.maps.level1.row0[0], 9);
});

test('a complete save loads', () => {
  const result = prepareLoad({ raw: colony(), template: gameDataInit });

  assert.equal(result.ok, true);
  assert.equal(result.state.day, 12);
});

test('a save older than a field still loads, because normalizing runs first', () => {
  // The ordering is the point: isValidSaveData rejects a save missing any key of
  // the template, so normalizing has to happen before validating or every save
  // written before a field existed becomes unloadable.
  const legacy = colony({ sellPrice: 23 });
  delete legacy.sellPriceAccumulator;
  delete legacy.disasterMode;
  delete legacy.daysOutsideDisasterMode;

  const result = prepareLoad({ raw: legacy, template: gameDataInit });

  assert.equal(result.ok, true);
  assert.equal(result.state.sellPriceAccumulator, 23);
  assert.equal(result.state.disasterMode, false);
});

test('a corrupt save is refused with a reason rather than half-loaded', () => {
  const corrupt = colony();
  corrupt.maps.level2.row4 = Array(9).fill(2);

  assert.deepEqual(prepareLoad({ raw: corrupt, template: gameDataInit }), {
    ok: false, reason: 'unreadable',
  });
});

test('an absent record is distinguished from a corrupt one', () => {
  // Different causes deserve different handling: nothing stored is an empty
  // slot, while something stored that will not load is worth telling the player.
  assert.deepEqual(prepareLoad({ raw: null, template: gameDataInit }), { ok: false, reason: 'missing' });
  assert.deepEqual(prepareLoad({ raw: undefined, template: gameDataInit }), { ok: false, reason: 'missing' });
  assert.equal(prepareLoad({ raw: 'not a save', template: gameDataInit }).reason, 'unreadable');
});
