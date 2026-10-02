import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { buildingMap, gameDataInit } from '../scripts/gamedata.js';
import { countCompletedBuildingsByName } from '../scripts/simulation-calculations.js';
import { advanceConstructionProgress, updateDailyCore } from '../scripts/simulation-rules.js';
import { createTurnController } from '../scripts/turn-controller.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The turn against the real scene on the fake Pixi, a real session, and the real
// construction, cadence and daily-core rules. Everything it hands work to is a
// fake writing to one log, so the order of a turn -- which app-turn-wiring used
// to pin as the order of lines in app.js -- is pinned here as the order of calls.
// The reveal and the disaster each hold their callback until the test lets them
// land, as the real ones do.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

/** A colony past the mother-ship days, with a building under construction on level 1. */
const COLONY = {
  day: 30, deathRate: 10, difficulty: 2, asteroid: 'Class:2', diridium: 1000, efficiency: 90,
  food: 85, health: 85, jobs: 75, jobsPrev: 75, lifeSupport: 85, miningEfficiency: 80, morale: 55,
  moralePrev: 55, occupancy: 160, sellPrice: 20, sellPriceAccumulator: 20, wage: 500, workers: 100,
  workersPrev: 100, credits: 1000000, level: 'level1', disasterMode: false, daysOutsideDisasterMode: 9,
  soldToday: true,
};

function colonyMaps() {
  const maps = structuredClone(gameDataInit.maps);
  maps.level1.row1[1] = 212; // a tube with two days to go
  maps.level1.row2[2] = 15; // a finished processor
  return maps;
}

/** An event that changes nothing and says nothing, so the core is all a test sees. */
const QUIET = { state: null, messages: [], effects: [] };

function build(change = {}, { event = null, results = [], draws = [], oreVeins = 3 } = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({ initialState: { ...initial, ...COLONY, maps: colonyMaps(), ...change } });
  const log = [];
  const reveals = [];
  const disasters = [];
  const messages = [];
  const asked = [];
  const selections = [];
  const applications = [];
  const script = [...draws];
  const queuedResults = [...results];

  const turn = createTurnController({
    session,
    view,
    dialogs: {
      enqueue: (text) => log.push(`queued: ${text}`),
      drain: () => log.push('drain'),
      discard: () => log.push('discard'),
      message: (parent, text, onClose) => { log.push('message'); messages.push({ parent, text, onClose }); },
      confirm: (parent, text, yes, no) => { log.push('confirm'); asked.push({ parent, text, yes, no }); },
    },
    map: {
      countBuildings: (site) => { log.push(`count ${site}`); return site === 4 ? oreVeins : 0; },
      updateMineSurface: (...args) => { log.push('reveal'); reveals.push(args); },
      forgetUndo: () => log.push('forgetUndo'),
    },
    renderer: { updateReports: () => log.push('reports') },
    saveWorkflow: { save: (slot, showProgress) => log.push(`save ${slot} ${showProgress}`) },
    disasters: { disaster: (done) => { log.push('disaster'); disasters.push(done); } },
    endings: {
      checkEnding: () => log.push('checkEnding'),
      endGame: (...args) => log.push(['endGame', ...args]),
    },
    grantSkinForTrigger: (trigger) => log.push(`grant ${trigger}`),
    buildingNames: buildingMap,
    selectEvent: (args) => { log.push('selectEvent'); selections.push(args); return event; },
    applyEvent: (state, chosen, options) => {
      log.push(options ? `applyEvent ${options.choice}` : 'applyEvent');
      applications.push({ state, chosen, options });
      const next = queuedResults.length ? queuedResults.shift() : QUIET;
      // A result's state may be a function of the colony the event was applied to.
      const nextState = typeof next.state === 'function' ? next.state(state) : (next.state ?? state);
      return { ...next, state: nextState };
    },
    pocketRandom: (max) => (script.length ? script.shift() : 0),
  });
  const named = () => log.filter((entry) => typeof entry === 'string');
  return { view, session, log, named, reveals, disasters, messages, asked, selections, applications, turn };
}

/** Advances and lets the reveal land, returning the controller's world. */
function advanceAndLand(world, days) {
  world.turn.advance(days);
  world.reveals[0][4]();
  return world;
}

// Advancing

test('advancing commits the new day, the progressed maps and a fresh sale allowance in one update', () => {
  const { session, turn } = build({ daysOutsideDisasterMode: 9 });
  const before = session.getState();
  let updates = 0;
  session.subscribe(() => { updates += 1; });
  turn.advance(7);

  const after = session.getState();
  assert.equal(updates, 1);
  assert.deepEqual([after.day, after.daysOutsideDisasterMode, after.soldToday], [37, 16, false]);
  assert.deepEqual(after.maps, advanceConstructionProgress(before.maps, 7));
});

test('days played in Disaster Mode do not count as days outside it', () => {
  const { session, turn } = build({ disasterMode: true, daysOutsideDisasterMode: 0 });
  turn.advance(7);

  assert.equal(session.getState().daysOutsideDisasterMode, 0);
});

test('the reveal runs from the maps as they were to the maps as they are, and nothing else happens until it lands', () => {
  const { session, log, reveals, turn } = build();
  const previous = session.getState().maps;
  turn.advance(1);

  const [title, level, updated, clear, , from] = reveals[0];
  assert.deepEqual([title, level, clear], ['Updating...', 'level1', false]);
  assert.equal(from, previous, 'the pre-advance maps, handed over explicitly');
  assert.deepEqual(updated, advanceConstructionProgress(previous, 1));
  assert.notEqual(session.getState().maps, updated, 'the colony holds a copy, not the object being revealed');
  assert.deepEqual(log, ['forgetUndo', 'reveal']);
});

// The order of a turn

test('once the reveal lands: the event, then the core, the reports, the autosave and the disaster, in that order', () => {
  const world = advanceAndLand(build(), 1);

  // The core's own news is queued along the way; the steps are what is pinned.
  assert.deepEqual(world.named().filter((entry) => !entry.startsWith('queued')), [
    'forgetUndo', 'reveal', 'count 4', 'selectEvent', 'applyEvent', 'reports', 'save autoSave false', 'disaster',
  ]);
});

test('the ending is checked only once the disaster has landed, and the queued news is shown after it', () => {
  const world = advanceAndLand(build(), 1);
  assert.ok(!world.log.includes('checkEnding'));

  world.disasters[0]();
  assert.deepEqual(world.named().slice(-2), ['checkEnding', 'drain']);
});

test('every turn autosaves after the reports, with no progress window', () => {
  const world = advanceAndLand(build(), 7);

  assert.ok(world.named().indexOf('reports') < world.named().indexOf('save autoSave false'));
});

test('the event is chosen for the colony as it now is, the days advanced, and whether any ore vein is left', () => {
  const seen = advanceAndLand(build({}, { oreVeins: 2 }), 7);
  assert.equal(seen.selections[0].days, 7);
  assert.equal(seen.selections[0].noOreVeins, false);
  assert.equal(seen.selections[0].state.day, 37);

  const exhausted = advanceAndLand(build({}, { oreVeins: 0 }), 1);
  assert.equal(exhausted.selections[0].noOreVeins, true);
});

// Committing the day's random event

test('an event replaces the colony, refreshes the day, and queues its news before the core runs', () => {
  const world = build({}, {
    results: [{ state: (colony) => ({ ...colony, day: 45, credits: 1234 }), messages: ['NEWS FLASH: one', 'two'], effects: [] }],
  });
  world.turn.advance(1);
  let coreSaw = null;
  world.session.subscribe((state) => { coreSaw ??= state; });
  world.reveals[0][4]();

  assert.deepEqual([coreSaw.day, coreSaw.credits], [45, 1234], 'the event\'s colony is committed first');
  assert.equal(world.view.mine.chrome.dayText.text, '45');
  const named = world.named();
  assert.deepEqual(named.filter((entry) => entry.startsWith('queued')).slice(0, 2), ['queued: NEWS FLASH: one', 'queued: two']);
  assert.ok(named.indexOf('queued: two') < named.indexOf('reports'));
});

test('the alien artifact and the EM storm each grant their frame, from the effects they carry', () => {
  const artifact = advanceAndLand(build({}, { results: [{ messages: [], effects: [{ type: 'set-morale' }] }] }), 1);
  assert.ok(artifact.log.includes('grant alien-artifact'));
  assert.ok(!artifact.log.includes('grant time-shift'));

  const storm = advanceAndLand(build({}, { results: [{ messages: [], effects: [{ type: 'time-shift' }] }] }), 1);
  assert.ok(storm.log.includes('grant time-shift'));
  assert.ok(!storm.log.includes('grant alien-artifact'));

  const quiet = advanceAndLand(build(), 1);
  assert.ok(!quiet.named().some((entry) => entry.startsWith('grant')));
});

test('an event that changes the surface redraws the level on screen, without holding up the turn', () => {
  const world = advanceAndLand(build({}, { results: [{ messages: [], effects: [], mapUpdate: { redraw: true } }] }), 1);

  assert.equal(world.reveals.length, 2);
  const [title, level, maps, clear, landed] = world.reveals[1];
  assert.deepEqual([title, level, clear], ['Updating...', 'level1', false]);
  assert.deepEqual(maps, advanceConstructionProgress(colonyMaps(), 1), 'the colony\'s maps after the event');
  assert.equal(typeof landed, 'function');
  assert.doesNotThrow(() => landed(), 'landing resumes nothing; the turn did not wait');
  assert.ok(world.named().indexOf('reports') > world.named().lastIndexOf('reveal'), 'the turn goes on regardless');
});

test('an event that asks first waits over the mine screen; the answer decides the event, then the core runs', () => {
  const choice = { message: 'Accept the offer?' };
  const world = build({}, { results: [{ messages: [], effects: [], pendingChoice: choice }, { messages: ['accepted'], effects: [] }] });
  advanceAndLand(world, 1);

  assert.deepEqual([world.asked[0].parent, world.asked[0].text], [world.view.mine.screen, 'Accept the offer?']);
  assert.ok(!world.log.includes('reports'), 'nothing more until answered');

  world.asked[0].yes();
  assert.ok(world.log.includes('applyEvent accept'));
  assert.ok(world.named().indexOf('queued: accepted') < world.named().indexOf('reports'));
});

// The daily core

test('the core update is the rules\' own, with buildings counted from the maps and pocketRandom', () => {
  const draws = [3, 1, 4, 1, 5, 9, 2, 6];
  const world = build({}, { draws });
  world.turn.advance(1);
  const afterAdvance = world.session.getState();
  world.reveals[0][4]();

  const expected = updateDailyCore(
    afterAdvance,
    countCompletedBuildingsByName(afterAdvance.maps, buildingMap),
    1,
    { random: ((script) => () => (script.length ? script.shift() : 0))([...draws]) },
  );
  assert.deepEqual(world.session.getState(), expected.state);
  const { creditText, sellPrice } = world.view.mine.chrome;
  assert.deepEqual([creditText.text, sellPrice.text], [String(expected.state.credits), String(expected.state.sellPrice)]);
  const queued = world.named().filter((entry) => entry.startsWith('queued')).map((entry) => entry.slice(8));
  assert.deepEqual(queued, expected.messages);
  assert.ok(expected.messages.length > 0, 'the fixture\'s day has news to order');
  // Queued before the disaster is checked, so the day's own news reads before
  // anything a disaster adds.
  const lastNews = world.named().lastIndexOf(`queued: ${expected.messages.at(-1)}`);
  assert.ok(lastNews < world.named().indexOf('reports'));
  assert.ok(lastNews < world.named().indexOf('disaster'));
});

test('a death rate past 100 discards the day\'s news, reports it over the mine screen, and ends the colony on dismissal', () => {
  const dying = { deathRate: 100, health: 0, food: 0, lifeSupport: 0, morale: 0 };
  const world = build(dying);
  world.turn.advance(1);
  const afterAdvance = world.session.getState();
  assert.ok(updateDailyCore(afterAdvance, countCompletedBuildingsByName(afterAdvance.maps, buildingMap), 1, { random: () => 0 })
    .deathRateTerminal, 'the fixture really is terminal');
  world.reveals[0][4]();

  assert.deepEqual(world.named().slice(-2), ['discard', 'message']);
  assert.equal(world.messages[0].parent, world.view.mine.screen);
  assert.match(world.messages[0].text, /^NEWS FLASH: With the asteriod mine death rate rising to 100%/);
  assert.ok(!world.log.includes('reports') && !world.log.includes('disaster'), 'nothing after the core runs');

  world.messages[0].onClose();
  assert.deepEqual(world.log.at(-1), ['endGame', false, 'Death Rate Reached 100%']);
});
