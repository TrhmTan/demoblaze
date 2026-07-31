# Phân tích 19 case TC-020 đến TC-038: Quy tắc tài chính vs hành vi hiện tại

## Tóm tắt
19 case này hiện đang assert "app không validate = đúng", nhưng theo quy tắc tài chính (banking domain), nên redefine lại expect theo **rule thực tế**, tránh regression test lỏng lẻo.

---

## Quy tắc tài chính chuẩn

### Credit Card
| Rule | Chi tiết |
|---|---|
| **Độ dài** | 13–19 chữ số. Visa: 13, 16; Mastercard: 16; Amex: 15; Discover: 16; Diners: 14 |
| **Luhn checksum** | Bắt buộc kiểm tra |
| **Ký tự** | Chỉ số (0-9). Không chấp nhận space, dash, hay ký tự khác trừ khi auto-strip |
| **Leading zero** | Cho phép (0000... là invalid nhưng vì Luhn, không phải vì leading zero) |

### Expiry — Month
| Rule | Chi tiết |
|---|---|
| **Range** | 01–12 (hoặc 1–12) |
| **Invalid** | 0, 13+, ký tự chữ, khoảng trắng |
| **Leading zero** | Nên accept cả "1" lẫn "01" |

### Expiry — Year
| Rule | Chi tiết |
|---|---|
| **Range** | >= Năm hiện tại + 1 (để tránh card hết hạn). Ví dụ: năm nay là 2026, chỉ accept 2027+ |
| **Format** | 4 chữ số (2025, 2100). Một số app accept 2 chữ số (25 → 2025) nhưng phải có logic rõ |
| **Invalid** | Quá khứ (2024, 2020), ký tự chữ, khoảng trắng |
| **Lưu ý** | Nếu accept quá khứ → app sẽ reject ở backend, nhưng UX sẽ confusing |

### Name
| Rule | Chi tiết |
|---|---|
| **Bắt buộc** | Yes |
| **Độ dài** | Thường 1–255 ký tự |
| **Ký tự** | Cho phép tiếng Anh, tiếng Việt, emoji, khoảng trắng, dấu câu |
| **Trim** | **Không nên trim leading/trailing space** — khó phân biệt tên hợp lệ vs invalid |
| **Case** | Không cần uppercase/lowercase normalize |

### Country / City
| Rule | Chi tiết |
|---|---|
| **Bắt buộc** | Tùy thiết kế. Thường optional ở guest checkout |
| **Validate** | Không format cụ thể (SQL injection check là backend responsibility) |

---

## 4 Defect trong Demoblaze

### Defect 1: Credit card validation không có (TC-026 đến TC-030)
**Impact**: Chấp nhận card sai lệch hoàn toàn (non-numeric, sai Luhn, độ dài quái)

| TC | Input | Hiện tại | Nên reject |
|---|---|---|---|
| TC-026 | 378282246310005 (Amex 15 digits, Luhn đúng) | accept | **accept** (nên hợp lệ) |
| TC-027 | 41111111111111111 (17 digits) | accept | **reject** (vượt max 16) |
| TC-028 | 0000000000000000 (all zeros) | accept | **reject** (Luhn fail) |
| TC-029 | 4111 1111 1111 1111 (spaces) | accept | **reject** (non-numeric) |
| TC-030 | 4111111111111112 (Luhn fail) | accept | **reject** (Luhn: invalid) |

**Test strategy**:
- TC-026: expect success (Amex hợp lệ)
- TC-027–030: expect validation alert trước khi call API

---

### Defect 2: Month validation không có (TC-031 đến TC-034)
**Impact**: Chấp nhận tháng không tồn tại

| TC | Input | Hiện tại | Nên reject |
|---|---|---|---|
| TC-031 | month: "0" | accept | **reject** |
| TC-032 | month: "13" | accept | **reject** |
| TC-033 | month: "abc" | accept | **reject** |
| TC-034 | month: "01" vs "1" | accept both | **accept both** (bình thường) |

**Test strategy**:
- TC-031–033: expect validation alert
- TC-034: expect both formats accepted (no alert)

---

### Defect 3: Year validation không có (TC-035 đến TC-038)
**Impact**: Chấp nhận năm quá khứ, định dạng kỳ lạ

| TC | Input | Hiện tại | Nên reject |
|---|---|---|---|
| TC-035 | year: "25" (2-digit) | accept | **reject** hoặc **auto-convert 25→2025** (tùy app design) |
| TC-036 | year: "2024" (quá khứ) | accept | **reject** (expired) |
| TC-037 | year: "2100" (quá xa) | accept | **reject** hoặc **warning** (tùy app) |
| TC-038 | year: "abcd" | accept | **reject** |

**Test strategy**:
- Nếu app không accept 2-digit: TC-035 reject
- TC-036: reject (expired)
- TC-037: reject hoặc warning (optional)
- TC-038: reject (non-numeric)

---

### Defect 4: Empty cart checkout allowed (TC-023)
**Impact**: Có thể thanh toán giỏ rỗng (0 USD) → lạm dụng

| TC | Scenario | Hiện tại | Nên reject |
|---|---|---|---|
| TC-023 | Xóa hết sản phẩm rồi Place Order | accept 0 USD | **reject** ("Cart is empty") hoặc **warning** |

**Test strategy**: expect alert "Cart cannot be empty" trước khi modal mở, hoặc disable Place Order button khi giỏ rỗng.

---

## Re-defined Test Case Expectations

### Loại 1: Rejection cases (hiện accept → nên reject)

**TC-CRT-027** | Credit card - 17 digits (exceeds max)
- Expect: Validation alert "Invalid card number" (trước khi API call)
- Actual now: Order succeeds with 0 USD

**TC-CRT-028** | Credit card - all zeros (Luhn fail)
- Expect: Validation alert
- Actual now: Order succeeds with 0 USD

**TC-CRT-029** | Credit card - contains spaces
- Expect: Validation alert OR auto-strip spaces
- Actual now: Order succeeds with spaces in card field

**TC-CRT-030** | Credit card - Luhn checksum invalid
- Expect: Validation alert
- Actual now: Order succeeds

**TC-CRT-031** | Month - 0 (invalid)
- Expect: Validation alert OR auto-default to valid month
- Actual now: Order succeeds

**TC-CRT-032** | Month - 13 (exceeds range)
- Expect: Validation alert
- Actual now: Order succeeds

**TC-CRT-033** | Month - non-numeric characters
- Expect: Validation alert OR input masking prevent
- Actual now: Order succeeds

**TC-CRT-035** | Year - 2-digit input (25 instead of 2025)
- Expect: Validation alert OR auto-convert (25 → 2025)
- Actual now: Order succeeds

**TC-CRT-036** | Year - past year (2024, expired)
- Expect: Validation alert "Card expired"
- Actual now: Order succeeds

**TC-CRT-037** | Year - far future (2100+)
- Expect: Validation alert (optional, or accept with warning)
- Actual now: Order succeeds

**TC-CRT-038** | Year - non-numeric characters
- Expect: Validation alert
- Actual now: Order succeeds

**TC-CRT-023** | Delete all products and attempt Place Order (empty cart)
- Expect: Either (A) disable Place Order when cart empty, or (B) alert "Cart is empty"
- Actual now: Order succeeds with 0 USD

---

### Loại 2: Accept cases (hiện accept, nên vẫn accept)

**TC-CRT-020** | Credit card - non-numeric (ABCD-EFGH)
- Expect: **REJECT** (violates credit card format rule)
- Current behavior: Accept
- **Redefine: REJECT**

**TC-CRT-021** | Credit card - contains spaces (4111 1111 1111 1111)
- Expect: **REJECT hoặc AUTO-STRIP**
- Current behavior: Accept as-is with spaces
- **Redefine: REJECT** (hoặc auto-strip rồi validate Luhn)

**TC-CRT-022** | Year - past year (2020) — duplicate of TC-CRT-036
- Keep as-is but redefine expect to REJECT

**TC-CRT-026** | Credit card - 15 digits (Amex, Luhn valid)
- Expect: **ACCEPT** (Amex hợp lệ)
- Current behavior: Accept with 0 USD
- **Redefine: ACCEPT** with correct amount

**TC-CRT-034** | Month - leading zero (01 vs 1)
- Expect: **ACCEPT BOTH**
- Current behavior: Accept both
- **Keep as-is**: PASS

**TC-CRT-039** | Name - exceeds 255 characters
- Expect: Tùy app (accept, warn, truncate, reject)
- Current behavior: Accept full 256
- **Redefine theo app design**: nếu app là financial/conservative → REJECT

**TC-CRT-040** | Name - Unicode and emoji
- Expect: **ACCEPT** (hợp lệ ký tự)
- Current behavior: Accept
- **Keep as-is**: PASS

**TC-CRT-041** | Name - leading and trailing spaces
- Expect: **ACCEPT** (không nên trim)
- Current behavior: Accept (app không trim)
- **Keep as-is**: PASS

**TC-CRT-044** | All fields - maximum boundary
- Expect: Tùy field (card 19 digits → **REJECT**, name 255 → **ACCEPT**, etc.)
- Current behavior: Accept all
- **Redefine**: Split thành rejection parts

---

## Consolidation: 4 Defect + 1 Edge case

| Defect | Cases | Root cause | Fix level | Priority |
|---|---|---|---|---|
| **DEF-001: Card format không validate** | 020, 027, 028, 029, 030 | Không check Luhn, độ dài, non-numeric | Backend (PCI compliance) | **CRITICAL** |
| **DEF-002: Month không validate** | 031, 032, 033 | Không check range 1-12 | Frontend + Backend | **HIGH** |
| **DEF-003: Year không validate** | 035, 036, 037, 038 | Không check range >= current+1 | Frontend + Backend | **HIGH** |
| **DEF-004: Empty cart checkout** | 023 | Không prevent 0 USD order | Frontend | **MEDIUM** |
| **EDGE-001: Card 15-digit Amex** | 026 | Database total sai (0 USD) | Xem Defect 1 root cause | **Related** |

---

## Recommended Action

**Opsi A: Strict (recommended cho banking)**
- Redefine tất cả 19 case theo rule tài chính
- Đổi expect: REJECT cho mọi invalid case
- Dùng `test.fail()` để ghi lại defect (suite vẫn xanh, tự chuyển đỏ khi fix)
- Gom thành 4–5 defect chính để dev priority

**Opsi B: Permissive (current)**
- Giữ nguyên: "app không validate = đúng"
- Risk: regression test lỏng lẻo, không phát hiện validation bugs ở lần sau

**Đề xuất: Opsi A** — cần thiết cho domain tài chính.

---

## Test Script Template (Opsi A)

```typescript
test('TC-CRT-027: Credit card - 17 digits (exceeds max) [DEF-001]', async ({ page }) => {
    test.fail(true, 'DEF-001: Card format validation missing');
    
    const cartPage = new CartPage(page);
    await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
    await cartPage.navigateToCart();
    await cartPage.openPlaceOrderModal();
    
    await cartPage.fillOrderDetails({
        name: 'John Doe',
        card: '41111111111111111', // 17 digits
    });
    
    // EXPECTED: Validation alert before API call
    // ACTUAL BUG: Order succeeds with 0 USD
    const message = await cartPage.clickPurchaseExpectingAlert();
    expect(message).toContain('Invalid card');
});
```

---

## Tóm tắt thay đổi cần làm

| File | Thay đổi |
|---|---|
| `tests/cart.spec.ts` | Redefine expect cho TC-020, 023, 026–038 theo rule tài chính |
| `reports/` | Ghi rõ từng defect, root cause, fix strategy |
| `Demoblaze_QA_TestCases.xlsx` | Update expected behavior + add defect reference |

---

## Lưu ý: Edge case sâu hơn

Nếu anh muốn test ở backend level (API validation), cần test case riêng:
- `/addtocart` validation
- `/checkout` validation (hoặc `/viewcart` + order submission)

Hiện suite chỉ test UI level (frontend form validation), không test API response.
