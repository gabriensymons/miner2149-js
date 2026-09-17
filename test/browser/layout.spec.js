import { expect, test } from '@playwright/test';

import { DEFAULT_SKIN_IDS, SKIN_CATALOGUE } from '../../scripts/skin-catalogue.js';
import { enterKonamiCode } from './helpers.js';

// Responsive behaviour: the canvas, the frame around it, the header drawer, and
// the chrome that has to keep working from a phone to an extra-large desktop.
// These need a real layout engine, which is why they are not Node tests.

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
    await enterKonamiCode(page);

    const boxes = await page.evaluate(() => ({
      header: document.querySelector('.site-header').getBoundingClientRect().bottom,
      toast: document.querySelector('#skin-unlock-toast').getBoundingClientRect().top,
    }));
    expect(boxes.toast, `notice sits under the header at ${size.width}px`)
      .toBeGreaterThanOrEqual(boxes.header);
  }
});
