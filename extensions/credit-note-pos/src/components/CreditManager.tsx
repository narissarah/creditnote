// Main Credit Manager component that combines scanner and list functionality
import React, { useState, useCallback } from 'react';
import {
  reactExtension,
  useApi,
  Navigator,
  Screen,
  ScrollView,
  Stack,
  Text,
  Button,
  Banner
} from '@shopify/ui-extensions-react/point-of-sale';

import { CreditNote } from '../types/credit.types';
import CreditScanner from './CreditScanner';
import CreditList from './CreditList';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { formatCreditAmount } from '../utils/qrcode.utils';

const CreditManager: React.FC = () => {
  const api = useApi<'pos.home.modal.render'>();
  
  // State
  const [activeTab, setActiveTab] = useState('scanner');
  const [selectedCredit, setSelectedCredit] = useState<CreditNote | null>(null);
  const [appliedCredits, setAppliedCredits] = useState<CreditNote[]>([]);

  // Hooks
  const { isOnline, pendingItems, processQueue, syncInProgress } = useOfflineSync();

  /**
   * Handle credit selection from scanner or list
   */
  const handleCreditSelected = useCallback(async (credit: CreditNote) => {
    setSelectedCredit(credit);
    
    // Add to applied credits for reference
    setAppliedCredits(prev => {
      const existing = prev.find(c => c.id === credit.id);
      if (existing) return prev;
      return [...prev, credit];
    });

    // Show success message
    api.toast.show(
      `Credit ${credit.noteNumber} ready to apply`,
      'success'
    );
  }, [api]);

  /**
   * Handle errors from scanner or operations
   */
  const handleError = useCallback((error: string) => {
    api.toast.show(error, 'error');
  }, [api]);

  /**
   * Get current cart total for reference
   */
  const getCartTotal = useCallback(async () => {
    try {
      const cart = await api.cart.subscribable.value;
      return cart.totalAmount || 0;
    } catch (error) {
      return 0;
    }
  }, [api]);

  return (
    <Navigator>
      <Screen name="CreditManager" title="Store Credits">
        <ScrollView>
          <Stack spacing="base">
            {/* Status Banner */}
            {!isOnline && (
              <Banner status="warning">
                <Stack spacing="tight">
                  <Text>Offline Mode Active</Text>
                  <Text variant="bodySm">
                    {pendingItems.length} operations pending sync
                  </Text>
                  {pendingItems.length > 0 && (
                    <Button
                      onPress={processQueue}
                      title="Sync Now"
                      variant="secondary"
                      loading={syncInProgress}
                      size="small"
                    />
                  )}
                </Stack>
              </Banner>
            )}

            {/* Tab Navigation */}
            <Stack spacing="base">
              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => setActiveTab('scanner')}
                  title="QR Scanner"
                  variant={activeTab === 'scanner' ? 'primary' : 'secondary'}
                  fullWidth
                />
                <Button
                  onPress={() => setActiveTab('browse')}
                  title="Browse Credits"
                  variant={activeTab === 'browse' ? 'primary' : 'secondary'}
                  fullWidth
                />
                <Button
                  onPress={() => setActiveTab('applied')}
                  title={`Applied (${appliedCredits.length})`}
                  variant={activeTab === 'applied' ? 'primary' : 'secondary'}
                  fullWidth
                />
              </Stack>


              {/* Tab Content */}
              {activeTab === 'scanner' && (
                <CreditScanner
                  onCreditSelected={handleCreditSelected}
                  onError={handleError}
                  autoApply={true}
                />
              )}

              {activeTab === 'browse' && (
                <CreditList
                  onCreditSelect={handleCreditSelected}
                  showExpired={false}
                />
              )}

              {activeTab === 'applied' && (
                <AppliedCreditsView 
                  credits={appliedCredits}
                  onClearAll={() => setAppliedCredits([])}
                />
              )}
            </Stack>

            {/* Quick Actions & Sync Status */}
            <Stack spacing="base">
              <Text variant="headingSm">Quick Actions</Text>
              
              <Stack direction="horizontal" spacing="tight">
                <Button
                  onPress={() => setActiveTab('scanner')}
                  title="Scan Credit"
                  variant="primary"
                  fullWidth
                />
                
                <Button
                  onPress={() => setActiveTab('browse')}
                  title="Browse All"
                  variant="secondary"
                  fullWidth
                />
              </Stack>

              {isOnline && pendingItems.length > 0 && (
                <>
                  <Button
                    onPress={processQueue}
                    title={`Sync ${pendingItems.length} Pending`}
                    variant="secondary"
                    loading={syncInProgress}
                    fullWidth
                  />
                </>
              )}
            </Stack>

            {/* Instructions & Tips */}
            <Stack spacing="base">
              <Text variant="headingSm">How to Use</Text>
              <Stack spacing="tight">
                <Text variant="bodySm">• Use QR Scanner to quickly validate and apply credits</Text>
                <Text variant="bodySm">• Browse Credits to search and manage all available credits</Text>
                <Text variant="bodySm">• Applied Credits shows credits used in current session</Text>
                <Text variant="bodySm">• Credits work offline and sync when connection is restored</Text>
                {!isOnline && (
                  <Text variant="bodySm" color="warning">
                    • Offline mode: All changes will sync when online
                  </Text>
                )}
              </Stack>
            </Stack>
          </Stack>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

/**
 * Applied Credits View Component
 */
interface AppliedCreditsViewProps {
  credits: CreditNote[];
  onClearAll: () => void;
}

const AppliedCreditsView: React.FC<AppliedCreditsViewProps> = ({
  credits,
  onClearAll
}) => {
  const totalApplied = credits.reduce((sum, credit) => sum + credit.remainingAmount, 0);

  return (
    <Stack spacing="base">
      {credits.length === 0 ? (
        <Stack spacing="base" alignment="center">
          <Text variant="bodySm" color="subdued">
            No credits applied in this session
          </Text>
          <Text variant="bodySm" color="subdued">
            Credits will appear here after being scanned or selected
          </Text>
        </Stack>
      ) : (
        <>
          <Stack direction="horizontal" alignment="space-between">
            <Text variant="headingSm">
              Applied Credits ({credits.length})
            </Text>
            <Text variant="headingSm">
              Total: {formatCreditAmount(totalApplied)}
            </Text>
          </Stack>

          <Stack spacing="tight">
            {credits.map(credit => (
              <Stack key={credit.id} spacing="tight">
                <Stack direction="horizontal" alignment="space-between">
                  <Stack spacing="extraTight">
                    <Text variant="bodySm" color="emphasis">
                      {credit.noteNumber}
                    </Text>
                    {credit.customerName && (
                      <Text variant="bodySm" color="subdued">
                        {credit.customerName}
                      </Text>
                    )}
                  </Stack>
                  
                  <Text variant="bodySm" color="emphasis">
                    {formatCreditAmount(credit.remainingAmount, credit.currency)}
                  </Text>
                </Stack>
              </Stack>
            ))}
          </Stack>

          {credits.length > 0 && (
            <Button
              onPress={onClearAll}
              title="Clear All"
              variant="secondary"
              fullWidth
            />
          )}
        </>
      )}
    </Stack>
  );
};

// Export as POS UI Extension
export default reactExtension('pos.home.modal.render', () => <CreditManager />);