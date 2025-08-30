// Credit Note Service - handles all credit note business logic
import { PrismaClient, CreditNote, CreditStatus, TransactionType } from '@prisma/client';
import prisma from '~/db.server';
import { QRCodeService } from './qrcode.server';
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
        status: 'ACTIVE'
      }
    });

    // Log creation transaction
    await this.createTransaction({
      creditNoteId: creditNote.id,
      amount: input.amount,
      type: 'ISSUANCE',
      description: `Credit note created: ${noteNumber}`,
      metadata: {
        reason: input.reason,
        originalOrderId: input.originalOrderId
      }
    });

    return creditNote;
  }

  /**
   * Find credit note by QR code
   */
  async findByQRCode(qrCode: string): Promise<CreditNote | null> {
    return prisma.creditNote.findFirst({
      where: {
        shop: this.shop,
        qrCode,
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
        shop: this.shop
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
      shop: this.shop
    };

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      where.OR = [
        { noteNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { reason: { contains: search, mode: 'insensitive' } }
      ];
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
    if (!['ACTIVE', 'PARTIALLY_USED'].includes(creditNote.status)) {
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
      let newStatus: CreditStatus = creditNote.status;

      if (newRemainingAmount <= 0) {
        newStatus = 'FULLY_USED';
      } else if (newRemainingAmount < creditNote.originalAmount) {
        newStatus = 'PARTIALLY_USED';
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

      // Create transaction record
      const transaction = await tx.creditTransaction.create({
        data: {
          creditNoteId: input.creditNoteId,
          amount: input.amount,
          type: newRemainingAmount <= 0 ? 'REDEMPTION' : 'PARTIAL_REDEMPTION',
          description: input.description || `Redeemed $${input.amount}`,
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          posDeviceId: input.posDeviceId,
          staffId: input.staffId,
          staffName: input.staffName,
          metadata: input.metadata as any,
          status: 'COMPLETED'
        }
      });

      // Update customer cache
      await this.updateCustomerCache(creditNote.customerId, tx);

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
        shop: this.shop,
        customerId,
        status: { in: ['ACTIVE', 'PARTIALLY_USED'] }
      },
      _sum: { remainingAmount: true }
    });

    return Number(result._sum.remainingAmount) || 0;
  }

  /**
   * Generate unique credit note number
   */
  private async generateNoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.creditNote.count({
      where: {
        shop: this.shop,
        createdAt: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1)
        }
      }
    }) + 1;

    return `CN-${year}-${count.toString().padStart(4, '0')}`;
  }

  /**
   * Create transaction record
   */
  private async createTransaction(data: {
    creditNoteId: string;
    amount: number;
    type: TransactionType;
    description?: string;
    orderId?: string;
    orderNumber?: string;
    posDeviceId?: string;
    staffId?: string;
    staffName?: string;
    metadata?: Record<string, any>;
  }) {
    return prisma.creditTransaction.create({
      data: {
        ...data,
        metadata: data.metadata as any,
        status: 'COMPLETED'
      }
    });
  }

  /**
   * Update customer cache for offline operations
   */
  private async updateCustomerCache(customerId: string, tx?: any) {
    const client = tx || prisma;
    
    const balance = await this.getCustomerCreditBalance(customerId);
    const creditCount = await client.creditNote.count({
      where: {
        shop: this.shop,
        customerId,
        status: { in: ['ACTIVE', 'PARTIALLY_USED'] }
      }
    });

    await client.customerCache.upsert({
      where: {
        shop_customerId: {
          shop: this.shop,
          customerId
        }
      },
      update: {
        totalCreditBalance: balance,
        activeCreditCount: creditCount,
        lastSyncAt: new Date(),
        syncVersion: { increment: 1 }
      },
      create: {
        shop: this.shop,
        customerId,
        totalCreditBalance: balance,
        activeCreditCount: creditCount
      }
    });
  }

  /**
   * Get recent validation attempts (for security)
   */
  async getRecentValidations(creditNoteId: string, minutes: number): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    return prisma.auditLog.count({
      where: {
        shop: this.shop,
        resource: 'credit_note',
        resourceId: creditNoteId,
        action: 'validate',
        createdAt: { gte: since }
      }
    });
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
    return prisma.auditLog.create({
      data: {
        shop: this.shop,
        action: 'validate',
        resource: 'credit_note',
        resourceId: data.creditNoteId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        newValues: {
          success: data.success,
          error: data.error,
          isPOSRequest: data.isPOSRequest
        } as any
      }
    });
  }
}