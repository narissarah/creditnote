import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const QRGeneratorTile = () => {
  const api = useApi();
  const [todayGenerated, setTodayGenerated] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'backend' | 'unknown'>('unknown');

  // Initialize POS API client (recommended approach for POS UI Extensions)
  const apiClient = new POSApiClient();

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[QR Generator] 🚀 Loading metrics with POS Session Token API (2025-07 recommended pattern)...');
      setAuthMethod('backend');

      const response = await apiClient.getCreditNotes(api.session, {
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (response.success && Array.isArray(response.data)) {
        const credits = response.data;
        console.log('[QR Generator] ✅ Backend Success! Loaded', credits.length, 'credits from shop:', response.metadata?.shop);

        const today = new Date().toDateString();

        const todayCount = credits.filter((credit: any) => {
          if (!credit?.createdAt) return false;
          return new Date(credit.createdAt).toDateString() === today;
        }).length;

        const activeCount = credits.filter((credit: any) => {
          const status = credit?.status?.toLowerCase();
          return status === 'active' || status === 'partially_used';
        }).length;

        setTodayGenerated(todayCount);
        setTotalActive(activeCount);
        setError(null);

      } else {
        console.error('[QR Generator] ❌ Backend API Error:', response.error);

        // Run diagnostics to help identify the issue
        console.log('[QR Generator] Running diagnostics to identify the problem...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics(api.session);
          console.log('[QR Generator] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[QR Generator] 📊 Server Environment:', diag.server?.environment);
            console.log('[QR Generator] 🔐 Authentication Status:', diag.authentication);
            console.log('[QR Generator] 💾 Database Status:', diag.database);
          }
        } catch (diagError) {
          console.error('[QR Generator] ❌ Diagnostic check also failed:', diagError);
        }

        setError(response.error || 'Failed to load credit data');
        setTodayGenerated(0);
        setTotalActive(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[QR Generator] ❌ Exception:', errorMessage);
      setError(`${errorMessage} - Check: User app permissions, Email login (not PIN), POS version 10.6.0+`);
      setTodayGenerated(0);
      setTotalActive(0);
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
    if (todayGenerated > 0 || totalActive > 0) {
      const methodIndicator = ' (Backend)';
      return `${todayGenerated} created today • ${totalActive} active${methodIndicator}`;
    }
    return 'Ready to create';
  };

  return (
    <Tile
      title="QR Generator"
      subtitle={buildSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={todayGenerated > 0 ? todayGenerated : undefined}
      destructive={false}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <QRGeneratorTile />);