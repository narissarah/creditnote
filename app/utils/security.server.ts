import type { HeadersFunction } from "@remix-run/node";

/**
 * Security headers middleware for Shopify app compliance
 */
export const securityHeaders: HeadersFunction = () => ({
  // Content Security Policy - configured for Shopify embedded apps
  "Content-Security-Policy": [
    "default-src 'self' https://*.myshopify.com https://*.shopify.com https://*.shopifycdn.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.shopify.com https://*.shopifycdn.com",
    "style-src 'self' 'unsafe-inline' https://cdn.shopify.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://cdn.shopify.com",
    "connect-src 'self' https://*.myshopify.com https://*.shopify.com wss://*.myshopify.com",
    "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
    "child-src 'self' https://*.myshopify.com",
    "worker-src 'self' blob:",
  ].join("; "),
  
  // Security headers
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "ALLOWALL", // Required for Shopify embedded apps
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  
  // HSTS - only in production
  ...(process.env.NODE_ENV === "production" && {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  }),
});