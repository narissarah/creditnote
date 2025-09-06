# Fix Instructions for Credit Note App Issues

## Issues Identified and Fixed

### 1. 500 Error on Login Route ✅
**Problem:** The app was trying to access `/login` but throwing an error.
**Fix Applied:** Updated the redirect in `/app/routes/login.tsx` to properly return a redirect instead of throwing it.

### 2. React Hydration Errors (418, 425, 423) ✅
**Problem:** Client-side only libraries and SSR mismatches were causing hydration errors.
**Fixes Applied:**
- Commented out `Html5Qrcode` import in `app/routes/app._index.tsx` (line 18) - this library doesn't support SSR
- The `useBreakpoints` hook is already properly handled with null-safe operations

### 3. Settings Page
The settings page code looks correct. If it's showing blank, it might be a database migration issue.

### 4. Create Credit Note
The create credit note functionality uses a separate route (`app.credit-notes.new.tsx`). The main app uses a modal instead.

## Database Migration Needed

Run these commands to ensure your database is up to date:

```bash
# Generate Prisma client
npx prisma generate

# Push database changes
npx prisma db push

# Optional: Run migrations if you have them
npx prisma migrate deploy
```

## Environment Variables Required

Make sure your `.env` file has these variables:

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-cloudflare-tunnel-url.trycloudflare.com
SCOPES=write_products,read_products,write_customers,read_customers,write_orders,read_orders
DATABASE_URL=your_database_url
```

## Additional Fixes for Hydration Errors

If hydration errors persist, add this to `app/routes/app._index.tsx`:

Replace line 191-192:
```typescript
// Ensure breakpoints default to desktop on initial render
const isMobile = breakpoints?.smDown ?? false;
```

With:
```typescript
// Ensure breakpoints default to desktop on initial render
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  if (breakpoints?.smDown !== undefined) {
    setIsMobile(breakpoints.smDown);
  }
}, [breakpoints?.smDown]);
```

## Cloudflare Tunnel Issue

Your Cloudflare tunnel URL (`clicking-pat-pools-cookies.trycloudflare.com`) is not resolving. You need to:

1. Restart your Cloudflare tunnel:
```bash
# If using cloudflared
cloudflared tunnel run

# Or if using ngrok
ngrok http 3000
```

2. Update the `SHOPIFY_APP_URL` in your `.env` file with the new tunnel URL

3. Update the app URL in your Shopify Partner Dashboard

## Running the App

1. Install dependencies:
```bash
npm install
```

2. Set up database:
```bash
npx prisma generate
npx prisma db push
```

3. Start development server:
```bash
npm run dev
```

## Testing Authentication

1. Make sure your app is installed on a development store
2. Access the app through the Shopify Admin (not directly via the tunnel URL)
3. The authentication flow should work through the embedded app iframe

## If Issues Persist

1. Clear browser cache and cookies
2. Reinstall the app on your development store
3. Check the browser console for specific error messages
4. Ensure all environment variables are correctly set