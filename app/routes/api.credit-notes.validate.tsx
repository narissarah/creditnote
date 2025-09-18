// API route for validating credit notes via QR code
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import { QRCodeService } from '../services/qrcode.server';
import { z } from 'zod';

const ValidateSchema = z.object({
  qrCode: z.string().min(1, 'QR code is required'),
  qrData: z.object({
    type: z.string(),
    code: z.string(),
    amount: z.number().optional(),
    customerId: z.string().optional(),
    shop: z.string().optional(),
    timestamp: z.string().optional(),
    hash: z.string().optional(),
  }).optional(),
  requestedAmount: z.number().positive().optional(),
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
      valid: false,
      error: 'Authentication failed'
    }, { status: 401, headers });
  }

  try {
    const formData = await request.json();
    const validated = ValidateSchema.parse(formData);
    
    const creditService = new CreditNoteService(session.shop, admin);
    const qrService = new QRCodeService();
    
    // First validate QR code format and integrity
    const qrValidation = qrService.validateQRCode(validated.qrCode, validated.qrData);
    if (!qrValidation.isValid) {
      return json({
        success: false,
        valid: false,
        error: qrValidation.error || 'Invalid QR code format'
      }, { headers });
    }
    
    // Find credit note by QR code
    const creditNote = await creditService.findByQRCode(validated.qrCode);
    if (!creditNote) {
      return json({
        success: false,
        valid: false,
        error: 'Credit note not found'
      }, { headers });
    }
    
    // Validate credit note status and expiration
    const statusValidation = creditService.validateForRedemption(
      creditNote, 
      validated.requestedAmount
    );
    
    if (!statusValidation.isValid) {
      return json({
        success: false,
        valid: false,
        error: statusValidation.error,
        data: creditNote // Include data for reference even if invalid
      }, { headers });
    }
    
    // Additional security checks for POS requests
    const isPOSRequest = request.headers.get('X-POS-Request') === 'true';
    if (isPOSRequest) {
      // Verify shop matches
      if (validated.qrData?.shop && validated.qrData.shop !== session.shop) {
        return json({
          success: false,
          valid: false,
          error: 'Credit note is not valid for this store'
        }, { headers });
      }
      
      // Check for suspicious activity (multiple rapid validations)
      const recentValidations = await creditService.getRecentValidations(
        creditNote.id, 
        5 // minutes
      );
      
      if (recentValidations > 10) {
        return json({
          success: false,
          valid: false,
          error: 'Too many validation attempts. Please contact support.'
        }, { headers });
      }
    }
    
    // Log validation attempt for audit
    await creditService.logValidationAttempt({
      creditNoteId: creditNote.id,
      success: true,
      ipAddress: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      isPOSRequest
    });
    
    return json({
      success: true,
      valid: true,
      data: creditNote,
      usableAmount: statusValidation.maxAmount,
      message: 'Credit note is valid and ready to use'
    }, { headers });
    
  } catch (error) {
    console.error('Error validating credit note:', error);
    
    // Log failed validation attempt
    try {
      const creditService = new CreditNoteService(session.shop, admin);
      await creditService.logValidationAttempt({
        creditNoteId: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        isPOSRequest: request.headers.get('X-POS-Request') === 'true'
      });
    } catch (logError) {
      console.error('Failed to log validation attempt:', logError);
    }
    
    if (error instanceof z.ZodError) {
      return json({
        success: false,
        valid: false,
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400, headers });
    }
    
    return json({
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }, { status: 500, headers });
  }
}