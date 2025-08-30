// QR Scanner component for credit note validation and redemption
import React, { useState, useEffect, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  Badge,
  Banner,
  CameraScanner,
  useScannerDataSubscription,
  TextField
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote, CreditScannerProps } from '../types/credit.types';
import { useCreditOperations } from '../hooks/useCreditOperations';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCreditAmount, formatCreditNoteNumber } from '../utils/qrcode.utils';

const CreditScanner: React.FC<CreditScannerProps> = ({
  onCreditSelected,
  onError,
  autoApply = false
}) => {
  const api = useApi<'pos.home.modal.render'>();
  const { data: scannedData, error: scanError } = useScannerDataSubscription();
  
  // State
  const [scanning, setScanning] = useState(false);
  const [validatedCredit, setValidatedCredit] = useState<CreditNote | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showAmountModal, setShowAmountModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Hooks
  const { validateCredit, redeemCredit, loading, error } = useCreditOperations();
  const { addToQueue, isOnline } = useOfflineSync();

  // Handle scanned QR data
  useEffect(() => {
    if (scannedData && scanning) {
      handleQRScan(scannedData);
    }
  }, [scannedData, scanning]);

  // Handle scan errors
  useEffect(() => {
    if (scanError) {
      onError?.(scanError.message || 'Scanner error occurred');
      setScanning(false);
    }
  }, [scanError, onError]);

  // Display validation errors
  useEffect(() => {
    if (error) {
      onError?.(error);
    }
  }, [error, onError]);

  /**
   * Handle QR code scan result
   */
  const handleQRScan = useCallback(async (qrData: string) => {
    setProcessing(true);
    
    try {
      const result = await validateCredit(qrData);
      
      if (result.valid && result.data) {
        setValidatedCredit(result.data);
        setScanning(false);
        
        // Auto-apply logic
        if (autoApply) {
          const cart = await api.cart.subscribable.value;
          const cartTotal = cart.totalAmount || 0;
          
          if (result.data.remainingAmount >= cartTotal && cartTotal > 0) {
            // Auto-apply full cart amount
            await applyCredit(result.data, cartTotal);
          } else {
            // Show amount selection modal
            setShowAmountModal(true);
          }
        } else {
          // Just notify parent component
          onCreditSelected?.(result.data);
        }
      } else {
        onError?.(result.error || 'Invalid credit note');
        setScanning(false);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Validation failed');
      setScanning(false);
    } finally {
      setProcessing(false);
    }
  }, [validateCredit, autoApply, api.cart, onCreditSelected, onError]);

  /**
   * Apply credit to current transaction
   */
  const applyCredit = useCallback(async (credit: CreditNote, amount?: number) => {
    setProcessing(true);

    try {
      const cart = await api.cart.subscribable.value;
      const amountToApply = amount || Math.min(credit.remainingAmount, cart.totalAmount || 0);
      
      if (amountToApply <= 0) {
        onError?.('Invalid amount to apply');
        return;
      }

      // Apply discount to POS cart
      await api.cart.applyDiscount({
        type: 'FIXED_AMOUNT',
        amount: amountToApply,
        title: `Credit: ${formatCreditNoteNumber(credit.noteNumber)}`,
        reason: `Store credit redemption - ${credit.noteNumber}`
      });

      // Record redemption
      const redemption = {
        creditNoteId: credit.id,
        amount: amountToApply,
        orderId: cart.id,
        posDeviceId: getDeviceId(),
        staffId: await getStaffId(),
        staffName: await getStaffName(),
        metadata: {
          cartTotal: cart.totalAmount,
          appliedAt: new Date().toISOString()
        }
      };

      if (isOnline) {
        // Online redemption
        await redeemCredit(redemption);
      } else {
        // Offline - add to sync queue
        await addToQueue('CREDIT_REDEEM', redemption);
      }

      // Show success message
      api.toast.show(
        `Applied ${formatCreditAmount(amountToApply)} credit`,
        'success'
      );

      // Clear states
      setValidatedCredit(null);
      setCustomAmount('');
      setShowAmountModal(false);

    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to apply credit');
    } finally {
      setProcessing(false);
    }
  }, [api, redeemCredit, addToQueue, isOnline, onError]);

  /**
   * Handle custom amount application
   */
  const handleCustomAmountApply = useCallback(async () => {
    if (!validatedCredit) return;

    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      onError?.('Please enter a valid amount');
      return;
    }

    if (amount > validatedCredit.remainingAmount) {
      onError?.(`Amount cannot exceed available credit: ${formatCreditAmount(validatedCredit.remainingAmount)}`);
      return;
    }

    await applyCredit(validatedCredit, amount);
  }, [validatedCredit, customAmount, applyCredit, onError]);

  return (
    <Navigator>
      <Screen name="CreditScanner" title="Scan Credit Note">
        <ScrollView>
          <Stack spacing="loose">
            {/* Scanner Status */}
            <Stack spacing="base">
              <Text variant="headingMd">Credit Note Scanner</Text>
                
                {!isOnline && (
                  <Banner status="warning">
                    <Text>Offline mode - credits will sync when online</Text>
                  </Banner>
                )}

                <Stack direction="horizontal" spacing="tight">
                  <Button
                    onPress={() => setScanning(true)}
                    title={scanning ? "Scanning..." : "Scan QR Code"}
                    variant="primary"
                    loading={scanning || processing}
                    disabled={scanning || processing}
                    fullWidth
                  />
                  
                  {validatedCredit && (
                    <Button
                      onPress={() => {
                        setValidatedCredit(null);
                        setCustomAmount('');
                      }}
                      title="Clear"
                      variant="secondary"
                    />
                  )}
                </Stack>
            </Stack>

            {/* Validated Credit Display */}
            {validatedCredit && (
              <Stack spacing="base">
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="headingMd">Credit Validated</Text>
                    <Badge status="success">Active</Badge>
                  </Stack>
                  
                  <Stack spacing="tight">
                    <Text variant="bodyMd" color="subdued">
                      {formatCreditNoteNumber(validatedCredit.noteNumber)}
                    </Text>
                    
                    <Text variant="headingSm">
                      Available: {formatCreditAmount(validatedCredit.remainingAmount, validatedCredit.currency)}
                    </Text>
                    
                    {validatedCredit.customerName && (
                      <Text variant="bodySm">
                        Customer: {validatedCredit.customerName}
                      </Text>
                    )}
                    
                    {validatedCredit.expiresAt && (
                      <Text variant="bodySm" color="subdued">
                        Expires: {new Date(validatedCredit.expiresAt).toLocaleDateString()}
                      </Text>
                    )}
                  </Stack>

                  <Stack direction="horizontal" spacing="tight">
                    <Button
                      onPress={() => applyCredit(validatedCredit)}
                      title="Apply Full Amount"
                      variant="primary"
                      loading={processing}
                      disabled={processing}
                    />
                    
                    <Button
                      onPress={() => setShowAmountModal(true)}
                      title="Custom Amount"
                      variant="secondary"
                      disabled={processing}
                    />
                  </Stack>
              </Stack>
            )}

            {/* Scanner Instructions */}
            <Stack spacing="base">
                <Text variant="headingSm">Instructions</Text>
                <Stack spacing="tight">
                  <Text variant="bodySm">• Point camera at credit note QR code</Text>
                  <Text variant="bodySm">• Ensure QR code is clearly visible</Text>
                  <Text variant="bodySm">• Credit will be validated automatically</Text>
                  {!isOnline && (
                    <Text variant="bodySm" color="warning">• Offline mode: Changes sync when online</Text>
                  )}
                </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>

      {/* Scanner Screen */}
      {scanning && (
        <Screen name="ScannerView" title="Scanning QR Code">
          <Stack spacing="loose" alignment="center">
            <CameraScanner />
            
            <Text alignment="center">
              Point camera at credit note QR code
            </Text>
            
            {processing && (
              <Banner status="info">
                <Text>Processing scanned code...</Text>
              </Banner>
            )}
            
            <Button
              onPress={() => {
                setScanning(false);
                setProcessing(false);
              }}
              title="Cancel"
              variant="secondary"
              fullWidth
            />
          </Stack>
        </Screen>
      )}

      {/* Custom Amount Modal */}
      {showAmountModal && validatedCredit && (
        <Screen name="CustomAmountModal" title="Enter Amount">
          <Stack spacing="base">
            <Text variant="bodySm">
              Available credit: {formatCreditAmount(validatedCredit.remainingAmount)}
            </Text>
            
            <TextField
              label="Amount to Apply"
              type="number"
              value={customAmount}
              onChange={setCustomAmount}
              placeholder="0.00"
              step="0.01"
              min="0"
              max={validatedCredit.remainingAmount.toString()}
            />
            
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={handleCustomAmountApply}
                title="Apply"
                variant="primary"
                loading={processing}
                disabled={processing || !customAmount}
              />
              
              <Button
                onPress={() => {
                  setShowAmountModal(false);
                  setCustomAmount('');
                }}
                title="Cancel"
                variant="secondary"
              />
            </Stack>
          </Stack>
        </Screen>
      )}
    </Navigator>
  );
};

/**
 * Get device ID for POS tracking
 */
function getDeviceId(): string {
  if (typeof window !== 'undefined') {
    let deviceId = localStorage.getItem('pos_device_id');
    if (!deviceId) {
      deviceId = `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('pos_device_id', deviceId);
    }
    return deviceId;
  }
  return 'unknown';
}

/**
 * Get current staff ID (placeholder - implement based on POS API)
 */
async function getStaffId(): Promise<string> {
  // TODO: Implement staff ID retrieval from POS API
  return 'staff_default';
}

/**
 * Get current staff name (placeholder - implement based on POS API)
 */
async function getStaffName(): Promise<string> {
  // TODO: Implement staff name retrieval from POS API
  return 'Staff Member';
}

// Export as POS UI Extension
export default reactExtension('pos.home.modal.render', () => <CreditScanner 
  onCreditSelected={(credit) => console.log('Credit selected:', credit)}
  onError={(error) => console.error('Scanner error:', error)}
  autoApply={true}
/>);