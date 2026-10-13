import assert from 'node:assert/strict';
import test from 'node:test';

import { CAPTION_Y, SKYLINE_KEYS } from '../scripts/disaster-frame.js';
import { CAPTIONS } from '../scripts/power-plant-overload.js';
import { PANEL, SPRITE_KEYS, createPowerPlantView, unitAt } from '../scripts/power-plant-view.js';
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

function setup(options = {}) {
  const { PIXI } = createFakePIXI();
  const app = { stage: new PIXI.Container(), ticker: new FakeTicker() };
  const document = { hidden: false };
  const underlyingParent = { interactiveChildren: true };
  const completions = [];
  const fonts = { title: { fontName: 'Bold' }, status: { fontName: 'Regular' } };
  const draws = [...(options.draws ?? [])];
  const finals = [];
  const view = createPowerPlantView({
    PIXI, app, document, fonts, textures: fakeSheet().textures, underlyingParent,
    difficulty: 3,
    random: () => draws.shift(),
    onComplete: (finalState) => { completions.push(app.ticker.listeners.size); finals.push(finalState); },
    ...options,
  });
  return { app, document, underlyingParent, completions, finals, view };
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

// The breaker panel

const units = (scene) => scene.children.filter(({ name }) => /^unit \d$/.test(name ?? ''));
const labelOf = (scene, box) => scene.children[scene.children.indexOf(box) + 1];
const lit = (box) => box.drawn[0][1] === 0x000000;
const dotted = (box) => box.drawn.filter(([name]) => name === 'drawRect').length < 2 * (PANEL.unitWidth + PANEL.unitHeight);
/** A tap at the centre of unit `n` of `count`. */
function tapUnitAt(app, n, count) {
  const left = Math.round(80 - (count * PANEL.unitWidth + (count - 1) * PANEL.gap) / 2);
  const x = left + (n - 1) * (PANEL.unitWidth + PANEL.gap) + PANEL.unitWidth / 2;
  const shield = app.stage.children[0].children.at(-1);
  shield.emit('pointerdown', { data: { global: { x, y: PANEL.y + 6 } }, stopPropagation() {} });
}

test('a class 3 colony gets six numbered units, centred under the caption, with four lit on the first pulse', () => {
  const { app, view } = setup();
  view.open();
  const scene = sceneOf(app);

  const boxes = units(scene);
  assert.deepEqual(boxes.map(({ x, y }) => [x, y]), [
    [33, 37], [49, 37], [65, 37], [81, 37], [97, 37], [113, 37],
  ]);
  assert.deepEqual(boxes.map((box) => labelOf(scene, box).text), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(boxes.map(lit), [false, false, false, true, false, false]);
  assert.equal(labelOf(scene, boxes[3]).tint, 0xffffff, 'a lit unit\'s number is white on black');
  assert.ok(scene.children.indexOf(boxes[0]) > scene.children.indexOf(scene.children.find(({ name }) => name === 'gauge')));

  app.ticker.run(300);
  assert.deepEqual(boxes.map(lit), [false, false, false, false, false, false], 'and dark on the second');
});

test('a tap maps to the unit under it, with the gaps split between neighbours', () => {
  assert.equal(unitAt({ x: 33, y: 37 }, 6), 1);
  assert.equal(unitAt({ x: 47, y: 43 }, 6), 1);
  assert.equal(unitAt({ x: 48, y: 43 }, 6), 2);
  assert.equal(unitAt({ x: 126, y: 49 }, 6), 6);
  assert.equal(unitAt({ x: 31, y: 43 }, 6), null, 'left of the panel');
  assert.equal(unitAt({ x: 60, y: 60 }, 6), null, 'below it');
});

test('tapping the lit unit raises the next fault, and three contain the overload before it blows', () => {
  const { app, completions, finals, view } = setup({ draws: [0, 0] });
  view.open();
  const scene = sceneOf(app);

  tapUnitAt(app, 4, 6);
  assert.equal(caption(scene).text, '"Red line on one!"');
  tapUnitAt(app, 1, 6);
  assert.equal(caption(scene).text, '"Red line on two!"');
  tapUnitAt(app, 2, 6);
  assert.equal(caption(scene).text, '"Overload contained!"');

  app.ticker.run(1150);
  assert.deepEqual(completions, []);
  app.ticker.run(100);
  assert.equal(completions.length, 1, 'contained, it hands back after its hold rather than at 7.2 s');
  assert.equal(finals[0].faultsFixed, 3);
});

test('a wrong unit dots every rule for one pulse, and the panel ignores taps until it clears', () => {
  const { app, view } = setup({ draws: [0] });
  view.open();
  const scene = sceneOf(app);

  tapUnitAt(app, 2, 6);
  assert.ok(units(scene).filter((box) => !lit(box)).every(dotted), 'tripped');
  tapUnitAt(app, 4, 6);
  assert.equal(caption(scene).text, '"Red line on four!"', 'the right unit, too soon');

  app.ticker.run(650);
  assert.ok(!units(scene).filter((box) => !lit(box)).some(dotted), 'cleared');
  tapUnitAt(app, 4, 6);
  assert.equal(caption(scene).text, '"Red line on one!"');
});

test('a scene nobody taps hands back the state with no faults fixed', () => {
  const { app, finals, view } = setup();
  view.open();
  app.ticker.run(7250);
  assert.equal(finals.length, 1);
  assert.equal(finals[0].faultsFixed, 0);
});

test('not interactive, the scene is the original alone: no panel, and taps do nothing', () => {
  const { app, finals, view } = setup({ interactive: false });
  view.open();
  const scene = sceneOf(app);

  assert.deepEqual(units(scene), []);
  tapUnitAt(app, 4, 6);
  assert.equal(caption(scene).text, CAPTIONS.redLine);
  app.ticker.run(7250);
  assert.equal(finals[0].faultsFixed, 0);
});
