import { authenticate } from "../shopify.server";
import { verifyPOSSessionToken } from "./pos-auth-balanced.server";
import { validateShopifySessionToken } from "./jwt-validation.server";
import { authenticateWithTokenExchange, createTokenExchangeErrorResponse } from "./token-exchange-2025-07.server";
import { json } from "@remix-run/node";
import { isbot } from "isbot";
import { trackBotRequest } from "./production-monitoring.server";

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

  // ENHANCED BOT DETECTION: Comprehensive pattern for Shopify 2025-07 deployment
  // Skip authentication for bots, favicon requests, and static assets
  const pathname = url.pathname.toLowerCase();
  const isStaticAsset = pathname.includes('/favicon') ||
                       pathname.includes('.ico') ||
                       pathname.includes('.png') ||
                       pathname.includes('.jpg') ||
                       pathname.includes('.gif') ||
                       pathname.includes('.svg') ||
                       pathname.includes('.css') ||
                       pathname.includes('.js') ||
                       pathname.includes('.woff') ||
                       pathname.includes('.woff2') ||
                       pathname.includes('.ttf') ||
                       pathname.includes('/assets/') ||
                       pathname.includes('/build/') ||
                       pathname.includes('/_static/') ||
                       pathname.includes('/public/') ||
                       pathname.includes('/robots.txt') ||
                       pathname.includes('/.well-known') ||
                       pathname.includes('/sitemap') ||
                       pathname.includes('.xml') ||
                       pathname.includes('.json') ||
                       pathname.includes('/manifest.json') ||
                       pathname.includes('/sw.js') ||
                       pathname.includes('/service-worker.js');

  // CRITICAL: Enhanced Vercel and deployment-specific bot patterns
  // Based on deployment logs analysis showing vercel-favicon/1.0, vercel-screenshot/1.0
  // Updated 2025-09-28: Enhanced pattern matching for new Vercel bot variants
  const isVercelBot = userAgent.includes('vercel-favicon') ||
                     userAgent.includes('vercel-screenshot') ||
                     userAgent.includes('vercel-og-image') ||
                     userAgent.includes('vercel-bot') ||
                     userAgent.includes('vercel-deployment') ||
                     userAgent.includes('vercel-cache') ||
                     userAgent.includes('vercel-edge') ||
                     userAgent.startsWith('vercel-') ||
                     userAgent.endsWith('/1.0') && userAgent.includes('vercel');

  // Allow legitimate test tools and monitoring services
  const isWhitelistedBot = userAgent.includes('CreditNote-Test-Suite') ||
                           userAgent.includes('StatusCake') ||
                           userAgent.includes('Pingdom') ||
                           userAgent.includes('UptimeRobot') ||
                           userAgent.includes('GTmetrix') ||
                           userAgent.includes('WebPageTest') ||
                           userAgent.includes('Node.js'); // Allow Node.js user agents (test scripts)

  // Common crawler and SEO bot patterns
  const isKnownCrawler = userAgent.includes('GoogleBot') ||
                        userAgent.includes('bingbot') ||
                        userAgent.includes('Slackbot') ||
                        userAgent.includes('facebookexternalhit') ||
                        userAgent.includes('WhatsApp') ||
                        userAgent.includes('LinkedInBot') ||
                        userAgent.includes('TwitterBot') ||
                        userAgent.includes('DiscordBot') ||
                        userAgent.includes('AppleBot') ||
                        userAgent.includes('DuckDuckBot') ||
                        userAgent.includes('YandexBot') ||
                        userAgent.includes('BaiduSpider');

  // First check if this is a whitelisted bot - allow it through even if detected as bot
  if (isWhitelistedBot) {
    console.log('[ENHANCED AUTH] ✅ Whitelisted bot/tool detected, allowing authentication:', {
      userAgent: userAgent.substring(0, 100),
      pathname
    });
  }

  const isBotRequest = !isWhitelistedBot && (
                       (isbot(userAgent)) ||
                       isStaticAsset ||
                       isVercelBot ||
                       isKnownCrawler
                       );

  if (isBotRequest) {
    // Determine specific bot detection reason for better debugging
    let detectionReason = 'unknown';
    if (isStaticAsset) detectionReason = 'static_asset';
    else if (isVercelBot) detectionReason = 'vercel_bot';
    else if (isKnownCrawler) detectionReason = 'known_crawler';
    else if (isbot(userAgent)) detectionReason = 'isbot_detection';

    console.log('[ENHANCED AUTH] ⚠️ Bot or static asset request detected, skipping authentication:', {
      userAgent: userAgent.substring(0, 100),
      pathname,
      detectionReason,
      isStaticAsset,
      isVercelBot,
      isKnownCrawler,
      isBotByUserAgent: isbot(userAgent)
    });

    // Track bot request for monitoring and analytics
    trackBotRequest(request, detectionReason, {
      detectionCategories: {
        staticAsset: isStaticAsset,
        vercelBot: isVercelBot,
        knownCrawler: isKnownCrawler,
        isbotDetection: isbot(userAgent),
        whitelisted: isWhitelistedBot
      }
    });

    return {
      success: false,
      authMethod: 'BOT_DETECTED',
      error: 'Bot request or static asset - authentication skipped',
      debugInfo: {
        userAgent: userAgent.substring(0, 100),
        pathname,
        skipReason: detectionReason,
        detectionCategories: {
          staticAsset: isStaticAsset,
          vercelBot: isVercelBot,
          knownCrawler: isKnownCrawler,
          isbotDetection: isbot(userAgent),
          whitelisted: isWhitelistedBot
        }
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

  // Strategy 2: 2025-07 Embedded App Authentication with Enhanced Token Exchange
  try {
    console.log('[ENHANCED AUTH] 🔐 Attempting 2025-07 compliant embedded authentication...');

    // Enhanced session token extraction for App Bridge 4.0 with 2025-07 patterns
    const sessionToken = extractSessionToken(request);

    if (sessionToken) {
      console.log('[ENHANCED AUTH] 📋 Session token found, applying 2025-07 token exchange patterns...');

      // ENHANCED: Use proper token exchange instead of session bounces
      const tokenExchangeResult = await authenticateWithTokenExchange(sessionToken, request);

      if (tokenExchangeResult.success) {
        console.log('[ENHANCED AUTH] ✅ 2025-07 token exchange authentication successful');
        return {
          success: true,
          shop: tokenExchangeResult.shop!,
          session: tokenExchangeResult.session,
          admin: null, // Admin will be available through session.accessToken
          authMethod: tokenExchangeResult.authMethod,
          accessToken: tokenExchangeResult.accessToken,
          debugInfo: {
            ...tokenExchangeResult.debugInfo,
            tokenExchange: '2025-07-successful',
            authStrategy: 'tokenExchange',
            eliminatedBounce: true,
            apiVersion: '2025-07'
          }
        };
      } else {
        console.log('[ENHANCED AUTH] ❌ 2025-07 token exchange failed - providing enhanced error response');
        console.log('[ENHANCED AUTH] Token exchange error:', tokenExchangeResult.error);
        console.log('[ENHANCED AUTH] Debug info:', tokenExchangeResult.debugInfo);

        // Instead of bouncing, provide detailed error response for better debugging
        return {
          success: false,
          authMethod: tokenExchangeResult.authMethod,
          requiresBounce: false, // 2025-07 doesn't use bounces
          error: tokenExchangeResult.error || 'Token exchange authentication failed',
          debugInfo: {
            ...tokenExchangeResult.debugInfo,
            tokenExchangePattern: '2025-07-compliant',
            authStrategy: 'tokenExchange',
            bouncePrevented: true,
            enhancedErrorHandling: 'ENABLED'
          }
        };
      }
    }
  } catch (embedError) {
    console.log('[ENHANCED AUTH] ⚠️ 2025-07 authentication error:', embedError instanceof Error ? embedError.message : 'Unknown error');

    // Handle 2025-07 specific error patterns
    if (embedError instanceof Response && embedError.status === 410) {
      return {
        success: false,
        authMethod: 'SESSION_EXPIRED_2025_07',
        requiresBounce: true,
        error: 'Session expired - 2025-07 bounce recovery required',
        debugInfo: {
          status: 410,
          pattern: '2025-07-session-recovery',
          authStrategy: 'newEmbeddedAuthStrategy'
        }
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
 * Validate session token using 2025-07 compliant JWT validation with signature verification
 * CRITICAL FIX: Pass request parameter for iOS device detection and enhanced clock skew tolerance
 */
async function validateSessionToken(token: string, request?: Request): Promise<{ valid: boolean; debugInfo: any }> {
  console.log('[ENHANCED AUTH] Using 2025-07 compliant JWT validation with signature verification...');

  // Enhanced debug information for troubleshooting
  console.log('[ENHANCED AUTH] Token validation context:', {
    tokenLength: token?.length || 0,
    tokenPreview: token?.substring(0, 30) + '...',
    userAgent: request?.headers?.get('User-Agent')?.substring(0, 50) || 'Unknown',
    origin: request?.headers?.get('Origin') || 'Unknown',
    hasShopifySecret: !!process.env.SHOPIFY_API_SECRET,
    hasShopifyApiKey: !!process.env.SHOPIFY_API_KEY
  });

  // CRITICAL: Pass request parameter for iOS device detection and clock skew tolerance
  const validationResult = validateShopifySessionToken(token, request);

  if (!validationResult.valid) {
    console.error('[ENHANCED AUTH] 🚨 Session token validation failed:', validationResult.error);
    console.error('[ENHANCED AUTH] Detailed error info:', validationResult.debugInfo);

    // Enhanced error categorization for better troubleshooting
    let errorCategory = 'UNKNOWN';
    if (validationResult.error?.includes('signature')) {
      errorCategory = 'SIGNATURE_VERIFICATION_FAILED';
    } else if (validationResult.error?.includes('audience')) {
      errorCategory = 'AUDIENCE_VALIDATION_FAILED';
    } else if (validationResult.error?.includes('expired')) {
      errorCategory = 'TOKEN_EXPIRED';
    } else if (validationResult.error?.includes('not yet valid')) {
      errorCategory = 'TOKEN_NOT_YET_VALID';
    } else if (validationResult.error?.includes('missing')) {
      errorCategory = 'MISSING_REQUIRED_FIELDS';
    }

    return {
      valid: false,
      debugInfo: {
        ...validationResult.debugInfo,
        error: validationResult.error,
        errorCategory,
        validationMethod: 'SHOPIFY_2025_07_JWT_SIGNATURE_VERIFIED_WITH_REQUEST',
        securityLevel: 'INVALID',
        iosDeviceDetection: request ? 'ENABLED' : 'DISABLED',
        clockSkewTolerance: validationResult.debugInfo?.clockSkewTolerance || 'STANDARD',
        timestamp: new Date().toISOString(),
        troubleshootingHints: getTroubleshootingHints(errorCategory)
      }
    };
  }

  console.log('[ENHANCED AUTH] ✅ Session token validation successful');
  return {
    valid: validationResult.valid,
    debugInfo: {
      ...validationResult.debugInfo,
      error: validationResult.error,
      validationMethod: 'SHOPIFY_2025_07_JWT_SIGNATURE_VERIFIED_WITH_REQUEST',
      securityLevel: validationResult.valid ? 'HIGH' : 'INVALID',
      iosDeviceDetection: request ? 'ENABLED' : 'DISABLED',
      clockSkewTolerance: validationResult.debugInfo?.clockSkewTolerance || 'STANDARD',
      validatedAt: new Date().toISOString()
    }
  };
}

/**
 * Get troubleshooting hints based on validation error category
 */
function getTroubleshootingHints(errorCategory: string): string[] {
  switch (errorCategory) {
    case 'SIGNATURE_VERIFICATION_FAILED':
      return [
        'Check SHOPIFY_API_SECRET environment variable',
        'Verify token was not modified in transit',
        'Ensure token is fresh and issued by Shopify'
      ];
    case 'AUDIENCE_VALIDATION_FAILED':
      return [
        'Check SHOPIFY_API_KEY environment variable',
        'Verify token was issued for this specific app',
        'Check for environment variable conflicts'
      ];
    case 'TOKEN_EXPIRED':
    case 'TOKEN_NOT_YET_VALID':
      return [
        'Use session token bounce to get fresh token',
        'Check system clock synchronization',
        'Consider iOS clock skew tolerance settings'
      ];
    default:
      return [
        'Check all SHOPIFY_* environment variables',
        'Verify token structure and format',
        'Review Shopify app configuration'
      ];
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
 * Enhanced with iOS-specific recovery parameters for better success rates
 */
export function redirectToSessionTokenBounce(request: Request, reason?: string) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop') || url.searchParams.get('shopDomain');
  const host = url.searchParams.get('host');

  // Enhanced iOS device detection for session recovery
  const userAgent = request.headers.get('User-Agent') || '';
  const isIOSDevice = userAgent.includes('iPhone') ||
                     userAgent.includes('iPad') ||
                     userAgent.includes('iPod') ||
                     userAgent.includes('Safari') && userAgent.includes('Mobile') ||
                     userAgent.includes('Shopify POS');

  const bounceUrl = new URL('/session-token-bounce', url.origin);
  bounceUrl.searchParams.set('shopify-reload', url.pathname + url.search);

  if (shop) bounceUrl.searchParams.set('shop', shop);
  if (host) bounceUrl.searchParams.set('host', host);
  if (reason) bounceUrl.searchParams.set('reason', reason);

  // iOS-specific recovery enhancements based on research
  if (isIOSDevice) {
    bounceUrl.searchParams.set('ios-recovery', 'true');
    bounceUrl.searchParams.set('retry-count', '5'); // Extra retries for iOS devices
    bounceUrl.searchParams.set('device-type', 'ios');
    bounceUrl.searchParams.set('recovery-strategy', 'enhanced');

    console.log('[ENHANCED AUTH] 📱 iOS device detected - applying enhanced bounce recovery:', {
      userAgent: userAgent.substring(0, 100),
      shop,
      reason
    });
  }

  console.log('[ENHANCED AUTH] Redirecting to bounce page:', bounceUrl.toString());

  return new Response(null, {
    status: 302,
    headers: {
      'Location': bounceUrl.toString(),
      'X-Shopify-Retry-Invalid-Session-Request': '1',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
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