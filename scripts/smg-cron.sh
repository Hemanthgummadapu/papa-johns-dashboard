#!/bin/bash
# Set PATH to include common locations and nvm node/npx
export PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin:$PATH"

cd /Users/hemanthgummadapu/papa-johns-dashboard
echo "$(date): Pinging extranet keepalive..."
/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin/npx tsx scripts/extranet-keepalive.ts

if [ $? -ne 0 ]; then
  echo "$(date): ❌ Extranet session dead — manual re-login required"
  exit 1
fi

echo "$(date): Refreshing SMG session..."
/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin/npx tsx scripts/smg-auto-session.ts

if [ $? -ne 0 ]; then
  echo "$(date): ❌ SMG session refresh failed"
  exit 1
fi

echo "$(date): Starting SMG scrape..."
/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin/node scripts/test-smg-one-store.js

if [ $? -eq 0 ]; then
  echo "$(date): ✅ SMG scrape completed and saved to Supabase"
else
  echo "$(date): ❌ SMG scrape failed"
fi

echo "$(date): Scraping SMG comments..."
/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin/npx tsx scripts/smg-scrape-comments.ts
if [ $? -eq 0 ]; then
  echo "$(date): ✅ Comments scraped and saved"
else
  echo "$(date): ❌ Comments scrape failed"
fi

