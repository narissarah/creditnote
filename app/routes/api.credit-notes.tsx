// Main API route for credit note operations
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { authenticate } from '~/shopify.server';
import { CreditNoteService } from '~/services/creditNote.server';
import { QRCodeService } from '~/services/qrcode.server';
import { z } from 'zod';

// Validation schemas
const CreateCreditNoteSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  customerEmail: z.string().email('Valid email required').optional(),
  customerName: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('USD'),
  reason: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  originalOrderId: z.string().optional(),
  originalOrderNumber: z.string().optional(),
});

const SearchSchema = z.object({
  customerId: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['active', 'all', 'expired', 'used']).default('active'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  activeOnly: z.string().transform(val => val === 'true').default(false)
});

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const validated = SearchSchema.parse(searchParams);
    
    const creditService = new CreditNoteService(session.shop, admin);
    
    // Build filter options
    const filters = {
      customerId: validated.customerId,
      search: validated.search,
      limit: validated.limit,
      offset: validated.offset,
    };
    
    // Add status filters
    if (validated.activeOnly || validated.status === 'active') {
      filters.status = ['ACTIVE', 'PARTIALLY_USED'];
    } else if (validated.status === 'expired') {
      filters.status = ['EXPIRED'];
    } else if (validated.status === 'used') {
      filters.status = ['FULLY_USED'];
    }
    
    const result = await creditService.getCredits(filters);
    
    return json({
      success: true,
      credits: result.credits,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      message: `Found ${result.credits.length} credit notes`
    });
    
  } catch (error) {
    console.error('Error fetching credit notes:', error);
    
    return json({
      success: false,
      credits: [],
      totalCount: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credit notes'
    }, { status: 400 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  try {
    const formData = await request.json();
    const validated = CreateCreditNoteSchema.parse(formData);
    
    const creditService = new CreditNoteService(session.shop, admin);
    const qrService = new QRCodeService();
    
    // Validate customer exists
    const customerResponse = await admin.graphql(`
      query getCustomer($id: ID!) {
        customer(id: $id) {
          id
          email
          firstName
          lastName
          displayName
        }
      }
    `, {
      variables: { id: validated.customerId }
    });
    
    const customerData = await customerResponse.json();
    if (!customerData.data?.customer) {
      return json({
        success: false,
        error: 'Customer not found'
      }, { status: 404 });
    }
    
    const customer = customerData.data.customer;
    
    // Create credit note with QR code
    const creditData = {
      ...validated,
      customerEmail: validated.customerEmail || customer.email,
      customerName: validated.customerName || customer.displayName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
    };
    
    const creditNote = await creditService.createCreditNote(creditData);
    
    // Update customer metafield with credit balance
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
          id: validated.customerId,
          metafields: [{
            namespace: "creditcraft",
            key: "total_balance",
            value: (await creditService.getCustomerCreditBalance(validated.customerId)).toString(),
            type: "number_decimal"
          }]
        }
      }
    });
    
    return json({
      success: true,
      data: creditNote,
      message: `Credit note ${creditNote.noteNumber} created successfully`
    });
    
  } catch (error) {
    console.error('Error creating credit note:', error);
    
    if (error instanceof z.ZodError) {
      return json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400 });
    }
    
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create credit note'
    }, { status: 500 });
  }
}