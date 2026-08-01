import { defineConfig, devices } from '@playwright/test';

/**
 * Unified config for all 5 automated test suites:
 * - Login / Cart / API (map 1:1 to manual test case sheets in
 *   inputdata/Demoblaze_QA_TestCases.xlsx)
 * - Regression (internal quality gate)
 * - Performance (load + stress testing)
 *
 * Outputs a JSON report to reports/test-results/latest/results.json that
 * scripts/sync_test_results_to_xlsx.py reads to fill in the Actual Result /
 * Status columns for Login/Cart/API sheets. Regression + Performance results
 * are archived for trend analysis.
 *
 * Run via: npm run test:manual-suite
 * (that npm script also archives the previous "latest" run and syncs the
 * Login/Cart/API results to xlsx - see package.json).
 */
export default defineConfig({
  testDir: './tests',
  testMatch: [
    'login.spec.ts',
    'cart.spec.ts',
    'api.spec.ts',
    'regression.spec.ts',
    'performance.spec.ts',
  ],
  // Regression timeout: 90s, Performance timeout: 120s → use 120s global
  timeout: 120 * 1000,
  // Performance tests must run sequentially to avoid interference.
  // Sequential is safer and more predictable overall.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  expect: { timeout: 15 * 1000 },
  use: {
    baseURL: 'https://www.demoblaze.com',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/test-results/latest/html-report', open: 'never' }],
    ['json', { outputFile: 'reports/test-results/latest/results.json' }],
  ],
});
