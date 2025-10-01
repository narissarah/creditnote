import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log('[APP LOADER] Starting modern 2025-07 embedded authentication');

  try {
    // Use standard Shopify authentication for embedded apps
    const { session } = await authenticate.admin(request);

    console.log('[APP LOADER] ✅ Authentication successful:', {
      shop: session.shop,
      hasAccessToken: !!session.accessToken,
      sessionId: session.id,
      isOnline: session.isOnline
    });

    return {
      shop: session.shop,
      apiKey: process.env.SHOPIFY_API_KEY
    };
  } catch (error) {
    console.error('[APP LOADER] Authentication failed:', error);

    // Let the error bubble up to be handled by the root error boundary
    throw error;
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