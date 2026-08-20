import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { renderReport } from '../scripts/report-renderer.js';

function alertBinding() {
  return {
    label: { text: 'stale', tint: 0x123456, width: 17 },
    highlight: { visible: true, width: 1 },
  };
}

test('renderReport clears every stale tint and highlight after alerting values become healthy or unavailable', () => {
  const bindings = {
    jobs: alertBinding(),
    lifeSupport: alertBinding(),
    processors: alertBinding(),
  };

  renderReport({
    jobs: { text: '49%', alert: true },
    lifeSupport: { text: '79%', alert: true },
    processors: { text: '101%', alert: true },
  }, bindings);

  for (const binding of Object.values(bindings)) {
    assert.equal(binding.label.tint, 0xffffff);
    assert.equal(binding.highlight.visible, true);
    assert.equal(binding.highlight.width, 17);
  }

  renderReport({
    jobs: { text: '50%', alert: false },
    lifeSupport: { text: '---', alert: false },
    processors: { text: 'None', alert: false },
  }, bindings);

  assert.equal(bindings.jobs.label.text, '50%');
  assert.equal(bindings.lifeSupport.label.text, '---');
  assert.equal(bindings.processors.label.text, 'None');
  for (const binding of Object.values(bindings)) {
    assert.equal(binding.label.tint, 0x000000);
    assert.equal(binding.highlight.visible, false);
  }
});

test('renderReport refreshes fields without alert visuals on every render', () => {
  const bindings = {
    wage: { label: { text: '500', tint: 0x000000, width: 10 } },
  };

  renderReport({ wage: { text: '600' } }, bindings);
  assert.equal(bindings.wage.label.text, '600');

  renderReport({ wage: { text: '700' } }, bindings);
  assert.equal(bindings.wage.label.text, '700');
});

test('app updateReports delegates report math and rendering to the pure modules', async () => {
  const source = await readFile(new URL('../scripts/app.js', import.meta.url), 'utf8');
  const updateReports = source.match(
    /function updateReports\([^)]*\) \{([\s\S]*?)\n\}\n\nfunction updateDiridiumStorageIcon/,
  )?.[1];

  assert.match(source, /from '\.\/simulation-calculations\.js'/);
  assert.match(source, /from '\.\/report-renderer\.js'/);
  assert.match(updateReports, /countCompletedBuildingsByName\(gameData\.maps, buildingMap\)/);
  assert.match(updateReports, /calculateOperationsReport\(gameData\)/);
  assert.match(updateReports, /calculateProductionReport\(gameData, buildingCounts\)/);
  assert.match(updateReports, /renderReport\(operationsViewModel,/);
  assert.match(updateReports, /renderReport\(productionViewModel,/);
  assert.doesNotMatch(updateReports, /Math\.(?:floor|ceil)\([^\n]*gameData/);
  assert.doesNotMatch(updateReports, /countBuildingsByName/);
});
