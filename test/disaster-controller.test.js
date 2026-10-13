import assert from 'node:assert/strict';
import test from 'node:test';

import { createDisasterController } from '../scripts/disaster-controller.js';
import {
  applyMineCaveIn,
  applyPirateRaid,
  applyPlague,
  applyPowerPlantExplosion,
  applyRadiationStorm,
  applySpaceportCrash,
  createMeteorStormCommand,
  DISASTER_IDS,
} from '../scripts/disaster-rules.js';
import { bold, regular } from '../scripts/font-styles.js';
import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit } from '../scripts/gamedata.js';
import {
  activateMeteorStorm,
  clearMeteorLaserInput,
  createMeteorStorm,
  fireMeteorLaser,
  setMeteorLaserInput,
} from '../scripts/meteor-storm.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The controller against the real scene, built on the fake Pixi, a real session
// and the real disaster rules. pocketRandom is a script; the dialog queue holds
// its tasks until the test runs them; the storm and power-plant views are fakes
// that record what they were opened with and finish when the test says.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

/** The disaster table's order, which the selection draw indexes. */
const TABLE = Object.values(DISASTER_IDS);

/** Every rule the controller dispatches to, as the controller should call it. */
const RULES = {
  [DISASTER_IDS.PIRATE_RAID]: (state, random) => applyPirateRaid(state, { random }),
  [DISASTER_IDS.SPACEPORT_CRASH]: (state, random) => applySpaceportCrash(state, { random }),
  [DISASTER_IDS.POWER_PLANT_EXPLOSION]: (state, random) => applyPowerPlantExplosion(state, { random }),
  [DISASTER_IDS.PLAGUE]: (state, random) => applyPlague(state, { sickbayCount: COUNTS.Sickbay, random }),
  [DISASTER_IDS.RADIATION_STORM]: (state) => applyRadiationStorm(state),
  [DISASTER_IDS.MINE_CAVE_IN]: (state, random) => applyMineCaveIn(state, { random }),
};

/**
 * Buildings the fake map controller reports, by name. Enough demand that the
 * storm's starting power lands below its cap of 100, so every count shows in it.
 */
const COUNTS = {
  Bulldozer: 3, 'Diridium Mine': 20, Hydroponics: 4, 'Life Support': 5, 'Space Port': 7,
  'Power Plant': 1, Processor: 6, Sickbay: 2, Storage: 9,
};
const STORM_COUNTS = {
  bulldozer: 3, diridiumMine: 20, hydroponics: 4, lifeSupport: 5, spacePort: 7,
  powerPlant: 1, processor: 6, sickbay: 2, storage: 9,
};

/** A colony past the grace period, with something on the surface for every disaster to hit. */
function colonyMaps() {
  const maps = structuredClone(gameDataInit.maps);
  maps.level1.row2[2] = 13;
  maps.level1.row5[5] = 14;
  maps.level1.row5[6] = 10;
  maps.level1.row3[3] = 8;
  maps.level2.row3[3] = 8;
  return maps;
}

const COLONY = {
  day: 100, difficulty: 3, asteroid: 'Class:3', diridium: 20000, credits: 500000, morale: 60,
  health: 90, efficiency: 90, deathRate: 1, workers: 200, level: 'level1',
};

function build(change = {}, { draws = [] } = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({ initialState: { ...initial, ...COLONY, maps: colonyMaps(), ...change } });
  const log = [];
  const tasks = [];
  const drawn = [];
  const script = [...draws];
  const pocketRandom = (max) => { drawn.push(max); return script.length ? script.shift() : 0; };
  const storms = [];
  const plants = [];
  const textures = { atlas: true };
  const app = { ticker: 'the app' };
  const disasters = createDisasterController({
    session,
    view,
    dialogs: {
      enqueue: (text) => log.push(`queued: ${text}`),
      enqueueTask: (run) => { log.push('task'); tasks.push(run); },
      message: (parent, text, onOk) => { log.push(`message: ${text}`); onOk(); },
      drain: () => log.push('drain'),
    },
    map: {
      countBuildingsByName: (name) => COUNTS[name] ?? 0,
      updateMineSurface: (...args) => log.push(['updateMineSurface', ...args]),
    },
    renderer: { updateReports: () => log.push('updateReports') },
    grantSkinForTrigger: (trigger) => log.push(`grant ${trigger}`),
    PIXI,
    app,
    textures,
    createStormView: (options) => {
      const storm = { options, opened: null, open(state) { this.opened = state; log.push('storm opened'); } };
      storms.push(storm);
      return storm;
    },
    createPowerPlantView: (options) => {
      const plant = { options, open() { log.push('power plant opened'); } };
      plants.push(plant);
      return plant;
    },
    pocketRandom,
  });
  const done = () => log.push('done');
  build.last = { PIXI, app, textures, view, session, log, tasks, drawn, storms, plants, disasters, done };
  return build.last;
}

const strings = (log) => log.filter((entry) => typeof entry === 'string');

/** Runs the queued overload: the scene ends as `finalState`, then the news and the redraw. */
function runOverload({ tasks, plants, log }, finalState) {
  tasks[0](() => log.push('resumed'));
  plants[0].options.onComplete(finalState);
  for (const task of tasks.slice(1)) task(() => log.push('resumed'));
}

/** A real storm command for the colony, as the meteor rule would issue it. */
function stormCommand(session) {
  const issued = createMeteorStormCommand(session.getState(), { buildingCounts: STORM_COUNTS, random: () => 0 });
  return issued.effects.find(({ type }) => type === 'run-meteor-storm').command;
}

// Choosing whether anything strikes

test('inside the grace period nothing is drawn and the turn resumes at once', () => {
  const { session, log, drawn, disasters, done } = build({ day: 21 });
  const before = session.getState();
  disasters.disaster(done);

  assert.deepEqual([log, drawn], [['done'], []]);
  assert.equal(session.getState(), before);
});

test('a missed chance draws once, from the class denominator, and resumes', () => {
  const { session, log, drawn, disasters, done } = build({ difficulty: 3 }, { draws: [0] });
  const before = session.getState();
  disasters.disaster(done);

  assert.deepEqual(drawn, [20 * (6 - 3)]);
  assert.deepEqual(log, ['done']);
  assert.equal(session.getState(), before);
});

test('with no callback, a turn without a disaster still runs to the end', () => {
  const { disasters } = build({ day: 5 });
  assert.doesNotThrow(() => disasters.disaster());
});

// Dispatch: each disaster reaches its own rule

for (const [index, id] of TABLE.entries()) {
  if (id === DISASTER_IDS.METEOR_STORM) continue;

  test(`${id} is dispatched to its rule, with the same draws, and its news queued`, () => {
    const { session, log, drawn, disasters, done } = build({}, { draws: [1, index] });
    const colony = session.getState();
    disasters.disaster(done);

    const expectedDraws = [];
    const expected = RULES[id](colony, (max) => { expectedDraws.push(max); return 0; });
    assert.deepEqual(drawn.slice(0, 2), [20 * (6 - 3), TABLE.length], 'the gate, then the table');
    assert.deepEqual(drawn.slice(2), expectedDraws, 'then exactly the rule\'s own draws');
    assert.ok(expected.outcome.applied, `the fixture lets ${id} apply`);
    assert.deepEqual(session.getState(), expected.state);
    // The power plant's news waits for its scene; a scene nobody answered
    // leaves the rule's own words.
    if (id === DISASTER_IDS.POWER_PLANT_EXPLOSION) runOverload(build.last, { faultsFixed: 0 });
    const news = expected.effects.filter(({ type }) => type === 'message').map(({ text }) => text);
    assert.deepEqual(
      strings(log).filter((entry) => /^(queued|message): /.test(entry)).map((entry) => entry.replace(/^\w+: /, '')),
      news,
    );
  });
}

test('the meteor storm is dispatched with the colony\'s building counts', () => {
  const index = TABLE.indexOf(DISASTER_IDS.METEOR_STORM);
  const { session, storms, tasks, disasters, done } = build({}, { draws: [1, index] });
  const colony = session.getState();
  disasters.disaster(done);
  tasks[0]();

  const expected = createMeteorStormCommand(colony, { buildingCounts: STORM_COUNTS, random: () => 0 });
  const command = expected.effects.find(({ type }) => type === 'run-meteor-storm').command;
  assert.deepEqual(storms[0].opened, createMeteorStorm(command));
  assert.ok(storms[0].opened.initialPower < 100, 'below the cap, so a wrong count would show');
});

// Applying a result

test('an applied disaster refreshes the labels and reports, then resumes the turn last', () => {
  const index = TABLE.indexOf(DISASTER_IDS.RADIATION_STORM);
  const { view, session, log, disasters, done } = build({ day: 123, credits: 4567 }, { draws: [1, index] });
  disasters.disaster(done);

  assert.deepEqual([view.mine.chrome.dayText.text, view.mine.chrome.creditText.text], ['123', '4567']);
  assert.deepEqual(strings(log).slice(-2), ['updateReports', 'done']);
  assert.ok(session.getState().health < COLONY.health);
});

test('a disaster with nothing to hit changes nothing and resumes', () => {
  const index = TABLE.indexOf(DISASTER_IDS.SPACEPORT_CRASH);
  const { session, log, disasters, done } = build({ maps: structuredClone(gameDataInit.maps) }, { draws: [1, index] });
  const before = session.getState();
  disasters.disaster(done);

  assert.equal(session.getState(), before);
  assert.deepEqual(log, ['done']);
});

test('damage to the level on screen redraws it as a queued task, which resumes the queue when it lands', () => {
  const index = TABLE.indexOf(DISASTER_IDS.SPACEPORT_CRASH);
  const { session, log, tasks, disasters, done } = build({ level: 'level1' }, { draws: [1, index] });
  disasters.disaster(done);

  assert.equal(tasks.length, 1);
  const resume = () => {};
  log.length = 0;
  tasks[0](resume);
  const { level, maps } = session.getState();
  assert.deepEqual(log, [['updateMineSurface', 'Updating...', level, maps, false, resume]]);
});

test('damage to a level that is not on screen does not redraw', () => {
  const index = TABLE.indexOf(DISASTER_IDS.SPACEPORT_CRASH);
  const { tasks, disasters, done } = build({ level: 'level2' }, { draws: [1, index] });
  disasters.disaster(done);

  assert.equal(tasks.length, 0);
});

// The power plant's scene

test('a power-plant explosion queues its scene, its news and its redraw, in that order, and resumes the turn', () => {
  const index = TABLE.indexOf(DISASTER_IDS.POWER_PLANT_EXPLOSION);
  const { session, log, tasks, plants, disasters, done } = build({ level: 'level1' }, { draws: [1, index] });
  const before = session.getState();
  disasters.disaster(done);

  assert.notDeepEqual(session.getState().maps, before.maps, 'the damage is rolled before the scene, as in the source');
  assert.deepEqual(strings(log), ['task', 'task', 'task', 'updateReports', 'done']);
  assert.equal(plants.length, 0, 'nothing is opened until the queue reaches it');

  log.length = 0;
  tasks[0](() => log.push('resumed'));
  assert.deepEqual(log, ['power plant opened']);
  plants[0].options.onComplete({ faultsFixed: 0 });
  tasks[1](() => log.push('resumed'));
  tasks[2](() => log.push('resumed'));
  const { level, maps } = session.getState();
  assert.equal(log[0], 'power plant opened');
  assert.equal(log[1], 'resumed', 'the queue resumes once the scene has played');
  assert.equal(log[2], 'message: DISASTER: The power plant has overloaded and exploded. Nearby buildings destroyed.');
  assert.equal(log[3], 'resumed');
  assert.deepEqual(log[4].slice(0, 5), ['updateMineSurface', 'Updating...', level, maps, false]);
});

test('an overload nobody answered leaves exactly the rule\'s damage', () => {
  const index = TABLE.indexOf(DISASTER_IDS.POWER_PLANT_EXPLOSION);
  const { session, disasters, done } = build({ level: 'level1' }, { draws: [1, index] });
  disasters.disaster(done);
  const damaged = session.getState();

  runOverload(build.last, { faultsFixed: 0 });
  assert.equal(session.getState(), damaged, 'not even a new object');
});

/** A blast that hits the plant and three neighbours: the draws pick the site, then up, down and right. */
function hitsThreeNeighbours() {
  const index = TABLE.indexOf(DISASTER_IDS.POWER_PLANT_EXPLOSION);
  // gate, table, site (one candidate), centre, up chance+damage, down chance+damage, left miss, right chance+damage
  return build({ level: 'level1' }, { draws: [1, index, 1, 0, 1, 0, 1, 0, 0, 1, 0] });
}

test('a contained overload puts back everything the blast destroyed, says so, and skips the redraw', () => {
  const { session, log, disasters, done } = hitsThreeNeighbours();
  const before = session.getState();
  disasters.disaster(done);
  assert.equal(session.getState().maps.level1.row4[5], 3, 'the fixture really does hit the neighbours');

  log.length = 0;
  runOverload(build.last, { faultsFixed: 3 });

  assert.deepEqual(session.getState().maps, before.maps);
  assert.ok(log.includes('message: NEWS FLASH: Power plant overload contained. No buildings were lost.'));
  assert.ok(!log.some((entry) => Array.isArray(entry) && entry[0] === 'updateMineSurface'), 'nothing to redraw');
  assert.equal(log.at(-1), 'resumed', 'the queue still moves on');
});

test('one fault fixed saves half the neighbours, rounded up, and the plant is still lost', () => {
  const { session, log, disasters, done } = hitsThreeNeighbours();
  const before = session.getState();
  disasters.disaster(done);
  const damaged = session.getState();
  runOverload(build.last, { faultsFixed: 1 });

  const { maps } = session.getState();
  assert.equal(maps.level1.row5[5], damaged.maps.level1.row5[5], 'the plant');
  assert.equal(maps.level1.row4[5], before.maps.level1.row4[5], 'up, saved');
  assert.equal(maps.level1.row6[5], before.maps.level1.row6[5], 'down, saved');
  assert.equal(maps.level1.row5[6], damaged.maps.level1.row5[6], 'right, lost');
  assert.ok(log.includes('message: DISASTER: The power plant has overloaded and exploded. Quick work at the breakers saved some nearby buildings.'));
  assert.ok(log.some((entry) => Array.isArray(entry) && entry[0] === 'updateMineSurface'));
});

test('the scene is given the colony\'s class and the game\'s own randomness', () => {
  const index = TABLE.indexOf(DISASTER_IDS.POWER_PLANT_EXPLOSION);
  const { tasks, plants, drawn, disasters, done } = build({ difficulty: 5, asteroid: 'Class:5' }, { draws: [1, index] });
  disasters.disaster(done);
  tasks[0](() => {});

  assert.equal(plants[0].options.difficulty, 5);
  plants[0].options.random(7);
  assert.equal(drawn.at(-1), 7, 'its next fault is drawn from pocketRandom');
});

test('the scene is opened over the mine screen with the title face and the atlas', () => {
  const index = TABLE.indexOf(DISASTER_IDS.POWER_PLANT_EXPLOSION);
  const { PIXI, app, textures, view, tasks, plants, disasters, done } = build({}, { draws: [1, index] });
  disasters.disaster(done);
  tasks[0](() => {});

  const { options } = plants[0];
  assert.equal(options.PIXI, PIXI);
  assert.equal(options.app, app);
  assert.equal(options.textures, textures);
  assert.equal(options.underlyingParent, view.mine.screen);
  assert.deepEqual(options.fonts, { title: bold, status: regular });
});

test('no other disaster plays the power plant\'s scene', () => {
  for (const id of [DISASTER_IDS.SPACEPORT_CRASH, DISASTER_IDS.MINE_CAVE_IN, DISASTER_IDS.PIRATE_RAID]) {
    const { tasks, plants, disasters, done } = build({ level: 'level1' }, { draws: [1, TABLE.indexOf(id)] });
    disasters.disaster(done);
    for (const task of tasks) task(() => {});
    assert.equal(plants.length, 0, id);
  }
});

test('a power plant with nothing to blow up plays no scene', () => {
  const index = TABLE.indexOf(DISASTER_IDS.POWER_PLANT_EXPLOSION);
  const { log, plants, disasters, done } = build({ maps: structuredClone(gameDataInit.maps) }, { draws: [1, index] });
  disasters.disaster(done);

  assert.deepEqual(log, ['done']);
  assert.equal(plants.length, 0);
});

// Striking a named disaster, as the development panel does

test('strike applies the named disaster without drawing for whether one strikes', () => {
  const { session, log, tasks, drawn, disasters, done } = build({ level: 'level1' });
  const before = session.getState();

  const struck = disasters.strike(DISASTER_IDS.POWER_PLANT_EXPLOSION, done);

  assert.deepEqual(struck, { applied: true });
  assert.notDeepEqual(session.getState().maps, before.maps);
  assert.equal(drawn[0], 2, 'the first draw is the blast\'s site choice, not the chance or the table');
  assert.equal(tasks.length, 3, 'the scene, the news, then the redraw');
  assert.deepEqual(strings(log).slice(-2), ['updateReports', 'done']);
});

test('strike can play the scene at another class without changing the colony\'s', () => {
  const { session, tasks, plants, disasters, done } = build({ level: 'level1' });
  disasters.strike(DISASTER_IDS.POWER_PLANT_EXPLOSION, done, { difficulty: 5 });
  tasks[0](() => {});

  assert.equal(plants[0].options.difficulty, 5);
  assert.equal(session.getState().difficulty, COLONY.difficulty);
});

test('strike reports when there was nothing to hit, and still resumes', () => {
  const { session, log, disasters, done } = build({ maps: structuredClone(gameDataInit.maps) });
  const before = session.getState();

  assert.deepEqual(disasters.strike(DISASTER_IDS.POWER_PLANT_EXPLOSION, done), { applied: false });
  assert.equal(session.getState(), before);
  assert.deepEqual(log, ['done']);
});

test('strike refuses a disaster the table does not have', () => {
  const { disasters } = build();
  assert.throws(() => disasters.strike('volcano'), /Unknown disaster: volcano/);
});

// The meteor storm

test('a storm is queued as a task and the queue is drained; the turn waits for the storm', () => {
  const index = TABLE.indexOf(DISASTER_IDS.METEOR_STORM);
  const { log, storms, tasks, disasters, done } = build({}, { draws: [1, index] });
  disasters.disaster(done);

  assert.deepEqual(strings(log), ['task', 'drain']);
  assert.deepEqual(storms, [], 'not opened until its turn in the queue');
  tasks[0]();
  assert.equal(storms.length, 1);
  assert.ok(!log.includes('done'), 'the turn resumes only after the storm');
});

test('the storm is opened over the mine screen with the black-tinted title face, the atlas and the storm rules', () => {
  const { PIXI, app, textures, view, session, drawn, storms, disasters } = build();
  disasters.startMeteorStorm(stormCommand(session), () => {});
  const { options } = storms[0];

  assert.equal(options.PIXI, PIXI);
  assert.equal(options.app, app);
  assert.equal(options.textures, textures);
  assert.equal(options.underlyingParent, view.mine.screen);
  // The storm modal paints a white ground, so the title needs the bold face.
  assert.deepEqual(options.fonts, { title: bold, status: regular });
  assert.equal(options.model.activate, activateMeteorStorm);
  assert.equal(options.model.fire, fireMeteorLaser);
  assert.equal(options.model.setInput, setMeteorLaserInput);
  assert.equal(options.model.clearInput, clearMeteorLaserInput);

  const state = storms[0].opened;
  drawn.length = 0;
  options.model.step(activateMeteorStorm(state));
  assert.ok(drawn.length > 0, 'stepping the storm draws from pocketRandom');
});

test('a finished storm is scored against the colony\'s maps as they are then', () => {
  const { session, storms, disasters } = build();
  let result;
  disasters.startMeteorStorm(stormCommand(session), (r) => { result = r; });
  const later = colonyMaps();
  later.level1.row9[9] = 10;
  session.update({ maps: later });
  storms[0].options.onComplete(storms[0].opened);

  assert.deepEqual(result.nextMaps.level1.row9, later.level1.row9);
});

test('a storm result applies efficiency and maps, clamps morale, adds any bonus, and resumes last', () => {
  const { view, session, log, disasters, done } = build({ morale: 95, diridium: 100, day: 77, credits: 31 });
  const nextMaps = structuredClone(session.getState().maps);
  disasters.applyMeteorStormResult({
    nextEfficiency: 42, nextMaps, moraleDelta: 10, diridiumBonus: 25, messages: ['one', 'two'],
  }, done);

  const after = session.getState();
  assert.deepEqual([after.efficiency, after.morale, after.diridium], [42, 100, 125]);
  assert.equal(after.maps, nextMaps);
  assert.deepEqual([view.mine.chrome.dayText.text, view.mine.chrome.creditText.text], ['77', '31']);
  assert.deepEqual(strings(log), ['updateReports', 'grant meteor-storm', 'queued: one', 'queued: two', 'done']);
});

test('a storm nobody fired in carries no bonus: morale and diridium stand, and never fall below zero', () => {
  const { session, disasters } = build({ morale: 3, diridium: 100 });
  disasters.applyMeteorStormResult({
    nextEfficiency: 50, nextMaps: session.getState().maps, message: 'only',
  }, () => {});
  assert.deepEqual([session.getState().morale, session.getState().diridium], [3, 100]);

  const low = build({ morale: 3 });
  low.disasters.applyMeteorStormResult({ nextEfficiency: 50, nextMaps: low.session.getState().maps, moraleDelta: -10, message: 'm' }, () => {});
  assert.equal(low.session.getState().morale, 0);
});

test('a storm result with a single message queues it', () => {
  const { session, log, disasters } = build();
  disasters.applyMeteorStormResult({ nextEfficiency: 1, nextMaps: session.getState().maps, message: 'the one' }, () => {});

  assert.ok(log.includes('queued: the one'));
});

test('a storm that changed the surface redraws it only while level 1 is on screen', () => {
  const changed = (session) => {
    const maps = structuredClone(session.getState().maps);
    maps.level1.row0[0] = 99;
    return maps;
  };

  const onSurface = build({ level: 'level1' });
  onSurface.disasters.applyMeteorStormResult({ nextEfficiency: 1, nextMaps: changed(onSurface.session), message: 'm' }, () => {});
  assert.equal(onSurface.tasks.length, 1);

  const below = build({ level: 'level2' });
  below.disasters.applyMeteorStormResult({ nextEfficiency: 1, nextMaps: changed(below.session), message: 'm' }, () => {});
  assert.equal(below.tasks.length, 0);

  const untouched = build({ level: 'level1' });
  untouched.disasters.applyMeteorStormResult({ nextEfficiency: 1, nextMaps: untouched.session.getState().maps, message: 'm' }, () => {});
  assert.equal(untouched.tasks.length, 0);
});

test('a storm run end to end resumes the turn once its result has been applied', () => {
  const index = TABLE.indexOf(DISASTER_IDS.METEOR_STORM);
  const { log, storms, tasks, disasters, done } = build({}, { draws: [1, index] });
  disasters.disaster(done);
  tasks[0]();
  storms[0].options.onComplete(storms[0].opened);

  assert.deepEqual(strings(log).slice(-1), ['done']);
  assert.ok(log.includes('grant meteor-storm'));
});
