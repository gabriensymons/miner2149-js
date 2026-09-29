/**
 * The Sell Diridium dialog: the tonnage to sell, arrows to change it, Sell and
 * Cancel.
 *
 * Hands back the dialog, which the storage icon opens over the mine screen, and
 * the tonnage label, which the sale workflow rewrites as the arrows are held.
 * Holding an arrow repeats, and that timing is the workflow's, in `app.js`: an
 * arrow here only says when it was pressed and when it was let go.
 *
 * Sell and Cancel are painted into the dialog's artwork, so their normal state
 * is `emptySpace` and only the hover and pressed states are drawn over it.
 *
 * Pixi and the button builder arrive by injection, so this runs under Node.
 */

import { regular } from '../font-styles.js';

/** Never added to the mine screen: `show()` puts it on the stage, so its children are placed in dialog coordinates. */
export const SELL_DIALOG_POSITION = { x: 2, y: 86 };
export const AMOUNT_POSITION = { x: 47, y: 26 };

export const AMOUNT_ARROWS = {
  up: { button: { width: 13, height: 6, x: 81, y: 25 }, hitzone: { width: 18, height: 7, x: 80, y: 24 } },
  down: { button: { width: 13, height: 6, x: 81, y: 32 }, hitzone: { width: 18, height: 7, x: 80, y: 32 } },
};

/** Sell and Cancel answer the pointer over exactly the artwork they cover. */
export const SELL_BUTTON = { width: 43, height: 15, x: 8, y: 40 };
export const CANCEL_BUTTON = { width: 44, height: 15, x: 54, y: 40 };

/**
 * `diridium` is the tonnage the dialog starts showing.
 *
 * `on.pressUp`/`on.pressDown` start an arrow and `on.release` stops either;
 * `on.sell` and `on.cancel` act on release.
 */
export function createSellDialogView({ PIXI, sheet, assets, buildSpriteButton, diridium, on }) {
  const dialog = PIXI.Sprite.from(sheet.textures['sell dialog.png']);
  dialog.position.set(SELL_DIALOG_POSITION.x, SELL_DIALOG_POSITION.y);

  const amount = new PIXI.BitmapText(diridium.toString(), regular);
  amount.position.set(AMOUNT_POSITION.x, AMOUNT_POSITION.y);
  amount.anchor.set(0.5, 0);
  dialog.addChild(amount);

  const arrow = ({ button, hitzone }, { normal, hover, down }, onPress) =>
    buildSpriteButton(dialog, button, hitzone, normal, hover, down, onPress, on.release, on.release);
  arrow(AMOUNT_ARROWS.up, assets.upArrow, on.pressUp);
  arrow(AMOUNT_ARROWS.down, assets.downArrow, on.pressDown);

  // Always armed: whether a sale can happen was decided before the dialog opened.
  const armed = () => true;
  const painted = (place, hover, down, onRelease) =>
    buildSpriteButton(dialog, place, { ...place }, assets.emptySpace,
      PIXI.Texture.from(hover), PIXI.Texture.from(down), armed, onRelease);
  painted(SELL_BUTTON, 'sell-dialog-sell-hover.gif', 'sell dialog sell inverted.gif', on.sell);
  painted(CANCEL_BUTTON, 'sell-dialog-cancel-hover.gif', 'sell dialog cancel inverted.gif', on.cancel);

  return { dialog, amount };
}
