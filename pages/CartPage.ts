import { Page, Locator, expect } from '@playwright/test';

/** Cart trÃªn Demoblaze load qua 2+N round trip tá»›i api.demoblaze.com vÃ 
 *  thÆ°á»ng xuyÃªn máº¥t 2-5s khi giá» nhiá»u item. */
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
     * Chá»‘t Ä‘á»“ng bá»™ duy nháº¥t Ä‘Ã¡ng tin cho cart.html.
     *
     * TrÃ¬nh tá»± tháº­t trong /js/cart.js:
     *   $(document).ready -> GET config.json
     *                     -> POST /viewcart   (tráº£ vá» Items[])
     *                     -> POST /view       (Má»˜T request cho Má»–I sáº£n pháº©m)
     *   vÃ  chá»‰ trong success callback cá»§a /view má»›i cÃ³:
     *       $('#tbodyid').append('<tr ...>');
     *       total = total + parseInt(price);
     *
     * Há»‡ quáº£ quan trá»ng: row trong DOM vÃ  biáº¿n `total` Ä‘Æ°á»£c cáº­p nháº­t trong
     * CÃ™NG má»™t callback, nÃªn chÃºng luÃ´n khá»›p nhau á»Ÿ má»i thá»i Ä‘iá»ƒm - ká»ƒ cáº£
     * khi má»›i render 1/5 row, hoáº·c khi chÆ°a render row nÃ o (0 === 0). Má»i
     * heuristic kiá»ƒu "so DOM vá»›i total rá»“i coi lÃ  Ä‘Ã£ settle" (báº£n cÅ© cá»§a
     * waitForCartTotalStable) Ä‘á»u thoÃ¡t sá»›m vÃ  tráº£ vá» sá»‘ row sai, phá»• biáº¿n
     * nháº¥t lÃ  0. ÄÃ³ lÃ  root cause cá»§a 7 case fail + 3 case "Amount: 0 USD"
     * + case flaky TC-CRT-008.
     *
     * Chá»‘t Ä‘Ãºng: sá»‘ pháº§n tá»­ `Items` mÃ  /viewcart tráº£ vá». ÄÃ³ lÃ  con sá»‘ duy
     * nháº¥t biáº¿t trÆ°á»›c Ä‘Æ°á»£c cart cuá»‘i cÃ¹ng pháº£i cÃ³ bao nhiÃªu row.
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

        // toHaveCount tá»± retry, vÃ  vÃ¬ `total` Ä‘Æ°á»£c cá»™ng trong Ä‘Ãºng callback
        // append row nÃªn khi Ä‘á»§ row thÃ¬ window.total cháº¯c cháº¯n Ä‘Ã£ lÃ  giÃ¡ trá»‹
        // cuá»‘i cÃ¹ng -> purchaseOrder() khÃ´ng cÃ²n Ä‘á»c pháº£i total = 0.
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

    /** Reload cart page vÃ  chá» load láº¡i xong (dÃ¹ng cho TC-CRT-018) */
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

        // Filter by category if specified. Chá» link sáº£n pháº©m hiá»‡n ra thay vÃ¬
        // sleep 1000ms cá»‘ Ä‘á»‹nh - khÃ´ng phá»¥ thuá»™c vÃ o tÃªn endpoint filter.
        if (categoryName) {
            await this.page.click(`a.list-group-item:has-text("${categoryName}")`);
        }
        const productLink = this.page.locator(`a.hrefch:has-text("${productName}")`).first();
        await productLink.waitFor({ state: 'visible', timeout: 15_000 });

        // Click product link
        await productLink.click();
        await this.page.waitForSelector('.btn-success:has-text("Add to cart")');

        // Chá»‘t vÃ o response /addtocart thay vÃ¬ sleep 1000ms. Round trip tháº­t
        // Ä‘o Ä‘Æ°á»£c cÃ³ lÃºc > 1.5s, sleep ngáº¯n hÆ¡n lÃ m láº§n add káº¿ tiáº¿p bá»‹ race.
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
     * DÃ¹ng Ä‘á»ƒ tÃ¡i hiá»‡n defect tháº­t: cookie Ä‘á»‹nh danh giá» hÃ ng guest
     * (`user=<uuid>`) CHá»ˆ Ä‘Æ°á»£c set bá»Ÿi /js/index.js. /js/prod.js khÃ´ng set
     * cookie nÃ y. VÃ o tháº³ng prod.html -> document.cookie rá»—ng -> addToCart()
     * váº«n alert "Product added", nhÆ°ng cart.html sau Ä‘Ã³ gá»­i
     * {"cookie": ""} lÃªn /viewcart vÃ  nháº­n vá» bucket dÃ¹ng chung cá»§a Má»ŒI
     * guest khÃ´ng cookie (Ä‘o thá»±c táº¿: 168 sáº£n pháº©m cá»§a ngÆ°á»i khÃ¡c).
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
     * Sá»‘ row hiá»‡n cÃ³ trong giá».
     *
     * KHÃ”NG chá» gÃ¬ á»Ÿ Ä‘Ã¢y ná»¯a - viá»‡c chá» Ä‘Ã£ do waitForCartLoad() lÃ m á»Ÿ
     * navigateToCart/goto/reloadCart/deleteProduct. HÃ m nÃ y chá»‰ Ä‘á»c.
     */
    async getCartRowsCount(): Promise<number> {
        return await this.cartRows.count();
    }

    /** Delete product by name or index */
    async deleteProduct(productName: string) {
        const row = this.page.locator(`#tbodyid tr:has-text("${productName}")`).first();
        // deleteItem() trong /js/cart.js gá»i location.reload() sau khi
        // /deleteitem tráº£ vá» -> trang load láº¡i vÃ  báº¯n /viewcart má»›i.
        // waitForCartLoad chá»‘t Ä‘Ãºng vÃ o /viewcart cá»§a láº§n load láº¡i Ä‘Ã³.
        await this.waitForCartLoad(async () => {
            await row.locator('a:has-text("Delete")').click();
        });
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

    /** Submit the purchase form (Ä‘Æ°á»ng happy path -> SweetAlert, khÃ´ng cÃ³
     *  native dialog). Náº¿u Name hoáº·c Card rá»—ng thÃ¬ app báº¯n window.alert()
     *  Ä‘á»“ng bá»™ vÃ  click() sáº½ treo - trÆ°á»ng há»£p Ä‘Ã³ pháº£i dÃ¹ng
     *  clickPurchaseExpectingAlert().
     */
    async clickPurchase() {
        await this.modalPurchaseButton.waitFor({ state: 'visible' });
        await this.modalPurchaseButton.click();
    }

    /**
     * Click Purchase khi biáº¿t cháº¯c app sáº½ báº¯n native alert (thiáº¿u Name
     * hoáº·c Card). Tráº£ vá» ná»™i dung alert.
     *
     * KHÃ”NG dÃ¹ng `Promise.all([page.waitForEvent('dialog'), click()])`:
     * Ä‘Äƒng kÃ½ listener lÃ m Playwright Táº®T auto-dismiss, window.alert() cháº·n
     * main thread nÃªn click() khÃ´ng bao giá» resolve, mÃ  Promise.all láº¡i Ä‘á»£i
     * cáº£ hai -> khoÃ¡ cháº¿t Ä‘áº¿n háº¿t timeout. ÄÃ³ chÃ­nh lÃ  nguyÃªn nhÃ¢n
     * TC-CRT-014 vÃ  TC-CRT-019 timeout 30s.
     *
     * CÃ¡ch Ä‘Ãºng: accept dialog ngay trong handler Ä‘á»ƒ giáº£i phÃ³ng main thread,
     * click() tá»± resolve sau Ä‘Ã³.
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
     * KHÃ”NG dÃ¹ng innerText: innerText Ã¡p CSS white-space:normal nÃªn gá»™p má»i
     * chuá»—i khoáº£ng tráº¯ng liÃªn tiáº¿p vÃ  trim hai Ä‘áº§u. Äo trá»±c tiáº¿p trÃªn chÃ­nh
     * element .sweet-alert p vá»›i name = "  John Doe ":
     *     innerText   -> "Name: John Doe"        (máº¥t space -> TC-CRT-041 fail giáº£)
     *     textContent -> "Name:   John Doe "     (giá»¯ nguyÃªn)
     * á»ž Ä‘Ã¢y clone node, thay <br> báº±ng "\n" rá»“i láº¥y textContent: giá»¯ Ä‘Æ°á»£c
     * cáº£ khoáº£ng tráº¯ng láº«n ngáº¯t dÃ²ng, Ä‘á»“ng thá»i váº«n tráº£ vá» text Ä‘Ã£ unescape
     * (nÃªn assertion XSS cá»§a TC-CRT-024 khÃ´ng bá»‹ áº£nh hÆ°á»Ÿng).
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
     * Convenience wrapper cho chuá»—i "open modal -> fill -> purchase -> Ä‘á»c
     * hoÃ¡ Ä‘Æ¡n" dÃ¹ng á»Ÿ pháº§n lá»›n cÃ¡c case checkout.
     *
     * LÆ¯U Ã (Ä‘Ã£ Ä‘á»‘i chiáº¿u source purchaseOrder()): text hoÃ¡ Ä‘Æ¡n SweetAlert
     * chá»‰ chá»©a Id / Amount / Card Number / Name / Date. Country, City,
     * Month, Year Ä‘Æ°á»£c form thu tháº­p nhÆ°ng purchaseOrder() khÃ´ng há» Ä‘á»c vÃ 
     * khÃ´ng bao giá» xuáº¥t hiá»‡n trong hoÃ¡ Ä‘Æ¡n. KhÃ´ng Ä‘Æ°á»£c assert 4 field nÃ y
     * vÃ o hoÃ¡ Ä‘Æ¡n.
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
