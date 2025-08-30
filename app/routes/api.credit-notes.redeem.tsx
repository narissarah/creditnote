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
  const { admin, session } = await authenticate.admin(request);
  
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
      }, { status: 404 });
    }
    
    // Validate redemption
    const validation = creditService.validateForRedemption(creditNote, validated.amount);
    if (!validation.isValid) {
      return json({
        success: false,
        error: validation.error
      }, { status: 400 });
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
    });
    
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
      }, { status: 400 });
    }
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Redemption failed'
    }, { status: 500 });
  }
}