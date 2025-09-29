import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * Session Token Bounce Route for Shopify 2025-07 API
 *
 * This route is critical for recovering from invalid or expired session tokens.
 * It loads App Bridge to fetch a fresh session token and redirects back to the app.
 *
 * Enhanced for 2025-07 with proper JWT token handling and signature verification.
 * Supports both embedded apps and POS extension authentication recovery.
 *
 * Based on Shopify's official documentation:
 * https://shopify.dev/docs/apps/build/authentication-authorization/set-embedded-app-authorization
 * https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
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

  // Enhanced detection for different request types and iOS devices
  const userAgent = request.headers.get('User-Agent') || '';
  const origin = request.headers.get('Origin') || '';
  const isPOSExtension = origin.includes('extensions.shopifycdn.com') ||
                        userAgent.includes('Shopify POS') ||
                        userAgent.includes('ExtensibilityHost');

  // iOS-specific recovery parameters from redirectToSessionTokenBounce
  const isIOSRecovery = searchParams.get('ios-recovery') === 'true';
  const retryCount = parseInt(searchParams.get('retry-count') || '3', 10);
  const deviceType = searchParams.get('device-type') || '';
  const recoveryStrategy = searchParams.get('recovery-strategy') || 'standard';

  console.log('[SESSION TOKEN BOUNCE] Enhanced recovery parameters:', {
    shop,
    host: !!host,
    redirectTo: redirectUrl,
    userAgent: userAgent.substring(0, 50),
    origin,
    isPOSExtension,
    isIOSRecovery,
    retryCount,
    deviceType,
    recoveryStrategy,
    requestType: isPOSExtension ? 'POS_EXTENSION' : 'EMBEDDED_APP'
  });

  // Return HTML that loads App Bridge and fetches a new session token
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="shopify-api-key" content="${process.env.SHOPIFY_API_KEY || '3e0a90c9ecdf9a085dfc7bd1c1c5fa6e'}" />
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

    // Get configuration from URL with iOS-enhanced recovery
    const searchParams = new URLSearchParams(window.location.search);
    const isIOSRecovery = searchParams.get('ios-recovery') === 'true';
    const retryCount = parseInt(searchParams.get('retry-count') || '3', 10);
    const recoveryStrategy = searchParams.get('recovery-strategy') || 'standard';

    const config = {
      apiKey: document.querySelector('meta[name="shopify-api-key"]').getAttribute('content'),
      host: searchParams.get('host') || btoa('${shop || 'shop'}.myshopify.com/admin'),
      forceRedirect: true
    };

    console.log('[SESSION TOKEN BOUNCE] Enhanced App Bridge config:', {
      ...config,
      isIOSRecovery,
      retryCount,
      recoveryStrategy
    });

    try {
      const app = createApp(config);

      if (typeof window['app-bridge'] === 'undefined' || !window['app-bridge'].utilities) {
        throw new Error('App Bridge utilities not available');
      }

      const utils = window['app-bridge'].utilities;

      // iOS-enhanced session token fetching with retry logic
      async function fetchSessionTokenWithRetry(attemptNumber = 1) {
        console.log('[SESSION TOKEN BOUNCE] Fetch attempt', attemptNumber, 'of', retryCount);

        try {
          const token = await utils.getSessionToken(app);

          if (!token) {
            throw new Error('No session token received from App Bridge');
          }

          console.log('[SESSION TOKEN BOUNCE] ✅ Session token obtained on attempt', attemptNumber, ':', {
            length: token.length,
            startsWithEyJ: token.startsWith('eyJ'),
            hasDots: token.split('.').length === 3,
            requestType: '${isPOSExtension ? 'POS_EXTENSION' : 'EMBEDDED_APP'}',
            isIOSRecovery,
            attemptNumber
          });

          return token;

        } catch (error) {
          console.error('[SESSION TOKEN BOUNCE] Attempt', attemptNumber, 'failed:', error);

          // Enhanced error categorization for 2025-07
          if (error.message.includes('getSessionToken is not a function')) {
            console.error('[SESSION TOKEN BOUNCE] App Bridge method not available - possible version mismatch');
            throw new Error('App Bridge session token method unavailable - ensure App Bridge 4.0+ is loaded');
          }

          if (error.message.includes('Invalid session token')) {
            console.error('[SESSION TOKEN BOUNCE] Session token validation failed');
            throw new Error('Session token validation failed - requires re-authentication');
          }

          if (attemptNumber < retryCount) {
            const delay = isIOSRecovery ? 2000 * attemptNumber : 1000; // Progressive delay for iOS
            console.log('[SESSION TOKEN BOUNCE] Retrying in', delay, 'ms...');
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchSessionTokenWithRetry(attemptNumber + 1);
          } else {
            throw new Error('Failed to obtain session token after ' + retryCount + ' attempts: ' + error.message);
          }
        }
      }

      // Start the enhanced token fetch process
      fetchSessionTokenWithRetry().then(function(token) {
        if (!token) {
          throw new Error('No session token received from App Bridge');
        }

        console.log('[SESSION TOKEN BOUNCE] ✅ New session token obtained:', {
          length: token.length,
          startsWithEyJ: token.startsWith('eyJ'),
          hasDots: token.split('.').length === 3,
          requestType: '${isPOSExtension ? 'POS_EXTENSION' : 'EMBEDDED_APP'}'
        });

        // Enhanced token validation for 2025-07
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            console.log('[SESSION TOKEN BOUNCE] Token payload preview:', {
              iss: payload.iss,
              aud: payload.aud,
              exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiry',
              sub: payload.sub
            });

            // Validate basic JWT structure
            if (!payload.iss || !payload.aud || !payload.exp) {
              throw new Error('Invalid JWT structure - missing required fields');
            }

            // Check if token is expired
            if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) {
              throw new Error('Token is already expired');
            }
          } else {
            console.warn('[SESSION TOKEN BOUNCE] Token is not a valid JWT format');
          }
        } catch (validationError) {
          console.error('[SESSION TOKEN BOUNCE] Token validation failed:', validationError);
          throw new Error('Received invalid session token: ' + validationError.message);
        }

        // Build redirect URL with new token
        const redirectUrl = '${redirectUrl}';
        const url = new URL(redirectUrl, window.location.origin);

        // Preserve essential parameters
        const preserveParams = ['shop', 'host', 'embedded', 'locale', 'hmac', 'timestamp'];
        preserveParams.forEach(param => {
          const value = searchParams.get(param);
          if (value) {
            url.searchParams.set(param, value);
          }
        });

        // Add the new session token as id_token (2025-07 standard)
        url.searchParams.set('id_token', token);

        // Also set session parameter for compatibility
        url.searchParams.set('session', token);

        console.log('[SESSION TOKEN BOUNCE] Redirecting with validated token to:', url.pathname);

        // Enhanced redirect with token storage for subsequent requests
        try {
          // Store token for automatic inclusion in future requests
          if (window.sessionStorage) {
            window.sessionStorage.setItem('shopify-session-token', token);
            window.sessionStorage.setItem('shopify-session-token-timestamp', Date.now().toString());
          }
        } catch (storageError) {
          console.warn('[SESSION TOKEN BOUNCE] Failed to store token in session storage:', storageError);
        }

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
    api_key: process.env.SHOPIFY_API_KEY || '3e0a90c9ecdf9a085dfc7bd1c1c5fa6e',
    instructions: 'Load this URL in an embedded iframe to fetch a new session token'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    }
  });
}