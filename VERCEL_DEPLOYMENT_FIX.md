# Vercel Deployment Fix Guide

## Critical Issues Fixed

### 1. Missing API Handler File ✅
- **Issue:** No `/api/index.js` file for Vercel serverless function
- **Fix Applied:** Created `/api/index.js` with proper Remix request handler
- **Impact:** This was causing all routes to fail including authentication

### 2. Incorrect URLs in Configuration ✅
- **Issue:** `shopify.app.toml` still pointed to old Cloudflare tunnel URL
- **Fix Applied:** Updated all URLs to `https://creditnote-41ur.vercel.app`
- **Files Updated:**
  - `shopify.app.toml` - application_url and redirect_urls

## Required Actions on Vercel Dashboard

### 1. Update Environment Variables in Vercel
Go to your Vercel project dashboard (creditnote-41ur) and ensure these environment variables are set:

```
SHOPIFY_APP_URL=https://creditnote-41ur.vercel.app
SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
SHOPIFY_API_SECRET=06754ce32306ac7725baccf5c46ae3bb
DATABASE_URL=[Your Neon database URL]
SESSION_SECRET=[Generate a secure random string]
SCOPES=write_products,write_customers,write_draft_orders,write_orders,read_all_orders,write_pos_applications,read_customers,write_customer_metafields,read_customer_metafields
```

### 2. Update Shopify Partner Dashboard
1. Go to your app in Shopify Partner Dashboard
2. Update App URL to: `https://creditnote-41ur.vercel.app`
3. Update Allowed redirection URL(s) to include:
   - `https://creditnote-41ur.vercel.app/auth/callback`
   - `https://creditnote-41ur.vercel.app/auth/shopify/callback`
   - `https://creditnote-41ur.vercel.app/api/auth/callback`

### 3. Deploy to Vercel
```bash
# Commit the changes
git add .
git commit -m "Fix Vercel deployment configuration"

# Push to trigger deployment
git push origin main
```

## Verification Steps

After deployment:

1. **Check Authentication:**
   - Install app on development store through Shopify Partner Dashboard
   - Should redirect to OAuth flow without 500 errors

2. **Check Database Connection:**
   - Settings page should load with default values
   - Credit notes should be creatable

3. **Check for Hydration Errors:**
   - Open browser console
   - Should not see React hydration mismatch errors

## Troubleshooting

### If authentication still fails:
1. Clear all cookies for your development store
2. Uninstall and reinstall the app
3. Check Vercel function logs for specific errors

### If database errors occur:
1. Verify DATABASE_URL is correctly set in Vercel
2. Run database migrations from local:
   ```bash
   npx prisma migrate deploy
   ```

### If hydration errors persist:
The hydration fixes are already in the code. Clear browser cache and hard refresh.

## Key Differences from Cloudflare Deployment

1. **Serverless Function:** Vercel requires `/api/index.js` as the entry point
2. **Environment Variables:** Must be set in Vercel dashboard, not `.env` file
3. **Build Process:** Uses `vercel-build` script which includes Prisma generation
4. **URL Structure:** All callbacks and webhooks must use Vercel URL

## Success Indicators

✅ App installs without errors
✅ Login redirects work properly  
✅ Settings page loads with content
✅ Credit notes can be created via modal
✅ No React hydration errors in console
✅ Database operations succeed

## Next Steps

1. Commit and push these changes
2. Update environment variables in Vercel dashboard
3. Update URLs in Shopify Partner Dashboard
4. Test the deployment
5. Monitor Vercel function logs for any issues