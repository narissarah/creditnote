# 🚨 CRITICAL: CSS Loading Issue in Embedded Shopify Context

## Problem Identified
CSS files exist and are served correctly when accessed directly:
- ✅ `curl -I https://creditnote-41ur.vercel.app/assets/print-CPDMw9Kp.css` returns `200 OK` with `content-type: text/css`
- ❌ But in Shopify embedded iframe, same CSS returns HTML/404

## Root Cause
The embedded Shopify context is causing CORS/referrer issues, making Vercel serve 404 pages instead of CSS files.

## Manual Fix Required in Vercel Dashboard

### Step 1: Go to Vercel Dashboard
1. Visit [vercel.com](https://vercel.com)
2. Open your `creditnote` project
3. Go to **Settings** → **Headers**

### Step 2: Add Custom Headers
Add these headers for CSS files:

```json
{
  "source": "/assets/(.*)",
  "headers": [
    {
      "key": "Access-Control-Allow-Origin",
      "value": "*"
    },
    {
      "key": "Access-Control-Allow-Methods",
      "value": "GET, OPTIONS"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    },
    {
      "key": "Content-Type",
      "value": "text/css"
    }
  ]
}
```

### Step 3: Rebuild Deployment
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **Redeploy** → **Redeploy with existing Build Cache**

## Alternative: Update vercel.json with Headers

If the dashboard approach doesn't work, we need to update vercel.json with proper headers configuration.

## Why This Happens
Shopify's embedded app context adds security headers and referrer policies that can interfere with asset loading. The CSS files exist but Vercel's routing isn't handling the embedded context correctly.

## Expected Result
After applying these headers, CSS files should load correctly in the Shopify embedded admin without MIME type errors.