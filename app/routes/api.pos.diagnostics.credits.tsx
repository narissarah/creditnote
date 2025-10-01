import { json, LoaderFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { extractSessionToken } from "../utils/session-token-validation.server";

/**
 * POS Diagnostics Endpoint - Shows WHY credit notes aren't appearing
 */
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("[POS DIAGNOSTICS] Starting credit note diagnostic check...");

  try {
    // Extract session token
    const tokenResult = extractSessionToken(request);

    if (!tokenResult.success || !tokenResult.shop) {
      return json({
        success: false,
        error: "Authentication required",
        diagnostic: "No valid session token found"
      }, { status: 401 });
    }

    const shop = tokenResult.shop;
    console.log(`[POS DIAGNOSTICS] Checking credits for shop: ${shop}`);

    // Query 1: ALL credits for this shop (no filters)
    const allCredits = await db.creditNote.findMany({
      where: {
        OR: [
          { shopDomain: shop },
          { shop: shop }
        ],
        deletedAt: null
      },
      select: {
        id: true,
        noteNumber: true,
        status: true,
        expiresAt: true,
        originalAmount: true,
        remainingAmount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Query 2: Only active, non-expired credits (POS filter)
    const posVisibleCredits = await db.creditNote.findMany({
      where: {
        OR: [
          { shopDomain: shop },
          { shop: shop }
        ],
        deletedAt: null,
        expiresAt: { gt: new Date() },
        status: { in: ['active', 'partially_used'] }
      },
      select: {
        id: true,
        noteNumber: true,
        status: true,
        expiresAt: true
      }
    });

    // Analyze why credits are hidden
    const now = new Date();
    const analysis = allCredits.map(credit => {
      const isExpired = credit.expiresAt ? credit.expiresAt <= now : false;
      const hasValidStatus = ['active', 'partially_used'].includes(credit.status);
      const visibleInPOS = !isExpired && hasValidStatus;

      return {
        noteNumber: credit.noteNumber,
        status: credit.status,
        expiresAt: credit.expiresAt?.toISOString(),
        isExpired,
        hasValidStatus,
        visibleInPOS,
        reason: !visibleInPOS
          ? (isExpired ? 'EXPIRED' : 'INVALID_STATUS')
          : 'OK'
      };
    });

    const response = {
      success: true,
      shop,
      timestamp: new Date().toISOString(),
      summary: {
        totalCredits: allCredits.length,
        posVisibleCredits: posVisibleCredits.length,
        hiddenCredits: allCredits.length - posVisibleCredits.length
      },
      creditAnalysis: analysis,
      posFilters: {
        expiresAt: "Must be greater than current time",
        status: "Must be 'active' or 'partially_used'",
        currentTime: now.toISOString()
      },
      recommendations: analysis
        .filter(c => !c.visibleInPOS)
        .map(c => ({
          noteNumber: c.noteNumber,
          issue: c.reason,
          fix: c.reason === 'EXPIRED'
            ? 'Update expiresAt to a future date'
            : `Change status from '${c.status}' to 'active'`
        }))
    };

    return json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    console.error("[POS DIAGNOSTICS] Error:", error);

    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
