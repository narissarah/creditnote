/**
 * Session Token Manager for Shopify POS UI Extensions
 * Implements official Shopify best practices for handling session tokens
 *
 * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
 * Reference: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens
 *
 * CRITICAL: This handles the "device idle" bug where session tokens return null/undefined
 * after device has been idle or on cold start.
 */

interface SessionTokenResult {
  token: string | null;
  shopDomain: string | null;
  success: boolean;
  error?: string;
  attemptCount: number;
}

export class SessionTokenManager {
  private maxRetries: number;
  private retryDelayMs: number;
  private maxRetryDelayMs: number;

  constructor(options: {
    maxRetries?: number;
    retryDelayMs?: number;
    maxRetryDelayMs?: number;
  } = {}) {
    // SHOPIFY RECOMMENDATION: "If device has gone idle, it can take multiple attempts to get session token"
    // Source: https://community.shopify.dev/t/bug-pos-extension-session-token-bug/10781
    this.maxRetries = options.maxRetries ?? 10; // Up to 10 retries for idle devices
    this.retryDelayMs = options.retryDelayMs ?? 500; // Start with 500ms
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 5000; // Cap at 5 seconds
  }

  /**
   * Fetch session token with intelligent retry strategy
   *
   * This implements Shopify's recommended pattern for handling session tokens
   * on POS devices, especially after device idle or cold start.
   *
   * @param api - The POS UI Extension API object from useApi()
   * @param silentMode - If true, don't log errors until final attempt
   * @returns SessionTokenResult with token, shop domain, and status
   */
  async getSessionToken(api: any, silentMode: boolean = false): Promise<SessionTokenResult> {
    let attemptCount = 0;
    let lastError: string | null = null;

    // Extract shop domain FIRST (more reliable than session token)
    const shopDomain = this.extractShopDomain(api);

    if (shopDomain && !silentMode) {
      console.log('[Session Token Manager] ✅ Shop domain extracted:', shopDomain);
    }

    // Try to get session token with retries
    for (attemptCount = 0; attemptCount < this.maxRetries; attemptCount++) {
      try {
        if (!silentMode || attemptCount === this.maxRetries - 1) {
          console.log(`[Session Token Manager] 🔑 Attempt ${attemptCount + 1}/${this.maxRetries} to fetch session token...`);
        }

        // Call the session token API
        const token = await this.fetchTokenFromAPI(api);

        // Validate token
        if (this.isValidToken(token)) {
          console.log(`[Session Token Manager] ✅ Valid session token obtained on attempt ${attemptCount + 1}`);
          return {
            token,
            shopDomain,
            success: true,
            attemptCount: attemptCount + 1
          };
        }

        // Token is null, undefined, or invalid
        lastError = `Session token is ${token === null ? 'null' : token === undefined ? 'undefined' : 'invalid'} (device may be idle)`;

        if (!silentMode || attemptCount === this.maxRetries - 1) {
          console.warn(`[Session Token Manager] ⚠️ Attempt ${attemptCount + 1}: ${lastError}`);
        }

        // Don't retry on last attempt
        if (attemptCount < this.maxRetries - 1) {
          // Exponential backoff with cap
          const delay = Math.min(
            this.retryDelayMs * Math.pow(1.5, attemptCount),
            this.maxRetryDelayMs
          );

          if (!silentMode) {
            console.log(`[Session Token Manager] 🔄 Retrying in ${delay}ms...`);
          }

          await this.sleep(delay);
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';

        if (!silentMode || attemptCount === this.maxRetries - 1) {
          console.error(`[Session Token Manager] ❌ Attempt ${attemptCount + 1} failed:`, lastError);
        }

        // Don't retry on last attempt
        if (attemptCount < this.maxRetries - 1) {
          const delay = Math.min(
            this.retryDelayMs * Math.pow(1.5, attemptCount),
            this.maxRetryDelayMs
          );
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    console.error(`[Session Token Manager] ❌ Failed to get session token after ${attemptCount} attempts`);
    console.error(`[Session Token Manager] Last error: ${lastError}`);

    // If we have shop domain, we can still proceed with degraded auth
    if (shopDomain) {
      console.log(`[Session Token Manager] ⚠️ Proceeding with shop domain only (degraded mode)`);
      return {
        token: null,
        shopDomain,
        success: false,
        error: lastError || 'Session token unavailable',
        attemptCount
      };
    }

    // No token AND no shop domain - complete failure
    return {
      token: null,
      shopDomain: null,
      success: false,
      error: lastError || 'Session token and shop domain unavailable',
      attemptCount
    };
  }

  /**
   * Extract shop domain from POS API object
   * Tries multiple known paths in order of reliability
   */
  private extractShopDomain(api: any): string | null {
    const paths = [
      { name: 'session.currentSession.shopDomain', value: api?.session?.currentSession?.shopDomain },
      { name: 'session.currentSession.shop', value: api?.session?.currentSession?.shop },
      { name: 'session.shopDomain', value: api?.session?.shopDomain },
      { name: 'session.shop', value: api?.session?.shop },
      { name: 'shopDomain', value: api?.shopDomain },
      { name: 'shop', value: api?.shop }
    ];

    for (const path of paths) {
      if (path.value && typeof path.value === 'string' && path.value.trim().length > 0) {
        console.log(`[Session Token Manager] ✅ Shop domain found at api.${path.name}:`, path.value);
        return path.value.trim();
      }
    }

    console.warn('[Session Token Manager] ⚠️ Could not extract shop domain from any known path');
    return null;
  }

  /**
   * Fetch token from Shopify POS Session API
   * Tries multiple known API paths
   */
  private async fetchTokenFromAPI(api: any): Promise<string | null | undefined> {
    // OFFICIAL PATH: api.session.getSessionToken()
    // Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api

    if (typeof api?.session?.getSessionToken === 'function') {
      return await api.session.getSessionToken();
    }

    // Fallback paths (for older POS versions)
    if (typeof api?.sessionToken?.getSessionToken === 'function') {
      return await api.sessionToken.getSessionToken();
    }

    if (typeof api?.getSessionToken === 'function') {
      return await api.getSessionToken();
    }

    throw new Error('No session token method found - POS API may be incompatible');
  }

  /**
   * Validate session token
   *
   * Valid tokens are:
   * - Non-null
   * - Non-undefined
   * - String type
   * - Non-empty
   * - Not the literal string "undefined"
   * - Typically starts with "eyJ" (JWT format)
   */
  private isValidToken(token: any): token is string {
    if (token === null || token === undefined) {
      return false;
    }

    if (typeof token !== 'string') {
      return false;
    }

    if (token.trim() === '') {
      return false;
    }

    if (token === 'undefined' || token === 'null') {
      return false;
    }

    // Session tokens should be JWTs (typically start with "eyJ")
    // But we'll accept any non-empty string to be flexible
    return true;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if result is successful and has a valid token
   */
  static hasValidToken(result: SessionTokenResult): boolean {
    return result.success && result.token !== null && result.token !== undefined;
  }

  /**
   * Check if result has at least shop domain (degraded mode)
   */
  static hasDegradedAuth(result: SessionTokenResult): boolean {
    return !result.success && result.shopDomain !== null;
  }
}
