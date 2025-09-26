# CreditNote Production Deployment URLs

## CRITICAL: All URLs Must Point to Production Domain

**Production Domain**: `https://creditnote.vercel.app`

## Shopify Partner Dashboard Configuration

### App Setup → App URL
```
https://creditnote.vercel.app
```

### App Setup → Allowed redirection URL(s)
```
https://creditnote.vercel.app/auth/callback
https://creditnote.vercel.app/auth/shopify/callback
https://creditnote.vercel.app/auth
```

### Privacy Compliance Webhooks
```
Customers data request URL: https://creditnote.vercel.app/api/webhooks/customers/data_request
Customers redact URL: https://creditnote.vercel.app/api/webhooks/customers/redact
Shop redact URL: https://creditnote.vercel.app/api/webhooks/shop/redact
```

## Vercel Environment Variables

Add these in Vercel Dashboard → Project Settings → Environment Variables:

```env
# Shopify Configuration
SHOPIFY_API_KEY=3e0a90c9ecdf9a085dfc7bd1c1c5fa6e
SHOPIFY_API_SECRET=[your_secret_from_partner_dashboard]
SHOPIFY_APP_URL=https://creditnote.vercel.app
SHOPIFY_API_VERSION=2025-07
SHOPIFY_SCOPES=read_customers,read_discounts,read_draft_orders,read_inventory,read_locations,read_orders,read_products,unauthenticated_read_checkouts,unauthenticated_read_product_listings,unauthenticated_write_checkouts,write_customers,write_discounts,write_draft_orders,write_orders,write_products,read_locales,read_locations

# Database Configuration (Neon PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_URL=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_URL_NON_POOLING=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require
POSTGRES_PRISMA_URL=postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?connect_timeout=15&sslmode=require
POSTGRES_USER=neondb_owner
POSTGRES_HOST=ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech
POSTGRES_PASSWORD=npg_1j8NseTfaxkh
POSTGRES_DATABASE=neondb

# Environment
NODE_ENV=production
```

## Important Notes

1. **NEVER use preview deployment URLs** like `creditnote-gajwxnag8-narissarahs-projects.vercel.app`
2. **ALWAYS use the production domain**: `https://creditnote.vercel.app`
3. **Ensure consistency** across all configurations (Shopify, Vercel, app code)
4. **Database credentials** are for Neon PostgreSQL (not SQLite)

## Verification Checklist

- [ ] Shopify Partner Dashboard App URL: `https://creditnote.vercel.app`
- [ ] All redirect URLs use production domain
- [ ] Webhook URLs use production domain
- [ ] Vercel environment variables configured
- [ ] SHOPIFY_API_SECRET added to Vercel
- [ ] Database credentials point to Neon PostgreSQL
- [ ] NODE_ENV set to production

## Testing

1. Visit: `https://creditnote.vercel.app`
2. Should redirect to Shopify OAuth
3. After authorization, app loads in Shopify Admin
4. POS extensions appear in Smart Grid

Last Updated: 2025-09-26