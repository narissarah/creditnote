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

  const loadMetrics = useCallback(async (retryCount = 0) => {
    // CRITICAL FIX 2025-07: Never throw errors that crash the tile
    // POS tiles must ALWAYS render successfully, even if data loading fails

    setIsLoading(true);
    setError(null);
    setSessionStatus('checking');

    try {
      console.log('[Credit Manager] 🚀 Loading metrics (attempt', retryCount + 1, ')...');

      // CRITICAL: Shopify docs state "if device has gone idle, it can take multiple attempts to get session token"
      // Solution: Implement retry logic with exponential backoff

      setSessionStatus('valid');
      setAuthMethod('backend');
      console.log('[Credit Manager] ✅ POS session checking, proceeding with API call...');

      // API call with POS authentication - CRITICAL FIX: pass entire api object (not just api.session)
      const response = await apiClient.getCreditNotes(api, {
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

        // CRITICAL: Check if this is a session token error that needs retry
        const isSessionError = response.error?.includes('session') ||
                              response.error?.includes('token') ||
                              response.error?.includes('Authentication');

        // Shopify docs: "it can take multiple attempts" - retry up to 3 times
        if (isSessionError && retryCount < 3) {
          const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(`[Credit Manager] 🔄 Session token issue detected, retrying in ${retryDelay}ms...`);

          setTimeout(() => {
            loadMetrics(retryCount + 1);
          }, retryDelay);

          return; // Exit early, retry will happen after delay
        }

        // Enhanced error handling for "Not added" status
        let enhancedError = response.error || 'Failed to load credit data';

        if (response.error?.includes('authentication') || response.error?.includes('permission')) {
          enhancedError = 'Tap to retry - Check app permissions';
        } else if (response.error?.includes('network') || response.error?.includes('connection')) {
          enhancedError = 'Tap to retry - Connection error';
        } else if (response.error?.includes('session') || response.error?.includes('token')) {
          enhancedError = 'Tap to retry - Session initializing';
        } else {
          enhancedError = 'Tap to retry - ' + (response.error || 'Unknown error');
        }

        setError(enhancedError);
        setTotalCredits(0);
        setActiveCredits(0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Credit Manager] ❌ Exception:', errorMessage);

      // CRITICAL: Check if this is a session token error that needs retry
      const isSessionError = errorMessage.includes('session') ||
                            errorMessage.includes('token') ||
                            errorMessage.includes('Authentication') ||
                            errorMessage.includes('unauthorized');

      // Shopify docs: "it can take multiple attempts" - retry up to 3 times
      if (isSessionError && retryCount < 3) {
        const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`[Credit Manager] 🔄 Session error detected, retrying in ${retryDelay}ms...`);

        setTimeout(() => {
          loadMetrics(retryCount + 1);
        }, retryDelay);

        return; // Exit early, retry will happen after delay
      }

      // Enhanced error categorization for troubleshooting
      let categorizedError = 'Tap to retry';

      if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
        categorizedError = 'Tap to retry - Check app permissions';
        setSessionStatus('invalid');
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        categorizedError = 'Tap to retry - Connection error';
      } else if (errorMessage.includes('timeout')) {
        categorizedError = 'Tap to retry - Server timeout';
      } else if (errorMessage.includes('session') || errorMessage.includes('token')) {
        categorizedError = 'Tap to retry - Session initializing';
      }

      setError(categorizedError);
      setTotalCredits(0);
      setActiveCredits(0);
    } finally {
      setIsLoading(false);
    }
  }, [api, apiClient]);

  useEffect(() => {
    // CRITICAL FIX 2025-07: Delay initial load to allow session initialization
    // Shopify docs: "if device has gone idle, it can take multiple attempts to get session token"
    // Solution: Give POS 2 seconds to initialize session before first API call

    console.log('[Credit Manager] 🕐 Scheduling initial load with 2s delay for session initialization...');

    const initialLoadTimer = setTimeout(() => {
      console.log('[Credit Manager] ⏰ Initial load timer fired, calling loadMetrics()');
      loadMetrics();
    }, 2000); // 2 second delay for session to initialize

    // Refresh every 60 seconds after initial load
    const interval = setInterval(() => {
      console.log('[Credit Manager] 🔄 Auto-refresh interval triggered');
      loadMetrics();
    }, 60000);

    return () => {
      clearTimeout(initialLoadTimer);
      clearInterval(interval);
    };
  }, [loadMetrics]);

  const handlePress = () => {
    // CRITICAL FIX 2025-07: If there's an error, tapping should retry instead of opening modal
    // This gives users a way to recover from session token initialization issues
    if (error) {
      console.log('[Credit Manager] 🔄 User tapped tile with error - retrying load...');
      loadMetrics(); // Reset retry count by calling without arguments
    } else if (api.action?.presentModal) {
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