import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { verifyPOSSessionToken } from "../utils/pos-auth-balanced.server";

// Enhanced CORS headers for POS extensions
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

    console.log("[POS Credit List API] Processing request with BALANCED authentication");
    console.log("[POS Credit List API] Request headers:", {
      authorization: request.headers.get('Authorization') ? 'Bearer ***' : 'Missing',
      locationId,
      origin: request.headers.get('Origin'),
      userAgent: request.headers.get('User-Agent')
    });

    // BALANCED POS Session Token Authentication (Primary)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionToken = authHeader.substring(7);
      const authResult = verifyPOSSessionToken(sessionToken);

      if (authResult.success && authResult.shopDomain) {
        shopDomain = authResult.shopDomain;
        authType = "BALANCED_POS_SESSION_TOKEN";
        console.log("[POS Credit List API] ✅ BALANCED POS authentication successful, shop:", shopDomain);
      } else {
        console.error("[POS Credit List API] ❌ BALANCED POS authentication failed:", authResult.error);
        console.log("[POS Credit List API] Debug info:", authResult.debugInfo);
        return json(
          {
            success: false,
            error: authResult.error || "Authentication failed",
            debugInfo: authResult.debugInfo,
            credits: [],
            total: 0
          },
          { status: authResult.status || 401, headers }
        );
      }
    }

    // Admin Authentication Fallback (Secondary) - ONLY if no POS token provided
    if (!shopDomain && !authHeader) {
      try {
        const { session } = await authenticate.admin(request);
        if (session?.shop) {
          shopDomain = session.shop;
          authType = "ADMIN_SESSION_FALLBACK";
          console.log("[POS Credit List API] ✅ Admin fallback authenticated, shop:", shopDomain);
        }
      } catch (adminError) {
        console.warn("[POS Credit List API] ⚠️ Admin auth fallback failed:", adminError);
      }
    }

    // Final Authentication Validation
    if (!shopDomain) {
      console.error("[POS Credit List API] ❌ No valid authentication found");
      return json({
        success: false,
        error: "Authentication required - POS user lacks app permissions",
        data: [],
        total: 0,
        solutions: [
          "Step 1: In Shopify Admin → Settings → Users → Find your POS user",
          "Step 2: Click on the user → Apps tab → Enable 'CreditNote' app",
          "Step 3: Ensure user is logged in with EMAIL/PASSWORD (not just PIN)",
          "Step 4: Close and reopen POS app if still not working",
          "Note: Smart grid tiles require these specific permissions to function"
        ],
        debugInfo: {
          hasAuthHeader: !!authHeader,
          authHeaderFormat: authHeader ? 'Bearer ***' : 'Missing',
          locationId: locationId || 'Not provided',
          userAgent: request.headers.get('User-Agent')?.substring(0, 50) + '...'
        },
        metadata: {
          timestamp: new Date().toISOString(),
          authType: "NONE",
          status: 401
        }
      }, {
        status: 401,
        headers
      });
    }

    // Build search conditions - FIXED: Use both shopDomain AND shop field for compatibility
    const whereConditions: any = {
      OR: [
        { shopDomain: shopDomain },
        { shop: shopDomain }
      ],
      deletedAt: null  // Exclude soft-deleted records
    };

    if (search) {
      whereConditions.AND = [
        whereConditions.OR,
        {
          OR: [
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerEmail: { contains: search, mode: 'insensitive' } },
            { noteNumber: { contains: search, mode: 'insensitive' } },
          ]
        }
      ];
      delete whereConditions.OR; // Replace with AND structure
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
    console.log("[POS Credit List API] Authentication type:", authType);

    const responseData = {
      success: true,
      data: creditNotes,
      total,
      hasMore,
      pagination: {
        limit,
        offset,
        total,
        pages: Math.ceil(total / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      metadata: {
        shop: shopDomain,
        locationId,
        authType,
        timestamp: new Date().toISOString(),
        apiVersion: "2025-07"
      }
    };

    return json(responseData, { headers });

  } catch (error) {
    console.error("[POS Credit List API] ❌ Database query failed:", error);

    return json({
      success: false,
      error: "Database query failed",
      data: [],
      total: 0,
      debugInfo: {
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        status: 500
      }
    }, {
      status: 500,
      headers
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, HEAD",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
      "Access-Control-Max-Age": "86400"
    },
  });
}
