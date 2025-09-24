# CreditNote App - 410 Gone Error Solution Plan

## Critical Issue
URL mismatch between Shopify configuration and Vercel deployment causing 100% authentication failures.

## Root Causes
1. **Primary:** Domain mismatch - App configured for `creditnote.vercel.app` but deployed to `creditnote-k60kxncwj-narissarahs-projects.vercel.app`
2. **Secondary:** Session storage issues in serverless environment
3. **Tertiary:** Missing proper domain routing configuration

## Immediate Actions Required

### 1. Fix Domain Configuration (CRITICAL)
**Option A: Configure Vercel Domain (Recommended)**
```bash
# Add domain alias in Vercel
vercel alias set creditnote-k60kxncwj-narissarahs-projects.vercel.app creditnote.vercel.app
```

**Option B: Update Shopify Configuration**
- Update all references from `creditnote.vercel.app` to actual deployment URL
- Update in Shopify Partner Dashboard
- Update environment variables

### 2. Authentication Configuration Fixes
```typescript
// shopify.server.ts - Required changes
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: "2025-07" as ApiVersion,
  scopes: configuredScopes,
  appUrl: process.env.SHOPIFY_APP_URL, // Must match actual deployment
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  // Remove unstable_newEmbeddedAuthStrategy - DONE
  useOnlineTokens: true, // Change to true for better stability
});
```

### 3. Environment Variable Updates
```env
# Update in Vercel Dashboard
SHOPIFY_APP_URL=https://creditnote.vercel.app # Must match domain alias
```

### 4. Shopify Partner Dashboard Updates
1. Go to app settings
2. Update App URL to: `https://creditnote.vercel.app`
3. Update Allowed redirection URLs:
   - `https://creditnote.vercel.app/auth/callback`
   - `https://creditnote.vercel.app/auth/shopify/callback`
   - `https://creditnote.vercel.app/api/auth/callback`

### 5. POS UI Extensions Configuration
Ensure POS extensions use correct GraphQL endpoint:
```typescript
// extensions/*/src/index.tsx
const client = createGraphQLClient({
  apiVersion: '2025-07',
  // Use session token from POS
});
```

## Testing Checklist
- [ ] Domain alias configured in Vercel
- [ ] Environment variables updated
- [ ] Shopify Partner Dashboard updated
- [ ] Admin interface loads without 410 errors
- [ ] POS extensions show correct credit data
- [ ] Authentication flow completes successfully

## Expected Results
1. No more 410 Gone errors
2. Admin interface loads properly
3. POS UI extensions display correct credit note data
4. Consistent data between admin and POS

## Monitoring
- Check Vercel logs for 410 errors
- Monitor authentication success rate
- Verify POS data consistency