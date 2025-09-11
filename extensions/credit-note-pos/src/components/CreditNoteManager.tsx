// Comprehensive Credit Note Management for POS
import React, { useState, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  TextField,
  Banner,
  QRCode,
  POSReceiptBlock
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { formatCreditAmount, generateCreditQRData } from '../utils/qrcode.utils';

const CreditNoteManager: React.FC = () => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State for credit note creation
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCredit, setCreatedCredit] = useState<CreditNote | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create new credit note with QR code
   */
  const handleCreateCredit = useCallback(async () => {
    if (!customerName.trim() || !amount || parseFloat(amount) <= 0) {
      setError('Please enter valid customer name and amount');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const amountValue = parseFloat(amount);
      const timestamp = Date.now();
      const creditId = `CN-${timestamp.toString().slice(-8)}`;

      // Create credit note object
      const creditNote: CreditNote = {
        id: creditId,
        noteNumber: creditId,
        customerId: `customer-${timestamp}`,
        customerName: customerName.trim(),
        originalAmount: amountValue,
        remainingAmount: amountValue,
        currency: 'USD',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shop: 'pos-created'
      };

      // Generate QR code data
      const qrData = generateCreditQRData(creditNote);
      creditNote.qrCode = JSON.stringify(qrData);

      // In a real implementation, save to backend
      // await saveCreditNote(creditNote);

      setCreatedCredit(creditNote);
      
      // Show success toast
      api.toast.show(
        `Credit note ${creditId} created successfully!`,
        'success'
      );

      // Clear form
      setCustomerName('');
      setAmount('');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create credit note');
    } finally {
      setCreating(false);
    }
  }, [customerName, amount, api]);

  /**
   * Print QR code receipt
   */
  const handlePrintQRCode = useCallback(async () => {
    if (!createdCredit) return;

    try {
      // Print QR code receipt
      await api.receipt.print({
        title: 'Store Credit',
        content: (
          <POSReceiptBlock>
            <Stack spacing="base" alignment="center">
              <Text size="large" weight="bold" alignment="center">
                STORE CREDIT
              </Text>
              
              <Text size="medium" alignment="center">
                Credit Note: {createdCredit.noteNumber}
              </Text>
              
              <Text size="large" weight="bold" alignment="center">
                Amount: {formatCreditAmount(createdCredit.originalAmount, createdCredit.currency)}
              </Text>
              
              <Text size="small" alignment="center">
                Customer: {createdCredit.customerName}
              </Text>
              
              <QRCode 
                data={createdCredit.qrCode || ''}
                size="large"
              />
              
              <Text size="small" alignment="center">
                Scan QR code to redeem credit
              </Text>
              
              <Text size="extraSmall" alignment="center">
                Created: {new Date(createdCredit.createdAt).toLocaleDateString()}
              </Text>
              
              <Text size="extraSmall" alignment="center">
                CreditCraft POS System
              </Text>
            </Stack>
          </POSReceiptBlock>
        )
      });

      api.toast.show('QR code receipt printed!', 'success');
      
    } catch (err) {
      setError('Failed to print QR code');
    }
  }, [createdCredit, api]);

  /**
   * View credit note details
   */
  const handleViewCredit = useCallback(() => {
    if (!createdCredit) return;
    
    // Navigate to credit details view
    // In a full implementation, this would show full credit history
    api.toast.show('Credit details would be displayed here', 'info');
  }, [createdCredit, api]);

  /**
   * Delete/void credit note
   */
  const handleDeleteCredit = useCallback(async () => {
    if (!createdCredit) return;

    try {
      // In real implementation, mark as voided in backend
      // await voidCreditNote(createdCredit.id);
      
      setCreatedCredit(null);
      api.toast.show('Credit note voided successfully', 'success');
      
    } catch (err) {
      setError('Failed to void credit note');
    }
  }, [createdCredit, api]);

  return (
    <Navigator>
      <Screen name="CreditManager" title="Credit Note Manager">
        <ScrollView>
          <Stack spacing="loose">
            {error && (
              <Banner status="critical">
                <Text>{error}</Text>
              </Banner>
            )}

            {/* Create New Credit Note */}
            <Stack spacing="base">
              <Text variant="headingMd">Create New Credit Note</Text>
              
              <TextField
                label="Customer Name"
                value={customerName}
                onChange={setCustomerName}
                placeholder="Enter customer name"
              />
              
              <TextField
                label="Credit Amount"
                type="number"
                value={amount}
                onChange={setAmount}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              
              <Button
                onPress={handleCreateCredit}
                title="Create Credit Note"
                variant="primary"
                loading={creating}
                disabled={creating || !customerName.trim() || !amount}
                fullWidth
              />
            </Stack>

            {/* Created Credit Note Display */}
            {createdCredit && (
              <Stack spacing="base">
                <Text variant="headingMd">Credit Note Created</Text>
                
                <Stack spacing="tight">
                  <Text variant="bodyMd">
                    ID: {createdCredit.noteNumber}
                  </Text>
                  <Text variant="bodyMd">
                    Customer: {createdCredit.customerName}
                  </Text>
                  <Text variant="headingSm">
                    Amount: {formatCreditAmount(createdCredit.originalAmount, createdCredit.currency)}
                  </Text>
                  <Text variant="bodySm">
                    Status: {createdCredit.status}
                  </Text>
                </Stack>

                {/* QR Code Display */}
                <Stack spacing="tight" alignment="center">
                  <Text variant="bodyMd">QR Code:</Text>
                  <QRCode 
                    data={createdCredit.qrCode || ''}
                    size="medium"
                  />
                  <Text variant="bodySm" alignment="center">
                    Scan to redeem credit
                  </Text>
                </Stack>

                {/* Action Buttons */}
                <Stack direction="horizontal" spacing="tight">
                  <Button
                    onPress={handlePrintQRCode}
                    title="Print QR Code"
                    variant="primary"
                  />
                  
                  <Button
                    onPress={handleViewCredit}
                    title="View Details"
                    variant="secondary"
                  />
                  
                  <Button
                    onPress={handleDeleteCredit}
                    title="Void Credit"
                    variant="secondary"
                    tone="critical"
                  />
                </Stack>
              </Stack>
            )}

            {/* Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">How to Use</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Enter customer name and credit amount</Text>
                <Text variant="bodySm">• Create credit note with QR code</Text>
                <Text variant="bodySm">• Print QR code receipt for customer</Text>
                <Text variant="bodySm">• Customer can scan QR code to redeem credit</Text>
                <Text variant="bodySm">• Use barcode scanner to redeem existing credits</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default CreditNoteManager;