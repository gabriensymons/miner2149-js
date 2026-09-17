import { expect, test } from '@playwright/test';

// What is left here after the content assertions moved to Node
// (test/mission-log-content.test.js): the one thing a file read cannot answer.
//
// The markup being a plain closed <details> does not prove the note actually
// appears when it is opened -- a stylesheet can hide the content in the open
// state too. That has bitten this project before, which is why AGENTS.md carries
// an invariant about giving a <dialog> its `display` only while `[open]`.

test('opening a technical note reveals it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await page.getByRole('link', { name: 'Mission Log' }).click();
  const log = page.locator('#mission-log');
  await expect(log).toBeVisible();

  const detail = log.locator('.log-entry').first().locator('.log-entry__detail');
  await expect(detail.locator('.details-content')).toBeHidden();

  await detail.locator('summary').click();
  await expect(detail.locator('.details-content')).toBeVisible();

  // And it closes again, so the section does not grow permanently on one click.
  await detail.locator('summary').click();
  await expect(detail.locator('.details-content')).toBeHidden();
});
