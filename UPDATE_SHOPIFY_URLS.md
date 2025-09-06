# 🔧 Update Shopify App URLs to Railway

## Current Issue
Your app is configured to use Vercel URLs, but we're moving to Railway to bypass caching issues.

## URLs to Update

### 1. Update shopify.app.toml

Replace these lines in your `shopify.app.toml`:

```toml
# CHANGE FROM:
application_url = "https://creditnote-41ur.vercel.app"

# CHANGE TO:
application_url = "https://YOUR-RAILWAY-DOMAIN.up.railway.app"
```

And:

```toml
# CHANGE FROM:
redirect_urls = [
  "https://creditnote-41ur.vercel.app/auth/callback"
]

# CHANGE TO:
redirect_urls = [
  "https://YOUR-RAILWAY-DOMAIN.up.railway.app/auth/callback"
]
```

### 2. Update Shopify Partner Dashboard

Go to [partners.shopify.com](https://partners.shopify.com) → Your Apps → Credit Note App:

**App URL:**
- Current: `https://creditnote-41ur.vercel.app`
- New: `https://YOUR-RAILWAY-DOMAIN.up.railway.app`

**Allowed redirection URLs:**
- Current: `https://creditnote-41ur.vercel.app/auth/callback`
- New: `https://YOUR-RAILWAY-DOMAIN.up.railway.app/auth/callback`

### 3. Update Environment Variables (if any hardcoded URLs)

Check these files for any hardcoded Vercel URLs:
- `.env`
- `.env.local` 
- `app/shopify.server.ts`

## After URL Updates

1. **Commit and push changes:**
   ```bash
   git add shopify.app.toml
   git commit -m "Update URLs from Vercel to Railway"
   git push origin main
   ```

2. **Reinstall the app on your development store** with the new Railway URL

3. **Test the fixed application:**
   - ✅ No React hydration errors
   - ✅ Settings page shows content
   - ✅ Create credit note button works
   - ✅ Fresh builds without caching issues

## Benefits of Railway Deployment

- 🎯 **Fixed Hydration Errors**: All fixes from HYDRATION_FIX_REPORT.md will work
- 🔄 **No Caching Issues**: Fresh builds every deployment
- 🚀 **Better Performance**: Optimized for Node.js apps
- 🔒 **Shopify Compliant**: All security headers properly applied
- 📊 **Better Monitoring**: Real-time logs and metrics

Your Credit Note app should now work perfectly without the caching and hydration issues!