// CRITICAL FIX: Dedicated 410 Gone error handler for Vercel serverless recovery
import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  const returnUrl = url.searchParams.get('return_url');

  console.log('[410 HANDLER] Processing 410 recovery for shop:', shop);

  if (shop) {
    const authUrl = `/auth?shop=${encodeURIComponent(shop)}`;
    console.log('[410 HANDLER] Redirecting to auth:', authUrl);
    return redirect(authUrl);
  }

  return json({
    success: false,
    error: '410 Gone - Session Expired',
    message: 'Please re-authenticate with Shopify',
    timestamp: new Date().toISOString()
  }, { status: 410 });
}

export default function Auth410Handler() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Session Recovery</title>
      </head>
      <body>
        <h1>🔄 Session Recovery</h1>
        <p>Recovering your authentication session...</p>
      </body>
    </html>
  );
}