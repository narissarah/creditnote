import React, { useState, useEffect } from 'react';
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
  console.log('[Credit Manager Modal] Loaded');

  const api = useApi();
  const [credits, setCredits] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCredits();
  }, []);

  const loadCredits = async () => {
    try {
      setIsLoading(true);

      // Get shop domain
      const shopDomain = api?.session?.currentSession?.shopDomain;

      // Get session token
      let sessionToken = null;
      if (typeof api?.session?.getSessionToken === 'function') {
        sessionToken = await api.session.getSessionToken();
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
      }
    } catch (err) {
      console.error('[Credit Manager Modal] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

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
