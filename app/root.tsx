import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useLoaderData,
} from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { authenticate } from "./shopify.server";
import printStyles from "./styles/print.css?url";
import mobileStyles from "./styles/mobile.css?url";
import uniformTableStyles from "./styles/uniform-table.css?url";
import polarisOverrides from "./styles/polaris-overrides.css?url";

export function links() {
  return [
    { rel: "stylesheet", href: printStyles },
    { rel: "stylesheet", href: mobileStyles },
    { rel: "stylesheet", href: uniformTableStyles },
    { rel: "stylesheet", href: polarisOverrides },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  // ROOT LOADER: Only handle document-level concerns, NOT authentication
  // Authentication should be handled by app.tsx loader in the hierarchy
  console.log('[ROOT LOADER] Providing document-level configuration (no auth)');

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    isEmbedded: true,
  });
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        {/* CRITICAL: July 2025 App Bridge Compliance - Latest Version Required */}
        <meta name="shopify-api-key" content={apiKey || ""} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>

        {/* Pass API key to client for embedded app initialization */}
        {apiKey && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.shopifyConfig = {"apiKey": "${apiKey.replace(/"/g, '\\"')}"}`,
            }}
          />
        )}
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  try {
    console.error('[ROOT ERROR BOUNDARY] Error caught:', error);

    if (isRouteErrorResponse(error)) {
      // Handle authentication errors with proper redirect (2025-07 API pattern)
      if (error.status === 401 || error.status === 403) {
        console.log('[ROOT ERROR] Authentication error - redirecting to auth');
        return (
          <html>
            <head>
              <title>Authentication Required</title>
              <script dangerouslySetInnerHTML={{
                __html: `console.log('Redirecting to auth due to 401/403'); window.top.location.href = "/auth";`
              }} />
            </head>
            <body>
              <div>Redirecting to authentication...</div>
            </body>
          </html>
        );
      }

      // Handle 410 Gone responses (common in 2025-07 API)
      if (error.status === 410) {
        console.log('[ROOT ERROR] 410 Gone response - session expired');
        return boundary.error(new Error('Session expired - please refresh'));
      }

      // Handle 404 errors
      if (error.status === 404) {
        return (
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
              <title>Page Not Found</title>
            </head>
            <body>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </body>
          </html>
        );
      }
    }

    // For other errors, delegate to Shopify boundary
    return boundary.error(error);
  } catch (boundaryError) {
    console.error('[ROOT ERROR BOUNDARY] Boundary failed:', boundaryError);
    return (
      <html>
        <head><title>Application Error</title></head>
        <body>
          <div>An unexpected error occurred. Please refresh the page.</div>
        </body>
      </html>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  try {
    // CRITICAL FIX: Create headers manually to avoid ESM/CommonJS issues
    // Essential headers for Shopify embedded apps - no dynamic import needed
    const headers = new Headers();

    // Core security headers for Shopify embedded apps
    headers.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('X-Content-Type-Options', 'nosniff');

    // Additional security headers
    headers.set('X-DNS-Prefetch-Control', 'off');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    console.log('[ROOT HEADERS] Headers created successfully');
    return headers;

  } catch (error) {
    console.error('[ROOT HEADERS] Critical error in headers function:', error);
    // Return minimal headers required for Shopify embedded apps
    const fallbackHeaders = new Headers();
    fallbackHeaders.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    fallbackHeaders.set('X-Frame-Options', 'ALLOWALL');
    fallbackHeaders.set('X-Content-Type-Options', 'nosniff');
    return fallbackHeaders;
  }
};
