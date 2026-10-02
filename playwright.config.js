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
  // Every test with its duration, on CI too, where the default is a line of
  // dots. Each test's time is what decides how the projects below are split.
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_USE_SYSTEM_CHROME ? 'chrome' : undefined,
    headless: true,
    serviceWorkers: 'block',
  },
  // The suite split three ways by measured time, for CI to run on three runners
  // at once (.github/workflows/ci.yml); locally all three run, as one suite.
  // Playwright's own --shard splits by test count in file order, and the time
  // here is concentrated: lifecycle.spec.js is about 60% of it, so count-based
  // shards came out lopsided. The filters are complements -- lifecycle without
  // the @resign tag, lifecycle with it, everything but lifecycle -- so every
  // test runs exactly once and a new spec file lands in `site-and-screens`
  // without anyone listing it.
  projects: [
    { name: 'saves', testMatch: 'lifecycle.spec.js', grepInvert: /@resign/ },
    { name: 'resign', testMatch: 'lifecycle.spec.js', grep: /@resign/ },
    { name: 'site-and-screens', testIgnore: 'lifecycle.spec.js' },
  ],
  webServer: {
    command: 'node ./node_modules/http-server/bin/http-server dist -p 4173 -c-1',
    port: 4173,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
