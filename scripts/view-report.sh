#!/bin/bash

# View latest test report in browser
# Usage: ./scripts/view-report.sh [suite]
# Examples:
#   ./scripts/view-report.sh          # View latest test report index
#   ./scripts/view-report.sh latest   # Same as above
#   ./scripts/view-report.sh archive  # List archived runs

REPORT_DIR="reports/test-results"
SUITE="${1:-latest}"

if [ "$SUITE" = "archive" ]; then
  echo "📦 Archived test runs:"
  echo ""
  ls -d "$REPORT_DIR/archive"/*/ 2>/dev/null | sort -r | while read run; do
    echo "$(basename "$run")"
    ls "$run"/*.html 2>/dev/null | xargs -I {} basename {} || echo "  (no reports)"
  done
  exit 0
fi

REPORT_PATH="$REPORT_DIR/$SUITE/index.html"

if [ ! -f "$REPORT_PATH" ]; then
  echo "❌ Report not found: $REPORT_PATH"
  echo ""
  echo "Available options:"
  echo "  ./scripts/view-report.sh latest"
  echo "  ./scripts/view-report.sh archive"
  if [ -d "$REPORT_DIR/archive" ]; then
    echo ""
    echo "Archived runs:"
    ls -d "$REPORT_DIR/archive"/*/ 2>/dev/null | sort -r | head -5 | while read run; do
      echo "  ./scripts/view-report.sh archive/$(basename "$run" | sed 's:/$::') [file]"
    done
  fi
  exit 1
fi

echo "🌐 Opening test report: $REPORT_PATH"
echo ""

# Try different ways to open browser based on OS
if command -v npx &> /dev/null; then
  npx playwright show-report "$REPORT_DIR/$SUITE" 2>/dev/null || {
    echo "⚠️  Playwright show-report failed, trying system browser..."
    open_browser
  }
elif command -v open &> /dev/null; then
  open "$REPORT_PATH"
elif command -v xdg-open &> /dev/null; then
  xdg-open "$REPORT_PATH"
elif command -v start &> /dev/null; then
  start "$REPORT_PATH"
else
  echo "Could not open browser. Manual view:"
  echo "  File: $REPORT_PATH"
fi
