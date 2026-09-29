/**
 * The shop along the mine screen's bottom left: eleven buildings, Undo, and the
 * caption and price of whichever is selected.
 *
 * Hands back each item's "selected" sprite by id, and the caption, its
 * highlight and the price, for the renderer to show the colony's selection.
 * Which item is selected, and whether it is affordable, is decided elsewhere
 * (`shop.js`); nothing here reads the colony.
 *
 * The item buttons are painted into the mine screen's artwork. Each is a hit
 * zone that moves one shared hover overlay onto itself -- the wider overlay for
 * the two 15px-wide items, since stretching the 14px artwork would blur it.
 *
 * Pixi and the button builder arrive by injection, so this runs under Node.
 */

import { regular } from '../font-styles.js';

/**
 * Two rows of items, then Undo in the twelfth spot. `frame` is each item's
 * "selected" artwork, by its name in the atlas, misspelling included.
 */
export const SHOP_ITEMS = [
  { id: 'bulldozer', frame: 'button bulldozer selected.gif', width: 15, x: 6, y: 119 },
  { id: 'diridiumMine', frame: 'button mine selected.gif', width: 14, x: 22, y: 119 },
  { id: 'hydroponics', frame: 'button hydroponics selected.gif', width: 14, x: 37, y: 119 },
  { id: 'tube', frame: 'button tube selected.gif', width: 14, x: 52, y: 119 },
  { id: 'lifeSupport', frame: 'button lifesupport selected.gif', width: 14, x: 67, y: 119 },
  { id: 'quarters', frame: 'button quarters selected.gif', width: 14, x: 82, y: 119 },
  { id: 'spacePort', frame: 'button spaceport selected.gif', width: 15, x: 6, y: 132 },
  { id: 'powerPlant', frame: 'button powerplant selected.gif', width: 14, x: 22, y: 132 },
  { id: 'processor', frame: 'button processor selected.gif', width: 14, x: 37, y: 132 },
  { id: 'sickbay', frame: 'button sickbay seletced.gif', width: 14, x: 52, y: 132 },
  { id: 'storage', frame: 'button storage selected.gif', width: 14, x: 67, y: 132 },
];
export const SHOP_ITEM_HEIGHT = 12;
export const UNDO_BUTTON = { width: 14, height: 12, x: 82, y: 132 };

/** The caption is centred under the first row; the price beside it. */
export const CAPTION_POSITION = { x: 34, y: 146 };
export const PRICE_POSITION = { x: 82, y: 146 };
/** Black behind the caption when the selection is unaffordable; the renderer turns the caption white over it. */
export const CAPTION_HIGHLIGHT = { x: 4, y: 146, width: 59, height: 12 };

/**
 * `caption` and `price` are what the shop starts showing. `on.shop(id)` selects
 * an item; `on.undo` is Undo. Everything is added to `parent`, the mine screen.
 */
export function createShopView({ PIXI, sheet, buildHoverHitzone, parent, caption, price, on }) {
  // Only the bulldozer's starts showing, as the port always has; the renderer
  // shows the colony's own selection before the mine screen is ever seen.
  const selected = {};
  for (const { id, frame, x, y } of SHOP_ITEMS) {
    const sprite = PIXI.Sprite.from(sheet.textures[frame]);
    sprite.position.set(x, y);
    if (id !== 'bulldozer') sprite.visible = false;
    parent.addChild(sprite);
    selected[id] = sprite;
  }

  const overlay = hidden(PIXI.Sprite.from(sheet.textures['shop-hover.gif']));
  const wideOverlay = hidden(PIXI.Sprite.from(sheet.textures['shop-hover-wide.gif']));
  parent.addChild(overlay);
  parent.addChild(wideOverlay);

  const captionHighlight = new PIXI.Graphics();
  captionHighlight.beginFill(0x000000);
  captionHighlight.drawRect(0, 0, CAPTION_HIGHLIGHT.width, CAPTION_HIGHLIGHT.height);
  captionHighlight.endFill();
  captionHighlight.x = CAPTION_HIGHLIGHT.x;
  captionHighlight.y = CAPTION_HIGHLIGHT.y;
  hidden(captionHighlight);
  parent.addChild(captionHighlight);

  const captionText = centred(caption.toString(), CAPTION_POSITION);
  const priceText = centred(price.toString(), PRICE_POSITION);

  for (const { id, width, x, y } of SHOP_ITEMS) {
    const place = { width, height: SHOP_ITEM_HEIGHT, x, y };
    buildHoverHitzone(parent, width === 15 ? wideOverlay : overlay, place, { ...place }, () => on.shop(id));
  }
  buildHoverHitzone(parent, overlay, { ...UNDO_BUTTON }, { ...UNDO_BUTTON }, on.undo);

  return { selected, caption: captionText, price: priceText, captionHighlight };

  function hidden(part) {
    part.visible = false;
    return part;
  }

  function centred(text, { x, y }) {
    const label = new PIXI.BitmapText(text, regular);
    label.position.set(x, y);
    label.anchor.set(0.5, 0);
    parent.addChild(label);
    return label;
  }
}
