import { expect, test } from '@playwright/test';

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

  await page.selectOption('#device-skin', 'palm-iiic');
  await expect(page.locator('#palm-frame')).toHaveAttribute('data-skin', 'palm-iiic');
  await expect(page.locator('#device-skin option')).toHaveCount(7);
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
