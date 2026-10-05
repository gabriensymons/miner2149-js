import { expect, test } from '@playwright/test';

import { RECORDS_EVENT } from '../../scripts/local-best-score.js';

// The Records section is built by site-controls.js from this browser's records:
// what records-board.test.js cannot see is the page doing it -- opening on the
// last colony's board, following the chips, remembering the one picked, and
// redrawing when the game says a board changed.

test('the Records section shows the last board played, follows the chips, and redraws when a board changes', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('miner2149.localBestScore', JSON.stringify({ normal: { 3: [{ score: 6000000, name: 'Ada' }] }, disaster: {} }));
    localStorage.setItem('miner2149.highScoreBoard', JSON.stringify({ category: 'normal', difficulty: 3 }));
  });
  await page.goto('/');
  const section = page.locator('#records');
  const rows = section.locator('tbody tr');

  await expect(section.locator('caption')).toHaveText('Class 3');
  await expect(section.getByRole('radio', { name: 'Class 3' })).toBeChecked();
  await expect(section.getByRole('radio', { name: 'Normal' })).toBeChecked();
  await expect(rows).toHaveCount(10);
  await expect(rows.nth(0)).toHaveClass('is-player');
  await expect(rows.nth(1)).toHaveClass('is-archive');
  await expect(rows.nth(0)).toHaveText(/^1Ada6,000,000$/);
  await expect(rows.nth(1)).toHaveText(/^2Mr\. Nobodyarchive5,000,000$/);

  await section.getByText('Class 1', { exact: true }).click();
  await expect(section.locator('caption')).toHaveText('Class 1');
  await expect(rows.nth(0)).toHaveText(/^1Mr\. Nobodyarchive5,000,000$/);

  // The game writes, then tells the page; nothing is reloaded.
  await page.evaluate((event) => {
    localStorage.setItem('miner2149.localBestScore', JSON.stringify({ normal: { 1: [{ score: 7000000, name: 'Bo' }] }, disaster: {} }));
    document.dispatchEvent(new CustomEvent(event));
  }, RECORDS_EVENT);
  await expect(rows.nth(0)).toHaveText(/^1Bo7,000,000$/);

  // The board picked is remembered, over the last colony's, on reload.
  await page.reload();
  await expect(section.getByRole('radio', { name: 'Class 1' })).toBeChecked();
  await expect(section.locator('caption')).toHaveText('Class 1');
});
