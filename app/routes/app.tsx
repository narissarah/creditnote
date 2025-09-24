import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// BULLETPROOF: Standard Shopify 2025-07 authentication (eliminates 410 errors)
const authenticateRequest = async (request: Request) => {
  console.log('[AUTH] Using standard Shopify 2025-07 authentication pattern');

  try {
    // Use standard Shopify authentication - this is the most reliable approach
    const { admin, session } = await authenticate.admin(request);

    if (session?.shop) {
      console.log('[AUTH] ✅ Standard authentication successful for shop:', session.shop);

      return {
        admin,
        session,
        authMethod: "STANDARD_SHOPIFY_2025",
        shopDomain: session.shop,
        health: {
          status: 'optimal',
          message: 'Using standard Shopify authentication',
          sessionId: session.id,
          isOnline: session.isOnline,
          expires: session.expires
        }
      };
    }
  } catch (authError) {
    console.error('[AUTH] Standard authentication failed:', authError);

    // Check if it's a 410 error specifically
    if (authError instanceof Response && authError.status === 410) {
      console.error('[AUTH] 410 Gone error detected - session may have expired');
      throw authError; // Let the error boundary handle this
    }

    // For other errors, throw them to trigger proper Shopify auth flow
    throw authError;
  }

  // This should never be reached, but included for completeness
  throw new Error('Authentication failed - no valid session found');
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log('[APP LOADER] Standard Shopify 2025-07 authentication');

    // Import bot detection locally to avoid circular dependencies
    const { handleBotAuthentication } = await import("../utils/bot-detection.server");

    // Handle bots before authentication
    const botResponse = handleBotAuthentication(request);
    if (botResponse) {
      return botResponse;
    }

    // STANDARD: Use official Shopify authentication (prevents 410 errors)
    const { admin, session, authMethod, health } = await authenticateRequest(request);

    console.log('[APP LOADER] ✅ Authentication successful:', {
      method: authMethod,
      shop: session?.shop,
      sessionId: session?.id,
      isOnline: session?.isOnline,
      hasAccessToken: !!session?.accessToken,
      health: health?.status
    });

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session?.shop,
      authMethod,
      sessionHealth: {
        status: health?.status || 'optimal',
        message: health?.message || 'Standard authentication active'
      }
    };

  } catch (error) {
    console.error('[APP LOADER] Authentication failed:', error);

    // Enhanced error classification for debugging
    if (error instanceof Response) {
      console.error('[APP LOADER] Response error:', {
        status: error.status,
        statusText: error.statusText
      });

      // Let Shopify's boundary handle 410 errors properly
      if (error.status === 410) {
        console.warn('[APP LOADER] 410 Gone error - triggering Shopify auth flow');
      }
    }

    // Re-throw to let Shopify's boundary handler manage authentication
    throw error;
  }
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <Outlet />
    </AppProvider>
  );
}

// ENHANCED: Smart error boundary with session recovery for embedded apps
export function ErrorBoundary() {
  const error = useRouteError();

  try {
    console.error('[APP ERROR BOUNDARY] Error caught:', error);

    // Handle authentication errors specifically
    if (isRouteErrorResponse(error)) {
      console.error('[APP ERROR BOUNDARY] Route error response:', {
        status: error.status,
        statusText: error.statusText,
        data: error.data
      });

      // CRITICAL: Enhanced 410 Gone error handling
      if (error.status === 410) {
        console.log('[APP ERROR BOUNDARY] 410 Gone error - attempting session recovery');

        // Try to trigger App Bridge session refresh instead of redirect
        return (
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
              <title>Refreshing Session...</title>
              <script dangerouslySetInnerHTML={{
                __html: `
                  // Enhanced session recovery for embedded apps
                  (function() {
                    console.log('[SESSION RECOVERY] Starting session refresh...');

                    // Check if we're in an embedded context
                    if (window.top !== window.self) {
                      try {
                        // Force App Bridge session token refresh
                        if (window.shopify && window.shopify.app) {
                          console.log('[SESSION RECOVERY] Requesting new session token...');
                          window.shopify.app.getSessionToken().then(function(token) {
                            console.log('[SESSION RECOVERY] New session token obtained, reloading...');
                            window.location.reload();
                          }).catch(function(err) {
                            console.error('[SESSION RECOVERY] Token refresh failed:', err);
                            // Fallback to parent window refresh
                            window.top.location.href = window.location.href;
                          });
                        } else {
                          // Fallback: trigger parent window navigation
                          console.log('[SESSION RECOVERY] App Bridge not available, trying parent refresh');
                          setTimeout(function() {
                            window.top.location.href = window.location.href;
                          }, 1000);
                        }
                      } catch (e) {
                        console.error('[SESSION RECOVERY] Embedded context error:', e);
                        window.location.reload();
                      }
                    } else {
                      // Direct access - simple reload
                      console.log('[SESSION RECOVERY] Direct access detected, reloading page');
                      setTimeout(function() {
                        window.location.reload();
                      }, 2000);
                    }
                  })();
                `
              }} />
            </head>
            <body style={{
              padding: '20px',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              backgroundColor: '#f5f5f5'
            }}>
              <h2>🔄 Refreshing Authentication...</h2>
              <p>Your session has expired. We're automatically refreshing it for you.</p>
              <div style={{
                margin: '20px 0',
                padding: '10px',
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}>
                <p><strong>Status:</strong> Requesting new session token...</p>
                <div style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: '#4CAF50',
                    animation: 'progress 3s linear infinite'
                  }}></div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#666' }}>
                If this doesn't work automatically, please refresh your browser or contact support.
              </p>
              <style dangerouslySetInnerHTML={{
                __html: `
                  @keyframes progress {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                  }
                `
              }} />
            </body>
          </html>
        );
      }

      // Handle other authentication errors with improved UX
      if (error.status === 401 || error.status === 403) {
        console.log('[APP ERROR BOUNDARY] Authentication error - enhanced handling');

        return (
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
              <title>Authentication Required</title>
            </head>
            <body style={{
              padding: '20px',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
              backgroundColor: '#fff4f4'
            }}>
              <h2>🔐 Authentication Required</h2>
              <p>You need to authenticate with Shopify to continue.</p>
              <div style={{
                margin: '20px 0',
                padding: '15px',
                backgroundColor: '#fff',
                border: '1px solid #ffcccb',
                borderRadius: '4px'
              }}>
                <p><strong>Error {error.status}:</strong> {error.statusText}</p>
                <p>This usually happens when your session has expired or you don't have the required permissions.</p>
              </div>
              <button
                onClick={() => window.location.href = '/auth'}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#5865F2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Re-authenticate with Shopify
              </button>
            </body>
          </html>
        );
      }
    }

    // For all other errors, delegate to Shopify boundary
    return boundary.error(error);

  } catch (boundaryError) {
    console.error('[APP ERROR BOUNDARY] Boundary error:', boundaryError);

    // Enhanced fallback UI for critical failures
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Critical Error</title>
        </head>
        <body style={{
          padding: '20px',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center',
          backgroundColor: '#fff'
        }}>
          <h1>⚠️ Critical Error</h1>
          <p>Something went wrong with the authentication system.</p>
          <div style={{
            margin: '20px 0',
            padding: '15px',
            backgroundColor: '#f8f8f8',
            border: '1px solid #ddd',
            borderRadius: '4px',
            textAlign: 'left'
          }}>
            <p><strong>Error Details:</strong></p>
            <p style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {boundaryError instanceof Error ? boundaryError.message : 'Unknown error'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Refresh Page
            </button>
            <button
              onClick={() => window.location.href = '/auth'}
              style={{
                padding: '10px 20px',
                backgroundColor: '#5865F2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Re-authenticate
            </button>
          </div>
        </body>
      </html>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
