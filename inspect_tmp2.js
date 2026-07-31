const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('dialog', async d => { console.log('NATIVE DIALOG:', d.message()); await d.accept(); });
  await page.goto('https://www.demoblaze.com/');
  await page.click('a.list-group-item:has-text("Phones")');
  await page.waitForTimeout(1000);
  await page.click('a.hrefch:has-text("Samsung galaxy s6")');
  await page.waitForSelector('.btn-success:has-text("Add to cart")');
  await page.click('.btn-success:has-text("Add to cart")');
  await page.waitForTimeout(1000);
  await page.click('#cartur');
  await page.waitForURL(/.*cart\.html/);
  await page.waitForSelector('#tbodyid', { state: 'attached' });
  await page.click('button:has-text("Place Order")');
  await page.waitForSelector('#orderModal', { state: 'visible' });
  await page.fill('#name', 'John Doe');
  // no card filled - matching TC-CRT-014
  await page.click('button[onclick="purchaseOrder()"]');
  await page.waitForTimeout(3000);
  const html = await page.evaluate(() => document.querySelector('.sweet-alert')?.outerHTML || 'NOT FOUND');
  console.log('SWEET ALERT HTML:', html);
  await browser.close();
})();
