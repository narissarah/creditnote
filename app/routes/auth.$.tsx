import type { LoaderFunctionArgs } from "@remix-run/node";
import { useRouteError } from "@remix-run/react";
import { authenticate, login } from "../shopify.server";
import { handleBotAuthentication } from "../utils/bot-detection.server";
import { boundary } from "@shopify/shopify-app-remix/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // First, check for bots and handle them appropriately
    const botResponse = handleBotAuthentication(request);
    if (botResponse) {
      return botResponse;
    }

    const url = new URL(request.url);

    // CRITICAL: Host parameter validation for embedded apps
    const host = url.searchParams.get('host');
    const shop = url.searchParams.get('shop');

    console.log(`[AUTH ROUTE] Processing authentication request:`, {
      pathname: url.pathname,
      host: host,
      shop: shop,
      hasEmbeddedParam: url.searchParams.has('embedded'),
      userAgent: request.headers.get("User-Agent"),
      origin: request.headers.get("Origin"),
      referer: request.headers.get("Referer")
    });

    // Enhanced validation for embedded app requirements
    if (!host && !shop) {
      console.error('[AUTH ROUTE] Missing required host or shop parameter');
      throw new Error('Missing required authentication parameters');
    }

    // Validate host format if present
    if (host && (!host.includes('.myshopify.com') && !host.includes('shopify.com'))) {
      console.warn('[AUTH ROUTE] Unusual host format detected:', host);
    }

    // If this is the login path, use shopify.login() instead of authenticate.admin()
    if (url.pathname === '/auth/login') {
      return await login(request);
    }

    // For all other auth paths, use authenticate.admin()
    await authenticate.admin(request);
    return null;

  } catch (error) {
    console.error(`[AUTH ROUTE] Authentication error:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      url: request.url,
      userAgent: request.headers.get("User-Agent"),
      method: request.method
    });

    // Re-throw to let Shopify's boundary handler manage the error
    throw error;
  }
};

// CRITICAL: Official Shopify boundary utilities for embedded app authentication
// These provide proper CSP headers and error handling for OAuth flow per Shopify docs
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs: any) => {
  return boundary.headers(headersArgs);
};
