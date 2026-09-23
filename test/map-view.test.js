import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GRID_COLUMNS,
  GRID_ORIGIN_X,
  GRID_ORIGIN_Y,
  GRID_ROWS,
  TILE_SIZE,
  createMapView,
  tilePosition,
  tileTextureFor,
} from '../scripts/map-view.js';
import { buildingMap } from '../scripts/gamedata.js';

/** Textures are compared by identity, so a distinct string per name is enough. */
const TEXTURE_NAMES = [
  'clearArea', 'smoothArea', 'smoothAreaGrid', 'roughArea', 'oreVein', 'motherShip',
  'construction', 'bulldozer', 'diridiumMine', 'hydroponics', 'tube', 'lifeSupport',
  'quarters', 'spacePort', 'powerPlant', 'processor', 'sickbay', 'storage',
];

const textures = Object.fromEntries(
  TEXTURE_NAMES.flatMap(name => [[name, `tex:${name}`], [`${name}Inverted`, `tex:${name}Inverted`]]),
);

class FakeSprite {
  constructor(texture) {
    this.texture = texture;
    this.x = 0;
    this.y = 0;
    this.position = { set: (x, y) => { this.x = x; this.y = y; } };
  }
}

class FakeSurface {
  constructor() { this.children = []; this.clears = 0; }
  removeChildren() { this.clears += 1; this.children = []; }
  addChild(child) { this.children.push(child); return child; }
}

const FakePIXI = { Sprite: { from: texture => new FakeSprite(texture) } };

/** A level of one terrain, with `sites` painted over it as [col, row, num]. */
function level(fill, sites = []) {
  const rows = {};
  for (let y = 0; y < GRID_ROWS; y++) rows[`row${y}`] = new Array(GRID_COLUMNS).fill(fill);
  for (const [x, y, num] of sites) rows[`row${y}`][x] = num;
  return rows;
}

function view(overrides = {}) {
  const surface = new FakeSurface();
  const scheduled = [];
  const mapView = createMapView({
    PIXI: FakePIXI,
    surface,
    textures,
    scheduleReveal: run => scheduled.push(run),
    ...overrides,
  });
  return { mapView, surface, scheduled, flush: () => { while (scheduled.length) scheduled.shift()(); } };
}

test('every terrain and building draws as its own tile', () => {
  const expected = {
    1: 'clearArea', 2: 'smoothArea', 3: 'roughArea', 4: 'oreVein',
    5: 'motherShip', 6: 'construction', 7: 'bulldozer', 8: 'diridiumMine',
    9: 'hydroponics', 10: 'tube', 11: 'lifeSupport', 12: 'quarters',
    13: 'spacePort', 14: 'powerPlant', 15: 'processor', 16: 'sickbay', 17: 'storage',
  };

  for (const [num, name] of Object.entries(expected)) {
    assert.equal(tileTextureFor(Number(num), textures), `tex:${name}`, `site ${num}`);
  }
});

test('a negative site draws the same tile inverted, which is how the reveal works', () => {
  for (const num of [1, 2, 3, 4, 5, 6, 7, 8, 17, 107]) {
    const upright = tileTextureFor(num, textures);
    const inverted = tileTextureFor(-num, textures);

    assert.equal(inverted, `${upright}Inverted`, `site ${num}`);
  }
});

test('every building the game can place has a tile', () => {
  for (const [num, name] of Object.entries(buildingMap)) {
    if (name === 'None') continue;
    assert.ok(tileTextureFor(Number(num), textures), `${name} (${num}) has no tile`);
  }
});

// 107 is a bulldozer at work, and it draws as a bulldozer. Anything above is
// some other building under construction. `num % 100` would get this wrong.
test('a bulldozer at work is a bulldozer; everything above it is a construction site', () => {
  assert.equal(tileTextureFor(107, textures), 'tex:bulldozer');
  assert.equal(tileTextureFor(-107, textures), 'tex:bulldozerInverted');
  assert.equal(tileTextureFor(108, textures), 'tex:construction');
  assert.equal(tileTextureFor(1208, textures), 'tex:construction');
  assert.equal(tileTextureFor(-1208, textures), 'tex:constructionInverted');
});

test('gridlines change the smooth tile, and only that one, and only upright', () => {
  assert.equal(tileTextureFor(2, textures, true), 'tex:smoothAreaGrid');
  assert.equal(tileTextureFor(2, textures, false), 'tex:smoothArea');

  // There is no inverted grid tile, so a row mid-reveal shows the plain one.
  assert.equal(tileTextureFor(-2, textures, true), 'tex:smoothAreaInverted');
  assert.equal(tileTextureFor(1, textures, true), 'tex:clearArea', 'clear ground is unaffected');
  assert.equal(tileTextureFor(4, textures, true), 'tex:oreVein', 'so is an ore vein');
});

// The original's switch falls out of the bottom for these rather than guarding,
// so a corrupt site renders as nothing instead of a plausible wrong building.
test('an encoding no tile covers draws nothing rather than guessing', () => {
  for (const num of [0, 18, 99, 100, 106, -100, -18]) {
    assert.equal(tileTextureFor(num, textures), undefined, `site ${num}`);
  }
});

test('tiles are laid on a ten-pixel grid below the top bar', () => {
  assert.deepEqual(tilePosition(0, 0), { x: GRID_ORIGIN_X, y: GRID_ORIGIN_Y });
  assert.deepEqual(tilePosition(9, 9), {
    x: GRID_ORIGIN_X + 9 * TILE_SIZE,
    y: GRID_ORIGIN_Y + 9 * TILE_SIZE,
  });
});

test('drawing empties the surface first, then lays one sprite per cell', () => {
  const { mapView, surface } = view();

  mapView.draw(level(1));
  assert.equal(surface.clears, 1);
  assert.equal(surface.children.length, GRID_ROWS * GRID_COLUMNS);

  mapView.draw(level(1));
  assert.equal(surface.clears, 2, 'a redraw clears rather than stacking');
  assert.equal(surface.children.length, GRID_ROWS * GRID_COLUMNS);
});

test('sprites land in reading order at their grid positions', () => {
  const { mapView, surface } = view();

  mapView.draw(level(1, [[3, 2, 8]]));

  const index = 2 * GRID_COLUMNS + 3;
  const tile = surface.children[index];

  assert.equal(tile.texture, 'tex:diridiumMine');
  assert.deepEqual({ x: tile.x, y: tile.y }, tilePosition(3, 2));
});

// The gridlines toggle redraws the live map without telling this module
// anything, so the flag has to be read per tile rather than captured.
test('the gridlines flag is read at draw time, not when the view is built', () => {
  let gridlines = false;
  const { mapView, surface } = view({ gridlinesEnabled: () => gridlines });

  mapView.draw(level(2));
  assert.equal(surface.children[0].texture, 'tex:smoothArea');

  gridlines = true;
  mapView.draw(level(2));
  assert.equal(surface.children[0].texture, 'tex:smoothAreaGrid');
});

test('one hit zone covers each cell, a pixel proud of the tile on every side', () => {
  const { mapView } = view();
  const zones = [];

  mapView.buildHitZones({
    parent: 'mineScreen',
    hoverSprite: 'hover',
    buildHoverHitzone: (parent, sprite, hitzone, button, onTap) =>
      zones.push({ parent, sprite, hitzone, button, onTap }),
    onTapSite: () => {},
  });

  assert.equal(zones.length, GRID_ROWS * GRID_COLUMNS);

  const { hitzone, button } = zones[0];
  assert.deepEqual(button, { width: TILE_SIZE, height: TILE_SIZE, x: GRID_ORIGIN_X, y: GRID_ORIGIN_Y });
  assert.deepEqual(hitzone, {
    width: TILE_SIZE + 2,
    height: TILE_SIZE + 2,
    x: GRID_ORIGIN_X - 1,
    y: GRID_ORIGIN_Y - 1,
  });
});

test('a hit zone reports the cell it covers, as grid coordinates', () => {
  const { mapView } = view();
  const zones = [];
  const taps = [];

  mapView.buildHitZones({
    parent: 'mineScreen',
    hoverSprite: 'hover',
    buildHoverHitzone: (parent, sprite, hitzone, button, onTap) => zones.push(onTap),
    onTapSite: (col, row) => taps.push([col, row]),
  });

  zones[0]();
  zones[GRID_COLUMNS * 2 + 3]();
  zones.at(-1)();

  assert.deepEqual(taps, [[0, 0], [3, 2], [9, 9]]);
});

test('the reveal paints a row inverted before restoring it a tile at a time', () => {
  const { mapView, surface, scheduled } = view();
  const row0 = () => surface.children.slice(0, GRID_COLUMNS).map(tile => tile.texture);

  mapView.revealLevel({ currentMap: level(1), newMap: level(4) }, () => {});

  assert.deepEqual(
    row0(),
    new Array(GRID_COLUMNS).fill('tex:oreVeinInverted'),
    'the row goes down fully inverted first',
  );
  assert.equal(scheduled.length, 1, 'the next tile is queued rather than drawn now');

  scheduled.shift()();
  assert.equal(row0()[0], 'tex:oreVein', 'then the leftmost tile is restored');
  assert.equal(row0()[1], 'tex:oreVeinInverted', 'and only that one');

  scheduled.shift()();
  assert.equal(row0()[1], 'tex:oreVein', 'the reveal runs left to right');
});

test('a row is finished before the next one starts', () => {
  const { mapView, surface, scheduled } = view();
  const textureAt = (col, row) => surface.children[row * GRID_COLUMNS + col].texture;

  mapView.revealLevel({ currentMap: level(1), newMap: level(4) }, () => {});

  // Drain exactly row 0's steps: one per tile.
  for (let i = 0; i < GRID_COLUMNS; i++) scheduled.shift()();

  assert.equal(textureAt(0, 0), 'tex:oreVein', 'row 0 is fully restored');
  assert.equal(textureAt(9, 0), 'tex:oreVein');
  assert.equal(textureAt(0, 1), 'tex:oreVeinInverted', 'and row 1 has only just gone down');
});

test('the reveal walks all ten rows and calls back exactly once', () => {
  const { mapView, scheduled, flush } = view();
  let done = 0;

  mapView.revealLevel({ currentMap: level(1), newMap: level(4) }, () => { done += 1; });

  // Each row queues one step per tile; draining repeatedly runs the whole map.
  for (let guard = 0; guard < 5000 && scheduled.length; guard++) flush();

  assert.equal(done, 1);
});

test('the reveal leaves the surface showing the new map', () => {
  const { mapView, surface, scheduled, flush } = view();

  mapView.revealLevel({ currentMap: level(1), newMap: level(4, [[7, 8, 15]]) }, () => {});
  for (let guard = 0; guard < 5000 && scheduled.length; guard++) flush();

  assert.equal(surface.children.length, GRID_ROWS * GRID_COLUMNS);
  assert.equal(surface.children[0].texture, 'tex:oreVein');
  assert.equal(surface.children[8 * GRID_COLUMNS + 7].texture, 'tex:processor');
});

// A new colony has nothing to transition away from, so it starts from bare
// terrain rather than from whatever the last colony left on screen.
test('a cleared reveal ignores the map currently on screen', () => {
  const { mapView, surface, scheduled } = view();

  mapView.revealLevel(
    { currentMap: level(15), newMap: level(4), clearMap: true },
    () => {},
  );

  // Row 0 is mid-reveal, but rows below it must already be bare terrain rather
  // than the processors the outgoing map was covered in.
  const belowIndex = 5 * GRID_COLUMNS;
  assert.equal(surface.children[belowIndex].texture, 'tex:clearArea');
  void scheduled;
});

test('the reveal does not mutate the map it was handed', () => {
  const currentMap = level(1);
  const newMap = level(4);
  const { mapView, scheduled, flush } = view();

  mapView.revealLevel({ currentMap, newMap }, () => {});
  for (let guard = 0; guard < 5000 && scheduled.length; guard++) flush();

  assert.equal(currentMap.row0[0], 1, 'the outgoing map is untouched');
  assert.equal(newMap.row0[0], 4, 'and so is the incoming one');
});
