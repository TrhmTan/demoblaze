# Demoblaze QA Automation

Playwright + TypeScript end-to-end automation for the Login and Cart features of [demoblaze.com](https://www.demoblaze.com), built for a QA automation take-home challenge. Covers test case documentation, a modular E2E framework, CI, and a documented defect list found while building the suite.

Author: Trần Huỳnh Minh Tân

## Contents

- [Architecture](#architecture)
- [How to run](#how-to-run)
- [CI/CD](#cicd)
- [Defects found](#defects-found)
- [Known limitations & next steps](#known-limitations--next-steps)

## Architecture

```
pages/            Page Object Model (LoginPage, CartPage)
tests/
  login.spec.ts       21 cases - Login modal, auth, session
  cart.spec.ts         Cart, checkout, financial validation edge cases
  api.spec.ts          Direct API-level checks (no browser) for /login, /viewcart, /addtocart, /purchaseorder...
  regression.spec.ts   Independent smoke pass over Login+Cart+Integration, doesn't share code with pages/
  demo.spec.ts         The "automation implementation demo" the challenge asks for: login -> add to cart -> place order -> verify invoice
  performance.spec.ts  Response-time / load-smoke checks (see limitations below)
playwright.config.ts        Main config - Login/Cart across Chromium, Firefox, WebKit
playwright.perf.config.ts   Performance config - single browser, sequential, longer timeout
playwright.manual.config.ts Unified runner for all 5 suites, JSON reporter feeds the xlsx sync script
scripts/                    archive-run.js, sync_test_results_to_xlsx.py, manage-reports.sh, view-report.sh
docs/                       API validation analysis, performance/regression guides
reports/test-cases/         Defect analysis written while building the suite (source for the table below)
inputdata/Demoblaze_QA_TestCases.xlsx   Master manual test case sheet (Login/Cart/API), synced with automation results
.github/workflows/playwright.yml        CI: install browsers, run Login/Cart/API, publish HTML report
```

### Why Page Object Model, not a shared BaseTest

`LoginPage` and `CartPage` hold locators and the interaction logic that's actually tricky on this site: racing a native `alert()` against the welcome banner, polling Bootstrap's internal `_isShown`/`_isTransitioning` flags before touching a modal, and reading `/viewcart` responses to know how many rows to expect. Tests stay declarative (`cartPage.addProductToCart(...)`, `cartPage.placeOrderAndGetInvoice(...)`) and don't re-implement that logic. A shared inheritance-based `BaseTest` was deliberately avoided in favor of composition (Playwright fixtures + POM instances per test) - it keeps each test's dependencies explicit instead of pulling in a growing grab-bag of inherited helpers.

### Why deterministic waits instead of `waitForTimeout`

Demoblaze's own client code (`cart.js`, `index.js`) is the actual source of truth for timing:

- Adding an item shows a **native `window.alert()`** ("Product added") fired asynchronously from the `/addtocart` success callback - not synchronously with the click. Both `LoginPage.login()` and `CartPage.addProductToCart()` register the dialog listener before clicking and race the dialog against the next real signal, instead of sleeping and hoping the alert already fired.
- **Order confirmation is a SweetAlert DOM element**, not a native dialog - a different mechanism in the same checkout flow, handled separately in `CartPage.confirmSuccessPurchase()`.
- `cart.js` renders the cart by first calling `/viewcart` (returns the item list), then one `/view` call *per item*. The DOM row count and the running `total` are both updated inside that same per-item callback, so the only reliable "cart finished loading" signal is: read `/viewcart`'s response body for the expected item count, then `expect(rows).toHaveCount(expectedCount)`. This is implemented once in `CartPage.waitForCartLoad()` and duplicated in `regression.spec.ts`'s `gotoCartAndWaitLoaded()` (that file intentionally doesn't import from `pages/`, so it needed its own copy).
- Bootstrap 4's modal fade animation means `waitFor({state: 'visible'})` can resolve while the modal is still mid-transition and silently ignoring input. `closeLoginModalByBackdrop()` and `waitForLoginModalReady()` poll the actual jQuery modal instance state (`_isShown && !_isTransitioning`) instead of sleeping a guessed duration.

Every `page.waitForTimeout()` in `login.spec.ts`'s and `cart.spec.ts`'s support code, and in `regression.spec.ts`, has been replaced with one of the waits above. `performance.spec.ts` still uses fixed delays to pace simulated concurrent requests - that's a legitimate use (deliberate think-time), not a synchronization workaround.

### Data isolation

`login.spec.ts` and `cart.spec.ts` each register a `user_<timestamp>` / `cart_user_<timestamp>` account via the signup API in `beforeAll`, so parallel runs and repeated CI runs never collide on the same account. This matters specifically on Demoblaze because **the cart is tied to the account/guest-cookie, not the browser session** - reusing a shared login across parallel workers would mean tests stomping on each other's cart contents (see DEF-SYS-001 below for what happens when that guest identity is missing entirely).

### Cross-browser

`playwright.config.ts` now runs Login/Cart across Chromium, Firefox, and WebKit. `regression.spec.ts`'s `login()` helper already retries up to 3 times because WebKit intermittently submits the login form while the Bootstrap modal is still fading - that's a real cross-browser timing difference, not a flaky test masked with retries.

## How to run

```bash
npm ci
npx playwright install --with-deps        # or: chromium firefox webkit

npm test                 # everything, all 3 browsers
npm run test:ui          # login.spec.ts + cart.spec.ts only
npm run test:api         # API-level checks, no browser
npm run test:regression  # independent smoke pass
npm run test:demo        # the login -> cart -> order demo
npm run test:perf        # response-time checks, Chromium only, sequential
npm run test:chromium    # any of the above, restricted to one browser
npm run test:headed      # see the browser

npm run test:manual-suite   # all 5 suites via playwright.manual.config.ts, archives the previous run, writes reports/test-results/latest/results.json
npm run sync:all            # sync:tc-sheet + sync:defects in sequence - run this after every test:manual-suite
npm run sync:tc-sheet       # reads that results.json and fills Actual Result / Status in inputdata/Demoblaze_QA_TestCases.xlsx (backs up the xlsx first)
npm run sync:defects        # (re)builds the Defect sheet in the xlsx, cross-referencing each defect's related TC IDs against their current Status

npm run report            # open the last HTML report
```

`scripts/README.md` documents each script in more detail; `docs/PERFORMANCE_TESTING.md` and `docs/REGRESSION_TESTING.md` document those two suites specifically.

## CI/CD

`.github/workflows/playwright.yml` runs on push/PR to `main`/`develop`: installs dependencies and all 3 browsers, runs Login, Cart, and API suites, uploads the HTML report as a build artifact, and archives results under `reports/test-results/`. CI no longer swallows failures - `continue-on-error` was removed from the Login/Cart steps, so a real regression fails the build instead of being silently logged.

## Defects found

Found while building and running the suite against the live site, not synthetic examples. This table is a summary - the authoritative, always-current version is the **Defect sheet in `inputdata/Demoblaze_QA_TestCases.xlsx`**, which cross-references each defect against the live Status of its related TC IDs (rebuilt by `scripts/build_defect_sheet.py`, see below). Full write-ups with reproduction steps are in `reports/test-cases/`.

| ID | Area | Description | Severity |
|---|---|---|---|
| DEF-SYS-001 | Cart / guest identity | The guest-cart cookie (`user=<uuid>`) is only set by `index.js` on the homepage. Arriving via a direct/bookmarked product link (`prod.html?idp_=1`) never sets it, so `/viewcart` is called with an empty cookie and the API returns the **shared bucket used by every cookie-less guest on demoblaze.com** - not an empty cart. Verified growing over time from unrelated traffic: 168 items -> 589 items (next day) -> 720 items (day after). This is a live data leak between unrelated guest sessions, not stale test data - though see the limitation below about the latest automated run not reproducing it. See `reports/test-cases/TC-CRT-046-definition.md`. | Critical |
| DEF-001 | Checkout | `/purchaseorder`'s card field has no validation at all: non-numeric input, spaces, wrong length (13-19 expected), and failing Luhn checksums are all accepted and the order still succeeds. | Critical |
| DEF-002 | Checkout | Expiry month is never validated - `0`, `13`, and non-numeric values are all accepted. | High |
| DEF-003 | Checkout | Expiry year is never validated - already-expired years, 2-digit years, and non-numeric values are all accepted. | High |
| DEF-004 | Checkout | An empty cart can still be "placed" as an order, producing a 0 USD order ID. | Medium |
| DEF-005 | Checkout | The Place Order modal's Purchase button stays visible and clickable behind the SweetAlert success popup, so a second click while the confirmation is showing can plausibly fire a duplicate order. | Medium |
| DEF-006 | Checkout | The invoice date is off by one month on every single order (`purchaseOrder()` uses `date.getMonth()` without `+1`) - present in every passing checkout test today; nothing currently asserts on it. | Low |
| DEF-API-002 | API / `/login` | Wrong password, empty username, empty password, and SQL-injection-shaped input (`' OR '1'='1`) are all expected to return 401/400 with a structured error, but none are rejected. | Critical |
| DEF-API-003 | API / cart endpoints | `/viewcart`, `/addtocart`, `/deleteitem` enforce no auth/ownership or input validation - empty/missing cookie, invalid product ID, flag=false, deleting a non-existent item all return 200 instead of 400/401/404. | Critical |
| DEF-API-004 | API / `/view` | Product details endpoint doesn't validate the product ID - non-existent ID, missing `idp_`, and `idp_=0` all return 200 instead of 400/404. | High |
| DEF-API-005 | API / `/purchaseorder` | Same lack of validation as DEF-001/002/003/004, confirmed at the API layer directly: invalid card/month/year, missing required fields, and empty cart all return 200 with an order ID instead of 400. | Critical |
| DEF-API-006 | API / config.json | `config.json` is expected to 404 (shouldn't be public) but is reachable and returns 200 - minor information-disclosure finding, different risk profile from the validation defects above. | Low |
| DEF-TEST-001 | Test infrastructure (not an app defect) | The 13 automated cases for DEF-001/002/003/004 were hanging for ~96-100s each (waiting on a validation alert that never fires) instead of failing in seconds. Fixed. | Low |
| DEF-TEST-002 | Test infrastructure (not an app defect) | 4 API happy-path tests (`API-CART-001`, `API-ADD-002`, `API-DEL-004`, `API-PROD-001`) asserted a response shape/value the app never actually returns (a made-up `{status, data:{items}}` wrapper for `/viewcart` instead of the real `{Items:[...]}`, and `'Samsung Galaxy S6'` instead of the real `'Samsung galaxy s6'`) - test-authoring bugs, not app defects. Fixed in `tests/api.spec.ts`. | Low |

14 defects total: 12 confirmed application defects, 2 test-script bugs caught and fixed during this work (see the Summary sheet's new "Defect Summary" block for the live count, and `DEF-API-001` in the Defect sheet's history if you're diffing against an earlier version of this file - it was the original lumped entry, now split into DEF-API-002..006 above for accurate TC-to-defect mapping).

## Known limitations & next steps

- **TC-CRT-046 (guest cart leak) is flaky by nature, not by test design.** It failed as expected (bug reproduced) in the 2026-08-01 07:45 UTC run, but had unexpectedly passed in an earlier run that same day. DEF-SYS-001 depends on other anonymous guests' live traffic filling the shared bucket at that exact moment, so a clean 1-item cart is possible by chance - this is expected variance in a defect this shape, not evidence the bug comes and goes. Treat a Pass here as inconclusive, not as "fixed".
- ~~The card/month/year negative cases (DEF-001/002/003/004) were hanging for ~96-100s instead of failing fast.~~ - fixed: `CartPage.clickPurchaseExpectingAlertOrAccept()` races the alert against the SweetAlert success popup with an 8s bound instead of waiting indefinitely for a validation alert Demoblaze never shows. Confirmed fast in the 2026-08-01 07:45 UTC run.
- ~~TC-LOG-015/016/017 (empty username/password) hung to the full test timeout instead of failing fast.~~ - fixed: `logIn()`'s alert for empty fields fires **synchronously** inside the click handler (unlike the wrong-password/unknown-user path, which fires async from the auth API callback), so registering a `waitForEvent('dialog')` listener deadlocked `click()` against the blocked main thread. `LoginPage.login()` now accepts the dialog inside a `page.once('dialog', ...)` handler to release the main thread immediately. Verified with `tsc --noEmit`; needs one clean `test:manual-suite` run to confirm all three now pass (fresh run in progress at time of writing).
- ~~Cross-browser is configured, not yet proven stable (WebKit needed the retry-on-submit workaround from `regression.spec.ts` ported to `LoginPage`).~~ - addressed at the root instead of porting the retry loop as-is: `LoginPage.openLoginPopup()` now waits for Bootstrap's modal to be fully shown (`_isShown===true && _isTransitioning===false`, the same internal flag `regression.spec.ts`'s `waitForLoginModalReady()` polls) before returning, instead of just waiting for `display:block`. This fixes the "click lost during fade" flakiness at its source rather than masking it with blind retries, which would have been the wrong semantics for the intentional-failure login tests anyway. Still needs a green 3-browser CI run to fully confirm.
- **`performance.spec.ts` is a response-time smoke check, not a load test.** It measures single-session round-trip latency (with some artificial pacing for realism), not concurrent virtual users. Real load/stress testing against demoblaze.com would need a tool built for it (k6, JMeter, Gatling) rather than a browser-driven approach.
- **The xlsx Status column now uses proper Pass/Fail/Flaky/Skipped values**, synced via `sync_test_results_to_xlsx.py` (an earlier version wrote Playwright's internal `expected`/`unexpected` vocabulary straight into the Status column - fixed). Run `npm run test:manual-suite && npm run sync:all` after any test/page-object change to keep the xlsx and Defect sheet current - `sync:all` runs the results sync and the Defect sheet rebuild together.
- ~~`docs/REGRESSION_TESTING.md` is stale relative to the current `regression.spec.ts`~~ - fixed: regenerated against the actual 13 regression tests + 2 performance markers, correct test data (`TMA`/`tma@12345`, Samsung galaxy s6/Nokia lumia 1520), and descriptions for REG-INT-003/004 which the old doc didn't mention at all.
- ~~`pages/CartPage.ts` has an encoding artifact~~ - fixed: the file had been saved through a UTF-8 BOM plus a double mojibake round-trip (UTF-8 bytes misread as Windows-1252 and re-saved as UTF-8, twice) that mangled every Vietnamese comment. Restored with `ftfy` and one manual correction it missed, verified against `tsc --noEmit` (no new errors) - logic untouched, comments only.
- ~~`reports/test-results/` was accumulating ~200MB+ of videos/screenshots/traces per run as untracked files, never actually excluded despite `reports/README.md` documenting that they should be~~ - fixed: `reports/.gitignore` now excludes the whole `html-report/` directory (regenerable any time via `npx playwright show-report <dir>`) under both `latest/` and `archive/**`, while still tracking `results.json` - the actual machine-readable evidence the xlsx sync and Defect sheet are built from.
- **No test data factory.** Test data (users, cards, product names) is mostly inline literals rather than a shared faker-based generator; fine at this suite's size, would need revisiting if the suite grows significantly.
