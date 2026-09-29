import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameAssets } from '../scripts/game-assets.js';
import { createOptionsView } from '../scripts/views/options-view.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// Takes over the options half of canvas-control-wiring's "shop, map, and
// options controls use shared hover-only overlays". Geometry is written out as
// init() had it before phase 9.

const ACTIONS = ['toggleDisasterMode', 'toggleGridlines', 'openSaveMine', 'openLoadMine', 'exitAndSave', 'resign', 'close'];

function build() {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const on = Object.fromEntries(ACTIONS.map((action) => [action, () => action]));
  const view = createOptionsView({
    PIXI, sheet, assets, buildTextButton: buttons.buildTextButton, buildHoverHitzone: buttons.buildHoverHitzone, on,
  });
  return { view, assets, buttons, on };
}

test('the menu opens over the mine screen, with its extension tab to the right', () => {
  const { view } = build();

  assert.deepEqual([view.menu.texture.name, view.menu.x, view.menu.y], ['screen options menu.gif', 5, 17]);
  assert.deepEqual([view.extension.texture.name, view.extension.x, view.extension.y], ['window extension options.gif', 104, 47]);
});

test('both checkbox marks sit on their boxes, and neither is on the menu until the renderer puts it there', () => {
  const { view } = build();

  assert.deepEqual([view.checks.disasterMode.texture.name, view.checks.disasterMode.x, view.checks.disasterMode.y], ['checked.gif', 16, 24]);
  assert.deepEqual([view.checks.gridlines.texture.name, view.checks.gridlines.x, view.checks.gridlines.y], ['checked.gif', 16, 39]);
  assert.notEqual(view.checks.disasterMode, view.checks.gridlines);
  for (const check of Object.values(view.checks)) {
    assert.ok(!view.menu.children.includes(check));
  }
});

test('every row shares one hidden overlay, except Disaster Mode, whose label needs the wider one', () => {
  const { view, buttons, on } = build();
  const [overlay, wideOverlay] = view.menu.children;

  assert.deepEqual([overlay.texture.name, overlay.visible], ['options-hover.gif', false]);
  assert.deepEqual([wideOverlay.texture.name, wideOverlay.visible], ['options-hover-wide.gif', false]);

  const rows = buttons.calls.filter(({ kind }) => kind === 'hover');
  assert.deepEqual(rows.map(({ args }) => args), [
    [view.menu, wideOverlay, { width: 80, height: 15, x: 11, y: 21 }, { width: 65, height: 11, x: 15, y: 23 }, on.toggleDisasterMode],
    [view.menu, overlay, { width: 68, height: 15, x: 11, y: 36 }, { width: 65, height: 11, x: 15, y: 38 }, on.toggleGridlines],
    [view.menu, overlay, { width: 68, height: 15, x: 11, y: 51 }, { width: 65, height: 11, x: 15, y: 53 }, on.openSaveMine],
    [view.menu, overlay, { width: 68, height: 15, x: 11, y: 66 }, { width: 65, height: 11, x: 15, y: 68 }, on.openLoadMine],
    [view.menu, overlay, { width: 68, height: 15, x: 11, y: 81 }, { width: 65, height: 11, x: 15, y: 83 }, on.exitAndSave],
    [view.menu, overlay, { width: 68, height: 15, x: 11, y: 96 }, { width: 65, height: 11, x: 15, y: 98 }, on.resign],
  ]);
  // 80 + 11 keeps the wide overlay inside the 98px-wide menu artwork.
  assert.ok(80 + 11 <= 98);
});

test('the menu is its two overlays, then its rows top to bottom, then OK', () => {
  const { view, assets, buttons, on } = build();
  const menu = assets.menuButton;
  const ok = buttons.calls.find(({ kind }) => kind === 'text');

  assert.deepEqual(ok.args, [view.menu, 42, 13, 28, 119, menu.normal, menu.hover, menu.down, on.close, 'OK']);
  assert.deepEqual(view.menu.children.slice(2), buttons.calls);
  assert.equal(view.menu.children.length, 2 + 6 + 1);
});
