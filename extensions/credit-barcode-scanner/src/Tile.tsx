import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const BarcodeScannerTile = () => {
  const api = useApi();
  // Note: Session tokens are handled by POS authentication automatically
  const [activeCredits, setActiveCredits] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'backend' | 'unknown'>('unknown');
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  // Initialize POS API client (recommended approach for POS UI Extensions)
  const apiClient = new POSApiClient();

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSessionStatus('checking');

    try {
      console.log('[Redeem Credits] 🚀 Loading metrics with enhanced POS Session Token validation...');

      // POS authentication is handled automatically by Shopify
      setSessionStatus('valid');
      setAuthMethod('backend');
      console.log('[Redeem Credits] ✅ POS authenticated, proceeding with API call...');

      // API call with POS authentication
      const response = await apiClient.getCreditNotes('', {
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        // Pass additional validation parameters
        validateSession: true,
        posVersion: api.version || 'unknown'
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
        console.log('[Redeem Credits] Running enhanced diagnostics...');
        try {
          const diagnosticResult = await apiClient.runDiagnostics('');
          console.log('[Redeem Credits] 🔍 Diagnostic Result:', diagnosticResult);

          if (diagnosticResult.success && diagnosticResult.data?.diagnostics) {
            const diag = diagnosticResult.data.diagnostics;
            console.log('[Redeem Credits] 📊 Server Environment:', diag.server?.environment);
            console.log('[Redeem Credits] 🔐 Authentication Status:', diag.authentication);
            console.log('[Redeem Credits] 💾 Database Status:', diag.database);
            console.log('[Redeem Credits] 📱 POS Session Status:', diag.posSession);

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
          console.error('[Redeem Credits] ❌ Diagnostic check also failed:', diagError);
          enhancedError = 'System error: Check app installation & network';
        }

        setError(enhancedError);
        setActiveCredits(0);
        setTotalValue(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Redeem Credits] ❌ Exception:', errorMessage);

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
      // Enhanced error messages based on official troubleshooting guide
      if (error.includes('Session token null') || error.includes('Smart Grid Tile Activation Error')) {
        return 'Setup required - check permissions';
      }
      if (error.includes('Authentication') || error.includes('permissions')) {
        return 'Permission error - tap for help';
      }
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