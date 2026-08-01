# 🔧 API Bug Fix Plan - Execution Guide

**Target:** Fix 12 critical bugs → 80-90% test pass rate  
**Estimated Effort:** 1-2 sprints (depend on API structure)  
**Risk Level:** Low (comprehensive test coverage exists)

---

## 📋 PRIORITIZATION MATRIX

### 🔴 CRITICAL - FIX FIRST (Sprint 1)

These block deployment and have security/functionality impact.

---

## BUG #1: LOGIN ENDPOINT - NO VALIDATION
**Severity:** 🔴 CRITICAL  
**Impact:** Invalid credentials accepted as valid  
**Cases Failing:** API-LOG-002, 004, 005, 006 (4 tests)

### Current Behavior:
```
POST /login {username: "", password: ""}
→ Returns 200 OK (WRONG!)
```

### Expected Behavior:
```
POST /login {username: "", password: ""}
→ Returns 400 Bad Request
→ Response: {error: "VALIDATION_ERROR", details: [{field: "username", issue: "Field is required"}]}
```

### Fix Implementation:
```typescript
// In /login endpoint
POST /login (req, res) {
  // 1. Validate input
  if (!req.body.username || typeof req.body.username !== 'string') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: [{field: 'username', issue: 'Field is required'}]
    });
  }
  
  if (!req.body.password || typeof req.body.password !== 'string') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: [{field: 'password', issue: 'Field is required'}]
    });
  }
  
  // 2. Check credentials
  const user = findUser(req.body.username);
  if (!user || user.password !== req.body.password) {
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.'
    });
  }
  
  // 3. Return auth token
  return res.status(200).json({Auth: generateToken(user)});
}
```

### Tests That Will Pass After Fix:
- ✅ API-LOG-002 (wrong password → 401)
- ✅ API-LOG-004 (empty username → 400)
- ✅ API-LOG-005 (empty password → 400)
- ✅ API-LOG-006 (SQL injection → 400)

---

## BUG #2: CARD VALIDATION - COMPLETELY MISSING
**Severity:** 🔴 CRITICAL  
**Impact:** Fraudulent orders, security breach  
**Cases Failing:** API-ORD-003, 004, 005 (3 tests)

### Current Behavior:
```
POST /purchaseorder {cardnumber: "ABCD1234", ...}
→ Returns 200 OK (WRONG!)
```

### Expected Behavior:
```
POST /purchaseorder {cardnumber: "ABCD1234", ...}
→ Returns 400 Bad Request
→ Response: {error: "BAD_REQUEST", message: "Invalid card format"}
```

### Fix Implementation:
```typescript
function validateCard(cardnumber) {
  // 1. Check numeric
  if (!/^\d{13,19}$/.test(cardnumber)) {
    throw {status: 400, error: 'BAD_REQUEST', message: 'Card must be 13-19 numeric digits'};
  }
  
  // 2. Luhn checksum
  if (!luhnCheck(cardnumber)) {
    throw {status: 400, error: 'BAD_REQUEST', message: 'Invalid card (Luhn checksum failed)'};
  }
  
  return true;
}

function luhnCheck(num) {
  let sum = 0;
  let isEven = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}
```

### Tests That Will Pass After Fix:
- ✅ API-ORD-003 (non-numeric card → 400)
- ✅ API-ORD-004 (Luhn fail → 400)
- ✅ API-ORD-005 (card length > 19 → 400)

---

## BUG #3: DATE VALIDATION - COMPLETELY MISSING
**Severity:** 🔴 CRITICAL  
**Impact:** Expired/invalid orders accepted  
**Cases Failing:** API-ORD-006, 007, 008, 009, 010, 011 (6 tests)

### Current Behavior:
```
POST /purchaseorder {month: "13", year: "2024", ...}
→ Returns 200 OK (WRONG!)
```

### Expected Behavior:
```
POST /purchaseorder {month: "13", year: "2024", ...}
→ Returns 400 Bad Request
→ Response: {error: "BAD_REQUEST", message: "Invalid expiry date"}
```

### Fix Implementation:
```typescript
function validateExpiryDate(month, year) {
  // 1. Validate month
  const monthNum = parseInt(month, 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw {status: 400, error: 'BAD_REQUEST', message: 'Month must be 1-12'};
  }
  
  // 2. Validate year format (4 digits)
  if (!/^\d{4}$/.test(year)) {
    throw {status: 400, error: 'BAD_REQUEST', message: 'Year must be 4 digits (YYYY)'};
  }
  
  const yearNum = parseInt(year, 10);
  const currentYear = new Date().getFullYear();
  
  // 3. Check not in past
  if (yearNum < currentYear) {
    throw {status: 400, error: 'BAD_REQUEST', message: 'Card expired'};
  }
  
  // 4. Check not too far in future
  if (yearNum > currentYear + 20) {
    throw {status: 400, error: 'BAD_REQUEST', message: 'Year too far in future'};
  }
  
  return true;
}
```

### Tests That Will Pass After Fix:
- ✅ API-ORD-006 (month=0 → 400)
- ✅ API-ORD-007 (month=13 → 400)
- ✅ API-ORD-008 (month=abc → 400)
- ✅ API-ORD-009 (year=2024 → 400)
- ✅ API-ORD-010 (year=25 → 400)
- ✅ API-ORD-011 (year=2100 → 400)

---

## BUG #4: REQUIRED FIELDS VALIDATION - COMPLETELY MISSING
**Severity:** 🔴 CRITICAL  
**Impact:** Orders created with missing data  
**Cases Failing:** API-ORD-012, 013 (2 tests)

### Current Behavior:
```
POST /purchaseorder {country: "USA", ...missing: city, cardnumber, etc}
→ Returns 200 OK (WRONG!)
```

### Expected Behavior:
```
POST /purchaseorder {country: "USA", ...missing: city, cardnumber, etc}
→ Returns 400 Bad Request
→ Response: {error: "BAD_REQUEST", message: "Missing required field: city"}
```

### Fix Implementation:
```typescript
function validateOrderFields(data) {
  const required = ['cookie', 'country', 'city', 'month', 'year', 'cardname', 'cardnumber', 'cvv'];
  
  for (const field of required) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      throw {
        status: 400,
        error: 'BAD_REQUEST',
        message: `Missing required field: ${field}`
      };
    }
  }
  
  return true;
}
```

### Tests That Will Pass After Fix:
- ✅ API-ORD-012 (missing country → 400)
- ✅ API-ORD-013 (missing cardnumber → 400)

---

## BUG #5: CART OPERATIONS - NO AUTHENTICATION
**Severity:** 🔴 CRITICAL  
**Impact:** Unauthorized access to cart operations  
**Cases Failing:** API-CART-002, 003; API-ADD-004; API-DEL-003 (4 tests)

### Current Behavior:
```
POST /viewcart {cookie: ""}
→ Returns 200 OK (WRONG!)
POST /addtocart {... no cookie ...}
→ Returns 200 OK (WRONG!)
```

### Expected Behavior:
```
POST /viewcart {cookie: ""}
→ Returns 401 Unauthorized
→ Response: {error: "UNAUTHORIZED", message: "Session context is missing"}

POST /addtocart {... no cookie ...}
→ Returns 401 Unauthorized
→ Response: {error: "UNAUTHORIZED", message: "Authentication required"}
```

### Fix Implementation:
```typescript
function validateAuth(cookie) {
  if (!cookie || cookie.trim() === '') {
    throw {
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Session context is missing or invalid'
    };
  }
  return true;
}

// In /viewcart endpoint:
POST /viewcart (req, res) {
  try {
    validateAuth(req.body.cookie);
    // ... rest of logic
  } catch (err) {
    return res.status(err.status).json({error: err.error, message: err.message});
  }
}

// In /addtocart endpoint:
POST /addtocart (req, res) {
  try {
    validateAuth(req.body.cookie);
    // ... rest of logic
  } catch (err) {
    return res.status(err.status).json({error: err.error, message: err.message});
  }
}

// In /deleteitem endpoint:
POST /deleteitem (req, res) {
  try {
    validateAuth(req.body.cookie);
    // ... rest of logic
  } catch (err) {
    return res.status(err.status).json({error: err.error, message: err.message});
  }
}
```

### Tests That Will Pass After Fix:
- ✅ API-CART-002 (empty cookie → 401)
- ✅ API-CART-003 (missing cookie → 400 or 401)
- ✅ API-ADD-004 (missing cookie → 401)
- ✅ API-DEL-003 (missing cookie → 401)

---

## 🟠 HIGH PRIORITY - FIX SOON (Sprint 1-2)

---

## BUG #6: PRODUCT ENDPOINT - NO VALIDATION
**Severity:** 🟠 HIGH  
**Impact:** Invalid inputs accepted  
**Cases Failing:** API-PROD-003, 004, 005 (3 tests)

### Current Behavior:
```
POST /view {idp_: 0}
→ Returns 200 OK (WRONG!)
POST /view {} // missing idp_
→ Returns 200 OK (WRONG!)
```

### Expected Behavior:
```
POST /view {idp_: 0}
→ Returns 400 Bad Request
POST /view {} 
→ Returns 400 Bad Request
POST /view {idp_: 99999}
→ Returns 404 Not Found
```

### Fix Implementation:
```typescript
POST /view (req, res) {
  // 1. Required field check
  if (!req.body.idp_ || typeof req.body.idp_ !== 'number') {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Missing parameter: id'
    });
  }
  
  // 2. Valid range check
  if (req.body.idp_ <= 0) {
    return res.status(400).json({
      error: 'INVALID_PARAMETER',
      message: 'Parameter id must be a positive integer'
    });
  }
  
  // 3. Product exists check
  const product = findProductById(req.body.idp_);
  if (!product) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Requested resource does not exist'
    });
  }
  
  return res.status(200).json(product);
}
```

### Tests That Will Pass After Fix:
- ✅ API-PROD-003 (invalid ID → 404)
- ✅ API-PROD-004 (missing ID → 400)
- ✅ API-PROD-005 (zero ID → 400)

---

## BUG #7: CART STATE MANAGEMENT - BROKEN
**Severity:** 🟠 HIGH  
**Impact:** Items not accumulating, cart cleared unexpectedly  
**Cases Failing:** API-ADD-002; API-DEL-004 (2 tests)

### Current Behavior:
```
1. POST /addtocart {cookie: "user1", prod_id: 1}
   → Item added ✓
2. POST /addtocart {cookie: "user1", prod_id: 2}
   → OVERWRITES cart, only item 2 exists (WRONG!)
3. POST /viewcart {cookie: "user1"}
   → Returns 1 item instead of 2
```

### Expected Behavior:
```
1. POST /addtocart {cookie: "user1", prod_id: 1}
   → Item 1 added ✓
2. POST /addtocart {cookie: "user1", prod_id: 2}
   → Item 2 ADDED to cart ✓
3. POST /viewcart {cookie: "user1"}
   → Returns 2 items
```

### Root Cause:
- Cart storage likely using array assignment instead of push
- Or session not properly stored/retrieved

### Fix Implementation:
```typescript
// Cart storage structure
const carts = {}; // {cookie: [item1, item2, ...]}

POST /addtocart (req, res) {
  const {cookie, prod_id} = req.body;
  
  // Initialize cart if not exists
  if (!carts[cookie]) {
    carts[cookie] = [];
  }
  
  // PUSH item instead of OVERWRITING
  const product = findProductById(prod_id);
  carts[cookie].push({
    id: generateItemId(),
    product_id: prod_id,
    title: product.title,
    price: product.price
  });
  
  return res.status(200).json({
    Item: carts[cookie][carts[cookie].length - 1]
  });
}

POST /viewcart (req, res) {
  const {cookie} = req.body;
  const items = carts[cookie] || [];
  
  return res.status(200).json({
    status: 'success',
    data: {
      items: items,
      total: items.reduce((sum, item) => sum + item.price, 0)
    }
  });
}

POST /deleteitem (req, res) {
  const {cookie, id} = req.body;
  
  if (!carts[cookie]) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Cart item not found'
    });
  }
  
  const index = carts[cookie].findIndex(item => item.id === id);
  if (index === -1) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Cart item not found'
    });
  }
  
  carts[cookie].splice(index, 1);
  return res.status(200).json({message: 'Item deleted'});
}
```

### Tests That Will Pass After Fix:
- ✅ API-ADD-002 (items accumulate)
- ✅ API-DEL-004 (cart clears when all deleted)

---

## BUG #8: PRODUCT DATABASE - MISSING DATA
**Severity:** 🟠 HIGH  
**Impact:** Some products unavailable  
**Cases Failing:** API-PROD-002 (1 test)

### Current Behavior:
```
POST /view {idp_: 2}
→ Returns 404 Not Found (WRONG - product should exist!)
```

### Expected Behavior:
```
POST /view {idp_: 2}
→ Returns 200 OK
→ Response: {id: "2", title: "iPhone 5", price: 250, ...}
```

### Root Cause:
- Product ID #2 missing from database
- Or wrong product seeding

### Fix:
1. Check products table/array
2. Verify iPhone 5 record exists with ID=2
3. Re-seed if necessary

---

## ✅ SUMMARY - FIXES NEEDED

| Bug | Endpoint | Fix Type | Effort | Tests Pass |
|---|---|---|---|---|
| 1 | /login | Input validation | 1 day | 4 |
| 2 | /purchaseorder | Card validation | 1 day | 3 |
| 3 | /purchaseorder | Date validation | 1 day | 6 |
| 4 | /purchaseorder | Required fields | 0.5 day | 2 |
| 5 | /viewcart, /addtocart, /deleteitem | Auth check | 1 day | 4 |
| 6 | /view | Input validation | 0.5 day | 3 |
| 7 | /addtocart, /deleteitem | State mgmt | 1 day | 2 |
| 8 | Product DB | Data fix | 0.5 day | 1 |
| **TOTAL** | | | **6-7 days** | **25 tests** |

---

## 🎯 EXPECTED OUTCOMES

**Before Fixes:**
- ✅ 5 pass
- ❌ 185 fail
- Pass rate: 2.6%

**After All Fixes:**
- ✅ 30 pass (expected)
- ❌ ~8 fail (edge cases, design decisions)
- Pass rate: ~79%

---

## 🚀 EXECUTION STEPS

1. **Pick one bug** (start with #1 - Login)
2. **Implement fix** using code snippets above
3. **Run tests:** `npx playwright test tests/api.spec.ts`
4. **Verify:** Check specific failing test now passes
5. **Move to next bug**
6. **Repeat until done**

---

## 📝 Notes

- Each bug is **independent** → can fix in any order
- Test suite will **automatically validate** each fix
- If test still fails after fix → debug the fix logic
- Don't skip validation - these are security-critical

Ready to start? 🚀
