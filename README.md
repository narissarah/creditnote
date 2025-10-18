# CreditNote - Shopify POS Store Credit Extension

A Shopify POS UI Extension for creating, viewing, and redeeming store credit directly from Point of Sale.

## Features

- **Create Store Credit** - Issue store credit to customers from POS
- **View Store Credit** - Check customer store credit balances
- **Redeem Store Credit** - Apply store credit to purchases
- **QR Code Printing** - Print QR codes for easy redemption

## Architecture

**Type:** POS UI Extension-only app (no admin UI)

**Backend:** Minimal Remix API routes on Vercel for:
- QR code generation and printing
- POS logging
- Webhooks
- Health checks

**Extensions:** 3 POS UI extensions built with React:
- `extensions/create/` - Create store credit
- `extensions/redeem/` - Redeem store credit
- `extensions/view/` - View balances

**Database:** PostgreSQL via Prisma (Neon Database)

## Tech Stack

- **Framework:** Remix (Vercel deployment)
- **UI Extensions:** @shopify/ui-extensions-react (2025-07)
- **Database:** PostgreSQL + Prisma ORM
- **API:** Shopify Admin GraphQL API (2025-07)
- **Deployment:** Vercel (backend) + Shopify (extensions)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy extensions to Shopify
npx shopify app deploy
```

## Environment Variables

Required environment variables (set in Vercel):

```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app.vercel.app
DATABASE_URL=postgresql://...
```

## Deployment

1. **Backend:** Push to GitHub → Auto-deploys to Vercel
2. **Extensions:** Run `npx shopify app deploy --force`

## API Routes

- `/api/print-qr` - Generate and print QR codes
- `/api/pos-logs` - POS logging endpoint
- `/api/webhooks` - Shopify webhooks handler
- `/api/health` - Health check endpoint

## Store Credit Workflow

1. **Create:** Staff searches for customer → enters amount → creates credit → prints QR code
2. **View:** Staff searches for customer → views current balance
3. **Redeem:** Staff scans QR code or searches customer → enters redemption amount → processes

## Currency

Default currency: CAD (configurable via store settings)

## License

Proprietary
