#!/bin/bash

echo "🚀 NUCLEAR VERCEL CACHE INVALIDATION - FORCE NEW DEPLOYMENT"
echo "============================================================"
echo "⚠️  WARNING: This will force complete cache invalidation"
echo "============================================================"

# 1. Set environment variable to force no build cache
echo "📋 Step 1: Setting VERCEL_FORCE_NO_BUILD_CACHE..."
vercel env add VERCEL_FORCE_NO_BUILD_CACHE 1 production

# 2. Create timestamp invalidation file
echo "⏰ Step 2: Creating cache-busting timestamp..."
TIMESTAMP=$(date -u +"%Y%m%d%H%M%S")
echo "export const NUCLEAR_DEPLOYMENT_ID = 'NUCLEAR_${TIMESTAMP}';" > app/nuclear-cache-bust.ts
echo "export const DEPLOYMENT_SIGNATURE = '$(openssl rand -hex 16)';" >> app/nuclear-cache-bust.ts

# 3. Update all critical files with timestamp
echo "🔄 Step 3: Force-updating critical authentication files..."
sed -i.bak "s/routeVersion: '[^']*'/routeVersion: 'nuclear-${TIMESTAMP}'/g" app/utils/simplified-pos-auth.server.ts
sed -i.bak "s/deploymentStatus: '[^']*'/deploymentStatus: 'NUCLEAR_FRESH_${TIMESTAMP}'/g" app/routes/api.pos.v2025.credit-notes.list.tsx

# 4. Remove any stale cache-related files
echo "🗑️  Step 4: Removing potential cache artifacts..."
rm -rf node_modules/.cache/
rm -rf .vercel/
rm -rf build/
rm -f .next/cache/**

# 5. Force Vercel to rebuild everything
echo "🏗️  Step 5: Force Vercel complete rebuild..."
vercel --force --prod --env VERCEL_FORCE_NO_BUILD_CACHE=1

echo ""
echo "✅ NUCLEAR CACHE INVALIDATION COMPLETE!"
echo "⏱️  Wait 3-5 minutes for global edge cache propagation"
echo "🔍 Monitor deployment: https://vercel.com/narissarahs-projects/creditnote"
echo ""
echo "🧪 Test your new deployment:"
echo "curl -H 'User-Agent: Shopify POS iOS' https://creditnote.vercel.app/api/pos/v2025/credit-notes/list"
echo ""
echo "🎯 Look for 'NUCLEAR_FRESH_${TIMESTAMP}' in response to confirm new code is active"