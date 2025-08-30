// Receipt printing component for credit note transactions
import React from 'react';
import {
  reactExtension,
  useApi,
  POSReceiptBlock,
  Text,
  QRCode,
  Stack
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditReceiptProps } from '../types/credit.types';
import { formatCreditAmount, formatCreditNoteNumber } from '../utils/qrcode.utils';

const CreditReceipt: React.FC<CreditReceiptProps> = ({
  transaction,
  creditNote,
  showQR = true
}) => {
  const api = useApi<'pos.purchase.post.action.render'>();

  // Get transaction and order data from POS API
  const posTransaction = api.transaction;
  const order = posTransaction?.order;

  // Only render if this is a credit transaction
  if (!transaction || !creditNote) {
    return null;
  }

  // Generate receipt QR code data for transaction verification
  const receiptQRData = JSON.stringify({
    type: 'credit_receipt',
    transactionId: transaction.id,
    creditNoteNumber: creditNote.noteNumber,
    amount: transaction.amount,
    timestamp: transaction.createdAt,
    orderId: transaction.orderId || order?.id,
    shop: creditNote.shop || 'unknown'
  });

  return (
    <POSReceiptBlock>
      <Stack spacing="base" alignment="center">
        {/* Header */}
        <Text size="large" alignment="center" weight="bold">
          STORE CREDIT APPLIED
        </Text>

        <BlockSpacer spacing="base" />

        {/* Credit Note Information */}
        <Stack spacing="tight" alignment="center">
          <Text size="medium" weight="bold">
            Credit Note: {formatCreditNoteNumber(creditNote.noteNumber)}
          </Text>
          
          <Text size="large" weight="bold">
            Amount Applied: {formatCreditAmount(transaction.amount, creditNote.currency)}
          </Text>

          {creditNote.customerName && (
            <Text size="small">
              Customer: {creditNote.customerName}
            </Text>
          )}

          {creditNote.remainingAmount > 0 && (
            <Text size="small">
              Remaining Balance: {formatCreditAmount(creditNote.remainingAmount, creditNote.currency)}
            </Text>
          )}
        </Stack>

        <Divider />

        {/* Transaction Details */}
        <Stack spacing="tight" alignment="center">
          <Text size="small">
            Transaction Date: {new Date(transaction.createdAt).toLocaleString()}
          </Text>

          {transaction.staffName && (
            <Text size="small">
              Processed by: {transaction.staffName}
            </Text>
          )}

          {transaction.posDeviceId && (
            <Text size="small">
              Device: {transaction.posDeviceId}
            </Text>
          )}

          {order?.orderNumber && (
            <Text size="small">
              Order: {order.orderNumber}
            </Text>
          )}
        </Stack>

        {/* QR Code for verification */}
        {showQR && (
          <>
            <BlockSpacer spacing="base" />
            
            <Stack spacing="tight" alignment="center">
              <QRCode 
                data={receiptQRData}
                size="small"
              />
              
              <Text size="small" alignment="center">
                Scan for transaction verification
              </Text>
            </Stack>
          </>
        )}

        <Divider />

        {/* Footer */}
        <Stack spacing="extraTight" alignment="center">
          <Text size="small" alignment="center">
            Thank you for using store credit!
          </Text>
          
          {creditNote.expiresAt && creditNote.remainingAmount > 0 && (
            <Text size="small" alignment="center">
              Remaining credit expires: {new Date(creditNote.expiresAt).toLocaleDateString()}
            </Text>
          )}
          
          <Text size="extraSmall" alignment="center">
            CreditCraft POS System
          </Text>
        </Stack>
      </Stack>
    </POSReceiptBlock>
  );
};

/**
 * Credit Summary Receipt Block
 * Shows summary when multiple credits are applied
 */
export const CreditSummaryReceipt: React.FC<{
  transactions: any[];
  totalApplied: number;
  currency?: string;
}> = ({ transactions, totalApplied, currency = 'USD' }) => {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  return (
    <POSReceiptBlock>
      <Stack spacing="base" alignment="center">
        <Text size="large" alignment="center" weight="bold">
          MULTIPLE STORE CREDITS APPLIED
        </Text>

        <BlockSpacer spacing="base" />

        <Text size="large" weight="bold">
          Total Applied: {formatCreditAmount(totalApplied, currency)}
        </Text>

        <Divider />

        <Stack spacing="tight">
          {transactions.map((transaction, index) => (
            <Stack key={transaction.id || index} direction="horizontal" alignment="space-between">
              <Text size="small">
                {transaction.creditNote?.noteNumber || `Credit ${index + 1}`}
              </Text>
              <Text size="small" weight="bold">
                {formatCreditAmount(transaction.amount, currency)}
              </Text>
            </Stack>
          ))}
        </Stack>

        <Divider />

        <Stack spacing="extraTight" alignment="center">
          <Text size="small" alignment="center">
            Thank you for using store credit!
          </Text>
          <Text size="extraSmall" alignment="center">
            CreditCraft POS System
          </Text>
        </Stack>
      </Stack>
    </POSReceiptBlock>
  );
};

/**
 * Credit Balance Receipt Block
 * Shows customer's remaining credit balance
 */
export const CreditBalanceReceipt: React.FC<{
  customerName?: string;
  totalBalance: number;
  activeCredits: number;
  currency?: string;
}> = ({ customerName, totalBalance, activeCredits, currency = 'USD' }) => {
  if (totalBalance <= 0) {
    return null;
  }

  return (
    <POSReceiptBlock>
      <Stack spacing="base" alignment="center">
        <Text size="medium" alignment="center" weight="bold">
          STORE CREDIT BALANCE
        </Text>

        <BlockSpacer spacing="tight" />

        {customerName && (
          <Text size="small" alignment="center">
            {customerName}
          </Text>
        )}

        <Text size="large" weight="bold">
          Available Balance: {formatCreditAmount(totalBalance, currency)}
        </Text>

        <Text size="small">
          Active Credits: {activeCredits}
        </Text>

        <BlockSpacer spacing="tight" />

        <Stack spacing="extraTight" alignment="center">
          <Text size="small" alignment="center">
            Use your credits on your next visit!
          </Text>
          <Text size="extraSmall" alignment="center">
            CreditCraft POS System
          </Text>
        </Stack>
      </Stack>
    </POSReceiptBlock>
  );
};

/**
 * Credit Expiration Warning Receipt Block
 */
export const CreditExpirationWarning: React.FC<{
  expiringCredits: Array<{
    noteNumber: string;
    amount: number;
    expiresAt: string;
  }>;
  currency?: string;
}> = ({ expiringCredits, currency = 'USD' }) => {
  if (!expiringCredits || expiringCredits.length === 0) {
    return null;
  }

  return (
    <POSReceiptBlock>
      <Stack spacing="base" alignment="center">
        <Text size="medium" alignment="center" weight="bold">
          ⚠️ CREDITS EXPIRING SOON ⚠️
        </Text>

        <BlockSpacer spacing="base" />

        <Stack spacing="tight">
          {expiringCredits.map((credit, index) => (
            <Stack key={index} spacing="extraTight" alignment="center">
              <Stack direction="horizontal" alignment="space-between">
                <Text size="small">{credit.noteNumber}</Text>
                <Text size="small" weight="bold">
                  {formatCreditAmount(credit.amount, currency)}
                </Text>
              </Stack>
              <Text size="extraSmall">
                Expires: {new Date(credit.expiresAt).toLocaleDateString()}
              </Text>
            </Stack>
          ))}
        </Stack>

        <BlockSpacer spacing="base" />

        <Stack spacing="extraTight" alignment="center">
          <Text size="small" alignment="center" weight="bold">
            Use your credits before they expire!
          </Text>
          <Text size="extraSmall" alignment="center">
            CreditCraft POS System
          </Text>
        </Stack>
      </Stack>
    </POSReceiptBlock>
  );
};

// Export main receipt component as POS UI Extension
export default reactExtension('pos.purchase.post.action.render', () => {
  const api = useApi<'pos.purchase.post.action.render'>();
  
  // Get transaction data
  const transaction = api.transaction;
  
  // Check if this transaction involved credit redemption
  const creditDiscount = transaction?.discounts?.find(discount => 
    discount.title?.includes('Credit:') || discount.title?.includes('Credit Note')
  );

  // Only render if there was a credit applied
  if (!creditDiscount) {
    return null;
  }

  // Extract credit info from discount title (assuming format: "Credit: CN-2024-0001")
  const creditNoteNumber = creditDiscount.title?.split('Credit:')[1]?.trim();
  
  // Mock credit note data (in real implementation, this would be fetched)
  const mockCreditNote = {
    id: 'mock-id',
    noteNumber: creditNoteNumber || 'CN-UNKNOWN',
    remainingAmount: 0, // Would be calculated
    currency: 'USD',
    shop: 'example-shop'
  };

  const mockTransaction = {
    id: `tx-${Date.now()}`,
    amount: creditDiscount.amount || 0,
    createdAt: new Date().toISOString(),
    orderId: transaction?.order?.id
  };

  return (
    <CreditReceipt
      transaction={mockTransaction}
      creditNote={mockCreditNote}
      showQR={true}
    />
  );
});