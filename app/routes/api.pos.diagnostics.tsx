import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { simplifiedPOSAuth, createPOSAuthErrorResponse, createPOSAuthSuccessResponse } from "../utils/simplified-pos-auth.server";

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

    // PHASE 2: Enhanced Authentication Test with Simplified POS Auth
    console.log("[POS Diagnostics] 🎯 USING SIMPLIFIED POS AUTH - v2025 SYSTEM 🎯");
    const authResult = await simplifiedPOSAuth(request);

    console.log("[POS Diagnostics] Auth test result:", {
      success: authResult.success,
      authMethod: authResult.authMethod,
      error: authResult.error,
      hasShop: !!authResult.shop
    });

    // PHASE 3: Admin Authentication Test (moved before database test)
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

    // PHASE 4: Enhanced Database Connectivity Test
    let dbResult = null;
    try {
      // Try to get shop domain from auth result, admin auth, or use actual shop domain
      let shopDomain = authResult.shop;

      if (!shopDomain && adminAuthResult?.shopDomain) {
        shopDomain = adminAuthResult.shopDomain;
      }

      // If still no shop domain, diagnostics cannot proceed without valid authentication
      if (!shopDomain) {
        return json({
          success: false,
          error: 'Cannot run diagnostics - no valid shop domain found in authentication',
          diagnostics: {
            server: envCheck,
            authentication: { valid: false, error: 'No shop domain extracted from any auth method' },
            posSession: authResult,
            adminAuth: adminAuthResult,
            recommendation: 'Ensure proper POS authentication is working before running diagnostics'
          }
        }, { status: 401 });
      }

      console.log(`[POS Diagnostics] Using shop domain for database test: ${shopDomain}`);

      // Test both field names for compatibility
      const [shopDomainCount, shopFieldCount] = await Promise.all([
        db.creditNote.count({
          where: { shopDomain, deletedAt: null }
        }),
        db.creditNote.count({
          where: { shop: shopDomain, deletedAt: null }
        })
      ]);

      // Also test for all credits to see if data exists under different shop domains
      const [allCreditsCount] = await Promise.all([
        db.creditNote.count({
          where: { deletedAt: null }
        })
      ]);

      const totalCredits = Math.max(shopDomainCount, shopFieldCount);

      dbResult = {
        success: true,
        shopDomainFieldCount: shopDomainCount,
        shopFieldCount: shopFieldCount,
        totalCredits,
        allCreditsInDatabase: allCreditsCount,
        testedShopDomain: shopDomain,
        message: "Database connection successful",
        dataConsistency: shopDomainCount === shopFieldCount ? "CONSISTENT" : "INCONSISTENT"
      };

      console.log("[POS Diagnostics] Enhanced database test successful:", dbResult);
    } catch (dbError) {
      dbResult = {
        success: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error',
        message: "Database connection failed"
      };

      console.error("[POS Diagnostics] Database test failed:", dbResult);
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
    return createPOSAuthSuccessResponse(authResult, {
      diagnostics: diagnosticData,
      status: "OK",
      message: "Diagnostic check completed successfully - v2025 SIMPLIFIED AUTH ACTIVE",
      routeIdentifier: "🎯 POS_DIAGNOSTICS_V2025 🎯",
      deploymentStatus: "NUCLEAR_CACHE_CLEARED"
    });

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