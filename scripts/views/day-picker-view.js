/**
 * The v3.2 "Select # of days:" picker the clock button opens: twenty day cells
 * and Cancel.
 *
 * Its geometry is `day-picker.js`'s, which also owns what a tap on a cell
 * means (the first tap selects, the second on the same day confirms). This only
 * builds it and hands back the menu, which `app.js` shows over the mine screen.
 *
 * Every cell is painted into the artwork, so each draws `emptySpace` until
 * hovered or pressed. Cancel is a real button, laid over the grey one painted
 * into the artwork.
 *
 * Pixi and the button builders arrive by injection, so this runs under Node.
 */

import { DAY_PICKER_CANCEL, DAY_PICKER_ORIGIN, dayPickerCells } from '../day-picker.js';

/** `on.chooseDay(day)` is a cell's tap; `on.cancel` closes the picker. */
export function createDayPickerView({ PIXI, sheet, assets, buildTextButton, buildSpriteButton, on }) {
  // Never added to the mine screen: show() puts it on the stage, so its
  // children are placed in menu coordinates.
  const menu = PIXI.Sprite.from(sheet.textures['advance-days-menu.gif']);
  menu.position.set(DAY_PICKER_ORIGIN.x, DAY_PICKER_ORIGIN.y);

  for (const { day, button, hitzone } of dayPickerCells()) {
    buildSpriteButton(
      menu,
      button,
      hitzone,
      assets.emptySpace,
      PIXI.Texture.from(`advance-${day}-hover.gif`),
      PIXI.Texture.from(`advance-${day}-inverted.gif`),
      () => true,
      () => on.chooseDay(day),
    );
  }

  const { width, height, x, y } = DAY_PICKER_CANCEL;
  const button = assets.menuButton;
  buildTextButton(menu, width, height, x, y, button.normal, button.hover, button.down, on.cancel, 'Cancel');

  return { menu };
}
