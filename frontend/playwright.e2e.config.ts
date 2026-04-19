import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'retain-on-failure',
    headless: false,
    launchOptions: {
      slowMo: 300,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
