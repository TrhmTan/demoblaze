# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart.spec.ts >> CartPage Test Suite >> TC-CRT-023b: Empty cart - Place Order button should be disabled [DEF-004]
- Location: tests\cart.spec.ts:883:9

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.waitFor: Test timeout of 90000ms exceeded.
Call log:
  - waiting for locator('button[onclick="purchaseOrder()"]') to be visible
    177 × locator resolved to hidden <button type="button" class="btn btn-primary" onclick="purchaseOrder()">Purchase</button>

```

# Page snapshot

```yaml
- generic [active] [ref=f3e1]:
  - text:             
  - navigation [ref=f3e2]:
    - generic [ref=f3e3]:
      - link "PRODUCT STORE" [ref=f3e4] [cursor=pointer]:
        - /url: index.html
      - list [ref=f3e7]:
        - listitem [ref=f3e8]:
          - link "Home (current)" [ref=f3e9] [cursor=pointer]:
            - /url: index.html
            - text: Home
            - generic [ref=f3e10]: (current)
        - listitem [ref=f3e11]:
          - link "Contact" [ref=f3e12] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f3e13]:
          - link "About us" [ref=f3e14] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f3e15]:
          - link "Cart" [ref=f3e16] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f3e17]:
          - link "Log in" [ref=f3e18] [cursor=pointer]:
            - /url: "#"
        - listitem
        - listitem
        - listitem [ref=f3e19]:
          - link "Sign up" [ref=f3e20] [cursor=pointer]:
            - /url: "#"
  - generic [ref=f3e22]:
    - generic [ref=f3e23]:
      - heading "Products" [level=2] [ref=f3e24]
      - table [ref=f3e26]:
        - rowgroup [ref=f3e27]:
          - row [ref=f3e28]:
            - columnheader "Pic" [ref=f3e29]
            - columnheader "Title" [ref=f3e30]
            - columnheader "Price" [ref=f3e31]
            - columnheader "x" [ref=f3e32]
        - rowgroup
    - generic [ref=f3e33]:
      - heading "Total" [level=2] [ref=f3e34]
      - generic:
        - generic:
          - heading [level=3]
      - button "Place Order" [ref=f3e35]
  - generic [ref=f3e37]:
    - generic [ref=f3e40]:
      - heading "About Us" [level=4] [ref=f3e41]
      - paragraph [ref=f3e42]: We believe performance needs to be validated at every stage of the software development cycle and our open source compatible, massively scalable platform makes that a reality.
    - generic [ref=f3e45]:
      - heading "Get in Touch" [level=4] [ref=f3e46]
      - paragraph [ref=f3e47]: "Address: 2390 El Camino Real"
      - paragraph [ref=f3e48]: "Phone: +440 123456"
      - paragraph [ref=f3e49]: "Email: demo@blazemeter.com"
    - heading "PRODUCT STORE" [level=4] [ref=f3e53]
  - contentinfo [ref=f3e55]:
    - paragraph [ref=f3e56]: Copyright © Product Store
```

# Test source

```ts
  156 |             await this.page.goto('/');
  157 |         }
  158 | 
  159 |         // Filter by category if specified. Chá» link sáº£n pháº©m hiá»‡n ra thay vÃ¬
  160 |         // sleep 1000ms cá»‘ Ä‘á»‹nh - khÃ´ng phá»¥ thuá»™c vÃ o tÃªn endpoint filter.
  161 |         if (categoryName) {
  162 |             await this.page.click(`a.list-group-item:has-text("${categoryName}")`);
  163 |         }
  164 |         const productLink = this.page.locator(`a.hrefch:has-text("${productName}")`).first();
  165 |         await productLink.waitFor({ state: 'visible', timeout: 15_000 });
  166 | 
  167 |         // Click product link
  168 |         await productLink.click();
  169 |         await this.page.waitForSelector('.btn-success:has-text("Add to cart")');
  170 | 
  171 |         // Chá»‘t vÃ o response /addtocart thay vÃ¬ sleep 1000ms. Round trip tháº­t
  172 |         // Ä‘o Ä‘Æ°á»£c cÃ³ lÃºc > 1.5s, sleep ngáº¯n hÆ¡n lÃ m láº§n add káº¿ tiáº¿p bá»‹ race.
  173 |         const addToCart = this.page.waitForResponse(
  174 |             r => r.url().includes('/addtocart') && r.request().method() === 'POST',
  175 |             { timeout: CART_LOAD_TIMEOUT },
  176 |         );
  177 |         this.page.once('dialog', dialog => dialog.accept()); // "Product added"
  178 |         await this.page.click('.btn-success:has-text("Add to cart")');
  179 |         await addToCart;
  180 |     }
  181 | 
  182 |     /**
  183 |      * Navigate DIRECTLY to a product detail page (e.g. a shared/bookmarked
  184 |      * link) and add it to cart, WITHOUT visiting the homepage first.
  185 |      *
  186 |      * DÃ¹ng Ä‘á»ƒ tÃ¡i hiá»‡n defect tháº­t: cookie Ä‘á»‹nh danh giá» hÃ ng guest
  187 |      * (`user=<uuid>`) CHá»ˆ Ä‘Æ°á»£c set bá»Ÿi /js/index.js. /js/prod.js khÃ´ng set
  188 |      * cookie nÃ y. VÃ o tháº³ng prod.html -> document.cookie rá»—ng -> addToCart()
  189 |      * váº«n alert "Product added", nhÆ°ng cart.html sau Ä‘Ã³ gá»­i
  190 |      * {"cookie": ""} lÃªn /viewcart vÃ  nháº­n vá» bucket dÃ¹ng chung cá»§a Má»ŒI
  191 |      * guest khÃ´ng cookie (Ä‘o thá»±c táº¿: 168 sáº£n pháº©m cá»§a ngÆ°á»i khÃ¡c).
  192 |      * Xem TC-CRT-046 / TC-CRT-047.
  193 |      */
  194 |     async addProductToCartViaDirectUrl(prodId: number) {
  195 |         await this.page.goto(`/prod.html?idp_=${prodId}`);
  196 |         await this.page.waitForSelector('.btn-success:has-text("Add to cart")');
  197 |         const addToCart = this.page.waitForResponse(
  198 |             r => r.url().includes('/addtocart') && r.request().method() === 'POST',
  199 |             { timeout: CART_LOAD_TIMEOUT },
  200 |         );
  201 |         this.page.once('dialog', dialog => dialog.accept());
  202 |         await this.page.click('.btn-success:has-text("Add to cart")');
  203 |         await addToCart;
  204 |     }
  205 | 
  206 |     /**
  207 |      * Sá»‘ row hiá»‡n cÃ³ trong giá».
  208 |      *
  209 |      * KHÃ”NG chá» gÃ¬ á»Ÿ Ä‘Ã¢y ná»¯a - viá»‡c chá» Ä‘Ã£ do waitForCartLoad() lÃ m á»Ÿ
  210 |      * navigateToCart/goto/reloadCart/deleteProduct. HÃ m nÃ y chá»‰ Ä‘á»c.
  211 |      */
  212 |     async getCartRowsCount(): Promise<number> {
  213 |         return await this.cartRows.count();
  214 |     }
  215 | 
  216 |     /** Delete product by name or index */
  217 |     async deleteProduct(productName: string) {
  218 |         const row = this.page.locator(`#tbodyid tr:has-text("${productName}")`).first();
  219 |         // deleteItem() trong /js/cart.js gá»i location.reload() sau khi
  220 |         // /deleteitem tráº£ vá» -> trang load láº¡i vÃ  báº¯n /viewcart má»›i.
  221 |         // waitForCartLoad chá»‘t Ä‘Ãºng vÃ o /viewcart cá»§a láº§n load láº¡i Ä‘Ã³.
  222 |         await this.waitForCartLoad(async () => {
  223 |             await row.locator('a:has-text("Delete")').click();
  224 |         });
  225 |     }
  226 | 
  227 |     /** Open the Place Order modal */
  228 |     async openPlaceOrderModal() {
  229 |         await this.placeOrderButton.click();
  230 |         await this.orderModal.waitFor({ state: 'visible' });
  231 |     }
  232 | 
  233 |     /** Fill Place Order form details */
  234 |     async fillOrderDetails(details: {
  235 |         name?: string;
  236 |         country?: string;
  237 |         city?: string;
  238 |         card?: string;
  239 |         month?: string;
  240 |         year?: string;
  241 |     }) {
  242 |         if (details.name !== undefined) await this.modalNameInput.fill(details.name);
  243 |         if (details.country !== undefined) await this.modalCountryInput.fill(details.country);
  244 |         if (details.city !== undefined) await this.modalCityInput.fill(details.city);
  245 |         if (details.card !== undefined) await this.modalCardInput.fill(details.card);
  246 |         if (details.month !== undefined) await this.modalMonthInput.fill(details.month);
  247 |         if (details.year !== undefined) await this.modalYearInput.fill(details.year);
  248 |     }
  249 | 
  250 |     /** Submit the purchase form (Ä‘Æ°á»ng happy path -> SweetAlert, khÃ´ng cÃ³
  251 |      *  native dialog). Náº¿u Name hoáº·c Card rá»—ng thÃ¬ app báº¯n window.alert()
  252 |      *  Ä‘á»“ng bá»™ vÃ  click() sáº½ treo - trÆ°á»ng há»£p Ä‘Ã³ pháº£i dÃ¹ng
  253 |      *  clickPurchaseExpectingAlert().
  254 |      */
  255 |     async clickPurchase() {
> 256 |         await this.modalPurchaseButton.waitFor({ state: 'visible' });
      |                                        ^ Error: locator.waitFor: Test timeout of 90000ms exceeded.
  257 |         await this.modalPurchaseButton.click();
  258 |     }
  259 | 
  260 |     /**
  261 |      * Click Purchase khi biáº¿t cháº¯c app sáº½ báº¯n native alert (thiáº¿u Name
  262 |      * hoáº·c Card). Tráº£ vá» ná»™i dung alert.
  263 |      *
  264 |      * KHÃ”NG dÃ¹ng `Promise.all([page.waitForEvent('dialog'), click()])`:
  265 |      * Ä‘Äƒng kÃ½ listener lÃ m Playwright Táº®T auto-dismiss, window.alert() cháº·n
  266 |      * main thread nÃªn click() khÃ´ng bao giá» resolve, mÃ  Promise.all láº¡i Ä‘á»£i
  267 |      * cáº£ hai -> khoÃ¡ cháº¿t Ä‘áº¿n háº¿t timeout. ÄÃ³ chÃ­nh lÃ  nguyÃªn nhÃ¢n
  268 |      * TC-CRT-014 vÃ  TC-CRT-019 timeout 30s.
  269 |      *
  270 |      * CÃ¡ch Ä‘Ãºng: accept dialog ngay trong handler Ä‘á»ƒ giáº£i phÃ³ng main thread,
  271 |      * click() tá»± resolve sau Ä‘Ã³.
  272 |      */
  273 |     async clickPurchaseExpectingAlert(): Promise<string> {
  274 |         let resolveMessage!: (m: string) => void;
  275 |         const message = new Promise<string>(resolve => {
  276 |             resolveMessage = resolve;
  277 |         });
  278 | 
  279 |         this.page.once('dialog', async dialog => {
  280 |             const text = dialog.message();
  281 |             await dialog.accept();
  282 |             resolveMessage(text);
  283 |         });
  284 | 
  285 |         await this.clickPurchase();
  286 |         return await message;
  287 |     }
  288 | 
  289 |     /** Close Order Modal via Close Button */
  290 |     async closeModal() {
  291 |         await this.modalCloseButton.click();
  292 |         await this.orderModal.waitFor({ state: 'hidden' });
  293 |     }
  294 | 
  295 |     /** Close Order Modal via X top icon */
  296 |     async closeModalWithX() {
  297 |         await this.modalXButton.click();
  298 |         await this.orderModal.waitFor({ state: 'hidden' });
  299 |     }
  300 | 
  301 |     /** Get total price from text indicator */
  302 |     async getTotalPriceValue(): Promise<number> {
  303 |         const totalText = await this.totalPriceLabel.textContent();
  304 |         return totalText ? parseInt(totalText.trim(), 10) || 0 : 0;
  305 |     }
  306 | 
  307 |     /**
  308 |      * Confirm Success dialog and return invoice content string.
  309 |      *
  310 |      * KHÃ”NG dÃ¹ng innerText: innerText Ã¡p CSS white-space:normal nÃªn gá»™p má»i
  311 |      * chuá»—i khoáº£ng tráº¯ng liÃªn tiáº¿p vÃ  trim hai Ä‘áº§u. Äo trá»±c tiáº¿p trÃªn chÃ­nh
  312 |      * element .sweet-alert p vá»›i name = "  John Doe ":
  313 |      *     innerText   -> "Name: John Doe"        (máº¥t space -> TC-CRT-041 fail giáº£)
  314 |      *     textContent -> "Name:   John Doe "     (giá»¯ nguyÃªn)
  315 |      * á»ž Ä‘Ã¢y clone node, thay <br> báº±ng "\n" rá»“i láº¥y textContent: giá»¯ Ä‘Æ°á»£c
  316 |      * cáº£ khoáº£ng tráº¯ng láº«n ngáº¯t dÃ²ng, Ä‘á»“ng thá»i váº«n tráº£ vá» text Ä‘Ã£ unescape
  317 |      * (nÃªn assertion XSS cá»§a TC-CRT-024 khÃ´ng bá»‹ áº£nh hÆ°á»Ÿng).
  318 |      */
  319 |     async confirmSuccessPurchase(): Promise<string> {
  320 |         await this.successCheckmark.waitFor({ state: 'visible', timeout: 10_000 });
  321 |         const successText = await this.successDialogText.evaluate((el: Element) => {
  322 |             const clone = el.cloneNode(true) as HTMLElement;
  323 |             clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  324 |             return clone.textContent ?? '';
  325 |         });
  326 |         await this.successConfirmButton.click();
  327 |         await this.successCheckmark.waitFor({ state: 'hidden' });
  328 | 
  329 |         // Wait for navigation to index.html to complete after purchase.
  330 |         // purchaseOrder() calls location.href = 'index.html' after SweetAlert dismiss.
  331 |         // successCheckmark hidden resolves too early (during navigation), causing
  332 |         // navigateToCart() to fail with 'Test ended'. waitForURL ensures DOM is stable.
  333 |         await this.page.waitForURL(/index\.html|\/(?:\?.*)?$/, { timeout: 15_000, waitUntil: 'commit' }).catch(() => {});
  334 |         return successText;
  335 |     }
  336 | 
  337 |     /**
  338 |      * Convenience wrapper cho chuá»—i "open modal -> fill -> purchase -> Ä‘á»c
  339 |      * hoÃ¡ Ä‘Æ¡n" dÃ¹ng á»Ÿ pháº§n lá»›n cÃ¡c case checkout.
  340 |      *
  341 |      * LÆ¯U Ã (Ä‘Ã£ Ä‘á»‘i chiáº¿u source purchaseOrder()): text hoÃ¡ Ä‘Æ¡n SweetAlert
  342 |      * chá»‰ chá»©a Id / Amount / Card Number / Name / Date. Country, City,
  343 |      * Month, Year Ä‘Æ°á»£c form thu tháº­p nhÆ°ng purchaseOrder() khÃ´ng há» Ä‘á»c vÃ 
  344 |      * khÃ´ng bao giá» xuáº¥t hiá»‡n trong hoÃ¡ Ä‘Æ¡n. KhÃ´ng Ä‘Æ°á»£c assert 4 field nÃ y
  345 |      * vÃ o hoÃ¡ Ä‘Æ¡n.
  346 |      */
  347 |     async placeOrderAndGetInvoice(details: {
  348 |         name?: string;
  349 |         country?: string;
  350 |         city?: string;
  351 |         card?: string;
  352 |         month?: string;
  353 |         year?: string;
  354 |     }): Promise<string> {
  355 |         await this.openPlaceOrderModal();
  356 |         await this.fillOrderDetails(details);
```