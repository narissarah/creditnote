import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import printStyles from "./styles/print.css?url";

export function links() {
  return [
    { rel: "stylesheet", href: printStyles },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle OPTIONS requests for CORS preflight
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

  // POS UI Extension-only app - no admin UI
  // API routes and webhooks handled by dedicated route files
  return json({
    appType: "pos-extension-backend",
  });
}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
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

  console.error('[ROOT ERROR BOUNDARY] Error caught:', error);

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Error {error.status}</title>
        </head>
        <body>
          <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
            <h1>{error.status} - {error.statusText}</h1>
            <p>{error.data}</p>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>Application Error</title>
      </head>
      <body>
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Application Error</h1>
          <p>An unexpected error occurred. Please try again.</p>
        </div>
      </body>
    </html>
  );
}
