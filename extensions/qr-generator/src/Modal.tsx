import React, { useState } from 'react';
import {
  Navigator,
  Screen,
  Button,
  TextField,
  ScrollView,
  Text,
  Image,
  Dialog,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

// QR Generator Modal - Create new credit notes with QR codes
// Allows customer search, amount input, and QR code generation/printing

const QRGeneratorModal = () => {
  const api = useApi();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCredit, setGeneratedCredit] = useState<any | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const validateForm = () => {
    if (!customerName.trim()) {
      api.ui.toast.show('Customer name is required', { duration: 2000 });
      return false;
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      api.ui.toast.show('Please enter a valid amount', { duration: 2000 });
      return false;
    }

    return true;
  };

  const handleCreateCredit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;
      const userId = api.session.currentSession?.userId;

      // Convert amount to cents
      const amountInCents = Math.round(parseFloat(amount) * 100);

      console.log('[QR Generator] Creating credit note:', {
        customerName,
        amount: amountInCents,
      });

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          amount: amountInCents,
          reason: reason.trim() || undefined,
          createdBy: userId || 'pos-user',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Creation failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.creditNote && data.qrCode) {
        setGeneratedCredit(data.creditNote);
        setQrCodeImage(data.qrCode); // Base64 image from backend
        api.ui.toast.show('Credit note created successfully!', { duration: 2000 });
        api.ui.modal.navigate({ target: 'qr-display' });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('[QR Generator] Creation failed:', err);
      api.ui.toast.show(err.message || 'Failed to create credit note', { duration: 3000 });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const handlePrint = () => {
    // Use Shopify POS Print API to print the QR code
    console.log('[QR Generator] Printing QR code');

    api.ui.toast.show('Print functionality coming soon', { duration: 2000 });

    // TODO: Implement actual printing using Shopify POS Print API
    // This would typically involve creating a receipt with the QR code
  };

  const handleReset = () => {
    setCustomerName('');
    setCustomerEmail('');
    setAmount('');
    setReason('');
    setGeneratedCredit(null);
    setQrCodeImage('');
    api.ui.modal.navigate({ target: 'create-form' });
  };

  const formatAmount = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  return (
    <Navigator>
      <Screen name="create-form" title="Create Credit Note">
        <ScrollView>
          <TextField
            label="Customer Name"
            placeholder="Enter customer name"
            value={customerName}
            onChange={setCustomerName}
            required
          />

          <TextField
            label="Customer Email (Optional)"
            placeholder="customer@example.com"
            value={customerEmail}
            onChange={setCustomerEmail}
            inputMode="email"
          />

          <TextField
            label="Amount"
            placeholder="0.00"
            value={amount}
            onChange={setAmount}
            inputMode="decimal"
            required
          />

          <TextField
            label="Reason (Optional)"
            placeholder="Return, store credit, etc."
            value={reason}
            onChange={setReason}
            multiline
          />

          <Button
            title="Generate Credit Note"
            onPress={() => setShowConfirmDialog(true)}
            disabled={loading || !customerName.trim() || !amount}
            appearance="primary"
          />
        </ScrollView>
      </Screen>

      <Screen name="qr-display" title="Credit Note Created">
        {generatedCredit && (
          <ScrollView>
            <Text>Customer: {generatedCredit.customerName}</Text>
            <Text>Code: {generatedCredit.code}</Text>
            <Text>Amount: {formatAmount(generatedCredit.amount)}</Text>

            {qrCodeImage && (
              <Image
                source={qrCodeImage}
                accessibilityLabel="Credit note QR code"
              />
            )}

            <Button
              title="Print QR Code"
              onPress={handlePrint}
              appearance="primary"
            />

            <Button
              title="Create Another"
              onPress={handleReset}
            />

            <Button
              title="Done"
              onPress={() => api.ui.modal.close()}
            />
          </ScrollView>
        )}
      </Screen>

      {showConfirmDialog && (
        <Dialog
          title="Create Credit Note"
          message={`Create a credit note for ${customerName} with amount $${amount}?`}
          primaryAction={{
            label: 'Create',
            onPress: handleCreateCredit,
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowConfirmDialog(false),
          }}
        />
      )}
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <QRGeneratorModal />);
