import assert from 'node:assert/strict';
import test from 'node:test';

import { CAPTION_Y, SKYLINE_KEYS } from '../scripts/disaster-frame.js';
import { CAPTIONS } from '../scripts/power-plant-overload.js';
import { SPRITE_KEYS, createPowerPlantView } from '../scripts/power-plant-view.js';
import { createFakePIXI, fakeSheet, FakeBitmapText, FakeGraphics, FakeSprite } from './fake-pixi.js';

class FakeTicker {
  constructor() {
    this.listeners = new Set();
    this.deltaMS = 0;
  }

  add(listener) { this.listeners.add(listener); }
  remove(listener) { this.listeners.delete(listener); }

  tick(milliseconds) {
    this.deltaMS = milliseconds;
    for (const listener of [...this.listeners]) listener();
  }

  /** Runs `milliseconds` of frames at 60 a second. */
  run(milliseconds) {
    for (let left = milliseconds; left > 0; left -= 1000 / 60) this.tick(Math.min(left, 1000 / 60));
  }
}

function setup() {
  const { PIXI } = createFakePIXI();
  const app = { stage: new PIXI.Container(), ticker: new FakeTicker() };
  const document = { hidden: false };
  const underlyingParent = { interactiveChildren: true };
  const completions = [];
  const fonts = { title: { fontName: 'Bold' }, status: { fontName: 'Regular' } };
  const view = createPowerPlantView({
    PIXI, app, document, fonts, textures: fakeSheet().textures, underlyingParent,
    onComplete: () => completions.push(app.ticker.listeners.size),
  });
  return { app, document, underlyingParent, completions, view };
}

const sceneOf = (app) => app.stage.children[0];
const sprites = (scene) => scene.children.filter((child) => child instanceof FakeSprite);
const named = (scene, key) => sprites(scene).find(({ texture }) => texture.name === key);
const caption = (scene) => scene.children.find((child) => child instanceof FakeBitmapText && child.y === CAPTION_Y);

test('the scene opens on the shared frame, the gauge, the plant, and "Red line on four!"', () => {
  const { app, underlyingParent, view } = setup();
  view.open();

  const scene = sceneOf(app);
  assert.equal(app.stage.children.length, 1);
  assert.deepEqual(
    sprites(scene).slice(0, 3).map(({ texture }) => texture.name),
    [SKYLINE_KEYS.left, SKYLINE_KEYS.middle, SKYLINE_KEYS.right],
    'the skyline is the first thing drawn after the ground',
  );
  // rect(1,100,55,101,130,0), lifted two pixels with the skyline it stands on.
  const gauge = scene.children.find(({ name }) => name === 'gauge');
  assert.ok(gauge instanceof FakeGraphics);
  assert.deepEqual(gauge.drawn, [['beginFill', 0x000000], ['drawRect', 100, 53, 1, 75], ['endFill']]);
  // bitmap(95,135), lifted the same two pixels.
  const plant = named(scene, SPRITE_KEYS.pulseA);
  assert.deepEqual([plant.x, plant.y, plant.visible], [95, 133, true]);
  assert.equal(named(scene, SPRITE_KEYS.pulseB).visible, false);
  assert.equal(caption(scene).text, CAPTIONS.redLine);
  assert.equal(caption(scene).visible, true);
  assert.equal(underlyingParent.interactiveChildren, false, 'the mine underneath stops taking input');
  const shield = scene.children.at(-1);
  assert.equal(shield.interactive, true, 'the scene takes every tap, over everything it draws');
  assert.deepEqual([shield.hitArea.width, shield.hitArea.height], [160, 160]);
});

test('the blast walks up and to the left as it grows, from bitmap(94,133) to bitmap(91,127)', () => {
  const { app, view } = setup();
  view.open();

  const scene = sceneOf(app);
  assert.deepEqual(
    SPRITE_KEYS.blast.map((key) => named(scene, key)).map(({ x, y, visible }) => [x, y, visible]),
    [[94, 131, false], [93, 129, false], [92, 127, false], [91, 125, false]],
  );
  const plantIndex = scene.children.indexOf(named(scene, SPRITE_KEYS.pulseB));
  assert.ok(
    SPRITE_KEYS.blast.every((key) => scene.children.indexOf(named(scene, key)) > plantIndex),
    'every blast bitmap is drawn over the plant',
  );
});

test('the ticker plays the source timeline: pulses, the second caption, then the blast frame by frame', () => {
  const { app, view } = setup();
  view.open();
  const scene = sceneOf(app);
  const blastShown = () => SPRITE_KEYS.blast.filter((key) => named(scene, key).visible).length;

  app.ticker.run(300);
  assert.deepEqual(
    [named(scene, SPRITE_KEYS.pulseA).visible, named(scene, SPRITE_KEYS.pulseB).visible],
    [false, true],
  );
  app.ticker.run(2150);
  assert.equal(caption(scene).text, CAPTIONS.goingToBlow);
  app.ticker.run(3000);
  assert.equal(blastShown(), 1);
  app.ticker.run(1200);
  assert.equal(blastShown(), 4, 'each blast bitmap stays under the next');
});

test('when the last blast frame has been held the scene closes, gives the mine back, and completes once', () => {
  const { app, underlyingParent, completions, view } = setup();
  view.open();
  const scene = sceneOf(app);

  app.ticker.run(7150);
  assert.deepEqual(completions, []);
  app.ticker.run(100);

  assert.deepEqual(completions, [0], 'completes after its ticker listener is gone');
  assert.equal(app.stage.children.length, 0);
  assert.equal(scene.destroyed, true);
  assert.equal(underlyingParent.interactiveChildren, true);
  app.ticker.run(1000);
  assert.equal(completions.length, 1);
});

test('the scene does not advance while the page is hidden', () => {
  const { app, document, completions, view } = setup();
  view.open();
  const scene = sceneOf(app);

  document.hidden = true;
  app.ticker.run(10_000);
  assert.deepEqual(completions, []);
  assert.equal(caption(scene).text, CAPTIONS.redLine);

  document.hidden = false;
  app.ticker.run(7250);
  assert.equal(completions.length, 1);
});

test('closing early tears the scene down and restores input without completing', () => {
  const { app, underlyingParent, completions, view } = setup();
  view.open();

  view.close();
  view.close();
  assert.equal(app.stage.children.length, 0);
  assert.equal(app.ticker.listeners.size, 0);
  assert.equal(underlyingParent.interactiveChildren, true);
  assert.deepEqual(completions, []);
});
