# CRITICAL: Vercel Deployment Guide for Shopify Remix App

## Root Cause Analysis

The deployment failures were caused by:
1. **Manual API Route Conflict**: `api/index.js` was trying to import from incorrect build path
2. **Function Pattern Mismatch**: Vercel looking for `build/server/index.js` but Vite generates `build/server/nodejs-{hash}/index.js`
3. **Configuration Conflicts**: Manual configuration conflicting with `@vercel/remix` preset automatic detection
4. **Missing Database Migration**: Prisma migrations not executed on Vercel deployment

## SOLUTION: Step-by-Step Deployment Instructions

### 1. VERCEL PROJECT CONFIGURATION

**In Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add ALL variables from `.env.example`:
   ```
   SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
   SHOPIFY_API_SECRET=[your_secret_from_shopify_partner_dashboard]
   SHOPIFY_APP_URL=https://creditnote.vercel.app
   SHOPIFY_SCOPES=read_customers,read_discounts,read_draft_orders,read_inventory,read_locations,read_orders,read_products,unauthenticated_read_checkouts,unauthenticated_read_product_listings,unauthenticated_write_checkouts,write_customers,write_discounts,write_draft_orders,write_orders,write_products,read_locales,read_locations
   SHOPIFY_API_VERSION=2025-07
   DATABASE_URL=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   POSTGRES_URL=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
   POSTGRES_PRISMA_URL=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
   ```

**In Build & Development Settings:**
- Framework Preset: **Remix** (should auto-detect)
- Build Command: `npm run vercel-build`
- Install Command: `npm install`
- Output Directory: (leave empty, auto-detected)

### 2. DATABASE MIGRATION (CRITICAL)

**Before deployment, run locally:**
```bash
npx prisma migrate deploy
```

**This step is essential** - it ensures your Neon database has all required tables.

### 3. KEY CONFIGURATION CHANGES MADE

#### Fixed `vercel.json`:
```json
{
  "regions": ["iad1"],
  "buildCommand": "npm run vercel-build",
  "installCommand": "npm install",
  "framework": "remix"
}
```

#### Removed Manual API Route:
- Deleted `/api/index.js` directory
- `@vercel/remix` preset handles function routing automatically

#### Verified Build Configuration:
- `vite.config.ts` uses `vercelPreset()` correctly
- Package.json has `vercel-build` script
- Uses `@vercel/remix@2.16.7`

### 4. SHOPIFY PARTNER DASHBOARD UPDATES

**Update App URLs in Shopify Partner Dashboard:**
1. App URL: `https://creditnote.vercel.app`
2. Allowed redirection URLs:
   - `https://creditnote.vercel.app/auth/callback`
   - `https://creditnote.vercel.app/auth`

### 5. POS SMART GRID EXTENSION ACTIVATION

**After successful deployment:**
1. Install app in test store
2. Go to POS Settings → Smart Grid Extensions
3. Enable the three CreditNote extensions:
   - Credit Manager
   - Credit QR Generator
   - Credit Barcode Scanner

### 6. DEPLOYMENT & VERIFICATION

**Deploy Process:**
1. Push changes to main branch
2. Vercel auto-deploys using new configuration
3. Monitor build logs for success

**Verification Steps:**
1. **App Loading**: Visit `https://creditnote.vercel.app` → should redirect to Shopify auth
2. **Health Check**: `https://creditnote.vercel.app/health` → should return JSON
3. **Embedded Loading**: Install in test store → should load without "Something went wrong"
4. **Database Connection**: Check app functionality (create credit note)
5. **POS Extensions**: Verify Smart Grid tiles appear as "Added"

### 7. TROUBLESHOOTING

**If deployment still fails:**

1. **Clear Vercel Cache:**
   ```bash
   npx vercel --prod --force
   ```

2. **Check Build Logs:**
   - Look for Prisma generation errors
   - Verify all environment variables loaded

3. **Database Issues:**
   - Ensure Neon database is accessible
   - Re-run `npx prisma migrate deploy`

4. **Function Detection:**
   - Verify no manual `api/` directory exists
   - Check Vercel Functions tab shows auto-detected routes

### 8. 2025-07 API COMPLIANCE

**Your app is configured for:**
- Shopify API version 2025-07
- Embedded app with proper CSP headers
- Latest App Bridge integration
- POS UI Extensions support

**Key Files Updated:**
- `/Users/narissaranamkhan/Projects/creditnote/creditnote/vercel.json`
- `/Users/narissaranamkhan/Projects/creditnote/creditnote/.env.example`
- Removed `/Users/narissaranamkhan/Projects/creditnote/creditnote/api/` directory

The deployment should now work correctly with the `@vercel/remix` preset handling all serverless function detection automatically.