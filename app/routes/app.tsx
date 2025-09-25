import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// SIMPLIFIED 2025-07: Use new embedded auth strategy (eliminates 410 errors)
const authenticateRequest = async (request: Request) => {
  console.log('[AUTH] Using Shopify 2025-07 embedded auth strategy with token exchange');

  try {
    // CRITICAL: Use new embedded auth strategy - no manual error recovery needed
    const { admin, session } = await authenticate.admin(request);

    console.log('[AUTH] ✅ Authentication successful with token exchange for shop:', session.shop);

    return {
      admin,
      session,
      authMethod: "SHOPIFY_MANAGED_2025",
      shopDomain: session.shop,
    };
  } catch (authError) {
    console.error('[AUTH] Authentication failed - letting Shopify handle recovery:', authError);
    // Let Shopify's new auth strategy handle all error recovery
    throw authError;
  }
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    console.log('[APP LOADER] Shopify 2025-07 embedded auth with token exchange');

    // Import bot detection locally to avoid circular dependencies
    const { handleBotAuthentication } = await import("../utils/bot-detection.server");

    // Handle bots before authentication
    const botResponse = handleBotAuthentication(request);
    if (botResponse) {
      return botResponse;
    }

    // SIMPLIFIED: Use new embedded auth strategy - eliminates 410 errors
    const { admin, session, authMethod } = await authenticateRequest(request);

    console.log('[APP LOADER] ✅ Token exchange authentication successful:', {
      method: authMethod,
      shop: session?.shop,
      sessionId: session?.id,
      hasAccessToken: !!session?.accessToken,
    });

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session?.shop,
      authMethod,
    };

  } catch (error) {
    console.error('[APP LOADER] Authentication failed - using Shopify managed recovery:', error);
    // Re-throw to let Shopify's new auth strategy handle everything
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

// ENHANCED 2025-07: Custom error boundary with detailed error reporting
export function ErrorBoundary() {
  const error = useRouteError();

  console.error('[APP ERROR BOUNDARY] Error caught:', error);

  // Enhanced error handling with detailed user feedback
  if (isRouteErrorResponse(error)) {
    // Handle specific HTTP errors with user-friendly messages
    if (error.status === 401 || error.status === 403) {
      console.log('[APP ERROR] Authentication error - redirecting');
      return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
          <h2>Authentication Required</h2>
          <p>Please refresh the page to re-authenticate with Shopify.</p>
          <button onClick={() => window.location.reload()} style={{
            backgroundColor: '#008060',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Refresh Page
          </button>
        </div>
      );
    }

    // Handle database or server errors with detailed info
    if (error.status === 500) {
      return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
          <h2>Server Error</h2>
          <p>We're experiencing technical difficulties. Details:</p>
          <pre style={{
            background: '#f6f6f7',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {error.data || error.statusText}
          </pre>
          <button onClick={() => window.location.reload()} style={{
            backgroundColor: '#008060',
            color: 'white',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '12px'
          }}>
            Try Again
          </button>
        </div>
      );
    }

    // For other HTTP errors, show status and details
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>Error {error.status}: {error.statusText}</h2>
        <p>Something went wrong with your request.</p>
        {error.data && (
          <pre style={{
            background: '#f6f6f7',
            padding: '12px',
            borderRadius: '4px',
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2)}
          </pre>
        )}
        <button onClick={() => window.location.reload()} style={{
          backgroundColor: '#008060',
          color: 'white',
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '12px'
        }}>
          Refresh Page
        </button>
      </div>
    );
  }

  // Handle JavaScript errors with detailed stack trace
  if (error instanceof Error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h2>Application Error</h2>
        <p><strong>Error:</strong> {error.message}</p>
        {error.stack && (
          <details style={{ marginTop: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              Stack Trace (click to expand)
            </summary>
            <pre style={{
              background: '#f6f6f7',
              padding: '12px',
              borderRadius: '4px',
              fontSize: '11px',
              overflow: 'auto',
              marginTop: '8px'
            }}>
              {error.stack}
            </pre>
          </details>
        )}
        <button onClick={() => window.location.reload()} style={{
          backgroundColor: '#008060',
          color: 'white',
          padding: '8px 16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '12px'
        }}>
          Refresh Page
        </button>
      </div>
    );
  }

  // Fallback for unknown error types
  console.error('[APP ERROR BOUNDARY] Unknown error type:', typeof error, error);
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
