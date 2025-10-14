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
 * Detects if a request is from a POS extension based on headers and query parameters
 * POS extensions cannot send custom headers to external domains due to CORS restrictions,
 * so we also check for session tokens in query parameters
 * @param request - The incoming request
 * @returns true if the request is from a POS extension
 */
export function isPOSRequest(request: Request): boolean {
  const url = new URL(request.url);
  const authHeader = request.headers.get('Authorization');
  const customTokenHeader = request.headers.get('X-Shopify-Access-Token');
  const userAgent = request.headers.get('User-Agent') || '';
  const shopDomainHeader = request.headers.get('X-Shopify-Shop-Domain');
  const origin = request.headers.get('Origin') || '';

  // Check if request has Bearer token (Authorization header) OR custom token header
  const hasBearerToken = authHeader?.startsWith('Bearer ');
  const hasCustomToken = !!customTokenHeader;

  // NEW: Check for session token in query parameters (for GET requests from POS)
  const hasQueryToken = !!url.searchParams.get('sessionToken') || !!url.searchParams.get('token');
  const isPOSQueryParam = url.searchParams.get('isPOS') === 'true';

  // Check if User-Agent indicates POS
  const isPOSUserAgent = userAgent.includes('Shopify POS') || userAgent.includes('POS/') || userAgent.includes('iPhone') || userAgent.includes('iPad');

  // Check for explicit POS request header
  const hasPOSHeader = request.headers.get('X-POS-Request') === 'true';

  // Check for shop domain header (common in POS extension requests)
  const hasShopDomainHeader = !!shopDomainHeader;

  // Check if origin is from Shopify CDN (where POS extensions are hosted)
  const isShopifyCDN = origin.includes('shopifycdn.com') || origin.includes('cdn.shopify.com');

  // POS request if ANY of:
  // 1. Has token (header OR query param) AND (POS user agent OR POS header OR shop domain header)
  // 2. Has query token AND Shopify CDN origin (common for POS extensions)
  // 3. Explicit isPOS query parameter (set by extension)
  const hasToken = hasBearerToken || hasCustomToken || hasQueryToken;
  const hasPOSIndicator = isPOSUserAgent || hasPOSHeader || hasShopDomainHeader || isShopifyCDN;

  const isPOS = (hasToken && hasPOSIndicator) || isPOSQueryParam;

  // Log all detection details for debugging
  console.log('[POS Auth] Request detection:', {
    hasBearerToken,
    hasCustomToken,
    hasQueryToken,
    isPOSQueryParam,
    isPOSUserAgent,
    hasPOSHeader,
    hasShopDomainHeader,
    isShopifyCDN,
    origin,
    userAgent: userAgent.substring(0, 50),
    authHeaderPresent: !!authHeader,
    customTokenPresent: !!customTokenHeader,
    authHeaderValue: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
    customTokenValue: customTokenHeader ? `${customTokenHeader.substring(0, 20)}...` : 'none',
    isPOS
  });

  if (isPOS) {
    console.log('[POS Auth] ✅ Detected POS extension request:', {
      hasBearerToken,
      hasCustomToken,
      hasQueryToken,
      isPOSQueryParam,
      isPOSUserAgent,
      hasPOSHeader,
      hasShopDomainHeader,
      isShopifyCDN,
    });
  }

  return isPOS;
}

/**
 * Extracts the session token from headers or query parameters
 * POS extensions cannot send Authorization header to external domains,
 * so we check custom header X-Shopify-Access-Token first, then query params
 * @param request - The incoming request
 * @returns The session token or null
 */
export function extractSessionToken(request: Request): string | null {
  // Try custom header first (used by POS extensions if headers work)
  const customHeader = request.headers.get('X-Shopify-Access-Token');
  if (customHeader) {
    console.log('[POS Auth] Session token found in X-Shopify-Access-Token header');
    return customHeader;
  }

  // NEW: Check query parameters for session token (for GET requests from POS)
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('sessionToken') || url.searchParams.get('token');
  if (queryToken) {
    console.log('[POS Auth] Session token found in query parameters');
    return queryToken;
  }

  // Fallback to Authorization header (for admin requests)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[POS Auth] No session token found in headers or query parameters');
    return null;
  }

  console.log('[POS Auth] Session token found in Authorization header');
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

/**
 * Exchanges a POS session token for an online access token
 * Uses Shopify's token exchange OAuth flow to get a user-specific access token
 * Online tokens expire after 24 hours and have user context
 *
 * @param sessionToken - The JWT session token from POS extension
 * @param shop - The shop domain
 * @returns Online access token for Admin API calls
 */
export async function exchangeSessionTokenForAccessToken(
  sessionToken: string,
  shop: string
): Promise<string> {
  console.log('[POS Auth] Exchanging session token for online access token');

  const apiSecret = process.env.SHOPIFY_API_SECRET;
  const apiKey = process.env.SHOPIFY_API_KEY;

  if (!apiSecret || !apiKey) {
    console.error('[POS Auth] Missing API credentials');
    throw new Error('Server configuration error: Missing API credentials');
  }

  try {
    const tokenExchangeUrl = `https://${shop}/admin/oauth/access_token`;

    const requestBody = {
      client_id: apiKey,
      client_secret: apiSecret,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token'
    };

    console.log('[POS Auth] Token exchange request:', {
      url: tokenExchangeUrl,
      client_id: apiKey.substring(0, 8) + '...',
      grant_type: requestBody.grant_type,
      requested_token_type: requestBody.requested_token_type
    });

    const response = await fetch(tokenExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[POS Auth] Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      console.error('[POS Auth] No access token in response:', data);
      throw new Error('Token exchange response missing access_token');
    }

    console.log('[POS Auth] ✅ Successfully exchanged session token for online access token');
    console.log('[POS Auth] Token preview:', `${data.access_token.substring(0, 15)}...`);
    console.log('[POS Auth] Token scope:', data.scope);
    console.log('[POS Auth] Expires in:', data.expires_in, 'seconds');

    return data.access_token;
  } catch (error) {
    console.error('[POS Auth] Error during token exchange:', error);
    throw error;
  }
}

/**
 * DEPRECATED: Gets the offline access token for POS extension requests
 * Use exchangeSessionTokenForAccessToken instead for POS extensions
 *
 * @param shop - The shop domain
 * @returns Access token for Admin API calls
 */
export async function getOfflineAccessToken(shop: string): Promise<string> {
  console.warn('[POS Auth] ⚠️ getOfflineAccessToken is deprecated for POS extensions');
  console.warn('[POS Auth] Use exchangeSessionTokenForAccessToken instead');
  console.log('[POS Auth] Getting offline access token for shop:', shop);

  try {
    // Find the offline session for this shop
    const sessions = await sessionStorage.findSessionsByShop(shop);

    console.log('[POS Auth] Found sessions:', sessions.map(s => ({
      id: s.id,
      isOnline: s.isOnline,
      hasToken: !!s.accessToken,
      tokenPreview: s.accessToken ? `${s.accessToken.substring(0, 10)}...` : 'none'
    })));

    const offlineSession = sessions.find(s => !s.isOnline);

    if (!offlineSession) {
      console.error('[POS Auth] ❌ No offline session found for shop:', shop);
      console.error('[POS Auth] Available sessions:', sessions.length);
      console.error('[POS Auth] This usually means the app needs to be reinstalled or the OAuth flow needs to be completed.');
      throw new Error(`No offline session found for ${shop}. Please reinstall the app from Shopify admin.`);
    }

    if (!offlineSession.accessToken) {
      console.error('[POS Auth] ❌ Offline session exists but has no access token');
      console.error('[POS Auth] Session ID:', offlineSession.id);
      throw new Error('Session missing access token. Please reinstall the app.');
    }

    console.log('[POS Auth] ✅ Retrieved offline access token from session');
    console.log('[POS Auth] Session ID:', offlineSession.id);
    console.log('[POS Auth] Token preview:', `${offlineSession.accessToken.substring(0, 15)}...`);
    console.log('[POS Auth] Scope:', offlineSession.scope);

    return offlineSession.accessToken;
  } catch (error) {
    console.error('[POS Auth] Error getting offline access token:', error);
    throw error;
  }
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
