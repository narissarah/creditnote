// CreditCraft POS - Main extension entry point
// This file exports all POS UI Extension components for the credit note system

// Import and register all POS UI Extensions
import './components/CreditNoteTile';
import './components/CreditScanner';
import './components/CreditReceipt';
import './components/CreditNoteManager';

// Export components for use in other contexts
export { default as CreditScanner } from './components/CreditScanner';
export { default as CreditManager } from './components/CreditManager';
export { default as CreditReceipt } from './components/CreditReceipt';
export { default as CreditList } from './components/CreditList';
export { default as CreditNoteTile } from './components/CreditNoteTile';
export { default as CreditNoteManager } from './components/CreditNoteManager';
export { default as BulkCreditManager } from './components/BulkCreditManager';
export { default as StaffPermissionManager } from './components/StaffPermissionManager';
export { default as CurrencyManager } from './components/CurrencyManager';
export { default as ExpirationManager } from './components/ExpirationManager';
export { default as PerformanceDashboard } from './components/PerformanceDashboard';
export { default as ComplianceDashboard } from './components/ComplianceDashboard';

// Extension configurations and utilities
export * from './types/credit.types';
export * from './hooks/useCreditOperations';
export * from './hooks/useOfflineSync';
export * from './utils/qrcode.utils';
export * from './utils/validation.utils';
export * from './utils/performance.utils';
export * from './utils/compliance.validator';