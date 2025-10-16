// Main API route for credit note operations
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { authenticate, unauthenticated } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import { QRCodeService } from '../services/qrcode.server';
import { z } from 'zod';
import {
  isPOSRequest,
  extractSessionToken,
  validatePOSSessionToken,
  getOrCreatePOSSession,
  exchangeSessionTokenForAccessToken
} from '../utils/pos-auth.server';

// Validation schemas
const CreateCreditNoteSchema = z.object({
  // Authentication fields (for POS requests)
  sessionToken: z.string().optional(),
  shopDomain: z.string().optional(),
  isPOSRequest: z.boolean().optional(),

  // Credit note fields
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

// Handle CORS preflight requests
// CRITICAL: OPTIONS requests must return immediately without authentication
export async function options({ request }: LoaderFunctionArgs) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = [
    'https://cdn.shopify.com',
    'https://extensions.shopifycdn.com',
    'https://shopify.com'
  ];

  console.log('[OPTIONS] Handling CORS preflight from:', origin);

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POS-Request, X-Shopify-Shop-Domain, X-Shopify-Access-Token',
      'Access-Control-Max-Age': '7200',
      'Vary': 'Origin',
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  // CRITICAL: Handle OPTIONS (CORS preflight) FIRST before any authentication
  // Remix may route OPTIONS to loader instead of options() handler
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://cdn.shopify.com',
      'https://extensions.shopifycdn.com',
      'https://shopify.com'
    ];

    console.log('[LOADER OPTIONS] Handling CORS preflight from:', origin);

    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POS-Request, X-Shopify-Shop-Domain, X-Shopify-Access-Token',
        'Access-Control-Max-Age': '7200',
        'Vary': 'Origin',
      },
    });
  }

  // Get origin from request
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://cdn.shopify.com', 'https://extensions.shopifycdn.com'];

  // Set CORS headers for POS requests, wildcard for others
  const headers = new Headers({
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POS-Request, X-Shopify-Shop-Domain, X-Shopify-Access-Token',
    'Vary': 'Origin',
  });

  const isFromPOS = isPOSRequest(request);

  if (isFromPOS) {
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

  // ENHANCED: Support both admin and POS extension authentication
  let admin, session;

  // Detect if this is a POS extension request
  if (isFromPOS) {
    try {
      console.log('[API Credit Notes] Detected POS extension request - using JWT validation');

      // Extract and validate the session token from Authorization header
      const sessionToken = extractSessionToken(request);
      if (!sessionToken) {
        throw new Error('No session token in Authorization header');
      }

      const posAuth = await validatePOSSessionToken(sessionToken);
      console.log('[API Credit Notes] POS token validated for shop:', posAuth.shop);

      // Get the offline session for this shop (for database operations)
      session = await getOrCreatePOSSession(posAuth.shop);

      // CRITICAL FIX: Exchange session token for online access token
      // POS extensions need online tokens with user context for Admin API requests
      const accessToken = await exchangeSessionTokenForAccessToken(sessionToken, posAuth.shop);

      // Create authenticated GraphQL client wrapper using the exchanged access token
      admin = {
        graphql: async (query: string, options?: any) => {
          const apiVersion = '2025-07';

          console.log('[GraphQL Request] Shop:', posAuth.shop);
          console.log('[GraphQL Request] API Version:', apiVersion);
          console.log('[GraphQL Request] Access Token:', accessToken ? `${accessToken.substring(0, 15)}...` : 'MISSING');
          console.log('[GraphQL Request] Query:', query.substring(0, 100));

          const response = await fetch(
            `https://${posAuth.shop}/admin/api/${apiVersion}/graphql.json`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
              },
              body: JSON.stringify({
                query,
                variables: options?.variables || {},
              }),
            }
          );

          console.log('[GraphQL Response] Status:', response.status, response.statusText);
          console.log('[GraphQL Response] Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

          // Read response body for detailed error logging
          const responseText = await response.text();
          console.log('[GraphQL Response] Body:', responseText);

          if (!response.ok) {
            console.error('[GraphQL Error] Full response:', {
              status: response.status,
              statusText: response.statusText,
              body: responseText,
              accessTokenPrefix: accessToken?.substring(0, 6),
            });
            throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} - ${responseText}`);
          }

          // Parse the response and check for GraphQL errors
          let jsonData;
          try {
            jsonData = JSON.parse(responseText);
          } catch (e) {
            console.error('[GraphQL Error] Failed to parse response as JSON');
            throw new Error(`Invalid JSON response: ${responseText}`);
          }

          if (jsonData.errors) {
            console.error('[GraphQL Errors]:', JSON.stringify(jsonData.errors, null, 2));
            throw new Error(`GraphQL errors: ${JSON.stringify(jsonData.errors)}`);
          }

          // Return a response-like object with json() method
          return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            json: async () => jsonData,
          };
        }
      };

      console.log('[API Credit Notes] ✅ POS authentication successful for shop:', session?.shop);
      console.log('[API Credit Notes] Using exchanged access token for GraphQL requests');
    } catch (error) {
      console.error('[API Credit Notes] POS authentication failed:', error);
      return json({
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'POS authentication failed'
      }, { status: 401, headers });
    }
  } else {
    // Standard admin authentication for embedded app requests
    try {
      console.log('[API Credit Notes] Using standard admin authentication');
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;

      console.log('[API Credit Notes] ✅ Admin authentication successful for shop:', session?.shop);
    } catch (error) {
      console.error('[API Credit Notes] Admin authentication failed:', error);
      return json({
        success: false,
        data: [],
        error: 'Authentication failed - please refresh the page'
      }, { status: 401, headers });
    }
  }

  try {
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);

    // Convert string parameters to proper types before validation
    const parsedParams = {
      ...searchParams,
      limit: searchParams.limit ? Number(searchParams.limit) : undefined,
      offset: searchParams.offset ? Number(searchParams.offset) : undefined,
    };

    const validated = SearchSchema.parse(parsedParams);
    
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
      filters.status = ['active', 'partially_used'];
    } else if (validated.status === 'expired') {
      filters.status = ['expired'];
    } else if (validated.status === 'used') {
      filters.status = ['fully_used'];
    }
    
    const result = await creditService.getCredits(filters);
    
    return json({
      success: true,
      credits: result.credits,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      message: `Found ${result.credits.length} credit notes`
    }, { headers });
    
  } catch (error) {
    console.error('Error fetching credit notes:', error);
    
    return json({
      success: false,
      credits: [],
      totalCount: 0,
      hasMore: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credit notes'
    }, { status: 400, headers });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // CRITICAL: Handle OPTIONS (CORS preflight) FIRST before any authentication
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [
      'https://cdn.shopify.com',
      'https://extensions.shopifycdn.com',
      'https://shopify.com'
    ];

    console.log('[ACTION OPTIONS] Handling CORS preflight from:', origin);

    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POS-Request, X-Shopify-Shop-Domain, X-Shopify-Access-Token',
        'Access-Control-Max-Age': '7200',
        'Vary': 'Origin',
      },
    });
  }

  // Get origin from request
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://cdn.shopify.com', 'https://extensions.shopifycdn.com'];

  // Set CORS headers for POS requests, wildcard for others
  const headers = new Headers({
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POS-Request, X-Shopify-Shop-Domain, X-Shopify-Access-Token',
    'Vary': 'Origin',
  });

  // Parse request body to check for POS authentication data
  const formData = await request.json();
  const isPOSFromBody = formData.isPOSRequest === true;
  const isFromPOS = isPOSRequest(request) || isPOSFromBody;

  if (isFromPOS || isPOSFromBody) {
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

  // ENHANCED: Support both admin and POS extension authentication
  let admin, session;

  // Detect if this is a POS extension request
  if (isFromPOS || isPOSFromBody) {
    try {
      console.log('[API Credit Notes Action] Detected POS extension request - using JWT validation');

      // Extract session token from body (POS cannot send custom headers)
      let sessionToken = formData.sessionToken;
      let shopDomain = formData.shopDomain;

      // Fallback to header-based extraction for backwards compatibility
      if (!sessionToken) {
        sessionToken = extractSessionToken(request);
      }

      if (!sessionToken) {
        throw new Error('No session token provided (checked body and headers)');
      }

      console.log('[API Credit Notes Action] Session token source:', formData.sessionToken ? 'body' : 'header');
      console.log('[API Credit Notes Action] Shop domain:', shopDomain);

      const posAuth = await validatePOSSessionToken(sessionToken);
      console.log('[API Credit Notes Action] POS token validated for shop:', posAuth.shop);

      // Use shop from token if not provided in body
      if (!shopDomain) {
        shopDomain = posAuth.shop;
      }

      // Get the offline session for this shop (for database operations)
      session = await getOrCreatePOSSession(shopDomain);

      // CRITICAL FIX: Exchange session token for online access token
      // POS extensions need online tokens with user context for Admin API requests
      const accessToken = await exchangeSessionTokenForAccessToken(sessionToken, shopDomain);

      // Create authenticated GraphQL client wrapper using the exchanged access token
      admin = {
        graphql: async (query: string, options?: any) => {
          const apiVersion = '2025-07';

          console.log('[GraphQL Request Action] Shop:', shopDomain);
          console.log('[GraphQL Request Action] API Version:', apiVersion);
          console.log('[GraphQL Request Action] Access Token:', accessToken ? `${accessToken.substring(0, 15)}...` : 'MISSING');
          console.log('[GraphQL Request Action] Query:', query.substring(0, 100));

          const response = await fetch(
            `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
              },
              body: JSON.stringify({
                query,
                variables: options?.variables || {},
              }),
            }
          );

          console.log('[GraphQL Response Action] Status:', response.status, response.statusText);
          console.log('[GraphQL Response Action] Headers:', JSON.stringify(Object.fromEntries(response.headers.entries())));

          // Read response body for detailed error logging
          const responseText = await response.text();
          console.log('[GraphQL Response Action] Body:', responseText);

          if (!response.ok) {
            console.error('[GraphQL Error Action] Full response:', {
              status: response.status,
              statusText: response.statusText,
              body: responseText,
              accessTokenPrefix: accessToken?.substring(0, 6),
            });
            throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} - ${responseText}`);
          }

          // Parse the response and check for GraphQL errors
          let jsonData;
          try {
            jsonData = JSON.parse(responseText);
          } catch (e) {
            console.error('[GraphQL Error Action] Failed to parse response as JSON');
            throw new Error(`Invalid JSON response: ${responseText}`);
          }

          if (jsonData.errors) {
            console.error('[GraphQL Errors Action]:', JSON.stringify(jsonData.errors, null, 2));
            throw new Error(`GraphQL errors: ${JSON.stringify(jsonData.errors)}`);
          }

          // Return a response-like object with json() method
          return {
            ok: true,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            json: async () => jsonData,
          };
        }
      };

      console.log('[API Credit Notes Action] ✅ POS authentication successful for shop:', session?.shop);
      console.log('[API Credit Notes Action] Using exchanged access token for GraphQL requests');
    } catch (error) {
      console.error('[API Credit Notes Action] POS authentication failed:', error);
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'POS authentication failed'
      }, { status: 401, headers });
    }
  } else {
    // Standard admin authentication for embedded app requests
    try {
      console.log('[API Credit Notes Action] Using standard admin authentication');
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;

      console.log('[API Credit Notes Action] ✅ Admin authentication successful for shop:', session?.shop);
    } catch (error) {
      console.error('[API Credit Notes Action] Admin authentication failed:', error);
      return json({
        success: false,
        error: 'Authentication failed - please refresh the page'
      }, { status: 401, headers });
    }
  }

  try {
    // formData already parsed above for POS detection
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
      }, { status: 404, headers });
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
    }, { headers });
    
  } catch (error) {
    console.error('Error creating credit note:', error);
    
    if (error instanceof z.ZodError) {
      return json({
        success: false,
        error: 'Validation error',
        details: error.errors
      }, { status: 400, headers });
    }

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create credit note'
    }, { status: 500, headers });
  }
}