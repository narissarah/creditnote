# POS UI Extensions Setup Guide - Fix "0 Credits" Issue

## 🎯 Goal
Fix POS smart grid tiles showing "0 total credit" when admin interface has credit note data.

## 📋 Step-by-Step Instructions

### Phase 1: Verify Admin Interface (REQUIRED FIRST)
1. **Open Shopify Admin**
2. **Go to Apps → CreditNote**
3. **Create 2-3 test credit notes**:
   - Customer Name: "Test Customer 1"
   - Amount: $50.00
   - Email: test@example.com (optional)
4. **Verify credit notes appear in the list**

### Phase 2: Enable POS User Permissions (CRITICAL)

#### Step 1: Access User Settings
1. **In Shopify Admin → Settings → Users and permissions**
2. **Find the user account used for POS**
3. **Click on the user name**

#### Step 2: Enable App Access
1. **Click on "Apps" tab**
2. **Look for "CreditNote" in the app list**
3. **Enable the toggle next to CreditNote**
4. **Click "Save"**

#### Step 3: Verify Account Type
1. **Ensure user has "Apps" permission scope**
2. **User must be "Staff account" not "POS-only"**
3. **User needs email/password login (not PIN-only)**

### Phase 3: Configure POS Login

#### Step 1: Check Login Method
1. **POS user MUST log in with email + password**
2. **PIN-only login will NOT work for app access**
3. **If user currently uses PIN, add email/password**

#### Step 2: Update User Credentials
1. **In Admin → Settings → Users**
2. **Click user → "Security"**
3. **Set up email/password if not already configured**
4. **Save changes**

### Phase 4: Test POS Extensions

#### Step 1: Refresh POS Session
1. **Log out of POS completely**
2. **Log back in using EMAIL + PASSWORD (not PIN)**
3. **Wait for full login to complete**

#### Step 2: Check Smart Grid Tiles
1. **Go to smart grid in POS**
2. **Look for all 3 CreditNote tiles**:
   - Credit Scanner
   - Credit Manager
   - Credit QR Generator
3. **Each should show actual credit data (not "0 credits")**

#### Step 3: Test Functionality
1. **Tap each tile to verify they open**
2. **Check that credit note data loads**
3. **Verify customer information appears**

## 🔍 Troubleshooting

### Issue: Still Shows "0 Credits"

#### Check 1: Credit Notes Exist
```
→ Admin → Apps → CreditNote
→ Should see list of credit notes
→ If empty, create test credit notes first
```

#### Check 2: User Permissions
```
→ Admin → Settings → Users → [POS User]
→ Apps tab → CreditNote should be ENABLED
→ Permission scope should include "Apps"
```

#### Check 3: Login Method
```
→ POS user logged in with EMAIL + PASSWORD?
→ PIN-only login will NOT work
→ Check user has email credentials set
```

#### Check 4: App Installation
```
→ Admin → Apps → CreditNote
→ Should show "Installed" status
→ If not, reinstall the app
```

### Issue: Authentication Errors

#### Solution 1: Clear POS Cache
1. **Log out of POS**
2. **Clear browser cache/data**
3. **Log back in with email/password**

#### Solution 2: Verify App URL
1. **Check shopify.app.toml**
2. **application_url = "https://creditnote-41ur.vercel.app"**
3. **Must match your deployed URL**

#### Solution 3: Check Environment Variables
1. **Visit: https://your-app-url/debug/auth**
2. **Verify all required variables are present**
3. **Check Vercel environment settings**

## ✅ Success Criteria

After completing this guide, you should see:

### POS Smart Grid:
- ✅ Credit Scanner shows credit count
- ✅ Credit Manager shows customer data
- ✅ Credit QR Generator works properly
- ✅ No "0 credits" messages
- ✅ No authentication errors

### Admin Interface:
- ✅ Credit notes create successfully
- ✅ No "Something went wrong" errors
- ✅ Proper validation messages
- ✅ Data persistence works

## 📞 If Problems Persist

### Check These URLs:
1. **Admin Interface**: `https://your-store.myshopify.com/admin/apps/creditnote`
2. **Debug Info**: `https://creditnote-41ur.vercel.app/debug/auth`
3. **Diagnostics**: `https://creditnote-41ur.vercel.app/api/pos/diagnostics`

### Common Solutions:
1. **Recreate user with email/password login**
2. **Reinstall the CreditNote app**
3. **Verify Vercel deployment is working**
4. **Check browser console for specific errors**

### Required App Permissions:
- `read_customers`
- `write_customers`
- `read_orders`
- `write_orders`
- `read_locations`

## 🎯 Quick Verification Test

1. **Admin**: Create credit note → Should work without errors
2. **POS Login**: Use email/password → Should authenticate successfully
3. **POS Tiles**: Check all 3 tiles → Should show credit data
4. **Debug URL**: Visit `/debug/auth` → Should show green checkmarks

**Expected Result**: POS extensions show real credit data matching admin interface!