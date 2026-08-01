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
npm run sync:tc-sheet       # reads that results.json and fills Actual Result / Status in inputdata/Demoblaze_QA_TestCases.xlsx (backs up the xlsx first)

npm run report            # open the last HTML report
```

`scripts/README.md` documents each script in more detail; `docs/PERFORMANCE_TESTING.md` and `docs/REGRESSION_TESTING.md` document those two suites specifically.

## CI/CD

`.github/workflows/playwright.yml` runs on push/PR to `main`/`develop`: installs dependencies and all 3 browsers, runs Login, Cart, and API suites, uploads the HTML report as a build artifact, and archives results under `reports/test-results/`. CI no longer swallows failures - `continue-on-error` was removed from the Login/Cart steps, so a real regression fails the build instead of being silently logged.

## Defects found

Found while building and running the suite against the live site, not synthetic examples. Full write-ups with reproduction steps are in `reports/test-cases/`.

| ID | Area | Description | Severity |
|---|---|---|---|
| DEF-SYS-001 | Cart / guest identity | The guest-cart cookie (`user=<uuid>`) is only set by `index.js` on the homepage. Arriving via a direct/bookmarked product link (`prod.html?idp_=1`) never sets it, so `/viewcart` is called with an empty cookie and the API returns the **shared bucket used by every cookie-less guest on demoblaze.com** - not an empty cart. Verified growing over time from unrelated traffic: 168 items -> 589 items (next day) -> 720 items (day after). This is a live data leak between unrelated guest sessions, not stale test data. See `reports/test-cases/TC-CRT-046-definition.md`. | Critical |
| DEF-001 | Checkout | `/purchaseorder`'s card field has no validation at all: non-numeric input, spaces, wrong length (13-19 expected), and failing Luhn checksums are all accepted and the order still succeeds. | Critical |
| DEF-002 | Checkout | Expiry month is never validated - `0`, `13`, and non-numeric values are all accepted. | High |
| DEF-003 | Checkout | Expiry year is never validated - already-expired years, 2-digit years, and non-numeric values are all accepted. | High |
| DEF-004 | Checkout | An empty cart can still be "placed" as an order, producing a 0 USD order ID. | Medium |
| DEF-005 | Checkout | The Place Order modal's Purchase button stays visible and clickable behind the SweetAlert success popup, so a second click while the confirmation is showing can plausibly fire a duplicate order. | Medium |
| (unfiled) | Checkout | The invoice date is off by one month on every single order (`purchaseOrder()` uses `date.getMonth()` without `+1`) - present in every passing checkout test today; nothing currently asserts on it. | Low |
| (see docs/api-analysis) | API layer | `/login`, `/purchaseorder`, `/viewcart`, `/addtocart`, `/deleteitem` return HTTP 200 for almost every malformed or invalid request instead of 400/401/404 - no input validation, no auth enforcement at the API layer. Documented separately in `docs/api-analysis/BUG_REPORT_API_FAILURES.md` with the full request/response matrix. | Critical (API contract) |

## Known limitations & next steps

- **Card/month/year negative cases are still permissive.** `cart.spec.ts` (TC-CRT-020, 026-038) currently asserts the *actual* (buggy) accept-everything behavior, so the suite documents DEF-001/002/003 without failing on them. `reports/test-cases/financial-validation-rules-and-case-redefinition.md` already specifies the correct reject-based assertions; redefining those ~16 cases to actually fail against the real financial rules is the single highest-value next step, and hasn't been done yet.
- **Cross-browser is configured, not yet proven stable.** Firefox and WebKit were only just added to `playwright.config.ts`. WebKit is known to need the retry-on-submit workaround already present in `regression.spec.ts`; that workaround hasn't been ported to `LoginPage`/`login.spec.ts` yet, so a full 3-browser CI run may need another pass to be green everywhere.
- **`performance.spec.ts` is a response-time smoke check, not a load test.** It measures single-session round-trip latency (with some artificial pacing for realism), not concurrent virtual users. Real load/stress testing against demoblaze.com would need a tool built for it (k6, JMeter, Gatling) rather than a browser-driven approach.
- **The xlsx sync pipeline (`test:manual-suite` + `sync:tc-sheet`) hasn't been run end-to-end and committed with real results yet.** The scripts exist and are documented, but `inputdata/Demoblaze_QA_TestCases.xlsx`'s Actual Result/Status columns aren't yet backed by a fresh, verified run.
- **`docs/REGRESSION_TESTING.md` is stale** relative to the current `regression.spec.ts` (test count and test data have both since changed) - needs regenerating, not hand-editing.
- **`pages/CartPage.ts` has an encoding artifact** (a UTF-8 BOM plus some mis-encoded Vietnamese comments) inherited from an earlier save - cosmetic, doesn't affect execution, not yet cleaned up.
- **No test data factory.** Test data (users, cards, product names) is mostly inline literals rather than a shared faker-based generator; fine at this suite's size, would need revisiting if the suite grows significantly.
