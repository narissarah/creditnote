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
import { POSApiClient } from '../../shared/pos-api-client';

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
  console.log('[Credit Manager Modal] 🚀 COMPONENT RENDERED - POS Extension is running');

  const api = useApi();
  const itemsPerPage = 10;

  console.log('[Credit Manager Modal] API object check:', {
    hasApi: !!api,
    hasSession: !!api?.session,
    hasToast: !!api?.toast,
    apiKeys: api ? Object.keys(api) : []
  });

  // Initialize API client (session API passed to method calls)
  const apiClient = new POSApiClient();

  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const loadCredits = useCallback(async () => {
    console.log('[Credit Manager Modal] 📞 loadCredits() CALLED');

    setLoading(true);
    setError(null);

    try {
      console.log('[Credit Manager Modal] 🚀 Starting credit notes load...');
      console.log('[Credit Manager Modal] Session API details:', {
        hasSession: !!api.session,
        hasCurrentSession: !!(api.session as any)?.currentSession,
        shopDomain: (api.session as any)?.currentSession?.shopDomain,
        sessionKeys: api.session ? Object.keys(api.session) : [],
        currentSessionKeys: (api.session as any)?.currentSession ? Object.keys((api.session as any).currentSession) : []
      });

      console.log('[Credit Manager Modal] 🌐 About to call apiClient.getCreditNotes()...');

      const response = await apiClient.getCreditNotes(api.session, {
        limit: itemsPerPage,
        offset: currentPage * itemsPerPage,
        search: searchTerm.trim(),
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      console.log('[Credit Manager Modal] 📦 getCreditNotes() returned:', {
        success: response.success,
        hasData: !!response.data,
        dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        error: response.error,
        total: response.total
      });

      if (response.success && Array.isArray(response.data)) {
        const filteredCredits = response.data;
        console.log('[Credit Manager Modal] ✅ Loaded', filteredCredits.length, 'credits from shop:', response.metadata?.shop);

        // Use functional setState to avoid stale state issues
        setCredits(prevCredits =>
          currentPage === 0 ? filteredCredits : [...prevCredits, ...filteredCredits]
        );
        setHasMore((currentPage * itemsPerPage + filteredCredits.length) < (response.total || 0));
        setError(null);
      } else {
        console.error('[Credit Manager Modal] ❌ API Error:', response.error);

        // Run diagnostics to help identify the issue
        console.log('[Credit Manager Modal] Running diagnostics to identify the problem...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics(api.session);
          console.log('[Credit Manager Modal] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[Credit Manager Modal] 📊 Server Environment:', diag.server?.environment);
            console.log('[Credit Manager Modal] 🔐 Authentication Status:', diag.authentication);
            console.log('[Credit Manager Modal] 💾 Database Status:', diag.database);
          }
        } catch (diagError) {
          console.error('[Credit Manager Modal] ❌ Diagnostic check also failed:', diagError);
        }

        setError(response.error || 'Failed to load credit notes');
        setCredits([]);
        setHasMore(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error loading credit notes';
      console.error('[Credit Manager Modal] ❌ Exception caught in loadCredits:', errorMessage);
      console.error('[Credit Manager Modal] Full error object:', error);
      console.error('[Credit Manager Modal] Error stack:', error instanceof Error ? error.stack : 'No stack');

      setError(errorMessage);
      setCredits([]);
      setHasMore(false);

      // Show error to user
      if (api.toast?.show) {
        api.toast.show(errorMessage);
      }
    } finally {
      console.log('[Credit Manager Modal] 🏁 loadCredits() finished');
      setLoading(false);
    }
  }, [api, apiClient, searchTerm, currentPage, itemsPerPage]);

  useEffect(() => {
    console.log('[Credit Manager Modal] 🔄 Search term changed, resetting pagination');
    setCurrentPage(0);
    setCredits([]);
  }, [searchTerm]);

  useEffect(() => {
    console.log('[Credit Manager Modal] 🔄 useEffect triggered - calling loadCredits()');
    console.log('[Credit Manager Modal] Current state:', {
      currentPage,
      searchTerm: searchTerm || '(empty)',
      hasLoadCredits: typeof loadCredits === 'function'
    });

    try {
      loadCredits().catch((err) => {
        console.error('[Credit Manager Modal] ❌ Unhandled loadCredits promise rejection:', err);
        if (api.toast?.show) {
          api.toast.show('Failed to load credits: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
      });
    } catch (err) {
      console.error('[Credit Manager Modal] ❌ Exception calling loadCredits:', err);
    }
  }, [currentPage, searchTerm, loadCredits, api.toast]);

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