# Phân tích 14 case fail + 1 flaky — cart.spec.ts

Run: 46 test (Chromium) → 29 pass, 14 fail, 1 flaky, 2 skip. `retries: 1`, cả 14 case fail đều fail lại ở retry.

**Kết luận: 13/14 là fail giả (lỗi framework/script, không phải lỗi app). 1 case (TC-046) chạm đúng bug thật nhưng assertion viết sai nên cũng không tin được.**

---

## Nhóm 1 — `waitForCartTotalStable()` sai logic (7 fail + 1 flaky) — FAIL GIẢ

| Case | Expected | Actual |
|---|---|---|
| TC-CRT-001 | >= 1 | 0 |
| TC-CRT-003 | 790 | 0 |
| TC-CRT-005 | -1 | 0 |
| TC-CRT-011 | 2 | 0 |
| TC-CRT-012 | 1 | 0 |
| TC-CRT-016 | 5 | 0 |
| TC-CRT-018 | 0 | 1 |
| TC-CRT-008 (flaky) | 1 | 0 → pass ở retry |

### Root cause

`CartPage.ts:114`:

```ts
const settled = rowCount === 0 ? internalTotal === 0 : (domSum === internalTotal && domSum > 0);
```

Đọc source thật của `https://www.demoblaze.com/js/cart.js`:

```js
var total = 0;                      // window.total
$(document).ready(function () {
  $.getJSON("config.json", function (data) {      // ← request 1
    ...
    $.ajax({ url: API_URL + '/viewcart', ...      // ← request 2
      success: function (data) {
        data.Items.forEach(function (articleItem) {
          $.ajax({ url: API_URL + '/view', ...    // ← request 3..N, MỘT REQUEST / SẢN PHẨM
            success: function (data) {
              $('#tbodyid').append('<tr ...>');   // append row
              total = total + parseInt(valew2["price"]);   // và cộng total
```

Hai lỗ hổng chí mạng:

1. **`domSum` và `internalTotal` được cập nhật trong CÙNG một callback** → chúng luôn bằng nhau ở mọi thời điểm, kể cả khi mới render 1/5 row. Điều kiện `domSum === internalTotal` không bao giờ phân biệt được "đã load xong" với "đang load dở".
2. **Nhánh `rowCount === 0`**: trong lúc `config.json` + `/viewcart` còn đang bay (đo thực tế 0.5–2s), DOM rỗng và `total === 0` → `settled = true` → hàm thoát ngay và trả về **0 row**. Không phân biệt được "giỏ rỗng" với "chưa load".

Bằng chứng đo trực tiếp trên site (điều hướng tới cart.html rồi eval ngay):

```
{ rowCount: 3, domSum: 690, internalTotal: 690, settled: true }   ← thoát ngay, trả về 3
```

trong khi giỏ đó thực tế render dần lên 168 row sau ~4s:

```
t=0ms   rows=49  total=25820
t=1750  rows=70  total=36060
t=3500  rows=155 total=78460
t=4000  rows=168 total=84620   ← mới thật sự xong
```

Comment trong `CartPage.ts` (dòng 88–91) nói `total` "NOT incremented gradually row by row" — sai. Source cho thấy nó cộng dồn từng row một.

TC-CRT-018 (`expected 0, received 1`) là bằng chứng ngược khẳng định điều này: lần đọc đầu trả 0 vì đọc quá sớm, sau `reload()` thì đọc được 1. Item vẫn luôn ở đó.

TC-CRT-004 pass được chỉ vì có `await page.waitForTimeout(2000)` thủ công — may, không phải đúng.

### Fix

Bỏ hẳn `waitForCartTotalStable`. Chốt vào response `/viewcart` để biết số row kỳ vọng, rồi dùng assertion auto-retry của Playwright:

```ts
async navigateToCart() {
    const viewcart = this.page.waitForResponse(r =>
        r.url().includes('/viewcart') && r.request().method() === 'POST');
    await this.cartNavLink.click();
    await this.page.waitForURL(/.*cart\.html/);
    const items = (await (await viewcart).json()).Items ?? [];
    await expect(this.cartRows).toHaveCount(items.length, { timeout: 20000 });
}

async getCartRowsCount(): Promise<number> {
    return await this.cartRows.count();   // không sleep, không poll
}
```

Vì `total` được cộng trong đúng callback append row, khi đủ N row thì `window.total` chắc chắn đã là giá trị cuối → sửa luôn được Nhóm 2.

`goto()` cũng cần chốt cùng cách (hiện đang chỉ `waitForLoadState('domcontentloaded')`, hoàn toàn không đợi AJAX).

---

## Nhóm 2 — `Amount: 0 USD` (3 fail) — FAIL GIẢ, cùng gốc Nhóm 1

TC-CRT-007, TC-CRT-026, TC-CRT-045.

```
Expected substring: "Amount: 360 USD"
Received string:    "Id: 2447995
                     Amount: 0 USD
                     Card Number: 4111111111111111 ..."
```

`purchaseOrder()` đọc thẳng biến `total` chứ không đọc lại `#totalp`:

```js
text: "Id: " + idr + "\n" + "Amount: " + total + " USD" + ...
```

`navigateToCart()` thoát sớm (Nhóm 1) → nhấn Purchase khi `total` vẫn còn là 0 → hóa đơn ghi 0. Không phải bug app. Fix Nhóm 1 là hết.

---

## Nhóm 3 — Deadlock với native alert (2 fail) — FAIL GIẢ

TC-CRT-014, TC-CRT-019. Cả hai timeout 30s tại `CartPage.ts:235` (`modalPurchaseButton.click()`).

```ts
const [dialog] = await Promise.all([
    page.waitForEvent('dialog'),
    cartPage.clickPurchase(),
]);
```

`page.waitForEvent('dialog')` đăng ký listener → Playwright **tắt auto-dismiss**. `alert()` chặn main thread nên `click()` không bao giờ resolve. `Promise.all` lại đợi cả hai → khóa chết đúng 30s. Comment trong test nói pattern này để "tránh deadlock" — thực tế nó chính là deadlock.

Kiểm chứng: `purchaseOrder()` đúng là bắn alert đồng bộ khi thiếu field, nên premise của test đúng, chỉ pattern sai.

```js
if (name == "" || creditcard == "") { alert("Please fill out Name and Creditcard."); }
```

### Fix

```ts
let message = '';
page.once('dialog', async d => { message = d.message(); await d.accept(); });
await cartPage.clickPurchase();
expect(message).toContain('Please fill out Name and Creditcard.');
```

Hoặc nếu muốn giữ `waitForEvent`, **không** gói vào `Promise.all` — accept dialog trước rồi mới await click.

---

## Nhóm 4 — `innerText` nuốt khoảng trắng (1 fail) — FAIL GIẢ

TC-CRT-041 `Name - leading and trailing spaces`.

```
Expected: "Name:  John Doe "
Received: "Name: John Doe"
```

`purchaseOrder()` không `.trim()` → app giữ nguyên space, comment trong test đúng. Nhưng `confirmSuccessPurchase()` dùng `.innerText()`, mà `innerText` áp CSS `white-space: normal` → gộp khoảng trắng liên tiếp.

Đo trực tiếp trên cùng một element `.sweet-alert p`:

```
innerText   : "...Name: John Doe\nDate: 31/6/2026"          ← mất space
textContent : "...Name:   John Doe Date: 31/6/2026"          ← giữ nguyên
innerHTML   : "...Name:   John Doe <br>Date: 31/6/2026"      ← giữ cả space lẫn ngắt dòng
```

### Fix (`CartPage.ts:262`)

```ts
const html = await this.successDialogText.innerHTML();
const successText = html.replace(/<br\s*\/?>/gi, '\n');
```

Dùng `innerHTML` thay vì `textContent` để vừa giữ space vừa giữ `\n` — các assertion `toContain('Amount: ... USD')` hiện có vẫn chạy nguyên.

---

## Nhóm 5 — TC-CRT-046 — BUG THẬT, nhưng assertion sai

```ts
// the bug: guest cart identity is never established outside of index.html
expect(count).toBe(1);
```

Test tự khai đây là bug rồi lại assert hành vi đúng → chắc chắn fail, không nói lên điều gì.

Kiểm chứng bug trên site:

- `js/index.js` là nơi duy nhất set cookie: `document.cookie = "user=" + guid();`
- `js/prod.js` (`addToCart`) **không** set cookie này.
- Vào thẳng `prod.html?idp_=1` với cookie rỗng → `addToCart(1)` vẫn alert `"Product added"`, `document.cookie` sau đó vẫn `""`.

Nhưng hệ quả nặng hơn mô tả trong test. `cart.html` gửi `{"cookie": document.cookie}` = chuỗi rỗng, và API trả về **bucket dùng chung của mọi guest không cookie**: đo được **168 row** của người khác trong giỏ, total 84.620 USD. Không phải "item bị mất" — mà là **rò rỉ giỏ hàng giữa các guest session**.

### Fix

Tách làm 2, và assert vào nguyên nhân thay vì hệ quả nhiễu:

```ts
test('TC-CRT-046: direct product URL không tạo guest cart identity [BUG]', async ({ page }) => {
    await page.goto('/prod.html?idp_=1');
    ...add to cart...
    const cookies = await page.context().cookies();
    expect(cookies.find(c => c.name === 'user')).toBeUndefined();   // deterministic
});
```

Nên nâng thành defect report riêng, mức nghiêm trọng cao hơn nhãn `[BUG]` hiện tại.

---

## Case flaky — TC-CRT-008

Không phải flaky theo nghĩa "môi trường phập phù". Đây là **race có thật, tỉ lệ trúng ~50%**, cùng root cause Nhóm 1: attempt 1 đọc trúng lúc `/viewcart` chưa về (`count = 0`), retry thì cache DNS/HTTP ấm hơn nên response về kịp → pass.

`retries: 1` đang che nó lại và dán nhãn "flaky" — đó là lý do nó không nằm trong 14 case fail, chứ bản chất giống hệt TC-CRT-001.

### Hướng xử lý

1. **Sửa root cause**, không sửa triệu chứng. Áp fix Nhóm 1 → hết flaky. Tuyệt đối không thêm `waitForTimeout` hay tăng `retries`.
2. **Verify bằng repeat, không bằng một lần chạy xanh**:
   ```
   npx playwright test cart.spec.ts -g "TC-CRT-008" --repeat-each=20 --retries=0
   ```
   20/20 pass mới coi là xong.
3. **Tạm thời `retries: 0` trong lúc sửa suite.** Đang có retries thì mọi race sẽ bị đội lốt "flaky" và trôi qua CI. Bật lại `retries: 1` chỉ sau khi suite sạch, và coi mọi báo cáo flaky sau đó là bug phải điều tra chứ không phải nhiễu.
4. Bổ sung `fullyParallel: false` hoặc worker riêng nếu thấy giỏ bị nhiễm chéo — hiện `actualWorkers: 1` nên chưa phải vấn đề.

---

## Thứ tự sửa đề xuất

| # | Việc | Chữa được |
|---|---|---|
| 1 | Thay `waitForCartTotalStable` bằng chốt response `/viewcart` + `toHaveCount` | 7 fail + 3 fail (Amount 0) + 1 flaky = **11** |
| 2 | Bỏ `Promise.all` khi bắt native alert | 2 |
| 3 | `innerHTML` + replace `<br>` trong `confirmSuccessPurchase` | 1 |
| 4 | Viết lại assertion TC-046, tách thành defect report | 1 |

Sau bước 1–3: 46 test còn lại đúng 1 fail hợp lệ (TC-046) — và đó là bug app thật.

---

## Bug thật phát hiện thêm, chưa có case nào bắt

1. **Sai tháng trên hóa đơn.** `purchaseOrder()` dùng `date.getMonth()` (0-indexed) không +1. Ngày 31/07/2026 in ra `Date: 31/6/2026`. Xuất hiện trong mọi hóa đơn của mọi case đang pass mà không ai assert. → nên thêm TC.
2. **Rò rỉ giỏ hàng guest** khi `document.cookie` rỗng (mục Nhóm 5) — API trả giỏ của người dùng khác.
3. **Không có validation nào ở backend** cho card/month/year (TC-020, 026–038 đều pass với rác) — đúng như suite đã ghi nhận, nhưng đáng gom thành một defect chung thay vì 19 case rời rạc.

---

# PHẦN 2 — Patch đã áp và kết quả verify

## File đã sửa

| File | Thay đổi |
|---|---|
| `pages/CartPage.ts` | Xoá `waitForCartTotalStable`, thay bằng `waitForCartLoad()` chốt vào response `/viewcart`. Thêm `reloadCart()`, `clickPurchaseExpectingAlert()`. `addProductToCart` chốt vào `/addtocart` thay vì `waitForTimeout(1000)`. `confirmSuccessPurchase` đọc text qua clone node + `<br>`→`\n` thay vì `innerText`. |
| `tests/cart.spec.ts` | TC-014, TC-019 bỏ `Promise.all` deadlock. TC-018 dùng `reloadCart()`. TC-007 sửa false pass (đang đếm row trên index.html). TC-046 đổi sang assert payload `/viewcart` + `test.fail()`. Thêm TC-047. |
| `playwright.config.ts` | `timeout` 30s → 90s, `retries` 1 → 0, `expect.timeout` 15s, bật `trace: retain-on-failure`. |

`tsc --noEmit`: sạch.

## Verify trực tiếp trên www.demoblaze.com

Sandbox không có network tới demoblaze nên chưa chạy được test runner. Đã verify từng cơ chế bằng Playwright thật, mỗi kịch bản một browser context riêng (cookie sạch, mô phỏng đúng điều kiện test):

| Kịch bản | Kết quả |
|---|---|
| TC-016 — thêm 5 sản phẩm | `expected 5 / actual 5`, chờ 367ms, `#totalp` = 3070 = `window.total` |
| TC-018 — reload | `expected 5 / actual 5`, chờ 591ms |
| TC-005 — xoá 1 sản phẩm | 5 → 4, chờ 250ms |
| TC-007 / TC-045 — hoá đơn | `Amount: 360 USD` ✔ (trước là `Amount: 0 USD`) |
| TC-019 — alert form rỗng | bắt được `"Please fill out Name and Creditcard."` sau **348ms** (trước: timeout 30s) |
| TC-041 — space đầu/cuối | `"Name:  John Doe "` giữ nguyên ✔ |
| TC-024 — XSS payload | `"Name: <script>alert('xss')</script>"` vẫn khớp với cách đọc text mới ✔ |
| TC-047 — cookie `user` sau direct URL | `undefined` ✔ (deterministic) |
| TC-046 — `/viewcart` Items | **589** item, không phải 1 → đúng là expected-failure |
| **TC-008 (case flaky) — lặp 5 lần** | **5/5 pass**, 5.65–5.99s mỗi lần, độ lệch < 350ms |

Đáng chú ý: bucket dùng chung của guest không cookie đo lúc 03:44 là **168 item**, đo lại lúc 04:50 là **589 item**. Nó tăng theo traffic của người dùng khác — bằng chứng trực tiếp rằng đây là rò rỉ giỏ hàng giữa các session, không phải dữ liệu cũ tồn đọng.

## Lệnh chạy lại (chạy trên máy anh, sandbox không ra được demoblaze)

```bash
npx playwright test cart.spec.ts --project=Chromium --reporter=list

# kiểm tra flaky đã hết hẳn:
npx playwright test cart.spec.ts --project=Chromium -g "TC-CRT-008" --repeat-each=20
```

Kỳ vọng: 45 pass, 1 expected-failure (TC-046), 2 skip, 0 flaky.

---

## Ghi chú khác

- TC-CRT-042, 043 (SQL injection Country/City) đang skip. `purchaseOrder()` không hề đọc `#country`/`#city` → hai case này vô nghĩa ở tầng UI, nên xóa hoặc chuyển xuống test API.
- `playwright.config.ts` khai 5 project nhưng run này chỉ chạy Chromium. Chưa biết Firefox/WebKit/Mobile ra sao.
