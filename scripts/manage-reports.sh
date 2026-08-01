#!/bin/bash

# Report Management Script
# - Archive old test runs
# - Cleanup large trace files
# - Generate summary statistics

set -e

REPORTS_DIR="reports"
ARCHIVE_DIR="$REPORTS_DIR/test-results/archive"
LATEST_DIR="$REPORTS_DIR/test-results/latest"
MAX_RUNS=5
DAYS_TO_KEEP=30

echo "🔧 Managing test reports..."

# Step 1: Cleanup old traces (keep summaries)
echo "📦 Cleaning up old traces..."
find "$ARCHIVE_DIR" -name "*.zip" -mtime +$DAYS_TO_KEEP -delete 2>/dev/null || true
find "$ARCHIVE_DIR" -name "traces" -type d -mtime +$DAYS_TO_KEEP -exec rm -rf {} + 2>/dev/null || true

# Step 2: Keep only latest N runs
echo "🗂️  Keeping latest $MAX_RUNS runs..."
if [ -d "$ARCHIVE_DIR" ]; then
  run_count=$(ls -d "$ARCHIVE_DIR"/*/ 2>/dev/null | wc -l)
  if [ $run_count -gt $MAX_RUNS ]; then
    delete_count=$((run_count - MAX_RUNS))
    ls -d "$ARCHIVE_DIR"/*/ | sort | head -n $delete_count | xargs rm -rf
    echo "   Deleted $delete_count old runs"
  fi
fi

# Step 3: Generate report summary if latest run exists
echo "📊 Generating report summary..."
if [ -f "$LATEST_DIR/index.html" ]; then
  # Extract basic stats from HTML (example - adjust based on your HTML structure)
  cat > "$LATEST_DIR/summary.json" << 'EOF'
{
  "generated": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
  "latest_run": "Check index.html for details"
}
EOF
  echo "   ✓ Summary updated: $LATEST_DIR/summary.json"
fi

# Step 4: List current archive
echo ""
echo "📋 Archive Status:"
if [ -d "$ARCHIVE_DIR" ]; then
  run_count=$(ls -d "$ARCHIVE_DIR"/*/ 2>/dev/null | wc -l || echo 0)
  echo "   Total archived runs: $run_count"
  echo "   Recent runs:"
  ls -d "$ARCHIVE_DIR"/*/ 2>/dev/null | sort -r | head -3 | while read run; do
    echo "   - $(basename "$run")"
  done
else
  echo "   No archived runs yet"
fi

echo ""
echo "✅ Report management complete!"
