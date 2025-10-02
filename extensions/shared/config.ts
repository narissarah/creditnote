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
 * CRITICAL 2025-07 UPDATE: Due to Shopify bug, relative URLs DON'T WORK
 *
 * Known Issue (Shopify Community Forums):
 * - Relative URLs in fetch() incorrectly resolve to myshopify.com instead of application_url
 * - This is a confirmed bug in POS UI Extensions 2025-07 API
 * - Workaround: Use FULL absolute URLs instead of relative URLs
 *
 * Authentication Strategy:
 * - Use full URL: https://creditnote.vercel.app
 * - Manually fetch session token using api.session.getSessionToken()
 * - Include session token in Authorization header
 * - Include shop domain in X-Shopify-Shop-Domain header (backend fallback)
 *
 * Reference: https://community.shopify.dev/t/bug-in-pos-ext-relative-url-fetch-resolves-incorrectly/19233
 * Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api
 */
function getBaseUrl(): string {
  // CRITICAL FIX: Use FULL URL to bypass Shopify's relative URL resolution bug
  // Relative URLs incorrectly resolve to myshopify.com instead of our app URL
  const baseUrl = 'https://creditnote.vercel.app';

  console.log('[POS Config] ✅ Using FULL URL to bypass Shopify relative URL bug (2025-07)');
  console.log('[POS Config] Base URL:', baseUrl);
  console.log('[POS Config] Will fetch session tokens manually and include in Authorization header');
  console.log('[POS Config] Will include shop domain in X-Shopify-Shop-Domain header');

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