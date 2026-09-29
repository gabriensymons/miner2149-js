import assert from 'node:assert/strict';
import test from 'node:test';

import { gameDataInit } from '../scripts/gamedata.js';
import { createGameView } from '../scripts/game-view.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The whole scene against the fake. The screens themselves are pinned in their
// own views' tests; what this pins is what game-view.js owns: the order things
// are built in, and that every callback handed in reaches a control.

/** Every callback `createGameView` takes, as a spy that records its own path. */
function spies(called) {
  const spy = (path) => (...args) => { called.add(path); return args.length ? undefined : true; };
  const group = (name, keys) => Object.fromEntries(keys.map((key) => [key, spy(`${name}.${key}`)]));
  return {
    start: group('start', ['newMine', 'loadMine', 'openInstructions', 'closeInstructions', 'closeInstructionsToMine',
      'launch', 'armMoreProbes', 'moreProbes', 'armFewerProbes', 'fewerProbes']),
    reports: group('reports', ['closeOperations', 'closeProduction']),
    options: group('options', ['toggleDisasterMode', 'toggleGridlines', 'openSaveMine', 'openLoadMine', 'exitAndSave', 'resign', 'close']),
    saveLoad: {
      ...group('saveLoad', ['load', 'save', 'cancelSave']),
      cancelLoad: group('saveLoad.cancelLoad', ['start', 'mine', 'gameOver']),
    },
    dayPicker: group('dayPicker', ['chooseDay', 'cancel']),
    sell: group('sell', ['pressUp', 'pressDown', 'release', 'sell', 'cancel']),
    gameOver: group('gameOver', ['newMine', 'loadMine', 'quit']),
    chrome: group('chrome', ['showInstructions', 'showLevel', 'showOperations', 'showProduction', 'showOptions',
      'showDayPicker', 'advance', 'armWageUp', 'wageUp', 'armWageDown', 'wageDown']),
    shop: group('shop', ['shop', 'undo']),
  };
}

const paths = (on, prefix = '') => Object.entries(on).flatMap(([key, value]) =>
  (typeof value === 'function' ? [`${prefix}${key}`] : paths(value, `${prefix}${key}.`)));

function build(initial = { ...structuredClone(gameDataInit), probes: 4, wage: 450, diridium: 321 }) {
  const { PIXI } = createFakePIXI();
  const buttons = recordingButtons();
  const stage = { children: [], addChild(child) { this.children.push(child); return child; } };
  const called = new Set();
  const on = spies(called);
  const slotNames = { autoSave: 'Auto', save1: 'One', save2: 'Two', save3: 'Three' };
  const view = createGameView({ PIXI, sheet: fakeSheet(), stage, buttons, initial, slotNames, on });
  return { view, stage, buttons, on, called, slotNames };
}

test('the start screen is the one thing put on the stage, so everything else shows over it', () => {
  const { view, stage } = build();
  assert.deepEqual(stage.children, [view.start.startScreen]);
});

test('on the mine screen the map comes first, then its chrome, then its shop', () => {
  const { view } = build();
  const { screen, map, chrome, shop } = view.mine;
  const index = (part) => screen.children.indexOf(part);

  assert.deepEqual(screen.children.slice(0, 2), [map.surface, map.tileHover], 'the map, beneath everything');
  const chromeParts = [...Object.values(chrome.levelSelected), chrome.dayText, chrome.topBar.cover, chrome.creditText,
    chrome.sellPrice, chrome.wage, chrome.storageIcon];
  const shopParts = [...Object.values(shop.selected), shop.captionHighlight, shop.caption, shop.price];
  assert.ok(chromeParts.every((part) => index(part) > 1), 'the chrome is over the map');
  assert.ok(Math.max(...chromeParts.map(index)) < Math.min(...shopParts.map(index)), 'the chrome, then the shop');
});

test('every callback handed in is reachable from some control', () => {
  const { buttons, on, called } = build();

  for (const { args } of buttons.calls) {
    for (const arg of args) if (typeof arg === 'function') arg();
  }
  assert.deepEqual(paths(on).filter((path) => !called.has(path)), []);
});

test('the labels start from the colony handed in, and the slots from their names', () => {
  const { view, slotNames } = build();

  assert.equal(view.start.probeCount.text, 4);
  assert.equal(view.reports.operations.bindings.wage.label.text, '450');
  assert.equal(view.mine.chrome.wage.text, '450');
  assert.equal(view.sell.amount.text, '321');
  assert.equal(view.mine.shop.caption.text, String(gameDataInit.shopBtn));
  for (const screen of ['load', 'save']) {
    assert.deepEqual(Object.fromEntries(Object.entries(view.saveLoad[screen].slotLabels).map(([slot, label]) => [slot, label.text])), slotNames);
  }
});

test('the dialog parts and the shared textures come back for the caller to wire', () => {
  const { view } = build();
  assert.equal(view.message.dialogParts.length, 15);
  assert.ok(view.assets.menuButton.normal);
  assert.ok(view.mine.map.textures.smoothAreaGrid);
});
