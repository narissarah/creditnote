import type { HeadersFunction } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
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

export default function App() {
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

  // CRITICAL FIX: Always delegate to Shopify's boundary first for proper authentication handling
  // This prevents generic "Something went wrong" messages for auth issues
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
// Development environment check
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('CreditNote App: Development environment detected');
}
