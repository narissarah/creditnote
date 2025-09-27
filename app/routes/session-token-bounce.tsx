import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Session Token Bounce Route for Shopify 2025-07 API
 *
 * This route is critical for recovering from invalid or expired session tokens.
 * It loads App Bridge to fetch a fresh session token and redirects back to the app.
 *
 * Based on Shopify's official documentation:
 * https://shopify.dev/docs/apps/build/authentication-authorization/set-embedded-app-authorization
 */

export async function loader({ request }: LoaderFunctionArgs) {
  console.log('[SESSION TOKEN BOUNCE] Initiating token recovery...');

  // IMPORTANT: Do not authenticate this request - just return HTML
  // This route is specifically for recovering from authentication failures

  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Get the redirect URL (where to go after getting new token)
  const redirectUrl = searchParams.get('shopify-reload') || '/app';
  const shop = searchParams.get('shop') || '';
  const host = searchParams.get('host') || '';

  console.log('[SESSION TOKEN BOUNCE] Recovery parameters:', {
    shop,
    host: !!host,
    redirectTo: redirectUrl,
    userAgent: request.headers.get('User-Agent')?.substring(0, 50)
  });

  // Return HTML that loads App Bridge and fetches a new session token
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="shopify-api-key" content="${process.env.SHOPIFY_API_KEY}" />
  <title>Authenticating...</title>
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <style>
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .spinner {
      display: inline-block;
      width: 50px;
      height: 50px;
      margin: 20px auto;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 {
      margin: 0 0 10px 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    p {
      margin: 0;
      opacity: 0.9;
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Authenticating with Shopify</h2>
    <p>Fetching new session token...</p>
  </div>

  <script>
    console.log('[SESSION TOKEN BOUNCE] Loading App Bridge and fetching session token...');

    // Initialize App Bridge
    const AppBridge = window['app-bridge'];
    const createApp = AppBridge.default;

    // Get configuration from URL
    const searchParams = new URLSearchParams(window.location.search);
    const config = {
      apiKey: document.querySelector('meta[name="shopify-api-key"]').getAttribute('content'),
      host: searchParams.get('host') || btoa('${shop || 'shop'}.myshopify.com/admin'),
      forceRedirect: true
    };

    console.log('[SESSION TOKEN BOUNCE] App Bridge config:', config);

    try {
      const app = createApp(config);

      if (typeof window['app-bridge'] === 'undefined' || !window['app-bridge'].utilities) {
        throw new Error('App Bridge utilities not available');
      }

      const utils = window['app-bridge'].utilities;

      // Fetch a new session token
      utils.getSessionToken(app).then(function(token) {
        if (!token) {
          throw new Error('No session token received');
        }

        console.log('[SESSION TOKEN BOUNCE] ✅ New session token obtained, length:', token.length);

        // Build redirect URL with new token
        const redirectUrl = '${redirectUrl}';
        const url = new URL(redirectUrl, window.location.origin);

        // Preserve essential parameters
        const preserveParams = ['shop', 'host', 'embedded', 'locale'];
        preserveParams.forEach(param => {
          const value = searchParams.get(param);
          if (value) {
            url.searchParams.set(param, value);
          }
        });

        // Add the new session token in Authorization header format
        // Note: URL parameters are for initial load, subsequent requests should use headers
        url.searchParams.set('id_token', token);

        console.log('[SESSION TOKEN BOUNCE] Redirecting with new token to:', url.pathname);

        // Redirect with new token
        window.location.href = url.toString();
      }).catch(function(error) {
        console.error('[SESSION TOKEN BOUNCE] ❌ Failed to get session token:', error);

        // Update UI to show error
        document.querySelector('.container').innerHTML = \`
          <div class="spinner"></div>
          <h2>Session Recovery Failed</h2>
          <p>Unable to obtain new session token. Redirecting to authentication...</p>
        \`;

        // Fallback: Try to redirect to auth
        setTimeout(() => {
          const authUrl = '/auth' + (searchParams.get('shop') ? '?shop=' + encodeURIComponent(searchParams.get('shop')) : '');
          window.location.href = authUrl;
        }, 2000);
      });
    } catch (error) {
      console.error('[SESSION TOKEN BOUNCE] ❌ Failed to initialize App Bridge:', error);

      // Emergency fallback
      document.querySelector('.container').innerHTML = \`
        <h2>Authentication Error</h2>
        <p>App Bridge initialization failed. Redirecting to login...</p>
      \`;

      setTimeout(() => {
        const authUrl = '/auth' + (searchParams.get('shop') ? '?shop=' + encodeURIComponent(searchParams.get('shop')) : '');
        window.location.href = authUrl;
      }, 3000);
    }
  </script>
</body>
</html>
  `.trim();

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}

/**
 * Handle POST requests for programmatic token refresh
 */
export async function action({ request }: LoaderFunctionArgs) {
  console.log('[SESSION TOKEN BOUNCE] POST request for token refresh');

  const formData = await request.formData();
  const shop = formData.get('shop')?.toString();
  const redirectTo = formData.get('redirect_to')?.toString() || '/app';

  if (!shop) {
    return new Response(JSON.stringify({
      error: 'Missing shop parameter',
      code: 'MISSING_SHOP'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Return bounce page configuration for programmatic use
  return new Response(JSON.stringify({
    success: true,
    bounce_url: `/auth/session-token-bounce?shop=${shop}&shopify-reload=${encodeURIComponent(redirectTo)}`,
    api_key: process.env.SHOPIFY_API_KEY,
    instructions: 'Load this URL in an embedded iframe to fetch a new session token'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}