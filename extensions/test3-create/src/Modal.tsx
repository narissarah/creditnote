import React, { useState } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  TextField,
  NumberField,
  Button,
  Text,
  Banner,
  Image,
  List,
  Dialog,
} from '@shopify/ui-extensions-react/point-of-sale';

function CreditNoteCreatorModal() {
  const api = useApi();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [expiryDays, setExpiryDays] = useState<number>(365);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Created credit note state
  const [createdNote, setCreatedNote] = useState<any | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState('');
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const validateForm = () => {
    if (!customerName.trim()) {
      setError('Customer name is required');
      api.ui.toast.show('Customer name is required', { duration: 2000 });
      return false;
    }

    if (amount <= 0) {
      setError('Amount must be greater than zero');
      api.ui.toast.show('Please enter a valid amount', { duration: 2000 });
      return false;
    }

    if (customerEmail && !customerEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Invalid email format');
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

      if (!sessionToken) {
        throw new Error('Unable to authenticate. Please try reopening the extension.');
      }

      console.log('[Credit Creator] Creating credit note:', {
        customerName,
        amount,
        expiryDays,
      });

      // Convert dollars to cents
      const amountInCents = Math.round(amount * 100);

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({
          customerId: `pos-customer-${Date.now()}`, // Temporary ID for POS-created notes
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          amount: amountInCents,
          currency: 'USD',
          reason: reason.trim() || undefined,
          expiresAt: expiresAt.toISOString(),
        }),
      });

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Session expired. Please reopen the extension.');
        } else if (response.status === 403) {
          throw new Error('Permission denied. Please check app permissions.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again in a moment.');
        }

        const errorData = await response.json().catch(() => ({ error: 'Creation failed' }));
        throw new Error(errorData.error || `Creation failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        console.log('[Credit Creator] ✅ Credit note created:', data.data.noteNumber);

        setCreatedNote(data.data);
        setSuccessMessage(`Credit note ${data.data.noteNumber} created successfully!`);

        // Fetch QR code image
        await fetchQRCode(data.data.id);

        api.ui.toast.show('Credit note created successfully!', { duration: 3000 });
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('[Credit Creator] Error creating note:', err);

      // Handle network errors
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
        api.ui.toast.show('Network error - check connection', { duration: 3000 });
      } else {
        setError(err.message || 'Failed to create credit note');
        api.ui.toast.show(err.message || 'Creation failed', { duration: 3000 });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchQRCode = async (creditNoteId: string) => {
    try {
      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      const response = await fetch(`https://creditnote.vercel.app/api/credit-notes/${creditNoteId}/qr`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.qrCodeImage) {
          setQrCodeImage(data.qrCodeImage);
        }
      }
    } catch (error) {
      console.error('[Credit Creator] Error fetching QR code:', error);
    }
  };

  const handlePrint = () => {
    // Show print dialog
    setShowPrintDialog(true);
  };

  const confirmPrint = () => {
    if (!createdNote) return;

    api.ui.toast.show('QR code ready to print', { duration: 2000 });

    // In a real implementation, this would trigger the device's print functionality
    // For now, we just show the QR code in a printable format
    console.log('[Credit Creator] Print requested for:', createdNote.noteNumber);

    setShowPrintDialog(false);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerEmail('');
    setAmount(0);
    setReason('');
    setExpiryDays(365);
    setCreatedNote(null);
    setQrCodeImage('');
    setError(null);
    setSuccessMessage(null);
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Navigator>
      {/* Create Form Screen */}
      {!createdNote && (
        <Screen name="create" title="Create Credit Note">
          <ScrollView>
            {error && (
              <Banner tone="critical" title="Error">
                {error}
              </Banner>
            )}

            <Text variant="headingMd">Customer Information</Text>

            <TextField
              label="Customer Name *"
              placeholder="Enter customer name"
              value={customerName}
              onChange={setCustomerName}
              required
            />

            <TextField
              label="Customer Email"
              placeholder="customer@example.com"
              value={customerEmail}
              onChange={setCustomerEmail}
            />

            <Text variant="headingMd">Credit Details</Text>

            <NumberField
              label="Amount *"
              placeholder="0.00"
              value={amount}
              onChange={(value) => setAmount(value || 0)}
              required
            />

            <TextField
              label="Reason"
              placeholder="Return, refund, store credit, etc."
              value={reason}
              onChange={setReason}
            />

            <NumberField
              label="Expiry (days)"
              placeholder="365"
              value={expiryDays}
              onChange={(value) => setExpiryDays(value || 365)}
            />

            <Text variant="bodyMd">
              Expires on: {new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
            </Text>

            <Button
              title="Create Credit Note"
              onPress={handleCreate}
              disabled={loading}
              loading={loading}
            />

            <Text variant="bodySm" subdued>
              * Required fields
            </Text>
          </ScrollView>
        </Screen>
      )}

      {/* Success Screen with QR Code */}
      {createdNote && (
        <Screen name="success" title="Credit Note Created">
          <ScrollView>
            {successMessage && (
              <Banner tone="success" title="Success">
                {successMessage}
              </Banner>
            )}

            <Text variant="headingLg">Credit Note Details</Text>

            <List
              data={[
                { id: '1', title: 'Note Number', subtitle: createdNote.noteNumber || 'N/A' },
                { id: '2', title: 'Customer', subtitle: createdNote.customerName || 'N/A' },
                { id: '3', title: 'Amount', subtitle: formatCurrency(createdNote.originalAmount) },
                { id: '4', title: 'Status', subtitle: createdNote.status || 'active' },
                { id: '5', title: 'Created', subtitle: formatDate(createdNote.createdAt) },
                { id: '6', title: 'Expires', subtitle: createdNote.expiresAt ? formatDate(createdNote.expiresAt) : 'Never' },
              ]}
              renderItem={(item) => ({
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
              })}
            />

            {qrCodeImage && (
              <>
                <Text variant="headingMd">QR Code</Text>
                <Text variant="bodySm" subdued>
                  Customer can scan this code to redeem credit
                </Text>

                <Image
                  source={qrCodeImage}
                  alt="Credit Note QR Code"
                />

                <Button
                  title="Print QR Code"
                  onPress={handlePrint}
                />
              </>
            )}

            <Button
              title="Create Another"
              onPress={resetForm}
            />
          </ScrollView>
        </Screen>
      )}

      {/* Print Confirmation Dialog */}
      {showPrintDialog && createdNote && (
        <Dialog
          title="Print QR Code"
          message={`Print QR code for credit note ${createdNote.noteNumber}?`}
          primaryAction={{
            label: 'Print',
            onPress: confirmPrint
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowPrintDialog(false)
          }}
        />
      )}
    </Navigator>
  );
}

export default reactExtension('pos.home.modal.render', () => <CreditNoteCreatorModal />);
