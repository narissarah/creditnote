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
 * Supports multiple deployment environments with comprehensive logging
 */
function getBaseUrl(): string {
  console.log('[POS Config] Starting base URL detection...');

  // Log environment context
  if (typeof window !== 'undefined') {
    console.log('[POS Config] Window context available:', {
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      port: window.location.port,
      origin: window.location.origin,
      href: window.location.href
    });
  } else {
    console.log('[POS Config] No window context (server-side or worker)');
  }

  // Check if we're in development
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const devUrl = 'http://localhost:3000';
    console.log('[POS Config] ⚙️ Development environment detected, using:', devUrl);
    return devUrl;
  }

  // Production URL - should match your Vercel deployment
  const prodUrl = 'https://creditnote.vercel.app';
  console.log('[POS Config] 🌍 Production environment detected, using:', prodUrl);
  return prodUrl;
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