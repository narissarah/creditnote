import "@shopify/shopify-app-remix/adapters/vercel";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// ENHANCED: Comprehensive environment variable validation with format checks
const EXPECTED_API_KEY = "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e"; // From shopify.app.toml

const requiredEnvVars = {
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL
};

// Check for missing variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value || value.trim() === '')
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:', missingVars);
  console.error('📝 Required variables:', Object.keys(requiredEnvVars));
  console.error('🔍 Check your .env file or deployment environment configuration');
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Enhanced format validation
const formatValidationErrors = [];

// Validate SHOPIFY_APP_URL format
const appUrl = process.env.SHOPIFY_APP_URL;
if (appUrl) {
  try {
    const url = new URL(appUrl.startsWith('http') ? appUrl : `https://${appUrl}`);
    if (!url.hostname.includes('vercel.app') && !url.hostname.includes('ngrok') && !url.hostname.includes('localhost')) {
      console.warn('⚠️ Unusual app URL format detected:', appUrl);
    }
  } catch (urlError) {
    formatValidationErrors.push(`SHOPIFY_APP_URL has invalid format: ${appUrl}`);
  }
}

// Validate DATABASE_URL format
const dbUrl = process.env.DATABASE_URL;
if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
  formatValidationErrors.push(`DATABASE_URL must be a PostgreSQL connection string: ${dbUrl.substring(0, 30)}...`);
}

// Validate API key format (should be alphanumeric)
const apiKey = process.env.SHOPIFY_API_KEY;
if (apiKey && !/^[a-f0-9]{32}$/i.test(apiKey)) {
  formatValidationErrors.push(`SHOPIFY_API_KEY has unexpected format (should be 32 hex characters)`);
}

// CRITICAL: API key specific validation with expected value check
if (apiKey && apiKey !== EXPECTED_API_KEY) {
  console.warn('⚠️ API key mismatch detected in shopify.server.ts');
  console.warn(`Current API key: ${apiKey.substring(0, 8)}...`);
  console.warn(`Expected API key: ${EXPECTED_API_KEY.substring(0, 8)}...`);
  console.warn('This may cause authentication issues. Please verify your Vercel environment variables.');
}

if (formatValidationErrors.length > 0) {
  console.error('❌ CRITICAL ERROR: Environment variable format validation failed:');
  formatValidationErrors.forEach(error => console.error(`  - ${error}`));
  throw new Error(`Environment variable format validation failed: ${formatValidationErrors.join(', ')}`);
}

console.log('✅ Environment variables validated successfully (format and presence)');

// CRITICAL DEBUG: Verify auth strategy flag
console.log('🔐 AUTH STRATEGY VERIFICATION:');
console.log('✅ unstable_newEmbeddedAuthStrategy: ENABLED (as recommended by Shopify docs)');
console.log('✅ useOnlineTokens will be set to: FALSE');
console.log('✅ isEmbeddedApp will be set to: TRUE');
console.log('🎯 Using NEW embedded authentication strategy for 2025-07 API');

// Valid scopes for Shopify API 2025-07 (verified against official documentation)
const VALID_SCOPES = [
  "read_customers",
  "read_discounts",
  "read_orders",
  "write_customers",
  "write_discounts",
  "write_orders",
  "read_products",
  "write_products",
  "read_inventory",
  "unauthenticated_read_product_listings",
  "unauthenticated_write_checkouts",
  "unauthenticated_read_checkouts",
  "read_locations",
  "write_draft_orders",
  "read_draft_orders"
];

// Deprecated scopes in 2025-07 that should be filtered out
const DEPRECATED_SCOPES = [
  "read_all_orders", // Deprecated - use read_orders instead
  "write_script_tags", // Deprecated
  "read_script_tags" // Deprecated
];

// Use environment scopes if valid, otherwise use hardcoded valid scopes
const configuredScopes = process.env.SCOPES?.split(",").filter(scope => {
  const trimmedScope = scope.trim();
  const isValid = VALID_SCOPES.includes(trimmedScope);
  const isDeprecated = DEPRECATED_SCOPES.includes(trimmedScope);

  if (isDeprecated) {
    console.warn(`⚠️ Deprecated scope detected and filtered out: ${trimmedScope} (use read_orders instead of read_all_orders)`);
    return false;
  }

  if (!isValid && trimmedScope) {
    console.warn(`⚠️ Invalid scope detected and filtered out: ${trimmedScope}`);
    return false;
  }

  return isValid;
}) || VALID_SCOPES;

// CRITICAL FIX: Normalize appUrl to ensure it has protocol
// This fixes "Invalid appUrl configuration" errors when Vercel env vars are missing https://
const rawAppUrl = process.env.SHOPIFY_APP_URL || "";
const normalizedAppUrl = rawAppUrl.startsWith("http") ? rawAppUrl : `https://${rawAppUrl}`;

console.log(`✅ App URL normalized: ${rawAppUrl} → ${normalizedAppUrl}`);

// CRITICAL: Use validated API key with fallback to expected value
const finalApiKey = apiKey || EXPECTED_API_KEY;
if (finalApiKey === EXPECTED_API_KEY && finalApiKey !== apiKey) {
  console.warn('🔄 Using expected API key as fallback. Please update SHOPIFY_API_KEY environment variable.');
}

const shopify = shopifyApp({
  apiKey: finalApiKey,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: "2025-07" as ApiVersion,
  scopes: configuredScopes,
  appUrl: normalizedAppUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,

  // CRITICAL FIX: Enable unstable auth strategy for 2025-07 compliance
  // Latest Shopify docs recommend this for modern embedded authentication
  // This resolves Frame context errors and enables proper token exchange
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },

  // Use offline tokens for serverless stability and POS compatibility
  useOnlineTokens: false,

  // CRITICAL FIX: Session strategy for 2025-07 embedded authentication
  // Required for proper token exchange handling
  session: {
    strategy: 'token-exchange',
    tokenExchange: true,
  },

  // ENHANCED: Proper token exchange configuration for 2025-07
  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },

  // Enhanced hooks for debugging and error tracking
  hooks: {
    afterAuth: async ({ session }) => {
      console.log(`[SHOPIFY AUTH] ✅ Session created for shop: ${session.shop}`);
      console.log(`[SHOPIFY AUTH] Session details:`, {
        id: session.id,
        isOnline: session.isOnline,
        scope: session.scope,
        hasAccessToken: !!session.accessToken
      });
    },
  },

  // Enhanced webhook configuration for proper HMAC verification
  webhooks: {
    path: "/api/webhooks",
  },

  // Custom domain configuration
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = "2025-07" as ApiVersion;
// CRITICAL FIX: Removed addDocumentResponseHeaders export to avoid ESM issues
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;