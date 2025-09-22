import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const BarcodeScannerTile = () => {
  const api = useApi();
  const [activeCredits, setActiveCredits] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'backend' | 'unknown'>('unknown');

  // Initialize POS API client (recommended approach for POS UI Extensions)
  const apiClient = new POSApiClient();

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Redeem Credits] 🚀 Loading metrics with POS Session Token API (2025-07 recommended pattern)...');
      setAuthMethod('backend');

      const response = await apiClient.getCreditNotes(api.session, {
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (response.success && Array.isArray(response.data)) {
        const credits = response.data;
        console.log('[Redeem Credits] ✅ Backend Success! Loaded', credits.length, 'credits from shop:', response.metadata?.shop);

        const activeCount = credits.filter((credit: any) => {
          const status = credit?.status?.toLowerCase();
          return status === 'active' || status === 'partially_used';
        }).length;

        const totalAmount = credits.reduce((sum: number, credit: any) => {
          const status = credit?.status?.toLowerCase();
          if (status === 'active' || status === 'partially_used') {
            const amount = parseFloat(credit?.remainingAmount || '0');
            return sum + (isNaN(amount) ? 0 : amount);
          }
          return sum;
        }, 0);

        setActiveCredits(activeCount);
        setTotalValue(totalAmount);
        setError(null);

      } else {
        console.error('[Redeem Credits] ❌ Backend API Error:', response.error);

        // Run diagnostics to help identify the issue
        console.log('[Redeem Credits] Running diagnostics to identify the problem...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics(api.session);
          console.log('[Redeem Credits] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[Redeem Credits] 📊 Server Environment:', diag.server?.environment);
            console.log('[Redeem Credits] 🔐 Authentication Status:', diag.authentication);
            console.log('[Redeem Credits] 💾 Database Status:', diag.database);
          }
        } catch (diagError) {
          console.error('[Redeem Credits] ❌ Diagnostic check also failed:', diagError);
        }

        setError(response.error || 'Failed to load credit data');
        setActiveCredits(0);
        setTotalValue(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Redeem Credits] ❌ Exception:', errorMessage);
      setError(`${errorMessage} - Check: User app permissions, Email login (not PIN), POS version 10.6.0+`);
      setActiveCredits(0);
      setTotalValue(0);
    } finally {
      setIsLoading(false);
    }
  }, [api, apiClient]);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 60000);
    return () => clearInterval(interval);
  }, [loadMetrics]);

  const handlePress = () => {
    if (api.action?.presentModal) {
      api.action.presentModal();
    }
  };

  const buildSubtitle = () => {
    if (isLoading) {
      return 'Loading credit data...';
    }
    if (error) {
      return 'Connection error - tap to retry';
    }
    if (activeCredits > 0) {
      const methodIndicator = ' (Backend)';
      return `${activeCredits} active • $${totalValue.toFixed(2)} value${methodIndicator}`;
    }
    return 'No active credits';
  };

  return (
    <Tile
      title="Redeem Credits"
      subtitle={buildSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={activeCredits > 0 ? activeCredits : undefined}
      destructive={false}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <BarcodeScannerTile />);