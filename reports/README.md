# Test Reports Structure

Organized test documentation, results, and metrics for Demoblaze QA project.

## Folder Organization

### `/test-cases` — Test Case Management
- **Demoblaze_QA_TestCases.xlsx** — Master test case document (Login, Cart, API sheets)
- **API-Validation-Plan.md** — API validation strategy & coverage analysis
- **TC-* .csv, .md** — Test case definitions & analysis
- **Implementation-checklist-* , cart-failure-analysis.md** — Supporting documentation

**Usage:** Manual test case review, TC updates, defect mapping

---

### `/test-results` — Test Execution Results
- **`/latest`** — Most recent test run (login, cart, api HTML reports + summary.json)
- **`/archive`** — Historical runs (organized by date: `YYYY-MM-DD-run-NNN/`)

**Auto-managed by:** GitHub Actions CI (downloads artifacts after each run)

**Cleanup:** Keeps latest 5 runs, archives older results for trend analysis

**Usage:** 
- Review latest failures: `open test-results/latest/cart-report.html`
- Compare performance over time: `test-results/archive/`

---

### `/coverage` — Code Coverage Reports
- Future: Coverage reports from Playwright/Istanbul
- Format: HTML report + metrics.json

**Usage:** Track code coverage trends, identify untested paths

---

### `/performance` — Performance & Load Testing
- Benchmark results, response times, load test data
- Format: JSON, CSV, or HTML dashboards

**Usage:** SLA validation, performance regression detection

---

## File Naming Conventions

### Test Results
```
{suite}-report.html           # Playwright HTML report (login-report.html)
summary.json                  # Aggregated results (status, counts, timing)
{suite}-trace-{timestamp}.zip # Playwright traces (for debugging)
```

### Archive Runs
```
test-results/archive/{YYYY-MM-DD}-run-{NNN}/
├── login-report.html
├── cart-report.html
├── api-report.html
├── summary.json
└── traces.zip
```

---

## CI/CD Integration

**GitHub Actions Workflow:**
1. Run Playwright tests (login.spec.ts → cart.spec.ts → api.spec.ts)
2. Generate HTML reports
3. Upload artifacts (30-day retention)
4. Download artifacts locally → save to `/test-results/latest/`
5. Archive previous run → `/test-results/archive/{date}-run-{N}/`
6. Keep latest 5, delete older

**Local Workflow:**
```bash
npm test                    # Run all suites
# Results appear in:
# playwright-report/         (browser: npx playwright show-report)
# → manually copy to test-results/latest/ when significant
```

---

## Usage Examples

### View latest test results
```bash
# Open HTML reports
open reports/test-results/latest/cart-report.html
open reports/test-results/latest/login-report.html

# Check summary
cat reports/test-results/latest/summary.json
```

### Compare two runs
```bash
# Run 001 vs. Run 005
diff reports/test-results/archive/2026-07-31-run-001/summary.json \
     reports/test-results/archive/2026-07-31-run-005/summary.json
```

### Add new metric
Just drop files into appropriate folder:
- New suite? → `test-results/latest/{suite}-report.html`
- Coverage? → `coverage/index.html`
- Perf benchmark? → `performance/benchmark-YYYY-MM-DD.json`

---

## Best Practices

✅ **DO:**
- Keep test-cases/ for all TC documentation (source of truth)
- Auto-archive results from CI (timestamp all runs)
- Regular cleanup of old archives (>30 days)
- Document defect mappings in TC sheets

❌ **DON'T:**
- Manual edits to test-results/ (auto-managed by CI)
- Commit large HTML/trace files (use .gitignore)
- Hardcode report paths (use env vars or scripts)

---

## Next Steps

1. Update `.gitignore` to exclude large reports
2. Setup GitHub Actions to auto-manage test-results/
3. Add performance baseline tracking
4. Create report dashboard (trend analysis)
