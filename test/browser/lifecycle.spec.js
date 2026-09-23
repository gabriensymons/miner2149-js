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

async function openCanvas(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);
  return canvas;
}

/** Clicks, then waits for whatever the click set moving to finish drawing. */
async function press(page, canvas, point) {
  await clickLogical(canvas, ...point);
  await waitForCanvasToSettle(page, canvas);
}

/** The whole canvas with the pointer parked, so no hover overlay is captured. */
async function still(page, canvas) {
  await parkPointer(canvas);
  await waitForCanvasToSettle(page, canvas);
  return canvas.screenshot();
}

function autoSlot(page, canvas) {
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
  await press(page, canvas, WAGE_UP);
  await press(page, canvas, WAGE_UP);
  const whenSaved = await still(page, canvas);

  await press(page, canvas, OPTIONS_BUTTON);
  await press(page, canvas, SAVE_MINE_ROW);
  await press(page, canvas, SLOT_ONE);
  // "Would you like to enter a personalized comment for this game?"
  await press(page, canvas, DIALOG_NO);

  expect(await still(page, canvas), 'saving leaves the colony on screen untouched').toEqual(whenSaved);

  // Move away from the saved state, so the load has something to undo.
  await press(page, canvas, WAGE_UP);
  await press(page, canvas, WAGE_UP);
  expect(await still(page, canvas), 'the wage really moved').not.toEqual(whenSaved);

  // The options menu is drawn over the load screen, which it mounts underneath
  // itself; "Load Mine" reveals it by taking the menu away. Phase 8 replaces that
  // arrangement with a named screen stack, which is why this goes through it.
  await press(page, canvas, OPTIONS_BUTTON);
  await press(page, canvas, LOAD_MINE_ROW);
  await press(page, canvas, SLOT_ONE);

  expect(await still(page, canvas), 'the load restores the colony as it was saved').toEqual(whenSaved);
});

test('declining to resign leaves the colony exactly as it was', async ({ page }) => {
  const canvas = await openCanvas(page);
  await reachMineScreen(page, canvas);
  const before = await still(page, canvas);

  await press(page, canvas, OPTIONS_BUTTON);
  await press(page, canvas, RESIGN_ROW);
  // "Are you sure you want to resign? (This will end your current colony.)"
  await press(page, canvas, DIALOG_NO);
  await press(page, canvas, OPTIONS_OK);

  expect(await still(page, canvas)).toEqual(before);
});

// The colony is reset twice on this route: once when the game ends, and again
// when game over's New Mine hands off to newMine(). Removing either reset alone
// changes nothing a player can see, and this test rightly does not notice --
// it was mutation-checked with both removed, and fails then. That is the point:
// it pins the outcome, so phase 8 can fold the two resets into one without
// rewriting it.
test('game over starts the next colony from scratch, not from the resigned one', async ({ page }) => {
  const canvas = await openCanvas(page);

  await press(page, canvas, START_NEW_MINE);
  const freshLaunchScreen = await still(page, canvas);

  // Leave a setting off its default before playing, so a reset that did not
  // happen would carry it through to the next launch screen.
  await press(page, canvas, FEWER_PROBES);
  await press(page, canvas, FEWER_PROBES);
  await press(page, canvas, FEWER_PROBES);
  expect(await still(page, canvas), 'the probe count really moved').not.toEqual(freshLaunchScreen);

  await press(page, canvas, LAUNCH);
  await press(page, canvas, FIRST_ASTEROID);

  await press(page, canvas, OPTIONS_BUTTON);
  await press(page, canvas, RESIGN_ROW);
  await press(page, canvas, DIALOG_YES);

  await press(page, canvas, GAME_OVER_NEW_MINE);

  expect(await still(page, canvas), 'the launch screen is back at its defaults').toEqual(freshLaunchScreen);
});

test('a resigned colony is gone from its autosave, and stays gone after a reload', async ({ page }) => {
  let canvas = await openCanvas(page);

  // What an empty auto slot looks like, taken before anything is saved.
  await press(page, canvas, START_LOAD_MINE);
  const emptyAutoSlot = await autoSlot(page, canvas);

  await seedAutosave(page);
  await page.reload();
  canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);

  await press(page, canvas, START_LOAD_MINE);
  expect(await autoSlot(page, canvas), 'there is a colony to resign').not.toEqual(emptyAutoSlot);

  await press(page, canvas, AUTO_SLOT);
  await press(page, canvas, OPTIONS_BUTTON);
  await press(page, canvas, RESIGN_ROW);
  await press(page, canvas, DIALOG_YES);

  await press(page, canvas, GAME_OVER_LOAD_MINE);
  expect(await autoSlot(page, canvas), 'resigning empties the auto slot').toEqual(emptyAutoSlot);

  // The reset is written to storage, not only to memory. A resigned colony that
  // came back on the next visit would be the most confusing way for this to fail.
  await page.reload();
  canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);

  await press(page, canvas, START_LOAD_MINE);
  expect(await autoSlot(page, canvas), 'and the next visit agrees').toEqual(emptyAutoSlot);
});
