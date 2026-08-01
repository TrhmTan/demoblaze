import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

// Unique dynamic user for clean TC execution
const UNIQUE_USER = `user_${Date.now()}`;
const UNIQUE_PASS = 'Test@1234';

test.describe('LoginPage Test Suite', () => {
    test.beforeAll(async ({ request }) => {
        // Register the unique user before tests run
        await request.post('https://api.demoblaze.com/signup', {
            data: { username: UNIQUE_USER, password: btoa(UNIQUE_PASS) },
        });
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    // TC-LOG-001: Open Login modal via navigation bar
    test('TC-LOG-001: Open Login modal via navigation bar', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await expect(loginPage.usernameInput).toBeVisible();
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.loginButton).toBeVisible();
        await expect(loginPage.closeModalButton).toBeVisible();
    });

    // TC-LOG-002: Successful login with valid credentials
    test('TC-LOG-002: Successful login with valid credentials', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login(UNIQUE_USER, UNIQUE_PASS);
        await loginPage.assertLoginSuccess(UNIQUE_USER);
    });

    // TC-LOG-003: User stays logged in after page refresh
    test('TC-LOG-003: User stays logged in after page refresh', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login(UNIQUE_USER, UNIQUE_PASS);
        await loginPage.assertLoginSuccess(UNIQUE_USER);

        // Reload page and verify session persistence
        await page.reload();
        await loginPage.assertLoginSuccess(UNIQUE_USER);
    });

    // TC-LOG-004: Successful logout after login
    test('TC-LOG-004: Successful logout after login', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login(UNIQUE_USER, UNIQUE_PASS);
        await loginPage.assertLoginSuccess(UNIQUE_USER);

        await loginPage.logout();
    });

    // TC-LOG-005: Close modal using 'Close' button
    test('TC-LOG-005: Close modal using Close button', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.closeLoginModal();
        await expect(loginPage.loginModal).toBeHidden();
    });

    // TC-LOG-006: Close modal using 'X' icon
    test('TC-LOG-006: Close modal using X icon', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.closeLoginModalWithX();
        await expect(loginPage.loginModal).toBeHidden();
    });

    // TC-LOG-007: Close modal by clicking outside (backdrop)
    test('TC-LOG-007: Close modal by clicking outside (backdrop)', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.closeLoginModalByBackdrop();
        await expect(loginPage.loginModal).toBeHidden();
    });

    // TC-LOG-008: Login with username that has leading/trailing spaces
    test('TC-LOG-008: Login with username that has leading/trailing spaces', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login(` ${UNIQUE_USER} `, UNIQUE_PASS);
        // Demoblaze fails to trim leading/trailing spaces in credentials, resulting in failure
        await loginPage.assertLoginFail();
    });

    // TC-LOG-009: Login with username in different case (case sensitivity)
    test('TC-LOG-009: Login with username in different case (case sensitivity)', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        // Since original registration username is all-lowercase/specific-case, changing case fails
        await loginPage.login(UNIQUE_USER.toUpperCase(), UNIQUE_PASS);
        await loginPage.assertLoginFail();
    });

    // TC-LOG-010: Login with maximum-length username/password
    test('TC-LOG-010: Login with maximum-length username/password', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        const maxUsername = 'a'.repeat(255);
        const maxPassword = 'b'.repeat(255);
        await loginPage.login(maxUsername, maxPassword);
        await loginPage.assertLoginFail();
    });

    // TC-LOG-011: Login with special characters in username
    test('TC-LOG-011: Login with special characters in username', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login('user!@#$%', 'anypass');
        await loginPage.assertLoginFail();
    });

    // TC-LOG-012: Login with only spaces as credentials
    test('TC-LOG-012: Login with only spaces as credentials', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login('   ', '   ');
        await loginPage.assertLoginFail();
    });

    // TC-LOG-013: Password field masks input
    test('TC-LOG-013: Password field masks input', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    });

    // TC-LOG-014: Login after a previously failed attempt
    test('TC-LOG-014: Login after a previously failed attempt', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();

        // 1st Attempt: Fail
        await loginPage.login(UNIQUE_USER, 'WrongPassword123');
        await loginPage.assertLoginFail();

        // 2nd Attempt: Pass (input gets cleared/re-filled)
        await loginPage.login(UNIQUE_USER, UNIQUE_PASS);
        await loginPage.assertLoginSuccess(UNIQUE_USER);
    });

    // TC-LOG-015: Login with empty Username and Password
    test('TC-LOG-015: Login with empty Username and Password', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login('', '');
        await loginPage.assertLoginFail();
    });

    // TC-LOG-016: Login with empty Username only
    test('TC-LOG-016: Login with empty Username only', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login('', UNIQUE_PASS);
        await loginPage.assertLoginFail();
    });

    // TC-LOG-017: Login with empty Password only
    test('TC-LOG-017: Login with empty Password only', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login(UNIQUE_USER, '');
        await loginPage.assertLoginFail();
    });

    // TC-LOG-018: Login with incorrect password for existing user
    test('TC-LOG-018: Login with incorrect password for existing user', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login(UNIQUE_USER, 'WrongPass99');
        await loginPage.assertLoginFail('Wrong password');
    });

    // TC-LOG-019: Login with non-existent username
    test('TC-LOG-019: Login with non-existent username', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login('ghost_user_xyz', 'anypass');
        await loginPage.assertLoginFail('User does not exist');
    });

    // TC-LOG-020: SQL Injection attempt in Username field
    test('TC-LOG-020: SQL Injection attempt in Username field', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login("' OR '1'='1", 'anypass');
        await loginPage.assertLoginFail();
    });

    // TC-LOG-021: XSS attempt in Username field
    test('TC-LOG-021: XSS attempt in Username field', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.openLoginPopup();
        await loginPage.login("<script>alert('xss')</script>", 'anypass');
        await loginPage.assertLoginFail();
    });
});