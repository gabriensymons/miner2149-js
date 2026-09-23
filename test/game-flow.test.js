import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameFlow } from '../scripts/game-flow.js';
import { createStageManager } from '../scripts/stage-manager.js';

/** Pixi Container semantics, as in stage-manager.test.js: re-adding moves to top. */
class FakeStage {
  constructor() { this.children = []; }
  addChild(child) {
    const at = this.children.indexOf(child);
    if (at >= 0) this.children.splice(at, 1);
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const at = this.children.indexOf(child);
    if (at < 0) return null;
    this.children.splice(at, 1);
    return child;
  }
}

const SCREEN_NAMES = [
  'startScreen', 'mineScreen', 'launchScreen', 'gameOver', 'loadMineScreen', 'instructionsScreen',
  'optionsMenu', 'optionsMenuExtension',
  'operationsReport', 'operationsReportExtension', 'productionReport', 'productionReportExtension',
];

function world() {
  const stage = new FakeStage();
  const screens = createStageManager({ stage });
  const parts = Object.fromEntries(SCREEN_NAMES.map(name => [name, { name, interactiveChildren: true }]));
  // As init() leaves them: only the start screen's Cancel is live, and only the
  // start screen's OK shows on the instructions screen.
  const cancels = {
    load: { start: { interactive: true }, mine: { interactive: false }, gameOver: { interactive: false } },
    instructions: { start: { visible: true }, mine: { visible: false } },
  };
  const flow = createGameFlow({ screens, parts, cancels });
  return { stage, screens, parts, cancels, flow };
}

/** Everything a transition can change: the stack, every screen's input, every button. */
function snapshot({ stage, parts, cancels }) {
  return {
    stack: stage.children.map(child => child.name),
    input: Object.fromEntries(SCREEN_NAMES.map(name => [name, parts[name].interactiveChildren])),
    loadCancels: Object.fromEntries(Object.entries(cancels.load).map(([k, v]) => [k, v.interactive])),
    instructionOks: Object.fromEntries(Object.entries(cancels.instructions).map(([k, v]) => [k, v.visible])),
  };
}

/** A mine screen in play, as enterMine leaves it. */
function inMine() {
  const w = world();
  w.flow.showStart();
  w.flow.enterMine();
  return w;
}

for (const [name, open, close] of [
  ['the operations report', 'openOperations', 'closeOperations'],
  ['the production report', 'openProduction', 'closeProduction'],
  ['the options menu', 'openOptions', 'closeOptions'],
]) {
  test(`closing ${name} puts everything back exactly as opening found it`, () => {
    const w = inMine();
    const before = snapshot(w);

    w.flow[open]();
    assert.notDeepEqual(snapshot(w), before, 'opening really changed something');
    w.flow[close]();

    assert.deepEqual(snapshot(w), before);
  });
}

test('a panel opens over the load screen, which opens over the mine screen', () => {
  const w = inMine();

  w.flow.openOperations();

  assert.deepEqual(snapshot(w).stack, ['mineScreen', 'loadMineScreen', 'operationsReport', 'operationsReportExtension']);
  assert.equal(w.parts.mineScreen.interactiveChildren, false);
  assert.equal(w.parts.loadMineScreen.interactiveChildren, false, 'the backdrop takes no input either');
});

test('cancelled back to the start screen or game over, the load screen leaves everything as it found it', () => {
  // From the start screen.
  let w = world();
  w.flow.showStart();
  let before = snapshot(w);
  w.flow.openLoadFromStart();
  w.flow.cancelLoadToStart();
  assert.deepEqual(snapshot(w), before, 'start');

  // From game over.
  w = world();
  w.flow.showStart();
  w.screens.show(w.parts.gameOver);
  before = snapshot(w);
  w.flow.openLoadFromGameOver();
  w.flow.cancelLoadToGameOver();
  assert.deepEqual(snapshot(w), before, 'game over');
});

// Cancel goes back to the options menu, not the mine. It does not quite put the
// stack back: opening took the menu away and left its extension up, so Cancel
// mounts the menu again *above* the extension. That is the original's order,
// kept. It cannot be seen -- the menu is 98px wide at x=5 and ends at x=103,
// and the extension starts at x=104, so the two never overlap -- and every
// other part of the state does come back exactly.
test('cancelling the load screen from options goes back to options, menu restacked over its extension', () => {
  const w = inMine();
  w.flow.openOptions();
  const before = snapshot(w);

  w.flow.openLoadFromOptions();
  w.flow.cancelLoadToOptions();
  const after = snapshot(w);

  assert.deepEqual(before.stack.slice(-2), ['optionsMenu', 'optionsMenuExtension']);
  assert.deepEqual(after.stack.slice(-2), ['optionsMenuExtension', 'optionsMenu']);
  assert.deepEqual({ ...after, stack: [...after.stack].sort() }, { ...before, stack: [...before.stack].sort() });
});

test('exactly one Cancel is live, and it is the one for where the load screen opened', () => {
  const live = w => Object.entries(w.cancels.load).filter(([, b]) => b.interactive).map(([k]) => k);

  let w = world();
  w.flow.openLoadFromStart();
  assert.deepEqual(live(w), ['start']);

  w = inMine();
  w.flow.openOptions();
  w.flow.openLoadFromOptions();
  assert.deepEqual(live(w), ['mine']);

  w = world();
  w.flow.openLoadFromGameOver();
  assert.deepEqual(live(w), ['gameOver']);
});

/**
 * The old way of leaving the load screen after a load, transcribed from app.js
 * as it stood before this change: call every closer it might need, in order,
 * whichever screen opened it.
 */
function oldLeaveLoadScreen({ screens, parts, cancels }) {
  const show = (a, b) => screens.show(a, b);
  const hide = (a, b) => screens.hide(a, b);
  const { loadMineScreen, optionsMenu, optionsMenuExtension, mineScreen, gameOver } = parts;
  // closeLoadOptions
  cancels.load.start.interactive = true;
  cancels.load.mine.interactive = false;
  show(optionsMenu, loadMineScreen);
  // closeOptions
  hide(optionsMenu, loadMineScreen);
  hide(loadMineScreen, mineScreen);
  hide(optionsMenuExtension);
  // closeGameOverLoad
  cancels.load.start.interactive = true;
  cancels.load.gameOver.interactive = false;
  hide(loadMineScreen, gameOver);
}

/** Puts a world into the state just before a load, from one of the three places. */
const ARRIVE = {
  start(w) {
    w.flow.showStart();
    w.flow.openLoadFromStart();
  },
  options(w) {
    w.flow.showStart();
    w.flow.enterMine();
    w.flow.openOptions();
    w.flow.openLoadFromOptions();
  },
  gameOver(w) {
    w.flow.showStart();
    w.flow.enterMine();
    // endGameFunctions, as it stands
    w.screens.hide(w.parts.mineScreen);
    w.screens.show(w.parts.startScreen);
    w.screens.show(w.parts.gameOver);
    w.flow.openLoadFromGameOver();
  },
};

// The replacement has to leave exactly what the old sequence left -- including
// `interactiveChildren` on screens it has just unmounted, which persist and
// decide whether their buttons work the next time they open.
for (const origin of ['start', 'options', 'gameOver']) {
  test(`leaving the load screen after a load from ${origin} leaves exactly what the old sequence did`, () => {
    const old = world();
    ARRIVE[origin](old);
    oldLeaveLoadScreen(old);

    const now = world();
    ARRIVE[origin](now);
    now.flow.leaveLoadScreen();

    assert.deepEqual(snapshot(now), snapshot(old));
  });
}

// The reason the replacement copies the old flags rather than tidying them: a
// game-over screen left non-interactive here would have dead buttons the next
// time a colony ends, and no test near this code would say so.
test('game over still takes input the next time a colony ends', () => {
  const w = world();
  ARRIVE.gameOver(w);
  w.flow.leaveLoadScreen();
  w.flow.enterMine();

  w.screens.hide(w.parts.mineScreen);
  w.screens.show(w.parts.startScreen);
  w.screens.show(w.parts.gameOver);

  assert.equal(w.parts.gameOver.interactiveChildren, true);
});

test('the instructions screen, opened over the mine, closes back to it with the start OK restored', () => {
  const w = inMine();
  const before = snapshot(w);

  w.flow.openInstructionsFromMine();
  assert.deepEqual(snapshot(w).instructionOks, { start: false, mine: true });
  w.flow.closeInstructionsToMine();

  assert.deepEqual(snapshot(w), before);
});

test('entering the mine replaces the start screen and hands the mine its input', () => {
  const w = world();
  w.flow.showStart();
  w.parts.mineScreen.interactiveChildren = false;

  w.flow.enterMine();

  assert.deepEqual(snapshot(w).stack, ['mineScreen']);
  assert.equal(w.parts.mineScreen.interactiveChildren, true);
});
