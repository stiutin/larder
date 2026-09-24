import {defineConfig, devices} from '@playwright/test';

const APP_PORT = 4300;

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  projects: [
    {name: 'chromium', use: {...devices['Desktop Chrome']}},
    {name: 'mobile', use: {...devices['Pixel 7']}},
  ],
  reporter: process.env.CI ? [['github'], ['html', {open: 'never'}]] : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: 'e2e',
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: {executablePath: process.env.CHROMIUM_PATH ?? undefined},
  },
  webServer: {
    command: 'node scripts/serve-static.mjs',
    env: {BASE_HREF: '/', PORT: String(APP_PORT)},
    port: APP_PORT,
    reuseExistingServer: !process.env.CI,
  },
});
