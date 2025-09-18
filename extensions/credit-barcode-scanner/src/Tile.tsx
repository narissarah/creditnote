import React, { useState, useEffect, useCallback } from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

const BarcodeScannerTile = () => {
  const api = useApi();
  const [activeCredits, setActiveCredits] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  // Use Vercel production URL for POS extension access

  const loadMetrics = useCallback(async () => {
    try {
      console.log('[Redeem] Loading metrics from:', 'https://creditnote-41ur.vercel.app/api/pos/credit-notes/list');
      console.log('[Redeem] Full API object:', api);
      console.log('[Redeem] Shop object:', api.shop);
      console.log('[Redeem] Shop domain:', api.shop?.domain);
      console.log('[Redeem] Location object:', api.location);

      // CRITICAL FIX: Always use arts-kardz.myshopify.com as the shop domain
      // Since api.shop?.domain is unreliable in POS extensions
      const shopDomain = 'arts-kardz.myshopify.com';
      console.log('[Redeem] Using hardcoded shop domain:', shopDomain);

      const response = await fetch(`https://creditnote-41ur.vercel.app/api/pos/credit-notes/list?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Shop-Domain': shopDomain,
          'X-Shopify-Location-Id': api.location?.id || '',
        },
      });

      console.log('[Redeem] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Redeem] Response data:', data);

        const activeCount = data.data?.filter((credit: any) =>
          credit.status === 'active' || credit.status === 'partially_used'
        ).length || 0;

        const totalAmount = data.data?.reduce((sum: number, credit: any) => {
          if (credit.status === 'active' || credit.status === 'partially_used') {
            return sum + parseFloat(credit.remainingAmount || '0');
          }
          return sum;
        }, 0) || 0;

        console.log('[Redeem] Active credits:', activeCount);
        console.log('[Redeem] Total value:', totalAmount);

        setActiveCredits(activeCount);
        setTotalValue(totalAmount);
      } else {
        const errorText = await response.text();
        console.error('[Redeem] API Error:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Redeem] Failed to load metrics:', error);
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
    if (activeCredits > 0) {
      return `${activeCredits} active • $${totalValue.toFixed(2)} value`;
    }
    // DIAGNOSTIC: Show that hardcoded fix is deployed
    return 'Fixed v22eb09c - Hardcoded domain';
  };

  return (
    <Tile
      title="Redeem"
      subtitle={buildSubtitle()}
      onPress={handlePress}
      enabled={true}
      badgeValue={activeCredits > 0 ? activeCredits : undefined}
      destructive={false}
    />
  );
};

export default reactExtension('pos.home.tile.render', () => <BarcodeScannerTile />);