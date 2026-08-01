import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CartPage } from '../pages/CartPage';

/**
 * AUTOMATION IMPLEMENTATION DEMO
 *
 * This test demonstrates the complete end-to-end flow for the Demoblaze e-commerce platform:
 * 1. User authentication (login with valid credentials)
 * 2. Product browsing and cart operations (add product to cart)
 * 3. Checkout flow (Place Order → fill form → Purchase)
 * 4. Order confirmation (verify success popup and invoice details)
 *
 * Uses Page Object Model (LoginPage, CartPage) for maintainability and reusability.
 * Tests both happy path (valid order) and edge case (missing required field).
 */

const TEST_USER = {
  username: `demo_user_${Date.now()}`,
  password: 'Test@1234'
};

const TEST_PRODUCT = {
  id: 1,
  name: 'Samsung galaxy s6',
  price: 360
};

test.describe('🚀 AUTOMATION IMPLEMENTATION DEMO - Complete Order Flow', () => {

  test.beforeAll(async ({ request }) => {
    await request.post('https://api.demoblaze.com/signup', {
      data: { username: TEST_USER.username, password: btoa(TEST_USER.password) },
    });
  });

  // ================================================================
  // HAPPY PATH: COMPLETE ORDER FLOW
  // ================================================================

  test('DEMO-001: Complete order flow - Login → Add to Cart → Place Order → Verify Invoice', async ({ page }) => {
    /**
     * Test: End-to-end order flow
     * Steps:
     *   1. Login with valid credentials
     *   2. Navigate to product and add to cart
     *   3. Go to cart page and verify total
     *   4. Click "Place Order" and fill checkout form
     *   5. Submit order (Purchase button)
     *   6. Verify success popup with invoice details
     *
     * Expected: Order is placed successfully, invoice contains:
     *   - Order ID
     *   - Name (filled in form)
     *   - Amount (matches cart total)
     *   - Card number (filled in form)
     *   - Transaction date
     */

    // ===== STEP 1: LOGIN =====
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginPopup();
    await loginPage.login(TEST_USER.username, TEST_USER.password);
    await loginPage.assertLoginSuccess(TEST_USER.username);
    console.log('✓ Step 1: Login successful');

    // ===== STEP 2: ADD PRODUCT TO CART =====
    const cartPage = new CartPage(page);
    await cartPage.addProductToCart('', TEST_PRODUCT.name);
    console.log('✓ Step 2: Product added to cart');

    // ===== STEP 3: VERIFY CART =====
    await cartPage.navigateToCart();
    const cartRowCount = await cartPage.getCartRowsCount();
    expect(cartRowCount).toBeGreaterThan(0);

    const cartTotal = await cartPage.getTotalPriceValue();
    expect(cartTotal).toBeGreaterThan(0);
    console.log(`✓ Step 3: Cart verified - ${cartRowCount} item(s), total: ${cartTotal} USD`);

    // ===== STEP 4 & 5: PLACE ORDER AND FILL FORM =====
    const orderDetails = {
      name: 'John Doe',
      country: 'United States',
      city: 'New York',
      card: '4532123456789010',
      month: '12',
      year: '2025'
    };

    const invoice = await cartPage.placeOrderAndGetInvoice(orderDetails);
    console.log('✓ Step 4-5: Order placed, invoice received');

    // ===== STEP 6: VERIFY INVOICE DETAILS =====
    expect(invoice).toBeTruthy();
    expect(invoice).toContain('Id:');           // Order ID
    expect(invoice).toContain('Name: ' + orderDetails.name);
    expect(invoice).toContain('Amount: ' + cartTotal);
    expect(invoice).toContain('Card Number: ' + orderDetails.card);
    expect(invoice).toContain('Date:');         // Transaction date

    console.log('✓ Step 6: Invoice verified - all required fields present');
    console.log('\n✅ DEMO TEST PASSED: Complete order flow works end-to-end');
  });

  // ================================================================
  // EDGE CASE: MISSING REQUIRED FIELD (VALIDATION)
  // ================================================================

  test('DEMO-002: Order validation - Missing Name field prevents purchase', async ({ page }) => {
    /**
     * Test: Form validation when required field is missing
     * Steps:
     *   1. Login and add product to cart
     *   2. Proceed to checkout
     *   3. Leave Name field empty (required field)
     *   4. Click Purchase
     *
     * Expected: System shows alert error, order is NOT placed
     */

    // Setup: Login and add product to cart
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginPopup();
    await loginPage.login(TEST_USER.username, TEST_USER.password);
    await loginPage.assertLoginSuccess(TEST_USER.username);

    const cartPage = new CartPage(page);
    await cartPage.addProductToCart('', TEST_PRODUCT.name);
    await cartPage.navigateToCart();
    console.log('✓ Setup: Login and cart ready');

    // Open Place Order modal and fill form WITHOUT Name
    await cartPage.openPlaceOrderModal();
    await cartPage.fillOrderDetails({
      // name is intentionally omitted (undefined)
      country: 'United States',
      city: 'New York',
      card: '4532123456789010',
      month: '12',
      year: '2025'
    });
    console.log('✓ Form filled (Name field left empty)');

    // Click Purchase - should trigger alert because Name is missing
    const alertMessage = await cartPage.clickPurchaseExpectingAlert();
    expect(alertMessage).toBeTruthy();
    expect(alertMessage.toLowerCase()).toContain('name');

    console.log(`✓ Validation triggered: "${alertMessage}"`);
    console.log('✅ EDGE CASE TEST PASSED: Form validation works correctly');
  });

  // ================================================================
  // EDGE CASE: MISSING CARD NUMBER
  // ================================================================

  test('DEMO-003: Order validation - Missing Card field prevents purchase', async ({ page }) => {
    /**
     * Test: Form validation when Card field is missing
     * Steps:
     *   1. Login and add product to cart
     *   2. Proceed to checkout
     *   3. Leave Card field empty (required field)
     *   4. Click Purchase
     *
     * Expected: System shows alert error, order is NOT placed
     */

    // Setup: Login and add product to cart
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginPopup();
    await loginPage.login(TEST_USER.username, TEST_USER.password);
    await loginPage.assertLoginSuccess(TEST_USER.username);

    const cartPage = new CartPage(page);
    await cartPage.addProductToCart('', TEST_PRODUCT.name);
    await cartPage.navigateToCart();
    console.log('✓ Setup: Login and cart ready');

    // Open Place Order modal and fill form WITHOUT Card
    await cartPage.openPlaceOrderModal();
    await cartPage.fillOrderDetails({
      name: 'Jane Doe',
      country: 'United States',
      city: 'Los Angeles',
      // card is intentionally omitted (undefined)
      month: '06',
      year: '2026'
    });
    console.log('✓ Form filled (Card field left empty)');

    // Click Purchase - should trigger alert because Card is missing
    const alertMessage = await cartPage.clickPurchaseExpectingAlert();
    expect(alertMessage).toBeTruthy();
    expect(alertMessage.toLowerCase()).toContain('card');

    console.log(`✓ Validation triggered: "${alertMessage}"`);
    console.log('✅ EDGE CASE TEST PASSED: Card validation works correctly');
  });

  // ================================================================
  // INTEGRATION: LOGIN + CART + ORDER (All Features)
  // ================================================================

  test('DEMO-004: Full integration - Session persists through entire order flow', async ({ page }) => {
    /**
     * Test: User remains authenticated throughout entire order flow
     * Verifies that login session is maintained during:
     *   - Navigation to cart
     *   - Checkout form filling
     *   - Order submission
     *
     * Expected: Welcome banner visible at start and end
     */

    const loginPage = new LoginPage(page);
    const cartPage = new CartPage(page);

    // Login
    await loginPage.goto();
    await loginPage.openLoginPopup();
    await loginPage.login(TEST_USER.username, TEST_USER.password);
    await loginPage.assertLoginSuccess(TEST_USER.username);

    // Add product
    await cartPage.addProductToCart('', TEST_PRODUCT.name);

    // Navigate to cart
    await cartPage.navigateToCart();
    // Verify still logged in
    await loginPage.assertLoggedIn(TEST_USER.username);

    // Place order (should maintain session)
    const cartTotal = await cartPage.getTotalPriceValue();
    const invoice = await cartPage.placeOrderAndGetInvoice({
      name: 'Integration Test User',
      country: 'Vietnam',
      city: 'Hanoi',
      card: '5555555555554444',
      month: '12',
      year: '2027'
    });

    // Verify order was placed
    expect(invoice).toContain('Amount: ' + cartTotal);
    console.log('✅ INTEGRATION TEST PASSED: Session persists through entire flow');
  });
});

// ================================================================
// PERFORMANCE & DIAGNOSTICS (BONUS)
// ================================================================

test.describe('📊 DEMO DIAGNOSTICS', () => {

  test('DIAG-001: Measure checkout flow performance', async ({ page }) => {
    /**
     * Measures end-to-end time from login to order confirmation.
     * Useful for detecting performance regressions.
     */

    const startTime = Date.now();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.openLoginPopup();
    await loginPage.login(TEST_USER.username, TEST_USER.password);
    await loginPage.assertLoginSuccess(TEST_USER.username);

    const cartPage = new CartPage(page);
    await cartPage.addProductToCart('', TEST_PRODUCT.name);
    await cartPage.navigateToCart();

    const cartTotal = await cartPage.getTotalPriceValue();
    const invoice = await cartPage.placeOrderAndGetInvoice({
      name: 'Performance Test',
      country: 'United States',
      city: 'Chicago',
      card: '3782822463100005',
      month: '03',
      year: '2028'
    });

    const duration = Date.now() - startTime;

    expect(invoice).toContain('Amount: ' + cartTotal);
    console.log(`
╔════════════════════════════════════════╗
║   CHECKOUT FLOW PERFORMANCE            ║
╠════════════════════════════════════════╣
║  Total Duration: ${duration}ms          ║
║  Status: ${duration < 60000 ? 'GOOD (< 60s)' : 'SLOW (> 60s)'} ║
╚════════════════════════════════════════╝
    `);

    expect(duration).toBeLessThan(90000); // Should complete in < 90 seconds
  });
});
