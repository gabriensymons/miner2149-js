/**
 * Pure helpers for the three 10×10 asteroid grids.
 *
 * `cloneMaps` was written out, identically, in `disaster-rules.js`,
 * `random-events.js` and `meteor-storm.js`. This is that one function, plus the
 * single-site write the screens need in order to change a map without mutating
 * the colony in place.
 *
 * Dependency-free on purpose. The pure rules modules import it, and they must
 * not pull in map *generation*, which carries randomness with it.
 */

export function cloneMaps(maps) {
  return Object.fromEntries(Object.entries(maps).map(([level, rows]) => [
    level,
    Object.fromEntries(Object.entries(rows).map(([row, cells]) => [row, [...cells]])),
  ]));
}

/**
 * Returns new maps with one site changed, leaving the original untouched.
 *
 * Returning rather than mutating is what lets a caller build several changes up
 * and commit them as one — a diridium mine writes its own site and the shaft on
 * the level below, and the player should see one change, not two.
 *
 * It clones all three levels for a single cell, which is 300 array copies and
 * costs nothing at this size. The rules modules already work this way.
 */
export function setSite(maps, level, row, column, value) {
  const next = cloneMaps(maps);
  const sites = next[level]?.[`row${row}`];

  // A bad level or row would otherwise write into `undefined` and surface much
  // later as a map that is quietly missing a change.
  if (!Array.isArray(sites)) {
    throw new Error(`no site at ${level} row${row}`);
  }
  if (column < 0 || column >= sites.length) {
    throw new Error(`column ${column} is outside ${level} row${row}`);
  }

  sites[column] = value;
  return next;
}
