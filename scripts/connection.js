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

function initUser() {
  if (!CLOUD_SAVES_ENABLED) {
    const message = document.createElement('p');
    message.textContent = 'Cloud saves are disabled pending security verification.';
    document.querySelector('#user-section').replaceChildren(message);
  }
}

export {
  initUser,
  saveGame,
  loadGame
};
