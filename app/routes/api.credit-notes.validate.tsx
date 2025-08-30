// API route for validating credit notes via QR code
import { json, type ActionFunctionArgs } from '@remix-run/node';
import { authenticate } from '~/shopify.server';
import { CreditNoteService } from '~/services/creditNote.server';
import { QRCodeService } from '~/services/qrcode.server';
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
  const { admin, session } = await authenticate.admin(request);
  
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
      });
    }
    
    // Find credit note by QR code
    const creditNote = await creditService.findByQRCode(validated.qrCode);
    if (!creditNote) {
      return json({
        success: false,
        valid: false,
        error: 'Credit note not found'
      });
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
      });
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
        });
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
        });
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
    });
    
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
      }, { status: 400 });
    }
    
    return json({
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }, { status: 500 });
  }
}