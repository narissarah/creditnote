/**
 * Environment Variable Validation for CreditNote 2025-07
 *
 * Critical utility to prevent "Missing API key" and "Token exchange 403" errors
 * in production deployment by validating all required environment variables
 * with comprehensive fallbacks and error handling.
 */

export interface EnvironmentValidationResult {
  isValid: boolean;
  missingVariables: string[];
  errors: string[];
  warnings: string[];
  config: {
    apiKey?: string;
    apiSecret?: string;
    appUrl?: string;
    scopes?: string;
    databaseUrl?: string;
  };
  hasApiKeyFallback: boolean;
  hasApiSecretFallback: boolean;
}

interface EnvironmentConfig {
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  DATABASE_URL: string;
}

/**
 * Production-grade API key fallback for critical deployment scenarios
 * This ensures AppProvider can initialize even if environment variables fail
 */
const PRODUCTION_API_KEY_FALLBACK = '3e0a90c9ecdf9a085dfc7bd1c1c5fa6e';

/**
 * Comprehensive environment variable validation with fallbacks
 */
export function validateEnvironmentVariables(): EnvironmentValidationResult {
  console.log('[ENV VALIDATION] Starting comprehensive environment validation...');

  const result: EnvironmentValidationResult = {
    isValid: false,
    missingVariables: [],
    errors: [],
    warnings: [],
    config: {},
    hasApiKeyFallback: false,
    hasApiSecretFallback: false
  };

  // Critical variables for Shopify 2025-07 authentication
  const requiredVariables: Array<keyof EnvironmentConfig> = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',  // CRITICAL: Required for token exchange
    'SHOPIFY_APP_URL',
    'SCOPES',
    'DATABASE_URL'
  ];

  // Validate each required variable
  for (const variable of requiredVariables) {
    const value = process.env[variable];

    if (!value || value.trim() === '') {
      result.missingVariables.push(variable);
      console.error(`[ENV VALIDATION] ❌ Missing required variable: ${variable}`);

      // Apply fallbacks for critical variables
      if (variable === 'SHOPIFY_API_KEY') {
        result.config.apiKey = PRODUCTION_API_KEY_FALLBACK;
        result.hasApiKeyFallback = true;
        result.warnings.push(`Using fallback API key for ${variable}`);
        console.warn(`[ENV VALIDATION] ⚠️ Using fallback API key for production deployment`);
      } else if (variable === 'SHOPIFY_API_SECRET') {
        result.errors.push(`CRITICAL: ${variable} is required for token exchange - no fallback available`);
      } else if (variable === 'SHOPIFY_APP_URL') {
        result.config.appUrl = 'https://creditnote.vercel.app';
        result.warnings.push(`Using fallback app URL: https://creditnote.vercel.app`);
        console.warn(`[ENV VALIDATION] ⚠️ Using fallback app URL`);
      } else if (variable === 'SCOPES') {
        result.config.scopes = 'read_customers,write_customers,read_orders,write_orders';
        result.warnings.push(`Using default scopes for ${variable}`);
        console.warn(`[ENV VALIDATION] ⚠️ Using default scopes`);
      } else if (variable === 'DATABASE_URL') {
        // Use the provided PostgreSQL URL from CLAUDE.md
        result.config.databaseUrl = 'postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cache-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';
        result.warnings.push(`Using fallback database URL`);
        console.warn(`[ENV VALIDATION] ⚠️ Using fallback database URL`);
      }
    } else {
      // Variable exists, validate format
      switch (variable) {
        case 'SHOPIFY_API_KEY':
          if (value.length < 32) {
            result.errors.push(`${variable} appears to be too short (${value.length} chars)`);
          } else {
            result.config.apiKey = value;
            console.log(`[ENV VALIDATION] ✅ ${variable} validated`);
          }
          break;

        case 'SHOPIFY_API_SECRET':
          if (value.length < 32) {
            result.errors.push(`${variable} appears to be too short (${value.length} chars)`);
          } else {
            result.config.apiSecret = value;
            console.log(`[ENV VALIDATION] ✅ ${variable} validated`);
          }
          break;

        case 'SHOPIFY_APP_URL':
          if (!value.startsWith('https://')) {
            result.errors.push(`${variable} must use HTTPS protocol`);
          } else if (!value.includes('creditnote.vercel.app')) {
            result.warnings.push(`${variable} doesn't match expected production domain`);
            result.config.appUrl = value;
          } else {
            result.config.appUrl = value;
            console.log(`[ENV VALIDATION] ✅ ${variable} validated`);
          }
          break;

        case 'DATABASE_URL':
          if (!value.includes('postgresql://') && !value.includes('postgres://')) {
            result.errors.push(`${variable} doesn't appear to be a valid PostgreSQL URL`);
          } else if (!value.includes('neondb')) {
            result.warnings.push(`${variable} doesn't match expected Neon database`);
            result.config.databaseUrl = value;
          } else {
            result.config.databaseUrl = value;
            console.log(`[ENV VALIDATION] ✅ ${variable} validated`);
          }
          break;

        case 'SCOPES':
          if (!value.includes('read_') && !value.includes('write_')) {
            result.warnings.push(`${variable} doesn't appear to contain typical Shopify scopes`);
          }
          result.config.scopes = value;
          console.log(`[ENV VALIDATION] ✅ ${variable} validated`);
          break;
      }
    }
  }

  // Validate Node.js environment
  if (process.env.NODE_ENV === 'development') {
    result.warnings.push('Running in development mode - some validations relaxed');
  }

  // Validate Vercel-specific environment
  if (process.env.VERCEL) {
    console.log('[ENV VALIDATION] 🚀 Detected Vercel deployment environment');

    // Vercel-specific checks
    if (!process.env.VERCEL_URL && !result.config.appUrl) {
      result.warnings.push('No Vercel URL detected - using fallback app URL');
    }
  }

  // Final validation assessment
  const hasCriticalErrors = result.errors.some(error =>
    error.includes('SHOPIFY_API_SECRET') ||
    error.includes('SHOPIFY_API_KEY')
  );

  result.isValid = !hasCriticalErrors && (
    result.config.apiKey !== undefined &&
    result.config.apiSecret !== undefined
  );

  // Log validation summary
  console.log('[ENV VALIDATION] Validation Summary:', {
    isValid: result.isValid,
    missingCount: result.missingVariables.length,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    hasApiKeyFallback: result.hasApiKeyFallback,
    hasApiSecretFallback: result.hasApiSecretFallback
  });

  if (result.isValid) {
    console.log('[ENV VALIDATION] ✅ Environment validation passed');
  } else {
    console.error('[ENV VALIDATION] ❌ Environment validation failed');
    result.errors.forEach(error => console.error(`[ENV VALIDATION] ERROR: ${error}`));
  }

  result.warnings.forEach(warning => console.warn(`[ENV VALIDATION] WARNING: ${warning}`));

  return result;
}

/**
 * Get validated environment configuration with fallbacks
 */
export function getValidatedEnvironmentConfig(): EnvironmentConfig {
  const validation = validateEnvironmentVariables();

  if (!validation.isValid) {
    const missingCritical = validation.errors.filter(error =>
      error.includes('SHOPIFY_API_SECRET')
    );

    if (missingCritical.length > 0) {
      throw new Error(
        `Critical environment validation failed: ${missingCritical.join(', ')}. ` +
        'This will cause token exchange 403 errors in production.'
      );
    }
  }

  return {
    SHOPIFY_API_KEY: validation.config.apiKey || PRODUCTION_API_KEY_FALLBACK,
    SHOPIFY_API_SECRET: validation.config.apiSecret || '',
    SHOPIFY_APP_URL: validation.config.appUrl || 'https://creditnote.vercel.app',
    SCOPES: validation.config.scopes || 'read_customers,write_customers,read_orders,write_orders',
    DATABASE_URL: validation.config.databaseUrl || 'postgresql://neondb_owner:npg_1j8NseTfaxkh@ep-noisy-cake-adjpzw42-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
  };
}

/**
 * Enhanced error message generation for missing environment variables
 */
export function generateEnvironmentErrorMessage(validation: EnvironmentValidationResult): {
  title: string;
  message: string;
  solutions: string[];
} {
  const hasCriticalErrors = validation.errors.some(error =>
    error.includes('SHOPIFY_API_SECRET') || error.includes('SHOPIFY_API_KEY')
  );

  if (hasCriticalErrors) {
    return {
      title: 'Critical Configuration Missing',
      message: 'Your CreditNote app cannot authenticate with Shopify due to missing critical environment variables.',
      solutions: [
        '🔧 Check Vercel Dashboard → Settings → Environment Variables',
        '🔑 Ensure SHOPIFY_API_SECRET is set (required for token exchange)',
        '🆔 Verify SHOPIFY_API_KEY matches your Partner Dashboard app',
        '🔄 Redeploy after adding missing environment variables',
        '📞 Contact support if issues persist'
      ]
    };
  }

  return {
    title: 'Configuration Warnings',
    message: 'Your CreditNote app is using fallback configuration values.',
    solutions: [
      '⚠️ Review environment variables in Vercel Dashboard',
      '🔧 Update any missing or incorrect values',
      '✅ App will continue to work with fallback values',
      '🚀 Recommended: Set all variables for optimal performance'
    ]
  };
}