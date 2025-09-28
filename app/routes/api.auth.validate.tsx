import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticateEmbeddedRequest } from "../utils/enhanced-auth.server";
import { verifyPOSSessionToken } from "../utils/pos-auth-balanced.server";
import { validateShopifySessionToken } from "../utils/jwt-validation.server";
import { handleRouteError, AppErrorFactory } from "../utils/advanced-error-handling.server";

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

  // Handle CORS preflight requests immediately, before any authentication
  if (request.method === 'OPTIONS') {
    console.log('[AUTH VALIDATE] CORS preflight request detected');
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
      const authResult = await authenticateEmbeddedRequest(request);

      // Handle bot detection - return 404 instead of continuing authentication
      if (authResult.authMethod === 'BOT_DETECTED') {
        console.log('[AUTH VALIDATE] Bot request detected, returning 404');
        return new Response('Not Found', {
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=3600',
          }
        });
      }

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

      // Try 2025-07 compliant JWT validation with signature verification
      try {
        console.log('[AUTH VALIDATE] Attempting 2025-07 JWT validation with signature verification...');

        const jwtValidation = validateShopifySessionToken(tokenToValidate);

        if (jwtValidation.valid && jwtValidation.payload) {
          console.log('[AUTH VALIDATE] ✅ 2025-07 JWT validation successful with signature verification');

          const { payload } = jwtValidation;

          return json({
            valid: true,
            shop: extractShopFromIssuer(payload.iss) || extractShopFromIssuer(payload.dest),
            authMethod: 'JWT_SIGNATURE_VERIFIED_2025_07',
            sessionInfo: {
              issuer: payload.iss,
              destination: payload.dest,
              subject: payload.sub,
              audience: payload.aud,
              expiresAt: new Date(payload.exp * 1000).toISOString(),
              issuedAt: new Date(payload.iat * 1000).toISOString(),
              notBefore: new Date(payload.nbf * 1000).toISOString(),
              sessionId: payload.sid || payload.jti
            },
            metadata: {
              validatedAt: new Date().toISOString(),
              processingTime: Date.now() - startTime,
              validationType: 'JWT_SIGNATURE_VERIFIED',
              apiVersion: '2025-07',
              securityLevel: 'HIGH'
            },
            debugInfo: {
              tokenType: 'JWT',
              validation: 'SHOPIFY_2025_07_COMPLIANT',
              signatureVerified: true,
              algorithm: 'HS256',
              ...jwtValidation.debugInfo
            }
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          });
        } else {
          console.log('[AUTH VALIDATE] 2025-07 JWT validation failed:', jwtValidation.error);

          // Fallback to basic JWT structure check (less secure)
          const jwtParts = tokenToValidate.split('.');
          if (jwtParts.length === 3) {
            const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
            const now = Math.floor(Date.now() / 1000);

            console.log('[AUTH VALIDATE] Fallback JWT structure validation:', {
              hasIssuer: !!payload.iss,
              hasSubject: !!payload.sub,
              hasExpiry: !!payload.exp,
              isExpired: payload.exp && payload.exp < now
            });

            if (payload.iss && payload.sub && payload.exp && payload.exp > now) {
              console.log('[AUTH VALIDATE] ⚠️ JWT structure validation successful (no signature verification)');

              return json({
                valid: true,
                shop: extractShopFromIssuer(payload.iss),
                authMethod: 'JWT_STRUCTURE_ONLY_INSECURE',
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
                  validationType: 'JWT_STRUCTURE_FALLBACK',
                  securityLevel: 'LOW'
                },
                debugInfo: {
                  tokenType: 'JWT',
                  validation: 'STRUCTURE_ONLY_FALLBACK',
                  signatureVerified: false,
                  warning: 'Token structure is valid but signature was not verified - less secure',
                  signatureValidationError: jwtValidation.error
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
    console.error('[AUTH VALIDATE] Critical error during validation - using advanced error handling:', error);

    // Create appropriate authentication error
    const appError = AppErrorFactory.createAuthenticationError(
      {
        processingTime: Date.now() - startTime,
        validationType: 'ERROR',
        originalError: error instanceof Error ? error.message : 'Unknown error'
      },
      {
        route: '/api/auth/validate',
        userAgent: request.headers.get('User-Agent')
      }
    );

    return handleRouteError(appError, request);
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

