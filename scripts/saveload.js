import { deepClone } from './utilities.js';

// Empty save data
const minerSaves = {
  autoSave: {
    name: 'Empty Auto Slot', // Becomes "Auto Save Slot" when it has data
    hasCustomName: false,
    empty: true,
    saveData: {}
  },
  save1: {
    name: 'Empty Slot 1', // Becomes "Day:0|Class:2" when it has data
    hasCustomName: false,
    empty: true,
    saveData: {}
  },
  save2: {
    name: 'Empty Slot 2',
    hasCustomName: false,
    empty: true,
    saveData: {}
  },
  save3: {
    name: 'Empty Slot 3',
    hasCustomName: false,
    empty: true,
    saveData: {}
  }
};

// Usage:
// saveGame(gameData, 'save1', 'custom name for slot');
//
function saveGame(data, slot, customName = '') {
  // console.log(`saveGame for ${slot} called, data:`, data);

  if (customName) minerSaves[slot].hasCustomName = true;
  else minerSaves[slot].hasCustomName = false;

  data.saveName = slot === 'autoSave' ? 'Auto Save Slot' :
   customName ? customName : `Day:${data.day} | ${data.asteroid}`;
  minerSaves[slot].name = data.saveName;
  minerSaves[slot].empty = false;
  // Object.assign(minerSaves[slot].saveData, data);
  minerSaves[slot].saveData = JSON.parse(JSON.stringify(data));

  try {
    localStorage.setItem('minerSaves', JSON.stringify(minerSaves));
  } catch(error) {
    console.error('An error occured while saving.');
    if (error) console.error(error);
  }

  return data;
}

function initAutosave() {
  minerSaves.autoSave.name = 'Empty Auto Slot';
  minerSaves.autoSave.empty = true;
  minerSaves.autoSave.saveData = {};

  try {
    localStorage.setItem('minerSaves', JSON.stringify(minerSaves));
  } catch(error) {
    console.error('An error occured while autosaving.');
    if (error) console.error(error);
  }

  return minerSaves.autoSave;
}

// Usage:
// loadGame('slot1');
//
function loadGame(slot) {
  // console.log('loadGame slot: ', slot);

  if (localStorage.getItem("minerSaves")) {
    try {
      // const data = {};
      // Object.assign(data, JSON.parse(localStorage.getItem('minerSaves')));
      const data = JSON.parse(localStorage.getItem('minerSaves'));
      // console.log(`loadGame data[${slot}].saveData: `, data[slot].saveData);

      return data[slot].saveData;
    } catch {
      console.error('An error occured while loading.');
      if (error) console.error(error);
      return false;
    }
  }
  console.log('Error loading game data.');
}

export {
  saveGame,
  initAutosave,
  loadGame,
  minerSaves
}
