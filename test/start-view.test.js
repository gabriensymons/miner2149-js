import assert from 'node:assert/strict';
import test from 'node:test';

import { regular } from '../scripts/font-styles.js';
import { createGameAssets } from '../scripts/game-assets.js';
import { createStartView } from '../scripts/views/start-view.js';
import { FakeBitmapText, FakeGraphics, createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// Geometry is written out as init() and launchProbes() had it before phase 9,
// rather than read back from the module's own tables.

const names = (...textures) => textures.map((texture) => texture.name);

function build({ probes = 3 } = {}) {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const on = Object.fromEntries([
    'newMine', 'loadMine', 'openInstructions', 'closeInstructions', 'closeInstructionsToMine',
    'launch', 'armMoreProbes', 'moreProbes', 'armFewerProbes', 'fewerProbes',
  ].map((name) => [name, () => name]));
  const view = createStartView({
    PIXI, sheet, assets, buildTextButton: buttons.buildTextButton, buildSpriteButton: buttons.buildSpriteButton, probes, on,
  });
  return { view, assets, buttons, on };
}

const on = (buttons, parent) => buttons.calls.filter(({ args }) => args[0] === parent);

test('the four screens come from their artwork, full screen but for the asteroid list', () => {
  const { view } = build();

  for (const [screen, frame] of [
    [view.startScreen, 'screen start.gif'],
    [view.launchScreen, 'screen launch control.png'],
    [view.instructionsScreen, 'screen instructions.png'],
  ]) {
    assert.equal(screen.texture.name, frame);
    assert.deepEqual([screen.x, screen.y], [0, 0]);
  }
  assert.equal(view.selectAsteroidTitle.texture.name, 'select asteroid title.gif');
  assert.deepEqual([view.selectAsteroidTitle.x, view.selectAsteroidTitle.y], [5, 3]);
});

test('the start cover is white over all but the hi-score strip', () => {
  const { view } = build();

  assert.ok(view.startCover instanceof FakeGraphics);
  assert.deepEqual(view.startCover.drawn, [['beginFill', 0xFFFFFF], ['drawRect', 5, 5, 150, 120], ['endFill']]);
});

test('the start screen has New Mine, Load Mine and Instructions, stacked', () => {
  const { view, buttons, on: callbacks } = build();
  const start = ['button start.gif', 'button-start-hover.gif', 'button start inverted.gif'];

  assert.deepEqual(on(buttons, view.startScreen).map(({ args }) => [...args.slice(1, 5), names(...args.slice(5, 8)), ...args.slice(8)]), [
    [62, 14, 49, 74, start, callbacks.newMine, 'New Mine'],
    [62, 14, 49, 91, start, callbacks.loadMine, 'Load Mine'],
    [62, 14, 49, 108, start, callbacks.openInstructions, 'Instructions'],
  ]);
});

test('the launch screen shows the probe count, then its arrows, then Launch', () => {
  const { view, assets, buttons, on: callbacks } = build({ probes: 7 });
  const [count, more, fewer, launch] = view.launchScreen.children;

  assert.equal(count, view.probeCount);
  assert.ok(count instanceof FakeBitmapText);
  assert.deepEqual([count.text, count.style, count.x, count.y], [7, regular, 44, 127]);

  const up = assets.upArrow;
  const down = assets.downArrow;
  assert.deepEqual(more.args, [view.launchScreen, { width: 13, height: 6, x: 64, y: 126 }, { width: 18, height: 7, x: 63, y: 125 },
    up.normal, up.hover, up.down, callbacks.armMoreProbes, callbacks.moreProbes]);
  assert.deepEqual(fewer.args, [view.launchScreen, { width: 13, height: 6, x: 64, y: 133 }, { width: 18, height: 7, x: 63, y: 133 },
    down.normal, down.hover, down.down, callbacks.armFewerProbes, callbacks.fewerProbes]);
  assert.deepEqual([...launch.args.slice(1, 5), names(...launch.args.slice(5, 8)), ...launch.args.slice(8)], [
    43, 15, 85, 125, ['button-launch.gif', 'button-launch-hover.gif', 'button-launch-inverted.gif'], callbacks.launch, 'Launch',
  ]);
  assert.equal(view.launchScreen.children.length, 4);
});

test('the instructions screen stacks two OKs in one spot, and only the start one shows', () => {
  const { view, buttons, on: callbacks } = build();
  const ok = ['button OK.gif', 'button-OK-hover.gif', 'button OK inverted.gif'];
  const oks = on(buttons, view.instructionsScreen);

  assert.deepEqual(oks.map(({ args }) => [...args.slice(1, 5), names(...args.slice(5, 8)), ...args.slice(8)]), [
    [48, 13, 56, 141, ok, callbacks.closeInstructions, 'OK'],
    [48, 13, 56, 141, ok, callbacks.closeInstructionsToMine, 'OK'],
  ]);
  assert.deepEqual(view.instructionsOk, { start: oks[0], mine: oks[1] });
  assert.deepEqual([oks[0].visible, oks[1].visible], [true, false]);
});

test('each surveyed asteroid adds a named button and its class beside it, a row apart', () => {
  const { view, buttons } = build();
  const picks = [() => 0, () => 1, () => 2];

  ['Class:1', 'Class:3', 'Class:5'].forEach((label, index) => {
    view.addAsteroidChoice({ index, designation: `X${index}`, label, onPick: picks[index] });
  });

  const asteroid = ['button asteroid.gif', 'button-asteroid-hover.gif', 'button asteroid inverted.gif'];
  const children = view.selectAsteroidTitle.children;
  assert.equal(children.length, 6, 'a button and a label per asteroid, interleaved');
  [29, 49, 69].forEach((y, index) => {
    const [button, label] = children.slice(index * 2, index * 2 + 2);
    assert.deepEqual([...button.args.slice(1, 5), names(...button.args.slice(5, 8)), ...button.args.slice(8)], [
      59, 17, 4, y, asteroid, picks[index], `Asteroid X${index}`,
    ]);
    assert.ok(label instanceof FakeBitmapText);
    assert.deepEqual([label.text, label.style, label.x, label.y], [['Class:1', 'Class:3', 'Class:5'][index], regular, 67, y + 3]);
  });
  assert.equal(on(buttons, view.selectAsteroidTitle).length, 3);
});

test('the hi-score line is drawn over a white cover where the art paints it, masked to inside the frame', () => {
  const { view } = build();
  const [cover, mask, line] = view.startScreen.children.slice(0, 3);
  const { label, setText } = view.highScore;

  // Measured from 'screen start.gif': the painted text's rows are 148-156 and
  // the frame's bottom border is row 157, so the cover stops at 156; the border
  // columns are 0, 2, 157 and 159, and its rounded corners reach x 4 and 155 on
  // rows 155-156, so it spans 5-154.
  for (const part of [cover, mask]) {
    assert.ok(part instanceof FakeGraphics);
    assert.deepEqual(part.drawn, [['beginFill', 0xFFFFFF], ['drawRect', 5, 146, 150, 11], ['endFill']]);
  }
  assert.equal(line, label);
  assert.ok(line instanceof FakeBitmapText);
  assert.equal(line.style, regular);
  assert.equal(line.mask, mask);
  assert.equal(line.text, 'Hi Score:5000000 by Mr. Nobody', 'the placeholder the art paints, until a board is shown');

  // Centred on x=80 in whole pixels, from the left, then drawn back by the
  // font's glyph padding (0.2 across, 0.4 down) so the ink lands on the art's
  // pixels. The fake's text is five pixels a character: 30 characters are 150
  // wide and start at 80 - 75.
  assert.deepEqual([line.x, line.y, line.anchor.x, line.anchor.y], [5 - 0.2, 146 - 0.4, 0, 0]);
  setText('Hi Score:7 by A');
  assert.deepEqual([line.text, line.x], ['Hi Score:7 by A', 80 - Math.floor(75 / 2) - 0.2], 'an odd width rounds the start down, as Palm OS did');
});
