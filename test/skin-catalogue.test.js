import assert from 'node:assert/strict';
import test from 'node:test';
import { access } from 'node:fs/promises';

import {
  DEFAULT_SKIN_IDS,
  SKIN_CATALOGUE,
  SKIN_UNLOCK_EVENT,
  UNLOCK_TRIGGERS,
  skinById,
  skinCssVariables,
  skinForTrigger,
  skinIds,
} from '../scripts/skin-catalogue.js';

const skinsDirectory = new URL('../assets/skins/', import.meta.url);

test('every catalogue entry names a frame that is actually on disk', async () => {
  assert.equal(SKIN_CATALOGUE.length, 11);
  for (const skin of SKIN_CATALOGUE) {
    await assert.doesNotReject(
      access(new URL(skin.file, skinsDirectory)),
      `${skin.file} is missing from assets/skins/`,
    );
  }
});

test('ids are unique, kebab-case, and safe to write into a CSS attribute selector', () => {
  const ids = skinIds();

  assert.deepEqual(ids, [...new Set(ids)], 'ids are unique');
  for (const id of ids) {
    assert.match(id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${id} is kebab-case`);
  }
  // The id is written to frame.dataset.skin, which CSS matches on. Anything
  // needing escaping there would silently fail to paint.
  assert.ok(!ids.some((id) => /["'\\\s]/.test(id)));
});

test('four frames start unlocked and every other one has a distinct trigger', () => {
  assert.deepEqual(DEFAULT_SKIN_IDS, ['astrodyne', 'tc-ii', 'trekstat', 'enkom']);
  assert.deepEqual(UNLOCK_TRIGGERS, [...new Set(UNLOCK_TRIGGERS)], 'one skin per trigger');
  assert.deepEqual([...UNLOCK_TRIGGERS].sort(), [
    'alien-artifact',
    'disaster-mode-completion',
    'konami',
    'level-three-mine',
    'lifetime-earnings',
    'meteor-storm',
    'time-shift',
  ]);
  assert.equal(DEFAULT_SKIN_IDS.length + UNLOCK_TRIGGERS.length, SKIN_CATALOGUE.length);
});

test('lookups resolve, and miss cleanly rather than throwing', () => {
  assert.equal(skinById('precursor').label, 'Precursor');
  assert.equal(skinById('palm-iiic'), null, 'a retired Palm id no longer resolves');
  assert.equal(skinForTrigger('meteor-storm').id, 'dsef-102');
  assert.equal(skinForTrigger('not-a-trigger'), null);
});

test('every entry carries lore and a display slot for the locked label', () => {
  for (const skin of SKIN_CATALOGUE) {
    assert.ok(skin.lore.length > 40, `${skin.id} has real lore`);
    assert.ok(skin.label.length > 0);
  }
  assert.deepEqual(
    SKIN_CATALOGUE.map(({ slot }) => slot),
    Array.from({ length: SKIN_CATALOGUE.length }, (_, index) => index + 1),
    'slots number the frames 1..n for the "Locked - frame 05" label',
  );
});

test('the unlock event name is a namespaced constant both entry points can share', () => {
  assert.equal(SKIN_UNLOCK_EVENT, 'miner2149:skin-unlocked');
});

test('CSS variables are derived from the measured pixels, not transcribed', () => {
  // AstroDyne: 1024x1536 image, 618px square cutout at (204,158).
  const astrodyne = skinCssVariables(skinById('astrodyne'));

  assert.deepEqual(astrodyne, {
    '--skin-factor': '1.656958',      // 1024 / 618
    '--skin-aspect': '1024 / 1536',
    '--screen-left': '19.922%',       // 204 / 1024
    '--screen-top': '10.286%',        // 158 / 1536
    '--screen-width': '60.352%',      // 618 / 1024
    '--skin-image': 'url("/assets/skins/AstroDyne.png")',
  });
});

test('the frame is scaled so the cutout comes out exactly one game-size across', () => {
  // This is the whole point of --skin-factor, and the invariant the old
  // hand-written CSS had to be trusted to hold: frame width x screen share = 1.
  for (const skin of SKIN_CATALOGUE) {
    const variables = skinCssVariables(skin);
    const factor = Number(variables['--skin-factor']);
    const share = Number(variables['--screen-width'].replace('%', '')) / 100;

    assert.ok(
      Math.abs(factor * share - 1) < 1e-4,
      `${skin.id}: factor ${factor} x screen share ${share} should be 1`,
    );
  }
});

test('cutouts are square, because the canvas is positioned by width alone', () => {
  // A non-square cutout means the canvas cannot fill the hole in both axes.
  // One pixel of tolerance for rounding in the source art; more is a real bug.
  for (const skin of SKIN_CATALOGUE) {
    const difference = Math.abs(skin.screenWidth - skin.screenHeight);
    assert.ok(
      difference <= 1,
      `${skin.id} cutout is ${skin.screenWidth}x${skin.screenHeight}`,
    );
  }
});

test('the cutout sits inside the image it was measured from', () => {
  for (const skin of SKIN_CATALOGUE) {
    assert.ok(skin.screenX >= 0 && skin.screenY >= 0, `${skin.id} origin is positive`);
    assert.ok(
      skin.screenX + skin.screenWidth <= skin.imageWidth
      && skin.screenY + skin.screenHeight <= skin.imageHeight,
      `${skin.id} cutout overflows its image`,
    );
  }
});

test('the catalogue is frozen, so a caller cannot corrupt the shared list', () => {
  assert.throws(() => { SKIN_CATALOGUE.push({}); });
  assert.throws(() => { SKIN_CATALOGUE[0].id = 'tampered'; });
});
