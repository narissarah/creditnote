# 🚂 Railway Deployment Guide - Bypass Vercel Caching Issues

## Why Railway?

Vercel's aggressive caching is preventing your hydration fixes from being deployed. Railway provides:
- ✅ No aggressive build caching
- ✅ Built-in PostgreSQL database
- ✅ Better control over deployments
- ✅ Fresh builds every time

## Step 1: Create Railway Account & Project

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click "New Project"
3. Choose "Deploy from GitHub repo"
4. Select your `creditnote` repository

## Step 2: Add PostgreSQL Database

1. In your Railway project dashboard, click "New Service"
2. Choose "Database" → "PostgreSQL"
3. Railway will create a new PostgreSQL database instance

## Step 3: Configure Environment Variables

In Railway project settings, add these environment variables:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=your-session-secret-here
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SCOPES=write_orders,read_customers,write_customers,read_products,write_products
```

## Step 4: Get Your Railway Domain

1. In Railway, go to your app service → "Settings" → "Domains"
2. Generate a Railway domain (e.g., `creditnote-production-abcd.up.railway.app`)
3. Copy this URL for the next step

## Step 5: Update Shopify App Configuration

Update `shopify.app.toml`:

```toml
# Replace creditnote-41ur.vercel.app with your Railway domain
application_url = "https://your-railway-domain.up.railway.app"
embedded = true

[access_scopes]
scopes = "write_orders,read_customers,write_customers,read_products,write_products"

[auth]
redirect_urls = [
  "https://your-railway-domain.up.railway.app/auth/callback"
]

[webhooks]
api_version = "2024-07"
```

## Step 6: Update Shopify Partner Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Open your Credit Note app
3. Update these URLs to your Railway domain:
   - App URL: `https://your-railway-domain.up.railway.app`
   - Allowed redirection URL: `https://your-railway-domain.up.railway.app/auth/callback`

## Step 7: Deploy to Railway

Railway will automatically deploy when you push to GitHub. To force a deploy:

1. Make any small change to your code
2. Commit and push:
   ```bash
   git add .
   git commit -m "Deploy to Railway - bypass Vercel caching"
   git push origin main
   ```

## Step 8: Run Database Migrations

After deployment, go to Railway project → your app service → "Deployments" → click latest deployment → "View Logs"

If you need to run migrations manually:
1. Go to Railway project settings
2. Add a one-time service with command: `npx prisma migrate deploy`

## Step 9: Test Your Fixed App

Your hydration fixes should now work because Railway will serve fresh builds:

1. Install your app on a development store using the Railway URL
2. Test that React hydration errors (#418, #425, #423) are gone
3. Verify settings page loads content
4. Confirm create credit note button works

## Database Migration from Neon

If you need to migrate data from Neon to Railway PostgreSQL:

1. Export from Neon:
   ```bash
   pg_dump $NEON_DATABASE_URL > backup.sql
   ```

2. Import to Railway:
   ```bash
   psql $RAILWAY_DATABASE_URL < backup.sql
   ```

## Benefits of This Approach

✅ **No Caching Issues**: Fresh builds every deployment  
✅ **All Hydration Fixes Applied**: Your fixes in HYDRATION_FIX_REPORT.md will work  
✅ **Shopify Compliance**: Security headers and CSP properly applied  
✅ **Database Included**: No need to manage separate Neon instance  
✅ **Better Debugging**: Clear logs and deployment history  

## Monitoring Deployment

Railway provides excellent monitoring:
- View real-time logs during deployment
- Monitor app performance and errors
- Database metrics and connection pooling
- Automatic HTTPS certificates

Your app should now work without the hydration errors and caching issues you experienced with Vercel!