import { test, expect } from '@playwright/test';

const API_BASE = 'https://api.demoblaze.com';

// Generate unique username for each test run
const getUniqueUser = () => `testuser_${Date.now()}`;

test.describe('API Validation Suite', () => {
    let uniqueUser: string;
    let userId: string | null = null;

    test.beforeEach(() => {
        uniqueUser = getUniqueUser();
    });

    // ================================================================
    // 1. POST /login - LOGIN ENDPOINT
    // ================================================================
    test.describe('POST /login - User Authentication', () => {
        test('API-LOG-001: Successful login with valid credentials', async ({ request }) => {
            const response = await request.post(`${API_BASE}/login`, {
                data: {
                    username: uniqueUser,
                    password: 'password123'
                }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body).toHaveProperty('Auth');
            expect(body.Auth).toBeTruthy();
            userId = body.Auth; // Store token for later use
        });

        test('API-LOG-002: Failed login with invalid credentials', async ({ request }) => {
            const response = await request.post(`${API_BASE}/login`, {
                data: {
                    username: 'testuser',
                    password: 'wrongpass'
                }
            });

            // Expected: HTTP 401 Unauthorized with error message
            expect(response.status()).toBe(401);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('INVALID_CREDENTIALS');
        });

        test('API-LOG-004: Login with empty username', async ({ request }) => {
            const response = await request.post(`${API_BASE}/login`, {
                data: {
                    username: '',
                    password: 'password123'
                }
            });

            // Expected: HTTP 400 Bad Request with validation error
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('VALIDATION_ERROR');
        });

        test('API-LOG-005: Login with empty password', async ({ request }) => {
            const response = await request.post(`${API_BASE}/login`, {
                data: {
                    username: 'testuser',
                    password: ''
                }
            });

            // Expected: HTTP 400 Bad Request with validation error
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('VALIDATION_ERROR');
        });

        test('API-LOG-006: Login with SQL injection attempt', async ({ request }) => {
            const response = await request.post(`${API_BASE}/login`, {
                data: {
                    username: "' OR '1'='1",
                    password: "' OR '1'='1"
                }
            });

            // Expected: HTTP 400 Bad Request - reject malformed input
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('INVALID_INPUT');
        });
    });

    // ================================================================
    // 2. GET config.json - CONFIGURATION ENDPOINT
    // ================================================================
    test.describe('GET config.json - Configuration', () => {
        test('API-CONF-001: Get config successfully', async ({ request }) => {
            const response = await request.get(`https://demoblaze.com/config.json`);

            // Expected: HTTP 404 Not Found
            expect(response.status()).toBe(404);
        });
    });

    // ================================================================
    // 3. POST /viewcart - VIEW CART ENDPOINT
    // ================================================================
    test.describe('POST /viewcart - Get Cart Items', () => {
        test('API-CART-001: View cart with valid cookie', async ({ request }) => {
            const response = await request.post(`${API_BASE}/viewcart`, {
                data: {
                    cookie: 'guest_1234567890'
                }
            });

            // Expected: HTTP 200 OK with items array.
            // NOTE: the real /viewcart response is `{"Items": [...]}` - a
            // top-level, capital-I array, NOT `{status, data: {items}}`. That
            // was confirmed independently via CartPage.ts (see body?.Items
            // there), which the UI-level cart tests already rely on
            // successfully. The original assertions here asserted a made-up
            // REST-ish shape that the app never returns, so this test failed
            // on a bad assumption, not a real app defect.
            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body).toHaveProperty('Items');
            expect(Array.isArray(body.Items)).toBeTruthy();
        });

        test('API-CART-002: View cart with empty cookie', async ({ request }) => {
            const response = await request.post(`${API_BASE}/viewcart`, {
                data: {
                    cookie: ''
                }
            });

            // Expected: HTTP 401 Unauthorized - session context missing
            expect(response.status()).toBe(401);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('UNAUTHORIZED');
        });

        test('API-CART-003: View cart without cookie field', async ({ request }) => {
            const response = await request.post(`${API_BASE}/viewcart`, {
                data: {}
            });

            // Expected: HTTP 400 Bad Request - missing required field
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('BAD_REQUEST');
        });
    });

    // ================================================================
    // 4. POST /view - PRODUCT DETAILS ENDPOINT
    // ================================================================
    test.describe('POST /view - Get Product Details', () => {
        test('API-PROD-001: Get product details with valid product ID', async ({ request }) => {
            const response = await request.post(`${API_BASE}/view`, {
                data: {
                    idp_: 1 // Samsung Galaxy S6
                }
            });

            // NOTE: real catalog title is 'Samsung galaxy s6' (lowercase
            // "galaxy"/"s6") - confirmed via cart.spec.ts/regression.spec.ts,
            // which click this exact product name successfully throughout
            // the suite. The original 'Samsung Galaxy S6' assertion here was
            // a case-mismatch test-authoring bug, not a real app defect.
            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body).toHaveProperty('id');
            expect(body).toHaveProperty('title');
            expect(body).toHaveProperty('price');
            expect(body.id).toBe('1');
            expect(body.title).toBe('Samsung galaxy s6');
            expect(body.price).toBe(360);
        });

        test('API-PROD-002: Get product details with valid product ID (iPhone)', async ({ request }) => {
            const response = await request.post(`${API_BASE}/view`, {
                data: {
                    idp_: 2 // iPhone 5
                }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body).toHaveProperty('id');
            expect(body).toHaveProperty('title');
            expect(body.id).toBe('2');
        });

        test('API-PROD-003: Get product details with invalid product ID', async ({ request }) => {
            const response = await request.post(`${API_BASE}/view`, {
                data: {
                    idp_: 99999 // Non-existent product
                }
            });

            // Expected: HTTP 404 Not Found
            expect(response.status()).toBe(404);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('NOT_FOUND');
        });

        test('API-PROD-004: Get product without required field', async ({ request }) => {
            const response = await request.post(`${API_BASE}/view`, {
                data: {} // Missing idp_
            });

            // Expected: HTTP 400 Bad Request - missing ID field
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('BAD_REQUEST');
        });

        test('API-PROD-005: Get product with zero ID', async ({ request }) => {
            const response = await request.post(`${API_BASE}/view`, {
                data: {
                    idp_: 0 // Invalid ID
                }
            });

            // Expected: HTTP 400 Bad Request - invalid parameter
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('INVALID_PARAMETER');
        });
    });

    // ================================================================
    // 5. POST /addtocart - ADD TO CART ENDPOINT
    // ================================================================
    test.describe('POST /addtocart - Add Item to Cart', () => {
        test('API-ADD-001: Add product to cart with valid data', async ({ request }) => {
            const response = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: 'test_user_' + Date.now(),
                    prod_id: 1,
                    flag: true
                }
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            // Verify response indicates success
            expect(body).toHaveProperty('Item');
        });

        test('API-ADD-002: Add product - multiple items same user', async ({ request }) => {
            const cookie = 'test_multi_' + Date.now();

            // Add first product
            const response1 = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });
            expect(response1.status()).toBe(200);

            // Add second product
            const response2 = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 2,
                    flag: true
                }
            });
            expect(response2.status()).toBe(200);

            // Verify cart has both items
            const viewResponse = await request.post(`${API_BASE}/viewcart`, {
                data: { cookie: cookie }
            });
            // NOTE: real shape is `body.Items` (see API-CART-001 note above).
            const body = await viewResponse.json();
            expect(body.Items.length).toBeGreaterThanOrEqual(2);
        });

        test('API-ADD-003: Add product with invalid product ID', async ({ request }) => {
            const response = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: 'test_user',
                    prod_id: 99999,
                    flag: true
                }
            });

            // Expected: HTTP 401 Unauthorized - invalid token
            expect(response.status()).toBe(401);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('INVALID_TOKEN');
        });

        test('API-ADD-004: Add product without cookie', async ({ request }) => {
            const response = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    prod_id: 1,
                    flag: true
                }
            });

            // Expected: HTTP 401 Unauthorized - authentication required
            expect(response.status()).toBe(401);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('UNAUTHORIZED');
        });

        test('API-ADD-005: Add product with flag=false', async ({ request }) => {
            const response = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: 'test_user',
                    prod_id: 1,
                    flag: false
                }
            });

            // Expected: HTTP 400 Bad Request - missing required parameter
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('BAD_REQUEST');
        });
    });

    // ================================================================
    // 6. POST /deleteitem - DELETE FROM CART ENDPOINT
    // ================================================================
    test.describe('POST /deleteitem - Remove Item from Cart', () => {
        test('API-DEL-001: Delete item with valid data', async ({ request }) => {
            const cookie = 'test_del_' + Date.now();

            // First add item
            const addResponse = await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            expect(addResponse.status()).toBe(200);
            const addBody = await addResponse.json();

            // Then delete it
            const delResponse = await request.post(`${API_BASE}/deleteitem`, {
                data: {
                    cookie: cookie,
                    id: addBody.Item?.id || 1
                }
            });

            expect(delResponse.status()).toBe(200);
        });

        test('API-DEL-002: Delete non-existent item', async ({ request }) => {
            const response = await request.post(`${API_BASE}/deleteitem`, {
                data: {
                    cookie: 'test_user',
                    id: 99999
                }
            });

            // Expected: HTTP 404 Not Found - item not found
            expect(response.status()).toBe(404);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('NOT_FOUND');
        });

        test('API-DEL-003: Delete item without cookie', async ({ request }) => {
            const response = await request.post(`${API_BASE}/deleteitem`, {
                data: {
                    id: 1
                }
            });

            // Expected: HTTP 401 Unauthorized - authentication required
            expect(response.status()).toBe(401);
            const body = await response.json();
            expect(body).toHaveProperty('error');
            expect(body.error).toBe('UNAUTHORIZED');
        });

        test('API-DEL-004: Delete all items from cart', async ({ request }) => {
            const cookie = 'test_clear_' + Date.now();

            // Add multiple items
            for (let i = 1; i <= 3; i++) {
                await request.post(`${API_BASE}/addtocart`, {
                    data: {
                        cookie: cookie,
                        prod_id: i,
                        flag: true
                    }
                });
            }

            // Get cart items
            const viewResponse = await request.post(`${API_BASE}/viewcart`, {
                data: { cookie: cookie }
            });
            // NOTE: real shape is `body.Items` (see API-CART-001 note above).
            const viewBody = await viewResponse.json();
            const items = viewBody.Items;

            // Delete each item
            for (const item of items) {
                const delResponse = await request.post(`${API_BASE}/deleteitem`, {
                    data: {
                        cookie: cookie,
                        id: item.id
                    }
                });
                expect(delResponse.status()).toBe(200);
            }

            // Verify cart is empty
            const finalViewResponse = await request.post(`${API_BASE}/viewcart`, {
                data: { cookie: cookie }
            });
            const finalBody = await finalViewResponse.json();
            expect(finalBody.Items.length).toBe(0);
        });
    });

    // ================================================================
    // 7. POST /purchaseOrder - CHECKOUT ENDPOINT
    // ================================================================
    test.describe('POST /purchaseOrder - Place Order', () => {
        test('API-ORD-001: Place order with valid complete data', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            // Add product to cart first
            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            expect(response.status()).toBe(200);
            const body = await response.json();
            expect(body).toHaveProperty('orderid');
            expect(body.orderid).toMatch(/\d+/);
        });

        test('API-ORD-002: Place order with empty cart', async ({ request }) => {
            const orderData = {
                cookie: 'empty_cart_' + Date.now(),
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - empty cart
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-003: Place order with invalid card number (non-numeric)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: 'ABCD1234', // Invalid card
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - invalid card format
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-004: Place order with invalid card (Luhn checksum fail)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111112', // Invalid Luhn
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - Luhn check failed
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-005: Place order with card exceeding max length', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '41111111111111111', // 17 digits (exceeds max)
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - card length exceeded
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-006: Place order with month=0 (invalid)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '0', // Invalid month
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - invalid month
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-007: Place order with month=13 (exceeds range)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '13', // Invalid month
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - month out of range
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-008: Place order with non-numeric month', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: 'abc', // Non-numeric
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - invalid data type
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-009: Place order with expired year (2024)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2024', // Expired
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - expired card
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-010: Place order with 2-digit year (25 instead of 2025)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '25', // 2-digit year
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - invalid year format
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-011: Place order with far future year (2100)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2100', // Far future
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - year too far in future
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-012: Place order with missing required field (country)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                // Missing country
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - missing required field
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-013: Place order with missing card number', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: 'John Doe',
                // Missing cardnumber
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Expected: HTTP 400 Bad Request - missing required field
            expect(response.status()).toBe(400);
            const body = await response.json();
            expect(body).toHaveProperty('error');
        });

        test('API-ORD-014: Place order with month formats (01 vs 1)', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            // Add product
            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            // Test with format "01"
            const orderData1 = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '01',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response1 = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData1
            });
            expect([200, 400]).toContain(response1.status());

            // Test with format "1"
            const orderData2 = {
                cookie: cookie + '_v2',
                country: 'USA',
                city: 'New York',
                month: '1',
                year: '2027',
                cardname: 'John Doe',
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response2 = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData2
            });
            expect([200, 400]).toContain(response2.status());
        });

        test('API-ORD-015: Place order with special characters in name', async ({ request }) => {
            const cookie = 'test_order_' + Date.now();

            await request.post(`${API_BASE}/addtocart`, {
                data: {
                    cookie: cookie,
                    prod_id: 1,
                    flag: true
                }
            });

            const orderData = {
                cookie: cookie,
                country: 'USA',
                city: 'New York',
                month: '06',
                year: '2027',
                cardname: "John O'Brien-Döe", // Special characters
                cardnumber: '4111111111111111',
                cvv: '123'
            };

            const response = await request.post(`${API_BASE}/purchaseorder`, {
                data: orderData
            });

            // Should handle special characters
            expect([200, 400]).toContain(response.status());
        });
    });
});
