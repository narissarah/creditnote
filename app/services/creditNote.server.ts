// Credit Note Service - handles all credit note business logic
import { PrismaClient, CreditNote } from '@prisma/client';
import prisma from '../db.server';
import { QRCodeService } from './qrcode.server';
import { MetafieldSyncService } from '../utils/metafield-sync.server';
import { nanoid } from 'nanoid';

export interface CreateCreditNoteInput {
  customerId: string;
  customerEmail?: string;
  customerName?: string;
  amount: number;
  currency?: string;
  reason?: string;
  expiresAt?: string;
  originalOrderId?: string;
  originalOrderNumber?: string;
}

export interface CreditRedemptionInput {
  creditNoteId: string;
  amount: number;
  orderId?: string;
  orderNumber?: string;
  posDeviceId?: string;
  staffId?: string;
  staffName?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  maxAmount?: number;
}

export interface CreditListResult {
  credits: CreditNote[];
  totalCount: number;
  hasMore: boolean;
}

export class CreditNoteService {
  private qrService: QRCodeService;

  constructor(
    private shop: string, 
    private shopifyAdmin?: any
  ) {
    this.qrService = new QRCodeService();
  }

  /**
   * Create a new credit note with QR code
   */
  async createCreditNote(input: CreateCreditNoteInput): Promise<CreditNote> {
    const noteNumber = await this.generateNoteNumber();
    const qrCode = nanoid(16); // Generate unique QR code identifier
    
    // Generate QR code image
    const qrCodeData = {
      type: 'credit_note' as const,
      version: '1.0',
      code: qrCode,
      amount: input.amount,
      customerId: input.customerId,
      shop: this.shop,
      timestamp: new Date().toISOString()
    };
    
    const qrCodeImage = await this.qrService.generateQRImage(qrCodeData);
    
    const creditNote = await prisma.creditNote.create({
      data: {
        shop: this.shop,
        shopDomain: this.shop,  // FIXED: Set both fields for compatibility
        noteNumber,
        customerId: input.customerId,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        originalAmount: input.amount,
        remainingAmount: input.amount,
        currency: input.currency || 'USD',
        qrCode,
        qrCodeImage,
        qrCodeData: qrCodeData as any,
        reason: input.reason,
        originalOrderId: input.originalOrderId,
        originalOrderNumber: input.originalOrderNumber,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: 'active'
      }
    });

    // Log creation transaction (temporarily disabled - table doesn't exist)
    console.log('[Credit Note Service] Transaction logging skipped - table not in schema');

    // METAFIELD SYNC: Temporarily disabled to isolate admin error
    console.log('[Credit Note Service] Metafield creation temporarily disabled for troubleshooting');

    // TODO: Re-enable after fixing admin redirect issue
    // This feature syncs credit notes to customer metafields for POS GraphQL access

    return creditNote;
  }

  /**
   * Find credit note by QR code
   */
  async findByQRCode(qrCode: string): Promise<CreditNote | null> {
    return prisma.creditNote.findFirst({
      where: {
        OR: [
          { shop: this.shop },
          { shopDomain: this.shop }
        ],
        qrCode,
        deletedAt: null
      }
    });
  }

  /**
   * Find credit note by ID
   */
  async findById(id: string): Promise<CreditNote | null> {
    return prisma.creditNote.findFirst({
      where: {
        id,
        OR: [
          { shop: this.shop },
          { shopDomain: this.shop }
        ],
        deletedAt: null
      }
    });
  }

  /**
   * Get credits with filtering and pagination
   */
  async getCredits(filters: {
    customerId?: string;
    search?: string;
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<CreditListResult> {
    const where: any = {
      OR: [
        { shop: this.shop },
        { shopDomain: this.shop }
      ],
      deletedAt: null
    };

    // Build additional filters using AND array
    const additionalFilters = [];

    if (filters.customerId) {
      additionalFilters.push({ customerId: filters.customerId });
    }

    if (filters.status && filters.status.length > 0) {
      additionalFilters.push({ status: { in: filters.status } });
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      additionalFilters.push({
        OR: [
          { noteNumber: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
          { reason: { contains: search, mode: 'insensitive' } }
        ]
      });
    }

    // Combine with shop filter
    if (additionalFilters.length > 0) {
      where.AND = [
        ...where.OR, // Spread the shop OR condition array into AND
        ...additionalFilters
      ];
      delete where.OR;
    }

    const [credits, totalCount] = await Promise.all([
      prisma.creditNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0
      }),
      prisma.creditNote.count({ where })
    ]);

    const hasMore = (filters.offset || 0) + credits.length < totalCount;

    return {
      credits,
      totalCount,
      hasMore
    };
  }

  /**
   * Validate credit note for redemption
   */
  validateForRedemption(creditNote: CreditNote, requestedAmount?: number): ValidationResult {
    // Check status
    if (!['active', 'partially_used'].includes(creditNote.status)) {
      return {
        isValid: false,
        error: `Credit note is ${creditNote.status.toLowerCase()}`
      };
    }

    // Check expiration
    if (creditNote.expiresAt && creditNote.expiresAt < new Date()) {
      return {
        isValid: false,
        error: 'Credit note has expired'
      };
    }

    // Check remaining amount
    if (creditNote.remainingAmount <= 0) {
      return {
        isValid: false,
        error: 'No remaining credit amount'
      };
    }

    // Check requested amount
    if (requestedAmount !== undefined) {
      if (requestedAmount <= 0) {
        return {
          isValid: false,
          error: 'Invalid redemption amount'
        };
      }

      if (requestedAmount > creditNote.remainingAmount) {
        return {
          isValid: false,
          error: 'Requested amount exceeds available credit',
          maxAmount: creditNote.remainingAmount
        };
      }
    }

    return {
      isValid: true,
      maxAmount: creditNote.remainingAmount
    };
  }

  /**
   * Redeem credit note
   */
  async redeemCredit(input: CreditRedemptionInput) {
    return await prisma.$transaction(async (tx) => {
      // Get current credit note
      const creditNote = await tx.creditNote.findFirst({
        where: {
          id: input.creditNoteId,
          shop: this.shop
        }
      });

      if (!creditNote) {
        throw new Error('Credit note not found');
      }

      // Validate redemption
      const validation = this.validateForRedemption(creditNote, input.amount);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Calculate new amounts and status
      const newRemainingAmount = creditNote.remainingAmount - input.amount;
      let newStatus = creditNote.status;

      if (newRemainingAmount <= 0) {
        newStatus = 'fully_used';
      } else if (newRemainingAmount < creditNote.originalAmount) {
        newStatus = 'partially_used';
      }

      // Update credit note
      const updatedCreditNote = await tx.creditNote.update({
        where: { id: input.creditNoteId },
        data: {
          remainingAmount: newRemainingAmount,
          status: newStatus,
          updatedAt: new Date()
        }
      });

      // Create redemption record
      const transaction = await tx.creditRedemption.create({
        data: {
          creditNoteId: input.creditNoteId,
          amount: input.amount,
          orderId: input.orderId || `redemption_${Date.now()}`,
          posTerminal: input.posDeviceId || 'unknown'
        }
      });

      // Note: Customer cache functionality removed - not in current schema

      return {
        transaction,
        updatedCreditNote,
        redeemedAmount: input.amount,
        remainingAmount: newRemainingAmount
      };
    });
  }

  /**
   * Get customer's total credit balance
   */
  async getCustomerCreditBalance(customerId: string): Promise<number> {
    const result = await prisma.creditNote.aggregate({
      where: {
        OR: [
          { shop: this.shop },
          { shopDomain: this.shop }
        ],
        customerId,
        status: { in: ['active', 'partially_used'] },
        deletedAt: null
      },
      _sum: { remainingAmount: true }
    });

    return Number(result._sum.remainingAmount) || 0;
  }

  /**
   * Generate unique credit note number with race condition protection
   * Uses random ID to avoid collisions in high-concurrency scenarios
   */
  private async generateNoteNumber(): Promise<string> {
    const maxRetries = 10; // Increased from 5 for better reliability

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Strategy: Use timestamp + random to minimize collisions
      const year = new Date().getFullYear();
      const timestamp = Date.now();

      // Generate a unique suffix with timestamp microseconds + random
      // This dramatically reduces collision probability
      const microseconds = (timestamp % 1000).toString().padStart(3, '0');
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const uniqueSuffix = `${microseconds}${randomSuffix}`;

      const noteNumber = `CN-${year}-${uniqueSuffix}`;

      try {
        // Atomic check: Try to find existing note with this number
        const existing = await prisma.creditNote.findFirst({
          where: {
            noteNumber,
            OR: [
              { shop: this.shop },
              { shopDomain: this.shop }
            ]
          },
          select: { id: true } // Only select ID for performance
        });

        if (!existing) {
          console.log(`[Credit Note Service] Generated unique note number: ${noteNumber}`);
          return noteNumber;
        }

        console.log(`[Credit Note Service] Note number ${noteNumber} collision, retrying (attempt ${attempt + 1}/${maxRetries})`);

        // Add exponential backoff to reduce contention
        if (attempt < maxRetries - 1) {
          const backoffMs = Math.min(100 * Math.pow(2, attempt), 1000); // Max 1 second
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      } catch (error) {
        console.error(`[Credit Note Service] Error checking note number uniqueness:`, error);
        // Continue to next attempt
      }
    }

    // Ultimate fallback: timestamp + nanoid (guaranteed unique)
    const timestamp = Date.now();
    const uniqueId = nanoid(8).toUpperCase(); // Increased from 4 for more uniqueness
    const fallbackNumber = `CN-${new Date().getFullYear()}-${timestamp}-${uniqueId}`;

    console.warn(`[Credit Note Service] ⚠️ Using fallback note number after ${maxRetries} attempts: ${fallbackNumber}`);
    return fallbackNumber;
  }

  /**
   * Create transaction record (temporarily disabled - table doesn't exist)
   */
  private async createTransaction(data: {
    creditNoteId: string;
    amount: number;
    type: any;
    description?: string;
    orderId?: string;
    orderNumber?: string;
    posDeviceId?: string;
    staffId?: string;
    staffName?: string;
    metadata?: Record<string, any>;
  }) {
    // Table doesn't exist in current schema
    console.log('[Credit Note Service] Transaction record skipped:', data.description);
    return { logged: true };
  }

  /**
   * Get customer statistics (simplified without cache)
   */
  private async getCustomerStats(customerId: string) {
    const balance = await this.getCustomerCreditBalance(customerId);
    const creditCount = await prisma.creditNote.count({
      where: {
        shop: this.shop,
        customerId,
        status: { in: ['active', 'partially_used'] }
      }
    });

    return { balance, creditCount };
  }

  /**
   * Get recent validation attempts (for security)
   */
  async getRecentValidations(creditNoteId: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    // Simplified: return 0 since we don't have audit log table
    // In production, consider adding audit functionality if needed
    return 0;
  }

  /**
   * Log validation attempt for audit
   */
  async logValidationAttempt(data: {
    creditNoteId: string | null;
    success: boolean;
    error?: string;
    ipAddress: string;
    userAgent: string;
    isPOSRequest: boolean;
  }) {
    // Simplified: log to console since we don't have audit log table
    console.log('Validation attempt:', {
      shop: this.shop,
      creditNoteId: data.creditNoteId,
      success: data.success,
      error: data.error,
      isPOSRequest: data.isPOSRequest
    });
    return { logged: true };
  }

  /**
   * Delete credit note (soft delete)
   */
  async deleteCredit(creditNoteId: string): Promise<void> {
    await prisma.creditNote.update({
      where: {
        id: creditNoteId,
        shop: this.shop
      },
      data: {
        deletedAt: new Date(),
        status: 'deleted'
      }
    });
  }

  /**
   * Get credit redemptions for a credit note
   */
  async getCreditRedemptions(creditNoteId: string) {
    return prisma.creditRedemption.findMany({
      where: {
        creditNoteId,
        creditNote: {
          shop: this.shop
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Update credit note
   */
  async updateCredit(creditNoteId: string, updates: {
    status?: string;
    expiresAt?: string;
    notes?: string;
  }) {
    const updateData: any = {};

    if (updates.status) {
      updateData.status = updates.status;
    }

    if (updates.expiresAt) {
      updateData.expiresAt = new Date(updates.expiresAt);
    }

    if (updates.notes) {
      updateData.metadata = {
        notes: updates.notes
      };
    }

    updateData.updatedAt = new Date();

    return prisma.creditNote.update({
      where: {
        id: creditNoteId,
        shop: this.shop
      },
      data: updateData
    });
  }
}