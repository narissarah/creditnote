import React, { useState, useEffect } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const CreditManagerTile = () => {
  console.log('=== FRESH BUILD - 2025-10-07 22:05 UTC ===');
  console.log('[Credit Manager] Extension loaded successfully');

  const api = useApi();
  const [credits, setCredits] = useState({ total: 0, active: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCredits();
  }, []);

  const loadCredits = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('[Credit Manager] Fetching credits...');

      // Get shop domain from POS session
      const shopDomain = api?.session?.currentSession?.shopDomain;
      console.log('[Credit Manager] Shop domain:', shopDomain);

      // Get session token
      let sessionToken = null;
      if (typeof api?.session?.getSessionToken === 'function') {
        sessionToken = await api.session.getSessionToken();
        console.log('[Credit Manager] Session token obtained:', sessionToken ? 'YES' : 'NO');
      }

      // Build request headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      if (shopDomain) {
        headers['X-Shopify-Shop-Domain'] = shopDomain;
      }

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
      console.log('[Credit Manager] API response:', data);

      if (data.success && Array.isArray(data.data)) {
        const total = data.total || 0;
        const active = data.data.filter((c: any) =>
          c.status === 'active' || c.status === 'partially_used'
        ).length;

        setCredits({ total, active });
        setError(null);
        console.log('[Credit Manager] Loaded:', { total, active });
      } else {
        setError('Tap to open');
        console.error('[Credit Manager] API error:', data.error);
      }
    } catch (err) {
      setError('Tap to open');
      console.error('[Credit Manager] Exception:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    console.log('[Credit Manager] Tile tapped - opening modal');
    if (api?.action?.presentModal) {
      api.action.presentModal();
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
