// Debug endpoint for session analysis in Vercel environment
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { sessionStorage } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Only allow in development or with special header
  const allowDebug = process.env.NODE_ENV === 'development' ||
                    request.headers.get('X-Debug-Key') === 'creditnote-debug-2025';

  if (!allowDebug) {
    return json({ error: "Debug endpoint not available in production" }, { status: 403 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  const sessionId = url.searchParams.get('sessionId');

  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        region: process.env.VERCEL_REGION,
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'vercel-function',
      },
      request: {
        url: request.url,
        method: request.method,
        headers: {
          'user-agent': request.headers.get('user-agent'),
          'x-shopify-shop-domain': request.headers.get('x-shopify-shop-domain'),
          'authorization': request.headers.get('authorization') ? '[PRESENT]' : '[MISSING]',
          'x-shopify-access-token': request.headers.get('x-shopify-access-token') ? '[PRESENT]' : '[MISSING]',
        }
      },
      session: null as any,
      sessionTests: [] as any[]
    };

    // Test specific session if provided
    if (sessionId) {
      try {
        const session = await sessionStorage.loadSession(sessionId);
        if (session) {
          debugInfo.session = {
            id: session.id,
            shop: session.shop,
            isOnline: session.isOnline,
            hasAccessToken: !!session.accessToken,
            expires: session.expires,
            state: session.state,
            scope: session.scope
          };
        } else {
          debugInfo.session = { error: 'Session not found' };
        }
      } catch (error) {
        debugInfo.session = { error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }

    // Test common session patterns if shop is provided
    if (shop) {
      const sessionPatterns = [
        `offline_${shop}`,
        `online_${shop}`,
        shop,
        `${shop}_offline`,
        `${shop}_online`
      ];

      for (const pattern of sessionPatterns) {
        try {
          const session = await sessionStorage.loadSession(pattern);
          debugInfo.sessionTests.push({
            pattern,
            found: !!session,
            data: session ? {
              id: session.id,
              shop: session.shop,
              isOnline: session.isOnline,
              hasAccessToken: !!session.accessToken,
              expires: session.expires,
              isExpired: session.expires ? new Date(session.expires) < new Date() : false
            } : null
          });
        } catch (error) {
          debugInfo.sessionTests.push({
            pattern,
            found: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return json(debugInfo);

  } catch (error) {
    return json({
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}