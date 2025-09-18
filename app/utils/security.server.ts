import { type HeadersFunction } from "@remix-run/node";

/**
 * Detect if the request is from POS context
 */
function isPOSContext(request: Request): boolean {
  const url = request.url;
  const userAgent = request.headers.get("User-Agent") || "";
  const xPosRequest = request.headers.get("X-POS-Request");
  const referer = request.headers.get("Referer") || "";

  return (
    xPosRequest === "true" ||
    url.includes("pos.shopifyapps.com") ||
    referer.includes("pos.shopifyapps.com") ||
    userAgent.includes("Shopify POS") ||
    url.includes("pos-ui-extensions")
  );
}

/**
 * Security headers middleware for Shopify app compliance
 * Handles both Admin and POS contexts with appropriate CSP policies
 */
export const securityHeaders: HeadersFunction = ({ request }) => {
  const headers = new Headers();
  const isPos = isPOSContext(request);

  let cspDirectives: string[];

  if (isPos) {
    // POS-specific CSP - Extremely restrictive to match POS environment
    cspDirectives = [
      "default-src 'self'",
      "script-src 'self' https://cdn.shopify.com/shopifycloud/pos_channel/ 'report-sample'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://monorail-edge.shopifysvc.com",
      "frame-ancestors https://*.pos.shopifyapps.com https://pos.shopify.com",
      "child-src 'none'",
      "worker-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ];
  } else {
    // Admin-specific CSP - Allows App Bridge and web functionality
    cspDirectives = [
      "default-src 'self' https://*.myshopify.com https://*.shopify.com https://*.shopifycdn.com https://*.shopifyapps.com https://*.shopifycloud.com wss://*.shopifycloud.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://*.shopify.com https://*.shopifycdn.com https://*.shopifyapps.com blob:",
      "style-src 'self' 'unsafe-inline' https://cdn.shopify.com https://*.shopifycdn.com",
      "img-src 'self' data: blob: https: https://*.shopifycdn.com https://*.shopify.com",
      "font-src 'self' data: https://cdn.shopify.com https://*.shopifycdn.com",
      "connect-src 'self' https://*.shopify.com https://*.myshopify.com https://*.shopifyapps.com https://*.shopifycloud.com wss://*.shopifycloud.com https://monorail-edge.shopifysvc.com",
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
      "child-src 'self' blob: data: https://*.shopifyapps.com",
      "worker-src 'self' blob: data: https://*.shopifyapps.com",
      "media-src 'self' data: blob: https://*.shopifycdn.com https://*.shopify.com",
      "object-src 'none'",
      "manifest-src 'self'"
    ];
  }

  const cspHeader = cspDirectives.join("; ");

  // Set security headers
  headers.set("Content-Security-Policy", cspHeader);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", isPos ? "ALLOWALL" : "ALLOWALL");
  headers.set("X-XSS-Protection", "1; mode=block");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()");

  // Add HSTS in production
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // Add debug header to identify context
  if (process.env.NODE_ENV === "development") {
    headers.set("X-Context-Type", isPos ? "POS" : "Admin");
  }

  return headers;
};