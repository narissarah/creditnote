import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const CreditManagerTile = () => {
  const api = useApi();
  const [totalCredits, setTotalCredits] = useState(0);
  const [activeCredits, setActiveCredits] = useState(0);

  // Use Vercel production URL for POS extension access

  const loadMetrics = useCallback(async () => {
    try {
      console.log('[Credit Manager] Loading metrics from:', 'https://creditnote-41ur.vercel.app/api/pos/credit-notes/list');
      console.log('[Credit Manager] Shop domain:', api.shop?.domain);
      console.log('[Credit Manager] Location ID:', api.location?.id);

      const response = await fetch(`https://creditnote-41ur.vercel.app/api/pos/credit-notes/list?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': api.shop?.domain || 'arts-kardz.myshopify.com',
          'X-Shopify-Location-Id': api.location?.id || '',
        },
      });

      console.log('[Credit Manager] Response status:', response.status);

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
      }
    } catch (error) {
      console.error('[Credit Manager] Failed to load metrics:', error);
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
    return 'No credit notes found';
  };

  return (
    <Tile
      title="Credit Manager"
      subtitle={buildSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={activeCredits > 0 ? activeCredits : undefined}
      destructive={false}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <CreditManagerTile />);