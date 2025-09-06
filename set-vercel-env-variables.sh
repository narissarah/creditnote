#!/bin/bash

# Set Vercel Environment Variables for Credit Note App
# This script sets all required environment variables in Vercel

echo "Setting Vercel environment variables..."

# Database Configuration
vercel env add DATABASE_URL production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
vercel env add DIRECT_DATABASE_URL production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Shopify App Configuration
vercel env add SHOPIFY_API_KEY production <<< "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e"
vercel env add SHOPIFY_API_SECRET production <<< "06754ce32306ac7725baccf5c46ae3bb"
vercel env add SCOPES production <<< "write_products,write_customers,write_draft_orders,write_orders,read_all_orders,write_pos_applications,read_customers,write_customer_metafields,read_customer_metafields"
vercel env add SHOPIFY_APP_URL production <<< "https://creditnote-41ur.vercel.app"

# Session Secret
vercel env add SESSION_SECRET production <<< "7786a706bcdf1e21ef41ec605d28bf59a19090ebde056b7ca91202bf0ecfb3f4"

# QR Code Security
vercel env add QR_SECRET_KEY production <<< "creditcraft_qr_security_key_2024"

# Vercel Postgres Configuration
vercel env add POSTGRES_URL production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
vercel env add POSTGRES_PRISMA_URL production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require"
vercel env add POSTGRES_URL_NON_POOLING production <<< "postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"
vercel env add POSTGRES_USER production <<< "neondb_owner"
vercel env add POSTGRES_HOST production <<< "ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech"
vercel env add POSTGRES_PASSWORD production <<< "npg_1j8NseTfaxkh"
vercel env add POSTGRES_DATABASE production <<< "neondb"

echo "All environment variables set in Vercel!"
echo "Now triggering a redeploy to apply the changes..."

# Trigger redeploy
vercel --prod

echo "Redeploy triggered! The app should work now."