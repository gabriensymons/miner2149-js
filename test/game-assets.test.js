import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FONT_BASE_URL,
  FONTS,
  MENU_BUTTON_NINE_SLICE,
  SPRITESHEET,
  createGameAssets,
  loadGameAssets,
} from '../scripts/game-assets.js';
import { FakeLoader, createFakePIXI } from './fake-pixi.js';

const BOTH_FONTS = ['Palm OS', 'Palm OS Bold'];

/** Starts a load against fakes, and hands back everything a test needs to drive it. */
function startLoad({ fonts = BOTH_FONTS } = {}) {
  const { PIXI, loaders } = createFakePIXI({ fonts });
  const fontLoader = new FakeLoader();
  const loaded = [];
  const errors = [];
  loadGameAssets({
    PIXI,
    fontLoader,
    onLoaded: (atlas) => loaded.push(atlas),
    log: { error: (message) => errors.push(message) },
  });
  const [atlasLoader] = loaders;
  const atlas = { textures: {} };
  return {
    atlasLoader,
    fontLoader,
    loaded,
    errors,
    atlas,
    finishAtlas: () => atlasLoader.finish({ [SPRITESHEET]: { spritesheet: atlas } }),
  };
}

test('the atlas loads first, then the fonts, and only then is the game handed the atlas', () => {
  const { atlasLoader, fontLoader, loaded, errors, atlas, finishAtlas } = startLoad();

  assert.deepEqual(atlasLoader.added, [[SPRITESHEET]]);
  assert.equal(atlasLoader.loading, true);
  assert.equal(fontLoader.loading, false, 'the fonts wait for the atlas');

  finishAtlas();
  assert.equal(fontLoader.baseUrl, FONT_BASE_URL);
  assert.deepEqual(fontLoader.added, [
    ['Palm OS', 'palm-os-bitmap-white.fnt'],
    ['Palm OS Bold', 'palm-os-bold-bitmap-white.fnt'],
  ]);
  assert.deepEqual(loaded, [], 'the game waits for the fonts');

  fontLoader.finish();
  assert.deepEqual(loaded, [atlas]);
  assert.equal(loaded[0], atlas, 'the spritesheet itself, not a copy');
  assert.deepEqual(errors, []);
});

test('an atlas error is logged, and loading carries on', () => {
  const { atlasLoader, fontLoader, loaded, errors, finishAtlas } = startLoad();

  atlasLoader.onError.dispatch({ message: 'spritesheet.png 404' });
  assert.deepEqual(errors, ['ERROR: spritesheet.png 404']);

  finishAtlas();
  fontLoader.finish();
  assert.equal(loaded.length, 1);
});

test('without the bold font the game does not start', () => {
  const { fontLoader, loaded, errors, finishAtlas } = startLoad({ fonts: ['Palm OS'] });
  finishAtlas();
  fontLoader.finish();

  assert.deepEqual(loaded, []);
  assert.deepEqual(errors, ['Required fonts did not load.']);
});

test('the shared textures come from the atlas frames the screens have always used', () => {
  const { PIXI } = createFakePIXI();
  const sheet = { textures: {} };
  const assets = createGameAssets({ PIXI, sheet });

  const names = (states) => Object.fromEntries(
    ['normal', 'hover', 'down'].map((state) => [state, states[state].name]),
  );

  assert.equal(assets.sheet, sheet);
  assert.deepEqual(names(assets.menuButton), {
    normal: 'button-for-menu.gif',
    hover: 'button-for-menu-hover.gif',
    down: 'button-for-menu-inverted.gif',
  });
  assert.deepEqual(names(assets.upArrow), {
    normal: 'up-arrow.gif',
    hover: 'up-arrow-hover.gif',
    down: 'up-arrow-inverted.gif',
  });
  assert.deepEqual(names(assets.downArrow), {
    normal: 'down-arrow.gif',
    hover: 'down-arrow-hover.gif',
    down: 'down-arrow-inverted.gif',
  });
  assert.equal(assets.emptySpace.name, 'empty space.gif');
});

test('the menu button stretches from six-pixel corners', () => {
  const { PIXI } = createFakePIXI();
  assert.deepEqual(MENU_BUTTON_NINE_SLICE, { leftWidth: 6, topHeight: 6, rightWidth: 6, bottomHeight: 6 });
  assert.equal(createGameAssets({ PIXI, sheet: {} }).menuButton.nineSlice, MENU_BUTTON_NINE_SLICE);
});

// The failure mode this module exists to prevent is a shared texture being
// minted again in whichever screen is written next. Only this module names them.
test('no other script mints a shared texture for itself', async () => {
  const shared = [
    'button-for-menu.gif', 'button-for-menu-hover.gif', 'button-for-menu-inverted.gif',
    'up-arrow.gif', 'up-arrow-hover.gif', 'up-arrow-inverted.gif',
    'down-arrow.gif', 'down-arrow-hover.gif', 'down-arrow-inverted.gif',
    'empty space.gif',
  ];
  const scriptsDir = fileURLToPath(new URL('../scripts/', import.meta.url));
  const scripts = (await readdir(scriptsDir, { recursive: true }))
    .filter((file) => file.endsWith('.js') && !file.startsWith('vendor') && file !== 'game-assets.js');

  for (const file of scripts) {
    const source = await readFile(scriptsDir + file, 'utf8');
    for (const frame of shared) {
      assert.ok(!source.includes(`'${frame}'`), `${file} names '${frame}'; take it from game-assets.js`);
    }
  }
});

test('each font is registered under the face its file declares', async () => {
  for (const [face, file] of FONTS) {
    const fnt = await readFile(fileURLToPath(new URL(`../assets/fonts/${file}`, import.meta.url)), 'utf8');
    assert.match(fnt, new RegExp(`face="${face}"`), `${file} declares face "${face}"`);
  }
});
