import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticateEmbeddedRequest } from "../utils/enhanced-auth.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];


export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log('[APP LOADER] Starting Shopify 2025-07 embedded authentication');

    // Use enhanced authentication with bot detection
    const authResult = await authenticateEmbeddedRequest(request);

    // Handle bot detection - bots should not access the app route
    if (authResult.authMethod === 'BOT_DETECTED') {
      console.log('[APP LOADER] Bot request detected, returning 404');
      throw new Response('Not Found', { status: 404 });
    }

    if (!authResult.success) {
      console.warn('[APP LOADER] Authentication failed:', authResult.error);

      // Handle session expiry gracefully - only redirect to bounce if needed
      if (authResult.requiresBounce) {
        console.log('[APP LOADER] Session bounce required');
        throw new Response(null, {
          status: 302,
          headers: {
            'Location': `/session-token-bounce?shopify-reload=${encodeURIComponent(request.url)}`
          }
        });
      }

      throw new Error(`Authentication failed: ${authResult.error}`);
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
    console.error('[APP LOADER] Authentication failed - delegating to Shopify error handling:', error);
    // Re-throw to let Shopify's error handling take over
    throw error;
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
    return boundary.error(error);
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
  try {
    // ENHANCED HEADERS FIX: Comprehensive ESM-safe headers for Shopify 2025-07
    // Eliminates all potential "require is not defined" errors in serverless environments
    const headers = new Headers();

    // Essential CSP headers for Shopify embedded apps (2025-07 compliant)
    headers.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('X-Content-Type-Options', 'nosniff');

    // Security headers for production deployment
    headers.set('X-DNS-Prefetch-Control', 'off');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS headers for API endpoints and embedded app communication
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Session-Token, X-Shopify-Access-Token');
    headers.set('Access-Control-Max-Age', '86400');

    // Session token handling headers for App Bridge integration
    headers.set('X-Shopify-Retry-Invalid-Session-Request', '1');

    // Performance and caching headers
    headers.set('X-Powered-By', 'Shopify CreditNote App v3.0');

    console.log('[APP HEADERS] ✅ Enhanced headers configured successfully for Shopify 2025-07 embedded app');

    return headers;

  } catch (error) {
    // FAILSAFE: Minimal headers if any error occurs during header creation
    console.error('[APP HEADERS] ❌ Error creating headers, using failsafe:', error);

    const fallbackHeaders = new Headers();
    fallbackHeaders.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    fallbackHeaders.set('X-Frame-Options', 'ALLOWALL');
    fallbackHeaders.set('X-Content-Type-Options', 'nosniff');
    fallbackHeaders.set('Access-Control-Allow-Origin', '*');

    return fallbackHeaders;
  }
};
