import { authenticate } from "../shopify.server";
import { verifyPOSSessionToken } from "./pos-auth-balanced.server";
import { json } from "@remix-run/node";
import { isbot } from "isbot";

export interface AuthResult {
  success: boolean;
  shop?: string;
  session?: any;
  admin?: any;
  authMethod: string;
  error?: string;
  debugInfo?: any;
  accessToken?: string;
  requiresBounce?: boolean;
}

/**
 * Enhanced Authentication Flow for Embedded Apps and POS Integration
 * Implements Shopify 2025-07 token exchange pattern
 * Based on: https://shopify.dev/docs/apps/build/authentication-authorization/set-embedded-app-authorization
 */
export async function authenticateEmbeddedRequest(request: Request): Promise<AuthResult> {
  console.log('[ENHANCED AUTH] Starting 2025-07 token exchange authentication flow...');

  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';

  // CRITICAL FIX: Bot detection to prevent authentication failures
  // Skip authentication for bots, favicon requests, and static assets
  const pathname = url.pathname.toLowerCase();
  const isStaticAsset = pathname.includes('/favicon') ||
                       pathname.includes('.ico') ||
                       pathname.includes('.png') ||
                       pathname.includes('.jpg') ||
                       pathname.includes('.css') ||
                       pathname.includes('.js') ||
                       pathname.includes('/assets/') ||
                       pathname.includes('/build/') ||
                       pathname.includes('/robots.txt') ||
                       pathname.includes('/.well-known') ||
                       pathname.includes('/sitemap') ||
                       pathname.includes('.xml');

  // Allow legitimate test tools and monitoring services
  const isWhitelistedBot = userAgent.includes('CreditNote-Test-Suite') ||
                           userAgent.includes('StatusCake') ||
                           userAgent.includes('Pingdom') ||
                           userAgent.includes('UptimeRobot');

  const isBotRequest = (isbot(userAgent) && !isWhitelistedBot) || isStaticAsset;

  if (isBotRequest) {
    console.log('[ENHANCED AUTH] ⚠️ Bot or static asset request detected, skipping authentication:', {
      userAgent: userAgent.substring(0, 100),
      pathname,
      isStaticAsset,
      isBotByUserAgent: isbot(userAgent)
    });

    return {
      success: false,
      authMethod: 'BOT_DETECTED',
      error: 'Bot request or static asset - authentication skipped',
      debugInfo: {
        userAgent: userAgent.substring(0, 100),
        pathname,
        skipReason: isStaticAsset ? 'static_asset' : 'bot_user_agent'
      }
    };
  }

  const authHeader = request.headers.get('authorization');
  const isEmbeddedRequest = request.headers.get('sec-fetch-dest') === 'iframe' ||
                           request.headers.get('x-requested-with') === 'XMLHttpRequest' ||
                           url.searchParams.has('embedded') ||
                           authHeader?.startsWith('Bearer ');

  console.log('[ENHANCED AUTH] Request analysis:', {
    hasAuthHeader: !!authHeader,
    isEmbeddedRequest,
    userAgent: userAgent.substring(0, 50),
    origin: request.headers.get('Origin'),
    referer: request.headers.get('Referer'),
    isBotRequest: false // We already handled bot requests above
  });

  // Strategy 1: POS Session Token Authentication (for POS extensions)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    console.log('[ENHANCED AUTH] Attempting POS session token authentication...');

    const sessionToken = authHeader.substring(7);
    const posAuthResult = verifyPOSSessionToken(sessionToken);

    if (posAuthResult.success && posAuthResult.shopDomain) {
      console.log('[ENHANCED AUTH] ✅ POS authentication successful');
      return {
        success: true,
        shop: posAuthResult.shopDomain,
        authMethod: 'POS_SESSION_TOKEN',
        debugInfo: posAuthResult.debugInfo
      };
    } else {
      console.log('[ENHANCED AUTH] ⚠️ POS authentication failed, trying embedded auth...');
    }
  }

  // Strategy 2: Embedded App Authentication with Token Exchange (for admin interface)
  try {
    console.log('[ENHANCED AUTH] Attempting embedded app authentication with token exchange...');

    // Enhanced session token extraction for App Bridge 4.0
    const sessionToken = extractSessionToken(request);

    if (sessionToken) {
      console.log('[ENHANCED AUTH] Session token found, validating and exchanging...');

      // Validate session token structure first
      const tokenValidation = await validateSessionToken(sessionToken);

      if (!tokenValidation.valid) {
        console.log('[ENHANCED AUTH] Session token invalid, needs bounce');
        return {
          success: false,
          authMethod: 'INVALID_SESSION_TOKEN',
          requiresBounce: true,
          error: 'Session token invalid or expired',
          debugInfo: tokenValidation.debugInfo
        };
      }

      // Create a new request with proper session token formatting
      const enhancedRequest = enhanceRequestWithSessionToken(request, sessionToken);

      const { admin, session } = await authenticate.admin(enhancedRequest);

      console.log('[ENHANCED AUTH] ✅ Embedded authentication successful with token exchange');
      return {
        success: true,
        shop: session.shop,
        session,
        admin,
        authMethod: 'EMBEDDED_TOKEN_EXCHANGE',
        accessToken: session.accessToken,
        debugInfo: {
          sessionId: session.id,
          isOnline: session.isOnline,
          hasAccessToken: !!session.accessToken,
          scope: session.scope,
          tokenExchange: 'successful'
        }
      };
    }
  } catch (embedError) {
    console.log('[ENHANCED AUTH] ⚠️ Embedded authentication failed:', embedError instanceof Error ? embedError.message : 'Unknown error');

    // Check if this is a 410 (session expired) error
    if (embedError instanceof Response && embedError.status === 410) {
      return {
        success: false,
        authMethod: 'SESSION_EXPIRED',
        requiresBounce: true,
        error: 'Session expired, bounce required',
        debugInfo: { status: 410 }
      };
    }
  }

  // Strategy 3: Standard Admin Authentication (fallback)
  try {
    console.log('[ENHANCED AUTH] Attempting standard admin authentication...');

    const { admin, session } = await authenticate.admin(request);

    console.log('[ENHANCED AUTH] ✅ Standard admin authentication successful');
    return {
      success: true,
      shop: session.shop,
      session,
      admin,
      authMethod: 'STANDARD_ADMIN',
      debugInfo: {
        sessionId: session.id,
        isOnline: session.isOnline,
        hasAccessToken: !!session.accessToken
      }
    };
  } catch (adminError) {
    console.log('[ENHANCED AUTH] ⚠️ Standard admin authentication failed:', adminError instanceof Error ? adminError.message : 'Unknown error');
  }

  // Strategy 4: URL Parameter Fallback (for testing/debugging)
  const shopParam = url.searchParams.get('shop') || url.searchParams.get('shopDomain');
  if (shopParam && shopParam.includes('.myshopify.com')) {
    console.log('[ENHANCED AUTH] ⚠️ Using URL parameter fallback authentication');
    return {
      success: true,
      shop: shopParam,
      authMethod: 'URL_PARAMETER_FALLBACK',
      debugInfo: {
        warning: 'This is a fallback method and should not be used in production',
        shop: shopParam
      }
    };
  }

  // Authentication failed
  console.log('[ENHANCED AUTH] ❌ All authentication strategies failed');
  return {
    success: false,
    authMethod: 'NONE',
    error: 'No valid authentication method succeeded',
    debugInfo: {
      hasAuthHeader: !!authHeader,
      authHeaderType: authHeader?.split(' ')[0],
      hasShopParam: !!shopParam,
      userAgent: request.headers.get('User-Agent')?.substring(0, 50),
      origin: request.headers.get('Origin')
    }
  };
}

/**
 * Extract session token from various sources in priority order
 */
function extractSessionToken(request: Request): string | null {
  const url = new URL(request.url);
  const authHeader = request.headers.get('authorization');

  // Priority order based on Shopify 2025-07 best practices
  const sessionToken =
    url.searchParams.get('id_token') ||                    // App Bridge 4.0 primary
    authHeader?.replace('Bearer ', '') ||                  // Authorization header
    url.searchParams.get('session') ||                     // Legacy session param
    request.headers.get('x-shopify-session-token') ||      // Direct header
    url.searchParams.get('embedded') ||                    // Embedded param
    null;

  console.log('[ENHANCED AUTH] Session token extraction:', {
    hasIdToken: !!url.searchParams.get('id_token'),
    hasAuthHeader: !!authHeader,
    hasSessionParam: !!url.searchParams.get('session'),
    hasDirectHeader: !!request.headers.get('x-shopify-session-token'),
    tokenLength: sessionToken?.length || 0
  });

  return sessionToken;
}

/**
 * Enhance request with proper session token formatting for Shopify authentication
 */
function enhanceRequestWithSessionToken(request: Request, sessionToken: string): Request {
  const url = new URL(request.url);

  // Ensure session token is in the correct parameter
  if (!url.searchParams.has('id_token')) {
    url.searchParams.set('id_token', sessionToken);
  }

  // Create new request with enhanced URL
  const enhancedRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  return enhancedRequest;
}

/**
 * Validate session token structure and expiry
 */
async function validateSessionToken(token: string): Promise<{ valid: boolean; debugInfo: any }> {
  try {
    // Basic JWT structure validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        debugInfo: { error: 'Invalid JWT structure', partCount: parts.length }
      };
    }

    // Decode and validate payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const now = Math.floor(Date.now() / 1000);

    // Check expiry
    if (payload.exp && payload.exp < now) {
      return {
        valid: false,
        debugInfo: {
          error: 'Token expired',
          expired: true,
          expiredAt: new Date(payload.exp * 1000).toISOString()
        }
      };
    }

    // Validate required fields
    if (!payload.iss || !payload.dest || !payload.aud) {
      return {
        valid: false,
        debugInfo: {
          error: 'Missing required JWT fields',
          hasIssuer: !!payload.iss,
          hasDest: !!payload.dest,
          hasAudience: !!payload.aud
        }
      };
    }

    return {
      valid: true,
      debugInfo: {
        issuer: payload.iss,
        audience: payload.aud,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'no expiry',
        subject: payload.sub
      }
    };
  } catch (error) {
    return {
      valid: false,
      debugInfo: { error: 'Failed to parse token', details: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Create session token from Shopify admin session (for POS integration)
 */
export function createSessionTokenForPOS(session: any): string {
  // This would create a session token that POS extensions can use
  // In a real implementation, this would use proper JWT signing
  const tokenData = {
    iss: `https://${session.shop}`,
    dest: `https://${session.shop}`,
    aud: process.env.SHOPIFY_API_KEY,
    sub: session.userId?.toString() || 'user',
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
    iat: Math.floor(Date.now() / 1000),
    jti: session.id,
    sid: session.id
  };

  // For demo purposes, return a simple base64 encoded token
  // In production, this should be properly signed JWT
  return Buffer.from(JSON.stringify(tokenData)).toString('base64');
}

/**
 * Redirect to session token bounce page for token recovery
 */
export function redirectToSessionTokenBounce(request: Request, reason?: string) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop') || url.searchParams.get('shopDomain');
  const host = url.searchParams.get('host');

  const bounceUrl = new URL('/session-token-bounce', url.origin);
  bounceUrl.searchParams.set('shopify-reload', url.pathname + url.search);

  if (shop) bounceUrl.searchParams.set('shop', shop);
  if (host) bounceUrl.searchParams.set('host', host);
  if (reason) bounceUrl.searchParams.set('reason', reason);

  console.log('[ENHANCED AUTH] Redirecting to bounce page:', bounceUrl.toString());

  return new Response(null, {
    status: 302,
    headers: {
      'Location': bounceUrl.toString(),
      'X-Shopify-Retry-Invalid-Session-Request': '1'
    }
  });
}

/**
 * Middleware for routes that need enhanced authentication
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  const authResult = await authenticateEmbeddedRequest(request);

  if (!authResult.success) {
    // CRITICAL FIX: Handle bot requests gracefully instead of throwing 401
    if (authResult.authMethod === 'BOT_DETECTED') {
      console.log('[ENHANCED AUTH] Bot request detected, returning 404 instead of auth error');
      throw new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=3600', // Cache bot responses
        }
      });
    }

    // For all other authentication failures, return proper auth error
    throw new Response(JSON.stringify({
      error: 'Authentication required',
      details: authResult.error,
      authMethod: authResult.authMethod,
      debugInfo: authResult.debugInfo,
      solutions: [
        'Ensure you are accessing the app through Shopify Admin',
        'Check that your session is valid and not expired',
        'For POS: Ensure user has app permissions enabled',
        'Try refreshing the page or logging out and back in'
      ]
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return authResult;
}