import { expect, test } from '@playwright/test';

import { DEFAULT_SKIN_IDS, SKIN_CATALOGUE } from '../../scripts/skin-catalogue.js';
import { enterKonamiCode } from './helpers.js';

// Earning things: the Konami sequence, what it releases, the Field Kit that
// catalogues it, and the badge and archive plates that come with it.
//
// The matcher itself is covered by konami.test.js in Node; these are the wiring,
// the persistence, and what the player actually sees.

test('the Konami code unlocks a frame that survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const konamiFrame = SKIN_CATALOGUE.find(({ unlock }) => unlock === 'konami');
  const locked = page.locator(`#device-skin option[value="${konamiFrame.id}"]`);
  // Asserted as a property rather than with toBeDisabled(): Playwright does not
  // treat <option> as a disableable control and reports it enabled regardless.
  const isLocked = () => locked.evaluate((option) => option.disabled);
  await expect.poll(isLocked).toBe(true);

  await enterKonamiCode(page);

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
  await enterKonamiCode(page);

  await expect.poll(
    () => page.locator(`#device-skin option[value="${konamiFrame.id}"]`)
      .evaluate((option) => option.disabled),
  ).toBe(true);
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

  await enterKonamiCode(page);

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

  await enterKonamiCode(page);

  await expect(toggle).toHaveClass(/has-unseen/);
  // Two, not one: the Diridium unit brings the dark matter screen color with
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
  await enterKonamiCode(page);

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
  await enterKonamiCode(page);

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

  await enterKonamiCode(page);

  // The overlay is built on the first strike, so the clip is downloaded by the
  // players who earned it and by nobody else.
  await expect(page.locator('#diridium-lightning')).toHaveClass(/is-striking/);
  await expect.poll(() => videoRequests.length).toBeGreaterThan(0);
});
