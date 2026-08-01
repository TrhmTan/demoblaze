import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://www.demoblaze.com';
// Verified live on demoblaze.com (Aug 2026): product cards no longer carry an
// onclick="byId(...)" attribute - they're plain `<a class="hrefch" href="prod.html?idp_=N">`.
// The old selector a[onclick*="byid"] matches 0 elements, so .click() on it
// hangs forever waiting for a match that will never appear, until the global
// test timeout (120000ms) kills the test. That is the actual cause of
// PERF-LOAD-001/002/003 failing with "Test timeout of 120000ms exceeded".
const PRODUCT_LINK_SELECTOR = 'a.hrefch';
const metrics: any[] = [];

function recordMetric(testName: string, responseTime: number, status: 'success' | 'failure', error?: string) {
  metrics.push({
    testName,
    timestamp: Date.now(),
    responseTime,
    status,
    error,
  });
}

function getPercentile(percentile: number) {
  const sorted = [...metrics.map((m: any) => m.responseTime)].sort((a: number, b: number) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

// ================================================================
// LOAD TESTING
// ================================================================

test.describe('⚡ LOAD TESTING - Normal Load (5-10 concurrent users)', () => {

  test('PERF-LOAD-001: Browse products under normal load', async ({ page }) => {
    const testName = 'Browse Products';
    let startTime = 0;
    let responseTime = 0;

    try {
      startTime = Date.now();
      await page.goto(`${BASE_URL}/index.html`);
      await page.waitForLoadState('load');
      await page.locator(PRODUCT_LINK_SELECTOR).first().click({ timeout: 15000 });
      await page.waitForLoadState('load');
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'success');
      console.log(`✓ ${testName}: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(10000);
    } catch (e) {
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'failure', (e as Error).message);
      console.log(`✗ ${testName}: Failed - ${e}`);
      throw e; // don't swallow real failures - a caught expect() must still fail the test
    }
  });

  test('PERF-LOAD-002: Add product to cart under normal load', async ({ page }) => {
    const testName = 'Add to Cart';
    let startTime = 0;
    let responseTime = 0;

    try {
      startTime = Date.now();
      page.on('dialog', async dialog => { await dialog.accept(); });
      await page.goto(`${BASE_URL}/index.html`);
      await page.waitForLoadState('load');
      await page.locator(PRODUCT_LINK_SELECTOR).first().click({ timeout: 15000 });
      await page.waitForTimeout(500);
      await page.click('a:has-text("Add to cart")');
      await page.waitForTimeout(1000);
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'success');
      console.log(`✓ ${testName}: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(10000);
    } catch (e) {
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'failure', (e as Error).message);
      console.log(`✗ ${testName}: Failed - ${e}`);
      throw e;
    }
  });

  test('PERF-LOAD-003: Complete purchase flow under normal load', async ({ page }) => {
    const testName = 'Complete Flow';
    let startTime = 0;
    let responseTime = 0;

    try {
      startTime = Date.now();
      page.on('dialog', async dialog => { await dialog.accept(); });
      await page.goto(`${BASE_URL}/index.html`);
      await page.locator(PRODUCT_LINK_SELECTOR).first().click({ timeout: 15000 });
      await page.waitForTimeout(500);
      await page.click('a:has-text("Add to cart")');
      await page.waitForTimeout(1000);
      await page.click('a:has-text("Cart")');
      await page.waitForLoadState('load');
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'success');
      console.log(`✓ ${testName}: ${responseTime}ms`);
      expect(responseTime).toBeLessThan(15000);
    } catch (e) {
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'failure', (e as Error).message);
      console.log(`✗ ${testName}: Failed - ${e}`);
      throw e;
    }
  });
});

// ================================================================
// STRESS TESTING
// ================================================================

test.describe('🔥 STRESS TESTING - High Load (50+ concurrent simulated)', () => {

  test('PERF-STRESS-001: Rapid product browsing (stress test)', async ({ page }) => {
    const testName = 'Rapid Browse';
    let startTime = 0;
    let responseTime = 0;
    let successCount = 0;

    try {
      startTime = Date.now();
      await page.goto(`${BASE_URL}/index.html`);
      await page.waitForLoadState('load');

      for (let i = 0; i < 5; i++) {
        try {
          // Re-query product links on each iteration: after goBack() + page load,
          // the old cached locator from the previous iteration is stale.
          const productLinks = await page.locator(PRODUCT_LINK_SELECTOR).all();
          if (productLinks.length === 0) {
            console.log(`  Iteration ${i}: no product links found`);
            break;
          }
          await productLinks[0].click({ timeout: 15000 });
          await page.waitForLoadState('load');
          await page.waitForTimeout(200);
          successCount++;
          await page.goBack();
          await page.waitForLoadState('load');
        } catch (e) {
          console.log(`  Product ${i} failed: ${e}`);
        }
      }

      responseTime = Date.now() - startTime;
      const status = successCount === 5 ? 'success' : 'failure';
      recordMetric(testName, responseTime, status as 'success' | 'failure');
      console.log(`✓ ${testName}: ${responseTime}ms (${successCount}/5)`);
      expect(successCount).toBeGreaterThan(3);
    } catch (e) {
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'failure', (e as Error).message);
      console.log(`✗ ${testName}: Failed - ${e}`);
      throw e; // was silently swallowed before - this assertion never actually failed the test
    }
  });

  test('PERF-STRESS-002: Multiple add-to-cart operations (stress test)', async ({ page }) => {
    const testName = 'Rapid Add to Cart';
    let startTime = 0;
    let responseTime = 0;
    let successCount = 0;

    try {
      startTime = Date.now();
      page.on('dialog', async dialog => { await dialog.accept(); });
      await page.goto(`${BASE_URL}/index.html`);
      await page.waitForLoadState('load');

      for (let i = 0; i < 3; i++) {
        try {
          // Re-query product links on each iteration to avoid stale locators
          // (after clicking Home to return, the previously cached product list is no longer valid).
          const productLinks = await page.locator(PRODUCT_LINK_SELECTOR).all();
          if (productLinks.length === 0) {
            console.log(`  Iteration ${i}: no product links found`);
            break;
          }
          await productLinks[0].click({ timeout: 15000 });
          await page.waitForLoadState('load');
          await page.waitForTimeout(300);
          const addButtons = await page.locator('a:has-text("Add to cart")').all();
          if (addButtons.length > 0) {
            await addButtons[0].click({ timeout: 15000 });
            await page.waitForTimeout(300);
            successCount++;
          }
          await page.click('a:has-text("Home")');
          await page.waitForLoadState('load');
        } catch (e) {
          console.log(`  Product ${i} add failed: ${e}`);
        }
      }

      responseTime = Date.now() - startTime;
      const status = successCount >= 1 ? 'success' : 'failure';
      recordMetric(testName, responseTime, status as 'success' | 'failure');
      console.log(`✓ ${testName}: ${responseTime}ms (${successCount}/3)`);
      expect(successCount).toBeGreaterThan(0);
    } catch (e) {
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'failure', (e as Error).message);
      console.log(`✗ ${testName}: Failed - ${e}`);
      throw e;
    }
  });

  test('PERF-STRESS-003: Repeated login attempts (stress test)', async ({ page }) => {
    const testName = 'Repeated Login';
    let startTime = 0;
    let responseTime = 0;
    let successCount = 0;

    try {
      startTime = Date.now();

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await page.goto(`${BASE_URL}/index.html`);
          await page.click('a:has-text("Log in")');
          await page.waitForSelector('#logInModal', { timeout: 5000 });
          await page.fill('#loginusername', 'TMA');
          await page.fill('#loginpassword', 'tma@12345');
          await page.click('#logInModal button:has-text("Log in")');
          await page.waitForSelector('a:has-text("Welcome")', { timeout: 5000 });
          successCount++;
          await page.click('a:has-text("Log out")').catch(() => {});
          await page.waitForTimeout(300);
        } catch (e) {
          console.log(`  Login attempt ${attempt + 1} failed`);
        }
      }

      responseTime = Date.now() - startTime;
      const status = successCount >= 2 ? 'success' : 'failure';
      recordMetric(testName, responseTime, status as 'success' | 'failure');
      console.log(`✓ ${testName}: ${responseTime}ms (${successCount}/3)`);
      expect(successCount).toBeGreaterThan(0);
    } catch (e) {
      responseTime = Date.now() - startTime;
      recordMetric(testName, responseTime, 'failure', (e as Error).message);
      console.log(`✗ ${testName}: Failed - ${e}`);
      throw e;
    }
  });
});

// ================================================================
// SAVE METRICS REPORT
// ================================================================

test.afterAll(async () => {
  if (metrics.length === 0) return;

  const summary = {
    totalRequests: metrics.length,
    successfulRequests: metrics.filter((m: any) => m.status === 'success').length,
    failedRequests: metrics.filter((m: any) => m.status === 'failure').length,
    averageResponseTime: metrics.reduce((sum: number, m: any) => sum + m.responseTime, 0) / metrics.length,
    minResponseTime: Math.min(...metrics.map((m: any) => m.responseTime)),
    maxResponseTime: Math.max(...metrics.map((m: any) => m.responseTime)),
    successRate: ((metrics.filter((m: any) => m.status === 'success').length / metrics.length) * 100).toFixed(2),
    p50: getPercentile(50),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };

  console.log('\n' + '='.repeat(60));
  console.log('📊 PERFORMANCE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Requests: ${summary.totalRequests}`);
  console.log(`Successful: ${summary.successfulRequests}`);
  console.log(`Failed: ${summary.failedRequests}`);
  console.log(`Success Rate: ${summary.successRate}%`);
  console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
  console.log(`Min: ${summary.minResponseTime}ms, Max: ${summary.maxResponseTime}ms`);
  console.log(`P50: ${summary.p50}ms, P95: ${summary.p95}ms, P99: ${summary.p99}ms`);
  console.log('='.repeat(60) + '\n');

  const reportPath = path.join(__dirname, '../test-results/performance-report.json');
  const reportDir = path.dirname(reportPath);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary,
    metrics,
  }, null, 2));

  console.log(`✓ Report saved to: test-results/performance-report.json\n`);
});
