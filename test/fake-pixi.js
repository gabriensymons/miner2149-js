/**
 * A stand-in for the parts of Pixi the view factories touch, for Node tests.
 *
 * Not a test file: `npm test` runs `test/*.test.js` only, so this is imported,
 * never executed on its own.
 *
 * Phase 9 moves scene construction out of `app.js` into factories that take
 * Pixi by injection. This is the one fake they share, grown a piece at a time
 * as each factory needs it, so that each step's tests do not invent their own.
 * It records what was asked for rather than drawing anything: a texture is its
 * atlas frame name, and a loader is the calls made on it.
 */

/** A texture is identified by its frame name. Pixi caches by name, so this does too. */
class FakeTexture {
  constructor(name) {
    this.name = name;
  }
}

/** Anything that can hold children and be placed: sprites, graphics, text. */
class FakeDisplayObject {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.visible = true;
    this.children = [];
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
    this.anchor = { x: 0, y: 0, set: (x, y = x) => { this.anchor.x = x; this.anchor.y = y; } };
  }

  addChild(child) {
    this.children.push(child);
    return child;
  }

  // Pixi's removeChild ignores a child that is not there, and so does this.
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    return child;
  }

  removeChildren() {
    return this.children.splice(0);
  }
}

export class FakeContainer extends FakeDisplayObject {}

export class FakeSprite extends FakeDisplayObject {
  constructor(texture) {
    super();
    this.texture = texture;
  }
}

/** Records every drawing call in order, so a test can read back what was drawn. */
export class FakeGraphics extends FakeDisplayObject {
  constructor() {
    super();
    this.drawn = [];
  }

  beginFill(color) { this.drawn.push(['beginFill', color]); return this; }
  drawRect(x, y, width, height) { this.drawn.push(['drawRect', x, y, width, height]); return this; }
  endFill() { this.drawn.push(['endFill']); return this; }
}

/** Bitmap text is as wide as five pixels a character, which is enough for the renderer's arithmetic. */
export class FakeBitmapText extends FakeDisplayObject {
  constructor(text, style) {
    super();
    this.text = text;
    this.style = style;
    this.tint = style?.tint;
  }

  get width() { return String(this.text).length * 5; }
}

/** An atlas whose every frame exists and is a texture named after itself. */
export function fakeSheet() {
  const textures = new Map();
  return {
    textures: new Proxy({}, {
      get: (_, name) => {
        if (!textures.has(name)) textures.set(name, new FakeTexture(name));
        return textures.get(name);
      },
    }),
  };
}

/**
 * Stands in for `button.js`'s builders, which read a global PIXI. Each call is
 * recorded with its arguments and returns a placeholder the caller can keep,
 * and the button is added to its parent the way the real ones are. A text
 * button's first child is its caption, as the real one's is, because callers
 * keep that to rename the button later.
 */
export function recordingButtons() {
  const calls = [];
  const record = (kind) => (...args) => {
    const button = { kind, args, interactive: true, visible: true, children: kind === 'text' ? [{ text: args[9] }] : [] };
    calls.push(button);
    args[0]?.addChild?.(button);
    return button;
  };
  return {
    calls,
    buildTextButton: record('text'),
    buildSpriteButton: record('sprite'),
    buildHoverHitzone: record('hover'),
  };
}

/** One of Pixi's signals: handlers added now, dispatched later by the test. */
function fakeSignal() {
  const handlers = [];
  return {
    add: (handler) => { handlers.push(handler); },
    dispatch: (...args) => handlers.forEach((handler) => handler(...args)),
  };
}

/**
 * A loader that loads nothing until the test says so. `finish()` completes it:
 * each resource gets whatever `resources` the test supplied, then `onComplete`
 * and the `load()` callback fire, in that order, as Pixi's do.
 */
export class FakeLoader {
  constructor() {
    this.added = [];
    this.baseUrl = '';
    this.loading = false;
    this.resources = {};
    this.onComplete = fakeSignal();
    this.onError = fakeSignal();
    this.callback = null;
  }

  add(name, url) {
    this.added.push(url === undefined ? [name] : [name, url]);
    return this;
  }

  load(callback = null) {
    this.loading = true;
    this.callback = callback;
    return this;
  }

  finish(resources = {}) {
    Object.assign(this.resources, resources);
    this.onComplete.dispatch(this, this.resources);
    this.callback?.(this, this.resources);
  }
}

/**
 * A fresh fake per test. `fonts` lists the bitmap font faces that will count as
 * loaded; `loaders` collects every `new PIXI.Loader()` in the order made.
 */
export function createFakePIXI({ fonts = [] } = {}) {
  const textureCache = new Map();
  const loaders = [];

  const PIXI = {
    Sprite: { from: (texture) => new FakeSprite(texture) },
    Container: FakeContainer,
    Graphics: FakeGraphics,
    BitmapText: FakeBitmapText,
    Texture: {
      from(name) {
        if (!textureCache.has(name)) textureCache.set(name, new FakeTexture(name));
        return textureCache.get(name);
      },
    },
    Loader: class extends FakeLoader {
      constructor() {
        super();
        loaders.push(this);
      }
    },
    BitmapFont: {
      available: Object.fromEntries(fonts.map((face) => [face, { face }])),
    },
  };

  return { PIXI, loaders, textureCache };
}
