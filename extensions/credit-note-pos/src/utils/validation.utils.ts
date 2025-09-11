// Validation utilities for credit note operations
import { CreditNote, CreditRedemption } from '../types/credit.types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validate credit redemption request
 */
export function validateCreditRedemption(
  redemption: CreditRedemption,
  creditNote?: CreditNote
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic field validation
  if (!redemption.creditNoteId) {
    errors.push('Credit note ID is required');
  }
  
  if (!redemption.amount || redemption.amount <= 0) {
    errors.push('Valid redemption amount is required');
  }
  
  // Credit note specific validation
  if (creditNote) {
    // Check status
    if (!['ACTIVE', 'PARTIALLY_USED'].includes(creditNote.status)) {
      errors.push(`Cannot redeem ${creditNote.status.toLowerCase()} credit note`);
    }
    
    // Check expiration
    if (creditNote.expiresAt && new Date(creditNote.expiresAt) < new Date()) {
      errors.push('Credit note has expired');
    }
    
    // Check remaining amount
    if (redemption.amount > creditNote.remainingAmount) {
      errors.push(`Redemption amount (${redemption.amount}) exceeds remaining credit (${creditNote.remainingAmount})`);
    }
    
    // Currency validation
    if (creditNote.currency && creditNote.currency !== 'USD') {
      warnings.push(`Credit note currency is ${creditNote.currency}, ensure cart uses same currency`);
    }
    
    // Large redemption warning
    if (redemption.amount > 500) {
      warnings.push('Large credit redemption - consider manager approval');
    }
  }
  
  // Staff validation
  if (redemption.staffId && !redemption.staffName) {
    warnings.push('Staff name missing for audit trail');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate customer email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate credit note number format
 */
export function validateCreditNoteNumber(noteNumber: string): ValidationResult {
  const errors: string[] = [];
  
  if (!noteNumber) {
    errors.push('Credit note number is required');
    return { isValid: false, errors };
  }
  
  // Expected format: CN-YYYY-NNNN
  const regex = /^CN-\d{4}-\d{4}$/i;
  if (!regex.test(noteNumber)) {
    errors.push('Invalid credit note number format. Expected: CN-YYYY-NNNN');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate amount format and range
 */
export function validateAmount(
  amount: number,
  options: {
    min?: number;
    max?: number;
    allowZero?: boolean;
    currency?: string;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const { min = 0.01, max = 10000, allowZero = false } = options;
  
  if (typeof amount !== 'number' || isNaN(amount)) {
    errors.push('Amount must be a valid number');
    return { isValid: false, errors };
  }
  
  if (!allowZero && amount <= 0) {
    errors.push('Amount must be greater than zero');
  }
  
  if (amount < min) {
    errors.push(`Amount must be at least ${min}`);
  }
  
  if (amount > max) {
    errors.push(`Amount cannot exceed ${max}`);
  }
  
  // Check for reasonable decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    errors.push('Amount cannot have more than 2 decimal places');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate POS device ID format
 */
export function validatePOSDeviceId(deviceId: string): boolean {
  if (!deviceId) return false;
  
  // Basic validation - should be alphanumeric with possible hyphens/underscores
  const regex = /^[a-zA-Z0-9_-]+$/;
  return regex.test(deviceId) && deviceId.length >= 3 && deviceId.length <= 50;
}

/**
 * Sanitize customer search query
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';
  
  // Remove potentially dangerous characters but keep common search characters
  return query
    .trim()
    .replace(/[<>\"'&]/g, '')
    .substring(0, 100); // Limit length
}

/**
 * Validate offline sync payload
 */
export function validateOfflinePayload(payload: any): ValidationResult {
  const errors: string[] = [];
  
  if (!payload) {
    errors.push('Payload is required');
    return { isValid: false, errors };
  }
  
  if (typeof payload !== 'object') {
    errors.push('Payload must be an object');
    return { isValid: false, errors };
  }
  
  // Check required fields based on operation type
  if (payload.operation === 'CREDIT_REDEEM') {
    if (!payload.creditNoteId) {
      errors.push('Credit note ID required for redemption');
    }
    if (!payload.amount) {
      errors.push('Amount required for redemption');
    }
  }
  
  // Validate payload size (prevent overly large payloads)
  const payloadSize = JSON.stringify(payload).length;
  if (payloadSize > 10000) { // 10KB limit
    errors.push('Payload size exceeds limit');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if credit note is near expiration
 */
export function isNearExpiration(
  expiresAt: string,
  warningDays: number = 7
): boolean {
  if (!expiresAt) return false;
  
  const expirationDate = new Date(expiresAt);
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + warningDays);
  
  return expirationDate <= warningDate && expirationDate > new Date();
}

/**
 * Validate barcode format and checksum
 */
export function validateBarcode(barcode: string): ValidationResult {
  const errors: string[] = [];
  
  if (!barcode) {
    errors.push('Barcode is required');
    return { isValid: false, errors };
  }
  
  // Remove any spaces and convert to uppercase
  const cleanBarcode = barcode.trim().toUpperCase();
  
  // Check different barcode formats
  if (isCreditNoteBarcode(cleanBarcode)) {
    return validateCreditBarcode(cleanBarcode);
  } else if (isUPCBarcode(cleanBarcode)) {
    return validateUPCBarcode(cleanBarcode);
  } else if (isEAN13Barcode(cleanBarcode)) {
    return validateEAN13Barcode(cleanBarcode);
  } else if (isCode128Barcode(cleanBarcode)) {
    return validateCode128Barcode(cleanBarcode);
  } else {
    errors.push('Unsupported barcode format');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if barcode matches credit note format
 */
function isCreditNoteBarcode(barcode: string): boolean {
  // Credit note barcode format: CN + 4 digit year + 8 character code
  return /^CN[0-9]{4}[A-Z0-9]{8}$/.test(barcode);
}

/**
 * Validate credit note barcode format
 */
function validateCreditBarcode(barcode: string): ValidationResult {
  const errors: string[] = [];
  
  if (!isCreditNoteBarcode(barcode)) {
    errors.push('Invalid credit note barcode format');
  } else {
    // Extract year and validate
    const year = parseInt(barcode.substring(2, 6));
    const currentYear = new Date().getFullYear();
    
    if (year < 2020 || year > currentYear + 1) {
      errors.push(`Invalid year in barcode: ${year}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if barcode is UPC format
 */
function isUPCBarcode(barcode: string): boolean {
  return /^[0-9]{12}$/.test(barcode);
}

/**
 * Validate UPC barcode with checksum
 */
function validateUPCBarcode(barcode: string): ValidationResult {
  const errors: string[] = [];
  
  if (!isUPCBarcode(barcode)) {
    errors.push('Invalid UPC barcode format');
    return { isValid: false, errors };
  }
  
  // Calculate UPC checksum
  const digits = barcode.split('').map(Number);
  const checksum = digits.slice(0, 11);
  const providedCheckDigit = digits[11];
  
  let sum = 0;
  for (let i = 0; i < checksum.length; i++) {
    sum += checksum[i] * (i % 2 === 0 ? 3 : 1);
  }
  
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  
  if (calculatedCheckDigit !== providedCheckDigit) {
    errors.push('Invalid UPC checksum');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if barcode is EAN-13 format
 */
function isEAN13Barcode(barcode: string): boolean {
  return /^[0-9]{13}$/.test(barcode);
}

/**
 * Validate EAN-13 barcode with checksum
 */
function validateEAN13Barcode(barcode: string): ValidationResult {
  const errors: string[] = [];
  
  if (!isEAN13Barcode(barcode)) {
    errors.push('Invalid EAN-13 barcode format');
    return { isValid: false, errors };
  }
  
  // Calculate EAN-13 checksum
  const digits = barcode.split('').map(Number);
  const checksum = digits.slice(0, 12);
  const providedCheckDigit = digits[12];
  
  let sum = 0;
  for (let i = 0; i < checksum.length; i++) {
    sum += checksum[i] * (i % 2 === 0 ? 1 : 3);
  }
  
  const calculatedCheckDigit = (10 - (sum % 10)) % 10;
  
  if (calculatedCheckDigit !== providedCheckDigit) {
    errors.push('Invalid EAN-13 checksum');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if barcode is Code128 format
 */
function isCode128Barcode(barcode: string): boolean {
  // Code128 can contain alphanumeric characters
  return /^[A-Z0-9\-\.\s]{4,48}$/.test(barcode);
}

/**
 * Validate Code128 barcode
 */
function validateCode128Barcode(barcode: string): ValidationResult {
  const errors: string[] = [];
  
  if (!isCode128Barcode(barcode)) {
    errors.push('Invalid Code128 barcode format');
  }
  
  if (barcode.length < 4) {
    errors.push('Code128 barcode too short');
  }
  
  if (barcode.length > 48) {
    errors.push('Code128 barcode too long');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract credit note information from barcode
 */
export function extractCreditInfoFromBarcode(barcode: string): {
  noteNumber?: string;
  year?: number;
  sequenceCode?: string;
  isValid: boolean;
} {
  const cleanBarcode = barcode.trim().toUpperCase();
  
  if (isCreditNoteBarcode(cleanBarcode)) {
    const year = parseInt(cleanBarcode.substring(2, 6));
    const sequenceCode = cleanBarcode.substring(6, 14);
    const noteNumber = `CN-${year}-${sequenceCode.substring(0, 4)}`;
    
    return {
      noteNumber,
      year,
      sequenceCode,
      isValid: true
    };
  }
  
  return { isValid: false };
}

/**
 * Generate QR code validation patterns
 */
export function validateQRCodePattern(qrData: string): ValidationResult {
  const errors: string[] = [];
  
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(qrData);
    
    // Validate required QR code fields
    if (!parsed.type || parsed.type !== 'credit_note') {
      errors.push('Invalid QR code type');
    }
    
    if (!parsed.code) {
      errors.push('Missing credit code in QR data');
    }
    
    if (!parsed.amount || typeof parsed.amount !== 'number') {
      errors.push('Invalid amount in QR data');
    }
    
    if (!parsed.customerId) {
      errors.push('Missing customer ID in QR data');
    }
    
    if (!parsed.shop) {
      errors.push('Missing shop identifier in QR data');
    }
    
    // Validate timestamp if present
    if (parsed.timestamp) {
      const timestamp = new Date(parsed.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('Invalid timestamp format in QR data');
      } else {
        // Check if QR code is too old (security measure)
        const hoursAgo = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
        if (hoursAgo > 72) { // 3 days
          errors.push('QR code is expired (too old)');
        }
      }
    }
    
  } catch (parseError) {
    // Try simple format validation
    if (qrData.startsWith('CREDIT:')) {
      const parts = qrData.split(':');
      if (parts.length < 4) {
        errors.push('Invalid simple QR format');
      }
    } else {
      errors.push('Invalid QR code format');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}