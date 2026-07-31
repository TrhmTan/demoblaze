# Checklist: Cập nhật bộ Test Case Manual

## A. Thêm TC mới

### TC-CRT-046: Add to cart via direct product URL (no prior homepage visit) [BUG]
- **Status**: Xem file `TC-CRT-046-definition.md`
- **Action**: Copy thông tin từ file đó vào `Demoblaze_QA_TestCases.xlsx`
- **Priority**: HIGH (security/data leak issue)
- **Severity**: CRITICAL
- **Automation**: Done (in script)
- **Notes**: Là defect findings từ suite building, cần add ngay

---

## B. Redefine TC hiện tại (từ hành vi sai → rule tài chính)

**Total: 19 cases (TC-020 đến TC-038) + 1 edge (TC-023)**

### Tóm tắt thay đổi expect

| TC Range | Field | Defect | Current Expect | New Expect | Action |
|---|---|---|---|---|---|
| 020, 027–030 | Credit Card | DEF-001: No validation | Accept all | REJECT invalid format | Redefine |
| 031–033 | Month | DEF-002: No range check | Accept all | REJECT 0,13+,non-numeric | Redefine |
| 035–038 | Year | DEF-003: No expiry check | Accept all | REJECT past/invalid | Redefine |
| 023 | All | DEF-004: Empty cart | Accept 0 USD | REJECT (empty cart) | Redefine |
| 026 | Card 15-digit | Related to DEF-001 | Accept with 0 USD | ACCEPT with 360 USD | Redefine amount only |
| 034 | Month 01 vs 1 | N/A | Accept both | Accept both | Keep as-is |
| 040, 041 | Name unicode/space | N/A | Accept | Accept | Keep as-is |
| 039, 044 | Name length | Edge case | Accept all | Tùy design (reject if >255) | Review design |

---

### Chi tiết từng TC cần thay đổi

#### Group 1: Card format (5 cases)

```
TC-CRT-020: Credit card - non-numeric (ABCD-EFGH)
  Current: expect success
  New: expect REJECT "Invalid card format"
  
TC-CRT-027: Credit card - 17 digits
  Current: expect success (0 USD)
  New: expect REJECT "Card must be 13-19 digits"
  
TC-CRT-028: Credit card - all zeros
  Current: expect success (0 USD)
  New: expect REJECT "Invalid card (Luhn checksum failed)"
  
TC-CRT-029: Credit card - contains spaces
  Current: expect success with spaces
  New: expect REJECT "Invalid card format" OR AUTO-STRIP then validate
  
TC-CRT-030: Credit card - Luhn invalid
  Current: expect success (0 USD)
  New: expect REJECT "Invalid card (Luhn checksum failed)"
```

**Defect to create**: DEF-001 — Credit Card Validation Missing
- No Luhn check
- No length validation (13-19)
- No non-numeric check
- Severity: CRITICAL (PCI compliance)

---

#### Group 2: Month validation (3 cases)

```
TC-CRT-031: Month - 0 (invalid)
  Current: expect success
  New: expect REJECT "Month must be 1-12"
  
TC-CRT-032: Month - 13 (exceeds range)
  Current: expect success
  New: expect REJECT "Month must be 1-12"
  
TC-CRT-033: Month - non-numeric (abc)
  Current: expect success
  New: expect REJECT "Month must be numeric 1-12"
```

**Defect to create**: DEF-002 — Month Validation Missing
- No range check (1-12)
- No data type check
- Severity: HIGH

---

#### Group 3: Year validation (4 cases)

```
TC-CRT-035: Year - 2-digit (25)
  Current: expect success
  New: expect REJECT "Year must be 4 digits (YYYY)"
         OR AUTO-CONVERT "25" → "2025" (tùy design)
  
TC-CRT-036: Year - past year (2024)
  Current: expect success
  New: expect REJECT "Card expired (must be >= 2027)"
  
TC-CRT-037: Year - far future (2100)
  Current: expect success
  New: expect REJECT "Year too far in future" (optional, tùy app tolerance)
         OR ACCEPT as-is (nếu app không có boundary trên)
  
TC-CRT-038: Year - non-numeric (abcd)
  Current: expect success
  New: expect REJECT "Year must be numeric"
```

**Defect to create**: DEF-003 — Year/Expiry Validation Missing
- No range check (>= current + 1)
- No 2-digit auto-convert logic
- No data type check
- Severity: HIGH

---

#### Group 4: Cart/Order validation (1 case)

```
TC-CRT-023: Delete all products and checkout
  Current: expect success (0 USD order)
  New: expect REJECT with alert "Cart is empty" 
       OR BLOCK "Place Order" button when cart empty
  
TC-CRT-022: (duplicate) Year - past year (2020)
  → Same as TC-CRT-036, consolidate or keep for regression coverage
```

**Defect to create**: DEF-004 — Empty Cart Checkout Allowed
- Can create 0 USD order
- Severity: MEDIUM (abuse/fraud risk)

---

#### Group 5: No change needed (4 cases)

```
TC-CRT-026: Card 15-digit Amex (Luhn valid)
  Current: expect success
  New: expect success ✓ BUT AMOUNT MUST BE 360 (not 0)
  Action: Update amount expectation only (fix root cause DEF-001)
  
TC-CRT-034: Month leading zero (01 vs 1)
  Current: expect both accepted
  New: expect both accepted ✓
  Action: KEEP AS-IS
  
TC-CRT-040: Name - Unicode/emoji
  Current: expect success
  New: expect success ✓
  Action: KEEP AS-IS
  
TC-CRT-041: Name - leading/trailing spaces
  Current: expect success
  New: expect success ✓
  Action: KEEP AS-IS
```

---

#### Group 6: Edge cases (2 cases) — tùy app design

```
TC-CRT-039: Name - exceeds 255 characters
  Current: expect accept (256 char)
  Recommendation: REJECT if app is PCI-strict
  Action: Review app design + update expectation
  
TC-CRT-044: All fields - boundary lengths
  Current: expect all accept
  New: accept name 255, REJECT card 19+ (per DEF-001)
  Action: Redefine per field rules
```

---

## C. Automation Status

| TC | In script? | Status | Notes |
|---|---|---|---|
| 046 | ✓ | Done | Implemented with `test.fail()` |
| 020, 027–030 | ✗ | Pending redefine | Need to implement REJECT expectations |
| 031–033 | ✗ | Pending redefine | Need to implement REJECT expectations |
| 035–038 | ✗ | Pending redefine | Need to implement REJECT expectations |
| 023 | ✓ | Done | `clickPurchaseExpectingAlert()` ready |
| 026 | ✓ | Partial | Amount expect sẽ auto-fix khi fix DEF-001 |
| 034, 040, 041 | ✓ | Done | No change needed |
| 039, 044 | ✓ | Partial | Partially implemented, edge case handling unclear |

---

## D. Defect Backlog

| Defect | Severity | Affected TCs | Root cause | Fix complexity |
|---|---|---|---|---|
| DEF-001 | CRITICAL | 020, 026–030 | No card format validation | High (PCI DSS compliance) |
| DEF-002 | HIGH | 031–033 | No month validation | Low–Medium |
| DEF-003 | HIGH | 035–038, 022, 036 | No year/expiry validation | Low–Medium |
| DEF-004 | MEDIUM | 023 | No empty cart check | Low |

---

## E. Next Steps

### Phase 1: Manual update
1. ✅ Copy TC-CRT-046 vào spreadsheet (from `TC-CRT-046-definition.md`)
2. 🔲 Update expected behavior cho TC-020, 023, 026–038 (from file này)
3. 🔲 Create 4 defects trong issue tracker
4. 🔲 Link TC → defect

### Phase 2: Automation update (in script)
1. 🔲 Redefine TC-020, 027–030 expectations (reject instead of accept)
2. 🔲 Redefine TC-031–033 expectations
3. 🔲 Redefine TC-035–038 expectations
4. 🔲 Add `test.fail()` annotations linking to defects
5. 🔲 Chạy lại: nên thấy ~12–15 expected failures (thay vì pass)

### Phase 3: Verification
1. 🔲 Run: `npx playwright test cart.spec.ts --project=Chromium`
   - Expected: 30 pass, 12–15 expected-fail, 2 skip
2. 🔲 Review failed/pending cases
3. 🔲 Validate defect list trước submit dev

---

## Timeline

| Phase | Effort | Duration |
|---|---|---|
| Manual update | 30 min (copy + review) | 30m |
| Automation update | 1–2 hours (code + test) | 2h |
| Verification | 30 min (run + review) | 1h |
| **Total** | — | **3.5–4h** |

---

## Liên hệ

- Detailed rule: `financial-validation-rules-and-case-redefinition.md`
- TC-046 chi tiết: `TC-CRT-046-definition.md`
- Code changes: `pages/CartPage.ts`, `tests/cart.spec.ts`
