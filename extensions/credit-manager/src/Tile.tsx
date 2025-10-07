import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const CreditManagerTile = () => {
  console.log('=== CREDIT MANAGER V126 - 2025-10-07 22:45 UTC ===');

  const api = useApi();
  const [credits, setCredits] = useState({ total: 0, active: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCredits = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[Credit Manager] Starting to load credits...');
      console.log('[Credit Manager] API available:', !!api);
      console.log('[Credit Manager] API keys:', api ? Object.keys(api) : []);

      // Try to get shop domain
      let shopDomain = null;
      try {
        shopDomain = api?.session?.currentSession?.shopDomain;
        console.log('[Credit Manager] Shop domain:', shopDomain);
      } catch (e) {
        console.log('[Credit Manager] Could not get shop domain:', e);
      }

      // Try to get session token
      let sessionToken = null;
      try {
        if (typeof api?.session?.getSessionToken === 'function') {
          sessionToken = await api.session.getSessionToken();
          console.log('[Credit Manager] Got session token:', !!sessionToken);
        } else {
          console.log('[Credit Manager] getSessionToken not available');
        }
      } catch (e) {
        console.log('[Credit Manager] Could not get session token:', e);
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      if (shopDomain) {
        headers['X-Shopify-Shop-Domain'] = shopDomain;
      }

      console.log('[Credit Manager] Making API request with headers:', Object.keys(headers));

      // Call API
      const response = await fetch('https://creditnote.vercel.app/api/pos/credit-notes/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
      });

      const data = await response.json();
      console.log('[Credit Manager] API response status:', response.status);
      console.log('[Credit Manager] API response success:', data.success);

      if (data.success && Array.isArray(data.data)) {
        const total = data.total || 0;
        const active = data.data.filter((c: any) =>
          c.status === 'active' || c.status === 'partially_used'
        ).length;

        setCredits({ total, active });
        setError(null);
        console.log('[Credit Manager] Successfully loaded credits:', { total, active });
      } else {
        setError('Tap to open');
        console.log('[Credit Manager] API returned error or no data');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Credit Manager] Error loading credits:', errorMsg);
      setError('Tap to open');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const handlePress = () => {
    console.log('[Credit Manager] Tile pressed - opening modal');
    if (api?.action?.presentModal) {
      api.action.presentModal();
    } else {
      console.error('[Credit Manager] presentModal not available');
    }
  };

  const getSubtitle = () => {
    if (isLoading) return 'Loading...';
    if (error) return error;
    if (credits.total > 0) return `${credits.active} active • ${credits.total} total`;
    return 'Tap to manage';
  };

  return (
    <Tile
      title="Manage Credits"
      subtitle={getSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={credits.active > 0 ? credits.active : undefined}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CreditManagerTile />);
