/**
 * Enhanced POS API Client for Shopify UI Extensions 2025-07
 * Implements robust authentication, token refresh, and error handling
 *
 * CRITICAL FIX 2025-10-03: Proper session token handling with retry logic
 * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
 */

import { defaultPosConfig, PosConfig } from './config';
import { SessionTokenManager } from './session-token-manager';

interface POSApiOptions {
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  metadata?: {
    shop?: string;
    authType?: string;
    timestamp?: string;
  };
}

interface TokenRefreshResult {
  token: string;
  expiresAt: number;
}

export class POSApiClient {
  private baseUrl: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private readonly APP_VERSION = "2025.1.7-force-bundle-refresh"; // Version tracking for cache invalidation
  private sessionTokenManager: SessionTokenManager;

  constructor(options: POSApiOptions = {}) {
    this.baseUrl = options.baseUrl || defaultPosConfig.baseUrl;
    this.timeout = options.timeout || defaultPosConfig.timeout;
    this.retryAttempts = options.retryAttempts || defaultPosConfig.retryAttempts;
    this.retryDelay = options.retryDelay || defaultPosConfig.retryDelay;

    // Initialize session token manager with retry strategy
    this.sessionTokenManager = new SessionTokenManager({
      maxRetries: 10, // Shopify recommendation for idle devices
      retryDelayMs: 500,
      maxRetryDelayMs: 5000
    });

    console.log('[POS API Client] Initialized with baseUrl:', this.baseUrl);
    console.log('[POS API Client] Configuration:', {
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    });
  }

  /**
   * DEPRECATED - Use sessionTokenManager.getSessionToken() instead
   * Kept for backwards compatibility but delegates to new manager
   */
  private async getSessionToken(apiRoot: any): Promise<TokenRefreshResult> {
    const result = await this.sessionTokenManager.getSessionToken(apiRoot, false);

    if (result.token) {
      return {
        token: result.token,
        expiresAt: Date.now() + 60000 // 60 seconds
      };
    }

    throw new Error(result.error || 'Session token unavailable');
  }

  /**
   * LEGACY METHOD - DO NOT USE
   * This old implementation had bugs - keeping it commented for reference
   */
  private async getSessionTokenOLD(apiRoot: any): Promise<TokenRefreshResult> {
    try {
      console.log('[POS API Client] 🔑 Fetching session token from Shopify POS...');
      console.log('[POS API Client] API root inspection:', {
        hasApiRoot: !!apiRoot,
        apiRootType: typeof apiRoot,
        apiRootKeys: apiRoot ? Object.keys(apiRoot) : [],
        hasSessionToken: apiRoot && typeof apiRoot.sessionToken !== 'undefined',
        sessionTokenType: apiRoot?.sessionToken ? typeof apiRoot.sessionToken : 'undefined',
        sessionTokenKeys: apiRoot?.sessionToken ? Object.keys(apiRoot.sessionToken) : []
      });

      // CRITICAL FIX 2025-07: According to Shopify docs, the correct path is api.session.getSessionToken()
      // Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api

      console.log('[POS API Client] 🔍 Inspecting API structure for session token...');
      console.log('[POS API Client] API root keys:', apiRoot ? Object.keys(apiRoot) : []);
      console.log('[POS API Client] Has api.session?:', !!apiRoot?.session);
      console.log('[POS API Client] api.session keys:', apiRoot?.session ? Object.keys(apiRoot.session) : []);

      let getTokenFunction = null;

      // CORRECT PATH (per Shopify docs): api.session.getSessionToken()
      if (apiRoot?.session && typeof apiRoot.session.getSessionToken === 'function') {
        getTokenFunction = apiRoot.session.getSessionToken.bind(apiRoot.session);
        console.log('[POS API Client] ✅ Found session token at: api.session.getSessionToken() (CORRECT PATH)');
      }
      // Fallback Path 1: api.sessionToken.getSessionToken() (might exist in some versions)
      else if (apiRoot?.sessionToken && typeof apiRoot.sessionToken.getSessionToken === 'function') {
        getTokenFunction = apiRoot.sessionToken.getSessionToken.bind(apiRoot.sessionToken);
        console.log('[POS API Client] ✅ Found session token at: api.sessionToken.getSessionToken() (FALLBACK)');
      }
      // Fallback Path 2: Direct getSessionToken on api
      else if (typeof apiRoot?.getSessionToken === 'function') {
        getTokenFunction = apiRoot.getSessionToken.bind(apiRoot);
        console.log('[POS API Client] ✅ Found session token at: api.getSessionToken() (FALLBACK)');
      }

      if (!getTokenFunction) {
        console.error('[POS API Client] ❌ No session token method found in API root');
        console.error('[POS API Client] Available API structure:', {
          topLevelKeys: apiRoot ? Object.keys(apiRoot) : [],
          sessionKeys: apiRoot?.session ? Object.keys(apiRoot.session) : [],
          hasSessionToken: !!apiRoot?.sessionToken,
          hasGetSessionToken: typeof apiRoot?.getSessionToken === 'function'
        });
        throw new Error('Session token API not available - POS extension may not have proper permissions');
      }

      // Fetch session token from Shopify POS
      console.log('[POS API Client] 🔑 Calling getSessionToken()...');
      const token = await getTokenFunction();

      console.log('[POS API Client] 📨 getSessionToken() returned:', {
        tokenType: typeof token,
        isNull: token === null,
        isUndefined: token === undefined,
        tokenValue: token ? String(token).substring(0, 30) + '...' : String(token)
      });

      // CRITICAL FIX 2025-07: Shopify docs state getSessionToken() returns null when:
      // 1. Device has gone idle (known issue - can take multiple attempts)
      // 2. User lacks app permissions
      // 3. User not logged in with email/password (PIN-only login doesn't work)

      // Check for null
      if (token === null) {
        console.error('[POS API Client] ❌ Session token is NULL - Common causes:');
        console.error('[POS API Client] 1. Device was idle (Shopify known issue - retry recommended)');
        console.error('[POS API Client] 2. User lacks app permissions in Shopify Admin');
        console.error('[POS API Client] 3. User logged in with PIN only (needs email/password)');
        throw new Error('Session token is null - device may be idle or user needs to re-login with email/password');
      }

      // Check for undefined - CRITICAL!
      if (token === undefined) {
        console.error('[POS API Client] ❌ Session token is UNDEFINED - getSessionToken() returned undefined');
        console.error('[POS API Client] This likely means:');
        console.error('[POS API Client] 1. Device is in idle state (common on cold start)');
        console.error('[POS API Client] 2. POS version too old (need 10.6.0+)');
        console.error('[POS API Client] 3. Extension not properly loaded');
        throw new Error('Session token is undefined - device idle or POS version incompatible');
      }

      // Check for invalid values
      if (!token || token === 'undefined' || typeof token !== 'string' || token.trim() === '') {
        console.error('[POS API Client] ❌ Invalid session token received:', {
          tokenType: typeof token,
          tokenValue: String(token).substring(0, 30),
          isNull: token === null,
          isUndefined: token === undefined,
          isString: typeof token === 'string',
          isEmpty: typeof token === 'string' && token.trim() === ''
        });
        throw new Error('Session token is invalid - user may lack app permissions or must login with email/password (not PIN)');
      }

      console.log('[POS API Client] ✅ Valid session token obtained:', {
        length: token.length,
        preview: token.substring(0, 20) + '...',
        startsWithEyJ: token.startsWith('eyJ'),
        tokenType: typeof token
      });

      // Session tokens from POS typically expire in 60 seconds
      // We'll refresh 30 seconds before expiry
      const expiresAt = Date.now() + 60000;

      return {
        token,
        expiresAt
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[POS API Client] ❌ Failed to get session token:', errorMessage);
      throw new Error(`Session token fetch failed: ${errorMessage}`);
    }
  }

  /**
   * CRITICAL FIX 2025-07: Manual session token authentication (relative URLs have a bug)
   *
   * Due to Shopify bug in POS 2025-07, relative URLs incorrectly resolve to myshopify.com
   * Solution: Use FULL URLs + manually fetch session token BEFORE every request
   *
   * Authentication Flow:
   * 1. Fetch session token using api.session.getSessionToken()
   * 2. Get shop domain from api.session.currentSession.shopDomain
   * 3. Include session token in Authorization header
   * 4. Include shop domain in X-Shopify-Shop-Domain header (backend fallback)
   *
   * Reference: https://community.shopify.dev/t/bug-in-pos-ext-relative-url-fetch-resolves-incorrectly/19233
   * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    sessionApi: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    console.log(`[POS API Client] 🔐 Starting authenticated request with MANUAL session token`);
    console.log(`[POS API Client] Endpoint: ${endpoint}`);

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // CRITICAL FIX 2025-07: ALWAYS fetch session token before every request
        // Shopify docs: "Session tokens expire every minute, so always fetch a new token before making a request"
        // Reference: https://shopify.dev/docs/apps/build/authentication-authorization/session-tokens

        console.log(`[POS API Client] Attempt ${attempt + 1}/${this.retryAttempts + 1}`);
        console.log(`[POS API Client] Step 1: Extracting shop domain FIRST (before token)...`);

        let sessionToken: string;
        let shopDomain: string | undefined;

        // CRITICAL FIX: Extract shop domain FIRST before attempting token fetch
        // This ensures we always have shop domain even if token fetch fails
        // Shop domain is more reliable than session token (device idle bug)
        const shopPaths = [
          { path: 'session.currentSession.shopDomain', value: sessionApi?.session?.currentSession?.shopDomain },
          { path: 'session.currentSession.shop', value: sessionApi?.session?.currentSession?.shop },
          { path: 'session.shopDomain', value: sessionApi?.session?.shopDomain },
          { path: 'session.shop', value: sessionApi?.session?.shop },
          { path: 'shopDomain', value: sessionApi?.shopDomain },
          { path: 'shop', value: sessionApi?.shop }
        ];

        for (const { path, value } of shopPaths) {
          if (value && typeof value === 'string' && value.length > 0) {
            shopDomain = value;
            console.log(`[POS API Client] ✅ Shop domain found at api.${path}:`, shopDomain);
            break;
          }
        }

        if (!shopDomain) {
          console.warn(`[POS API Client] ⚠️ Could not extract shop domain from any known API path`);
          console.warn(`[POS API Client] Tried paths:`, shopPaths.map(p => p.path));
        } else {
          console.log(`[POS API Client] ✅ Shop domain extracted successfully:`, shopDomain);
        }

        console.log(`[POS API Client] Step 2: Fetching session token...`);

        try {
          // CRITICAL: Fetch session token from Shopify POS using NEW session token manager
          console.log(`[POS API Client] 🔐 Using SessionTokenManager to fetch token with retry logic...`);
          const tokenResult = await this.sessionTokenManager.getSessionToken(sessionApi, attempt > 0);

          // Check if we got a valid token
          if (SessionTokenManager.hasValidToken(tokenResult) && tokenResult.token) {
            sessionToken = tokenResult.token;
            console.log(`[POS API Client] ✅ Valid session token obtained from manager`);
          } else if (SessionTokenManager.hasDegradedAuth(tokenResult)) {
            // Has shop domain but no token - degraded mode
            console.log(`[POS API Client] ⚠️ Degraded auth mode: shop domain only, no token`);
            sessionToken = ''; // Empty string, NOT undefined
            if (tokenResult.shopDomain) {
              shopDomain = tokenResult.shopDomain; // Use shop domain from manager
            }
          } else {
            // Complete failure
            throw new Error(tokenResult.error || 'Session token and shop domain unavailable');
          }

          console.log(`[POS API Client] ✅ Session token obtained successfully:`, {
            tokenLength: sessionToken.length,
            tokenPreview: sessionToken.substring(0, 30) + '...',
            tokenType: typeof sessionToken,
            hasShopDomain: !!shopDomain,
            shopDomain: shopDomain || 'none'
          });
        } catch (tokenError) {
          console.error(`[POS API Client] ❌ Session token fetch failed:`, tokenError);
          console.error(`[POS API Client] Error details:`, {
            errorMessage: tokenError instanceof Error ? tokenError.message : String(tokenError),
            errorType: tokenError instanceof Error ? tokenError.constructor.name : typeof tokenError
          });

          // CRITICAL FIX: We already extracted shop domain above, so just check if we have it
          if (shopDomain) {
            console.log(`[POS API Client] ✅ Continuing with shop domain header only (no token):`, shopDomain);
            sessionToken = ''; // IMPORTANT: Empty string, NOT undefined!
          } else {
            // Can't get token OR shop domain - this request will likely fail
            console.error(`[POS API Client] ❌ No shop domain AND no session token available`);
            console.error(`[POS API Client] API structure:`, {
              topLevelKeys: sessionApi ? Object.keys(sessionApi).slice(0, 20) : [],
              sessionKeys: sessionApi?.session ? Object.keys(sessionApi.session) : []
            });
            throw new Error(`Session token fetch failed AND no shop domain available: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
          }
        }

        // Build full URL with cache-busting parameters
        const timestamp = Date.now();
        const separator = endpoint.includes('?') ? '&' : '?';
        const fullUrl = `${this.baseUrl}${endpoint}${separator}_t=${timestamp}&_v=${this.APP_VERSION}`;

        console.log(`[POS API Client] Step 2: Building request...`);
        console.log(`[POS API Client] Full URL:`, fullUrl);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // CRITICAL: Build request headers with session token and shop domain
        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-POS-Extension-Version': this.APP_VERSION,
          'X-Extension-Build-Date': '2025-10-03T15:50:00Z',
          'X-Extension-Features': 'SessionTokenManager-v1.1.0',
          'X-Requested-With': 'POS-Extension-2025.07',
          ...(options.headers as Record<string, string> || {}),
        };

        // Add Authorization header with session token (ONLY if we have a valid token)
        // CRITICAL FIX: Never send "Bearer undefined" or "Bearer " - backend sees this as invalid auth
        if (sessionToken && sessionToken.length > 0 && sessionToken !== 'undefined' && sessionToken !== 'null') {
          requestHeaders['Authorization'] = `Bearer ${sessionToken}`;
          console.log(`[POS API Client] ✅ Authorization header added with valid token (${sessionToken.length} chars)`);
        } else {
          console.log(`[POS API Client] ⚠️ No valid session token - Authorization header NOT added`);
          console.log(`[POS API Client] Backend will use X-Shopify-Shop-Domain header for auth fallback`);
        }

        // CRITICAL: Add shop domain header for backend fallback authentication
        // Backend can use this if session token validation fails
        if (shopDomain) {
          requestHeaders['X-Shopify-Shop-Domain'] = shopDomain;
        }

        console.log(`[POS API Client] Step 3: Request headers configured:`, {
          hasAuthHeader: !!requestHeaders['Authorization'],
          hasShopDomain: !!requestHeaders['X-Shopify-Shop-Domain'],
          shopDomain: shopDomain || 'none',
          contentType: requestHeaders['Content-Type'],
          extensionVersion: requestHeaders['X-POS-Extension-Version']
        });

        // Extract body separately to avoid options overwriting headers
        const { headers: _, body, ...safeOptions } = options;

        console.log(`[POS API Client] Step 4: Executing fetch()...`);
        const response = await fetch(fullUrl, {
          method: options.method || 'GET',
          headers: requestHeaders,
          signal: controller.signal,
          body,
          ...safeOptions,
        });
        console.log(`[POS API Client] ✅ fetch() returned with status: ${response.status}`);

        clearTimeout(timeoutId);

        console.log(`[POS API Client] Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch {
            errorData = { error: response.statusText };
          }

          // 401 means user lacks app permissions or not logged in with email/password
          if (response.status === 401) {
            console.error(`[POS API Client] ❌ 401 Unauthorized - Common causes:`);
            console.error(`[POS API Client] 1. User lacks app permissions in Shopify Admin`);
            console.error(`[POS API Client] 2. User logged in with PIN only (needs email/password)`);
            console.error(`[POS API Client] 3. Extension not properly deployed`);
            throw new Error('Authentication failed - check user permissions and login method');
          }

          throw new Error(`API Error (${response.status}): ${errorData.error || response.statusText}`);
        }

        let data: ApiResponse<T>;
        try {
          data = await response.json();
          console.log(`[POS API Client] ✅ Success:`, {
            hasData: !!data.data,
            total: data.total,
            shop: data.metadata?.shop,
            authType: data.metadata?.authType
          });
        } catch (parseError) {
          console.error(`[POS API Client] Failed to parse response:`, parseError);
          throw new Error('Failed to parse API response');
        }

        if (!data.success) {
          throw new Error(`API Error: ${data.error || 'Unknown error'}`);
        }

        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`[POS API Client] ⚠️ Attempt ${attempt + 1} failed:`, lastError.message);

        // Don't retry auth errors
        if (lastError.message.includes('Authentication') || lastError.message.includes('401')) {
          break;
        }

        // Exponential backoff for retries
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.log(`[POS API Client] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('[POS API Client] ❌ All attempts failed:', lastError?.message);

    return {
      success: false,
      error: lastError?.message || 'Request failed after all retries',
      data: [] as any,
      total: 0
    };
  }

  /**
   * Fetches credit notes with simplified, single-endpoint strategy
   * Removes dual-endpoint complexity that can mask authentication issues
   */
  async getCreditNotes(sessionApi: any, options: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ApiResponse<any[]>> {
    const {
      limit = 100,
      offset = 0,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    console.log('[POS API Client] Starting getCreditNotes with simplified single-endpoint strategy');

    // Use single, well-tested endpoint with comprehensive error handling
    const endpoint = `/api/pos/credit-notes/list?limit=${limit}&offset=${offset}&search=${encodeURIComponent(search)}&sortBy=${sortBy}&sortOrder=${sortOrder}`;
    const result = await this.makeAuthenticatedRequest(endpoint, sessionApi);

    if (result.success) {
      console.log('[POS API Client] ✅ Credit notes loaded successfully:', {
        count: Array.isArray(result.data) ? result.data.length : 0,
        total: result.total,
        shop: result.metadata?.shop
      });
    } else {
      console.error('[POS API Client] ❌ Failed to load credit notes:', result.error);

      // Enhanced error logging for debugging
      console.log('[POS API Client] 🔍 Debugging info:', {
        endpoint,
        baseUrl: this.baseUrl,
        hasSession: !!sessionApi,
        version: this.APP_VERSION
      });
    }

    return result;
  }

  /**
   * Checks API health and authentication status
   */
  async healthCheck(sessionApi: any): Promise<ApiResponse<{ status: string }>> {
    return this.makeAuthenticatedRequest('/api/pos/health', sessionApi);
  }

  /**
   * Creates a new credit note
   */
  async createCreditNote(sessionApi: any, creditData: {
    customerId?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    currency?: string;
    reason?: string;
    expiresInDays?: number;
  }): Promise<ApiResponse<any>> {
    console.log('[POS API Client] Creating credit note...');
    return this.makeAuthenticatedRequest('/api/pos/credit-notes/create', sessionApi, {
      method: 'POST',
      body: JSON.stringify(creditData)
    });
  }

  /**
   * Validates a credit note by code/QR
   */
  async validateCreditNote(sessionApi: any, code: string): Promise<ApiResponse<any>> {
    console.log('[POS API Client] Validating credit note code...');
    const endpoint = `/api/pos/credit-notes/validate?code=${encodeURIComponent(code)}`;
    return this.makeAuthenticatedRequest(endpoint, sessionApi);
  }

  /**
   * Runs comprehensive diagnostics for troubleshooting
   */
  async runDiagnostics(sessionApi: any): Promise<ApiResponse<any>> {
    console.log('[POS API Client] Running comprehensive diagnostics...');
    return this.makeAuthenticatedRequest('/api/pos/diagnostics', sessionApi);
  }
}