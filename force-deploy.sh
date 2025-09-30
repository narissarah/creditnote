#!/bin/bash
# Force Vercel deployment with cache clearing

echo "🚀 NUCLEAR DEPLOYMENT: Force deploying with cache clear..."
echo "==============================================="

# Add timestamp to force new deployment
echo "export const DEPLOYMENT_TIMESTAMP = '$(date -u +"%Y-%m-%dT%H:%M:%SZ")';" > app/deployment-timestamp.ts

# Stage the timestamp file
git add app/deployment-timestamp.ts

# Commit with deployment timestamp
git commit -m "FORCE DEPLOY: Nuclear Frame context fixes with cache clear - $(date -u +"%Y-%m-%d %H:%M:%S UTC")"

# Push to trigger deployment
git push origin main

echo "✅ Deployment triggered with cache clear"
echo "📊 Monitor at: https://vercel.com/narissarahs-projects/creditnote"
echo "🔍 Check deployment logs for build errors"
echo ""
echo "After deployment completes, test at:"
echo "https://creditnote.vercel.app/?shop=YOUR_SHOP.myshopify.com"