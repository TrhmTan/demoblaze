# Test Scripts & Utilities

Automation scripts for test execution, reporting, and management.

## Scripts

### `archive-run.js`
**Purpose:** Archive the previous test run before overwriting `latest/`

**What it does:**
- Checks if `reports/test-results/latest/results.json` exists (from previous run)
- If found, moves `latest/` → `archive/{YYYY-MM-DD}-run-{N}/`
- Recreates empty `latest/` folder for new run

**Usage:**
```bash
node scripts/archive-run.js
```

**Auto-run:** `npm run test:manual-suite` calls this automatically before running tests

**Why:** Ensures each test run's evidence is timestamped and never overwritten

---

### `sync_test_results_to_xlsx.py`
**Purpose:** Sync automated test results (JSON) → Manual test case spreadsheet (xlsx)

**What it does:**
1. Reads `reports/test-results/latest/results.json` (from latest test run)
2. Matches test titles to TC IDs (TC-LOG-*, TC-CRT-*, API-*)
3. Fills "Actual Result" column = test status + duration + error (if failed)
4. Fills "Status" column = Pass / Fail / Skipped
5. For duplicate TC IDs: uses [DEF-xxx] version as canonical, notes the old one
6. Backs up xlsx before writing: `Demoblaze_QA_TestCases.backup-{timestamp}.xlsx`

**Usage:**
```bash
python3 scripts/sync_test_results_to_xlsx.py
# Or with custom paths:
python3 scripts/sync_test_results_to_xlsx.py \
  --results reports/test-results/latest/results.json \
  --xlsx inputdata/Demoblaze_QA_TestCases.xlsx
```

**Note:** Requires `pip install openpyxl` (or `pip install openpyxl --break-system-packages`)

**Auto-run:** `npm run sync:tc-sheet` (aliased in package.json)

---

### `build_defect_sheet.py`
**Purpose:** Add/rebuild the "Defect" sheet in the manual xlsx

**What it does:**
1. Reads a curated list of known defects (ID, title, severity, root cause) from the top of the script
2. For each defect's related TC IDs, looks up their *current* Status from the Login/Cart/API sheets (whatever `sync_test_results_to_xlsx.py` last wrote there)
3. Fully replaces the "Defect" sheet with this data - safe to re-run after editing the `DEFECTS` list or after a fresh `sync_test_results_to_xlsx.py` run
4. Backs up the xlsx first, same as the sync script

**Usage:**
```bash
python3 scripts/build_defect_sheet.py
```

**Why it looks up Status live instead of hardcoding it:** so the Defect sheet's "Automation Evidence" column can never silently drift out of sync with the Login/Cart/API sheets - re-running it after a new test run always reflects the latest reality.

---

### `manage-reports.sh`
**Purpose:** Cleanup and organize test result archives

**What it does:**
- Deletes old trace files (30+ days)
- Keeps only latest 5 runs in archive
- Generates summary.json for latest run

**Usage:**
```bash
./scripts/manage-reports.sh
```

**Auto-run:** Can be added to GitHub Actions or scheduled via cron

---

### `view-report.sh`
**Purpose:** Open test reports in browser

**Usage:**
```bash
# View latest report
./scripts/view-report.sh latest
./scripts/view-report.sh        # Same as above

# List archived runs
./scripts/view-report.sh archive

# View specific archived run (example)
./scripts/view-report.sh archive/2026-07-31-run-001
```

---

## Integration with CI/CD

**GitHub Actions calls these automatically:**
1. `manage-reports.sh` — After archiving latest run
2. Summaries updated in `reports/test-results/latest/summary.json`

**Local usage:**
```bash
npm test
# Then:
./scripts/manage-reports.sh
./scripts/view-report.sh latest
```

---

## Directory Layout

```
scripts/
├── archive-run.js                    # Archive previous "latest" → "archive/{date}-run-N"
├── sync_test_results_to_xlsx.py      # Parse JSON results → fill xlsx
├── manage-reports.sh                 # Old: cleanup old trace files
├── view-report.sh                    # Old: open reports in browser
└── README.md                         # This file
```

---

## Next Steps

Add more scripts as needed:
- `generate-trends.sh` — Performance trend analysis
- `compare-runs.sh` — Compare two test runs
- `export-metrics.sh` — Export to spreadsheet/dashboard
