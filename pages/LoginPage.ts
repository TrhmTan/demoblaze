import { Page, Locator, Dialog, expect } from '@playwright/test';

export class LoginPage {
    readonly page: Page;

    readonly loginNavLink: Locator;
    readonly loginModal: Locator;
    readonly usernameInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;
    readonly closeModalButton: Locator;
    readonly xModalButton: Locator;
    readonly welcomeUser: Locator;
    readonly logoutLink: Locator;
    readonly submitButton: string = 'button[onclick="logIn()"]';

    /** Message of the native alert raised by the last login() attempt, if any. */
    private lastDialogMessage: string | null = null;

    constructor(page: Page) {
        this.page = page;
        this.loginNavLink = page.locator('#login2');
        this.loginModal = page.locator('#logInModal');
        this.usernameInput = page.locator('#loginusername');
        this.passwordInput = page.locator('#loginpassword');
        this.loginButton = page.locator(this.submitButton);
        this.closeModalButton = page.locator('#logInModal .btn-secondary');
        this.xModalButton = page.locator('#logInModal .close');
        this.welcomeUser = page.locator('#nameofuser');
        this.logoutLink = page.locator('#logout2');
    }

    async goto() {
        await this.page.goto('/');
    }

    async openLoginPopup() {
        await this.loginNavLink.click();
        await this.loginModal.waitFor({ state: 'visible' });
    }

    async openLoginModal() {
        return this.openLoginPopup();
    }

    /**
     * Submit the login form and wait deterministically for whichever real
     * signal happens: a native alert (failure — e.g. "Wrong password.",
     * "User does not exist.") or the welcome banner (success).
     *
     * logIn() has TWO different failure paths, and they behave differently:
     *
     *  1. Empty Username or Password -> logIn() calls alert("Please fill out
     *     Username and Password.") SYNCHRONOUSLY, inside the click handler,
     *     before any network call.
     *  2. Wrong password / unknown user -> the alert fires later, from the
     *     async auth-API response callback.
     *
     * Case 2 works with a plain `waitForEvent('dialog')` + `click()`. Case 1
     * DEADLOCKS with it: registering a dialog listener turns OFF Playwright's
     * auto-dismiss, window.alert() then blocks the renderer's main thread, and
     * because the alert is raised synchronously during the click handler,
     * `click()` itself never resolves. The test hangs until the global timeout
     * (this is what made TC-LOG-015/016/017 hang for the full 90s at
     * `loginButton.click()`, reporting "performing click action" and never
     * returning). Same root cause already documented in
     * CartPage.clickPurchaseExpectingAlert().
     *
     * Fix: accept the dialog INSIDE a `page.once('dialog', ...)` handler, which
     * releases the blocked main thread immediately so `click()` can resolve.
     * Never await the dialog and the click together.
     *
     * The captured dialog message is available to assertLoginFail().
     */
    async login(username: string, password: string) {
        this.lastDialogMessage = null;
        await this.usernameInput.fill(username);
        await this.passwordInput.fill(password);

        let resolveDialog!: (message: string) => void;
        const dialogOutcome = new Promise<{ type: 'dialog'; message: string }>(resolve => {
            resolveDialog = (message: string) => resolve({ type: 'dialog', message });
        });

        // Accept immediately in the handler - this is what unblocks click().
        const onDialog = async (dialog: Dialog) => {
            const message = dialog.message();
            await dialog.accept().catch(() => {});
            resolveDialog(message);
        };
        this.page.once('dialog', onDialog);

        const successOutcome = this.welcomeUser
            .waitFor({ state: 'visible', timeout: 10_000 })
            .then(() => ({ type: 'success' as const }))
            .catch(() => ({ type: 'timeout' as const }));

        try {
            await this.loginButton.click();
            const outcome = await Promise.race([dialogOutcome, successOutcome]);

            if (outcome.type === 'dialog') {
                this.lastDialogMessage = outcome.message;
            }
            // type === 'success': nothing to accept; assertLoginSuccess() verifies it.
            // type === 'timeout': neither signal arrived in 10s - both
            // assertLoginSuccess() and assertLoginFail() will fail loudly below,
            // which is correct: that state means the app didn't respond as expected.
        } finally {
            // Drop the listener if no dialog ever fired, so it can't leak into
            // the next action on this page.
            this.page.off('dialog', onDialog);
        }
    }

    /**
     * Assert a SUCCESSFUL login:
     *  - Waits for the welcome banner to appear (implies modal closed)
     *  - Verifies the displayed username
     */
    async assertLoginSuccess(username: string) {
        // Welcome text appearing is the definitive success signal
        await expect(this.welcomeUser).toBeVisible({ timeout: 10000 });
        await expect(this.welcomeUser).toContainText(username);
    }

    /**
     * Assert a FAILED login.
     *
     * Confirms the user was not authenticated AND that a native alert was
     * actually raised (login() captures its message). Pass expectedMessage
     * when the exact wording is known (e.g. "Wrong password.", "User does
     * not exist.") so a silently-changed error string fails the test instead
     * of being masked by a presence-only check.
     */
    async assertLoginFail(expectedMessage?: string) {
        await expect(this.welcomeUser).not.toBeVisible();
        expect(
            this.lastDialogMessage,
            'Expected login() to have captured a native alert on failed login'
        ).not.toBeNull();
        if (expectedMessage) {
            expect(this.lastDialogMessage).toContain(expectedMessage);
        }
    }

    /** Close the login modal using Close button */
    async closeLoginModal() {
        await this.closeModalButton.click();
        await this.loginModal.waitFor({ state: 'hidden' });
    }

    /** Close the login modal using X button */
    async closeLoginModalWithX() {
        await this.xModalButton.click();
        await this.loginModal.waitFor({ state: 'hidden' });
    }

    /** Close the login modal by clicking outside (backdrop)
     *
     * How Bootstrap 4 jQuery detects a backdrop click:
     *   It registers a jQuery handler for 'click.dismiss.bs.modal' on the
     *   #logInModal container. Inside that handler it checks:
     *       event.target === event.currentTarget
     *   If true (click landed directly on the container, not a child element)
     *   and the backdrop is not 'static', it calls hide().
     *
     *   A separate 'mousedown.dismiss.bs.modal' handler on .modal-dialog only
     *   sets the _ignoreBackdropClick flag — it is NOT what dismisses the modal.
     *   We therefore dispatch a 'click' event (not mousedown) directly on the
     *   #logInModal element, which satisfies target === currentTarget.
     *
     * Why we poll Bootstrap's internal flags before clicking:
     *   Playwright's waitFor({state:'visible'}) resolves when the modal gets
     *   display:block, but Bootstrap still has _isTransitioning=true during its
     *   CSS fade animation. A backdrop click during that window is silently
     *   dropped. We use waitForFunction to poll the jQuery modal instance until
     *   _isShown===true AND _isTransitioning===false (the same guard Bootstrap
     *   uses internally before processing hide requests).
     */
    async closeLoginModalByBackdrop() {
        // Step 1: Poll Bootstrap 4 jQuery's internal modal state.
        // This is the exact same guard Bootstrap checks before accepting hide().
        await this.page.waitForFunction(() => {
            const win = window as any;
            if (win.$) {
                const instance = win.$('#logInModal').data('bs.modal');
                if (instance) {
                    return instance._isShown === true && instance._isTransitioning === false;
                }
            }
            // Fallback for non-jQuery Bootstrap: class-based check.
            const el = document.querySelector('#logInModal');
            return el !== null && el.classList.contains('show');
        }, undefined, { timeout: 10000 });

        // Step 2: Dispatch a native 'click' event directly on #logInModal.
        // Because we dispatch on the element itself (not a child), e.target
        // equals e.currentTarget in Bootstrap's handler → hide() is called.
        await this.page.evaluate(() => {
            const modal = document.querySelector('#logInModal') as HTMLElement | null;
            if (!modal) return;
            modal.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
            }));
        });

        // Final assertion-grade wait — fails loudly if modal never closed.
        await this.loginModal.waitFor({ state: 'hidden', timeout: 10000 });
    }

    /** Log out the currently authenticated user */
    async logout() {
        await this.logoutLink.click();
        await expect(this.loginNavLink).toBeVisible();
    }

    /** Assert the user is logged in */
    async assertLoggedIn(username: string) {
        await expect(this.welcomeUser).toBeVisible();
        await expect(this.welcomeUser).toContainText(username);
    }

    /** Assert the user is NOT logged in */
    async assertLoggedOut() {
        await expect(this.loginNavLink).toBeVisible();
        await expect(this.logoutLink).toBeHidden();
    }
}
