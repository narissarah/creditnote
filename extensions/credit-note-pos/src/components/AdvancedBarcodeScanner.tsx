// Advanced Multi-Format Barcode Scanner for Credit Notes
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
  Banner,
  Badge,
  CameraScanner,
  useScannerDataSubscription,
  TextField,
  POSReceiptBlock,
  QRCode
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { useCreditOperations } from '../hooks/useCreditOperations';
import { formatCreditAmount, formatCreditNoteNumber, generateCreditQRData } from '../utils/qrcode.utils';
import { validateBarcode, extractCreditInfoFromBarcode, validateQRCodePattern } from '../utils/validation.utils';

interface AdvancedBarcodeScannerProps {
  onCreditRedeemed?: (credit: CreditNote, amount: number) => void;
  onError?: (error: string) => void;
}

const AdvancedBarcodeScanner: React.FC<AdvancedBarcodeScannerProps> = ({
  onCreditRedeemed,
  onError
}) => {
  const api = useApi<'pos.home.modal.render'>();
  const { data: scannedData, error: scanError } = useScannerDataSubscription();
  
  // State management
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [validatedCredit, setValidatedCredit] = useState<CreditNote | null>(null);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [scanHistory, setScanHistory] = useState<Array<{
    data: string;
    timestamp: string;
    format: string;
    result: 'success' | 'error';
    message: string;
  }>>([]);

  // Hooks
  const { validateCredit, redeemCredit, createCredit } = useCreditOperations();

  /**
   * Enhanced barcode/QR processing with multi-format support
   */
  const processScanData = useCallback(async (scanData: string) => {
    setProcessing(true);
    const timestamp = new Date().toISOString();
    
    try {
      // Detect scan format
      const format = detectScanFormat(scanData);
      let validationResult;
      
      console.log(`Processing scan: ${format} - ${scanData}`);
      
      switch (format) {
        case 'QR_JSON':
          validationResult = await processQRCode(scanData);
          break;
        case 'QR_SIMPLE':
          validationResult = await processSimpleQRCode(scanData);
          break;
        case 'CREDIT_BARCODE':
          validationResult = await processCreditBarcode(scanData);
          break;
        case 'UPC':
          validationResult = await processUPCBarcode(scanData);
          break;
        case 'EAN13':
          validationResult = await processEAN13Barcode(scanData);
          break;
        case 'CODE128':
          validationResult = await processCode128Barcode(scanData);
          break;
        default:
          throw new Error(`Unsupported scan format: ${format}`);
      }
      
      if (validationResult.success) {
        setValidatedCredit(validationResult.credit!);
        
        // Add to scan history
        setScanHistory(prev => [{
          data: scanData,
          timestamp,
          format,
          result: 'success',
          message: `Credit ${validationResult.credit!.noteNumber} validated successfully`
        }, ...prev.slice(0, 9)]);
        
        api.toast.show(
          `Credit note ${validationResult.credit!.noteNumber} scanned successfully!`,
          'success'
        );
      } else {
        throw new Error(validationResult.error || 'Scan validation failed');
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Scan processing failed';
      
      // Add error to scan history
      setScanHistory(prev => [{
        data: scanData,
        timestamp,
        format: 'unknown',
        result: 'error',
        message: errorMessage
      }, ...prev.slice(0, 9)]);
      
      onError?.(errorMessage);
      api.toast.show(errorMessage, 'error');
    } finally {
      setProcessing(false);
      setScanning(false);
    }
  }, [api, onError]);

  /**
   * Handle scanner data
   */
  useEffect(() => {
    if (scannedData && scanning) {
      processScanData(scannedData);
    }
  }, [scannedData, scanning, processScanData]);

  /**
   * Handle scan errors
   */
  useEffect(() => {
    if (scanError) {
      onError?.(scanError.message || 'Scanner error occurred');
      setScanning(false);
      setProcessing(false);
    }
  }, [scanError, onError]);

  /**
   * Redeem credit with specified amount
   */
  const handleRedeemCredit = useCallback(async () => {
    if (!validatedCredit) return;

    const amount = parseFloat(redeemAmount) || validatedCredit.remainingAmount;
    
    if (amount <= 0 || amount > validatedCredit.remainingAmount) {
      onError?.('Invalid redemption amount');
      return;
    }

    try {
      setProcessing(true);
      
      // Get current cart
      const cart = await api.cart.subscribable.value;
      
      // Apply credit as discount
      await api.cart.applyDiscount({
        type: 'FIXED_AMOUNT',
        amount: amount,
        title: `Credit: ${formatCreditNoteNumber(validatedCredit.noteNumber)}`,
        reason: `Store credit redemption - ${validatedCredit.noteNumber}`
      });

      // Record redemption (in real app, this would call backend)
      const redemption = {
        creditNoteId: validatedCredit.id,
        amount: amount,
        orderId: cart.id || 'pos-transaction',
        timestamp: new Date().toISOString()
      };

      // Update remaining amount
      validatedCredit.remainingAmount -= amount;
      
      onCreditRedeemed?.(validatedCredit, amount);
      
      api.toast.show(
        `Applied ${formatCreditAmount(amount)} credit to cart`,
        'success'
      );

      // Clear state
      setValidatedCredit(null);
      setRedeemAmount('');
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to redeem credit');
    } finally {
      setProcessing(false);
    }
  }, [validatedCredit, redeemAmount, api, onCreditRedeemed, onError]);

  /**
   * Create new credit note with QR code
   */
  const handleCreateCredit = useCallback(async (customerName: string, amount: number) => {
    try {
      setProcessing(true);
      
      const timestamp = Date.now();
      const creditId = `CN-${timestamp.toString().slice(-8)}`;
      
      const newCredit: CreditNote = {
        id: creditId,
        noteNumber: creditId,
        customerId: `pos-${timestamp}`,
        customerName,
        originalAmount: amount,
        remainingAmount: amount,
        currency: 'USD',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shop: 'pos-created'
      };

      // Generate QR code
      const qrData = generateCreditQRData(newCredit);
      newCredit.qrCode = JSON.stringify(qrData);

      // In real implementation, save to backend
      // await createCredit(newCredit);

      api.toast.show(`Credit note ${creditId} created successfully!`, 'success');
      
      return newCredit;
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to create credit note');
      return null;
    } finally {
      setProcessing(false);
    }
  }, [api, onError]);

  return (
    <Navigator>
      <Screen name="BarcodeScanner" title="Advanced Credit Scanner">
        <ScrollView>
          <Stack spacing="loose">
            {/* Scanner Controls */}
            <Stack spacing="base">
              <Text variant="headingMd">Multi-Format Scanner</Text>
              
              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => setScanning(true)}
                  title={scanning ? "Scanning..." : "Start Scan"}
                  variant="primary"
                  loading={scanning || processing}
                  disabled={scanning || processing}
                />
                
                {validatedCredit && (
                  <Button
                    onPress={() => {
                      setValidatedCredit(null);
                      setRedeemAmount('');
                    }}
                    title="Clear"
                    variant="secondary"
                  />
                )}
              </Stack>

              {/* Supported formats info */}
              <Banner status="info">
                <Text>Supports: QR codes, Credit barcodes, UPC, EAN-13, Code128</Text>
              </Banner>
            </Stack>

            {/* Validated Credit Display */}
            {validatedCredit && (
              <Stack spacing="base">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="headingMd">Credit Validated</Text>
                  <Badge tone="success" size="small">Active</Badge>
                </Stack>
                
                <Stack spacing="tight">
                  <Text variant="bodySm" color="subdued">
                    {formatCreditNoteNumber(validatedCredit.noteNumber)}
                  </Text>
                  
                  <Text variant="headingSm">
                    Available: {formatCreditAmount(validatedCredit.remainingAmount)}
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

                {/* Redemption amount */}
                <TextField
                  label="Amount to Redeem"
                  type="number"
                  value={redeemAmount}
                  onChange={setRedeemAmount}
                  placeholder={validatedCredit.remainingAmount.toString()}
                  step="0.01"
                  min="0"
                  max={validatedCredit.remainingAmount.toString()}
                />

                <Stack direction="horizontal" spacing="tight">
                  <Button
                    onPress={handleRedeemCredit}
                    title="Redeem Credit"
                    variant="primary"
                    loading={processing}
                    disabled={processing}
                  />
                  
                  <Button
                    onPress={() => setRedeemAmount(validatedCredit.remainingAmount.toString())}
                    title="Use Full Amount"
                    variant="secondary"
                  />
                </Stack>
              </Stack>
            )}

            {/* Scan History */}
            {scanHistory.length > 0 && (
              <Stack spacing="base">
                <Text variant="headingSm">Recent Scans</Text>
                
                {scanHistory.slice(0, 5).map((scan, index) => (
                  <Stack key={index} spacing="tight">
                    <Stack direction="horizontal" alignment="space-between">
                      <Badge tone={scan.result === 'success' ? 'success' : 'critical'} size="small">
                        {scan.format}
                      </Badge>
                      <Text variant="bodySm" color="subdued">
                        {new Date(scan.timestamp).toLocaleTimeString()}
                      </Text>
                    </Stack>
                    
                    <Text variant="bodySm">
                      {scan.message}
                    </Text>
                    
                    <Text variant="bodySm" color="subdued">
                      Data: {scan.data.substring(0, 40)}...
                    </Text>
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Scanner Instructions */}
            <Stack spacing="base">
              <Text variant="headingSm">Supported Formats</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">🔲 QR Codes: JSON format with credit note data</Text>
                <Text variant="bodySm">🔲 Credit Barcodes: CN followed by year and sequence</Text>
                <Text variant="bodySm">🔲 UPC: 12-digit Universal Product Codes</Text>
                <Text variant="bodySm">🔲 EAN-13: 13-digit European Article Numbers</Text>
                <Text variant="bodySm">🔲 Code128: Alphanumeric linear barcodes</Text>
                <Text variant="bodySm">🔲 Simple Codes: CREDIT:noteNumber:amount:customer</Text>
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>

      {/* Camera Scanner Screen */}
      {scanning && (
        <Screen name="CameraView" title="Scanning">
          <Stack spacing="loose" alignment="center">
            <CameraScanner />
            
            <Text alignment="center">
              Position barcode or QR code in the camera view
            </Text>
            
            {processing && (
              <Banner status="info">
                <Text>Processing scanned data...</Text>
              </Banner>
            )}
            
            <Button
              onPress={() => {
                setScanning(false);
                setProcessing(false);
              }}
              title="Cancel Scan"
              variant="secondary"
              fullWidth
            />
          </Stack>
        </Screen>
      )}
    </Navigator>
  );
};

/**
 * Detect the format of scanned data
 */
function detectScanFormat(data: string): string {
  // QR Code JSON format
  try {
    const parsed = JSON.parse(data);
    if (parsed.type === 'credit_note') return 'QR_JSON';
  } catch {}

  // Simple QR format
  if (data.startsWith('CREDIT:')) return 'QR_SIMPLE';

  // Credit note barcode (CN + year + sequence)
  if (/^CN[0-9]{4}[A-Z0-9]{8}$/.test(data)) return 'CREDIT_BARCODE';

  // UPC (12 digits)
  if (/^[0-9]{12}$/.test(data)) return 'UPC';

  // EAN-13 (13 digits)
  if (/^[0-9]{13}$/.test(data)) return 'EAN13';

  // Code128 (alphanumeric)
  if (/^[A-Z0-9\-\.]{4,48}$/i.test(data)) return 'CODE128';

  return 'UNKNOWN';
}

/**
 * Process QR code JSON format
 */
async function processQRCode(data: string): Promise<{success: boolean, credit?: CreditNote, error?: string}> {
  try {
    const validation = validateQRCodePattern(data);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const parsed = JSON.parse(data);
    
    // Mock credit note from QR data (in real app, fetch from backend)
    const credit: CreditNote = {
      id: parsed.code,
      noteNumber: parsed.code,
      customerId: parsed.customerId,
      customerName: parsed.customerName || 'QR Customer',
      originalAmount: parsed.originalAmount || parsed.amount,
      remainingAmount: parsed.amount,
      currency: parsed.currency || 'USD',
      status: parsed.status || 'ACTIVE',
      createdAt: parsed.timestamp || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shop: parsed.shop || 'qr-scanned'
    };

    return { success: true, credit };
  } catch (error) {
    return { success: false, error: 'Invalid QR code format' };
  }
}

/**
 * Process simple QR code format
 */
async function processSimpleQRCode(data: string): Promise<{success: boolean, credit?: CreditNote, error?: string}> {
  try {
    const parts = data.split(':');
    if (parts.length < 4) {
      return { success: false, error: 'Invalid simple QR format' };
    }

    const [, noteNumber, amountStr, customerId, currency = 'USD'] = parts;
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Invalid amount in QR code' };
    }

    const credit: CreditNote = {
      id: noteNumber,
      noteNumber,
      customerId,
      customerName: 'Simple QR Customer',
      originalAmount: amount,
      remainingAmount: amount,
      currency,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shop: 'simple-qr'
    };

    return { success: true, credit };
  } catch (error) {
    return { success: false, error: 'Failed to parse simple QR code' };
  }
}

/**
 * Process credit note barcode
 */
async function processCreditBarcode(data: string): Promise<{success: boolean, credit?: CreditNote, error?: string}> {
  try {
    const validation = validateBarcode(data);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const info = extractCreditInfoFromBarcode(data);
    if (!info.isValid) {
      return { success: false, error: 'Invalid credit barcode format' };
    }

    const credit: CreditNote = {
      id: info.noteNumber!,
      noteNumber: info.noteNumber!,
      customerId: `barcode-${info.sequenceCode}`,
      customerName: 'Barcode Customer',
      originalAmount: 100, // Would come from backend
      remainingAmount: 100,
      currency: 'USD',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      shop: 'barcode-scanned'
    };

    return { success: true, credit };
  } catch (error) {
    return { success: false, error: 'Failed to process credit barcode' };
  }
}

/**
 * Process UPC barcode (could be used for product-based credits)
 */
async function processUPCBarcode(data: string): Promise<{success: boolean, credit?: CreditNote, error?: string}> {
  try {
    const validation = validateBarcode(data);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // In a real implementation, you might look up product-based credits
    // For now, return an error since UPC doesn't directly contain credit info
    return { success: false, error: 'UPC codes not supported for credits. Use credit-specific QR codes or barcodes.' };
  } catch (error) {
    return { success: false, error: 'Failed to process UPC barcode' };
  }
}

/**
 * Process EAN-13 barcode
 */
async function processEAN13Barcode(data: string): Promise<{success: boolean, credit?: CreditNote, error?: string}> {
  try {
    const validation = validateBarcode(data);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Similar to UPC, EAN-13 doesn't directly contain credit info
    return { success: false, error: 'EAN-13 codes not supported for credits. Use credit-specific QR codes or barcodes.' };
  } catch (error) {
    return { success: false, error: 'Failed to process EAN-13 barcode' };
  }
}

/**
 * Process Code128 barcode
 */
async function processCode128Barcode(data: string): Promise<{success: boolean, credit?: CreditNote, error?: string}> {
  try {
    const validation = validateBarcode(data);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Check if it's a credit note in Code128 format
    if (data.startsWith('CN') && /^CN[0-9]{4}[A-Z0-9]{4,}$/i.test(data)) {
      return processCreditBarcode(data);
    }

    return { success: false, error: 'Code128 format not recognized as credit note. Use proper credit barcode format.' };
  } catch (error) {
    return { success: false, error: 'Failed to process Code128 barcode' };
  }
}

export default AdvancedBarcodeScanner;