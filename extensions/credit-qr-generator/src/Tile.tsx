import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const QRGeneratorTile = () => {
  const api = useApi();
  const [todayGenerated, setTodayGenerated] = useState(0);
  const [totalActive, setTotalActive] = useState(0);

  // Use Vercel production URL for POS extension access

  const loadMetrics = useCallback(async () => {
    try {
      console.log('[QR Generator] Loading metrics from:', 'https://creditnote-41ur.vercel.app/api/pos/credit-notes/list');
      console.log('[QR Generator] Shop domain:', api.shop?.domain);
      console.log('[QR Generator] Location ID:', api.location?.id);

      const response = await fetch(`https://creditnote-41ur.vercel.app/api/pos/credit-notes/list?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': api.shop?.domain || 'arts-kardz.myshopify.com',
          'X-Shopify-Location-Id': api.location?.id || '',
        },
      });

      console.log('[QR Generator] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[QR Generator] Response data:', data);

        const today = new Date().toDateString();

        const todayCount = data.data?.filter((credit: any) =>
          new Date(credit.createdAt).toDateString() === today
        ).length || 0;

        const activeCount = data.data?.filter((credit: any) =>
          credit.status === 'active' || credit.status === 'partially_used'
        ).length || 0;

        console.log('[QR Generator] Today generated:', todayCount);
        console.log('[QR Generator] Total active:', activeCount);

        setTodayGenerated(todayCount);
        setTotalActive(activeCount);
      } else {
        const errorText = await response.text();
        console.error('[QR Generator] API Error:', response.status, errorText);
      }
    } catch (error) {
      console.error('[QR Generator] Failed to load metrics:', error);
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
    if (todayGenerated > 0) {
      return `${todayGenerated} created today • ${totalActive} active`;
    }
    return `${totalActive} active credits • Create new`;
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