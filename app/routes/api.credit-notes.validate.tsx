// API route for validating credit notes via QR code
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate, unauthenticated } from '../shopify.server';
import { CreditNoteService } from '../services/creditNote.server';
import { QRCodeService } from '../services/qrcode.server';
import { z } from 'zod';
import {
  isPOSRequest,
  extractSessionToken,
  validatePOSSessionToken,
  getOrCreatePOSSession
} from '../utils/pos-auth.server';

const ValidateSchema = z.object({
  // Accept both 'code' (from POS extensions) and 'qrCode' (from admin app)
  code: z.string().min(1, 'Code is required').optional(),
  qrCode: z.string().min(1, 'QR code is required').optional(),
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
}).refine(data => data.code || data.qrCode, {
  message: 'Either code or qrCode must be provided',
});

export async function action({ request }: ActionFunctionArgs) {
  // Set CSP headers for POS compatibility first
  const headers = new Headers();
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

  if (isFromPOS) {
    try {
      console.log('[API Validate] Detected POS extension request - using JWT validation');

      const sessionToken = extractSessionToken(request);
      if (!sessionToken) {
        throw new Error('No session token in Authorization header');
      }

      const posAuth = await validatePOSSessionToken(sessionToken);
      console.log('[API Validate] POS token validated for shop:', posAuth.shop);

      session = await getOrCreatePOSSession(posAuth.shop);
      const { admin: posAdmin } = await unauthenticated.admin(posAuth.shop);
      admin = posAdmin;

      console.log('[API Validate] ✅ POS authentication successful');
    } catch (error) {
      console.error('[API Validate] POS authentication failed:', error);
      return json({
        success: false,
        valid: false,
        error: error instanceof Error ? error.message : 'POS authentication failed'
      }, { status: 401, headers });
    }
  } else {
    try {
      console.log('[API Validate] Using standard admin authentication');
      const authResult = await authenticate.admin(request);
      admin = authResult.admin;
      session = authResult.session;
    } catch (error) {
      console.error('[API Validate] Authentication failed:', error);
      return json({
        success: false,
        valid: false,
        error: 'Authentication failed'
      }, { status: 401, headers });
    }
  }

  try {
    const formData = await request.json();
    const validated = ValidateSchema.parse(formData);

    const creditService = new CreditNoteService(session.shop, admin);
    const qrService = new QRCodeService();

    // Get code from either field
    const codeToValidate = validated.code || validated.qrCode;

    // First validate QR code format and integrity
    const qrValidation = qrService.validateQRCode(codeToValidate, validated.qrData);
    if (!qrValidation.isValid) {
      return json({
        success: false,
        valid: false,
        error: qrValidation.error || 'Invalid QR code format',
        creditNote: null,
      }, { headers });
    }

    // Find credit note by QR code
    const creditNote = await creditService.findByQRCode(codeToValidate);
    if (!creditNote) {
      return json({
        success: false,
        valid: false,
        error: 'Credit note not found',
        creditNote: null,
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