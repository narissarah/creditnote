import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
    return { apiKey: process.env.SHOPIFY_API_KEY || "" };
  } catch (error) {
    console.error('[APP LOADER] Authentication failed:', error);
    console.error('[APP LOADER] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      url: request.url,
      headers: Object.fromEntries(request.headers.entries())
    });

    // Re-throw the error to let Shopify's boundary handler manage it
    // This ensures proper Shopify authentication flow
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

// Enhanced error boundary for Shopify embedded app authentication
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

      // For 410 Gone errors, redirect to proper auth flow
      if (error.status === 410) {
        console.log('[APP ERROR BOUNDARY] 410 Gone error - redirecting to auth');
        // Let Shopify handle the 410 with proper redirect
        return boundary.error(error);
      }

      // Handle other authentication errors
      if (error.status === 401 || error.status === 403) {
        console.log('[APP ERROR BOUNDARY] Authentication error - delegating to Shopify');
        return boundary.error(error);
      }
    }

    // For all other errors, delegate to Shopify boundary
    return boundary.error(error);

  } catch (boundaryError) {
    console.error('[APP ERROR BOUNDARY] Boundary error:', boundaryError);

    // Fallback UI for critical failures
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Authentication Error</title>
        </head>
        <body style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
          <h1>Authentication Required</h1>
          <p>Please refresh this page or reinstall the app to continue.</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </body>
      </html>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
