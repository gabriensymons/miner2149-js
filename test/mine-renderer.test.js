import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameSession } from '../scripts/game-session.js';
import { createGameView } from '../scripts/game-view.js';
import { buildingMap, gameDataInit, shopItems } from '../scripts/gamedata.js';
import { createMineRenderer } from '../scripts/mine-renderer.js';
import {
  calculateOperationsReport, calculateProductionReport, countCompletedBuildingsByName,
} from '../scripts/simulation-calculations.js';
import { createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The renderer against the real scene, built on the fake Pixi, and a real
// session. What it pins is what reaches the screen from the colony.

/** Every callback `createGameView` takes, doing nothing: the renderer presses no buttons. */
const noCallbacks = new Proxy({}, { get: () => new Proxy({}, { get: () => () => undefined }) });

function build(change = {}, { buildingCount = () => 0 } = {}) {
  const { PIXI } = createFakePIXI();
  const buttons = recordingButtons();
  const stage = { addChild: (child) => child };
  const initial = structuredClone(gameDataInit);
  const slotNames = { autoSave: '', save1: '', save2: '', save3: '' };
  const view = createGameView({ PIXI, sheet: fakeSheet(), stage, buttons, initial, slotNames, on: noCallbacks });
  const session = createGameSession({ initialState: { ...initial, ...change } });
  const saleRequests = [];
  const counted = [];
  const renderer = createMineRenderer({
    session,
    view,
    shopItems,
    buildingNames: buildingMap,
    buildSpriteButton: buttons.buildSpriteButton,
    countBuildingsByName: (name) => { counted.push(name); return buildingCount(name); },
    requestSale: () => saleRequests.push(session.getState().diridium),
  });
  return { view, session, renderer, buttons, saleRequests, counted };
}

/** A copy of the colony's maps with one site set, as a placed building sets it. */
function withSite(maps, level, row, column, site) {
  const next = structuredClone(maps);
  next[level][`row${row}`][column] = site;
  return next;
}

/** What each binding of a report shows, by field. */
const shown = (bindings) => Object.fromEntries(Object.entries(bindings).map(([field, { label }]) => [field, label.text]));
const texts = (model) => Object.fromEntries(Object.entries(model).map(([field, { text }]) => [field, text]));

test('render writes every label on the mine screen, and the probe count, from the colony', () => {
  const { view, renderer } = build({
    probes: 3, day: 42, credits: 123456, shopBtn: 'Tube', shopPrice: 200, sellPrice: 17, wage: 550,
  });
  renderer.render();

  const { chrome, shop } = view.mine;
  assert.deepEqual(
    [view.start.probeCount.text, chrome.dayText.text, chrome.creditText.text, shop.caption.text, shop.price.text,
      chrome.sellPrice.text, chrome.wage.text],
    [3, '42', '123456', 'Tube', '200', '17', '550'],
  );
});

test('render reads the session as it is now, not as it was when the renderer was built', () => {
  const { view, session, renderer } = build({ day: 1, credits: 10 });
  session.update({ day: 2, credits: 20 });
  renderer.render();

  assert.deepEqual([view.mine.chrome.dayText.text, view.mine.chrome.creditText.text], ['2', '20']);
});

test('subscribed to the session, it redraws on every change', () => {
  const { view, session, renderer } = build();
  session.subscribe(renderer.render);
  session.update({ wage: 610 });

  assert.equal(view.mine.chrome.wage.text, '610');
});

test('each options checkbox is on the menu exactly when its flag is set, and taken off when it is not', () => {
  const { view, session, renderer } = build({ disasterMode: true, gridlinesEnabled: false });
  const { menu, checks } = view.options;
  const shows = () => [menu.children.includes(checks.disasterMode), menu.children.includes(checks.gridlines)];

  renderer.render();
  assert.deepEqual(shows(), [true, false]);

  session.update({ disasterMode: false, gridlinesEnabled: true });
  renderer.render();
  assert.deepEqual(shows(), [false, true]);
  assert.equal(menu.children.filter((child) => child === checks.gridlines).length, 1, 'added once, not per render');
});

test('the lit level button follows the colony level', () => {
  const lit = (view) => Object.entries(view.mine.chrome.levelSelected).filter(([, marker]) => marker.visible).map(([level]) => level);

  for (const level of ['level1', 'level2', 'level3']) {
    const { view, renderer } = build({ level });
    renderer.render();
    assert.deepEqual(lit(view), [level]);
  }

  const { view, renderer } = build({ level: 'level3' });
  renderer.updateLevelButtons('level2');
  assert.deepEqual(lit(view), ['level2'], 'updateLevelButtons lights the level it is given, ahead of the state');
});

test('exactly the selected shop item is lit, and a cleared selection lights none', () => {
  const lit = (view) => Object.entries(view.mine.shop.selected).filter(([, sprite]) => sprite.visible).map(([id]) => id);

  const selected = build({ shopBtn: 'Life Support', shopPrice: 1000 });
  selected.renderer.render();
  assert.deepEqual(lit(selected.view), ['lifeSupport']);

  selected.session.update({ shopBtn: '' });
  selected.renderer.render();
  assert.deepEqual(lit(selected.view), []);
});

test('an unaffordable selection turns the caption white over its highlight, and back when it is affordable', () => {
  const { view, session, renderer } = build({ shopBtn: 'Power Plant', shopPrice: 5000, credits: 4999 });
  const { caption, captionHighlight } = view.mine.shop;

  renderer.render();
  assert.deepEqual([caption.tint, captionHighlight.visible], [0xFFFFFF, true]);

  session.update({ credits: 5000 });
  renderer.render();
  assert.deepEqual([caption.tint, captionHighlight.visible], [0x000000, false]);
});

test('both reports show the report models of the colony as it is now', () => {
  const change = { day: 30, workers: 120, morale: 64, diridium: 4321, wage: 480 };
  const { view, session, renderer } = build(change);
  const maps = withSite(gameDataInit.maps, 'level2', 4, 7, 8);
  session.update({ maps });
  renderer.updateReports();

  const state = session.getState();
  const counts = countCompletedBuildingsByName(state.maps, buildingMap);
  assert.deepEqual(shown(view.reports.operations.bindings), texts(calculateOperationsReport(state)));
  assert.deepEqual(shown(view.reports.production.bindings), texts(calculateProductionReport(state, counts)));
  assert.equal(view.reports.production.bindings.mines.label.text, '1', 'the mine placed on level 2 is counted');
});

test('the reports count buildings from the maps, not through the injected counter', () => {
  const { view, session, renderer } = build({}, { buildingCount: () => 99 });
  session.update({ maps: withSite(gameDataInit.maps, 'level1', 0, 0, 8) });
  renderer.updateReports();

  assert.equal(view.reports.production.bindings.mines.label.text, '1');
});

test('a building still under construction is not counted in the reports', () => {
  const { view, session, renderer } = build();
  session.update({ maps: withSite(gameDataInit.maps, 'level1', 0, 0, 708) });
  renderer.updateReports();

  assert.equal(view.reports.production.bindings.mines.label.text, '0');
});

test('render redraws the reports too', () => {
  const { view, session, renderer } = build();
  session.update({ maps: withSite(gameDataInit.maps, 'level3', 9, 9, 8) });
  renderer.render();

  assert.equal(view.reports.production.bindings.mines.label.text, '1');
});

test('the storage icon is rebuilt as one sprite button in the fill band the colony is in', () => {
  // One storage building holds 50,000 tons and one processor 500, so 50,500 in all.
  const cases = [[0, 'empty'], [16664, 'empty'], [16665, 'third'], [33330, 'twoThirds'], [49995, 'full']];

  for (const [diridium, fill] of cases) {
    const { view, renderer, buttons, counted } = build({ diridium }, { buildingCount: () => 1 });
    const { storageIcon, storageTextures } = view.mine.chrome;
    renderer.updateReports();
    renderer.updateReports();

    const icon = buttons.calls.filter(({ args }) => args[0] === storageIcon);
    assert.equal(icon.length, 2, 'built on every update');
    assert.deepEqual(storageIcon.children, [icon[1]], `${diridium} tons: cleared before it is rebuilt`);
    const [, button, hitzone, normal, hover, down] = icon[1].args;
    assert.deepEqual([button, hitzone], [{ width: 14, height: 13, x: 0, y: 0 }, { width: 14, height: 13, x: 0, y: 0 }]);
    const { normal: n, hover: h, down: d } = storageTextures[fill];
    assert.deepEqual([normal, hover, down], [n, h, d], `${diridium} tons is ${fill}`);
    assert.deepEqual(counted.slice(0, 2), ['Processor', 'Storage']);
  }
});

test('processors and storage buildings hold different amounts, and the icon tells them apart', () => {
  // Two processors hold 1,000 tons, so 500 is half full. Two storage buildings would hold 100,000.
  const { view, renderer, buttons } = build({ diridium: 500 }, { buildingCount: (name) => (name === 'Processor' ? 2 : 0) });
  renderer.updateDiridiumStorageIcon();

  const [, , , normal] = buttons.calls.find(({ args }) => args[0] === view.mine.chrome.storageIcon).args;
  assert.equal(normal, view.mine.chrome.storageTextures.third.normal);
});

test('the storage icon arms on press and asks for a sale on release, reading the colony at the time', () => {
  const { view, session, renderer, buttons, saleRequests } = build({ diridium: 10 });
  renderer.updateDiridiumStorageIcon();
  const [, , , , , , pressed, released] = buttons.calls.find(({ args }) => args[0] === view.mine.chrome.storageIcon).args;

  assert.equal(pressed(), true);
  assert.deepEqual(saleRequests, []);
  session.update({ diridium: 25 });
  released();
  assert.deepEqual(saleRequests, [25]);
});

test('the renderer never writes the colony', () => {
  const { session, renderer } = build({ shopBtn: 'Tube', shopPrice: 200, level: 'level2' });
  const before = session.getState();
  let changes = 0;
  session.subscribe(() => { changes += 1; });

  renderer.render();
  renderer.updateReports();
  renderer.updateLevelButtons('level3');

  assert.equal(changes, 0);
  assert.equal(session.getState(), before);
});
