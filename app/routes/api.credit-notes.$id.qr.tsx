// API endpoint for generating QR code for a credit note
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { db } from '../db.server';
import QRCode from 'qrcode';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
  });

  try {
    const { session } = await authenticate.admin(request);
    const { id } = params;

    if (!id) {
      return json({
        success: false,
        error: 'Credit note ID is required',
      }, { status: 400, headers });
    }

    // Find credit note
    const creditNote = await db.creditNote.findFirst({
      where: {
        id,
        OR: [
          { shop: session.shop },
          { shopDomain: session.shop },
        ],
      },
    });

    if (!creditNote) {
      return json({
        success: false,
        error: 'Credit note not found',
      }, { status: 404, headers });
    }

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(creditNote.qrCode || creditNote.id, {
      width: 300,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    // Update credit note with QR code image if not already set
    if (!creditNote.qrCodeImage) {
      await db.creditNote.update({
        where: { id },
        data: { qrCodeImage: qrCodeDataUrl },
      });
    }

    return json({
      success: true,
      qrCode: qrCodeDataUrl,
      code: creditNote.qrCode || creditNote.id,
    }, { headers });
  } catch (error: any) {
    console.error('[QR Code API] Error:', error);
    return json({
      success: false,
      error: error.message || 'Failed to generate QR code',
    }, { status: 500, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
      'Access-Control-Max-Age': '86400',
    },
  });
}
