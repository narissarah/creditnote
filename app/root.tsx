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

  // Simplified error handling for serverless stability
  try {
    console.error('[ROOT ERROR BOUNDARY] Error caught:', error);

    // Check if this is a route error response (like 404, 401, etc.)
    if (isRouteErrorResponse(error)) {
      // Handle authentication errors
      if (error.status === 401 || error.status === 403) {
        return boundary.error(error);
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
    console.error('[ROOT ERROR BOUNDARY] Boundary error:', boundaryError);
    // Fallback error UI
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Error</title>
        </head>
        <body>
          <h1>Something went wrong</h1>
          <p>Please try again later.</p>
        </body>
      </html>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return addDocumentResponseHeaders(headersArgs.request, boundary.headers(headersArgs));
};
