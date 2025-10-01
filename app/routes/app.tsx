import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Enhanced Shopify authentication with session token validation
  console.log('[APP LOADER] Starting enhanced authentication with session token validation');

  try {
    // First, try standard Shopify authentication
    const { admin, session } = await authenticate.admin(request);

    console.log('[APP LOADER] ✅ Standard authentication successful:', {
      shop: session.shop,
      hasAccessToken: !!session.accessToken,
      sessionId: session.id
    });

    return {
      shop: session.shop,
      apiKey: process.env.SHOPIFY_API_KEY
    };

  } catch (authError) {
    console.error('[APP LOADER] Authentication failed:', authError);

    // Import session token validation utilities
    const { validateSessionToken, createSessionTokenErrorResponse } = await import("../utils/session-token-validation.server");

    // Check if we have a valid session token that can be used for recovery
    const tokenValidation = validateSessionToken(request);

    if (tokenValidation.success) {
      console.log('[APP LOADER] 🔄 Valid session token found, attempting token exchange...');

      // If we have a valid session token but authentication failed,
      // redirect to bounce page to refresh the session
      const url = new URL(request.url);
      const shop = tokenValidation.shop || url.searchParams.get('shop') || 'example.myshopify.com';

      return new Response(null, {
        status: 302,
        headers: {
          'Location': `/session-token-bounce?shop=${encodeURIComponent(shop)}&shopify-reload=${encodeURIComponent(url.pathname + url.search)}`,
          'Cache-Control': 'no-cache'
        }
      });
    } else {
      console.log('[APP LOADER] ❌ No valid session token found, using session token error response');

      // No valid session token, return appropriate error response
      return createSessionTokenErrorResponse(tokenValidation, request.url);
    }
  }
};

export default function App() {
  return <Outlet />;
}

// Standard error boundary
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h2>Error {error.status}</h2>
        <p>{error.statusText}</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#008060',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif'
          }}
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
      <h2>Application Error</h2>
      <p>Something went wrong. Please try again.</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          backgroundColor: '#008060',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        Reload
      </button>
    </div>
  );
}