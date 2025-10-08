import jwt from 'jsonwebtoken';
import { sessionStorage } from '../shopify.server';

/**
 * Validates session tokens from POS UI extensions
 * POS extensions send JWT tokens in the Authorization header that need to be verified
 * differently than embedded admin app requests
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

interface POSAuthResult {
  shop: string;
  userId: string;
  sessionId: string;
  payload: SessionTokenPayload;
}

/**
 * Validates a session token from a POS extension request
 * @param sessionToken - The JWT session token from the Authorization header
 * @returns Validated session data
 * @throws Error if token is invalid or expired
 */
export async function validatePOSSessionToken(sessionToken: string): Promise<POSAuthResult> {
  console.log('[POS Auth] Validating session token from POS extension');

  if (!sessionToken || sessionToken.trim() === '') {
    throw new Error('No session token provided');
  }

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!apiSecret) {
    console.error('[POS Auth] SHOPIFY_API_SECRET not configured');
    throw new Error('Server configuration error');
  }

  if (!apiKey) {
    console.error('[POS Auth] SHOPIFY_API_KEY not configured');
    throw new Error('Server configuration error');
  }

  try {
    // Verify the JWT token using the app's API secret
    const decoded = jwt.verify(sessionToken, apiSecret, {
      algorithms: ['HS256'],
    }) as SessionTokenPayload;

    console.log('[POS Auth] Token decoded successfully:', {
      iss: decoded.iss,
      dest: decoded.dest,
      aud: decoded.aud,
      sub: decoded.sub,
      exp: new Date(decoded.exp * 1000).toISOString(),
    });

    // Validate the token payload
    if (!decoded.dest) {
      throw new Error('Invalid token: missing dest (shop domain)');
    }

    if (decoded.aud !== apiKey) {
      console.error('[POS Auth] Token audience mismatch:', {
        expected: apiKey,
        received: decoded.aud,
      });
      throw new Error('Invalid token: audience mismatch');
    }

    // Extract shop domain from dest field (format: https://shop-name.myshopify.com)
    const shopDomain = decoded.dest.replace('https://', '');

    console.log('[POS Auth] ✅ Session token validated successfully for shop:', shopDomain);

    return {
      shop: shopDomain,
      userId: decoded.sub,
      sessionId: decoded.sid,
      payload: decoded,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      console.error('[POS Auth] Token expired:', error.message);
      throw new Error('Session token expired - please refresh the app');
    } else if (error instanceof jwt.JsonWebTokenError) {
      console.error('[POS Auth] Invalid token:', error.message);
      throw new Error('Invalid session token');
    } else {
      console.error('[POS Auth] Token validation error:', error);
      throw error;
    }
  }
}

/**
 * Detects if a request is from a POS extension based on headers
 * @param request - The incoming request
 * @returns true if the request is from a POS extension
 */
export function isPOSRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const userAgent = request.headers.get('User-Agent') || '';
  const shopDomainHeader = request.headers.get('X-Shopify-Shop-Domain');

  // Check if request has Bearer token (POS extensions send JWT in Authorization header)
  const hasBearerToken = authHeader?.startsWith('Bearer ');

  // Check if User-Agent indicates POS
  const isPOSUserAgent = userAgent.includes('Shopify POS') || userAgent.includes('POS/');

  // Check for explicit POS request header
  const hasPOSHeader = request.headers.get('X-POS-Request') === 'true';

  // Check for shop domain header (common in POS extension requests)
  const hasShopDomainHeader = !!shopDomainHeader;

  const isPOS = hasBearerToken && (isPOSUserAgent || hasPOSHeader || hasShopDomainHeader);

  if (isPOS) {
    console.log('[POS Auth] Detected POS extension request:', {
      hasBearerToken,
      isPOSUserAgent,
      hasPOSHeader,
      hasShopDomainHeader,
    });
  }

  return isPOS;
}

/**
 * Extracts the session token from the Authorization header
 * @param request - The incoming request
 * @returns The session token or null
 */
export function extractSessionToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Gets or creates an offline session for the POS request
 * This ensures we have a valid session in the database for the shop
 * @param shop - The shop domain
 * @returns Session data
 */
export async function getOrCreatePOSSession(shop: string) {
  console.log('[POS Auth] Getting or creating offline session for shop:', shop);

  try {
    // Try to find an existing offline session for this shop
    const sessions = await sessionStorage.findSessionsByShop(shop);

    // Look for an offline session (isOnline = false)
    const offlineSession = sessions.find(s => !s.isOnline);

    if (offlineSession) {
      console.log('[POS Auth] Found existing offline session:', offlineSession.id);
      return offlineSession;
    }

    console.log('[POS Auth] No offline session found for shop:', shop);
    console.log('[POS Auth] POS extensions require the shop to have completed the OAuth flow');

    throw new Error('No active session found. Please install or reinstall the app from the Shopify admin.');
  } catch (error) {
    console.error('[POS Auth] Error getting session:', error);
    throw error;
  }
}
