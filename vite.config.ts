import { vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { vercelPreset } from "@vercel/remix/vite";

installGlobals({ nativeFetch: true });

// Simplified configuration for production stability
console.log('[VITE CONFIG] App URL:', process.env.SHOPIFY_APP_URL || 'not set');

export default defineConfig({
  plugins: [
    remix({
      presets: [vercelPreset()],
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_lazyRouteDiscovery: true,
        v3_singleFetch: true,
      },
      // CRITICAL FIX: Ensure correct server build configuration for Vercel
      serverBuildFile: "index.js",
      serverModuleFormat: "cjs",
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  // BULLETPROOF: Complete ESM bundling to eliminate "require is not defined" errors
  ssr: {
    noExternal: [
      "@shopify/shopify-app-remix",
      "@shopify/polaris",
      "@shopify/app-bridge-react",
      "@shopify/shopify-app-session-storage-prisma",
      "@shopify/ui-extensions",
      "@shopify/ui-extensions-react",
      // Bundle ALL Shopify packages to avoid any CommonJS conflicts
      /^@shopify\//,
      // Include additional packages that might use require()
      "crypto-js",
      "uuid",
      "nanoid",
      "qrcode",
      "decimal.js",
      "date-fns",
    ],
    // Force all external dependencies to be treated as ESM
    external: [],
  },
  optimizeDeps: {
    include: [
      "@shopify/polaris",
      "@shopify/app-bridge-react",
      "@shopify/shopify-app-remix/server"
    ],
  },
}) satisfies UserConfig;
