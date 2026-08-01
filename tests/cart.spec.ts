import { test, expect } from '@playwright/test';
import { CartPage } from '../pages/CartPage';

// We use dynamic timestamped user so we start with a clean isolated server cart session.
// Note: Demoblaze guest cart is tied to browser context session.
const UNIQUE_USER = `cart_user_${Date.now()}`;
const UNIQUE_PASS = 'Test@1234';

test.describe('CartPage Test Suite', () => {
    test.beforeAll(async ({ request }) => {
        // Register unique test account to keep sessions clean
        await request.post('https://api.demoblaze.com/signup', {
            data: { username: UNIQUE_USER, password: btoa(UNIQUE_PASS) },
        });
    });

    test.beforeEach(async ({ page }) => {
        // Ensure clean page context state before each test.
        //
        // Visiting index.html first is NOT optional: Demoblaze's guest-cart
        // identity cookie (user=<uuid>) is set only by js/index.js. Landing
        // straight on cart.html/prod.html sends an empty cookie to /viewcart
        // and gets back the bucket shared by every cookie-less guest (see
        // DEF-SYS-001). Playwright already gives each test a fresh browser
        // context - and therefore a fresh cookie and a private cart - so no
        // explicit cart teardown is needed on top of this.
        await page.goto('/');
    });

    // TC-CRT-001: Add a product to the cart
    test('TC-CRT-001: Add a product to the cart', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const count = await cartPage.getCartRowsCount();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    // TC-CRT-002: Verify cart page displays added product correctly
    test('TC-CRT-002: Verify cart page displays added product correctly', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Nokia lumia 1520');
        await cartPage.navigateToCart();

        const row = page.locator('#tbodyid tr:has-text("Nokia lumia 1520")');
        await expect(row).toBeVisible();
        await expect(row.locator('td').nth(1)).toContainText('Nokia lumia 1520');
        await expect(row.locator('td').nth(2)).toContainText('820');
    });

    // TC-CRT-003: Total price updates correctly for one product
    test('TC-CRT-003: Total price updates correctly for one product', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Laptops', 'Sony vaio i5');
        await cartPage.navigateToCart();
        const total = await cartPage.getTotalPriceValue();
        expect(total).toBe(790);
    });

    // TC-CRT-004: Total price updates correctly for multiple products
    test('TC-CRT-004: Total price updates correctly for multiple products', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Nexus 6'); // $650
        await cartPage.addProductToCart('Monitors', 'ASUS Full HD'); // $230
        await cartPage.navigateToCart();

        // No extra sleep needed: navigateToCart() already chốt vào response
        // /viewcart và đợi đủ số row qua toHaveCount. window.total được cộng
        // trong đúng callback append row, nên khi đủ row thì total đã là giá
        // trị cuối cùng (xem waitForCartLoad() trong CartPage.ts).
        const total = await cartPage.getTotalPriceValue();
        expect(total).toBe(880); // 650 + 230
    });

    // TC-CRT-005: Delete a product from the cart
    test('TC-CRT-005: Delete a product from the cart', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Iphone 6 32gb');
        await cartPage.navigateToCart();

        const initialCount = await cartPage.getCartRowsCount();
        await cartPage.deleteProduct('Iphone 6 32gb');
        const finalCount = await cartPage.getCartRowsCount();
        expect(finalCount).toBe(initialCount - 1);
    });

    // TC-CRT-006: Open Place Order modal from cart page
    test('TC-CRT-006: Open Place Order modal from cart page', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await expect(cartPage.orderModal).toBeVisible();
    });

    // TC-CRT-007: Successful order placement with all fields filled
    test('TC-CRT-007: Successful order placement with all fields filled', async ({ page }) => {
        // Increase timeout: full flow takes ~35-55s, over the 30s default.
        test.setTimeout(60_000);

        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6'); // $360
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            country: 'USA',
            city: 'New York',
            card: '4111111111111111',
            month: '06',
            year: '2027'
        });

        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain('Amount: 360 USD');
        expect(successText).toContain('Card Number: 4111111111111111');
        expect(successText).toContain('Name: John Doe');

        // Verify cart is cleared.
        // LƯU Ý: sau khi bấm OK trên SweetAlert, purchaseOrder() chạy
        // location.href = 'index.html'. Bản cũ đếm #tbodyid tr ngay tại chỗ
        // -> đang đếm trên TRANG CHỦ (index.html cũng có #tbodyid, nhưng là
        // grid div nên luôn ra 0). Đó là một false pass. Phải quay lại
        // cart.html rồi mới đếm.
        await cartPage.goto(); // goto() via page.goto('/cart.html') - reliable after mid-navigation state
        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(0);
    });

    // TC-CRT-008: Close Place Order modal using 'Close' button
    test('TC-CRT-008: Close Place Order modal using Close button', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await cartPage.closeModal();
        await expect(cartPage.orderModal).toBeHidden();

        // Cart items should remain
        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(1);
    });

    // TC-CRT-009: Close Place Order modal using 'X' icon
    test('TC-CRT-009: Close Place Order modal using X icon', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await cartPage.closeModalWithX();
        await expect(cartPage.orderModal).toBeHidden();

        // Cart items should remain
        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(1);
    });

    // TC-CRT-010: Navigate back to homepage from cart page
    test('TC-CRT-010: Navigate back to homepage from cart page', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.navigateToCart();
        await cartPage.clickHome();
        await expect(page).toHaveURL(/.*index\.html|.*\//);
    });

    // TC-CRT-011: Add the same product to cart multiple times
    test('TC-CRT-011: Add the same product to cart multiple times', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Nokia lumia 1520');
        await cartPage.addProductToCart('Phones', 'Nokia lumia 1520');
        await cartPage.navigateToCart();

        const count = await cartPage.getCartRowsCount();
        // Demoblaze duplicates items as individual rows in the table
        expect(count).toBe(2);
    });

    // TC-CRT-012: Add product to cart without being logged in (Guest checkout support)
    test('TC-CRT-012: Add product to cart without being logged in', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(1);
    });

    // TC-CRT-013: View cart when no items have been added (empty cart)
    test('TC-CRT-013: View cart when no items have been added (empty cart)', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.goto();
        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(0);
        const total = await cartPage.getTotalPriceValue();
        expect(total).toBe(0);
    });

    // TC-CRT-014: Place Order with only Name filled, Credit Card left empty
    test('TC-CRT-014: Place Order with only Name filled and Credit Card empty (expected validation alert)', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await cartPage.fillOrderDetails({ name: 'John Doe' });

        const message = await cartPage.clickPurchaseExpectingAlert();
        expect(message).toContain('Please fill out Name and Creditcard.');
    });

    // TC-CRT-015: Place Order with special characters in Name field
    test('TC-CRT-015: Place Order with special characters in Name field', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await cartPage.fillOrderDetails({
            name: "José María O'Brien",
            card: '4111111111111111'
        });
        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain("Name: José María O'Brien");
    });

    // TC-CRT-016: Add maximum number of different products to cart
    test('TC-CRT-016: Add maximum number of different products to cart', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.addProductToCart('Phones', 'Nokia lumia 1520');
        await cartPage.addProductToCart('Laptops', 'Sony vaio i5');
        await cartPage.addProductToCart('Laptops', 'MacBook air');
        await cartPage.addProductToCart('Monitors', 'Apple monitor 24');
        await cartPage.navigateToCart();

        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(5);
    });

    // TC-CRT-017: Place Order with extremely long values in text fields
    test('TC-CRT-017: Place Order with extremely long values in text fields', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        const longName = 'a'.repeat(500);
        const longCountry = 'b'.repeat(500);
        await cartPage.fillOrderDetails({
            name: longName,
            country: longCountry,
            card: '4111111111111111'
        });
        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain(`Name: ${longName}`);
    });

    // TC-CRT-018: Cart persists items after browser refresh
    test('TC-CRT-018: Cart persists items after browser refresh', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();

        const countBefore = await cartPage.getCartRowsCount();
        expect(countBefore).toBe(1);
        await cartPage.reloadCart();

        const countAfter = await cartPage.getCartRowsCount();
        expect(countAfter).toBe(countBefore);
    });

    // TC-CRT-019: Place Order with all fields empty
    // Demoblaze Behavior: Triggers alert "Please fill out Name and Creditcard."
    test('TC-CRT-019: Place Order with all fields empty (expected alert)', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        const message = await cartPage.clickPurchaseExpectingAlert();
        expect(message).toContain('Please fill out Name and Creditcard.');
    });


    // TC-CRT-021: Place Order with credit card number containing spaces
    test('TC-CRT-021: Place Order with credit card number containing spaces', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111 1111 1111 1111'
        });
        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain('Card Number: 4111 1111 1111 1111');
    });

    // TC-CRT-022: Place Order with past year in Year field
    test('TC-CRT-022: Place Order with past year in Year field', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();
        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            year: '2020'
        });
        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain('Card Number: 4111111111111111');
    });

    // TC-CRT-023: Delete all products from cart one by one and attempt to place order
    // Demoblaze allows checking out an empty cart for 0 USD. Documenting this behavior.
    test('TC-CRT-023: Delete all products from cart one by one and attempt to place order', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.deleteProduct('Samsung galaxy s6');

        await cartPage.openPlaceOrderModal();
        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111'
        });
        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain('Amount: 0 USD');
    });

    // TC-CRT-024: XSS attempt in Place Order Name field
    test('TC-CRT-024: XSS attempt in Place Order Name field', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        const xssPayload = "<script>alert('xss')</script>";
        await cartPage.fillOrderDetails({
            name: xssPayload,
            card: '4111111111111111'
        });
        await cartPage.clickPurchase();
        const successText = await cartPage.confirmSuccessPurchase();
        expect(successText).toContain(`Name: ${xssPayload}`);
    });

    // TC-CRT-025: Direct URL access to cart page without any session
    test('TC-CRT-025: Direct URL access to cart page without any session', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.goto();
        const count = await cartPage.getCartRowsCount();
        expect(count).toBe(0);
    });


    // TC-CRT-039: Name - exceeds 255 characters
    test('TC-CRT-039: Name - exceeds 255 characters', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const longName = 'a'.repeat(256);
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: longName,
            card: '4111111111111111',
        });

        expect(successText).toContain(`Name: ${longName}`);
    });

    // TC-CRT-040: Name - Unicode and emoji characters
    test('TC-CRT-040: Name - Unicode and emoji characters', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const unicodeName = 'John 🙂 Döe';
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: unicodeName,
            card: '4111111111111111',
        });
        expect(successText).toContain(`Name: ${unicodeName}`);
    });

    // TC-CRT-041: Name - leading and trailing spaces
    test('TC-CRT-041: Name - leading and trailing spaces', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const spacedName = ' John Doe ';
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: spacedName,
            card: '4111111111111111',
        });

        expect(successText).toContain(`Name: ${spacedName}`);
    });

    // TC-CRT-042: Country - SQL injection attempt
    test.skip('TC-CRT-042: Country - SQL injection attempt', async () => {

    });

    // TC-CRT-043: City - SQL injection attempt
    test.skip('TC-CRT-043: City - SQL injection attempt', async () => {

    });

    // TC-CRT-044: All checkout fields - maximum boundary length
    test('TC-CRT-044: All checkout fields - maximum boundary length', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const longName = 'a'.repeat(255);
        const longCard = '1234567890123456789'; // 19 digits
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: longName,
            country: 'b'.repeat(50),
            city: 'c'.repeat(50),
            card: longCard,
            month: '06',
            year: '2027',
        });

        expect(successText).toContain(`Name: ${longName}`);
        expect(successText).toContain(`Card Number: ${longCard}`);
    });

    // TC-CRT-045: Successful order placement (demo card) - baseline happy path
    test('TC-CRT-045: Successful order placement (demo card)', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: 'John Doe',
            country: 'USA',
            city: 'New York',
            card: '4111111111111111',
            month: '06',
            year: '2027',
        });
        expect(successText).toContain('Amount: 360 USD');
        expect(successText).toContain('Card Number: 4111111111111111');
        expect(successText).toContain('Name: John Doe');
    });

    // TC-CRT-046 (NEW - not yet in the tracker; please add it): Add to
    test('TC-CRT-046: Add to cart via direct product URL (no prior homepage visit) [BUG]', async ({ page, context }) => {
        test.fail(true, 'Defect: guest cart identity không được tạo ngoài index.html');

        await context.clearCookies();
        const cartPage = new CartPage(page);
        await cartPage.addProductToCartViaDirectUrl(1); // Samsung galaxy s6

        const viewCart = page.waitForResponse(
            r => r.url().includes('/viewcart') && r.request().method() === 'POST',
        );
        await page.goto('/cart.html');
        const items = (await (await viewCart).json())?.Items ?? [];

        // EXPECTED (đúng): giỏ phải có đúng 1 sản phẩm vừa thêm.
        expect(items.length).toBe(1);
    });


    // ========================================================================
    // NEW TEST CASES: Financial Validation Rules (DEF-001 to DEF-005)
    // ========================================================================

    // TC-CRT-020: Credit card – non-numeric characters [DEF-001]
    test('TC-CRT-020: Credit card - non-numeric characters [DEF-001]', async ({ page }) => {
        test.fail(true, 'DEF-001: Card format validation missing');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: 'ABCD-EFGH'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Invalid card');
    });

    // TC-CRT-026: Credit card – 15 digits (Amex, Luhn valid)
    test('TC-CRT-026: Credit card - 15 digits (Amex)', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: 'John Doe',
            card: '378282246310005',
            month: '06',
            year: '2027',
        });
        expect(successText).toContain('Card Number: 378282246310005');
        expect(successText).toContain('Amount: 360 USD');  // Fixed: was 0 USD
    });

    // TC-CRT-027: Credit card – 17 digits (exceeds max) [DEF-001]
    test('TC-CRT-027: Credit card - 17 digits (exceeds max) [DEF-001]', async ({ page }) => {
        test.fail(true, 'DEF-001: Card length validation missing');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '41111111111111111'  // 17 digits
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Invalid card');
    });

    // TC-CRT-028: Credit card – all zeros (Luhn fail) [DEF-001]
    test('TC-CRT-028: Credit card - all zeros [DEF-001]', async ({ page }) => {
        test.fail(true, 'DEF-001: Luhn checksum validation missing');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '0000000000000000'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Invalid card');
    });

    // TC-CRT-029: Credit card – contains spaces [DEF-001]
    test('TC-CRT-029: Credit card - contains spaces [DEF-001]', async ({ page }) => {
        test.fail(true, 'DEF-001: No auto-strip or validation for spaces');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111 1111 1111 1111'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Invalid card');
    });

    // TC-CRT-030: Credit card – Luhn checksum invalid [DEF-001]
    test('TC-CRT-030: Credit card - Luhn checksum invalid [DEF-001]', async ({ page }) => {
        test.fail(true, 'DEF-001: Luhn checksum not validated');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111112'  // Luhn invalid
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Invalid card');
    });

    // TC-CRT-031: Month – 0 (invalid) [DEF-002]
    test('TC-CRT-031: Month - 0 (invalid) [DEF-002]', async ({ page }) => {
        test.fail(true, 'DEF-002: Month range validation missing');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            month: '0',
            year: '2027'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Month must be 1-12');
    });

    // TC-CRT-032: Month – 13 (exceeds range) [DEF-002]
    test('TC-CRT-032: Month - 13 (exceeds range) [DEF-002]', async ({ page }) => {
        test.fail(true, 'DEF-002: Month range not validated');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            month: '13',
            year: '2027'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Month must be 1-12');
    });

    // TC-CRT-033: Month – non-numeric [DEF-002]
    test('TC-CRT-033: Month - non-numeric characters [DEF-002]', async ({ page }) => {
        test.fail(true, 'DEF-002: Month data type not validated');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            month: 'abc',
            year: '2027'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Month must be numeric');
    });

    // TC-CRT-034: Month – leading zero (01 vs 1) — NO CHANGE
    test('TC-CRT-034: Month - leading zero (01 vs 1)', async ({ page }) => {
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        const successText = await cartPage.placeOrderAndGetInvoice({
            name: 'John Doe',
            card: '4111111111111111',
            month: '01',
            year: '2027',
        });
        expect(successText).toContain('Amount: 360 USD');
    });

    // TC-CRT-035: Year – 2-digit input [DEF-003]
    test('TC-CRT-035: Year - 2-digit input (25) [DEF-003]', async ({ page }) => {
        test.fail(true, 'DEF-003: No 2-digit auto-convert or validation');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            year: '25'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Year must be');
    });

    // TC-CRT-036: Year – past year (2024, expired) [DEF-003]
    test('TC-CRT-036: Year - past year (2024) [DEF-003]', async ({ page }) => {
        test.fail(true, 'DEF-003: Expiry year not validated');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            year: '2024'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('expired');
    });

    // TC-CRT-037: Year – far future (2100+) [DEF-003]
    test('TC-CRT-037: Year - far future (2100) [DEF-003]', async ({ page }) => {
        test.fail(true, 'DEF-003: Year boundary not validated');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            year: '2100'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Year');
    });

    // TC-CRT-038: Year – non-numeric [DEF-003]
    test('TC-CRT-038: Year - non-numeric characters [DEF-003]', async ({ page }) => {
        test.fail(true, 'DEF-003: Year data type not validated');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();
        await cartPage.openPlaceOrderModal();

        await cartPage.fillOrderDetails({
            name: 'John Doe',
            card: '4111111111111111',
            year: 'abcd'
        });

        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('Year must be numeric');
    });

    // TC-CRT-023 (redefine): Empty cart checkout [DEF-004]
    test('TC-CRT-023b: Empty cart - Place Order button should be disabled [DEF-004]', async ({ page }) => {
        test.fail(true, 'DEF-004: Empty cart validation missing');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();

        // Delete product
        await cartPage.deleteProduct('Samsung galaxy s6');

        // Try to click Place Order — should be disabled, or the submitted
        // order should be rejected with an "empty cart" message.
        const isDisabled = await cartPage.placeOrderButton.isDisabled();

        if (isDisabled) {
            expect(isDisabled).toBe(true);
            return;
        }

        // Button is enabled: open the modal and fill valid Name/Card first so
        // we reach the empty-cart check instead of the unrelated "Please
        // fill out Name and Creditcard" alert.
        await cartPage.openPlaceOrderModal();
        await cartPage.fillOrderDetails({ name: 'John Doe', card: '4111111111111111' });
        const message = await cartPage.clickPurchaseExpectingAlertOrAccept();
        expect(message).toContain('empty');
    });

    // TC-CRT-047: Modal stacking bug - Purchase button clickable during success popup [DEF-005]
    test('TC-CRT-047: Place Order modal button interactive during success popup [DEF-005]', async ({ page }) => {
        test.fail(true, 'DEF-005: Modal stacking issue - buttons stay clickable');
        const cartPage = new CartPage(page);
        await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
        await cartPage.navigateToCart();

        const successText = await cartPage.placeOrderAndGetInvoice({
            name: 'John Doe',
            card: '4111111111111111',
            month: '06',
            year: '2027',
        });
        expect(successText).toContain('Amount: 360 USD');

        // While success popup is visible, try to interact with modal behind it
        const purchaseBtn = page.locator('button[onclick="purchaseOrder()"]');
        const isClickable = !await purchaseBtn.isDisabled();

        // Bug: button should NOT be clickable/visible while popup is displayed
        expect(isClickable).toBe(false);  // Should be false (disabled/hidden)
    });
});

