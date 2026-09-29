/**
 * The mine screen, and everything on it that is neither the map nor the shop:
 * the top bar, the column of level, report and advance buttons on the right,
 * the diridium storage icon, and the wage.
 *
 * `createMineScreen` builds the screen itself, which the map and the shop are
 * added to as well. `createMineChrome` adds the rest and hands back what the
 * renderer and the turn plumbing update: the level markers, the top bar's
 * labels and cover, the credits, the sell price, the wage, and the storage icon
 * with its textures for each fill band.
 *
 * Most of these buttons are painted into the screen's artwork, so their normal
 * state is `emptySpace` and only hover and pressed are drawn over it. A level
 * button's pressed state is its "selected" marker's own artwork.
 *
 * Pixi and the button builder arrive by injection, so this runs under Node.
 */

import { barText, regular } from '../font-styles.js';

/** The right-hand column: level, reports and options, advance. One row each, left to right. */
export const LEVEL_BUTTONS = [
  { level: 'level1', selected: 'button level1 selected.gif', hover: 'button-level1-hover.gif', button: { width: 12, height: 11, x: 115, y: 28 }, hitzone: { width: 14, height: 13, x: 114, y: 27 } },
  { level: 'level2', selected: 'button level2 seleced.gif', hover: 'button-level2-hover.gif', button: { width: 13, height: 11, x: 130, y: 28 }, hitzone: { width: 15, height: 13, x: 129, y: 27 } },
  { level: 'level3', selected: 'button level3 selected.gif', hover: 'button-level3-hover.gif', button: { width: 13, height: 11, x: 146, y: 28 }, hitzone: { width: 15, height: 13, x: 145, y: 27 } },
];
export const REPORT_BUTTONS = [
  { action: 'showOperations', hover: 'button-chart-inverted.gif', button: { width: 12, height: 11, x: 115, y: 57 }, hitzone: { width: 14, height: 13, x: 114, y: 56 } },
  { action: 'showProduction', hover: 'button-factory-inverted.gif', button: { width: 13, height: 11, x: 130, y: 57 }, hitzone: { width: 15, height: 13, x: 129, y: 56 } },
  { action: 'showOptions', hover: 'button-x-inverted.gif', button: { width: 12, height: 11, x: 146, y: 57 }, hitzone: { width: 15, height: 13, x: 145, y: 56 } },
];
/** The clock opens the day picker; its pressed state is the painted artwork itself. */
export const ADVANCE_BUTTONS = [
  { days: 'clock', hover: 'button-advance-clock-hover.gif', down: null, button: { width: 12, height: 11, x: 115, y: 86 }, hitzone: { width: 14, height: 13, x: 114, y: 85 } },
  { days: 1, hover: 'button-advance1-hover.gif', down: 'button-advance1-inverted.gif', button: { width: 13, height: 11, x: 130, y: 86 }, hitzone: { width: 15, height: 13, x: 129, y: 85 } },
  { days: 7, hover: 'button-advance7-hover.gif', down: 'button-advance7-inverted.gif', button: { width: 13, height: 11, x: 146, y: 86 }, hitzone: { width: 15, height: 13, x: 145, y: 85 } },
];

export const INFO_BUTTON = { button: { width: 10, height: 11, x: 147, y: 2 }, hitzone: { width: 16, height: 15, x: 145, y: 0 } };
export const WAGE_ARROWS = {
  up: { button: { width: 13, height: 6, x: 146, y: 143 }, hitzone: { width: 15, height: 7, x: 145, y: 142 } },
  down: { button: { width: 13, height: 6, x: 146, y: 150 }, hitzone: { width: 15, height: 7, x: 145, y: 150 } },
};

/** The top bar: the day, the credits, and the black cover "Mapping..." is written on while the map redraws. */
export const DAY_POSITION = { x: 24, y: 2 };
export const CREDITS_POSITION = { x: 91, y: 2 };
export const TOP_BAR_COVER = { width: 146, height: 15 };
export const TOP_BAR_TEXT_POSITION = { x: 3, y: 2 };

/** The sell price over the storage icon, and the wage between its arrows, both centred. */
export const SELL_PRICE_POSITION = { x: 128, y: 115 };
export const WAGE_POSITION = { x: 128, y: 144 };
export const STORAGE_ICON_POSITION = { x: 146, y: 114 };

/**
 * The storage icon by fill band. An empty store's icon is painted into the
 * screen; the others draw their fill. Pressing never shows a pressed fill.
 */
export const STORAGE_FRAMES = {
  empty: { normal: null, hover: 'sell-diridium-hover.gif', down: 'sell diridium inverted.gif' },
  third: { normal: 'sell diridium 33.gif', hover: 'sell-diridium-33-hover.gif', down: 'sell diridium 33 inverted.gif' },
  twoThirds: { normal: 'sell diridium 66.gif', hover: 'sell-diridium-66-hover.gif', down: 'sell diridium 66 inverted.gif' },
  full: { normal: 'sell diridium 99.gif', hover: 'sell-diridium-99-hover.gif', down: 'sell diridium 99 inverted.gif' },
};

export function createMineScreen({ PIXI, sheet }) {
  const screen = PIXI.Sprite.from(sheet.textures['screen game.png']);
  screen.x = 0;
  screen.y = 0;
  return screen;
}

/**
 * `initial` holds the numbers the labels start with: `day`, `credits`,
 * `sellPrice` and `wage`.
 *
 * `on` carries every button: `showInstructions`, `showLevel(level)`, the three
 * report buttons' `action`s, `showDayPicker`, `advance(days)`, and the wage
 * arrows as `armWageUp`/`wageUp` and `armWageDown`/`wageDown` -- the arming
 * function decides whether a press shows as pressed, the other acts on release.
 */
export function createMineChrome({ PIXI, sheet, assets, buildSpriteButton, parent, initial, on }) {
  const texture = (name) => PIXI.Texture.from(name);
  const { emptySpace } = assets;
  const alwaysArmed = () => true;
  const add = (part) => parent.addChild(part);

  // Which level is showing. Level 1 until the renderer says otherwise.
  const levelSelected = {};
  for (const { level, selected, button } of LEVEL_BUTTONS) {
    const marker = PIXI.Sprite.from(sheet.textures[selected]);
    marker.position.set(button.x, button.y);
    marker.visible = level === 'level1';
    levelSelected[level] = add(marker);
  }

  const dayText = label(parent, initial.day.toString(), barText, DAY_POSITION);
  const topBarText = new PIXI.BitmapText('Mapping...', barText);
  topBarText.position.set(TOP_BAR_TEXT_POSITION.x, TOP_BAR_TEXT_POSITION.y);
  const topBarCover = new PIXI.Graphics();
  topBarCover.beginFill(0x000000);
  topBarCover.drawRect(0, 0, TOP_BAR_COVER.width, TOP_BAR_COVER.height);
  topBarCover.endFill();
  topBarCover.addChild(topBarText);
  topBarCover.visible = false;
  // Over the day, under the credits: the port has always left the credits
  // showing while the map redraws.
  add(topBarCover);
  const creditText = label(parent, initial.credits.toString(), barText, CREDITS_POSITION);
  const sellPrice = centred(initial.sellPrice.toString(), SELL_PRICE_POSITION);
  const wage = centred(initial.wage.toString(), WAGE_POSITION);

  buildSpriteButton(parent, INFO_BUTTON.button, INFO_BUTTON.hitzone, emptySpace,
    texture('button-info-hover.gif'), texture('button info inverted.gif'), alwaysArmed, on.showInstructions);

  for (const { level, hover, button, hitzone } of LEVEL_BUTTONS) {
    buildSpriteButton(parent, button, hitzone, emptySpace, texture(hover), levelSelected[level].texture,
      alwaysArmed, () => on.showLevel(level));
  }
  for (const { action, hover, button, hitzone } of REPORT_BUTTONS) {
    buildSpriteButton(parent, button, hitzone, emptySpace, texture(hover), emptySpace, alwaysArmed, on[action]);
  }
  for (const { days, hover, down, button, hitzone } of ADVANCE_BUTTONS) {
    buildSpriteButton(parent, button, hitzone, emptySpace, texture(hover), down === null ? emptySpace : texture(down),
      alwaysArmed, days === 'clock' ? () => on.showDayPicker() : () => on.advance(days));
  }

  const storageIcon = add(new PIXI.Container());
  storageIcon.position.set(STORAGE_ICON_POSITION.x, STORAGE_ICON_POSITION.y);
  const storageTextures = Object.fromEntries(Object.entries(STORAGE_FRAMES).map(([fill, frames]) => [fill, {
    normal: frames.normal === null ? emptySpace : texture(frames.normal),
    hover: texture(frames.hover),
    down: texture(frames.down),
  }]));

  const { up, down } = WAGE_ARROWS;
  buildSpriteButton(parent, up.button, up.hitzone, assets.upArrow.normal, assets.upArrow.hover, assets.upArrow.down,
    on.armWageUp, on.wageUp);
  buildSpriteButton(parent, down.button, down.hitzone, assets.downArrow.normal, assets.downArrow.hover, assets.downArrow.down,
    on.armWageDown, on.wageDown);

  return {
    levelSelected,
    dayText,
    topBar: { cover: topBarCover, text: topBarText },
    creditText,
    sellPrice,
    wage,
    storageIcon,
    storageTextures,
  };

  function label(onto, text, style, { x, y }) {
    const part = new PIXI.BitmapText(text, style);
    part.x = x;
    part.y = y;
    return onto.addChild(part);
  }

  function centred(text, { x, y }) {
    const part = new PIXI.BitmapText(text, regular);
    part.position.set(x, y);
    part.anchor.set(0.5, 0);
    return add(part);
  }
}
