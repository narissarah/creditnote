// QR Code utilities for credit note validation and parsing
import { QRCodeData, CreditNote } from '../types/credit.types';

export interface QRValidationResult {
  isValid: boolean;
  data?: QRCodeData;
  error?: string;
}

/**
 * Parse and validate QR code data for credit notes
 */
export function parseQRCode(qrString: string): QRValidationResult {
  try {
    // Try to parse as JSON first
    const data = JSON.parse(qrString) as QRCodeData;
    
    // Validate required fields
    if (!data.type || data.type !== 'credit_note') {
      return {
        isValid: false,
        error: 'Invalid QR code type. Expected credit_note.'
      };
    }
    
    if (!data.code || !data.amount || !data.customerId || !data.shop) {
      return {
        isValid: false,
        error: 'Missing required QR code data fields.'
      };
    }
    
    // Validate amount is positive number
    if (typeof data.amount !== 'number' || data.amount <= 0) {
      return {
        isValid: false,
        error: 'Invalid credit amount in QR code.'
      };
    }
    
    // Check if QR code is not too old (optional timestamp validation)
    if (data.timestamp) {
      const qrTime = new Date(data.timestamp);
      const now = new Date();
      const hoursDiff = (now.getTime() - qrTime.getTime()) / (1000 * 60 * 60);
      
      // Reject QR codes older than 24 hours for security
      if (hoursDiff > 24) {
        return {
          isValid: false,
          error: 'QR code has expired. Please generate a new one.'
        };
      }
    }
    
    return {
      isValid: true,
      data
    };
    
  } catch (error) {
    // Try simple format parsing (fallback)
    if (typeof qrString === 'string' && qrString.includes('CREDIT:')) {
      return parseSimpleQRFormat(qrString);
    }
    
    return {
      isValid: false,
      error: 'Invalid QR code format. Unable to parse data.'
    };
  }
}

/**
 * Parse simple QR format: CREDIT:code:amount:customerId
 */
function parseSimpleQRFormat(qrString: string): QRValidationResult {
  try {
    const parts = qrString.split(':');
    if (parts.length < 4 || parts[0] !== 'CREDIT') {
      return {
        isValid: false,
        error: 'Invalid simple QR format.'
      };
    }
    
    const [, code, amountStr, customerId] = parts;
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      return {
        isValid: false,
        error: 'Invalid amount in QR code.'
      };
    }
    
    return {
      isValid: true,
      data: {
        type: 'credit_note',
        version: '1.0',
        code,
        amount,
        customerId,
        shop: '', // Will be filled by API
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Failed to parse simple QR format.'
    };
  }
}

/**
 * Generate QR code data for a credit note
 */
export function generateQRData(creditNote: CreditNote, shopDomain: string): QRCodeData {
  return {
    type: 'credit_note',
    version: '1.0',
    code: creditNote.qrCode,
    amount: creditNote.remainingAmount,
    customerId: creditNote.customerId,
    shop: shopDomain,
    timestamp: new Date().toISOString(),
    // Add hash for security if needed
    hash: generateQRHash(creditNote)
  };
}

/**
 * Generate QR code data for credit note (POS extension compatible)
 */
export function generateCreditQRData(creditNote: CreditNote): QRCodeData {
  // Validate input
  if (!creditNote || !creditNote.id || !creditNote.customerId) {
    throw new Error('Invalid credit note data for QR generation');
  }

  return {
    type: 'credit_note',
    version: '1.0',
    code: creditNote.noteNumber || creditNote.id,
    amount: creditNote.remainingAmount,
    customerId: creditNote.customerId,
    shop: creditNote.shop || 'pos-created',
    timestamp: new Date().toISOString(),
    hash: generateQRHash(creditNote),
    // Additional POS-specific data
    originalAmount: creditNote.originalAmount,
    currency: creditNote.currency || 'USD',
    customerName: creditNote.customerName,
    status: creditNote.status
  };
}

/**
 * Generate security hash for QR code validation
 */
function generateQRHash(creditNote: CreditNote): string {
  // Simple hash implementation - in production, use proper cryptographic hash
  const data = `${creditNote.id}-${creditNote.qrCode}-${creditNote.remainingAmount}`;
  return btoa(data).substring(0, 8);
}

/**
 * Validate credit note status for redemption
 */
export function canRedeemCredit(creditNote: CreditNote, requestedAmount?: number): {
  canRedeem: boolean;
  reason?: string;
  maxAmount?: number;
} {
  // Check if credit is active
  if (creditNote.status !== 'ACTIVE' && creditNote.status !== 'PARTIALLY_USED') {
    return {
      canRedeem: false,
      reason: `Credit note is ${creditNote.status.toLowerCase()}`
    };
  }
  
  // Check if expired
  if (creditNote.expiresAt && new Date(creditNote.expiresAt) < new Date()) {
    return {
      canRedeem: false,
      reason: 'Credit note has expired'
    };
  }
  
  // Check remaining amount
  if (creditNote.remainingAmount <= 0) {
    return {
      canRedeem: false,
      reason: 'No remaining credit amount'
    };
  }
  
  // Check requested amount if provided
  if (requestedAmount !== undefined) {
    if (requestedAmount <= 0) {
      return {
        canRedeem: false,
        reason: 'Invalid redemption amount'
      };
    }
    
    if (requestedAmount > creditNote.remainingAmount) {
      return {
        canRedeem: false,
        reason: 'Requested amount exceeds available credit',
        maxAmount: creditNote.remainingAmount
      };
    }
  }
  
  return {
    canRedeem: true,
    maxAmount: creditNote.remainingAmount
  };
}

/**
 * Format credit amount for display
 */
export function formatCreditAmount(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

/**
 * Format credit note number for display
 */
export function formatCreditNoteNumber(noteNumber: string): string {
  // Ensure consistent format: CN-YYYY-NNNN
  if (noteNumber.startsWith('CN-')) {
    return noteNumber.toUpperCase();
  }
  return `CN-${noteNumber}`.toUpperCase();
}