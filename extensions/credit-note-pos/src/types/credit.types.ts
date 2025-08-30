// TypeScript types for credit note system
export interface CreditNote {
  id: string;
  noteNumber: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
  status: CreditStatus;
  qrCode: string;
  qrCodeImage?: string;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  creditNoteId: string;
  amount: number;
  type: TransactionType;
  description?: string;
  orderId?: string;
  orderNumber?: string;
  posDeviceId?: string;
  staffId?: string;
  staffName?: string;
  createdAt: string;
}

export interface QRCodeData {
  type: 'credit_note';
  version: string;
  code: string;
  amount: number;
  customerId: string;
  shop: string;
  timestamp: string;
  hash?: string;
}

export interface CreditRedemption {
  creditNoteId: string;
  amount: number;
  orderId?: string;
  posDeviceId?: string;
  staffId?: string;
  staffName?: string;
  metadata?: Record<string, any>;
}

export interface OfflineSyncItem {
  id: string;
  operation: string;
  payload: any;
  timestamp: string;
  retryCount: number;
}

// Enums
export enum CreditStatus {
  ACTIVE = 'ACTIVE',
  PARTIALLY_USED = 'PARTIALLY_USED', 
  FULLY_USED = 'FULLY_USED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED'
}

export enum TransactionType {
  ISSUANCE = 'ISSUANCE',
  REDEMPTION = 'REDEMPTION', 
  PARTIAL_REDEMPTION = 'PARTIAL_REDEMPTION',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  EXPIRY = 'EXPIRY',
  CANCELLATION = 'CANCELLATION'
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreditValidationResponse extends ApiResponse<CreditNote> {
  valid: boolean;
  usableAmount?: number;
}

export interface CreditListResponse extends ApiResponse<CreditNote[]> {
  credits: CreditNote[];
  totalCount: number;
  hasMore: boolean;
}

// Component Props types
export interface CreditScannerProps {
  onCreditSelected: (credit: CreditNote) => void;
  onError: (error: string) => void;
  autoApply?: boolean;
}

export interface CreditListProps {
  customerId?: string;
  searchQuery?: string;
  onCreditSelect: (credit: CreditNote) => void;
  showExpired?: boolean;
}

export interface CreditReceiptProps {
  transaction: CreditTransaction;
  creditNote: CreditNote;
  showQR?: boolean;
}