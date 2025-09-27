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
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        format: 'es'
      }
    },
  },
  optimizeDeps: {
    include: ["@shopify/polaris"],
  },
  ssr: {
    noExternal: ["@shopify/shopify-app-remix"]
  },
}) satisfies UserConfig;
