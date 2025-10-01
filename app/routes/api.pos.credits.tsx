import { json, LoaderFunctionArgs } from "@remix-run/node";
import { extractSessionToken } from "../utils/session-token-validation.server";
import db from "../db.server";

/**
 * POS API ENDPOINT with Session Token Authentication (2025-07 Pattern)
 * Uses session token validation for POS UI Extensions
 * POS extensions send session tokens in Authorization header, not admin OAuth tokens
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[POS CREDITS API] 🚀 Processing POS request with session token validation (2025-07)");

  try {
    // Extract and validate session token from Authorization header
    const tokenResult = extractSessionToken(request);

    if (!tokenResult.success || !tokenResult.shop) {
      console.error("[POS CREDITS API] ❌ Session token validation failed:", tokenResult.error);
      return json({
        success: false,
        error: "Session token validation failed - POS authentication required",
        data: [],
        total: 0,
        solutions: [
          "Ensure POS device is connected to Shopify",
          "Verify app is installed and has POS extension access",
          "Check that session token is included in Authorization header",
          "Try closing and reopening the POS extension"
        ]
      }, {
        status: 401,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Access-Token",
        }
      });
    }

    const shop = tokenResult.shop;
    console.log(`[POS CREDITS API] ✅ Session token validated for shop: ${shop}`);

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search") || "";

    console.log("[POS Credits API] Querying credits for shop:", shop, "limit:", limit);

    // Use EXACT same query logic as admin interface for data consistency
    const whereConditions: any = {
      OR: [
        { shopDomain: shop },
        { shop: shop }
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
        shop: shop,
        authType: "pos-session-token",
        timestamp: new Date().toISOString(),
        apiVersion: "2025-07",
        dataSource: "pos-extension"
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