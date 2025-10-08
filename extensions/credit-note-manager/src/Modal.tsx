import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
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

function CreditNoteManagerModal() {
  const api = useApi();
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCreditNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [searchQuery, statusFilter, creditNotes]);

  const loadCreditNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      console.log('[Credit Manager] Loading credit notes...');

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load' }));
        throw new Error(errorData.error || `Failed to load: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        setCreditNotes(data.data);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      console.error('[Credit Manager] Error:', err);
      setError(err.message || 'Failed to load credit notes');
      api.ui.toast.show(err.message || 'Failed to load credit notes', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = creditNotes;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(note => note.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        note.noteNumber?.toLowerCase().includes(query) ||
        note.customerName?.toLowerCase().includes(query) ||
        note.qrCode?.toLowerCase().includes(query)
      );
    }

    setFilteredNotes(filtered);
  };

  const handleDelete = async () => {
    if (!selectedNote) return;

    try {
      setLoading(true);

      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      console.log('[Credit Manager] Deleting:', selectedNote.id);

      const response = await fetch(`https://creditnote.vercel.app/api/credit-notes/${selectedNote.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        throw new Error(errorData.error || `Delete failed: ${response.status}`);
      }

      api.ui.toast.show('Credit note deleted successfully', { duration: 2000 });

      // Refresh list
      await loadCreditNotes();
      setSelectedNote(null);
      setShowDeleteDialog(false);
    } catch (err: any) {
      console.error('[Credit Manager] Delete error:', err);
      setError(err.message || 'Failed to delete');
      api.ui.toast.show(err.message || 'Failed to delete credit note', { duration: 3000 });
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
      <Screen name="list" title="Credit Notes">
        <ScrollView>
          {error && (
            <Banner tone="critical" title="Error">
              {error}
            </Banner>
          )}

          <TextField
            label="Search"
            placeholder="Note number, customer, or code"
            value={searchQuery}
            onChange={setSearchQuery}
          />

          <Button
            title={`Status: ${statusFilter}`}
            onPress={() => {
              const statuses = ['all', 'active', 'used', 'expired', 'cancelled'];
              const currentIndex = statuses.indexOf(statusFilter);
              const nextIndex = (currentIndex + 1) % statuses.length;
              setStatusFilter(statuses[nextIndex]);
            }}
          />

          <Button
            title="Refresh"
            onPress={loadCreditNotes}
            disabled={loading}
            loading={loading}
          />

          {filteredNotes.length === 0 ? (
            <Text>No credit notes found</Text>
          ) : (
            <List
              data={filteredNotes}
              renderItem={(note) => ({
                id: note.id,
                title: `${note.noteNumber} - ${note.customerName || 'Customer'}`,
                subtitle: `${formatCurrency(note.remainingAmount)} / ${formatCurrency(note.originalAmount)} • ${note.status}`,
                onPress: () => setSelectedNote(note),
              })}
            />
          )}
        </ScrollView>
      </Screen>

      {selectedNote && (
        <Screen name="details" title="Credit Note Details">
          <ScrollView>
            <Text variant="headingLg">{selectedNote.customerName || 'Customer'}</Text>
            <Text>Note: {selectedNote.noteNumber}</Text>
            <Text>QR Code: {selectedNote.qrCode}</Text>
            <Text>Original: {formatCurrency(selectedNote.originalAmount)}</Text>
            <Text>Remaining: {formatCurrency(selectedNote.remainingAmount)}</Text>
            <Text>Status: {selectedNote.status}</Text>
            <Text>Currency: {selectedNote.currency}</Text>
            <Text>Created: {formatDate(selectedNote.createdAt)}</Text>
            {selectedNote.expiresAt && (
              <Text>Expires: {formatDate(selectedNote.expiresAt)}</Text>
            )}
            {selectedNote.reason && (
              <Text>Reason: {selectedNote.reason}</Text>
            )}

            <Button
              title="Delete"
              onPress={() => setShowDeleteDialog(true)}
              tone="critical"
              disabled={loading}
            />

            <Button
              title="Back to List"
              onPress={() => setSelectedNote(null)}
            />
          </ScrollView>
        </Screen>
      )}

      {showDeleteDialog && selectedNote && (
        <Dialog
          title="Delete Credit Note"
          message={`Are you sure you want to delete ${selectedNote.noteNumber}? This cannot be undone.`}
          primaryAction={{
            label: 'Delete',
            onPress: handleDelete
          }}
          secondaryAction={{
            label: 'Cancel',
            onPress: () => setShowDeleteDialog(false)
          }}
        />
      )}
    </Navigator>
  );
}

export default reactExtension('pos.home.modal.render', () => <CreditNoteManagerModal />);
