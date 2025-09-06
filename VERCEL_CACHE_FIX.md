# Vercel Deployment Cache Fix

## Problem Identified
The Vercel deployment was serving cached/old code even after fixes were pushed. This caused:
- Old login page to appear instead of the app
- React hydration errors from old code
- 500 errors persisting despite fixes

## Fixes Applied (Just Pushed)

### 1. Force Clean Build in vercel.json
```json
"buildCommand": "rm -rf build .cache && npm run vercel-build"
```
This clears all build artifacts before each deployment.

### 2. Added Index Route Redirect
Created `/app/routes/_index.tsx` that redirects root path to `/app`
This prevents the old login page from showing.

### 3. Added Build ID for Cache Busting
Added `BUILD_ID=v2-2025-09-06` to force Vercel to rebuild.

## CRITICAL: Manual Steps Required on Vercel

### 1. Clear Vercel Cache (IMPORTANT!)
1. Go to: https://vercel.com/narissarahs-projects/creditnote-41ur
2. Click on "Settings" tab
3. Scroll to "Data Cache"
4. Click "Purge All" to clear cache

### 2. Redeploy with "Force New Build"
1. Go to "Deployments" tab
2. Find the latest deployment
3. Click the three dots menu
4. Select "Redeploy"
5. CHECK the box "Use existing Build Cache" should be UNCHECKED
6. Click "Redeploy"

### 3. Set Environment Variables (if not already done)
Go to Settings → Environment Variables and ensure these are set:
```
SHOPIFY_APP_URL=https://creditnote-41ur.vercel.app
DATABASE_URL=[Your Neon database URL]
SHOPIFY_API_SECRET=[From Shopify Partner Dashboard]
SESSION_SECRET=12d6ff05ce98f81b3d851dbdd1ce888bd6eb2f86aa2ef8d35c60df44eca0b40c
```

## What This Fixes

✅ **500 Error on Login** - Removed CSP headers that blocked auth
✅ **React Hydration Errors** - Fixed all client/server mismatches
✅ **Old Login Page** - Added redirect from root to /app
✅ **Cache Issues** - Forces clean build on every deployment

## Testing After Deployment

1. **Clear Your Browser Cache:**
   - Open Developer Tools (F12)
   - Right-click the refresh button
   - Select "Empty Cache and Hard Reload"

2. **Test Authentication:**
   - Go to Shopify Admin
   - Uninstall the app if installed
   - Reinstall from Partner Dashboard
   - Should authenticate without errors

3. **Check Console:**
   - Open browser console
   - Should see NO React errors
   - Should see NO 500 errors

## Success Indicators

When deployment is successful:
- ✅ No "Application Error" page
- ✅ No React hydration errors in console
- ✅ App loads inside Shopify Admin iframe
- ✅ Settings page shows content
- ✅ Create Credit Note button works

## If Issues Persist

1. **Check Vercel Function Logs:**
   - Go to Functions tab in Vercel
   - Check for any error logs

2. **Verify Shopify Partner Dashboard:**
   - App URL: `https://creditnote-41ur.vercel.app`
   - All redirect URLs updated

3. **Database Connection:**
   - Ensure DATABASE_URL is correct
   - Test with: `npx prisma db push`

## Summary

The main issue was Vercel serving cached builds. The fixes ensure:
1. Clean builds on every deployment
2. Proper routing from root to app
3. No CSP header conflicts
4. No hydration mismatches

After following the manual steps above, your app should work perfectly!