import React, { useState } from 'react';
import {
  reactExtension,
  useApi,
  Tile,
  Navigator,
  Screen,
  ScrollView,
  TextField,
  NumberField,
  Button,
  Text,
  Dialog,
  Banner,
  Image,
  DatePicker,
} from '@shopify/ui-extensions-react/point-of-sale';

// Extension 3: Credit Note Creator & Printer
// Create credit notes with QR codes and print functionality
// https://shopify.dev/docs/apps/build/purchase-options/product-subscription-app-extensions/authenticate-extension-requests

function CreditNoteCreator() {
  const api = useApi();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(365);
  const [loading, setLoading] = useState(false);
  const [createdNote, setCreatedNote] = useState<any | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateForm = () => {
    if (!customerName.trim()) {
      api.ui.toast.show('Customer name is required', { duration: 2000 });
      return false;
    }

    if (amount <= 0) {
      api.ui.toast.show('Please enter a valid amount', { duration: 2000 });
      return false;
    }

    if (customerEmail && !customerEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      api.ui.toast.show('Please enter a valid email', { duration: 2000 });
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;
      const userId = api.session.currentSession?.userId;

      // Convert dollars to cents
      const amountInCents = Math.round(amount * 100);

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      console.log('[Credit Creator] Creating credit note:', {
        customerName,
        amount: amountInCents,
        expiryDays,
      });

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({
          customerId: `pos-customer-${Date.now()}`, // Generate temp customer ID
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          amount: amountInCents,
          currency: 'USD',
          reason: reason.trim() || undefined,
          expiresAt: expiresAt.toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Creation failed' }));
        throw new Error(errorData.error || `Creation failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setCreatedNote(data.data);

        // Generate QR code on backend
        const qrResponse = await fetch(`https://creditnote.vercel.app/api/credit-notes/${data.data.id}/qr`, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'X-Shopify-Shop-Domain': shopDomain || '',
          },
        });

        if (qrResponse.ok) {
          const qrData = await qrResponse.json();
          setQrCodeImage(qrData.qrCode || '');
        }

        api.ui.toast.show('Credit note created successfully!', { duration: 2000 });
        api.ui.modal.navigate({ target: 'success' });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('[Credit Creator] Error:', err);
      setError(err.message || 'Failed to create credit note');
      api.ui.toast.show(err.message || 'Failed to create credit note', { duration: 3000 });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const handlePrint = () => {
    if (!createdNote) return;

    // Use POS print API
    api.ui.toast.show('Sending to printer...', { duration: 2000 });

    // TODO: Implement actual printing via POS printer API
    // This would typically create a receipt-style printout with the QR code
    console.log('[Credit Creator] Print requested for:', createdNote.noteNumber);
  };

  const handleEmail = async () => {
    if (!createdNote || !customerEmail) return;

    try {
      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      await fetch(`https://creditnote.vercel.app/api/credit-notes/${createdNote.id}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({
          email: customerEmail,
        }),
      });

      api.ui.toast.show('Email sent successfully!', { duration: 2000 });
    } catch (err) {
      api.ui.toast.show('Failed to send email', { duration: 2000 });
    }
  };

  const handleReset = () => {
    setCustomerName('');
    setCustomerEmail('');
    setAmount(0);
    setReason('');
    setExpiryDays(365);
    setCreatedNote(null);
    setQrCodeImage('');
    setError(null);
    api.ui.modal.navigate({ target: 'create' });
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Tile view
  if (!api.ui.modal.isOpen) {
    return (
      <Tile
        title="Create Credit"
        subtitle="New credit note with QR"
        onPress={() => api.ui.modal.open()}
        enabled={true}
      />
    );
  }

  // Modal view
  return (
    <Navigator>
      <Screen name="create" title="Create Credit Note">
        <ScrollView>
          {error && (
            <Banner tone="critical" title="Error">
              {error}
            </Banner>
          )}

          <TextField
            label="Customer Name *"
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

          <NumberField
            label="Amount *"
            value={amount}
            onChange={setAmount}
            min={0.01}
            step={0.01}
            required
          />

          <TextField
            label="Reason (Optional)"
            placeholder="Return, store credit, etc."
            value={reason}
            onChange={setReason}
            multiline
          />

          <NumberField
            label="Expiry (days)"
            value={expiryDays}
            onChange={setExpiryDays}
            min={1}
            max={3650}
          />

          <Button
            title="Create Credit Note"
            onPress={() => setShowConfirmDialog(true)}
            disabled={loading || !customerName.trim() || amount <= 0}
            loading={loading}
            tone="success"
          />
        </ScrollView>
      </Screen>

      <Screen name="success" title="Credit Note Created">
        {createdNote && (
          <ScrollView>
            <Banner tone="success" title="Success">
              Credit note created successfully
            </Banner>

            <Text variant="headingLg">{createdNote.customerName}</Text>
            <Text>Note Number: {createdNote.noteNumber}</Text>
            <Text>Amount: {formatCurrency(createdNote.originalAmount)}</Text>
            <Text>QR Code: {createdNote.qrCode}</Text>

            {qrCodeImage && (
              <>
                <Text variant="headingMd">QR Code</Text>
                <Image
                  source={qrCodeImage}
                  accessibilityLabel="Credit note QR code"
                />
              </>
            )}

            <Button
              title="Print QR Code"
              onPress={handlePrint}
              tone="success"
            />

            {customerEmail && (
              <Button
                title="Email to Customer"
                onPress={handleEmail}
              />
            )}

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
          message={`Create a $${amount.toFixed(2)} credit note for ${customerName}?`}
          primaryAction={{
            label: 'Create',
            onPress: handleCreate,
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowConfirmDialog(false)
          }}
        />
      )}
    </Navigator>
  );
}

export default reactExtension('pos.home.tile.render', () => <CreditNoteCreator />);
