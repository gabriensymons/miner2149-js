/**
 * The options menu the X button opens over the mine screen: two checkboxes,
 * four actions, and OK.
 *
 * Hands back the menu and its extension tab, for the game flow, and the two
 * checkbox marks, which the renderer adds to the menu or takes away as the
 * colony's flags say. Neither mark is added here: both options start off.
 *
 * Each row answers the pointer with a hover overlay that is moved and sized
 * onto it, rather than an overlay per row. Disaster Mode's label is longer than
 * the others, so it has its own wider overlay: the artwork is pixel-exact
 * inverted text, and stretching the 68px one to 80px would blur it.
 *
 * Pixi and the button builders arrive by injection, so this runs under Node.
 */

export const OPTIONS_MENU_POSITION = { x: 5, y: 17 };
export const EXTENSION_POSITION = { x: 104, y: 47 };

/** Where each checkbox's mark sits over its box in the artwork. */
export const CHECK_POSITIONS = { disasterMode: { x: 16, y: 24 }, gridlines: { x: 16, y: 39 } };

/**
 * The rows, top to bottom. `overlay` is where the hover artwork goes; `hitzone`
 * is what the pointer has to be inside, a little inset from it. `wide` rows use
 * the wider overlay.
 */
export const OPTION_ROWS = [
  { action: 'toggleDisasterMode', wide: true, overlay: { width: 80, height: 15, x: 11, y: 21 }, hitzone: { width: 65, height: 11, x: 15, y: 23 } },
  { action: 'toggleGridlines', wide: false, overlay: { width: 68, height: 15, x: 11, y: 36 }, hitzone: { width: 65, height: 11, x: 15, y: 38 } },
  { action: 'openSaveMine', wide: false, overlay: { width: 68, height: 15, x: 11, y: 51 }, hitzone: { width: 65, height: 11, x: 15, y: 53 } },
  { action: 'openLoadMine', wide: false, overlay: { width: 68, height: 15, x: 11, y: 66 }, hitzone: { width: 65, height: 11, x: 15, y: 68 } },
  { action: 'exitAndSave', wide: false, overlay: { width: 68, height: 15, x: 11, y: 81 }, hitzone: { width: 65, height: 11, x: 15, y: 83 } },
  { action: 'resign', wide: false, overlay: { width: 68, height: 15, x: 11, y: 96 }, hitzone: { width: 65, height: 11, x: 15, y: 98 } },
];

export const OK_BUTTON = { width: 42, height: 13, x: 28, y: 119 };

/** `on` has one callback per row's `action`, and `close` for OK. */
export function createOptionsView({ PIXI, sheet, assets, buildTextButton, buildHoverHitzone, on }) {
  const sprite = (frame, { x, y }) => {
    const part = PIXI.Sprite.from(sheet.textures[frame]);
    part.x = x;
    part.y = y;
    return part;
  };

  const menu = sprite('screen options menu.gif', OPTIONS_MENU_POSITION);
  const extension = sprite('window extension options.gif', EXTENSION_POSITION);
  const checks = {
    disasterMode: sprite('checked.gif', CHECK_POSITIONS.disasterMode),
    gridlines: sprite('checked.gif', CHECK_POSITIONS.gridlines),
  };

  const overlay = hidden(PIXI.Sprite.from(sheet.textures['options-hover.gif']));
  const wideOverlay = hidden(PIXI.Sprite.from(sheet.textures['options-hover-wide.gif']));
  menu.addChild(overlay);
  menu.addChild(wideOverlay);

  for (const row of OPTION_ROWS) {
    buildHoverHitzone(menu, row.wide ? wideOverlay : overlay, row.overlay, row.hitzone, on[row.action]);
  }

  const { width, height, x, y } = OK_BUTTON;
  const button = assets.menuButton;
  buildTextButton(menu, width, height, x, y, button.normal, button.hover, button.down, on.close, 'OK');

  return { menu, extension, checks };

  function hidden(part) {
    part.visible = false;
    return part;
  }
}
