import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../scripts/app.js', import.meta.url));

function compact(source) {
  return source.replace(/\s+/g, '');
}

test('the map, storage icon and autosave are wired from app.js', async () => {
  const source = await readFile(appPath, 'utf8');
  const code = compact(source);

  // The shop's items, Undo and their two overlays moved to views/shop-view.js
  // in phase 9, and the options menu's to views/options-view.js; both are
  // pinned in those views' tests.

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
  assert.match(
    code,
    /storageIconContainer=newPIXI\.Container\(\);mineScreen\.addChild\(storageIconContainer\)/,
  );
  assert.doesNotMatch(code, /storageIconContainer=buildHitzone/);

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
