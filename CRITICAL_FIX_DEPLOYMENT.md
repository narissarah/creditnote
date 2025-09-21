# 🚨 CRITICAL DEPLOYMENT FIX - Invalid Scopes Issue

## Root Cause Identified
The deployment failure is caused by the `SCOPES` environment variable on Vercel containing invalid scopes that don't exist in Shopify API 2025-07.

### Invalid Scopes Being Used:
- ❌ `read_customer_metafields` (doesn't exist)
- ❌ `write_customer_metafields` (doesn't exist)
- ❌ `read_pos_sessions` (doesn't exist)
- ❌ `write_pos_sessions` (doesn't exist)

## IMMEDIATE ACTIONS REQUIRED

### 1. Update Vercel Environment Variables
Go to: https://vercel.com/narissaranamkhan/creditnote/settings/environment-variables

**Find and Update the `SCOPES` variable to:**
```
read_customers,read_discounts,read_orders,write_customers,write_discounts,write_orders,read_products,write_products,read_inventory,unauthenticated_read_product_listings,unauthenticated_write_checkouts,unauthenticated_read_checkouts,read_locations,write_draft_orders,read_draft_orders
```

### 2. Critical Environment Variables to Verify
Ensure these are set correctly on Vercel:

```env
# Shopify App Configuration
SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
SHOPIFY_API_SECRET=[your-api-secret]
SHOPIFY_APP_URL=https://creditnote-41ur.vercel.app
SCOPES=read_customers,read_discounts,read_orders,write_customers,write_discounts,write_orders,read_products,write_products,read_inventory,unauthenticated_read_product_listings,unauthenticated_write_checkouts,unauthenticated_read_checkouts,read_locations,write_draft_orders,read_draft_orders

# Database Configuration
DATABASE_URL=[your-neon-database-url]
DATABASE_URL_UNPOOLED=[your-neon-database-url-unpooled]

# Session Configuration
SESSION_SECRET=[generate-a-secure-random-string]
```

### 3. Remove Any Cached Configurations
After updating environment variables:
1. Go to Vercel Dashboard
2. Navigate to your project
3. Click "Settings" → "Functions"
4. Clear Function Cache
5. Trigger a new deployment

### 4. Redeploy the Application
```bash
vercel --prod --force
```

## Valid Scopes for 2025-07 API

### Customer Scopes:
- `read_customers`
- `write_customers`

### Order Scopes:
- `read_orders`
- `write_orders`
- `read_draft_orders`
- `write_draft_orders`

### Product Scopes:
- `read_products`
- `write_products`
- `read_inventory`

### Discount Scopes:
- `read_discounts`
- `write_discounts`

### Location Scopes:
- `read_locations`

### Checkout Scopes:
- `unauthenticated_read_product_listings`
- `unauthenticated_write_checkouts`
- `unauthenticated_read_checkouts`

### Metafield Scopes (Valid Ones):
- `read_metaobjects`
- `write_metaobjects`
- `read_metaobject_definitions`
- `write_metaobject_definitions`

## Post-Deployment Steps

### 1. Verify Application is Running
- Visit: https://creditnote-41ur.vercel.app
- Should show Shopify app interface, not "Application Error"

### 2. Reinstall App on Test Store
- Uninstall CreditNote from your test store
- Clear browser cache
- Reinstall from: https://creditnote-41ur.vercel.app

### 3. Configure Smart Grid Extensions
- Go to: Settings → Point of Sale → POS Apps
- Remove any duplicate CreditNote entries
- Add extensions in this order:
  1. Credit Manager
  2. Barcode Scanner
  3. QR Generator

## Monitoring Checklist
- [ ] Vercel environment variables updated
- [ ] Application deploys without scope errors
- [ ] App loads without "Application Error"
- [ ] Can log into app from Shopify admin
- [ ] Smart Grid extensions show as "Added"
- [ ] POS tiles display actual credit data

## Emergency Rollback
If issues persist, rollback to last known working version:
```bash
vercel rollback
```

## Support
If deployment continues to fail after these steps:
1. Check Vercel logs for specific errors
2. Verify DATABASE_URL is correct
3. Ensure SESSION_SECRET is set
4. Contact Shopify Partner Support for API scope clarification