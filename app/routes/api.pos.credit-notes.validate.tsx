import { json, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { z } from 'zod';

const ValidateSchema = z.object({
  qrCode: z.string().min(1, 'QR code is required'),
  requestedAmount: z.number().positive().optional(),
});

// CORS headers for POS extensions
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

export async function action({ request }: ActionFunctionArgs) {
  console.log('[POS Validate API] Starting credit note validation with enhanced CORS...');

  try {
    let shopDomain: string | null = null;
    let locationId: string | null = null;

    // DUAL AUTH SUPPORT: Check for session token first (new method), fallback to headers (old method)
    const authHeader = request.headers.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // NEW SESSION TOKEN AUTHENTICATION
      console.log("[POS Validate API] Using session token authentication");
      const sessionToken = authHeader.replace("Bearer ", "");

      try {
        // Try Shopify session authentication first
        const modifiedRequest = new Request(request.url, {
          method: request.method,
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            'Authorization': authHeader,
          }),
          body: request.body,
        });

        const authResult = await authenticate.admin(modifiedRequest);
        shopDomain = authResult.session?.shop || null;
        console.log("[POS Validate API] Session auth successful, shop:", shopDomain);
      } catch (authError) {
        console.log("[POS Validate API] Session auth failed, trying fallback JWT decode");

        // Fallback: Try to decode JWT session token
        try {
          const tokenParts = sessionToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            if (payload.dest && payload.dest.includes('.myshopify.com')) {
              shopDomain = payload.dest;
              console.log("[POS Validate API] JWT fallback successful, shop:", shopDomain);
            }
          }
        } catch (fallbackError) {
          console.error("[POS Validate API] JWT fallback also failed:", fallbackError);
        }
      }
    } else {
      // LEGACY HEADER AUTHENTICATION (fallback for compatibility)
      console.log("[POS Validate API] Using legacy header authentication");
      shopDomain = request.headers.get('X-Shopify-Shop-Domain');
      locationId = request.headers.get('X-Shopify-Location-Id');
    }

    if (!shopDomain) {
      return json(
        {
          success: false,
          valid: false,
          error: "Missing shop domain",
          debug: "Requires either Bearer token authentication or X-Shopify-Shop-Domain header"
        },
        { status: 400, headers }
      );
    }

    const formData = await request.json();
    const validated = ValidateSchema.parse(formData);

    // Find credit note by QR code
    const creditNote = await db.creditNote.findFirst({
      where: {
        OR: [
          { qrCode: validated.qrCode },
          { noteNumber: validated.qrCode }
        ],
        shopDomain: shopDomain,
      },
      include: {
        redemptions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!creditNote) {
      return json({
        success: false,
        valid: false,
        error: 'Credit note not found'
      }, { headers });
    }

    // Check if credit note is expired
    if (creditNote.expiresAt && new Date() > creditNote.expiresAt) {
      return json({
        success: false,
        valid: false,
        error: 'Credit note has expired',
        data: creditNote
      }, { headers });
    }

    // Check if credit note has remaining balance
    if (Number(creditNote.remainingAmount) <= 0) {
      return json({
        success: false,
        valid: false,
        error: 'Credit note has been fully used',
        data: creditNote
      }, { headers });
    }

    // Check if requested amount is valid
    const remainingAmount = Number(creditNote.remainingAmount);
    if (validated.requestedAmount && validated.requestedAmount > remainingAmount) {
      return json({
        success: false,
        valid: false,
        error: `Insufficient credit balance. Available: $${remainingAmount.toFixed(2)}`,
        data: creditNote
      }, { headers });
    }

    // Update timestamp for tracking (using updatedAt since lastRedemptionAt doesn't exist)
    await db.creditNote.update({
      where: { id: creditNote.id },
      data: {
        updatedAt: new Date(),
        // Update status if needed
        status: creditNote.status === 'active' ? 'active' : creditNote.status
      }
    });

    return json({
      success: true,
      valid: true,
      data: {
        id: creditNote.id,
        noteNumber: creditNote.noteNumber,
        customerName: creditNote.customerName,
        customerEmail: creditNote.customerEmail,
        originalAmount: Number(creditNote.originalAmount),
        remainingAmount: Number(creditNote.remainingAmount),
        currency: creditNote.currency,
        status: creditNote.status,
        reason: creditNote.reason,
        createdAt: creditNote.createdAt,
        expiresAt: creditNote.expiresAt,
        updatedAt: creditNote.updatedAt,
      },
      usableAmount: remainingAmount,
      message: 'Credit note is valid and ready to use',
      metadata: {
        locationId,
        timestamp: new Date().toISOString(),
      }
    }, { headers });

  } catch (error) {
    console.error("[POS] Error validating credit note:", error);

    if (error instanceof z.ZodError) {
      return json({
        success: false,
        valid: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400, headers });
    }

    return json({
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }, { status: 500, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers
  });
}