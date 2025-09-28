/**
 * Shopify 2025-07 Token Exchange Implementation
 *
 * Implements the official token exchange patterns as documented at:
 * https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 * https://shopify.dev/docs/api/shopify-app-remix
 *
 * This resolves session bounce loops by using proper token exchange instead of redirects
 */

import { validateShopifySessionToken } from './jwt-validation.server';

export interface TokenExchangeRequest {
  sessionToken: string;
  shop: string;
  requestedTokenType?: 'urn:shopify:params:oauth:token-type:online-access-token' | 'urn:shopify:params:oauth:token-type:offline-access-token';
}

export interface TokenExchangeResult {
  success: boolean;
  accessToken?: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string;
  associatedUser?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    locale: string;
  };
  error?: string;
  debugInfo?: any;
}

export interface ValidatedSessionResult {
  success: boolean;
  shop?: string;
  userId?: string;
  sessionId?: string;
  accessToken?: string;
  session?: any;
  authMethod: string;
  error?: string;
  debugInfo?: any;
}

/**
 * Exchange session token for access token using Shopify's 2025-07 token exchange API
 * This is the core of the new embedded auth strategy that eliminates bounce redirects
 */
export async function exchangeSessionTokenForAccessToken(
  sessionToken: string,
  shop: string,
  request?: Request
): Promise<TokenExchangeResult> {
  console.log('[Token Exchange 2025-07] Starting session token exchange...');

  try {
    // Step 1: Validate the session token first
    const validation = validateShopifySessionToken(sessionToken, request);
    if (!validation.valid) {
      return {
        success: false,
        error: `Session token validation failed: ${validation.error}`,
        debugInfo: validation.debugInfo
      };
    }

    // Step 2: Prepare token exchange request
    const tokenExchangeUrl = `https://${shop}/admin/oauth/token`;
    const requestBody = {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: process.env.SHOPIFY_API_KEY,
      audience: process.env.SHOPIFY_API_KEY,
      scope: process.env.SCOPES || 'read_customers,write_customers,read_orders,write_orders',
      subject_token: sessionToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:online-access-token'
    };

    console.log('[Token Exchange 2025-07] Requesting token exchange for shop:', shop);
    console.log('[Token Exchange 2025-07] Request details:', {
      url: tokenExchangeUrl,
      hasClientId: !!process.env.SHOPIFY_API_KEY,
      hasScopes: !!process.env.SCOPES,
      tokenLength: sessionToken.length
    });

    // Step 3: Make token exchange request
    const response = await fetch(tokenExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'CreditNote-2025-07/1.0'
      },
      body: new URLSearchParams(requestBody).toString()
    });

    console.log('[Token Exchange 2025-07] Token exchange response:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[Token Exchange 2025-07] Token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      return {
        success: false,
        error: `Token exchange failed: ${response.status} ${response.statusText}`,
        debugInfo: {
          status: response.status,
          statusText: response.statusText,
          responseData: errorData,
          shop,
          tokenExchangeUrl
        }
      };
    }

    // Step 4: Parse successful response
    const tokenData = await response.json();

    console.log('[Token Exchange 2025-07] ✅ Token exchange successful:', {
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      hasAssociatedUser: !!tokenData.associated_user
    });

    return {
      success: true,
      accessToken: tokenData.access_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope,
      associatedUser: tokenData.associated_user,
      debugInfo: {
        exchangeMethod: 'SHOPIFY_2025_07_TOKEN_EXCHANGE',
        shop,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type
      }
    };

  } catch (error) {
    console.error('[Token Exchange 2025-07] ❌ Token exchange error:', error);

    return {
      success: false,
      error: `Token exchange error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      debugInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        shop,
        exchangeMethod: 'SHOPIFY_2025_07_TOKEN_EXCHANGE'
      }
    };
  }
}

/**
 * Complete 2025-07 authentication flow with token exchange
 * This replaces the session bounce pattern with direct token exchange
 */
export async function authenticateWithTokenExchange(
  sessionToken: string,
  request: Request
): Promise<ValidatedSessionResult> {
  console.log('[Auth 2025-07] Starting complete authentication with token exchange...');

  try {
    // Step 1: Validate session token and extract shop
    const validation = validateShopifySessionToken(sessionToken, request);
    if (!validation.valid) {
      return {
        success: false,
        authMethod: 'TOKEN_EXCHANGE_VALIDATION_FAILED',
        error: `Session token validation failed: ${validation.error}`,
        debugInfo: validation.debugInfo
      };
    }

    const payload = validation.payload!;
    const shop = extractShopFromPayload(payload);

    if (!shop) {
      return {
        success: false,
        authMethod: 'TOKEN_EXCHANGE_SHOP_EXTRACTION_FAILED',
        error: 'Could not extract shop domain from session token',
        debugInfo: { iss: payload.iss, dest: payload.dest }
      };
    }

    // Step 2: Exchange session token for access token
    const tokenExchange = await exchangeSessionTokenForAccessToken(sessionToken, shop, request);

    if (!tokenExchange.success) {
      return {
        success: false,
        authMethod: 'TOKEN_EXCHANGE_FAILED',
        error: tokenExchange.error || 'Token exchange failed',
        debugInfo: tokenExchange.debugInfo
      };
    }

    // Step 3: Create session object compatible with Shopify app structure
    const session = {
      id: `${shop}_${payload.sub}`,
      shop: shop,
      state: 'authenticated',
      isOnline: true,
      scope: tokenExchange.scope || '',
      accessToken: tokenExchange.accessToken,
      userId: payload.sub,
      firstName: tokenExchange.associatedUser?.first_name,
      lastName: tokenExchange.associatedUser?.last_name,
      email: tokenExchange.associatedUser?.email,
      locale: tokenExchange.associatedUser?.locale || 'en',
      expires: tokenExchange.expiresIn ? new Date(Date.now() + tokenExchange.expiresIn * 1000) : undefined
    };

    console.log('[Auth 2025-07] ✅ Complete authentication successful:', {
      shop: session.shop,
      userId: session.userId,
      hasAccessToken: !!session.accessToken,
      scope: session.scope,
      authMethod: 'TOKEN_EXCHANGE_2025_07'
    });

    return {
      success: true,
      shop: session.shop,
      userId: session.userId,
      sessionId: session.id,
      accessToken: session.accessToken,
      session: session,
      authMethod: 'TOKEN_EXCHANGE_2025_07',
      debugInfo: {
        exchangeMethod: 'SHOPIFY_2025_07_COMPLIANT',
        tokenExchange: tokenExchange.debugInfo,
        sessionValidation: validation.debugInfo
      }
    };

  } catch (error) {
    console.error('[Auth 2025-07] ❌ Authentication with token exchange failed:', error);

    return {
      success: false,
      authMethod: 'TOKEN_EXCHANGE_ERROR',
      error: `Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      debugInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    };
  }
}

/**
 * Extract shop domain from JWT payload
 */
function extractShopFromPayload(payload: any): string | null {
  // Try destination first, then issuer
  const candidates = [payload.dest, payload.iss];

  for (const candidate of candidates) {
    if (candidate) {
      // Handle https://shop.myshopify.com format
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
 * Create session token exchange error response
 */
export function createTokenExchangeErrorResponse(error: string, debugInfo?: any) {
  return {
    success: false,
    error: 'Authentication failed - token exchange required',
    details: error,
    solutions: [
      '🔄 Token Exchange Authentication Required:',
      '1. This app uses Shopify 2025-07 authentication with token exchange',
      '2. Session tokens must be exchanged for access tokens',
      '3. Ensure your app has proper OAuth configuration',
      '4. Check that SHOPIFY_API_KEY and SCOPES are configured correctly',
      '5. Verify the shop domain is accessible and valid'
    ],
    debugInfo: {
      authMethod: 'TOKEN_EXCHANGE_2025_07',
      timestamp: new Date().toISOString(),
      ...debugInfo
    }
  };
}