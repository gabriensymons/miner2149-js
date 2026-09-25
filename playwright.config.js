import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  // One browser at a time on CI. A runner renders the canvas in software, and
  // two workers put two software-rendering Chromiums on the same few cores:
  // the two heaviest files, mine-screen and lifecycle, starved each other into
  // timeouts whenever they overlapped, and which of them lost depended on which
  // ran longer. Locally there is a GPU and the default stays.
  workers: process.env.CI ? 1 : undefined,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? 'chrome' : undefined,
    headless: true,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node ./node_modules/http-server/bin/http-server dist -p 4173 -c-1',
    port: 4173,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
