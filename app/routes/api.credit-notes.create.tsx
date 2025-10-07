// POS Extension API - Create credit note with QR code
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { db } from '../db.server';
import QRCode from 'qrcode';

export async function action({ request }: ActionFunctionArgs) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
  });

  try {
    // Authenticate using session token from POS extension
    const { admin, session } = await authenticate.admin(request);

    console.log('[POS API Create] Authenticated:', session.shop);

    const body = await request.json();
    const { customerName, customerEmail, amount, reason, createdBy } = body;

    if (!customerName || !amount) {
      return json({
        success: false,
        error: 'Customer name and amount are required',
      }, { status: 400, headers });
    }

    // Generate unique code
    const code = `CN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create credit note in database
    const creditNote = await db.creditNote.create({
      data: {
        shop: session.shop,
        code,
        customerName,
        customerEmail: customerEmail || null,
        amount,
        remainingAmount: amount,
        status: 'active',
        reason: reason || null,
        createdBy: createdBy || 'pos-extension',
        createdAt: new Date(),
      },
    });

    console.log('[POS API Create] Created credit note:', creditNote.code);

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(code, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    return json({
      success: true,
      creditNote,
      qrCode: qrCodeDataUrl,
    }, { headers });
  } catch (error: any) {
    console.error('[POS API Create] Error:', error);
    return json({
      success: false,
      error: error.message || 'Failed to create credit note',
    }, { status: 500, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
      'Access-Control-Max-Age': '86400',
    },
  });
}
