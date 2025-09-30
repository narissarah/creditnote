import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export interface SimplifiedPOSAuthResult {
  success: boolean;
  authMethod: string;
  shop?: string;
  error?: string;
  requiresClientFix?: boolean;
}

/**
 * Simplified POS Authentication for 2025-07
 *
 * Handles cases where POS extensions don't send proper Authorization headers
 * Based on Shopify documentation recommendations for embedded app authentication
 */
export async function simplifiedPOSAuth(request: Request): Promise<SimplifiedPOSAuthResult> {
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('User-Agent') || '';
  const origin = request.headers.get('origin') || '';

  // Step 1: Check if this is definitely a POS request
  const isPOSRequest = userAgent.includes('Shopify POS') ||
                      origin.includes('extensions.shopifycdn.com') ||
                      userAgent.includes('ExtensibilityHost');

  console.log('[SIMPLIFIED POS AUTH] Request analysis:', {
    isPOSRequest,
    hasAuthHeader: !!authHeader,
    userAgent: userAgent.substring(0, 100),
    origin
  });

  // Step 2: Try standard Shopify authentication first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      console.log('[SIMPLIFIED POS AUTH] Attempting standard Shopify authentication...');
      const { admin, session } = await authenticate.admin(request);

      return {
        success: true,
        authMethod: 'STANDARD_SHOPIFY_AUTH',
        shop: session.shop
      };
    } catch (authError) {
      console.log('[SIMPLIFIED POS AUTH] Standard auth failed:', authError);
      // Continue to fallback methods
    }
  }

  // Step 3: Handle missing Authorization header for POS requests
  if (isPOSRequest && !authHeader) {
    console.log('[SIMPLIFIED POS AUTH] POS request with missing Authorization header');

    // For development/testing: Allow POS requests without auth
    if (process.env.NODE_ENV !== 'production') {
      console.log('[SIMPLIFIED POS AUTH] DEV MODE: Allowing POS request without auth');
      return {
        success: true,
        authMethod: 'DEV_MODE_POS_BYPASS',
        shop: 'dev-shop.myshopify.com'
      };
    }

    return {
      success: false,
      authMethod: 'POS_MISSING_AUTH_HEADER',
      error: 'POS extension must include session token in Authorization header',
      requiresClientFix: true
    };
  }

  // Step 4: Handle non-POS requests without auth
  if (!authHeader) {
    return {
      success: false,
      authMethod: 'NO_AUTH_HEADER',
      error: 'Authorization header is required'
    };
  }

  // Step 5: Handle invalid auth header format
  return {
    success: false,
    authMethod: 'INVALID_AUTH_FORMAT',
    error: 'Authorization header must be in format: Bearer <token>'
  };
}

/**
 * Create a standardized response for POS authentication failures
 */
export function createPOSAuthErrorResponse(authResult: SimplifiedPOSAuthResult) {
  const statusCode = authResult.requiresClientFix ? 400 : 401;

  return json({
    success: false,
    error: authResult.error,
    authMethod: authResult.authMethod,
    solutions: authResult.requiresClientFix ? [
      'Ensure POS extension fetches session token using getSessionToken()',
      'Include session token in Authorization header as "Bearer <token>"',
      'Verify POS extension has proper authentication setup',
      'Check if app has required POS permissions enabled'
    ] : [
      'Refresh the app or extension',
      'Verify you are logged into Shopify admin',
      'Check your internet connection',
      'Contact support if the issue persists'
    ],
    debugInfo: {
      authMethod: authResult.authMethod,
      requiresClientFix: authResult.requiresClientFix,
      timestamp: new Date().toISOString()
    }
  }, {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain'
    }
  });
}

/**
 * Create a standardized response for successful POS authentication
 */
export function createPOSAuthSuccessResponse(authResult: SimplifiedPOSAuthResult, data: any) {
  return json({
    success: true,
    authMethod: authResult.authMethod,
    shop: authResult.shop,
    data,
    metadata: {
      authenticatedAt: new Date().toISOString(),
      authMethod: authResult.authMethod
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}