# 🔍 VERCEL DEPLOYMENT DEBUGGING

## Check These Things on Vercel Dashboard:

### 1. Go to Function Logs
**URL**: https://vercel.com/dashboard/creditnote/functions

Look for error messages in the logs. Common issues:
- "Cannot find module" errors
- "Environment variable not found" errors
- Database connection errors

### 2. Check Build Status
**URL**: https://vercel.com/dashboard/creditnote

The latest deployment should show:
- ✅ Ready (green) - Build succeeded
- ❌ Error (red) - Build failed
- ⏳ Building (yellow) - Still building

### 3. Verify ALL Environment Variables Are Set

Go to: https://vercel.com/dashboard/creditnote/settings/environment-variables

**CRITICAL - Make sure ALL of these are set:**

```
✅ DATABASE_URL
✅ DIRECT_DATABASE_URL
✅ SHOPIFY_API_KEY
✅ SHOPIFY_API_SECRET
✅ SHOPIFY_APP_URL
✅ SESSION_SECRET
✅ SCOPES
```

### 4. Check Latest Build Logs

Click on the latest deployment → View Build Logs

Look for:
- ✅ "Generated Prisma Client"
- ✅ "Your database is now in sync"
- ❌ Any error messages

## If Build Succeeded But App Still Shows 500:

This means the build worked but runtime is failing. Check:

1. **Function Logs** (most important):
   - Go to Functions tab
   - Look for the error message
   - Common: "Session table does not exist" or "Cannot connect to database"

2. **Redeploy with "Clear Cache"**:
   - Go to deployments
   - Click 3 dots → Redeploy
   - Check "Use existing Build Cache" → UNCHECK IT
   - Click Redeploy

## Quick Diagnostic Command

Run this locally to verify your setup:

```bash
node -e "
const env = process.env;
console.log('Environment Check:');
console.log('DATABASE_URL:', env.DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('DIRECT_DATABASE_URL:', env.DIRECT_DATABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SHOPIFY_API_KEY:', env.SHOPIFY_API_KEY ? '✅ Set' : '❌ Missing');
console.log('SHOPIFY_API_SECRET:', env.SHOPIFY_API_SECRET ? '✅ Set' : '❌ Missing');
console.log('SHOPIFY_APP_URL:', env.SHOPIFY_APP_URL ? '✅ Set' : '❌ Missing');
console.log('SESSION_SECRET:', env.SESSION_SECRET ? '✅ Set' : '❌ Missing');
"
```

## Most Likely Issues:

1. **Environment variables not saved properly in Vercel**
   - Solution: Re-add them and click Save

2. **Build cache causing issues**
   - Solution: Redeploy with "Clear Cache"

3. **Database connection failing**
   - Solution: Check DATABASE_URL is correct in Vercel

4. **Session storage failing**
   - Solution: Verify Session table exists in database

Please check the Function Logs first - they will show the exact error!