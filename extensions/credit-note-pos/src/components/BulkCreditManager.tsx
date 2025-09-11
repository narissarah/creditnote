// Bulk Credit Management component for high-volume POS operations
import React, { useState, useCallback, useEffect } from 'react';
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
  TextField
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { useCreditOperations } from '../hooks/useCreditOperations';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCreditAmount, formatCreditNoteNumber } from '../utils/qrcode.utils';
import { validateBarcode, extractCreditInfoFromBarcode } from '../utils/validation.utils';

interface BulkOperation {
  id: string;
  type: 'SCAN' | 'APPLY' | 'VALIDATE' | 'PRINT';
  creditNote?: CreditNote;
  amount?: number;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
  error?: string;
  timestamp: string;
}

interface BulkCreditManagerProps {
  onBulkComplete?: (results: BulkOperation[]) => void;
  onError?: (error: string) => void;
  maxOperations?: number;
}

const BulkCreditManager: React.FC<BulkCreditManagerProps> = ({
  onBulkComplete,
  onError,
  maxOperations = 50
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [operations, setOperations] = useState<BulkOperation[]>([]);
  const [batchInput, setBatchInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string | null>(null);
  const [totalAmount, setTotalAmount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  
  // Hooks
  const { validateCredit, redeemCredit, loading } = useCreditOperations();
  const { isOnline, addToQueue } = useOfflineSync();

  // Update counters when operations change
  useEffect(() => {
    const successful = operations.filter(op => op.status === 'SUCCESS').length;
    const failed = operations.filter(op => op.status === 'ERROR').length;
    const total = operations.reduce((sum, op) => {
      return sum + (op.amount || 0);
    }, 0);
    
    setSuccessCount(successful);
    setErrorCount(failed);
    setTotalAmount(total);
  }, [operations]);

  /**
   * Parse batch input (multiple codes/barcodes)
   */
  const parseBatchInput = useCallback((input: string): string[] => {
    return input
      .split(/[\n,;\t]/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, maxOperations);
  }, [maxOperations]);

  /**
   * Add single operation to batch
   */
  const addOperation = useCallback((
    type: BulkOperation['type'],
    creditNote?: CreditNote,
    amount?: number
  ) => {
    const operation: BulkOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      creditNote,
      amount,
      status: 'PENDING',
      timestamp: new Date().toISOString()
    };

    setOperations(prev => [...prev, operation]);
    return operation.id;
  }, []);

  /**
   * Update operation status
   */
  const updateOperation = useCallback((
    id: string,
    updates: Partial<BulkOperation>
  ) => {
    setOperations(prev => prev.map(op =>
      op.id === id ? { ...op, ...updates } : op
    ));
  }, []);

  /**
   * Process batch codes/barcodes
   */
  const processBatchCodes = useCallback(async () => {
    if (!batchInput.trim()) {
      onError?.('Please enter credit codes or barcodes to process');
      return;
    }

    const codes = parseBatchInput(batchInput);
    if (codes.length === 0) {
      onError?.('No valid codes found in input');
      return;
    }

    if (codes.length > maxOperations) {
      onError?.(`Too many codes. Maximum ${maxOperations} allowed per batch.`);
      return;
    }

    setProcessing(true);
    setCurrentOperation('Validating codes...');

    try {
      for (const [index, code] of codes.entries()) {
        setCurrentOperation(`Processing ${index + 1} of ${codes.length}...`);
        
        const operationId = addOperation('VALIDATE');
        
        try {
          // Validate the code/barcode
          const barcodeValidation = validateBarcode(code);
          
          if (barcodeValidation.isValid) {
            // Extract credit info from barcode
            const creditInfo = extractCreditInfoFromBarcode(code);
            
            if (creditInfo.isValid && creditInfo.noteNumber) {
              // Validate with API
              const result = await validateCredit(code);
              
              if (result.valid && result.data) {
                updateOperation(operationId, {
                  status: 'SUCCESS',
                  creditNote: result.data,
                  type: 'VALIDATE'
                });
              } else {
                updateOperation(operationId, {
                  status: 'ERROR',
                  error: result.error || 'Credit validation failed'
                });
              }
            } else {
              updateOperation(operationId, {
                status: 'ERROR',
                error: 'Invalid credit barcode format'
              });
            }
          } else {
            // Try as QR code
            try {
              const result = await validateCredit(code);
              
              if (result.valid && result.data) {
                updateOperation(operationId, {
                  status: 'SUCCESS',
                  creditNote: result.data,
                  type: 'VALIDATE'
                });
              } else {
                updateOperation(operationId, {
                  status: 'ERROR',
                  error: result.error || 'Invalid credit code'
                });
              }
            } catch (err) {
              updateOperation(operationId, {
                status: 'ERROR',
                error: 'Code validation failed'
              });
            }
          }
        } catch (error) {
          updateOperation(operationId, {
            status: 'ERROR',
            error: error instanceof Error ? error.message : 'Processing failed'
          });
        }

        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      api.toast.show(
        `Processed ${codes.length} codes. ${successCount} successful, ${errorCount} failed.`,
        'success'
      );

    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Batch processing failed');
    } finally {
      setProcessing(false);
      setCurrentOperation(null);
    }
  }, [batchInput, parseBatchInput, addOperation, updateOperation, validateCredit, api.toast, successCount, errorCount, maxOperations, onError]);

  /**
   * Apply all valid credits to current cart
   */
  const applyAllCredits = useCallback(async () => {
    const validCredits = operations.filter(op => 
      op.status === 'SUCCESS' && op.creditNote
    );

    if (validCredits.length === 0) {
      onError?.('No valid credits to apply');
      return;
    }

    setProcessing(true);
    setCurrentOperation('Applying credits to cart...');

    try {
      const cart = await api.cart.subscribable.value;
      const cartTotal = cart.totalAmount || 0;
      let remainingCartAmount = cartTotal;
      let appliedCount = 0;

      for (const operation of validCredits) {
        if (remainingCartAmount <= 0) break;
        if (!operation.creditNote) continue;

        const amountToApply = Math.min(
          operation.creditNote.remainingAmount,
          remainingCartAmount
        );

        if (amountToApply > 0) {
          try {
            setCurrentOperation(`Applying credit ${operation.creditNote.noteNumber}...`);
            
            // Apply discount to cart
            await api.cart.applyDiscount({
              type: 'FIXED_AMOUNT',
              amount: amountToApply,
              title: `Credit: ${formatCreditNoteNumber(operation.creditNote.noteNumber)}`,
              reason: `Bulk credit application - ${operation.creditNote.noteNumber}`
            });

            // Record redemption
            const redemption = {
              creditNoteId: operation.creditNote.id,
              amount: amountToApply,
              orderId: cart.id,
              posDeviceId: getDeviceId(),
              staffId: await getStaffId(),
              staffName: await getStaffName(),
              metadata: {
                bulkOperation: true,
                cartTotal,
                appliedAt: new Date().toISOString()
              }
            };

            if (isOnline) {
              await redeemCredit(redemption);
            } else {
              await addToQueue('CREDIT_REDEEM', redemption);
            }

            updateOperation(operation.id, {
              type: 'APPLY',
              amount: amountToApply,
              status: 'SUCCESS'
            });

            remainingCartAmount -= amountToApply;
            appliedCount++;

          } catch (error) {
            updateOperation(operation.id, {
              status: 'ERROR',
              error: error instanceof Error ? error.message : 'Application failed'
            });
          }
        }
      }

      api.toast.show(
        `Applied ${appliedCount} credits totaling ${formatCreditAmount(cartTotal - remainingCartAmount)}`,
        'success'
      );

      if (onBulkComplete) {
        onBulkComplete(operations);
      }

    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Bulk application failed');
    } finally {
      setProcessing(false);
      setCurrentOperation(null);
    }
  }, [operations, api.cart, api.toast, redeemCredit, addToQueue, isOnline, updateOperation, onBulkComplete, onError]);

  /**
   * Clear all operations
   */
  const clearOperations = useCallback(() => {
    setOperations([]);
    setBatchInput('');
    setTotalAmount(0);
    setSuccessCount(0);
    setErrorCount(0);
  }, []);

  /**
   * Export results for reporting
   */
  const exportResults = useCallback(() => {
    const csvData = operations.map(op => ({
      id: op.id,
      type: op.type,
      status: op.status,
      creditNumber: op.creditNote?.noteNumber || 'N/A',
      amount: op.amount || 0,
      error: op.error || '',
      timestamp: op.timestamp
    }));

    // In a real implementation, this would trigger a download
    api.toast.show('Export feature would be implemented here', 'info');
  }, [operations, api.toast]);

  return (
    <Navigator>
      <Screen name="BulkCreditManager" title="Bulk Credit Manager">
        <ScrollView>
          <Stack spacing="base">
            {/* Status Banner */}
            {!isOnline && (
              <Banner status="warning">
                <Text>Offline mode - operations will sync when online</Text>
              </Banner>
            )}

            {processing && currentOperation && (
              <Banner status="info">
                <Text>{currentOperation}</Text>
              </Banner>
            )}

            {/* Batch Input */}
            <Stack spacing="base">
              <Text variant="headingSm">Batch Credit Processing</Text>
              
              <TextField
                label="Credit Codes/Barcodes"
                value={batchInput}
                onChange={setBatchInput}
                placeholder="Enter credit codes, QR data, or barcodes (one per line, comma, or semicolon separated)"
                multiline={5}
                disabled={processing}
              />

              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={processBatchCodes}
                  title={`Process Codes (${parseBatchInput(batchInput).length})`}
                  variant="primary"
                  loading={processing}
                  disabled={processing || !batchInput.trim()}
                  fullWidth
                />
                
                <Button
                  onPress={clearOperations}
                  title="Clear All"
                  variant="secondary"
                  disabled={processing}
                />
              </Stack>

              <Text variant="bodySm" color="subdued">
                Maximum {maxOperations} operations per batch
              </Text>
            </Stack>

            {/* Results Summary */}
            {operations.length > 0 && (
              <Stack spacing="base">
                <Text variant="headingSm">Processing Results</Text>
                
                <Stack direction="horizontal" spacing="tight">
                  <Badge status="success">{successCount} Success</Badge>
                  <Badge status="critical">{errorCount} Errors</Badge>
                  <Badge status="info">{operations.length} Total</Badge>
                </Stack>

                {totalAmount > 0 && (
                  <Text variant="bodySm">
                    Total Credit Value: {formatCreditAmount(totalAmount)}
                  </Text>
                )}

                <Stack direction="horizontal" spacing="tight">
                  <Button
                    onPress={applyAllCredits}
                    title={`Apply ${successCount} Credits`}
                    variant="primary"
                    loading={processing}
                    disabled={processing || successCount === 0}
                  />
                  
                  <Button
                    onPress={exportResults}
                    title="Export Results"
                    variant="secondary"
                    disabled={operations.length === 0}
                  />
                </Stack>
              </Stack>
            )}

            {/* Operations List */}
            {operations.length > 0 && (
              <Stack spacing="base">
                <Text variant="headingSm">Operations ({operations.length})</Text>
                
                <Stack spacing="tight">
                  {operations.slice(-10).reverse().map(operation => (
                    <Stack 
                      key={operation.id} 
                      direction="horizontal" 
                      alignment="space-between"
                      spacing="tight"
                    >
                      <Stack spacing="extraTight">
                        <Text variant="bodySm" color="emphasis">
                          {operation.type}: {operation.creditNote?.noteNumber || 'Processing...'}
                        </Text>
                        {operation.error && (
                          <Text variant="bodySm" color="critical">
                            {operation.error}
                          </Text>
                        )}
                        {operation.amount && (
                          <Text variant="bodySm">
                            Amount: {formatCreditAmount(operation.amount)}
                          </Text>
                        )}
                      </Stack>
                      
                      <Stack spacing="extraTight" alignment="end">
                        <Badge 
                          status={
                            operation.status === 'SUCCESS' ? 'success' :
                            operation.status === 'ERROR' ? 'critical' :
                            operation.status === 'PROCESSING' ? 'info' : 'warning'
                          }
                        >
                          {operation.status}
                        </Badge>
                        <Text variant="bodySm" color="subdued">
                          {new Date(operation.timestamp).toLocaleTimeString()}
                        </Text>
                      </Stack>
                    </Stack>
                  ))}
                  
                  {operations.length > 10 && (
                    <Text variant="bodySm" color="subdued" alignment="center">
                      ... and {operations.length - 10} more operations
                    </Text>
                  )}
                </Stack>
              </Stack>
            )}

            {/* Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">How to Use Bulk Processing</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Paste multiple credit codes, QR data, or barcodes</Text>
                <Text variant="bodySm">• Separate entries with new lines, commas, or semicolons</Text>
                <Text variant="bodySm">• Process validates all codes before applying</Text>
                <Text variant="bodySm">• Apply all valid credits to current cart with one click</Text>
                <Text variant="bodySm">• Export results for record keeping</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

// Helper functions (same as in CreditScanner)
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

async function getStaffId(): Promise<string> {
  // TODO: Implement staff ID retrieval from POS API
  return 'staff_default';
}

async function getStaffName(): Promise<string> {
  // TODO: Implement staff name retrieval from POS API
  return 'Staff Member';
}

export default BulkCreditManager;