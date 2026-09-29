/**
 * The Load Mine and Save Mine screens: the same artwork twice, four slot
 * buttons on each, and their Cancels.
 *
 * Hands back the two screens, for the game flow and the save workflow, and each
 * screen's slot captions keyed by slot id, so whatever renames a slot writes one
 * lookup rather than a four-way switch. The captions are the buttons' own text,
 * not separate labels.
 *
 * ## The load screen has three Cancels in one spot
 *
 * It opens from the start screen, the options menu and game over, and each
 * needs its own way back. They are drawn in that order, one over the next, and
 * only the start screen's takes input until `game-flow.js` says otherwise. The
 * order is kept exactly: they overlap, so it decides which one is drawn on top.
 *
 * Pixi and the button builder arrive by injection, so this runs under Node.
 */

import { regular } from '../font-styles.js';
import { SAVE_SLOTS } from '../save-controller.js';

/** Both screens sit below the status bar, where the load screen's artwork was drawn for. */
export const SCREEN_POSITION = { x: 0, y: 13 };

/** The Save Mine title covers the artwork's own "Load Mine" heading. */
export const SAVE_TITLE_POSITION = { x: 20, y: 7 };

/** One slot button per row, twenty pixels apart, in `SAVE_SLOTS` order. */
export const SLOT_BUTTON = { width: 86, height: 15, x: 11, firstY: 30, spacing: 20 };

/** The load screen's Cancel, drawn once per screen that can open it. */
export const LOAD_CANCEL = { width: 42, height: 13, x: 33, y: 123 };

/** The save screen's Cancel hangs off its title, so it is placed relative to that. */
export const SAVE_CANCEL = { width: 42, height: 13, x: 13, y: 116 };

/**
 * `slotNames` are the captions the slots start with, keyed by slot id.
 *
 * `on.load(slot)` and `on.save(slot)` are the slot buttons. `on.cancelLoad` has
 * one entry per screen the load screen opens from -- `start`, `mine` and
 * `gameOver` -- and `on.cancelSave` closes the save screen.
 */
export function createSaveLoadViews({ PIXI, sheet, assets, buildTextButton, slotNames, on }) {
  const menu = assets.menuButton;

  const textButton = (parent, { width, height, x, y }, callback, text, ...style) =>
    buildTextButton(parent, width, height, x, y, menu.normal, menu.hover, menu.down, callback, text, ...style);

  const slotButtons = (screen, onSlot) => Object.fromEntries(SAVE_SLOTS.map((slot, row) => {
    const place = { ...SLOT_BUTTON, y: SLOT_BUTTON.firstY + row * SLOT_BUTTON.spacing };
    const button = textButton(screen, place, () => onSlot(slot), slotNames[slot], regular, menu.nineSlice);
    return [slot, button.children[0]];
  }));

  // Load Mine.
  const loadScreen = screenSprite();
  const loadSlotLabels = slotButtons(loadScreen, on.load);
  const cancels = {
    start: textButton(loadScreen, LOAD_CANCEL, on.cancelLoad.start, 'Cancel'),
    mine: textButton(loadScreen, LOAD_CANCEL, on.cancelLoad.mine, 'Cancel'),
    gameOver: textButton(loadScreen, LOAD_CANCEL, on.cancelLoad.gameOver, 'Cancel'),
  };
  cancels.mine.interactive = false;
  cancels.gameOver.interactive = false;

  // Save Mine: the same artwork, retitled.
  const saveScreen = screenSprite();
  const saveTitle = PIXI.Sprite.from(sheet.textures['save mine title.gif']);
  saveTitle.x = SAVE_TITLE_POSITION.x;
  saveTitle.y = SAVE_TITLE_POSITION.y;
  saveScreen.addChild(saveTitle);
  const saveSlotLabels = slotButtons(saveScreen, on.save);
  textButton(saveTitle, SAVE_CANCEL, on.cancelSave, 'Cancel');

  return {
    load: { screen: loadScreen, slotLabels: loadSlotLabels, cancels },
    save: { screen: saveScreen, title: saveTitle, slotLabels: saveSlotLabels },
  };

  function screenSprite() {
    const screen = PIXI.Sprite.from(sheet.textures['screen load mine.gif']);
    screen.x = SCREEN_POSITION.x;
    screen.y = SCREEN_POSITION.y;
    return screen;
  }
}
