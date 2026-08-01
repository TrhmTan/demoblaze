import { Page, Locator, expect } from '@playwright/test';

/** Cart trên Demoblaze load qua 2+N round trip tới api.demoblaze.com và
 *  thường xuyên mất 2-5s khi giỏ nhiều item. */
const CART_LOAD_TIMEOUT = 30_000;

export class CartPage {
    readonly page: Page;

    // Navigation and Home elements
    readonly cartNavLink: Locator;
    readonly homeNavLink: Locator;
    readonly logoLink: Locator;

    // Cart table elements
    readonly cartTable: Locator;
    readonly cartRows: Locator;
    readonly totalPriceLabel: Locator;
    readonly placeOrderButton: Locator;

    // Place Order Modal Form elements
    readonly orderModal: Locator;
    readonly modalNameInput: Locator;
    readonly modalCountryInput: Locator;
    readonly modalCityInput: Locator;
    readonly modalCardInput: Locator;
    readonly modalMonthInput: Locator;
    readonly modalYearInput: Locator;
    readonly modalPurchaseButton: Locator;
    readonly modalCloseButton: Locator;
    readonly modalXButton: Locator;

    // Order Success Dialog elements
    readonly successCheckmark: Locator;
    readonly successDialogText: Locator;
    readonly successConfirmButton: Locator;

    constructor(page: Page) {
        this.page = page;

        // Nav and Logo selectors
        this.cartNavLink = page.locator('#cartur');
        this.homeNavLink = page.locator('a.nav-link:has-text("Home")'); // Use robust text matching
        this.logoLink = page.locator('#nava');

        // Cart items table and total selectors
        this.cartTable = page.locator('#tbodyid');
        this.cartRows = page.locator('#tbodyid tr');
        this.totalPriceLabel = page.locator('#totalp');
        this.placeOrderButton = page.locator('button:has-text("Place Order")');

        // Place Order Form selectors
        this.orderModal = page.locator('#orderModal');
        this.modalNameInput = page.locator('#name');
        this.modalCountryInput = page.locator('#country');
        this.modalCityInput = page.locator('#city');
        this.modalCardInput = page.locator('#card');
        this.modalMonthInput = page.locator('#month');
        this.modalYearInput = page.locator('#year');
        this.modalPurchaseButton = page.locator('button[onclick="purchaseOrder()"]');
        this.modalCloseButton = page.locator('#orderModal .btn-secondary');
        this.modalXButton = page.locator('#orderModal .close');

        // Success Confirmation Popup selectors
        this.successCheckmark = page.locator('.sa-success');
        this.successDialogText = page.locator('.sweet-alert p');
        this.successConfirmButton = page.locator('.sweet-alert .confirm');
    }

    // ------------------------------------------------------------------
    // Cart load barrier
    // ------------------------------------------------------------------

    /**
     * Chốt đồng bộ duy nhất đáng tin cho cart.html.
     *
     * Trình tự thật trong /js/cart.js:
     *   $(document).ready -> GET config.json
     *                     -> POST /viewcart   (trả về Items[])
     *                     -> POST /view       (MỘT request cho MỖI sản phẩm)
     *   và chỉ trong success callback của /view mới có:
     *       $('#tbodyid').append('<tr ...>');
     *       total = total + parseInt(price);
     *
     * Hệ quả quan trọng: row trong DOM và biến `total` được cập nhật trong
     * CÙNG một callback, nên chúng luôn khớp nhau ở mọi thời điểm - kể cả
     * khi mới render 1/5 row, hoặc khi chưa render row nào (0 === 0). Mọi
     * heuristic kiểu "so DOM với total rồi coi là đã settle" (bản cũ của
     * waitForCartTotalStable) đều thoát sớm và trả về số row sai, phổ biến
     * nhất là 0. Đó là root cause của 7 case fail + 3 case "Amount: 0 USD"
     * + case flaky TC-CRT-008.
     *
     * Chốt đúng: số phần tử `Items` mà /viewcart trả về. Đó là con số duy
     * nhất biết trước được cart cuối cùng phải có bao nhiêu row.
     */
    private async waitForCartLoad<T>(action: () => Promise<T>): Promise<T> {
        const viewCart = this.page.waitForResponse(
            r => r.url().includes('/viewcart') && r.request().method() === 'POST',
            { timeout: CART_LOAD_TIMEOUT },
        );
        const result = await action();

        let expectedRows = 0;
        try {
            const body = await (await viewCart).json();
            expectedRows = Array.isArray(body?.Items) ? body.Items.length : 0;
        } catch {
            expectedRows = 0;
        }

        // toHaveCount tự retry, và vì `total` được cộng trong đúng callback
        // append row nên khi đủ row thì window.total chắc chắn đã là giá trị
        // cuối cùng -> purchaseOrder() không còn đọc phải total = 0.
        await expect(this.cartRows).toHaveCount(expectedRows, { timeout: CART_LOAD_TIMEOUT });
        return result;
    }

    /** Navigate to Cart page directly via URL */
    async goto() {
        await this.waitForCartLoad(async () => {
            await this.page.goto('/cart.html');
        });
    }

    /** Navigate to Cart page via navigation link */
    async navigateToCart() {
        await this.waitForCartLoad(async () => {
            await this.cartNavLink.click();
            await this.page.waitForURL(/.*cart\.html/);
        });
    }

    /** Reload cart page và chờ load lại xong (dùng cho TC-CRT-018) */
    async reloadCart() {
        await this.waitForCartLoad(async () => {
            await this.page.reload();
        });
    }

    /** Click Home menu link */
    async clickHome() {
        await this.homeNavLink.click();
        await this.page.waitForURL(/.*index\.html|.*\//);
    }

    /** Click Demoblaze Brand Logo */
    async clickLogo() {
        await this.logoLink.click();
        await this.page.waitForURL(/.*index\.html|.*\//);
    }

    /** Open product item from homepage and add to cart */
    async addProductToCart(categoryName: string, productName: string) {
        // Navigate to homepage first if not already
        if (!this.page.url().includes('index.html') && this.page.url() !== 'https://www.demoblaze.com/') {
            await this.page.goto('/');
        }

        // Filter by category if specified. Chờ link sản phẩm hiện ra thay vì
        // sleep 1000ms cố định - không phụ thuộc vào tên endpoint filter.
        if (categoryName) {
            await this.page.click(`a.list-group-item:has-text("${categoryName}")`);
        }
        const productLink = this.page.locator(`a.hrefch:has-text("${productName}")`).first();
        await productLink.waitFor({ state: 'visible', timeout: 15_000 });

        // Click product link
        await productLink.click();
        await this.page.waitForSelector('.btn-success:has-text("Add to cart")');

        // Chốt vào response /addtocart thay vì sleep 1000ms. Round trip thật
        // đo được có lúc > 1.5s, sleep ngắn hơn làm lần add kế tiếp bị race.
        //
        // LƯU Ý (đã verify trực tiếp bằng API call thật ngoài Playwright,
        // 2026-08-01): /addtocart trả HTTP 200 với body RỖNG ngay cả khi
        // item được add THÀNH CÔNG (verify lại bằng /viewcart thấy item nằm
        // đủ trong đó). Đây KHÔNG phải dấu hiệu lỗi - đừng dùng độ dài body
        // để quyết định success/fail cho endpoint này.
        const addToCart = this.page.waitForResponse(
            r => r.url().includes('/addtocart') && r.request().method() === 'POST',
            { timeout: CART_LOAD_TIMEOUT },
        );
        this.page.once('dialog', dialog => dialog.accept()); // "Product added"
        await this.page.click('.btn-success:has-text("Add to cart")');
        await addToCart;
    }

    /**
     * Navigate DIRECTLY to a product detail page (e.g. a shared/bookmarked
     * link) and add it to cart, WITHOUT visiting the homepage first.
     *
     * Dùng để tái hiện defect thật: cookie định danh giỏ hàng guest
     * (`user=<uuid>`) CHỈ được set bởi /js/index.js. /js/prod.js không set
     * cookie này. Vào thẳng prod.html -> document.cookie rỗng -> addToCart()
     * vẫn alert "Product added", nhưng cart.html sau đó gửi
     * {"cookie": ""} lên /viewcart và nhận về bucket dùng chung của MỌI
     * guest không cookie (đo thực tế: 168 sản phẩm của người khác).
     * Xem TC-CRT-046 / TC-CRT-047.
     */
    async addProductToCartViaDirectUrl(prodId: number) {
        await this.page.goto(`/prod.html?idp_=${prodId}`);
        await this.page.waitForSelector('.btn-success:has-text("Add to cart")');
        const addToCart = this.page.waitForResponse(
            r => r.url().includes('/addtocart') && r.request().method() === 'POST',
            { timeout: CART_LOAD_TIMEOUT },
        );
        this.page.once('dialog', dialog => dialog.accept());
        await this.page.click('.btn-success:has-text("Add to cart")');
        await addToCart;
    }

    /**
     * Số row hiện có trong giỏ.
     *
     * KHÔNG chờ gì ở đây nữa - việc chờ đã do waitForCartLoad() làm ở
     * navigateToCart/goto/reloadCart/deleteProduct. Hàm này chỉ đọc.
     */
    async getCartRowsCount(): Promise<number> {
        return await this.cartRows.count();
    }

    /** Delete product by name or index */
    async deleteProduct(productName: string) {
        const row = this.page.locator(`#tbodyid tr:has-text("${productName}")`).first();
        // deleteItem() trong /js/cart.js gọi location.reload() sau khi
        // /deleteitem trả về -> trang load lại và bắn /viewcart mới.
        // waitForCartLoad chốt đúng vào /viewcart của lần load lại đó.
        await this.waitForCartLoad(async () => {
            await row.locator('a:has-text("Delete")').click();
        });
    }

    /** Clear all items from cart (for test isolation) */
    async clearCart() {
        await this.navigateToCart();
        let count = await this.getCartRowsCount();
        while (count > 0) {
            // Delete first row repeatedly until cart is empty
            const firstDeleteLink = this.page.locator('#tbodyid tr').first().locator('a:has-text("Delete")');
            await this.waitForCartLoad(async () => {
                await firstDeleteLink.click();
            });
            count = await this.getCartRowsCount();
        }
    }

    /** Open the Place Order modal */
    async openPlaceOrderModal() {
        await this.placeOrderButton.click();
        await this.orderModal.waitFor({ state: 'visible' });
    }

    /** Fill Place Order form details */
    async fillOrderDetails(details: {
        name?: string;
        country?: string;
        city?: string;
        card?: string;
        month?: string;
        year?: string;
    }) {
        if (details.name !== undefined) await this.modalNameInput.fill(details.name);
        if (details.country !== undefined) await this.modalCountryInput.fill(details.country);
        if (details.city !== undefined) await this.modalCityInput.fill(details.city);
        if (details.card !== undefined) await this.modalCardInput.fill(details.card);
        if (details.month !== undefined) await this.modalMonthInput.fill(details.month);
        if (details.year !== undefined) await this.modalYearInput.fill(details.year);
    }

    /** Submit the purchase form (đường happy path -> SweetAlert, không có
     *  native dialog). Nếu Name hoặc Card rỗng thì app bắn window.alert()
     *  đồng bộ và click() sẽ treo - trường hợp đó phải dùng
     *  clickPurchaseExpectingAlert().
     */
    async clickPurchase() {
        await this.modalPurchaseButton.waitFor({ state: 'visible' });
        await this.modalPurchaseButton.click();
    }

    /**
     * Click Purchase khi biết chắc app sẽ bắn native alert (thiếu Name
     * hoặc Card). Trả về nội dung alert.
     *
     * KHÔNG dùng `Promise.all([page.waitForEvent('dialog'), click()])`:
     * đăng ký listener làm Playwright TẮT auto-dismiss, window.alert() chặn
     * main thread nên click() không bao giờ resolve, mà Promise.all lại đợi
     * cả hai -> khoá chết đến hết timeout. Đó chính là nguyên nhân
     * TC-CRT-014 và TC-CRT-019 timeout 30s.
     *
     * Cách đúng: accept dialog ngay trong handler để giải phóng main thread,
     * click() tự resolve sau đó.
     */
    async clickPurchaseExpectingAlert(): Promise<string> {
        let resolveMessage!: (m: string) => void;
        const message = new Promise<string>(resolve => {
            resolveMessage = resolve;
        });

        this.page.once('dialog', async dialog => {
            const text = dialog.message();
            await dialog.accept();
            resolveMessage(text);
        });

        await this.clickPurchase();
        return await message;
    }

    /**
     * Bounded variant of clickPurchaseExpectingAlert() for input Demoblaze is
     * KNOWN NOT to validate (DEF-001/002/003/004 - card format, month, year,
     * empty cart). clickPurchaseExpectingAlert() waits indefinitely for a
     * native alert; since these fields have no client-side validation at
     * all, that alert never fires and the order just succeeds instead, so
     * the wait would hang for the full test timeout (~96-100s observed)
     * instead of failing fast.
     *
     * This races the alert against the SweetAlert success popup with an 8s
     * bound and returns a string either way, so existing
     * `expect(message).toContain(...)` assertions written for the
     * correct/desired (rejected) behavior keep working unchanged - they now
     * just fail in seconds with a readable reason instead of a bare
     * timeout when the defect is still present.
     */
    async clickPurchaseExpectingAlertOrAccept(): Promise<string> {
        const dialogOutcome = this.page
            .waitForEvent('dialog', { timeout: 8_000 })
            .then(dialog => ({ kind: 'dialog' as const, dialog }))
            .catch(() => ({ kind: 'timeout' as const }));

        const successOutcome = this.successCheckmark
            .waitFor({ state: 'visible', timeout: 8_000 })
            .then(() => ({ kind: 'success' as const }))
            .catch(() => ({ kind: 'timeout' as const }));

        await this.clickPurchase();
        const outcome = await Promise.race([dialogOutcome, successOutcome]);

        if (outcome.kind === 'dialog') {
            const message = outcome.dialog.message();
            await outcome.dialog.accept();
            return message;
        }
        if (outcome.kind === 'success') {
            const invoiceText = await this.confirmSuccessPurchase();
            return `(no validation alert - order was accepted instead) ${invoiceText}`;
        }
        return '(no validation alert and no success popup within 8s - unexpected app state, investigate)';
    }

    /** Close Order Modal via Close Button */
    async closeModal() {
        await this.modalCloseButton.click();
        await this.orderModal.waitFor({ state: 'hidden' });
    }

    /** Close Order Modal via X top icon */
    async closeModalWithX() {
        await this.modalXButton.click();
        await this.orderModal.waitFor({ state: 'hidden' });
    }

    /** Get total price from text indicator */
    async getTotalPriceValue(): Promise<number> {
        const totalText = await this.totalPriceLabel.textContent();
        return totalText ? parseInt(totalText.trim(), 10) || 0 : 0;
    }

    /**
     * Confirm Success dialog and return invoice content string.
     *
     * KHÔNG dùng innerText: innerText áp CSS white-space:normal nên gộp mọi
     * chuỗi khoảng trắng liên tiếp và trim hai đầu. Đo trực tiếp trên chính
     * element .sweet-alert p với name = "  John Doe ":
     *     innerText   -> "Name: John Doe"        (mất space -> TC-CRT-041 fail giả)
     *     textContent -> "Name:   John Doe "     (giữ nguyên)
     * Ở đây clone node, thay <br> bằng "\n" rồi lấy textContent: giữ được
     * cả khoảng trắng lẫn ngắt dòng, đồng thời vẫn trả về text đã unescape
     * (nên assertion XSS của TC-CRT-024 không bị ảnh hưởng).
     */
    async confirmSuccessPurchase(): Promise<string> {
        await this.successCheckmark.waitFor({ state: 'visible', timeout: 10_000 });
        const successText = await this.successDialogText.evaluate((el: Element) => {
            const clone = el.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            return clone.textContent ?? '';
        });
        await this.successConfirmButton.click();
        await this.successCheckmark.waitFor({ state: 'hidden' });

        // Wait for navigation to index.html to complete after purchase.
        // purchaseOrder() calls location.href = 'index.html' after SweetAlert dismiss.
        // successCheckmark hidden resolves too early (during navigation), causing
        // navigateToCart() to fail with 'Test ended'. waitForURL ensures DOM is stable.
        await this.page.waitForURL(/index\.html|\/(?:\?.*)?$/, { timeout: 15_000, waitUntil: 'commit' }).catch(() => {});
        return successText;
    }

    /**
     * Convenience wrapper cho chuỗi "open modal -> fill -> purchase -> đọc
     * hoá đơn" dùng ở phần lớn các case checkout.
     *
     * LƯU Ý (đã đối chiếu source purchaseOrder()): text hoá đơn SweetAlert
     * chỉ chứa Id / Amount / Card Number / Name / Date. Country, City,
     * Month, Year được form thu thập nhưng purchaseOrder() không hề đọc và
     * không bao giờ xuất hiện trong hoá đơn. Không được assert 4 field này
     * vào hoá đơn.
     */
    async placeOrderAndGetInvoice(details: {
        name?: string;
        country?: string;
        city?: string;
        card?: string;
        month?: string;
        year?: string;
    }): Promise<string> {
        await this.openPlaceOrderModal();
        await this.fillOrderDetails(details);
        await this.clickPurchase();
        return await this.confirmSuccessPurchase();
    }
}
