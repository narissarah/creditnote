import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
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

  try {
    console.log("[POS Credits API] Processing request...");

    // Extract authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[POS Credits API] Missing or invalid Authorization header");
      return json(
        {
          success: false,
          error: "Missing authorization token",
          debug: "Authorization header required with Bearer token"
        },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          }
        }
      );
    }

    const sessionToken = authHeader.replace("Bearer ", "");
    console.log("[POS Credits API] Session token received, length:", sessionToken.length);

    // Authenticate using the session token
    let session;
    try {
      // Create a new request with the Bearer token in the proper format
      const modifiedRequest = new Request(request.url, {
        method: request.method,
        headers: new Headers({
          ...Object.fromEntries(request.headers.entries()),
          'Authorization': authHeader,
        }),
        body: request.body,
      });

      const authResult = await authenticate.admin(modifiedRequest);
      session = authResult.session;
      console.log("[POS Credits API] Session authenticated successfully, shop:", session?.shop);
    } catch (authError) {
      console.error("[POS Credits API] Authentication failed:", authError);

      // Fallback: Try to validate session token manually
      try {
        // Extract shop from session token if possible (simplified approach)
        const tokenParts = sessionToken.split('.');
        if (tokenParts.length === 3) {
          // This is a JWT-like token, try to decode payload
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          if (payload.dest && payload.dest.includes('.myshopify.com')) {
            session = { shop: payload.dest };
            console.log("[POS Credits API] Fallback authentication successful, shop:", session.shop);
          }
        }
      } catch (fallbackError) {
        console.error("[POS Credits API] Fallback authentication also failed:", fallbackError);
      }

      if (!session) {
        return json(
          {
            success: false,
            error: "Invalid session token",
            debug: "Session authentication failed"
          },
          {
            status: 401,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            }
          }
        );
      }
    }

    if (!session?.shop) {
      console.error("[POS Credits API] No shop in session");
      return json(
        {
          success: false,
          error: "Invalid session - no shop context",
          debug: "Session exists but no shop context available"
        },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          }
        }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search") || "";

    console.log("[POS Credits API] Querying credits for shop:", session.shop, "limit:", limit);

    // Use the exact same query logic as admin interface
    const whereConditions: any = {
      shopDomain: session.shop,
      deletedAt: null
    };

    if (search) {
      whereConditions.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { noteNumber: { contains: search, mode: 'insensitive' } },
      ];
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
        timestamp: new Date().toISOString(),
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
    console.error("[POS Credits API] Unexpected error:", error);

    return json(
      {
        success: false,
        error: "Internal server error",
        debug: error instanceof Error ? error.message : "Unknown error",
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      }
    );
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