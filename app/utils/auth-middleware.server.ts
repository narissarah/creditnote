import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

/**
 * Enhanced Authentication Middleware for 2025-07 API
 * Handles both embedded apps and POS extensions with proper error handling
 */

export interface AuthResult {
  success: boolean;
  shop?: string;
  session?: any;
  admin?: any;
  error?: string;
  status?: number;
}

/**
 * Unified authentication function that works with Shopify 2025-07 embedded strategy
 */
export async function authenticateApp(request: Request): Promise<AuthResult> {
  console.log('[AUTH MIDDLEWARE] Starting authentication with 2025-07 strategy...');

  try {
    // Extract and analyze session token from multiple sources
    const sessionToken = extractSessionToken(request);

    console.log('[AUTH MIDDLEWARE] Session token analysis:', {
      hasToken: !!sessionToken,
      tokenLength: sessionToken?.length || 0,
      source: getTokenSource(request),
      userAgent: request.headers.get('User-Agent')?.substring(0, 50)
    });

    // Use Shopify's new embedded authentication
    const { admin, session } = await authenticate.admin(request);

    console.log('[AUTH MIDDLEWARE] ✅ Authentication successful:', {
      shop: session.shop,
      sessionId: session.id,
      isOnline: session.isOnline,
      hasAccessToken: !!session.accessToken,
      scope: session.scope?.split(',').length + ' scopes'
    });

    return {
      success: true,
      shop: session.shop,
      session,
      admin
    };

  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Authentication failed:', error);

    // Enhanced error handling for different scenarios
    if (error instanceof Response) {
      const status = error.status;

      if (status === 410) {
        console.log('[AUTH MIDDLEWARE] Session expired (410) - recovery needed');
        return {
          success: false,
          error: 'Session expired',
          status: 410
        };
      }

      if (status === 401 || status === 403) {
        console.log('[AUTH MIDDLEWARE] Authentication required - bouncing');
        return {
          success: false,
          error: 'Authentication required',
          status: status
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
      status: 500
    };
  }
}

/**
 * Extract session token from various sources in priority order
 */
function extractSessionToken(request: Request): string | null {
  const url = new URL(request.url);
  const authHeader = request.headers.get('authorization');

  // Priority order for 2025-07 API
  return (
    url.searchParams.get('id_token') ||           // App Bridge 4.0 primary
    authHeader?.replace('Bearer ', '') ||         // Authorization header
    url.searchParams.get('session') ||            // Legacy session
    request.headers.get('x-shopify-session-token') || // Direct header
    null
  );
}

/**
 * Determine the source of the session token for debugging
 */
function getTokenSource(request: Request): string {
  const url = new URL(request.url);
  const authHeader = request.headers.get('authorization');

  if (url.searchParams.get('id_token')) return 'id_token_param';
  if (authHeader?.startsWith('Bearer ')) return 'auth_header';
  if (url.searchParams.get('session')) return 'session_param';
  if (request.headers.get('x-shopify-session-token')) return 'direct_header';
  return 'none';
}

/**
 * Create a proper authentication response for API endpoints
 */
export function createAuthResponse(authResult: AuthResult, data?: any) {
  if (authResult.success) {
    return json(data || { success: true }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': authResult.shop || '',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }

  // Handle different error types
  if (authResult.status === 410) {
    return json({
      error: 'Session expired',
      code: 'SESSION_EXPIRED',
      action: 'redirect_to_auth'
    }, {
      status: 410,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Retry-Invalid-Session-Request': '1'
      }
    });
  }

  if (authResult.status === 401 || authResult.status === 403) {
    return json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      action: 'bounce_to_auth'
    }, {
      status: authResult.status || 401,
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Retry-Invalid-Session-Request': '1'
      }
    });
  }

  return json({
    error: authResult.error || 'Authentication failed',
    code: 'AUTH_FAILED'
  }, {
    status: authResult.status || 500,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Middleware for routes that require authentication
 */
export async function requireAuthentication(request: Request) {
  const authResult = await authenticateApp(request);

  if (!authResult.success) {
    throw createAuthResponse(authResult);
  }

  return authResult;
}

/**
 * Extract shop domain from various sources (for fallback scenarios)
 */
export function extractShopDomain(request: Request): string | null {
  const url = new URL(request.url);

  // Try URL parameters first
  const shopParam = url.searchParams.get('shop') ||
                   url.searchParams.get('shopDomain');

  if (shopParam && shopParam.includes('.myshopify.com')) {
    return shopParam;
  }

  // Try headers
  const shopHeader = request.headers.get('X-Shopify-Shop-Domain');
  if (shopHeader && shopHeader.includes('.myshopify.com')) {
    return shopHeader;
  }

  // Try to extract from referer
  const referer = request.headers.get('Referer');
  if (referer) {
    const match = referer.match(/https:\/\/([^\/]+\.myshopify\.com)/);
    if (match) return match[1];
  }

  return null;
}