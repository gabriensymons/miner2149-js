import assert from 'node:assert/strict';
import test from 'node:test';

import { dayPickerCells } from '../scripts/day-picker.js';
import { createGameAssets } from '../scripts/game-assets.js';
import { createDayPickerView } from '../scripts/views/day-picker-view.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The cells' geometry is day-picker.js's and is pinned in day-picker.test.js.
// What this pins is that the view builds exactly those cells, each wired to
// its own day, and places the menu and Cancel where init() did.

function build() {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const chosen = [];
  const on = { chooseDay: (day) => chosen.push(day), cancel: () => 'cancel' };
  const view = createDayPickerView({
    PIXI, sheet, assets, buildTextButton: buttons.buildTextButton, buildSpriteButton: buttons.buildSpriteButton, on,
  });
  return { view, assets, buttons, on, chosen };
}

test('the picker sits over the map, in menu coordinates, from its own artwork', () => {
  const { view } = build();
  assert.deepEqual([view.menu.texture.name, view.menu.x, view.menu.y], ['advance-days-menu.gif', 2, 36]);
});

test('there is one painted cell per day, each drawing its own hover and pressed art', () => {
  const { view, assets, buttons } = build();
  const cells = buttons.calls.filter(({ kind }) => kind === 'sprite');
  const expected = dayPickerCells();

  assert.equal(cells.length, 20);
  cells.forEach(({ args }, index) => {
    const { day, button, hitzone } = expected[index];
    const [parent, cellButton, cellHitzone, normal, hover, down, arm] = args;
    assert.equal(parent, view.menu);
    assert.deepEqual([cellButton, cellHitzone], [button, hitzone], `day ${day}`);
    assert.equal(normal, assets.emptySpace);
    assert.deepEqual([hover.name, down.name], [`advance-${day}-hover.gif`, `advance-${day}-inverted.gif`]);
    assert.equal(arm(), true);
  });
});

test('tapping a cell chooses that cell\'s day', () => {
  const { buttons, chosen } = build();
  buttons.calls.filter(({ kind }) => kind === 'sprite').forEach(({ args }) => args[7]());
  assert.deepEqual(chosen, dayPickerCells().map(({ day }) => day));
});

test('Cancel sits over the grey button in the artwork, after every cell', () => {
  const { view, assets, buttons, on } = build();
  const menu = assets.menuButton;

  assert.deepEqual(buttons.calls.at(-1).args, [view.menu, 42, 13, 31, 91, menu.normal, menu.hover, menu.down, on.cancel, 'Cancel']);
  assert.deepEqual(view.menu.children, buttons.calls);
});
