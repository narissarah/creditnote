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
   * DEPRECATED: Manual session token management no longer needed
   *
   * Shopify POS Extensions 2025-07 use automatic authorization:
   * - Relative URLs (fetch('/api/...')) are resolved against application_url
   * - Authorization header is automatically added by Shopify
   * - No manual token management required!
   *
   * This method is kept for backwards compatibility but not used in 2025-07 pattern
   */
  private async getSessionToken(sessionApi: any): Promise<TokenRefreshResult> {
    console.warn('[POS API Client] ⚠️ DEPRECATED: Manual token fetch not needed with 2025-07 automatic authorization');
    console.warn('[POS API Client] Using relative URLs with fetch() provides automatic session tokens');

    // For backwards compatibility, return a dummy result
    // In practice, this method should never be called with 2025-07 pattern
    return {
      token: 'automatic-authorization-2025-07',
      expiresAt: Date.now() + 60000
    };
  }

  /**
   * Makes authenticated requests using Shopify's automatic authorization (2025-07 pattern)
   *
   * CRITICAL: Uses relative URLs which Shopify automatically:
   * 1. Resolves against application_url (from shopify.app.toml)
   * 2. Adds Authorization header with ID token
   *
   * This eliminates manual token management and works consistently across all devices!
   */
  private async makeAuthenticatedRequest<T>(
    endpoint: string,
    sessionApi: any, // Kept for backwards compatibility but not used
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    console.log(`[POS API Client] 🔐 Using automatic Shopify authorization (2025-07)`);
    console.log(`[POS API Client] Request: ${endpoint}`);
    console.log(`[POS API Client] Pattern: Relative URL → Automatic Authorization`);

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // Build relative URL (baseUrl is empty string for automatic authorization)
        const timestamp = Date.now();
        const separator = endpoint.includes('?') ? '&' : '?';
        const finalUrl = `${this.baseUrl}${endpoint}${separator}_t=${timestamp}&_v=${this.APP_VERSION}`;

        console.log(`[POS API Client] Attempt ${attempt + 1}/${this.retryAttempts + 1}`);
        console.log(`[POS API Client] URL: ${finalUrl}`);
        console.log(`[POS API Client] Shopify will auto-resolve against: https://creditnote.vercel.app`);
        console.log(`[POS API Client] Shopify will auto-add: Authorization header with ID token`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // Simple headers - Shopify adds Authorization automatically!
        const requestHeaders = {
          'Content-Type': 'application/json',
          'X-POS-Extension-Version': this.APP_VERSION,
          'X-Requested-With': 'POS-Extension-2025.07',
          ...options.headers,
        };

        console.log(`[POS API Client] Request headers (Authorization added by Shopify):`, requestHeaders);

        const response = await fetch(finalUrl, {
          method: options.method || 'GET',
          mode: 'cors',
          credentials: 'include', // Required for automatic authorization
          headers: requestHeaders,
          signal: controller.signal,
          ...options,
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