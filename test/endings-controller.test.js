import assert from 'node:assert/strict';
import test from 'node:test';

import { createEndingsController } from '../scripts/endings-controller.js';
import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit } from '../scripts/gamedata.js';
import { PLACEHOLDER_RECORD, addToBoard, readBoard, readLocalBestScore } from '../scripts/local-best-score.js';
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
  const boards = [];
  const announced = [];
  let afterDrain = null;
  const dialogs = {
    shown,
    enqueue: (text) => log.push(`queued: ${text}`),
    whenDrained: (run) => { afterDrain = run; },
    drain: () => { const run = afterDrain; afterDrain = null; run?.(); },
    message: (parent, text, onClose) => { log.push('message'); shown.push({ kind: 'message', parent, text, onClose }); },
    confirm: (parent, text, yes, no) => { shown.push({ kind: 'confirm', parent, text, yes, no }); },
    input: (parent, initial, ok, cancel, options) => { shown.push({ kind: 'input', parent, initial, ok, cancel, options }); },
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
    highScoreLine: { showColony: (colony) => { log.push('showColony'); boards.push(colony); } },
    storage,
    pocketRandom: (n) => { draws.push(n); return rolls.length ? rolls.shift() : 0; },
    announceRecords: () => { announced.push(storage.getItem('miner2149.localBestScore')); },
  });
  const status = () => [view.gameOver.status.first.text, view.gameOver.status.second.text];
  return { view, session, dialogs, log, draws, shown, boards, announced, storage, endings, status };
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
  assert.deepEqual(log, ['message', 'leaveMineForGameOver', 'resetAutosave', 'showColony', 'showGameOver']);
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
//
// Each class keeps its own record in each category, and an empty one is the
// source's 5,000,000 by Mr. Nobody, so a record has to beat that.

const RICH = 6_000_000;
const best = (storage, category, difficulty = 2) => readLocalBestScore(storage, category, difficulty);

test("completing draws the flavour roll only then, scores ore at the day price, and records the class's normal best", () => {
  const { session, dialogs, log, draws, storage, endings } = build({ day: 730, credits: RICH, diridium: 500, sellPrice: 30 });
  endings.checkEnding();

  assert.deepEqual(draws, [3]);
  assert.equal(session.getState().credits, RICH + 15000, 'credits become the score');
  assert.deepEqual(best(storage, 'normal'), { score: RICH + 15000, name: '' }, 'written at once, under no name yet');
  assert.deepEqual(best(storage, 'disaster'), PLACEHOLDER_RECORD);
  assert.deepEqual(best(storage, 'normal', 3), PLACEHOLDER_RECORD, 'another class is untouched');
  assert.ok(!log.some((entry) => entry.startsWith('grant')), 'no frame for a normal completion');
  assert.ok(!log.includes('showGameOver'), 'game over waits for the queue');

  dialogs.drain();
  assert.deepEqual(log.slice(-5), ['leaveMineForGameOver', 'resetAutosave', 'showColony', 'showGameOver', 'message']);
});

test("a completion below the top is no record, but takes its place on the board and is asked its name", () => {
  const { view, dialogs, shown, storage, endings } = build({ day: 730, credits: 1_000_000, diridium: 0 });
  endings.checkEnding();
  dialogs.drain();
  shown[0].onClose();

  assert.deepEqual(best(storage, 'normal'), PLACEHOLDER_RECORD, 'Mr. Nobody keeps the top');
  assert.deepEqual(readBoard(storage, 'normal', 2)[7], { score: 1_000_000, name: '', seeded: false }, 'written at once');
  assert.deepEqual([shown[1].kind, shown[1].parent, shown[1].text],
    ['message', view.gameOver.screen, 'Your colony has earned place 8 in the Class 2 records!']);
  shown[1].onClose();
  assert.equal(shown[2].kind, 'input');
  view.message.message.inputText.text = 'Bo';
  shown[2].ok();
  assert.deepEqual(readBoard(storage, 'normal', 2)[7], { score: 1_000_000, name: 'Bo', seeded: false });
});

test('the site is told each time a board changes, after the write', () => {
  const { view, dialogs, shown, announced, endings } = build({ day: 730, credits: 1_000_000, diridium: 0 });
  endings.checkEnding();
  assert.equal(announced.length, 1, 'once entered');
  assert.match(announced[0], /"score":1000000,"name":""/);

  dialogs.drain();
  shown[0].onClose();
  shown[1].onClose();
  view.message.message.inputText.text = 'Bo';
  shown[2].ok();
  assert.equal(announced.length, 2, 'and once named');
  assert.match(announced[1], /"name":"Bo"/);
});

test('a run that makes no board tells the site nothing', () => {
  const { announced, endings } = build({ day: 730, credits: 250_000, diridium: 0 });
  endings.checkEnding();
  assert.deepEqual(announced, []);
});

test('a Disaster Mode place names its board as such', () => {
  const { dialogs, shown, endings } = build({ day: 730, credits: 1_000_000, diridium: 0, daysOutsideDisasterMode: 0 });
  endings.checkEnding();
  dialogs.drain();
  shown[0].onClose();

  assert.equal(shown[1].text, 'Your colony has earned place 8 in the Class 2 Disaster Mode records!');
});

test('a completion below the last place is neither a record nor a place, and asks nothing', () => {
  const { dialogs, shown, storage, endings } = build({ day: 730, credits: 250_000, diridium: 0 });
  endings.checkEnding();
  dialogs.drain();
  shown[0].onClose();

  assert.equal(shown.length, 1, 'only the mine\'s future');
  assert.equal(storage.getItem('miner2149.localBestScore'), null);
});

test("a completion that does not beat its class's best leaves the record alone", () => {
  const { storage, endings } = build({ day: 730, credits: RICH, diridium: 0 });
  addToBoard(storage, 'normal', 2, { score: 9_000_000, name: 'Ada' });
  endings.checkEnding();

  assert.deepEqual(best(storage, 'normal'), { score: 9_000_000, name: 'Ada' });
});

test('a higher record on another class does not stand in the way', () => {
  const { storage, endings } = build({ day: 730, credits: RICH, diridium: 0 });
  addToBoard(storage, 'normal', 4, { score: 9_000_000, name: 'Ada' });
  endings.checkEnding();

  assert.equal(best(storage, 'normal').score, RICH);
  assert.deepEqual(best(storage, 'normal', 4), { score: 9_000_000, name: 'Ada' });
});

test('a completion that never left Disaster Mode goes in its own record and earns its frame', () => {
  const { log, storage, endings } = build({ day: 730, credits: RICH, diridium: 0, daysOutsideDisasterMode: 0, disasterMode: true });
  endings.checkEnding();

  assert.equal(best(storage, 'disaster').score, RICH);
  assert.deepEqual(best(storage, 'normal'), PLACEHOLDER_RECORD);
  assert.ok(log.includes('grant disaster-mode-completion'));
});

test('a Disaster Mode completion is measured against the Disaster Mode best, not the normal one', () => {
  const { storage, endings } = build({ day: 730, credits: RICH, diridium: 0, daysOutsideDisasterMode: 0 });
  addToBoard(storage, 'normal', 2, { score: 9_000_000, name: 'Ada' });
  endings.checkEnding();

  assert.equal(best(storage, 'disaster').score, RICH);
  assert.deepEqual(best(storage, 'normal'), { score: 9_000_000, name: 'Ada' });
});

test('a session that is not normal -- a class that does not match its asteroid -- completes but records nothing', () => {
  const { storage, endings } = build({ day: 730, credits: RICH, diridium: 0, asteroid: 'Class:5' });
  endings.checkEnding();

  assert.deepEqual(best(storage, 'normal'), PLACEHOLDER_RECORD);
  assert.deepEqual(best(storage, 'normal', 5), PLACEHOLDER_RECORD);
});

test('a sandbox completion records nothing, and the frame is left to the grant to refuse', () => {
  const { log, storage, endings } = build({ day: 730, credits: RICH, diridium: 0, daysOutsideDisasterMode: 0, devSandbox: true });
  endings.checkEnding();

  assert.deepEqual(best(storage, 'disaster'), PLACEHOLDER_RECORD);
  // The !devSandbox boundary belongs to grantSkinForTrigger, not to this check.
  assert.ok(log.includes('grant disaster-mode-completion'));
});

// The name, as the source asks for it: after the mine's future, a
// congratulation, then the prompt until the name fits.

function completeWithRecord() {
  const world = build({ day: 730, credits: RICH, diridium: 0 });
  world.endings.checkEnding();
  world.dialogs.drain();
  world.shown[0].onClose();
  return world;
}

test('a record is congratulated over game over once the future is read, then a name is asked for', () => {
  const { view, shown } = completeWithRecord();

  assert.deepEqual([shown[1].kind, shown[1].parent, shown[1].text],
    ['message', view.gameOver.screen, 'Congratulations, you have earned a personal record on this mine!']);
  shown[1].onClose();
  assert.deepEqual([shown[2].kind, shown[2].parent, shown[2].initial, shown[2].options],
    ['input', view.gameOver.screen, '', { prompt: 'Enter your name below (max=8):' }]);
});

test('the name entered is kept with the record', () => {
  const { view, shown, storage } = completeWithRecord();
  shown[1].onClose();
  view.message.message.inputText.text = 'Ada';
  shown[2].ok();

  assert.deepEqual(best(storage, 'normal'), { score: RICH, name: 'Ada' });
});

test('a name over eight characters is asked for again, and the record keeps waiting for it', () => {
  const { view, shown, storage } = completeWithRecord();
  shown[1].onClose();
  view.message.message.inputText.text = 'Commander';
  shown[2].ok();

  assert.equal(shown[3].kind, 'input', 'asked again');
  assert.deepEqual(best(storage, 'normal'), { score: RICH, name: '' });
  view.message.message.inputText.text = 'Cmdr Ada';
  shown[3].ok();
  assert.deepEqual(best(storage, 'normal'), { score: RICH, name: 'Cmdr Ada' }, 'exactly eight fits');
});

test("game over shows the ended colony's board, and the line is redrawn once the name is in", () => {
  const { view, session, shown, log, boards } = completeWithRecord();
  assert.deepEqual(boards, [session.getState()], 'shown as game over went up');
  shown[1].onClose();
  view.message.message.inputText.text = 'Ada';
  shown[2].ok();

  assert.equal(boards.length, 2);
  assert.equal(log.at(-1), 'showColony', 'after the name was written');
});

test('cancelling the name keeps the record, under no name', () => {
  const { shown, storage } = completeWithRecord();
  shown[1].onClose();
  shown[2].cancel();

  assert.deepEqual(best(storage, 'normal'), { score: RICH, name: '' });
  assert.equal(shown.length, 3, 'and asks nothing more');
});

test('completion survives storage that throws, and asks for no name it could not keep', () => {
  const { dialogs, log, shown, storage, endings } = build({ day: 730, credits: RICH, diridium: 0 });
  storage.setItem = () => { throw new Error('quota'); };
  assert.doesNotThrow(() => endings.checkEnding());

  dialogs.drain();
  assert.ok(log.includes('showGameOver'));
  shown[0].onClose();
  assert.equal(shown.length, 1);
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

  assert.deepEqual(log, ['leaveMineForGameOver', 'resetAutosave', 'showColony', 'showGameOver']);
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
  assert.deepEqual(log, ['leaveMineForGameOver', 'resetAutosave', 'showColony', 'showGameOver']);
  assert.deepEqual(status(), ['Mission Status: FAILURE on day 77', 'Cause: Death Rate Reached 100%']);
});
