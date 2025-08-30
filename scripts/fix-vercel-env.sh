#!/bin/bash

echo "======================================"
echo "   FIXING VERCEL ENVIRONMENT VARIABLES"
echo "======================================"
echo ""
echo "The build failed because DIRECT_DATABASE_URL is missing."
echo "Setting all required environment variables in Vercel..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "ERROR: Vercel CLI is not installed"
    echo "Install it with: npm install -g vercel"
    exit 1
fi

echo "Setting environment variables..."

# Set DIRECT_DATABASE_URL (this was missing)
echo "1. Setting DIRECT_DATABASE_URL..."
vercel env add DIRECT_DATABASE_URL production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Ensure DATABASE_URL is set
echo "2. Setting DATABASE_URL..."
vercel env add DATABASE_URL production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Set Shopify variables
echo "3. Setting Shopify variables..."
vercel env add SHOPIFY_API_KEY production <<< "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e"
vercel env add SHOPIFY_API_SECRET production <<< "06754ce32306ac7725baccf5c46ae3bb"
vercel env add SHOPIFY_APP_URL production <<< "https://creditnote-41ur.vercel.app"
vercel env add SCOPES production <<< "write_products,write_customers,write_draft_orders,write_orders,read_all_orders,write_pos_applications,read_customers,write_customer_metafields,read_customer_metafields"

# Set Session Secret
echo "4. Setting SESSION_SECRET..."
vercel env add SESSION_SECRET production <<< "7786a706bcdf1e21ef41ec605d28bf59a19090ebde056b7ca91202bf0ecfb3f4"

echo ""
echo "======================================"
echo "   ENVIRONMENT VARIABLES SET!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Trigger a rebuild in Vercel dashboard"
echo "2. Or push a small change to trigger auto-deploy"
echo ""
echo "To trigger rebuild manually:"
echo "  - Go to: https://vercel.com/dashboard/creditnote"
echo "  - Click on the latest deployment"
echo "  - Click 'Redeploy' button"
echo ""