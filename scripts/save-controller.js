import { isValidSaveData, normalizeSaveData } from './game-state-repository.js';
import { deepClone } from './utilities.js';

/**
 * The policy half of saving and loading: which slots exist, what a slot is
 * called, and whether a stored record is loadable.
 *
 * Pure and DOM-free on purpose. This logic used to live inside `saveload.js`,
 * tangled with `localStorage` and the Supabase adapter, which meant it could not
 * be imported in a Node test and never had one. It is also the layer both
 * 2026-09-17 load defects sat next to.
 *
 * `saveload.js` keeps the I/O and applies what these functions return.
 */

export const AUTO_SAVE_SLOT = 'autoSave';

export const SAVE_SLOTS = Object.freeze(['autoSave', 'save1', 'save2', 'save3']);

const EMPTY_SLOT_NAMES = Object.freeze({
  autoSave: 'Empty Auto Slot',
  save1: 'Empty Slot 1',
  save2: 'Empty Slot 2',
  save3: 'Empty Slot 3',
});

export function isSaveSlot(slot) {
  return SAVE_SLOTS.includes(slot);
}

/**
 * The shape a slot has before anything is written to it.
 */
export function emptySlot(slot) {
  if (!isSaveSlot(slot)) throw new Error(`unknown save slot: ${slot}`);

  return {
    name: EMPTY_SLOT_NAMES[slot],
    hasCustomName: false,
    empty: true,
    saveData: {},
  };
}

/**
 * What a slot is labelled in the Save and Load menus.
 *
 * The autosave slot is never named by the player, so it keeps a fixed label
 * whatever is passed for `customName`. Everything else takes the player's name
 * when there is one and falls back to the colony's day and asteroid class.
 */
export function deriveSaveName({ slot, customName = '', day, asteroid }) {
  if (slot === AUTO_SAVE_SLOT) return 'Auto Save Slot';
  if (customName) return customName;

  return `Day:${day} | ${asteroid}`;
}

/**
 * Builds the slot record to persist, and the name to write back into the
 * colony's own state.
 *
 * `saveName` goes into both: it is a field of the save, so a record reloaded
 * later still knows what it was called.
 */
export function buildSaveEntry({ slot, state, customName = '' }) {
  if (!isSaveSlot(slot)) throw new Error(`unknown save slot: ${slot}`);

  const saveName = deriveSaveName({
    slot,
    customName,
    day: state.day,
    asteroid: state.asteroid,
  });

  return {
    saveName,
    entry: {
      name: saveName,
      // The autosave slot is never player-named, so a custom name passed for it
      // is ignored here as well as in the label.
      hasCustomName: slot !== AUTO_SAVE_SLOT && Boolean(customName),
      empty: false,
      saveData: deepClone({ ...state, saveName }),
    },
  };
}

/**
 * Decides whether a stored record can be loaded, and returns the state to adopt.
 *
 * Normalizing before validating is the whole point: a save written before a
 * field existed is missing that field, and `isValidSaveData` rejects any save
 * missing a key of the template. `normalizeSaveData` backfills the ones it knows
 * how to rebuild, so an older save survives a field being added.
 */
export function prepareLoad({ raw, template }) {
  if (raw === null || raw === undefined) return { ok: false, reason: 'missing' };

  const state = normalizeSaveData(raw);
  if (!isValidSaveData(state, template)) return { ok: false, reason: 'unreadable' };

  return { ok: true, state };
}
