import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Tile,
  Navigator,
  Screen,
  ScrollView,
  List,
  TextField,
  Button,
  Text,
  Dialog,
  Banner,
} from '@shopify/ui-extensions-react/point-of-sale';

// Extension 1: Credit Note Manager - View, manage, and delete credit notes
// Implements secure authentication as per:
// https://shopify.dev/docs/apps/build/purchase-options/product-subscription-app-extensions/authenticate-extension-requests

function CreditNoteManager() {
  const api = useApi();
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCreditNotes();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredNotes(creditNotes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = creditNotes.filter((note) =>
        note.customerName?.toLowerCase().includes(query) ||
        note.noteNumber?.toLowerCase().includes(query) ||
        note.customerEmail?.toLowerCase().includes(query)
      );
      setFilteredNotes(filtered);
    }
  }, [searchQuery, creditNotes]);

  const loadCreditNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get session token for authentication
      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load credit notes: ${response.status}`);
      }

      const data = await response.json();
      setCreditNotes(data.credits || []);
      setFilteredNotes(data.credits || []);
    } catch (err: any) {
      console.error('[Credit Note Manager] Error loading notes:', err);
      setError(err.message || 'Failed to load credit notes');
      api.ui.toast.show('Failed to load credit notes', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;

    try {
      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      const response = await fetch(`https://creditnote.vercel.app/api/credit-notes/${selectedNote.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete credit note');
      }

      api.ui.toast.show('Credit note deleted successfully', { duration: 2000 });
      await loadCreditNotes();
      setShowDeleteDialog(false);
      setSelectedNote(null);
      api.ui.modal.close();
    } catch (err: any) {
      console.error('[Credit Note Manager] Delete error:', err);
      api.ui.toast.show('Failed to delete credit note', { duration: 3000 });
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      active: 'success',
      expired: 'warning',
      fully_used: 'neutral',
      cancelled: 'critical',
    };
    return statusMap[status] || 'neutral';
  };

  // Tile view - entry point
  if (!api.ui.modal.isOpen) {
    return (
      <Tile
        title="Manage Credits"
        subtitle={`${creditNotes.length} credit notes`}
        onPress={() => api.ui.modal.open()}
        enabled={!loading}
      />
    );
  }

  // Modal view - full management interface
  return (
    <Navigator>
      <Screen name="list" title="Credit Note Manager">
        <ScrollView>
          {error && (
            <Banner tone="critical" title="Error">
              {error}
            </Banner>
          )}

          <TextField
            label="Search"
            placeholder="Search by customer, email, or note number..."
            value={searchQuery}
            onChange={setSearchQuery}
          />

          <Button
            title="Refresh"
            onPress={loadCreditNotes}
            loading={loading}
          />

          {filteredNotes.length === 0 ? (
            <Text>No credit notes found</Text>
          ) : (
            <List
              data={filteredNotes}
              renderItem={(note) => ({
                id: note.id,
                title: note.customerName || 'Unknown Customer',
                subtitle: `${note.noteNumber} • ${formatCurrency(note.remainingAmount)} remaining`,
                trailingAccessory: {
                  label: note.status,
                  tone: getStatusBadge(note.status),
                },
              })}
              onPress={(note) => {
                setSelectedNote(note);
                api.ui.modal.navigate({ target: 'details' });
              }}
            />
          )}
        </ScrollView>
      </Screen>

      <Screen name="details" title="Credit Note Details">
        {selectedNote && (
          <ScrollView>
            <Text variant="headingMd">{selectedNote.customerName}</Text>
            <Text>Note Number: {selectedNote.noteNumber}</Text>
            <Text>Original Amount: {formatCurrency(selectedNote.originalAmount)}</Text>
            <Text>Remaining: {formatCurrency(selectedNote.remainingAmount)}</Text>
            <Text>Status: {selectedNote.status}</Text>
            <Text>Created: {formatDate(selectedNote.createdAt)}</Text>
            {selectedNote.expiresAt && (
              <Text>Expires: {formatDate(selectedNote.expiresAt)}</Text>
            )}
            {selectedNote.reason && (
              <Text>Reason: {selectedNote.reason}</Text>
            )}

            <Button
              title="Delete Credit Note"
              onPress={() => setShowDeleteDialog(true)}
              tone="critical"
            />
            <Button
              title="Back"
              onPress={() => api.ui.modal.navigate({ target: 'list' })}
            />
          </ScrollView>
        )}
      </Screen>

      {showDeleteDialog && selectedNote && (
        <Dialog
          title="Delete Credit Note"
          message={`Are you sure you want to delete credit note ${selectedNote.noteNumber}? This action cannot be undone.`}
          primaryAction={{
            label: 'Delete',
            onPress: handleDeleteNote,
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowDeleteDialog(false),
          }}
        />
      )}
    </Navigator>
  );
}

export default reactExtension('pos.home.tile.render', () => <CreditNoteManager />);
