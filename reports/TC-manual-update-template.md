# Template: Cập nhật Demoblaze_QA_TestCases.xlsx — Cart Sheet

> **Hướng dẫn**: Copy thông tin từ file này vào Excel, điền vào các cột tương ứng. Format: Markdown Table → Excel columns.

---

## A. THÊM MỚI: TC-CRT-046

| Test Case ID | Test Case Name | Feature | Scenario | Steps | Expected Result | Actual Behavior (Current) | Status | Defect Reference | Priority | Automation | Auto Pass Criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-CRT-046 | Add to cart via direct product URL (no prior homepage visit) | Cart – Add to Cart | User arrives via shared/bookmarked product link without visiting homepage first | 1. Clear browser cookies<br/>2. Navigate directly to `/prod.html?idp_=1` (Samsung Galaxy S6)<br/>3. Click "Add to cart" button<br/>4. Confirm "Product added" dialog<br/>5. Navigate to `/cart.html`<br/>6. Verify product in cart table | **Expected**: Product should appear in cart (1 row), total = 360 USD<br/>**Root cause**: Cookie `user` only set by index.html, not prod.html → empty cookie → `/viewcart` returns shared bucket of 589+ items | **Current BUG**: Cart shows 589 items (other users' data) or appears empty | FAIL | DEF-SYS-001: Guest cart identity not established outside homepage | HIGH | Yes (Playwright) | test.fail() – assert payload /viewcart returns 1 item (currently fails) |

---

## B. REDEFINE: TC-CRT-020 to TC-CRT-030 (Card format validation)

### DEF-001: Credit Card Validation Missing

| Test Case ID | Test Case Name | Feature | Scenario | Steps | Expected Result | Actual Behavior (Current) | Status | Defect Reference | Priority | Automation | Pass Criteria (NEW) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-CRT-020 | Credit card – non-numeric characters | Checkout | User enters non-numeric characters in card field | 1. Add product ($360)<br/>2. Open Place Order modal<br/>3. Fill: Name="John Doe", Card="ABCD-EFGH"<br/>4. Click Purchase | **REJECT** with validation alert "Invalid card format (numbers only)" | Currently: Order succeeds with 0 USD (card stored as-is) | FAIL | DEF-001 | CRITICAL | Yes | Validation alert before API call |
| TC-CRT-026 | Credit card – 15 digits (Amex) | Checkout | Valid Amex card (15 digits, Luhn checksum valid) | 1. Add product ($360)<br/>2. Open Place Order<br/>3. Fill: Name="John Doe", Card="378282246310005" (Luhn ✓)<br/>4. Click Purchase | **ACCEPT**: Order succeeds, Amount = 360 USD | Currently: Accept but Amount shows 0 USD | PASS w/ bug | DEF-001 (partial – Luhn not checked but happens to pass) | CRITICAL | Yes | Amount must = 360 USD (not 0) |
| TC-CRT-027 | Credit card – 17 digits (exceeds max) | Checkout | Card exceeds 16-digit maximum | 1. Add product ($360)<br/>2. Open Place Order<br/>3. Fill: Card="41111111111111111" (17 digits)<br/>4. Click Purchase | **REJECT** with alert "Invalid card (must be 13-19 digits)" or "Card must be 16 or fewer" per app rules | Currently: Accept, Amount = 0 USD | FAIL | DEF-001 | CRITICAL | Yes | Validation alert (reject) |
| TC-CRT-028 | Credit card – all zeros (Luhn fail) | Checkout | Card fails Luhn checksum | 1. Add product<br/>2. Open Place Order<br/>3. Card="0000000000000000"<br/>4. Click Purchase | **REJECT** with alert "Invalid card (failed Luhn check)" | Currently: Accept, 0 USD | FAIL | DEF-001 | CRITICAL | Yes | Validation alert (reject) |
| TC-CRT-029 | Credit card – contains spaces | Checkout | Formatted card with spaces | 1. Add product<br/>2. Card="4111 1111 1111 1111"<br/>3. Click Purchase | **REJECT** with alert "Invalid card (remove spaces or auto-strip)" OR **AUTO-STRIP** spaces then validate | Currently: Accept with spaces in invoice | FAIL | DEF-001 | CRITICAL | Yes | Validation alert OR invoice shows card without spaces |
| TC-CRT-030 | Credit card – Luhn checksum invalid | Checkout | Last digit fails Luhn check | 1. Add product<br/>2. Card="4111111111111112" (valid card is ...111)<br/>3. Click Purchase | **REJECT** with alert "Invalid card (Luhn checksum failed)" | Currently: Accept, 0 USD | FAIL | DEF-001 | CRITICAL | Yes | Validation alert (reject) |

---

## C. REDEFINE: TC-CRT-031 to TC-CRT-034 (Month validation)

### DEF-002: Month Validation Missing

| Test Case ID | Test Case Name | Feature | Scenario | Steps | Expected Result | Actual Behavior (Current) | Status | Defect Reference | Priority | Automation | Pass Criteria (NEW) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-CRT-031 | Month – 0 (invalid) | Checkout | Month out of valid range | 1. Add product<br/>2. Open Place Order<br/>3. Fill: Month="0", Year="2027", Card="4111111111111111"<br/>4. Click Purchase | **REJECT** with alert "Month must be 1-12" | Currently: Accept, order succeeds | FAIL | DEF-002 | HIGH | Yes | Validation alert (reject) |
| TC-CRT-032 | Month – 13 (exceeds range) | Checkout | Month > 12 | 1. Add product<br/>2. Month="13", Year="2027"<br/>3. Click Purchase | **REJECT** with alert "Month must be 1-12" | Currently: Accept | FAIL | DEF-002 | HIGH | Yes | Validation alert (reject) |
| TC-CRT-033 | Month – non-numeric characters | Checkout | Month contains letters | 1. Add product<br/>2. Month="abc", Year="2027"<br/>3. Click Purchase | **REJECT** with alert "Month must be numeric (1-12)" | Currently: Accept | FAIL | DEF-002 | HIGH | Yes | Validation alert (reject) |
| TC-CRT-034 | Month – leading zero (01 vs 1) | Checkout | Test both formats accepted | 1. Add product<br/>2. Month="01", Year="2027", Card="4111111111111111"<br/>3. Click Purchase<br/>4. Repeat with Month="1" | **ACCEPT BOTH**: Both "01" and "1" should be accepted, order succeeds | Currently: Accept both | PASS | – | LOW | Yes | Order succeeds for both formats, Amount = 360 USD |

---

## D. REDEFINE: TC-CRT-035 to TC-CRT-038 (Year validation)

### DEF-003: Year/Expiry Validation Missing

| Test Case ID | Test Case Name | Feature | Scenario | Steps | Expected Result | Actual Behavior (Current) | Status | Defect Reference | Priority | Automation | Pass Criteria (NEW) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-CRT-035 | Year – 2-digit input (25 instead of 2025) | Checkout | 2-digit year entry | 1. Add product<br/>2. Year="25", Month="06"<br/>3. Click Purchase | **REJECT** with alert "Year must be 4 digits (YYYY)" <br/>OR **AUTO-CONVERT** "25" → "2025" (if app supports) | Currently: Accept as-is | FAIL | DEF-003 | HIGH | Yes | Validation alert OR auto-convert then accept |
| TC-CRT-036 | Year – past year (2024, expired) | Checkout | Expired card (current year is 2026) | 1. Add product<br/>2. Year="2024", Month="06"<br/>3. Click Purchase | **REJECT** with alert "Card expired (year must be >= 2027)" | Currently: Accept, order succeeds | FAIL | DEF-003 | HIGH | Yes | Validation alert (reject) |
| TC-CRT-037 | Year – far future (2100+) | Checkout | Unrealistic expiry | 1. Add product<br/>2. Year="2100"<br/>3. Click Purchase | **REJECT** with alert "Year too far in future" <br/>OR **ACCEPT** (app tolerance varies) | Currently: Accept | Conditional | DEF-003 (optional) | MEDIUM | Yes | Per app design (recommend reject) |
| TC-CRT-038 | Year – non-numeric characters | Checkout | Year contains letters | 1. Add product<br/>2. Year="abcd"<br/>3. Click Purchase | **REJECT** with alert "Year must be numeric (YYYY)" | Currently: Accept | FAIL | DEF-003 | HIGH | Yes | Validation alert (reject) |

---

## E. REDEFINE: TC-CRT-023 (Empty cart checkout)

### DEF-004: Empty Cart Checkout Allowed

| Test Case ID | Test Case Name | Feature | Scenario | Steps | Expected Result | Actual Behavior (Current) | Status | Defect Reference | Priority | Automation | Pass Criteria (NEW) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-CRT-023 | Delete all products and attempt Place Order | Checkout | Checkout with empty cart | 1. Add product ($360)<br/>2. Navigate to cart<br/>3. Delete product<br/>4. Click "Place Order" | **REJECT** with alert "Cart is empty" <br/>OR **BLOCK** button (disabled) | Currently: Order succeeds with 0 USD | FAIL | DEF-004 | MEDIUM | Yes | Validation alert OR button disabled |

---

## F. NO CHANGE NEEDED (4 cases) — Keep expectations as-is

| Test Case ID | Test Case Name | Feature | Current Expect | Verification |
|---|---|---|---|---|
| TC-CRT-034 | Month – leading zero | Checkout | Accept both "01" and "1" | ✓ Both formats work |
| TC-CRT-040 | Name – Unicode/emoji | Checkout | Accept special chars (John 🙂 Döe) | ✓ Stored and echoed in invoice |
| TC-CRT-041 | Name – leading/trailing spaces | Checkout | Accept spaces (" John Doe ") | ✓ Spaces preserved in invoice |
| TC-CRT-022 | Year – past year (2020) | Checkout | Same as TC-036 (reject expired) | → Consolidate or keep for regression coverage |

---

## G. SUMMARY TABLE — What to change in Excel

| Section | Count | Action | Estimated Effort |
|---|---|---|---|
| Add TC-CRT-046 | 1 | Insert new row | 5 min |
| Redefine TC-020, 026–030 | 6 | Update Expected Result + Defect + Pass Criteria | 15 min |
| Redefine TC-031–034 | 4 | Update Expected Result + Defect | 10 min |
| Redefine TC-035–038 | 4 | Update Expected Result + Defect | 10 min |
| Redefine TC-023 | 1 | Update Expected Result + Defect | 5 min |
| **TOTAL** | **16 rows** | **Update + 1 insert** | **45 min** |

---

## H. Column Mapping (để ánh xạ vào Excel)

```
Excel Column A: Test Case ID (TC-CRT-046, TC-CRT-020, ...)
Excel Column B: Test Case Name (descriptive title)
Excel Column C: Feature (Cart – Add/Checkout)
Excel Column D: Scenario (brief description)
Excel Column E: Steps (numbered 1–4+)
Excel Column F: Expected Result (detailed, include alert text)
Excel Column G: Actual Behavior (current system state)
Excel Column H: Status (PASS/FAIL/expected-fail)
Excel Column I: Defect Reference (DEF-001, DEF-002, ...)
Excel Column J: Priority (CRITICAL, HIGH, MEDIUM)
Excel Column K: Automation (Yes/No)
Excel Column L: Auto Pass Criteria (assertion details)
```

---

## Notes for User

1. **DEF-001 severity**: PCI DSS violation — card validation required for payment processing
2. **TC-022 & TC-036**: Duplicate scenario (past year), consider consolidate in spreadsheet
3. **TC-037**: App tolerance on future year varies — recommend REJECT to be strict
4. **Format consistency**: Maintain existing Excel formatting (font, colors, borders)
5. **Defect tracking**: Create 4 defects in issue tracker (DEF-001 to DEF-004) and link from TC rows

---

## Ready for Review

Please review this template and confirm:
- [ ] Format matches your Excel structure
- [ ] Content is accurate and complete
- [ ] I can proceed to update cart.spec.ts with these expectations
- [ ] Any adjustments needed?
