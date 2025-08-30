# 🚨 VERCEL BUILD FAILED - Missing Environment Variable

## The Problem
The build failed with error: **Environment variable not found: DIRECT_DATABASE_URL**

## Quick Fix - Manual Steps

### Step 1: Go to Vercel Dashboard
Open: https://vercel.com/dashboard/creditnote/settings/environment-variables

### Step 2: Add Missing Variable
Click "Add Variable" and add:

**DIRECT_DATABASE_URL** (⚠️ THIS IS MISSING - MOST IMPORTANT)
```
postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
```
- Environment: Production ✓
- Click "Save"

### Step 3: Verify All Variables
Make sure ALL these are set (some might already exist):

| Variable | Value |
|----------|-------|
| **DATABASE_URL** | `postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| **DIRECT_DATABASE_URL** | `postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| **SHOPIFY_API_KEY** | `3e0a90c9ecdf9a085dfc7bd1c1c5fa6e` |
| **SHOPIFY_API_SECRET** | `06754ce32306ac7725baccf5c46ae3bb` |
| **SHOPIFY_APP_URL** | `https://creditnote-41ur.vercel.app` |
| **SESSION_SECRET** | `7786a706bcdf1e21ef41ec605d28bf59a19090ebde056b7ca91202bf0ecfb3f4` |
| **SCOPES** | `write_products,write_customers,write_draft_orders,write_orders,read_all_orders,write_pos_applications,read_customers,write_customer_metafields,read_customer_metafields` |

### Step 4: Trigger Rebuild
After adding the variables:
1. Go to: https://vercel.com/dashboard/creditnote
2. Click on the failed deployment
3. Click "Redeploy" → "Redeploy"

## Alternative: Using Vercel CLI

If you have Vercel CLI installed:
```bash
chmod +x scripts/fix-vercel-env.sh
./scripts/fix-vercel-env.sh
```

## What's Different?

**DATABASE_URL** vs **DIRECT_DATABASE_URL**:
- **DATABASE_URL**: Uses connection pooler (for app queries)  
  `ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech`
- **DIRECT_DATABASE_URL**: Direct connection (for migrations)  
  `ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech`

Note the difference: `-pooler` in DATABASE_URL, no `-pooler` in DIRECT_DATABASE_URL

## Success Indicators

When it works, you'll see in the build logs:
```
✔ Generated Prisma Client
🚀 Your database is now in sync with your Prisma schema
```

Then your app will load in Shopify admin! 🎉