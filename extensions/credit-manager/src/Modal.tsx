import React, { useState, useEffect, useCallback } from 'react';
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
  List,
} from '@shopify/ui-extensions-react/point-of-sale';

interface CreditNote {
  id: string;
  noteNumber: string;
  customerName: string;
  customerEmail: string;
  originalAmount: number;
  remainingAmount: number;
  currency: string;
  status: string;
  reason: string;
  createdAt: string;
  expiresAt: string | null;
  updatedAt: string | null;
}

const CreditManagerModal = () => {
  const api = useApi();
  // Use relative endpoints for automatic authentication in POS 2025-07
  const itemsPerPage = 10;

  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadCredits = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const shopDomain = api.shop?.domain;
      if (!shopDomain) {
        throw new Error('Shop information not available');
      }

      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: (currentPage * itemsPerPage).toString(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      const response = await fetch(`https://creditnote-41ur.vercel.app/api/pos/credit-notes/list?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shopDomain,
          'X-Shopify-Location-Id': api.location?.id || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const filteredCredits = data.data || [];

        setCredits(currentPage === 0 ? filteredCredits : [...credits, ...filteredCredits]);
        setHasMore(data.hasMore || false);
      } else {
        throw new Error('Failed to load credit notes');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading credit notes';
      setError(errorMessage);
      api.toast?.show(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [api, searchTerm, currentPage, itemsPerPage, credits]);

  useEffect(() => {
    setCurrentPage(0);
    setCredits([]);
  }, [searchTerm]);

  useEffect(() => {
    loadCredits();
  }, [currentPage, searchTerm]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  if (selectedCredit) {
    return (
      <Navigator>
        <Screen name="details" title="Credit Note Details">
          <ScrollView>
            <Section title="Credit Information">
              <Text>Note Number: {selectedCredit.noteNumber}</Text>
              <Text>Customer: {selectedCredit.customerName}</Text>
              <Text>Email: {selectedCredit.customerEmail}</Text>
              <Text>Status: {selectedCredit.status}</Text>
              <Text>Original Amount: {formatCurrency(selectedCredit.originalAmount)}</Text>
              <Text>Remaining: {formatCurrency(selectedCredit.remainingAmount)}</Text>
              <Text>Created: {formatDate(selectedCredit.createdAt)}</Text>
              {selectedCredit.expiresAt && (
                <Text>Expires: {formatDate(selectedCredit.expiresAt)}</Text>
              )}
              {selectedCredit.updatedAt && (
                <Text>Last Updated: {formatDate(selectedCredit.updatedAt)}</Text>
              )}
              <Text>Reason: {selectedCredit.reason}</Text>
            </Section>

            <Section title="Actions">
              <Button
                title="View QR Code (Demo)"
                onPress={() => api.toast?.show('QR code displayed (Demo Mode)')}
                type="basic"
              />
              <Button
                title="Resend to Customer (Demo)"
                onPress={() => api.toast?.show('Credit note resent (Demo Mode)')}
                type="basic"
              />
              <Button
                title="Delete Credit Note (Demo)"
                onPress={() => {
                  api.toast?.show(`Credit note ${selectedCredit.noteNumber} deleted (Demo Mode)`);
                  setSelectedCredit(null);
                }}
                type="basic"
              />
            </Section>

            <Section title="Navigation">
              <Button
                title="Back to List"
                onPress={() => setSelectedCredit(null)}
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
      <Screen name="list" title="Credit Notes Manager">
        <ScrollView>
          {loading && currentPage === 0 && (
            <Section>
              <Text>Fetching credit notes...</Text>
            </Section>
          )}

          {error && (
            <Section>
              <Banner title="Loading Error" type="critical">
                <Text>{error}</Text>
              </Banner>
            </Section>
          )}

          <Section title="Search & Filter">
            <TextField
              label="Search"
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                setError(null);
              }}
              placeholder="Search by customer, email, or note number..."
            />
          </Section>

          <Section title={`Credit Notes (${credits.length})`}>
            {credits.length > 0 ? (
              <Section>
                {credits.map((credit) => (
                  <Button
                    key={credit.id}
                    title={`${credit.noteNumber} - ${credit.customerName}`}
                    onPress={() => setSelectedCredit(credit)}
                    type="basic"
                  >
                    <Text>{credit.status} - Remaining: {formatCurrency(credit.remainingAmount)}</Text>
                  </Button>
                ))}
              </Section>
            ) : !loading && (
              <Text>No credit notes found. Try adjusting your search.</Text>
            )}

            {hasMore && (
              <Button
                title={loading ? "Loading..." : "Load More"}
                onPress={() => setCurrentPage(currentPage + 1)}
                type="basic"
                disabled={loading}
              />
            )}
          </Section>

          <Section title="Quick Actions">
            <Button
              title="Refresh List"
              onPress={() => {
                setCurrentPage(0);
                setCredits([]);
                loadCredits();
              }}
              type="basic"
              disabled={loading}
            />
            <Button
              title="Export Report (Demo)"
              onPress={() => api.toast?.show('Report exported (Demo Mode)')}
              type="basic"
            />
          </Section>

          <Section title="Summary">
            <Text>Total Credits: {credits.length}</Text>
            <Text>
              Active Credits: {credits.filter(c => c.status === 'active' || c.status === 'partially_used').length}
            </Text>
            <Text>
              Total Value: {formatCurrency(credits.reduce((sum, c) => sum + c.remainingAmount, 0))}
            </Text>
          </Section>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <CreditManagerModal />);