import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticateApp, extractShopDomain } from "../utils/auth-middleware.server";
import { verifyPOSSessionToken } from "../utils/pos-auth-balanced.server";

/**
 * Session Token Validation Endpoint
 * Validates session tokens for both embedded apps and POS extensions
 */

export async function loader({ request }: LoaderFunctionArgs) {
  return handleValidation(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handleValidation(request);
}

async function handleValidation(request: Request) {
  const startTime = Date.now();

  try {
    console.log('[AUTH VALIDATE] Starting session token validation...');

    const url = new URL(request.url);
    const method = request.method;
    const authHeader = request.headers.get('authorization');
    const sessionTokenParam = url.searchParams.get('sessionToken') || url.searchParams.get('token');

    // Enhanced request analysis
    console.log('[AUTH VALIDATE] Request analysis:', {
      method,
      hasAuthHeader: !!authHeader,
      hasTokenParam: !!sessionTokenParam,
      userAgent: request.headers.get('User-Agent')?.substring(0, 50),
      origin: request.headers.get('Origin'),
      referer: request.headers.get('Referer')
    });

    // Strategy 1: Validate using enhanced authentication flow
    try {
      const authResult = await authenticateApp(request);

      if (authResult.success) {
        console.log('[AUTH VALIDATE] ✅ Enhanced authentication validation successful');

        return json({
          valid: true,
          shop: authResult.shop,
          authMethod: 'SHOPIFY_ADMIN_AUTH',
          sessionInfo: {
            sessionId: authResult.session?.id,
            isOnline: authResult.session?.isOnline,
            scope: authResult.session?.scope,
            expires: authResult.session?.expires?.toISOString(),
            userId: authResult.session?.userId?.toString()
          },
          metadata: {
            validatedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            validationType: 'ENHANCED_AUTH'
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }
    } catch (enhancedError) {
      console.log('[AUTH VALIDATE] Enhanced authentication failed, trying other methods...');
    }

    // Strategy 2: Direct session token validation (for explicit token validation)
    const tokenToValidate = sessionTokenParam || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (tokenToValidate) {
      console.log('[AUTH VALIDATE] Attempting direct token validation...');

      // Try POS token validation
      const posValidation = verifyPOSSessionToken(tokenToValidate);

      if (posValidation.success) {
        console.log('[AUTH VALIDATE] ✅ POS token validation successful');

        return json({
          valid: true,
          shop: posValidation.shopDomain,
          authMethod: 'POS_SESSION_TOKEN',
          sessionInfo: {
            userId: posValidation.userId,
            sessionId: posValidation.sessionId
          },
          metadata: {
            validatedAt: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            validationType: 'DIRECT_POS_TOKEN'
          },
          debugInfo: posValidation.debugInfo
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      }

      // Try JWT validation (basic structure check)
      try {
        const jwtParts = tokenToValidate.split('.');
        if (jwtParts.length === 3) {
          const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
          const now = Math.floor(Date.now() / 1000);

          console.log('[AUTH VALIDATE] JWT structure validation:', {
            hasIssuer: !!payload.iss,
            hasSubject: !!payload.sub,
            hasExpiry: !!payload.exp,
            isExpired: payload.exp && payload.exp < now
          });

          if (payload.iss && payload.sub && payload.exp && payload.exp > now) {
            console.log('[AUTH VALIDATE] ✅ JWT structure validation successful');

            return json({
              valid: true,
              shop: extractShopFromIssuer(payload.iss),
              authMethod: 'JWT_STRUCTURE_VALID',
              sessionInfo: {
                issuer: payload.iss,
                subject: payload.sub,
                audience: payload.aud,
                expiresAt: new Date(payload.exp * 1000).toISOString(),
                issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined
              },
              metadata: {
                validatedAt: new Date().toISOString(),
                processingTime: Date.now() - startTime,
                validationType: 'JWT_STRUCTURE'
              },
              debugInfo: {
                tokenType: 'JWT',
                validation: 'STRUCTURE_ONLY',
                warning: 'This validation only checks JWT structure, not cryptographic signature'
              }
            }, {
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
              }
            });
          }
        }
      } catch (jwtError) {
        console.log('[AUTH VALIDATE] JWT parsing failed:', jwtError);
      }
    }

    // Validation failed
    console.log('[AUTH VALIDATE] ❌ All validation strategies failed');

    return json({
      valid: false,
      error: 'No valid session token found or token validation failed',
      authMethod: 'NONE',
      solutions: [
        'Ensure you are accessing through Shopify Admin',
        'Check that your session is valid and not expired',
        'For POS: Ensure user has app permissions enabled',
        'Try refreshing the page or re-authenticating'
      ],
      metadata: {
        validatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        validationType: 'FAILED'
      },
      debugInfo: {
        hasAuthHeader: !!authHeader,
        hasTokenParam: !!sessionTokenParam,
        authHeaderType: authHeader?.split(' ')[0],
        requestMethod: method,
        userAgent: request.headers.get('User-Agent')?.substring(0, 50)
      }
    }, {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('[AUTH VALIDATE] Critical error during validation:', error);

    return json({
      valid: false,
      error: 'Validation service error',
      details: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        validatedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        validationType: 'ERROR'
      }
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

/**
 * Extract shop domain from JWT issuer field
 */
function extractShopFromIssuer(issuer: string): string | null {
  try {
    const url = new URL(issuer);
    const hostname = url.hostname;

    if (hostname.includes('.myshopify.com')) {
      return hostname;
    }

    // Extract shop name and add .myshopify.com
    const shopMatch = hostname.match(/^([^.]+)/);
    if (shopMatch) {
      return `${shopMatch[1]}.myshopify.com`;
    }

    return hostname;
  } catch (error) {
    console.warn('[AUTH VALIDATE] Failed to extract shop from issuer:', issuer);
    return null;
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Session-Token",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "public, max-age=86400"
    },
  });
}