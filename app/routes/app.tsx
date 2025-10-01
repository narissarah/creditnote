import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { Frame } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-remix/server";
import { detectBot } from "../utils/bot-detection.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Handle OPTIONS requests for CORS preflight at loader level
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Access-Token",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  console.log('[APP LOADER] Starting modern 2025-07 embedded authentication');

  // CRITICAL FIX: Detect bots before calling authenticate.admin
  // This prevents 410 Gone errors for Vercel bots during deployment
  const { isBot, botType, shouldBypass } = detectBot(request);

  if (isBot && shouldBypass) {
    console.log('[APP LOADER] Bot detected, bypassing authentication:', {
      botType,
      userAgent: request.headers.get('User-Agent')
    });

    // For Vercel bots, return minimal data without calling authenticate.admin
    // This prevents 410 Gone errors during deployment verification
    return {
      shop: 'bot-bypass.myshopify.com',
      apiKey: process.env.SHOPIFY_API_KEY,
      isBot: true,
      botType
    };
  }

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

    // Let the error bubble up to be handled by the error boundary
    throw error;
  }
};

export default function App() {
  // CRITICAL FIX: Wrap Outlet with Polaris Frame to provide Frame context
  // Even though Frame is deprecated, it's still required for Polaris components
  // in @shopify/shopify-app-remix v3.7.0
  return (
    <Frame>
      <Outlet />
    </Frame>
  );
}

// CRITICAL FIX: Use manual headers to avoid boundary.headers() authentication issues
// boundary.headers() tries to authenticate ALL requests and throws 410 for bots
export const headers = (headersArgs: any) => {
  try {
    // Get shop from request to set dynamic CSP
    const request = headersArgs?.request;
    let shopDomain = 'admin.shopify.com';

    if (request) {
      try {
        const url = new URL(request.url);
        const shopParam = url.searchParams.get('shop');
        if (shopParam) {
          shopDomain = shopParam.endsWith('.myshopify.com') ? shopParam : `${shopParam}.myshopify.com`;
        }
      } catch (e) {
        console.warn('[APP HEADERS] Could not parse shop from URL');
      }
    }

    // Manual CSP headers that work for both bots and real users
    // This avoids the authenticate.admin call that boundary.headers makes
    const headers = new Headers();
    headers.set(
      'Content-Security-Policy',
      `frame-ancestors https://${shopDomain} https://admin.shopify.com https://*.myshopify.com;`
    );
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'ALLOWALL');

    console.log('[APP HEADERS] Manual headers set for shop:', shopDomain);

    return headers;
  } catch (error) {
    console.error('[APP HEADERS] Error setting headers:', error);

    // Fallback CSP headers
    const fallbackHeaders = new Headers();
    fallbackHeaders.set(
      'Content-Security-Policy',
      'frame-ancestors https://admin.shopify.com https://*.myshopify.com;'
    );
    fallbackHeaders.set('X-Content-Type-Options', 'nosniff');

    return fallbackHeaders;
  }
};

// CRITICAL FIX: Simple error boundary that doesn't try to re-authenticate
// We handle 410 Gone errors by redirecting to session-token-bounce
export function ErrorBoundary() {
  const error = useRouteError();

  try {
    console.error('[APP ERROR BOUNDARY] Error caught:', error);

    if (isRouteErrorResponse(error)) {
      // Handle 410 Gone - session expired
      if (error.status === 410) {
        console.log('[APP ERROR BOUNDARY] 410 Gone - redirecting to session token bounce');

        return (
          <html>
            <head>
              <title>Session Expired</title>
              <script dangerouslySetInnerHTML={{
                __html: `
                  console.log('410 Gone - Redirecting to session token bounce');
                  const params = new URLSearchParams(window.location.search);
                  const shop = params.get('shop') || '';
                  if (shop) {
                    window.top.location.href = '/session-token-bounce?shop=' + encodeURIComponent(shop) + '&shopify-reload=/app';
                  } else {
                    console.error('No shop parameter found, refreshing page');
                    window.location.reload();
                  }
                `
              }} />
            </head>
            <body>
              <div>Session expired - fetching new token...</div>
            </body>
          </html>
        );
      }

      // Handle 401/403 - authentication required
      if (error.status === 401 || error.status === 403) {
        console.log('[APP ERROR BOUNDARY] Auth error - redirecting to auth');

        return (
          <html>
            <head>
              <title>Authentication Required</title>
              <script dangerouslySetInnerHTML={{
                __html: `
                  console.log('Redirecting to auth due to ${error.status}');
                  const params = new URLSearchParams(window.location.search);
                  const shop = params.get('shop') || '';
                  window.top.location.href = '/auth' + (shop ? '?shop=' + encodeURIComponent(shop) : '');
                `
              }} />
            </head>
            <body>
              <div>Redirecting to authentication...</div>
            </body>
          </html>
        );
      }
    }

    // For all other errors, show simple error UI
    return (
      <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
        <h1>Application Error</h1>
        <p>An unexpected error occurred. Please try refreshing the page.</p>
        <button
          onClick={() => window.location.reload()}
          style={{
            backgroundColor: '#008060',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Refresh Page
        </button>
      </div>
    );
  } catch (boundaryError) {
    console.error('[APP ERROR BOUNDARY] Boundary error:', boundaryError);

    // Ultimate fallback
    return (
      <div style={{ padding: '20px' }}>
        <h1>Error</h1>
        <p>Please refresh the page.</p>
      </div>
    );
  }
}