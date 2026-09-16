const CLOUD_SAVES_ENABLED = false;

async function saveGame(slot, saveData) {
  return {
    data: null,
    error: new Error('Cloud saves are disabled pending security verification.'),
  };
}

async function loadGame() {
  return {
    data: null,
    error: new Error('Cloud saves are disabled pending security verification.'),
  };
}

export {
  saveGame,
  loadGame
};
