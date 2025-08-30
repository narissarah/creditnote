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