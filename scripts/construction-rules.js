/**
 * Pure site and construction rules: what a site is, what tapping it decides,
 * and what placing a structure costs and changes.
 *
 * DOM-free and Pixi-free. `resolveSiteTap` returns a decision; `app.js` turns it
 * into messages and dialogs. Nothing here shows anything or writes state.
 *
 * ## Site encoding
 *
 * A map site holds one number. Below 100 it is terrain or a finished building,
 * keyed by `buildingMap`. At or above 100 it is a building under construction,
 * encoded as `days * 100 + building`, so 1208 is a diridium mine with 12 days
 * left. That is why identity is `num % 100` and remaining time is `num / 100`.
 */

import { setSite } from './map-grid.js';

/** Terrain, which every map starts as. Not buildings, despite sharing the keyspace. */
export const CLEAR_AREA = 1;
export const SMOOTH_AREA = 2;
export const ROUGH_AREA = 3;
export const ORE_VEIN = 4;
export const MOTHER_SHIP = 5;

export const BULLDOZER = 7;
export const DIRIDIUM_MINE = 8;

/** A bulldozer already at work. `constructionTimeMap[7]`, spelled out because the tap rules test it. */
export const BULLDOZING = 107;

/** Buildings the colony may only put on the surface, each with its own refusal. */
const SURFACE_ONLY = {
  13: 'Now why would you want to build a landing pad INSIDE an asteroid?',
  14: 'Mining regulations state a power plant can only be built on the surface level 1 due to risk of explosion.',
  15: 'Building that here would contaminate life support with toxic fumes. The workers refuse to build that anywhere other than level 1.',
};

/** Where a new diridium mine opens a shaft. Level 3 is the bottom and opens nothing. */
const LEVEL_BELOW = {
  level1: 'level2',
  level2: 'level3',
};

/** The shaft a mine opens on the level beneath it: a 12-day diridium mine. */
const SHAFT_SITE = 1208;

export function siteNumberAt(x, y) {
  return y * 10 + x + 1;
}

export function siteAt(maps, level, x, y) {
  return maps[level][`row${y}`][x];
}

/** The building a site holds, ignoring how much construction is left. */
export function buildingNameFor(num, buildingNames) {
  return buildingNames[num % 100];
}

export function buildingNameAt(maps, level, x, y, buildingNames) {
  return buildingNameFor(siteAt(maps, level, x, y), buildingNames);
}

/**
 * The number a display name maps to.
 *
 * **Returns a Number.** The version this replaced returned a `for...in` key,
 * which is a string, and the string leaked as far as `placeStructure`, where one
 * check coerced and the one beside it did not. That only ever worked because the
 * single call site that could produce `'8'` never does — see `placeMine` in
 * `resolvePlacement`, which now compares numbers on both sides.
 */
export function buildingNumberFor(name, buildingNames) {
  const found = Object.keys(buildingNames).find(key => buildingNames[key] === name);
  return found === undefined ? undefined : Number(found);
}

/**
 * The status line shown for a site.
 *
 * The mother ship reads as non-functional after day 21 because it leaves: the
 * colony is on its own from then on, and the sprite stays on the map.
 */
export function constructionStatus(num, day) {
  if (num > 100) {
    const numDays = Math.floor(num / 100);
    return `${numDays} day${numDays === 1 ? '' : 's'} until construction complete`;
  }

  if (num === MOTHER_SHIP && day > 21) return 'Non-functional';

  return 'Operational';
}

/**
 * Whether a site touches a finished structure on one of its four edges.
 *
 * "Finished" is the mother ship or anything from 8 up that is not still under
 * construction — so a bulldozer (7) does not qualify and neither does a site
 * encoded above 100. Diagonals do not count.
 */
export function isAdjacentToCompleted(maps, level, x, y) {
  const isCompleted = n => n === MOTHER_SHIP || (n > BULLDOZER && n < 100);

  const neighbours = [
    y - 1 >= 0 && [x, y - 1],
    x + 1 < 10 && [x + 1, y],
    y + 1 < 10 && [x, y + 1],
    x - 1 >= 0 && [x - 1, y],
  ];

  return neighbours.some(at => at && isCompleted(siteAt(maps, level, at[0], at[1])));
}

const none = () => ({ action: 'none' });
const notice = text => ({ action: 'notice', text });
const place = num => ({ action: 'place', num });
const confirm = (text, num) => ({ action: 'confirm', text, num });

/**
 * What tapping a site decides.
 *
 * Returns `{ info, decision }`. When `info` is present it is a message shown
 * *first*, and `decision` is what happens once the player dismisses it — that
 * sequencing is the original's, and it is why this returns a pair rather than a
 * single outcome.
 *
 * `decision.action` is one of:
 *
 * - `none`    — the tap is inert.
 * - `notice`  — show `text`, nothing follows.
 * - `place`   — build `num` here.
 * - `confirm` — ask `text`; build `num` on yes, nothing on no.
 */
export function resolveSiteTap({ maps, level, day, shopBtn }, x, y, buildingNames) {
  const num = siteAt(maps, level, x, y);
  const selected = buildingNumberFor(shopBtn, buildingNames);

  // A bulldozer already bulldozing skips the site-info message it would
  // otherwise get, because the bulldozer's own refusal is the more useful reply.
  if (num >= MOTHER_SHIP && !(num === BULLDOZING && shopBtn === 'Bulldozer')) {
    return {
      info: [
        `•Site Number: ${siteNumberAt(x, y)}`,
        `•Building: ${buildingNameFor(num, buildingNames)}`,
        `•Status: ${constructionStatus(num, day)}`,
      ].join('\n'),
      decision: decide(),
    };
  }

  // The adjacency rule only guards empty terrain; an occupied site has already
  // returned above. On level 1 the mother ship is the seed structure, and below
  // it the shaft a mine opened is.
  if (
    num < MOTHER_SHIP
    && !isAdjacentToCompleted(maps, level, x, y)
    && ((level === 'level1' && num !== MOTHER_SHIP)
      || (level !== 'level1' && num % 100 !== DIRIDIUM_MINE))
  ) {
    return { decision: notice('You can only build next to a completed structure.') };
  }

  return { decision: decide() };

  function decide() {
    if (num === MOTHER_SHIP) return none();

    if (shopBtn === 'Diridium Mine') {
      if (num === CLEAR_AREA || num === SMOOTH_AREA) {
        return notice('A mine can only be placed on an ore vein.');
      }
      if (num === ORE_VEIN) return place(DIRIDIUM_MINE);
      // Rough ground and occupied sites fall through inert, which is what the
      // original's unmatched `else if` chain did.
      return none();
    }

    if (shopBtn === 'Bulldozer') return decideBulldozer();

    if (num === ROUGH_AREA) return none();

    if (num === SMOOTH_AREA || num === ORE_VEIN) {
      return notice([
        `•Site Number: ${siteNumberAt(x, y)}`,
        '•Building: None',
        '•Note: You must bulldoze clear the area before building that.',
      ].join('\n'));
    }

    if (num >= MOTHER_SHIP) return none();

    if (level !== 'level1' && SURFACE_ONLY[selected]) return notice(SURFACE_ONLY[selected]);

    return place(selected);
  }

  function decideBulldozer() {
    switch (num) {
      case CLEAR_AREA:
        return notice('That area is already prepared for a building.');
      case SMOOTH_AREA:
        return place(BULLDOZER);
      case ROUGH_AREA:
        return notice('That terrain is too rocky to bulldoze.');
      case ORE_VEIN:
        return confirm(
          'Bulldozing that area will destroy the ore vein. Do you really want to place a bulldozer there?',
          BULLDOZER,
        );
      case BULLDOZER:
      case BULLDOZING:
        return notice('Now why would you want to bulldoze a bulldozer while its bulldozing?');
      case MOTHER_SHIP:
        return none();
    }

    // Everything else standing, finished or half-built, is fair game.
    if ((num > MOTHER_SHIP && num <= 17) || num > 100) {
      return confirm(
        `Do you want to bulldoze the ${buildingNameFor(num, buildingNames)} on this area?`,
        BULLDOZER,
      );
    }

    return none();
  }
}

/**
 * What building `num` here costs and changes.
 *
 * Returns either `{ outcome: 'unaffordable', text }` or `{ outcome: 'placed' }`
 * carrying the new maps, the new credit balance, the undo record, and the unlock
 * trigger to fire if there is one. The site and the payment are one transaction,
 * and the shaft a mine opens below is composed onto the same maps, so the player
 * sees a single change rather than two.
 */
export function resolvePlacement(
  { maps, level, credits, shopPrice },
  num,
  x, y,
  constructionTimes,
) {
  if (credits < shopPrice) {
    return {
      outcome: 'unaffordable',
      text: `You do not have enough credits to build that. That module costs ${shopPrice} credits to build.`,
    };
  }

  // Both comparisons below were a string/number mismatch waiting to happen; the
  // building number is normalized once, here.
  const placeMine = Number(num) === DIRIDIUM_MINE;
  const undoNum = siteAt(maps, level, x, y);

  let nextMaps = setSite(maps, level, y, x, constructionTimes[num]);

  if (placeMine && LEVEL_BELOW[level]) {
    nextMaps = setSite(nextMaps, LEVEL_BELOW[level], y, x, SHAFT_SITE);
  }

  return {
    outcome: 'placed',
    maps: nextMaps,
    credits: credits - shopPrice,
    unlock: placeMine && level === 'level3' ? 'level-three-mine' : null,
    undo: {
      hasUndo: true,
      undoLevel: level,
      undoNum,
      undoX: x,
      undoY: y,
      undoPrice: Number(shopPrice),
    },
  };
}
