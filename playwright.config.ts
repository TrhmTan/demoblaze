import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    // 30s không đủ cho các case thêm 5 sản phẩm: mỗi lần add là
    // goto home -> filter -> mở product -> POST /addtocart, round trip thật
    // tới api.demoblaze.com đo được 1-2s mỗi bước.
    timeout: 90 * 1000,
    // retries: 0 trong lúc dọn suite - có retry thì mọi race sẽ bị đội lốt
    // "flaky" và trôi qua CI. Chỉ bật lại 1 khi suite đã sạch.
    retries: 0,
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