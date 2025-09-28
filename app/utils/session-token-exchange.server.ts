/**
 * Enhanced Session Token Exchange Patterns for Shopify 2025-07
 *
 * Implements comprehensive token lifecycle management including:
 * - Token validation and refresh
 * - Exchange mechanisms for different token types
 * - Proactive token renewal before expiration
 * - iOS-optimized token handling
 */

import { validateShopifySessionToken, type SessionTokenPayload } from './jwt-validation.server';
import { validateAuthorizationHeader } from './auth-header-validation.server';

export interface TokenExchangeResult {
  success: boolean;
  token?: string;
  shopDomain?: string;
  userId?: string;
  sessionId?: string;
  expiresAt?: string;
  refreshNeeded?: boolean;
  error?: string;
  debugInfo?: any;
}

export interface SessionTokenCache {
  token: string;
  shopDomain: string;
  userId: string;
  expiresAt: number;
  refreshThreshold: number;
  cached: number;
}

// In-memory token cache for session management
const tokenCache = new Map<string, SessionTokenCache>();

/**
 * Enhanced session token validation with exchange patterns
 */
export function validateAndExchangeSessionToken(request: Request): TokenExchangeResult {
  console.log('[Token Exchange] Starting enhanced session token validation and exchange...');

  // Step 1: Validate Authorization header
  const headerValidation = validateAuthorizationHeader(request);

  if (!headerValidation.valid) {
    return {
      success: false,
      error: headerValidation.error || 'Authorization header validation failed',
      debugInfo: {
        step: 'HEADER_VALIDATION',
        headerDiagnostics: headerValidation.diagnostics
      }
    };
  }

  const token = headerValidation.token!;

  // Step 2: Check if token is in cache and still valid
  const cachedToken = getCachedToken(token);
  if (cachedToken && !isTokenNearExpiry(cachedToken)) {
    console.log('[Token Exchange] ✅ Using cached valid token');
    return {
      success: true,
      token: cachedToken.token,
      shopDomain: cachedToken.shopDomain,
      userId: cachedToken.userId,
      expiresAt: new Date(cachedToken.expiresAt * 1000).toISOString(),
      refreshNeeded: false,
      debugInfo: {
        source: 'CACHE',
        cachedAt: new Date(cachedToken.cached).toISOString()
      }
    };
  }

  // Step 3: Validate token with JWT verification
  const validationResult = validateShopifySessionToken(token, request);

  if (!validationResult.valid) {
    return {
      success: false,
      error: validationResult.error || 'Token validation failed',
      debugInfo: {
        step: 'JWT_VALIDATION',
        validationError: validationResult.error,
        validationDebugInfo: validationResult.debugInfo
      }
    };
  }

  const payload = validationResult.payload!;

  // Step 4: Extract session information
  const shopDomain = extractShopDomainFromPayload(payload);
  if (!shopDomain) {
    return {
      success: false,
      error: 'Could not extract shop domain from validated token',
      debugInfo: {
        step: 'SHOP_EXTRACTION',
        payload: { iss: payload.iss, dest: payload.dest }
      }
    };
  }

  // Step 5: Check if token needs refresh soon
  const refreshNeeded = isTokenNearExpiry({ expiresAt: payload.exp } as SessionTokenCache);

  // Step 6: Cache the validated token
  cacheToken(token, {
    token,
    shopDomain,
    userId: payload.sub,
    expiresAt: payload.exp,
    refreshThreshold: payload.exp - 300, // Refresh 5 minutes before expiry
    cached: Date.now()
  });

  console.log('[Token Exchange] ✅ Token validation and exchange successful', {
    shopDomain,
    userId: payload.sub,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    refreshNeeded
  });

  return {
    success: true,
    token,
    shopDomain,
    userId: payload.sub,
    sessionId: payload.sid || payload.jti,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    refreshNeeded,
    debugInfo: {
      source: 'VALIDATION',
      algorithm: 'HS256_VERIFIED',
      validationMethod: validationResult.debugInfo?.validationMethod || 'SHOPIFY_2025_07',
      deviceType: validationResult.debugInfo?.deviceType || 'Unknown'
    }
  };
}

/**
 * Proactive token refresh mechanism
 */
export async function refreshSessionTokenIfNeeded(
  currentToken: string,
  request: Request
): Promise<TokenExchangeResult> {
  console.log('[Token Exchange] Checking if token refresh is needed...');

  const cachedToken = getCachedToken(currentToken);

  if (!cachedToken || !isTokenNearExpiry(cachedToken)) {
    return {
      success: true,
      token: currentToken,
      refreshNeeded: false,
      debugInfo: { action: 'NO_REFRESH_NEEDED' }
    };
  }

  // For production, this would integrate with Shopify's token refresh endpoint
  // For now, we'll return a signal that the client should get a new token
  console.log('[Token Exchange] Token refresh needed - instructing client to get new token');

  return {
    success: false,
    error: 'Token refresh required',
    refreshNeeded: true,
    debugInfo: {
      action: 'REFRESH_REQUIRED',
      reason: 'TOKEN_NEAR_EXPIRY',
      expiresAt: new Date(cachedToken.expiresAt * 1000).toISOString(),
      refreshInstructions: {
        method: 'CLIENT_SIDE_REFRESH',
        endpoint: '/session-token-bounce',
        description: 'Client must fetch new session token using App Bridge'
      }
    }
  };
}

/**
 * Enhanced token exchange for different token types
 */
export function exchangeTokenType(
  token: string,
  fromType: 'JWT' | 'ACCESS_TOKEN' | 'SESSION_TOKEN',
  toType: 'JWT' | 'ACCESS_TOKEN' | 'SESSION_TOKEN',
  request: Request
): TokenExchangeResult {
  console.log(`[Token Exchange] Exchanging token from ${fromType} to ${toType}`);

  // For JWT to JWT (validation and reformatting)
  if (fromType === 'JWT' && toType === 'JWT') {
    return validateAndExchangeSessionToken(request);
  }

  // Other exchange patterns would be implemented here
  // For now, we focus on JWT validation as that's the primary use case

  return {
    success: false,
    error: `Token exchange from ${fromType} to ${toType} not yet implemented`,
    debugInfo: {
      supportedExchanges: ['JWT->JWT'],
      requestedExchange: `${fromType}->${toType}`
    }
  };
}

/**
 * Session token lifecycle management
 */
export function getTokenLifecycleInfo(token: string): {
  isValid: boolean;
  expiresIn: number;
  refreshRecommended: boolean;
  status: 'VALID' | 'NEAR_EXPIRY' | 'EXPIRED' | 'INVALID';
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { isValid: false, expiresIn: 0, refreshRecommended: false, status: 'INVALID' };
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as SessionTokenPayload;
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = payload.exp - now;

    if (expiresIn <= 0) {
      return { isValid: false, expiresIn, refreshRecommended: true, status: 'EXPIRED' };
    }

    if (expiresIn <= 300) { // 5 minutes
      return { isValid: true, expiresIn, refreshRecommended: true, status: 'NEAR_EXPIRY' };
    }

    return { isValid: true, expiresIn, refreshRecommended: false, status: 'VALID' };

  } catch (error) {
    return { isValid: false, expiresIn: 0, refreshRecommended: false, status: 'INVALID' };
  }
}

/**
 * Helper: Extract shop domain from JWT payload
 */
function extractShopDomainFromPayload(payload: SessionTokenPayload): string | null {
  // Try destination first, then issuer
  const candidates = [payload.dest, payload.iss];

  for (const candidate of candidates) {
    if (candidate) {
      // Handle https://shop.myshopify.com/admin format
      if (candidate.startsWith('https://')) {
        try {
          const url = new URL(candidate);
          return url.hostname;
        } catch (e) {
          continue;
        }
      }

      // Handle shop.myshopify.com format
      if (candidate.includes('.myshopify.com')) {
        return candidate;
      }

      // Handle just shop name
      if (candidate.match(/^[a-zA-Z0-9\-]+$/)) {
        return `${candidate}.myshopify.com`;
      }
    }
  }

  return null;
}

/**
 * Helper: Check if token is near expiry
 */
function isTokenNearExpiry(cachedToken: SessionTokenCache): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= cachedToken.refreshThreshold;
}

/**
 * Helper: Get cached token
 */
function getCachedToken(token: string): SessionTokenCache | null {
  return tokenCache.get(token) || null;
}

/**
 * Helper: Cache token with TTL
 */
function cacheToken(tokenKey: string, tokenData: SessionTokenCache): void {
  tokenCache.set(tokenKey, tokenData);

  // Clean up expired tokens
  setTimeout(() => {
    const cached = tokenCache.get(tokenKey);
    if (cached && Date.now() / 1000 > cached.expiresAt) {
      tokenCache.delete(tokenKey);
    }
  }, (tokenData.expiresAt * 1000) - Date.now());
}

/**
 * Helper: Clear expired tokens from cache
 */
export function cleanupExpiredTokens(): void {
  const now = Math.floor(Date.now() / 1000);

  for (const [tokenKey, tokenData] of tokenCache.entries()) {
    if (now > tokenData.expiresAt) {
      tokenCache.delete(tokenKey);
    }
  }
}

/**
 * Helper: Get cache statistics for monitoring
 */
export function getCacheStats(): {
  totalTokens: number;
  expiredTokens: number;
  activeTokens: number;
  nearExpiryTokens: number;
} {
  const now = Math.floor(Date.now() / 1000);
  let expired = 0;
  let nearExpiry = 0;
  let active = 0;

  for (const tokenData of tokenCache.values()) {
    if (now > tokenData.expiresAt) {
      expired++;
    } else if (now >= tokenData.refreshThreshold) {
      nearExpiry++;
    } else {
      active++;
    }
  }

  return {
    totalTokens: tokenCache.size,
    expiredTokens: expired,
    activeTokens: active,
    nearExpiryTokens: nearExpiry
  };
}