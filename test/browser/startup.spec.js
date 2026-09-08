import { expect, test } from '@playwright/test';

import { DEFAULT_SKIN_IDS, SKIN_CATALOGUE } from '../../scripts/skin-catalogue.js';
import { DAY_PICKER_CANCEL, dayPickerCells } from '../../scripts/day-picker.js';

function isSupabaseUrl(value) {
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

async function clickLogical(canvas, x, y) {
  await pointerAtLogicalPosition(canvas, x, y, 'click');
}

async function hoverLogical(canvas, x, y) {
  await pointerAtLogicalPosition(canvas, x, y, 'hover');
}

async function screenshotLogicalRegion(page, canvas, x, y, width, height) {
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

test('the game starts and responds to the New Mine control without runtime errors', async ({ context, page }) => {
  const attemptedHttp = [];
  const blockedHttp = [];
  const blockedWebSockets = [];

  context.on('request', (request) => {
    if (isSupabaseUrl(request.url())) attemptedHttp.push(request.url());
  });

  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (isSupabaseUrl(url)) {
      blockedHttp.push(url);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  await context.routeWebSocket(/.*/, async (webSocket) => {
    if (isSupabaseUrl(webSocket.url())) {
      blockedWebSockets.push(webSocket.url());
      await webSocket.close({ code: 1008, reason: 'Production services are blocked in tests.' });
      return;
    }
    webSocket.connectToServer();
  });

  await page.goto('about:blank');
  await page.evaluate(async () => {
    await fetch('https://isolation-test.supabase.co/http-probe').catch(() => null);
    await new Promise((resolve) => {
      const socket = new WebSocket('wss://isolation-test.supabase.co/websocket-probe');
      socket.onclose = resolve;
      socket.onerror = resolve;
      setTimeout(resolve, 1_000);
    });
  });

  const secondaryPage = await context.newPage();
  await secondaryPage.evaluate(async () => {
    await fetch('https://isolation-test.supabase.co/secondary-page-probe').catch(() => null);
  });
  await secondaryPage.close();

  expect(blockedHttp).toContain('https://isolation-test.supabase.co/http-probe');
  expect(blockedHttp).toContain('https://isolation-test.supabase.co/secondary-page-probe');
  expect(blockedWebSockets).toContain('wss://isolation-test.supabase.co/websocket-probe');
  expect(attemptedHttp.sort()).toEqual(blockedHttp.sort());

  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('/');

  await expect(page.getByText('Cloud saves are disabled pending security verification.')).toHaveCount(0);
  await expect(page.locator('#user-form')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Play', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Miner 2149' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Introduction' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Playing Instructions' })).toBeVisible();

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const titleScreen = await canvas.screenshot();

  const canvasBox = await canvas.boundingBox();
  await canvas.click({ position: { x: canvasBox.width / 2, y: canvasBox.height * (81 / 160) } });
  await expect.poll(async () => canvas.screenshot()).not.toEqual(titleScreen);

  expect(runtimeErrors).toEqual([]);
});

test('the New Mine button displays its hover sprite', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const canvasBox = await canvas.boundingBox();
  const normalState = await canvas.screenshot();

  await canvas.hover({
    position: {
      x: canvasBox.width * (80 / 160),
      y: canvasBox.height * (81 / 160),
    },
  });

  await expect.poll(async () => canvas.screenshot()).not.toEqual(normalState);
});

test('mine-screen sprite controls display hover states', async ({ page }) => {
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
  await page.waitForTimeout(8_000);

  await hoverLogical(canvas, 105, 130);
  let normalMineScreen = await canvas.screenshot();
  const normalMap = await screenshotLogicalRegion(page, canvas, 2, 15, 100, 100);
  const normalStorageIcon = await screenshotLogicalRegion(page, canvas, 145, 113, 15, 15);

  for (const reportX of [121, 136]) {
    await clickLogical(canvas, reportX, 62);
    await expect.poll(async () => canvas.screenshot()).not.toEqual(normalMineScreen);
    await clickLogical(canvas, 54, 142);
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

test('the canvas fills a small mobile viewport and hides manual sizing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const canvasTopBeforeControls = (await canvas.boundingBox()).y;
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#display-controls-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.display-control--size')).toBeHidden();
  await expect(page.locator('#screen-tone')).toBeVisible();
  await expect(page.locator('.site-header__tagline')).toBeHidden();
  expect((await canvas.boundingBox()).y).toBe(canvasTopBeforeControls);

  const canvasBox = await canvas.boundingBox();
  expect(canvasBox.width).toBeGreaterThanOrEqual(389);
  expect(canvasBox.width).toBeLessThanOrEqual(390);
  expect(canvasBox.height).toBe(canvasBox.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

  const titleScreen = await canvas.screenshot();
  await canvas.click({ position: { x: canvasBox.width / 2, y: canvasBox.height * (81 / 160) } });
  await expect.poll(async () => canvas.screenshot()).not.toEqual(titleScreen);
});

test('the header drawer resizes and tints the game and offers the replacement Palm frames', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const canvas = page.locator('canvas');
  await expect(page.locator('.site-header__tagline')).toBeVisible();

  for (const item of [
    page.getByRole('button', { name: 'Controls' }),
    page.getByRole('link', { name: 'Play', exact: true }),
    page.getByRole('link', { name: 'Introduction' }),
    page.getByRole('link', { name: 'Playing Instructions' }),
  ]) {
    await item.hover();
    const verticalOffset = await item.evaluate((element) => {
      const elementBox = element.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const textBox = range.getBoundingClientRect();
      return (textBox.top + textBox.height / 2) - (elementBox.top + elementBox.height / 2);
    });
    expect(Math.abs(verticalOffset)).toBeLessThanOrEqual(1);
  }

  await expect(page.locator('#display-controls-drawer')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#display-controls-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.display-control--size')).toBeVisible();

  await page.locator('#game-size').evaluate((slider) => {
    slider.value = '3.5';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(async () => (await canvas.boundingBox()).width).toBe(560);

  await page.selectOption('#screen-tone', 'backlight');
  await expect(page.locator('#game-stage')).toHaveAttribute('data-screen-tone', 'backlight');

  // Picked from the catalogue rather than hard-coded, so replacing the art does
  // not silently leave this asserting a frame that no longer exists.
  const [firstUnlocked] = DEFAULT_SKIN_IDS;
  await page.selectOption('#device-skin', firstUnlocked);
  await expect(page.locator('#palm-frame')).toHaveAttribute('data-skin', firstUnlocked);
  // Every frame is listed; the locked ones are disabled rather than hidden, so
  // the collection is discoverable without giving away the names or triggers.
  await expect(page.locator('#device-skin option')).toHaveCount(SKIN_CATALOGUE.length + 1);
  await expect(page.locator('#device-skin option:not([disabled])'))
    .toHaveCount(DEFAULT_SKIN_IDS.length + 1);
  await expect(page.locator('#device-skin option[disabled]').first())
    .toHaveText(/^Locked/);

  // The frame is sized so the transparent cutout is exactly one canvas across.
  const frameWidth = (await page.locator('#palm-frame').boundingBox()).width;
  const canvasWidth = (await canvas.boundingBox()).width;
  const skin = SKIN_CATALOGUE.find(({ id }) => id === firstUnlocked);
  expect(Math.abs(frameWidth / canvasWidth - skin.imageWidth / skin.screenWidth))
    .toBeLessThan(0.02);
});

test('the game console wrapper fills an extra-large viewport with black', async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.goto('/');

  const shell = page.locator('.game-console-shell');
  const console = page.locator('.game-console');
  await expect(shell).toBeVisible();
  expect((await shell.boundingBox()).width).toBe(1700);
  expect((await console.boundingBox()).width).toBe(1500);
  await expect(shell).toHaveCSS('background-color', 'rgb(8, 10, 15)');
});

test('the Konami code unlocks a frame that survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const konamiFrame = SKIN_CATALOGUE.find(({ unlock }) => unlock === 'konami');
  const locked = page.locator(`#device-skin option[value="${konamiFrame.id}"]`);
  // Asserted as a property rather than with toBeDisabled(): Playwright does not
  // treat <option> as a disableable control and reports it enabled regardless.
  const isLocked = () => locked.evaluate((option) => option.disabled);
  await expect.poll(isLocked).toBe(true);

  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  await expect.poll(isLocked).toBe(false);
  await expect(locked).toHaveText(konamiFrame.label);
  await expect(page.locator('#skin-unlock-toast')).toHaveText(`Frame unlocked: ${konamiFrame.label}`);

  // Cosmetic unlocks live outside the save model, so they outlive a reload and
  // any individual colony.
  await page.reload();
  await expect.poll(
    () => page.locator(`#device-skin option[value="${konamiFrame.id}"]`)
      .evaluate((option) => option.disabled),
  ).toBe(false);
});

test('typing the code into a form control does not trigger it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const konamiFrame = SKIN_CATALOGUE.find(({ unlock }) => unlock === 'konami');
  // The save-name flow binds its own window keydown listener and the display
  // controls are form elements; the listener must not steal keys from them.
  await page.getByRole('button', { name: 'Controls' }).click();
  await page.locator('#game-size').focus();
  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  await expect.poll(
    () => page.locator(`#device-skin option[value="${konamiFrame.id}"]`)
      .evaluate((option) => option.disabled),
  ).toBe(true);
});

// The picker's twenty cells are loop-generated, so they cannot be covered by the
// source-text matchers that guard the rest of app.js. day-picker.test.js carries
// the layout; this carries the wiring.
const ADVANCE_MENU_ORIGIN = { x: 2, y: 24 };

async function reachMineScreen(page, canvas) {
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(250);
  for (const [x, y] of [[80, 81], [106, 132], [30, 37]]) {
    const previous = await canvas.screenshot();
    await clickLogical(canvas, x, y);
    await expect.poll(async () => canvas.screenshot()).not.toEqual(previous);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(8_000);
}

// The status bar carries no interactive controls, so parking the pointer there
// keeps a hover overlay from contaminating a screenshot comparison.
const parkPointer = (canvas) => hoverLogical(canvas, 80, 7);

function cellCentre(day) {
  const { hitzone } = dayPickerCells().find((cell) => cell.day === day);
  return [
    ADVANCE_MENU_ORIGIN.x + hitzone.x + Math.floor(hitzone.width / 2),
    ADVANCE_MENU_ORIGIN.y + hitzone.y + Math.floor(hitzone.height / 2),
  ];
}

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
