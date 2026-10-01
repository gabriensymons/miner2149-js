import assert from 'node:assert/strict';
import test from 'node:test';

import { createColonyStart } from '../scripts/colony-start.js';
import { probeLaunchCost } from '../scripts/economy-rules.js';
import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit } from '../scripts/gamedata.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The controller against the real scene, built on the fake Pixi, and a real
// session. Everything else it is handed is a fake writing to one log, because
// most of what matters here is order: the draws, the screens, the render and
// the reveal.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

/** Maps unlike the template's, so a test can tell which it is looking at. */
function generated(difficulty) {
  const maps = structuredClone(gameDataInit.maps);
  maps.level1.row0[0] = 100 + difficulty;
  return maps;
}

function build(change = {}, { autoSaveEmpty = true, labels = ['Class 3-Rocky', 'Class 1-Smooth', 'Class 5-Jagged'] } = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const log = [];
  const choices = [];
  view.start.addAsteroidChoice = (choice) => { log.push(`choice ${choice.index}`); choices.push(choice); };

  const session = createGameSession({ initialState: { ...initial, credits: 1000000, probes: 3, ...change } });
  const asked = [];
  const zones = [];
  const reveals = [];
  let difficultyRolls = 0;
  let designationRolls = 0;
  const tapSurface = () => {};
  const buildHoverHitzone = () => {};

  const colonyStart = createColonyStart({
    session,
    view,
    dialogs: { confirm: (parent, text, yes, no) => asked.push({ parent, text, yes, no }) },
    screens: {
      show: (sprite, parent) => log.push(['show', sprite, parent]),
      hide: (sprite, parent) => log.push(['hide', sprite, parent]),
    },
    flow: Object.fromEntries(['openLaunch', 'enterMine', 'leaveGameOver', 'leaveGameOverForStart']
      .map((name) => [name, () => log.push(name)])),
    mapView: { buildHitZones: (args) => { log.push('buildHitZones'); zones.push(args); } },
    map: {
      tapSurface,
      updateMineSurface: (...args) => { log.push('reveal'); reveals.push(args); },
    },
    renderer: { render: () => log.push(['render', session.getState().maps]) },
    saveWorkflow: { resetAutosave: () => log.push('resetAutosave') },
    minerSaves: { autoSave: { empty: autoSaveEmpty } },
    buildHoverHitzone,
    resetColony: () => { log.push('reset'); session.replace(structuredClone(gameDataInit)); },
    rollDifficulty: () => { log.push('roll difficulty'); return labels[difficultyRolls++ % labels.length]; },
    rollDesignation: () => { log.push('roll designation'); return `X${++designationRolls}`; },
    generateMaps: (difficulty) => { log.push(`generate ${difficulty}`); return generated(difficulty); },
  });
  const names = () => log.filter((entry) => typeof entry === 'string');
  return { view, session, colonyStart, log, names, asked, zones, reveals, choices, tapSurface, buildHoverHitzone };
}

// New Mine

test('with no colony in the autosave, New Mine resets, clears the autosave and opens the launch screen, in that order', () => {
  const { session, colonyStart, names, asked } = build({ credits: 5 });
  colonyStart.newMine();

  assert.deepEqual(asked, []);
  assert.deepEqual(names(), ['reset', 'resetAutosave', 'openLaunch']);
  assert.equal(session.getState().credits, gameDataInit.credits);
});

test('over an autosaved colony, New Mine asks first, over the start screen, and does nothing until yes', () => {
  const yes = build({}, { autoSaveEmpty: false });
  yes.colonyStart.newMine();
  assert.equal(yes.asked.length, 1);
  assert.equal(yes.asked[0].parent, yes.view.start.startScreen);
  assert.match(yes.asked[0].text, /will overwrite an active mining colony/);
  assert.deepEqual(yes.names(), []);
  yes.asked[0].yes();
  assert.deepEqual(yes.names(), ['reset', 'resetAutosave', 'openLaunch']);

  const no = build({}, { autoSaveEmpty: false });
  no.colonyStart.newMine();
  no.asked[0].no();
  assert.deepEqual(no.names(), []);
});

test("game over's New Mine leaves game over first, then starts the same way", () => {
  const { colonyStart, names } = build();
  colonyStart.gameOverNewMine();

  assert.deepEqual(names(), ['leaveGameOver', 'reset', 'resetAutosave', 'openLaunch']);
});

test("game over's Quit only leaves for the start screen; the colony is left as it was", () => {
  const { session, colonyStart, names } = build();
  const before = session.getState();
  colonyStart.quit();

  assert.deepEqual(names(), ['leaveGameOverForStart']);
  assert.equal(session.getState(), before);
});

// Probes

test('the probe arrows move the count between one and five, and arm only when they would', () => {
  const { session, colonyStart } = build({ probes: 4 });
  assert.equal(colonyStart.armMoreProbes(), true);
  colonyStart.moreProbes();
  assert.equal(session.getState().probes, 5);
  assert.equal(colonyStart.armMoreProbes(), undefined);
  const atFive = session.getState();
  colonyStart.moreProbes();
  assert.equal(session.getState(), atFive, 'no write at the top bound');

  session.update({ probes: 2 });
  assert.equal(colonyStart.armFewerProbes(), true);
  colonyStart.fewerProbes();
  assert.equal(session.getState().probes, 1);
  assert.equal(colonyStart.armFewerProbes(), undefined);
  let changes = 0;
  session.subscribe(() => { changes += 1; });
  colonyStart.fewerProbes();
  assert.equal(changes, 0, 'no write at the bound');
});

// Launch and the survey

test('launching swaps the launch screen for the asteroid list and charges for the probes', () => {
  const { view, session, colonyStart, log } = build({ probes: 3, credits: 1000000 });
  view.mine.map.surface.addChild({ stale: true });
  colonyStart.launchProbes();

  const { startScreen, launchScreen, startCover, selectAsteroidTitle } = view.start;
  assert.deepEqual(view.mine.map.surface.children, [], 'the last colony\'s surface is cleared');
  assert.deepEqual(log.filter(Array.isArray), [
    ['hide', launchScreen, startScreen],
    ['show', startCover, startScreen],
    ['show', selectAsteroidTitle, undefined],
  ]);
  assert.equal(session.getState().credits, 1000000 - probeLaunchCost(3));
});

test('the survey rolls a class then a designation per probe, every draw before any choice is built', () => {
  const { colonyStart, names, choices } = build({ probes: 3 });
  colonyStart.launchProbes();

  assert.deepEqual(names(), [
    'roll difficulty', 'roll designation', 'roll difficulty', 'roll designation', 'roll difficulty', 'roll designation',
    'choice 0', 'choice 1', 'choice 2',
  ]);
  assert.deepEqual(choices.map(({ index, label, designation }) => [index, label, designation]),
    [[0, 'Class 3-Rocky', 'X1'], [1, 'Class 1-Smooth', 'X2'], [2, 'Class 5-Jagged', 'X3']]);
});

test('the survey sizes itself by the probes counted after the launch, one choice per probe', () => {
  const { colonyStart, choices } = build({ probes: 5 });
  colonyStart.launchProbes();

  assert.equal(choices.length, 5);
});

// Picking an asteroid and entering the mine

test('picking an asteroid sets its class, clears the list, and enters a newly generated colony on level 1', () => {
  const { view, session, colonyStart, log, names, reveals, choices } = build({ probes: 3, level: 'level3' });
  colonyStart.launchProbes();
  log.length = 0;
  choices[2].onPick();

  const { startCover, selectAsteroidTitle } = view.start;
  assert.deepEqual(log.slice(0, 2), [['hide', selectAsteroidTitle, undefined], ['hide', startCover, undefined]]);
  assert.deepEqual([session.getState().asteroid, session.getState().difficulty, session.getState().miningEfficiency],
    ['Class:5', 5, 60]);
  assert.deepEqual(names(), ['enterMine', 'generate 5', 'buildHitZones', 'reveal']);
  assert.deepEqual(session.getState().maps, generated(5));

  const [title, level, maps, clear] = reveals[0];
  assert.deepEqual([title, level, clear], ['Mapping...', 'level1', true]);
  assert.equal(maps, session.getState().maps, 'the reveal draws the maps the colony now has');
});

test('the asteroid list is emptied of its choices when one is picked', () => {
  const { view, colonyStart, choices } = build({ probes: 2 });
  view.start.selectAsteroidTitle.addChild({ choice: true });
  colonyStart.launchProbes();
  choices[0].onPick();

  assert.deepEqual(view.start.selectAsteroidTitle.children, []);
});

test('the screen is rendered from the new state before the reveal starts', () => {
  const { session, colonyStart, log, choices } = build({ probes: 1 });
  colonyStart.launchProbes();
  choices[0].onPick();

  const renderAt = log.findIndex((entry) => Array.isArray(entry) && entry[0] === 'render');
  assert.ok(renderAt >= 0 && renderAt < log.indexOf('reveal'));
  assert.equal(log[renderAt][1], session.getState().maps, 'rendered with the generated maps already in place');
});

test('a loaded colony opens on its saved level, from a copy of its own maps, generating nothing', () => {
  const saved = generated(4);
  const { session, colonyStart, names, reveals } = build({ level: 'level2', maps: saved });
  colonyStart.gotoMineScreen(true);

  assert.deepEqual(names(), ['enterMine', 'buildHitZones', 'reveal']);
  const [, level, maps, clear] = reveals[0];
  assert.deepEqual([level, clear], ['level2', true]);
  assert.deepEqual(maps, saved);
  assert.notEqual(maps, session.getState().maps, 'a copy: the reveal cannot write the colony');
  assert.equal(session.getState().maps, saved);
});

test('entering the mine builds the hit zones once, with the one shared hover sprite, routing taps to the map controller', () => {
  const { view, colonyStart, zones, tapSurface, buildHoverHitzone } = build();
  colonyStart.gotoMineScreen(true);
  colonyStart.gotoMineScreen(true);
  colonyStart.gotoMineScreen(false);

  assert.equal(zones.length, 1);
  assert.deepEqual(zones[0], {
    parent: view.mine.screen, hoverSprite: view.mine.map.tileHover, buildHoverHitzone, onTapSite: tapSurface,
  });
});
