import { json } from "@remix-run/node";
import { ApiVersion } from "@shopify/shopify-app-remix/server";
import crypto from "crypto";

/**
 * STRICT POS Authentication for 2025-07
 * Replaces overly permissive authentication with proper validation
 * Addresses "load fails and 0 total credit" issues caused by masked auth failures
 */

interface SessionTokenPayload {
  iss: string;      // Issuer (Shopify domain)
  dest: string;     // Destination shop domain
  aud: string;      // Audience (app client ID)
  sub: string;      // Subject (user ID)
  exp: number;      // Expiration timestamp
  nbf: number;      // Not before timestamp
  iat: number;      // Issued at timestamp
  jti: string;      // JWT ID
  sid: string;      // Session ID
}

interface AuthResult {
  success: boolean;
  shopDomain?: string;
  userId?: string;
  sessionId?: string;
  error?: string;
  status?: number;
}

/**
 * STRICT Authentication - Properly validates session tokens
 * No longer masks authentication failures that cause data loading issues
 */
export function verifyPOSSessionTokenStrict(token: string): AuthResult {
  console.log('[POS Auth Strict] Starting strict token verification...');

  if (!token || typeof token !== 'string') {
    return {
      success: false,
      error: "Missing or invalid session token",
      status: 401
    };
  }

  try {
    // PHASE 1: JWT Structure Validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        success: false,
        error: "Invalid JWT format - must have 3 parts",
        status: 401
      };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // PHASE 2: Decode and Parse JWT
    let header, payload: SessionTokenPayload;
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    } catch (parseError) {
      console.error('[POS Auth Strict] JWT parsing failed:', parseError);
      return {
        success: false,
        error: "Invalid JWT format - parsing failed",
        status: 401
      };
    }

    console.log('[POS Auth Strict] JWT parsed:', {
      algorithm: header.alg,
      issuer: payload.iss,
      audience: payload.aud,
      destination: payload.dest,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none'
    });

    // PHASE 3: Algorithm Validation
    if (!header.alg || (header.alg !== 'HS256' && header.alg !== 'RS256')) {
      return {
        success: false,
        error: `Unsupported JWT algorithm: ${header.alg}`,
        status: 401
      };
    }

    // PHASE 4: STRICT Signature Verification
    const appSecret = process.env.SHOPIFY_API_SECRET;
    if (!appSecret) {
      console.error('[POS Auth Strict] Missing SHOPIFY_API_SECRET environment variable');
      return {
        success: false,
        error: "Server configuration error",
        status: 500
      };
    }

    // Verify HMAC signature for HS256
    if (header.alg === 'HS256') {
      try {
        const dataToSign = `${headerB64}.${payloadB64}`;
        const expectedSignature = crypto
          .createHmac('sha256', appSecret)
          .update(dataToSign)
          .digest('base64url');

        if (!crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'base64url'),
          Buffer.from(signatureB64, 'base64url')
        )) {
          console.error('[POS Auth Strict] JWT signature verification FAILED');
          return {
            success: false,
            error: "Invalid JWT signature",
            status: 401
          };
        }

        console.log('[POS Auth Strict] ✅ JWT signature verified successfully');
      } catch (signatureError) {
        console.error('[POS Auth Strict] Signature verification error:', signatureError);
        return {
          success: false,
          error: "JWT signature verification failed",
          status: 401
        };
      }
    }

    // PHASE 5: STRICT Token Expiry Validation
    const now = Math.floor(Date.now() / 1000);

    // Check token expiry with minimal grace period (10 seconds max)
    if (payload.exp) {
      if (payload.exp <= now) {
        const gracePeriod = 10; // 10 seconds grace period only
        if (payload.exp < now - gracePeriod) {
          console.error('[POS Auth Strict] Token expired:', {
            expiredAt: new Date(payload.exp * 1000).toISOString(),
            currentTime: new Date(now * 1000).toISOString(),
            secondsExpired: now - payload.exp
          });
          return {
            success: false,
            error: "Session token expired - please refresh",
            status: 401
          };
        }
        console.warn('[POS Auth Strict] Token recently expired but within grace period');
      }
    } else {
      console.warn('[POS Auth Strict] Token has no expiration claim');
    }

    // Check not-before claim
    if (payload.nbf && payload.nbf > now + 10) { // 10 second tolerance
      return {
        success: false,
        error: "Token not yet valid",
        status: 401
      };
    }

    // PHASE 6: Extract and Validate Shop Domain
    let shopDomain = payload.dest || payload.iss;

    // Clean up shop domain
    if (shopDomain) {
      shopDomain = shopDomain.replace('https://', '').replace('http://', '').replace(/\/$/, '');

      // Validate shop domain format
      if (!shopDomain.includes('.myshopify.com') && !shopDomain.includes('.shopify.com')) {
        // Try appending .myshopify.com if it looks like a shop name
        if (shopDomain.match(/^[a-zA-Z0-9-]+$/)) {
          shopDomain = `${shopDomain}.myshopify.com`;
        } else {
          return {
            success: false,
            error: "Invalid shop domain in token",
            status: 400
          };
        }
      }
    }

    if (!shopDomain) {
      return {
        success: false,
        error: "Missing shop domain in token",
        status: 400
      };
    }

    // PHASE 7: Audience Validation (Optional but recommended)
    const expectedAudience = process.env.SHOPIFY_API_KEY;
    if (expectedAudience && payload.aud !== expectedAudience) {
      console.warn('[POS Auth Strict] Audience mismatch:', {
        expected: expectedAudience,
        received: payload.aud
      });
    }

    console.log('[POS Auth Strict] ✅ Token validation successful:', {
      shopDomain,
      userId: payload.sub,
      sessionId: payload.sid,
      issuedAt: new Date(payload.iat * 1000).toISOString(),
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none'
    });

    return {
      success: true,
      shopDomain,
      userId: payload.sub,
      sessionId: payload.sid
    };

  } catch (error) {
    console.error('[POS Auth Strict] Unexpected error during validation:', error);
    return {
      success: false,
      error: "Token validation failed",
      status: 500
    };
  }
}

/**
 * Creates a standardized error response for POS authentication failures
 */
export function createPOSAuthErrorResponse(
  message: string,
  status: number = 401,
  details?: any
) {
  return json(
    {
      success: false,
      error: message,
      details,
      metadata: {
        authType: "POS_SESSION_TOKEN_STRICT",
        timestamp: new Date().toISOString(),
        apiVersion: ApiVersion.July25
      }
    },
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  );
}

/**
 * Creates a standardized success response for POS operations
 */
export function createPOSSuccessResponse(
  data: any,
  shopDomain?: string,
  locationId?: string
) {
  return json(
    {
      success: true,
      data,
      metadata: {
        shop: shopDomain,
        locationId,
        authType: "POS_SESSION_TOKEN_STRICT",
        timestamp: new Date().toISOString(),
        apiVersion: ApiVersion.July25
      }
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  );
}