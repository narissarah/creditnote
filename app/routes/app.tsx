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

// SIMPLIFIED 2025-07: Trust Shopify's new embedded auth strategy for error handling
export function ErrorBoundary() {
  const error = useRouteError();

  console.error('[APP ERROR BOUNDARY] Error caught - using Shopify managed recovery:', error);

  // Let Shopify's new embedded auth strategy handle all authentication errors
  // This eliminates the need for complex manual recovery logic
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
