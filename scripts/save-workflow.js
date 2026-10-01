/**
 * Saving and loading as the player sees them: the personalised-comment prompt,
 * the progress window, the slot captions on both screens, Exit & Save, and
 * clearing the autosave when a colony ends.
 *
 * What a slot is called and whether a record is loadable live in
 * `save-controller.js`, which is pure and imported. Storage lives in
 * `saveload.js`, which arrives here as the `saves` port -- its functions and the
 * live slot collection the captions are read from -- so this runs in Node
 * against a fake.
 *
 * The progress window is not decoration on the load path. It is what runs the
 * close functions that take the player to the mine, after the bar fills: the
 * bar advances by a random step on every tick of the injected `ticker`, using
 * the injected `randomNum`, which is also why its length is not fixed.
 *
 * The screen flow, closing the options menu, and opening the loaded colony
 * belong to other parts of the game and are injected.
 */

import { SAVE_SLOTS, prepareLoad } from './save-controller.js';
import { deepClone } from './utilities.js';

const PROGRESS_BAR_WIDTH = 112;

export function createSaveWorkflow({
  session, view, dialogs, screens, ticker, randomNum, saves, template, flow, openLoadedColony,
}) {
  const loadMineScreen = view.saveLoad.load.screen;
  const saveMineScreen = view.saveLoad.save.screen;
  const optionsMenu = view.options.menu;
  const slotLabels = { load: view.saveLoad.load.slotLabels, save: view.saveLoad.save.slotLabels };
  const { window: progressWindow, bar: loadingBar, title: progressTitle } = view.message.progress;
  const { inputText } = view.message.message;
  const closeOptions = () => flow.closeOptions();

  // A slot on the Load Mine screen. The screen is the load's parent, and leaving
  // it goes through game-flow.js whichever screen opened it.
  function loadFromSlot(slot) {
    load(slot, loadMineScreen, () => flow.leaveLoadScreen(), openLoadedColony);
  }

  // A slot on the Save Mine screen, which saves behind a progress window and then
  // closes itself and the options menu beneath it.
  function saveToSlot(slot) {
    save(slot, true, saveMineScreen, () => screens.hide(saveMineScreen, optionsMenu), closeOptions);
  }

  function exitAndSave() {
    // No reset on the way out. The start screen leads only to New Mine, which
    // resets the colony, and Load Mine, which replaces it, and nothing on it reads
    // the colony first -- so a reset here only ran a second one before the next
    // colony. Game over's Quit leaves the colony in place the same way.
    const closeFunctions = [
      closeOptions,
      () => flow.leaveMineForStart(),
      () => flow.showStart(),
    ];
    save('autoSave', true, optionsMenu, ...closeFunctions);
  }

  function save(slot, showProgress, parent, ...closeFunctions) {
    let customName = '';

    if (slot === 'autoSave') {
      commenceSaving();
    } else {
      dialogs.confirm(parent, 'Would you like to enter a personalized comment for this game?', nameSaveSlot, commenceSaving);
    }

    // Yes: input name for save slot
    function nameSaveSlot() {
      let slotName = '';
      if (saves.minerSaves[slot].hasCustomName) {
        slotName = saves.minerSaves[slot].name;
      }

      dialogs.input(parent, slotName, getCustomName, commenceSaving);
    }

    function getCustomName() {
      customName = inputText.text;
      commenceSaving();
    }

    function commenceSaving() {
      // The automatic autosave, at the end of a day, has no progress window.
      if (!showProgress && slot === 'autoSave') updateData();

      if (showProgress) showProgressWindow(parent, updateData, true, ...closeFunctions);
    }

    function updateData() {
      session.replace(deepClone(saves.saveGame(session.getState(), slot, customName)));

      // The slot's new name, on both screens that list it.
      slotLabels.save[slot].text = saves.minerSaves[slot].name;
      slotLabels.load[slot].text = saves.minerSaves[slot].name;
    }
  }

  async function load(slot, parent, ...closeFunctions) {
    if (saves.minerSaves[slot].empty) return;

    const loaded = prepareLoad({ raw: await saves.loadGame(slot), template });
    if (!loaded.ok) {
      // 'missing' and 'unreadable' get the same message deliberately. An empty
      // slot already returned above, so a slot that holds something unreadable and
      // a slot that holds nothing are both faults worth telling the player about.
      dialogs.message(parent, 'Unable to load that saved game. Your current game has not been changed.', doNothing);
      return;
    }
    session.replace(loaded.state);
    // No callback: opening the colony is the last of the close functions and
    // renders from state itself, so there is nothing left to apply afterwards.
    showProgressWindow(parent, null, false, ...closeFunctions);
  }

  function showProgressWindow(parent, callback, isCallbackFirst = false, ...closeFunctions) {
    progressTitle.text = parent === saveMineScreen
      || parent === optionsMenu
      ? 'Saving Mining Colony...'
      : 'Preparing Mining Colony...';
    screens.show(progressWindow, parent);
    screens.show(loadingBar);

    let count = 0;
    let rand = 0;

    const countListener = function() {
      // Randomly advance progress bar
      if (count < 60)
        // Slower at first...
        rand = Math.floor(randomNum(0, 500) * .005);
      else
        // Then faster toward end...
        rand = randomNum(1, 10);

      count += rand;

      loadingBar.width = count > PROGRESS_BAR_WIDTH ? PROGRESS_BAR_WIDTH : count;
      if (loadingBar.width === PROGRESS_BAR_WIDTH) {
        ticker.remove(countListener);
        screens.hide(progressWindow, parent);
        screens.hide(loadingBar);

        if (isCallbackFirst && callback) callback();

        // Pass all the functions needed to close open screens
        closeFunctions.forEach(f => f.apply());

        if (!isCallbackFirst && callback) callback();
      }
    };

    ticker.add(countListener);
  }

  // Load Mine opened from the options menu shows the slots as they are now.
  function refreshLoadCaptions() {
    for (const slot of SAVE_SLOTS) slotLabels.load[slot].text = saves.minerSaves[slot].name;
  }

  // A colony that has ended leaves an empty autosave behind, on both screens.
  function resetAutosave() {
    saves.minerSaves.autoSave = deepClone(saves.initAutosave());
    slotLabels.load.autoSave.text = saves.minerSaves.autoSave.name;
    slotLabels.save.autoSave.text = saves.minerSaves.autoSave.name;
  }

  return { save, load, loadFromSlot, saveToSlot, exitAndSave, refreshLoadCaptions, resetAutosave };
}

function doNothing() {
  return;
}
