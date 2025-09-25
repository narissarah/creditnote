import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const CreditManagerTile = () => {
  const api = useApi();
  const [totalCredits, setTotalCredits] = useState(0);
  const [activeCredits, setActiveCredits] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'backend' | 'unknown'>('unknown');

  // Initialize POS API client (recommended approach for POS UI Extensions)
  const apiClient = new POSApiClient();

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[Credit Manager] 🚀 Loading metrics with POS Session Token API (2025-07 recommended pattern)...');
      setAuthMethod('backend');

      const response = await apiClient.getCreditNotes(api.session, {
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (response.success && Array.isArray(response.data)) {
        const credits = response.data;
        console.log('[Credit Manager] ✅ Backend Success! Loaded', credits.length, 'credits from shop:', response.metadata?.shop);

        const activeCount = credits.filter((credit: any) => {
          const status = credit?.status?.toLowerCase();
          return status === 'active' || status === 'partially_used';
        }).length;

        setTotalCredits(response.total || 0);
        setActiveCredits(activeCount);
        setError(null);

      } else {
        console.error('[Credit Manager] ❌ Backend API Error:', response.error);

        // Run diagnostics to help identify the issue
        console.log('[Credit Manager] Running diagnostics to identify the problem...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics(api.session);
          console.log('[Credit Manager] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[Credit Manager] 📊 Server Environment:', diag.server?.environment);
            console.log('[Credit Manager] 🔐 Authentication Status:', diag.authentication);
            console.log('[Credit Manager] 💾 Database Status:', diag.database);
          }
        } catch (diagError) {
          console.error('[Credit Manager] ❌ Diagnostic check also failed:', diagError);
        }

        setError(response.error || 'Failed to load credit data');
        setTotalCredits(0);
        setActiveCredits(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Credit Manager] ❌ Exception:', errorMessage);
      setError(`${errorMessage} - Check: User app permissions, Email login (not PIN), POS version 10.6.0+`);
      setTotalCredits(0);
      setActiveCredits(0);
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
      // Enhanced error messages based on official troubleshooting guide
      if (error.includes('Session token null') || error.includes('Smart Grid Tile Activation Error')) {
        return 'Setup required - check permissions';
      }
      if (error.includes('Authentication') || error.includes('permissions')) {
        return 'Permission error - tap for help';
      }
      return 'Connection error - tap to retry';
    }
    if (totalCredits > 0) {
      const methodIndicator = ' (Backend)';
      return `${activeCredits} active • ${totalCredits} total${methodIndicator}`;
    }
    return 'No credits found';
  };

  return (
    <Tile
      title="Manage Credits"
      subtitle={buildSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={activeCredits > 0 ? activeCredits : undefined}
      destructive={false}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CreditManagerTile />);