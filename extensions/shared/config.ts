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
 * CRITICAL 2025-07 UPDATE: POS UI Extensions should use RELATIVE URLs
 *
 * According to Shopify documentation:
 * - When using fetch() with relative URLs, Shopify automatically:
 *   1. Resolves URLs against your application_url (shopify.app.toml)
 *   2. Adds Authorization header with ID token (session token)
 *
 * This eliminates the need for manual token management!
 *
 * Reference: https://shopify.dev/docs/api/pos-ui-extensions/apis/session-api
 */
function getBaseUrl(): string {
  // ALWAYS use empty string for POS extensions to enable automatic authorization
  // Relative URLs like '/api/pos/credits' will be resolved against application_url
  // This is the officially recommended pattern for POS UI Extensions 2025-07

  console.log('[POS Config] ✅ Using relative URLs for automatic Shopify authorization (2025-07)');
  console.log('[POS Config] Application URL from shopify.app.toml: https://creditnote.vercel.app');
  console.log('[POS Config] Relative URLs will be resolved automatically by Shopify POS');

  return ''; // Empty string = relative URLs = automatic authorization
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