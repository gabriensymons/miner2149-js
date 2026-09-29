import assert from 'node:assert/strict';
import test from 'node:test';

import { barText, regular } from '../scripts/font-styles.js';
import { createGameAssets } from '../scripts/game-assets.js';
import { shopItems } from '../scripts/gamedata.js';
import { createMineChrome, createMineScreen } from '../scripts/views/mine-chrome-view.js';
import { createShopView } from '../scripts/views/shop-view.js';
import {
  FakeBitmapText, FakeContainer, FakeGraphics, createFakePIXI, fakeSheet, recordingButtons,
} from './fake-pixi.js';

// Geometry is written out as init() had it before phase 9.

const ON = [
  'showInstructions', 'showLevel', 'showOperations', 'showProduction', 'showOptions',
  'showDayPicker', 'advance', 'armWageUp', 'wageUp', 'armWageDown', 'wageDown',
];

function build() {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const screen = createMineScreen({ PIXI, sheet });
  const calls = [];
  const on = Object.fromEntries(ON.map((name) => [name, (...args) => { calls.push([name, ...args]); return name; }]));
  const chrome = createMineChrome({
    PIXI, sheet, assets, buildSpriteButton: buttons.buildSpriteButton, parent: screen,
    initial: { day: 12, credits: 1000000, sellPrice: 19, wage: 400 }, on,
  });
  return { PIXI, sheet, assets, buttons, screen, chrome, on, calls };
}

const spriteButtons = (buttons) => buttons.calls.filter(({ kind }) => kind === 'sprite').map(({ args }) => args);

test('the mine screen is the full-screen game artwork', () => {
  const { screen } = build();
  assert.deepEqual([screen.texture.name, screen.x, screen.y], ['screen game.png', 0, 0]);
});

test('the level markers sit on their buttons, and only level 1 starts marked', () => {
  const { chrome } = build();
  const expected = [
    ['level1', 'button level1 selected.gif', 115, true],
    ['level2', 'button level2 seleced.gif', 130, false],
    ['level3', 'button level3 selected.gif', 146, false],
  ];
  for (const [level, frame, x, visible] of expected) {
    const marker = chrome.levelSelected[level];
    assert.deepEqual([marker.texture.name, marker.x, marker.y, marker.visible], [frame, x, 28, visible], level);
  }
});

test('the top bar: the day, then the hidden "Mapping..." cover over it, then the credits over that', () => {
  const { chrome, screen } = build();
  const { dayText, creditText, topBar } = chrome;

  assert.deepEqual([dayText.text, dayText.style, dayText.x, dayText.y], ['12', barText, 24, 2]);
  assert.deepEqual([creditText.text, creditText.style, creditText.x, creditText.y], ['1000000', barText, 91, 2]);
  assert.ok(topBar.cover instanceof FakeGraphics);
  assert.deepEqual(topBar.cover.drawn, [['beginFill', 0x000000], ['drawRect', 0, 0, 146, 15], ['endFill']]);
  assert.deepEqual([topBar.cover.x, topBar.cover.y, topBar.cover.visible], [0, 0, false]);
  assert.deepEqual(topBar.cover.children, [topBar.text]);
  assert.deepEqual([topBar.text.text, topBar.text.style, topBar.text.x, topBar.text.y], ['Mapping...', barText, 3, 2]);

  const order = [dayText, topBar.cover, creditText].map((part) => screen.children.indexOf(part));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'day, cover, credits');
});

test('the sell price and the wage are centred in their slots', () => {
  const { chrome } = build();
  for (const [label, text, y] of [[chrome.sellPrice, '19', 115], [chrome.wage, '400', 144]]) {
    assert.ok(label instanceof FakeBitmapText);
    assert.deepEqual([label.text, label.style, label.x, label.y, label.anchor.x, label.anchor.y], [text, regular, 128, y, 0.5, 0]);
  }
});

test('the painted buttons: info, levels, reports and advance, each over its artwork', () => {
  const { chrome, assets, buttons, on, calls } = build();
  const [info, ...rest] = spriteButtons(buttons);
  const names = (args) => [args[4].name, args[5].name ?? args[5]];
  const { emptySpace } = assets;

  assert.deepEqual(info.slice(1, 4), [{ width: 10, height: 11, x: 147, y: 2 }, { width: 16, height: 15, x: 145, y: 0 }, emptySpace]);
  assert.deepEqual(names(info), ['button-info-hover.gif', 'button info inverted.gif']);
  assert.equal(info[7], on.showInstructions);

  const rows = [
    // [button, hitzone, hover, down]
    [{ width: 12, height: 11, x: 115, y: 28 }, { width: 14, height: 13, x: 114, y: 27 }, 'button-level1-hover.gif', chrome.levelSelected.level1.texture],
    [{ width: 13, height: 11, x: 130, y: 28 }, { width: 15, height: 13, x: 129, y: 27 }, 'button-level2-hover.gif', chrome.levelSelected.level2.texture],
    [{ width: 13, height: 11, x: 146, y: 28 }, { width: 15, height: 13, x: 145, y: 27 }, 'button-level3-hover.gif', chrome.levelSelected.level3.texture],
    [{ width: 12, height: 11, x: 115, y: 57 }, { width: 14, height: 13, x: 114, y: 56 }, 'button-chart-inverted.gif', emptySpace],
    [{ width: 13, height: 11, x: 130, y: 57 }, { width: 15, height: 13, x: 129, y: 56 }, 'button-factory-inverted.gif', emptySpace],
    [{ width: 12, height: 11, x: 146, y: 57 }, { width: 15, height: 13, x: 145, y: 56 }, 'button-x-inverted.gif', emptySpace],
    [{ width: 12, height: 11, x: 115, y: 86 }, { width: 14, height: 13, x: 114, y: 85 }, 'button-advance-clock-hover.gif', emptySpace],
    [{ width: 13, height: 11, x: 130, y: 86 }, { width: 15, height: 13, x: 129, y: 85 }, 'button-advance1-hover.gif', 'button-advance1-inverted.gif'],
    [{ width: 13, height: 11, x: 146, y: 86 }, { width: 15, height: 13, x: 145, y: 85 }, 'button-advance7-hover.gif', 'button-advance7-inverted.gif'],
  ];
  rows.forEach(([button, hitzone, hover, down], index) => {
    const args = rest[index];
    assert.deepEqual(args.slice(1, 4), [button, hitzone, emptySpace], `row ${index}`);
    assert.equal(args[4].name, hover, `row ${index}`);
    assert.equal(typeof down === 'string' ? args[5].name : args[5], down, `row ${index}`);
    assert.equal(args[6](), true, 'always armed');
  });

  rest.slice(0, 9).forEach((args) => args[7]());
  assert.deepEqual(calls, [
    ['showLevel', 'level1'], ['showLevel', 'level2'], ['showLevel', 'level3'],
    ['showOperations'], ['showProduction'], ['showOptions'],
    ['showDayPicker'], ['advance', 1], ['advance', 7],
  ]);
});

test('the wage arrows arm and act through their own callbacks', () => {
  const { assets, buttons, on } = build();
  const [up, down] = spriteButtons(buttons).slice(-2);

  assert.deepEqual(up.slice(1), [{ width: 13, height: 6, x: 146, y: 143 }, { width: 15, height: 7, x: 145, y: 142 },
    assets.upArrow.normal, assets.upArrow.hover, assets.upArrow.down, on.armWageUp, on.wageUp]);
  assert.deepEqual(down.slice(1), [{ width: 13, height: 6, x: 146, y: 150 }, { width: 15, height: 7, x: 145, y: 150 },
    assets.downArrow.normal, assets.downArrow.hover, assets.downArrow.down, on.armWageDown, on.wageDown]);
});

test('the storage icon is an empty container over its slot, with textures for each fill band', () => {
  const { chrome, assets } = build();

  assert.ok(chrome.storageIcon instanceof FakeContainer);
  assert.deepEqual([chrome.storageIcon.x, chrome.storageIcon.y, chrome.storageIcon.children.length], [146, 114, 0]);
  const frames = Object.fromEntries(Object.entries(chrome.storageTextures).map(([fill, t]) => [fill, [t.normal.name ?? t.normal, t.hover.name, t.down.name]]));
  assert.deepEqual(frames, {
    empty: [assets.emptySpace.name, 'sell-diridium-hover.gif', 'sell diridium inverted.gif'],
    third: ['sell diridium 33.gif', 'sell-diridium-33-hover.gif', 'sell diridium 33 inverted.gif'],
    twoThirds: ['sell diridium 66.gif', 'sell-diridium-66-hover.gif', 'sell diridium 66 inverted.gif'],
    full: ['sell diridium 99.gif', 'sell-diridium-99-hover.gif', 'sell diridium 99 inverted.gif'],
  });
  assert.equal(chrome.storageTextures.empty.normal, assets.emptySpace);
});

test('drawn in order: markers, the top bar, the two labels, the buttons, the storage icon, the wage arrows', () => {
  const { chrome, screen, buttons } = build();
  const sprites = spriteButtons(buttons);
  const recorded = buttons.calls;

  assert.deepEqual(screen.children, [
    ...Object.values(chrome.levelSelected),
    chrome.dayText, chrome.topBar.cover, chrome.creditText, chrome.sellPrice, chrome.wage,
    ...recorded.slice(0, 10),
    chrome.storageIcon,
    ...recorded.slice(10),
  ]);
  assert.equal(sprites.length, 12);
});

// Phase 9 builds the chrome and the shop as separate views, so the shop's
// children now all come after the chrome's rather than interleaved with them.
// That changes nothing on screen only because the two never overlap: what is
// drawn on top of what, and what the pointer reaches first, only depend on the
// order of things that share pixels. This is that argument, checked. The chrome
// keeps to the top bar and the right-hand column; the shop keeps to the bottom
// left. Labels are measured at a generous six pixels a character, against the
// longest thing each can say.
test('the chrome and the shop never share a pixel, which is why their order on the screen decides nothing', () => {
  const { PIXI, sheet, buttons, screen, chrome } = build();
  const shopButtons = recordingButtons();
  const longestItem = Object.values(shopItems).map(({ name }) => name).reduce((a, b) => (b.length > a.length ? b : a));
  const shop = createShopView({
    PIXI, sheet, buildHoverHitzone: shopButtons.buildHoverHitzone, parent: screen,
    caption: longestItem, price: 999999, on: { shop: () => {}, undo: () => {} },
  });

  const rect = ({ x, y, width, height }) => ({ left: x, top: y, right: x + width, bottom: y + height });
  const label = (text, chars) => {
    const width = 6 * chars;
    const left = text.x - width * text.anchor.x;
    return { left, top: text.y, right: left + width, bottom: text.y + 12 };
  };

  const chromeBoxes = [
    ...Object.values(chrome.levelSelected).map((marker) => rect({ x: marker.x, y: marker.y, width: 13, height: 11 })),
    label(chrome.dayText, 5), label(chrome.creditText, 8), rect({ x: 0, y: 0, width: 146, height: 15 }),
    label(chrome.sellPrice, 5), label(chrome.wage, 4),
    ...spriteButtons(buttons).flatMap((args) => [rect(args[1]), rect(args[2])]),
    rect({ x: chrome.storageIcon.x, y: chrome.storageIcon.y, width: 14, height: 13 }),
  ];
  const shopBoxes = [
    ...shopButtons.calls.flatMap(({ args }) => [rect(args[2]), rect(args[3])]),
    rect({ x: shop.captionHighlight.x, y: shop.captionHighlight.y, width: 59, height: 12 }),
    label(shop.caption, longestItem.length), label(shop.price, 6),
  ];

  for (const box of chromeBoxes) {
    assert.ok(box.bottom <= 16 || box.left >= 104, `chrome at ${JSON.stringify(box)} is in the top bar or the right-hand column`);
  }
  for (const box of shopBoxes) {
    assert.ok(box.right <= 104 && box.top >= 116, `shop at ${JSON.stringify(box)} is in the bottom left`);
  }
  assert.equal(chromeBoxes.length, 3 + 5 + 12 * 2 + 1);
  assert.equal(shopBoxes.length, 12 * 2 + 3);
});
