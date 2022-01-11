// Empty save data
const minerSaves = {
  autoSave: {
    name: 'Empty Auto Slot', // Becomes "Auto Save Slot" when it has data
    empty: true,
    saveData: {}
  },
  save1: {
    name: 'Empty Slot 1', // Becomes "Day:0|Class:2" when it has data
    empty: true,
    saveData: {}
  },
  save2: {
    name: 'Empty Slot 2',
    empty: true,
    saveData: {}
  },
  save3: {
    name: 'Empty Slot 3',
    empty: true,
    saveData: {}
  }
};

// Usage:
// saveGame(gameData, 'save1');
//
function saveGame(data, slot) {
  data.saveName = slot === 'autoSave' ? 'Auto Save Slot' : `Day:${data.day} | ${data.asteroid}`;
  minerSaves[slot].name = data.saveName;
  minerSaves[slot].empty = false;
  Object.assign(minerSaves[slot].saveData, data);

  try {
    localStorage.setItem('minerSaves', JSON.stringify(minerSaves));
  } catch (error) {
    console.error(error);
  }

  return data;
}

// Autosave is the same as saveGame but to the same slot every time
// Seems like this isn't needed
function autosave(data) {
  saveGame(data, 'autoSave');
}

function initAutosave() {
  minerSaves.autoSave.name = 'Empty Auto Slot';
  minerSaves.autoSave.empty = true;
  minerSaves.autoSave.saveData = {};

  try {
    localStorage.setItem('minerSaves', JSON.stringify(minerSaves));
  } catch (error) {
    console.error(error);
  }

  return minerSaves.autoSave;
}

// Usage:
// loadGame('slot1');
//
function loadGame(slot) {
  if (localStorage.getItem("minerSaves")) {
    try {
      const data = {};
      Object.assign(data, JSON.parse(localStorage.getItem('minerSaves')));
      return data[slot].saveData;
    } catch {
      console.error(error);
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
