// Advanced QR Code Printing and Receipt System for Credit Notes
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
  POSReceiptBlock,
  QRCode,
  Badge
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { formatCreditAmount, formatCreditNoteNumber, generateCreditQRData } from '../utils/qrcode.utils';

interface QRCodePrintSystemProps {
  onReceiptPrinted?: (credit: CreditNote) => void;
  onError?: (error: string) => void;
}

const QRCodePrintSystem: React.FC<QRCodePrintSystemProps> = ({
  onReceiptPrinted,
  onError
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State for credit creation
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [expirationDays, setExpirationDays] = useState('365');
  const [notes, setNotes] = useState('');
  
  // State for printing
  const [processing, setProcessing] = useState(false);
  const [createdCredits, setCreatedCredits] = useState<CreditNote[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<'standard' | 'gift' | 'refund'>('standard');

  /**
   * Create new credit note with QR code
   */
  const handleCreateCredit = useCallback(async () => {
    if (!customerName.trim() || !amount || parseFloat(amount) <= 0) {
      onError?.('Please enter valid customer name and amount');
      return;
    }

    try {
      setProcessing(true);
      
      const amountValue = parseFloat(amount);
      const timestamp = Date.now();
      const creditId = `CN-${new Date().getFullYear()}-${timestamp.toString().slice(-6)}`;
      
      // Calculate expiration date
      const expiresAt = expirationDays !== '0' 
        ? new Date(Date.now() + parseInt(expirationDays) * 24 * 60 * 60 * 1000)
        : null;

      const newCredit: CreditNote = {
        id: creditId,
        noteNumber: creditId,
        customerId: `pos-${timestamp}`,
        customerName: customerName.trim(),
        originalAmount: amountValue,
        remainingAmount: amountValue,
        currency: currency,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: expiresAt?.toISOString() || null,
        shop: 'pos-created',
        notes: notes.trim() || undefined
      };

      // Generate comprehensive QR code data
      const qrData = generateCreditQRData(newCredit);
      newCredit.qrCode = JSON.stringify(qrData);

      // Add to created credits list
      setCreatedCredits(prev => [newCredit, ...prev]);

      // Show success message
      api.toast.show(
        `Credit note ${creditId} created successfully!`,
        'success'
      );

      // Clear form
      setCustomerName('');
      setAmount('');
      setNotes('');

      return newCredit;
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to create credit note');
      return null;
    } finally {
      setProcessing(false);
    }
  }, [customerName, amount, currency, expirationDays, notes, api, onError]);

  /**
   * Print QR code receipt using selected template
   */
  const handlePrintQRReceipt = useCallback(async (credit: CreditNote) => {
    try {
      setProcessing(true);
      
      const receiptContent = generateReceiptContent(credit, selectedTemplate);
      
      // Print receipt
      await api.receipt.print({
        title: 'Store Credit',
        content: receiptContent
      });

      onReceiptPrinted?.(credit);
      
      api.toast.show(`Receipt printed for ${credit.noteNumber}`, 'success');
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to print receipt');
    } finally {
      setProcessing(false);
    }
  }, [api, selectedTemplate, onReceiptPrinted, onError]);

  /**
   * Print multiple QR codes in batch
   */
  const handleBatchPrint = useCallback(async () => {
    try {
      setProcessing(true);
      
      for (const credit of createdCredits) {
        const receiptContent = generateReceiptContent(credit, selectedTemplate);
        
        await api.receipt.print({
          title: `Store Credit - ${credit.noteNumber}`,
          content: receiptContent
        });
        
        // Small delay between prints
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      api.toast.show(`Printed ${createdCredits.length} credit receipts`, 'success');
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to print batch receipts');
    } finally {
      setProcessing(false);
    }
  }, [createdCredits, api, selectedTemplate, onError]);

  /**
   * Clear all created credits
   */
  const handleClearCredits = useCallback(() => {
    setCreatedCredits([]);
    api.toast.show('Credit list cleared', 'info');
  }, [api]);

  return (
    <Navigator>
      <Screen name="QRPrintSystem" title="QR Code Print System">
        <ScrollView>
          <Stack spacing="loose">
            {/* Create Credit Section */}
            <Stack spacing="base">
              <Text variant="headingMd">Create New Credit Note</Text>
              
              <TextField
                label="Customer Name"
                value={customerName}
                onChange={setCustomerName}
                placeholder="Enter customer name"
                requiredIndicator
              />
              
              <Stack direction="horizontal" spacing="tight">
                <TextField
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={setAmount}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  requiredIndicator
                />
                
                <TextField
                  label="Currency"
                  value={currency}
                  onChange={setCurrency}
                  placeholder="USD"
                />
              </Stack>
              
              <TextField
                label="Expiration (days)"
                type="number"
                value={expirationDays}
                onChange={setExpirationDays}
                placeholder="365"
                helpText="Enter 0 for no expiration"
              />
              
              <TextField
                label="Notes (optional)"
                value={notes}
                onChange={setNotes}
                placeholder="Additional notes for this credit"
                multiline
              />
              
              <Button
                onPress={handleCreateCredit}
                title="Create Credit Note"
                variant="primary"
                loading={processing}
                disabled={processing || !customerName.trim() || !amount}
                fullWidth
              />
            </Stack>

            {/* Template Selection */}
            <Stack spacing="base">
              <Text variant="headingSm">Receipt Template</Text>
              
              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => setSelectedTemplate('standard')}
                  title="Standard"
                  variant={selectedTemplate === 'standard' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setSelectedTemplate('gift')}
                  title="Gift Card"
                  variant={selectedTemplate === 'gift' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setSelectedTemplate('refund')}
                  title="Refund"
                  variant={selectedTemplate === 'refund' ? 'primary' : 'secondary'}
                />
              </Stack>
            </Stack>

            {/* Created Credits List */}
            {createdCredits.length > 0 && (
              <Stack spacing="base">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="headingMd">Created Credits ({createdCredits.length})</Text>
                  
                  <Stack direction="horizontal" spacing="tight">
                    <Button
                      onPress={handleBatchPrint}
                      title="Print All"
                      variant="primary"
                      loading={processing}
                      disabled={processing}
                    />
                    
                    <Button
                      onPress={handleClearCredits}
                      title="Clear"
                      variant="secondary"
                    />
                  </Stack>
                </Stack>
                
                {createdCredits.map((credit, index) => (
                  <Stack key={credit.id} spacing="tight">
                    <Stack direction="horizontal" alignment="space-between">
                      <Stack spacing="extraTight">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {credit.noteNumber}
                        </Text>
                        <Text variant="bodySm">
                          {credit.customerName} • {formatCreditAmount(credit.originalAmount, credit.currency)}
                        </Text>
                        {credit.expiresAt && (
                          <Text variant="bodySm" color="subdued">
                            Expires: {new Date(credit.expiresAt).toLocaleDateString()}
                          </Text>
                        )}
                      </Stack>
                      
                      <Stack direction="horizontal" spacing="tight">
                        <Badge tone="success" size="small">Active</Badge>
                        
                        <Button
                          onPress={() => handlePrintQRReceipt(credit)}
                          title="Print"
                          variant="secondary"
                          loading={processing}
                          disabled={processing}
                        />
                      </Stack>
                    </Stack>
                    
                    {/* QR Code Preview */}
                    <Stack alignment="center" spacing="tight">
                      <QRCode 
                        data={credit.qrCode || ''}
                        size="small"
                      />
                      <Text variant="bodySm" alignment="center">
                        QR Code Preview
                      </Text>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Template Preview */}
            {createdCredits.length > 0 && (
              <Stack spacing="base">
                <Text variant="headingSm">Receipt Preview ({selectedTemplate})</Text>
                
                <Stack alignment="center">
                  {generateReceiptContent(createdCredits[0], selectedTemplate)}
                </Stack>
              </Stack>
            )}

            {/* Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">How to Use</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">1. Enter customer details and credit amount</Text>
                <Text variant="bodySm">2. Select expiration period (0 for no expiration)</Text>
                <Text variant="bodySm">3. Choose receipt template style</Text>
                <Text variant="bodySm">4. Create credit note with QR code</Text>
                <Text variant="bodySm">5. Print individual receipts or batch print all</Text>
                <Text variant="bodySm">6. Customer scans QR code to redeem credit</Text>
              </Stack>
            </Stack>

            {/* QR Code Information */}
            <Stack spacing="base">
              <Text variant="headingSm">QR Code Contains</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Credit note number and amount</Text>
                <Text variant="bodySm">• Customer identification</Text>
                <Text variant="bodySm">• Expiration date (if applicable)</Text>
                <Text variant="bodySm">• Security hash for validation</Text>
                <Text variant="bodySm">• Creation timestamp</Text>
                <Text variant="bodySm">• Shop identifier</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

/**
 * Generate receipt content based on template
 */
function generateReceiptContent(credit: CreditNote, template: 'standard' | 'gift' | 'refund') {
  const baseContent = (
    <POSReceiptBlock>
      <Stack spacing="base" alignment="center">
        {/* Header based on template */}
        <Text size="large" weight="bold" alignment="center">
          {template === 'gift' ? 'GIFT CARD' : 
           template === 'refund' ? 'REFUND CREDIT' : 
           'STORE CREDIT'}
        </Text>
        
        {/* Credit details */}
        <Stack spacing="tight" alignment="center">
          <Text size="medium" alignment="center">
            Credit Note: {formatCreditNoteNumber(credit.noteNumber)}
          </Text>
          
          <Text size="large" weight="bold" alignment="center">
            {formatCreditAmount(credit.originalAmount, credit.currency)}
          </Text>
          
          <Text size="small" alignment="center">
            For: {credit.customerName}
          </Text>
          
          {credit.expiresAt && (
            <Text size="small" alignment="center">
              Expires: {new Date(credit.expiresAt).toLocaleDateString()}
            </Text>
          )}
        </Stack>

        {/* QR Code */}
        <QRCode 
          data={credit.qrCode || ''}
          size="large"
        />
        
        <Text size="small" alignment="center">
          Scan QR code to redeem
        </Text>

        {/* Template-specific messages */}
        {template === 'gift' && (
          <Stack spacing="extraTight" alignment="center">
            <Text size="small" alignment="center" weight="bold">
              🎁 Gift Card
            </Text>
            <Text size="small" alignment="center">
              This gift card can be used for future purchases
            </Text>
          </Stack>
        )}
        
        {template === 'refund' && (
          <Stack spacing="extraTight" alignment="center">
            <Text size="small" alignment="center" weight="bold">
              💰 Refund Credit
            </Text>
            <Text size="small" alignment="center">
              This credit represents a refund for returned items
            </Text>
          </Stack>
        )}

        {template === 'standard' && (
          <Stack spacing="extraTight" alignment="center">
            <Text size="small" alignment="center" weight="bold">
              💳 Store Credit
            </Text>
            <Text size="small" alignment="center">
              Use this credit for future purchases at our store
            </Text>
          </Stack>
        )}

        {/* Instructions */}
        <Stack spacing="extraTight" alignment="center">
          <Text size="small" alignment="center">
            How to use:
          </Text>
          <Text size="small" alignment="center">
            1. Present this receipt at checkout
          </Text>
          <Text size="small" alignment="center">
            2. Staff will scan the QR code
          </Text>
          <Text size="small" alignment="center">
            3. Credit will be applied to your purchase
          </Text>
        </Stack>

        {/* Footer */}
        <Stack spacing="extraTight" alignment="center">
          <Text size="extraSmall" alignment="center">
            Created: {new Date(credit.createdAt).toLocaleDateString()}
          </Text>
          
          {credit.notes && (
            <Text size="extraSmall" alignment="center">
              Note: {credit.notes}
            </Text>
          )}
          
          <Text size="extraSmall" alignment="center">
            CreditCraft POS System • Receipt #{credit.id.substring(0, 8)}
          </Text>
          
          <Text size="extraSmall" alignment="center">
            Thank you for your business!
          </Text>
        </Stack>
      </Stack>
    </POSReceiptBlock>
  );

  return baseContent;
}

export default QRCodePrintSystem;