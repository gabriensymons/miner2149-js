import { expect, test } from '@playwright/test';

import { DEFAULT_SKIN_IDS, SKIN_CATALOGUE } from '../../scripts/skin-catalogue.js';
import {
  DAY_PICKER_CANCEL,
  DAY_PICKER_ORIGIN,
  dayPickerCells,
} from '../../scripts/day-picker.js';

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
  await expect(page.locator('#skin-unlock-toast .skin-unlock-toast__name'))
    .toHaveText(konamiFrame.label);

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
const ADVANCE_MENU_ORIGIN = DAY_PICKER_ORIGIN;

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

test('the Field Kit lists every frame and withholds the locked ones', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/');

  const items = page.locator('#field-kit-list > li');
  await expect(items).toHaveCount(SKIN_CATALOGUE.length);
  await expect(page.locator('#field-kit-progress'))
    .toHaveText(`${DEFAULT_SKIN_IDS.length} of ${SKIN_CATALOGUE.length} units on file.`);

  // Locked entries carry a number and nothing else -- no name, no lore, and no
  // image, so the collection is visibly incomplete without giving away what is
  // missing or how to earn it.
  const locked = page.locator('#field-kit-list > li.is-locked');
  await expect(locked).toHaveCount(SKIN_CATALOGUE.length - DEFAULT_SKIN_IDS.length);
  await expect(locked.locator('img')).toHaveCount(0);
  const lockedText = await locked.first().innerText();
  for (const { label } of SKIN_CATALOGUE.filter(({ unlock }) => unlock !== null)) {
    expect(lockedText).not.toContain(label);
  }

  // Thumbnails, not the 1-2 MB frames the picker uses.
  const source = await items.first().locator('img').getAttribute('src');
  expect(source).toContain('/assets/skins/thumbs/');
});

test('the Konami code releases the frame, the screen tone, and the concept art', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/');

  // None of the reward is present, or downloaded, before the code is entered.
  await expect(page.locator('#field-kit-concepts')).toHaveCount(0);
  await expect(page.locator('#screen-tone option[value="diridium"]')).toHaveCount(0);

  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  await expect(page.locator('#field-kit-concepts img')).toHaveCount(2);
  await expect(page.locator('#screen-tone option[value="diridium"]')).toHaveCount(1);
  // Both rewards are applied, not merely offered: this is a one-time find and
  // the reveal is the reward. The controls are highlighted so going back is one
  // click rather than a hunt through a drawer the player may never have opened.
  await expect(page.locator('#game-stage')).toHaveAttribute('data-screen-tone', 'diridium');
  await expect(page.locator('#palm-frame')).toHaveAttribute('data-skin', 'diridium');
  await expect(page.locator('.display-control--skin')).toHaveClass(/is-newly-unlocked/);
  await expect(page.locator('.display-control--tone')).toHaveClass(/is-newly-unlocked/);

  // Opening the drawer is not enough: the ring is pointing at a specific
  // control, and it stays up until that control is the one the player uses.
  await page.getByRole('button', { name: 'Controls' }).click();
  // The drawer fades in, and a control inside it cannot take focus until it has.
  await expect(page.locator('#display-controls-drawer')).toBeVisible();
  await expect(page.locator('.display-control--skin')).toHaveClass(/is-newly-unlocked/);
  await expect(page.locator('.display-control--tone')).toHaveClass(/is-newly-unlocked/);

  await page.locator('#screen-tone').focus();
  await expect(page.locator('.display-control--tone')).not.toHaveClass(/is-newly-unlocked/);
  await expect(page.locator('.display-control--skin'))
    .toHaveClass(/is-newly-unlocked/, { timeout: 1000 });

  await page.locator('#device-skin').focus();
  await expect(page.locator('.display-control--skin')).not.toHaveClass(/is-newly-unlocked/);

  // The Japanese stencil on the DSEF-102 casing is marked up so a screen reader
  // switches voice rather than spelling it out in English.
  await page.evaluate(() => {
    const key = 'miner2149.unlockProgress';
    const progress = JSON.parse(localStorage.getItem(key));
    progress.unlocked.push('dsef-102');
    localStorage.setItem(key, JSON.stringify(progress));
  });
  await page.reload();
  await expect(page.locator('#field-kit-list span[lang="ja"]')).toHaveCount(1);
});

test('an unlock badges the Controls toggle until the drawer is opened', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/');

  const toggle = page.locator('#controls-toggle');
  await expect(toggle).not.toHaveClass(/has-unseen/);

  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  await expect(toggle).toHaveClass(/has-unseen/);
  // Two, not one: the Diridium unit brings the dark matter screen colour with
  // it, so the drawer has two new things in it.
  await expect(toggle).toHaveAttribute('data-unseen', '2');
  // The Konami notice is marked so it can arc, unlike an ordinary unlock.
  await expect(page.locator('#skin-unlock-toast')).toHaveClass(/is-charged/);

  // It survives a reload: an unlock earned mid-game must still be findable later.
  await page.reload();
  await expect(page.locator('#controls-toggle')).toHaveClass(/has-unseen/);

  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#controls-toggle')).not.toHaveClass(/has-unseen/);
  await page.reload();
  await expect(page.locator('#controls-toggle')).not.toHaveClass(/has-unseen/);
});

test('archive images open full size and close on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto('/');
  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  await expect(page.locator('.field-kit__concepts-title')).toHaveText('Archive image library');
  // A real button, so it is reachable by keyboard and announced as interactive.
  await expect(page.locator('.field-kit__expand').first()).toHaveAttribute('aria-label', /Enlarge/);
  // A catalogue line, a subject, a lead, and the record: the card has an entry
  // point rather than being one block of prose.
  const card = page.locator('.plate').first();
  await expect(card.locator('.plate__ref')).toContainText('Plate 01');
  await expect(card.locator('.plate__title')).toHaveText('Working face, mid-stage colony');
  await expect(card.locator('.plate__body')).toHaveCount(2);

  await page.locator('.field-kit__expand').first().click();
  const viewer = page.locator('#image-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toHaveAttribute('src', /assets\/concepts\//);

  // The record used to be clipped away entirely: the dialog hid its overflow and
  // the image was allowed almost all of the height. Every paragraph must now sit
  // inside the pane that holds it.
  const clipped = await viewer.locator('.image-viewer__record').evaluate((pane) => {
    const bounds = pane.getBoundingClientRect();
    return [...pane.querySelectorAll('p')].filter((paragraph) => {
      const line = paragraph.getBoundingClientRect();
      return line.bottom > bounds.bottom + 1 || line.top < bounds.top - 1;
    }).length;
  });
  expect(clipped).toBe(0);
  await expect(viewer.locator('.image-viewer__record')).toContainText('terraces');

  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
});

test('the console line carries a field note for the mounted frame', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');

  const slot = page.locator('#device-lore-slot');
  const trigger = page.locator('#device-lore-button');
  // No frame, no hardware to have a note about.
  await expect(slot).toBeHidden();

  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#display-controls-drawer')).toBeVisible();
  const astrodyne = SKIN_CATALOGUE.find(({ id }) => id === 'astrodyne');
  await page.selectOption('#device-skin', astrodyne.id);

  await expect(trigger).toHaveText(`About the ${astrodyne.label}`);
  // The open drawer hangs over the console line, so it has to be dismissed
  // before the note underneath it can be reached -- which is what a player does.
  await page.keyboard.press('Escape');
  await expect(page.locator('#display-controls-drawer')).toBeHidden();
  await trigger.click();

  const dialog = page.locator('#device-lore-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.lore-dialog__title')).toHaveText(astrodyne.label);
  // The same catalogue entry the Field Kit renders, so the two copies of the
  // lore cannot drift apart.
  await expect(dialog.locator('.lore-dialog__body'))
    .toContainText(astrodyne.lore.slice(0, 40));

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#display-controls-drawer')).toBeVisible();
  await page.selectOption('#device-skin', 'none');
  await expect(slot).toBeHidden();
});

test('the Diridium unit names its own field note', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/');
  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  // The code applies the frame, so the note points at it without any further
  // action. "About the Diridium" would read as though the ore were the subject.
  await expect(page.locator('#device-lore-button')).toHaveText('About the Diridium case');
});

test('the Diridium strike is only requested once that frame is found', async ({ page }) => {
  const videoRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/video/')) videoRequests.push(request.url());
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.locator('#diridium-lightning')).toHaveCount(0);
  expect(videoRequests).toEqual([]);

  for (const key of [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
  ]) {
    await page.keyboard.press(key);
  }

  // The overlay is built on the first strike, so the clip is downloaded by the
  // players who earned it and by nobody else.
  await expect(page.locator('#diridium-lightning')).toHaveClass(/is-striking/);
  await expect.poll(() => videoRequests.length).toBeGreaterThan(0);
});

test('the mission log lists dispatches with expandable technical notes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.getByRole('link', { name: 'Mission Log' }).click();
  const log = page.locator('#mission-log');
  await expect(log).toBeVisible();

  const entries = log.locator('.log-entry');
  await expect(entries.first().locator('h3')).toBeVisible();
  // Newest first, so the first entry is the most recent transmission number.
  const numbers = await log.locator('.log-entry__number').allInnerTexts();
  const parsed = numbers.map((text) => Number(text.replace(/\D/g, '')));
  expect(parsed).toEqual([...parsed].sort((left, right) => right - left));
  // Every entry is dated for machines as well as for readers.
  await expect(log.locator('.log-entry time[datetime]')).toHaveCount(parsed.length);
  await expect(log.locator('.log-entry__label')).toHaveCount(parsed.length);

  // The technical note is a plain <details>, so it is closed until asked for and
  // keyboard behaviour comes from the platform rather than from us.
  const detail = entries.first().locator('.log-entry__detail');
  await expect(detail.locator('.details-content')).toBeHidden();
  await detail.locator('summary').click();
  await expect(detail.locator('.details-content')).toBeVisible();

  // Curated, not a second changelog: it points at the factual record.
  await expect(log.locator('.source-note a')).toHaveAttribute('href', /CHANGELOG\.md$/);

  // The log carries work that has not shipped as well as work that has. That is
  // the only place on the site unshipped work is named -- and it must stay a
  // teaser: the Field Kit promises the game will not say which frame a coming
  // mini-game unlocks, so no entry may name one.
  const building = log.locator('.log-entry__label--building');
  await expect(building).not.toHaveCount(0);
  const teaserText = await log.locator('.log-entry').filter({ has: building }).allInnerTexts();
  for (const { label } of SKIN_CATALOGUE.filter(({ unlock }) => unlock !== null)) {
    expect(teaserText.join(' ')).not.toContain(label);
  }
});

test('the mission log needs no JavaScript to be read', async ({ browser }) => {
  // None of it depends on game state, so it is static markup: a crawler, a
  // reader-mode pass, or a failed module load must all still get the content.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.locator('#mission-log .log-entry')).not.toHaveCount(0);
  await expect(page.locator('#mission-log .log-entry h3').first()).toBeVisible();
  await context.close();
});

test('every navigation link stays reachable on a phone', async ({ page }) => {
  // The nav used to be a horizontal scroller, which quietly hid its last link
  // once a sixth was added. Adding a link must not cost the previous one its
  // place, so this measures every one against the bar that holds them.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const clipped = await page.evaluate(() => {
    const nav = document.querySelector('.site-nav').getBoundingClientRect();
    return [...document.querySelectorAll('.site-nav a, .site-nav button')]
      .filter((link) => {
        const box = link.getBoundingClientRect();
        return box.left < nav.left - 1 || box.right > nav.right + 1;
      })
      .map((link) => link.textContent.trim());
  });
  expect(clipped).toEqual([]);

  // And the page itself never scrolls sideways to accommodate them.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('the unlock notice clears the header at any viewport', async ({ page }) => {
  // The clearance is measured from the sticky header rather than hard-coded,
  // because the header is a different height once the nav wraps.
  for (const size of [{ width: 1400, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('miner2149.unlockProgress'));
    await page.reload();
    for (const key of [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
    ]) {
      await page.keyboard.press(key);
    }

    const boxes = await page.evaluate(() => ({
      header: document.querySelector('.site-header').getBoundingClientRect().bottom,
      toast: document.querySelector('#skin-unlock-toast').getBoundingClientRect().top,
    }));
    expect(boxes.toast, `notice sits under the header at ${size.width}px`)
      .toBeGreaterThanOrEqual(boxes.header);
  }
});

test('the favicon set is wired and every file it names resolves', async ({ page }) => {
  const missing = [];
  page.on('response', (response) => {
    if (response.status() >= 400) missing.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('/');
  const declared = await page.evaluate(() => [...document.querySelectorAll('link[rel*="icon"], link[rel="manifest"]')]
    .map((link) => ({ rel: link.getAttribute('rel'), href: link.getAttribute('href') })));

  // An SVG for modern tabs, a PNG fallback, the .ico for legacy, a touch icon
  // for iOS, and the manifest.
  expect(declared.map(({ href }) => href)).toEqual([
    '/favicon-96x96.png',
    '/favicon.svg',
    '/favicon.ico',
    '/apple-touch-icon.png',
    '/site.webmanifest',
  ]);

  // Every declared path actually resolves, and so does the bare request a
  // crawler makes without reading the markup at all.
  for (const { href } of declared) {
    const response = await page.request.get(href);
    expect(response.status(), `${href} resolves`).toBe(200);
  }
  expect((await page.request.get('/favicon.ico')).status()).toBe(200);

  // The manifest still carries placeholder identity if nobody edited it.
  const manifest = await (await page.request.get('/site.webmanifest')).json();
  expect(manifest.name).toBe('Miner 2149');
  expect(manifest.theme_color).toBe('#11151d');
  for (const icon of manifest.icons) {
    expect((await page.request.get(icon.src)).status(), `${icon.src} resolves`).toBe(200);
  }

  expect(missing).toEqual([]);
});
