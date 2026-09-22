import {defineConfig, devices} from '@playwright/test';

/**
 * End-to-end tests against the production build, served exactly like GitHub Pages serves it.
 * Pages were prerendered against the mock API; in the browser, requests to dummyjson are routed to the same
 * mock handler (see e2e/fixtures.ts), so prerendered HTML and client revalidation always agree.
 */
const APP_PORT = 4300;

export default defineConfig({
  forbidOnly: !!process.env['CI'],
  fullyParallel: true,
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'mobile', use: {...devices['Pixel 7']}},
  ],
  reporter: process.env['CI'] ? [['github'], ['html', {open: 'never'}]] : 'list',
  retries: process.env['CI'] ? 1 : 0,
  testDir: 'e2e',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    // A Service Worker fetches on its own, bypassing `page.route()` — the mock API would silently stop applying.
    // The offline scenarios exercise IndexedDB and the outbox, which do not need the worker.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    // The prerendered site served like GitHub Pages. The build is made against the mock API
    // (`npm run build:mock`, run automatically by `pree2e`); browser requests are routed to the same mock.
    command: 'node scripts/serve-static.mjs',
    env: {BASE_HREF: '/', PORT: String(APP_PORT)},
    port: APP_PORT,
    reuseExistingServer: !process.env['CI'],
  },
});
