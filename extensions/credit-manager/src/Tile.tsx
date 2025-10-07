import React, { useState, useEffect } from 'react';
import {
  Tile,
  reactExtension,
  useApi,
} from '@shopify/ui-extensions-react/point-of-sale';

// Credit Manager Tile - Entry point for credit notes management
// Shows total active credits and allows navigation to management interface

const CreditManagerTile = () => {
  const api = useApi();
  const [credits, setCredits] = useState({ total: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCreditsSummary();
  }, []);

  const loadCreditsSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get session token for authentication
      const sessionToken = await api.session.getSessionToken();
      const shopDomain = api.session.currentSession?.shopDomain;

      console.log('[Credit Manager Tile] Loading credits summary:', { shopDomain });

      const response = await fetch('https://creditnote.vercel.app/api/credit-notes/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Shopify-Shop-Domain': shopDomain || '',
        },
        body: JSON.stringify({ limit: 1000 }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const creditNotes = data.creditNotes || [];

      // Calculate active vs total
      const activeCreds = creditNotes.filter((cn: any) =>
        cn.status === 'active' || cn.status === 'ACTIVE'
      );

      setCredits({
        total: creditNotes.length,
        active: activeCreds.length,
      });

      console.log('[Credit Manager Tile] Credits loaded:', {
        total: creditNotes.length,
        active: activeCreds.length,
      });
    } catch (err: any) {
      console.error('[Credit Manager Tile] Failed to load credits:', err);
      setError(err.message || 'Failed to load credits');
    } finally {
      setLoading(false);
    }
  };

  const handlePress = () => {
    console.log('[Credit Manager Tile] Opening credit manager modal');
    api.ui.modal.navigate({
      target: 'credit-manager-modal',
    });
  };

  const getSubtitle = () => {
    if (loading) return 'Loading...';
    if (error) return 'Tap to retry';
    return `${credits.active} active / ${credits.total} total`;
  };

  return (
    <Tile
      title="Manage Credits"
      subtitle={getSubtitle()}
      onPress={handlePress}
      enabled={!loading}
      badgeValue={credits.active > 0 ? credits.active : undefined}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CreditManagerTile />);
