/**
 * Session Token Validation Utility for Shopify 2025-07 API
 *
 * Handles session token extraction, validation, and error responses
 * according to Shopify's embedded app authorization documentation
 */

import { json } from "@remix-run/node";

export interface SessionTokenValidationResult {
  success: boolean;
  token?: string;
  error?: string;
  shouldBounce?: boolean;
  shop?: string;
}

/**
 * Extract session token from request headers or URL parameters
 */
export function extractSessionToken(request: Request): SessionTokenValidationResult {
  const url = new URL(request.url);

  // Method 1: Check Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (isValidJWTFormat(token)) {
      return {
        success: true,
        token,
        shop: extractShopFromToken(token)
      };
    }
  }

  // Method 2: Check id_token URL parameter (2025-07 standard)
  const idToken = url.searchParams.get('id_token');
  if (idToken && isValidJWTFormat(idToken)) {
    return {
      success: true,
      token: idToken,
      shop: extractShopFromToken(idToken)
    };
  }

  // Method 3: Check session parameter (legacy compatibility)
  const sessionToken = url.searchParams.get('session');
  if (sessionToken && isValidJWTFormat(sessionToken)) {
    return {
      success: true,
      token: sessionToken,
      shop: extractShopFromToken(sessionToken)
    };
  }

  // No valid session token found
  return {
    success: false,
    error: 'No valid session token found in Authorization header or URL parameters',
    shouldBounce: true,
    shop: url.searchParams.get('shop') || undefined
  };
}

/**
 * Validate JWT format (basic structure check)
 */
function isValidJWTFormat(token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    // Check if we can decode the header and payload
    JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract shop domain from JWT payload
 */
function extractShopFromToken(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check dest field (destination shop domain)
    if (payload.dest && typeof payload.dest === 'string') {
      const destMatch = payload.dest.match(/https:\/\/(.+?)\/admin/);
      if (destMatch) return destMatch[1];
    }

    // Check iss field (issuer)
    if (payload.iss && typeof payload.iss === 'string') {
      const issMatch = payload.iss.match(/https:\/\/(.+?)\/admin/);
      if (issMatch) return issMatch[1];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Create appropriate error response for invalid session tokens
 */
export function createSessionTokenErrorResponse(
  validation: SessionTokenValidationResult,
  originalUrl: string
): Response {
  const url = new URL(originalUrl);
  const shop = validation.shop || url.searchParams.get('shop') || 'example.myshopify.com';

  // For XHR requests, return 401 with retry header
  const isXHR = url.searchParams.has('_data') ||
                url.pathname.startsWith('/api/') ||
                originalUrl.includes('application/json');

  if (isXHR) {
    return json(
      {
        error: validation.error || 'Invalid session token',
        code: 'INVALID_SESSION_TOKEN',
        bounce_url: `/session-token-bounce?shop=${encodeURIComponent(shop)}&shopify-reload=${encodeURIComponent(url.pathname + url.search)}`
      },
      {
        status: 401,
        headers: {
          'X-Shopify-Retry-Invalid-Session-Request': '1',
          'X-Shopify-API-Request-Failure-Reauthorize': '1',
          'X-Shopify-API-Request-Failure-Reauthorize-Url': `/session-token-bounce?shop=${encodeURIComponent(shop)}`
        }
      }
    );
  }

  // For document requests, redirect to bounce page
  const bounceUrl = `/session-token-bounce?shop=${encodeURIComponent(shop)}&shopify-reload=${encodeURIComponent(url.pathname + url.search)}`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': bounceUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

/**
 * Validate session token expiration
 */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    if (!payload.exp) return true;

    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  } catch {
    return true;
  }
}

/**
 * Enhanced session token validation with expiration check
 */
export function validateSessionToken(request: Request): SessionTokenValidationResult {
  const validation = extractSessionToken(request);

  if (!validation.success) {
    return validation;
  }

  if (!validation.token) {
    return {
      success: false,
      error: 'Session token is empty',
      shouldBounce: true
    };
  }

  if (isTokenExpired(validation.token)) {
    return {
      success: false,
      error: 'Session token has expired',
      shouldBounce: true,
      shop: validation.shop
    };
  }

  return validation;
}