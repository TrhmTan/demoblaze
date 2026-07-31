const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('dialog', d => d.accept());

  async function addToCart(product) {
    await page.goto('https://www.demoblaze.com/');
    await page.click('a.list-group-item:has-text("Phones")');
    await page.waitForTimeout(1000);
    await page.click(`a.hrefch:has-text("${product}")`);
    await page.waitForSelector('.btn-success:has-text("Add to cart")');
    await page.click('.btn-success:has-text("Add to cart")');
    await page.waitForTimeout(1000);
  }

  await addToCart('Nokia lumia 1520');
  await addToCart('Nokia lumia 1520');

  await page.click('#cartur');
  await page.waitForURL(/.*cart\.html/);
  await page.waitForTimeout(2000);
  const rows = await page.locator('#tbodyid tr').count();
  console.log('ROWS AFTER ADDING SAME PRODUCT TWICE:', rows);
  const rowTexts = await page.locator('#tbodyid tr').allTextContents();
  console.log('ROW TEXTS:', JSON.stringify(rowTexts));

  await browser.close();
})();
