import { json, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { verifyPOSSessionToken } from "../utils/pos-auth-balanced.server";
import { validateAuthorizationHeader, createAuthHeaderErrorResponse } from "../utils/auth-header-validation.server";
import { validateAndExchangeSessionToken, refreshSessionTokenIfNeeded, getTokenLifecycleInfo } from "../utils/session-token-exchange.server";
import { recoverPosSessionToken, createPosRecoveryResponse, isPosExtensionRequest, isIOSPosDevice } from "../utils/pos-session-token-recovery.server";

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

    // ENHANCED SESSION TOKEN VALIDATION WITH EXCHANGE PATTERNS (Primary)
    console.log("[POS Credit List API] Using enhanced session token validation and exchange...");
    const tokenExchangeResult = validateAndExchangeSessionToken(request);

    if (tokenExchangeResult.success && tokenExchangeResult.shopDomain) {
      shopDomain = tokenExchangeResult.shopDomain;
      authType = "ENHANCED_SESSION_TOKEN_EXCHANGE";

      // Check if token needs refresh and handle proactively
      const refreshResult = await refreshSessionTokenIfNeeded(tokenExchangeResult.token!, request);

      console.log("[POS Credit List API] ✅ Enhanced authentication successful", {
        shop: shopDomain,
        userId: tokenExchangeResult.userId,
        expiresAt: tokenExchangeResult.expiresAt,
        refreshNeeded: refreshResult.refreshNeeded,
        authMethod: tokenExchangeResult.debugInfo?.validationMethod
      });

      // If refresh is needed, include guidance in response metadata
      if (refreshResult.refreshNeeded) {
        console.log("[POS Credit List API] ⚠️ Token refresh recommended for optimal performance");
      }

    } else {
      console.error("[POS Credit List API] ❌ Enhanced authentication failed:", tokenExchangeResult.error);

      // Fallback to legacy validation for compatibility
      console.log("[POS Credit List API] Attempting legacy validation fallback...");

      const headerValidation = validateAuthorizationHeader(request);
      if (!headerValidation.valid) {
        console.error("[POS Credit List API] ❌ Legacy validation also failed:", headerValidation.error);
        const errorResponse = createAuthHeaderErrorResponse(headerValidation, {
          endpoint: '/api/pos/credit-notes/list',
          method: 'GET',
          timestamp: new Date().toISOString(),
          enhancedValidationError: tokenExchangeResult.error
        });
        return json(errorResponse, { status: 401, headers });
      }

      const sessionToken = headerValidation.token!;
      const authResult = verifyPOSSessionToken(sessionToken, request);

      if (authResult.success && authResult.shopDomain) {
        shopDomain = authResult.shopDomain;
        authType = "LEGACY_FALLBACK_VALIDATION";
        console.log("[POS Credit List API] ✅ Legacy fallback authentication successful, shop:", shopDomain);
      } else {
        console.error("[POS Credit List API] ❌ Both enhanced and legacy authentication failed:", authResult.error);
        console.log("[POS Credit List API] Debug info:", authResult.debugInfo);
      return json(
        {
          success: false,
          error: authResult.error || "Authentication failed",
          debugInfo: authResult.debugInfo,
          headerValidation: headerValidation.diagnostics,
          credits: [],
          total: 0
        },
        { status: authResult.status || 401, headers }
      );
    }

    // ENHANCED: Comprehensive POS Extension Authentication Recovery for iOS devices
    if (!shopDomain) {
      // Use enhanced POS extension detection
      const isPOSExtension = isPosExtensionRequest(request);
      const isIOSDevice = isIOSPosDevice(request);

      // Enhanced diagnostic headers from POS API client
      const isIOSTokenFallback = request.headers.get('X-POS-Token-Fallback') === 'true';
      const posDeviceType = request.headers.get('X-POS-Device-Type');
      const iosTokenFailed = request.headers.get('X-iOS-Token-Failed');
      const posAuthAttempt = request.headers.get('X-POS-Auth-Attempt');

      if (isPOSExtension) {
        console.log("[POS Credit List API] 🔄 Initiating comprehensive POS session token recovery...");
        console.log("[POS Credit List API] Enhanced device and context analysis:", {
          isIOSDevice,
          posDeviceType,
          isIOSTokenFallback,
          iosTokenFailed,
          posAuthAttempt,
          userAgent: request.headers.get('User-Agent')?.substring(0, 100),
          origin: request.headers.get('Origin'),
          hasEnhancedHeaders: isIOSTokenFallback
        });

        // COMPREHENSIVE: Use new POS session token recovery system
        const recoveryResult = recoverPosSessionToken(request, {
          shop: url.searchParams.get('shop') || '',
          locationId,
          deviceType: isIOSDevice ? 'iOS' : 'Unknown',
          userAgent: request.headers.get('User-Agent') || '',
          origin: request.headers.get('Origin') || ''
        });

        if (recoveryResult.success && recoveryResult.shopDomain) {
          shopDomain = recoveryResult.shopDomain;
          authType = `COMPREHENSIVE_POS_RECOVERY_${recoveryResult.fallbackStrategy}`;

          console.log("[POS Credit List API] ✅ Comprehensive POS recovery successful:", {
            shop: shopDomain,
            authType,
            fallbackStrategy: recoveryResult.fallbackStrategy,
            isIOSDevice,
            recoveryContext: recoveryResult.debugInfo
          });
        } else {
          console.error("[POS Credit List API] ❌ Comprehensive POS recovery failed:", recoveryResult.error);

          // Return enhanced recovery failure response
          const recoveryResponse = createPosRecoveryResponse(recoveryResult, locationId, {
            isIOSTokenFallback,
            posDeviceType,
            iosTokenFailed,
            posAuthAttempt,
            apiEndpoint: '/api/pos/credit-notes/list',
            enhancedDiagnostics: 'ENABLED'
          });

          return json(recoveryResponse, {
            status: 401,
            headers
          });
        }
      } else {
        // For non-POS requests, try admin authentication
        try {
          console.log("[POS Credit List API] Attempting admin authentication fallback...");
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
    }

    // Final Authentication Validation
    if (!shopDomain) {
      console.error("[POS Credit List API] ❌ No valid authentication found");

      // Enhanced diagnostic information
      const origin = request.headers.get('Origin');
      const userAgent = request.headers.get('User-Agent');
      const isPOSExtension = origin?.includes('extensions.shopifycdn.com') ||
                            userAgent?.includes('Shopify POS') ||
                            userAgent?.includes('ExtensibilityHost');

      console.error("[POS Credit List API] Enhanced diagnostics:", {
        hasAuthHeader: !!request.headers.get('Authorization'),
        isPOSExtension,
        origin,
        userAgent: userAgent?.substring(0, 100),
        hasShopParam: !!new URL(request.url).searchParams.get('shop'),
        detectedPlatform: isPOSExtension ? 'POS_EXTENSION' : 'UNKNOWN'
      });

      const errorMessage = isPOSExtension
        ? "CRITICAL: Enhanced POS Extension Session Token Missing - Enhanced 2025-07 authentication failed"
        : "Authentication required - No valid session token found";

      const solutions = isPOSExtension ? [
        "🚨 IMMEDIATE ACTION REQUIRED FOR POS USER (Enhanced 2025-07):",
        "Step 1: In Shopify Admin → Settings → Users & permissions → Staff accounts",
        "Step 2: Find the POS user who is experiencing this issue",
        "Step 3: Click on the user → Apps tab → Enable 'CreditNote' app permissions",
        "Step 4: CRITICAL: User must be logged into POS with EMAIL/PASSWORD (NOT PIN-only)",
        "Step 5: Verify POS app version is 10.6.0+ (check POS settings)",
        "Step 6: Remove and re-add the Smart Grid tile in POS",
        "Step 7: Clear POS app cache and restart the device",
        "Step 8: Try different WiFi network if network issues suspected",
        "Step 9: If URL changed recently, extension may need re-deployment",
        "📞 Contact support if issue persists after completing all steps"
      ] : [
        "Step 1: Ensure you are accessing through Shopify Admin",
        "Step 2: Check that your session is valid and not expired",
        "Step 3: Try refreshing the page or re-authenticating"
      ];

      return json({
        success: false,
        error: errorMessage,
        data: [],
        total: 0,
        solutions,
        diagnostics: {
          platform: isPOSExtension ? 'POS_EXTENSION_ENHANCED_2025_07' : 'UNKNOWN',
          hasAuthHeader: !!request.headers.get('Authorization'),
          enhancedFallbackSupported: isPOSExtension,
          isIOSTokenFallback,
          posDeviceType,
          iosTokenFailed,
          posAuthAttempt,
          userAgent: userAgent?.substring(0, 100),
          origin,
          timestamp: new Date().toISOString(),
          troubleshootingLevel: 'CRITICAL_ENHANCED'
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

    // Enhanced metadata with token lifecycle information
    let enhancedMetadata: any = {
      shop: shopDomain,
      locationId,
      authType,
      timestamp: new Date().toISOString(),
      apiVersion: "2025-07"
    };

    // Add token lifecycle information if using enhanced authentication
    if (authType === "ENHANCED_SESSION_TOKEN_EXCHANGE" && tokenExchangeResult?.token) {
      const lifecycleInfo = getTokenLifecycleInfo(tokenExchangeResult.token);
      enhancedMetadata.tokenLifecycle = {
        status: lifecycleInfo.status,
        expiresIn: lifecycleInfo.expiresIn,
        refreshRecommended: lifecycleInfo.refreshRecommended,
        expiresAt: tokenExchangeResult.expiresAt
      };

      // Add refresh guidance if needed
      if (lifecycleInfo.refreshRecommended) {
        enhancedMetadata.refreshGuidance = {
          action: 'RECOMMEND_REFRESH',
          reason: lifecycleInfo.status === 'NEAR_EXPIRY' ? 'Token expires soon' : 'Token expired',
          method: 'Use sessionApi.getSessionToken() to get new token',
          bounceUrl: '/session-token-bounce'
        };
      }
    }

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
      metadata: enhancedMetadata
    };

    return json(responseData, { headers });
  }

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
