import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit } from '../scripts/gamedata.js';
import { emptySlot } from '../scripts/save-controller.js';
import { createSaveWorkflow } from '../scripts/save-workflow.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The workflow against the real scene, built on the fake Pixi, and a real
// session. Storage, the dialogs, the screens, the ticker and the screen flow are
// fakes, and the ones whose order matters write into one shared log.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

function fakeSaves(log, stored = {}) {
  const minerSaves = {
    autoSave: { ...emptySlot('autoSave') },
    save1: { name: 'Day:3|Class:1', hasCustomName: false, empty: false, saveData: {} },
    save2: { name: 'My colony', hasCustomName: true, empty: false, saveData: {} },
    save3: { ...emptySlot('save3') },
  };
  return {
    minerSaves,
    saved: [],
    saveGame(data, slot, customName) {
      log.push(`saved ${slot}`);
      this.saved.push({ slot, customName, day: data.day });
      minerSaves[slot].name = customName || `Day:${data.day}`;
      return { ...data, saveName: minerSaves[slot].name };
    },
    loadGame: async (slot) => stored[slot] ?? null,
    initAutosave() {
      Object.assign(minerSaves.autoSave, emptySlot('autoSave'));
      return minerSaves.autoSave;
    },
  };
}

function fakeTicker() {
  const listeners = new Set();
  return {
    listeners,
    add: (listener) => { listeners.add(listener); },
    remove: (listener) => { listeners.delete(listener); },
    /** Ticks until nothing is listening, or `limit` ticks. Returns how many ran. */
    run(limit = 1000) {
      let ticks = 0;
      while (listeners.size && ticks < limit) {
        for (const listener of [...listeners]) listener();
        ticks += 1;
      }
      return ticks;
    },
  };
}

function build(change = {}, { stored = {}, randomNum = (lo, hi) => hi } = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({ initialState: { ...initial, day: 12, ...change } });
  const log = [];
  const shown = [];
  const dialogs = {
    shown,
    confirm: (parent, text, yes, no) => { shown.push({ kind: 'confirm', parent, text, yes, no }); },
    input: (parent, text, ok, cancel) => { shown.push({ kind: 'input', parent, text, ok, cancel }); },
    message: (parent, text, onClose) => { shown.push({ kind: 'message', parent, text, onClose }); },
  };
  const screens = {
    show: (sprite, parent) => { log.push(['show', sprite, parent]); },
    hide: (sprite, parent) => { log.push(['hide', sprite, parent]); },
  };
  const flow = Object.fromEntries(['closeOptions', 'leaveLoadScreen', 'leaveMineForStart', 'showStart']
    .map((name) => [name, () => log.push(name)]));
  const ticker = fakeTicker();
  const saves = fakeSaves(log, stored);
  const workflow = createSaveWorkflow({
    session, view, dialogs, screens, ticker, randomNum, saves, template: gameDataInit, flow,
    openLoadedColony: () => log.push('openLoadedColony'),
  });
  const { progress } = view.message;
  return { view, session, dialogs, log, ticker, saves, workflow, progress };
}

const captions = (view, slot) => [view.saveLoad.save.slotLabels[slot].text, view.saveLoad.load.slotLabels[slot].text];
const names = (log) => log.filter((entry) => typeof entry === 'string');

// The autosave

test('the end-of-day autosave saves at once, with no question and no progress window', () => {
  const { view, session, dialogs, log, ticker, saves, workflow } = build();
  workflow.save('autoSave', false);

  assert.deepEqual(saves.saved, [{ slot: 'autoSave', customName: '', day: 12 }]);
  assert.deepEqual([dialogs.shown, ticker.listeners.size, log.filter(Array.isArray)], [[], 0, []]);
  assert.equal(session.getState().saveName, 'Day:12', 'the colony carries the name it was saved under');
  assert.deepEqual(captions(view, 'autoSave'), ['Day:12', 'Day:12']);
});

test('the saved colony is a copy, not the object storage returned', () => {
  const { session, saves, workflow } = build();
  let returned;
  const saveGame = saves.saveGame.bind(saves);
  saves.saveGame = (...args) => (returned = saveGame(...args));
  workflow.save('autoSave', false);

  assert.deepEqual(session.getState(), returned);
  assert.notEqual(session.getState(), returned);
});

// Saving to a slot

test('saving to a slot asks for a comment first, over the save screen, and saves nothing until answered', () => {
  const { view, dialogs, saves, workflow } = build();
  workflow.saveToSlot('save1');

  assert.equal(dialogs.shown.length, 1);
  const [ask] = dialogs.shown;
  assert.deepEqual([ask.kind, ask.parent, ask.text],
    ['confirm', view.saveLoad.save.screen, 'Would you like to enter a personalized comment for this game?']);
  assert.deepEqual(saves.saved, []);
});

test('without a comment: the progress window fills, then it saves, closes the save screen and the options, in that order', () => {
  const { view, dialogs, log, ticker, saves, workflow, progress } = build();
  workflow.saveToSlot('save1');
  dialogs.shown[0].no();

  assert.equal(progress.title.text, 'Saving Mining Colony...');
  assert.deepEqual(log, [['show', progress.window, view.saveLoad.save.screen], ['show', progress.bar, undefined]]);
  assert.deepEqual(saves.saved, [], 'not until the bar is full');

  ticker.run();
  assert.deepEqual(log.slice(2), [
    ['hide', progress.window, view.saveLoad.save.screen],
    ['hide', progress.bar, undefined],
    'saved save1',
    ['hide', view.saveLoad.save.screen, view.options.menu],
    'closeOptions',
  ]);
  assert.deepEqual(saves.saved, [{ slot: 'save1', customName: '', day: 12 }]);
  assert.deepEqual(captions(view, 'save1'), ['Day:12', 'Day:12']);
});

test('with a comment: the field starts empty for a slot with no custom name, and the typed text names the save', () => {
  const { view, dialogs, ticker, saves, workflow } = build();
  workflow.saveToSlot('save1');
  dialogs.shown[0].yes();

  const [, input] = dialogs.shown;
  assert.deepEqual([input.kind, input.parent, input.text], ['input', view.saveLoad.save.screen, '']);
  view.message.message.inputText.text = 'Deep shaft';
  input.ok();
  ticker.run();

  assert.deepEqual(saves.saved, [{ slot: 'save1', customName: 'Deep shaft', day: 12 }]);
  assert.deepEqual(captions(view, 'save1'), ['Deep shaft', 'Deep shaft']);
});

test('a slot that already has a custom name offers it for editing', () => {
  const { dialogs, workflow } = build();
  workflow.saveToSlot('save2');
  dialogs.shown[0].yes();

  assert.equal(dialogs.shown[1].text, 'My colony');
});

test('cancelling the comment still saves, under no custom name', () => {
  const { view, dialogs, ticker, saves, workflow } = build();
  workflow.saveToSlot('save2');
  dialogs.shown[0].yes();
  view.message.message.inputText.text = 'typed then cancelled';
  dialogs.shown[1].cancel();
  ticker.run();

  assert.deepEqual(saves.saved, [{ slot: 'save2', customName: '', day: 12 }]);
});

// Exit & Save

test('Exit & Save saves the autosave behind the progress window, then leaves for the start screen', () => {
  const { view, dialogs, log, ticker, saves, workflow, progress } = build();
  workflow.exitAndSave();

  assert.deepEqual(dialogs.shown, [], 'the autosave asks nothing');
  assert.equal(progress.title.text, 'Saving Mining Colony...');
  assert.deepEqual(log[0], ['show', progress.window, view.options.menu]);

  ticker.run();
  assert.deepEqual(names(log), ['saved autoSave', 'closeOptions', 'leaveMineForStart', 'showStart']);
  assert.deepEqual(saves.saved, [{ slot: 'autoSave', customName: '', day: 12 }]);
});

// Loading

test('an empty slot loads nothing and says nothing', async () => {
  const { session, dialogs, log, ticker, workflow } = build();
  const before = session.getState();
  await workflow.load('save3', {});

  assert.deepEqual([dialogs.shown, log, ticker.listeners.size], [[], [], 0]);
  assert.equal(session.getState(), before);
});

test('a slot that cannot be loaded says so over its screen, and the colony is untouched', async () => {
  const { view, session, dialogs, log, workflow } = build({}, { stored: { save1: { not: 'a colony' } } });
  const before = session.getState();
  workflow.loadFromSlot('save1');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(dialogs.shown.map(({ parent, text }) => [parent, text]),
    [[view.saveLoad.load.screen, 'Unable to load that saved game. Your current game has not been changed.']]);
  assert.equal(session.getState(), before);
  assert.deepEqual(log, []);
});

test('a good slot replaces the colony at once, then the progress window leads to the loaded colony', async () => {
  const record = { ...structuredClone(gameDataInit), day: 77, credits: 4242 };
  const { view, session, log, ticker, workflow, progress } = build({}, { stored: { save1: record } });
  workflow.loadFromSlot('save1');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual([session.getState().day, session.getState().credits], [77, 4242], 'before the bar moves');
  assert.equal(progress.title.text, 'Preparing Mining Colony...');
  assert.deepEqual(log[0], ['show', progress.window, view.saveLoad.load.screen]);
  assert.deepEqual(names(log), [], 'nothing closes until the bar is full');

  ticker.run();
  assert.deepEqual(names(log), ['leaveLoadScreen', 'openLoadedColony']);
});

// The progress bar

test('the bar creeps until 60, then jumps, stops at 112, and lets go of the ticker', () => {
  const calls = [];
  const { ticker, workflow, progress } = build({}, { randomNum: (lo, hi) => { calls.push([lo, hi]); return hi; } });
  workflow.exitAndSave();
  const widths = [];
  for (let i = 0; i < 200 && ticker.listeners.size; i++) {
    ticker.run(1);
    widths.push(progress.bar.width);
  }

  // 500 * .005 = 2.5, floored to 2, while below 60; then 10 a tick, capped.
  assert.deepEqual(widths.slice(0, 3), [2, 4, 6]);
  assert.equal(widths.indexOf(60), 29);
  assert.deepEqual(widths.slice(29), [60, 70, 80, 90, 100, 110, 112]);
  assert.deepEqual(calls.slice(29, 31), [[0, 500], [1, 10]]);
  assert.equal(ticker.listeners.size, 0);
});

test('a bar that never fills never finishes', () => {
  const { ticker, saves, workflow } = build({}, { randomNum: () => 0 });
  workflow.exitAndSave();
  ticker.run(500);

  assert.equal(ticker.listeners.size, 1);
  assert.deepEqual(saves.saved, []);
});

// Captions

test('ending a colony leaves an empty autosave, on both screens', () => {
  const { view, saves, workflow } = build();
  const before = saves.minerSaves.autoSave;
  saves.minerSaves.autoSave.name = 'Day:40|Class:3';
  saves.minerSaves.autoSave.empty = false;
  workflow.resetAutosave();

  assert.deepEqual(saves.minerSaves.autoSave, emptySlot('autoSave'));
  assert.notEqual(saves.minerSaves.autoSave, before, 'a copy of what storage reset');
  assert.deepEqual(captions(view, 'autoSave'), [emptySlot('autoSave').name, emptySlot('autoSave').name]);
});

test('Load Mine from the options shows every slot as it is now', () => {
  const { view, saves, workflow } = build();
  saves.minerSaves.save3.name = 'Changed since';
  workflow.refreshLoadCaptions();

  assert.deepEqual(Object.fromEntries(Object.entries(view.saveLoad.load.slotLabels).map(([slot, label]) => [slot, label.text])), {
    autoSave: saves.minerSaves.autoSave.name, save1: 'Day:3|Class:1', save2: 'My colony', save3: 'Changed since',
  });
});
