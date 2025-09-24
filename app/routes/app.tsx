import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// VERCEL OPTIMIZED: Enhanced Shopify authentication with 410 error recovery
const authenticateRequest = async (request: Request) => {
  console.log('[AUTH] Using Vercel-optimized Shopify authentication with 410 recovery');

  try {
    // Use standard Shopify authentication - this is the most reliable approach
    const { admin, session } = await authenticate.admin(request);

    if (session?.shop) {
      console.log('[AUTH] ✅ Standard authentication successful for shop:', session.shop);

      return {
        admin,
        session,
        authMethod: "VERCEL_OPTIMIZED_2025",
        shopDomain: session.shop,
        health: {
          status: 'optimal',
          message: 'Using Vercel-optimized Shopify authentication',
          sessionId: session.id,
          isOnline: session.isOnline,
          expires: session.expires
        }
      };
    }
  } catch (authError) {
    console.error('[AUTH] Authentication failed:', authError);

    // CRITICAL FIX: Handle 410 Gone errors with session recovery
    if (authError instanceof Response && authError.status === 410) {
      console.warn('[AUTH] 410 Gone error detected - attempting session recovery');

      try {
        // Import session recovery locally to avoid circular dependencies
        const { recoverFromAuthError } = await import("../utils/session-manager.server");
        const recoveredSession = await recoverFromAuthError(request, authError);

        if (recoveredSession) {
          console.log('[AUTH] ✅ Session recovery successful');

          // Create admin client with recovered session
          const { admin } = await authenticate.admin(request);

          return {
            admin,
            session: recoveredSession,
            authMethod: "RECOVERED_SESSION_2025",
            shopDomain: recoveredSession.shop,
            health: {
              status: 'recovered',
              message: 'Session recovered from 410 error',
              sessionId: recoveredSession.id,
              isOnline: recoveredSession.isOnline,
              expires: recoveredSession.expires
            }
          };
        }
      } catch (recoveryError) {
        console.error('[AUTH] Session recovery failed:', recoveryError);
      }

      // If recovery failed, throw original error to trigger proper auth flow
      throw authError;
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

      // VERCEL CRITICAL FIX: Enhanced 410 Gone error handling with session recovery
      if (error.status === 410) {
        console.log('[APP ERROR BOUNDARY] 410 Gone error - attempting Vercel-optimized session recovery');

        // Extract shop parameter for recovery
        const url = new URL(window.location.href);
        const shop = url.searchParams.get('shop') || 'unknown';
        const returnUrl = encodeURIComponent(window.location.href);

        // Redirect to dedicated 410 handler
        return (
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
              <title>Session Recovery - CreditNote</title>
              <script dangerouslySetInnerHTML={{
                __html: `
                  // VERCEL OPTIMIZED: Enhanced session recovery for embedded apps
                  (function() {
                    console.log('[410 RECOVERY] Starting Vercel-optimized session recovery...');

                    const shop = new URLSearchParams(window.location.search).get('shop') || 'unknown';
                    const returnUrl = encodeURIComponent(window.location.href);

                    // Check if we're in an embedded context
                    if (window.top !== window.self) {
                      try {
                        // Try App Bridge token refresh first
                        if (window.shopify && window.shopify.app) {
                          console.log('[410 RECOVERY] Attempting App Bridge token refresh...');
                          window.shopify.app.getSessionToken()
                            .then(function(token) {
                              console.log('[410 RECOVERY] New session token obtained');
                              // Redirect to 410 handler with new token
                              window.location.href = '/auth/410-handler?shop=' + shop + '&return_url=' + returnUrl + '&token=' + encodeURIComponent(token);
                            })
                            .catch(function(err) {
                              console.warn('[410 RECOVERY] App Bridge token refresh failed, using fallback:', err);
                              // Fallback to 410 handler without token
                              window.location.href = '/auth/410-handler?shop=' + shop + '&return_url=' + returnUrl;
                            });
                        } else {
                          console.log('[410 RECOVERY] App Bridge not available, using direct recovery');
                          // Direct recovery via 410 handler
                          setTimeout(function() {
                            window.location.href = '/auth/410-handler?shop=' + shop + '&return_url=' + returnUrl;
                          }, 1000);
                        }
                      } catch (e) {
                        console.error('[410 RECOVERY] Embedded context error:', e);
                        // Fallback to auth route
                        window.location.href = '/auth?shop=' + shop;
                      }
                    } else {
                      // Direct access - redirect to 410 handler
                      console.log('[410 RECOVERY] Direct access detected, redirecting to recovery handler');
                      setTimeout(function() {
                        window.location.href = '/auth/410-handler?shop=' + shop + '&return_url=' + returnUrl;
                      }, 1500);
                    }
                  })();
                `
              }} />
            </head>
            <body style={{
              padding: '20px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: 0
            }}>
              <div style={{
                backgroundColor: 'white',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                maxWidth: '500px'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔄</div>
                <h2 style={{ color: '#333', marginBottom: '16px' }}>Recovering Session</h2>
                <p style={{ color: '#666', lineHeight: 1.5, marginBottom: '20px' }}>Your authentication session expired in our serverless environment. We're recovering it now...</p>
                <div style={{
                  margin: '20px 0',
                  padding: '15px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #e9ecef',
                  borderRadius: '8px'
                }}>
                  <p style={{ margin: 0, color: '#495057' }}><strong>Status:</strong> Initiating session recovery...</p>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginTop: '10px'
                  }}>
                    <div style={{
                      height: '100%',
                      backgroundColor: '#28a745',
                      animation: 'progress 3s linear infinite'
                    }}></div>
                  </div>
                </div>
                <p style={{ fontSize: '12px', color: '#6c757d', margin: 0 }}>
                  Vercel serverless optimization in progress...
                </p>
              </div>
              <style dangerouslySetInnerHTML={{
                __html: `
                  @keyframes progress {
                    0% { width: 0%; }
                    25% { width: 30%; }
                    50% { width: 60%; }
                    75% { width: 85%; }
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
