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
   * CRITICAL FIX: Makes authenticated requests with manual session token
   *
   * For POS UI Extensions 2025-07, we must:
   * 1. Fetch session token using api.session.getSessionToken()
   * 2. Include it in Authorization header as "Bearer <token>"
   * 3. Use full application_url (not relative URLs)
   *
   * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    sessionApi: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    console.log(`[POS API Client] 🔐 Starting authenticated request with session token`);
    console.log(`[POS API Client] Endpoint: ${endpoint}`);

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // CRITICAL: Fetch fresh session token from Shopify POS
        const { token } = await this.getSessionToken(sessionApi);

        // Build full URL with application_url from shopify.app.toml
        const timestamp = Date.now();
        const separator = endpoint.includes('?') ? '&' : '?';
        const baseUrl = 'https://creditnote.vercel.app'; // application_url from shopify.app.toml
        const finalUrl = `${baseUrl}${endpoint}${separator}_t=${timestamp}&_v=${this.APP_VERSION}`;

        console.log(`[POS API Client] Attempt ${attempt + 1}/${this.retryAttempts + 1}`);
        console.log(`[POS API Client] Full URL: ${finalUrl}`);
        console.log(`[POS API Client] Session token obtained: ${token.substring(0, 20)}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // CRITICAL: Include session token in Authorization header
        const requestHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // CRITICAL FIX: Add session token
          'X-POS-Extension-Version': this.APP_VERSION,
          'X-Requested-With': 'POS-Extension-2025.07',
          ...options.headers,
        };

        console.log(`[POS API Client] Request headers with Authorization:`, {
          ...requestHeaders,
          Authorization: 'Bearer <token-redacted>'
        });

        // CRITICAL FIX: Don't spread options at the end as it can overwrite headers
        // Extract body separately to avoid overwriting our carefully constructed config
        const { headers: _, body, ...safeOptions } = options;

        const response = await fetch(finalUrl, {
          method: options.method || 'GET',
          mode: 'cors',
          credentials: 'include', // Required for cookie-based fallbacks
          headers: requestHeaders, // Our headers with Authorization
          signal: controller.signal,
          body, // Add body if present
          ...safeOptions, // Spread other options safely
        });

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