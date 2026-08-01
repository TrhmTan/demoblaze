# 🚀 PERFORMANCE TESTING GUIDE

**Purpose:** Measure system performance under normal and stress conditions  
**File:** `tests/performance.spec.ts`  
**Status:** Ready to run

---

## 📊 TEST SUITES

### 1️⃣ LOAD TESTING - Normal Load
5-10 concurrent users simulated through parallel Playwright workers

**Tests:**
- `PERF-LOAD-001`: Browse products
- `PERF-LOAD-002`: Add product to cart
- `PERF-LOAD-003`: Login process
- `PERF-LOAD-004`: View cart
- `PERF-LOAD-005`: Complete purchase flow

**Expected Metrics:**
- Average response time: < 5000ms
- Success rate: > 95%
- P95 response time: < 8000ms

---

### 2️⃣ STRESS TESTING - High Load
50+ concurrent operations simulated

**Tests:**
- `PERF-STRESS-001`: Rapid product browsing (5 products)
- `PERF-STRESS-002`: Multiple add-to-cart operations (3 products)
- `PERF-STRESS-003`: Repeated login attempts (3x)

**Expected Metrics:**
- Average response time: < 10000ms
- Success rate: > 80%
- System should remain responsive

---

## 🎯 HOW TO RUN

⚠️ **IMPORTANT:** Performance tests use a separate config (single browser only).

### Run all performance tests (Chromium only):
```bash
npx playwright test --config playwright.perf.config.ts
```

### Run load tests only:
```bash
npx playwright test --config playwright.perf.config.ts -g "LOAD TESTING"
```

### Run stress tests only:
```bash
npx playwright test --config playwright.perf.config.ts -g "STRESS TESTING"
```

### Run in headed mode (see browser):
```bash
npx playwright test --config playwright.perf.config.ts --headed
```

### View HTML report:
```bash
npx playwright show-report
```

---

## 📈 METRICS COLLECTED

Performance tests automatically collect:

```json
{
  "totalRequests": number,
  "successfulRequests": number,
  "failedRequests": number,
  "averageResponseTime": number,
  "minResponseTime": number,
  "maxResponseTime": number,
  "successRate": percentage,
  "p50": number,     // Median response time
  "p95": number,     // 95th percentile
  "p99": number      // 99th percentile
}
```

### Report Location:
`test-results/performance-report.json`

---

## 🔍 UNDERSTANDING RESULTS

### Response Time Distribution:
- **P50 (Median):** 50% of requests respond within this time
- **P95:** 95% of requests respond within this time (acceptable for most users)
- **P99:** 99% of requests respond within this time (worst-case scenario)

### Success Rate Interpretation:
- **95%+:** Excellent (load acceptable)
- **80-95%:** Good (system under pressure)
- **<80%:** Poor (system overloaded)

### Example Good Result:
```
Average: 2500ms
P95: 5000ms
P99: 8000ms
Success Rate: 98%
```
This means: Most requests < 2.5s, 95% < 5s, even worst 1% < 8s

---

## 🧪 TEST SCENARIOS

### Scenario 1: Normal Day (LOAD TESTING)
- 5 concurrent users
- Typical browsing + shopping
- Expected: < 5s average response

### Scenario 2: Peak Hours (STRESS TESTING)
- 50+ concurrent operations
- Rapid browsing + multiple purchases
- Expected: System stays up, some degradation OK

---

## 💡 INTERPRETATION GUIDE

### Load Test Results:
- ✅ P95 < 5000ms: System ready for production
- ⚠️ P95 5000-8000ms: Monitor, may need optimization
- ❌ P95 > 8000ms: Performance issues found

### Stress Test Results:
- ✅ Success rate > 80%: System handles stress well
- ⚠️ Success rate 70-80%: Acceptable with monitoring
- ❌ Success rate < 70%: Serious issues, needs investigation

---

## 🛠️ TROUBLESHOOTING

### Tests Running Slowly
**Cause:** Network latency or server slow  
**Solution:** 
- Check internet connection
- Run during off-peak hours
- Increase timeouts in `playwright.config.ts`

### High Failure Rate
**Cause:** Server overloaded or bugs  
**Solution:**
- Check server health
- Review error messages in report
- Run regression tests to verify functionality

### Large Variance in Response Times
**Cause:** Server under load or network instability  
**Solution:**
- Run tests multiple times
- Look at P95 instead of average
- Check server resource usage

---

## 📋 NEXT STEPS

After completing performance tests:

1. ✅ Run load tests on production
2. ✅ Document baseline metrics
3. ✅ Run stress tests
4. ✅ Compare with baseline
5. ✅ Identify bottlenecks
6. ✅ Optimization recommendations (Phase 4)

---

## 📊 SAMPLE REPORT

```json
{
  "timestamp": "2026-08-01T10:30:00Z",
  "summary": {
    "totalRequests": 50,
    "successfulRequests": 49,
    "failedRequests": 1,
    "averageResponseTime": 3240,
    "minResponseTime": 800,
    "maxResponseTime": 12500,
    "successRate": "98.00",
    "p50": 2800,
    "p95": 5200,
    "p99": 10800
  }
}
```

**Interpretation:**
- 98% success rate ✅
- Average 3.2s ✅
- P95 5.2s (acceptable) ✅
- 1 failure (investigate) ⚠️

---

**Status:** Ready to execute  
**Last Updated:** 2026-08-01
