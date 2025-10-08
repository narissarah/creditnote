// API route for individual credit note operations (GET, DELETE, UPDATE)
import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { authenticate, unauthenticated } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import {
  isPOSRequest,
  extractSessionToken,
  validatePOSSessionToken,
  getOrCreatePOSSession
} from '../utils/pos-auth.server';

// GET /api/credit-notes/:id - Get a single credit note
export async function loader({ request, params }: LoaderFunctionArgs) {
  const headers = new Headers();
  const isPOS = isPOSRequest(request);

  if (isPOS) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Shop-Domain');
  }

  let admin, session;

  // Detect if this is a POS extension request
  if (isPOS) {
    try {
      console.log('[API Credit Note] Detected POS extension request - using JWT validation');

      const sessionToken = extractSessionToken(request);
      if (!sessionToken) {
        throw new Error('No session token in Authorization header');
      }

      const posAuth = await validatePOSSessionToken(sessionToken);
      console.log('[API Credit Note] POS token validated for shop:', posAuth.shop);

      session = await getOrCreatePOSSession(posAuth.shop);
      const { admin: posAdmin } = await unauthenticated.admin(posAuth.shop);
      admin = posAdmin;

      console.log('[API Credit Note] ✅ POS authentication successful');
    } catch (error) {
      console.error('[API Credit Note] POS authentication failed:', error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'POS authentication failed'
      }, { status: 401, headers });
    }
  } else {
    try {
      console.log('[API Credit Note] Using standard admin authentication');
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;
    } catch (error) {
      console.error('[API Credit Note] Admin authentication failed:', error);
      return json({
        success: false,
        error: 'Authentication failed'
      }, { status: 401, headers });
    }
  }

  const { id } = params;
  if (!id) {
    return json({
      success: false,
      error: 'Credit note ID is required'
    }, { status: 400, headers });
  }

  try {
    const creditService = new CreditNoteService(session.shop, admin);
    const creditNote = await creditService.findById(id);

    if (!creditNote) {
      return json({
        success: false,
        error: 'Credit note not found'
      }, { status: 404, headers });
    }

    return json({
      success: true,
      data: creditNote
    }, { headers });
  } catch (error) {
    console.error('[API Credit Note] Error fetching credit note:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credit note'
    }, { status: 500, headers });
  }
}

// DELETE /api/credit-notes/:id - Delete a credit note
export async function action({ request, params }: LoaderFunctionArgs) {
  if (request.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  const headers = new Headers();
  const isPOS = isPOSRequest(request);

  if (isPOS) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Shopify-Shop-Domain');
  }

  let admin, session;

  // Detect if this is a POS extension request
  if (isPOS) {
    try {
      console.log('[API Credit Note Delete] Detected POS extension request - using JWT validation');

      const sessionToken = extractSessionToken(request);
      if (!sessionToken) {
        throw new Error('No session token in Authorization header');
      }

      const posAuth = await validatePOSSessionToken(sessionToken);
      console.log('[API Credit Note Delete] POS token validated for shop:', posAuth.shop);

      session = await getOrCreatePOSSession(posAuth.shop);
      const { admin: posAdmin } = await unauthenticated.admin(posAuth.shop);
      admin = posAdmin;

      console.log('[API Credit Note Delete] ✅ POS authentication successful');
    } catch (error) {
      console.error('[API Credit Note Delete] POS authentication failed:', error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'POS authentication failed'
      }, { status: 401, headers });
    }
  } else {
    try {
      console.log('[API Credit Note Delete] Using standard admin authentication');
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;
    } catch (error) {
      console.error('[API Credit Note Delete] Admin authentication failed:', error);
      return json({
        success: false,
        error: 'Authentication failed'
      }, { status: 401, headers });
    }
  }

  const { id } = params;
  if (!id) {
    return json({
      success: false,
      error: 'Credit note ID is required'
    }, { status: 400, headers });
  }

  try {
    const creditService = new CreditNoteService(session.shop, admin);

    // Check if credit note exists
    const creditNote = await creditService.findById(id);
    if (!creditNote) {
      return json({
        success: false,
        error: 'Credit note not found'
      }, { status: 404, headers });
    }

    console.log('[API Credit Note Delete] Deleting credit note:', id);

    // Delete the credit note (soft delete)
    await creditService.deleteCredit(id);

    // Update customer metafield with new balance
    const customerId = creditNote.customerId;
    if (customerId) {
      const newBalance = await creditService.getCustomerCreditBalance(customerId);

      await admin.graphql(`
        mutation updateCustomerMetafield($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer {
              id
              metafield(namespace: "creditcraft", key: "total_balance") {
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          input: {
            id: customerId,
            metafields: [{
              namespace: "creditcraft",
              key: "total_balance",
              value: newBalance.toString(),
              type: "number_decimal"
            }]
          }
        }
      });
    }

    console.log('[API Credit Note Delete] ✅ Credit note deleted successfully');

    return json({
      success: true,
      message: 'Credit note deleted successfully'
    }, { headers });
  } catch (error) {
    console.error('[API Credit Note Delete] Error deleting credit note:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete credit note'
    }, { status: 500, headers });
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain",
      "Access-Control-Max-Age": "86400",
    },
  });
}
