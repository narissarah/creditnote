import { json, LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { simplifiedPOSAuth, createPOSAuthErrorResponse, createPOSAuthSuccessResponse } from "../utils/simplified-pos-auth.server";

/**
 * POS Credit Notes List API - iOS-Compatible 2025-07 Version
 *
 * Uses simplified POS authentication with comprehensive iOS fallback strategies
 * to handle cases where iOS POS doesn't send proper Authorization headers
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  try {
    console.log("[POS Credit List API] 🎯 iOS-COMPATIBLE AUTH ROUTE ACTIVE 🎯");
    console.log("[POS Credit List API] Starting simplified POS authentication with iOS fallbacks...");

    // CRITICAL FIX: Use simplifiedPOSAuth with comprehensive iOS fallback strategies
    // This handles cases where iOS POS doesn't send proper session tokens
    const authResult = await simplifiedPOSAuth(request);

    if (!authResult.success) {
      console.log("[POS Credit List API] ❌ Authentication failed:", authResult.error);
      return createPOSAuthErrorResponse(authResult);
    }

    console.log("[POS Credit List API] ✅ Authentication successful:", {
      authMethod: authResult.authMethod,
      shop: authResult.shop,
      isIOSFallback: authResult.authMethod.includes('IOS')
    });

    const shopDomain = authResult.shop!;

    // Handle iOS fallback authentication methods
    if (authResult.authMethod === 'IOS_VALIDATION_ONLY_MODE' ||
        authResult.authMethod === 'IOS_GRACEFUL_DEGRADATION') {
      console.log("[POS Credit List API] 📱 iOS fallback mode detected - providing limited data");

      // For iOS fallback modes, return empty list with helpful message
      const fallbackData = {
        credits: [],
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false
        },
        metadata: {
          search: search || null,
          sortBy,
          sortOrder,
          shopDomain: 'ios-fallback-mode',
          retrievedAt: new Date().toISOString(),
          authMethod: authResult.authMethod,
          iosMode: true,
          note: 'iOS fallback mode - Please ensure user is logged in with email/password (not PIN)'
        }
      };

      return createPOSAuthSuccessResponse(authResult, fallbackData);
    }

    // Standard authentication - query database
    console.log("[POS Credit List API] Querying credit notes for authenticated shop:", shopDomain);

    const whereClause: any = {
      OR: [
        { shopDomain: shopDomain },
        { shop: shopDomain }
      ],
      deletedAt: null
    };

    // Add search filter if provided
    if (search.trim()) {
      whereClause.AND = whereClause.AND || [];
      whereClause.AND.push({
        OR: [
          { noteNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
          { reason: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    // REMOVED RESTRICTIVE FILTERS - Show ALL credits like admin does
    // Previous filters were hiding credits that showed in admin:
    // - expiresAt: { gt: new Date() } // Hidden if expired
    // - status: { in: ['active', 'partially_used'] } // Hidden if redeemed/cancelled
    //
    // POS staff need to see ALL credits to manage them, not just active ones

    // Execute database query
    const [creditNotes, totalCount] = await Promise.all([
      db.creditNote.findMany({
        where: whereClause,
        select: {
          id: true,
          noteNumber: true,
          originalAmount: true,
          remainingAmount: true,
          currency: true,
          customerName: true,
          customerEmail: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          reason: true
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        take: Math.min(limit, 50), // Cap at 50 for performance
        skip: offset
      }),
      db.creditNote.count({ where: whereClause })
    ]);

    console.log("[POS Credit List API] ✅ Successfully retrieved credit notes:", {
      count: creditNotes.length,
      total: totalCount,
      shop: shopDomain,
      authMethod: authResult.authMethod
    });

    const responseData = {
      credits: creditNotes.map(note => ({
        id: note.id,
        noteNumber: note.noteNumber,
        amount: parseFloat(note.originalAmount.toString()),
        currency: note.currency || 'USD',
        remainingBalance: parseFloat(note.remainingAmount.toString()),
        customerName: note.customerName,
        customerEmail: note.customerEmail,
        status: note.status,
        expiresAt: note.expiresAt,
        createdAt: note.createdAt,
        reason: note.reason,
        // POS-specific computed fields
        isExpiringSoon: note.expiresAt && note.expiresAt < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        canBeUsed: note.status === 'active' || note.status === 'partially_used'
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + creditNotes.length < totalCount
      },
      metadata: {
        search: search || null,
        sortBy,
        sortOrder,
        shopDomain,
        retrievedAt: new Date().toISOString(),
        authMethod: authResult.authMethod
      }
    };

    return createPOSAuthSuccessResponse(authResult, responseData);

  } catch (error) {
    console.error("[POS Credit List API] ❌ Database or processing error:", error);

    return json({
      success: false,
      error: "Failed to retrieve credit notes",
      details: error instanceof Error ? error.message : "Unknown error",
      credits: [],
      pagination: { limit, offset, total: 0, hasMore: false }
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
      "Access-Control-Max-Age": "86400",
    },
  });
}
