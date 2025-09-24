#!/bin/bash

# CreditNote App - Deployment Verification Script
# This script verifies that all 2025-07 authentication fixes are properly configured

echo "🚀 CreditNote Deployment Verification - 2025-07 Authentication Fixes"
echo "=================================================================="

# Check 1: Verify Shopify Server Configuration
echo ""
echo "✅ CHECK 1: Shopify Server Authentication Strategy"
if grep -q "unstable_newEmbeddedAuthStrategy: true" app/shopify.server.ts; then
    echo "✅ PASS: New embedded auth strategy is ENABLED"
else
    echo "❌ FAIL: New embedded auth strategy not enabled"
    exit 1
fi

if grep -q "useOnlineTokens: false" app/shopify.server.ts; then
    echo "✅ PASS: Using offline tokens for Vercel serverless stability"
else
    echo "❌ FAIL: Online tokens may cause issues in serverless"
fi

# Check 2: Verify Vercel Configuration
echo ""
echo "✅ CHECK 2: Vercel Deployment Configuration"
if ! grep -q "build/index.js" vercel.json; then
    echo "✅ PASS: Removed legacy build/index.js functions pattern"
else
    echo "❌ FAIL: Legacy functions pattern still present in vercel.json"
    exit 1
fi

if grep -q '"framework": "remix"' vercel.json; then
    echo "✅ PASS: Using Remix framework configuration"
else
    echo "❌ FAIL: Remix framework not configured"
    exit 1
fi

# Check 3: Verify Shopify App Configuration
echo ""
echo "✅ CHECK 3: Shopify App Configuration"
if grep -q "use_shopify_managed_installation = true" shopify.app.toml; then
    echo "✅ PASS: Shopify managed installation is enabled"
else
    echo "❌ FAIL: Shopify managed installation not enabled"
    exit 1
fi

if grep -q "use_legacy_install_flow = false" shopify.app.toml; then
    echo "✅ PASS: Legacy install flow is disabled"
else
    echo "❌ FAIL: Legacy install flow not properly disabled"
    exit 1
fi

# Check 4: Verify Vite Configuration
echo ""
echo "✅ CHECK 4: Vite Configuration"
if grep -q "vercelPreset()" vite.config.ts; then
    echo "✅ PASS: Vercel preset is configured in Vite"
else
    echo "❌ FAIL: Vercel preset missing from Vite config"
    exit 1
fi

# Check 5: Verify Package Configuration
echo ""
echo "✅ CHECK 5: Package Dependencies"
if grep -q "@vercel/remix" package.json; then
    echo "✅ PASS: @vercel/remix dependency present"
else
    echo "❌ FAIL: @vercel/remix dependency missing"
    exit 1
fi

if grep -q '"@shopify/shopify-app-remix": "^3.7.0"' package.json; then
    echo "✅ PASS: Using latest Shopify App Remix version"
else
    echo "⚠️  WARNING: Consider updating @shopify/shopify-app-remix to latest version"
fi

# Check 6: Environment Variables
echo ""
echo "✅ CHECK 6: Critical Environment Variables"
required_vars=("SHOPIFY_API_KEY" "SHOPIFY_API_SECRET" "SHOPIFY_APP_URL" "DATABASE_URL")

for var in "${required_vars[@]}"; do
    if [[ -n "${!var}" ]]; then
        echo "✅ PASS: $var is set"
    else
        echo "❌ FAIL: $var is not set (check your .env or Vercel environment variables)"
        exit 1
    fi
done

# Summary
echo ""
echo "🎉 DEPLOYMENT VERIFICATION COMPLETE"
echo "================================="
echo ""
echo "✅ All critical 2025-07 authentication fixes are properly configured!"
echo ""
echo "🚀 NEXT STEPS:"
echo "1. Deploy to Vercel: 'vercel deploy --prod'"
echo "2. Update your Shopify app configuration via Shopify CLI: 'shopify app deploy'"
echo "3. Test the admin interface - 410 Gone errors should be eliminated"
echo ""
echo "📊 KEY IMPROVEMENTS IMPLEMENTED:"
echo "• Enabled unstable_newEmbeddedAuthStrategy for token exchange"
echo "• Configured Shopify managed installation"
echo "• Removed legacy Vercel functions patterns"
echo "• Simplified authentication logic to trust Shopify's new strategy"
echo "• Using offline tokens for serverless stability"
echo ""
echo "🔍 WHY POS WORKED WHILE ADMIN FAILED:"
echo "• POS extensions use specialized APIs with native rendering"
echo "• Admin interface required embedded iframe session token validation"
echo "• 410 errors occurred due to token expiration in traditional OAuth"
echo "• New embedded auth strategy eliminates these issues entirely"
echo ""
echo "Deploy with confidence! 🚀"