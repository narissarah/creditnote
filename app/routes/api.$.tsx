import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// CORS handling moved inline to avoid build issues
import { NUCLEAR_DEPLOYMENT_ID } from "../nuclear-cache-bust";

/**
 * Universal API Catch-All Route for CORS OPTIONS Handling
 *
 * This route handles OPTIONS requests for any API endpoint that doesn't
 * have its own OPTIONS handler, ensuring consistent CORS behavior across
 * the entire application.
 *
 * Route pattern: /api/* (catch-all for unmatched API routes)
 */

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const splat = params["*"] || "unknown";

  console.log('[API CATCH-ALL] Universal API route accessed:', {
    method: request.method,
    path: `/api/${splat}`,
    userAgent: request.headers.get('User-Agent')?.substring(0, 50),
    origin: request.headers.get('Origin'),
    nuclearDeploymentId: NUCLEAR_DEPLOYMENT_ID,
    timestamp: new Date().toISOString()
  });

  // Handle OPTIONS requests with universal CORS
  if (request.method === 'OPTIONS') {
    console.log('[API CATCH-ALL] 🛩️ Handling universal OPTIONS request for:', `/api/${splat}`);
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }

  // For non-OPTIONS requests, return a helpful 404 with CORS headers
  console.log('[API CATCH-ALL] ❌ API endpoint not found:', `/api/${splat}`);

  return json({
    error: 'API endpoint not found',
    path: `/api/${splat}`,
    method: request.method,
    available_endpoints: [
      '/api/auth/validate',
      '/api/pos/credit-notes/list',
      '/api/pos/diagnostics',
      '/api/webhooks'
    ],
    solutions: [
      'Check the endpoint URL for typos',
      'Ensure you\'re using the correct HTTP method',
      'Verify the API endpoint exists in the application',
      'Check the API documentation for available endpoints'
    ],
    metadata: {
      timestamp: new Date().toISOString(),
      nuclearDeploymentId: NUCLEAR_DEPLOYMENT_ID,
      routeHandler: 'universal-api-catch-all'
    }
  }, {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Session-Token',
      'X-Route-Handler': 'universal-catch-all',
      'X-Nuclear-Deployment': NUCLEAR_DEPLOYMENT_ID
    }
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  // Handle POST, PUT, DELETE, etc. with the same logic as loader
  return loader({ request, params, context: {} });
};

// Named export for OPTIONS to ensure it's handled correctly
export const options = async ({ request, params }: ActionFunctionArgs) => {
  console.log('[API CATCH-ALL] 🛩️ Explicit OPTIONS handler called for:', `/api/${params["*"] || "unknown"}`);
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
  });
};