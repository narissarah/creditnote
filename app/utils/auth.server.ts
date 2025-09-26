import { authenticate } from "../shopify.server";

// ENHANCED 2025-07: Advanced authentication with comprehensive error handling and debugging
export const authenticateRequest = async (request: Request, retryCount = 0): Promise<any> => {
  console.log('[AUTH] Initiating Shopify 2025-07 embedded authentication with token exchange');

  // Enhanced session token analysis for debugging
  const url = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const sessionToken = url.searchParams.get('id_token') ||
                       url.searchParams.get('session') ||
                       authHeader?.replace('Bearer ', '');
  const hostParam = url.searchParams.get('host');
  const shopParam = url.searchParams.get('shop');

  console.log('[AUTH] Request analysis:', {
    hasSessionToken: !!sessionToken,
    tokenLength: sessionToken?.length || 0,
    hasHostParam: !!hostParam,
    hasShopParam: !!shopParam,
    userAgent: request.headers.get('User-Agent')?.substring(0, 50),
    requestUrl: url.pathname,
    origin: request.headers.get('Origin'),
    referer: request.headers.get('Referer'),
    retryAttempt: retryCount
  });

  try {
    // CRITICAL: Use new embedded auth strategy with enhanced error capture
    const { admin, session } = await authenticate.admin(request);

    console.log('[AUTH] ✅ Authentication successful:', {
      shop: session.shop,
      sessionId: session.id,
      isOnline: session.isOnline,
      hasAccessToken: !!session.accessToken,
      tokenLength: session.accessToken?.length || 0,
      scope: session.scope,
      expires: session.expires?.toISOString(),
      userId: session.userId?.toString(),
      authMethod: "SHOPIFY_STANDARD_EMBEDDED"
    });

    return {
      admin,
      session,
      authMethod: "SHOPIFY_STANDARD_EMBEDDED",
      shopDomain: session.shop,
    };
  } catch (authError) {
    // ENHANCED: Detailed error analysis for debugging
    console.error('[AUTH] ❌ Authentication failed with detailed context:', {
      error: authError instanceof Error ? authError.message : 'Unknown error',
      errorType: authError?.constructor?.name,
      stack: authError instanceof Error ? authError.stack?.split('\n')[0] : 'No stack trace',
      retryAttempt: retryCount,
      requestContext: {
        hasSessionToken: !!sessionToken,
        hasHost: !!hostParam,
        hasShop: !!shopParam,
        url: url.pathname,
        method: request.method
      }
    });

    // ENHANCED: Retry logic for intermittent authentication failures
    if (retryCount < 2 && authError instanceof Error) {
      // Retry for session token refresh issues or temporary failures
      if (authError.message.includes('session') ||
          authError.message.includes('token') ||
          authError.message.includes('Invalid') ||
          authError.message.includes('expired')) {

        console.log(`[AUTH] Retrying authentication (attempt ${retryCount + 1}/2) after ${100 * (retryCount + 1)}ms delay`);

        // Brief delay before retry to allow token refresh
        await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));

        return authenticateRequest(request, retryCount + 1);
      }
    }

    // Provide specific error context for different authentication failure types
    if (authError instanceof Error) {
      if (authError.message.includes('session')) {
        console.log('[AUTH] Session-related error - this is expected for direct access without Shopify context');
      } else if (authError.message.includes('token')) {
        console.log('[AUTH] Token validation error - check session token format and expiry');
      } else if (authError.message.includes('shop')) {
        console.log('[AUTH] Shop parameter error - verify shop domain configuration');
      }
    }

    // Let Shopify's new auth strategy handle error recovery
    throw authError;
  }
};