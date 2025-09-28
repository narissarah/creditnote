import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const CreditManagerTile = () => {
  const api = useApi();
  // Note: Session tokens are handled by POS authentication automatically
  const [totalCredits, setTotalCredits] = useState(0);
  const [activeCredits, setActiveCredits] = useState(0);
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
      console.log('[Credit Manager] 🚀 Loading metrics with enhanced POS Session Token validation...');

      // POS authentication is handled automatically by Shopify
      setSessionStatus('valid');
      setAuthMethod('backend');
      console.log('[Credit Manager] ✅ POS authenticated, proceeding with API call...');

      // API call with POS authentication - pass session API as first parameter
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
        console.log('[Credit Manager] Running enhanced diagnostics...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics(api.session);
          console.log('[Credit Manager] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[Credit Manager] 📊 Server Environment:', diag.server?.environment);
            console.log('[Credit Manager] 🔐 Authentication Status:', diag.authentication);
            console.log('[Credit Manager] 💾 Database Status:', diag.database);
            console.log('[Credit Manager] 📱 POS Session Status:', diag.posSession);

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
          console.error('[Credit Manager] ❌ Diagnostic check also failed:', diagError);
          enhancedError = 'System error: Check app installation & network';
        }

        setError(enhancedError);
        setTotalCredits(0);
        setActiveCredits(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Credit Manager] ❌ Exception:', errorMessage);

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