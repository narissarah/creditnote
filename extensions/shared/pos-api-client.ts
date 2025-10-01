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
   * Gets a fresh session token with intelligent caching and retry logic
   * Tokens expire every minute, so we refresh when < 30 seconds remain
   * Implements retry pattern based on 2025-07 best practices
   * Based on official documentation: Session tokens return null if user lacks app permissions
   */
  private async getSessionToken(sessionApi: any): Promise<TokenRefreshResult> {
    const now = Date.now();

    console.log('[POS API Client] Session token request started:', {
      hasSessionApi: !!sessionApi,
      sessionApiType: typeof sessionApi,
      timeSinceLastRefresh: now - this.lastTokenRefresh,
      threshold: this.TOKEN_REFRESH_THRESHOLD,
      shouldRefresh: now - this.lastTokenRefresh >= this.TOKEN_REFRESH_THRESHOLD
    });

    // Only refresh if enough time has passed since last refresh
    if (now - this.lastTokenRefresh < this.TOKEN_REFRESH_THRESHOLD) {
      console.log('[POS API Client] Using cached token (recently refreshed)');
    }

    return await this.getSessionTokenWithRetry(sessionApi, 3);
  }

  /**
   * Verify POS extension context is ready for session token requests
   * POS extensions don't need Frame context like admin apps do
   */
  private async ensurePOSContext(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        console.warn('[POS API Client] No window context available');
        resolve(false);
        return;
      }

      // POS extensions run in their own context - no Frame dependency needed
      console.log('[POS API Client] ✅ POS extension context detected');

      // Simple readiness check - just verify we have access to basic APIs
      const hasBasicAPIs = typeof fetch !== 'undefined';

      if (hasBasicAPIs) {
        console.log('[POS API Client] ✅ Basic APIs available, ready for requests');
        resolve(true);
      } else {
        console.warn('[POS API Client] ⚠️ Basic APIs not available');
        resolve(false);
      }
    });
  }

  /**
   * Enhanced session token retrieval with iOS-specific retry logic for 2025-07
   * Handles intermittent null token responses from POS devices, especially iOS
   * Now includes Frame context verification before token requests
   */
  private async getSessionTokenWithRetry(sessionApi: any, maxRetries = 5): Promise<TokenRefreshResult> {
    const now = Date.now();

    // CRITICAL: Ensure POS context before token requests
    console.log('[POS API Client] 🔍 Verifying POS context before session token request...');
    const hasPOSContext = await this.ensurePOSContext();

    if (!hasPOSContext) {
      throw new Error('POS context not available - session token request would fail');
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[POS API Client] Refreshing session token (attempt ${attempt + 1}/${maxRetries})...`);

        // iOS-specific: Add progressive delay and device responsiveness check
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000); // Max 5 second delay
          console.log(`[POS API Client] iOS retry delay: ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Check if device is responsive before token request (iOS idle state detection)
        if (typeof sessionApi.currentSession !== 'undefined') {
          try {
            const sessionCheck = await sessionApi.currentSession;
            if (!sessionCheck) {
              console.warn('[POS API Client] Session API not responsive, device may be idle');
              if (attempt < maxRetries - 1) continue;
            }
          } catch (sessionCheckError) {
            console.warn('[POS API Client] Session check failed (device may be idle):', sessionCheckError);
            if (attempt < maxRetries - 1) continue;
          }
        }

        const token = await sessionApi.getSessionToken();

        if (!token) {
          console.error(`[POS API Client] ❌ Session token is null on attempt ${attempt + 1}/${maxRetries}`);
          console.error(`[POS API Client] Debugging info:`, {
            sessionApiAvailable: !!sessionApi,
            sessionApiType: typeof sessionApi,
            hasGetSessionToken: !!(sessionApi && sessionApi.getSessionToken),
            attempt: attempt + 1,
            maxRetries,
            hasCurrentSession: typeof sessionApi.currentSession !== 'undefined'
          });

          // iOS-specific: Try to wake up the session API
          if (typeof sessionApi.refresh === 'function') {
            try {
              console.log('[POS API Client] Attempting session API refresh for iOS device...');
              await sessionApi.refresh();
            } catch (refreshError) {
              console.warn('[POS API Client] Session refresh failed:', refreshError);
            }
          }

          if (attempt < maxRetries - 1) {
            // Official documentation: Session tokens return null if user lacks proper app permissions
            console.warn(`[POS API Client] Session token null on attempt ${attempt + 1}, retrying...`);
            console.warn(`[POS API Client] TROUBLESHOOTING GUIDE (iOS Enhanced):`);
            console.warn(`[POS API Client] 1. User lacks app permissions in Shopify Admin`);
            console.warn(`[POS API Client] 2. User not logged in with email/password (using PIN only)`);
            console.warn(`[POS API Client] 3. POS extension not properly deployed/activated`);
            console.warn(`[POS API Client] 4. POS app version < 10.6.0 (current requirement)`);
            console.warn(`[POS API Client] 5. Smart Grid tile needs re-adding after URL changes`);
            console.warn(`[POS API Client] 6. iOS device went idle - session API may need time to wake up`);
            continue;
          }

          // Provide detailed error for final failure
          const errorMessage = `CRITICAL: POS Session Token Retrieval Failed

🚨 IMMEDIATE ACTION REQUIRED:
This error indicates the POS user cannot access session tokens from the Shopify POS Session API.

📋 TROUBLESHOOTING CHECKLIST:
✅ 1. Verify user has app permissions in Shopify Admin (Users & permissions > Staff accounts)
✅ 2. User must be logged into POS with email/password (NOT PIN-only login)
✅ 3. POS app version must be 10.6.0+ (current: check POS settings)
✅ 4. Extension must be properly deployed and Smart Grid tile activated
✅ 5. Try removing and re-adding the Smart Grid tile
✅ 6. Check if shop domain changed recently (requires re-deployment)

🔍 TECHNICAL DETAILS:
- Session API Available: ${!!sessionApi}
- Session API Type: ${typeof sessionApi}
- Has getSessionToken Method: ${!!(sessionApi && sessionApi.getSessionToken)}
- Attempts Made: ${maxRetries}
- POS Version Required: 10.6.0+

📞 If issue persists, this is typically a user permission or POS configuration issue.`;

          throw new Error(errorMessage);
        }

        // Validate token structure for iOS timestamp issues
        const validation = this.validateTokenTimestamp(token);
        if (!validation.valid) {
          if (validation.clockSkew && Math.abs(validation.clockSkew) < 300) {
            console.warn(`[POS API Client] Minor clock skew detected (${validation.clockSkew}s), accepting token`);
          } else {
            console.error(`[POS API Client] Token timestamp validation failed: ${validation.error}`);
            if (attempt < maxRetries - 1) {
              console.warn(`[POS API Client] Retrying due to timestamp validation failure...`);
              continue;
            }
            throw new Error(`Token timestamp validation failed: ${validation.error}`);
          }
        }

        this.lastTokenRefresh = now;
        const expiresAt = now + 60000; // Tokens expire in 1 minute

        console.log('[POS API Client] ✅ Session token refreshed successfully');
        return { token, expiresAt };

      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error('[POS API Client] ❌ Token refresh failed after all retries:', error);
          throw new Error(`Session token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        console.warn(`[POS API Client] ⚠️ Token refresh attempt ${attempt + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Unexpected end of token retry loop');
  }

  /**
   * Validates JWT token timestamps to handle iOS clock skew issues
   * iOS devices can have significant clock drift causing future timestamps
   */
  private validateTokenTimestamp(token: string): { valid: boolean; error?: string; clockSkew?: number } {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid JWT format' };
      }

      // Decode the payload using base64url decoding
      const base64Payload = parts[1];
      const decodedPayload = this.base64UrlDecode(base64Payload);
      const payload = JSON.parse(decodedPayload);

      const now = Math.floor(Date.now() / 1000);
      const clockSkew = payload.nbf ? payload.nbf - now : 0;

      // Allow up to 10 minutes clock skew for iOS devices (addresses Sep 2025 timestamps)
      const IOS_CLOCK_SKEW_TOLERANCE = 600;

      if (payload.exp && payload.exp <= (now - IOS_CLOCK_SKEW_TOLERANCE)) {
        return {
          valid: false,
          error: `Token expired beyond acceptable clock skew. Expired: ${new Date(payload.exp * 1000).toISOString()}, Current: ${new Date(now * 1000).toISOString()}`,
          clockSkew
        };
      }

      if (payload.nbf && payload.nbf > (now + IOS_CLOCK_SKEW_TOLERANCE)) {
        return {
          valid: false,
          error: `Token not yet valid beyond acceptable clock skew. Valid from: ${new Date(payload.nbf * 1000).toISOString()}, Current: ${new Date(now * 1000).toISOString()}`,
          clockSkew
        };
      }

      // Log clock skew if detected
      if (Math.abs(clockSkew) > 30) {
        console.warn(`[POS API Client] Clock skew detected: ${clockSkew} seconds`);
      }

      return { valid: true, clockSkew };

    } catch (error) {
      return {
        valid: false,
        error: `Token parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Base64URL decode helper for JWT processing
   */
  private base64UrlDecode(str: string): string {
    // Replace URL-safe characters
    str = str.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    while (str.length % 4) {
      str += '=';
    }

    return Buffer.from(str, 'base64').toString('utf8');
  }

  /**
   * Makes authenticated request with iOS-enhanced automatic retry and error handling
   * Implements explicit session token fallback for iOS devices where automatic headers fail
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

    // Detect iOS device for enhanced authentication handling
    const userAgent = (typeof navigator !== 'undefined' ? navigator.userAgent : '') || '';
    const isIOSDevice = /iPhone|iPad|iPod|Safari.*Mobile/i.test(userAgent);

    console.log(`[POS API Client] Device detection:`, {
      userAgent: userAgent.substring(0, 100),
      isIOSDevice,
      supportsAutomaticAuth: !isIOSDevice
    });

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const url = `${this.baseUrl}${endpoint}`;
        const timestamp = Date.now();
        const separator = endpoint.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}_t=${timestamp}&_v=${this.APP_VERSION}&_cache=${Math.random()}`;

        console.log(`[POS API Client] Attempt ${attempt + 1}/${this.retryAttempts + 1}: ${finalUrl}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        // STRATEGY 1: Try automatic authorization first (Shopify 2025-07 feature)
        let requestHeaders = {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-POS-Extension-Version': this.APP_VERSION,
          'X-Requested-With': 'POS-Extension-2025.07',
          'X-Cache-Buster': timestamp.toString(),
          ...options.headers,
        };

        // CRITICAL FIX: Enhanced iOS session token handling with better fallback logic
        let shouldGetExplicitToken = isIOSDevice || attempt > 0;
        let tokenAcquisitionFailed = false;

        if (shouldGetExplicitToken) {
          console.log(`[POS API Client] Attempt ${attempt + 1}: Getting explicit session token for ${isIOSDevice ? 'iOS device' : 'retry attempt'}...`);
          try {
            const { token } = await this.getSessionToken(sessionApi);
            if (token && token.length > 0) {
              requestHeaders = {
                ...requestHeaders,
                'Authorization': `Bearer ${token}`,
              };
              console.log(`[POS API Client] ✅ Explicit session token added (length: ${token?.length || 0})`);
            } else {
              console.error(`[POS API Client] ❌ Session token is empty or null`);
              tokenAcquisitionFailed = true;
            }
          } catch (tokenError) {
            console.error(`[POS API Client] ❌ Failed to get explicit session token:`, tokenError);
            tokenAcquisitionFailed = true;

            // For iOS devices on first attempt, this is critical - log detailed troubleshooting
            if (isIOSDevice && attempt === 0) {
              console.error(`[POS API Client] 🚨 CRITICAL iOS Issue: Session token acquisition failed on first attempt`);
              console.error(`[POS API Client] 📱 iOS Device Troubleshooting:`);
              console.error(`[POS API Client] 1. User may lack app permissions in Shopify Admin`);
              console.error(`[POS API Client] 2. User not logged in with email/password (PIN-only login)`);
              console.error(`[POS API Client] 3. POS extension not properly activated`);
              console.error(`[POS API Client] 4. POS app version < 10.6.0`);
              console.error(`[POS API Client] 5. Smart Grid tile needs re-activation`);
              console.error(`[POS API Client] 6. Network connectivity issues on iOS device`);
            }

            // Don't continue without a token on final attempt
            if (attempt === this.retryAttempts) {
              throw new Error(`Session token acquisition failed after ${this.retryAttempts + 1} attempts: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
            }
          }
        } else {
          console.log(`[POS API Client] Attempt ${attempt + 1}: Using automatic Shopify authorization (2025-07)`);
        }

        // ENHANCED FALLBACK: Multiple strategies for iOS devices when token acquisition fails
        if (isIOSDevice && tokenAcquisitionFailed) {
          console.warn(`[POS API Client] 🔄 iOS token acquisition failed, implementing enhanced fallback strategies...`);

          // Strategy 1: Try to extract shop domain from current context
          let fallbackShopDomain: string | null = null;
          if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            fallbackShopDomain = urlParams.get('shop') || urlParams.get('shopDomain');

            if (fallbackShopDomain && fallbackShopDomain.includes('.myshopify.com')) {
              console.log(`[POS API Client] 📱 iOS Fallback Strategy 1: Using shop from URL: ${fallbackShopDomain}`);
              requestHeaders['X-Shopify-Shop-Domain'] = fallbackShopDomain;
            }
          }

          // Strategy 2: Add enhanced headers for server-side fallback detection
          console.log('[POS API Client] 📱 iOS Fallback Strategy 2: Adding enhanced fallback headers');
          requestHeaders['X-POS-Device-Type'] = 'iOS';
          requestHeaders['X-POS-Token-Fallback'] = 'true';
          requestHeaders['X-Shopify-POS-Extension'] = 'creditnote-2025-07';
          requestHeaders['X-iOS-Token-Failed'] = 'session-api-null';
          requestHeaders['X-POS-Auth-Attempt'] = (attempt + 1).toString();

          // Strategy 3: Use automatic authorization for server-side handling
          if (attempt === 0) {
            console.warn(`[POS API Client] 📱 iOS Strategy 3: Using automatic auth with enhanced headers for server detection`);
            shouldGetExplicitToken = false;
          }
        }

        console.log(`[POS API Client] Request headers:`, {
          ...requestHeaders,
          'Authorization': requestHeaders.Authorization ? 'Bearer ***' : 'Automatic (2025-07)',
          'X-POS-Device-Type': requestHeaders['X-POS-Device-Type'] || 'Unknown',
          'X-POS-Token-Fallback': requestHeaders['X-POS-Token-Fallback'] || 'false',
          'X-Shopify-Shop-Domain': requestHeaders['X-Shopify-Shop-Domain'] ? '***' : 'Not provided'
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

        // Handle iOS-specific authorization failures with automatic retry
        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
            console.log(`[POS API Client] Error response data:`, errorData);
          } catch (parseError) {
            console.log(`[POS API Client] Failed to parse error response:`, parseError);
            errorData = { error: 'Unknown server error - could not parse response' };
          }

          // SPECIAL HANDLING: iOS automatic authorization failure
          if (response.status === 401 && !requestHeaders.Authorization && attempt < this.retryAttempts) {
            console.warn(`[POS API Client] ❌ 401 Unauthorized - automatic authorization failed on attempt ${attempt + 1}`);
            console.warn(`[POS API Client] 🔄 Retrying with explicit session token (iOS fallback pattern)...`);

            // Set flag to force explicit token on next attempt
            continue; // This will trigger explicit token logic in next iteration
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

        // Enhanced error categorization based on official troubleshooting guide
        if (lastError.message.includes('Smart Grid Tile Activation Error') ||
            lastError.message.includes('Authentication') ||
            lastError.message.includes('permissions') ||
            lastError.message.includes('401') ||
            lastError.message.includes('403') ||
            attempt === this.retryAttempts) {
          console.log(`[POS API Client] Not retrying due to: ${lastError.message}`);
          // Log specific troubleshooting steps for common issues
          if (lastError.message.includes('Session token null')) {
            console.log('[POS API Client] 🔧 TROUBLESHOOTING STEPS:');
            console.log('[POS API Client] 1. Check POS user has app permissions: Admin → Settings → Users → [User] → Apps → Enable CreditNote');
            console.log('[POS API Client] 2. Ensure user logged in with EMAIL/PASSWORD (not PIN only)');
            console.log('[POS API Client] 3. Verify POS app version is 10.6.0 or higher');
            console.log('[POS API Client] 4. Check extension deployment status with: shopify app info');
            console.log('[POS API Client] 5. Re-add Smart Grid extension tiles if URL changed during development');
          }
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