// POS Extension API - List credit notes
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { db } from '../db.server';

export async function action({ request }: ActionFunctionArgs) {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Shopify-Shop-Domain',
  });

  try {
    // Authenticate using session token from POS extension
    const { admin, session } = await authenticate.admin(request);

    console.log('[POS API List] Authenticated:', session.shop);

    const body = await request.json();
    const limit = body.limit || 100;

    // Query credit notes from database
    const creditNotes = await db.creditNote.findMany({
      where: {
        shop: session.shop,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    console.log('[POS API List] Found credit notes:', creditNotes.length);

    return json({
      success: true,
      creditNotes,
    }, { headers });
  } catch (error: any) {
    console.error('[POS API List] Error:', error);
    return json({
      success: false,
      error: error.message || 'Failed to fetch credit notes',
      creditNotes: [],
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
