import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

// Valid scopes for Shopify API 2025-07
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

// Use environment scopes if valid, otherwise use hardcoded valid scopes
const configuredScopes = process.env.SCOPES?.split(",").filter(scope => {
  const isValid = VALID_SCOPES.includes(scope.trim());
  if (!isValid && scope.trim()) {
    console.warn(`⚠️ Invalid scope detected and filtered out: ${scope}`);
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
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
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