import React, { useState, useEffect, useCallback } from 'react';
import {
  Screen,
  ScrollView,
  Navigator,
  Button,
  Text,
  List,
  Section,
  reactExtension,
  useApi
} from '@shopify/ui-extensions-react/point-of-sale';

const CreditManagerModal = () => {
  console.log('[Credit Manager Modal] V126 Loaded');

  const api = useApi();
  const [credits, setCredits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadCredits = useCallback(async () => {
    try {
      setIsLoading(true);

      console.log('[Modal] Loading credits...');

      // Try to get shop domain
      let shopDomain = null;
      try {
        shopDomain = api?.session?.currentSession?.shopDomain;
      } catch (e) {
        console.log('[Modal] Could not get shop domain');
      }

      // Try to get session token
      let sessionToken = null;
      try {
        if (typeof api?.session?.getSessionToken === 'function') {
          sessionToken = await api.session.getSessionToken();
        }
      } catch (e) {
        console.log('[Modal] Could not get session token');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      if (shopDomain) {
        headers['X-Shopify-Shop-Domain'] = shopDomain;
      }

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

      if (data.success && Array.isArray(data.data)) {
        setCredits(data.data);
        console.log('[Modal] Loaded', data.data.length, 'credits');
      } else {
        console.log('[Modal] No credits loaded');
      }
    } catch (err) {
      console.error('[Modal] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  const handleClose = () => {
    if (api?.action?.dismissModal) {
      api.action.dismissModal();
    }
  };

  return (
    <Navigator>
      <Screen name="CreditList" title="Credit Notes">
        <ScrollView>
          <Section>
            {isLoading ? (
              <Text>Loading credits...</Text>
            ) : credits.length === 0 ? (
              <Text>No credit notes found</Text>
            ) : (
              <List>
                {credits.map((credit) => (
                  <List.Item
                    key={credit.id}
                    title={credit.customerName || 'Unknown Customer'}
                    subtitle={`${credit.code} • $${credit.remainingBalance || credit.amount} • ${credit.status}`}
                  />
                ))}
              </List>
            )}
          </Section>
          <Section>
            <Button title="Close" onPress={handleClose} />
          </Section>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.home.modal.render', () => <CreditManagerModal />);
