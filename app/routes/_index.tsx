import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect, json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  console.log('[ROOT INDEX] Request received:', {
    url: url.toString(),
    pathname: url.pathname,
    search: url.search,
    userAgent: request.headers.get('User-Agent'),
    origin: request.headers.get('Origin'),
    referer: request.headers.get('Referer'),
    shopParam: url.searchParams.get("shop"),
    hostParam: url.searchParams.get("host"),
    hasShopifyHeaders: {
      shopDomain: request.headers.get('X-Shopify-Shop-Domain'),
      accessToken: !!request.headers.get('X-Shopify-Access-Token'),
      topic: request.headers.get('X-Shopify-Topic')
    }
  });

  // If there's a shop parameter, this is likely an app installation/access
  if (url.searchParams.get("shop")) {
    const redirectUrl = `/app?${url.searchParams.toString()}`;
    console.log('[ROOT INDEX] Shop parameter found, redirecting to:', redirectUrl);
    return redirect(redirectUrl);
  }

  // If there's a host parameter (embedded app), redirect to app
  if (url.searchParams.get("host")) {
    const redirectUrl = `/app?${url.searchParams.toString()}`;
    console.log('[ROOT INDEX] Host parameter found, redirecting to:', redirectUrl);
    return redirect(redirectUrl);
  }

  // For direct access, redirect to app without authentication
  console.log('[ROOT INDEX] Direct access, redirecting to /app');
  return redirect("/app");
};