// Complete Credit Note Management System for POS
import React, { useState, useCallback, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  TextField,
  Banner,
  Badge
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import { useCreditOperations } from '../hooks/useCreditOperations';
import { formatCreditAmount, formatCreditNoteNumber } from '../utils/qrcode.utils';

interface CompleteCreditManagerProps {
  onCreditUpdated?: (credit: CreditNote) => void;
  onError?: (error: string) => void;
}

const CompleteCreditManager: React.FC<CompleteCreditManagerProps> = ({
  onCreditUpdated,
  onError
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State management
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'edit'>('list');
  const [editingCredit, setEditingCredit] = useState<Partial<CreditNote>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'redeemed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');

  // Hooks
  const { validateCredit, updateCredit, deleteCredit } = useCreditOperations();

  /**
   * Load credits (mock implementation - replace with real API)
   */
  const loadCredits = useCallback(async () => {
    try {
      setLoading(true);
      
      // Mock data - in real implementation, fetch from backend
      const mockCredits: CreditNote[] = [
        {
          id: 'CN-2024-001234',
          noteNumber: 'CN-2024-001234',
          customerId: 'cust-001',
          customerName: 'John Smith',
          originalAmount: 150.00,
          remainingAmount: 75.00,
          currency: 'USD',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          updatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days from now
          shop: 'test-shop'
        },
        {
          id: 'CN-2024-001235',
          noteNumber: 'CN-2024-001235',
          customerId: 'cust-002',
          customerName: 'Jane Doe',
          originalAmount: 200.00,
          remainingAmount: 200.00,
          currency: 'USD',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          updatedAt: new Date(Date.now() - 172800000).toISOString(),
          shop: 'test-shop'
        },
        {
          id: 'CN-2024-001236',
          noteNumber: 'CN-2024-001236',
          customerId: 'cust-003',
          customerName: 'Bob Wilson',
          originalAmount: 50.00,
          remainingAmount: 0.00,
          currency: 'USD',
          status: 'FULLY_USED',
          createdAt: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
          shop: 'test-shop'
        }
      ];
      
      setCredits(mockCredits);
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  /**
   * Load credits on mount
   */
  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  /**
   * Filter and sort credits
   */
  const filteredCredits = credits
    .filter(credit => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && credit.status !== 'ACTIVE') return false;
        if (statusFilter === 'redeemed' && credit.status !== 'FULLY_USED') return false;
        if (statusFilter === 'expired' && (!credit.expiresAt || new Date(credit.expiresAt) > new Date())) return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          credit.noteNumber.toLowerCase().includes(query) ||
          credit.customerName.toLowerCase().includes(query) ||
          credit.customerId.toLowerCase().includes(query)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.remainingAmount - a.remainingAmount;
        case 'customer':
          return a.customerName.localeCompare(b.customerName);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  /**
   * View credit details
   */
  const handleViewCredit = useCallback((credit: CreditNote) => {
    setSelectedCredit(credit);
    setViewMode('details');
  }, []);

  /**
   * Edit credit
   */
  const handleEditCredit = useCallback((credit: CreditNote) => {
    setSelectedCredit(credit);
    setEditingCredit({
      customerName: credit.customerName,
      remainingAmount: credit.remainingAmount,
      expiresAt: credit.expiresAt,
      notes: credit.notes
    });
    setViewMode('edit');
  }, []);

  /**
   * Save credit changes
   */
  const handleSaveCredit = useCallback(async () => {
    if (!selectedCredit) return;

    try {
      setLoading(true);
      
      const updatedCredit: CreditNote = {
        ...selectedCredit,
        ...editingCredit,
        updatedAt: new Date().toISOString()
      };

      // In real implementation, save to backend
      // await updateCredit(updatedCredit);

      // Update local state
      setCredits(prev => prev.map(c => 
        c.id === selectedCredit.id ? updatedCredit : c
      ));

      onCreditUpdated?.(updatedCredit);
      
      api.toast.show(`Credit ${selectedCredit.noteNumber} updated successfully`, 'success');
      
      setViewMode('details');
      setSelectedCredit(updatedCredit);
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to save credit');
    } finally {
      setLoading(false);
    }
  }, [selectedCredit, editingCredit, api, onCreditUpdated, onError]);

  /**
   * Delete credit
   */
  const handleDeleteCredit = useCallback(async () => {
    if (!selectedCredit) return;

    try {
      setLoading(true);
      
      // In real implementation, soft delete in backend
      // await deleteCredit(selectedCredit.id);

      // Update local state
      setCredits(prev => prev.filter(c => c.id !== selectedCredit.id));
      
      api.toast.show(`Credit ${selectedCredit.noteNumber} deleted successfully`, 'success');
      
      setViewMode('list');
      setSelectedCredit(null);
      setShowDeleteModal(false);
      
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to delete credit');
    } finally {
      setLoading(false);
    }
  }, [selectedCredit, api, onError]);

  /**
   * Get status badge color
   */
  const getStatusBadge = (credit: CreditNote) => {
    const isExpired = credit.expiresAt && new Date(credit.expiresAt) < new Date();
    
    if (isExpired) {
      return <Badge tone="critical" size="small">Expired</Badge>;
    }
    
    switch (credit.status) {
      case 'ACTIVE':
        return <Badge tone="success" size="small">Active</Badge>;
      case 'PARTIALLY_USED':
        return <Badge tone="warning" size="small">Partial</Badge>;
      case 'FULLY_USED':
        return <Badge tone="info" size="small">Used</Badge>;
      default:
        return <Badge tone="default" size="small">{credit.status}</Badge>;
    }
  };

  return (
    <Navigator>
      {/* Main List Screen */}
      <Screen name="CreditList" title="Credit Management">
        <ScrollView>
          <Stack spacing="loose">
            {/* Search and Filters */}
            <Stack spacing="base">
              <TextField
                label="Search Credits"
                labelHidden
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by note number, customer name, or ID"
                clearButton
                onClearButtonClick={() => setSearchQuery('')}
              />
              
              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => setStatusFilter('all')}
                  title="All"
                  variant={statusFilter === 'all' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setStatusFilter('active')}
                  title="Active"
                  variant={statusFilter === 'active' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setStatusFilter('redeemed')}
                  title="Used"
                  variant={statusFilter === 'redeemed' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setStatusFilter('expired')}
                  title="Expired"
                  variant={statusFilter === 'expired' ? 'primary' : 'secondary'}
                />
              </Stack>

              <Stack direction="horizontal" spacing="tight">
                <Text variant="bodySm">Sort by:</Text>
                <Button
                  onPress={() => setSortBy('date')}
                  title="Date"
                  variant={sortBy === 'date' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setSortBy('amount')}
                  title="Amount"
                  variant={sortBy === 'amount' ? 'primary' : 'secondary'}
                />
                <Button
                  onPress={() => setSortBy('customer')}
                  title="Customer"
                  variant={sortBy === 'customer' ? 'primary' : 'secondary'}
                />
              </Stack>
            </Stack>

            {/* Stats Summary */}
            <Stack spacing="base">
              <Text variant="headingSm">Summary</Text>
              <Stack direction="horizontal" spacing="tight">
                <Badge tone="info" size="medium">
                  Total: {credits.length}
                </Badge>
                <Badge tone="success" size="medium">
                  Active: {credits.filter(c => c.status === 'ACTIVE').length}
                </Badge>
                <Badge tone="warning" size="medium">
                  Used: {credits.filter(c => c.status === 'FULLY_USED').length}
                </Badge>
              </Stack>
            </Stack>

            {/* Credit List */}
            {loading ? (
              <Text alignment="center">Loading credits...</Text>
            ) : filteredCredits.length === 0 ? (
              <Banner status="info">
                <Text>No credits found matching your criteria</Text>
              </Banner>
            ) : (
              <Stack spacing="base">
                <Text variant="headingMd">
                  Credits ({filteredCredits.length})
                </Text>
                
                {filteredCredits.map((credit) => (
                  <Stack key={credit.id} spacing="tight">
                    <Stack direction="horizontal" alignment="space-between">
                      <Stack spacing="extraTight">
                        <Text variant="bodyMd" fontWeight="semibold">
                          {formatCreditNoteNumber(credit.noteNumber)}
                        </Text>
                        <Text variant="bodySm">
                          {credit.customerName}
                        </Text>
                        <Text variant="bodySm" color="subdued">
                          Created: {new Date(credit.createdAt).toLocaleDateString()}
                        </Text>
                      </Stack>
                      
                      <Stack spacing="extraTight" alignment="end">
                        {getStatusBadge(credit)}
                        <Text variant="headingSm">
                          {formatCreditAmount(credit.remainingAmount, credit.currency)}
                        </Text>
                        <Text variant="bodySm" color="subdued">
                          of {formatCreditAmount(credit.originalAmount, credit.currency)}
                        </Text>
                      </Stack>
                    </Stack>
                    
                    <Stack direction="horizontal" spacing="tight">
                      <Button
                        onPress={() => handleViewCredit(credit)}
                        title="View"
                        variant="secondary"
                      />
                      
                      {credit.status === 'ACTIVE' && (
                        <Button
                          onPress={() => handleEditCredit(credit)}
                          title="Edit"
                          variant="secondary"
                        />
                      )}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}

            {/* Refresh Button */}
            <Button
              onPress={loadCredits}
              title="Refresh List"
              variant="secondary"
              loading={loading}
              disabled={loading}
              fullWidth
            />
          </Stack>
        </ScrollView>
      </Screen>

      {/* Credit Details Screen */}
      {viewMode === 'details' && selectedCredit && (
        <Screen name="CreditDetails" title="Credit Details">
          <ScrollView>
            <Stack spacing="loose">
              {/* Header */}
              <Stack spacing="base">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="headingLg">
                    {formatCreditNoteNumber(selectedCredit.noteNumber)}
                  </Text>
                  {getStatusBadge(selectedCredit)}
                </Stack>
                
                <Text variant="headingMd">
                  {formatCreditAmount(selectedCredit.remainingAmount, selectedCredit.currency)}
                </Text>
                <Text variant="bodySm" color="subdued">
                  of {formatCreditAmount(selectedCredit.originalAmount, selectedCredit.currency)} original
                </Text>
              </Stack>

              {/* Customer Info */}
              <Stack spacing="base">
                <Text variant="headingSm">Customer Information</Text>
                <Stack spacing="tight">
                  <Text variant="bodyMd">
                    <Text fontWeight="semibold">Name:</Text> {selectedCredit.customerName}
                  </Text>
                  <Text variant="bodyMd">
                    <Text fontWeight="semibold">ID:</Text> {selectedCredit.customerId}
                  </Text>
                </Stack>
              </Stack>

              {/* Credit Details */}
              <Stack spacing="base">
                <Text variant="headingSm">Credit Details</Text>
                <Stack spacing="tight">
                  <Text variant="bodyMd">
                    <Text fontWeight="semibold">Status:</Text> {selectedCredit.status}
                  </Text>
                  <Text variant="bodyMd">
                    <Text fontWeight="semibold">Created:</Text> {new Date(selectedCredit.createdAt).toLocaleString()}
                  </Text>
                  <Text variant="bodyMd">
                    <Text fontWeight="semibold">Updated:</Text> {new Date(selectedCredit.updatedAt).toLocaleString()}
                  </Text>
                  {selectedCredit.expiresAt && (
                    <Text variant="bodyMd">
                      <Text fontWeight="semibold">Expires:</Text> {new Date(selectedCredit.expiresAt).toLocaleString()}
                    </Text>
                  )}
                  {selectedCredit.notes && (
                    <Text variant="bodyMd">
                      <Text fontWeight="semibold">Notes:</Text> {selectedCredit.notes}
                    </Text>
                  )}
                </Stack>
              </Stack>

              {/* Actions */}
              <Stack spacing="base">
                <Text variant="headingSm">Actions</Text>
                
                <Stack direction="horizontal" spacing="tight">
                  <Button
                    onPress={() => setViewMode('list')}
                    title="Back to List"
                    variant="secondary"
                  />
                  
                  {selectedCredit.status === 'ACTIVE' && (
                    <Button
                      onPress={() => handleEditCredit(selectedCredit)}
                      title="Edit Credit"
                      variant="primary"
                    />
                  )}
                </Stack>
                
                <Button
                  onPress={() => setShowDeleteModal(true)}
                  title="Delete Credit"
                  variant="secondary"
                  tone="critical"
                  fullWidth
                />
              </Stack>
            </Stack>
          </ScrollView>
        </Screen>
      )}

      {/* Edit Credit Screen */}
      {viewMode === 'edit' && selectedCredit && (
        <Screen name="EditCredit" title="Edit Credit">
          <ScrollView>
            <Stack spacing="loose">
              <Text variant="headingMd">
                Edit {formatCreditNoteNumber(selectedCredit.noteNumber)}
              </Text>
              
              <TextField
                label="Customer Name"
                value={editingCredit.customerName || ''}
                onChange={(value) => setEditingCredit(prev => ({ ...prev, customerName: value }))}
              />
              
              <TextField
                label="Remaining Amount"
                type="number"
                value={editingCredit.remainingAmount?.toString() || ''}
                onChange={(value) => setEditingCredit(prev => ({ 
                  ...prev, 
                  remainingAmount: parseFloat(value) || 0 
                }))}
                step="0.01"
                min="0"
                max={selectedCredit.originalAmount.toString()}
              />
              
              <TextField
                label="Expiration Date"
                type="date"
                value={editingCredit.expiresAt ? editingCredit.expiresAt.split('T')[0] : ''}
                onChange={(value) => setEditingCredit(prev => ({ 
                  ...prev, 
                  expiresAt: value ? new Date(value).toISOString() : null 
                }))}
              />
              
              <TextField
                label="Notes"
                value={editingCredit.notes || ''}
                onChange={(value) => setEditingCredit(prev => ({ ...prev, notes: value }))}
                multiline
              />
              
              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => setViewMode('details')}
                  title="Cancel"
                  variant="secondary"
                />
                
                <Button
                  onPress={handleSaveCredit}
                  title="Save Changes"
                  variant="primary"
                  loading={loading}
                  disabled={loading}
                />
              </Stack>
            </Stack>
          </ScrollView>
        </Screen>
      )}
      
      {/* Delete Confirmation using Banner instead of Modal */}
      {showDeleteModal && selectedCredit && (
        <Banner tone="critical" title="Confirm Delete">
          <Stack spacing="base">
            <Text>
              Delete credit note {selectedCredit.noteNumber}? This cannot be undone.
            </Text>
            
            <Stack direction="horizontal" spacing="tight">
              <Button
                onPress={() => setShowDeleteModal(false)}
                title="Cancel"
                variant="secondary"
              />
              
              <Button
                onPress={handleDeleteCredit}
                title="Delete"
                variant="primary"
                loading={loading}
                disabled={loading}
              />
            </Stack>
          </Stack>
        </Banner>
      )}
    </Navigator>
  );
};

export default CompleteCreditManager;