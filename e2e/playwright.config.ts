import { defineConfig, devices } from '@playwright/test'
import { ADMIN_STORAGE_STATE, BASE_URL } from './env'

const isCi = !!process.env.CI

// biome-ignore lint/style/noDefaultExport: Playwright config
export default defineConfig({
  testDir: './tests',
  // Starts PostgreSQL and Mailpit containers and the server bundle; see global-setup.ts
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: isCi ? 2 : undefined,
  reporter: isCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
})
