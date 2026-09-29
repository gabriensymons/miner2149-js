import { expect, test } from '@playwright/test';

import { gameDataInit } from '../../scripts/gamedata.js';
import {
  clickLogical,
  parkPointer,
  reachMineScreen,
  screenshotLogicalRegion,
  waitForCanvasToSettle,
} from './helpers.js';

// A colony's life outside the simulation: saving it, loading it back, resigning
// it, and starting over from game over.
//
// Written before phase 8 of the decomposition rather than alongside it. Phase 8
// moves every one of these flows out of app.js -- save and load, the game-over
// screen, and the screen stacking that holds them together -- and until now the
// only thing guarding them was source-text matching, which cannot tell a correct
// refactor from a broken one. These assert what the player sees instead.
//
// As elsewhere in the browser suite, each test compares two routes to the same
// state rather than a stored baseline, so it states the invariant and survives
// any change to how a screen is drawn.

// Every coordinate is a logical Palm pixel, derived from the code that builds
// the control rather than read off a screenshot.
const START_NEW_MINE = [80, 81];
const START_LOAD_MINE = [80, 98];
const LAUNCH = [106, 132];
const FEWER_PROBES = [72, 136];
const FIRST_ASTEROID = [30, 37];

const OPTIONS_BUTTON = [152, 62];
// Options menu rows, whose parent sits at (5, 17).
const SAVE_MINE_ROW = [52, 75];
const LOAD_MINE_ROW = [52, 90];
const RESIGN_ROW = [52, 120];
const OPTIONS_OK = [54, 142];

// The save and load screens both mount at (0, 13), so their slots coincide.
const AUTO_SLOT = [54, 50];
const SLOT_ONE = [54, 70];
const AUTO_SLOT_REGION = { x: 11, y: 43, width: 86, height: 15 };

// Every confirmation puts its buttons in the same place whatever it says: they
// hang off `messageBottom`, which is anchored to the bottom edge, and a longer
// message grows the dialog upward rather than moving them.
const DIALOG_YES = [25, 146];
const DIALOG_NO = [67, 146];

const WAGE_UP = [152, 145];

// Game-over buttons, whose parent sits at (4, 3).
const GAME_OVER_NEW_MINE = [45, 103];
const GAME_OVER_LOAD_MINE = [114, 103];

// Each test here walks a whole flow end to end, and one of them does it twice
// with a control run. Even with the waiting above cut to what is load-bearing,
// that is longer than the default thirty seconds allows on a software-rendered
// runner, so the file gets the budget the mine-screen hover test gets.
test.describe.configure({ timeout: 90_000 });

async function openCanvas(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);
  return canvas;
}

// How these tests wait, and why it is cheap.
//
// Screenshots are what a CI runner pays for: it renders the canvas in software,
// and every settle is at least three full-canvas screenshots. These tests first
// settled after every single click -- 32 to 73 screenshots each, against 8 to
// 16 for the browser tests that pass on CI -- and all four timed out there on
// every run from #21 on, while passing locally in seconds.
//
// Most clicks need no wait at all. Pixi hit-tests against the scene graph, not
// the drawn frame, so a menu that a click mounts can be clicked into at once;
// the pause in `tap` is only margin, and the same one the other suites use.
// Settling is kept for the two places it is load-bearing: before every
// comparison, in `still`, and after a click that starts an animation which
// locks input, in `press` -- picking an asteroid and loading a colony both run
// the surface reveal, and the mine screen ignores taps until it lands.

/** An instant transition: a menu, a dialog button, an arrow. */
async function tap(page, canvas, point) {
  await clickLogical(canvas, ...point);
  await page.waitForTimeout(250);
}

/** A click that starts an animation and locks input until it lands. */
async function press(page, canvas, point) {
  await clickLogical(canvas, ...point);
  await waitForCanvasToSettle(page, canvas);
}

/** The whole canvas, settled, with the pointer parked so no hover overlay is captured. */
async function still(page, canvas) {
  await parkPointer(canvas);
  return waitForCanvasToSettle(page, canvas);
}

/** The auto slot's label on the load screen, settled first: it is compared. */
async function autoSlot(page, canvas) {
  await waitForCanvasToSettle(page, canvas);
  const { x, y, width, height } = AUTO_SLOT_REGION;
  return screenshotLogicalRegion(page, canvas, x, y, width, height);
}

/**
 * Puts an active colony in the auto slot, once.
 *
 * Written through the running page and followed by a reload, rather than with
 * `addInitScript`, because an init script runs again on every navigation -- and
 * one test here reloads specifically to prove a resigned colony stays gone.
 */
async function seedAutosave(page) {
  const saveData = { ...structuredClone(gameDataInit), day: 12, difficulty: 2, asteroid: 'Class:2' };

  await page.evaluate((data) => {
    window.localStorage.setItem('minerSaves', JSON.stringify({
      autoSave: { name: 'Day:12|Class:2', hasCustomName: false, empty: false, saveData: data },
      save1: { name: 'Empty Slot 1', hasCustomName: false, empty: true, saveData: {} },
      save2: { name: 'Empty Slot 2', hasCustomName: false, empty: true, saveData: {} },
      save3: { name: 'Empty Slot 3', hasCustomName: false, empty: true, saveData: {} },
    }));
  }, saveData);
}

test('a colony saved to a slot loads back exactly as it was saved', async ({ page }) => {

  const canvas = await openCanvas(page);
  await reachMineScreen(page, canvas);

  // Raising the wage is the one change that is deterministic, visible on the
  // mine screen, and cannot set off a random event the way advancing a day can.
  await tap(page, canvas, WAGE_UP);
  await tap(page, canvas, WAGE_UP);
  const whenSaved = await still(page, canvas);

  await tap(page, canvas, OPTIONS_BUTTON);
  await tap(page, canvas, SAVE_MINE_ROW);
  await tap(page, canvas, SLOT_ONE);
  // "Would you like to enter a personalized comment for this game?"
  await tap(page, canvas, DIALOG_NO);

  expect(await still(page, canvas), 'saving leaves the colony on screen untouched').toEqual(whenSaved);

  // Move away from the saved state, so the load has something to undo.
  await tap(page, canvas, WAGE_UP);
  await tap(page, canvas, WAGE_UP);
  expect(await still(page, canvas), 'the wage really moved').not.toEqual(whenSaved);

  // The options menu is drawn over the load screen, which it mounts underneath
  // itself; "Load Mine" reveals it by taking the menu away. Phase 8 replaces that
  // arrangement with a named screen stack, which is why this goes through it.
  await tap(page, canvas, OPTIONS_BUTTON);
  await tap(page, canvas, LOAD_MINE_ROW);
  await tap(page, canvas, SLOT_ONE);

  expect(await still(page, canvas), 'the load restores the colony as it was saved').toEqual(whenSaved);
});

test('declining to resign leaves the colony exactly as it was', async ({ page }) => {
  const canvas = await openCanvas(page);
  await reachMineScreen(page, canvas);
  const before = await still(page, canvas);

  await tap(page, canvas, OPTIONS_BUTTON);
  await tap(page, canvas, RESIGN_ROW);
  // "Are you sure you want to resign? (This will end your current colony.)"
  await tap(page, canvas, DIALOG_NO);
  await tap(page, canvas, OPTIONS_OK);

  expect(await still(page, canvas)).toEqual(before);
});

// The colony used to be reset twice on this route -- when the game ended, and
// again when New Mine handed off to newMine() -- and Quit reset it a second
// time too. Phase 8 folded them into the one in newMine(). This test pins the
// outcome rather than either reset, which is why it did not have to change when
// they were folded; removing the one that remains fails it.
test('game over starts the next colony from scratch, not from the resigned one', async ({ page }) => {
  const canvas = await openCanvas(page);

  await tap(page, canvas, START_NEW_MINE);
  const freshLaunchScreen = await still(page, canvas);

  // Leave a setting off its default before playing, so a reset that did not
  // happen would carry it through to the next launch screen.
  await tap(page, canvas, FEWER_PROBES);
  await tap(page, canvas, FEWER_PROBES);
  await tap(page, canvas, FEWER_PROBES);
  expect(await still(page, canvas), 'the probe count really moved').not.toEqual(freshLaunchScreen);

  await tap(page, canvas, LAUNCH);
  await press(page, canvas, FIRST_ASTEROID);

  await tap(page, canvas, OPTIONS_BUTTON);
  await tap(page, canvas, RESIGN_ROW);
  await tap(page, canvas, DIALOG_YES);

  await tap(page, canvas, GAME_OVER_NEW_MINE);

  expect(await still(page, canvas), 'the launch screen is back at its defaults').toEqual(freshLaunchScreen);
});

test('a resigned colony is gone from its autosave, and stays gone after a reload', async ({ page }) => {
  let canvas = await openCanvas(page);

  // What an empty auto slot looks like, taken before anything is saved.
  await tap(page, canvas, START_LOAD_MINE);
  const emptyAutoSlot = await autoSlot(page, canvas);

  await seedAutosave(page);
  await page.reload();
  canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);

  await tap(page, canvas, START_LOAD_MINE);
  expect(await autoSlot(page, canvas), 'there is a colony to resign').not.toEqual(emptyAutoSlot);

  await press(page, canvas, AUTO_SLOT);
  await tap(page, canvas, OPTIONS_BUTTON);
  await tap(page, canvas, RESIGN_ROW);
  await tap(page, canvas, DIALOG_YES);

  await tap(page, canvas, GAME_OVER_LOAD_MINE);
  expect(await autoSlot(page, canvas), 'resigning empties the auto slot').toEqual(emptyAutoSlot);

  // The reset is written to storage, not only to memory. A resigned colony that
  // came back on the next visit would be the most confusing way for this to fail.
  await page.reload();
  canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);

  await tap(page, canvas, START_LOAD_MINE);
  expect(await autoSlot(page, canvas), 'and the next visit agrees').toEqual(emptyAutoSlot);
});

// A spot on the mine screen with nothing on it: right of the map's last column
// (which ends at x=103), below the advance buttons (which end at y=98), above
// the storage icon (which starts at y=114). It is also inside game over's own
// Load Mine button, which spans (90-139, 96-110) -- which is the point.
const EMPTY_SPOT_OVER_GAME_OVER_LOAD = [120, 104];

async function seedSlotOne(page) {
  const saveData = { ...structuredClone(gameDataInit), day: 12, difficulty: 2, asteroid: 'Class:2' };
  await page.evaluate((data) => {
    window.localStorage.setItem('minerSaves', JSON.stringify({
      autoSave: { name: 'Empty Auto Slot', hasCustomName: false, empty: true, saveData: {} },
      save1: { name: 'Day:12|Class:2', hasCustomName: false, empty: false, saveData: data },
      save2: { name: 'Empty Slot 2', hasCustomName: false, empty: true, saveData: {} },
      save3: { name: 'Empty Slot 3', hasCustomName: false, empty: true, saveData: {} },
    }));
  }, saveData);
}

// Loading used to close the load screen by calling every closer it might need
// -- the options one, the game-over one -- in sequence, whichever had opened it.
// From game over that unmounted the load screen but never the game-over screen
// beneath it, which stayed on the stage under the mine screen with its buttons
// live, reachable through any gap in the mine screen's own hit zones.
test('a colony loaded from game over leaves nothing of game over behind', async ({ page }) => {

  let canvas = await openCanvas(page);
  await seedSlotOne(page);
  await page.reload();
  canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);

  // Control: loaded straight from the start screen, the spot is inert.
  await tap(page, canvas, START_LOAD_MINE);
  await tap(page, canvas, SLOT_ONE);
  const loadedFromStart = await still(page, canvas);
  await tap(page, canvas, EMPTY_SPOT_OVER_GAME_OVER_LOAD);
  expect(await still(page, canvas), 'the spot really is empty on the mine screen').toEqual(loadedFromStart);

  // Now reach the same colony by way of game over. Resigning clears only the
  // autosave, so slot 1 is still there to load.
  await tap(page, canvas, OPTIONS_BUTTON);
  await tap(page, canvas, RESIGN_ROW);
  await tap(page, canvas, DIALOG_YES);
  await tap(page, canvas, GAME_OVER_LOAD_MINE);
  await tap(page, canvas, SLOT_ONE);
  const loadedFromGameOver = await still(page, canvas);

  await tap(page, canvas, EMPTY_SPOT_OVER_GAME_OVER_LOAD);
  expect(await still(page, canvas), 'no game-over button answers from underneath').toEqual(loadedFromGameOver);
});
