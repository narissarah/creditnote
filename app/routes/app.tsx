import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";

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

// CRITICAL: Official Shopify boundary utilities for embedded app authentication
// These provide proper CSP headers and error handling for app routes per Shopify docs
export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
};

// Official Shopify error boundary
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}