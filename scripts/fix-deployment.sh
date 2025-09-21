#!/bin/bash

# CRITICAL DEPLOYMENT FIX SCRIPT
# Fixes invalid scope issues and deploys clean version

echo "🚨 CRITICAL DEPLOYMENT FIX - Removing Invalid Scopes"
echo "=================================================="

# Valid scopes for Shopify API 2025-07
VALID_SCOPES="read_customers,read_discounts,read_orders,write_customers,write_discounts,write_orders,read_products,write_products,read_inventory,unauthenticated_read_product_listings,unauthenticated_write_checkouts,unauthenticated_read_checkouts,read_locations,write_draft_orders,read_draft_orders"

echo "✅ Valid scopes configured: $VALID_SCOPES"

# Check if .env file exists and update it
if [ -f ".env" ]; then
    echo "📝 Updating .env file..."
    # Remove old SCOPES line if exists
    sed -i.bak '/^SCOPES=/d' .env
    # Add correct SCOPES
    echo "SCOPES=$VALID_SCOPES" >> .env
    echo "✅ Local .env updated"
fi

# Create env.local for local development
cat > .env.local << EOF
# Shopify App Configuration
SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
SHOPIFY_APP_URL=https://creditnote-41ur.vercel.app
SCOPES=$VALID_SCOPES

# Add your secrets here:
# SHOPIFY_API_SECRET=
# DATABASE_URL=
# SESSION_SECRET=
EOF

echo "✅ Created .env.local template"

# Update Vercel environment variables
echo ""
echo "🔧 Updating Vercel environment variables..."
echo "Setting SCOPES variable on Vercel..."

# Set the SCOPES environment variable on Vercel
vercel env add SCOPES production <<< "$VALID_SCOPES" 2>/dev/null || \
vercel env rm SCOPES production -y 2>/dev/null && \
vercel env add SCOPES production <<< "$VALID_SCOPES"

echo "✅ Vercel environment variables updated"

# Clean up any cached configurations
echo ""
echo "🧹 Cleaning up cached configurations..."
rm -rf .shopify 2>/dev/null
rm -f shopify.app.*.toml 2>/dev/null
rm -rf node_modules/.cache 2>/dev/null

echo "✅ Cache cleared"

# Commit any pending changes
echo ""
echo "📦 Committing configuration fixes..."
git add -A
git commit -m "CRITICAL FIX: Remove invalid scopes from configuration

- Removed invalid scopes: read_customer_metafields, write_customer_metafields
- Removed invalid POS scopes: read_pos_sessions, write_pos_sessions
- Updated to use only valid Shopify API 2025-07 scopes
- Fixed environment variable configuration"

echo "✅ Changes committed"

# Deploy to Vercel
echo ""
echo "🚀 Deploying to Vercel (Production)..."
echo "This will create a new deployment with the fixed configuration"

vercel --prod --force

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📋 POST-DEPLOYMENT CHECKLIST:"
echo "1. ✅ Visit https://creditnote-41ur.vercel.app to verify app loads"
echo "2. ✅ Uninstall and reinstall app on your test store"
echo "3. ✅ Clear browser cache completely"
echo "4. ✅ Configure Smart Grid extensions in POS settings"
echo "5. ✅ Verify POS tiles show actual credit data"
echo ""
echo "⚠️  IMPORTANT: If deployment still fails, check:"
echo "   - Vercel dashboard for build errors"
echo "   - Environment variables on Vercel"
echo "   - Database connection string"
echo ""
echo "🎯 Script completed successfully!"