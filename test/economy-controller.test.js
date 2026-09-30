import assert from 'node:assert/strict';
import test from 'node:test';

import { createEconomyController, SELL_REPEAT_MS } from '../scripts/economy-controller.js';
import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { gameDataInit, shopItems } from '../scripts/gamedata.js';
import { LIFETIME_EARNINGS_TARGET, readUnlockProgress } from '../scripts/unlock-progress.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The controller against the real scene, built on the fake Pixi, and a real
// session. Everything it is handed from elsewhere is a fake that records.

const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

/** Dialogs that record what was shown and hold each message's callback until the test dismisses it. */
function fakeDialogs() {
  const shown = [];
  return {
    shown,
    message: (parent, text, onClose) => { shown.push({ kind: 'message', parent, text, onClose }); },
    notice: (text) => { shown.push({ kind: 'notice', text }); },
    dismiss() {
      const open = shown.filter(({ onClose }) => onClose && !onClose.done);
      const last = open[open.length - 1];
      last.onClose.done = true;
      last.onClose();
    },
  };
}

/** Which sprites are shown over which parent, as the stage manager would hold them. */
function fakeScreens() {
  const calls = [];
  const mounted = new Set();
  return {
    calls,
    mounted,
    show: (sprite, parent) => { calls.push(['show', sprite, parent]); mounted.add(sprite); },
    hide: (sprite, parent) => { calls.push(['hide', sprite, parent]); mounted.delete(sprite); },
  };
}

/** Intervals that run only when the test advances the clock. */
function fakeTimers() {
  const running = new Map();
  let next = 1;
  return {
    running,
    setInterval: (run, ms) => { const id = next++; running.set(id, { run, ms }); return id; },
    clearInterval: (id) => { running.delete(id); },
    tick(times = 1) {
      for (let i = 0; i < times; i++) for (const { run } of [...running.values()]) run();
    },
  };
}

function fakeStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => { values.set(key, String(value)); },
    removeItem: (key) => { values.delete(key); },
  };
}

function build(change = {}, { buildings = {} } = {}) {
  const { PIXI } = createFakePIXI();
  const initial = structuredClone(gameDataInit);
  const view = createGameView({
    PIXI, sheet: fakeSheet(), stage: { addChild: (child) => child }, buttons: recordingButtons(), initial,
    slotNames: { autoSave: '', save1: '', save2: '', save3: '' }, on: noCallbacks,
  });
  const session = createGameSession({ initialState: { ...initial, ...change } });
  const dialogs = fakeDialogs();
  const screens = fakeScreens();
  const timers = fakeTimers();
  const storage = fakeStorage();
  const granted = [];
  const economy = createEconomyController({
    session,
    view,
    shopItems,
    dialogs,
    screens,
    countBuildingsByName: (name) => buildings[name] ?? 0,
    grantSkinForTrigger: (trigger) => granted.push(trigger),
    storage,
    timers,
  });
  const dialog = view.sell.dialog;
  const amount = view.sell.amount;
  return { view, session, economy, dialogs, screens, timers, storage, granted, dialog, amount };
}

// Wages

test('the wage arrows move the wage a step at a time, through the session', () => {
  const { session, economy } = build({ wage: 400, wageMax: 90000 });
  const changes = [];
  session.subscribe((state) => changes.push(state.wage));

  economy.wageUp();
  economy.wageUp();
  economy.wageDown();
  assert.deepEqual(changes, [450, 500, 450]);
});

test('a wage arrow arms only when releasing it would change the wage, and does nothing otherwise', () => {
  const top = build({ wage: 90000, wageMax: 90000 });
  let changes = 0;
  top.session.subscribe(() => { changes += 1; });
  assert.equal(top.economy.armWageUp(), undefined);
  assert.equal(top.economy.armWageDown(), true);
  top.economy.wageUp();
  assert.equal(changes, 0, 'no write at the maximum, so no repaint');

  const bottom = build({ wage: 0, wageMax: 90000 });
  assert.equal(bottom.economy.armWageDown(), undefined);
  assert.equal(bottom.economy.armWageUp(), true);
  bottom.economy.wageDown();
  assert.equal(bottom.session.getState().wage, 0);
});

// Shop

test('picking a shop item selects it at its price for the colony', () => {
  const { session, economy } = build({ shopBtn: 'Bulldozer', multiplier: 3 });
  economy.shop('powerPlant');

  assert.deepEqual(
    [session.getState().shopBtn, session.getState().shopPrice],
    [shopItems.powerPlant.name, shopItems.powerPlant.price * 3],
  );
});

test('picking the item already selected changes nothing, so it cannot be unselected', () => {
  const { session, economy } = build({ shopBtn: 'Tube', shopPrice: 1 });
  let changes = 0;
  session.subscribe(() => { changes += 1; });
  economy.shop('tube');

  assert.equal(changes, 0);
  assert.equal(session.getState().shopPrice, 1);
});

// Asking for a sale

test('with no diridium, asking for a sale says so and opens nothing', () => {
  const { economy, dialogs, screens } = build({ diridium: 0 });
  economy.requestSale();

  assert.deepEqual(dialogs.shown.map(({ kind, text }) => [kind, text]), [['notice', 'You currently have no diridium to sell.']]);
  assert.deepEqual(screens.calls, []);
});

test('after a sale today without a space port, a second is refused', () => {
  const { economy, dialogs, screens } = build({ diridium: 5000, soldToday: true });
  economy.requestSale();

  assert.equal(dialogs.shown.length, 1);
  assert.match(dialogs.shown[0].text, /^Prior sale still being transfered\./);
  assert.deepEqual(screens.calls, []);
});

test('with a space port, the dialog opens over the mine screen at the whole stock', () => {
  const { view, economy, dialogs, screens, dialog, amount } = build(
    { diridium: 48000, soldToday: true },
    { buildings: { 'Space Port': 1 } },
  );
  economy.requestSale();

  assert.deepEqual(dialogs.shown, []);
  assert.deepEqual(screens.calls, [['show', dialog, view.mine.screen]]);
  assert.equal(amount.text, 48000);
});

test('without a space port, the cap is explained first, the amount set behind it, and the dialog opens on dismissal', () => {
  const { view, economy, dialogs, screens, dialog, amount } = build({ diridium: 48000, soldToday: false });
  economy.requestSale();

  assert.equal(dialogs.shown.length, 1);
  assert.equal(dialogs.shown[0].parent, view.options.menu, 'parented as the port has always parented it');
  assert.match(dialogs.shown[0].text, /only one sale up to 700 tons can be sold per day\.$/);
  assert.equal(amount.text, 700, 'already set behind the message');
  assert.deepEqual(screens.calls, [], 'not open until the message is dismissed');

  dialogs.dismiss();
  assert.deepEqual(screens.calls, [['show', dialog, view.mine.screen]]);
});

// Setting the amount

test('holding an arrow repeats every tenth of a second, and letting go stops it', () => {
  const { economy, timers, amount } = build({ diridium: 48000 }, { buildings: { 'Space Port': 1 } });
  economy.requestSale();

  assert.equal(economy.startLoweringSale(), true, 'the arrow arms');
  assert.deepEqual([...timers.running.values()].map(({ ms }) => ms), [SELL_REPEAT_MS]);
  assert.equal(SELL_REPEAT_MS, 100);
  timers.tick(3);
  // 48,000 less 10,000 twice, then 11,000 on the third: the original's ladder
  // is sequential ifs, and 18,000 falls into the next rung in the same press.
  assert.equal(amount.text, 17000);

  economy.stopSaleRepeat();
  assert.equal(timers.running.size, 0);
  timers.tick();
  assert.equal(amount.text, 17000);
});

test('pressing a second arrow while one is held does not start another repeat', () => {
  const { economy, timers } = build({ diridium: 48000 }, { buildings: { 'Space Port': 1 } });
  economy.requestSale();
  economy.startLoweringSale();
  economy.startRaisingSale();
  assert.equal(timers.running.size, 1, 'down held, then up');
  economy.stopSaleRepeat();

  economy.startRaisingSale();
  economy.startLoweringSale();
  assert.equal(timers.running.size, 1, 'up held, then down');
  economy.stopSaleRepeat();
  economy.stopSaleRepeat();
  assert.equal(timers.running.size, 0);
  economy.startLoweringSale();
  assert.equal(timers.running.size, 1, 'free to start again once released');
});

test('raising stops at the stock, and at 700 tons without a space port', () => {
  const withPort = build({ diridium: 950 }, { buildings: { 'Space Port': 1 } });
  withPort.economy.requestSale();
  withPort.economy.startLoweringSale();
  withPort.timers.tick(3);
  withPort.economy.stopSaleRepeat();
  withPort.economy.startRaisingSale();
  withPort.timers.tick(10);
  assert.equal(withPort.amount.text, 950);

  const noPort = build({ diridium: 48000 });
  noPort.economy.requestSale();
  noPort.dialogs.dismiss();
  noPort.economy.startRaisingSale();
  noPort.timers.tick(5);
  assert.equal(noPort.amount.text, 700);
});

test('raising reads the stock at each step, not when the dialog opened', () => {
  const { session, economy, timers, amount } = build({ diridium: 950 }, { buildings: { 'Space Port': 1 } });
  economy.requestSale();
  economy.startLoweringSale();
  timers.tick(5);
  economy.stopSaleRepeat();
  session.update({ diridium: 600 });
  economy.startRaisingSale();
  timers.tick(10);

  assert.equal(amount.text, 600);
});

// Selling

test('selling takes the diridium at once and pays when the receipt is dismissed', () => {
  const { view, session, economy, dialogs, screens, dialog } = build(
    { diridium: 48000, credits: 1000, sellPrice: 20, soldToday: false },
    { buildings: { 'Space Port': 1 } },
  );
  economy.requestSale();
  economy.startLoweringSale();
  economy.stopSaleRepeat();
  economy.sellDiridium();

  assert.deepEqual(screens.calls.at(-1), ['hide', dialog, view.mine.screen]);
  assert.deepEqual([session.getState().diridium, session.getState().soldToday, session.getState().credits], [0, true, 1000]);
  assert.deepEqual(dialogs.shown.map(({ parent, text }) => [parent, text]), [[view.mine.screen, 'Sold! for 960000 credits.']]);

  dialogs.dismiss();
  assert.equal(session.getState().credits, 961000);
});

test('the sale is of the amount set in the dialog, not the stock', () => {
  const { session, economy, dialogs, timers } = build(
    { diridium: 48000, credits: 0, sellPrice: 10 },
    { buildings: { 'Space Port': 1 } },
  );
  economy.requestSale();
  economy.startLoweringSale();
  timers.tick(2);
  economy.stopSaleRepeat();
  economy.sellDiridium();
  dialogs.dismiss();

  assert.deepEqual([session.getState().diridium, session.getState().credits], [20000, 280000]);
});

test('the payment is added to the balance at dismissal, whatever it has become since the sale', () => {
  const { session, economy, dialogs } = build({ diridium: 500, credits: 1000, sellPrice: 2 });
  economy.requestSale();
  dialogs.dismiss();
  economy.sellDiridium();
  session.update({ credits: 50 });
  dialogs.dismiss();

  assert.equal(session.getState().credits, 1050);
});

test('cancelling closes the dialog and changes nothing', () => {
  const { view, session, economy, screens, dialog } = build({ diridium: 900 }, { buildings: { 'Space Port': 1 } });
  economy.requestSale();
  const before = session.getState();
  economy.cancelSale();

  assert.deepEqual(screens.calls.at(-1), ['hide', dialog, view.mine.screen]);
  assert.equal(session.getState(), before);
});

// Lifetime earnings. These replaced unlock-wiring's check of app.js's source.

test('lifetime earnings are recorded from the sale value, on dismissal, not from the credit balance', () => {
  const { economy, dialogs, storage } = build({ diridium: 300, credits: 1_000_000, sellPrice: 7 }, { buildings: { 'Space Port': 1 } });
  economy.requestSale();
  economy.sellDiridium();
  assert.equal(readUnlockProgress(storage).lifetimeDiridiumCredits, 0, 'nothing until the receipt is dismissed');

  dialogs.dismiss();
  assert.equal(readUnlockProgress(storage).lifetimeDiridiumCredits, 2100);
});

test('crossing the lifetime target grants the lifetime-earnings frame, once', () => {
  const price = 100;
  const tons = LIFETIME_EARNINGS_TARGET / price / 2;
  const { session, economy, dialogs, granted } = build({ diridium: tons * 3, sellPrice: price }, { buildings: { 'Space Port': 1 } });

  for (let sale = 1; sale <= 3; sale++) {
    session.update({ diridium: tons });
    economy.requestSale();
    economy.sellDiridium();
    dialogs.dismiss();
    assert.deepEqual(granted, sale < 2 ? [] : ['lifetime-earnings'], `after sale ${sale}`);
  }
});

test('a sandbox sale pays but records nothing and grants nothing', () => {
  const { session, economy, dialogs, storage, granted } = build(
    { diridium: 20000, credits: 0, sellPrice: 100, devSandbox: true },
    { buildings: { 'Space Port': 1 } },
  );
  economy.requestSale();
  economy.sellDiridium();
  dialogs.dismiss();

  assert.equal(session.getState().credits, 2_000_000);
  assert.equal(readUnlockProgress(storage).lifetimeDiridiumCredits, 0);
  assert.deepEqual(granted, []);
});
