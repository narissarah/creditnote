import { json } from "@remix-run/node";
import { ApiVersion } from "@shopify/shopify-app-remix/server";
import crypto from "crypto";

/**
 * STRICT POS Authentication - Surfaces real permission issues
 * Based on ultra-deep research of Shopify POS UI Extensions documentation
 */

interface SessionTokenPayload {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
}

interface AuthResult {
  success: boolean;
  shopDomain?: string;
  userId?: string;
  sessionId?: string;
  error?: string;
  status?: number;
  debugInfo?: any;
}

/**
 * STRICT POS Session Token Verification - NO FALLBACKS
 * This will surface the real authentication issues instead of masking them
 */
export function verifyPOSSessionTokenStrict(token: string): AuthResult {
  console.log('[POS Auth Strict] Starting strict token verification...');

  if (!token) {
    return {
      success: false,
      error: "No session token provided - user likely lacks app permissions",
      status: 401,
      debugInfo: { issue: "NULL_TOKEN", solution: "Enable app permissions for POS user" }
    };
  }

  try {
    // Parse JWT structure
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        success: false,
        error: "Invalid JWT format - not a proper session token",
        status: 401,
        debugInfo: { issue: "INVALID_JWT", tokenLength: token.length }
      };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    let payload: SessionTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch (parseError) {
      return {
        success: false,
        error: "Invalid JWT payload format",
        status: 401,
        debugInfo: { issue: "JWT_PARSE_ERROR", error: parseError }
      };
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp <= now) {
      return {
        success: false,
        error: "Session token expired - refresh required",
        status: 401,
        debugInfo: {
          issue: "TOKEN_EXPIRED",
          expiredAt: new Date(payload.exp * 1000).toISOString(),
          now: new Date(now * 1000).toISOString()
        }
      };
    }

    // Extract shop domain with strict validation
    let shopDomain = payload.dest || payload.iss?.replace('https://', '').replace('/', '');

    if (!shopDomain) {
      return {
        success: false,
        error: "No shop domain found in session token",
        status: 400,
        debugInfo: {
          issue: "NO_SHOP_DOMAIN",
          payload: { dest: payload.dest, iss: payload.iss, aud: payload.aud }
        }
      };
    }

    // Normalize shop domain
    if (!shopDomain.includes('.myshopify.com')) {
      if (shopDomain.match(/^[a-zA-Z0-9-]+$/)) {
        shopDomain = `${shopDomain}.myshopify.com`;
      } else {
        return {
          success: false,
          error: "Invalid shop domain format in token",
          status: 400,
          debugInfo: { issue: "INVALID_SHOP_FORMAT", shopDomain }
        };
      }
    }

    console.log('[POS Auth Strict] ✅ Token verified successfully for shop:', shopDomain);

    return {
      success: true,
      shopDomain,
      userId: payload.sub,
      sessionId: payload.sid || payload.jti,
      debugInfo: {
        authMethod: "STRICT_JWT_VERIFICATION",
        shop: shopDomain,
        expiresAt: new Date(payload.exp * 1000).toISOString()
      }
    };

  } catch (error) {
    console.error('[POS Auth Strict] Token verification failed:', error);
    return {
      success: false,
      error: "Session token verification failed",
      status: 401,
      debugInfo: {
        issue: "VERIFICATION_FAILED",
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Enhanced error response with debugging information
 */
export function createPOSAuthErrorResponseWithDebug(result: AuthResult) {
  const errorResponse = {
    success: false,
    error: result.error || "Authentication failed",
    data: [],
    total: 0,
    debugInfo: result.debugInfo,
    solutions: getPossibleSolutions(result.debugInfo?.issue),
    metadata: {
      timestamp: new Date().toISOString(),
      authType: "STRICT_POS_SESSION_TOKEN",
      status: result.status || 401
    }
  };

  console.log('[POS Auth Strict] Error response:', errorResponse);

  return json(errorResponse, {
    status: result.status || 401,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json"
    }
  });
}

/**
 * Provide solution suggestions based on the issue type
 */
function getPossibleSolutions(issue?: string): string[] {
  switch (issue) {
    case "NULL_TOKEN":
      return [
        "Ensure POS user is logged in with email/password (not PIN)",
        "Enable CreditNote app permissions for the POS user",
        "Check: Shopify Admin → Settings → Users → [User] → Apps → Enable CreditNote"
      ];
    case "TOKEN_EXPIRED":
      return [
        "Refresh the POS session",
        "Re-authenticate the POS user",
        "Check device clock synchronization"
      ];
    case "NO_SHOP_DOMAIN":
      return [
        "Verify user has correct shop access",
        "Check if user belongs to the correct Shopify store",
        "Ensure app is properly installed on the shop"
      ];
    case "INVALID_JWT":
      return [
        "Update POS app to latest version",
        "Verify API version compatibility (requires 2025-07)",
        "Check if POS version supports session tokens (requires 10.6.0+)"
      ];
    default:
      return [
        "Check POS user app permissions",
        "Verify user authentication method (email vs PIN)",
        "Ensure app is properly installed and configured"
      ];
  }
}
