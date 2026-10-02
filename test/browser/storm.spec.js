import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

import { gameDataInit, shopItems } from '../../scripts/gamedata.js';
import { calculateShopPrice } from '../../scripts/shop.js';
import { captureCanvas, clickLogical, waitForCanvasToSettle } from './helpers.js';

// The meteor storm in a real browser: what the Node suites cannot reach. The
// storm's rules -- hits, misses, splits, power, recharge, parity -- are
// meteor-storm.test.js and meteor-storm-view.test.js. These prove only that a
// real pointer on the scaled canvas lands where the scene thinks it does, that
// the mine beneath is locked while the storm is up, and that it is handed back.
//
// The way in is the shipped build, seeded: the development trigger is stripped
// from dist/, which is what Playwright serves. A Class 5 Disaster Mode colony
// with Math.random replaced before boot meets a storm on its first advance
// (seed 2, found for the pixel harness). Each test first proves the storm
// opened, so a change in the order of random draws fails here, loudly, instead
// of passing without a storm.

// Two storm tests, one of which plays a storm out (about seventy seconds).
test.describe.configure({ timeout: 180_000 });

const STORM_SEED = 2;
const ADVANCE_ONE = [136, 91];
const LOAD_MINE = [80, 98];
const SLOT_ONE = [54, 70];
const MESSAGE_OK = [25, 146];

/** A self-supporting Class 5 colony in Disaster Mode, with buildings for a disaster to hit. */
function stormColony() {
  const maps = structuredClone(gameDataInit.maps);
  for (const [level, row, col, site] of [
    ['level1', 2, 2, 13], ['level1', 5, 5, 14], ['level1', 5, 6, 10], ['level1', 3, 3, 8],
    ['level1', 6, 6, 16], ['level1', 4, 4, 5], ['level2', 3, 3, 8],
    ['level1', 4, 5, 11], ['level1', 4, 6, 11], ['level1', 3, 4, 9], ['level1', 3, 5, 9], ['level1', 5, 4, 12],
  ]) maps[level][`row${row}`][col] = site;
  return {
    ...structuredClone(gameDataInit),
    day: 100, difficulty: 5, asteroid: 'Class:5', disasterMode: true, daysOutsideDisasterMode: 0,
    shopBtn: shopItems.bulldozer.name,
    shopPrice: calculateShopPrice(shopItems.bulldozer.price, gameDataInit.multiplier),
    morale: 80, credits: 500000, diridium: 20000, health: 90, efficiency: 90, workers: 5,
    maps,
  };
}

async function openStormColony(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ save, seed }) => {
    // mulberry32: the same stream on every run.
    let a = seed;
    Math.random = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    window.localStorage.setItem('minerSaves', JSON.stringify({
      autoSave: { name: 'Empty Auto Slot', hasCustomName: false, empty: true, saveData: {} },
      save1: { name: 'Day:100|Class:5', hasCustomName: false, empty: false, saveData: save },
      save2: { name: 'Empty Slot 2', hasCustomName: false, empty: true, saveData: {} },
      save3: { name: 'Empty Slot 3', hasCustomName: false, empty: true, saveData: {} },
    }));
  }, { save: stormColony(), seed: STORM_SEED });
  await page.goto('/');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await waitForCanvasToSettle(page, canvas);
  await clickLogical(canvas, ...LOAD_MINE);
  await page.waitForTimeout(250);
  await clickLogical(canvas, ...SLOT_ONE);
  await waitForCanvasToSettle(page, canvas);
  return canvas;
}

/** The canvas as Palm pixels: dark(x, y) samples the middle of each one, whatever the scale. */
async function readCanvas(page, canvas) {
  const png = PNG.sync.read(await captureCanvas(page, canvas));
  const dark = (x, y) => {
    const px = Math.min(png.width - 1, Math.floor((x + 0.5) * png.width / 160));
    const py = Math.min(png.height - 1, Math.floor((y + 0.5) * png.height / 160));
    return png.data[(py * png.width + px) * 4] < 128;
  };
  return { dark };
}

/**
 * The storm is up when the mine's top bar is gone: the bar is solid black
 * behind the day and credits, and the storm draws on white from edge to edge.
 */
async function stormShowing(page, canvas) {
  const { dark } = await readCanvas(page, canvas);
  let black = 0;
  for (let x = 10; x < 150; x += 4) if (dark(x, 1)) black += 1;
  return black < 5;
}

/** The autosaved colony's day, which every turn writes before its disaster. */
const autosavedDay = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('minerSaves')).autoSave.saveData.day);

/**
 * Meteors in the open sky: clusters of dark pixels between the storm's titles
 * and the skyline, the size of a meteor. The laser's wedge and the titles are
 * far larger or outside the band, so they are not mistaken for one.
 */
function findMeteors(dark) {
  const seen = new Set();
  const meteors = [];
  for (let y = 36; y < 122; y += 1) {
    for (let x = 6; x < 154; x += 1) {
      if (!dark(x, y) || seen.has(`${x},${y}`)) continue;
      const stack = [[x, y]];
      const cells = [];
      seen.add(`${x},${y}`);
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
          if (nx < 6 || nx >= 154 || ny < 36 || ny >= 122 || seen.has(`${nx},${ny}`) || !dark(nx, ny)) continue;
          seen.add(`${nx},${ny}`);
          stack.push([nx, ny]);
        }
      }
      const xs = cells.map(([cx]) => cx);
      const ys = cells.map(([, cy]) => cy);
      const width = Math.max(...xs) - Math.min(...xs) + 1;
      const height = Math.max(...ys) - Math.min(...ys) + 1;
      if (cells.length >= 8 && width <= 12 && height <= 12) {
        meteors.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 });
      }
    }
  }
  return meteors;
}

// What a player sees, not how it is done. The storm view also switches the
// mine's input off while it is up and back on as it closes, but neither is the
// only safeguard: the storm's scene takes every tap on the canvas, and a storm
// always ends in news, whose dismissal hands the mine its input back. Removing
// either switch changes nothing here, by design (mutation-checked 2026-10-02).
test('the mine is locked while a storm is up and handed back once it is over', async ({ page }) => {
  const canvas = await openStormColony(page, { width: 1280, height: 900 });
  await clickLogical(canvas, ...ADVANCE_ONE);
  await expect.poll(() => stormShowing(page, canvas), { timeout: 30_000, message: 'seed 2 brings a storm on the first advance' })
    .toBe(true);
  expect(await autosavedDay(page)).toBe(101);

  // A tap on Advance reaches the storm -- as a shot -- and not the mine beneath.
  await clickLogical(canvas, ...ADVANCE_ONE);
  await page.waitForTimeout(500);
  await clickLogical(canvas, ...ADVANCE_ONE);

  await expect.poll(() => stormShowing(page, canvas), { timeout: 150_000, intervals: [1_000] }).toBe(false);
  // The day's news follows the storm; a press where there is no dialog lands on
  // the shop caption, which does nothing.
  for (let i = 0; i < 6; i += 1) {
    await waitForCanvasToSettle(page, canvas);
    await clickLogical(canvas, ...MESSAGE_OK);
  }
  await waitForCanvasToSettle(page, canvas);
  expect(await autosavedDay(page), 'the taps during the storm advanced nothing').toBe(101);

  // The autosave is written once the day's surface reveal has landed, and a CI
  // runner draws that reveal in software: seconds, not the default poll's five.
  await clickLogical(canvas, ...ADVANCE_ONE);
  await expect.poll(() => autosavedDay(page), { timeout: 30_000, message: 'the mine takes input again' }).toBe(102);
});

test('a meteor pressed on a phone-sized canvas is hit', async ({ page }) => {
  const canvas = await openStormColony(page, { width: 375, height: 812 });
  await clickLogical(canvas, ...ADVANCE_ONE);
  await expect.poll(() => stormShowing(page, canvas), { timeout: 30_000, message: 'seed 2 brings a storm on the first advance' })
    .toBe(true);

  // "HIT n" at the status line's left; MISS comes after it and is not compared.
  const box = await canvas.boundingBox();
  const hitCount = () => page.screenshot({
    clip: { x: box.x + box.width * (8 / 160), y: box.y + box.height * (145 / 160), width: box.width * (26 / 160), height: box.height * (11 / 160) },
  });
  const toPage = ({ x, y }) => [box.x + box.width * (x + 0.5) / 160, box.y + box.height * (y + 0.5) / 160];

  // Wait for a meteor, press on it, and follow it with the pointer held down: a
  // held laser fires whenever it has recharged, at wherever it is aimed.
  let target = null;
  await expect.poll(async () => {
    [target] = findMeteors((await readCanvas(page, canvas)).dark);
    return Boolean(target);
  }, { timeout: 45_000, message: 'a meteor comes into the sky' }).toBe(true);
  const before = await hitCount();
  await page.mouse.move(...toPage(target));
  await page.mouse.down();
  let hit = false;
  for (let attempt = 0; attempt < 60 && !hit; attempt += 1) {
    const meteors = findMeteors((await readCanvas(page, canvas)).dark);
    if (meteors.length) {
      target = meteors.reduce((best, m) => (Math.hypot(m.x - target.x, m.y - target.y) < Math.hypot(best.x - target.x, best.y - target.y) ? m : best));
      await page.mouse.move(...toPage(target));
    }
    hit = !(await hitCount()).equals(before);
  }
  await page.mouse.up();
  expect(hit, 'HIT moved off zero').toBe(true);
});
