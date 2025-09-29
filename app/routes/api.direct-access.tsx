import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticateEmbeddedRequest } from "../utils/enhanced-auth.server";
import { handleRouteError, AppErrorFactory } from "../utils/advanced-error-handling.server";
import { validateEnvironmentVariables, getValidatedEnvironmentConfig } from "../utils/environment-validation.server";

/**
 * Direct API Access Endpoint for Embedded Apps
 *
 * Enables embedded apps to make direct API calls without session bounces
 * Supports Shopify 2025-07 authentication patterns with enhanced error handling
 */

export async function loader({ request }: LoaderFunctionArgs) {
  return handleDirectAccess(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handleDirectAccess(request);
}

async function handleDirectAccess(request: Request) {
  const startTime = Date.now();

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    console.log('[DIRECT ACCESS] CORS preflight request');
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Access-Token, X-API-Request-Type",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  try {
    console.log('[DIRECT ACCESS] Starting direct API access handler...');

    const url = new URL(request.url);
    const apiRequestType = request.headers.get('X-API-Request-Type') || url.searchParams.get('type') || 'embedded';
    const targetShop = request.headers.get('X-Shopify-Shop-Domain') || url.searchParams.get('shop');

    console.log('[DIRECT ACCESS] Request details:', {
      method: request.method,
      apiRequestType,
      targetShop,
      hasAuth: !!request.headers.get('authorization'),
      origin: request.headers.get('origin'),
      userAgent: request.headers.get('user-agent')?.substring(0, 50)
    });

    // Step 1: Environment validation for direct access
    const envValidation = validateEnvironmentVariables();
    if (!envValidation.isValid) {
      console.error('[DIRECT ACCESS] Environment validation failed:', envValidation.errors);

      return json({
        success: false,
        error: 'Environment configuration invalid for direct API access',
        type: 'ENVIRONMENT_ERROR',
        details: envValidation.errors.filter(err => !err.includes('sensitive')), // Filter sensitive errors
        canRetry: false
      }, {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }

    // Step 2: Enhanced authentication for direct access
    let authResult;
    try {
      authResult = await authenticateEmbeddedRequest(request);

      // Handle bot detection
      if (authResult.authMethod === 'BOT_DETECTED') {
        console.log('[DIRECT ACCESS] Bot request detected');
        return new Response('Service Unavailable', {
          status: 503,
          headers: {
            'Content-Type': 'text/plain',
            'Retry-After': '3600',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

    } catch (authError) {
      console.error('[DIRECT ACCESS] Authentication failed:', authError);

      return json({
        success: false,
        error: 'Authentication failed for direct API access',
        type: 'AUTHENTICATION_ERROR',
        canRetry: true,
        solutions: [
          'Verify you are accessing from within Shopify admin',
          'Check that your session is valid and not expired',
          'Try refreshing the page',
          'Ensure proper authentication headers are included'
        ]
      }, {
        status: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }

    if (!authResult.success) {
      console.warn('[DIRECT ACCESS] Authentication unsuccessful:', authResult.error);

      return json({
        success: false,
        error: 'Direct API access denied',
        type: 'ACCESS_DENIED',
        authMethod: authResult.authMethod,
        canRetry: !!authResult.requiresBounce,
        details: authResult.error,
        solutions: authResult.requiresBounce ? [
          'Authentication requires session refresh',
          'The app will attempt to refresh your session automatically',
          'Please wait for the redirect to complete'
        ] : [
          'Verify your permissions in Shopify admin',
          'Check that the app is properly installed',
          'Contact support if the issue persists'
        ]
      }, {
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }

    // Step 3: Generate direct access response with session details
    const config = getValidatedEnvironmentConfig();
    const { session } = authResult;

    console.log('[DIRECT ACCESS] ✅ Authentication successful, generating access response');

    const directAccessResponse = {
      success: true,
      accessGranted: true,
      directAccessEnabled: true,
      authMethod: authResult.authMethod,
      shop: session.shop,
      sessionInfo: {
        sessionId: session.id,
        isOnline: session.isOnline,
        userId: session.userId?.toString(),
        scope: session.scope,
        expires: session.expires?.toISOString(),
        accessToken: session.accessToken ? '***REDACTED***' : undefined // Never expose actual token
      },
      apiAccess: {
        enabled: true,
        apiKey: config.SHOPIFY_API_KEY,
        apiVersion: '2025-07',
        supportedOperations: [
          'products.read',
          'products.write',
          'orders.read',
          'customers.read',
          'metafields.read',
          'metafields.write'
        ],
        rateLimits: {
          bucket: 'app',
          maxRequests: 2000,
          windowSeconds: 3600
        }
      },
      embeddedContext: {
        appBridgeVersion: '4.0',
        shopifyAppUrl: config.SHOPIFY_APP_URL,
        isEmbedded: true,
        frameAllowed: true
      },
      metadata: {
        processingTime: Date.now() - startTime,
        authenticatedAt: new Date().toISOString(),
        apiVersion: '2025-07',
        securityLevel: 'ENHANCED'
      }
    };

    console.log('[DIRECT ACCESS] Direct access granted for shop:', session.shop);

    return json(directAccessResponse, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-App-Access-Level': 'DIRECT',
        'X-Authentication-Method': authResult.authMethod,
        'X-Processing-Time': (Date.now() - startTime).toString()
      }
    });

  } catch (error) {
    console.error('[DIRECT ACCESS] Critical error in direct access handler:', error);

    const appError = AppErrorFactory.createAuthenticationError(
      {
        processingTime: Date.now() - startTime,
        accessType: 'DIRECT_API_ACCESS',
        originalError: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        route: '/api/direct-access',
        userAgent: request.headers.get('User-Agent'),
        apiRequestType: request.headers.get('X-API-Request-Type')
      }
    );

    return handleRouteError(appError, request);
  }
}

/**
 * Utility function to check API permissions for specific operations
 */
function checkAPIPermissions(session: any, requestedOperation: string): boolean {
  // Basic permission checking - in production you'd want more sophisticated logic
  const scope = session.scope || '';
  const scopes = scope.split(',').map((s: string) => s.trim());

  const permissionMap: Record<string, string[]> = {
    'products.read': ['read_products', 'write_products'],
    'products.write': ['write_products'],
    'orders.read': ['read_orders', 'write_orders'],
    'customers.read': ['read_customers', 'write_customers'],
    'metafields.read': ['read_metafields', 'write_metafields'],
    'metafields.write': ['write_metafields']
  };

  const requiredScopes = permissionMap[requestedOperation] || [];
  return requiredScopes.some(scope => scopes.includes(scope));
}