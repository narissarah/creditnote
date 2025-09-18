import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const CreditManagerTile = () => {
  const api = useApi();
  const [totalCredits, setTotalCredits] = useState(0);
  const [activeCredits, setActiveCredits] = useState(0);

  // Use Vercel production URL for POS extension access

  const loadMetrics = useCallback(async () => {
    try {
      console.log('[Credit Manager] Testing network connectivity...');
      console.log('[Credit Manager] Shop domain:', api.shop?.domain || 'fallback: arts-kardz.myshopify.com');
      console.log('[Credit Manager] Location ID:', api.location?.id);
      console.log('[Credit Manager] API object:', api);

      // CRITICAL FIX: Always use arts-kardz.myshopify.com as the shop domain
      // Since api.shop?.domain is unreliable in POS extensions
      const shopDomain = 'arts-kardz.myshopify.com';
      console.log('[Credit Manager] Using hardcoded shop domain:', shopDomain);

      const response = await fetch(`https://creditnote-41ur.vercel.app/api/pos/credit-notes/list?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shopDomain,
          'X-Shopify-Location-Id': api.location?.id || '',
        },
      });

      console.log('[Credit Manager] Response received. Status:', response.status);
      console.log('[Credit Manager] Response headers:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('[Credit Manager] Response data:', data);

        const activeCount = data.data?.filter((credit: any) =>
          credit.status === 'active' || credit.status === 'partially_used'
        ).length || 0;

        console.log('[Credit Manager] Total credits:', data.total);
        console.log('[Credit Manager] Active credits:', activeCount);

        setTotalCredits(data.total || 0);
        setActiveCredits(activeCount);
      } else {
        const errorText = await response.text();
        console.error('[Credit Manager] API Error:', response.status, errorText);
        console.error('[Credit Manager] Error response body:', errorText);
      }
    } catch (error) {
      console.error('[Credit Manager] Network error or exception:', error);
      console.error('[Credit Manager] Error type:', typeof error);
      console.error('[Credit Manager] Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('[Credit Manager] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  }, [api.shop?.domain, api.location?.id]);

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
    if (totalCredits > 0) {
      return `${activeCredits} active • ${totalCredits} total`;
    }
    // DIAGNOSTIC: Show that hardcoded fix is deployed
    return 'Fixed v22eb09c - Hardcoded domain';
  };

  return (
    <Tile
      title="💳 Manager [v51cd334]"
      subtitle={buildSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={activeCredits > 0 ? activeCredits : undefined}
      destructive={false}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CreditManagerTile />);