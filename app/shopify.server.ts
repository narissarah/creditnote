import "@shopify/shopify-app-remix/adapters/vercel";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// CRITICAL: Validate required environment variables before initialization
const requiredEnvVars = {
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  SHOPIFY_APP_URL: process.env.SHOPIFY_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  console.error('❌ CRITICAL ERROR: Missing required environment variables:', missingVars);
  console.error('📝 Required variables:', Object.keys(requiredEnvVars));
  console.error('🔍 Check your .env file or deployment environment configuration');
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

console.log('✅ Environment variables validated successfully');

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

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July25,
  scopes: configuredScopes,
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  isEmbeddedApp: true,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  // Critical fix for 410 Gone errors - use offline tokens for stable authentication
  useOnlineTokens: false,
  // Enhanced authentication configuration for Vercel deployments
  hooks: {
    afterAuth: async ({ session }) => {
      console.log(`[SHOPIFY AUTH] Session created for shop: ${session.shop}`);
      console.log(`[SHOPIFY AUTH] Session ID: ${session.id}`);
      console.log(`[SHOPIFY AUTH] Access token exists: ${!!session.accessToken}`);
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;