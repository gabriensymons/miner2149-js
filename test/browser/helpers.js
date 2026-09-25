import { expect } from '@playwright/test';

import { gameDataInit, shopItems } from '../../scripts/gamedata.js';
import { calculateShopPrice } from '../../scripts/shop.js';

/**
 * Shared plumbing for the browser suites.
 *
 * The game canvas is a 160x160 logical screen scaled to whatever the viewport
 * allows, so every coordinate a test writes is in Palm pixels and converted
 * here. Keeping that in one place is the point: a test that hard-codes a
 * device pixel is wrong the moment the viewport changes.
 */

export function isSupabaseUrl(value) {
  const hostname = new URL(value).hostname;
  return hostname === 'supabase.co' || hostname.endsWith('.supabase.co');
}

async function pointerAtLogicalPosition(canvas, x, y, action) {
  const box = await canvas.boundingBox();
  await canvas[action]({
    position: {
      x: box.width * (x / 160),
      y: box.height * (y / 160),
    },
  });
}

export async function clickLogical(canvas, x, y) {
  await pointerAtLogicalPosition(canvas, x, y, 'click');
}

export async function hoverLogical(canvas, x, y) {
  await pointerAtLogicalPosition(canvas, x, y, 'hover');
}

/**
 * Waits for the canvas to stop changing, rather than guessing how long it takes.
 *
 * The asteroid reveal animates row by row and its duration depends on the
 * machine. A fixed sleep was long enough on a developer laptop and was not on a
 * CI runner, where a baseline screenshot was captured mid-animation -- and every
 * later comparison against that baseline then failed, in a test that has nothing
 * to do with the reveal.
 *
 * Returns the settled frame, so a caller about to screenshot the canvas can use
 * the one that proved it still instead of paying for another.
 */
export async function waitForCanvasToSettle(page, canvas, { quietFrames = 2, timeout = 15_000 } = {}) {
  const deadline = Date.now() + timeout;
  let previous = null;
  let stable = 0;
  while (Date.now() < deadline) {
    const frame = await canvas.screenshot();
    stable = previous && frame.equals(previous) ? stable + 1 : 0;
    previous = frame;
    if (stable >= quietFrames) return frame;
    await page.waitForTimeout(250);
  }
  throw new Error('the canvas never stopped changing, so no stable baseline exists');
}

export async function screenshotLogicalRegion(page, canvas, x, y, width, height) {
  const box = await canvas.boundingBox();
  return page.screenshot({
    clip: {
      x: box.x + box.width * (x / 160),
      y: box.y + box.height * (y / 160),
      width: box.width * (width / 160),
      height: box.height * (height / 160),
    },
  });
}

export async function reachMineScreen(page, canvas) {
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(250);
  for (const [x, y] of [[80, 81], [106, 132], [30, 37]]) {
    const previous = await canvas.screenshot();
    await clickLogical(canvas, x, y);
    await expect.poll(async () => canvas.screenshot()).not.toEqual(previous);
    await page.waitForTimeout(100);
  }
  // Preventative rather than a fix for an observed failure: these callers do not
  // compare pixel baselines, so a mid-animation frame does not fail them the way
  // it failed the hover test. But it is the same blind sleep on the same reveal,
  // and clicking into a screen that is still drawing is not a thing to rely on.
  await waitForCanvasToSettle(page, canvas);
}

// The status bar carries no interactive controls, so parking the pointer there
// keeps a hover overlay from contaminating a screenshot comparison.
export const parkPointer = (canvas) => hoverLogical(canvas, 80, 7);

/**
 * Seeds slot 1 with a colony, before the app boots.
 *
 * The selection is stored by display name and the price is stored already
 * multiplied, which is what the running game writes -- seeding the unmultiplied
 * base price would make the caption disagree with a hand-made selection for a
 * reason that has nothing to do with what the test is about.
 */
export async function seedSaveWithSelection(page, itemId, overrides = {}) {
  const saveData = {
    ...structuredClone(gameDataInit),
    day: 12,
    difficulty: 2,
    asteroid: 'Class:2',
    shopBtn: shopItems[itemId].name,
    shopPrice: calculateShopPrice(shopItems[itemId].price, gameDataInit.multiplier),
    ...overrides,
  };

  await page.addInitScript((data) => {
    window.localStorage.setItem('minerSaves', JSON.stringify({
      autoSave: { name: 'Empty Auto Slot', hasCustomName: false, empty: true, saveData: {} },
      save1: { name: 'Day:12|Class:2', hasCustomName: false, empty: false, saveData: data },
      save2: { name: 'Empty Slot 2', hasCustomName: false, empty: true, saveData: {} },
      save3: { name: 'Empty Slot 3', hasCustomName: false, empty: true, saveData: {} },
    }));
  }, saveData);
}

// The Konami sequence, as a player types it.
export const KONAMI_KEYS = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
];

export async function enterKonamiCode(page) {
  for (const key of KONAMI_KEYS) await page.keyboard.press(key);
}
