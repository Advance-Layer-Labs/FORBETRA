#!/bin/bash
# Quick screenshot capture — opens URLs and captures the screen.
# Run this AFTER you've impersonated Jamie Torres in your browser.
# Usage: bash scripts/capture-demo.sh

set -e
mkdir -p screenshots
BASE="http://localhost:5173"

snap() {
  local name=$1 path=$2
  echo "→ $name"
  open "$BASE$path"
  sleep 3
  screencapture -x -C "screenshots/$name.png"
}

echo "=== Capturing Individual Views (impersonate Jamie Torres first) ==="
snap "01-hub" "/individual"
snap "02-checkin" "/individual/checkin"
snap "03-insights" "/individual/insights"
snap "04-ask" "/individual/ask"
snap "05-dashboard" "/individual/dashboard"
snap "06-history" "/individual/history"

echo ""
echo "=== Capturing Reviewer View ==="
snap "10-reviewer" "/reviewer/feedback/preview?preview=true"

echo ""
echo "=== Now impersonate Marcus Thompson (coach) in the browser ==="
echo "Press ENTER when ready..."
read -r

snap "20-coach-dashboard" "/coach"
snap "21-coach-roster" "/coach/roster"
snap "22-coach-analytics" "/coach/analytics"
snap "23-coach-invitations" "/coach/invitations"

echo ""
echo "=== Now clear impersonation (go to /admin and stop impersonating) ==="
echo "Press ENTER when ready..."
read -r

snap "30-admin" "/admin"
snap "31-admin-orgs" "/admin/organizations"
snap "32-admin-demo" "/admin/demo"

echo ""
echo "Done! $(ls screenshots/*.png 2>/dev/null | wc -l | tr -d ' ') screenshots in screenshots/"
