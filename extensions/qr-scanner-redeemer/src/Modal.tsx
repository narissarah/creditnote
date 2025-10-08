import React, { useState } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  CameraScanner,
  TextField,
  Button,
  Text,
  Dialog,
  Banner,
  NumberField,
} from '@shopify/ui-extensions-react/point-of-sale';

function QRScannerRedeemerModal() {
  const api = useApi();
  const [manualCode, setManualCode] = useState('');
  const [creditNote, setCreditNote] = useState<any | null>(null);
  const [redemptionAmount, setRedemptionAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateCreditNote = async (code: string) => {
    if (!code || code.trim() === '') {
      api.ui.toast.show('Please scan or enter a valid code', { duration: 2000 });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      console.log('[QR Scanner] Validating code:', code);

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({ qrCode: code.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Validation failed' }));
        throw new Error(errorData.error || `Validation failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.valid && data.data) {
        setCreditNote(data.data);
        setRedemptionAmount(data.data.remainingAmount / 100); // Convert cents to dollars
      } else {
        throw new Error(data.error || 'Invalid credit note');
      }
    } catch (err: any) {
      console.error('[QR Scanner] Validation error:', err);
      setError(err.message || 'Failed to validate code');
      api.ui.toast.show(err.message || 'Invalid credit note', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (scannedData: string) => {
    console.log('[QR Scanner] Scanned:', scannedData);
    validateCreditNote(scannedData);
  };

  const handleManualEntry = () => {
    validateCreditNote(manualCode);
  };

  const handleRedeem = async () => {
    if (!creditNote) return;

    try {
      setLoading(true);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;
      const userId = api.session.currentSession?.userId;

      // Convert dollars to cents
      const amountInCents = Math.round(redemptionAmount * 100);

      console.log('[QR Scanner] Redeeming:', {
        noteId: creditNote.id,
        amount: amountInCents,
      });

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({
          creditNoteId: creditNote.id,
          amount: amountInCents,
          posDeviceId: api.device?.id || 'unknown',
          staffId: userId || 'pos-staff',
          description: `POS Redemption - ${redemptionAmount}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Redemption failed' }));
        throw new Error(errorData.error || `Redemption failed: ${response.status}`);
      }

      api.ui.toast.show(`Redeemed $${redemptionAmount}!`, { duration: 3000 });

      // Reset state
      setCreditNote(null);
      setManualCode('');
      setRedemptionAmount(0);
      setShowRedeemDialog(false);
    } catch (err: any) {
      console.error('[QR Scanner] Redemption error:', err);
      setError(err.message || 'Failed to redeem');
      api.ui.toast.show(err.message || 'Failed to redeem credit note', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Navigator>
      <Screen name="scanner" title="Scan QR Code">
        <ScrollView>
          {error && (
            <Banner tone="critical" title="Error">
              {error}
            </Banner>
          )}

          <CameraScanner
            onScan={handleScan}
            scannerType="qr-code"
          />

          <Text variant="headingMd">Or enter code manually:</Text>

          <TextField
            label="Credit Note Code"
            placeholder="Enter or paste code"
            value={manualCode}
            onChange={setManualCode}
          />

          <Button
            title="Validate Code"
            onPress={handleManualEntry}
            disabled={loading || !manualCode.trim()}
            loading={loading}
          />
        </ScrollView>
      </Screen>

      {creditNote && (
        <Screen name="details" title="Credit Note Details">
          <ScrollView>
            <Banner tone="success" title="Valid Credit Note">
              Ready to redeem
            </Banner>

            <Text variant="headingLg">{creditNote.customerName || 'Customer'}</Text>
            <Text>Note: {creditNote.noteNumber}</Text>
            <Text>Original: {formatCurrency(creditNote.originalAmount)}</Text>
            <Text>Remaining: {formatCurrency(creditNote.remainingAmount)}</Text>
            <Text>Status: {creditNote.status}</Text>
            <Text>Created: {formatDate(creditNote.createdAt)}</Text>
            {creditNote.expiresAt && (
              <Text>Expires: {formatDate(creditNote.expiresAt)}</Text>
            )}

            <NumberField
              label="Amount to Redeem"
              value={redemptionAmount}
              onChange={setRedemptionAmount}
              min={0.01}
              max={creditNote.remainingAmount / 100}
              step={0.01}
            />

            <Button
              title={`Redeem $${redemptionAmount.toFixed(2)}`}
              onPress={() => setShowRedeemDialog(true)}
              disabled={
                loading ||
                redemptionAmount <= 0 ||
                redemptionAmount > creditNote.remainingAmount / 100 ||
                creditNote.status !== 'active'
              }
              loading={loading}
              tone="success"
            />

            <Button
              title="Cancel"
              onPress={() => {
                setCreditNote(null);
                setManualCode('');
              }}
            />
          </ScrollView>
        </Screen>
      )}

      {showRedeemDialog && creditNote && (
        <Dialog
          title="Redeem Credit"
          message={`Redeem $${redemptionAmount.toFixed(2)} from ${creditNote.customerName}'s credit note?`}
          primaryAction={{
            label: 'Redeem',
            onPress: handleRedeem
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowRedeemDialog(false)
          }}
        />
      )}
    </Navigator>
  );
}

export default reactExtension('pos.home.modal.render', () => <QRScannerRedeemerModal />);
