import assert from 'node:assert/strict';
import test from 'node:test';

import { createGameAssets } from '../scripts/game-assets.js';
import { regular } from '../scripts/font-styles.js';
import { buildingMap, gameDataInit } from '../scripts/gamedata.js';
import { renderReport } from '../scripts/report-renderer.js';
import {
  calculateOperationsReport,
  calculateProductionReport,
  countCompletedBuildingsByName,
} from '../scripts/simulation-calculations.js';
import { deepClone } from '../scripts/utilities.js';
import { createReportViews } from '../scripts/views/report-views.js';
import { FakeBitmapText, FakeGraphics, createFakePIXI, fakeSheet, recordingButtons } from './fake-pixi.js';

// The geometry below is written out rather than read from the module's own
// tables, so a changed coordinate fails here instead of agreeing with itself.
// Every value is what init() built before phase 9 moved it.

/** [field, x, y, text before the first render, highlighted] */
const OPERATIONS_LABELS = [
  ['workers', 55, 15, '20(0)', true],
  ['jobs', 55, 26, '100%', true],
  ['morale', 55, 37, '100%(0)', true],
  ['wage', 55, 48, '600', false],
  ['lifeSupport', 55, 59, '100%', true],
  ['food', 55, 70, '---', true],
  ['health', 55, 81, '---', true],
  ['occupancy', 55, 92, '---', true],
  ['deathRate', 55, 103, '0%', true],
];

const PRODUCTION_LABELS = [
  ['asteroidClass', 50, 17, '', false],
  ['mines', 50, 29, '0', false],
  ['processors', 50, 41, 'None', true],
  ['storage', 50, 53, '0%', true],
  ['power', 50, 65, '100%', true],
  ['diridium', 50, 77, '0 tons', false],
  ['projectedCredits', 50, 89, '0', true],
];

function build({ wage = 600 } = {}) {
  const { PIXI } = createFakePIXI();
  const sheet = fakeSheet();
  const assets = createGameAssets({ PIXI, sheet });
  const buttons = recordingButtons();
  const on = { closeOperations: () => 'close operations', closeProduction: () => 'close production' };
  const views = createReportViews({ PIXI, sheet, assets, buildTextButton: buttons.buildTextButton, wage, on });
  return { views, assets, buttons, on };
}

test('both reports open at the same spot, with their extension tab beside them', () => {
  const { views } = build();

  for (const [name, frame, extensionFrame] of [
    ['operations', 'report operations.gif', 'window extension operations.gif'],
    ['production', 'report production.gif', 'window extension production.gif'],
  ]) {
    const { report, extension } = views[name];
    assert.equal(report.texture.name, frame);
    assert.deepEqual([report.x, report.y], [5, 17]);
    assert.equal(extension.texture.name, extensionFrame);
    assert.deepEqual([extension.x, extension.y], [104, 47]);
  }
});

test('every value sits where it always has, showing its placeholder until the first render', () => {
  const { views } = build();

  for (const [name, labels] of [['operations', OPERATIONS_LABELS], ['production', PRODUCTION_LABELS]]) {
    const { bindings } = views[name];
    assert.deepEqual(Object.keys(bindings), labels.map(([field]) => field), `${name}: fields in reading order`);
    for (const [field, x, y, text] of labels) {
      const { label } = bindings[field];
      assert.ok(label instanceof FakeBitmapText, `${name}.${field} is bitmap text`);
      assert.equal(label.style, regular);
      assert.deepEqual([label.x, label.y, label.text], [x, y, text], `${name}.${field}`);
    }
  }
});

test('the wage label starts from the colony, not a placeholder', () => {
  assert.equal(build({ wage: 450 }).views.operations.bindings.wage.label.text, '450');
});

test('a highlight is a hidden 23x11 black box under the value it marks, and only where a value can go wrong', () => {
  const { views } = build();

  for (const [name, labels] of [['operations', OPERATIONS_LABELS], ['production', PRODUCTION_LABELS]]) {
    const { report, bindings } = views[name];
    for (const [field, x, y, , highlighted] of labels) {
      const { highlight, label } = bindings[field];
      if (!highlighted) {
        assert.equal(highlight, undefined, `${name}.${field} has no highlight`);
        continue;
      }
      assert.ok(highlight instanceof FakeGraphics);
      assert.deepEqual(highlight.drawn, [['beginFill', 0x000000], ['drawRect', 0, 0, 23, 11], ['endFill']]);
      assert.deepEqual([highlight.x, highlight.y, highlight.visible], [x, y, false], `${name}.${field}`);
      assert.ok(
        report.children.indexOf(highlight) < report.children.indexOf(label),
        `${name}.${field}: the highlight is beneath its value`,
      );
    }
  }
});

test('each report is its highlights, then its values, then its OK button, which closes it', () => {
  const { views, assets, buttons, on } = build();

  for (const [name, labels, close] of [
    ['operations', OPERATIONS_LABELS, on.closeOperations],
    ['production', PRODUCTION_LABELS, on.closeProduction],
  ]) {
    const { report, ok, bindings } = views[name];
    const highlights = labels.filter(([, , , , highlighted]) => highlighted).map(([field]) => bindings[field].highlight);
    const values = labels.map(([field]) => bindings[field].label);
    assert.deepEqual(report.children, [...highlights, ...values, ok]);

    const menu = assets.menuButton;
    assert.deepEqual(ok.args, [report, 42, 13, 28, 119, menu.normal, menu.hover, menu.down, close, 'OK']);
  }
  assert.equal(buttons.calls.length, 2);
});

// The bindings are keyed by the view model's own field names, which is what
// lets updateReports() hand them to the renderer as they are.
test('the real report models render into these bindings without a missing field', () => {
  const { views } = build();
  const state = { ...deepClone(gameDataInit), difficulty: 2 };
  const counts = countCompletedBuildingsByName(state.maps, buildingMap);

  const operations = calculateOperationsReport(state);
  const production = calculateProductionReport(state, counts);
  renderReport(operations, views.operations.bindings);
  renderReport(production, views.production.bindings);

  assert.equal(views.operations.bindings.wage.label.text, operations.wage.text);
  assert.equal(views.production.bindings.diridium.label.text, production.diridium.text);
});
