#!/bin/bash
# Capture demo screenshots by opening URLs in your authenticated browser.
# Prerequisites: Be logged in at localhost:5173 as admin with impersonation active.
#
# Usage:
#   1. Open localhost:5173 in Safari, sign in as admin
#   2. Go to /admin/preview and impersonate Jamie Torres (individual)
#   3. Run: bash scripts/capture-screenshots.sh individual
#   4. Then impersonate Marcus Thompson (coach) and run: bash scripts/capture-screenshots.sh coach
#   5. Then clear impersonation and run: bash scripts/capture-screenshots.sh admin

set -e
mkdir -p screenshots

BASE="http://localhost:5173"
DELAY=3  # seconds to wait for page load

capture() {
  local name=$1
  local path=$2
  echo "Capturing: $name ($path)"
  open "$BASE$path"
  sleep $DELAY
  screencapture -x "screenshots/$name.png"
  echo "  Saved: screenshots/$name.png"
}

case "${1:-all}" in
  individual)
    capture "01-individual-hub" "/individual"
    capture "02-checkin" "/individual/checkin"
    capture "03-insights" "/individual/insights"
    capture "04-ask" "/individual/ask"
    capture "05-dashboard" "/individual/dashboard"
    capture "06-history" "/individual/history"
    capture "07-feedback" "/individual/feedback"
    capture "08-settings" "/individual/settings"
    ;;
  coach)
    capture "10-coach-dashboard" "/coach"
    capture "11-coach-roster" "/coach/roster"
    capture "12-coach-analytics" "/coach/analytics"
    capture "13-coach-invitations" "/coach/invitations"
    ;;
  reviewer)
    capture "20-reviewer-feedback" "/reviewer/feedback/preview?preview=true"
    ;;
  admin)
    capture "30-admin-dashboard" "/admin"
    capture "31-admin-organizations" "/admin/organizations"
    capture "32-admin-demo" "/admin/demo"
    ;;
  all)
    echo "Run each role separately:"
    echo "  1. Impersonate Jamie Torres, then: bash scripts/capture-screenshots.sh individual"
    echo "  2. Impersonate Marcus Thompson, then: bash scripts/capture-screenshots.sh coach"
    echo "  3. No impersonation: bash scripts/capture-screenshots.sh reviewer"
    echo "  4. No impersonation: bash scripts/capture-screenshots.sh admin"
    ;;
esac

echo ""
echo "Done! Screenshots in screenshots/"
ls -la screenshots/*.png 2>/dev/null | wc -l | xargs -I{} echo "{} screenshots captured"
