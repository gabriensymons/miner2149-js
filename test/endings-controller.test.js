import assert from 'node:assert/strict';
import test from 'node:test';

import { createEndingsController } from '../scripts/endings-controller.js';
import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit } from '../scripts/gamedata.js';
import { readLocalBestScore, writeLocalBestScore } from '../scripts/local-best-score.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The controller against the real scene, built on the fake Pixi, a real session
// and the real ending model. Everything else is a fake writing to one log; the
// dialog queue holds what is enqueued and runs `whenDrained` only when the test
// drains it, as dialog-service.js does once the player has read everything.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

function fakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

/** A colony that ends nothing by default: solvent, content, mid-game, a normal session. */
const ORDINARY = {
  day: 100, morale: 80, credits: 50000, diridium: 1000, sellPrice: 20,
  difficulty: 2, asteroid: 'Class:2', creditFlag: 0, daysOutsideDisasterMode: 100,
};

function build(change = {}, { rolls = [] } = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({ initialState: { ...initial, ...ORDINARY, ...change } });
  const log = [];
  const draws = [];
  const shown = [];
  let afterDrain = null;
  const dialogs = {
    shown,
    enqueue: (text) => log.push(`queued: ${text}`),
    whenDrained: (run) => { afterDrain = run; },
    drain: () => { const run = afterDrain; afterDrain = null; run?.(); },
    message: (parent, text, onClose) => { log.push('message'); shown.push({ kind: 'message', parent, text, onClose }); },
    confirm: (parent, text, yes, no) => { shown.push({ kind: 'confirm', parent, text, yes, no }); },
  };
  const storage = fakeStorage();
  const endings = createEndingsController({
    session,
    view,
    dialogs,
    flow: { leaveMineForGameOver: () => log.push('leaveMineForGameOver'), showGameOver: () => log.push('showGameOver') },
    renderer: { updateReports: () => log.push('updateReports') },
    saveWorkflow: {
      save: (slot, showProgress) => log.push(`save ${slot} ${showProgress}`),
      resetAutosave: () => log.push('resetAutosave'),
    },
    grantSkinForTrigger: (trigger) => log.push(`grant ${trigger}`),
    storage,
    pocketRandom: (n) => { draws.push(n); return rolls.length ? rolls.shift() : 0; },
  });
  const status = () => [view.gameOver.status.first.text, view.gameOver.status.second.text];
  return { view, session, dialogs, log, draws, shown, storage, endings, status };
}

// The check at the end of a turn

test('an ordinary turn ends nothing, draws nothing, and leaves the colony as it was', () => {
  const { session, dialogs, log, draws, endings } = build();
  const before = { ...session.getState() };
  endings.checkEnding();
  dialogs.drain();

  assert.deepEqual([log, draws], [[], []]);
  assert.deepEqual(session.getState(), before);
});

test('below 30 morale the revolt roll is drawn from eleven; at 30 it is not drawn at all', () => {
  const low = build({ morale: 29, difficulty: 2, asteroid: 'Class:2' }, { rolls: [5] });
  low.endings.checkEnding();
  assert.deepEqual(low.draws, [11]);
  assert.deepEqual(low.log, [], 'a roll of 5 is not below class 2: no revolt');

  const content = build({ morale: 30 });
  content.endings.checkEnding();
  assert.deepEqual(content.draws, []);
});

test('a revolt waits for the queue, then reports over the mine screen and ends the colony as a failure', () => {
  const { view, dialogs, log, shown, endings, status } = build({ morale: 10, difficulty: 3, asteroid: 'Class:3', day: 50 }, { rolls: [2] });
  endings.checkEnding();
  assert.deepEqual(log, [], 'nothing until the queue drains');

  dialogs.drain();
  assert.equal(shown[0].parent, view.mine.screen);
  assert.match(shown[0].text, /^DISASTER: You have been forced out of an airlock/);
  shown[0].onClose();
  assert.deepEqual(log, ['message', 'leaveMineForGameOver', 'resetAutosave', 'showGameOver']);
  assert.deepEqual(status(), ['Mission Status: FAILURE on day 50', 'Cause: Worker Revolt']);
});

test('debt the colony can still be extended credit for is paid from its ore, reported, and autosaved', () => {
  const { session, dialogs, log, endings, view } = build({ credits: -3000, diridium: 0, sellPrice: 20, creditFlag: 0, difficulty: 2 });
  endings.checkEnding();
  dialogs.drain();

  assert.deepEqual(log, [
    'queued: You do not have enough processed diridium to cover your debts.',
    'queued: Your credit has been extended to cover 3000 credits in debt. A lien is placed on future processed ore. Cut costs immediately!',
    'updateReports',
    'save autoSave false',
  ]);
  assert.deepEqual([session.getState().credits, session.getState().diridium, session.getState().creditFlag], [0, -150, 1]);
  assert.equal(view.mine.chrome.creditText.text, '0');
});

test('the last extension the class allows comes with a warning', () => {
  const { log, endings } = build({ credits: -100, diridium: 0, creditFlag: 3, difficulty: 2 });
  endings.checkEnding();

  assert.ok(log.includes('queued: WARNING: Your creditors refuse any future extension of your credit. Watch your expenses carefully.'));
});

test('debt beyond the last extension is insolvency: told, then a failure once the queue drains', () => {
  const { dialogs, log, shown, endings, status } = build({ credits: -100, diridium: 0, creditFlag: 4, difficulty: 2, day: 300 });
  endings.checkEnding();
  assert.deepEqual(log, ['queued: You do not have enough processed diridium to cover your debts.']);

  dialogs.drain();
  assert.match(shown[0].text, /^Your creditors will not extend you further credit\./);
  shown[0].onClose();
  assert.deepEqual(status(), ['Mission Status: FAILURE on day 300', 'Cause: Insufficient Funds']);
});

// Completion and the records

test('completing draws the flavour roll only then, scores ore at the day price, and records a normal best', () => {
  const { session, dialogs, log, draws, storage, endings } = build({ day: 730, credits: 100000, diridium: 500, sellPrice: 30 });
  endings.checkEnding();

  assert.deepEqual(draws, [3]);
  assert.equal(session.getState().credits, 115000, 'credits become the score');
  assert.deepEqual(readLocalBestScore(storage, 'normal'), { score: 115000, difficulty: 2 });
  assert.equal(readLocalBestScore(storage, 'disaster').score, 0);
  assert.ok(!log.some((entry) => entry.startsWith('grant')), 'no frame for a normal completion');
  assert.ok(!log.includes('showGameOver'), 'game over waits for the queue');

  dialogs.drain();
  assert.deepEqual(log.slice(-4), ['leaveMineForGameOver', 'resetAutosave', 'showGameOver', 'message']);
});

test('a completion that does not beat the best leaves the record alone', () => {
  const { storage, endings } = build({ day: 730, credits: 100000, diridium: 0 });
  writeLocalBestScore(storage, 'normal', { score: 500000, difficulty: 4 });
  endings.checkEnding();

  assert.deepEqual(readLocalBestScore(storage, 'normal'), { score: 500000, difficulty: 4 });
});

test('a completion that never left Disaster Mode goes in its own record and earns its frame', () => {
  const { log, storage, endings } = build({ day: 730, credits: 200000, diridium: 0, daysOutsideDisasterMode: 0, disasterMode: true });
  endings.checkEnding();

  assert.deepEqual(readLocalBestScore(storage, 'disaster'), { score: 200000, difficulty: 2 });
  assert.equal(readLocalBestScore(storage, 'normal').score, 0);
  assert.ok(log.includes('grant disaster-mode-completion'));
});

test('a Disaster Mode completion is measured against the Disaster Mode best, not the normal one', () => {
  const { storage, endings } = build({ day: 730, credits: 200000, diridium: 0, daysOutsideDisasterMode: 0 });
  writeLocalBestScore(storage, 'normal', { score: 900000, difficulty: 5 });
  endings.checkEnding();

  assert.deepEqual(readLocalBestScore(storage, 'disaster'), { score: 200000, difficulty: 2 });
  assert.deepEqual(readLocalBestScore(storage, 'normal'), { score: 900000, difficulty: 5 });
});

test('a session that is not normal -- a class that does not match its asteroid -- completes but records nothing', () => {
  const { storage, endings } = build({ day: 730, credits: 200000, diridium: 0, asteroid: 'Class:5' });
  endings.checkEnding();

  assert.equal(readLocalBestScore(storage, 'normal').score, 0);
});

test('a sandbox completion records nothing, and the frame is left to the grant to refuse', () => {
  const { log, storage, endings } = build({ day: 730, credits: 200000, diridium: 0, daysOutsideDisasterMode: 0, devSandbox: true });
  endings.checkEnding();

  assert.equal(readLocalBestScore(storage, 'disaster').score, 0);
  // The !devSandbox boundary belongs to grantSkinForTrigger, not to this check.
  assert.ok(log.includes('grant disaster-mode-completion'));
});

test('completion survives storage that throws', () => {
  const { dialogs, log, storage, endings } = build({ day: 730, credits: 200000, diridium: 0 });
  storage.setItem = () => { throw new Error('quota'); };
  assert.doesNotThrow(() => endings.checkEnding());

  dialogs.drain();
  assert.ok(log.includes('showGameOver'));
});

test('the completion screen follows up with what the colony became, over game over', () => {
  const { view, dialogs, shown, endings, status } = build({ day: 730, credits: 200000, diridium: 0 }, { rolls: [1] });
  endings.checkEnding();
  dialogs.drain();

  assert.equal(shown.length, 1);
  assert.equal(shown[0].parent, view.gameOver.screen);
  assert.equal(status()[1], '', 'a completion leaves the second line empty');
});

// Ending the game

test('resigning asks first, over the options menu, and does nothing on no', () => {
  const { view, log, shown, endings } = build();
  endings.endGame();

  assert.deepEqual([shown[0].kind, shown[0].parent, shown[0].text],
    ['confirm', view.options.menu, 'Are you sure you want to resign? (This will end your current colony.)']);
  shown[0].no();
  assert.deepEqual(log, []);
});

test('resigning on yes leaves for game over, clears the autosave and writes no manual slot', () => {
  const { log, shown, endings } = build();
  endings.endGame();
  shown[0].yes();

  assert.deepEqual(log, ['leaveMineForGameOver', 'resetAutosave', 'showGameOver']);
  assert.ok(!log.some((entry) => entry.startsWith('save')));
});

test('the game-over lines carry the day and credits as they were when the ending began', () => {
  const { session, shown, endings, status } = build({ day: 412, credits: 98765 });
  endings.endGame();
  session.update({ day: 1, credits: 0 });
  shown[0].yes();

  assert.deepEqual(status(), ['Mission Status: RESIGNED on day 412', 'Credits Remaining: 98765']);
});

test('an ending only ever runs once, however many times it is confirmed', () => {
  const { log, shown, endings } = build();
  endings.endGame();
  shown[0].yes();
  shown[0].yes();

  assert.deepEqual(log.filter((entry) => entry === 'showGameOver'), ['showGameOver']);
});

test('a failure ends at once, without asking', () => {
  const { log, shown, endings, status } = build({ day: 77 });
  endings.endGame(false, 'Death Rate Reached 100%');

  assert.deepEqual(shown, []);
  assert.deepEqual(log, ['leaveMineForGameOver', 'resetAutosave', 'showGameOver']);
  assert.deepEqual(status(), ['Mission Status: FAILURE on day 77', 'Cause: Death Rate Reached 100%']);
});
