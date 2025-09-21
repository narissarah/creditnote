import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// CORS headers for POS extensions
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  try {
    let shopDomain: string | null = null;
    let authType = "UNKNOWN";
    const locationId = request.headers.get('X-Shopify-Location-Id');

    console.log("[POS Credit List API] Processing request with enhanced authentication");
    console.log("[POS Credit List API] Request headers:", {
      authorization: request.headers.get('Authorization') ? 'Bearer ***' : 'Missing',
      locationId,
      origin: request.headers.get('Origin'),
      userAgent: request.headers.get('User-Agent'),
      contentType: request.headers.get('Content-Type')
    });
    console.log("[POS Credit List API] Environment variables check:", {
      hasShopifySecret: !!process.env.SHOPIFY_API_SECRET,
      nodeEnv: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Missing'
    });

    // PHASE 1: Try POS Session Token Authentication (Primary)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      const authResult = verifyPOSSessionToken(sessionToken);

      if (authResult.success && authResult.shopDomain) {
        shopDomain = authResult.shopDomain;
        authType = "POS_SESSION_TOKEN";
        console.log("[POS Credit List API] ✅ POS Session Token verified, shop:", shopDomain);
      } else {
        console.warn("[POS Credit List API] ⚠️ POS Session Token failed:", authResult.error);
        return createPOSAuthErrorResponse(
          authResult.error || "Invalid session token",
          authResult.status || 401
        );
      }
    }

    // PHASE 2: Fallback to Admin Authentication (Secondary)
    if (!shopDomain) {
      try {
        const { session } = await authenticate.admin(request);
        if (session?.shop) {
          shopDomain = session.shop;
          authType = "ADMIN_SESSION";
          console.log("[POS Credit List API] ✅ Admin fallback authenticated, shop:", shopDomain);
        }
      } catch (adminError) {
        console.warn("[POS Credit List API] ⚠️ Admin auth fallback failed:", adminError);
      }
    }

    // PHASE 3: Authentication Validation
    if (!shopDomain) {
      console.error("[POS Credit List API] ❌ Authentication failed - no valid session found");
      return createPOSAuthErrorResponse(
        "Authentication required - please refresh your session",
        401
      );
    }

    // Build search conditions
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

    // Get total count for pagination
    const total = await db.creditNote.count({
      where: whereConditions,
    });

    // Get credit notes with pagination
    const creditNotes = await db.creditNote.findMany({
      where: whereConditions,
      orderBy: { [sortBy]: sortOrder },
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

    const hasMore = offset + limit < total;

    console.log("[POS Credit List API] ✅ Query successful - Found", total, "credit notes for shop:", shopDomain);

    const responseData = {
      data: creditNotes,
      total,
      hasMore,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      }
    };

    return createPOSSuccessResponse(responseData, shopDomain, locationId);

  } catch (error) {
    console.error("[POS Credit List API] ❌ Database query failed:", error);

    return createPOSAuthErrorResponse(
      "Database query failed - please try again",
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