#!/bin/bash

# Script to set environment variables on Vercel
echo "Setting environment variables on Vercel..."

# Set each environment variable
vercel env add DATABASE_URL production < <(echo "postgres://neondb_owner:npg_1DwVsXvfcxr0@ep-quiet-night-adoyoef1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require")
vercel env add DIRECT_DATABASE_URL production < <(echo "postgresql://neondb_owner:npg_1DwVsXvfcxr0@ep-quiet-night-adoyoef1.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require")
vercel env add SHOPIFY_API_KEY production < <(echo "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e")
vercel env add SHOPIFY_API_SECRET production < <(echo "06754ce32306ac7725baccf5c46ae3bb")
vercel env add SESSION_SECRET production < <(echo "7786a706bcdf1e21ef41ec605d28bf59a19090ebde056b7ca91202bf0ecfb3f4")
vercel env add QR_SECRET_KEY production < <(echo "creditcraft_qr_security_key_2024")
vercel env add SHOPIFY_APP_URL production < <(echo "https://creditnote-41ur.vercel.app")
vercel env add SCOPES production < <(echo "write_products,write_customers,write_draft_orders,write_orders,read_all_orders,write_pos_applications,read_customers,write_customer_metafields,read_customer_metafields")

# Also add Postgres env vars for compatibility
vercel env add POSTGRES_URL production < <(echo "postgres://neondb_owner:npg_1DwVsXvfcxr0@ep-quiet-night-adoyoef1-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require")
vercel env add POSTGRES_PRISMA_URL production < <(echo "postgres://neondb_owner:npg_1DwVsXvfcxr0@ep-quiet-night-adoyoef1-pooler.c-2.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require")
vercel env add POSTGRES_URL_NON_POOLING production < <(echo "postgres://neondb_owner:npg_1DwVsXvfcxr0@ep-quiet-night-adoyoef1.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require")

echo "Environment variables set! Now redeploying..."
vercel --prod