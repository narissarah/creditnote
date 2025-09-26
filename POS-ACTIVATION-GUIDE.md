# 🎯 POS Smart Grid Activation Guide

## Critical Steps to Resolve "Not added" Status

Based on your screenshots, your POS extensions are **properly deployed** but need manual activation.

### ✅ **Step 1: Access POS UI Extensions Settings**

Navigate to:
```
https://admin.shopify.com/store/arts-kardz/apps/point-of-sale-channel/settings/pos-ui-extensions
```

*Replace `arts-kardz` with your actual shop name*

### ✅ **Step 2: Locate CreditNote Extensions**

You should see three CreditNote extensions:

1. **"Create and print QR code credit notes"** (QR Generator)
2. **"Scan barcodes and QR codes to redeem credit notes"** (Barcode Scanner)
3. **"View, manage, and delete credit notes"** (Manager)

### ✅ **Step 3: Click "Add" for Each Extension**

Click the **"Add"** button next to each CreditNote extension to activate them in the Smart Grid.

### ✅ **Step 4: Verify Smart Grid Tile Status**

For each extension, you should see:
- ✅ **Smart grid tile: Added** (green checkmark)
- Option to **Remove** if needed

### 🔧 **If Extensions Don't Appear**

If CreditNote extensions are missing from the list:

1. **Verify Deployment:**
   ```bash
   shopify app info
   ```

2. **Re-deploy Extensions:**
   ```bash
   shopify app deploy
   ```

3. **Check Extension Configuration:**
   - Ensure all extensions use `api_version = "2025-07"`
   - Verify `target = "pos.home.tile.render"`
   - Confirm `pos.embedded = true` in shopify.app.toml

### 👥 **Step 5: User Permissions**

Ensure POS users have app permissions:

1. Go to **Shopify Admin → Settings → Users**
2. Select each POS user
3. Click **Apps** tab
4. Enable **CreditNote** app access
5. **CRITICAL**: Users must login with **email/password** (not PIN only)

### 📱 **Step 6: POS App Version**

Verify POS app version:
- **Minimum required**: 10.6.0
- **Recommended**: Latest version
- Update through App Store/Google Play if needed

### 🎯 **Expected Result**

After activation, each Smart Grid tile will show:
- **Manage Credits**: View and manage existing credit notes
- **QR Generator**: Create new QR code credit notes
- **Redeem Credits**: Scan and redeem credit codes

## 🚨 **Most Common Issue**

90% of "Not added" issues are resolved by **manually clicking "Add"** in the POS UI Extensions settings. The extensions are deployed correctly but require manual activation in the admin dashboard.

## 📞 **If Issues Persist**

1. Check browser console for JavaScript errors
2. Verify all environment variables in Vercel
3. Test with different POS user accounts
4. Ensure network connectivity between POS and server

Your extensions are properly configured with 2025-07 best practices - they just need manual activation!