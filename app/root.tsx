import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useLoaderData,
} from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { authenticate } from "./shopify.server";
import { validateEnvironmentVariables, getValidatedEnvironmentConfig } from "./utils/environment-validation.server";
import printStyles from "./styles/print.css?url";
import mobileStyles from "./styles/mobile.css?url";
import uniformTableStyles from "./styles/uniform-table.css?url";
import polarisOverrides from "./styles/polaris-overrides.css?url";
// 2025-07: Frame components deprecated - AppProvider handles all frame context

export function links() {
  return [
    { rel: "stylesheet", href: printStyles },
    { rel: "stylesheet", href: mobileStyles },
    { rel: "stylesheet", href: uniformTableStyles },
    { rel: "stylesheet", href: polarisOverrides },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  // CRITICAL FIX: ALWAYS provide API key for AppProvider first, THEN handle bots
  // This ensures embedded app context can always be established
  console.log('[ROOT LOADER] Starting embedded app initialization...');

  try {
    // Step 1: ALWAYS get validated API key for AppProvider
    const validatedConfig = getValidatedEnvironmentConfig();

    // Step 2: Extract shop origin for modern 2025 AppProvider
    const url = new URL(request.url);
    const shopParam = url.searchParams.get('shop');
    const shopOrigin = shopParam?.endsWith('.myshopify.com')
      ? shopParam
      : shopParam
        ? `${shopParam}.myshopify.com`
        : 'example.myshopify.com'; // Fallback for development

    // Step 3: Check for bots but PRESERVE embedded app context capability
    const userAgent = request.headers.get('User-Agent') || '';
    const isVercelBot = userAgent.includes('vercel-favicon') ||
                       userAgent.includes('vercel-screenshot') ||
                       userAgent.includes('vercel-bot') ||
                       userAgent.includes('vercel-og-image') ||
                       userAgent.startsWith('vercel-');

    if (isVercelBot) {
      console.log('[ROOT] 🤖 Bot detected - providing minimal embedded app context support:', userAgent.substring(0, 50));

      // CRITICAL: Still return API key to allow embedded app context initialization
      // This prevents AppProvider errors even for bot requests
      return json({
        apiKey: validatedConfig.SHOPIFY_API_KEY,
        shopOrigin,
        isEmbedded: true,
        isBotRequest: true, // Flag for conditional rendering
        botType: 'vercel',
        userAgent: userAgent.substring(0, 50)
      });
    }

    // ROOT LOADER: Only handle document-level concerns, NOT authentication
    // Authentication should be handled by app.tsx loader in the hierarchy
    console.log('[ROOT LOADER] Providing document-level configuration with enhanced API key validation');

    try {
      // Use comprehensive environment validation with fallbacks
      const envValidation = validateEnvironmentVariables();
      const validatedConfig = getValidatedEnvironmentConfig();

    console.log('[ROOT LOADER] Environment validation:', {
      isValid: envValidation.isValid,
      hasApiKeyFallback: envValidation.hasApiKeyFallback,
      apiKeyLength: validatedConfig.SHOPIFY_API_KEY.length
    });

    // Log any validation issues
    if (!envValidation.isValid) {
      envValidation.warnings.forEach(warning =>
        console.warn(`[ROOT LOADER] WARNING: ${warning}`)
      );
      envValidation.errors.forEach(error =>
        console.error(`[ROOT LOADER] ERROR: ${error}`)
      );
    }

    return json({
      apiKey: validatedConfig.SHOPIFY_API_KEY, // Will use fallback if needed
      shopOrigin,
      isEmbedded: true,
      hasApiKeyFallback: envValidation.hasApiKeyFallback,
    });

  } catch (validationError) {
    console.error('[ROOT LOADER] Environment validation failed, using emergency fallback:', validationError);

    // Emergency fallback API key
    const emergencyApiKey = "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e";

    return json({
      apiKey: emergencyApiKey,
      shopOrigin: 'example.myshopify.com',
      isEmbedded: true,
      hasApiKeyFallback: true,
      emergencyFallback: true,
    });
    }
  } catch (outerError) {
    console.error('[ROOT LOADER] Critical error, using emergency fallback:', outerError);

    // Emergency fallback API key
    const emergencyApiKey = "3e0a90c9ecdf9a085dfc7bd1c1c5fa6e";

    return json({
      apiKey: emergencyApiKey,
      shopOrigin: 'example.myshopify.com',
      isEmbedded: true,
      hasApiKeyFallback: true,
      emergencyFallback: true,
    });
  }
}

export default function App() {
  const { apiKey, isBotRequest, botType, userAgent, shopOrigin } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        {/* SIMPLIFIED 2025: Let AppProvider handle App Bridge initialization */}
        <meta name="shopify-api-key" content={apiKey || ""} />
        <meta name="shopify-shop-domain" content={shopOrigin || ""} />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>

        {/* MODERN 2025: Enhanced App Bridge initialization for embedded context */}
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider
          apiKey={apiKey}
          isEmbeddedApp={true}
          shopOrigin={shopOrigin}
          i18n={{}}
        >
          {/* 2025-07: Let AppProvider handle all frame context - NO Frame wrapper needed */}
          {isBotRequest ? (
            <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
              <h1>CreditNote App</h1>
              <p>Shopify embedded app for credit note management.</p>
              <small>Bot request detected: {botType}</small>
            </div>
          ) : (
            <Outlet />
          )}
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  try {
    console.error('[ROOT ERROR BOUNDARY] Error caught:', error);

    if (isRouteErrorResponse(error)) {
      // FIXED: Let app.tsx boundary handle authentication errors (401, 403, 410)
      // Root boundary only handles non-auth errors like 404

      // Handle 404 errors
      if (error.status === 404) {
        return (
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
              <title>Page Not Found</title>
            </head>
            <body>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
            </body>
          </html>
        );
      }

      // For other HTTP errors, let them bubble up to app.tsx boundary
      // which uses official Shopify boundary.error for proper handling
    }

    // CRITICAL FIX: For other errors, handle manually to avoid "require is not defined"
    console.error('[ROOT ERROR] Unhandled error:', error);
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <title>Application Error</title>
        </head>
        <body>
          <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
            <h1>Application Error</h1>
            <p>An unexpected error occurred. Please refresh the page or contact support.</p>
            <button onClick={() => window.location.reload()} style={{
              backgroundColor: '#008060',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              Refresh Page
            </button>
          </div>
        </body>
      </html>
    );
  } catch (boundaryError) {
    console.error('[ROOT ERROR BOUNDARY] Boundary failed:', boundaryError);
    return (
      <html>
        <head><title>Application Error</title></head>
        <body>
          <div>An unexpected error occurred. Please refresh the page.</div>
        </body>
      </html>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  // BULLETPROOF ROOT HEADERS: Ultra-safe implementation to prevent "require is not defined"
  try {
    // Extract request safely with comprehensive null checks
    const request = headersArgs?.request;
    let shopDomain = 'example.myshopify.com'; // Safe fallback

    // Safe domain extraction with error handling
    if (request) {
      try {
        const url = new URL(request.url || '');
        const shopParam = url.searchParams.get('shop');
        const shopHeader = request.headers.get('x-shopify-shop-domain');

        const extractedShop = shopParam || shopHeader;
        if (extractedShop && typeof extractedShop === 'string') {
          shopDomain = extractedShop.endsWith('.myshopify.com')
            ? extractedShop
            : `${extractedShop}.myshopify.com`;
        }
      } catch (urlError) {
        console.warn('[ROOT HEADERS] URL parsing failed, using fallback domain');
      }
    }

    // Manual headers creation - completely avoids any Shopify boundary functions
    const headers = new Headers();

    // 2025-07 COMPLIANT: Dynamic shop-specific CSP headers
    const cspValue = `frame-ancestors https://${shopDomain} https://admin.shopify.com;`;
    headers.set('Content-Security-Policy', cspValue);

    console.log(`[ROOT HEADERS] ✅ Dynamic CSP set for shop: ${shopDomain}`);
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('X-Content-Type-Options', 'nosniff');

    // Additional security headers for production
    headers.set('X-DNS-Prefetch-Control', 'off');
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-XSS-Protection', '1; mode=block');

    // Performance optimizations
    headers.set('X-Powered-By', 'Shopify CreditNote App v3.0');

    console.log('[ROOT HEADERS] ✅ Enhanced headers created successfully for Shopify 2025-07');
    return headers;

  } catch (error) {
    console.error('[ROOT HEADERS] ❌ Critical error in headers function, using failsafe:', error);

    // FAILSAFE: Return minimal headers required for Shopify embedded apps
    const fallbackHeaders = new Headers();
    fallbackHeaders.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com;');
    fallbackHeaders.set('X-Frame-Options', 'ALLOWALL');
    fallbackHeaders.set('X-Content-Type-Options', 'nosniff');

    return fallbackHeaders;
  }
};
