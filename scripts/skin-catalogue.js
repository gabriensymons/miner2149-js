/**
 * The PDA frames the game canvas can be mounted inside, as data.
 *
 * Before this module the ten frame names were hard-coded in seven places -- a
 * Set in site-controls.js, the <option> list in index.html, six CSS blocks, the
 * static-build allowlist, two unit tests, and a browser test. Replacing the art
 * broke three of them. Everything about a frame now lives in one entry here.
 *
 * Pure data and arithmetic: no DOM, no storage, no imports. Both entry points
 * (scripts/app.js and scripts/site-controls.js) import it, which is what lets
 * them agree on skin ids and on the unlock event name without importing each
 * other.
 */

/**
 * Dispatched on `document` when a frame is unlocked. app.js detects the
 * triggers; site-controls.js renders the picker. Neither imports the other, so
 * this constant -- imported by both from here -- is the whole contract between
 * them and cannot drift.
 */
export const SKIN_UNLOCK_EVENT = 'miner2149:skin-unlocked';

/**
 * Screen geometry is stored as the raw pixel measurements taken from the source
 * PNG, not as pre-computed CSS percentages. The measurements are what someone
 * can re-derive (`node tools/measure-skin-cutouts.js`); the percentages are
 * arithmetic, and arithmetic transcribed by hand is arithmetic that drifts.
 *
 * `screenWidth`/`screenHeight` are the transparent cutout the 160x160 canvas is
 * positioned inside.
 */
const ENTRIES = [
  {
    id: 'astrodyne',
    label: 'AstroDyne',
    file: 'AstroDyne.png',
    imageWidth: 1024,
    imageHeight: 1536,
    screenX: 204,
    screenY: 158,
    screenWidth: 618,
    screenHeight: 618,
    unlock: null,
    lore: 'Standard issue to every Belt survey crew since the second expansion. '
      + 'It cannot be reasoned with, it cannot be reconfigured, and it absolutely '
      + 'will not stop logging. Nobody loves an AstroDyne, and nobody has ever '
      + 'had one fail.',
  },
  {
    id: 'tc-ii',
    label: 'TC-II',
    file: 'TC-II.png',
    imageWidth: 877,
    imageHeight: 1401,
    screenX: 163,
    screenY: 250,
    screenWidth: 541,
    screenHeight: 541,
    unlock: null,
    lore: 'Terran Colonial mark two, still in service four decades after the '
      + 'mark three was cancelled. The casing is rated for vacuum, impact, and '
      + 'being sat on by a Terran.',
  },
  {
    id: 'trekstat',
    label: 'TrekStat',
    file: 'TrekStat.png',
    imageWidth: 1024,
    imageHeight: 1536,
    screenX: 194,
    screenY: 282,
    screenWidth: 637,
    screenHeight: 637,
    unlock: null,
    lore: 'Built for long-haul navigators of the final frontier, with a screen sized for star charts '
      + 'rather than ledgers. Miners took to it for exactly that reason.',
  },
  {
    id: 'enkom',
    label: 'EnKom',
    file: 'EnKom.png',
    imageWidth: 973,
    imageHeight: 1309,
    screenX: 190,
    screenY: 241,
    screenWidth: 609,
    screenHeight: 609,
    unlock: null,
    lore: 'An Enterprise Communications handset, issued to colony administrators '
      + 'who were expected to stay reachable. The antenna is not decorative. '
      + 'Every message it sends closes the same way, whether you type it or not: '
      + 'END OF LINE.',
  },
  {
    id: 'precursor',
    label: 'Precursor',
    file: 'Precursor.png',
    imageWidth: 1024,
    imageHeight: 1536,
    screenX: 206,
    screenY: 257,
    screenWidth: 613,
    screenHeight: 613,
    unlock: 'alien-artifact',
    lore: 'Reverse-engineered from a housing recovered in the outer belt, by '
      + 'people who never did work out what the original was for, or what the '
      + 'recess on its underside accepts. It keeps perfect time. It runs '
      + 'slightly warm. It was already counting when they found it.',
  },
  {
    id: 'coretech',
    label: 'CoreTech',
    file: 'CoreTech.png',
    imageWidth: 984,
    imageHeight: 1309,
    screenX: 208,
    screenY: 164,
    screenWidth: 569,
    screenHeight: 569,
    unlock: 'level-three-mine',
    lore: 'Rated for the third level and below, where the rock reads back hotter '
      + 'than the surveys promise. Deep crews consider a borrowed CoreTech a '
      + 'reason to file a grievance.',
  },
  {
    id: 'megatech',
    label: 'MegaTech',
    file: 'MegaTech.png',
    imageWidth: 1062,
    imageHeight: 1329,
    screenX: 258,
    screenY: 268,
    screenWidth: 545,
    screenHeight: 545,
    unlock: 'lifetime-earnings',
    lore: 'Sold to operators who have cleared their first million and intend '
      + 'everyone to know it. The trim is not structural -- it is there so the '
      + 'shift sees it coming down the corridor. Fear of this device keeps the '
      + 'rosters in line.',
  },
  {
    id: 'giga1-21',
    label: 'Giga1-21',
    file: 'Giga1-21.png',
    imageWidth: 1024,
    imageHeight: 1536,
    screenX: 276,
    screenY: 357,
    screenWidth: 476,
    screenHeight: 476,
    unlock: 'time-shift',
    lore: 'A chronometry unit carried by crews working near the storm belts, '
      + 'where the clocks disagree. Discharges at exactly 1.21 gigawatts, which '
      + 'its designers maintain is a coincidence. It logs the discrepancy '
      + 'without comment, and once or twice has logged it beforehand.',
  },
  {
    id: 'dsef-102',
    label: 'DSEF-102',
    file: 'DSEF-102.png',
    imageWidth: 1145,
    imageHeight: 1374,
    screenX: 264,
    screenY: 208,
    screenWidth: 618,
    screenHeight: 618,
    unlock: 'meteor-storm',
    // The casing is stencilled with the garrison's name in Japanese. Rendered
    // markup should wrap that run in `lang="ja"` so a screen reader switches
    // voice; the Field Kit renderer is responsible for that, not this string.
    lore: 'Deep Space Emergency Fieldset. Issued to the \u30df\u30fc\u30c6\u30a3\u30a2\u30fb'
      + '\u30b9\u30c8\u30fc\u30e0\u8b66\u5099\u968a, the Meteor Storm Garrison, who guard '
      + 'the platforms, the ore, and the people working under both. Stowed by the '
      + 'laser controls, signed out by number, back on the same hook at end of '
      + 'shift. Most come back unscratched. Most.',
  },
  {
    id: 'diridium',
    label: 'Diridium',
    file: 'Diridium.png',
    imageWidth: 806,
    imageHeight: 1188,
    screenX: 172,
    screenY: 139,
    screenWidth: 461,
    screenHeight: 461,
    unlock: 'konami',
    lore: 'The casing is milled from ore that should not hold a shape. It does '
      + 'not appear on any manifest, the Mother Ship has never been asked about '
      + 'it, and the handling card carries two instructions and no explanation: '
      + 'not against skin, not for long.',
  },
];

export const SKIN_CATALOGUE = Object.freeze(
  ENTRIES.map((entry, index) => Object.freeze({ ...entry, slot: index + 1 })),
);

/** Frames a player has before earning anything. */
export const DEFAULT_SKIN_IDS = Object.freeze(
  SKIN_CATALOGUE.filter(({ unlock }) => unlock === null).map(({ id }) => id),
);

/** Every unlock trigger name in use, so a typo at a trigger site is catchable. */
export const UNLOCK_TRIGGERS = Object.freeze(
  SKIN_CATALOGUE.filter(({ unlock }) => unlock !== null).map(({ unlock }) => unlock),
);

export function skinIds() {
  return SKIN_CATALOGUE.map(({ id }) => id);
}

export function skinById(id) {
  return SKIN_CATALOGUE.find((skin) => skin.id === id) ?? null;
}

/** The skin a trigger awards, or null when the trigger is unknown. */
export function skinForTrigger(trigger) {
  return SKIN_CATALOGUE.find((skin) => skin.unlock === trigger) ?? null;
}

/**
 * The properties `skinCssVariables` sets, so a caller can clear the previous
 * frame's geometry before applying the next one's.
 */
export const SKIN_CSS_PROPERTY_NAMES = Object.freeze([
  '--skin-factor',
  '--skin-aspect',
  '--screen-left',
  '--screen-top',
  '--screen-width',
  '--skin-image',
]);

function percentage(value, total) {
  return `${Number(((value / total) * 100).toFixed(3))}%`;
}

/**
 * The five custom properties `styles/style.css` reads off `.palm-frame`.
 *
 * `--skin-factor` is the reciprocal of the screen's share of the frame width:
 * the frame is sized `game-size * skin-factor` so that the cutout comes out
 * exactly `game-size` across. The canvas is square and positioned by width
 * alone, so `screenHeight` deliberately does not appear here.
 */
export function skinCssVariables(skin) {
  return {
    '--skin-factor': String(Number((skin.imageWidth / skin.screenWidth).toFixed(6))),
    '--skin-aspect': `${skin.imageWidth} / ${skin.imageHeight}`,
    '--screen-left': percentage(skin.screenX, skin.imageWidth),
    '--screen-top': percentage(skin.screenY, skin.imageHeight),
    '--screen-width': percentage(skin.screenWidth, skin.imageWidth),
    '--skin-image': `url("/assets/skins/${skin.file}")`,
  };
}
