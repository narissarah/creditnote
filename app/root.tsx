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
  
  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>{error.status} - {error.statusText}</title>
          <Meta />
          <Links />
        </head>
        <body>
          <div style={{ 
            padding: '2rem', 
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
          }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              {error.status}
            </h1>
            <p style={{ fontSize: '1.2rem', color: '#666' }}>
              {error.statusText}
            </p>
            {error.data && (
              <p style={{ marginTop: '1rem', color: '#999' }}>
                {error.data}
              </p>
            )}
          </div>
          <Scripts />
        </body>
      </html>
    );
  }
  
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error - Credit Note</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{ 
          padding: '2rem', 
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#d72c0d' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#666' }}>
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#999' }}>
            If the problem persists, please contact support.
          </p>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
// Development environment check
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('CreditNote App: Development environment detected');
}
