import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Diagnostic endpoint for troubleshooting POS UI extension issues
 * Provides server configuration and connectivity information
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  try {
    console.log("[POS Diagnostics] Starting diagnostic check...");

    // PHASE 1: Environment Variables Check
    const envCheck = {
      nodeEnv: process.env.NODE_ENV || 'undefined',
      hasShopifySecret: !!process.env.SHOPIFY_API_SECRET,
      secretLength: process.env.SHOPIFY_API_SECRET?.length || 0,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasShopifyApiKey: !!process.env.SHOPIFY_API_KEY,
      hasShopifyAppUrl: !!process.env.SHOPIFY_APP_URL,
      timestamp: new Date().toISOString()
    };

    console.log("[POS Diagnostics] Environment check:", envCheck);

    // PHASE 2: Authentication Test
    let authResult = null;
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      authResult = verifyPOSSessionToken(sessionToken);
      console.log("[POS Diagnostics] Auth test result:", {
        success: authResult.success,
        error: authResult.error,
        hasShopDomain: !!authResult.shopDomain
      });
    } else {
      console.log("[POS Diagnostics] No auth header provided");
      authResult = { success: false, error: "No authorization header" };
    }

    // PHASE 3: Database Connectivity Test
    let dbResult = null;
    try {
      // Simple query to test database connectivity
      const testQuery = await db.creditNote.count({
        where: {
          shopDomain: authResult.shopDomain || 'test.myshopify.com'
        }
      });

      dbResult = {
        success: true,
        testQueryResult: testQuery,
        message: "Database connection successful"
      };

      console.log("[POS Diagnostics] Database test successful:", dbResult);
    } catch (dbError) {
      dbResult = {
        success: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error',
        message: "Database connection failed"
      };

      console.error("[POS Diagnostics] Database test failed:", dbResult);
    }

    // PHASE 4: Admin Authentication Fallback Test
    let adminAuthResult = null;
    try {
      const { session } = await authenticate.admin(request);
      adminAuthResult = {
        success: true,
        hasSession: !!session,
        shopDomain: session?.shop || null,
        message: "Admin authentication successful"
      };

      console.log("[POS Diagnostics] Admin auth test:", adminAuthResult);
    } catch (adminError) {
      adminAuthResult = {
        success: false,
        error: adminError instanceof Error ? adminError.message : 'Unknown admin auth error',
        message: "Admin authentication failed"
      };

      console.log("[POS Diagnostics] Admin auth test failed:", adminAuthResult);
    }

    const diagnosticData = {
      timestamp: new Date().toISOString(),
      processingTime: Date.now() - startTime,
      server: {
        environment: envCheck,
        uptime: process.uptime(),
        nodeVersion: process.version
      },
      authentication: {
        posAuth: authResult,
        adminAuth: adminAuthResult
      },
      database: dbResult,
      request: {
        method: request.method,
        url: request.url,
        headers: {
          origin: request.headers.get('Origin'),
          userAgent: request.headers.get('User-Agent'),
          contentType: request.headers.get('Content-Type'),
          hasAuth: !!request.headers.get('Authorization')
        }
      }
    };

    console.log("[POS Diagnostics] Complete diagnostic result:", {
      success: true,
      processingTime: diagnosticData.processingTime,
      authSuccess: authResult?.success,
      dbSuccess: dbResult?.success,
      adminAuthSuccess: adminAuthResult?.success
    });

    // Return success response with diagnostic data
    return createPOSSuccessResponse({
      diagnostics: diagnosticData,
      status: "OK",
      message: "Diagnostic check completed successfully"
    }, authResult?.shopDomain || adminAuthResult?.shopDomain || 'unknown');

  } catch (error) {
    console.error("[POS Diagnostics] Critical error during diagnostics:", error);

    return createPOSAuthErrorResponse(
      `Diagnostic check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id, X-Shopify-Access-Token, Cache-Control, Pragma, Expires",
      "Access-Control-Expose-Headers": "X-RateLimit-Remaining, X-RateLimit-Limit, X-Request-ID",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-cache, no-store, must-revalidate, private",
      "Pragma": "no-cache",
      "Expires": "0",
      "Vary": "Origin, Authorization"
    },
  });
}