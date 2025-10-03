import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';
import { POSApiClient } from '../../shared/pos-api-client';

const CreditManagerTile = () => {
  // CRITICAL VERSION MARKER - Check Vercel logs for this to confirm which version is running
  console.log('🚀🚀🚀 CREDIT MANAGER TILE v1.1.2 - FORCE BUNDLE REFRESH 🚀🚀🚀');
  console.log('[Credit Manager] Extension Version: 1.1.2-force-bundle-refresh');
  console.log('[Credit Manager] Deployment Date: 2025-10-03T16:45:00Z');
  console.log('[Credit Manager] Features: SessionTokenManager with 10-retry logic + CDN cache bust');

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

  const loadMetrics = useCallback(async (isInitialLoad = false) => {
    // CRITICAL FIX 2025-10-03: Using new SessionTokenManager with built-in retry logic
    // No need for manual retry loop here - SessionTokenManager handles it
    // Reference: https://shopify.dev/docs/api/pos-ui-extensions/2025-07/apis/session-api

    setIsLoading(true);
    setError(null);
    setSessionStatus('checking');

    try {
      console.log(`[Credit Manager] 🚀 Loading metrics (initialLoad=${isInitialLoad})...`);

      // CRITICAL DIAGNOSTIC: Log complete API structure to identify correct paths
      console.log('[Credit Manager] 🔍 COMPLETE API STRUCTURE INSPECTION:');
      console.log('[Credit Manager] API top-level keys:', api ? Object.keys(api) : 'api is null/undefined');
      console.log('[Credit Manager] API type:', typeof api);

      // Check session property
      console.log('[Credit Manager] Has api.session?:', !!api?.session);
      console.log('[Credit Manager] api.session keys:', api?.session ? Object.keys(api.session) : 'no session');
      console.log('[Credit Manager] api.session type:', typeof api?.session);

      // Check currentSession property (official 2025-07 path)
      console.log('[Credit Manager] Has api.session.currentSession?:', !!api?.session?.currentSession);
      console.log('[Credit Manager] api.session.currentSession keys:',
        api?.session?.currentSession ? Object.keys(api.session.currentSession) : 'no currentSession');
      console.log('[Credit Manager] api.session.currentSession type:', typeof api?.session?.currentSession);

      // Try to extract shop domain using OFFICIAL 2025-07 path
      const officialShopDomain = api?.session?.currentSession?.shopDomain;
      console.log('[Credit Manager] 🏪 Official path (api.session.currentSession.shopDomain):', officialShopDomain);
      console.log('[Credit Manager] Official shopDomain type:', typeof officialShopDomain);

      // Try alternative paths
      console.log('[Credit Manager] Alternative paths inspection:');
      console.log('[Credit Manager]   - api.session.currentSession.shop:', api?.session?.currentSession?.shop);
      console.log('[Credit Manager]   - api.session.shopDomain:', api?.session?.shopDomain);
      console.log('[Credit Manager]   - api.session.shop:', api?.session?.shop);
      console.log('[Credit Manager]   - api.shopDomain:', api?.shopDomain);
      console.log('[Credit Manager]   - api.shop:', api?.shop);

      // Check for getSessionToken method
      console.log('[Credit Manager] Has api.session.getSessionToken?:', typeof api?.session?.getSessionToken);
      console.log('[Credit Manager] getSessionToken is function?:', typeof api?.session?.getSessionToken === 'function');

      // CRITICAL: Send complete API structure to backend for server-side logging
      // Device console logs are inaccessible on iPhone, so we log to Vercel
      try {
        console.log('[Credit Manager] 📤 Sending diagnostic data to backend...');

        // Attempt to get session token for diagnostic
        let sessionTokenResult: any = {
          success: false,
          tokenType: 'not-attempted',
          isNull: false,
          isUndefined: false,
          tokenLength: 0,
          error: null
        };

        try {
          if (typeof api?.session?.getSessionToken === 'function') {
            const token = await api.session.getSessionToken();
            sessionTokenResult = {
              success: token !== null && token !== undefined,
              tokenType: typeof token,
              isNull: token === null,
              isUndefined: token === undefined,
              tokenLength: token ? String(token).length : 0,
              error: null
            };
          } else {
            sessionTokenResult.error = 'getSessionToken is not a function';
          }
        } catch (tokenError) {
          sessionTokenResult.error = tokenError instanceof Error ? tokenError.message : 'Unknown error';
        }

        // Extract all currentSession data
        const currentSessionData: any = {
          shopId: api?.session?.currentSession?.shopId,
          userId: api?.session?.currentSession?.userId,
          locationId: api?.session?.currentSession?.locationId,
          staffMemberId: api?.session?.currentSession?.staffMemberId,
          currency: api?.session?.currentSession?.currency,
          posVersion: api?.session?.currentSession?.posVersion,
          allKeys: api?.session?.currentSession ? Object.keys(api.session.currentSession) : []
        };

        // Build complete diagnostic payload
        const diagnosticPayload = {
          apiStructure: {
            topLevelKeys: api ? Object.keys(api).slice(0, 50) : [],
            apiType: typeof api,
            hasSession: !!api?.session,
            sessionKeys: api?.session ? Object.keys(api.session) : [],
            sessionType: typeof api?.session,
            hasCurrentSession: !!api?.session?.currentSession,
            currentSessionKeys: api?.session?.currentSession ? Object.keys(api.session.currentSession) : [],
            currentSessionType: typeof api?.session?.currentSession,
            hasGetSessionToken: typeof api?.session?.getSessionToken === 'function',
            getSessionTokenType: typeof api?.session?.getSessionToken,
            shopDomainPaths: {
              currentSessionShopDomain: api?.session?.currentSession?.shopDomain,
              currentSessionShop: api?.session?.currentSession?.shop,
              sessionShopDomain: api?.session?.shopDomain,
              sessionShop: api?.session?.shop,
              topLevelShopDomain: api?.shopDomain,
              topLevelShop: api?.shop
            }
          },
          sessionTokenAttempt: sessionTokenResult,
          currentSessionData: currentSessionData,
          context: {
            extensionPoint: 'pos.home.tile.render',
            retryAttempt: retryCount,
            loadTimestamp: new Date().toISOString()
          }
        };

        // Send to backend diagnostic endpoint
        const diagnosticResponse = await fetch('https://creditnote.vercel.app/api/pos/diagnostic-log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(diagnosticPayload)
        });

        if (diagnosticResponse.ok) {
          console.log('[Credit Manager] ✅ Diagnostic data sent successfully to backend');
        } else {
          console.log('[Credit Manager] ⚠️ Diagnostic endpoint returned:', diagnosticResponse.status);
        }
      } catch (diagnosticError) {
        console.error('[Credit Manager] ❌ Failed to send diagnostic data:', diagnosticError);
      }

      // CRITICAL: Shopify docs state "if device has gone idle, it can take multiple attempts to get session token"
      // Solution: Extended retry logic with exponential backoff (up to 10 attempts for idle devices)

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
        setIsLoading(false);

      } else {
        console.error('[Credit Manager] ❌ Backend API Error:', response.error);

        // NEW 2025-10-03: SessionTokenManager handles all retries automatically
        // So if we get here, retries are already exhausted - show friendly error
        let enhancedError = 'Tap to open - Connection issue';

        if (response.error?.includes('authentication') || response.error?.includes('permission')) {
          enhancedError = 'Tap to open - Check permissions';
        } else if (response.error?.includes('session') || response.error?.includes('token')) {
          enhancedError = 'Tap to open - Auth unavailable';
        }

        setError(enhancedError);
        setTotalCredits(0);
        setActiveCredits(0);
        setIsLoading(false);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[Credit Manager] ❌ Exception:', errorMessage);

      // NEW 2025-10-03: SessionTokenManager handles all retries automatically
      // So if we get here, retries are already exhausted - show friendly error
      let categorizedError = 'Tap to open';

      if (errorMessage.includes('authentication') || errorMessage.includes('unauthorized')) {
        categorizedError = 'Tap to open - Check permissions';
        setSessionStatus('invalid');
      } else if (errorMessage.includes('session') || errorMessage.includes('token')) {
        categorizedError = 'Tap to open - Auth starting';
      }

      setError(categorizedError);
      setTotalCredits(0);
      setActiveCredits(0);
      setIsLoading(false);
    }
  }, [api, apiClient]);

  useEffect(() => {
    // NEW 2025-10-03: SessionTokenManager handles all retry logic automatically
    // Still use initial delay to let device wake from idle, but no manual retry needed
    // The SessionTokenManager will retry internally with exponential backoff

    console.log('[Credit Manager] 🕐 Scheduling initial load with 3s delay for device wake-up...');

    const initialLoadTimer = setTimeout(() => {
      console.log('[Credit Manager] ⏰ Initial load timer fired, starting loadMetrics()');
      loadMetrics(true); // Initial load
    }, 3000); // 3 second delay to allow device to wake from idle state

    // Refresh every 60 seconds after initial load
    const interval = setInterval(() => {
      console.log('[Credit Manager] 🔄 Auto-refresh interval triggered');
      loadMetrics(false); // Auto-refresh
    }, 60000);

    return () => {
      clearTimeout(initialLoadTimer);
      clearInterval(interval);
    };
  }, [loadMetrics]);

  const handlePress = () => {
    // CRITICAL FIX 2025-07: Always open modal on tap - modal loads after user interaction so session is ready
    // Modal consistently works (per testing) even when tile fails, because device is no longer idle
    // This provides best UX: tile shows summary when ready, modal always works on tap
    console.log('[Credit Manager] 👆 User tapped tile - opening modal (session ready after user interaction)');

    if (api.action?.presentModal) {
      api.action.presentModal();
    }
  };

  const buildSubtitle = () => {
    if (isLoading) {
      return 'Connecting...';
    }
    if (error) {
      // User-friendly error messages - always emphasize that tapping will open the full manager
      // Modal works reliably even when tile fails (device wakes from idle on user interaction)
      return error; // Already formatted as "Tap to open - ..." from loadMetrics
    }
    if (totalCredits > 0) {
      return `${activeCredits} active • ${totalCredits} total`;
    }
    return 'Tap to manage credits';
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