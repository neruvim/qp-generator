import { defineConfig, devices } from '@playwright/test';
const externalURL = process.env.E2E_BASE_URL;
export default defineConfig({
  testDir: './e2e', fullyParallel: true, timeout: 30000,
  use: { baseURL: externalURL || 'http://localhost:4173', trace: 'retain-on-failure' },
  webServer: externalURL ? undefined : { command: 'npm run preview -- --port 4173', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
});
