// API route for redeeming credit notes
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import { OfflineSyncService } from '../services/offlineSync.server';
import { z } from 'zod';

const RedeemSchema = z.object({
  creditNoteId: z.string().min(1, 'Credit note ID is required'),
  amount: z.number().positive('Amount must be positive'),
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  posDeviceId: z.string().optional(),
  staffId: z.string().optional(),
  staffName: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  
  // Offline sync fields
  operation: z.string().optional(),
  timestamp: z.string().optional(),
  deviceId: z.string().optional(),
});

export async function action({ request }: ActionFunctionArgs) {
  // Set CSP headers for POS compatibility first
  const headers = new Headers();
  const isPOSRequest = request.headers.get('X-POS-Request') === 'true' ||
                      request.headers.get('User-Agent')?.includes('Shopify POS');

  if (isPOSRequest) {
    headers.set('Content-Security-Policy',
      "default-src 'self' https://*.shopify.com https://*.shopifycdn.com https://cdn.shopify.com; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://*.shopifycdn.com https://cdn.shopify.com; " +
      "style-src 'self' 'unsafe-inline' https://*.shopify.com https://*.shopifycdn.com; " +
      "font-src 'self' https://*.shopify.com https://*.shopifycdn.com data:; " +
      "img-src 'self' https://*.shopify.com https://*.shopifycdn.com data: blob:; " +
      "connect-src 'self' https://*.shopify.com https://*.shopifycdn.com wss://*.shopify.com; " +
      "frame-src 'self' https://*.shopify.com; " +
      "worker-src 'self' blob:;"
    );
    headers.set('X-Frame-Options', 'ALLOWALL');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-POS-Request, X-Shopify-Access-Token');
  }

  // Handle authentication based on request type
  let admin, session;
  try {
    if (isPOSRequest) {
      // For POS requests, try session token authentication first, fallback to admin
      const sessionToken = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                          request.headers.get('X-Shopify-Access-Token');

      if (sessionToken) {
        // Use admin authentication with session token
        const authResult = await authenticate.admin(request);
        admin = authResult.admin;
        session = authResult.session;
      } else {
        // Fallback to standard admin authentication
        const authResult = await authenticate.admin(request);
        admin = authResult.admin;
        session = authResult.session;
      }
    } else {
      // Standard admin authentication for non-POS requests
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;
    }
  } catch (error) {
    console.error('Authentication failed:', error);
    return json({
      success: false,
      error: 'Authentication failed'
    }, { status: 401, headers });
  }

  try {
    const formData = await request.json();
    const validated = RedeemSchema.parse(formData);
    
    const creditService = new CreditNoteService(session.shop, admin);
    const isOfflineSync = request.headers.get('X-Offline-Sync') === 'true';
    
    // Find and validate credit note
    const creditNote = await creditService.findById(validated.creditNoteId);
    if (!creditNote) {
      return json({
        success: false,
        error: 'Credit note not found'
      }, { status: 404, headers });
    }
    
    // Validate redemption
    const validation = creditService.validateForRedemption(creditNote, validated.amount);
    if (!validation.isValid) {
      return json({
        success: false,
        error: validation.error
      }, { status: 400, headers });
    }
    
    // Begin transaction for atomic operations
    const result = await creditService.redeemCredit({
      creditNoteId: validated.creditNoteId,
      amount: validated.amount,
      orderId: validated.orderId,
      orderNumber: validated.orderNumber,
      posDeviceId: validated.posDeviceId,
      staffId: validated.staffId,
      staffName: validated.staffName,
      description: validated.description || `POS redemption - ${validated.amount}`,
      metadata: {
        ...validated.metadata,
        redemptionSource: isOfflineSync ? 'offline_sync' : 'direct',
        originalTimestamp: validated.timestamp,
        userAgent: request.headers.get('user-agent'),
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip'),
      }
    });
    
    // Update customer metafield with new balance
    try {
      const newBalance = await creditService.getCustomerCreditBalance(creditNote.customerId);
      
      await admin.graphql(`
        mutation updateCustomerBalance($input: CustomerInput!) {
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
            id: creditNote.customerId,
            metafields: [{
              namespace: "creditcraft",
              key: "total_balance",
              value: newBalance.toString(),
              type: "number_decimal"
            }, {
              namespace: "creditcraft", 
              key: "last_redemption",
              value: new Date().toISOString(),
              type: "date_time"
            }]
          }
        }
      });
      
    } catch (metafieldError) {
      console.warn('Failed to update customer metafield:', metafieldError);
      // Don't fail the redemption if metafield update fails
    }
    
    // Create order note if order ID provided
    if (validated.orderId && !isOfflineSync) {
      try {
        await admin.graphql(`
          mutation addOrderNote($id: ID!, $note: String!) {
            orderUpdate(input: {
              id: $id
              note: $note
            }) {
              order {
                id
                note
              }
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: {
            id: validated.orderId,
            note: `Store credit applied: ${creditNote.noteNumber} - $${validated.amount}`
          }
        });
      } catch (noteError) {
        console.warn('Failed to add order note:', noteError);
        // Don't fail redemption if note addition fails
      }
    }
    
    // If this was an offline sync, mark the sync item as processed
    if (isOfflineSync && validated.operation) {
      const syncService = new OfflineSyncService(session.shop);
      await syncService.markCompleted(validated.operation, result);
    }
    
    return json({
      success: true,
      data: {
        transaction: result.transaction,
        creditNote: result.updatedCreditNote,
        remainingAmount: result.updatedCreditNote.remainingAmount,
        newStatus: result.updatedCreditNote.status
      },
      message: `Successfully redeemed $${validated.amount} from credit note ${creditNote.noteNumber}`
    }, { headers });
    
  } catch (error) {
    console.error('Error redeeming credit note:', error);
    
    // If this was an offline sync, mark it as failed
    if (request.headers.get('X-Offline-Sync') === 'true' && formData.operation) {
      try {
        const syncService = new OfflineSyncService(session.shop);
        await syncService.markFailed(formData.operation, error.message);
      } catch (syncError) {
        console.error('Failed to mark sync item as failed:', syncError);
      }
    }
    
    if (error instanceof z.ZodError) {
      return json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400, headers });
    }
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Redemption failed'
    }, { status: 500, headers });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Shopify-Shop-Domain",
      "Access-Control-Max-Age": "86400",
    },
  });
}