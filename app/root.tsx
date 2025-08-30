import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  LiveReload,
} from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://cdn.shopify.com/" },
  {
    rel: "stylesheet",
    href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css",
  },
];

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
        <LiveReload />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error('Root error boundary:', error);

  if (isRouteErrorResponse(error)) {
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Error {error.status}</title>
          <Meta />
          <Links />
        </head>
        <body>
          <div style={{
            fontFamily: 'system-ui, sans-serif',
            padding: '2rem',
            textAlign: 'center',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '3rem',
              maxWidth: '600px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
            }}>
              <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: '#333' }}>
                {error.status}
              </h1>
              <p style={{ fontSize: '1.5rem', color: '#666', marginBottom: '1rem' }}>
                {error.statusText || 'Error'}
              </p>
              {error.data && (
                <pre style={{
                  background: '#f5f5f5',
                  padding: '1rem',
                  borderRadius: '4px',
                  textAlign: 'left',
                  overflow: 'auto',
                  fontSize: '0.875rem'
                }}>
                  {JSON.stringify(error.data, null, 2)}
                </pre>
              )}
            </div>
          </div>
          <Scripts />
        </body>
      </html>
    );
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : null;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Application Error</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
          textAlign: 'center',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '3rem',
            maxWidth: '800px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
          }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#e53e3e' }}>
              ⚠️ Application Error
            </h1>
            <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
              {errorMessage}
            </p>
            {process.env.NODE_ENV === 'development' && errorStack && (
              <details style={{ textAlign: 'left' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '1rem' }}>
                  View Stack Trace
                </summary>
                <pre style={{
                  background: '#f5f5f5',
                  padding: '1rem',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace'
                }}>
                  {errorStack}
                </pre>
              </details>
            )}
            <div style={{ marginTop: '2rem' }}>
              <a 
                href="/" 
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 2rem',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '4px',
                  textDecoration: 'none'
                }}
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
