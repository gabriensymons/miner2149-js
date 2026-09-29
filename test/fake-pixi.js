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
