import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit } from '../scripts/gamedata.js';
import { createOptionsController } from '../scripts/options-controller.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The controller against the real scene on the fake Pixi and a real session,
// with the dialogs, screens, map view, flow and save workflow recording fakes.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

function build(change = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({ initialState: { ...initial, ...change } });
  const log = [];
  const asked = [];
  const options = createOptionsController({
    session,
    view,
    dialogs: { confirm: (parent, text, yes, no) => asked.push({ parent, text, yes, no }) },
    screens: {
      show: (sprite, parent) => log.push(['show', sprite, parent]),
      hide: (sprite, parent) => log.push(['hide', sprite, parent]),
    },
    // Reads the flag when it draws, as the real map view's accessor does.
    mapView: { draw: (map) => log.push(['draw', map, session.getState().gridlinesEnabled]) },
    flow: { openLoadFromOptions: () => log.push('openLoadFromOptions') },
    saveWorkflow: { refreshLoadCaptions: () => log.push('refreshLoadCaptions') },
  });
  return { view, session, log, asked, options };
}

test('turning Disaster Mode on asks first, over the options menu, and only yes turns it on', () => {
  const yes = build({ disasterMode: false });
  yes.options.toggleDisasterMode();
  assert.equal(yes.asked.length, 1);
  assert.equal(yes.asked[0].parent, yes.view.options.menu);
  assert.match(yes.asked[0].text, /^This raises the chance of disasters while it is on\./);
  assert.match(yes.asked[0].text, /A colony played entirely in Disaster Mode is ranked on its own leaderboard\.\nEnable it\?$/,
    'the question on a line of its own');
  assert.equal(yes.session.getState().disasterMode, false, 'not until answered');
  yes.asked[0].yes();
  assert.equal(yes.session.getState().disasterMode, true);

  const no = build({ disasterMode: false });
  no.options.toggleDisasterMode();
  no.asked[0].no();
  assert.equal(no.session.getState().disasterMode, false);
});

test('turning Disaster Mode off asks nothing', () => {
  const { session, asked, options } = build({ disasterMode: true });
  options.toggleDisasterMode();

  assert.deepEqual(asked, []);
  assert.equal(session.getState().disasterMode, false);
});

test('Grid Lines flips the flag and redraws the level on screen, with the flag already flipped', () => {
  // Levels made distinct, so drawing the wrong one cannot compare equal.
  const maps = structuredClone(gameDataInit.maps);
  maps.level2.row0[0] = 4;
  maps.level3.row0[0] = 3;
  const { session, log, options } = build({ gridlinesEnabled: false, level: 'level2', maps });
  options.toggleGridlines();

  assert.equal(session.getState().gridlinesEnabled, true);
  assert.deepEqual(log, [['draw', session.getState().maps.level2, true]], 'level 2, drawn with the flag already on');

  options.toggleGridlines();
  assert.equal(session.getState().gridlinesEnabled, false);
  assert.equal(log.length, 2);
});

test('Save Mine opens over the options menu with the menu\'s extension tab beside it', () => {
  const { view, log, options } = build();
  options.openSaveMine();

  assert.deepEqual(log, [
    ['show', view.saveLoad.save.screen, view.options.menu],
    ['show', view.options.extension, undefined],
  ]);
});

test('Load Mine from the options opens the load screen and shows the slots as they are now', () => {
  const { log, options } = build();
  options.openLoadMine();

  assert.deepEqual(log, ['openLoadFromOptions', 'refreshLoadCaptions']);
});
