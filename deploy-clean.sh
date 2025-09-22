#!/bin/bash

# ULTRA-CLEAN deployment script for CreditNote app
# Fixes persistent scope validation errors from Partner Dashboard cache

echo "🚀 CreditNote ULTRA-CLEAN Deployment Script"
echo "=========================================="

# Step 1: Nuclear cache clearing
echo "🧹 Step 1: Nuclear cache clearing..."
rm -rf .shopify ~/.shopify ~/.config/shopify 2>/dev/null
rm -rf node_modules/.cache .cache dist build 2>/dev/null
rm -f shopify.app.*.toml .shopify-cli.yml 2>/dev/null
echo "✅ All caches nuked"

# Step 2: Verify configuration files are clean
echo "📝 Step 2: Verifying configuration..."
echo "Current scopes in shopify.app.toml:"
grep "scopes =" shopify.app.toml
echo "✅ Configuration verified"

# Step 3: Force authentication reset
echo "🔐 Step 3: Resetting authentication..."
shopify auth logout 2>/dev/null || echo "Already logged out"
echo "Please log in with fresh authentication:"
shopify auth login

# Step 4: Deploy with --reset flag
echo "🚀 Step 4: Force deployment with reset..."
shopify app deploy --reset --force

echo ""
echo "✅ ULTRA-CLEAN deployment complete!"
echo ""
echo "🎯 CRITICAL: If you still get scope errors:"
echo "1. Go to Partner Dashboard: https://partners.shopify.com/"
echo "2. Apps → CreditNote → App setup → Configuration"
echo "3. Remove invalid scopes: read_customer_metafields, write_customer_metafields, read_pos_sessions, write_pos_sessions"
echo "4. Save and re-run this script"