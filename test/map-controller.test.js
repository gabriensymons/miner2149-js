import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { buildingMap, constructionTimeMap, gameDataInit } from '../scripts/gamedata.js';
import { createMapController } from '../scripts/map-controller.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The controller against the real scene, built on the fake Pixi, a real session
// and the real construction rules. The map view and the dialogs are fakes that
// record, and the reveal lands only when a test says so.

const CLEAR = 1;
const SMOOTH = 2;
const ORE_VEIN = 4;
const MOTHER_SHIP = 5;
const BULLDOZER = 7;
const DIRIDIUM_MINE = 8;
const TUBE = 10;

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

/** A level filled with `fill`, with `[x, y, site]` placed on it. */
function level(fill, sites = []) {
  const rows = {};
  for (let y = 0; y < 10; y++) rows[`row${y}`] = Array(10).fill(fill);
  for (const [x, y, site] of sites) rows[`row${y}`][x] = site;
  return rows;
}

// Each level distinct by default, so a test cannot pass by reading the wrong one.
function maps({
  level1 = level(SMOOTH), level2 = level(SMOOTH, [[9, 9, ORE_VEIN]]), level3 = level(SMOOTH, [[0, 9, ORE_VEIN]]),
} = {}) {
  return { level1, level2, level3 };
}

function fakeDialogs() {
  const shown = [];
  return {
    shown,
    message: (parent, text, onClose) => { shown.push({ kind: 'message', parent, text, onClose }); },
    notice: (text) => { shown.push({ kind: 'notice', text }); },
    confirm: (parent, text, yes, no) => { shown.push({ kind: 'confirm', parent, text, yes, no }); },
  };
}

function fakeMapView() {
  const drawn = [];
  const reveals = [];
  return {
    drawn,
    reveals,
    draw: (map) => { drawn.push(map); },
    revealLevel: (args, done) => { reveals.push({ ...args, done }); },
  };
}

function build(change = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({
    initialState: { ...initial, maps: maps(), level: 'level1', credits: 100000, day: 30, ...change },
  });
  const dialogs = fakeDialogs();
  const mapView = fakeMapView();
  const lit = [];
  const granted = [];
  const map = createMapController({
    session,
    view,
    mapView,
    buildingNames: buildingMap,
    constructionTimes: constructionTimeMap,
    dialogs,
    updateLevelButtons: (next) => lit.push(next),
    grantSkinForTrigger: (trigger) => granted.push(trigger),
  });
  return { view, session, dialogs, mapView, lit, granted, map };
}

const site = (session, levelName, x, y) => session.getState().maps[levelName][`row${y}`][x];

// Tapping and placing

test('a bulldozer on smooth ground beside the mother ship is placed, paid for, drawn and recorded for undo', () => {
  const { session, map, mapView, dialogs } = build({
    maps: maps({ level1: level(SMOOTH, [[4, 4, MOTHER_SHIP]]) }), shopBtn: 'Bulldozer', shopPrice: 650,
  });
  map.tapSurface(5, 4);

  assert.deepEqual(dialogs.shown, []);
  assert.equal(site(session, 'level1', 5, 4), constructionTimeMap[BULLDOZER]);
  assert.equal(session.getState().credits, 100000 - 650);
  assert.deepEqual(mapView.drawn, [session.getState().maps.level1], 'the level on screen, after the change');

  // Recorded: Undo takes back exactly this placement.
  map.undo();
  assert.equal(site(session, 'level1', 5, 4), SMOOTH);
  assert.equal(session.getState().credits, 100000);
  assert.deepEqual(dialogs.shown, []);
});

test('a building the colony cannot afford is refused with its price, and nothing changes', () => {
  const { view, session, map, mapView, dialogs } = build({
    maps: maps({ level1: level(CLEAR, [[4, 4, MOTHER_SHIP]]) }), shopBtn: 'Tube', shopPrice: 13000, credits: 12999,
  });
  const before = session.getState();
  map.tapSurface(4, 5);

  assert.deepEqual(dialogs.shown.map(({ kind, text }) => [kind, text]),
    [['notice', 'You do not have enough credits to build that. That module costs 13000 credits to build.']]);
  assert.equal(session.getState(), before);
  assert.deepEqual(mapView.drawn, []);

  // Nothing recorded: there is nothing for Undo to take back.
  map.undo();
  assert.equal(session.getState(), before);
  assert.deepEqual(dialogs.shown.at(-1).text, 'There is nothing that can be undone.');
  assert.equal(dialogs.shown.at(-1).parent, view.mine.screen);
});

test('a tap the rules refuse is a notice, and changes nothing', () => {
  const { session, map, dialogs } = build({ maps: maps({ level1: level(CLEAR, [[0, 0, MOTHER_SHIP]]) }), shopBtn: 'Tube' });
  const before = session.getState();
  map.tapSurface(8, 8);

  assert.deepEqual(dialogs.shown.map(({ kind, text }) => [kind, text]),
    [['notice', 'You can only build next to a completed structure.']]);
  assert.equal(session.getState(), before);
});

test('an occupied site reports itself first, over the mine screen, and decides only when that is dismissed', () => {
  const { view, session, map, dialogs, mapView } = build({
    maps: maps({ level1: level(CLEAR, [[4, 4, MOTHER_SHIP], [5, 4, TUBE]]) }), shopBtn: 'Bulldozer', shopPrice: 650,
  });
  map.tapSurface(5, 4);

  assert.equal(dialogs.shown.length, 1);
  const [info] = dialogs.shown;
  assert.equal(info.parent, view.mine.screen);
  assert.match(info.text, /^•Site Number: \d+\n•Building: Tube\n•Status: /);
  assert.equal(site(session, 'level1', 5, 4), TUBE, 'nothing decided yet');

  info.onClose();
  const [, ask] = dialogs.shown;
  assert.deepEqual([ask.kind, ask.parent, ask.text], ['confirm', view.mine.screen, 'Do you want to bulldoze the Tube on this area?']);
  assert.deepEqual(mapView.drawn, []);
});

test('a confirmation builds on yes and does nothing on no', () => {
  const setup = { maps: maps({ level1: level(CLEAR, [[4, 4, MOTHER_SHIP], [5, 4, ORE_VEIN]]) }), shopBtn: 'Bulldozer', shopPrice: 650 };

  const yes = build(setup);
  yes.map.tapSurface(5, 4);
  assert.match(yes.dialogs.shown[0].text, /destroy the ore vein/);
  yes.dialogs.shown[0].yes();
  assert.equal(site(yes.session, 'level1', 5, 4), constructionTimeMap[BULLDOZER]);

  const no = build(setup);
  const before = no.session.getState();
  no.map.tapSurface(5, 4);
  no.dialogs.shown[0].no();
  assert.equal(no.session.getState(), before);
  assert.deepEqual(no.mapView.drawn, []);
});

test('a mine on level 3 grants its frame; the same mine on level 2 grants nothing', () => {
  const setup = (levelName) => ({
    level: levelName, shopBtn: 'Diridium Mine', shopPrice: 7000,
    maps: maps({ [levelName]: level(CLEAR, [[4, 4, TUBE], [5, 4, ORE_VEIN]]) }),
  });

  const deep = build(setup('level3'));
  deep.map.tapSurface(5, 4);
  assert.equal(site(deep.session, 'level3', 5, 4), constructionTimeMap[DIRIDIUM_MINE]);
  assert.deepEqual(deep.granted, ['level-three-mine']);
  assert.deepEqual(deep.mapView.drawn, [deep.session.getState().maps.level3], 'the level being built on is redrawn');

  const shallow = build(setup('level2'));
  shallow.map.tapSurface(5, 4);
  assert.equal(site(shallow.session, 'level2', 5, 4), constructionTimeMap[DIRIDIUM_MINE]);
  assert.deepEqual(shallow.granted, []);
});

// Undo

test('undo puts the site back, refunds the price, redraws, and then has nothing left to undo', () => {
  const { view, session, map, mapView, dialogs } = build({
    maps: maps({ level1: level(SMOOTH, [[4, 4, MOTHER_SHIP]]) }), shopBtn: 'Bulldozer', shopPrice: 650,
  });
  map.tapSurface(5, 4);
  map.undo();

  assert.equal(site(session, 'level1', 5, 4), SMOOTH);
  assert.equal(session.getState().credits, 100000);
  assert.deepEqual(mapView.drawn.at(-1), session.getState().maps.level1);
  assert.deepEqual(dialogs.shown, []);

  map.undo();
  assert.deepEqual(dialogs.shown.map(({ parent, text }) => [parent, text]),
    [[view.mine.screen, 'There is nothing that can be undone.']]);
  assert.equal(session.getState().credits, 100000);
});

test('undo restores the level the building was placed on, whichever level is showing', () => {
  // A bulldozer placed on level 3's ore vein, with level 2 showing by the time
  // Undo is pressed.
  const { session, map, dialogs } = build({
    maps: maps({ level3: level(SMOOTH, [[0, 9, ORE_VEIN], [2, 6, MOTHER_SHIP], [2, 7, ORE_VEIN]]) }),
    level: 'level3', shopBtn: 'Bulldozer', shopPrice: 650,
  });
  map.tapSurface(2, 7);
  dialogs.shown.at(-1).yes(); // Bulldozing an ore vein asks first.
  assert.notEqual(site(session, 'level3', 2, 7), ORE_VEIN, 'placed');
  session.update({ level: 'level2' });
  map.undo();

  assert.equal(site(session, 'level3', 2, 7), ORE_VEIN);
  assert.equal(site(session, 'level2', 2, 7), SMOOTH);
  assert.equal(site(session, 'level1', 2, 7), SMOOTH);
});

test('forgetting closes the window: the placement before it is kept and paid for, and one after it can be undone', () => {
  const { session, map, dialogs } = build({
    maps: maps({ level1: level(SMOOTH, [[4, 4, MOTHER_SHIP]]) }), shopBtn: 'Bulldozer', shopPrice: 650,
  });
  map.tapSurface(5, 4);
  map.forgetUndo();
  map.undo();

  assert.equal(site(session, 'level1', 5, 4), constructionTimeMap[BULLDOZER]);
  assert.equal(session.getState().credits, 100000 - 650);
  assert.deepEqual(dialogs.shown.map(({ text }) => text), ['There is nothing that can be undone.']);

  map.tapSurface(3, 4);
  map.undo();
  assert.equal(site(session, 'level1', 3, 4), SMOOTH);
  assert.equal(site(session, 'level1', 5, 4), constructionTimeMap[BULLDOZER], 'the earlier one is still not undone');
  assert.equal(session.getState().credits, 100000 - 650);
});

// Levels and the reveal

test('choosing the level already showing does nothing', () => {
  const { map, mapView, lit } = build({ level: 'level2' });
  map.showLevel('level2');

  assert.deepEqual([mapView.reveals, lit], [[], []]);
});

test('choosing another level lights its button at once and reveals it; the level changes when the reveal lands', () => {
  const { view, session, map, mapView, lit } = build({ level: 'level1' });
  const levels = session.getState().maps;
  map.showLevel('level3');

  assert.deepEqual(lit, ['level3']);
  assert.equal(mapView.reveals.length, 1);
  const [reveal] = mapView.reveals;
  assert.deepEqual([reveal.currentMap, reveal.newMap, reveal.clearMap], [levels.level1, levels.level3, false]);
  assert.equal(view.mine.chrome.topBar.text.text, 'Mapping...');
  assert.equal(session.getState().level, 'level1', 'not until it lands');

  reveal.done();
  assert.equal(session.getState().level, 'level3');
});

test('while the surface is revealing, the screen is locked and the top bar covers the day and credits', () => {
  const { view, map, mapView } = build();
  const { screen, chrome } = view.mine;
  const shown = () => [screen.interactiveChildren, chrome.dayText.visible, chrome.creditText.visible, chrome.topBar.cover.visible];

  map.updateMineSurface('Updating...', 'level1', maps());
  assert.deepEqual(shown(), [false, false, false, true]);
  assert.equal(chrome.topBar.text.text, 'Updating...');

  mapView.reveals[0].done();
  assert.deepEqual(shown(), [true, true, true, false]);
});

test('the reveal runs from a copy of the current level, to the new maps, clearing first only when asked', () => {
  const { session, map, mapView } = build({ level: 'level2' });
  const target = maps({ level3: level(CLEAR, [[1, 1, TUBE]]) });
  map.updateMineSurface('Mapping...', 'level3', target, true);

  const [reveal] = mapView.reveals;
  assert.notDeepEqual(session.getState().maps.level2, session.getState().maps.level3);
  assert.deepEqual(reveal.currentMap, session.getState().maps.level2);
  assert.notEqual(reveal.currentMap, session.getState().maps.level2, 'a copy, so the animation cannot write the colony');
  assert.deepEqual(reveal.newMap, target.level3);
  assert.equal(reveal.clearMap, true);
});

test('the reveal can start from maps the colony has already moved past', () => {
  const { session, map, mapView } = build();
  const previous = maps({ level1: level(ORE_VEIN) });
  map.updateMineSurface('Updating...', 'level1', session.getState().maps, false, undefined, previous);

  assert.deepEqual(mapView.reveals[0].currentMap, previous.level1);
});

test('what to do once the reveal lands runs after the level is written, and only if it is a function', () => {
  const { session, map, mapView } = build();
  const seen = [];
  map.updateMineSurface('Mapping...', 'level2', maps(), false, () => seen.push(session.getState().level));
  map.updateMineSurface('Mapping...', 'level3', maps(), false, 'not a function');

  mapView.reveals[0].done();
  assert.doesNotThrow(() => mapView.reveals[1].done());
  assert.deepEqual(seen, ['level2']);
});

// Counting

test('buildings are counted by exact site value across every level, so one under construction is not', () => {
  const { map } = build({
    maps: maps({
      level1: level(CLEAR, [[0, 0, TUBE], [1, 0, constructionTimeMap[TUBE]]]),
      level2: level(CLEAR),
      level3: level(CLEAR, [[5, 5, TUBE]]),
    }),
  });

  assert.equal(map.countBuildingsByName('Tube'), 2);
  assert.equal(map.countBuildings(TUBE), 2);
  assert.equal(map.countBuildings(ORE_VEIN), 0);
  assert.equal(map.countBuildingsByName('Space Port'), 0);
});

test('counts read the colony as it is now', () => {
  const { session, map } = build({ maps: maps() });
  session.update({ maps: maps({ level2: level(ORE_VEIN), level3: level(SMOOTH) }) });

  assert.equal(map.countBuildings(ORE_VEIN), 100);
});
