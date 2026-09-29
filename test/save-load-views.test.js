import assert from 'node:assert/strict';
import test from 'node:test';

import { regular } from '../scripts/font-styles.js';
import { createGameAssets } from '../scripts/game-assets.js';
import { createSaveLoadViews } from '../scripts/views/save-load-views.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// Replaces the source-text test "save, load, and game-over controls are text
// buttons" in canvas-control-wiring, which matched these calls in app.js.
// Geometry is written out as init() had it before phase 9.

const SLOT_ROWS = [['autoSave', 30], ['save1', 50], ['save2', 70], ['save3', 90]];

function build() {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const pressed = [];
  const on = {
    load: (slot) => pressed.push(['load', slot]),
    save: (slot) => pressed.push(['save', slot]),
    cancelLoad: { start: () => 'start', mine: () => 'mine', gameOver: () => 'game over' },
    cancelSave: () => 'cancel save',
  };
  const slotNames = { autoSave: 'Empty Auto Slot', save1: 'Day:12|Class:2', save2: 'Empty Slot 2', save3: 'Empty Slot 3' };
  const views = createSaveLoadViews({ PIXI, sheet, assets, buildTextButton: buttons.buildTextButton, slotNames, on });
  return { views, assets, buttons, on, pressed, slotNames };
}

const callsOn = (buttons, parent) => buttons.calls.filter(({ args }) => args[0] === parent);

test('both screens are the load artwork below the status bar; Save Mine is retitled', () => {
  const { views } = build();

  for (const screen of [views.load.screen, views.save.screen]) {
    assert.equal(screen.texture.name, 'screen load mine.gif');
    assert.deepEqual([screen.x, screen.y], [0, 13]);
  }
  assert.notEqual(views.load.screen, views.save.screen);
  assert.equal(views.save.title.texture.name, 'save mine title.gif');
  assert.deepEqual([views.save.title.x, views.save.title.y], [20, 7]);
  assert.equal(views.save.screen.children[0], views.save.title, 'the title is drawn first, under the slots');
});

test('each screen has a stretching text button per slot, twenty pixels apart, captioned with its name', () => {
  const { views, assets, buttons, slotNames } = build();
  const menu = assets.menuButton;

  for (const name of ['load', 'save']) {
    const slots = callsOn(buttons, views[name].screen).slice(0, 4);
    for (const [[slot, y], { args, children }] of SLOT_ROWS.map((row, i) => [row, slots[i]])) {
      const [, width, height, x, top, normal, hover, down, , text, style, nineSlice] = args;
      assert.deepEqual([width, height, x, top], [86, 15, 11, y], `${name} ${slot}`);
      assert.deepEqual([normal, hover, down], [menu.normal, menu.hover, menu.down]);
      assert.deepEqual([text, style, nineSlice], [slotNames[slot], regular, menu.nineSlice]);
      assert.equal(views[name].slotLabels[slot], children[0], `${name} ${slot}: the caption is the button's own text`);
    }
    assert.deepEqual(Object.keys(views[name].slotLabels), SLOT_ROWS.map(([slot]) => slot));
  }
});

test('a slot button loads or saves its own slot', () => {
  const { views, buttons, pressed } = build();

  for (const name of ['load', 'save']) {
    callsOn(buttons, views[name].screen).slice(0, 4).forEach(({ args }) => args[8]());
  }
  assert.deepEqual(pressed, [
    ['load', 'autoSave'], ['load', 'save1'], ['load', 'save2'], ['load', 'save3'],
    ['save', 'autoSave'], ['save', 'save1'], ['save', 'save2'], ['save', 'save3'],
  ]);
});

test('the load screen stacks three Cancels in one spot, start first, and only the start one takes input', () => {
  const { views, assets, buttons, on } = build();
  const menu = assets.menuButton;
  const cancels = callsOn(buttons, views.load.screen).slice(4);

  assert.deepEqual(cancels.map(({ args }) => args), [
    [views.load.screen, 42, 13, 33, 123, menu.normal, menu.hover, menu.down, on.cancelLoad.start, 'Cancel'],
    [views.load.screen, 42, 13, 33, 123, menu.normal, menu.hover, menu.down, on.cancelLoad.mine, 'Cancel'],
    [views.load.screen, 42, 13, 33, 123, menu.normal, menu.hover, menu.down, on.cancelLoad.gameOver, 'Cancel'],
  ]);
  assert.deepEqual(views.load.cancels, { start: cancels[0], mine: cancels[1], gameOver: cancels[2] });
  assert.deepEqual(
    Object.values(views.load.cancels).map((cancel) => cancel.interactive),
    [true, false, false],
  );
  assert.deepEqual(views.load.screen.children.slice(4), cancels, 'drawn in that order, over the slots');
});

test("the save screen's Cancel hangs off its title", () => {
  const { views, assets, buttons, on } = build();
  const menu = assets.menuButton;

  assert.deepEqual(callsOn(buttons, views.save.title).map(({ args }) => args), [
    [views.save.title, 42, 13, 13, 116, menu.normal, menu.hover, menu.down, on.cancelSave, 'Cancel'],
  ]);
  assert.equal(callsOn(buttons, views.save.screen).length, 4, 'nothing but the slots on the screen itself');
});
