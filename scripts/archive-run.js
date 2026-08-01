#!/usr/bin/env node
/**
 * Moves whatever is currently in reports/test-results/latest/ (i.e. the
 * PREVIOUS run's evidence) into a dated, numbered folder under
 * reports/test-results/archive/ BEFORE the next Playwright run overwrites
 * "latest/". This is the piece that was missing: reports/README.md already
 * describes this archive/latest split, and .github/workflows/playwright.yml
 * has an "Archive previous run" step, but neither ever actually ran locally,
 * and the CI job never commits results back to the repo - so every local
 * run silently overwrote the last one with no trace. Run this BEFORE the
 * test command (npm run test:manual-suite does this automatically).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LATEST = path.join(ROOT, 'reports', 'test-results', 'latest');
const ARCHIVE_ROOT = path.join(ROOT, 'reports', 'test-results', 'archive');

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nextRunNumber(datePrefix) {
  if (!fs.existsSync(ARCHIVE_ROOT)) return 1;
  const existing = fs.readdirSync(ARCHIVE_ROOT).filter((d) => d.startsWith(datePrefix));
  return existing.length + 1;
}

const resultsJson = path.join(LATEST, 'results.json');

if (fs.existsSync(resultsJson)) {
  const date = todayStamp();
  const runNo = String(nextRunNumber(date)).padStart(3, '0');
  const dest = path.join(ARCHIVE_ROOT, `${date}-run-${runNo}`);
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(LATEST)) {
    if (entry === '.gitkeep') continue;
    fs.renameSync(path.join(LATEST, entry), path.join(dest, entry));
  }
  console.log(`Archived previous run -> reports/test-results/archive/${date}-run-${runNo}/`);
} else {
  console.log('No previous run (reports/test-results/latest/results.json not found) - nothing to archive.');
}

fs.mkdirSync(LATEST, { recursive: true });
