import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Credit Notes
        </Link>
        <Link to="/app/settings">
          Settings
        </Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  const headers = boundary.headers(headersArgs);
  
  // Enhanced CSP for 2025 requirements - more comprehensive  
  headers.set('Content-Security-Policy', 
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.shopifypreview.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com; " +
    "style-src 'self' 'unsafe-inline' https://cdn.shopify.com;"
  );
  
  // Remove X-Frame-Options to prevent conflicts with CSP frame-ancestors
  headers.delete('X-Frame-Options');
  
  return headers;
};
