import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://www.demoblaze.com';

// Test data
const TEST_USER = {
  username: 'TMA',
  password: 'tma@12345'
};

// Product IDs map to /prod.html?idp_=<id> on demoblaze.
// Navigating by URL is deterministic; clicking through index.html relies on an
// onclick handler that is unreliable on the WebKit engine.
const TEST_PRODUCTS = [
  { id: 1, name: 'Samsung galaxy s6', price: 360 },
  { id: 2, name: 'Nokia lumia 1520', price: 820 }
];

// ================================================================
// SHARED HELPERS
// ================================================================

/** Accept every native dialog. Must be registered before any action that opens one. */
function autoAcceptDialogs(page: Page) {
  page.on('dialog', dialog => dialog.accept().catch(() => {}));
}

/** Open a product detail page directly and wait until it is interactive. */
async function gotoProduct(page: Page, productId: number) {
  await page.goto(`${BASE_URL}/prod.html?idp_=${productId}`);
  await page.waitForLoadState('domcontentloaded');
  // The "Add to cart" control is an <a>, not a <button>.
  await page.locator('a:has-text("Add to cart")').waitFor({ state: 'visible', timeout: 20000 });
}

/** Add the currently open product to the cart and wait for the API call to settle. */
async function addCurrentProductToCart(page: Page) {
  // "Product added" is a native alert fired from the /addtocart AJAX success
  // callback (not synchronously with the click), so a fixed sleep either
  // races the request or wastes time. Chốt vào chính response /addtocart.
  const addToCart = page.waitForResponse(
    r => r.url().includes('/addtocart') && r.request().method() === 'POST',
    { timeout: 20000 }
  );
  await page.click('a:has-text("Add to cart")');
  await addToCart;
}

/**
 * Poll Bootstrap 4's internal modal state instead of sleeping through the
 * fade animation. Same guard Bootstrap itself checks before accepting
 * interaction — see LoginPage.closeLoginModalByBackdrop for the full
 * rationale. A fixed 500ms sleep is a guess; this is the actual signal.
 */
async function waitForLoginModalReady(page: Page) {
  await page.waitForFunction(() => {
    const win = window as any;
    if (win.$) {
      const instance = win.$('#logInModal').data('bs.modal');
      if (instance) return instance._isShown === true && instance._isTransitioning === false;
    }
    const el = document.querySelector('#logInModal');
    return el !== null && el.classList.contains('show');
  }, undefined, { timeout: 10000 });
}

/**
 * Navigate to the cart page and wait until every row has actually rendered,
 * using the /viewcart response as the single source of truth for the
 * expected row count (see clearCart() comment: DOM row count during load is
 * not trustworthy, and neither is a fixed sleep — cart.js renders one row
 * per product via N sequential /view calls, so load time scales with cart
 * size).
 */
async function gotoCartAndWaitLoaded(page: Page): Promise<number> {
  const viewCart = page.waitForResponse(
    r => r.url().includes('/viewcart') && r.request().method() === 'POST',
    { timeout: 20000 }
  );
  await page.goto(`${BASE_URL}/cart.html`);
  let expectedRows = 0;
  try {
    const body = await (await viewCart).json();
    expectedRows = Array.isArray(body?.Items) ? body.Items.length : 0;
  } catch {
    // Fall through - toHaveCount below will time out loudly instead of
    // silently trusting a row count read mid-render.
  }
  await expect(page.locator('#tbodyid tr')).toHaveCount(expectedRows, { timeout: 20000 });
  return expectedRows;
}

/**
 * Log in, retrying on transient failures.
 * WebKit intermittently loses the first submit while the Bootstrap modal is
 * still fading, so a single attempt is not reliable.
 */
async function login(page: Page, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto(`${BASE_URL}/index.html`);
      await page.waitForLoadState('domcontentloaded');

      await page.click('#login2');
      await page.locator('#logInModal').waitFor({ state: 'visible', timeout: 10000 });
      await waitForLoginModalReady(page);

      await page.fill('#loginusername', TEST_USER.username);
      await page.fill('#loginpassword', TEST_USER.password);
      await page.click('#logInModal button:has-text("Log in")');

      await page.locator('#nameofuser').waitFor({ state: 'visible', timeout: 15000 });
      return;
    } catch (e) {
      if (i === attempts) throw e;
      // Next loop iteration re-navigates and re-waits from scratch; no fixed
      // backoff needed between attempts.
    }
  }
}

/**
 * Remove every line item so each cart test starts from a known empty state.
 *
 * IMPORTANT: Demoblaze's guest-cart identity cookie (`user=<uuid>`) is only
 * set by the script on index.html (js/index.js). prod.html and cart.html do
 * NOT set it. If cart.html is the very first page visited in a browser
 * context, the request to /viewcart carries an empty cookie, and the backend
 * returns the SHARED bucket used by every cookie-less guest hitting
 * demoblaze.com worldwide - not our own cart. That shared bucket is huge and
 * changes in real time from unrelated traffic, which is exactly why row
 * counts were observed growing mid-poll (163 -> 825, 56 -> 672, 0 -> 720) and
 * totals didn't match a single added product. Visiting index.html first
 * guarantees a private guest identity before any cart.html/prod.html call.
 */
async function clearCart(page: Page) {
  await page.goto(`${BASE_URL}/index.html`);
  await page.waitForLoadState('domcontentloaded');

  await gotoCartAndWaitLoaded(page);

  // Rows re-render after each delete, so always re-query the first one.
  for (let i = 0; i < 40; i++) {
    const deleteLink = page.locator('#tbodyid tr a:has-text("Delete")').first();
    if (await deleteLink.count() === 0) break;

    // deleteItem() in cart.js calls location.reload() after /deleteitem
    // resolves, which fires a fresh /viewcart. Chốt vào đúng response đó
    // thay vì đoán thời gian reload mất bao lâu.
    const viewCartAfterDelete = page.waitForResponse(
      r => r.url().includes('/viewcart') && r.request().method() === 'POST',
      { timeout: 20000 }
    );
    await deleteLink.click();
    let rowsAfter = 0;
    try {
      const body = await (await viewCartAfterDelete).json();
      rowsAfter = Array.isArray(body?.Items) ? body.Items.length : 0;
    } catch {
      // fall through - toHaveCount below fails loudly if this is wrong
    }
    await expect(page.locator('#tbodyid tr')).toHaveCount(rowsAfter, { timeout: 20000 });
  }

  // Fail loudly instead of silently continuing on a dirty cart - if this
  // ever fires again after the cookie fix, it means a real regression, not
  // the shared-bucket issue.
  const remaining = await page.locator('#tbodyid tr').count();
  if (remaining > 0) {
    throw new Error(`clearCart: cart still has ${remaining} item(s) after cleanup`);
  }
}

/** Read the cart total from label#totalm, which stays hidden until items exist. */
async function readCartTotal(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/cart.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => (document.querySelector('#totalm')?.textContent || '').trim().length > 6,
    { timeout: 15000 }
  ).catch(() => {});
  return (await page.locator('#totalm').textContent()) || '';
}

/**
 * REGRESSION TEST SUITE
 *
 * Purpose: Verify Login & Cart features work correctly
 * Scope: Happy paths + critical workflows
 * Coverage: User authentication & shopping cart
 */

test.describe('🔄 REGRESSION TESTS - Login & Cart Features', () => {

  // ================================================================
  // FEATURE 1: LOGIN FUNCTIONALITY
  // ================================================================

  test.describe('1️⃣ LOGIN FEATURE - User Authentication', () => {

    test('REG-LOGIN-001: Valid user can login successfully', async ({ page }) => {
      /**
       * Test: User logs in with valid credentials
       * Expected: Login succeeds, welcome banner shows the username
       */
      await login(page);

      const welcome = page.locator('#nameofuser');
      await expect(welcome).toBeVisible();
      await expect(welcome).toContainText(TEST_USER.username);
    });

    test('REG-LOGIN-002: Invalid credentials rejected', async ({ page }) => {
      /**
       * Test: User tries to login with wrong password
       * Expected: Login fails, modal stays open, no welcome banner
       */
      await page.goto(`${BASE_URL}/index.html`);
      await page.waitForLoadState('domcontentloaded');

      await page.click('#login2');
      await page.locator('#logInModal').waitFor({ state: 'visible', timeout: 10000 });
      await waitForLoginModalReady(page);

      await page.fill('#loginusername', TEST_USER.username);
      await page.fill('#loginpassword', 'wrongpassword123');

      // The rejection alert fires from the /login AJAX callback, not
      // synchronously with the click - wait for the dialog itself rather
      // than sleeping a guessed duration, and assert its actual text so a
      // silently-changed error message would fail loudly instead of being
      // masked by a timing-based check.
      const dialogPromise = page.waitForEvent('dialog', { timeout: 10000 });
      await page.click('#logInModal button:has-text("Log in")');
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Wrong password');
      await dialog.accept();

      // Modal must stay open and the user must NOT be logged in
      await expect(page.locator('#logInModal')).toBeVisible();
      await expect(page.locator('#nameofuser')).toBeHidden();
    });

    test('REG-LOGIN-003: Session persists after page refresh', async ({ page }) => {
      /**
       * Test: User logs in, refreshes page, still logged in
       * Expected: Session token maintained, user stays logged in
       */
      await login(page);

      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const welcome = page.locator('#nameofuser');
      await welcome.waitFor({ state: 'visible', timeout: 15000 });
      await expect(welcome).toContainText(TEST_USER.username);
    });

    test('REG-LOGIN-004: User can logout', async ({ page }) => {
      /**
       * Test: Logged in user clicks logout
       * Expected: User is logged out, login button reappears
       */
      await login(page);

      await page.click('#logout2');

      // Welcome banner disappears and the Log in link comes back
      await page.locator('#login2').waitFor({ state: 'visible', timeout: 10000 });
      await expect(page.locator('#nameofuser')).toBeHidden();
      await expect(page.locator('#login2')).toBeVisible();
    });
  });

  // ================================================================
  // FEATURE 2: CART FUNCTIONALITY
  // ================================================================

  test.describe('2️⃣ CART FEATURE - Shopping Cart Operations', () => {

    test('REG-CART-001: Add product to cart', async ({ page }) => {
      /**
       * Test: User adds product to cart
       * Expected: Product appears in cart, alert confirms the action
       */
      let dialogMessage = '';
      page.on('dialog', dialog => {
        dialogMessage = dialog.message();
        dialog.accept().catch(() => {});
      });

      await clearCart(page);
      await gotoProduct(page, TEST_PRODUCTS[0].id);
      await addCurrentProductToCart(page);

      expect(dialogMessage).toContain('Product added');

      await page.goto(`${BASE_URL}/cart.html`);
      const rows = page.locator('#tbodyid tr');
      await rows.first().waitFor({ state: 'visible', timeout: 15000 });
      expect(await rows.count()).toBeGreaterThan(0);
    });

    test('REG-CART-002: Cart displays correct total', async ({ page }) => {
      /**
       * Test: Cart calculates total price correctly
       * Expected: Total equals the price of the single product added
       */
      autoAcceptDialogs(page);

      await clearCart(page);
      await gotoProduct(page, TEST_PRODUCTS[0].id);
      await addCurrentProductToCart(page);

      const totalText = await readCartTotal(page);
      expect(totalText).toContain(TEST_PRODUCTS[0].price.toString());
    });

    test('REG-CART-003: Remove product from cart', async ({ page }) => {
      /**
       * Test: User removes product from cart
       * Expected: Product removed, row count decreases
       */
      autoAcceptDialogs(page);

      await clearCart(page);
      await gotoProduct(page, TEST_PRODUCTS[0].id);
      await addCurrentProductToCart(page);

      await page.goto(`${BASE_URL}/cart.html`);
      const rows = page.locator('#tbodyid tr');
      await rows.first().waitFor({ state: 'visible', timeout: 15000 });

      const initialCount = await rows.count();
      expect(initialCount).toBeGreaterThan(0);

      await page.locator('#tbodyid tr a:has-text("Delete")').first().click();

      // The table re-renders after the delete API call resolves
      await expect(rows).toHaveCount(initialCount - 1, { timeout: 15000 });
    });

    test('REG-CART-004: Empty cart shows zero total', async ({ page }) => {
      /**
       * Test: Cart with no items shows no total
       * Expected: No rows and total is empty or zero
       */
      autoAcceptDialogs(page);
      await clearCart(page);

      await gotoCartAndWaitLoaded(page);

      // Cart must be empty
      await expect(page.locator('#tbodyid tr')).toHaveCount(0);

      // Demoblaze leaves the total label as "Total:" (no number) when empty
      const totalText = ((await page.locator('#totalm').textContent()) || '').trim();
      expect(totalText).toMatch(/^Total:\s*0?$/);
    });

    test('REG-CART-005: Multiple products in cart', async ({ page }) => {
      /**
       * Test: User adds two different products
       * Expected: Both rows appear and total equals the sum of both prices
       */
      autoAcceptDialogs(page);

      await clearCart(page);

      // Add both products via direct product URLs
      for (const product of TEST_PRODUCTS) {
        await gotoProduct(page, product.id);
        await addCurrentProductToCart(page);
      }

      await page.goto(`${BASE_URL}/cart.html`);
      const rows = page.locator('#tbodyid tr');
      await expect(rows).toHaveCount(TEST_PRODUCTS.length, { timeout: 20000 });

      // Business rule: displayed total must equal the sum of the line items.
      // Reading prices from the table avoids hardcoding catalog prices that
      // could drift without the test noticing.
      const lineItemSum = await page.locator('#tbodyid tr td:nth-child(3)').evaluateAll(
        cells => cells.reduce((sum, c) => sum + Number((c.textContent || '0').trim()), 0)
      );
      expect(lineItemSum).toBeGreaterThan(0);

      const totalText = await readCartTotal(page);
      expect(totalText).toContain(lineItemSum.toString());
    });
  });

  // ================================================================
  // FEATURE 3: INTEGRATION - LOGIN + CART
  // ================================================================

  test.describe('3️⃣ INTEGRATION - Login then Shopping', () => {

    test('REG-INT-001: Login user can add products to cart', async ({ page }) => {
      /**
       * Test: Complete flow - Login → Browse → Add to Cart
       * Expected: All steps work seamlessly and the session survives navigation
       */
      let dialogMessage = '';
      page.on('dialog', dialog => {
        dialogMessage = dialog.message();
        dialog.accept().catch(() => {});
      });

      await clearCart(page);

      // Step 1: Login
      await login(page);
      await expect(page.locator('#nameofuser')).toContainText(TEST_USER.username);

      // Step 2: Add product to cart
      await gotoProduct(page, TEST_PRODUCTS[0].id);
      await addCurrentProductToCart(page);
      expect(dialogMessage).toContain('Product added');

      // Step 3: Verify in cart
      await page.goto(`${BASE_URL}/cart.html`);
      const rows = page.locator('#tbodyid tr');
      await rows.first().waitFor({ state: 'visible', timeout: 15000 });
      expect(await rows.count()).toBeGreaterThan(0);

      // Step 4: Session still active after all that navigation
      await expect(page.locator('#nameofuser')).toBeVisible();
    });

    test('REG-INT-002: Logout clears user context', async ({ page }) => {
      /**
       * Test: User logs out, then logs back in
       * Expected: Previous session cleared, second login succeeds
       */
      await login(page);

      // Logout
      await page.click('#logout2');
      await page.locator('#login2').waitFor({ state: 'visible', timeout: 10000 });
      await expect(page.locator('#nameofuser')).toBeHidden();

      // Login again - reuses the retry-aware helper
      await login(page);
      await expect(page.locator('#nameofuser')).toContainText(TEST_USER.username);
    });

    test('REG-INT-003: Complete order flow - Login → Add to Cart → Place Order → Confirm', async ({ page }) => {
      /**
       * Test: Complete checkout flow including Place Order
       * Steps:
       *   1. Login with valid credentials
       *   2. Add product to cart
       *   3. Navigate to cart and click "Place Order"
       *   4. Fill checkout form (Name, Country, City, Card, Month, Year)
       *   5. Click Purchase button
       *   6. Verify success popup appears
       *
       * Expected: Order is placed successfully, success dialog shown
       */
      autoAcceptDialogs(page);
      await clearCart(page);

      // Step 1: Login
      await login(page);
      await expect(page.locator('#nameofuser')).toContainText(TEST_USER.username);

      // Step 2: Add product to cart
      await gotoProduct(page, TEST_PRODUCTS[0].id);
      await addCurrentProductToCart(page);

      // Step 3: Navigate to cart
      await gotoCartAndWaitLoaded(page);
      const rows = page.locator('#tbodyid tr');
      expect(await rows.count()).toBeGreaterThan(0);

      // Step 4: Click "Place Order" button
      await page.click('button:has-text("Place Order")');
      await page.locator('#orderModal').waitFor({ state: 'visible', timeout: 10000 });

      // Step 5: Fill checkout form
      await page.fill('#name', 'John Doe');
      await page.fill('#country', 'United States');
      await page.fill('#city', 'New York');
      await page.fill('#card', '4532123456789010');
      await page.fill('#month', '12');
      await page.fill('#year', '2025');

      // Step 6: Click Purchase
      await page.click('button[onclick="purchaseOrder()"]');

      // Step 7: Verify success popup
      await page.waitForSelector('.sweet-alert', { timeout: 15000 });
      const successCheckmark = page.locator('.sa-success');
      await expect(successCheckmark).toBeVisible();

      const successText = await page.locator('.sweet-alert p').textContent();
      expect(successText).toBeTruthy();
      expect(successText).toContain('Id:');      // Order ID
      expect(successText).toContain('Name:');    // Name
      expect(successText).toContain('Amount:');  // Amount
      expect(successText).toContain('Card Number:'); // Card

      // Dismiss success dialog
      await page.click('.sweet-alert .confirm');
      await successCheckmark.waitFor({ state: 'hidden', timeout: 10000 });
    });

    test('REG-INT-004: Place Order - Invoice amount matches cart total', async ({ page }) => {
      /**
       * Test: Verify order amount matches cart total before purchase
       * Expected: Invoice shows the exact same amount as cart total
       */
      autoAcceptDialogs(page);
      await clearCart(page);

      // Setup: Login and add product
      await login(page);
      await gotoProduct(page, TEST_PRODUCTS[0].id);
      await addCurrentProductToCart(page);

      // Navigate to cart and capture total
      await gotoCartAndWaitLoaded(page);
      const cartTotalText = await page.locator('#totalp').textContent();
      const expectedTotal = cartTotalText?.trim() || '0';

      // Place order
      await page.click('button:has-text("Place Order")');
      await page.locator('#orderModal').waitFor({ state: 'visible', timeout: 10000 });

      await page.fill('#name', 'Invoice Test');
      await page.fill('#country', 'Vietnam');
      await page.fill('#city', 'Hanoi');
      await page.fill('#card', '5555555555554444');
      await page.fill('#month', '06');
      await page.fill('#year', '2025');

      await page.click('button[onclick="purchaseOrder()"]');
      await page.waitForSelector('.sweet-alert', { timeout: 15000 });

      // Verify invoice amount matches cart total
      const invoiceText = await page.locator('.sweet-alert p').textContent();
      expect(invoiceText).toContain(`Amount: ${expectedTotal}`);

      // Dismiss and verify navigation back to home
      await page.click('.sweet-alert .confirm');
      // Navigation from purchase dialog can take 15-20s (API roundtrip + page load).
      // purchaseOrder() calls location.href = 'index.html' inside the success callback,
      // and page reload is not instantaneous on slow connections.
      await page.waitForURL(/index\.html|\/(?:\?.*)?$/, { timeout: 20000 });
    });
  });
});

// ================================================================
// PERFORMANCE MONITORING (Optional hooks)
// ================================================================

test.describe('📊 PERFORMANCE MARKERS', () => {

  test('PERF-LOGIN: Measure login response time', async ({ page }) => {
    /**
     * Measures only the submit -> welcome-banner roundtrip, so page load and
     * form filling do not pollute the number.
     */
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('domcontentloaded');

    await page.click('#login2');
    await page.locator('#logInModal').waitFor({ state: 'visible', timeout: 10000 });
    await waitForLoginModalReady(page);

    await page.fill('#loginusername', TEST_USER.username);
    await page.fill('#loginpassword', TEST_USER.password);

    const startTime = Date.now();
    await page.click('#logInModal button:has-text("Log in")');
    await page.locator('#nameofuser').waitFor({ state: 'visible', timeout: 20000 });
    const duration = Date.now() - startTime;

    console.log(`✓ Login round-trip: ${duration}ms`);
    expect(duration).toBeLessThan(20000);
  });

  test('PERF-CART: Measure add-to-cart response time', async ({ page }) => {
    /**
     * Measures the click -> confirmation-dialog roundtrip. The previous version
     * measured a fixed sleep, which always reported the sleep duration.
     */
    // Visit index.html first so the guest-cart cookie exists before the
    // addtocart call (see clearCart() comment) - otherwise this write lands
    // in demoblaze's shared cookie-less bucket instead of this context's own cart.
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForLoadState('domcontentloaded');
    await gotoProduct(page, TEST_PRODUCTS[0].id);

    // Arm the dialog listener before clicking so no event is missed
    const dialogPromise = page.waitForEvent('dialog', { timeout: 20000 });

    const startTime = Date.now();
    await page.click('a:has-text("Add to cart")');

    const dialog = await dialogPromise;
    const duration = Date.now() - startTime;
    await dialog.accept().catch(() => {});
    console.log(`✓ Add-to-cart round-trip: ${duration}ms`);
    expect(duration).toBeLessThan(15000);
  });
});
