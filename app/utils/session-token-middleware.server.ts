/**
 * Session Token Middleware for Shopify 2025-07 API
 *
 * Ensures session token validation happens on EVERY request as required by Shopify docs.
 * Provides consistent authentication patterns across all app routes.
 */

import { validateSessionToken, createSessionTokenErrorResponse } from "./session-token-validation.server";
import { authenticate } from "../shopify.server";

interface MiddlewareOptions {
  skipTokenValidation?: boolean;
  allowBotRequests?: boolean;
  skipPaths?: string[];
}

/**
 * Enhanced authentication middleware that validates session tokens on every request
 */
export async function withSessionTokenValidation(
  request: Request,
  options: MiddlewareOptions = {}
): Promise<{ success: true; session: any; admin: any } | { success: false; response: Response }> {

  const url = new URL(request.url);
  const pathname = url.pathname;

  console.log('[SESSION MIDDLEWARE] Processing request:', {
    pathname,
    method: request.method,
    hasAuth: !!request.headers.get('Authorization'),
    hasIdToken: !!url.searchParams.get('id_token')
  });

  // Skip validation for specific paths if configured
  if (options.skipPaths?.some(path => pathname.startsWith(path))) {
    console.log('[SESSION MIDDLEWARE] Skipping validation for path:', pathname);
    try {
      const { admin, session } = await authenticate.admin(request);
      return { success: true, session, admin };
    } catch (authError) {
      console.error('[SESSION MIDDLEWARE] Standard auth failed for skipped path:', authError);
      return {
        success: false,
        response: new Response('Authentication required', { status: 401 })
      };
    }
  }

  // Check for bot requests if allowed
  if (options.allowBotRequests) {
    const userAgent = request.headers.get('User-Agent') || '';
    const isBot = userAgent.includes('vercel-') ||
                  userAgent.includes('bot') ||
                  userAgent.includes('crawler');

    if (isBot) {
      console.log('[SESSION MIDDLEWARE] Bot request detected, skipping session validation:', userAgent.substring(0, 50));
      try {
        const { admin, session } = await authenticate.admin(request);
        return { success: true, session, admin };
      } catch (authError) {
        // For bots, just return a simple error instead of bounce page
        return {
          success: false,
          response: new Response('Bot authentication not available', { status: 401 })
        };
      }
    }
  }

  // Step 1: Validate session token FIRST (as required by Shopify docs)
  if (!options.skipTokenValidation) {
    const tokenValidation = validateSessionToken(request);

    if (!tokenValidation.success) {
      console.log('[SESSION MIDDLEWARE] ❌ Session token validation failed:', tokenValidation.error);

      // Return appropriate error response with bounce page redirect
      return {
        success: false,
        response: createSessionTokenErrorResponse(tokenValidation, request.url)
      };
    }

    console.log('[SESSION MIDDLEWARE] ✅ Session token validation successful:', {
      shop: tokenValidation.shop,
      tokenLength: tokenValidation.token?.length
    });
  }

  // Step 2: Perform standard Shopify authentication
  try {
    const { admin, session } = await authenticate.admin(request);

    console.log('[SESSION MIDDLEWARE] ✅ Standard authentication successful:', {
      shop: session.shop,
      sessionId: session.id,
      hasAccessToken: !!session.accessToken
    });

    return { success: true, session, admin };

  } catch (authError) {
    console.error('[SESSION MIDDLEWARE] ❌ Standard authentication failed:', authError);

    // If standard auth fails but we have a valid session token,
    // redirect to bounce page for token refresh
    const tokenValidation = validateSessionToken(request);

    if (tokenValidation.success && tokenValidation.shop) {
      console.log('[SESSION MIDDLEWARE] 🔄 Valid session token found, redirecting to bounce page');

      const shop = tokenValidation.shop;
      const bounceUrl = `/session-token-bounce?shop=${encodeURIComponent(shop)}&shopify-reload=${encodeURIComponent(pathname + url.search)}`;

      return {
        success: false,
        response: new Response(null, {
          status: 302,
          headers: {
            'Location': bounceUrl,
            'Cache-Control': 'no-cache',
            'X-Auth-Method': 'bounce-redirect'
          }
        })
      };
    }

    // No valid session token, return authentication error
    return {
      success: false,
      response: createSessionTokenErrorResponse(tokenValidation, request.url)
    };
  }
}

/**
 * Quick session token validation without full authentication
 * Useful for API endpoints that just need to verify the request is authenticated
 */
export function validateSessionTokenOnly(request: Request): {
  success: boolean;
  shop?: string;
  token?: string;
  error?: string;
  response?: Response;
} {
  const validation = validateSessionToken(request);

  if (!validation.success) {
    return {
      ...validation,
      response: createSessionTokenErrorResponse(validation, request.url)
    };
  }

  return validation;
}

/**
 * Middleware wrapper for route loaders
 */
export async function authenticatedLoader<T>(
  request: Request,
  loaderFunction: (args: { request: Request; session: any; admin: any }) => Promise<T>,
  options: MiddlewareOptions = {}
): Promise<T | Response> {

  const authResult = await withSessionTokenValidation(request, options);

  if (!authResult.success) {
    return authResult.response;
  }

  try {
    return await loaderFunction({
      request,
      session: authResult.session,
      admin: authResult.admin
    });
  } catch (loaderError) {
    console.error('[SESSION MIDDLEWARE] Loader function failed:', loaderError);
    throw loaderError;
  }
}

/**
 * Middleware wrapper for route actions
 */
export async function authenticatedAction<T>(
  request: Request,
  actionFunction: (args: { request: Request; session: any; admin: any }) => Promise<T>,
  options: MiddlewareOptions = {}
): Promise<T | Response> {

  const authResult = await withSessionTokenValidation(request, options);

  if (!authResult.success) {
    return authResult.response;
  }

  try {
    return await actionFunction({
      request,
      session: authResult.session,
      admin: authResult.admin
    });
  } catch (actionError) {
    console.error('[SESSION MIDDLEWARE] Action function failed:', actionError);
    throw actionError;
  }
}