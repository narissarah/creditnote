import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect } from "react";

// Session Token Bounce Page - Handles 410 Gone errors by refreshing session tokens
// When a session expires (410 Gone), the error boundary redirects here to get a fresh token
// Reference: https://shopify.dev/docs/api/shopify-app-remix/authenticate/admin

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const redirectTo = url.searchParams.get("shopify-reload") || "/app";

  console.log('[SESSION BOUNCE] Starting token refresh:', { shop, redirectTo });

  return {
    shop: shop || "",
    redirectTo,
  };
}

export default function SessionTokenBounce() {
  const { shop, redirectTo } = useLoaderData<typeof loader>();

  useEffect(() => {
    // Use App Bridge to get a fresh session token and redirect
    const refreshSession = async () => {
      try {
        console.log('[SESSION BOUNCE] Requesting fresh session token...');

        // App Bridge will automatically handle token refresh when we navigate
        // The navigation will trigger a new authentication flow
        const redirectUrl = `${redirectTo}?shop=${encodeURIComponent(shop)}`;

        console.log('[SESSION BOUNCE] Redirecting to:', redirectUrl);

        // Use top-level navigation to refresh the entire embedded app
        window.top!.location.href = redirectUrl;
      } catch (error) {
        console.error('[SESSION BOUNCE] Token refresh failed:', error);

        // Fallback: redirect to auth flow
        window.top!.location.href = `/auth?shop=${encodeURIComponent(shop)}`;
      }
    };

    refreshSession();
  }, [shop, redirectTo]);

  return (
    <div style={{
      padding: '40px',
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center'
    }}>
      <h2>Refreshing session...</h2>
      <p>Please wait while we refresh your authentication.</p>
    </div>
  );
}
