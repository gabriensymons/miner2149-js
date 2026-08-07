import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? 'chrome' : undefined,
    headless: true,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'node ./node_modules/http-server/bin/http-server . -p 4173 -c-1',
    port: 4173,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
