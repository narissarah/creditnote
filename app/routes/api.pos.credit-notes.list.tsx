import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  try {
    // Handle POS-specific authentication
    const shopDomain = request.headers.get('X-Shopify-Shop-Domain');
    const locationId = request.headers.get('X-Shopify-Location-Id');

    if (!shopDomain) {
      return json(
        { error: "Missing shop domain" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
          }
        }
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

    const response = {
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
        locationId,
        timestamp: new Date().toISOString(),
      }
    };

    return json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      }
    });

  } catch (error) {
    console.error("[POS] Error loading credit notes:", error);

    return json(
      {
        error: "Failed to load credit notes",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
    },
  });
}