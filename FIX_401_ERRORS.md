# Fix Guide: 401 Unauthorized Errors in POS Extension

## Root Cause

The 401 errors are caused by **incomplete app reinstallation** after changing `direct_api_mode` from `"offline"` to `"online"` in `shopify.app.toml`.

According to Shopify documentation:
- When `direct_api_mode` changes, the OAuth token type changes
- Old offline tokens remain in session storage
- **The app must be FULLY uninstalled and reinstalled** to trigger proper OAuth reauthorization
- Simply clicking "Install" may not complete the full OAuth flow

## What's Already Fixed ✅

1. **Code Implementation**: POS authentication follows Shopify's best practices
2. **Configuration**: `shopify.app.toml` has correct settings:
   - `direct_api_mode = "online"` ✅
   - `embedded_app_direct_api_access = true` ✅
   - `pos.embedded = true` ✅
3. **URLs**: All point to `https://creditnote.vercel.app` ✅
4. **Database**: Correctly configured ✅
5. **Latest Code**: Version creditnote-166 deployed ✅

## Step-by-Step Fix

### Step 1: Clear Old Sessions from Database

Run this command to remove all old session tokens:

```bash
cd /Users/narissaranamkhan/Projects/creditnote/creditnote
npx tsx scripts/clear-sessions.ts
```

**Expected output:**
```
🧹 Clearing all Shopify sessions...
📊 Found X existing sessions
✅ Deleted X sessions
✅ Session cleanup complete!
```

### Step 2: Uninstall the App Completely

**IMPORTANT**: You must fully uninstall the app, not just click "Install" again.

1. Go to your Shopify Admin: `https://admin.shopify.com/store/[your-store]`
2. Navigate to: **Settings → Apps and sales channels**
3. Find "CreditNote" app
4. Click the app name
5. Click **"Uninstall"** button
6. Confirm uninstallation

**Wait 30 seconds** for the uninstallation to complete.

### Step 3: Reinstall the App with Full OAuth Flow

1. Install the app using the app URL or Partner Dashboard install link
2. You should see the **OAuth approval screen** with scopes:
   ```
   This app will be able to:
   - Read and write customers
   - Read and write orders
   - Read and write products
   - Read and write discounts
   - Read and write draft orders
   - [... all scopes from shopify.app.toml]
   ```
3. Click **"Install app"**
4. **Wait for the installation to complete** (you'll see a success message)

### Step 4: Verify Installation

After installation, verify the app is working:

1. **Check Admin Dashboard**: Open the CreditNote app from Shopify admin
   - You should see the app load without errors
   - You should be able to view credit notes

2. **Check Environment**:
   ```bash
   curl https://creditnote.vercel.app/api/health | jq '.checks'
   ```
   - All checks should show `"status": "healthy"`

### Step 5: Test POS Extension

1. Open **Shopify POS** on your device or POS web
2. Add a customer to the cart (REQUIRED)
3. Open the **CreditNote extension**
4. Fill in:
   - Customer Name: [any name]
   - Amount: 10
5. Click **"Create Credit Note"**

**Expected result**:
- Credit note created successfully
- No 401 errors
- Success screen with note number

### Step 6: If Errors Still Occur

If you still see 401 errors after following all steps:

1. **Check the logs**:
   ```bash
   # Get latest logs from Vercel
   vercel logs --scope=narissarahs-projects creditnote
   ```

2. **Look for these log entries**:
   - `[POS Auth] Validating session token from POS extension`
   - `[POS Auth] ✅ Session token validated successfully`
   - `[POS Auth] Exchanging session token for online access token`
   - `[POS Auth] ✅ Successfully exchanged session token`

3. **Check for specific error messages**:
   - `Token exchange failed`: API credentials issue
   - `Invalid token: audience mismatch`: API key mismatch
   - `No offline session found`: App not installed properly

4. **Verify Partner Dashboard settings**:
   - Go to [Shopify Partners](https://partners.shopify.com)
   - Open your CreditNote app
   - Check **App setup → Configuration**
   - Ensure `Application URL` is: `https://creditnote.vercel.app`
   - Ensure `Redirect URLs` include:
     - `https://creditnote.vercel.app/auth/callback`
     - `https://creditnote.vercel.app/auth/shopify/callback`
     - `https://creditnote.vercel.app/auth`

## Technical Details

### Why This Fix Works

**Before (Offline Mode):**
```
App Installation → Offline Token Created → Stored in Database
POS Request → Uses Offline Token → ❌ 401 Error (wrong token type)
```

**After (Online Mode with Reinstall):**
```
App Installation → Online OAuth Flow → Correct Token Type
POS Request → Session Token → Token Exchange → Online Access Token → ✅ Works
```

### Authentication Flow

```
1. POS Extension makes fetch() to creditnote.vercel.app
2. Shopify AUTOMATICALLY adds Authorization header with session token
3. Backend extracts session token from Authorization header
4. Backend validates session token (verifies JWT signature)
5. Backend exchanges session token for online access token
6. Backend uses access token with X-Shopify-Access-Token header
7. Shopify Admin GraphQL API accepts the request ✅
```

### Key Configuration

From `shopify.app.toml`:
```toml
[access.admin]
direct_api_mode = "online"              # ✅ CRITICAL for POS
embedded_app_direct_api_access = true   # ✅ Enables token exchange

[pos]
embedded = true                         # ✅ Enables POS extensions

[access_scopes]
scopes = "read_customers,write_customers,..."  # ✅ Inherited by exchanged tokens
```

## Troubleshooting

### Error: "No session token in Authorization header"

**Cause**: Extension is not deployed or not the latest version
**Fix**: Run `shopify app deploy --force` and wait for version to update in POS

### Error: "Token exchange failed: 403 Forbidden"

**Cause**: App not properly registered or API credentials mismatch
**Fix**:
1. Verify SHOPIFY_API_KEY matches `client_id` in shopify.app.toml
2. Verify SHOPIFY_API_SECRET is correct
3. Check Vercel environment variables

### Error: "GraphQL Client: Unauthorized"

**Cause**: This is the main issue - old tokens or improper installation
**Fix**: Follow the full reinstallation process above

### Error: "Unique constraint failed on noteNumber"

**Cause**: Separate issue - race condition in note number generation
**Status**: Already fixed in version 166 with retry mechanism

## Success Indicators

You'll know the fix worked when:

1. ✅ No "401 Unauthorized" errors in POS
2. ✅ Credit notes created successfully
3. ✅ Success screen appears with note number
4. ✅ Logs show: "✅ Successfully exchanged session token"
5. ✅ Customer metafield updates without errors

## Questions?

If you encounter any issues:
1. Share the exact error message
2. Share logs from: `vercel logs --scope=narissarahs-projects creditnote`
3. Confirm you completed ALL steps above in order
