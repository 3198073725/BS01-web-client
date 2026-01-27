// @ts-check
const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://localhost:8081',
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'PORT=8081 VUE_APP_OVERLAY=0 npm run serve',
    url: 'http://localhost:8081',
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
})
