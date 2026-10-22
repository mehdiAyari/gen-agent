import { defineConfig } from '@playwright/test';

const port = 4322;

// The web generator, built as a static site (pnpm --filter @gen-agent/web build), in the installed Google Chrome.
export default defineConfig({
  testDir: 'web',
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${String(port)}`, channel: 'chrome', acceptDownloads: true },
  webServer: {
    command: 'node scripts/serve-web.js',
    url: `http://localhost:${String(port)}/en/`,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env.CI,
  },
});
