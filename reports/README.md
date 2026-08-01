# reports/

## test-results/

`latest/` holds the most recent local `npm run test:manual-suite` run: `results.json` (the Playwright JSON reporter output - what `scripts/sync_test_results_to_xlsx.py` and `scripts/build_defect_sheet.py` both read) plus an `html-report/` (not committed - see `reports/.gitignore`, regenerable any time via `npx playwright show-report reports/test-results/latest/html-report`).

`archive/{YYYY-MM-DD}-run-{NNN}/` holds every previous run's `results.json`, moved there automatically by `scripts/archive-run.js` before each new run starts, so past evidence is never overwritten.

This is a local workflow, not a CI-managed one: the GitHub Actions workflow (`.github/workflows/playwright.yml`) runs `demo.spec.ts` + `login.spec.ts` and uploads the HTML report as a downloadable build artifact - it does not write anything back into this folder.

## Everything else

`inputdata/Demoblaze_QA_TestCases.xlsx` (repo root's `inputdata/`, not under `reports/`) is the actual test case matrix and Defect sheet - see the main `README.md`.
