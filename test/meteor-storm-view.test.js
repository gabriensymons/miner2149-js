import assert from 'node:assert/strict';
import test from 'node:test';

import { createMeteorStormView } from '../scripts/meteor-storm-view.js';

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
  meteor: 'SRCBMP-019_storm_frame_line_261.png',
  meteorDestroyed: 'SRCBMP-020_storm_frame_line_287.png',
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
    meteor: { x: 52, y: 78, status: 'inbound' },
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
  assert.deepEqual([counters.x, counters.y], [8, 147], 'counters use the left band');
  assert.deepEqual([progress.x, progress.y], [96, 147], 'progress uses the band after the tank');
  const sprites = scene.children.filter((child) => child instanceof FakeSprite);
  assert.deepEqual(
    sprites.map(({ texture }) => texture.atlasKey),
    [
      SPRITE_KEYS.skylineLeft,
      SPRITE_KEYS.skylineMiddle,
      SPRITE_KEYS.skylineRight,
      SPRITE_KEYS.platformArmed,
      SPRITE_KEYS.meteor,
      SPRITE_KEYS.meteorDestroyed,
      SPRITE_KEYS.meteorImpact,
      SPRITE_KEYS.groundExplosion,
    ],
    'the scene draws the source storm bitmaps from the loaded atlas',
  );
  assert.deepEqual(
    sprites.filter(({ visible }) => visible).map(({ texture, x, y }) => [texture.atlasKey, x, y]),
    [
      [SPRITE_KEYS.skylineLeft, 5, 130],
      [SPRITE_KEYS.skylineMiddle, 50, 130],
      [SPRITE_KEYS.skylineRight, 100, 130],
      [SPRITE_KEYS.platformArmed, 72, 140],
      [SPRITE_KEYS.meteor, 52, 78],
    ],
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
  assert.ok(bar, 'the recharge bar sits at the source anchor');
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

test('render draws the latest laser effect and clears the beam on the next effect-free state', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState({
    effects: [
      { type: 'laser', from: { x: 80, y: 140 }, to: { x: 20, y: 70 } },
      { type: 'meteor-hit', index: 1 },
      { type: 'laser', from: { x: 79, y: 139 }, to: { x: 33, y: 65 } },
    ],
  }));

  const scene = harness.app.stage.children[0];
  const laser = scene.children.find((child) => child instanceof FakeGraphics
    && commandsAfterLastClear(child).some((command) => command.join() === 'moveTo,79,139'));
  assert.deepEqual(commandsAfterLastClear(laser), [
    ['lineStyle', 2, 0x000000],
    ['moveTo', 79, 139],
    ['lineTo', 33, 65],
    ['lineStyle', 1, 0xffffff],
    ['moveTo', 79, 139],
    ['lineTo', 33, 65],
  ]);
  assert.equal(laser.visible, true);
  assert.equal(scene.children.at(-1).interactive, true, 'pointer target remains above the beam');

  view.render(activeState({ effects: [] }));

  assert.equal(laser.visible, false);
  assert.deepEqual(commandsAfterLastClear(laser), []);
});

test('the caption slot shows the storm phase text and yields to model power warnings', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState({ phase: 'deploying' }));

  const scene = harness.app.stage.children[0];
  const caption = scene.children.find((child) => child instanceof FakeBitmapText
    && child.y === 36);
  assert.equal(caption.text, '"Warning: Meteor Storm! "', 'SRCMSG-010 opens the scene');

  const platform = spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed);
  assert.equal(platform.visible, false, 'the platform is not armed during the alert beat');
  assert.equal(
    spriteFor(scene, harness.textures, SPRITE_KEYS.unusedMeteorVariant),
    undefined,
    'the commented-out source bitmap is never added to the scene',
  );

  harness.app.ticker.tick(600);
  assert.equal(caption.text, '"Warning: Meteor Storm! "', 'the alert beat is held, not skipped');

  harness.app.ticker.tick(600);
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
  assert.equal(status.y, 147, 'counters live on the recharge bar row');
  assert.equal(warning.y, 36);
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
  const meteor = spriteFor(scene, harness.textures, SPRITE_KEYS.meteor);
  assert.ok(meteor, 'the in-flight meteor uses SRCBMP-019 from the loaded atlas');
  assert.equal(meteor.visible, true);
  assert.deepEqual([meteor.x, meteor.y], [52, 78]);
  assert.equal(
    scene.children.filter((child) => child instanceof FakeGraphics
      && child.commands.some(([name]) => name === 'drawCircle')).length,
    0,
    'no primitive meteor remains',
  );

  view.render(activeState({ meteor: { x: 20, y: 101, status: 'inbound' } }));
  assert.deepEqual([meteor.x, meteor.y], [20, 101]);

  view.render(activeState({ meteor: null }));
  assert.equal(meteor.visible, false);
});

test('a destroyed meteor shows the hit bitmap for one frame at the meteor position', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const meteor = spriteFor(scene, harness.textures, SPRITE_KEYS.meteor);
  const destroyed = spriteFor(scene, harness.textures, SPRITE_KEYS.meteorDestroyed);
  assert.ok(destroyed, 'the hit effect uses SRCBMP-020 from the loaded atlas');
  assert.equal(destroyed.visible, false);

  view.render(activeState({
    phase: 'impact',
    meteor: { x: 44, y: 96, status: 'destroyed' },
    effects: [{ type: 'meteor-hit', index: 1 }],
  }));

  assert.equal(destroyed.visible, true);
  assert.deepEqual([destroyed.x, destroyed.y], [44, 96]);
  assert.equal(meteor.visible, false, 'the in-flight bitmap yields to the hit bitmap');

  view.render(activeState({ meteor: null }));
  assert.equal(destroyed.visible, false);
});

test('a missed meteor plays the surface impact then the ground explosion bitmap', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());
  const scene = harness.app.stage.children[0];
  const impact = spriteFor(scene, harness.textures, SPRITE_KEYS.meteorImpact);
  const explosion = spriteFor(scene, harness.textures, SPRITE_KEYS.groundExplosion);
  assert.ok(impact && explosion, 'miss frames use SRCBMP-021 and SRCBMP-022');
  assert.deepEqual([impact.visible, explosion.visible], [false, false]);

  view.render(activeState({
    phase: 'impact',
    meteor: { x: 61, y: 133, status: 'missed' },
    effects: [{ type: 'meteor-missed', index: 1 }],
  }));

  assert.deepEqual([impact.visible, explosion.visible], [true, false]);
  assert.deepEqual([impact.x, impact.y], [61, 133], 'impact sits at the meteor anchor');

  view.render(activeState({ meteor: null }));

  assert.deepEqual([impact.visible, explosion.visible], [false, true]);
  assert.deepEqual([explosion.x, explosion.y], [59, 133], 'explosion sits two pixels left');

  view.render(activeState({ meteor: null }));

  assert.deepEqual([impact.visible, explosion.visible], [false, false]);
});

test('the armed laser platform is the source bitmap sprite at the source anchor', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState());

  const scene = harness.app.stage.children[0];
  const platform = spriteFor(scene, harness.textures, SPRITE_KEYS.platformArmed);
  assert.ok(platform, 'the armed platform uses SRCBMP-017 from the loaded atlas');
  assert.equal(platform.visible, true, 'the platform is armed once the scene is active');
  assert.deepEqual([platform.x, platform.y], [72, 140], 'source line 260 anchor');
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
    [SPRITE_KEYS.skylineLeft, 5, 130],
    [SPRITE_KEYS.skylineMiddle, 50, 130],
    [SPRITE_KEYS.skylineRight, 100, 130],
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
  const meteorIndex = scene.children.indexOf(
    spriteFor(scene, harness.textures, SPRITE_KEYS.meteor),
  );
  assert.ok(skylineIndex < meteorIndex, 'the skyline sits behind the play field');
});

test('scene captions carry the original quotation marks', () => {
  const harness = makeHarness();
  const view = createMeteorStormView({ ...harness, fonts: {} });

  view.open(activeState({ phase: 'deploying' }));

  const scene = harness.app.stage.children[0];
  const caption = scene.children.find((child) => child instanceof FakeBitmapText
    && child.y === 36);
  assert.equal(caption.text, '"Warning: Meteor Storm! "');

  view.render(activeState({ phase: 'active' }));
  assert.equal(caption.text, '"Target Incoming Meteors! "');
});
