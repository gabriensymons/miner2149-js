import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BULLDOZER,
  BULLDOZING,
  CLEAR_AREA,
  DIRIDIUM_MINE,
  MOTHER_SHIP,
  ORE_VEIN,
  ROUGH_AREA,
  SMOOTH_AREA,
  buildingNameFor,
  buildingNumberFor,
  constructionStatus,
  isAdjacentToCompleted,
  resolvePlacement,
  resolveSiteTap,
  siteAt,
  siteNumberAt,
} from '../scripts/construction-rules.js';
import { buildingMap, constructionTimeMap } from '../scripts/gamedata.js';

/** A 10x10 level of one terrain, with `sites` painted over it as [x, y, num]. */
function level(fill, sites = []) {
  const rows = {};
  for (let y = 0; y < 10; y++) rows[`row${y}`] = new Array(10).fill(fill);
  for (const [x, y, num] of sites) rows[`row${y}`][x] = num;
  return rows;
}

function maps({ l1 = level(CLEAR_AREA), l2 = level(CLEAR_AREA), l3 = level(CLEAR_AREA) } = {}) {
  return { level1: l1, level2: l2, level3: l3 };
}

/** A colony whose whole level is buildable, so a tap tests one rule at a time. */
function colony(overrides = {}) {
  return {
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP]]) }),
    level: 'level1',
    day: 1,
    shopBtn: 'Bulldozer',
    credits: 1_000_000,
    shopPrice: 6500,
    ...overrides,
  };
}

const tap = (state, x, y) => resolveSiteTap(state, x, y, buildingMap);

test('a site number counts across rows from one, not from zero', () => {
  assert.equal(siteNumberAt(0, 0), 1);
  assert.equal(siteNumberAt(9, 0), 10);
  assert.equal(siteNumberAt(0, 1), 11);
  assert.equal(siteNumberAt(9, 9), 100);
});

test('a site under construction is still identified by its building', () => {
  // 1208 is a diridium mine with 12 days left: days * 100 + building.
  assert.equal(buildingNameFor(1208, buildingMap), 'Diridium Mine');
  assert.equal(buildingNameFor(DIRIDIUM_MINE, buildingMap), 'Diridium Mine');
});

test('a display name resolves to a number, not to a string key', () => {
  const num = buildingNumberFor('Diridium Mine', buildingMap);

  assert.equal(num, DIRIDIUM_MINE);
  assert.equal(typeof num, 'number', 'a string here is what let the shaft rule miss');
  assert.equal(buildingNumberFor('Nothing At All', buildingMap), undefined);
});

test('construction status counts down in days, and says so in the singular', () => {
  assert.equal(constructionStatus(1208, 1), '12 days until construction complete');
  assert.equal(constructionStatus(107, 1), '1 day until construction complete');
  assert.equal(constructionStatus(DIRIDIUM_MINE, 1), 'Operational');
});

test('the mother ship reads as non-functional only after it leaves on day 21', () => {
  assert.equal(constructionStatus(MOTHER_SHIP, 21), 'Operational');
  assert.equal(constructionStatus(MOTHER_SHIP, 22), 'Non-functional');
});

test('adjacency looks at four edges and ignores diagonals', () => {
  const m = maps({ l1: level(CLEAR_AREA, [[5, 5, DIRIDIUM_MINE]]) });

  assert.equal(isAdjacentToCompleted(m, 'level1', 5, 4), true, 'above');
  assert.equal(isAdjacentToCompleted(m, 'level1', 6, 5), true, 'right');
  assert.equal(isAdjacentToCompleted(m, 'level1', 5, 6), true, 'below');
  assert.equal(isAdjacentToCompleted(m, 'level1', 4, 5), true, 'left');
  assert.equal(isAdjacentToCompleted(m, 'level1', 4, 4), false, 'diagonal does not count');
});

test('an unfinished building is not something you can build next to', () => {
  const building = maps({ l1: level(CLEAR_AREA, [[5, 5, 1208]]) });
  const bulldozer = maps({ l1: level(CLEAR_AREA, [[5, 5, BULLDOZER]]) });
  const finished = maps({ l1: level(CLEAR_AREA, [[5, 5, DIRIDIUM_MINE]]) });

  assert.equal(isAdjacentToCompleted(building, 'level1', 5, 4), false, 'still under construction');
  assert.equal(isAdjacentToCompleted(bulldozer, 'level1', 5, 4), false, 'a bulldozer is not a structure');
  assert.equal(isAdjacentToCompleted(finished, 'level1', 5, 4), true);
});

test('adjacency does not run off the edge of the grid', () => {
  const m = maps({ l1: level(CLEAR_AREA, [[0, 0, DIRIDIUM_MINE]]) });

  assert.equal(isAdjacentToCompleted(m, 'level1', 0, 9), false);
  assert.equal(isAdjacentToCompleted(m, 'level1', 9, 0), false);
  assert.equal(isAdjacentToCompleted(m, 'level1', 1, 0), true);
});

test('building away from every structure is refused', () => {
  const { info, decision } = tap(colony(), 0, 0);

  assert.equal(info, undefined);
  assert.deepEqual(decision, {
    action: 'notice',
    text: 'You can only build next to a completed structure.',
  });
});

// The mother ship seeds level 1. Below the surface the seed is the shaft a
// diridium mine opened, which is why the rule tests `num % 100` down there.
test('below the surface, a mine shaft is what you build out from', () => {
  const state = colony({
    maps: maps({ l2: level(CLEAR_AREA, [[5, 5, 1208]]) }),
    level: 'level2',
  });

  // The shaft site itself is occupied, so tapping it reports the site rather
  // than refusing for adjacency.
  assert.match(tap(state, 5, 5).info, /Diridium Mine/);

  // Its neighbour is not adjacent to anything completed, but the shaft exempts
  // the site it sits on, not the ones beside it.
  assert.equal(tap(state, 5, 4).decision.action, 'notice');
});

test('tapping an occupied site reports it before deciding anything', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, 15]]) }),
    shopBtn: 'Tube',
    day: 30,
  });

  const { info, decision } = tap(state, 5, 4);

  assert.equal(info, '•Site Number: 46\n•Building: Processor\n•Status: Operational');
  assert.deepEqual(decision, { action: 'none' }, 'reporting it is all that happens');
});

test('the mother ship is inert whatever is selected', () => {
  for (const shopBtn of ['Bulldozer', 'Diridium Mine', 'Tube']) {
    const { info, decision } = tap(colony({ shopBtn }), 5, 5);

    assert.match(info, /Mother Ship/, `${shopBtn} still gets the site report`);
    assert.deepEqual(decision, { action: 'none' }, `${shopBtn} cannot touch it`);
  }
});

test('a mine goes on an ore vein and nowhere else', () => {
  const state = colony({
    maps: maps({
      l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, ORE_VEIN], [4, 5, SMOOTH_AREA], [6, 5, ROUGH_AREA]]),
    }),
    shopBtn: 'Diridium Mine',
  });

  assert.deepEqual(tap(state, 5, 4).decision, { action: 'place', num: DIRIDIUM_MINE });
  assert.deepEqual(tap(state, 5, 6).decision, {
    action: 'notice',
    text: 'A mine can only be placed on an ore vein.',
  });
  assert.deepEqual(tap(state, 4, 5).decision, {
    action: 'notice',
    text: 'A mine can only be placed on an ore vein.',
  });
});

// Rough ground falls out of the mine's `else if` chain unmatched, so the tap
// does nothing at all rather than explaining itself. Preserved as found.
test('a mine on rough ground is silently inert, not refused', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [6, 5, ROUGH_AREA]]) }),
    shopBtn: 'Diridium Mine',
  });

  assert.deepEqual(tap(state, 6, 5).decision, { action: 'none' });
});

test('building on unprepared ground tells the player to bulldoze first', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, SMOOTH_AREA]]) }),
    shopBtn: 'Tube',
  });

  assert.deepEqual(tap(state, 5, 4).decision, {
    action: 'notice',
    text: '•Site Number: 46\n•Building: None\n•Note: You must bulldoze clear the area before building that.',
  });
});

test('rough ground refuses everything without a word', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, ROUGH_AREA]]) }),
    shopBtn: 'Tube',
  });

  assert.deepEqual(tap(state, 5, 4).decision, { action: 'none' });
});

test('three buildings are refused below the surface, each in its own words', () => {
  const below = { maps: maps({ l2: level(CLEAR_AREA, [[5, 5, DIRIDIUM_MINE]]) }), level: 'level2' };

  const refusals = {
    'Space Port': /landing pad INSIDE an asteroid/,
    'Power Plant': /risk of explosion/,
    Processor: /contaminate life support/,
  };

  for (const [shopBtn, pattern] of Object.entries(refusals)) {
    const decision = tap(colony({ ...below, shopBtn }), 5, 4).decision;

    assert.equal(decision.action, 'notice', shopBtn);
    assert.match(decision.text, pattern, shopBtn);
  }
});

test('those same three are allowed on the surface', () => {
  for (const shopBtn of ['Space Port', 'Power Plant', 'Processor']) {
    const decision = tap(colony({ shopBtn }), 5, 4).decision;

    assert.equal(decision.action, 'place', shopBtn);
    assert.equal(decision.num, buildingNumberFor(shopBtn, buildingMap), shopBtn);
  }
});

test('the bulldozer refuses ground that is already clear or too rocky', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, ROUGH_AREA]]) }),
  });

  assert.deepEqual(tap(state, 4, 5).decision, {
    action: 'notice',
    text: 'That area is already prepared for a building.',
  });
  assert.deepEqual(tap(state, 5, 4).decision, {
    action: 'notice',
    text: 'That terrain is too rocky to bulldoze.',
  });
});

test('the bulldozer clears smooth ground without asking', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, SMOOTH_AREA]]) }),
  });

  assert.deepEqual(tap(state, 5, 4).decision, { action: 'place', num: BULLDOZER });
});

test('bulldozing an ore vein asks first, because it destroys the vein', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, ORE_VEIN]]) }),
  });

  const { decision } = tap(state, 5, 4);

  assert.equal(decision.action, 'confirm');
  assert.match(decision.text, /destroy the ore vein/);
  assert.equal(decision.num, BULLDOZER);
});

test('bulldozing a building asks for it by name', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, 16]]) }),
  });

  const { info, decision } = tap(state, 5, 4);

  assert.match(info, /Sickbay/, 'the site report comes first');
  assert.deepEqual(decision, {
    action: 'confirm',
    text: 'Do you want to bulldoze the Sickbay on this area?',
    num: BULLDOZER,
  });
});

test('a half-built building can be bulldozed too, and is named by what it will be', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, 1208]]) }),
  });

  const { decision } = tap(state, 5, 4);

  assert.equal(decision.action, 'confirm');
  assert.match(decision.text, /bulldoze the Diridium Mine/);
});

// The one case that skips the site report: the bulldozer's own refusal is the
// more useful reply, so the original short-circuits past the info message.
test('a bulldozer already at work skips the site report and just refuses', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, BULLDOZING]]) }),
  });

  const { info, decision } = tap(state, 5, 4);

  assert.equal(info, undefined, 'no site report');
  assert.match(decision.text, /bulldoze a bulldozer while its bulldozing/);
});

test('a finished bulldozer refuses the same way, but does report the site', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[5, 5, MOTHER_SHIP], [5, 4, BULLDOZER]]) }),
  });

  const { info, decision } = tap(state, 5, 4);

  assert.match(info, /Bulldozer/);
  assert.match(decision.text, /bulldoze a bulldozer while its bulldozing/);
});

test('a placement the colony cannot afford is refused with the price', () => {
  const state = colony({ credits: 100, shopPrice: 6500 });

  assert.deepEqual(resolvePlacement(state, BULLDOZER, 5, 4, constructionTimeMap), {
    outcome: 'unaffordable',
    text: 'You do not have enough credits to build that. That module costs 6500 credits to build.',
  });
});

test('exactly enough credits is enough', () => {
  const state = colony({ credits: 6500, shopPrice: 6500 });

  assert.equal(resolvePlacement(state, BULLDOZER, 5, 4, constructionTimeMap).outcome, 'placed');
});

test('placing a structure writes its construction encoding and takes the payment', () => {
  const state = colony({ credits: 50_000, shopPrice: 6500 });
  const result = resolvePlacement(state, BULLDOZER, 3, 4, constructionTimeMap);

  assert.equal(result.credits, 43_500);
  assert.equal(siteAt(result.maps, 'level1', 3, 4), constructionTimeMap[BULLDOZER]);
  assert.equal(
    siteAt(state.maps, 'level1', 3, 4),
    CLEAR_AREA,
    'the colony it was given is left alone',
  );
});

test('the undo record captures what the site was before the build', () => {
  const state = colony({
    maps: maps({ l1: level(CLEAR_AREA, [[3, 4, ORE_VEIN]]) }),
    shopPrice: 45_500,
  });

  assert.deepEqual(resolvePlacement(state, DIRIDIUM_MINE, 3, 4, constructionTimeMap).undo, {
    hasUndo: true,
    undoLevel: 'level1',
    undoNum: ORE_VEIN,
    undoX: 3,
    undoY: 4,
    undoPrice: 45_500,
  });
});

test('a mine opens a shaft on the level below, in the same change', () => {
  const state = colony({ shopPrice: 45_500 });
  const result = resolvePlacement(state, DIRIDIUM_MINE, 3, 4, constructionTimeMap);

  assert.equal(siteAt(result.maps, 'level1', 3, 4), constructionTimeMap[DIRIDIUM_MINE]);
  assert.equal(siteAt(result.maps, 'level2', 3, 4), 1208, 'the shaft below');
  assert.equal(siteAt(result.maps, 'level3', 3, 4), CLEAR_AREA, 'but not two levels down');
});

test('a mine on the bottom level opens no shaft and earns the frame', () => {
  const state = colony({ level: 'level3', shopPrice: 45_500 });
  const result = resolvePlacement(state, DIRIDIUM_MINE, 3, 4, constructionTimeMap);

  assert.equal(result.unlock, 'level-three-mine');
  assert.equal(siteAt(result.maps, 'level3', 3, 4), constructionTimeMap[DIRIDIUM_MINE]);
});

test('only a level-three mine earns the frame', () => {
  assert.equal(resolvePlacement(colony(), DIRIDIUM_MINE, 3, 4, constructionTimeMap).unlock, null);
  assert.equal(
    resolvePlacement(colony({ level: 'level3' }), BULLDOZER, 3, 4, constructionTimeMap).unlock,
    null,
  );
});

// The building number used to reach here as a string on one path, so one check
// coerced and the neighbouring one did not. Both now compare numbers.
test('a building number given as a string still opens the shaft', () => {
  const state = colony({ shopPrice: 45_500 });
  const result = resolvePlacement(state, String(DIRIDIUM_MINE), 3, 4, constructionTimeMap);

  assert.equal(siteAt(result.maps, 'level2', 3, 4), 1208);
});
