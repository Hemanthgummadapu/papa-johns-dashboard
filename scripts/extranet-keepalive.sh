#!/bin/bash
cd /Users/hemanthgummadapu/papa-johns-dashboard
echo "$(date): Running extranet keepalive ping..."
npx tsx scripts/extranet-keepalive.ts >> /Users/hemanthgummadapu/papa-johns-dashboard/logs/keepalive.log 2>&1


