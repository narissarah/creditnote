import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
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
import { addDocumentResponseHeaders } from "./shopify.server";
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
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
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
        {/* Pass API key to client for embedded app initialization */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.shopifyConfig = ${JSON.stringify({ apiKey })};`,
          }}
        />
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

  // Enhanced error logging for debugging
  console.error('[ROOT ERROR BOUNDARY] Error caught:', error);
  console.error('[ROOT ERROR BOUNDARY] Error type:', typeof error);
  if (error instanceof Error) {
    console.error('[ROOT ERROR BOUNDARY] Error message:', error.message);
    console.error('[ROOT ERROR BOUNDARY] Error stack:', error.stack);
  }

  // Check if this is a route error response (like 404, 401, etc.)
  if (isRouteErrorResponse(error)) {
    console.error('[ROOT ERROR BOUNDARY] Route error response:', {
      status: error.status,
      statusText: error.statusText,
      data: error.data
    });

    // Handle specific authentication/authorization errors
    if (error.status === 401 || error.status === 403) {
      console.log('[ROOT ERROR BOUNDARY] Authentication error detected, delegating to Shopify boundary');
      return boundary.error(error);
    }

    // Handle other route errors with custom UI if needed
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

  // For authentication and Shopify-specific errors, always delegate to Shopify's boundary
  // This ensures proper authentication flows and embedded app behavior
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return addDocumentResponseHeaders(headersArgs.request, boundary.headers(headersArgs));
};
// Development environment check
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('CreditNote App: Development environment detected');
}
