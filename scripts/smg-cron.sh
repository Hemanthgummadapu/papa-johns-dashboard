#!/bin/bash
cd /Users/hemanthgummadapu/papa-johns-dashboard
echo "$(date): Refreshing SMG session..."
npx tsx scripts/smg-auto-session.ts
if [ $? -eq 0 ]; then
  echo "$(date): Starting SMG scrape..."
  node scripts/test-smg-one-store.js
  echo "$(date): Done"
else
  echo "$(date): Session refresh failed"
fi

