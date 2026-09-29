import assert from 'node:assert/strict';
import test from 'node:test';

import { regular } from '../scripts/font-styles.js';
import { shopItems } from '../scripts/gamedata.js';
import { createShopView } from '../scripts/views/shop-view.js';
import { FakeBitmapText, FakeGraphics, createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// Takes over the shop half of canvas-control-wiring's "shop, map, and options
// controls use shared hover-only overlays". Geometry is written out as init()
// had it before phase 9.

/** [id, selected artwork, width, x, y] */
const ITEMS = [
  ['bulldozer', 'button bulldozer selected.gif', 15, 6, 119],
  ['diridiumMine', 'button mine selected.gif', 14, 22, 119],
  ['hydroponics', 'button hydroponics selected.gif', 14, 37, 119],
  ['tube', 'button tube selected.gif', 14, 52, 119],
  ['lifeSupport', 'button lifesupport selected.gif', 14, 67, 119],
  ['quarters', 'button quarters selected.gif', 14, 82, 119],
  ['spacePort', 'button spaceport selected.gif', 15, 6, 132],
  ['powerPlant', 'button powerplant selected.gif', 14, 22, 132],
  ['processor', 'button processor selected.gif', 14, 37, 132],
  ['sickbay', 'button sickbay seletced.gif', 14, 52, 132],
  ['storage', 'button storage selected.gif', 14, 67, 132],
];

function build({ caption = 'Bulldozer', price = 6500 } = {}) {
  const { PIXI } = createFakePIXI();
  const buttons = recordingButtons();
  const parent = { children: [], addChild(child) { this.children.push(child); return child; } };
  const picked = [];
  const on = { shop: (id) => picked.push(id), undo: () => 'undo' };
  const view = createShopView({
    PIXI, sheet: fakeSheet(), buildHoverHitzone: buttons.buildHoverHitzone, parent, caption, price, on,
  });
  return { view, parent, buttons, on, picked };
}

test('each item has its selected artwork on its button, and only the bulldozer\'s starts showing', () => {
  const { view } = build();

  assert.deepEqual(Object.keys(view.selected), ITEMS.map(([id]) => id));
  for (const [id, frame, , x, y] of ITEMS) {
    const sprite = view.selected[id];
    assert.deepEqual([sprite.texture.name, sprite.x, sprite.y, sprite.visible], [frame, x, y, id === 'bulldozer'], id);
  }
});

test('the shop sells exactly the items gamedata prices', () => {
  assert.deepEqual(Object.keys(build().view.selected).sort(), Object.keys(shopItems).sort());
});

test('every item shares one hover overlay, but the two wide ones share the wider one, and Undo takes the twelfth spot', () => {
  const { parent, buttons, on, picked } = build();
  const overlay = parent.children[11];
  const wideOverlay = parent.children[12];
  assert.deepEqual([overlay.texture.name, overlay.visible], ['shop-hover.gif', false]);
  assert.deepEqual([wideOverlay.texture.name, wideOverlay.visible], ['shop-hover-wide.gif', false]);

  const zones = buttons.calls.map(({ args }) => args);
  assert.equal(zones.length, 12);
  ITEMS.forEach(([, , width, x, y], index) => {
    const [zoneParent, hover, place, hitzone] = zones[index];
    assert.equal(zoneParent, parent);
    assert.equal(hover, width === 15 ? wideOverlay : overlay);
    assert.deepEqual([place, hitzone], [{ width, height: 12, x, y }, { width, height: 12, x, y }]);
  });
  zones.slice(0, 11).forEach((args) => args[4]());
  assert.deepEqual(picked, ITEMS.map(([id]) => id), 'each item selects itself');

  assert.deepEqual(zones[11], [parent, overlay, { width: 14, height: 12, x: 82, y: 132 }, { width: 14, height: 12, x: 82, y: 132 }, on.undo]);
});

test('the caption and price sit centred under the items, with a hidden black box behind the caption', () => {
  const { view } = build({ caption: 'Tube', price: 1200 });

  for (const [label, text, x] of [[view.caption, 'Tube', 34], [view.price, '1200', 82]]) {
    assert.ok(label instanceof FakeBitmapText);
    assert.deepEqual([label.text, label.style, label.x, label.y, label.anchor.x, label.anchor.y], [text, regular, x, 146, 0.5, 0]);
  }
  assert.ok(view.captionHighlight instanceof FakeGraphics);
  assert.deepEqual(view.captionHighlight.drawn, [['beginFill', 0x000000], ['drawRect', 0, 0, 59, 12], ['endFill']]);
  assert.deepEqual([view.captionHighlight.x, view.captionHighlight.y, view.captionHighlight.visible], [4, 146, false]);
});

test('drawn in order: the items, both overlays, the highlight beneath the caption, the price, then the hit zones', () => {
  const { view, parent, buttons } = build();

  assert.deepEqual(parent.children, [
    ...Object.values(view.selected),
    parent.children[11],
    parent.children[12],
    view.captionHighlight,
    view.caption,
    view.price,
    ...buttons.calls,
  ]);
});
