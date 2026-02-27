#!/bin/bash
export PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin:$PATH"
cd /Users/hemanthgummadapu/papa-johns-dashboard
echo "$(date): Starting live data scrape..."
/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin/npx tsx scripts/scrape-live-data.ts
if [ $? -eq 0 ]; then
  echo "$(date): ✅ Live data scraped and saved"
else
  echo "$(date): ❌ Live data scrape failed"
fi
