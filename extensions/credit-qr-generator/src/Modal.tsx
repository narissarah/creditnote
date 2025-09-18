import React, { useState, useCallback } from 'react';
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
} from '@shopify/ui-extensions-react/point-of-sale';

const QRGeneratorModal = () => {
  const api = useApi();
  // Use relative endpoints for automatic authentication in POS 2025-07
  const defaultCurrency = 'USD';
  const defaultExpiryDays = 365;

  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [expiryDays, setExpiryDays] = useState(defaultExpiryDays.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    noteNumber: string;
    qrCode?: string;
    amount: number;
    expiresAt: string;
  } | null>(null);

  const resetForm = () => {
    setCustomerEmail('');
    setCustomerName('');
    setAmount('');
    setReason('');
    setExpiryDays(defaultExpiryDays.toString());
    setError(null);
    setSuccessData(null);
  };

  const createCreditNote = useCallback(async () => {
    if (!amount || !customerEmail.trim()) {
      setError('Amount and customer email are required');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const shopDomain = api.shop?.domain;
      if (!shopDomain) {
        throw new Error('Shop information not available');
      }

      const response = await fetch(`/api/pos/credit-notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shopDomain,
          'X-Shopify-Location-Id': api.location?.id || '',
        },
        body: JSON.stringify({
          customerId: `pos-customer-${Date.now()}`,
          customerEmail: customerEmail.trim(),
          customerName: customerName.trim() || customerEmail.split('@')[0],
          amount: amountNum,
          currency: defaultCurrency,
          reason: reason.trim() || 'POS Credit Note',
          expiresInDays: parseInt(expiryDays, 10),
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          setSuccessData({
            noteNumber: data.data.noteNumber,
            qrCode: data.data.noteNumber,
            amount: data.data.amount,
            expiresAt: data.data.expiresAt,
          });
          api.toast?.show(`Credit note ${data.data.noteNumber} created successfully`);
        } else {
          throw new Error(data.error || 'Failed to create credit note');
        }
      } else {
        throw new Error('Failed to create credit note');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error creating credit note';
      setError(errorMessage);
      api.toast?.show(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [amount, customerEmail, customerName, reason, expiryDays, api]);

  const printQRCode = useCallback(async () => {
    if (!successData) return;
    api.toast?.show('QR code sent to printer (Demo Mode)');
  }, [successData, api]);

  if (successData) {
    return (
      <Navigator>
        <Screen name="success" title="Credit Note Created">
          <ScrollView>
            <Section>
              <Banner title="Credit Note Created Successfully" type="confirmation">
                <Text>Credit note has been created</Text>
              </Banner>
            </Section>

            <Section title="Credit Note Details">
              <Text>Note Number: {successData.noteNumber}</Text>
              <Text>Amount: ${successData.amount.toFixed(2)}</Text>
              <Text>QR Code: {successData.qrCode}</Text>
              <Text>Expires: {new Date(successData.expiresAt).toLocaleDateString()}</Text>
            </Section>

            <Section title="QR Code Actions">
              <Button
                title="Print QR Code (Demo)"
                onPress={printQRCode}
                type="primary"
              />
              <Button
                title="Share QR Code (Demo)"
                onPress={() => api.toast?.show('QR code shared (Demo Mode)')}
                type="basic"
              />
            </Section>

            <Section title="Next Actions">
              <Button
                title="Create Another Credit Note"
                onPress={resetForm}
                type="basic"
              />
              <Button
                title="Close"
                onPress={() => api.modal?.close?.()}
                type="basic"
              />
            </Section>
          </ScrollView>
        </Screen>
      </Navigator>
    );
  }

  return (
    <Navigator>
      <Screen name="create" title="Create Credit Note">
        <ScrollView>
          {loading && (
            <Section>
              <Text>Generating credit note and QR code...</Text>
            </Section>
          )}

          {error && (
            <Section>
              <Banner title="Creation Error" type="critical">
                <Text>{error}</Text>
              </Banner>
            </Section>
          )}

          <Section title="Customer Information">
            <TextField
              label="Customer Email *"
              value={customerEmail}
              onChange={setCustomerEmail}
              placeholder="customer@example.com"
            />
            <TextField
              label="Customer Name (Optional)"
              value={customerName}
              onChange={setCustomerName}
              placeholder="Customer full name"
            />
          </Section>

          <Section title="Credit Note Details">
            <TextField
              label={`Amount (${defaultCurrency}) *`}
              value={amount}
              onChange={(value) => {
                setAmount(value);
                setError(null);
              }}
              placeholder="0.00"
            />
            <TextField
              label="Reason (Optional)"
              value={reason}
              onChange={setReason}
              placeholder="Store credit, refund, etc."
            />
            <TextField
              label="Expires In (Days)"
              value={expiryDays}
              onChange={setExpiryDays}
              placeholder="365"
            />
          </Section>

          <Section title="Actions">
            <Button
              title="Create Credit Note & Generate QR"
              onPress={createCreditNote}
              type="primary"
              disabled={loading || !amount || !customerEmail.trim()}
            />
            <Button
              title="Clear Form"
              onPress={resetForm}
              type="basic"
            />
          </Section>

          <Section title="Instructions">
            <Text>1. Enter customer email and amount</Text>
            <Text>2. Add optional details (name, reason)</Text>
            <Text>3. Set expiry period in days</Text>
            <Text>4. Create note to generate QR code</Text>
            <Text>5. Print or share QR code with customer</Text>
          </Section>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <QRGeneratorModal />);