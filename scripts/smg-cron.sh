#!/bin/bash
cd /Users/hemanthgummadapu/papa-johns-dashboard
echo "$(date): Pinging extranet keepalive..."
npx tsx scripts/extranet-keepalive.ts

if [ $? -ne 0 ]; then
  echo "$(date): ❌ Extranet session dead — manual re-login required"
  exit 1
fi

echo "$(date): Refreshing SMG session..."
npx tsx scripts/smg-auto-session.ts

if [ $? -ne 0 ]; then
  echo "$(date): ❌ SMG session refresh failed"
  exit 1
fi

echo "$(date): Starting SMG scrape..."
node scripts/test-smg-one-store.js

if [ $? -eq 0 ]; then
  echo "$(date): ✅ SMG scrape completed and saved to Supabase"
else
  echo "$(date): ❌ SMG scrape failed"
fi

