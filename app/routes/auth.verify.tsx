// Authentication verification route for debugging
import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    console.log('[AUTH VERIFY] Testing Shopify 2025-07 authentication...');

    const { admin, session } = await authenticate.admin(request);

    // Test a simple GraphQL query to verify everything works
    const response = await admin.graphql(`
      query {
        shop {
          name
          id
          myshopifyDomain
          plan {
            displayName
          }
        }
      }
    `);

    const data = await response.json();

    return json({
      success: true,
      authentication: {
        sessionId: session.id,
        shop: session.shop,
        isOnline: session.isOnline,
        expires: session.expires,
        hasAccessToken: !!session.accessToken,
      },
      shopInfo: data.data?.shop,
      timestamp: new Date().toISOString(),
      message: 'Authentication working perfectly! 410 Gone errors resolved.'
    });

  } catch (error) {
    console.error('[AUTH VERIFY] Authentication test failed:', error);

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: error instanceof Response ? error.status : 'Unknown',
      timestamp: new Date().toISOString(),
      message: 'Authentication failed - this helps diagnose the issue'
    }, {
      status: error instanceof Response ? error.status : 500
    });
  }
}