// POS Extension API - Delete credit note by ID
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { db } from '../db.server';

export async function action({ request, params }: ActionFunctionArgs) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
  });

  if (request.method !== 'DELETE') {
    return json({
      success: false,
      error: 'Method not allowed',
    }, { status: 405, headers });
  }

  try {
    // Authenticate using session token from POS extension
    const { admin, session } = await authenticate.admin(request);

    console.log('[POS API Delete] Authenticated:', session.shop);

    const { id } = params;

    if (!id) {
      return json({
        success: false,
        error: 'Credit note ID is required',
      }, { status: 400, headers });
    }

    // Find credit note to ensure it exists and belongs to this shop
    const creditNote = await db.creditNote.findFirst({
      where: {
        id,
        shop: session.shop,
      },
    });

    if (!creditNote) {
      return json({
        success: false,
        error: 'Credit note not found',
      }, { status: 404, headers });
    }

    // Delete the credit note
    await db.creditNote.delete({
      where: {
        id,
      },
    });

    console.log('[POS API Delete] Deleted credit note:', creditNote.code);

    return json({
      success: true,
      message: 'Credit note deleted successfully',
    }, { headers });
  } catch (error: any) {
    console.error('[POS API Delete] Error:', error);
    return json({
      success: false,
      error: error.message || 'Failed to delete credit note',
    }, { status: 500, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
      'Access-Control-Max-Age': '86400',
    },
  });
}
