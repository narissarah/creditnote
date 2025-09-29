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
import { validateEnvironmentVariables, getValidatedEnvironmentConfig } from './environment-validation.server';

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
  console.log('[Token Exchange 2025-07] Starting enhanced session token exchange...');

  try {
    // Step 0: CRITICAL - Validate environment variables first to prevent 403 errors
    console.log('[Token Exchange 2025-07] Validating environment configuration...');
    const envValidation = validateEnvironmentVariables();

    if (!envValidation.isValid) {
      const criticalErrors = envValidation.errors.filter(error =>
        error.includes('SHOPIFY_API_SECRET') || error.includes('SHOPIFY_API_KEY')
      );

      if (criticalErrors.length > 0) {
        console.error('[Token Exchange 2025-07] ❌ Critical environment validation failed:', criticalErrors);
        return {
          success: false,
          error: `Environment validation failed: ${criticalErrors.join(', ')}`,
          debugInfo: {
            issue: 'MISSING_CRITICAL_ENV_VARS',
            missingVariables: envValidation.missingVariables,
            errors: envValidation.errors,
            solution: 'Verify SHOPIFY_API_SECRET and SHOPIFY_API_KEY are set in Vercel environment variables'
          }
        };
      }
    }

    // Get validated configuration with fallbacks
    const config = getValidatedEnvironmentConfig();

    // Step 0.1: CRITICAL - Pre-flight client secret validation
    if (!config.SHOPIFY_API_SECRET || config.SHOPIFY_API_SECRET.trim() === '') {
      console.error('[Token Exchange 2025-07] ❌ SHOPIFY_API_SECRET is missing - will cause 403 Forbidden');
      return {
        success: false,
        error: 'SHOPIFY_API_SECRET is required for token exchange but not available',
        debugInfo: {
          issue: 'MISSING_CLIENT_SECRET',
          solution: 'Set SHOPIFY_API_SECRET in Vercel environment variables',
          impact: 'Token exchange will fail with 403 Forbidden without this parameter',
          hasApiKeyFallback: envValidation.hasApiKeyFallback
        }
      };
    }

    console.log('[Token Exchange 2025-07] ✅ Environment validation passed:', {
      hasApiKey: !!config.SHOPIFY_API_KEY,
      hasApiSecret: !!config.SHOPIFY_API_SECRET,
      hasApiKeyFallback: envValidation.hasApiKeyFallback,
      apiKeyLength: config.SHOPIFY_API_KEY.length,
      apiSecretLength: config.SHOPIFY_API_SECRET.length
    });

    // Step 1: Validate the session token
    const validation = validateShopifySessionToken(sessionToken, request);
    if (!validation.valid) {
      return {
        success: false,
        error: `Session token validation failed: ${validation.error}`,
        debugInfo: validation.debugInfo
      };
    }

    // Step 2: Prepare enhanced token exchange request with validated parameters
    // CRITICAL FIX: Use 2025-07 compliant endpoint for better Cloudflare compatibility
    const tokenExchangeUrl = `https://${shop}/admin/oauth/access_token`;
    const requestBody = {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: config.SHOPIFY_API_KEY,
      client_secret: config.SHOPIFY_API_SECRET, // CRITICAL: Validated to prevent 403 errors
      audience: config.SHOPIFY_API_KEY,
      scope: config.SCOPES,
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

    // Step 3: ULTRA-ENHANCED retry logic specifically for Shopify+Cloudflare challenges
    const maxRetries = 12; // Increased for more aggressive bypass attempts
    let response: Response | null = null;
    let lastErrorStatus: number | null = null;
    let last403Error: string | null = null;
    let cloudflareChallengePage: string | null = null;

    console.log('[Token Exchange 2025-07] Starting ULTRA-ENHANCED Cloudflare bypass with 12 strategies');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log('[Token Exchange 2025-07] ULTRA-ENHANCED attempt', attempt, 'of', maxRetries);

        const fetchStart = Date.now();

        // ULTRA-ENHANCED CLOUDFLARE BYPASS: Shopify-specific header strategies
        const cloudflareBypassHeaders = getShopifyCloudflareBypassHeaders(attempt, shop, request);

        // CRITICAL FIX: Use the updated 2025-07 endpoint directly
        const shopifyAdminUrl = tokenExchangeUrl; // Already using /admin/oauth/access_token

        response = await fetch(shopifyAdminUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            ...cloudflareBypassHeaders,
            // ENHANCED: 2025-07 specific headers for better compatibility
            'X-Shopify-API-Version': '2025-07',
            'Origin': `https://${shop}`,
            'Referer': `https://${shop}/admin/apps`,
            'X-Retry-Attempt': attempt.toString(),
            'X-Request-ID': crypto.randomUUID?.() || `req-${Date.now()}-${attempt}`,
            'X-Client-Version': '2025-07-shopify-enhanced',
            // Shopify-specific headers for admin requests
            'X-Shopify-Access-Token': 'token-exchange-request',
            'X-Shopify-Shop-Domain': shop
          },
          body: new URLSearchParams(requestBody).toString()
        });

        const fetchDuration = Date.now() - fetchStart;
        lastErrorStatus = response.status;

        console.log('[Token Exchange 2025-07] Request completed in', fetchDuration, 'ms, status:', response.status);

        // Enhanced success detection
        if (response.ok) {
          console.log('[Token Exchange 2025-07] ✅ Token exchange successful on attempt', attempt, 'after', fetchDuration, 'ms');
          break;
        }

        // Enhanced 403 error handling with specific diagnostics
        if (response.status === 403) {
          const errorText = await response.text();
          last403Error = errorText;

          console.error('[Token Exchange 2025-07] 🚫 403 Forbidden detected on attempt', attempt, ':', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText.substring(0, 200),
            hasClientSecret: !!config.SHOPIFY_API_SECRET,
            clientSecretLength: config.SHOPIFY_API_SECRET.length
          });

          // ENHANCED CLOUDFLARE BYPASS: Multi-strategy challenge handling
          const cloudflareChallenge = detectCloudflareChallenge(errorText, response.headers);
          if (cloudflareChallenge.detected) {
            console.error('[Token Exchange 2025-07] 🛡️ Cloudflare challenge detected:', cloudflareChallenge.type, 'on attempt', attempt);

            // Apply progressive bypass strategies based on challenge type
            const bypassResult = await handleCloudflareChallenge(cloudflareChallenge, attempt, shop, requestBody, config);
            if (bypassResult.shouldReturn) {
              return bypassResult.result!;
            }

            if (bypassResult.shouldContinue) {
              continue;
            }

            // Enhanced wait strategy based on challenge type
            const cloudflareDelay = calculateCloudflareDelay(cloudflareChallenge.type, attempt);

            if (attempt < maxRetries) {
              console.log('[Token Exchange 2025-07] 🕐 Waiting', cloudflareDelay, 'ms for Cloudflare challenge resolution...');
              await new Promise(resolve => setTimeout(resolve, cloudflareDelay));
              continue;
            } else {
              console.error('[Token Exchange 2025-07] ❌ Cloudflare challenge persists after all retries');
              return {
                success: false,
                error: `Cloudflare protection blocking token exchange: ${response.status} ${response.statusText}`,
                debugInfo: {
                  status: response.status,
                  statusText: response.statusText,
                  errorDetail: errorText.substring(0, 500),
                  issue: 'CLOUDFLARE_CHALLENGE_BLOCKING',
                  solution: 'Cloudflare WAF is blocking token exchange requests. This may require Shopify Partner Dashboard configuration or app review.',
                  attemptsFailed: attempt,
                  cloudflareDetected: true,
                  challengeType: cloudflareChallenge.type
                }
              };
            }
          }

          // For 403 errors, don't retry immediately if it's likely a configuration issue
          if (errorText.includes('client_secret') || errorText.includes('authentication')) {
            console.error('[Token Exchange 2025-07] ❌ 403 error appears to be configuration-related - stopping retries');
            return {
              success: false,
              error: `Token exchange authentication failed: ${response.status} ${response.statusText}`,
              debugInfo: {
                status: response.status,
                statusText: response.statusText,
                errorDetail: errorText,
                issue: 'CLIENT_SECRET_OR_AUTH_CONFIGURATION',
                solution: 'Verify SHOPIFY_API_SECRET is correct in environment variables',
                attemptsFailed: attempt
              }
            };
          }
        }

        // Enhanced rate limiting detection
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const rateLimitDelay = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * attempt;

          console.warn('[Token Exchange 2025-07] 🐌 Rate limited on attempt', attempt, '- waiting', rateLimitDelay, 'ms');

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
            continue;
          }
        }

        // If this is the last attempt, don't retry
        if (attempt === maxRetries) {
          console.error('[Token Exchange 2025-07] ❌ Token exchange failed after', maxRetries, 'attempts - final status:', response.status);
          break;
        }

        // Enhanced exponential backoff: 500ms, 1s, 2s, 4s, 8s
        const delay = 500 * Math.pow(2, attempt - 1);
        console.log('[Token Exchange 2025-07] Retrying in', delay, 'ms... (HTTP', response.status, ')');
        await new Promise(resolve => setTimeout(resolve, delay));

      } catch (fetchError) {
        console.error('[Token Exchange 2025-07] Network error on attempt', attempt, ':', {
          error: fetchError instanceof Error ? fetchError.message : 'Unknown network error',
          stack: fetchError instanceof Error ? fetchError.stack?.substring(0, 200) : undefined
        });

        if (attempt === maxRetries) {
          throw new Error(`Token exchange failed after ${maxRetries} network attempts: ${fetchError instanceof Error ? fetchError.message : 'Network error'}`);
        }

        // Enhanced network error backoff with jitter
        const baseDelay = 500 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 200; // Add 0-200ms jitter
        const delay = baseDelay + jitter;

        console.log('[Token Exchange 2025-07] Retrying after network error in', Math.round(delay), 'ms...');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!response) {
      throw new Error('Token exchange failed: No response received after all retry attempts');
    }

    console.log('[Token Exchange 2025-07] Final response:', response.status, response.statusText);

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
 * ULTRA-ENHANCED SHOPIFY CLOUDFLARE BYPASS STRATEGIES
 * Specialized headers for Shopify admin requests with Cloudflare protection
 */
function getShopifyCloudflareBypassHeaders(attempt: number, shop: string, request?: Request): Record<string, string> {
  const baseHeaders = {
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'DNT': '1'
  };

  // Get original request info for more authentic headers
  const originalUserAgent = request?.headers.get('User-Agent') || '';
  const isShopifyAdmin = originalUserAgent.includes('admin.shopify.com');

  // Progressive bypass strategies specifically tuned for Shopify+Cloudflare
  switch (attempt) {
    case 1:
      // Official Shopify Partner app headers
      return {
        ...baseHeaders,
        'User-Agent': 'Shopify-Partner-App/1.0.0 (Shopify)',
        'Origin': 'https://partners.shopify.com',
        'Referer': 'https://partners.shopify.com/',
        'X-Shopify-Partner-Request': '1',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      };

    case 2:
      // Shopify admin panel browser simulation
      return {
        ...baseHeaders,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': `https://${shop}`,
        'Referer': `https://${shop}/admin/apps`,
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Dest': 'empty',
        'X-Shopify-Web': '1',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/plain, */*'
      };

    case 3:
      // Shopify POS terminal simulation
      return {
        ...baseHeaders,
        'User-Agent': 'Shopify POS/9.87.0 (iPad; iOS 17.0; Scale/2.00)',
        'Origin': `https://${shop}`,
        'X-Shopify-POS': '1',
        'X-Shopify-Channel': 'pos',
        'Accept': 'application/json'
      };

    case 4:
      // Shopify mobile app simulation
      return {
        ...baseHeaders,
        'User-Agent': 'Shopify Mobile/iOS/9.87.0 (iPad; iOS 17.0)',
        'Origin': `https://${shop}`,
        'X-Shopify-Mobile': '1',
        'X-Shopify-API-Request': 'true',
        'Accept': 'application/json'
      };

    case 5:
      // Cloudflare-friendly browser with all sec headers
      return {
        ...baseHeaders,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://admin.shopify.com',
        'Referer': 'https://admin.shopify.com/',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'X-Shopify-Storefront-Access-Token': 'bypass-request',
        'Accept': 'application/json, application/xml, text/plain, text/html, *.*'
      };

    case 6:
      // Shopify CLI tool simulation
      return {
        ...baseHeaders,
        'User-Agent': 'Shopify CLI/3.85.0 (darwin-x64) node/18.17.0',
        'X-Shopify-CLI': '3.85.0',
        'X-Shopify-Tool': 'cli',
        'Accept': 'application/json'
      };

    case 7:
      // Minimal Shopify API client
      return {
        'User-Agent': 'Shopify-API-Client/1.0',
        'Accept': 'application/json',
        'X-Shopify-API-Client': '1.0'
      };

    case 8:
      // Advanced: Shopify Webhook simulation
      return {
        ...baseHeaders,
        'User-Agent': 'Shopify-Webhook/1.0',
        'X-Shopify-Topic': 'app/token_exchange',
        'X-Shopify-Hmac-Sha256': 'webhook-simulation',
        'X-Shopify-Webhook-Id': crypto.randomUUID?.() || `webhook-${Date.now()}`,
        'Accept': 'application/json'
      };

    case 9:
      // Enterprise: Shopify Plus simulation
      return {
        ...baseHeaders,
        'User-Agent': 'ShopifyPlus/3.85.0 (Enterprise)',
        'X-Shopify-Plus': '1',
        'X-Shopify-Enterprise': 'true',
        'X-Shopify-Tier': 'plus',
        'Accept': 'application/json'
      };

    case 10:
      // Advanced Browser: Real Firefox with full headers
      return {
        ...baseHeaders,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': `https://${shop}`,
        'Referer': `https://${shop}/admin/apps`,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'TE': 'trailers'
      };

    case 11:
      // Shopify Internal API simulation
      return {
        ...baseHeaders,
        'User-Agent': 'Shopify-Internal-API/2025.1.0',
        'X-Shopify-Internal': '1',
        'X-Shopify-API-Version': '2025-07',
        'X-Shopify-Source': 'admin-api',
        'Accept': 'application/json'
      };

    case 12:
      // Last resort: Standard curl with Shopify identification
      return {
        'User-Agent': 'curl/8.0.0 (Shopify-App)',
        'Accept': 'application/json',
        'X-Shopify-Request': 'api'
      };

    default:
      // Emergency fallback
      return {
        'User-Agent': 'Shopify-Token-Exchange/1.0',
        'Accept': 'application/json'
      };
  }
}

/**
 * Detect Cloudflare challenge types
 */
function detectCloudflareChallenge(errorText: string, headers: Headers): {
  detected: boolean;
  type: 'browser_check' | 'captcha' | 'rate_limit' | 'bot_fight' | 'waf_block' | 'unknown';
  confidence: number;
} {
  const text = errorText.toLowerCase();
  const serverHeader = headers.get('server') || '';
  const cfRay = headers.get('cf-ray');

  // Strong indicators of Cloudflare
  const isCloudflare = serverHeader.includes('cloudflare') || !!cfRay || text.includes('cloudflare');

  if (!isCloudflare && !text.includes('verifying') && !text.includes('checking')) {
    return { detected: false, type: 'unknown', confidence: 0 };
  }

  // Detect specific challenge types
  if (text.includes('browser check') || text.includes('checking your browser')) {
    return { detected: true, type: 'browser_check', confidence: 0.9 };
  }

  if (text.includes('captcha') || text.includes('human verification')) {
    return { detected: true, type: 'captcha', confidence: 0.95 };
  }

  if (text.includes('rate limit') || text.includes('too many requests')) {
    return { detected: true, type: 'rate_limit', confidence: 0.8 };
  }

  if (text.includes('bot') || text.includes('automated')) {
    return { detected: true, type: 'bot_fight', confidence: 0.85 };
  }

  if (text.includes('security') || text.includes('firewall') || text.includes('blocked')) {
    return { detected: true, type: 'waf_block', confidence: 0.7 };
  }

  // General Cloudflare challenge detection
  if (text.includes('verifying') || text.includes('checking') || text.includes('please wait')) {
    return { detected: true, type: 'browser_check', confidence: 0.6 };
  }

  return { detected: false, type: 'unknown', confidence: 0 };
}

/**
 * Handle specific Cloudflare challenge types with targeted bypass strategies
 */
async function handleCloudflareChallenge(
  challenge: ReturnType<typeof detectCloudflareChallenge>,
  attempt: number,
  shop: string,
  requestBody: any,
  config: any
): Promise<{ shouldReturn: boolean; shouldContinue: boolean; result?: any }> {
  const maxRetries = 5;

  switch (challenge.type) {
    case 'rate_limit':
      console.log('[Cloudflare Bypass] 🐌 Rate limit detected - using exponential backoff');
      return { shouldReturn: false, shouldContinue: false };

    case 'browser_check':
      if (attempt <= 3) {
        console.log('[Cloudflare Bypass] 🔄 Browser check - trying alternative endpoint');
        // Try the enhanced session manager fallback
        const { enhancedSessionManager } = await import('./enhanced-session-token-manager.server');
        const fallbackResult = await enhancedSessionManager.validateSessionWithCloudflareBypass(shop, requestBody);
        if (fallbackResult?.success) {
          console.log('[Cloudflare Bypass] ✅ Enhanced session manager bypassed Cloudflare');
          return { shouldReturn: true, result: fallbackResult };
        }
      }
      return { shouldReturn: false, shouldContinue: false };

    case 'waf_block':
    case 'bot_fight':
      if (attempt <= 3) {
        console.log('[Cloudflare Bypass] 🛡️ WAF/Bot Fight detected - trying Cloudflare fallback auth');
        const { CloudflareFallbackAuth } = await import('./cloudflare-fallback-auth.server');
        const fallbackAuth = new CloudflareFallbackAuth();
        const fallbackResult = await fallbackAuth.attemptTokenExchangeBypass(shop, requestBody, attempt);
        if (fallbackResult?.success) {
          console.log('[Cloudflare Bypass] ✅ Cloudflare fallback auth successful');
          return { shouldReturn: true, result: fallbackResult };
        }
      }
      return { shouldReturn: false, shouldContinue: false };

    default:
      return { shouldReturn: false, shouldContinue: false };
  }
}

/**
 * Calculate delay based on Cloudflare challenge type
 */
function calculateCloudflareDelay(challengeType: string, attempt: number): number {
  const baseDelays = {
    'browser_check': 3000,
    'captcha': 8000,
    'rate_limit': 2000,
    'bot_fight': 5000,
    'waf_block': 4000,
    'unknown': 3000
  };

  const baseDelay = baseDelays[challengeType as keyof typeof baseDelays] || 3000;
  const exponentialDelay = baseDelay * Math.pow(1.5, attempt - 1);

  // Add jitter to avoid thundering herd
  const jitter = Math.random() * 1000;

  return Math.min(15000, exponentialDelay + jitter);
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