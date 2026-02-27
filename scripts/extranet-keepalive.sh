#!/bin/bash
# Set PATH to include common locations and nvm node/npx
export PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin:$PATH"

cd /Users/hemanthgummadapu/papa-johns-dashboard
echo "$(date): Running extranet keepalive ping..."
/Users/hemanthgummadapu/.nvm/versions/node/v20.20.0/bin/npx tsx scripts/extranet-keepalive.ts >> /Users/hemanthgummadapu/papa-johns-dashboard/logs/keepalive.log 2>&1


