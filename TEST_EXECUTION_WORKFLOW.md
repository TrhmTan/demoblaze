# Test Execution Workflow

Hướng dẫn chạy tất cả 5 automated test suites và lưu evidence với timestamp.

## Quick Start

```bash
# 1. Chạy tất cả 5 suites (login, cart, api, regression, performance)
#    - Tự động archive lần chạy trước
#    - Output: reports/test-results/latest/results.json + HTML report
npm run test:manual-suite

# 2. Điền kết quả login/cart/api vào inputdata/Demoblaze_QA_TestCases.xlsx
#    - Regression + Performance results chỉ lưu trong JSON (không có TC ID để map)
#    - Backup xlsx cũ được tạo tự động
npm run sync:tc-sheet

# 3. Xem chi tiết (tùy chọn)
npx playwright show-report reports/test-results/latest/html-report
```

---

## Cấu trúc kết quả

```
reports/test-results/
├── latest/
│   ├── results.json                  ← JSON report (machine-readable)
│   │   ├── Login test results
│   │   ├── Cart test results
│   │   ├── API test results
│   │   ├── Regression test results
│   │   └── Performance test results
│   └── html-report/
│       └── index.html                ← HTML report (browser view)
│
└── archive/
    ├── 2026-08-01-run-001/           ← Lần chạy trước (auto-archived)
    ├── 2026-08-01-run-002/
    └── ...
```

---

## Cách hoạt động

### `npm run test:manual-suite`

1. **`node scripts/archive-run.js`** — Nếu `reports/test-results/latest/results.json` đã tồn tại (lần chạy trước), di chuyển nó sang:
   ```
   reports/test-results/archive/{date}-run-{N}/
   ```
   Tạo folder `latest` mới, sẵn sàng cho lần chạy này.

2. **`playwright test --config playwright.manual.config.ts`** — Chạy 5 suites:
   - **login.spec.ts** (21 test cases TC-LOG-001 → TC-LOG-021)
   - **cart.spec.ts** (47 test cases TC-CRT-001 → TC-CRT-047)
   - **api.spec.ts** (40 test cases API-LOG-001 → API-ORD-015)
   - **regression.spec.ts** (15 test cases REG-LOGIN, REG-CART, REG-INT)
   - **performance.spec.ts** (6 test cases PERF-LOAD, PERF-STRESS)

   Output:
   ```
   reports/test-results/latest/results.json  ← JSON (tất cả 5 suites)
   reports/test-results/latest/html-report/  ← HTML (tất cả 5 suites)
   ```

### `npm run sync:tc-sheet`

Đọc `reports/test-results/latest/results.json` và:

- **Login/Cart/API sheets**: Tìm test title matching `TC-LOG-*`, `TC-CRT-*`, `API-*`
  - Điền cột "Actual Result" = test status + duration + error message (nếu fail)
  - Điền cột "Status" = Pass / Fail / Skipped
  - Append vào "Notes" nếu có test trùng TC ID (bản cũ = superseded)

- **Regression/Performance**: Không có TC ID pattern, nên bị skip
  - Chỉ lưu trong JSON + archive, không map vào xlsx
  - Nếu cần trend analysis, đọc từ `reports/test-results/archive/{date}-run-N/results.json`

Backup: `inputdata/Demoblaze_QA_TestCases.backup-{timestamp}.xlsx`

---

## Test Timeouts

- **Login/Cart/API**: 90s per test
- **Regression**: 90s per test (REG-INT-004 tăng waitForURL lên 20s)
- **Performance**: 120s per test (PERF-LOAD + PERF-STRESS có timeout cao)
- **Global**: 120s (max của 2)
- **Workers**: 1 (sequential, vì performance tests cần isolation)

---

## Các tập tin liên quan

| File | Mục đích |
|------|---------|
| `playwright.manual.config.ts` | Config chạy 5 suites, JSON + HTML reporter |
| `scripts/archive-run.js` | Chuyển `latest/` → `archive/{date}-run-N/` |
| `scripts/sync_test_results_to_xlsx.py` | Parse JSON → điền xlsx |
| `reports/test-results/latest/results.json` | Kết quả JSON (machine-readable) |
| `inputdata/Demoblaze_QA_TestCases.xlsx` | Manual test case sheet (được cập nhật) |

---

## Tình huống sử dụng

### 1. **Chạy lần đầu**
```bash
npm run test:manual-suite
npm run sync:tc-sheet
```
Kết quả: `latest/results.json` + `latest/html-report/` được tạo, xlsx được cập nhật.

### 2. **Chạy lần thứ 2 (cùng ngày)**
```bash
npm run test:manual-suite
npm run sync:tc-sheet
```
Kết quả:
- Lần chạy trước di chuyển → `archive/2026-08-01-run-001/`
- Lần chạy mới → `latest/`
- xlsx được cập nhật với kết quả mới

### 3. **So sánh 2 lần chạy**
```bash
diff reports/test-results/archive/2026-08-01-run-001/results.json \
     reports/test-results/latest/results.json
```
Hoặc xem HTML reports:
```bash
npx playwright show-report reports/test-results/latest/html-report
npx playwright show-report reports/test-results/archive/2026-08-01-run-001/html-report
```

### 4. **Chỉ chạy Login + Cart (không cần regression/performance)**
```bash
npm run test:ui
# Hoặc:
playwright test tests/login.spec.ts tests/cart.spec.ts --config playwright.manual.config.ts
```

---

## Lưu ý

- ✅ **Automation evidence được lưu với timestamp** → không lo mất kết quả lần trước
- ✅ **JSON report readable** → có thể parse bằng script khác, generate dashboard, v.v.
- ✅ **Login/Cart/API results tự động map vào xlsx** → không phải điền tay
- ⚠️ **Regression/Performance không map vào xlsx** → chỉ có TC ID ở title, không ở spreadsheet
- ⚠️ **Cần Python 3 + openpyxl** để chạy sync script (`pip install openpyxl`)
