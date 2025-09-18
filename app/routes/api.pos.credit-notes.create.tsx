import { json, ActionFunctionArgs } from "@remix-run/node";
import db from "../db.server";
import { z } from 'zod';
import { Prisma } from '@prisma/client';

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
          error: "Missing shop domain"
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain, X-Shopify-Location-Id",
    },
  });
}