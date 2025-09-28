import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticateEmbeddedRequest } from "../utils/enhanced-auth.server";
import { handleRouteError, AppErrorFactory, ErrorRecoveryManager } from "../utils/advanced-error-handling.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];


export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log('[APP LOADER] Starting Shopify 2025-07 embedded authentication');

    // Use enhanced authentication with bot detection
    const authResult = await authenticateEmbeddedRequest(request);

    // BULLETPROOF: Enhanced bot detection to prevent "require is not defined" errors
    // Based on production logs showing vercel-favicon/1.0, vercel-screenshot/1.0 causing issues
    if (authResult.authMethod === 'BOT_DETECTED') {
      const userAgent = request.headers.get('User-Agent') || 'unknown';
      console.log('[APP LOADER] 🤖 Vercel bot request detected from:', userAgent);

      // Return minimal HTML that won't trigger serverless function compilation issues
      return new Response('<!DOCTYPE html><html><head><title>OK</title></head><body>OK</body></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'X-Bot-Detected': 'true',
          'X-User-Agent': userAgent.slice(0, 50) // Truncate for safety
        }
      });
    }

    if (!authResult.success) {
      console.warn('[APP LOADER] Authentication failed:', authResult.error);

      // ENHANCED 2025-07: Use token exchange instead of session bounces
      if (authResult.requiresBounce) {
        console.log('[APP LOADER] 🔄 2025-07 Enhanced Recovery: Using token exchange instead of session bounce');

        // Extract session token for token exchange recovery
        const url = new URL(request.url);
        const idToken = url.searchParams.get('id_token');
        const authHeader = request.headers.get('authorization');
        const sessionToken = idToken || authHeader?.replace('Bearer ', '');

        if (sessionToken) {
          console.log('[APP LOADER] 🔑 Attempting 2025-07 token exchange recovery...');

          try {
            // Use the token exchange implementation for recovery
            const { authenticateWithTokenExchange } = await import('../utils/token-exchange-2025-07.server');
            const tokenExchangeResult = await authenticateWithTokenExchange(sessionToken, request);

            if (tokenExchangeResult.success) {
              console.log('[APP LOADER] ✅ Token exchange recovery successful!');
              return {
                apiKey: process.env.SHOPIFY_API_KEY || "",
                shop: tokenExchangeResult.shop!,
                host: btoa(`${tokenExchangeResult.shop}/admin`),
              };
            } else {
              console.warn('[APP LOADER] ⚠️ Token exchange recovery failed:', tokenExchangeResult.error);
            }
          } catch (tokenExchangeError) {
            console.error('[APP LOADER] ❌ Token exchange recovery error:', tokenExchangeError);
          }
        }

        // Only fall back to bounce as last resort for session expiry (410 errors)
        if (authResult.authMethod === 'SESSION_EXPIRED_2025_07') {
          console.log('[APP LOADER] 🔄 Session expired (410) - using legacy bounce as last resort');
          throw new Response(null, {
            status: 302,
            headers: {
              'Location': `/session-token-bounce?shopify-reload=${encodeURIComponent(request.url)}`
            }
          });
        }
      }

      // For non-bounce errors, provide enhanced error response instead of generic error
      console.error('[APP LOADER] ❌ Authentication failed without recovery option');
      throw new Error(`Authentication failed: ${authResult.error || 'Unknown authentication error'}`);
    }

    console.log('[APP LOADER] ✅ Authentication successful:', {
      shop: authResult.shop,
      sessionId: authResult.session?.id,
      hasAccessToken: !!authResult.session?.accessToken,
      scope: authResult.session?.scope?.split(',').length + ' scopes',
      isOnline: authResult.session?.isOnline
    });

    const { session } = authResult;

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session.shop,
      host: btoa(`${session.shop}/admin`),
    };

  } catch (error) {
    console.error('[APP LOADER] Authentication failed - using advanced error handling:', error);

    // Use advanced error handling with recovery strategies
    return await handleRouteError(error, request);
  }
};

export default function App() {
  const { apiKey, shop, host } = useLoaderData<typeof loader>();

  // CRITICAL FIX: Ensure apiKey and shop are available for AppProvider
  if (!apiKey) {
    console.error('[APP] Missing API key - cannot initialize AppProvider');
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>Configuration Error</h2>
        <p>Missing Shopify API key. Please check your environment configuration.</p>
      </div>
    );
  }

  if (!shop) {
    console.error('[APP] Missing shop domain - cannot initialize AppProvider');
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>Authentication Required</h2>
        <p>This app must be accessed through Shopify Admin. Please install and access the app from your Shopify Admin panel.</p>
      </div>
    );
  }

  console.log('[APP] Initializing AppProvider with enhanced 2025-07 configuration:', {
    hasApiKey: !!apiKey,
    shop: shop,
    host: host,
    isEmbedded: true
  });

  // ENHANCED: App Bridge 4.0 configuration for proper session token handling
  return (
    <AppProvider
      isEmbeddedApp={true}
      apiKey={apiKey}
      config={{
        apiKey: apiKey,
        host: host || btoa(`${shop}/admin`), // Proper host encoding for App Bridge
        forceRedirect: true, // Force redirect for proper authentication flow
      }}
    >
      <Outlet />
    </AppProvider>
  );
}

// ENHANCED 2025-07: Advanced error boundary with session recovery
export function ErrorBoundary() {
  const error = useRouteError();

  console.error('[APP ERROR BOUNDARY] Error caught:', error);

  // Enhanced error handling with automatic recovery for different error types
  if (isRouteErrorResponse(error)) {
    // CRITICAL: Handle 410 Gone errors with session cleanup and recovery
    if (error.status === 410) {
      console.log('[APP ERROR] 410 Gone - clearing session and triggering re-auth');

      // Clear any cached session data
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage?.clear();
          window.localStorage?.removeItem('shopify-session');
          window.localStorage?.removeItem('shopify-app-session');
        } catch (e) {
          console.warn('[SESSION CLEANUP] Storage cleanup failed:', e);
        }
      }

      return (
        <html>
          <head>
            <title>Session Expired</title>
            <script dangerouslySetInnerHTML={{
              __html: `
                console.log('[410 RECOVERY] Initiating automatic session recovery...');
                // Clear any cached session data
                try {
                  if (window.sessionStorage) window.sessionStorage.clear();
                  if (window.localStorage) {
                    window.localStorage.removeItem('shopify-session');
                    window.localStorage.removeItem('shopify-app-session');
                  }
                } catch (e) {
                  console.warn('Storage cleanup failed:', e);
                }
                // Force re-authentication through Shopify
                setTimeout(() => {
                  window.top.location.href = '/auth';
                }, 2000);
              `
            }} />
          </head>
          <body style={{ fontFamily: 'Inter, sans-serif', padding: '20px', textAlign: 'center' }}>
            <div>
              <h2>Session Expired</h2>
              <p>Your Shopify session has expired. Redirecting to re-authenticate...</p>
              <div style={{ marginTop: '20px' }}>
                <button onClick={() => window.top.location.href = '/auth'} style={{
                  backgroundColor: '#008060',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}>
                  Re-authenticate Now
                </button>
              </div>
            </div>
          </body>
        </html>
      );
    }

    // Handle authentication errors with specific guidance
    if (error.status === 401 || error.status === 403) {
      console.log('[APP ERROR] Authentication error - providing recovery options');
      return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
          <h2>Authentication Required</h2>
          <p>Your session needs to be renewed to continue using the app.</p>
          <div style={{ margin: '20px 0', padding: '15px', background: '#f6f6f7', borderRadius: '4px' }}>
            <strong>Troubleshooting:</strong>
            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
              <li>Check your internet connection</li>
              <li>Ensure you're logged into Shopify admin</li>
              <li>Try clearing your browser cache</li>
            </ul>
          </div>
          <button onClick={() => window.location.reload()} style={{
            backgroundColor: '#008060',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}>
            Refresh & Re-authenticate
          </button>
        </div>
      );
    }

    // Handle server errors with enhanced diagnostics
    if (error.status >= 500) {
      return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
          <h2>Server Error ({error.status})</h2>
          <p>We're experiencing technical difficulties. Our team has been notified.</p>

          {error.data && (
            <details style={{ marginTop: '15px' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Technical Details (click to expand)
              </summary>
              <pre style={{
                background: '#f6f6f7',
                padding: '12px',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                marginTop: '8px',
                maxHeight: '200px'
              }}>
                {typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2)}
              </pre>
            </details>
          )}

          <div style={{ marginTop: '20px' }}>
            <button onClick={() => window.location.reload()} style={{
              backgroundColor: '#008060',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px',
              marginRight: '10px'
            }}>
              Try Again
            </button>
            <button onClick={() => window.history.back()} style={{
              backgroundColor: '#6c757d',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}>
              Go Back
            </button>
          </div>
        </div>
      );
    }

    // For other HTTP errors, show detailed status information
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>Request Error ({error.status}): {error.statusText}</h2>
        <p>Something went wrong with your request. Please try again.</p>

        {error.data && (
          <details style={{ marginTop: '15px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Error Details (click to expand)
            </summary>
            <pre style={{
              background: '#f6f6f7',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              marginTop: '8px',
              maxHeight: '200px'
            }}>
              {typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2)}
            </pre>
          </details>
        )}

        <div style={{ marginTop: '20px' }}>
          <button onClick={() => window.location.reload()} style={{
            backgroundColor: '#008060',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Handle JavaScript errors with enhanced debugging information
  if (error instanceof Error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>Application Error</h2>
        <p><strong>Error:</strong> {error.message}</p>
        <p style={{ color: '#6c757d', fontSize: '14px' }}>
          This error occurred in the application code. Please refresh the page or contact support if the problem persists.
        </p>

        {error.stack && (
          <details style={{ marginTop: '15px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Stack Trace (for debugging)
            </summary>
            <pre style={{
              background: '#f6f6f7',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '11px',
              overflow: 'auto',
              marginTop: '8px',
              maxHeight: '300px'
            }}>
              {error.stack}
            </pre>
          </details>
        )}

        <div style={{ marginTop: '20px' }}>
          <button onClick={() => window.location.reload()} style={{
            backgroundColor: '#008060',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}>
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // Fallback for unknown error types with safe handling
  console.error('[APP ERROR BOUNDARY] Unknown error type:', typeof error, error);

  try {
    // CRITICAL FIX: Handle errors manually to avoid "require is not defined"
    console.error('[APP ERROR] Handling error manually to avoid boundary issues:', error);
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h1>Application Error</h1>
        <p>The application encountered an error. Please refresh the page.</p>
        <button onClick={() => window.location.reload()} style={{
          backgroundColor: '#008060',
          color: 'white',
          padding: '12px 24px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}>
          Refresh Page
        </button>
      </div>
    );
  } catch (boundaryError) {
    console.error('[ERROR BOUNDARY] Critical failure:', boundaryError);
    return (
      <html>
        <head><title>Critical Error</title></head>
        <body style={{ fontFamily: 'Inter, sans-serif', padding: '20px', textAlign: 'center' }}>
          <div>
            <h1>Application Error</h1>
            <p>The application encountered a critical error. Please refresh the page.</p>
            <button onClick={() => window.location.reload()} style={{
              backgroundColor: '#008060',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}>
              Refresh Page
            </button>
          </div>
        </body>
      </html>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  // BULLETPROOF HEADERS: Ultra-safe implementation to prevent "require is not defined"
  try {
    // Extract request safely with comprehensive null checks
    const request = headersArgs?.request;
    let shopDomain = 'example.myshopify.com'; // Safe fallback

    // Safe domain extraction with error handling
    if (request) {
      try {
        const url = new URL(request.url || '');
        const shopParam = url.searchParams.get('shop');
        const shopHeader = request.headers.get('x-shopify-shop-domain');

        const extractedShop = shopParam || shopHeader;
        if (extractedShop && typeof extractedShop === 'string') {
          shopDomain = extractedShop.endsWith('.myshopify.com')
            ? extractedShop
            : `${extractedShop}.myshopify.com`;
        }
      } catch (urlError) {
        console.warn('[APP HEADERS] URL parsing failed, using fallback domain');
      }
    }

    // Manual headers creation - completely avoids any Shopify boundary functions
    const headers = new Headers();

    // 2025-07 COMPLIANT: Dynamic shop-specific CSP headers
    const cspValue = `frame-ancestors https://${shopDomain} https://admin.shopify.com;`;
    headers.set('Content-Security-Policy', cspValue);

    // Essential security headers
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-XSS-Protection', '1; mode=block');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Debug logging
    console.log(`[APP HEADERS] ✅ Headers set successfully for shop: ${shopDomain}`);

    return headers;

  } catch (criticalError) {
    // FAILSAFE: Return minimal working headers if anything fails
    console.error('[APP HEADERS] Critical error, using emergency fallback:', criticalError);

    const emergencyHeaders = new Headers();
    emergencyHeaders.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    emergencyHeaders.set('X-Frame-Options', 'ALLOWALL');
    emergencyHeaders.set('X-Content-Type-Options', 'nosniff');

    return emergencyHeaders;
  }
};
