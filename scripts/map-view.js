/**
 * The asteroid surface: tile textures, the hit-zone grid, and the row-by-row
 * reveal that plays whenever the map changes underneath the player.
 *
 * Pixi reaches this module through injection rather than an import, the way
 * `meteor-storm-view.js` takes it, so the whole thing runs under Node against a
 * fake renderer. The tile lookup is exported on its own because it is pure and
 * carries the part most worth pinning: which sprite each of forty site encodings
 * draws as.
 *
 * It owns no state. `gridlinesEnabled` arrives as an accessor rather than a
 * value because the original reads it afresh on every tile, and the gridlines
 * toggle redraws the live map without telling this module anything.
 */

import { createRowRevealStates } from './map-animation.js';
import { fillMap } from './maps.js';
import { deepClone } from './utilities.js';

export const TILE_SIZE = 10;
export const GRID_COLUMNS = 10;
export const GRID_ROWS = 10;

/** The surface sits below the top bar, inset two pixels from the left border. */
export const GRID_ORIGIN_X = 2;
export const GRID_ORIGIN_Y = 15;

/** One tile per step of the reveal. Fifteen milliseconds is the port's own pace. */
export const TILE_REVEAL_DELAY_MS = 15;

/**
 * Site encoding to texture name. A negative site is the same tile inverted,
 * which is how the reveal animation paints a row before restoring it.
 *
 * 107 is a bulldozer at work and draws as a bulldozer; anything above that is
 * some other building under construction and draws as a construction site. That
 * is the whole reason this cannot be `num % 100`.
 */
const TILE_NAMES = {
  1: 'clearArea',
  2: 'smoothArea',
  3: 'roughArea',
  4: 'oreVein',
  5: 'motherShip',
  6: 'construction',
  7: 'bulldozer',
  107: 'bulldozer',
  8: 'diridiumMine',
  9: 'hydroponics',
  10: 'tube',
  11: 'lifeSupport',
  12: 'quarters',
  13: 'spacePort',
  14: 'powerPlant',
  15: 'processor',
  16: 'sickbay',
  17: 'storage',
};

/** Above a bulldozer's own encoding, every site is somebody's construction site. */
const CONSTRUCTION_ABOVE = 107;

/**
 * The texture a site draws with, or `undefined` for an encoding no tile covers.
 *
 * `undefined` is the original's behaviour for an unreachable number rather than
 * a guard: its `switch` simply falls out of the bottom. Preserved so a corrupt
 * site renders as nothing instead of as a plausible wrong building.
 */
export function tileTextureFor(num, textures, gridlinesEnabled = false) {
  const inverted = num < 0;
  const magnitude = Math.abs(num);

  let name = TILE_NAMES[magnitude];
  if (name === undefined) {
    if (magnitude <= CONSTRUCTION_ABOVE) return undefined;
    name = 'construction';
  }

  // Gridlines are a variant of the smooth tile only, and only right way up:
  // there is no inverted grid tile, so a row mid-reveal shows the plain one.
  if (name === 'smoothArea' && !inverted && gridlinesEnabled) return textures.smoothAreaGrid;

  return inverted ? textures[`${name}Inverted`] : textures[name];
}

/** Where a grid cell is drawn, in the canvas's own 160x160 coordinates. */
export function tilePosition(col, row) {
  return {
    x: GRID_ORIGIN_X + col * TILE_SIZE,
    y: GRID_ORIGIN_Y + row * TILE_SIZE,
  };
}

export function createMapView({
  PIXI,
  surface,
  textures = {},
  gridlinesEnabled = () => false,
  scheduleReveal = (run, delay) => globalThis.setTimeout(run, delay),
  revealDelay = TILE_REVEAL_DELAY_MS,
}) {
  /**
   * Repaints every tile from `map`.
   *
   * The surface is emptied and rebuilt rather than diffed. At a hundred tiles
   * that is cheap, and the reveal calls this once per tile, so a diff would be
   * the more complicated way to do the same work.
   */
  function draw(map) {
    surface.removeChildren();

    for (let row = 0; row < GRID_ROWS; row++) {
      const cells = map[`row${row}`];

      for (let col = 0; col < GRID_COLUMNS; col++) {
        const texture = tileTextureFor(cells[col], textures, gridlinesEnabled());
        // `PIXI.Sprite.from(...)`, not `new PIXI.Sprite.from(...)`. The version
        // this replaced used `new`, which worked only because `from` returns an
        // object and so `new` hands that object straight back. Checked against
        // the vendored build before dropping it: `from` is
        // `function(t,e){return new r(...)}`, closing over the Sprite class and
        // never reading `this`, so the two forms are the same sprite.
        const tile = PIXI.Sprite.from(texture);
        const { x, y } = tilePosition(col, row);
        tile.position.set(x, y);
        surface.addChild(tile);
      }
    }
  }

  /**
   * Lays one hover hit zone over each cell, reporting taps as grid coordinates.
   *
   * The zone is a pixel larger than the tile on every side, which is what gives
   * the hover overlay its outline; the tile underneath keeps its own bounds.
   */
  function buildHitZones({ parent, hoverSprite, buildHoverHitzone, onTapSite }) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLUMNS; col++) {
        const { x, y } = tilePosition(col, row);

        buildHoverHitzone(
          parent,
          hoverSprite,
          { width: TILE_SIZE + 2, height: TILE_SIZE + 2, x: x - 1, y: y - 1 },
          { width: TILE_SIZE, height: TILE_SIZE, x, y },
          () => onTapSite(col, row),
        );
      }
    }
  }

  /**
   * Plays the row-by-row reveal from `currentMap` to `newMap`, then calls back.
   *
   * Each row is painted fully inverted and then restored a tile at a time, left
   * to right, which is the effect `createRowRevealStates` describes. Rows run in
   * order and the callback fires once, after the tenth.
   *
   * `clearMap` starts from bare terrain instead of the map on screen, which is
   * what a new colony wants: there is nothing to transition away from.
   */
  function revealLevel({ currentMap, newMap, clearMap = false }, onDone) {
    const working = clearMap ? { ...fillMap(1) } : deepClone(currentMap);

    revealRow(0);

    function revealRow(row) {
      if (row >= GRID_ROWS) {
        onDone();
        return;
      }

      const rowKey = `row${row}`;
      const states = createRowRevealStates(newMap[rowKey]);
      let index = 0;

      working[rowKey] = states[index];
      draw(working);

      revealNextTile();

      function revealNextTile() {
        scheduleReveal(() => {
          index += 1;
          working[rowKey] = states[index];
          draw(working);

          if (index < states.length - 1) revealNextTile();
          else revealRow(row + 1);
        }, revealDelay);
      }
    }
  }

  return { draw, buildHitZones, revealLevel };
}
