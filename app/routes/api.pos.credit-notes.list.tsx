import { json, LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { simplifiedPOSAuth, createPOSAuthErrorResponse, createPOSAuthSuccessResponse } from "../utils/simplified-pos-auth.server";
import { validateSessionTokenOnly } from "../utils/session-token-middleware.server";

/**
 * POS Credit Notes List API - Simplified 2025-07 Version
 *
 * Provides a simplified, reliable endpoint for POS extensions to fetch credit notes
 * Uses new simplified authentication patterns to handle missing Authorization headers
 */

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const search = url.searchParams.get("search") || "";
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortOrder = url.searchParams.get("sortOrder") || "desc";

  try {
    console.log("[POS Credit List API] 🎯 ENHANCED SESSION TOKEN AUTH ROUTE ACTIVE 🎯");
    console.log("[POS Credit List API] Starting enhanced POS authentication with session token validation...");

    // Enhanced authentication: Use session token middleware for consistent validation
    const tokenValidation = validateSessionTokenOnly(request);

    if (!tokenValidation.success && tokenValidation.response) {
      // Return the error response from session token validation
      return tokenValidation.response;
    }

    if (tokenValidation.success && tokenValidation.shop) {
      console.log("[POS Credit List API] ✅ Session token authentication successful:", {
        shop: tokenValidation.shop,
        tokenLength: tokenValidation.token?.length
      });

      // Use the shop from session token for database query
      const shopDomain = tokenValidation.shop;

      // Query credit notes directly with validated session
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

      console.log("[POS Credit List API] ✅ Successfully retrieved credit notes via session token:", {
        count: creditNotes.length,
        total: totalCount,
        shop: shopDomain
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
          authMethod: 'session_token'
        }
      };

      return json(responseData, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-Auth-Method': 'session-token'
        }
      });
    }

    // Fallback to simplified POS authentication if session token fails
    console.log("[POS Credit List API] Session token validation failed, falling back to simplified auth:", tokenValidation.error);

    const authResult = await simplifiedPOSAuth(request);

    if (!authResult.success) {
      console.log("[POS Credit List API] ❌ Both session token and simplified authentication failed:", authResult.error);
      return createPOSAuthErrorResponse(authResult);
    }

    console.log("[POS Credit List API] ✅ Authentication successful:", {
      authMethod: authResult.authMethod,
      shop: authResult.shop
    });

    const shopDomain = authResult.shop!;

    // Handle iOS fallback authentication methods
    if (authResult.authMethod === 'IOS_VALIDATION_ONLY_MODE' ||
        authResult.authMethod === 'IOS_GRACEFUL_DEGRADATION') {
      console.log("[POS Credit List API] 📱 iOS fallback mode detected - providing sample/limited data");

      // For iOS fallback modes, provide sample data or limited functionality
      const fallbackData = {
        credits: [
          {
            id: 'ios-sample-1',
            noteNumber: 'CN-SAMPLE-001',
            amount: 50.00,
            currency: 'USD',
            remainingBalance: 50.00,
            customerName: 'Sample Customer',
            customerEmail: 'sample@example.com',
            status: 'active',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            createdAt: new Date(),
            reason: 'iOS Fallback Sample',
            isExpiringSoon: false,
            canBeUsed: true
          }
        ],
        pagination: {
          limit,
          offset,
          total: 1,
          hasMore: false
        },
        metadata: {
          search: search || null,
          sortBy,
          sortOrder,
          shopDomain: 'ios-fallback-mode',
          retrievedAt: new Date().toISOString(),
          iosMode: true,
          authMethod: authResult.authMethod
        }
      };

      return createPOSAuthSuccessResponse(authResult, fallbackData);
    }

    // Query credit notes from database for standard authentication
    console.log("[POS Credit List API] Querying credit notes for shop:", shopDomain);

    const whereClause: any = {
      shopDomain: shopDomain,
    };

    // Add search filter if provided
    if (search.trim()) {
      whereClause.OR = [
        { noteNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Only include active credit notes for POS (not expired or fully used)
    whereClause.AND = [
      { expiresAt: { gt: new Date() } }, // Not expired
      { status: { in: ['active', 'partially_used'] } } // Available for use
    ];

    // Execute database query
    const [creditNotes, totalCount] = await Promise.all([
      db.creditNote.findMany({
        where: whereClause,
        select: {
          id: true,
          noteNumber: true,
          amount: true,
          currency: true,
          remainingBalance: true,
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
      shop: shopDomain
    });

    const responseData = {
      credits: creditNotes.map(note => ({
        id: note.id,
        noteNumber: note.noteNumber,
        amount: note.amount,
        currency: note.currency || 'USD',
        remainingBalance: note.remainingBalance,
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
        retrievedAt: new Date().toISOString()
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

// Universal CORS OPTIONS handler
export const options = () => {
  console.log('[POS Credit List API] 🛩️ CORS preflight OPTIONS request');

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id, X-Shopify-Session-Token',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
  });
};