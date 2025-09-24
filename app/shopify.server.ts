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
  // FIXED: Remove unstable_newEmbeddedAuthStrategy - it causes 410 Gone errors
  // Based on ultra-deep research: this strategy conflicts with manual session token validation
  // future: { unstable_newEmbeddedAuthStrategy: true }, // REMOVED - causes authentication conflicts

  // FIXED: Use offline tokens for better session stability in serverless environments
  // Online tokens cause issues with Vercel + Prisma session storage combination
  useOnlineTokens: false,
  // Enhanced authentication configuration for Vercel deployments and 2025-07 API
  hooks: {
    afterAuth: async ({ session }) => {
      console.log(`[SHOPIFY AUTH] Session created for shop: ${session.shop}`);
      console.log(`[SHOPIFY AUTH] Session ID: ${session.id}`);
      console.log(`[SHOPIFY AUTH] Access token exists: ${!!session.accessToken}`);
      console.log(`[SHOPIFY AUTH] Session expires: ${session.expires}`);
      console.log(`[SHOPIFY AUTH] Token type: ${session.isOnline ? 'online' : 'offline'}`);

      // CRITICAL: Validate session is properly stored (2025-07 API requirement)
      try {
        console.log(`[SHOPIFY AUTH] 🔍 Validating session storage...`);
        const stored = await shopify.sessionStorage.loadSession(session.id);

        if (!stored) {
          console.error('[SHOPIFY AUTH] ❌ Session not properly stored - CRITICAL ERROR!');
          throw new Error('Session storage failed - session not persisted');
        }

        if (!stored.accessToken) {
          console.error('[SHOPIFY AUTH] ❌ Stored session missing access token!');
          throw new Error('Session storage failed - missing access token');
        }

        console.log(`[SHOPIFY AUTH] ✅ Session validation successful:`, {
          storedShop: stored.shop,
          hasAccessToken: !!stored.accessToken,
          storedExpires: stored.expires,
          sessionMatches: stored.id === session.id
        });

      } catch (error) {
        console.error('[SHOPIFY AUTH] 💥 Session storage validation failed:', error);
        // Don't throw here as it would break auth flow, but log the critical error
      }
    },
    beforeAuth: async ({ request }) => {
      const userAgent = request.headers.get("User-Agent") || "";
      const url = request.url;

      console.log(`[SHOPIFY AUTH] Before auth check:`, {
        userAgent,
        url,
        method: request.method,
        timestamp: new Date().toISOString()
      });

      // Don't prevent auth, just log for debugging
      return;
    }
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