import React, { useState, useEffect } from 'react';
import {
  Navigator,
  Screen,
  List,
  TextField,
  Button,
  Dialog,
  ScrollView,
  Text,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

// Credit Manager Modal - Full interface for managing credit notes
// Allows viewing, searching, and deleting credit notes

const CreditManagerModal = () => {
  const api = useApi();
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCredit, setSelectedCredit] = useState<any | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadCreditNotes();
  }, []);

  useEffect(() => {
    // Filter credit notes based on search query
    if (searchQuery.trim() === '') {
      setFilteredNotes(creditNotes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = creditNotes.filter((cn) =>
        cn.customerName?.toLowerCase().includes(query) ||
        cn.code?.toLowerCase().includes(query) ||
        cn.amount?.toString().includes(query)
      );
      setFilteredNotes(filtered);
    }
  }, [searchQuery, creditNotes]);

  const loadCreditNotes = async () => {
    try {
      setLoading(true);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      console.log('[Credit Manager Modal] Loading all credit notes');

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({ limit: 1000 }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const notes = data.creditNotes || [];

      setCreditNotes(notes);
      setFilteredNotes(notes);

      console.log('[Credit Manager Modal] Loaded credit notes:', notes.length);
    } catch (err: any) {
      console.error('[Credit Manager Modal] Failed to load credit notes:', err);
      api.ui.toast.show('Failed to load credit notes', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredit = async () => {
    if (!selectedCredit) return;

    try {
      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      console.log('[Credit Manager Modal] Deleting credit note:', selectedCredit.id);

      const response = await fetch(`https://creditnote.vercel.app/api/credit-notes/${selectedCredit.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      api.ui.toast.show('Credit note deleted', { duration: 2000 });

      // Reload credit notes
      await loadCreditNotes();

      setShowDeleteDialog(false);
      setSelectedCredit(null);
    } catch (err: any) {
      console.error('[Credit Manager Modal] Delete failed:', err);
      api.ui.toast.show('Failed to delete credit note', { duration: 3000 });
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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'used':
      case 'redeemed':
        return 'neutral';
      case 'expired':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <Navigator>
      <Screen name="credit-list" title="Manage Credit Notes">
        <ScrollView>
          <TextField
            label="Search"
            placeholder="Search by customer, code, or amount..."
            value={searchQuery}
            onChange={setSearchQuery}
          />

          {loading ? (
            <Text>Loading credit notes...</Text>
          ) : filteredNotes.length === 0 ? (
            <Text>
              {searchQuery ? 'No matching credit notes found' : 'No credit notes available'}
            </Text>
          ) : (
            <List
              data={filteredNotes}
              onPress={(item) => {
                setSelectedCredit(item);
                api.ui.modal.navigate({ target: 'credit-detail' });
              }}
              renderItem={(item) => ({
                id: item.id,
                title: item.customerName || 'Unknown Customer',
                subtitle: `${formatAmount(item.amount)} • ${item.code}`,
                trailingAccessory: {
                  label: item.status || 'active',
                  tone: getStatusColor(item.status),
                },
              })}
            />
          )}
        </ScrollView>
      </Screen>

      <Screen name="credit-detail" title="Credit Note Details">
        {selectedCredit && (
          <ScrollView>
            <Text>Customer: {selectedCredit.customerName || 'N/A'}</Text>
            <Text>Code: {selectedCredit.code}</Text>
            <Text>Amount: {formatAmount(selectedCredit.amount)}</Text>
            <Text>Status: {selectedCredit.status || 'active'}</Text>
            <Text>Created: {formatDate(selectedCredit.createdAt)}</Text>
            {selectedCredit.expiryDate && (
              <Text>Expires: {formatDate(selectedCredit.expiryDate)}</Text>
            )}

            <Button
              title="Delete Credit Note"
              onPress={() => setShowDeleteDialog(true)}
              appearance="critical"
            />
            <Button
              title="Back"
              onPress={() => api.ui.modal.navigate({ target: 'credit-list' })}
            />
          </ScrollView>
        )}
      </Screen>

      {showDeleteDialog && (
        <Dialog
          title="Delete Credit Note"
          message={`Are you sure you want to delete this credit note for ${selectedCredit?.customerName}?`}
          primaryAction={{
            label: 'Delete',
            onPress: handleDeleteCredit,
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowDeleteDialog(false),
          }}
        />
      )}
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <CreditManagerModal />);
