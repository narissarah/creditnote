/**
 * Shared configuration for POS UI Extensions
 * Dynamically determines the correct API base URL
 */

interface PosConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Get the appropriate base URL for API calls
 *
 * CRITICAL 2025-07 UPDATE: POS UI Extensions use AUTOMATIC authentication
 *
 * According to Shopify POS UI Extensions documentation:
 * - When using fetch() to make requests to your app's configured auth domain,
 *   an Authorization header is AUTOMATICALLY added with a Shopify ID token
 * - NO need to manually manage ID tokens for same-domain requests
 * - This is the recommended approach for POS UI Extensions 2025-07
 *
 * Key Point: Use EMPTY string (relative URLs) to enable automatic authentication
 * Shopify will resolve relative URLs against your application_url and add auth headers
 *
 * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/server-communication
 * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
 */
function getBaseUrl(): string {
  // CRITICAL FIX: Use empty string for relative URLs
  // This enables Shopify's AUTOMATIC session token injection
  // Relative URLs like '/api/pos/credits' are resolved against application_url
  // and Shopify automatically adds Authorization header

  const baseUrl = ''; // Empty = relative URLs = automatic auth

  console.log('[POS Config] ✅ Using RELATIVE URLs for AUTOMATIC Shopify authentication (2025-07)');
  console.log('[POS Config] Base URL:', baseUrl === '' ? '(relative URLs)' : baseUrl);
  console.log('[POS Config] Application URL from shopify.app.toml: https://creditnote.vercel.app');
  console.log('[POS Config] Session tokens are AUTOMATICALLY added by Shopify for same-domain requests');

  return baseUrl;
}

/**
 * Default POS API configuration with enhanced logging
 */
function createDefaultConfig(): PosConfig {
  const baseUrl = getBaseUrl();
  const config = {
    baseUrl,
    timeout: 15000,
    retryAttempts: 2,
    retryDelay: 1000
  };

  console.log('[POS Config] ✅ Default configuration created:', {
    ...config,
    configuredAt: new Date().toISOString()
  });

  return config;
}

export const defaultPosConfig: PosConfig = createDefaultConfig();

/**
 * Create POS config with custom overrides and logging
 */
export function createPosConfig(overrides: Partial<PosConfig> = {}): PosConfig {
  const finalConfig = {
    ...defaultPosConfig,
    ...overrides
  };

  console.log('[POS Config] 🔧 Custom configuration created:', {
    overrides,
    finalConfig,
    hasOverrides: Object.keys(overrides).length > 0
  });

  return finalConfig;
}

export type { PosConfig };