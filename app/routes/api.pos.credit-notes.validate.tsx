import { json, ActionFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { z } from 'zod';

const ValidateSchema = z.object({
  qrCode: z.string().min(1, 'QR code is required'),
  requestedAmount: z.number().positive().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  // Set CORS headers for POS compatibility
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });

  try {
    // Get POS-specific headers
    const shopDomain = request.headers.get('X-Shopify-Shop-Domain');
    const locationId = request.headers.get('X-Shopify-Location-Id');

    if (!shopDomain) {
      return json(
        {
          success: false,
          valid: false,
          error: "Missing shop domain"
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
    },
  });
}