import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { requireFunctionBody } from './app-source.js';

const appPath = fileURLToPath(new URL('../scripts/app.js', import.meta.url));

function compact(source) {
  return source.replace(/\s+/g, '');
}

test('the map\'s hit zones and the autosave are wired from app.js', async () => {
  const source = await readFile(appPath, 'utf8');
  const code = compact(source);

  // The shop's items, Undo and their two overlays moved to views/shop-view.js
  // in phase 9, the options menu's to views/options-view.js, and the storage
  // icon's container to views/mine-chrome-view.js; each is pinned in its view's
  // tests.

  // Phase 7 moved the grid itself into map-view.js, which builds the hundred
  // zones and is where their geometry is now pinned ("one hit zone covers each
  // cell, a pixel proud of the tile on every side"). What stays this file's
  // business is that app.js hands the view the one shared overlay sprite and
  // routes taps back to the placement rules, rather than minting an overlay per
  // tile -- the same sharing the shop and options views are held to.
  assert.match(
    code,
    /mapView\.buildHitZones\(\{parent:mineScreen,hoverSprite:tileHover,buildHoverHitzone,onTapSite:tapSurface,?\}\)/,
  );

  // Autosave is unconditional now that its toggle is gone from the menu.
  assert.doesNotMatch(code, /autosaveEnabled/);
  assert.match(code, /save\('autoSave',false\);/);
});

test('Grid Lines switches smooth map tiles and redraws the current level', async () => {
  const source = await readFile(appPath, 'utf8');
  const code = compact(source);

  // The gridline texture and the tile overlay are built in map-view.js's
  // createMapSurface() since phase 9, and pinned in map-view.test.js.
  // The tile swap itself moved into map-view.js in phase 7 and is pinned there
  // ("gridlines change the smooth tile, and only that one, and only upright").
  // app.js's remaining half is handing the view a live accessor rather than a
  // captured value, without which the toggle would redraw the same tiles.
  assert.match(code, /gridlinesEnabled:\(\)=>gameData\.gridlinesEnabled/);
  assert.match(
    code,
    // Stage 6 of Plan 13 reduced toggleCheck to the flag: the checkbox sprite is
    // derived by the renderer now. The pairing this pins -- toggling gridlines
    // also redraws the current level -- is unchanged, and still needed, because
    // the renderer deliberately does not draw the map.
    /toggleCheck\('gridlinesEnabled'\);mapView\.draw\(gameData\.maps\[gameData\.level\]\)/,
  );
});

// "save, load, and game-over controls are text buttons" used to match those
// buttons' calls here. Phase 9 moved them into views: the Load Mine and Save
// Mine screens are pinned in save-load-views.test.js, the game-over buttons in
// game-over-view.test.js, and the nine-slice in game-assets.test.js.

// The map, the chrome and the shop are each built onto the mine screen by their
// own view. The chrome and the shop never share a pixel (mine-chrome-view.test.js
// checks it), so their order between themselves decides nothing. The map's
// does: its hit zones are a pixel proud of the tiles, reaching into the top
// bar's bottom row, and it has always been built first -- beneath everything.
test('the map is built onto the mine screen before its chrome and its shop', async () => {
  const init = requireFunctionBody(await readFile(appPath, 'utf8'), 'init');
  const map = init.indexOf('createMapSurface(');
  assert.ok(map >= 0);
  assert.ok(map < init.indexOf('createMineChrome('), 'before the chrome');
  assert.ok(map < init.indexOf('createShopView('), 'before the shop');
});
