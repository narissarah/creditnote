import React, { useState } from 'react';
import {
  Navigator,
  Screen,
  CameraScanner,
  Button,
  TextField,
  ScrollView,
  Text,
  Dialog,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

// QR Scanner Modal - Scan QR codes and redeem credit notes
// Uses CameraScanner component for QR code scanning

const QRScannerModal = () => {
  const api = useApi();
  const [scannedCode, setScannedCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [creditNote, setCreditNote] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);

  const validateCreditNote = async (code: string) => {
    if (!code || code.trim() === '') {
      api.ui.toast.show('Please scan or enter a code', { duration: 2000 });
      return;
    }

    try {
      setLoading(true);

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
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Validation failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.valid && data.creditNote) {
        setCreditNote(data.creditNote);
        setScannedCode(code.trim());
        api.ui.modal.navigate({ target: 'credit-details' });
      } else {
        api.ui.toast.show(data.error || 'Invalid credit note', { duration: 3000 });
      }
    } catch (err: any) {
      console.error('[QR Scanner] Validation failed:', err);
      api.ui.toast.show(err.message || 'Failed to validate code', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (scannedData: string) => {
    console.log('[QR Scanner] Code scanned:', scannedData);
    validateCreditNote(scannedData);
  };

  const handleManualSubmit = () => {
    validateCreditNote(manualCode);
  };

  const handleRedeem = async () => {
    if (!creditNote || !scannedCode) return;

    try {
      setLoading(true);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;
      const userId = api.session.currentSession?.userId;

      console.log('[QR Scanner] Redeeming credit note:', creditNote.id);

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({
          code: scannedCode,
          redeemedBy: userId || 'pos-user',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Redemption failed: ${response.status}`);
      }

      const data = await response.json();

      api.ui.toast.show('Credit note redeemed successfully!', { duration: 3000 });

      // Reset state and go back to scanner
      setCreditNote(null);
      setScannedCode('');
      setManualCode('');
      setShowRedeemDialog(false);
      api.ui.modal.navigate({ target: 'scanner' });
    } catch (err: any) {
      console.error('[QR Scanner] Redemption failed:', err);
      api.ui.toast.show(err.message || 'Failed to redeem credit note', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <Navigator>
      <Screen name="scanner" title="Scan QR Code">
        <ScrollView>
          <CameraScanner
            onScan={handleScan}
            scannerType="qr-code"
          />

          <Text>Or enter code manually:</Text>

          <TextField
            label="Credit Code"
            placeholder="Enter credit note code"
            value={manualCode}
            onChange={setManualCode}
          />

          <Button
            title="Validate Code"
            onPress={handleManualSubmit}
            disabled={loading || !manualCode.trim()}
          />
        </ScrollView>
      </Screen>

      <Screen name="credit-details" title="Credit Note Details">
        {creditNote && (
          <ScrollView>
            <Text>Customer: {creditNote.customerName || 'N/A'}</Text>
            <Text>Code: {creditNote.code}</Text>
            <Text>Amount: {formatAmount(creditNote.amount)}</Text>
            <Text>Status: {creditNote.status || 'active'}</Text>
            <Text>Created: {formatDate(creditNote.createdAt)}</Text>
            {creditNote.expiryDate && (
              <Text>Expires: {formatDate(creditNote.expiryDate)}</Text>
            )}

            <Button
              title="Redeem Credit Note"
              onPress={() => setShowRedeemDialog(true)}
              disabled={loading || creditNote.status?.toLowerCase() !== 'active'}
              appearance="primary"
            />

            <Button
              title="Cancel"
              onPress={() => {
                setCreditNote(null);
                setScannedCode('');
                api.ui.modal.navigate({ target: 'scanner' });
              }}
            />
          </ScrollView>
        )}
      </Screen>

      {showRedeemDialog && (
        <Dialog
          title="Redeem Credit Note"
          message={`Redeem ${formatAmount(creditNote?.amount || 0)} credit for ${creditNote?.customerName}?`}
          primaryAction={{
            label: 'Redeem',
            onPress: handleRedeem,
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowRedeemDialog(false),
          }}
        />
      )}
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <QRScannerModal />);
