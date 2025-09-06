# Shopify Partner Dashboard Update Instructions

## ✅ Deployment is Live!

Your app is now deployed at: https://creditnote-41ur.vercel.app

## Required Updates in Shopify Partner Dashboard

### 1. Log into Shopify Partner Dashboard
Go to: https://partners.shopify.com

### 2. Navigate to Your App
- Click on "Apps" in the left sidebar
- Find "CreditNote" (Client ID: 3e0a90c9ecdf9a085dfc7bd1c1c5fa6e)
- Click on the app to open settings

### 3. Update App URLs (Configuration > URLs)

**App URL:**
```
https://creditnote-41ur.vercel.app
```

**Allowed redirection URL(s):** Add ALL of these:
```
https://creditnote-41ur.vercel.app/auth/callback
https://creditnote-41ur.vercel.app/auth/shopify/callback
https://creditnote-41ur.vercel.app/api/auth/callback
https://creditnote-41ur.vercel.app/auth/login
https://creditnote-41ur.vercel.app/auth
```

### 4. Update Webhooks (if applicable)
Under Configuration > Webhooks, update the endpoint URL:
```
https://creditnote-41ur.vercel.app/api/webhooks
```

### 5. Save Changes
Click "Save" at the bottom of the page.

## Vercel Environment Variables

Make sure these are set in your Vercel dashboard (https://vercel.com/dashboard):

1. Go to your project: creditnote-41ur
2. Click on "Settings" tab
3. Navigate to "Environment Variables"
4. Add/Update these variables:

```
SHOPIFY_APP_URL=https://creditnote-41ur.vercel.app
SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
SHOPIFY_API_SECRET=[Your API Secret from Partner Dashboard]
DATABASE_URL=[Your Neon Database URL]
DIRECT_DATABASE_URL=[Your Neon Direct Database URL]
SESSION_SECRET=[Generate a secure random string]
SCOPES=write_products,write_customers,write_draft_orders,write_orders,read_all_orders,write_pos_applications,read_customers,write_customer_metafields,read_customer_metafields
```

### Generate a Secure Session Secret:
Run this command locally to generate a secure secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing the App

### 1. Install on Development Store
- In Partner Dashboard, click "Test your app"
- Select your development store
- Click "Install app"

### 2. Expected Flow:
1. You'll be redirected to OAuth consent screen
2. Click "Install app"
3. You'll be redirected to the app dashboard inside Shopify Admin
4. The app should load without errors

### 3. Verify Everything Works:
- ✅ No 500 errors on login
- ✅ Dashboard loads with credit notes table
- ✅ Settings page shows content
- ✅ Create Credit Note modal opens when clicked
- ✅ No React hydration errors in browser console

## Troubleshooting

### If you see "App not found" error:
1. Wait 2-3 minutes for Shopify to sync the new URLs
2. Clear browser cookies for your development store
3. Try installing again

### If authentication fails:
1. Double-check all environment variables in Vercel
2. Make sure SHOPIFY_API_SECRET matches what's in Partner Dashboard
3. Verify all redirect URLs are added exactly as shown above

### If database errors occur:
1. Check that DATABASE_URL is correctly set in Vercel
2. The URL should start with: postgres:// or postgresql://
3. Test connection from local: `npx prisma db push`

## Current Status

✅ Code pushed to GitHub
✅ Vercel deployment triggered automatically
✅ App is accessible at https://creditnote-41ur.vercel.app
⏳ Waiting for Shopify Partner Dashboard updates
⏳ Waiting for Vercel environment variables setup

Once you complete the Partner Dashboard and Vercel updates, your app should be fully functional!