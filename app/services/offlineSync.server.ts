// Offline Sync Service - handles POS offline operations and synchronization
import { PrismaClient, OfflineSyncQueue, OperationType, SyncStatus } from '@prisma/client';
import prisma from '~/db.server';
import { CreditNoteService } from './creditNote.server';

export interface OfflineSyncItem {
  id: string;
  operation: string;
  operationType: OperationType;
  payload: Record<string, any>;
  retryCount: number;
  maxRetries: number;
  status: SyncStatus;
  error?: string;
  posDeviceId?: string;
  createdAt: Date;
}

export interface SyncResult {
  processed: number;
  failed: number;
  remaining: number;
  errors: string[];
}

export class OfflineSyncService {
  constructor(
    private shop: string,
    private shopifyAdmin?: any
  ) {}

  /**
   * Add operation to sync queue
   */
  async addToQueue(
    operation: string,
    operationType: OperationType,
    payload: Record<string, any>,
    posDeviceId?: string,
    maxRetries: number = 3
  ): Promise<OfflineSyncItem> {
    // Validate payload based on operation type
    this.validatePayload(operationType, payload);

    // Calculate next retry time (immediate for first attempt)
    const nextRetryAt = new Date();

    const queueItem = await prisma.offlineSyncQueue.create({
      data: {
        shop: this.shop,
        operation,
        operationType,
        payload: payload as any,
        maxRetries,
        posDeviceId,
        nextRetryAt,
        status: 'PENDING'
      }
    });

    return this.mapToSyncItem(queueItem);
  }

  /**
   * Process pending sync queue items
   */
  async processQueue(limit: number = 100): Promise<SyncResult> {
    const pendingItems = await prisma.offlineSyncQueue.findMany({
      where: {
        shop: this.shop,
        status: 'PENDING',
        nextRetryAt: { lte: new Date() }
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      try {
        // Mark as processing
        await this.updateItemStatus(item.id, 'PROCESSING');

        // Process the item based on operation type
        await this.processItem(item);

        // Mark as completed
        await this.markCompleted(item.id);
        processed++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${item.operation}: ${errorMessage}`);

        // Update retry count and status
        const newRetryCount = item.retryCount + 1;
        
        if (newRetryCount >= item.maxRetries) {
          // Max retries exceeded, abandon
          await this.markAbandoned(item.id, errorMessage);
          failed++;
        } else {
          // Schedule retry with exponential backoff
          const nextRetryAt = this.calculateNextRetry(newRetryCount);
          await this.scheduleRetry(item.id, newRetryCount, nextRetryAt, errorMessage);
        }
      }
    }

    const remaining = await this.getQueueCount();

    return {
      processed,
      failed,
      remaining,
      errors
    };
  }

  /**
   * Process individual sync item
   */
  private async processItem(item: OfflineSyncQueue): Promise<void> {
    const creditService = new CreditNoteService(this.shop, this.shopifyAdmin);

    switch (item.operationType) {
      case 'CREDIT_REDEEM':
        await this.processCreditRedemption(item.payload, creditService);
        break;

      case 'CREDIT_CREATE':
        await this.processCreditCreation(item.payload, creditService);
        break;

      case 'CREDIT_ADJUST':
        await this.processCreditAdjustment(item.payload, creditService);
        break;

      case 'TRANSACTION_LOG':
        await this.processTransactionLog(item.payload, creditService);
        break;

      case 'CUSTOMER_UPDATE':
        await this.processCustomerUpdate(item.payload);
        break;

      default:
        throw new Error(`Unknown operation type: ${item.operationType}`);
    }
  }

  /**
   * Process credit redemption
   */
  private async processCreditRedemption(payload: any, creditService: CreditNoteService): Promise<void> {
    const {
      creditNoteId,
      amount,
      orderId,
      orderNumber,
      posDeviceId,
      staffId,
      staffName,
      metadata
    } = payload;

    if (!creditNoteId || !amount) {
      throw new Error('Credit redemption missing required fields');
    }

    await creditService.redeemCredit({
      creditNoteId,
      amount: Number(amount),
      orderId,
      orderNumber,
      posDeviceId,
      staffId,
      staffName,
      description: `Offline redemption sync - ${amount}`,
      metadata: {
        ...metadata,
        syncedAt: new Date().toISOString(),
        originalTimestamp: payload.timestamp
      }
    });
  }

  /**
   * Process credit creation
   */
  private async processCreditCreation(payload: any, creditService: CreditNoteService): Promise<void> {
    const {
      customerId,
      customerEmail,
      customerName,
      amount,
      currency,
      reason,
      expiresAt
    } = payload;

    if (!customerId || !amount) {
      throw new Error('Credit creation missing required fields');
    }

    await creditService.createCreditNote({
      customerId,
      customerEmail,
      customerName,
      amount: Number(amount),
      currency,
      reason: reason || 'Offline credit creation',
      expiresAt
    });
  }

  /**
   * Process credit adjustment
   */
  private async processCreditAdjustment(payload: any, creditService: CreditNoteService): Promise<void> {
    // Implementation for credit adjustments
    throw new Error('Credit adjustment sync not yet implemented');
  }

  /**
   * Process transaction logging
   */
  private async processTransactionLog(payload: any, creditService: CreditNoteService): Promise<void> {
    // Log transaction for audit purposes
    await prisma.auditLog.create({
      data: {
        shop: this.shop,
        action: payload.action || 'offline_transaction',
        resource: payload.resource || 'credit_note',
        resourceId: payload.resourceId,
        oldValues: payload.oldValues as any,
        newValues: payload.newValues as any,
        posDeviceId: payload.posDeviceId,
        ipAddress: payload.ipAddress || 'offline',
        userAgent: payload.userAgent || 'pos_offline'
      }
    });
  }

  /**
   * Process customer update
   */
  private async processCustomerUpdate(payload: any): Promise<void> {
    if (!this.shopifyAdmin) {
      throw new Error('Shopify admin required for customer updates');
    }

    const { customerId, metafields } = payload;

    if (!customerId || !metafields) {
      throw new Error('Customer update missing required fields');
    }

    await this.shopifyAdmin.graphql(`
      mutation updateCustomerMetafields($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        input: {
          id: customerId,
          metafields: metafields
        }
      }
    });
  }

  /**
   * Mark sync item as completed
   */
  async markCompleted(itemId: string, result?: any): Promise<void> {
    await prisma.offlineSyncQueue.update({
      where: { id: itemId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date()
      }
    });

    // Clean up old completed items periodically
    await this.cleanupOldItems();
  }

  /**
   * Mark sync item as failed
   */
  async markFailed(itemId: string, error: string): Promise<void> {
    await prisma.offlineSyncQueue.update({
      where: { id: itemId },
      data: {
        status: 'FAILED',
        error: error.substring(0, 500), // Limit error message length
        processedAt: new Date()
      }
    });
  }

  /**
   * Mark sync item as abandoned
   */
  async markAbandoned(itemId: string, error: string): Promise<void> {
    await prisma.offlineSyncQueue.update({
      where: { id: itemId },
      data: {
        status: 'ABANDONED',
        error: error.substring(0, 500),
        processedAt: new Date()
      }
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    abandoned: number;
  }> {
    const counts = await prisma.offlineSyncQueue.groupBy({
      by: ['status'],
      where: { shop: this.shop },
      _count: { status: true }
    });

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      abandoned: 0
    };

    counts.forEach(count => {
      stats[count.status.toLowerCase()] = count._count.status;
    });

    return stats;
  }

  /**
   * Get pending queue count
   */
  async getQueueCount(): Promise<number> {
    return prisma.offlineSyncQueue.count({
      where: {
        shop: this.shop,
        status: 'PENDING'
      }
    });
  }

  /**
   * Clear completed items from queue
   */
  async clearCompleted(): Promise<number> {
    const result = await prisma.offlineSyncQueue.deleteMany({
      where: {
        shop: this.shop,
        status: 'COMPLETED',
        processedAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Older than 24 hours
        }
      }
    });

    return result.count;
  }

  /**
   * Helper methods
   */
  private validatePayload(operationType: OperationType, payload: any): void {
    switch (operationType) {
      case 'CREDIT_REDEEM':
        if (!payload.creditNoteId || !payload.amount) {
          throw new Error('Credit redemption requires creditNoteId and amount');
        }
        break;

      case 'CREDIT_CREATE':
        if (!payload.customerId || !payload.amount) {
          throw new Error('Credit creation requires customerId and amount');
        }
        break;

      // Add other validations as needed
    }
  }

  private async updateItemStatus(itemId: string, status: SyncStatus): Promise<void> {
    await prisma.offlineSyncQueue.update({
      where: { id: itemId },
      data: { status }
    });
  }

  private calculateNextRetry(retryCount: number): Date {
    // Exponential backoff: 2^retryCount minutes
    const backoffMinutes = Math.pow(2, retryCount);
    return new Date(Date.now() + backoffMinutes * 60 * 1000);
  }

  private async scheduleRetry(
    itemId: string, 
    retryCount: number, 
    nextRetryAt: Date, 
    error: string
  ): Promise<void> {
    await prisma.offlineSyncQueue.update({
      where: { id: itemId },
      data: {
        status: 'PENDING',
        retryCount,
        nextRetryAt,
        error: error.substring(0, 500)
      }
    });
  }

  private async cleanupOldItems(): Promise<void> {
    // Remove completed items older than 7 days
    await prisma.offlineSyncQueue.deleteMany({
      where: {
        shop: this.shop,
        status: 'COMPLETED',
        processedAt: {
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });
  }

  private mapToSyncItem(queueItem: OfflineSyncQueue): OfflineSyncItem {
    return {
      id: queueItem.id,
      operation: queueItem.operation,
      operationType: queueItem.operationType,
      payload: queueItem.payload as Record<string, any>,
      retryCount: queueItem.retryCount,
      maxRetries: queueItem.maxRetries,
      status: queueItem.status,
      error: queueItem.error || undefined,
      posDeviceId: queueItem.posDeviceId || undefined,
      createdAt: queueItem.createdAt
    };
  }
}