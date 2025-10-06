const APP_VERSION = 'V3_PRODUCTION';

/**
 * Universal CORS Handler for Shopify Embedded Apps (2025-07)
 *
 * Provides standardized CORS handling for all API routes to support:
 * - Shopify Admin embedded app context
 * - POS extension requests
 * - Cross-origin iframe communication
 * - OPTIONS preflight requests
 */

export interface CORSConfig {
  allowOrigins?: string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  maxAge?: number;
  allowCredentials?: boolean;
  exposeHeaders?: string[];
}

export const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowOrigins: [
    'https://admin.shopify.com',
    'https://*.shopify.com',
    'https://*.myshopify.com',
    'https://extensions.shopifycdn.com',
    'https://cdn.shopify.com',
    'https://creditnote.vercel.app'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Shopify-Session-Token',
    'X-Shopify-Shop-Domain',
    'X-Shopify-Access-Token',
    'X-POS-Session-ID',
    'X-Frame-Options',
    'X-Requested-With',
    'Cache-Control',
    'Pragma'
  ],
  exposeHeaders: [
    'X-Auth-Refresh',
    'X-Session-Bounced',
    'X-Cache-Bust',
    'X-Route-Identifier'
  ],
  maxAge: 86400, // 24 hours
  allowCredentials: true
};

/**
 * Creates a universal OPTIONS response for CORS preflight requests
 */
export function createUniversalOPTIONSResponse(customConfig?: Partial<CORSConfig>): Response {
  const config = { ...DEFAULT_CORS_CONFIG, ...customConfig };

  console.log('[UNIVERSAL CORS] 🛩️ Handling OPTIONS preflight request:', {
    timestamp: new Date().toISOString(),
    appVersion: APP_VERSION,
    allowOrigins: config.allowOrigins?.length,
    allowMethods: config.allowMethods?.length,
    allowHeaders: config.allowHeaders?.length
  });

  const headers: Record<string, string> = {
    // Core CORS headers
    'Access-Control-Allow-Origin': '*', // Shopify requires flexible origin handling
    'Access-Control-Allow-Methods': config.allowMethods?.join(', ') || 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': config.allowHeaders?.join(', ') || 'Content-Type, Authorization',
    'Access-Control-Max-Age': config.maxAge?.toString() || '86400',

    // Shopify-specific headers
    'X-Frame-Options': 'ALLOWALL', // Required for Shopify embedded apps
    'Content-Security-Policy': 'frame-ancestors https://admin.shopify.com https://*.myshopify.com',

    // Caching and security
    'Cache-Control': 'public, max-age=86400', // Cache preflight for 24 hours
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',

    // Debugging and tracking
    'X-CORS-Handler': 'universal-2025',
    'X-App-Version': APP_VERSION,
    'X-Options-Timestamp': new Date().toISOString()
  };

  // Add exposed headers if specified
  if (config.exposeHeaders && config.exposeHeaders.length > 0) {
    headers['Access-Control-Expose-Headers'] = config.exposeHeaders.join(', ');
  }

  // Add credentials header if enabled
  if (config.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return new Response(null, {
    status: 200,
    headers
  });
}

/**
 * Adds CORS headers to any response
 */
export function addCORSHeaders(
  response: Response,
  origin?: string,
  customConfig?: Partial<CORSConfig>
): Response {
  const config = { ...DEFAULT_CORS_CONFIG, ...customConfig };

  // Clone the response to avoid modifying the original
  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers)
  });

  // Determine allowed origin
  let allowedOrigin = '*';
  if (origin && config.allowOrigins) {
    const isAllowed = config.allowOrigins.some(allowedPattern => {
      if (allowedPattern.includes('*')) {
        const regex = new RegExp(allowedPattern.replace(/\*/g, '.*'));
        return regex.test(origin);
      }
      return allowedPattern === origin;
    });
    if (isAllowed) {
      allowedOrigin = origin;
    }
  }

  // Add CORS headers
  newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  newResponse.headers.set('Access-Control-Allow-Methods', config.allowMethods?.join(', ') || 'GET, POST, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', config.allowHeaders?.join(', ') || 'Content-Type, Authorization');

  if (config.allowCredentials) {
    newResponse.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (config.exposeHeaders && config.exposeHeaders.length > 0) {
    newResponse.headers.set('Access-Control-Expose-Headers', config.exposeHeaders.join(', '));
  }

  // Add Shopify-specific headers
  newResponse.headers.set('X-Frame-Options', 'ALLOWALL');
  newResponse.headers.set('Content-Security-Policy', 'frame-ancestors https://admin.shopify.com https://*.myshopify.com');

  return newResponse;
}

/**
 * Universal request handler that automatically handles OPTIONS and adds CORS headers
 */
export async function handleWithCORS<T>(
  request: Request,
  handler: (request: Request) => Promise<Response>,
  customConfig?: Partial<CORSConfig>
): Promise<Response> {
  // Handle OPTIONS requests immediately
  if (request.method === 'OPTIONS') {
    return createUniversalOPTIONSResponse(customConfig);
  }

  try {
    // Execute the actual handler
    const response = await handler(request);

    // Add CORS headers to the response
    const origin = request.headers.get('Origin');
    return addCORSHeaders(response, origin || undefined, customConfig);

  } catch (error) {
    console.error('[UNIVERSAL CORS] Handler error:', error);

    // Create error response with CORS headers
    const errorResponse = new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const origin = request.headers.get('Origin');
    return addCORSHeaders(errorResponse, origin || undefined, customConfig);
  }
}

/**
 * Middleware function that can be easily added to existing route handlers
 */
export function withUniversalCORS(
  handler: (request: Request) => Promise<Response>,
  customConfig?: Partial<CORSConfig>
) {
  return async (request: Request): Promise<Response> => {
    return handleWithCORS(request, handler, customConfig);
  };
}

/**
 * Simple function to check if a request needs CORS handling
 */
export function needsCORSHandling(request: Request): boolean {
  const origin = request.headers.get('Origin');
  const userAgent = request.headers.get('User-Agent') || '';

  // Always handle if there's an origin header (indicates cross-origin request)
  if (origin) return true;

  // Handle POS extension requests
  if (userAgent.includes('Shopify POS') || userAgent.includes('ExtensibilityHost')) {
    return true;
  }

  // Handle if request comes from Shopify contexts
  const referer = request.headers.get('Referer') || '';
  if (referer.includes('shopify.com') || referer.includes('myshopify.com')) {
    return true;
  }

  return false;
}