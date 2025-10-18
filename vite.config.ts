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
  // SSR bundling for Vercel serverless + POS UI extensions backend
  ssr: {
    noExternal: [
      "@shopify/shopify-app-remix",
      "@shopify/shopify-app-session-storage-prisma",
      "@shopify/ui-extensions",
      "@shopify/ui-extensions-react",
      // Bundle ALL Shopify packages to avoid CommonJS conflicts
      /^@shopify\//,
      // Include additional packages that might use require()
      "crypto-js",
      "uuid",
      "nanoid",
      // Note: qrcode removed - let Node.js handle it as CommonJS
      "decimal.js",
      "date-fns",
    ],
    // CRITICAL: Externalize React and React Router to prevent "Cannot read properties of null (reading 'useContext')" error
    // These must be resolved by Node.js runtime, not bundled
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom/server",
      "@remix-run/react",
      "react-router",
      "react-router-dom",
    ],
    resolve: {
      externalConditions: ['node', 'import']
    }
  },
}) satisfies UserConfig;
