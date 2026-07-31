# TC-CRT-046: Add to cart via direct product URL (no prior homepage visit) [BUG]

## Tóm tắt
Kiểm chứng rằng khi người dùng vào thẳng link sản phẩm (không qua homepage trước), sản phẩm vẫn có thể thêm vào giỏ hàng và lấy được sau đó.

**Hiện tại FAIL** vì một defect: cookie định danh giỏ hàng guest chỉ được tạo bởi `/js/index.js`, không bởi `/js/prod.js`.

---

## Mô tả chi tiết

### Điều kiện tiên quyết
- Browser context mới (sạch cookie)
- Chưa bao giờ truy cập trang chủ (index.html)

### Các bước
1. Truy cập trực tiếp tới URL sản phẩm: `/prod.html?idp_=1` (Samsung Galaxy S6)
2. Click nút "Add to cart" → app hiển thị "Product added"
3. Điều hướng tới `/cart.html`
4. Kiểm tra sản phẩm có trong giỏ không

### Expected behavior (SAI HIỆN TẠI)
- Sản phẩm vừa thêm phải hiển thị trong bảng giỏ hàng (1 dòng)
- Tổng tiền phải là giá sản phẩm (360 USD cho S6)

### Actual behavior (BUG)
- Giỏ hiển thị rỗng hoặc hiển thị **589 sản phẩm của người dùng khác** (bucket dùng chung)
- Sản phẩm vừa thêm **không xuất hiện**

---

## Root cause

**Demoblaze's guest-cart identity mechanism:**

```javascript
// /js/index.js (chỉ chạy khi truy cập homepage)
document.cookie = "user=" + guid();

// /js/prod.js (KHÔNG tạo cookie này)
function addToCart(id) {
    var token = getCookie("tokenp_");
    if (token.length > 0) {
        // logged-in user
    } else {
        // guest: gửi với cookie hiện tại
        $.ajax({ ..., data: JSON.stringify({ "cookie": document.cookie, ... }) });
    }
}
```

**Hệ quả:**
- Vào homepage → get `user=<uuid>` → giỏ là riêng
- Vào trực tiếp prod.html → không get cookie này → `document.cookie` rỗng → `/viewcart` trả về **bucket dùng chung của MỌI guest không cookie**

Đo lịch sử:
- 03:44: bucket có 168 sản phẩm
- 04:50: bucket có 589 sản phẩm
- Nó tăng theo traffic người khác = **rò rỉ dữ liệu giỏ hàng giữa các session**

---

## Severity
**HIGH** — Rò rỉ dữ liệu người dùng, và breaking UX (user add item nhưng không tìm thấy).

---

## Root cause deterministic
Để verify fix, dùng:
```typescript
const cookies = await context.cookies();
expect(cookies.find(c => c.name === 'user')).toBeUndefined();  // sai
```
Mà không dùng giỏ hàng, vì bucket dùng chung không stable.

**Fix cho demoblaze:**
- Hoặc tạo cookie `user` ở `/js/prod.js` như ở `/js/index.js`
- Hoặc không dùng cookie, dùng session storage / API token thay vì `document.cookie`

---

## Test script ngắn gọn

```typescript
test('TC-CRT-046: Add to cart via direct product URL [BUG]', async ({ page, context }) => {
    await context.clearCookies();
    const cartPage = new CartPage(page);
    
    // Vào trực tiếp sản phẩm, không qua homepage
    await cartPage.addProductToCartViaDirectUrl(1);  // Samsung Galaxy S6
    
    // Kiểm tra payload /viewcart trả về
    const viewCart = page.waitForResponse(
        r => r.url().includes('/viewcart') && r.request().method() === 'POST'
    );
    await page.goto('/cart.html');
    const items = (await (await viewCart).json())?.Items ?? [];
    
    // EXPECTED: 1 item (vừa thêm)
    // ACTUAL BUG: 589 items (bucket dùng chung) vì cookie rỗng
    expect(items.length).toBe(1);
});
```

---

## Notes
- Đây là **regression test**, không phải acceptance test. Nó FAIL tại hệ thống, không phải tại script.
- Dùng `test.fail()` nếu muốn suite vẫn xanh: nó sẽ chuyển đỏ ("expected fail but passed") khi fix được.
- Link tương tự được share bởi người khác (bookmarked, social media) sẽ gặp lỗi này.
