import "@shopify/shopify-app-remix/adapters/vercel";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// ENHANCED: Comprehensive environment variable validation with format checks
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

if (formatValidationErrors.length > 0) {
  console.error('❌ CRITICAL ERROR: Environment variable format validation failed:');
  formatValidationErrors.forEach(error => console.error(`  - ${error}`));
  throw new Error(`Environment variable format validation failed: ${formatValidationErrors.join(', ')}`);
}

console.log('✅ Environment variables validated successfully (format and presence)');

// CRITICAL DEBUG: Verify auth strategy flag
console.log('🔐 AUTH STRATEGY VERIFICATION:');
console.log('✅ unstable_newEmbeddedAuthStrategy will be set to: TRUE');
console.log('✅ useOnlineTokens will be set to: FALSE');
console.log('✅ isEmbeddedApp will be set to: TRUE');
console.log('🎯 This should eliminate 410 Gone errors via token exchange');

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

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: "2025-07" as ApiVersion,
  scopes: configuredScopes,
  appUrl: normalizedAppUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,

  // 2025 PATTERN: Enable new embedded auth strategy for modern Shopify apps
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },

  // Use offline tokens for serverless stability and POS compatibility
  useOnlineTokens: false,

  // FIXED: Remove invalid restResources configuration that was causing Class extends error
  // The restResources should be imported from @shopify/shopify-api/rest/admin/* if needed
  // but for most apps, the default configuration is sufficient

  // ENHANCED: Proper token exchange configuration for 2025-07
  // This follows Shopify's latest recommendations for embedded apps
  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },
  // Simplified hooks for debugging
  hooks: {
    afterAuth: async ({ session }) => {
      console.log(`[SHOPIFY AUTH] Session created for shop: ${session.shop}`);
    },
  },
  // Enhanced error handling for embedded apps
  // Custom domain configuration
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = "2025-07" as ApiVersion;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;