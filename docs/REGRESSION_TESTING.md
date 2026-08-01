# 🔄 REGRESSION TEST SUITE

**Purpose:** Verify Login & Cart features work correctly  
**File:** `tests/regression.spec.ts`  
**Status:** Ready to run

---

## 📊 TEST COVERAGE

### Feature 1: LOGIN (4 tests)
- ✅ REG-LOGIN-001: Valid login succeeds
- ✅ REG-LOGIN-002: Invalid credentials rejected
- ✅ REG-LOGIN-003: Session persists after refresh
- ✅ REG-LOGIN-004: Logout works

### Feature 2: CART (5 tests)
- ✅ REG-CART-001: Add product to cart
- ✅ REG-CART-002: Cart displays correct total
- ✅ REG-CART-003: Remove product from cart
- ✅ REG-CART-004: Empty cart shows zero total
- ✅ REG-CART-005: Multiple products in cart

### Feature 3: INTEGRATION (2 tests)
- ✅ REG-INT-001: Login user can add products
- ✅ REG-INT-002: Logout clears user context

### TOTAL: 11 regression tests

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
- ✅ All 11 tests should PASS
- ✅ Login flow works smoothly
- ✅ Cart operations function correctly
- ✅ Integration between features works

### If Tests Fail:
- Check browser compatibility (Chrome/Firefox/Safari)
- Verify test environment is running
- Check browser console for errors
- Verify DOM selectors match current UI

---

## 🔍 WHAT EACH TEST DOES

### REG-LOGIN-001: Valid Login
1. Navigate to home
2. Click "Log in"
3. Enter username & password
4. Submit login form
5. Verify "Welcome [username]" appears

### REG-LOGIN-002: Invalid Credentials
1. Navigate to home
2. Click "Log in"
3. Enter wrong credentials
4. Submit
5. Verify login modal still visible (failed)

### REG-LOGIN-003: Session Persistence
1. Login with valid credentials
2. Wait for login to complete
3. Refresh page
4. Verify still logged in (session cookie works)

### REG-LOGIN-004: Logout
1. Login first
2. Click "Log out"
3. Verify "Log in" button reappears

### REG-CART-001: Add to Cart
1. Navigate to product
2. Click "Add to cart"
3. Accept alert
4. Go to cart
5. Verify product in cart

### REG-CART-002: Cart Total
1. Add product to cart
2. Go to cart
3. Verify total matches product price

### REG-CART-003: Remove from Cart
1. Add product to cart
2. Go to cart
3. Click "Delete"
4. Verify item removed

### REG-CART-004: Empty Cart
1. Go to empty cart
2. Verify total shows 0 or "empty"

### REG-CART-005: Multiple Products
1. Add product 1
2. Go back to home
3. Add product 2
4. Go to cart
5. Verify both products visible

### REG-INT-001: Login + Shopping
1. Login
2. Add product to cart
3. Go to cart
4. Verify still logged in

### REG-INT-002: Logout Flow
1. Login
2. Logout
3. Verify logged out
4. Login again
5. Verify fresh login

---

## 📈 PERFORMANCE MONITORING

Two non-blocking performance tests included:

- **PERF-LOGIN:** Measures login response time (target: < 10s)
- **PERF-CART:** Measures add-to-cart time (target: < 5s)

These tests output timing data to console without blocking test execution.

---

## 🎯 TEST STRATEGY

### What We're Testing:
✅ **Happy Paths** - Normal user workflows  
✅ **Critical Functionality** - Core features must work  
✅ **Integration** - Features work together  
✅ **Persistence** - Data survives refresh/reload

### What We're NOT Testing:
❌ Security vulnerabilities (no penetration testing)  
❌ Edge cases (covered in api.spec.ts)  
❌ Performance limits (separate load tests)  
❌ All browsers (run against primary browser first)

---

## 📝 TEST DATA

### Test User:
```
Username: testuser
Password: Test@1234
```

### Test Products:
1. Samsung Galaxy S6 - $360
2. iPhone 5 - $250

---

## 🔧 TROUBLESHOOTING

### Issue: Timeout waiting for login
**Solution:** Check if website is up. Verify selectors match UI.

### Issue: Cart doesn't show items
**Solution:** Check if cart page loads. Verify product was added successfully.

### Issue: Tests pass locally but fail in CI
**Solution:** May need viewport adjustment, wait time tuning, or async handling.

---

## 📊 NEXT STEPS

After regression tests pass:
1. ✅ Regression Testing (THIS SUITE)
2. ⏭️ Performance Testing (Load tests)
3. ⏭️ Final Report & Recommendations

---

**Status:** Ready to execute  
**Last Updated:** 2026-07-31
