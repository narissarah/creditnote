import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * SIMPLIFIED POS API - Optimized for POS UI Extensions
 * Uses flexible authentication and enhanced error handling
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const search = url.searchParams.get("search") || "";

  console.log("[POS Simple API] =================================");
  console.log("[POS Simple API] Starting request processing");
  console.log("[POS Simple API] Request details:", {
    url: request.url,
    method: request.method,
    limit,
    offset,
    search,
    timestamp: new Date().toISOString()
  });

  try {
    let shopDomain: string | null = null;
    let authType = "NONE";

    // STRATEGY 1: Try POS Session Token Authentication (Primary)
    console.log("[POS Simple API] Phase 1: Attempting POS authentication...");
    const authHeader = request.headers.get('Authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      console.log("[POS Simple API] Found Bearer token, length:", sessionToken.length);

      const authResult = verifyPOSSessionToken(sessionToken);

      if (authResult.success && authResult.shopDomain) {
        shopDomain = authResult.shopDomain;
        authType = "POS_SESSION_TOKEN";
        console.log("[POS Simple API] ✅ POS authentication successful, shop:", shopDomain);
      } else {
        console.warn("[POS Simple API] ⚠️ POS authentication failed:", authResult.error);
        // Don't fail yet - try fallback authentication
      }
    } else {
      console.log("[POS Simple API] No Bearer token found in Authorization header");
    }

    // STRATEGY 2: Admin Authentication Fallback
    if (!shopDomain) {
      console.log("[POS Simple API] Phase 2: Attempting admin authentication fallback...");
      try {
        const { session } = await authenticate.admin(request);
        if (session?.shop) {
          shopDomain = session.shop;
          authType = "ADMIN_SESSION_FALLBACK";
          console.log("[POS Simple API] ✅ Admin fallback successful, shop:", shopDomain);
        }
      } catch (adminError) {
        console.warn("[POS Simple API] ⚠️ Admin fallback failed:", adminError);
      }
    }

    // STRATEGY 3: Header-based Shop Detection (Last Resort)
    if (!shopDomain) {
      console.log("[POS Simple API] Phase 3: Attempting header-based shop detection...");
      const shopHeader = request.headers.get('X-Shopify-Shop-Domain');
      if (shopHeader) {
        shopDomain = shopHeader;
        authType = "HEADER_BASED";
        console.log("[POS Simple API] ✅ Header-based detection successful, shop:", shopDomain);
      }
    }

    // FINAL VALIDATION
    if (!shopDomain) {
      console.error("[POS Simple API] ❌ All authentication strategies failed");
      console.log("[POS Simple API] Request headers:", {
        authorization: request.headers.get('Authorization') ? 'Present' : 'Missing',
        shopDomain: request.headers.get('X-Shopify-Shop-Domain'),
        origin: request.headers.get('Origin'),
        userAgent: request.headers.get('User-Agent'),
        referer: request.headers.get('Referer')
      });

      return createPOSAuthErrorResponse(
        "Authentication failed - no valid session found. Please refresh your POS session.",
        401
      );
    }

    console.log("[POS Simple API] ✅ Authentication successful:", {
      shopDomain,
      authType,
      processingTime: Date.now() - startTime
    });

    // DATABASE QUERY
    console.log("[POS Simple API] Phase 4: Querying database...");

    const whereConditions: any = {
      shopDomain: shopDomain,
    };

    if (search) {
      whereConditions.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { noteNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await db.creditNote.count({
      where: whereConditions,
    });

    console.log("[POS Simple API] Total credit notes found:", total);

    // Get credit notes
    const creditNotes = await db.creditNote.findMany({
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        noteNumber: true,
        customerName: true,
        customerEmail: true,
        originalAmount: true,
        remainingAmount: true,
        currency: true,
        status: true,
        reason: true,
        createdAt: true,
        expiresAt: true,
        updatedAt: true,
      },
    });

    const processingTime = Date.now() - startTime;

    console.log("[POS Simple API] ✅ Query successful:", {
      creditNotesCount: creditNotes.length,
      total,
      processingTime,
      authType,
      shopDomain
    });

    const responseData = {
      data: creditNotes,
      total,
      hasMore: offset + limit < total,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      metadata: {
        authType,
        processingTime,
        requestTimestamp: new Date().toISOString()
      }
    };

    return createPOSSuccessResponse(responseData, shopDomain);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[POS Simple API] ❌ Critical error:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime
    });

    return createPOSAuthErrorResponse(
      `Database query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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