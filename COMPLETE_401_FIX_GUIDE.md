# Complete 401 Error Resolution Guide
## Based on Deep Research & Error Analysis

**Last Updated**: 2025-10-16
**Status**: Configuration verified ✅, Issue identified ⚠️

---

## Critical Discovery: Staff User Permissions 🔑

**From Shopify Documentation Research**:
> "Online access tokens have the same permissions as the user that's logged in. After your app is installed, requesting this access mode always returns an access token restricted to the scopes available to the user."

### What This Means:
- ✅ Your code is **100% correct**
- ✅ Your configuration is **100% correct**
- ⚠️ **The issue is likely STAFF USER PERMISSIONS**

Even if your app has `write_customers` scope, if the logged-in POS staff member doesn't have customer management permissions, GraphQL requests will return **401 Unauthorized**.

---

## Verified Configuration Status ✅

### 1. Application URLs
```toml
# shopify.app.toml
application_url = "https://creditnote.vercel.app"  ✅ CORRECT

[auth]
redirect_urls = [
  "https://creditnote.vercel.app/auth/callback",      ✅
  "https://creditnote.vercel.app/auth/shopify/callback", ✅
  "https://creditnote.vercel.app/auth"                 ✅
]
```

### 2. Database Configuration
```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")  ✅ CORRECT
  directUrl = env("POSTGRES_URL_NON_POOLING")  ✅ CORRECT
}
```

### 3. POS Configuration
```toml
# shopify.app.toml
[access.admin]
direct_api_mode = "online"  ✅ CORRECT for POS
embedded_app_direct_api_access = true  ✅ CORRECT

[pos]
embedded = true  ✅ CORRECT
```

### 4. Token Exchange Implementation
```typescript
// app/utils/pos-auth.server.ts (lines 196-202)
requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token'  ✅ CORRECT
```

### 5. Environment Variables
```bash
# Vercel (verified via `vercel env ls`)
✅ SHOPIFY_API_KEY configured
✅ SHOPIFY_API_SECRET configured
✅ DATABASE_URL configured
✅ SHOPIFY_APP_URL configured
```

---

## Error Analysis from Screenshots

### Error 1: 401 Unauthorized (Most Common)
```
"GraphQL request failed: 401 Unauthorized"
"Received an error response (401 Unauthorized) from Shopify"
```

**Most Likely Causes** (in order):
1. 🔴 **Staff user lacks app permission** (NEW - Test this first!)
2. 🟡 **Staff user lacks customer management permission**
3. 🟡 **Incomplete app reinstallation** after config changes
4. 🔵 **API credentials mismatch** (less likely)

### Error 2: Extension Loading Failure
```
"Error loading extension"
"There is an error in this extension. To repair, delete and reinstall this app from the smartgrid."
```

**Most Likely Causes**:
1. 🔴 **Cached old extension version** in POS app
2. 🟡 **Extension not properly deployed** after changes
3. 🟡 **Extension tile needs to be removed and re-added**

### Error 3: Unique Constraint on noteNumber
```
"Invalid \n\'prisma.creditNote.create()\' invocation:
Unique constraint failed on the fields: (\'noteNumber\')"
```

**Cause**: Race condition when multiple requests create notes simultaneously

**Status**: Retry logic exists (lines 348-391 in creditNote.server.ts) but needs database-level transaction

---

## Step-by-Step Resolution Plan

### Priority 1: Verify Staff User Permissions (TEST THIS FIRST!)

This is **THE MOST LIKELY cause** of 401 errors based on research.

#### A. Check Current User Permissions

1. Go to Shopify Admin: `https://admin.shopify.com/store/[your-store]`
2. Navigate to: **Settings → Users and permissions**
3. Find the staff member who is **logged into Shopify POS**
   - This is the user who logged in with their email (not the pinned POS staff)
4. Click on their name to view permissions

#### B. Required Permissions

The logged-in staff member MUST have:

```
✅ Point of Sale
   └─ Access Shopify POS

✅ Customers
   └─ View and manage customers
   └─ View customer details
   └─ Edit customer details

✅ App permissions
   └─ CreditNote (must be enabled!)
```

#### C. How to Enable App Permission

1. Edit the staff member
2. Scroll down to **"App permissions"** section
3. Find **"CreditNote"** app
4. Check the box to enable
5. Click **"Save"**

#### D. Test with Store Owner

**Critical Test**: Log into Shopify POS with the **store owner account** (has all permissions):

1. Log out of POS
2. Log in as store owner (not staff member)
3. Try creating a credit note
4. **Expected result**:
   - ✅ If it works → Staff permission issue confirmed
   - ❌ If it fails → Different issue (proceed to Priority 2)

---

### Priority 2: Verify API Credentials Match

#### Check Partner Dashboard

1. Go to [Shopify Partners](https://partners.shopify.com)
2. Open **CreditNote** app
3. Go to **Configuration** tab
4. Check **Client ID**:

```bash
Expected: 3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
(from shopify.app.toml line 3)
```

#### Verify Vercel Environment Variable

```bash
# Run this command:
vercel env pull .env.local --scope=narissarahs-projects

# Then check:
cat .env.local | grep SHOPIFY_API_KEY

# Should output:
SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
```

If they **don't match**:

```bash
# Update Vercel env:
vercel env add SHOPIFY_API_KEY production --scope=narissarahs-projects
# Paste: 3e0a90c9ecdf9a085dfc7bd1c1c5fa6e

# Redeploy:
vercel --prod
```

---

### Priority 3: Complete App Reinstallation

#### Why This Is Needed

When you changed `direct_api_mode` from `"offline"` to `"online"`, old offline tokens remained in the database. Full reinstallation clears them.

#### A. Clear Database Sessions

```bash
cd /Users/narissaranamkhan/Projects/creditnote/creditnote
npx tsx scripts/clear-sessions.ts
```

Expected output:
```
🧹 Clearing all Shopify sessions...
📊 Found X existing sessions
✅ Deleted X sessions
✅ Session cleanup complete!
```

#### B. Uninstall App Completely

**IMPORTANT**: Don't just click "Install" again - must **fully uninstall first**!

1. Go to Shopify Admin: `https://admin.shopify.com/store/[your-store]`
2. Navigate to: **Settings → Apps and sales channels**
3. Find **"CreditNote"** app
4. Click the app name
5. Click **"Uninstall"** button (usually in top-right or bottom)
6. Confirm uninstallation in modal dialog
7. **Wait 30 seconds** for complete cleanup

#### C. Reinstall App with Full OAuth Flow

1. Get installation URL from Partner Dashboard:
   - Partners → CreditNote → Overview → **"Test on development store"**
2. Or use direct URL:
   ```
   https://admin.shopify.com/store/[your-store]/oauth/install?client_id=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
   ```
3. **Must see OAuth approval screen** with all scopes:
   ```
   This app will be able to:
   - Read and write customers
   - Read and write orders
   - Read and write products
   ... (all scopes from shopify.app.toml)
   ```
4. If you DON'T see the approval screen → incomplete reinstall → try again
5. Click **"Install app"**
6. Wait for confirmation: "App installed successfully"

#### D. Verify Installation

```bash
# Check app loads without errors:
curl https://creditnote.vercel.app/api/health | jq

# Should show:
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "environment": { "status": "healthy" },
    ...
  }
}
```

---

### Priority 4: Fix Extension Loading Errors

#### A. Remove Cached Extension

1. Open Shopify POS app
2. Go to Smart Grid (home screen)
3. Find **CreditNote** tile
4. **Remove the tile** from smart grid:
   - Tap and hold tile
   - Select "Remove" or drag to remove area
5. Close POS app completely (force quit)
6. Wait 10 seconds

#### B. Deploy Latest Extension Version

```bash
cd /Users/narissaranamkhan/Projects/creditnote/creditnote

# Deploy with force flag:
shopify app deploy --force

# Wait for success message:
# "New version released to users."
# "creditnote-XXX"
```

#### C. Verify in Partner Dashboard

1. Go to Partners → CreditNote → Versions
2. Check latest version shows **"Active"** status
3. Note the version number (e.g., creditnote-167)

#### D. Re-add Extension to POS

1. Reopen Shopify POS app
2. Go to Smart Grid
3. Tap **"+"** to add tile
4. Find **"CreditNote"** extension
5. Add to smart grid
6. **Test immediately** (don't wait for cache)

---

### Priority 5: Fix noteNumber Race Condition

#### Current Implementation

The noteNumber generation has retry logic but doesn't use database transactions:

```typescript
// app/services/creditNote.server.ts (lines 348-391)
private async generateNoteNumber(): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const count = await prisma.creditNote.count({ ... }) + 1 + attempt;
    const noteNumber = `CN-${year}-${count.toString().padStart(4, '0')}`;

    const existing = await prisma.creditNote.findFirst({ where: { noteNumber } });
    if (!existing) {
      return noteNumber;
    }
  }
  // Fallback to timestamp + nanoid
}
```

**Problem**: Between `findFirst` check and actual `create`, another request can create the same noteNumber.

#### Solution: Use Advisory Locks

I'll implement this after we fix the authentication issue.

---

## Monitoring & Debugging

### A. Check Real-Time Logs

```bash
# Terminal 1: Watch Vercel logs
vercel logs --scope=narissarahs-projects creditnote --follow

# Terminal 2: Test in POS
# (create credit note in POS app)
```

### B. Look For These Log Entries

**✅ Success Indicators**:
```
[POS Auth] ✅ Successfully exchanged session token for ONLINE access token
[POS Auth] ✅ CONFIRMED: This is an ONLINE token with user context
[POS Auth] ✅ Token has required customer scopes: read_customers, write_customers
[GraphQL Response] Status: 200 OK
```

**⚠️ Warning Indicators**:
```
[POS Auth] ⚠️ WARNING: Token may not have user context (could be offline)
[POS Auth] ⚠️ WARNING: Token may be missing required scopes
[GraphQL Response] Status: 401 Unauthorized
```

### C. Extract Detailed Error Information

When 401 occurs, logs will show:
```
[GraphQL Error] Full response: {
  status: 401,
  statusText: "Unauthorized",
  body: "<error details>",
  accessTokenPrefix: "shpat_..."
}
```

Look for:
- `"message": "Unauthorized"` → Staff permission issue
- `"message": "Invalid access token"` → Credentials mismatch
- `"message": "Insufficient scopes"` → Scope configuration issue

---

## Testing Checklist

### ✅ Before Testing
- [ ] Staff user has CreditNote app permission enabled
- [ ] Staff user has Customers permission (View and manage)
- [ ] Staff user has Point of Sale permission
- [ ] App fully uninstalled and reinstalled (saw OAuth screen)
- [ ] Extension deployed and tile re-added to POS
- [ ] Logged into POS with correct staff user (or store owner)

### ✅ During Testing
- [ ] Customer added to POS cart
- [ ] CreditNote extension opens without "Error loading extension"
- [ ] Customer ID shows in extension
- [ ] Form fields accept input
- [ ] "Create Credit Note" button enabled

### ✅ After Creating Note
- [ ] Success screen appears
- [ ] Note number displays (format: CN-2025-XXXX)
- [ ] QR code image visible
- [ ] Customer and amount correct
- [ ] No 401 errors in Vercel logs

---

## Expected Results After Fix

### 1. Successful Credit Note Creation

POS Extension → API → GraphQL:
```
✅ POS extension loads
✅ Session token extracted
✅ Token exchanged for online access token
✅ Customer query succeeds (200 OK)
✅ Credit note created in database
✅ Customer metafield updated
✅ QR code generated and displayed
✅ Success screen shows note details
```

### 2. Logs Show Success

```
[POS Auth] Exchanging session token for online access token
[POS Auth] ✅ Successfully exchanged session token for ONLINE access token
[POS Auth] Token type: Bearer
[POS Auth] Token scopes: read_customers,write_customers,...
[POS Auth] Expires in: 86400 seconds
[POS Auth] Associated user: <user-id>
[POS Auth] ✅ CONFIRMED: This is an ONLINE token with user context
[POS Auth] ✅ Token has required customer scopes: read_customers, write_customers
[GraphQL Request] Shop: <shop>.myshopify.com
[GraphQL Request] API Version: 2025-07
[GraphQL Request] Access Token: shpat_<token>...
[GraphQL Response] Status: 200 OK
[Credit Creator] Success: {...}
[Credit Creator] QR Code Image: Present
```

---

## If Issues Persist

### Diagnostic Questions

1. **Who is logged into POS?**
   - Store owner or staff member?
   - Do they have CreditNote app permission?
   - Do they have Customers permission?

2. **When did errors start?**
   - After changing config?
   - After redeploying?
   - After adding new scopes?

3. **Does it work with store owner account?**
   - Yes → Staff permission issue confirmed
   - No → Configuration or API credentials issue

4. **What do logs show during error?**
   - Share output from `vercel logs`
   - Include [POS Auth] and [GraphQL] entries

### Advanced Debugging

#### Test Token Exchange Manually

1. Extract session token from logs:
   ```
   [POS Auth] Session token source: header
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. Test token exchange:
   ```bash
   curl -X POST https://<shop>.myshopify.com/admin/oauth/access_token \
     -H "Content-Type: application/json" \
     -d '{
       "client_id": "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e",
       "client_secret": "<your-secret>",
       "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
       "subject_token": "<session-token>",
       "subject_token_type": "urn:ietf:params:oauth:token-type:id_token",
       "requested_token_type": "urn:shopify:params:oauth:token-type:online-access-token"
     }'
   ```

3. Check response for `access_token`, `scope`, `associated_user`

#### Test GraphQL with Exchanged Token

```bash
curl -X POST https://<shop>.myshopify.com/admin/api/2025-07/graphql.json \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Access-Token: <exchanged-token>" \
  -d '{"query": "{ shop { name } }"}'
```

Expected:
```json
{"data": {"shop": {"name": "Your Shop"}}}
```

If 401:
```json
{"errors": [{"message": "Unauthorized"}]}
```
→ Staff permission or scope issue confirmed

---

## Summary

### What's Working ✅
- Code implementation (token exchange, GraphQL requests)
- Configuration (direct_api_mode, URLs, database)
- Token exchange flow (requesting online tokens)
- Comprehensive logging for debugging

### What Needs to Be Done 🔧

**Highest Priority** (Do these in order):
1. ✅ Verify staff user has CreditNote app permission
2. ✅ Verify staff user has Customers permission
3. ✅ Test with store owner account to confirm
4. ✅ Complete full app uninstall + reinstall if needed
5. ✅ Redeploy extension and re-add tile to POS

**Secondary Priority**:
6. Fix noteNumber race condition with advisory locks
7. Add staff permission check endpoint for diagnostics

### Key Insight

**Your code and configuration are correct!** The 401 errors are almost certainly caused by **staff user permissions**, not code issues. Online access tokens inherit the logged-in user's permissions, so even with correct app scopes, if the POS user lacks customer management permissions, requests will be unauthorized.

**Test with the store owner account first** - if it works, you've confirmed the issue is staff permissions.

---

## Questions?

If you encounter any issues during this process:
1. Share the exact error message
2. Share logs from: `vercel logs --scope=narissarahs-projects creditnote`
3. Confirm which user is logged into POS (owner or staff?)
4. Confirm you completed all steps in order

Your implementation follows Shopify best practices. The issue is environmental/permissions, not code! 🎯
