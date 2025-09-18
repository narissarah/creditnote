import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  Text,
  Button,
  TextField,
  Banner,
  Section,
  ScrollView,
  CameraScanner,
  useScannerDataSubscription,
} from '@shopify/ui-extensions-react/point-of-sale';

const BarcodeScannerModal = () => {
  const api = useApi();
  // Use relative endpoints for automatic authentication in POS 2025-07

  const [scanMode, setScanMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [creditDetails, setCreditDetails] = useState<{
    valid: boolean;
    data?: any;
    usableAmount?: number;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const processingRef = useRef(false);

  // Scanner subscription for 2025-07
  const { data: scannedData } = useScannerDataSubscription();

  useEffect(() => {
    if (scannedData && scanMode) {
      setScanMode(false);
      processCode(scannedData);
      api.toast?.show('Scanned successfully');
    }
  }, [scannedData, scanMode]);

  const processCode = useCallback(async (code: string) => {
    if (processingRef.current || !code.trim()) return;

    processingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const shopDomain = api.shop?.domain;
      if (!shopDomain) {
        throw new Error('Shop information not available');
      }

      const response = await fetch(`https://creditnote-41ur.vercel.app/api/pos/credit-notes/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shopDomain,
          'X-Shopify-Location-Id': api.location?.id || '',
        },
        body: JSON.stringify({ qrCode: code.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreditDetails(data);

        if (data.valid) {
          api.toast?.show(`Valid credit: $${data.usableAmount?.toFixed(2) || data.data?.remainingAmount?.toFixed(2)}`);
        } else {
          setError(data.error || 'This credit code is invalid or has expired');
          api.toast?.show('Invalid or expired credit');
        }
      } else {
        throw new Error('Failed to validate credit code');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error validating credit';
      setError(errorMessage);
      api.toast?.show(errorMessage);
    } finally {
      setLoading(false);
      processingRef.current = false;
    }
  }, [api]);

  const applyToCart = useCallback(async () => {
    if (!creditDetails || !creditDetails.valid) return;

    try {
      const cart = api.cart;
      if (!cart) {
        api.toast?.show('No active cart');
        return;
      }

      api.toast?.show('Credit applied to cart (Demo Mode)');
      setCreditDetails(null);
      setManualCode('');
    } catch (error) {
      api.toast?.show('Error applying credit');
    }
  }, [creditDetails, api]);

  if (scanMode) {
    return (
      <Screen name="Scanner" title="Scan Credit Code">
        <CameraScanner />
        <Section>
          <Button
            title="Cancel Scan"
            onPress={() => setScanMode(false)}
            type="basic"
          />
        </Section>
      </Screen>
    );
  }

  return (
    <Navigator>
      <Screen name="main" title="Scan & Redeem Credits">
        <ScrollView>
          {loading && (
            <Section>
              <Text>Validating credit code...</Text>
            </Section>
          )}

          {error && !creditDetails && (
            <Section>
              <Banner title="Validation Error" type="critical">
                <Text>{error}</Text>
              </Banner>
            </Section>
          )}

          <Section title="Quick Scan">
            <Button
              title="Open Camera Scanner"
              onPress={() => setScanMode(true)}
              type="primary"
              disabled={loading}
            />
            <Text>Scan QR codes or barcodes on credit vouchers</Text>
          </Section>

          <Section title="Manual Entry">
            <TextField
              label="Credit Code"
              value={manualCode}
              onChange={(value) => {
                setManualCode(value.toUpperCase());
                setError(null);
              }}
              placeholder="Enter code manually..."
            />
            <Button
              title="Validate Code"
              onPress={() => processCode(manualCode)}
              disabled={!manualCode.trim() || loading}
              type="basic"
            />
          </Section>

          {creditDetails && creditDetails.valid && (
            <Section title="Credit Details">
              <Banner title="Valid Credit Found" type="confirmation">
                <Text>Credit validated successfully</Text>
              </Banner>
              <Text>Customer: {creditDetails.data?.customerName || 'Unknown'}</Text>
              <Text>Balance: ${creditDetails.data?.remainingAmount?.toFixed(2) || '0.00'}</Text>
              <Text>Code: {creditDetails.data?.noteNumber || manualCode}</Text>
              {creditDetails.data?.expiresAt && (
                <Text>Expires: {new Date(creditDetails.data.expiresAt).toLocaleDateString()}</Text>
              )}
              <Button
                title="Apply to Current Cart (Demo)"
                onPress={applyToCart}
                type="primary"
              />
              <Button
                title="Clear"
                onPress={() => {
                  setCreditDetails(null);
                  setManualCode('');
                  setError(null);
                }}
                type="basic"
              />
            </Section>
          )}

          {creditDetails && !creditDetails.valid && (
            <Section>
              <Banner title="Invalid or Expired" type="critical">
                <Text>This credit is not valid</Text>
              </Banner>
            </Section>
          )}

          <Section title="How to Use">
            <Text>1. Tap camera button to scan credit codes</Text>
            <Text>2. Or enter code manually in text field</Text>
            <Text>3. Validate to check balance and details</Text>
            <Text>4. Apply to current cart at checkout</Text>
          </Section>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <BarcodeScannerModal />);