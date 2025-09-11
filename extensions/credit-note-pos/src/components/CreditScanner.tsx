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
import { validateBarcode, validateQRCodePattern, extractCreditInfoFromBarcode } from '../utils/validation.utils';

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

  // Handle scanned data (QR codes and barcodes)
  useEffect(() => {
    if (scannedData && scanning) {
      handleScanResult(scannedData);
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
   * Handle scan result (QR codes, barcodes, etc.)
   */
  const handleScanResult = useCallback(async (scanData: string) => {
    setProcessing(true);
    
    try {
      // Detect scan type and format
      const scanType = detectScanType(scanData);
      let result;
      
      switch (scanType) {
        case 'QR_CODE':
          result = await validateCredit(scanData);
          break;
        case 'CREDIT_BARCODE':
          result = await validateCreditBarcode(scanData);
          break;
        case 'SIMPLE_CODE':
          result = await validateSimpleCode(scanData);
          break;
        default:
          throw new Error('Unsupported scan format. Please scan a valid credit QR code or barcode.');
      }
      
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
        onError?.(result.error || 'Invalid credit note or barcode');
        setScanning(false);
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Scan validation failed');
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
                <Text variant="headingSm">Scanning Instructions</Text>
                <Stack spacing="tight">
                  <Text variant="bodySm">• Point camera at credit QR code or barcode</Text>
                  <Text variant="bodySm">• Supports QR codes, credit barcodes, and numeric codes</Text>
                  <Text variant="bodySm">• Hold steady until scan completes</Text>
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
              Point camera at credit QR code or barcode
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

/**
 * Detect the type of scanned data
 */
function detectScanType(scanData: string): 'QR_CODE' | 'CREDIT_BARCODE' | 'SIMPLE_CODE' | 'UNKNOWN' {
  try {
    // Try parsing as JSON (QR code)
    const parsed = JSON.parse(scanData);
    if (parsed.type === 'credit_note') {
      return 'QR_CODE';
    }
  } catch {}
  
  // Check for simple credit format
  if (scanData.startsWith('CREDIT:')) {
    return 'SIMPLE_CODE';
  }
  
  // Check for credit barcode patterns
  if (/^CN[0-9]{4}[A-Z0-9]{8}$/.test(scanData) || /^[0-9]{12,14}$/.test(scanData)) {
    return 'CREDIT_BARCODE';
  }
  
  return 'UNKNOWN';
}

/**
 * Validate credit barcode (numeric or alphanumeric codes)
 */
async function validateCreditBarcode(barcodeData: string) {
  try {
    // First validate the barcode format
    const validation = validateBarcode(barcodeData);
    if (!validation.isValid) {
      return {
        valid: false,
        error: validation.errors.join(', ')
      };
    }

    // Extract credit info from barcode
    const creditInfo = extractCreditInfoFromBarcode(barcodeData);
    if (!creditInfo.isValid) {
      return {
        valid: false,
        error: 'Invalid credit note barcode format'
      };
    }

    // Here you would typically make an API call to validate the credit note
    // For now, return a structure that matches what the scanner expects
    return {
      valid: true,
      data: {
        id: `credit_${creditInfo.sequenceCode}`,
        noteNumber: creditInfo.noteNumber || barcodeData,
        remainingAmount: 100, // Would come from API
        originalAmount: 100,
        currency: 'USD',
        status: 'ACTIVE',
        customerId: 'customer_from_barcode',
        customerName: 'Barcode Customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Barcode validation failed'
    };
  }
}

/**
 * Validate simple credit codes
 */
async function validateSimpleCode(codeData: string) {
  try {
    // Parse simple format like "CREDIT:CN20240001:100.00:customer123"
    const parts = codeData.split(':');
    if (parts.length >= 4 && parts[0] === 'CREDIT') {
      const noteNumber = parts[1];
      const amount = parseFloat(parts[2]);
      const customerId = parts[3];
      
      // Validate the components
      if (!noteNumber || !amount || !customerId) {
        return {
          valid: false,
          error: 'Invalid simple code format - missing required fields'
        };
      }
      
      // Validate note number format
      if (!/^CN[0-9]{4}[A-Z0-9]{4,8}$/i.test(noteNumber)) {
        return {
          valid: false,
          error: 'Invalid credit note number format in simple code'
        };
      }
      
      // Validate amount
      if (isNaN(amount) || amount <= 0 || amount > 10000) {
        return {
          valid: false,
          error: 'Invalid amount in simple code'
        };
      }
      
      // Here you would validate with your API
      // For now, return a mock successful validation
      return {
        valid: true,
        data: {
          id: `credit_${noteNumber.toLowerCase()}`,
          noteNumber,
          remainingAmount: amount,
          originalAmount: amount,
          currency: parts[4] || 'USD', // Optional currency parameter
          status: 'ACTIVE',
          customerId,
          customerName: 'Simple Code Customer',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
    }
    
    return {
      valid: false,
      error: 'Invalid simple code format. Expected: CREDIT:noteNumber:amount:customerId'
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Simple code validation failed'
    };
  }
}

// Export as POS UI Extension
export default reactExtension('pos.home.modal.render', () => <CreditScanner 
  onCreditSelected={(credit) => console.log('Credit selected:', credit)}
  onError={(error) => console.error('Scanner error:', error)}
  autoApply={true}
/>);