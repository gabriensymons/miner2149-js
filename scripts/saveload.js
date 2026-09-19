import { saveGame as dbSaveGame, loadGame as dbLoadGame } from './connection.js';
import { getPreferredSaveData, mergeSaveCollections } from './game-state-repository.js';
import { AUTO_SAVE_SLOT, SAVE_SLOTS, buildSaveEntry, emptySlot } from './save-controller.js';

/**
 * The I/O half of saving and loading.
 *
 * What a slot is called, what goes into it, and whether a record is loadable all
 * live in `save-controller.js`, which is pure and Node-tested. This module holds
 * what cannot be: `localStorage`, the cloud adapter, and the one mutable
 * collection the screens read their labels from.
 */

// The live slot collection. `app.js` reads names and empty flags straight off
// this, so it is mutated in place rather than replaced.
const minerSaves = Object.fromEntries(SAVE_SLOTS.map((slot) => [slot, emptySlot(slot)]));
async function setMinerSavesFromStorage() {
  let remoteSaves = null;
  try {
    ({ data: remoteSaves } = await dbLoadGame());
  } catch {
    // Local saves remain available when cloud synchronization is unavailable.
  }

  let localSaves = null;
  const storedSaves = localStorage.getItem('minerSaves');
  if (storedSaves) {
    try {
      localSaves = JSON.parse(storedSaves);
    } catch {
      console.error('An error occurred while loading local saves.');
    }
  }

  Object.assign(minerSaves, mergeSaveCollections(localSaves, remoteSaves));
  return minerSaves;
}

// Usage:
// saveGame(gameData, 'save1', 'custom name for slot');
//
function saveGame(data, slot, customName = '') {
  const { saveName, entry } = buildSaveEntry({ slot, state: data, customName });

  Object.assign(minerSaves[slot], entry);
  persist('saving');
  dbSaveGame(slot, minerSaves[slot].saveData);

  // The colony carries its own label, so a record reloaded later still knows
  // what it was called. Returned rather than written into the caller's state:
  // saving had been quietly mutating the thing it was asked to copy, which the
  // development freeze turns into an error.
  return { ...data, saveName };
}

function persist(action) {
  try {
    localStorage.setItem('minerSaves', JSON.stringify(minerSaves));
  } catch (error) {
    console.error(`An error occured while ${action}.`);
    if (error) console.error(error);
  }
}

function initAutosave() {
  Object.assign(minerSaves[AUTO_SAVE_SLOT], emptySlot(AUTO_SAVE_SLOT));
  persist('autosaving');

  return minerSaves[AUTO_SAVE_SLOT];
}

// Usage:
// loadGame('slot1');
//
async function loadGame(slot) {
  let remoteSaves = null;
  try {
    ({ data: remoteSaves } = await dbLoadGame(slot));
  } catch {
    // Local saves remain available when cloud synchronization is unavailable.
  }

  let localSaves = null;
  const storedSaves = localStorage.getItem('minerSaves');
  if (storedSaves) {
    try {
      localSaves = JSON.parse(storedSaves);
    } catch {
      console.error('An error occurred while loading local saves.');
    }
  }

  const saveData = getPreferredSaveData(localSaves, remoteSaves, slot);
  if (saveData) return saveData;

  console.error('Unable to load game data.');
  return null;
}

export {
  saveGame,
  initAutosave,
  loadGame,
  minerSaves,
  setMinerSavesFromStorage
}
