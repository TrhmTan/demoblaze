# Demoblaze Automation — Login → Cart → Order

Playwright + TypeScript automation for [demoblaze.com](https://www.demoblaze.com), built for the take-home challenge: *"Create a basic automation demo covering (1) logging in with valid credentials and (2) adding to cart then placing an order, with validations for both typical and edge case scenarios."*

`tests/demo.spec.ts` is the direct answer to that brief. Everything else in this repo (API validation, a regression suite, performance checks, a full manual test case matrix, CI) is additional coverage built on top of it - kept in the same repo because it exercises the same page objects, but clearly separated below so the core deliverable isn't buried in it.

Author: Trần Huỳnh Minh Tân

## Contents

- [Run the demo](#run-the-demo)
- [What the demo covers](#what-the-demo-covers)
- [Framework structure & rationale](#framework-structure--rationale)
- [Beyond the brief](#beyond-the-brief-additional-coverage-in-this-repo)
- [Defects found](#defects-found)
- [Known limitations](#known-limitations)

## Run the demo

```bash
npm ci
npx playwright install --with-deps        # or just: chromium

npm run test:demo                         # the login -> cart -> order demo
npm run report                            # open the HTML report for the last run
```

`test:demo` runs `tests/demo.spec.ts` across Chromium, Firefox, and WebKit (configured in `playwright.config.ts`). To run it against one browser only: `npx playwright test tests/demo.spec.ts --project=Chromium`.

## What the demo covers

| Test | Scenario | Type |
|---|---|---|
| `DEMO-001` | Login with valid credentials -> add a product to cart -> place an order -> verify the invoice (order ID, name, amount, card, date) | Happy path |
| `DEMO-002` | Submit the order form with the Name field empty | Edge case - validation |
| `DEMO-003` | Submit the order form with the Card field empty | Edge case - validation |
| `DEMO-004` | Login session stays valid through cart and checkout, end to end | Integration |
| `DIAG-001` | Times the full login-to-invoice flow and asserts it completes under a threshold | Bonus - diagnostic |

## Framework structure & rationale

```
pages/                       Page Object Model - LoginPage, CartPage
tests/
  demo.spec.ts                  <- the challenge's demo (see above)
  login.spec.ts, cart.spec.ts   Broader Login/Cart regression coverage (21 + 48 cases)
  api.spec.ts                   API-level checks, no browser (40 cases)
  regression.spec.ts            Independent smoke pass, doesn't import pages/
  performance.spec.ts           Response-time smoke checks
playwright.config.ts          Chromium/Firefox/WebKit, used by test:demo and test:ui
playwright.perf.config.ts     Single browser, sequential, longer timeout
playwright.manual.config.ts   Runs all 5 suites, JSON reporter feeds the xlsx sync
scripts/                      archive-run.js, sync_test_results_to_xlsx.py, build_defect_sheet.py
docs/                         PERFORMANCE_TESTING.md, REGRESSION_TESTING.md
inputdata/Demoblaze_QA_TestCases.xlsx   Manual test case matrix + Defect sheet
.github/workflows/playwright.yml        CI: 3 browsers, demo + Login regression, HTML report artifact
```

**Page Object Model, not a shared `BaseTest`.** `LoginPage` and `CartPage` own the locators and the interaction logic that's genuinely tricky on this site - racing a native `alert()` against the welcome banner, polling Bootstrap's internal modal state before touching it, reading `/viewcart` to know how many rows to expect. Tests stay declarative (`cartPage.addProductToCart(...)`, `cartPage.placeOrderAndGetInvoice(...)`). Composition (a fresh POM instance per test) was chosen over an inheritance-based `BaseTest` so each test's dependencies stay explicit instead of inheriting a growing grab-bag of helpers.

**Deterministic waits, not `waitForTimeout`.** Demoblaze's own client code is the actual source of truth for timing, so the framework reads its signals instead of sleeping a guessed duration:

- Adding an item fires a native `window.alert()` asynchronously from the `/addtocart` callback - not synchronously with the click - so both `LoginPage.login()` and `CartPage.addProductToCart()` register the dialog listener before clicking and race it against the next real signal.
- Order confirmation is a SweetAlert DOM popup, a different mechanism from the native dialogs used elsewhere, handled separately in `CartPage.confirmSuccessPurchase()`.
- The cart page loads by calling `/viewcart` then one `/view` per item; the only reliable "finished loading" signal is reading `/viewcart`'s item count and asserting the DOM row count matches it (`CartPage.waitForCartLoad()`).
- Bootstrap's modal fade means `waitFor({state: 'visible'})` can resolve mid-transition, while the modal still ignores input. `LoginPage.openLoginPopup()` polls the real modal instance state (`_isShown && !_isTransitioning`) instead.

**Data isolation.** `login.spec.ts`/`cart.spec.ts` each register a timestamped account in `beforeAll`, because the cart is tied to the account/guest-cookie rather than the browser session - a shared login across parallel workers would mean tests stomping on each other's cart contents.

**Cross-browser.** Chromium, Firefox, and WebKit are all configured. WebKit needed one specific fix: it can submit the login form while the Bootstrap modal is still fading, so `LoginPage.openLoginPopup()` waits for the modal's internal "fully shown" flag rather than just its CSS visibility.

## Beyond the brief: additional coverage in this repo

The brief asks for a demo of one flow. To show what a fuller test effort around this site looks like, the repo also includes:

- **API-level validation** (`tests/api.spec.ts`, 40 cases) - hits `/login`, `/viewcart`, `/addtocart`, `/deleteitem`, `/view`, `/purchaseorder` directly, no browser. This is where most of the defects below were found.
- **A regression suite** (`tests/regression.spec.ts`) - an independent smoke pass that doesn't import from `pages/`, for a second, differently-implemented check on the same flows. See `docs/REGRESSION_TESTING.md`.
- **Performance smoke checks** (`tests/performance.spec.ts`) - single-session response-time measurements, not a load test. See `docs/PERFORMANCE_TESTING.md`.
- **A manual test case matrix** (`inputdata/Demoblaze_QA_TestCases.xlsx`) - Login/Cart/API sheets with Actual Result and Status columns synced from real automated runs (`npm run sync:all`), a live Summary dashboard, and a Defect sheet cross-referencing every defect against the current Status of its related test cases.
- **CI** (`.github/workflows/playwright.yml`) - installs all 3 browsers and runs `demo.spec.ts` + `login.spec.ts` on every push/PR (both 100% passing suites), publishing the HTML report as a build artifact. Cart and API are intentionally not in CI: 14 of Cart's cases and most of API's are `expect()` assertions that fail on purpose to confirm real app defects (see below) - a red CI badge from those would misread as broken automation rather than working automation finding real bugs. They still run locally via `npm run test:manual-suite` and feed the Defect sheet.

Full script usage is documented in `scripts/README.md`.

## Defects found

Found by running the suites above against the live site - not synthetic examples. Full detail with reproduction steps and live TC cross-references: **Defect sheet in `inputdata/Demoblaze_QA_TestCases.xlsx`** (rebuilt by `npm run sync:defects`).

**Found via the demo/cart flow directly** (7 defects) - i.e., the exact kind of edge case the brief asks the demo to handle:

| ID | Description | Severity |
|---|---|---|
| DEF-001 | Checkout accepts a card number with no validation at all - non-numeric, wrong length, failing Luhn checksum all succeed. | Critical |
| DEF-002 / DEF-003 | Expiry month and year are never validated - `0`, `13`, already-expired years, non-numeric values are all accepted. | High |
| DEF-004 | An empty cart can still be "placed" as an order (0 USD). | Medium |
| DEF-005 | The Purchase button stays clickable behind the success popup - a second click can plausibly duplicate an order. | Medium |
| DEF-006 | The invoice date is off by one month on every order (`date.getMonth()` used without `+1`). | Low |
| DEF-SYS-001 | The guest-cart cookie is only set by the homepage script; arriving via a direct product link skips it, and `/viewcart` then returns a bucket shared by every cookie-less guest on the live site - not an empty cart. | Critical |

**Found via the additional API-level testing** (6 defects): `/login`, `/viewcart`, `/addtocart`, `/deleteitem`, `/view`, and `/purchaseorder` accept almost any malformed or invalid input with HTTP 200 instead of 400/401/404 (Critical/High, `DEF-API-002` through `DEF-API-005`); `/addtocart` silently drops items added under a cookie the API invented itself instead of rejecting the request (`DEF-API-007`, High); and `config.json` is publicly reachable when it shouldn't be (`DEF-API-006`, Low).

**Test-authoring issues caught while building the API suite** (3 findings - not app defects, not counted in the totals above): the test script asserted a response shape the real API never returned (`DEF-TEST-002` - fixed, confirmed passing against the live API); a request sent the product ID under the wrong field name (`DEF-TEST-004` - fix applied based on the documented API contract, but not yet re-run against the live site to confirm); and 13 checkout test cases were timing out instead of failing fast, a test-code issue unrelated to app behavior (`DEF-TEST-001` - fixed). Kept in the Defect sheet for a transparent record of what got caught and corrected, not because they reflect anything wrong with demoblaze.com.

**16 entries in the Defect sheet total: 7 (demo/cart) + 6 (API) = 13 confirmed application defects, plus the 3 test-authoring findings above.**

## Known limitations

- `performance.spec.ts` measures single-session response time, not concurrent load - a real load test would need k6/JMeter/Gatling rather than a browser-driven approach.
- `DEF-SYS-001` (shared guest-cart bucket) depends on other anonymous users' live traffic at the moment the test runs, so it can occasionally pass by chance even though the underlying defect is real; treat a Pass there as inconclusive rather than "fixed."
- No shared test-data factory - users/cards/product names are mostly inline literals. Fine at this suite's size, would need a faker-based generator if it grows significantly.
- Cross-browser is configured and passing in the runs behind this submission, but hasn't had a long soak test across all 3 engines in CI yet.
