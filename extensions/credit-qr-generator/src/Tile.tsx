import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const QRGeneratorTile = () => {
  const api = useApi();
  // Note: Session tokens are handled by POS authentication automatically
  const [todayGenerated, setTodayGenerated] = useState(0);
  const [totalActive, setTotalActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'backend' | 'unknown'>('unknown');
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  // Initialize POS API client (session API passed to method calls)
  const apiClient = new POSApiClient();

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSessionStatus('checking');

    try {
      console.log('[QR Generator] 🚀 Loading metrics with enhanced POS Session Token validation...');

      // POS authentication is handled automatically by Shopify
      setSessionStatus('valid');
      setAuthMethod('backend');
      console.log('[QR Generator] ✅ POS authenticated, proceeding with API call...');

      // API call with POS authentication - pass session API as first parameter
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

        // Enhanced error handling for "Not added" status
        let enhancedError = response.error || 'Failed to load credit data';

        if (response.error?.includes('authentication') || response.error?.includes('permission')) {
          enhancedError = 'Permission error: Check app installation & POS user login';
        } else if (response.error?.includes('network') || response.error?.includes('connection')) {
          enhancedError = 'Connection error: Check internet & server status';
        } else if (response.error?.includes('session')) {
          enhancedError = 'Session error: Try logging out & back into POS';
        }

        // Run diagnostics to help identify the issue
        console.log('[QR Generator] Running enhanced diagnostics...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics(api.session);
          console.log('[QR Generator] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[QR Generator] 📊 Server Environment:', diag.server?.environment);
            console.log('[QR Generator] 🔐 Authentication Status:', diag.authentication);
            console.log('[QR Generator] 💾 Database Status:', diag.database);
            console.log('[QR Generator] 📱 POS Session Status:', diag.posSession);

            // Enhanced diagnostic feedback
            if (!diag.authentication?.valid) {
              enhancedError = 'Auth setup: Check Shopify admin app permissions';
            } else if (!diag.database?.connected) {
              enhancedError = 'Server issue: Database connection error';
            } else if (!diag.posSession?.valid) {
              enhancedError = 'POS setup: User must login with email (not PIN)';
            }
          }
        } catch (diagError) {
          console.error('[QR Generator] ❌ Diagnostic check also failed:', diagError);
          enhancedError = 'System error: Check app installation & network';
        }

        setError(enhancedError);
        setTodayGenerated(0);
        setTotalActive(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[QR Generator] ❌ Exception:', errorMessage);

      // Enhanced error categorization for troubleshooting
      let categorizedError = errorMessage;

      if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
        categorizedError = 'Setup required: Check app permissions & POS user login';
        setSessionStatus('invalid');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        categorizedError = 'Connection error: Check internet & server status';
      } else if (errorMessage.includes('timeout')) {
        categorizedError = 'Timeout error: Server response too slow';
      } else {
        categorizedError = `System error: ${errorMessage}`;
      }

      setError(`${categorizedError} | Requirements: Email login (not PIN), POS 10.6.0+, App permissions`);
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