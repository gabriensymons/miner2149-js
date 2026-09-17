import { expect, test } from '@playwright/test';

import { isSupabaseUrl } from './helpers.js';

// Boot: the page loads, production services stay blocked, and the first control
// on the canvas responds. Everything past the title screen lives elsewhere.

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
