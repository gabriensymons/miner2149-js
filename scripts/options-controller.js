/**
 * The options menu's rows that do more than open a screen: the Disaster Mode
 * and Grid Lines toggles, and Save Mine and Load Mine opened from it.
 *
 * Both toggles change only the flag. The checkbox sprites are derived from the
 * colony by the renderer like every other piece of screen state; the one thing
 * the renderer deliberately does not draw is the map, so turning gridlines on
 * or off redraws the level on screen here.
 *
 * Injected: the dialogs, the stage manager, the map view, the screen flow and
 * the save workflow's caption refresh.
 */

export function createOptionsController({ session, view, dialogs, screens, mapView, flow, saveWorkflow }) {
  const { menu: optionsMenu, extension: optionsMenuExtension } = view.options;
  const saveMineScreen = view.saveLoad.save.screen;

  function toggleDisasterMode() {
    if (session.getState().disasterMode) {
      toggleCheck('disasterMode');
      return;
    }
    // Confirmed on the way in only: enabling raises the disaster rate until it
    // is turned off, which the player should agree to. The score is recorded
    // either way; only a colony that never advanced with it off goes in the
    // Disaster Mode category (`scoreCategory`).
    // The question gets a line of its own, apart from what it is asking about.
    dialogs.confirm(optionsMenu, 'This raises the chance of disasters while it is on. A colony played entirely in Disaster Mode is ranked on its own leaderboard.\nEnable it?', () => {
      toggleCheck('disasterMode');
    }, doNothing);
  }

  function toggleGridlines() {
    toggleCheck('gridlinesEnabled');
    const { maps, level } = session.getState();
    mapView.draw(maps[level]);
  }

  // Save Mine opens over the options menu, with the menu's extension tab beside it.
  function openSaveMine() {
    screens.show(saveMineScreen, optionsMenu);
    screens.show(optionsMenuExtension);
  }

  // Load Mine from the options shows the slots as they are now.
  function openLoadMine() {
    flow.openLoadFromOptions();
    saveWorkflow.refreshLoadCaptions();
  }

  function toggleCheck(field) {
    session.update({ [field]: !session.getState()[field] });
  }

  return { toggleDisasterMode, toggleGridlines, openSaveMine, openLoadMine };
}

function doNothing() {
  return;
}
