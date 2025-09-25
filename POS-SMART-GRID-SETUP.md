# 🎯 POS Smart Grid Setup Guide

## Critical Requirements for Smart Grid Activation

### ✅ Prerequisites
1. **POS Version**: Requires POS 10.6.0+
2. **User Login**: Must use **EMAIL/PASSWORD** (not PIN-only)
3. **App Permissions**: User must have app installation permissions
4. **Deployment**: Extensions must be deployed via `shopify app deploy`

### 🚀 Step-by-Step Activation Process

#### 1. Deploy POS Extensions
```bash
shopify app deploy
```

#### 2. Access POS Smart Grid Configuration
1. Open Shopify POS on your device
2. Navigate to: **Settings** → **Apps & Channels** → **POS Apps**
3. Find your **CreditNote** app
4. Click on each extension (QR Generator, Credit Manager, Redeem Credits)

#### 3. Manual Smart Grid Activation
For each extension showing "Not added":
1. Click **"Add"** button next to "Smart grid tile"
2. Confirm the tile activation
3. The status should change from "Not added" to "Added"

#### 4. Verify Smart Grid Tiles
1. Go to POS home screen
2. Look for the Smart Grid section
3. You should see your credit management tiles:
   - 📱 **Manage Credits** (shows active/total counts)
   - 🔍 **Redeem Credits** (barcode scanner)
   - 🎯 **QR Generator** (create QR codes)

### 🔧 Troubleshooting

#### "Not added" Status Persists
- **Solution**: Ensure POS user is logged in with email credentials
- **Check**: User has app permissions in Shopify admin
- **Verify**: POS version is 10.6.0 or higher

#### Extensions Show "0 credits"
- **Cause**: Authentication or permission issues
- **Fix**: Check session token validation in extension logs
- **Action**: Try logout/login from POS

#### "Setup required" Messages
- **Reason**: Session token validation failing
- **Resolution**: User must login with email (not PIN)
- **Verify**: App has proper Shopify admin permissions

### 📊 Expected Results After Setup

Once properly configured, your tiles should display:
- **QR Generator**: "X created today • Y active (Backend)"
- **Manage Credits**: "X active • Y total (Backend)"
- **Redeem Credits**: "X active • $Y.XX value (Backend)"

### ⚡ Quick Validation
1. All three extensions show "Added" status in POS Apps
2. Smart Grid tiles appear on POS home screen
3. Tiles show real credit counts (not "0 credits")
4. Backend authentication indicators appear in subtitles

---

**Note**: This is a **manual process** required by Shopify POS Smart Grid architecture. Extensions cannot auto-activate - they must be manually added by the POS user after deployment.