# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cart.spec.ts >> CartPage Test Suite >> TC-CRT-047: Place Order modal button interactive during success popup [DEF-005]
- Location: tests\cart.spec.ts:906:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [ref=f2e1]:
  - dialog [ref=f2e2]:
    - document [ref=f2e3]:
      - generic [ref=f2e4]:
        - generic [ref=f2e5]:
          - heading "Place order" [level=5] [ref=f2e6]
          - button "Close" [ref=f2e7] [cursor=pointer]: ×
        - generic [ref=f2e9]:
          - generic [ref=f2e10]: "Total: 360"
          - generic [ref=f2e11]:
            - generic [ref=f2e12]: "Name:"
            - 'textbox "Total: 360 Name:" [ref=f2e13]': John Doe
          - generic [ref=f2e14]:
            - generic [ref=f2e15]: "Country:"
            - textbox "Country:" [ref=f2e16]
          - generic [ref=f2e17]:
            - generic [ref=f2e18]: "City:"
            - textbox "City:" [ref=f2e19]
          - generic [ref=f2e20]:
            - generic [ref=f2e21]: "Credit card:"
            - textbox "Credit card:" [ref=f2e22]: "4111111111111111"
          - generic [ref=f2e23]:
            - generic [ref=f2e24]: "Month:"
            - textbox "Month:" [ref=f2e25]: "06"
          - generic [ref=f2e26]:
            - generic [ref=f2e27]: "Year:"
            - textbox "Year:" [ref=f2e28]: "2027"
        - generic [ref=f2e30]:
          - button "Close" [ref=f2e31]
          - button "Purchase" [active] [ref=f2e32]
  - text:             
  - navigation [ref=f2e33]:
    - generic [ref=f2e34]:
      - link "PRODUCT STORE" [ref=f2e35] [cursor=pointer]:
        - /url: index.html
      - list [ref=f2e38]:
        - listitem [ref=f2e39]:
          - link "Home (current)" [ref=f2e40] [cursor=pointer]:
            - /url: index.html
            - text: Home
            - generic [ref=f2e41]: (current)
        - listitem [ref=f2e42]:
          - link "Contact" [ref=f2e43] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f2e44]:
          - link "About us" [ref=f2e45] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f2e46]:
          - link "Cart" [ref=f2e47] [cursor=pointer]:
            - /url: "#"
        - listitem [ref=f2e48]:
          - link "Log in" [ref=f2e49] [cursor=pointer]:
            - /url: "#"
        - listitem
        - listitem
        - listitem [ref=f2e50]:
          - link "Sign up" [ref=f2e51] [cursor=pointer]:
            - /url: "#"
  - generic [ref=f2e53]:
    - generic [ref=f2e54]:
      - heading "Products" [level=2] [ref=f2e55]
      - table [ref=f2e57]:
        - rowgroup [ref=f2e58]:
          - row [ref=f2e59]:
            - columnheader "Pic" [ref=f2e60]
            - columnheader "Title" [ref=f2e61]
            - columnheader "Price" [ref=f2e62]
            - columnheader "x" [ref=f2e63]
        - rowgroup [ref=f2e64]:
          - row [ref=f2e65]:
            - cell [ref=f2e66]
            - cell "Samsung galaxy s6" [ref=f2e68]
            - cell "360" [ref=f2e69]
            - cell [ref=f2e70]:
              - link "Delete" [ref=f2e71] [cursor=pointer]:
                - /url: "#"
    - generic [ref=f2e72]:
      - heading "Total" [level=2] [ref=f2e73]
      - heading "360" [level=3] [ref=f2e76]
      - button "Place Order" [ref=f2e77]
  - generic [ref=f2e79]:
    - generic [ref=f2e82]:
      - heading "About Us" [level=4] [ref=f2e83]
      - paragraph [ref=f2e84]: We believe performance needs to be validated at every stage of the software development cycle and our open source compatible, massively scalable platform makes that a reality.
    - generic [ref=f2e87]:
      - heading "Get in Touch" [level=4] [ref=f2e88]
      - paragraph [ref=f2e89]: "Address: 2390 El Camino Real"
      - paragraph [ref=f2e90]: "Phone: +440 123456"
      - paragraph [ref=f2e91]: "Email: demo@blazemeter.com"
    - heading "PRODUCT STORE" [level=4] [ref=f2e95]
  - contentinfo [ref=f2e97]:
    - paragraph [ref=f2e98]: Copyright © Product Store
```

# Test source

```ts
  825 |         expect(message).toContain('Year must be');
  826 |     });
  827 | 
  828 |     // TC-CRT-036: Year – past year (2024, expired) [DEF-003]
  829 |     test('TC-CRT-036: Year - past year (2024) [DEF-003]', async ({ page }) => {
  830 |         test.fail(true, 'DEF-003: Expiry year not validated');
  831 |         const cartPage = new CartPage(page);
  832 |         await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
  833 |         await cartPage.navigateToCart();
  834 |         await cartPage.openPlaceOrderModal();
  835 | 
  836 |         await cartPage.fillOrderDetails({
  837 |             name: 'John Doe',
  838 |             card: '4111111111111111',
  839 |             year: '2024'
  840 |         });
  841 | 
  842 |         const message = await cartPage.clickPurchaseExpectingAlert();
  843 |         expect(message).toContain('expired');
  844 |     });
  845 | 
  846 |     // TC-CRT-037: Year – far future (2100+) [DEF-003]
  847 |     test('TC-CRT-037: Year - far future (2100) [DEF-003]', async ({ page }) => {
  848 |         test.fail(true, 'DEF-003: Year boundary not validated');
  849 |         const cartPage = new CartPage(page);
  850 |         await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
  851 |         await cartPage.navigateToCart();
  852 |         await cartPage.openPlaceOrderModal();
  853 | 
  854 |         await cartPage.fillOrderDetails({
  855 |             name: 'John Doe',
  856 |             card: '4111111111111111',
  857 |             year: '2100'
  858 |         });
  859 | 
  860 |         const message = await cartPage.clickPurchaseExpectingAlert();
  861 |         expect(message).toContain('Year');
  862 |     });
  863 | 
  864 |     // TC-CRT-038: Year – non-numeric [DEF-003]
  865 |     test('TC-CRT-038: Year - non-numeric characters [DEF-003]', async ({ page }) => {
  866 |         test.fail(true, 'DEF-003: Year data type not validated');
  867 |         const cartPage = new CartPage(page);
  868 |         await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
  869 |         await cartPage.navigateToCart();
  870 |         await cartPage.openPlaceOrderModal();
  871 | 
  872 |         await cartPage.fillOrderDetails({
  873 |             name: 'John Doe',
  874 |             card: '4111111111111111',
  875 |             year: 'abcd'
  876 |         });
  877 | 
  878 |         const message = await cartPage.clickPurchaseExpectingAlert();
  879 |         expect(message).toContain('Year must be numeric');
  880 |     });
  881 | 
  882 |     // TC-CRT-023 (redefine): Empty cart checkout [DEF-004]
  883 |     test('TC-CRT-023b: Empty cart - Place Order button should be disabled [DEF-004]', async ({ page }) => {
  884 |         test.fail(true, 'DEF-004: Empty cart validation missing');
  885 |         const cartPage = new CartPage(page);
  886 |         await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
  887 |         await cartPage.navigateToCart();
  888 | 
  889 |         // Delete product
  890 |         await cartPage.deleteProduct('Samsung galaxy s6');
  891 | 
  892 |         // Try to click Place Order — should be disabled or show alert
  893 |         const placeOrderBtn = page.locator('button:has-text("Place Order")');
  894 |         const isDisabled = await placeOrderBtn.isDisabled();
  895 | 
  896 |         if (!isDisabled) {
  897 |             // If button is enabled, clicking it should show alert
  898 |             const message = await cartPage.clickPurchaseExpectingAlert();
  899 |             expect(message).toContain('empty');
  900 |         } else {
  901 |             expect(isDisabled).toBe(true);
  902 |         }
  903 |     });
  904 | 
  905 |     // TC-CRT-047: Modal stacking bug - Purchase button clickable during success popup [DEF-005]
  906 |     test('TC-CRT-047: Place Order modal button interactive during success popup [DEF-005]', async ({ page }) => {
  907 |         test.fail(true, 'DEF-005: Modal stacking issue - buttons stay clickable');
  908 |         const cartPage = new CartPage(page);
  909 |         await cartPage.addProductToCart('Phones', 'Samsung galaxy s6');
  910 |         await cartPage.navigateToCart();
  911 | 
  912 |         const successText = await cartPage.placeOrderAndGetInvoice({
  913 |             name: 'John Doe',
  914 |             card: '4111111111111111',
  915 |             month: '06',
  916 |             year: '2027',
  917 |         });
  918 |         expect(successText).toContain('Amount: 360 USD');
  919 | 
  920 |         // While success popup is visible, try to interact with modal behind it
  921 |         const purchaseBtn = page.locator('button[onclick="purchaseOrder()"]');
  922 |         const isClickable = !await purchaseBtn.isDisabled();
  923 | 
  924 |         // Bug: button should NOT be clickable/visible while popup is displayed
> 925 |         expect(isClickable).toBe(false);  // Should be false (disabled/hidden)
      |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  926 |     });
  927 | });
  928 | 
  929 | 
```