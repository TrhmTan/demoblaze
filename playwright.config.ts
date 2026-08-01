import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    // 30s không đủ cho các case thêm 5 sản phẩm: mỗi lần add là
    // goto home -> filter -> mở product -> POST /addtocart, round trip thật
    // tới api.demoblaze.com đo được 1-2s mỗi bước.
    timeout: 90 * 1000,
    // Suite đã dọn xong (13/45 fail cũ đã fix, log ở README/docs). Bật 1 retry
    // riêng cho CI: CI run #12 cho thấy GitHub Actions' shared runner chậm hơn
    // máy dev rõ rệt trên WebKit (2 timeout borderline ở đúng mốc 10s, pass ở
    // Chromium/Firefox cùng run) - đây là môi trường CI, không phải race thật
    // trong code. Local giữ 0 để không che giấu lỗi thật khi đang debug.
    retries: process.env.CI ? 1 : 0,
    expect: { timeout: 15 * 1000 },
    use: {
        baseURL: 'https://www.demoblaze.com',
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
        trace: 'retain-on-failure',
    },
    projects: [
        {
            name: 'Chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'Firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'WebKit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    reporter: [['html'], ['list']],
});