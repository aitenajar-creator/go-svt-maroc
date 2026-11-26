const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 30000,
  outputDir: 'test-results/browser',
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8765', headless: true, serviceWorkers: 'block' },
  webServer: {
    command: 'python3 -B scripts/serve-local.py --port 8765 --quiet',
    url: 'http://127.0.0.1:8765/test-runner.html',
    reuseExistingServer: false,
    timeout: 30000
  }
});
