import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * CLEAN POS API ENDPOINT with Admin Authentication (2025-07 Pattern)
 * Removes complex session token fallbacks that were causing issues
 * Uses pure admin authentication for data consistency with admin interface
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[POS CREDITS API] 🚀 Processing request with admin authentication (2025-07)");

  try {
    // Use clean admin authentication (2025-07 best practice)
    const { session } = await authenticate.admin(request);

    if (!session?.shop) {
      console.error("[POS CREDITS API] ❌ Authentication failed - no shop in session");
      return json({
        success: false,
        error: "Authentication required - admin session not found",
        data: [],
        total: 0,
        solutions: [
          "Ensure user is logged into Shopify admin",
          "Verify app permissions are properly configured",
          "Check that the app is installed for this shop",
          "Ensure POS user has app access permissions"
        ]
      }, {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    console.log(`[POS CREDITS API] ✅ Admin authentication successful for shop: ${session.shop}`);

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search") || "";

    console.log("[POS Credits API] Querying credits for shop:", session.shop, "limit:", limit);

    // Use EXACT same query logic as admin interface for data consistency
    const whereConditions: any = {
      OR: [
        { shopDomain: session.shop },
        { shop: session.shop }
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

    const [credits, totalCount] = await Promise.all([
      db.creditNote.findMany({
        where: whereConditions,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
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
      }),
      db.creditNote.count({
        where: whereConditions,
      })
    ]);

    console.log("[POS Credits API] Found", credits.length, "credits, total:", totalCount);

    const serializedCredits = credits.map(credit => ({
      id: credit.id,
      noteNumber: credit.noteNumber,
      customerName: credit.customerName || "",
      customerEmail: credit.customerEmail || "",
      originalAmount: credit.originalAmount.toString(),
      remainingAmount: credit.remainingAmount.toString(),
      currency: credit.currency,
      status: credit.status,
      reason: credit.reason || "",
      createdAt: credit.createdAt.toISOString(),
      updatedAt: credit.updatedAt.toISOString(),
      expiresAt: credit.expiresAt?.toISOString() || null,
    }));

    const response = {
      success: true,
      data: serializedCredits,
      total: totalCount,
      hasMore: offset + limit < totalCount,
      pagination: {
        limit,
        offset,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: Math.floor(offset / limit) + 1,
      },
      metadata: {
        shop: session.shop,
        authType: "admin-authenticated",
        timestamp: new Date().toISOString(),
        apiVersion: "2025-07",
        dataSource: "admin-consistent"
      }
    };

    return json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (error) {
    console.error("[POS CREDITS API] ❌ Critical error:", error);

    // Handle authentication errors specifically (2025-07 pattern)
    if (error && typeof error === 'object' && 'status' in error) {
      return json({
        success: false,
        error: "Authentication failed - please ensure proper app installation",
        data: [],
        total: 0,
        debugInfo: {
          errorType: "AUTHENTICATION_ERROR",
          timestamp: new Date().toISOString()
        }
      }, {
        status: (error as any).status || 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    return json({
      success: false,
      error: "Internal server error",
      data: [],
      total: 0,
      debugInfo: {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        errorType: "SERVER_ERROR"
      }
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}