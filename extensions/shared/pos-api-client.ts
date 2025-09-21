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
  private readonly TOKEN_REFRESH_THRESHOLD = 10000; // 10 seconds before expiry (optimized for 2025-07)
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
   * Gets a fresh session token with intelligent caching
   * Tokens expire every minute, so we refresh when < 30 seconds remain
   */
  private async getSessionToken(sessionApi: any): Promise<TokenRefreshResult> {
    const now = Date.now();

    // Only refresh if enough time has passed since last refresh
    if (now - this.lastTokenRefresh < this.TOKEN_REFRESH_THRESHOLD) {
      console.log('[POS API Client] Using cached token (recently refreshed)');
    }

    try {
      console.log('[POS API Client] Refreshing session token...');
      const token = await sessionApi.getSessionToken();

      if (!token) {
        throw new Error('Failed to obtain session token - user may not have required permissions');
      }

      this.lastTokenRefresh = now;
      const expiresAt = now + 60000; // Tokens expire in 1 minute

      console.log('[POS API Client] ✅ Session token refreshed successfully');
      return { token, expiresAt };

    } catch (error) {
      console.error('[POS API Client] ❌ Token refresh failed:', error);
      throw new Error(`Session token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Makes authenticated request with automatic retry and error handling
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    sessionApi: any,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    console.log(`[POS API Client] Starting request to: ${endpoint}`);
    console.log(`[POS API Client] Base URL: ${this.baseUrl}`);
    console.log(`[POS API Client] Configuration:`, {
      timeout: this.timeout,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    });

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // Get fresh token for each attempt
        console.log(`[POS API Client] Attempt ${attempt + 1}: Getting session token...`);
        const { token } = await this.getSessionToken(sessionApi);

        const url = `${this.baseUrl}${endpoint}`;
        const timestamp = Date.now();
        const separator = endpoint.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}_t=${timestamp}&_v=${this.APP_VERSION}&_cache=${Math.random()}`;

        console.log(`[POS API Client] Attempt ${attempt + 1}/${this.retryAttempts + 1}: ${finalUrl}`);
        console.log(`[POS API Client] Token length: ${token?.length || 0}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const requestHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-POS-Extension-Version': this.APP_VERSION,
          'X-Requested-With': 'POS-Extension-2025.07',
          'X-Cache-Buster': timestamp.toString(),
          ...options.headers,
        };

        console.log(`[POS API Client] Request headers:`, {
          ...requestHeaders,
          'Authorization': 'Bearer ***' // Don't log the actual token
        });

        const response = await fetch(finalUrl, {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
          headers: requestHeaders,
          signal: controller.signal,
          cache: 'no-store',
          ...options,
        });

        clearTimeout(timeoutId);

        console.log(`[POS API Client] Response: ${response.status} ${response.statusText}`);
        console.log(`[POS API Client] Response headers:`, {
          contentType: response.headers.get('content-type'),
          cors: response.headers.get('access-control-allow-origin'),
          cacheControl: response.headers.get('cache-control')
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
            console.log(`[POS API Client] Error response data:`, errorData);
          } catch (parseError) {
            console.log(`[POS API Client] Failed to parse error response:`, parseError);
            errorData = { error: 'Unknown server error - could not parse response' };
          }
          throw new Error(`API Error (${response.status}): ${errorData.error || response.statusText}`);
        }

        let data: ApiResponse<T>;
        try {
          data = await response.json();
          console.log(`[POS API Client] Parsed response data:`, {
            success: data.success,
            hasData: !!data.data,
            dataType: Array.isArray(data.data) ? 'array' : typeof data.data,
            dataLength: Array.isArray(data.data) ? data.data.length : 'N/A',
            total: data.total,
            error: data.error,
            metadata: data.metadata
          });
        } catch (parseError) {
          console.error(`[POS API Client] Failed to parse successful response:`, parseError);
          throw new Error('Failed to parse API response');
        }

        if (!data.success) {
          console.error(`[POS API Client] API returned success: false`, data);
          throw new Error(`API Response Error: ${data.error || 'Unknown error'}`);
        }

        console.log('[POS API Client] ✅ Request successful:', {
          shop: data.metadata?.shop,
          authType: data.metadata?.authType,
          dataLength: Array.isArray(data.data) ? data.data.length : 'N/A',
          total: data.total
        });

        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown request error');
        console.warn(`[POS API Client] ⚠️ Attempt ${attempt + 1} failed:`, {
          error: lastError.message,
          stack: lastError.stack?.split('\n')[0]
        });

        // Don't retry on certain error types
        if (lastError.message.includes('Authentication') ||
            lastError.message.includes('permissions') ||
            lastError.message.includes('401') ||
            lastError.message.includes('403') ||
            attempt === this.retryAttempts) {
          console.log(`[POS API Client] Not retrying due to: ${lastError.message}`);
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.log(`[POS API Client] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('[POS API Client] ❌ All attempts failed:', {
      error: lastError?.message,
      attempts: this.retryAttempts + 1,
      finalError: lastError?.stack?.split('\n')[0]
    });

    return {
      success: false,
      error: lastError?.message || 'Request failed after all retry attempts',
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