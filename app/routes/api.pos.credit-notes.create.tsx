import { json, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { z } from 'zod';
import { Prisma } from '@prisma/client';

// CORS headers for POS extensions
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

const CreateCreditNoteSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  customerEmail: z.string().email('Valid email required'),
  customerName: z.string().min(1, 'Customer name is required'),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  reason: z.string().optional().default('POS Credit Note'),
  expiresInDays: z.number().positive().default(365),
});

function generateNoteNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CN-${year}-${randomSuffix}`;
}

function generateQRCode(noteNumber: string, amount: number, customerId: string, shopDomain: string): string {
  // Simple QR code format for POS - just the note number for now
  // In production, this could be a more complex JSON structure
  return noteNumber;
}

export async function action({ request }: ActionFunctionArgs) {
  console.log('[POS Create API] Starting credit note creation with enhanced CORS...');

  try {
    let shopDomain: string | null = null;
    let locationId: string | null = null;

    // DUAL AUTH SUPPORT: Check for session token first (new method), fallback to headers (old method)
    const authHeader = request.headers.get("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      // NEW SESSION TOKEN AUTHENTICATION
      console.log("[POS Create API] Using session token authentication");
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
        console.log("[POS Create API] Session auth successful, shop:", shopDomain);
      } catch (authError) {
        console.log("[POS Create API] Session auth failed, trying fallback JWT decode");

        // Fallback: Try to decode JWT session token
        try {
          const tokenParts = sessionToken.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
            if (payload.dest && payload.dest.includes('.myshopify.com')) {
              shopDomain = payload.dest;
              console.log("[POS Create API] JWT fallback successful, shop:", shopDomain);
            }
          }
        } catch (fallbackError) {
          console.error("[POS Create API] JWT fallback also failed:", fallbackError);
        }
      }
    } else {
      // LEGACY HEADER AUTHENTICATION (fallback for compatibility)
      console.log("[POS Create API] Using legacy header authentication");
      shopDomain = request.headers.get('X-Shopify-Shop-Domain');
      locationId = request.headers.get('X-Shopify-Location-Id');
    }

    if (!shopDomain) {
      return json(
        {
          success: false,
          error: "Missing shop domain",
          debug: "Requires either Bearer token authentication or X-Shopify-Shop-Domain header"
        },
        { status: 400, headers }
      );
    }

    const formData = await request.json();
    const validated = CreateCreditNoteSchema.parse(formData);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validated.expiresInDays);

    // Generate unique note number
    let noteNumber: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      noteNumber = generateNoteNumber();
      attempts++;

      // Check if note number already exists
      const existingNote = await db.creditNote.findUnique({
        where: { noteNumber }
      });

      if (!existingNote) break;

      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique note number');
      }
    } while (attempts < maxAttempts);

    // Generate QR code
    const qrCode = generateQRCode(noteNumber, validated.amount, validated.customerId, shopDomain);

    // Create credit note
    const creditNote = await db.creditNote.create({
      data: {
        customerId: validated.customerId,
        customerName: validated.customerName,
        customerEmail: validated.customerEmail,
        originalAmount: new Prisma.Decimal(validated.amount),
        remainingAmount: new Prisma.Decimal(validated.amount),
        currency: validated.currency,
        status: 'active',
        reason: validated.reason,
        noteNumber,
        qrCode,
        shopDomain,
        expiresAt,
        createdAt: new Date(),
      }
    });

    return json({
      success: true,
      data: {
        id: creditNote.id,
        noteNumber: creditNote.noteNumber,
        customerName: creditNote.customerName,
        customerEmail: creditNote.customerEmail,
        amount: Number(creditNote.originalAmount),
        remainingAmount: Number(creditNote.remainingAmount),
        currency: creditNote.currency,
        status: creditNote.status,
        reason: creditNote.reason,
        qrCode: creditNote.qrCode,
        expiresAt: creditNote.expiresAt,
        createdAt: creditNote.createdAt,
      },
      message: `Credit note ${noteNumber} created successfully`,
      metadata: {
        locationId,
        timestamp: new Date().toISOString(),
      }
    }, { headers });

  } catch (error) {
    console.error("[POS] Error creating credit note:", error);

    if (error instanceof z.ZodError) {
      return json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400, headers });
    }

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create credit note'
    }, { status: 500, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers
  });
}