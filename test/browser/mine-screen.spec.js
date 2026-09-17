import { expect, test } from '@playwright/test';

import { DAY_PICKER_CANCEL, DAY_PICKER_ORIGIN, dayPickerCells } from '../../scripts/day-picker.js';
import {
  clickLogical,
  hoverLogical,
  parkPointer,
  reachMineScreen,
  screenshotLogicalRegion,
  seedSaveWithSelection,
  waitForCanvasToSettle,
} from './helpers.js';

// The mine screen itself: hover feedback, the advance-day picker, and what a
// loaded colony puts back on screen.

// The picker's twenty cells are loop-generated, so they cannot be covered by the
// source-text matchers that guard the rest of app.js. day-picker.test.js carries
// the layout; this carries the wiring.
const ADVANCE_MENU_ORIGIN = DAY_PICKER_ORIGIN;

function cellCentre(day) {
  const { hitzone } = dayPickerCells().find((cell) => cell.day === day);
  return [
    ADVANCE_MENU_ORIGIN.x + hitzone.x + Math.floor(hitzone.width / 2),
    ADVANCE_MENU_ORIGIN.y + hitzone.y + Math.floor(hitzone.height / 2),
  ];
}

// The shop row: both icon rows, plus the caption and price beneath them.
const SHOP_ROW = { x: 4, y: 117, width: 96, height: 42 };

const LOAD_MINE_BUTTON = [80, 98];
// The load dialog sits at y=13, so its slot rows are offset from the
// container-local coordinates the buttons are built with.
const FIRST_SAVE_SLOT = [54, 70];
const BULLDOZER_ICON = [13, 125];
const HYDROPONICS_ICON = [44, 125];

// The three level buttons, top right of the mine screen.
const LEVEL_BUTTONS = { x: 113, y: 26, width: 47, height: 16 };
const LEVEL_TWO_BUTTON = [136, 34];

test('mine-screen sprite controls display hover states', async ({ page }) => {
  // By far the longest test here: it drives the whole mine screen and compares
  // full-canvas screenshots at every step, dozens of them. That costs about
  // nine seconds on a developer machine and several times more on a CI runner,
  // which renders the canvas in software -- enough to exceed the default
  // thirty-second budget three quarters of the way through. The work is real,
  // so it gets a realistic budget rather than being trimmed to fit.
  test.slow();

  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(250);

  let previousScreen = await canvas.screenshot();
  await clickLogical(canvas, 80, 81);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(previousScreen);
  await page.waitForTimeout(100);

  previousScreen = await canvas.screenshot();
  await clickLogical(canvas, 106, 132);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(previousScreen);
  await page.waitForTimeout(100);

  previousScreen = await canvas.screenshot();
  await clickLogical(canvas, 30, 37);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(previousScreen);
  // Everything below compares against a pixel baseline, so it has to be a
  // settled frame on any machine, not one captured after a hopeful sleep.
  await waitForCanvasToSettle(page, canvas);

  // (105,130) is a neutral spot: nothing there reacts to the pointer, so the
  // baseline records the mine screen with no control highlighted. Every
  // comparison against it below has to be made with the pointer back here.
  const NEUTRAL = [105, 130];
  await hoverLogical(canvas, ...NEUTRAL);
  let normalMineScreen = await canvas.screenshot();
  const normalMap = await screenshotLogicalRegion(page, canvas, 2, 15, 100, 100);
  const normalStorageIcon = await screenshotLogicalRegion(page, canvas, 145, 113, 15, 15);

  for (const reportX of [121, 136]) {
    await clickLogical(canvas, reportX, 62);
    await expect.poll(async () => canvas.screenshot()).not.toEqual(normalMineScreen);
    await clickLogical(canvas, 54, 142);
    // Closing the report leaves the pointer sitting on a mine-screen control,
    // which then draws its hover state -- so the screen legitimately does not
    // match a baseline taken with the pointer elsewhere. Whether Pixi has
    // processed that hover before the next screenshot is a race: it had not on
    // a developer laptop, and had about half the time on a CI runner, which is
    // exactly how this failed in CI and passed everywhere else.
    await hoverLogical(canvas, ...NEUTRAL);
    await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);
  }

  for (const [x, y] of [[7, 20], [29, 125], [13, 138], [89, 138]]) {
    await hoverLogical(canvas, x, y);
    await expect.poll(
      async () => canvas.screenshot(),
      { message: `hover at logical (${x}, ${y}) changes the canvas` },
    ).not.toEqual(normalMineScreen);

    await hoverLogical(canvas, 105, 130);
    await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);
  }

  await clickLogical(canvas, 29, 125);
  await hoverLogical(canvas, 105, 130);
  const alternateShopSelection = await canvas.screenshot();
  await hoverLogical(canvas, 13, 125);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(alternateShopSelection);
  await clickLogical(canvas, 13, 125);
  await hoverLogical(canvas, 105, 130);
  normalMineScreen = await canvas.screenshot();

  await hoverLogical(canvas, 136, 33);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalMineScreen);

  await hoverLogical(canvas, 105, 130);
  await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);

  await hoverLogical(canvas, 136, 91);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalMineScreen);

  await hoverLogical(canvas, 105, 130);
  await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);

  await hoverLogical(canvas, 152, 120);
  await expect.poll(
    async () => screenshotLogicalRegion(page, canvas, 145, 113, 15, 15),
  ).not.toEqual(normalStorageIcon);

  await hoverLogical(canvas, 105, 130);
  await expect.poll(
    async () => screenshotLogicalRegion(page, canvas, 145, 113, 15, 15),
  ).toEqual(normalStorageIcon);
  normalMineScreen = await canvas.screenshot();

  for (const x of [121, 136, 152]) {
    await hoverLogical(canvas, 105, 130);
    await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);

    await hoverLogical(canvas, x, 62);
    await expect.poll(async () => canvas.screenshot()).not.toEqual(normalMineScreen);
  }

  await page.mouse.down();
  await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);

  const canvasBox = await canvas.boundingBox();
  await page.mouse.move(
    canvasBox.x + canvasBox.width * (105 / 160),
    canvasBox.y + canvasBox.height * (130 / 160),
  );
  await page.mouse.up();
  await expect.poll(async () => canvas.screenshot()).toEqual(normalMineScreen);

  await hoverLogical(canvas, 152, 62);
  const hoverOptionsIcon = await screenshotLogicalRegion(page, canvas, 145, 55, 15, 15);
  await clickLogical(canvas, 152, 62);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalMineScreen);
  await expect.poll(
    async () => screenshotLogicalRegion(page, canvas, 145, 55, 15, 15),
  ).not.toEqual(hoverOptionsIcon);

  const normalOptionsMenu = await canvas.screenshot();
  await hoverLogical(canvas, 55, 121);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalOptionsMenu);

  await hoverLogical(canvas, 105, 130);
  await expect.poll(async () => canvas.screenshot()).toEqual(normalOptionsMenu);

  await clickLogical(canvas, 55, 60);
  await clickLogical(canvas, 54, 142);
  await expect.poll(
    async () => screenshotLogicalRegion(page, canvas, 2, 15, 100, 100),
  ).not.toEqual(normalMap);

  await clickLogical(canvas, 152, 62);
  await clickLogical(canvas, 55, 60);
  await clickLogical(canvas, 54, 142);
  await expect.poll(
    async () => screenshotLogicalRegion(page, canvas, 2, 15, 100, 100),
  ).toEqual(normalMap);

  await clickLogical(canvas, 152, 62);
  await clickLogical(canvas, 55, 75);
  const normalSaveMenu = await canvas.screenshot();
  await hoverLogical(canvas, 54, 50);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalSaveMenu);
  await clickLogical(canvas, 54, 142);

  await clickLogical(canvas, 55, 90);
  const normalLoadMenu = await canvas.screenshot();
  await hoverLogical(canvas, 54, 50);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalLoadMenu);

  expect(runtimeErrors).toEqual([]);
});

test('the clock opens the day picker, and Cancel leaves the colony untouched', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await reachMineScreen(page, canvas);

  await parkPointer(canvas);
  const mineScreen = await canvas.screenshot();

  await clickLogical(canvas, 121, 91);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(mineScreen);

  const [cancelX, cancelY] = [
    ADVANCE_MENU_ORIGIN.x + DAY_PICKER_CANCEL.x + Math.floor(DAY_PICKER_CANCEL.width / 2),
    ADVANCE_MENU_ORIGIN.y + DAY_PICKER_CANCEL.y + Math.floor(DAY_PICKER_CANCEL.height / 2),
  ];
  await clickLogical(canvas, cancelX, cancelY);
  await parkPointer(canvas);

  // Cancel must cost nothing: no day advanced, no turn run, so the screen comes
  // back byte-identical to the one the picker was opened over.
  await expect.poll(async () => canvas.screenshot()).toEqual(mineScreen);
});

test('picking a day from the grid advances the colony', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await reachMineScreen(page, canvas);

  await parkPointer(canvas);
  const before = await canvas.screenshot();
  await clickLogical(canvas, 121, 91);
  await expect.poll(async () => canvas.screenshot()).not.toEqual(before);

  await clickLogical(canvas, ...cellCentre(20));
  await page.waitForTimeout(9_000);
  await parkPointer(canvas);

  // The menu is gone and twenty days have passed.
  await expect.poll(async () => canvas.screenshot()).not.toEqual(before);
});

/**
 * A loaded colony must draw its shop exactly as choosing that item by hand does.
 *
 * Regression for a load-path defect: resetupdate() restored the caption from the
 * save but never the sprites that draw the selection, so a colony saved with
 * Hydroponics selected reopened captioned "Hydroponics" with the bulldozer lit.
 * Bulldozer is the one selection sprite that starts visible, so the mismatch was
 * invisible on a new mine and appeared only after a load.
 *
 * Comparing the two paths against each other, rather than against a stored
 * baseline, is what keeps this honest: it asserts the invariant that matters and
 * survives any change to how the shop row is drawn.
 */
test('a loaded colony restores the shop selection it was saved with', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedSaveWithSelection(page, 'hydroponics');
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(250);

  await clickLogical(canvas, ...LOAD_MINE_BUTTON);
  await page.waitForTimeout(250);
  await clickLogical(canvas, ...FIRST_SAVE_SLOT);
  await waitForCanvasToSettle(page, canvas);
  await parkPointer(canvas);

  const { x, y, width, height } = SHOP_ROW;
  const afterLoad = await screenshotLogicalRegion(page, canvas, x, y, width, height);

  // Now make the same selection by hand, through the code path that was always
  // correct: away to another item, then back.
  await clickLogical(canvas, ...BULLDOZER_ICON);
  await parkPointer(canvas);
  await expect
    .poll(async () => screenshotLogicalRegion(page, canvas, x, y, width, height))
    .not.toEqual(afterLoad);

  await clickLogical(canvas, ...HYDROPONICS_ICON);
  await parkPointer(canvas);

  await expect
    .poll(async () => screenshotLogicalRegion(page, canvas, x, y, width, height))
    .toEqual(afterLoad);
});

/**
 * A loaded colony reopens on the level it was saved on.
 *
 * The port used to draw level 1 on every load and discard the saved level, while
 * still writing `level` into the save. The original restores it: Load() reads
 * `level` back from the record and the main loop redraws there.
 *
 * Asserted against the same level selected by hand rather than a stored
 * baseline, so the test states the invariant instead of pinning today's pixels.
 */
test('a loaded colony reopens on the level it was saved on', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedSaveWithSelection(page, 'bulldozer', { level: 'level2' });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(250);

  await clickLogical(canvas, ...LOAD_MINE_BUTTON);
  await page.waitForTimeout(250);
  await clickLogical(canvas, ...FIRST_SAVE_SLOT);
  await waitForCanvasToSettle(page, canvas);
  await parkPointer(canvas);

  const { x, y, width, height } = LEVEL_BUTTONS;
  const afterLoad = await screenshotLogicalRegion(page, canvas, x, y, width, height);

  // Selecting level 2 by hand must be a no-op, because we are already there.
  // Before the fix this moved the indicator from 1 to 2 and redrew the surface.
  await clickLogical(canvas, ...LEVEL_TWO_BUTTON);
  await waitForCanvasToSettle(page, canvas);
  await parkPointer(canvas);

  await expect
    .poll(async () => screenshotLogicalRegion(page, canvas, x, y, width, height))
    .toEqual(afterLoad);
});
