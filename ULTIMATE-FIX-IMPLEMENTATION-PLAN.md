# CreditNote App - Ultimate Fix Implementation Plan

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **410 Gone Authentication Errors** (100% failure rate)
- Every `/app` request returns 410 Gone
- Authentication fails at `authenticate.admin()` call
- Affects both admin interface and POS extensions

### 2. **URL Configuration Mismatch**
- **Configured**: `https://creditnote.vercel.app`
- **Actual Deployment**: `creditnote-bq3fap6j1-narissarahs-projects.vercel.app`
- Domain alias not properly routing

### 3. **Missing Vercel Preset**
- Build warning: "The `vercelPreset()` Preset was not detected"
- Causing serverless function issues

### 4. **Session Storage Issues**
- Sessions not persisting in serverless environment
- Prisma session storage may be failing

## ✅ IMPLEMENTATION PLAN

### STEP 1: Fix Vercel Configuration
```javascript
// vite.config.ts - ADD THIS
import { vercelPreset } from '@vercel/remix/vite';

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_singleFetch: true
      }
    }),
    tsconfigPaths(),
    vercelPreset() // CRITICAL: Add this
  ],
});
```

### STEP 2: Fix Authentication Strategy
```typescript
// shopify.server.ts - UPDATE
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: "2025-07" as ApiVersion,
  scopes: configuredScopes,
  appUrl: process.env.SHOPIFY_APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  // REMOVE unstable_newEmbeddedAuthStrategy completely
  useOnlineTokens: false, // Use offline for better stability
});
```

### STEP 3: Update Environment Variables
```env
# CRITICAL: Must match your Partner Dashboard exactly
SHOPIFY_APP_URL=https://creditnote.vercel.app
```

### STEP 4: Fix Shopify Partner Dashboard
1. Log into Partner Dashboard
2. Go to your app settings
3. Update:
   - App URL: `https://creditnote.vercel.app`
   - Allowed redirection URLs:
     - `https://creditnote.vercel.app/auth/callback`
     - `https://creditnote.vercel.app/auth/shopify/callback`
     - `https://creditnote.vercel.app/api/auth/callback`

### STEP 5: Configure Vercel Domain Properly
```bash
# Set production domain
vercel domains add creditnote.vercel.app

# Remove old aliases
vercel alias rm creditnote-*.vercel.app

# Set clean alias
vercel alias set creditnote.vercel.app
```

### STEP 6: Fix POS Extensions Authentication
```typescript
// extensions/*/src/index.tsx
import { useApi } from '@shopify/ui-extensions-react/pos';

export default function Tile() {
  const api = useApi();

  // Use session token for GraphQL
  const fetchCredits = async () => {
    const token = await api.session.getSessionToken();
    const response = await fetch('/api/pos/credits', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    // Handle response
  };
}
```

### STEP 7: Add Health Check Route
```typescript
// app/routes/health.tsx
export async function loader() {
  return json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
}
```

## 📋 TODO LIST

1. ✅ Install Vercel preset: `npm install @vercel/remix`
2. ✅ Update vite.config.ts with vercelPreset()
3. ✅ Remove unstable_newEmbeddedAuthStrategy from shopify.server.ts
4. ✅ Set useOnlineTokens to false
5. ✅ Update Shopify Partner Dashboard URLs
6. ✅ Configure Vercel domain properly
7. ✅ Deploy with correct configuration
8. ✅ Test admin interface loads
9. ✅ Verify POS extensions show data
10. ✅ Confirm no more 410 errors

## 🚀 DEPLOYMENT COMMANDS

```bash
# 1. Install dependencies
npm install @vercel/remix

# 2. Build locally to test
npm run build

# 3. Deploy to Vercel
vercel --prod

# 4. Set domain alias
vercel alias set creditnote.vercel.app

# 5. Verify deployment
curl https://creditnote.vercel.app/health
```

## ⚠️ CRITICAL NOTES

1. **DO NOT** use unstable_newEmbeddedAuthStrategy - it's broken
2. **ENSURE** Partner Dashboard URLs match exactly
3. **VERIFY** environment variables are set in Vercel dashboard
4. **TEST** with a fresh browser/incognito mode

## 🎯 SUCCESS CRITERIA

- [ ] Admin interface loads without errors
- [ ] No more 410 Gone responses
- [ ] POS extensions display credit data
- [ ] Authentication flow completes
- [ ] Sessions persist correctly

## 🔍 MONITORING

Check these after deployment:
1. Vercel logs for any 410 errors
2. Network tab for failed auth requests
3. POS extension data loading
4. Session storage persistence