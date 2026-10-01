import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appPath = fileURLToPath(new URL('../scripts/app.js', import.meta.url));

function compact(source) {
  return source.replace(/\s+/g, '');
}

// Every control that used to be pinned here now lives in a view or a controller
// and is tested there: the shop, Undo and the options rows in their views, the
// map's hit zones in colony-start.js ("entering the mine builds the hit zones
// once ..."), and the end-of-day autosave in turn-controller.js ("every turn
// autosaves after the reports, with no progress window"). What is left here is
// what must stay absent from app.js.

test('app.js keeps none of the retired turn code, no autosave toggle and no Page Down key', async () => {
  const source = await readFile(appPath, 'utf8');

  // Moved from app-turn-wiring when the turn left app.js in phase 9b step 8.
  assert.doesNotMatch(source, /function (?:checkRandomEvent|updateMapProgress|advance|updateCoreStats)\(/);
  assert.doesNotMatch(source, /autosaveEnabled/);
  assert.doesNotMatch(source, /PageDown|Page Down|code === ['"]PageDown['"]/);
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

// Whether the map is built beneath the mine screen's chrome and shop used to be
// checked here as the order of three calls in init(). game-view.js owns that
// order now, and game-view.test.js checks it on the built scene.
