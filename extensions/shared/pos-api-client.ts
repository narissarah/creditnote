/**
 * Enhanced POS API Client for Shopify UI Extensions 2025-07
 * Implements robust authentication, token refresh, and error handling
 */

import { defaultPosConfig, PosConfig } from './config';

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
  private lastTokenRefresh: number = 0;
  private readonly TOKEN_REFRESH_THRESHOLD = 30000; // 30 seconds before expiry (optimized for 2025-07 based on deep research)
  private readonly APP_VERSION = "2025.1.0"; // Version tracking for cache invalidation

  constructor(options: POSApiOptions = {}) {
    this.baseUrl = options.baseUrl || defaultPosConfig.baseUrl;
    this.timeout = options.timeout || defaultPosConfig.timeout;
    this.retryAttempts = options.retryAttempts || defaultPosConfig.retryAttempts;
    this.retryDelay = options.retryDelay || defaultPosConfig.retryDelay;

    console.log('[POS API Client] Initialized with baseUrl:', this.baseUrl);
    console.log('[POS API Client] Configuration:', {
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    });
  }

  /**
   * CRITICAL FIX: Fetch session token from Shopify POS Session API
   *
   * For POS UI Extensions 2025-07, we MUST manually fetch the session token
   * using api.session.getSessionToken() and include it in the Authorization header.
   *
   * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
   */
  private async getSessionToken(sessionApi: any): Promise<TokenRefreshResult> {
    try {
      console.log('[POS API Client] 🔑 Fetching session token from Shopify POS Session API...');
      console.log('[POS API Client] Session API check:', {
        hasSessionApi: !!sessionApi,
        hasGetSessionToken: sessionApi && typeof sessionApi.getSessionToken === 'function',
        sessionApiType: typeof sessionApi,
        sessionApiKeys: sessionApi ? Object.keys(sessionApi) : []
      });

      if (!sessionApi || typeof sessionApi.getSessionToken !== 'function') {
        throw new Error('Session API not available or missing getSessionToken method');
      }

      // Fetch session token from Shopify POS
      const token = await sessionApi.getSessionToken();

      if (!token) {
        console.error('[POS API Client] ❌ Session token is null - user may lack permissions');
        throw new Error('Session token is null or empty - user may lack app permissions or must login with email/password');
      }

      console.log('[POS API Client] ✅ Session token obtained:', {
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
   * CRITICAL FIX: Makes authenticated requests using shopDomain from Session API
   *
   * For POS UI Extensions 2025-07, we use:
   * 1. api.session.shopDomain to get the shop domain
   * 2. Pass it as X-Shopify-Shop-Domain header
   * 3. Backend can identify the shop without requiring Authorization header
   *
   * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    sessionApi: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    console.log(`[POS API Client] 🔐 Starting authenticated request`);
    console.log(`[POS API Client] Endpoint: ${endpoint}`);

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // CRITICAL FIX: POS UI Extensions do NOT automatically add Authorization header
        // We MUST manually fetch the session token and include it
        // Reference: https://shopify.dev/docs/apps/build/purchase-options/product-subscription-app-extensions/authenticate-extension-requests

        const timestamp = Date.now();
        const separator = endpoint.includes('?') ? '&' : '?';
        const finalUrl = `${endpoint}${separator}_t=${timestamp}&_v=${this.APP_VERSION}`;

        console.log(`[POS API Client] Attempt ${attempt + 1}/${this.retryAttempts + 1}`);
        console.log(`[POS API Client] Using URL: ${finalUrl}`);
        console.log(`[POS API Client] Session API available:`, {
          hasSessionApi: !!sessionApi,
          hasGetSessionToken: sessionApi && typeof sessionApi.getSessionToken === 'function'
        });

        // CRITICAL: Fetch session token from POS Session API
        let sessionToken: string | null = null;
        try {
          const tokenResult = await this.getSessionToken(sessionApi);
          sessionToken = tokenResult.token;
          console.log(`[POS API Client] ✅ Session token obtained successfully`);
        } catch (tokenError) {
          console.error(`[POS API Client] ❌ Failed to get session token:`, tokenError);
          throw new Error(`Session token required but not available: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // CRITICAL FIX: Get shop domain from Session API (2025-07)
        // According to Shopify docs, shop domain is at api.session.currentSession.shopDomain
        // Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
        const shopDomain = sessionApi?.currentSession?.shopDomain ||
                          sessionApi?.shopDomain ||
                          sessionApi?.shop ||
                          null;

        console.log(`[POS API Client] 🔍 Session API inspection:`, {
          hasSessionApi: !!sessionApi,
          hasCurrentSession: !!sessionApi?.currentSession,
          shopDomain: shopDomain,
          fullSessionKeys: sessionApi ? Object.keys(sessionApi) : [],
          currentSessionKeys: sessionApi?.currentSession ? Object.keys(sessionApi.currentSession) : []
        });

        // CRITICAL FIX: MANUALLY add Authorization header with session token
        // POS UI Extensions do NOT automatically add this, we must do it ourselves
        const requestHeaders: Record<string, string> = {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
          'X-POS-Extension-Version': this.APP_VERSION,
          'X-Requested-With': 'POS-Extension-2025.07',
          ...(options.headers as Record<string, string> || {}),
        };

        console.log(`[POS API Client] ✅ Added Authorization header with session token`);

        // Add shop domain header if available from Session API
        if (shopDomain) {
          requestHeaders['X-Shopify-Shop-Domain'] = shopDomain;
          console.log(`[POS API Client] ✅ Added X-Shopify-Shop-Domain header: ${shopDomain}`);
        } else {
          console.warn(`[POS API Client] ⚠️ Shop domain not available from Session API`);
        }

        console.log(`[POS API Client] Request headers:`, {
          hasAuthorization: !!requestHeaders['Authorization'],
          authorizationPreview: requestHeaders['Authorization']?.substring(0, 30) + '...',
          shopDomain: requestHeaders['X-Shopify-Shop-Domain'],
          contentType: requestHeaders['Content-Type']
        });

        // CRITICAL FIX: Extract body separately to avoid options overwriting headers
        const { headers: _, body, ...safeOptions } = options;

        console.log(`[POS API Client] 🌐 About to execute fetch() call...`);
        console.log(`[POS API Client] Fetch parameters:`, {
          url: finalUrl,
          method: options.method || 'GET',
          hasBody: !!body,
          headerCount: Object.keys(requestHeaders).length,
          hasSignal: !!controller.signal,
          hasAuthHeader: !!requestHeaders['Authorization']
        });

        // CRITICAL: We are now manually adding the Authorization header with session token
        // This is required for POS UI Extensions as Shopify does NOT auto-inject it
        console.log(`[POS API Client] ⏳ Calling fetch() with Authorization header...`);
        const response = await fetch(finalUrl, {
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