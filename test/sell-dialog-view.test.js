import assert from 'node:assert/strict';
import test from 'node:test';

import { regular } from '../scripts/font-styles.js';
import { createGameAssets } from '../scripts/game-assets.js';
import { createSellDialogView } from '../scripts/views/sell-dialog-view.js';
import { FakeBitmapText, createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// Replaces sell-dialog-buttons.test.js, which matched these calls in app.js as
// text. Geometry is written out as init() had it before phase 9.

function build({ diridium = 5000 } = {}) {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const on = Object.fromEntries(['pressUp', 'pressDown', 'release', 'sell', 'cancel'].map((name) => [name, () => name]));
  const view = createSellDialogView({ PIXI, sheet, assets, buildSpriteButton: buttons.buildSpriteButton, diridium, on });
  return { view, assets, buttons, on };
}

test('the dialog sits low over the mine screen and starts showing the colony\'s tonnage, centred', () => {
  const { view } = build({ diridium: 1234 });

  assert.deepEqual([view.dialog.texture.name, view.dialog.x, view.dialog.y], ['sell dialog.png', 2, 86]);
  assert.ok(view.amount instanceof FakeBitmapText);
  assert.deepEqual(
    [view.amount.text, view.amount.style, view.amount.x, view.amount.y, view.amount.anchor.x, view.amount.anchor.y],
    ['1234', regular, 47, 26, 0.5, 0],
  );
});

test('each arrow starts on press and stops on release, inside or outside it', () => {
  const { view, assets, on } = build();
  const [, up, down] = view.dialog.children;

  assert.deepEqual(up.args, [view.dialog, { width: 13, height: 6, x: 81, y: 25 }, { width: 18, height: 7, x: 80, y: 24 },
    assets.upArrow.normal, assets.upArrow.hover, assets.upArrow.down, on.pressUp, on.release, on.release]);
  assert.deepEqual(down.args, [view.dialog, { width: 13, height: 6, x: 81, y: 32 }, { width: 18, height: 7, x: 80, y: 32 },
    assets.downArrow.normal, assets.downArrow.hover, assets.downArrow.down, on.pressDown, on.release, on.release]);
});

test('Sell and Cancel are painted into the artwork: transparent until hovered or pressed, and always armed', () => {
  const { view, assets, on } = build();
  const [, , , sell, cancel] = view.dialog.children;

  for (const [button, place, hover, down, onRelease] of [
    [sell, { width: 43, height: 15, x: 8, y: 40 }, 'sell-dialog-sell-hover.gif', 'sell dialog sell inverted.gif', on.sell],
    [cancel, { width: 44, height: 15, x: 54, y: 40 }, 'sell-dialog-cancel-hover.gif', 'sell dialog cancel inverted.gif', on.cancel],
  ]) {
    const [parent, buttonPlace, hitzone, normal, hoverTexture, downTexture, arm, release, ...rest] = button.args;
    assert.equal(parent, view.dialog);
    assert.deepEqual([buttonPlace, hitzone], [place, place], 'the pointer answers over exactly the artwork');
    assert.equal(normal, assets.emptySpace);
    assert.deepEqual([hoverTexture.name, downTexture.name], [hover, down]);
    assert.equal(arm(), true);
    assert.equal(release, onRelease);
    assert.deepEqual(rest, []);
  }
});

test('the dialog is its tonnage, then the arrows, then Sell and Cancel', () => {
  const { view, buttons } = build();

  assert.deepEqual(view.dialog.children, [view.amount, ...buttons.calls]);
  assert.equal(buttons.calls.length, 4);
});
