# Test Results & Reports

Auto-managed folder for Playwright test execution results.

> **2026-08-01 update:** the CI-driven flow described below was designed but
> never actually wired up locally - `latest/` and `archive/` were empty, and
> the CI job never commits results back to the repo, so nothing here ever
> got real, dated evidence. That's now fixed for local runs:
>
> ```bash
> npm run test:manual-suite   # archives the previous latest/, runs login+cart+api,
>                              # writes reports/test-results/latest/results.json (real JSON, not a placeholder)
> npm run sync:tc-sheet        # reads that JSON and fills Actual Result/Status in
>                              # inputdata/Demoblaze_QA_TestCases.xlsx (backs up the xlsx first)
> ```
>
> See `scripts/archive-run.js`, `playwright.manual.config.ts`, and
> `scripts/sync_test_results_to_xlsx.py`.

## Structure

```
test-results/
├── latest/              (Current run results)
│   ├── login-report.html
│   ├── cart-report.html
│   ├── api-report.html
│   └── summary.json
│
└── archive/             (Historical runs)
    ├── 2026-07-31-run-001/
    ├── 2026-07-31-run-002/
    └── ...
```

## Latest Run

After each CI run:
- GitHub Actions downloads Playwright HTML reports
- Artifacts saved to `/latest/` (overwrites previous)
- Previous run archived to `/archive/{date}-run-{N}/`

**View latest results:**
```bash
open test-results/latest/cart-report.html
```

## Archive

Historical runs kept for:
- Trend analysis (pass/fail rates over time)
- Regression detection
- Performance baseline comparison

**Keep:** Latest 5 runs (configurable)
**Auto-cleanup:** Runs older than 30 days

## Report Contents

### HTML Reports
- Browser: Open with `npx playwright show-report`
- Shows: Test status, timing, errors, screenshots, traces
- Filterable by: Suite, status, tag

### summary.json
```json
{
  "timestamp": "2026-07-31T17:00:00Z",
  "total": 44,
  "passed": 30,
  "failed": 12,
  "skipped": 2,
  "duration_ms": 1250000,
  "suites": {
    "login": { "passed": 6, "failed": 0, "skipped": 0 },
    "cart": { "passed": 22, "failed": 12, "skipped": 2 },
    "api": { "passed": 2, "failed": 0, "skipped": 0 }
  }
}
```

## CI/CD Automation

**Workflow Step (playwright.yml):**
```yaml
- name: Archive previous run
  if: always()
  run: |
    if [ -d test-results/latest ]; then
      mkdir -p test-results/archive/$(date +%Y-%m-%d)-run-${{ github.run_number }}
      mv test-results/latest/* test-results/archive/...
    fi

- name: Save latest results
  if: always()
  run: |
    mkdir -p test-results/latest
    cp -r playwright-report/* test-results/latest/
    # Generate summary.json from test results
```

## Local Testing

After `npm test`:
```bash
# View in browser
npx playwright show-report

# Copy to latest if significant
cp -r playwright-report/* reports/test-results/latest/
git add reports/test-results/latest/
git commit -m "test: Local run results"
```

## Gitignore

```gitignore
# Large test artifacts
/reports/test-results/latest/*.zip
/reports/test-results/archive/**/*.zip
# Only commit summary.json + HTML reports
```

---

**Note:** Do NOT manually edit this folder. CI automation manages archival & cleanup.
