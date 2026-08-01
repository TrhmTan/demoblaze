# 🔄 REGRESSION TEST SUITE

**Purpose:** Independent smoke pass over Login & Cart features. Deliberately does
**not** share code with `pages/` (LoginPage/CartPage) — it re-implements the same
flows with raw locators so a defect that only shows up in one code path (POM
helpers vs. inline calls) doesn't get masked by the other suite.
**File:** `tests/regression.spec.ts`
**Status:** Passing (see [Known limitations](../README.md#known-limitations--next-steps) in the main README for open items)

---

## 📊 TEST COVERAGE

### Feature 1: LOGIN (4 tests)
- REG-LOGIN-001: Valid login succeeds
- REG-LOGIN-002: Invalid credentials rejected (waits for the native alert and asserts it contains "Wrong password", not just a timing-based check)
- REG-LOGIN-003: Session persists after refresh
- REG-LOGIN-004: Logout works

### Feature 2: CART (5 tests)
- REG-CART-001: Add product to cart
- REG-CART-002: Cart displays correct total
- REG-CART-003: Remove product from cart
- REG-CART-004: Empty cart shows zero total
- REG-CART-005: Multiple products in cart

### Feature 3: INTEGRATION (4 tests)
- REG-INT-001: Login user can add products to cart
- REG-INT-002: Logout clears user context
- REG-INT-003: Complete order flow - Login → Add to Cart → Place Order → Confirm (fills the full checkout form and asserts the SweetAlert invoice contains Id/Name/Amount/Card Number)
- REG-INT-004: Place Order - invoice `Amount:` matches the cart total captured just before checkout

### TOTAL: 13 regression tests + 2 performance markers (see below) = 15 tests in this file

---

## 🚀 HOW TO RUN

### Run all regression tests:
```bash
npx playwright test tests/regression.spec.ts
```

### Run specific feature:
```bash
# Login tests only
npx playwright test tests/regression.spec.ts -g "LOGIN"

# Cart tests only
npx playwright test tests/regression.spec.ts -g "CART"

# Integration tests only
npx playwright test tests/regression.spec.ts -g "INTEGRATION"
```

### Run in headed mode (see browser):
```bash
npx playwright test tests/regression.spec.ts --headed
```

### Generate HTML report:
```bash
npx playwright test tests/regression.spec.ts
npx playwright show-report
```

---

## ✅ EXPECTED RESULTS

### Success Criteria:
- All 13 regression tests PASS
- Login flow works smoothly, including the rejection-message assertion in REG-LOGIN-002
- Cart operations function correctly
- Full checkout (REG-INT-003/004) completes and the invoice total matches the cart

### If Tests Fail:
- Check browser compatibility (Chromium/Firefox/WebKit)
- Verify demoblaze.com is reachable
- Check browser console for errors
- Verify DOM selectors match current UI

---

## 🔍 WHAT EACH TEST DOES

### REG-LOGIN-001: Valid Login
1. Login with `TEST_USER` credentials via the shared `login()` helper
2. Verify "Welcome `TMA`" banner appears

### REG-LOGIN-002: Invalid Credentials
1. Open the login modal, fill in the valid username with a wrong password
2. Wait for the native alert (fires async from the `/login` callback, not on click) and assert its text contains "Wrong password"
3. Verify the modal is still visible and no welcome banner appeared

### REG-LOGIN-003: Session Persistence
1. Login with valid credentials
2. Refresh the page
3. Verify still logged in (session persists)

### REG-LOGIN-004: Logout
1. Login first
2. Click logout
3. Verify the "Log in" link reappears and the welcome banner is hidden

### REG-CART-001: Add to Cart
1. Navigate directly to a product page (`gotoProduct`)
2. Add to cart, accepting the native "Product added" alert
3. Go to cart and wait for it to load deterministically (via `/viewcart` response, not a fixed sleep)
4. Verify the product row is present

### REG-CART-002: Cart Total
1. Add a product to cart
2. Go to cart
3. Verify the displayed total matches the product's price

### REG-CART-003: Remove from Cart
1. Add a product to cart
2. Go to cart, click Delete
3. Verify the row is removed

### REG-CART-004: Empty Cart
1. Clear the cart (delete every row, waiting on each `/viewcart` reload)
2. Verify the total reads 0

### REG-CART-005: Multiple Products
1. Add `TEST_PRODUCTS[0]` (Samsung galaxy s6)
2. Add `TEST_PRODUCTS[1]` (Nokia lumia 1520)
3. Go to cart
4. Verify both rows are present

### REG-INT-001: Login + Shopping
1. Login
2. Add a product to cart
3. Verify still logged in while shopping

### REG-INT-002: Logout Flow
1. Login, then logout
2. Verify logged out
3. Login again and verify a fresh session

### REG-INT-003: Full Checkout Flow
1. Clear cart, login, add a product
2. Open "Place Order", fill Name/Country/City/Card/Month/Year
3. Click Purchase
4. Verify the SweetAlert success popup contains `Id:`, `Name:`, `Amount:`, `Card Number:`

### REG-INT-004: Invoice Matches Cart Total
1. Clear cart, login, add a product
2. Capture the cart total shown on `#totalp`
3. Complete checkout
4. Verify the invoice's `Amount:` line matches the captured total exactly

---

## 📈 PERFORMANCE MONITORING

Two non-blocking performance markers included in the same file:

- **PERF-LOGIN:** Measures login response time
- **PERF-CART:** Measures add-to-cart response time

These output timing data to console without failing the run on slow responses. See `docs/PERFORMANCE_TESTING.md` and `tests/performance.spec.ts` for the dedicated, threshold-asserting performance suite.

---

## 🎯 TEST STRATEGY

### What We're Testing:
- **Happy paths** - normal login/cart/checkout workflows
- **Critical functionality** - core features must work
- **Integration** - login, cart, and checkout work together end-to-end
- **Persistence** - session survives refresh

### What We're NOT Testing:
- Security vulnerabilities (no penetration testing)
- Financial/input-validation edge cases (covered in `cart.spec.ts`'s DEF-00x cases and `api.spec.ts`)
- Load/stress limits (see `performance.spec.ts` and the note in the main README that real load testing needs a tool like k6/JMeter/Gatling)

---

## 📝 TEST DATA

### Test User (`TEST_USER` in `regression.spec.ts`):
```
Username: TMA
Password: tma@12345
```

### Test Products (`TEST_PRODUCTS`, navigated to directly via `/prod.html?idp_=<id>` rather than clicking through the homepage, which is unreliable on WebKit):
```
id 1: Samsung galaxy s6 - $360
id 2: Nokia lumia 1520 - $820
```

---

## 🔧 TROUBLESHOOTING

### Issue: Timeout waiting for login
**Solution:** Check if demoblaze.com is reachable. Verify selectors match the current UI.

### Issue: Cart doesn't show items
**Solution:** Check that `/viewcart` returns the expected `Items` array; verify the product was added successfully before navigating to cart.

### Issue: Tests pass locally but fail in CI
**Solution:** May need viewport adjustment or extra tolerance around network-dependent waits (`waitForResponse` timeouts).

---

**Last updated:** 2026-08-01, synced against the current `tests/regression.spec.ts` (13 regression tests + 2 performance markers).
