import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMeteorStormView,
  laserWedge,
  rasterizeTriangle,
} from '../scripts/meteor-storm-view.js';

class FakeDisplayObject {
  constructor() {
    this.children = [];
    this.parent = null;
    this.x = 0;
    this.y = 0;
    this.visible = true;
    this.listeners = new Map();
    this.position = {
      set: (x, y) => {
        this.x = x;
        this.y = y;
      },
    };
  }

  addChild(...children) {
    for (const child of children) {
      child.parent = this;
      this.children.push(child);
    }
    return children.at(-1);
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
    return child;
  }

  on(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
    return this;
  }

  off(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
    return this;
  }

  emit(name, event) {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }

  toLocal(point) {
    return { x: (point.x - this.x) / 2, y: (point.y - this.y) / 2 };
  }

  destroy() {
    this.destroyed = true;
    this.children.length = 0;
    this.listeners.clear();
  }
}

class FakeContainer extends FakeDisplayObject {}

class FakeSprite extends FakeDisplayObject {
  constructor(texture) {
    super();
    this.texture = texture;
  }
}

class FakeGraphics extends FakeDisplayObject {
  constructor() {
    super();
    this.commands = [];
  }

  command(name, ...args) {
    this.commands.push([name, ...args]);
    return this;
  }

  clear() { return this.command('clear'); }
  beginFill(...args) { return this.command('beginFill', ...args); }
  endFill(...args) { return this.command('endFill', ...args); }
  lineStyle(...args) { return this.command('lineStyle', ...args); }
  drawRect(...args) { return this.command('drawRect', ...args); }
  drawCircle(...args) { return this.command('drawCircle', ...args); }
  moveTo(...args) { return this.command('moveTo', ...args); }
  lineTo(...args) { return this.command('lineTo', ...args); }
}

class FakeBitmapText extends FakeDisplayObject {
  constructor(text, style) {
    super();
    this.text = text;
    this.style = style;
  }

  // The Palm bitmap faces are near enough fixed-pitch at ~6px per glyph.
  get width() {
    return this.text.length * 6;
  }
}

class FakeRectangle {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}

class FakeTicker {
  constructor() {
    this.listeners = new Set();
    this.deltaMS = 0;
  }

  add(listener) { this.listeners.add(listener); }
  remove(listener) { this.listeners.delete(listener); }

  tick(milliseconds) {
    this.deltaMS = milliseconds;
    for (const listener of [...this.listeners]) listener(milliseconds / (1000 / 60));
  }
}

class FakeDocument {
  constructor() {
    this.hidden = false;
    this.listeners = new Map();
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener);
  }

  dispatch(name) {
    for (const listener of this.listeners.get(name) ?? []) listener();
  }
}

const SPRITE_KEYS = Object.freeze({
  skylineLeft: 'SRCBMP-023_splash_frame_line_327.png',
  skylineMiddle: 'SRCBMP-024_splash_frame_line_328.png',
  skylineRight: 'SRCBMP-025_splash_frame_line_329.png',
  platformSlide: 'SRCBMP-016_storm_frame_line_240.png',
  // Source line 255, bitmap(72,140,...), 15x15: the tank with its turret raised.
  // SRCBMP-018 is the commented-out meteor variant at line 260, not a platform.
  platformArmed: 'SRCBMP-017_storm_frame_line_255.png',
  unusedMeteorVariant: 'SRCBMP-018_storm_frame_line_260.png',
  // v3.2 redrew the in-flight meteor: solid dark, replacing v3.0's outline.
  meteor: 'V32BMP-070_storm_meteor_pool_306.png',
  meteorDestroyed: 'SRCBMP-020_storm_frame_line_287.png',
  // Port addition: the source leaves the meter unlabelled.
  rechargeLabel: 'recharge-label.gif',
  meteorImpact: 'SRCBMP-021_storm_frame_line_307.png',
  groundExplosion: 'SRCBMP-022_storm_frame_line_309.png',
});

function makeTextures() {
  return Object.fromEntries(
    Object.values(SPRITE_KEYS).map((key) => [key, { atlasKey: key }]),
  );
}

function spriteFor(scene, textures, key) {
  return scene.children.find((child) => child instanceof FakeSprite
    && child.texture === textures[key]);
}

function makeHarness(overrides = {}) {
  const PIXI = {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    BitmapText: FakeBitmapText,
    Rectangle: FakeRectangle,
    Sprite: FakeSprite,
  };
  const stage = new FakeContainer();
  const ticker = new FakeTicker();
  const app = { stage, ticker };
  const document = new FakeDocument();
  const underlyingParent = { interactiveChildren: true };
  const model = {
    activate: (state) => ({ ...state, phase: 'active' }),
    step: (state) => state,
    fire: (state) => state,
    setInput: (state, input) => ({ ...state, input }),
    clearInput: (state) => ({ ...state, input: { held: false, aim: null } }),
  };
  return {
    PIXI,
    app,
    document,
    underlyingParent,
    model,
    textures: makeTextures(),
    ...overrides,
  };
}

function activeState(overrides = {}) {
  return {
    phase: 'active',
    total: 3,
    currentIndex: 1,
    destroyed: 1,
    missed: 0,
    power: 72,
    initialPower: 100,
    cooldown: 4,
    stepDelay: 12,
    warnings: [],
    meteors: [{ x: 52, y: 78, status: 'inbound' }],
    laserDisabled: false,
    input: { held: false, aim: null },
    effects: [],
    ...overrides,
  };
}

function pointerEvent(pointerId, x, y) {
  return {
    data: { pointerId, global: { x, y } },
    stopped: false,
    stopPropagation() { this.stopped = true; },
  };
}

const CAPTION_Y = 24;   // five pixels below the title's dotted rule at y=19

function captionIn(scene) {
  return scene.children.find((child) => child instanceof FakeBitmapText
    && child.y === CAPTION_Y);
}

function craterLayerIn(scene) {
  return scene.children.find((child) => child.name === 'craters');
}

function beamIn(scene) {
  return scene.children.find((child) => child.name === 'beam');
}

function meteorLayerIn(scene) {
  return scene.children.find((child) => child.name === 'meteors');
}

// The falling bitmaps are pooled inside the masked meteor layer, so look there
// rather than among the scene's own children.
function pooled(scene, textures, key) {
  return meteorLayerIn(scene).children.filter((child) => child.texture === textures[key]);
}

function visiblePooled(scene, textures, key) {
  return pooled(scene, textures, key).filter(({ visible }) => visible);
}

// The state the model now hands the view: a list of live meteors, not one.
function withMeteors(...meteors) {
  return { meteors };
}

function commandsAfterLastClear(graphic) {
  const clearIndex = graphic.commands.findLastIndex(([name]) => name === 'clear');
  return graphic.commands.slice(clearIndex + 1);
}

test('open builds and renders a 160 by 160 modal scene with the original source art', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({
    ...harness,
    fonts: { title: { fontName: 'Bold' }, status: { fontName: 'Regular' } },
  });

  view.open(activeState());

  assert.equal(harness.app.stage.children.length, 1);
  const scene = harness.app.stage.children[0];
  const graphics = scene.children.filter((child) => child instanceof FakeGraphics);
  const labels = scene.children.filter((child) => child instanceof FakeBitmapText);
  assert.ok(graphics.some(({ commands }) => commands.some(
    (command) => command[0] === 'drawRect' && command.slice(1).join() === '0,0,160,160',
  )), 'scene has a full logical-canvas modal background');
  assert.deepEqual(labels.filter(({ visible }) => visible).map(({ text }) => text), [
    'Disaster Alert:',
    '"Target Incoming Meteors! "',
    'HIT 1  MISS 0',
    '2/3',
  ]);
  // The bar row has two clear bands: x8..71 before the tank, x88..118 after it.
  const counters = labels.find(({ text }) => text.includes('HIT'));
  const progress = labels.find(({ text }) => text === '2/3');
  assert.deepEqual([counters.x, counters.y], [8, 145], 'counters use the left band');
  assert.deepEqual([progress.x, progress.y], [96, 145], 'progress uses the band after the tank');
  const sprites = scene.children.filter((child) => child instanceof FakeSprite);
  assert.deepEqual(
    sprites.map(({ texture }) => texture.atlasKey),
    [
      SPRITE_KEYS.skylineLeft,
      SPRITE_KEYS.skylineMiddle,
      SPRITE_KEYS.skylineRight,
      SPRITE_KEYS.platformSlide,
      SPRITE_KEYS.platformArmed,
      SPRITE_KEYS.groundExplosion,
      // Not a source bitmap: the port's caption for the recharge meter, which
      // the original leaves unlabelled.
      SPRITE_KEYS.rechargeLabel,
    ],
    'the scene draws the source storm bitmaps from the loaded atlas',
  );
  assert.deepEqual(craterLayerIn(scene).children, [], 'craters are added as misses land');
  assert.deepEqual(
    sprites.filter(({ visible }) => visible).map(({ texture, x, y }) => [texture.atlasKey, x, y]),
    [
      [SPRITE_KEYS.skylineLeft, 5, 128],
      [SPRITE_KEYS.skylineMiddle, 50, 128],
      [SPRITE_KEYS.skylineRight, 100, 128],
      [SPRITE_KEYS.platformArmed, 72, 140],
      // Aligned to the bar's left edge at x=120, one row of air above the bar's
      // top at y=147, and clear of the skyline, which ends at y=140.
      [SPRITE_KEYS.rechargeLabel, 120, 142],
    ],
  );
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor).map(({ x, y }) => [x, y]),
    [[52, 78]],
    'the one live meteor is drawn from the pooled layer',
  );
  const headerIndex = scene.children.indexOf(labels.find(
    ({ text }) => text === 'Disaster Alert:',
  ));
  assert.ok(
    scene.children.indexOf(meteorLayerIn(scene)) < headerIndex,
    'meteors entering from the top pass behind the header',
  );
  assert.equal(harness.underlyingParent.interactiveChildren, false);

  view.close();
  assert.equal(harness.underlyingParent.interactiveChildren, true);
});

test('the recharge bar reproduces the source rect and there is no power meter', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  // Source: rect(1,120,147,150-f,153,0) -- x 120 to 150-cooldown, y 147 to 153.
  view.open(activeState({ cooldown: 0 }));

  const scene = harness.app.stage.children[0];
  const bar = scene.children.find((child) => child instanceof FakeGraphics
    && child.x === 120 && child.y === 147);
  assert.ok(bar, 'the recharge bar keeps its source anchor, unlifted');
  assert.deepEqual(commandsAfterLastClear(bar), [
    ['beginFill', 0x000000],
    ['drawRect', 0, 0, 30, 6],
    ['endFill'],
  ], 'cooldown 0 draws a full 30x6 bar: ready to fire');

  view.render(activeState({ cooldown: 12 }));
  assert.deepEqual(commandsAfterLastClear(bar).at(-2), ['drawRect', 0, 0, 18, 6]);

  view.render(activeState({ cooldown: 30 }));
  assert.deepEqual(commandsAfterLastClear(bar), [], 'a fully drained bar draws nothing');

  const labels = scene.children.filter((child) => child instanceof FakeBitmapText);
  assert.equal(
    labels.filter(({ text }) => /POWER|COOLDOWN/.test(text)).length,
    0,
    'the original has no POWER or COOLDOWN labels',
  );
  assert.equal(
    scene.children.filter((child) => child instanceof FakeGraphics
      && child.x === 8 && child.y === 140).length,
    0,
    'the separate power meter is gone',
  );
  assert.equal(scene.children.at(-1).interactive, true, 'pointer target remains topmost');
});

test('the laser draws a filled wedge and is held on screen after the effect is gone', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({
    ...harness,
    fonts: {},
    laserHoldInterval: 300,
    completionHoldInterval: 0,
  });

  view.open(activeState({
    effects: [
      { type: 'laser', from: { x: 80, y: 140 }, to: { x: 20, y: 70 } },
      { type: 'meteor-hit', index: 1 },
      { type: 'laser', from: { x: 79, y: 139 }, to: { x: 33, y: 65 } },
    ],
  }));

  const scene = harness.app.stage.children[0];
  const laser = beamIn(scene);
  // The wedge is scan-converted onto the 160x160 grid, so it draws as whole
  // one-pixel rows rather than as a vector shape the renderer smooths.
  const commands = commandsAfterLastClear(laser);
  assert.deepEqual(commands.at(0), ['beginFill', 0x000000]);
  assert.deepEqual(commands.at(-1), ['endFill']);
  const rows = commands.slice(1, -1);
  assert.ok(rows.length > 10, 'a long beam covers many rows');
  for (const [name, x, y, width, height] of rows) {
    assert.equal(name, 'drawRect');
    assert.ok(Number.isInteger(x) && Number.isInteger(y), 'rows land on whole pixels');
    assert.equal(height, 1, 'one span per pixel row');
    assert.ok(width >= 1, 'the beam never thins away to nothing');
  }
  assert.deepEqual(rows.map(([, , y]) => y), rows.map(([, , y]) => y).sort((a, b) => a - b));
  assert.equal(laser.visible, true);
  assert.equal(scene.children.at(-1).interactive, true, 'pointer target remains above the beam');

  // An effect-free state does not end the beam; the hold does.
  view.render(activeState({ effects: [] }));
  assert.equal(laser.visible, true, 'the beam outlives the single-step effect');

  harness.app.ticker.tick(200);
  view.render(activeState({ effects: [] }));
  assert.equal(laser.visible, true, 'still inside the hold');

  harness.app.ticker.tick(120);
  view.render(activeState({ effects: [] }));
  assert.equal(laser.visible, false, 'the hold expires and the beam clears');
  assert.deepEqual(commandsAfterLastClear(laser), []);
});

test('re-rendering one state repeatedly does not keep restarting the laser hold', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {}, laserHoldInterval: 300 });

  // The armed pause and the completion hold both re-render the same state every
  // frame. A beam fired on the last simulation step must still time out.
  const held = activeState({ effects: [{ type: 'laser', from: { x: 80, y: 140 }, to: { x: 20, y: 70 } }] });
  view.open(held);
  const scene = harness.app.stage.children[0];
  const laser = beamIn(scene);
  assert.equal(laser.visible, true);

  for (let frame = 0; frame < 30; frame += 1) {
    harness.app.ticker.tick(16);
    view.render(held);
  }

  assert.equal(laser.visible, false, 'the same effect object cannot re-arm the hold');
});

test('the LOW POWER caption is latched until the recharge bar is back to 80 per cent', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  // The model raises low-power for only a handful of steps; the caption must not
  // blink out with it.
  view.open(activeState({ warnings: ['low-power'], cooldown: 30 }));
  const scene = harness.app.stage.children[0];
  const caption = captionIn(scene);
  assert.equal(caption.text, 'LOW POWER');

  view.render(activeState({ warnings: [], cooldown: 30 }));
  assert.equal(caption.text, 'LOW POWER', 'the warning outlives the model flag');

  view.render(activeState({ warnings: [], cooldown: 7 }));
  assert.equal(caption.text, 'LOW POWER', 'a bar at 23/30 is still under the threshold');

  view.render(activeState({ warnings: [], cooldown: 6 }));
  assert.equal(caption.text, '"Target Incoming Meteors! "', 'clears at exactly 24/30');

  // POWER DRAINED still wins the shared caption slot outright.
  view.render(activeState({ warnings: ['low-power'], cooldown: 30 }));
  assert.equal(caption.text, 'LOW POWER');
  view.render(activeState({ warnings: ['power-drained'], cooldown: 30 }));
  assert.equal(caption.text, 'POWER DRAINED');
});

test('the wedge base is square to the beam at every firing angle', () => {
  const from = { x: 80, y: 140 };
  // Shallow shots are where a screen-aligned base sheared the tip off worst.
  const aims = [
    { x: 8, y: 130 }, { x: 152, y: 132 }, { x: 80, y: 8 },
    { x: 5, y: 60 }, { x: 150, y: 20 }, { x: 81, y: 139 }, { x: 33, y: 65 },
  ];

  for (const to of aims) {
    const [apex, left, right] = laserWedge({ from, to });

    assert.deepEqual(apex, from, 'the point of the wedge is the turret');
    assert.ok(
      Math.abs(Math.hypot(right.x - left.x, right.y - left.y) - 3) < 1e-9,
      `base is three pixels long aiming at ${to.x},${to.y}`,
    );
    assert.ok(
      Math.abs((left.x + right.x) / 2 - to.x) < 1e-9
      && Math.abs((left.y + right.y) / 2 - to.y) < 1e-9,
      'the base is centred on the aim point',
    );
    // The median from the apex to the midpoint of the base runs down the beam
    // axis, so a perpendicular base means a zero dot product with that axis.
    const dot = (right.x - left.x) * (to.x - from.x) + (right.y - left.y) * (to.y - from.y);
    assert.ok(Math.abs(dot) < 1e-9, `base meets the beam axis at a right angle at ${to.x},${to.y}`);
  }
});

test('a zero-length beam has no axis to be square to and still yields a wedge', () => {
  const point = { x: 80, y: 140 };
  const [apex, left, right] = laserWedge({ from: point, to: point });

  assert.deepEqual(apex, point);
  assert.deepEqual([left, right], [{ x: 81.5, y: 140 }, { x: 78.5, y: 140 }],
    'it falls back to a horizontal base rather than producing NaN');
});

test('the wedge is scan-converted onto the Palm pixel grid', () => {
  const spans = rasterizeTriangle(laserWedge({
    from: { x: 80, y: 140 },
    to: { x: 20, y: 40 },
  }));

  assert.ok(spans.length > 0);
  for (const [x, y, width] of spans) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(width),
      'every span sits on whole pixels, like the bitmaps beside it');
    assert.ok(width >= 1, 'sub-pixel rows near the apex still draw one pixel');
  }
  const rows = spans.map(([, y]) => y);
  assert.deepEqual(rows, [...new Set(rows)], 'one span per row');
  assert.deepEqual(rows, [...rows].sort((a, b) => a - b));
  // The base straddles the aim point, so the top row is the highest base vertex.
  const wedge = laserWedge({ from: { x: 80, y: 140 }, to: { x: 20, y: 40 } });
  assert.equal(Math.min(...rows), Math.floor(Math.min(...wedge.map(({ y }) => y))));
  assert.equal(Math.max(...rows), 139, 'and it runs down to the turret');

  // The wedge is widest at the aim end and tapers to the turret.
  const widthAt = (row) => spans.find(([, y]) => y === row)[2];
  assert.ok(widthAt(41) >= widthAt(138), 'it tapers from the base towards the point');
});

test('a near-horizontal beam still rasterizes into rows rather than vanishing', () => {
  const spans = rasterizeTriangle(laserWedge({
    from: { x: 80, y: 140 },
    to: { x: 8, y: 140 },
  }));

  assert.ok(spans.length >= 2, 'the perpendicular base gives it height to scan');
  assert.ok(spans.every(([, , width]) => width >= 1));
});

test('the caption slot shows the storm phase text and yields to model power warnings', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState({ phase: 'deploying' }));

  const scene = harness.app.stage.children[0];
  const caption = captionIn(scene);
  assert.equal(caption.text, '"Warning: Meteor Storm! "', 'SRCMSG-010 opens the scene');

  const platform = spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed);
  assert.equal(platform.visible, false, 'the platform is not armed during the slide-in');
  assert.equal(
    spriteFor(scene, harness.textures, SPRITE_KEYS.unusedMeteorVariant),
    undefined,
    'the commented-out source bitmap is never added to the scene',
  );

  harness.app.ticker.tick(600);
  assert.equal(caption.text, '"Warning: Meteor Storm! "', 'the alert beat is held, not skipped');

  // 62 slide steps at 100ms, then one settle frame.
  harness.app.ticker.tick(6300);
  assert.equal(caption.text, '"Target Incoming Meteors! "', 'SRCMSG-012 takes over once active');
  assert.equal(platform.visible, true);

  view.render(activeState({ phase: 'complete' }));
  assert.equal(caption.visible, false);
});

test('render shows model power warnings below the unchanged meteor status and clears them', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState({ warnings: ['low-power'] }));

  const scene = harness.app.stage.children[0];
  const labels = scene.children.filter((child) => child instanceof FakeBitmapText);
  const status = labels.find(({ text }) => text.includes('HIT'));
  const warning = labels.find(({ text }) => text === 'LOW POWER');
  assert.equal(status.text, 'HIT 1  MISS 0');
  assert.equal(status.y, 145, 'counters live on the recharge bar row');
  assert.equal(warning.y, CAPTION_Y);
  assert.equal(warning.visible, true);

  view.render(activeState({ warnings: ['power-drained'] }));

  assert.equal(warning.text, 'POWER DRAINED');
  assert.equal(status.text, 'HIT 1  MISS 0');

  view.render(activeState({ warnings: [] }));

  assert.equal(warning.text, '"Target Incoming Meteors! "', 'the caption slot falls back to SRCMSG-012');
  assert.equal(warning.visible, true);
  assert.equal(scene.children.at(-1).interactive, true, 'pointer target remains above warning text');
});

test('full-screen pointer input converts scene coordinates and tracks only the held pointer', () => {
  const calls = [];
  const model = {
    activate: (state) => state,
    step: (state) => state,
    setInput: (state, input) => {
      calls.push(['setInput', input]);
      return { ...state, input };
    },
    fire: (state, aim) => {
      calls.push(['fire', aim, state.input]);
      return { ...state, effects: [{ type: 'laser', from: { x: 80, y: 140 }, to: aim }] };
    },
    clearInput: (state) => {
      calls.push(['clearInput']);
      return { ...state, input: { held: false, aim: null } };
    },
  };
  const harness = makeHarness({ model });
  const view = createMeteorStormView({ ...harness, fonts: {} });
  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const hitTarget = scene.children.find(({ interactive }) => interactive);

  assert.deepEqual(hitTarget.hitArea, new FakeRectangle(0, 0, 160, 160));
  assert.deepEqual([...hitTarget.listeners.keys()].sort(), [
    'pointercancel',
    'pointerdown',
    'pointermove',
    'pointerup',
    'pointerupoutside',
  ]);

  const down = pointerEvent(7, 104, 156);
  hitTarget.emit('pointerdown', down);
  hitTarget.emit('pointermove', pointerEvent(8, 0, 0));
  hitTarget.emit('pointermove', pointerEvent(7, 120, 180));
  hitTarget.emit('pointerup', pointerEvent(8, 0, 0));
  hitTarget.emit('pointerup', pointerEvent(7, 120, 180));

  assert.equal(down.stopped, true);
  assert.deepEqual(calls, [
    ['setInput', { held: true, x: 52, y: 78 }],
    ['fire', { x: 52, y: 78 }, { held: true, x: 52, y: 78 }],
    ['setInput', { held: true, x: 60, y: 90 }],
    ['clearInput'],
  ]);

  hitTarget.emit('pointerdown', pointerEvent(9, 104, 156));
  hitTarget.emit('pointerupoutside', pointerEvent(9, 104, 156));
  hitTarget.emit('pointerdown', pointerEvent(10, 104, 156));
  hitTarget.emit('pointercancel', pointerEvent(10, 104, 156));
  assert.equal(calls.filter(([name]) => name === 'clearInput').length, 3);
});

test('ticker uses a safe accumulator, pauses while hidden, and completion tears everything down once', () => {
  const steps = [];
  const clears = [];
  const model = {
    activate: (state) => state,
    setInput: (state, input) => ({ ...state, input }),
    fire: (state) => state,
    clearInput: (state) => {
      clears.push(state.input);
      return { ...state, input: { held: false, aim: null } };
    },
    step: (state) => {
      const count = steps.length + 1;
      steps.push(count);
      return { ...state, phase: count === 3 ? 'complete' : 'active', currentIndex: count };
    },
  };
  const underlyingParent = { interactiveChildren: false };
  const completed = [];
  const harness = makeHarness({ model, underlyingParent });
  const view = createMeteorStormView({
    ...harness,
    fonts: {},
    onComplete: (state) => completed.push(state),
  });
  view.open(activeState({ currentIndex: 0, stepDelay: 0 }));
  const scene = harness.app.stage.children[0];
  const hitTarget = scene.children.find(({ interactive }) => interactive);
  hitTarget.emit('pointerdown', pointerEvent(4, 104, 156));

  harness.app.ticker.tick(16);
  assert.equal(steps.length, 0, 'zero source delay still waits for a browser-safe frame');
  harness.app.ticker.tick(1);
  assert.equal(steps.length, 1);

  harness.document.hidden = true;
  harness.document.dispatch('visibilitychange');
  harness.app.ticker.tick(100);
  assert.equal(steps.length, 1, 'hidden time does not advance or accumulate');
  assert.deepEqual(clears[0], { held: true, x: 52, y: 78 });

  harness.document.hidden = false;
  harness.document.dispatch('visibilitychange');
  harness.app.ticker.tick(16);
  assert.equal(steps.length, 1);
  harness.app.ticker.tick(1);
  harness.app.ticker.tick(17);

  assert.equal(steps.length, 3);
  assert.equal(completed.length, 0, 'the finished field is held before handing back');
  assert.equal(harness.app.stage.children.length, 1, 'the craters stay up during the hold');

  harness.app.ticker.tick(1200);

  assert.equal(steps.length, 3, 'the hold does not advance the simulation');
  assert.equal(completed.length, 1);
  assert.equal(completed[0].phase, 'complete');
  assert.equal(harness.app.ticker.listeners.size, 0);
  assert.equal(harness.document.listeners.get('visibilitychange')?.size, 0);
  assert.equal(harness.app.stage.children.length, 0);
  assert.equal(harness.underlyingParent.interactiveChildren, false);
  assert.equal([...hitTarget.listeners.values()].flat().length, 0);
  view.close();
  assert.equal(completed.length, 1);
});

test('the in-flight meteor is the source bitmap sprite and tracks the model position', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());

  const scene = harness.app.stage.children[0];
  const meteors = visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor);
  assert.equal(meteors.length, 1, 'the in-flight meteor uses the v3.2 bitmap from the atlas');
  assert.deepEqual([meteors[0].x, meteors[0].y], [52, 78]);
  assert.equal(
    scene.children.filter((child) => child instanceof FakeGraphics
      && child.commands.some(([name]) => name === 'drawCircle')).length,
    0,
    'no primitive meteor remains',
  );

  view.render(activeState(withMeteors({ x: 20, y: 101, status: 'inbound' })));
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor).map(({ x, y }) => [x, y]),
    [[20, 101]],
  );

  // A split puts two live meteors in the air at once; the pool grows to match.
  view.render(activeState(withMeteors(
    { x: 20, y: 110, status: 'inbound' },
    { x: 96, y: 110, status: 'inbound' },
  )));
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor).map(({ x }) => x),
    [20, 96],
  );

  // Fractional model travel is rounded to whole pixels for the bitmap.
  view.render(activeState(withMeteors({ x: 20.5, y: 110.4, status: 'inbound' })));
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor).map(({ x, y }) => [x, y]),
    [[21, 110]],
    'the surplus sprite is hidden and the survivor is rounded',
  );

  view.render(activeState({ meteors: [] }));
  assert.deepEqual(visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor), []);
});

test('a destroyed meteor leaves wreckage that falls with the meteor and flickers out', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const wreckage = () => visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorDestroyed)
    .map(({ x, y }) => [x, y]);
  assert.deepEqual(wreckage(), [], 'nothing is falling before a shot lands');

  // The kill draws at the point of impact on the step it happens.
  view.render(activeState({
    meteors: [],
    effects: [{ type: 'meteor-hit', index: 1, x: 44, y: 96, fallStep: 1, drift: -1 }],
  }));
  assert.deepEqual(wreckage(), [[44, 96]], 'drawn where the effect says');
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteor), [],
    'the in-flight bitmap yields to the hit bitmap',
  );

  // Then it carries the meteor's own momentum rather than vanishing. It used to
  // be gone by this step, which read as the meteor being deleted.
  view.render(activeState({ meteors: [] }));
  assert.deepEqual(wreckage(), [[43, 97]], 'falls at 0.6 of the meteor rate, keeping its drift');
  view.render(activeState({ meteors: [] }));
  assert.deepEqual(wreckage(), [[42, 97]]);

  // It flickers rather than fading: the screen is 1-bit, so alternate steps are
  // the only way that display loses something.
  const seen = [];
  for (let step = 0; step < 8; step += 1) {
    view.render(activeState({ meteors: [] }));
    seen.push(wreckage().length);
  }
  assert.ok(seen.includes(0) && seen.includes(1), `flickers before it goes: ${seen}`);
  assert.equal(seen.at(-1), 0, 'and it is gone by the end of its life');

  // Clearing both halves of a split kills two meteors on one step, which the
  // single sprite this replaced could only ever have shown one of.
  view.render(activeState({
    meteors: [],
    effects: [
      { type: 'meteor-hit', index: 2, x: 20, y: 40, fallStep: 1, drift: 0 },
      { type: 'meteor-hit', index: 2, x: 46, y: 41, fallStep: 1, drift: 0 },
    ],
  }));
  assert.deepEqual(wreckage(), [[20, 40], [46, 41]], 'both pieces are drawn');

  // A crack throws off wreckage the same way, and a model that sends no motion
  // still gets some -- it just falls straight down.
  view.render(activeState({ meteors: [], effects: [{ type: 'meteor-split', x: 60, y: 30 }] }));
  assert.ok(wreckage().some(([x, y]) => x === 60 && y === 30));
});

test('every missed meteor plays the surface impact then leaves a crater on the field', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const craters = craterLayerIn(scene);
  assert.deepEqual(craters.children, []);
  assert.deepEqual(visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorImpact), []);

  view.render(activeState({
    meteors: [],
    effects: [{ type: 'meteor-missed', index: 1, x: 61, y: 133 }],
  }));

  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorImpact).map(({ x, y }) => [x, y]),
    [[61, 133]],
    'the impact frame sits where the effect says the meteor landed',
  );
  assert.deepEqual(craters.children, [], 'the crater is the frame after the impact');

  view.render(activeState({ meteors: [] }));

  assert.deepEqual(visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorImpact), []);
  assert.equal(craters.children.length, 1);
  assert.equal(craters.children[0].texture, harness.textures[SPRITE_KEYS.groundExplosion]);
  assert.deepEqual([craters.children[0].x, craters.children[0].y], [59, 133],
    'the 14px burst is centred on the 10px point of impact');

  view.render(activeState({ meteors: [] }));
  view.render(activeState({ meteors: [] }));

  assert.equal(craters.children.length, 1, 'one crater per miss, and it is not redrawn');
  assert.equal(craters.children[0].visible, true, 'craters stay up for the rest of the storm');

  // Two halves of a split can land on the same step: two impacts, two craters.
  view.render(activeState({
    meteors: [],
    effects: [
      { type: 'meteor-missed', index: 2, x: 20, y: 133 },
      { type: 'meteor-missed', index: 2, x: 110, y: 133 },
    ],
  }));
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorImpact).map(({ x }) => x),
    [20, 110],
    'the impact pool grows for a pair landing together',
  );

  view.render(activeState({ meteors: [] }));

  assert.deepEqual(craters.children.map(({ x }) => x), [59, 18, 108]);
  assert.deepEqual(craters.children.map(({ visible }) => visible), [true, true, true]);
});

test('everything that moves in the play field is clipped to the inside of the frame', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());

  const scene = harness.app.stage.children[0];
  const mask = scene.children.find((child) => child instanceof FakeGraphics
    && child.commands.some((command) => command[0] === 'drawRect'
      && command.slice(1).join() === '5,5,150,150'));
  assert.ok(mask, 'the mask covers the inside of the double border');
  assert.equal(meteorLayerIn(scene).mask, mask, 'every falling bitmap is clipped by its layer');
  assert.equal(craterLayerIn(scene).mask, mask, 'craters are clipped too');
  // The header and the tank are deliberately unclipped: they never leave the frame.
  assert.equal(spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed).mask, undefined);
});

test('a wrecked platform swaps the tank for the burst and takes over the caption', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const caption = captionIn(scene);
  const tank = spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed);
  const wreck = scene.children.find((child) => child instanceof FakeSprite
    && child.texture === harness.textures[SPRITE_KEYS.groundExplosion]);
  assert.ok(wreck, 'the wreck reuses SRCBMP-022');
  assert.deepEqual([tank.visible, wreck.visible], [true, false]);

  view.render(activeState({ laserDisabled: true, cooldown: 30, warnings: ['low-power'] }));

  assert.deepEqual([tank.visible, wreck.visible], [false, true], 'the tank is replaced by the burst');
  assert.deepEqual([wreck.x, wreck.y], [72, 143], 'the burst sits on the tank footprint');
  assert.equal(caption.text, 'REPAIRING TANK', 'the repair outranks the power warnings');

  view.render(activeState({ laserDisabled: true, cooldown: 30, warnings: ['power-drained'] }));
  assert.equal(caption.text, 'REPAIRING TANK', 'and outranks a drained warning too');

  view.render(activeState({ laserDisabled: false, cooldown: 0 }));

  assert.deepEqual([tank.visible, wreck.visible], [true, false], 'repaired, the tank comes back');
  assert.equal(caption.text, '"Target Incoming Meteors! "');

  // A storm can end with the platform still wrecked; the closing beat is quiet.
  view.render(activeState({ phase: 'complete', laserDisabled: true, cooldown: 30 }));
  assert.equal(caption.visible, false, 'completion clears the caption even mid-repair');
});

test('the repaired platform announces itself and the caption then stands down', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({
    ...harness,
    fonts: {},
    restoredHoldInterval: 1200,
    completionHoldInterval: 0,
  });

  view.open(activeState({ laserDisabled: true, cooldown: 30 }));
  const scene = harness.app.stage.children[0];
  const caption = captionIn(scene);
  assert.equal(caption.text, 'REPAIRING TANK');

  const repaired = { type: 'tank-repaired' };
  view.render(activeState({ laserDisabled: false, cooldown: 0, effects: [repaired] }));
  assert.equal(caption.text, '"Laser Platform Restored! "');

  // The model announces it on one step; the view is what keeps it readable.
  view.render(activeState({ laserDisabled: false, cooldown: 0 }));
  assert.equal(caption.text, '"Laser Platform Restored! "', 'it outlives the effect');

  harness.app.ticker.tick(1100);
  view.render(activeState({ laserDisabled: false, cooldown: 0 }));
  assert.equal(caption.text, '"Laser Platform Restored! "', 'still inside the hold');

  harness.app.ticker.tick(200);
  view.render(activeState({ laserDisabled: false, cooldown: 0 }));
  assert.equal(caption.text, '"Target Incoming Meteors! "', 'then it stands down');
});

test('a re-rendered repair effect cannot keep the restored caption up forever', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {}, restoredHoldInterval: 300 });

  const held = activeState({ effects: [{ type: 'tank-repaired' }] });
  view.open(held);
  const caption = captionIn(harness.app.stage.children[0]);
  assert.equal(caption.text, '"Laser Platform Restored! "');

  for (let frame = 0; frame < 30; frame += 1) {
    harness.app.ticker.tick(16);
    view.render(held);
  }

  assert.equal(caption.text, '"Target Incoming Meteors! "', 'the same effect cannot re-arm it');
});

test('a wrecked platform outranks the restored caption if it is hit again', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {}, restoredHoldInterval: 5000 });

  view.open(activeState({ effects: [{ type: 'tank-repaired' }] }));
  const caption = captionIn(harness.app.stage.children[0]);
  assert.equal(caption.text, '"Laser Platform Restored! "');

  view.render(activeState({ laserDisabled: true, cooldown: 30 }));
  assert.equal(caption.text, 'REPAIRING TANK', 'a fresh wreck wins the slot back');
});

test('the armed laser platform is the source bitmap sprite at the source anchor', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());

  const scene = harness.app.stage.children[0];
  const platform = spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed);
  assert.ok(platform, 'the armed platform uses SRCBMP-017 from the loaded atlas');
  assert.equal(platform.visible, true, 'the platform is armed once the scene is active');
  assert.deepEqual([platform.x, platform.y], [72, 140],
    'the armed tank shares its bottom edge with the settled slide bitmap');
  assert.equal(
    scene.children.filter((child) => child instanceof FakeGraphics
      && child.commands.some((command) => command[0] === 'drawRect'
        && command.slice(1).join() === '70,137,20,5')).length,
    0,
    'no primitive platform remains',
  );

  view.render(activeState({ phase: 'deploying' }));
  assert.equal(platform.visible, false, 'the platform is not armed before the storm deploys');
});

test('the colony skyline is drawn from the shared Splash() bitmaps behind the scene', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());

  const scene = harness.app.stage.children[0];
  // Source Splash(): bitmap(5,130), bitmap(50,130), bitmap(100,130).
  const expected = [
    [SPRITE_KEYS.skylineLeft, 5, 128],
    [SPRITE_KEYS.skylineMiddle, 50, 128],
    [SPRITE_KEYS.skylineRight, 100, 128],
  ];
  for (const [key, x, y] of expected) {
    const sprite = spriteFor(scene, harness.textures, key);
    assert.ok(sprite, `${key} is added to the scene`);
    assert.equal(sprite.visible, true);
    assert.deepEqual([sprite.x, sprite.y], [x, y]);
  }

  const skylineIndex = scene.children.indexOf(
    spriteFor(scene, harness.textures, SPRITE_KEYS.skylineLeft),
  );
  const meteorIndex = scene.children.indexOf(meteorLayerIn(scene));
  assert.ok(skylineIndex < meteorIndex, 'the skyline sits behind the play field');
});

test('scene captions carry the original quotation marks', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState({ phase: 'deploying' }));

  const scene = harness.app.stage.children[0];
  const caption = captionIn(scene);
  assert.equal(caption.text, '"Warning: Meteor Storm! "');

  view.render(activeState({ phase: 'active' }));
  assert.equal(caption.text, '"Target Incoming Meteors! "');
});

test('the laser platform slides in on the source schedule before the storm activates', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  // Source lines 237-246: for (d = 10; d < 72; d++) { bitmap(d, 147, ...); sleep(100); }
  // then bitmap(d, 145, ...) once the loop leaves d at 72.
  view.open(activeState({ phase: 'deploying' }));

  const scene = harness.app.stage.children[0];
  const slide = spriteFor(scene, harness.textures, SPRITE_KEYS.platformSlide);
  const armed = spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed);
  const caption = captionIn(scene);

  assert.ok(slide, 'the slide-in uses SRCBMP-016');
  assert.deepEqual([slide.visible, armed.visible], [true, false]);
  assert.deepEqual([slide.x, slide.y], [10, 145], 'the platform starts at x=10');
  assert.equal(caption.text, '"Warning: Meteor Storm! "');

  harness.app.ticker.tick(1000);
  assert.deepEqual([slide.x, slide.y], [20, 145], '100ms per step');
  assert.equal(caption.text, '"Warning: Meteor Storm! "');

  // d == 37 is 27 steps in, so the caption flips at 2700ms.
  harness.app.ticker.tick(1700);
  assert.equal(slide.x, 37);
  assert.equal(caption.text, '"Preparing Laser Platform! "', 'SRCMSG-011 at the halfway point');

  harness.app.ticker.tick(3400);
  assert.deepEqual([slide.x, slide.y], [71, 145], 'the slide stops at x=71');
  assert.equal(armed.visible, false, 'still not armed during the slide');

  // The loop exits with d = 72 and redraws two pixels higher.
  harness.app.ticker.tick(100);
  assert.deepEqual([slide.x, slide.y], [72, 145], 'the settle frame keeps the source row');

  harness.app.ticker.tick(100);
  assert.deepEqual([slide.visible, armed.visible], [false, true], 'armed platform takes over');
  assert.deepEqual([armed.x, armed.y], [72, 140], 'no upward jump when the tank stops');
  assert.equal(caption.text, '"Target Incoming Meteors! "');
});

test('the counters stay hidden until the tank settles, then hold before the first meteor', () => {
  const steps = [];
  const model = {
    activate: (state) => ({ ...state, phase: 'active' }),
    step: (state) => {
      steps.push(state);
      return state;
    },
    fire: (state) => state,
    setInput: (state, input) => ({ ...state, input }),
    clearInput: (state) => ({ ...state, input: { held: false, aim: null } }),
  };
  const harness = makeHarness({ model });
  const view = createMeteorStormView({ ...harness, fonts: {}, armedPauseInterval: 2000 });

  view.open(activeState({ phase: 'deploying', stepDelay: 0 }));
  const scene = harness.app.stage.children[0];
  const labels = scene.children.filter((child) => child instanceof FakeBitmapText);
  const counters = labels.find(({ text }) => text.includes('HIT'));
  const progress = labels.find(({ text }) => text === '2/3');
  assert.deepEqual([counters.visible, progress.visible], [false, false],
    'nothing to score while the platform is still driving in');

  harness.app.ticker.tick(6400);   // the full slide plus the settle frame
  assert.deepEqual([counters.visible, progress.visible], [true, true],
    'the counters arrive with the armed tank');
  assert.equal(steps.length, 0);

  harness.app.ticker.tick(1900);
  assert.equal(steps.length, 0, 'the player gets the beat to read them');

  harness.app.ticker.tick(200);
  assert.ok(steps.length > 0, 'the storm starts once the beat is over');
});

test('the Disaster Alert title carries the source dotted underline', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());

  const scene = harness.app.stage.children[0];
  const title = scene.children.find((child) => child instanceof FakeBitmapText
    && child.text === 'Disaster Alert:');
  // textattr(2,1,1) on source line 234 underlines the title.
  const underline = scene.children.find((child) => child instanceof FakeGraphics
    && child.commands.some(([name]) => name === 'drawRect')
    && child.y === title.y + 11);
  assert.ok(underline, 'an underline rule sits just below the title');
  const dots = underline.commands.filter(([name]) => name === 'drawRect');
  assert.ok(dots.length > 4, 'the rule is dotted, not solid');
  const width = title.width ?? 0;
  assert.equal(underline.x, Math.round(80 - width / 2), 'the rule is centred like the title');
});

test('a spent half plays its impact but leaves no crater', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const craters = craterLayerIn(scene);

  // The rock really did land, so the ground impact plays exactly as a miss does.
  view.render(activeState({
    meteors: [],
    effects: [{ type: 'meteor-spent', index: 1, x: 61, y: 133 }],
  }));
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorImpact).map(({ x, y }) => [x, y]),
    [[61, 133]],
    'the impact is drawn where it landed',
  );

  view.render(activeState({ meteors: [] }));
  view.render(activeState({ meteors: [] }));

  // But the slot was saved, so nothing is left on the field. Craters are the
  // running tally of a storm going badly; one here would be a lie.
  assert.deepEqual(craters.children, [], 'a saved slot does not scar the field');

  // A pair landing together, one spent and one a real miss, leaves exactly one.
  view.render(activeState({
    meteors: [],
    effects: [
      { type: 'meteor-spent', index: 2, x: 20, y: 133 },
      { type: 'meteor-missed', index: 3, x: 110, y: 133 },
    ],
  }));
  assert.deepEqual(
    visiblePooled(scene, harness.textures, SPRITE_KEYS.meteorImpact).map(({ x }) => x),
    [20, 110],
    'both impacts play',
  );
  view.render(activeState({ meteors: [] }));
  assert.deepEqual(craters.children.map(({ x }) => x), [108], 'only the miss scars');
});

test('the recharge meter is captioned, clear of the bar and of the row beside it', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const label = scene.children.find(
    (child) => child.texture === harness.textures[SPRITE_KEYS.rechargeLabel],
  );

  assert.ok(label, 'the caption uses recharge-label.gif from the loaded atlas');
  assert.equal(label.visible, true, 'it is up whenever the meter is');
  assert.deepEqual([label.x, label.y], [120, 142]);

  // The bar itself is source geometry and must not have moved to make room:
  // source line 300 puts it at x=120, y=147.
  const bar = scene.children.find(
    (child) => child instanceof FakeGraphics && child.x === 120 && child.y === 147,
  );
  assert.ok(bar, 'the bar is still where the source draws it');

  // 31px of label starting at x=120 ends at 150, clear of the progress readout
  // that shares the row at x=96 and of the tank footprint at x=72..87.
  assert.ok(label.x >= 120, 'it does not reach back into the progress readout');
  assert.ok(label.y + 5 <= 147, 'and it does not overlap the bar it captions');
});
