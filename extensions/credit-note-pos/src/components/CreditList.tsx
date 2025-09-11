// Credit note list and management interface for POS
import React, { useState, useEffect, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  Badge,
  Banner,
  List,
  SearchBar,
  TextField
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote, CreditListProps, CreditStatus } from '../types/credit.types';
import { useCreditOperations } from '../hooks/useCreditOperations';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCreditAmount, formatCreditNoteNumber, canRedeemCredit } from '../utils/qrcode.utils';
import { sanitizeSearchQuery, isNearExpiration } from '../utils/validation.utils';

const CreditList: React.FC<CreditListProps> = ({
  customerId,
  searchQuery: initialSearchQuery = '',
  onCreditSelect,
  showExpired = false
}) => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [sortBy, setSortBy] = useState<string>('created_desc');
  const [refreshing, setRefreshing] = useState(false);

  // Hooks
  const { fetchCredits, loading, error } = useCreditOperations();
  const { isOnline, pendingItems } = useOfflineSync();

  // Load credits on mount and when dependencies change
  useEffect(() => {
    loadCredits();
  }, [customerId, filterStatus, sortBy]);

  // Filter credits based on search query
  const filteredCredits = credits.filter(credit => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    
    return (
      credit.noteNumber.toLowerCase().includes(query) ||
      credit.customerName?.toLowerCase().includes(query) ||
      credit.customerEmail?.toLowerCase().includes(query) ||
      credit.reason?.toLowerCase().includes(query)
    );
  });

  // Sort credits
  const sortedCredits = [...filteredCredits].sort((a, b) => {
    switch (sortBy) {
      case 'created_desc':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'created_asc':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'amount_desc':
        return b.remainingAmount - a.remainingAmount;
      case 'amount_asc':
        return a.remainingAmount - b.remainingAmount;
      case 'expires_asc':
        if (!a.expiresAt && !b.expiresAt) return 0;
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      default:
        return 0;
    }
  });

  /**
   * Load credits from API
   */
  const loadCredits = useCallback(async () => {
    try {
      const response = await fetchCredits(customerId, searchQuery);
      if (response.success && response.credits) {
        let filteredCredits = response.credits;
        
        // Apply status filter
        if (filterStatus === 'active') {
          filteredCredits = filteredCredits.filter(c => 
            c.status === 'ACTIVE' || c.status === 'PARTIALLY_USED'
          );
        } else if (filterStatus === 'expired') {
          filteredCredits = filteredCredits.filter(c => 
            c.status === 'EXPIRED' || (c.expiresAt && new Date(c.expiresAt) < new Date())
          );
        } else if (filterStatus === 'used') {
          filteredCredits = filteredCredits.filter(c => c.status === 'FULLY_USED');
        }
        
        setCredits(filteredCredits);
      }
    } catch (err) {
      console.error('Failed to load credits:', err);
      api.toast.show('Failed to load credits', 'error');
    }
  }, [fetchCredits, customerId, searchQuery, filterStatus]);

  /**
   * Refresh credits list
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCredits();
      api.toast.show('Credits refreshed', 'success');
    } finally {
      setRefreshing(false);
    }
  }, [loadCredits]);

  /**
   * Handle credit selection
   */
  const handleCreditSelect = useCallback((credit: CreditNote) => {
    setSelectedCredit(credit);
    if (onCreditSelect) {
      onCreditSelect(credit);
    } else {
      setShowDetailsModal(true);
    }
  }, [onCreditSelect]);

  /**
   * Get status badge for credit note
   */
  const getStatusBadge = useCallback((credit: CreditNote) => {
    let status: 'success' | 'warning' | 'critical' | 'info' = 'success';
    let label = credit.status;

    switch (credit.status) {
      case 'ACTIVE':
        status = 'success';
        break;
      case 'PARTIALLY_USED':
        status = 'warning';
        break;
      case 'FULLY_USED':
        status = 'info';
        break;
      case 'EXPIRED':
        status = 'critical';
        break;
      case 'CANCELLED':
      case 'SUSPENDED':
        status = 'critical';
        break;
    }

    // Check if near expiration
    if (credit.expiresAt && isNearExpiration(credit.expiresAt)) {
      status = 'warning';
      label = 'EXPIRES SOON';
    }

    return <Badge status={status}>{label}</Badge>;
  }, []);

  /**
   * Get redemption info for credit
   */
  const getRedemptionInfo = useCallback((credit: CreditNote) => {
    const { canRedeem, reason, maxAmount } = canRedeemCredit(credit);
    
    return {
      canRedeem,
      reason,
      maxAmount,
      isNearExpiry: credit.expiresAt ? isNearExpiration(credit.expiresAt) : false
    };
  }, []);

  return (
    <Navigator>
      <Screen name="CreditList" title="Store Credits">
        <ScrollView>
          <Stack spacing="base">
            {/* Status Banner */}
            {!isOnline && (
              <Banner status="warning">
                <Text>Offline mode - {pendingItems.length} items pending sync</Text>
              </Banner>
            )}

            {error && (
              <Banner status="critical">
                <Text>{error}</Text>
              </Banner>
            )}

            {/* Search and Filters */}
            <Stack spacing="base">
              <TextField
                label="Search Credits"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by number, customer, or reason..."
                clearButton
              />

              <Stack spacing="tight">
                <Text variant="bodySm" color="subdued">Filter by Status</Text>
                <Stack direction="horizontal" spacing="tight">
                  {[
                    { label: 'Active', value: 'active' },
                    { label: 'Used', value: 'used' },
                    { label: 'Expired', value: 'expired' },
                    { label: 'All', value: 'all' }
                  ].map(option => (
                    <Button
                      key={option.value}
                      title={option.label}
                      variant={filterStatus === option.value ? 'primary' : 'secondary'}
                      size="small"
                      onPress={() => setFilterStatus(option.value)}
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack spacing="tight">
                <Text variant="bodySm" color="subdued">Sort Order</Text>
                <Stack direction="horizontal" spacing="tight">
                  {[
                    { label: 'Newest', value: 'created_desc' },
                    { label: 'Amount ↓', value: 'amount_desc' },
                    { label: 'Expires Soon', value: 'expires_asc' }
                  ].map(option => (
                    <Button
                      key={option.value}
                      title={option.label}
                      variant={sortBy === option.value ? 'primary' : 'secondary'}
                      size="small"
                      onPress={() => setSortBy(option.value)}
                    />
                  ))}
                </Stack>
              </Stack>

              <Button
                onPress={handleRefresh}
                title="Refresh Credits"
                variant="secondary"
                loading={refreshing || loading}
                disabled={refreshing || loading}
                fullWidth
              />
            </Stack>

            {/* Credits List */}
            <Stack spacing="base">
              <Stack direction="horizontal" alignment="space-between">
                <Text variant="headingMd">Credit Notes</Text>
                <Text variant="bodySm" color="subdued">
                  {sortedCredits.length} found
                </Text>
              </Stack>

              {sortedCredits.length === 0 ? (
                  <Stack spacing="base" alignment="center">
                    <Text variant="bodySm" color="subdued">
                      {loading ? 'Loading credits...' : 'No credit notes found'}
                    </Text>
                    {!loading && customerId && (
                      <Text variant="bodySm" color="subdued">
                        Try adjusting your search or filters
                      </Text>
                    )}
                  </Stack>
              ) : (
                <Stack spacing="tight">
                  {sortedCredits.map(credit => {
                    const redemptionInfo = getRedemptionInfo(credit);
                    
                    return (
                      <Button
                        key={credit.id}
                        onPress={() => handleCreditSelect(credit)}
                        variant="secondary"
                        fullWidth
                      >
                        <Stack spacing="tight" alignment="start">
                          <Stack direction="horizontal" alignment="space-between">
                            <Stack direction="horizontal" spacing="tight" alignment="center">
                              {getStatusBadge(credit)}
                              <Text variant="bodySm" color="emphasis">
                                {formatCreditNoteNumber(credit.noteNumber)}
                              </Text>
                            </Stack>
                            <Text variant="headingSm">
                              {formatCreditAmount(credit.remainingAmount, credit.currency)}
                            </Text>
                          </Stack>
                          
                          {credit.customerName && (
                            <Text variant="bodySm">
                              {credit.customerName}
                            </Text>
                          )}
                          
                          <Stack direction="horizontal" spacing="tight">
                            <Text variant="bodySm" color="subdued">
                              {new Date(credit.createdAt).toLocaleDateString()}
                            </Text>
                            
                            {credit.expiresAt && (
                              <Text 
                                variant="bodySm" 
                                color={redemptionInfo.isNearExpiry ? "warning" : "subdued"}
                              >
                                Expires: {new Date(credit.expiresAt).toLocaleDateString()}
                              </Text>
                            )}
                          </Stack>
                          
                          {credit.reason && (
                            <Text variant="bodySm" color="subdued">
                              {credit.reason}
                            </Text>
                          )}
                        </Stack>
                      </Button>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>

      {/* Credit Details Screen */}
      {showDetailsModal && selectedCredit && (
        <Screen name="CreditDetails" title="Credit Details">
          <ScrollView>
            <Stack spacing="base">
              <Stack direction="horizontal" alignment="space-between">
                <Text variant="headingMd">
                  {formatCreditNoteNumber(selectedCredit.noteNumber)}
                </Text>
                {getStatusBadge(selectedCredit)}
              </Stack>


              <Stack spacing="tight">
                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="bodySm" color="subdued">Available Amount:</Text>
                  <Text variant="headingSm">
                    {formatCreditAmount(selectedCredit.remainingAmount, selectedCredit.currency)}
                  </Text>
                </Stack>

                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="bodySm" color="subdued">Original Amount:</Text>
                  <Text variant="bodySm">
                    {formatCreditAmount(selectedCredit.originalAmount, selectedCredit.currency)}
                  </Text>
                </Stack>

                {selectedCredit.customerName && (
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm" color="subdued">Customer:</Text>
                    <Text variant="bodySm">{selectedCredit.customerName}</Text>
                  </Stack>
                )}

                <Stack direction="horizontal" alignment="space-between">
                  <Text variant="bodySm" color="subdued">Created:</Text>
                  <Text variant="bodySm">
                    {new Date(selectedCredit.createdAt).toLocaleDateString()}
                  </Text>
                </Stack>

                {selectedCredit.expiresAt && (
                  <Stack direction="horizontal" alignment="space-between">
                    <Text variant="bodySm" color="subdued">Expires:</Text>
                    <Text variant="bodySm">
                      {new Date(selectedCredit.expiresAt).toLocaleDateString()}
                    </Text>
                  </Stack>
                )}

                {selectedCredit.reason && (
                  <>
                    <Text variant="bodySm" color="subdued">Reason:</Text>
                    <Text variant="bodySm">{selectedCredit.reason}</Text>
                  </>
                )}
              </Stack>


              <Stack direction="horizontal" spacing="tight">
                {getRedemptionInfo(selectedCredit).canRedeem ? (
                  <Button
                    onPress={() => {
                      onCreditSelect?.(selectedCredit);
                      setShowDetailsModal(false);
                    }}
                    title="Use Credit"
                    variant="primary"
                  />
                ) : (
                  <Text variant="bodySm" color="critical">
                    {getRedemptionInfo(selectedCredit).reason}
                  </Text>
                )}
                
                <Button
                  onPress={() => {
                    setShowDetailsModal(false);
                    setSelectedCredit(null);
                  }}
                  title="Back"
                  variant="secondary"
                />
              </Stack>
            </Stack>
          </ScrollView>
        </Screen>
      )}
    </Navigator>
  );
};

export default CreditList;